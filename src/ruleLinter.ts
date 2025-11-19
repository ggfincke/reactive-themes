// src/ruleLinter.ts
// Rule linting and validation for detecting unreachable, duplicate, and invalid rules

import * as vscode from "vscode";
import { ThemeRule } from "./types";
import {
    getPatternMatches,
    getRuleConditionKey,
    patternsActuallyOverlap,
    rulesOverlap,
} from "./ruleOverlap";
import { matchGlobPattern } from "./ruleEngine";
import { getInstalledThemes } from "./themeCatalog";
import { validateGlobPattern } from "./utils/validators";

// rule specificity scoring constants (higher = more specific, wins in first-match evaluation)
const SPECIFICITY_WORKSPACE_NAME = 100; // exact workspace match is most specific
const SPECIFICITY_LANGUAGE_AND_PATTERN = 50; // both language & pattern specified
const SPECIFICITY_LANGUAGE_ONLY = 20; // language ID match
const SPECIFICITY_PATTERN_BASE = 10; // base score for glob pattern
const SPECIFICITY_PATTERN_PER_SEGMENT = 5; // bonus per path segment in pattern
const SPECIFICITY_PATTERN_EXTENSION = 10; // bonus for specific file extension
const SPECIFICITY_PATTERN_KEYWORD = 5; // bonus for test/spec keywords

export type LintSeverity = "error" | "warning" | "info";

export interface LintIssue {
    severity: LintSeverity;
    type:
        | "unreachable"
        | "duplicate"
        | "invalid-pattern"
        | "invalid-language"
        | "missing-theme"
        | "reorder-suggestion";
    ruleIndex: number;
    rule: ThemeRule;
    message: string;
    relatedRuleIndices?: number[];
    suggestedFix?: {
        description: string;
        action: "delete" | "reorder" | "merge";
        targetIndices?: number[];
    };
}

export interface LintResult {
    issues: LintIssue[];
    stats: {
        errors: number;
        warnings: number;
        infos: number;
        total: number;
    };
}

// * main linting function - runs all checks
export async function lintRules(rules: ThemeRule[]): Promise<LintResult> {
    const issues: LintIssue[] = [];

    // check for exact duplicates
    issues.push(...findExactDuplicates(rules));

    // check for unreachable rules (shadowed by earlier rules)
    issues.push(...findUnreachableRules(rules));

    // check for invalid glob patterns
    issues.push(...findInvalidPatterns(rules));

    // check for potentially invalid language IDs
    issues.push(...(await findInvalidLanguages(rules)));

    // check for missing themes
    issues.push(...findMissingThemes(rules));

    // generate reordering suggestions
    issues.push(...generateReorderingSuggestions(rules));

    // calculate stats
    const stats = {
        errors: issues.filter((i) => i.severity === "error").length,
        warnings: issues.filter((i) => i.severity === "warning").length,
        infos: issues.filter((i) => i.severity === "info").length,
        total: issues.length,
    };

    return { issues, stats };
}

// * find exact duplicate rules
function findExactDuplicates(rules: ThemeRule[]): LintIssue[] {
    const issues: LintIssue[] = [];
    const seen = new Map<string, number>();

    for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];
        const key = `${getRuleConditionKey(rule)}|||${rule.theme}`;

        if (seen.has(key)) {
            const originalIndex = seen.get(key)!;
            issues.push({
                severity: "error",
                type: "duplicate",
                ruleIndex: i,
                rule: rule,
                message: `Exact duplicate of rule #${originalIndex + 1} "${rules[originalIndex].name}"`,
                relatedRuleIndices: [originalIndex],
                suggestedFix: {
                    description: "Delete this duplicate rule",
                    action: "delete",
                    targetIndices: [i],
                },
            });
        } else {
            seen.set(key, i);
        }
    }

    return issues;
}

