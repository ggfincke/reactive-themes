// src/config.ts
// Configuration management & validation for Reactive Themes

import * as vscode from "vscode";
import { ReactiveThemesConfig, ThemeRule } from "./types";
import { validateInstalledTheme } from "./themeCatalog";
import { validateGlobPattern } from "./utils/validators";

// configuration section name
const CONFIG_SECTION = "reactiveThemes";
export const DEFAULT_DEBOUNCE_MS = 300;

const VALID_DEBUG_SESSION = new Set<ThemeRule["when"]["debugSession"]>(["active", "inactive"]);
const VALID_TEST_STATE = new Set<ThemeRule["when"]["testState"]>(["running", "failed", "passed", "none"]);
const VALID_VIEW_MODE = new Set<ThemeRule["when"]["viewMode"]>(["diff", "merge", "normal"]);

let currentConfig: ReactiveThemesConfig = readConfigFromWorkspace();

// ? mutex for config updates - prevents race conditions w/ concurrent read-modify-write ops
let configUpdatePromise: Promise<unknown> = Promise.resolve();
function queueConfigUpdate<T>(fn: () => Promise<T>): Promise<T> {
    // ensure the chain continues after failures without re-running the same fn twice
    configUpdatePromise = configUpdatePromise.catch(() => undefined).then(fn);
    return configUpdatePromise as Promise<T>;
}

function cloneConfig(config: ReactiveThemesConfig): ReactiveThemesConfig {
    return {
        ...config,
        rules: [...config.rules],
    };
}

// load current configuration from VS Code settings
function readConfigFromWorkspace(): ReactiveThemesConfig {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    const debounceMs = config.get<number>("debounceMs", DEFAULT_DEBOUNCE_MS);

    return {
        enabled: config.get<boolean>("enabled", true),
        rules: config.get<ThemeRule[]>("rules", []),
        defaultTheme: config.get<string>("defaultTheme"),
        debounceMs:
            typeof debounceMs === "number" && debounceMs >= 0 ? debounceMs : DEFAULT_DEBOUNCE_MS,
    };
}

// return cached configuration snapshot
export function loadConfig(): ReactiveThemesConfig {
    return cloneConfig(currentConfig);
}

// refresh cached configuration from workspace
export function refreshConfig(): ReactiveThemesConfig {
    currentConfig = readConfigFromWorkspace();
    return loadConfig();
}

function updateCachedRules(rules: ThemeRule[]): void {
    currentConfig = {
        ...currentConfig,
        rules: [...rules],
    };
}

// get current color theme from VS Code
export function getCurrentTheme(): string {
    const config = vscode.workspace.getConfiguration("workbench");
    return config.get<string>("colorTheme", "");
}

// set current color theme in VS Code
export async function setCurrentTheme(theme: string, global: boolean = true): Promise<void> {
    const config = vscode.workspace.getConfiguration("workbench");
    await config.update("colorTheme", theme, global);
}

// validate theme rule structure
export function getRuleValidationErrors(rule: ThemeRule): string[] {
    const errors: string[] = [];

    if (!rule.name || typeof rule.name !== "string") {
        errors.push("Rule name must be a non-empty string");
    }

    if (!rule.theme || typeof rule.theme !== "string") {
        errors.push("Rule theme must be a non-empty string");
    }

    if (!rule.when || typeof rule.when !== "object") {
        errors.push("Rule 'when' must be an object with at least one condition");
        return errors;
    }

    // require at least one condition (file-based or context-based)
    const hasCondition =
        rule.when.language !== undefined ||
        rule.when.pattern !== undefined ||
        rule.when.workspaceName !== undefined ||
        rule.when.debugSession !== undefined ||
        rule.when.debugType !== undefined ||
        rule.when.testState !== undefined ||
        rule.when.timerInterval !== undefined ||
        rule.when.viewMode !== undefined;

    if (!hasCondition) {
        errors.push("Rule must specify at least one condition in 'when'");
    }

    // timer interval, if provided, must be positive
    if (rule.when.timerInterval !== undefined) {
        if (typeof rule.when.timerInterval !== "number" || rule.when.timerInterval <= 0) {
            errors.push("Timer interval must be a positive number of minutes");
        } else if (rule.when.timerInterval > 720) {
            errors.push("Timer interval must be 720 minutes (12 hours) or less");
        }
    }

    if (rule.when.pattern) {
        const patternError = validateGlobPattern(rule.when.pattern);
        if (patternError) {
            errors.push(`Invalid glob pattern "${rule.when.pattern}": ${patternError}`);
        }
    }

    if (rule.when.debugSession && !VALID_DEBUG_SESSION.has(rule.when.debugSession)) {
        errors.push(
            `Invalid debugSession value "${rule.when.debugSession}" (allowed: ${Array.from(VALID_DEBUG_SESSION).join(", ")})`
        );
    }

    if (rule.when.testState && !VALID_TEST_STATE.has(rule.when.testState)) {
        errors.push(
            `Invalid testState value "${rule.when.testState}" (allowed: ${Array.from(VALID_TEST_STATE).join(", ")})`
        );
    }

    if (rule.when.viewMode && !VALID_VIEW_MODE.has(rule.when.viewMode)) {
        errors.push(
            `Invalid viewMode value "${rule.when.viewMode}" (allowed: ${Array.from(VALID_VIEW_MODE).join(", ")})`
        );
    }

    return errors;
}

