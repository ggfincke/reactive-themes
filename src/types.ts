// src/types.ts
// Type definitions for Reactive Themes extension

// condition object defining when a rule should match
export interface RuleCondition {
    // File-based conditions
    language?: string;
    pattern?: string;
    workspaceName?: string;

    // Context-based conditions
    debugSession?: "active" | "inactive";
    debugType?: string;
    testState?: "running" | "failed" | "passed" | "none";
    timerInterval?: number; // minutes
    viewMode?: "diff" | "merge" | "normal";
}

// single theme rule mapping conditions to a theme
export interface ThemeRule {
    name: string;
    when: RuleCondition;
    theme: string;
}

// configuration settings for Reactive Themes extension
export interface ReactiveThemesConfig {
    enabled: boolean;
    rules: ThemeRule[];
    defaultTheme?: string;
    debounceMs: number;
}

// result of evaluating rules against current context
export interface RuleMatchResult {
    matched: boolean;
    rule?: ThemeRule;
    theme?: string;
}