// * find unreachable rules (shadowed by earlier rules that always match)
function findUnreachableRules(rules: ThemeRule[]): LintIssue[] {
    const issues: LintIssue[] = [];

    for (let i = 1; i < rules.length; i++) {
        const currentRule = rules[i];
        const currentIsTimer = currentRule.when.timerInterval !== undefined;

        // check if any earlier rule makes this one unreachable
        for (let j = 0; j < i; j++) {
            const earlierRule = rules[j];
            const earlierIsTimer = earlierRule.when.timerInterval !== undefined;

            // timer rules should only be compared against other timer rules
            if (currentIsTimer !== earlierIsTimer) {
                continue;
            }

            // rule is unreachable if earlier rule overlaps AND has same or fewer conditions
            // (fewer conditions = more general = will always match first)
            if (isRuleShadowedBy(currentRule, earlierRule)) {
                issues.push({
                    severity: "warning",
                    type: "unreachable",
                    ruleIndex: i,
                    rule: currentRule,
                    message: `Unreachable: shadowed by earlier rule #${j + 1} "${earlierRule.name}"`,
                    relatedRuleIndices: [j],
                    suggestedFix: {
                        description: "Move this rule before the shadowing rule or delete it",
                        action: "reorder",
                        targetIndices: [i, j],
                    },
                });
                break; // only report first shadowing rule
            }
        }
    }

    return issues;
}

// * check if targetRule is completely shadowed by shadowingRule
function isRuleShadowedBy(targetRule: ThemeRule, shadowingRule: ThemeRule): boolean {
    // must overlap to shadow
    if (!rulesOverlap(targetRule, shadowingRule)) {
        return false;
    }

    const target = targetRule.when;
    const shadow = shadowingRule.when;

    // count ALL conditions (file-based AND context-based)
    const targetConditions = [
        target.language,
        target.pattern,
        target.workspaceName,
        target.debugSession,
        target.debugType,
        target.testState,
        target.viewMode,
        target.timerInterval !== undefined ? target.timerInterval : null,
    ].filter((v) => v !== null && v !== undefined).length;

    const shadowConditions = [
        shadow.language,
        shadow.pattern,
        shadow.workspaceName,
        shadow.debugSession,
        shadow.debugType,
        shadow.testState,
        shadow.viewMode,
        shadow.timerInterval !== undefined ? shadow.timerInterval : null,
    ].filter((v) => v !== null && v !== undefined).length;

    // shadowing rule must have fewer or equal conditions to be more general
    if (shadowConditions > targetConditions) {
        return false;
    }

    // FILE conditions (language, pattern, workspace): determine WHICH files match
    // if shadow is less restrictive on file conditions, it shadows target
    // e.g., shadow={ language: "typescript" } shadows target={ language: "typescript", pattern: "**/*.test.ts" }

    // check that every FILE condition in shadow is satisfied by target
    if (shadow.language && target.language !== shadow.language) {
        return false;
    }

    if (shadow.pattern) {
        // if shadow has a pattern, target must either have the same pattern
        // or have a more specific one that would match a subset
        const languageHint = target.language || shadow.language;
        if (!target.pattern || !isPatternSubset(target.pattern, shadow.pattern, languageHint)) {
            return false;
        }
    }

    if (shadow.workspaceName && target.workspaceName !== shadow.workspaceName) {
        return false;
    }

    // NOTE: for file conditions, if target has extra constraints (e.g., pattern when shadow doesn't),
    // target is MORE SPECIFIC file-wise, but still SHADOWED by the more general shadow.
    // This is different from context conditions below!

    // CONTEXT conditions (debug, test, view, timer): define WHEN rules apply
    // if target has extra context constraints, it's more specific TIME-wise and NOT shadowed
    // e.g., shadow={ language: "typescript" } does NOT shadow target={ language: "typescript", debugSession: "active" }

    // check context conditions
    if (shadow.debugSession) {
        // shadow specifies debug session, target must match
        if (target.debugSession !== shadow.debugSession) {
            return false;
        }
    } else {
        // shadow doesn't care about debug session
        // if target DOES care, it's more specific (active only in certain debug states)
        if (target.debugSession) {
            return false;
        }
    }

    if (shadow.debugType) {
        if (target.debugType !== shadow.debugType) {
            return false;
        }
    } else if (target.debugType) {
        return false;
    }

    if (shadow.testState) {
        if (target.testState !== shadow.testState) {
            return false;
        }
    } else if (target.testState) {
        return false;
    }

    if (shadow.viewMode) {
        if (target.viewMode !== shadow.viewMode) {
            return false;
        }
    } else if (target.viewMode) {
        return false;
    }

    if (shadow.timerInterval !== undefined) {
        if (target.timerInterval !== shadow.timerInterval) {
            return false;
        }
    } else if (target.timerInterval !== undefined) {
        return false;
    }

    // if we got here, shadow's conditions are a subset of (or equal to) target's
    // and shadow has fewer or equal conditions, so it shadows target
    return shadowConditions <= targetConditions;
}