export function validateRule(rule: ThemeRule): boolean {
    return getRuleValidationErrors(rule).length === 0;
}

// * validate configuration & collect errors
export function validateConfig(config: ReactiveThemesConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (typeof config.debounceMs !== "number" || config.debounceMs < 0) {
        errors.push("reactiveThemes.debounceMs must be a non-negative number");
    }

    if (!Array.isArray(config.rules)) {
        errors.push("reactiveThemes.rules must be an array");
        return { valid: false, errors };
    }

    config.rules.forEach((rule, index) => {
        const ruleErrors = getRuleValidationErrors(rule);
        if (ruleErrors.length > 0) {
            errors.push(`Rule at index ${index} is invalid: ${ruleErrors.join("; ")}`);
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
        errors,
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
    return queueConfigUpdate(async () => {
        try {
            ensureThemeIsInstalled(rule.theme);

            const config = loadConfig();
            const updatedRules = [...config.rules, rule];

            const vscodeConfig = vscode.workspace.getConfiguration(CONFIG_SECTION);
            await vscodeConfig.update("rules", updatedRules, vscode.ConfigurationTarget.Global);
            updateCachedRules(updatedRules);

            console.log("[Reactive Themes] Rule saved:", rule.name);
        } catch (error) {
            const message = `Failed to save rule: ${error instanceof Error ? error.message : String(error)}`;
            console.error("[Reactive Themes]", message);
            vscode.window.showErrorMessage(message);
            throw error;
        }
    });
}

// * update an existing rule at a specific index
export async function updateRule(index: number, rule: ThemeRule): Promise<void> {
    return queueConfigUpdate(async () => {
        try {
            ensureThemeIsInstalled(rule.theme);

            const config = loadConfig();

            if (index < 0 || index >= config.rules.length) {
                throw new Error(`Invalid rule index: ${index}`);
            }

            const updatedRules = [...config.rules];
            updatedRules[index] = rule;

            const vscodeConfig = vscode.workspace.getConfiguration(CONFIG_SECTION);
            await vscodeConfig.update("rules", updatedRules, vscode.ConfigurationTarget.Global);
            updateCachedRules(updatedRules);

            console.log("[Reactive Themes] Rule updated at index", index, ":", rule.name);
        } catch (error) {
            const message = `Failed to update rule: ${error instanceof Error ? error.message : String(error)}`;
            console.error("[Reactive Themes]", message);
            vscode.window.showErrorMessage(message);
            throw error;
        }
    });
}

// * delete a rule at a specific index
export async function deleteRule(index: number): Promise<void> {
    return queueConfigUpdate(async () => {
        try {
            const config = loadConfig();

            if (index < 0 || index >= config.rules.length) {
                throw new Error(`Invalid rule index: ${index}`);
            }

            const deletedRule = config.rules[index];
            const updatedRules = config.rules.filter((_, i) => i !== index);

            const vscodeConfig = vscode.workspace.getConfiguration(CONFIG_SECTION);
            await vscodeConfig.update("rules", updatedRules, vscode.ConfigurationTarget.Global);
            updateCachedRules(updatedRules);

            console.log("[Reactive Themes] Rule deleted:", deletedRule.name);
        } catch (error) {
            const message = `Failed to delete rule: ${error instanceof Error ? error.message : String(error)}`;
            console.error("[Reactive Themes]", message);
            vscode.window.showErrorMessage(message);
            throw error;
        }
    });
}

// * update all rules at once (for bulk operations like reordering)
export async function updateAllRules(rules: ThemeRule[]): Promise<void> {
    return queueConfigUpdate(async () => {
        try {
            const vscodeConfig = vscode.workspace.getConfiguration(CONFIG_SECTION);
            await vscodeConfig.update("rules", rules, vscode.ConfigurationTarget.Global);
            updateCachedRules(rules);

            console.log("[Reactive Themes] Bulk rule update completed:", rules.length, "rules");
        } catch (error) {
            const message = `Failed to update rules: ${error instanceof Error ? error.message : String(error)}`;
            console.error("[Reactive Themes]", message);
            vscode.window.showErrorMessage(message);
            throw error;
        }
    });
}
