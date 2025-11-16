// src/types.ts
// Type definitions for Reactive Themes extension

// condition object defining when a rule should match
export interface RuleCondition {
    language?: string;
    pattern?: string;
    workspaceName?: string;
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
}

// result of evaluating rules against current context
export interface RuleMatchResult {
    matched: boolean;
    rule?: ThemeRule;
    theme?: string;
}