// * check if patternA is a subset of (or equal to) patternB
// meaning: everything matched by A would also be matched by B
function isPatternSubset(patternA: string, patternB: string, language?: string): boolean {
    if (patternA === patternB) {
        return true;
    }

    const matchesA = getPatternMatches(patternA, language);
    const matchesB = getPatternMatches(patternB, language);

    if (matchesA.length === 0) {
        return false;
    }

    const isCovered = matchesA.every((path) => matchesB.includes(path));
    if (isCovered) {
        return true;
    }

    // fallback to overlap sampler so we don't rely on substring checks
    return patternsActuallyOverlap(patternA, patternB, language);
}

// * find rules with invalid glob patterns
function findInvalidPatterns(rules: ThemeRule[]): LintIssue[] {
    const issues: LintIssue[] = [];

    for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];
        if (rule.when.pattern) {
            const validationError = validateGlobPattern(rule.when.pattern);
            if (validationError) {
                issues.push({
                    severity: "error",
                    type: "invalid-pattern",
                    ruleIndex: i,
                    rule: rule,
                    message: `Invalid glob pattern: "${rule.when.pattern}" - ${validationError}`,
                });
                continue;
            }

            try {
                // test pattern with a dummy path - pattern must be defined here
                const pattern = rule.when.pattern;
                matchGlobPattern("/test/path/file.txt", pattern);
            } catch (error) {
                issues.push({
                    severity: "error",
                    type: "invalid-pattern",
                    ruleIndex: i,
                    rule: rule,
                    message: `Invalid glob pattern: "${rule.when.pattern}" - ${error instanceof Error ? error.message : "unknown error"}`,
                });
            }
        }
    }

    return issues;
}


// * find rules with potentially invalid language IDs
async function findInvalidLanguages(rules: ThemeRule[]): Promise<LintIssue[]> {
    const issues: LintIssue[] = [];
    const knownLanguages = await getKnownLanguageIds();

    for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];
        if (rule.when.language) {
            const langId = rule.when.language.toLowerCase();
            if (!knownLanguages.has(langId)) {
                issues.push({
                    severity: "info",
                    type: "invalid-language",
                    ruleIndex: i,
                    rule: rule,
                    message: `Unknown language ID: "${rule.when.language}" (may be valid if from an extension)`,
                });
            }
        }
    }

    return issues;
}

// * find rules referencing missing themes
function findMissingThemes(rules: ThemeRule[]): LintIssue[] {
    const issues: LintIssue[] = [];
    const installedThemes = getInstalledThemes();

    for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];
        // check both theme ID and label (like validateInstalledTheme in themeCatalog.ts)
        const themeExists = installedThemes.some(
            (theme) => theme.id === rule.theme || theme.label === rule.theme
        );

        if (!themeExists) {
            issues.push({
                severity: "error",
                type: "missing-theme",
                ruleIndex: i,
                rule: rule,
                message: `Theme "${rule.theme}" is not installed`,
            });
        }
    }

    return issues;
}

// * generate suggestions for reordering rules for better performance/clarity
function generateReorderingSuggestions(rules: ThemeRule[]): LintIssue[] {
    const issues: LintIssue[] = [];

    // suggestion: more specific rules should come before more general ones
    for (let i = 1; i < rules.length; i++) {
        const currentRule = rules[i];
        const currentSpecificity = getRuleSpecificity(currentRule);

        for (let j = 0; j < i; j++) {
            const earlierRule = rules[j];
            const earlierSpecificity = getRuleSpecificity(earlierRule);

            // if current rule is more specific than an earlier rule, suggest reordering
            if (currentSpecificity > earlierSpecificity && rulesOverlap(currentRule, earlierRule)) {
                issues.push({
                    severity: "info",
                    type: "reorder-suggestion",
                    ruleIndex: i,
                    rule: currentRule,
                    message: `More specific rule after more general rule #${j + 1} "${earlierRule.name}" - consider reordering`,
                    relatedRuleIndices: [j],
                    suggestedFix: {
                        description: "Move this rule before the more general rule",
                        action: "reorder",
                        targetIndices: [i, j],
                    },
                });
                break; // only report first occurrence
            }
        }
    }

    return issues;
}

