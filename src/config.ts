// src/config.ts
// Configuration management & validation for Reactive Themes

import * as vscode from 'vscode';
import { ReactiveThemesConfig, ThemeRule } from './types';
import { validateInstalledTheme } from './themeCatalog';

// configuration section name
const CONFIG_SECTION = 'reactiveThemes';
export const DEFAULT_DEBOUNCE_MS = 300;

// load current configuration from VS Code settings
export function loadConfig(): ReactiveThemesConfig {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    const debounceMs = config.get<number>('debounceMs', DEFAULT_DEBOUNCE_MS);

    return {
        enabled: config.get<boolean>('enabled', true),
        rules: config.get<ThemeRule[]>('rules', []),
        defaultTheme: config.get<string>('defaultTheme'),
        debounceMs: typeof debounceMs === 'number' && debounceMs >= 0 ? debounceMs : DEFAULT_DEBOUNCE_MS
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

    // require at least one condition (file-based or context-based)
    const hasCondition = (
        rule.when.language !== undefined ||
        rule.when.pattern !== undefined ||
        rule.when.workspaceName !== undefined ||
        rule.when.debugSession !== undefined ||
        rule.when.debugType !== undefined ||
        rule.when.testState !== undefined ||
        rule.when.timerInterval !== undefined ||
        rule.when.viewMode !== undefined
    );

    // timer interval, if provided, must be positive
    const validTimer = rule.when.timerInterval === undefined || rule.when.timerInterval > 0;

    return Boolean(hasCondition && validTimer);
}

// * validate configuration & collect errors
export function validateConfig(config: ReactiveThemesConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (typeof config.debounceMs !== 'number' || config.debounceMs < 0) {
        errors.push('reactiveThemes.debounceMs must be a non-negative number');
    }

    if (!Array.isArray(config.rules)) {
        errors.push('reactiveThemes.rules must be an array');
        return { valid: false, errors };
    }

    config.rules.forEach((rule, index) => {
        if (!validateRule(rule)) {
            errors.push(`Rule at index ${index} is invalid: ${JSON.stringify(rule)}`);
            return;
        }

        const themeValidation = validateInstalledTheme(rule.theme);
        if (!themeValidation.valid && themeValidation.message) {
            errors.push(`Rule "${rule.name}": ${themeValidation.message}`);
        }
    });

    if (config.defaultTheme) {
        const validation = validateInstalledTheme(config.defaultTheme);
        if (!validation.valid && validation.message) {
            errors.push(validation.message);
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

function ensureThemeIsInstalled(themeName: string): void {
    const validation = validateInstalledTheme(themeName);
    if (!validation.valid) {
        throw new Error(validation.message);
    }
}

// * save a new rule to configuration
export async function saveRule(rule: ThemeRule): Promise<void> {
    try {
        ensureThemeIsInstalled(rule.theme);

        const config = loadConfig();
        config.rules.push(rule);

        const vscodeConfig = vscode.workspace.getConfiguration(CONFIG_SECTION);
        await vscodeConfig.update('rules', config.rules, vscode.ConfigurationTarget.Global);

        console.log('[Reactive Themes] Rule saved:', rule.name);
    } catch (error) {
        const message = `Failed to save rule: ${error instanceof Error ? error.message : String(error)}`;
        console.error('[Reactive Themes]', message);
        vscode.window.showErrorMessage(message);
        throw error;
    }
}

// * update an existing rule at a specific index
export async function updateRule(index: number, rule: ThemeRule): Promise<void> {
    try {
        ensureThemeIsInstalled(rule.theme);

        const config = loadConfig();

        if (index < 0 || index >= config.rules.length) {
            throw new Error(`Invalid rule index: ${index}`);
        }

        config.rules[index] = rule;

        const vscodeConfig = vscode.workspace.getConfiguration(CONFIG_SECTION);
        await vscodeConfig.update('rules', config.rules, vscode.ConfigurationTarget.Global);

        console.log('[Reactive Themes] Rule updated at index', index, ':', rule.name);
    } catch (error) {
        const message = `Failed to update rule: ${error instanceof Error ? error.message : String(error)}`;
        console.error('[Reactive Themes]', message);
        vscode.window.showErrorMessage(message);
        throw error;
    }
}

// * delete a rule at a specific index
export async function deleteRule(index: number): Promise<void> {
    try {
        const config = loadConfig();

        if (index < 0 || index >= config.rules.length) {
            throw new Error(`Invalid rule index: ${index}`);
        }

        const deletedRule = config.rules[index];
        config.rules.splice(index, 1);

        const vscodeConfig = vscode.workspace.getConfiguration(CONFIG_SECTION);
        await vscodeConfig.update('rules', config.rules, vscode.ConfigurationTarget.Global);

        console.log('[Reactive Themes] Rule deleted:', deletedRule.name);
    } catch (error) {
        const message = `Failed to delete rule: ${error instanceof Error ? error.message : String(error)}`;
        console.error('[Reactive Themes]', message);
        vscode.window.showErrorMessage(message);
        throw error;
    }
}
