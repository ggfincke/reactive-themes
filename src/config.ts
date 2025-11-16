// src/config.ts
// Configuration management & validation for Reactive Themes

import * as vscode from 'vscode';
import { ReactiveThemesConfig, ThemeRule } from './types';

// configuration section name
const CONFIG_SECTION = 'reactiveThemes';

// load current configuration from VS Code settings
export function loadConfig(): ReactiveThemesConfig {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);

    return {
        enabled: config.get<boolean>('enabled', true),
        rules: config.get<ThemeRule[]>('rules', []),
        defaultTheme: config.get<string>('defaultTheme')
    };
}

// get current color theme from VS Code
export function getCurrentTheme(): string {
    const config = vscode.workspace.getConfiguration('workbench');
    return config.get<string>('colorTheme', '');
}

// set current color theme in VS Code
export async function setCurrentTheme(theme: string, global: boolean = true): Promise<void> {
    const config = vscode.workspace.getConfiguration('workbench');
    await config.update('colorTheme', theme, global);
}

// validate theme rule structure
export function validateRule(rule: ThemeRule): boolean {
    if (!rule.name || typeof rule.name !== 'string') {
        return false;
    }

    if (!rule.theme || typeof rule.theme !== 'string') {
        return false;
    }

    if (!rule.when || typeof rule.when !== 'object') {
        return false;
    }

    // require at least one condition
    const hasCondition = rule.when.language || rule.when.pattern || rule.when.workspaceName;
    return Boolean(hasCondition);
}

// * validate configuration & collect errors
export function validateConfig(config: ReactiveThemesConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!Array.isArray(config.rules)) {
        errors.push('reactiveThemes.rules must be an array');
        return { valid: false, errors };
    }

    config.rules.forEach((rule, index) => {
        if (!validateRule(rule)) {
            errors.push(`Rule at index ${index} is invalid: ${JSON.stringify(rule)}`);
        }
    });

    return {
        valid: errors.length === 0,
        errors
    };
}