// * calculate specificity score for a rule (higher = more specific)
function getRuleSpecificity(rule: ThemeRule): number {
    let score = 0;
    const when = rule.when;

    // workspace is most specific
    if (when.workspaceName) {
        score += SPECIFICITY_WORKSPACE_NAME;
    }

    // language + pattern is very specific
    if (when.language && when.pattern) {
        score += SPECIFICITY_LANGUAGE_AND_PATTERN;
    } else if (when.language) {
        // language-only is moderately specific
        score += SPECIFICITY_LANGUAGE_ONLY;
    } else if (when.pattern) {
        // pattern-only specificity depends on pattern complexity
        score += getPatternSpecificity(when.pattern);
    }

    return score;
}

// * estimate pattern specificity
function getPatternSpecificity(pattern: string): number {
    let score = SPECIFICITY_PATTERN_BASE; // base score for having a pattern

    // more path segments = more specific
    const segments = pattern.split("/").filter((s) => s && s !== "**");
    score += segments.length * SPECIFICITY_PATTERN_PER_SEGMENT;

    // specific file extensions are more specific than wildcards
    if (pattern.includes(".") && !pattern.endsWith(".*")) {
        score += SPECIFICITY_PATTERN_EXTENSION;
    }

    // patterns with "test" or specific keywords are more specific
    if (pattern.includes("test") || pattern.includes("spec")) {
        score += SPECIFICITY_PATTERN_KEYWORD;
    }

    return score;
}

// * get set of known VS Code language IDs
async function getKnownLanguageIds(): Promise<Set<string>> {
    // common built-in language IDs
    const knownLanguages = new Set([
        "typescript",
        "typescriptreact",
        "javascript",
        "javascriptreact",
        "python",
        "java",
        "csharp",
        "cpp",
        "c",
        "go",
        "rust",
        "ruby",
        "php",
        "swift",
        "kotlin",
        "dart",
        "json",
        "jsonc",
        "yaml",
        "markdown",
        "html",
        "css",
        "scss",
        "less",
        "xml",
        "sql",
        "shellscript",
        "powershell",
        "vue",
        "svelte",
        "scala",
        "lua",
        "r",
        "perl",
        "haskell",
        "elixir",
        "clojure",
        "coffeescript",
        "objective-c",
        "objective-cpp",
        "fsharp",
        "vb",
        "bat",
        "dockerfile",
        "makefile",
        "plaintext",
        "log",
        "ini",
        "toml",
        "diff",
        "git-commit",
        "git-rebase",
        "ignore",
        "properties",
        "jade",
        "handlebars",
        "razor",
        "latex",
        "bibtex",
        "groovy",
        "restructuredtext",
        "shaderlab",
        "hlsl",
        "glsl",
    ]);

    // attempt to get languages from VS Code API (if available)
    try {
        const languages = await vscode.languages.getLanguages();
        languages?.forEach((lang) => knownLanguages.add(lang.toLowerCase()));
    } catch (error) {
        // not available in all contexts
    }

    return knownLanguages;
}

// * group issues by type for display
export function groupIssuesByType(issues: LintIssue[]): Map<string, LintIssue[]> {
    const grouped = new Map<string, LintIssue[]>();

    for (const issue of issues) {
        const key = issue.type;
        if (!grouped.has(key)) {
            grouped.set(key, []);
        }
        grouped.get(key)!.push(issue);
    }

    return grouped;
}

// * get human-readable type label
export function getIssueTypeLabel(type: LintIssue["type"]): string {
    const labels: Record<LintIssue["type"], string> = {
        unreachable: "Unreachable Rules",
        duplicate: "Duplicate Rules",
        "invalid-pattern": "Invalid Patterns",
        "invalid-language": "Unknown Languages",
        "missing-theme": "Missing Themes",
        "reorder-suggestion": "Reordering Suggestions",
    };
    return labels[type] || type;
}

// * get icon for severity
export function getSeverityIcon(severity: LintSeverity): string {
    const icons: Record<LintSeverity, string> = {
        error: "$(error)",
        warning: "$(warning)",
        info: "$(info)",
    };
    return icons[severity];
}
