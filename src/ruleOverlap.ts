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

// * determine if two rules overlap in effect
export function rulesOverlap(ruleA: ThemeRule, ruleB: ThemeRule): boolean {
    if (ruleA === ruleB) {
        return false;
    }

    const whenA = ruleA.when;
    const whenB = ruleB.when;

    const hasLanguageA = Boolean(whenA.language);
    const hasLanguageB = Boolean(whenB.language);
    const hasPatternA = Boolean(whenA.pattern);
    const hasPatternB = Boolean(whenB.pattern);
    const hasWorkspaceA = Boolean(whenA.workspaceName);
    const hasWorkspaceB = Boolean(whenB.workspaceName);

    const sameLanguage = whenA.language && whenB.language && whenA.language === whenB.language;
    const samePattern = whenA.pattern && whenB.pattern && whenA.pattern === whenB.pattern;
    const sameWorkspace = whenA.workspaceName && whenB.workspaceName && whenA.workspaceName === whenB.workspaceName;

    // exact duplicate: identical condition structure and values
    if (hasLanguageA === hasLanguageB &&
        hasPatternA === hasPatternB &&
        hasWorkspaceA === hasWorkspaceB) {
        const conditionsMatch =
            (!hasLanguageA || sameLanguage) &&
            (!hasPatternA || samePattern) &&
            (!hasWorkspaceA || sameWorkspace);

        if (conditionsMatch) {
            return true;
        }
    }

    // functional overlap between language-only and pattern-only rules (e.g., python vs **/*.py)
    if (whenA.language && whenB.pattern && !whenB.language) {
        if (isLanguagePatternOverlap(whenA.language, whenB.pattern)) {
            return true;
        }
    }

    if (whenB.language && whenA.pattern && !whenA.language) {
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
