// src/ruleOverlap.ts
// Helpers for detecting overlapping rules

import { ThemeRule } from './types';

const LANGUAGE_EXTENSIONS: Record<string, string[]> = {
    typescript: ['.ts'],
    typescriptreact: ['.tsx'],
    javascript: ['.js', '.mjs', '.cjs'],
    javascriptreact: ['.jsx'],
    python: ['.py', '.pyw'],
    java: ['.java'],
    csharp: ['.cs'],
    cpp: ['.cpp', '.cc', '.cxx', '.hpp', '.h'],
    c: ['.c', '.h'],
    go: ['.go'],
    rust: ['.rs'],
    ruby: ['.rb'],
    php: ['.php'],
    swift: ['.swift'],
    kotlin: ['.kt', '.kts'],
    dart: ['.dart'],
    json: ['.json'],
    jsonc: ['.jsonc'],
    yaml: ['.yaml', '.yml'],
    markdown: ['.md', '.markdown'],
    html: ['.html', '.htm'],
    css: ['.css'],
    scss: ['.scss'],
    less: ['.less'],
    xml: ['.xml'],
    sql: ['.sql'],
    shellscript: ['.sh', '.bash', '.zsh'],
    powershell: ['.ps1'],
    vue: ['.vue'],
    svelte: ['.svelte'],
    scala: ['.scala'],
    lua: ['.lua'],
    r: ['.r'],
    perl: ['.pl', '.pm'],
    haskell: ['.hs', '.lhs'],
    elixir: ['.ex', '.exs'],
    clojure: ['.clj', '.cljs', '.cljc'],
};

export function getRuleConditionKey(rule: ThemeRule): string {
    const when = rule.when;
    return [
        when.language ?? '',
        when.pattern ?? '',
        when.workspaceName ?? '',
        when.debugSession ?? '',
        when.debugType ?? '',
        when.testState ?? '',
        when.timerInterval?.toString() ?? '',
        when.viewMode ?? ''
    ].join('|||');
}

export function rulesMatchExactly(ruleA: ThemeRule, ruleB: ThemeRule): boolean {
    return rulesHaveIdenticalConditions(ruleA, ruleB) && ruleA.theme === ruleB.theme;
}

export function rulesHaveIdenticalConditions(ruleA: ThemeRule, ruleB: ThemeRule): boolean {
    return getRuleConditionKey(ruleA) === getRuleConditionKey(ruleB);
}

// * determine if two rules overlap in effect
export function rulesOverlap(ruleA: ThemeRule, ruleB: ThemeRule): boolean {
    if (ruleA === ruleB) {
        return false;
    }

    const whenA = ruleA.when;
    const whenB = ruleB.when;

    const isTimerA = whenA.timerInterval !== undefined;
    const isTimerB = whenB.timerInterval !== undefined;

    // timer-based rules are evaluated separately; they do not overlap with non-timer rules
    if (isTimerA !== isTimerB) {
        return false;
    }

    // exact duplicate: identical condition structure and values
    if (rulesHaveIdenticalConditions(ruleA, ruleB)) {
        return true;
    }

    // file-based conditions
    const hasLanguageA = Boolean(whenA.language);
    const hasLanguageB = Boolean(whenB.language);
    const hasPatternA = Boolean(whenA.pattern);
    const hasPatternB = Boolean(whenB.pattern);
    const hasWorkspaceA = Boolean(whenA.workspaceName);
    const hasWorkspaceB = Boolean(whenB.workspaceName);

    // context compatibility: treat undefined as a wildcard ("any")
    const contextsCompatible =
        (!whenA.debugSession || !whenB.debugSession || whenA.debugSession === whenB.debugSession) &&
        (!whenA.debugType || !whenB.debugType || whenA.debugType === whenB.debugType) &&
        (!whenA.testState || !whenB.testState || whenA.testState === whenB.testState) &&
        (!whenA.timerInterval || !whenB.timerInterval || whenA.timerInterval === whenB.timerInterval) &&
        (!whenA.viewMode || !whenB.viewMode || whenA.viewMode === whenB.viewMode);

    if (!contextsCompatible) {
        return false;
    }

    // check high-level compatibility before deeper overlap heuristics
    const languageCompatible = !whenA.language || !whenB.language || whenA.language === whenB.language;
    const workspaceCompatible = !whenA.workspaceName || !whenB.workspaceName || whenA.workspaceName === whenB.workspaceName;

    if (!languageCompatible || !workspaceCompatible) {
        return false;
    }

    // consider overlap when patterns are missing, equal, or likely subsets
    const patternsLikelyOverlap =
        !whenA.pattern ||
        !whenB.pattern ||
        whenA.pattern === whenB.pattern ||
        whenA.pattern.includes(whenB.pattern) ||
        whenB.pattern.includes(whenA.pattern);

    if (patternsLikelyOverlap) {
        return true;
    }

    // functional overlap between language-only and pattern-only rules (e.g., python vs **/*.py)
    if (contextsCompatible && whenA.language && whenB.pattern && !whenB.language) {
        if (isLanguagePatternOverlap(whenA.language, whenB.pattern)) {
            return true;
        }
    }

    if (contextsCompatible && whenB.language && whenA.pattern && !whenA.language) {
        if (isLanguagePatternOverlap(whenB.language, whenA.pattern)) {
            return true;
        }
    }

    return false;
}

// * find existing rules that overlap w/ the provided target rule
export function findOverlappingRules(target: ThemeRule, existingRules: ThemeRule[]): ThemeRule[] {
    return existingRules.filter(rule => rule !== target && rulesOverlap(target, rule));
}

// * build a symmetric overlap map w/o double-counting pairs
export function buildOverlapMap(rules: ThemeRule[]): Map<number, ThemeRule[]> {
    const overlapSets = new Map<number, Set<number>>();

    for (let i = 0; i < rules.length; i++) {
        for (let j = i + 1; j < rules.length; j++) {
            if (rulesOverlap(rules[i], rules[j])) {
                if (!overlapSets.has(i)) {
                    overlapSets.set(i, new Set<number>());
                }
                if (!overlapSets.has(j)) {
                    overlapSets.set(j, new Set<number>());
                }
                overlapSets.get(i)!.add(j);
                overlapSets.get(j)!.add(i);
            }
        }
    }

    const overlapMap = new Map<number, ThemeRule[]>();
    for (const [index, neighbors] of overlapSets.entries()) {
        overlapMap.set(index, Array.from(neighbors.values()).map(i => rules[i]));
    }

    return overlapMap;
}

// helper to detect if a pattern likely targets files of a given language
function isLanguagePatternOverlap(language: string, pattern: string): boolean {
    const extensions = LANGUAGE_EXTENSIONS[language.toLowerCase()];
    if (!extensions) {
        return false;
    }

    const normalizedPattern = pattern.toLowerCase();

    return extensions.some(ext =>
        normalizedPattern.includes(`*${ext}`) ||
        normalizedPattern.endsWith(ext));
}
