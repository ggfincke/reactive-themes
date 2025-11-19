// src/commands/manageRules.ts
// Command for managing existing theme rules

import * as vscode from "vscode";
import { ThemeRule } from "../types";
import { loadConfig, updateRule, deleteRule } from "../config";
import { buildOverlapMap } from "../ruleOverlap";
import { selectTheme, selectRule } from "./uiHelpers";
import { confirmDeleteRule as confirmDeleteRulePrompt } from "../utils/ruleOperations";
import {
    validateDebugType,
    validateGlobPattern,
    validateLanguageId,
    validateWorkspaceName,
    validateTimerInterval,
    validateRuleName,
} from "../utils/validators";
import { formatRuleConditions } from "../utils/ruleFormatters";
import { wrapAsyncOperation } from "../utils/errorHandling";

// * manage existing rules (view, edit, delete)
export async function manageRules(): Promise<void> {
    return wrapAsyncOperation(
        "manage rules",
        async () => {
            console.log("[Reactive Themes] Managing rules");

            const config = loadConfig();

            if (config.rules.length === 0) {
                const createNew = await vscode.window.showInformationMessage(
                    "No rules configured yet.",
                    "Create First Rule"
                );

                if (createNew === "Create First Rule") {
                    await vscode.commands.executeCommand("reactiveThemes.createRuleFromCurrentFile");
                }
                return;
            }

            // show list of rules
            const overlapsMap = buildOverlapMap(config.rules);
            const selectedRuleIndex = await selectRule(config.rules, {
                overlapsMap,
                includeFindDuplicatesItem: overlapsMap.size > 0,
                title: "Manage Rules - Select a Rule",
                placeHolder: "Choose a rule to manage",
            });
            if (selectedRuleIndex === undefined) {
                return; // user cancelled
            }

            if (selectedRuleIndex === -1) {
                await showDuplicateRules(config.rules, overlapsMap);
                return;
            }

            // show actions for selected rule
            await showRuleActions(selectedRuleIndex, config.rules[selectedRuleIndex]);
        },
        { showUser: true, rethrow: false }
    );
}

// show all duplicate/overlapping rules
async function showDuplicateRules(
    rules: ThemeRule[],
    overlapsMap: Map<number, ThemeRule[]>
): Promise<void> {
    const items: Array<vscode.QuickPickItem & { index: number }> = [];

    for (const [index, overlapping] of overlapsMap.entries()) {
        const rule = rules[index];
        items.push({
            label: `$(warning) ${rule.name}`,
            description: formatRuleConditions(rule, { mode: "compact" }) as string,
            detail: `Overlaps with: ${overlapping.map((r) => r.name).join(", ")}`,
            index: index,
        });
    }

    const selected = await vscode.window.showQuickPick(items, {
        title: `Duplicate/Overlapping Rules (${items.length} total)`,
        placeHolder: "Select a rule to manage or delete",
    });

    if (selected) {
        await showRuleActions(selected.index, rules[selected.index]);
    }
}

// show actions for a selected rule
async function showRuleActions(index: number, rule: ThemeRule): Promise<void> {
    const actions: vscode.QuickPickItem[] = [
        {
            label: "$(paintcan) Edit Theme",
            description: "Change the theme for this rule",
        },
        {
            label: "$(edit) Edit Match Conditions",
            description: "Change when this rule applies",
        },
        {
            label: "$(symbol-text) Rename Rule",
            description: "Change the rule name",
        },
        {
            label: "$(trash) Delete Rule",
            description: "Remove this rule permanently",
        },
    ];

    const selected = await vscode.window.showQuickPick(actions, {
        title: `Manage Rule: ${rule.name}`,
        placeHolder: "Choose an action",
    });

    if (!selected) {
        return; // user cancelled
    }

    // handle selected action
    if (selected.label.includes("Edit Theme")) {
        await editTheme(index, rule);
    } else if (selected.label.includes("Edit Match Conditions")) {
        await editMatchConditions(index, rule);
    } else if (selected.label.includes("Rename Rule")) {
        await renameRule(index, rule);
    } else if (selected.label.includes("Delete Rule")) {
        await deleteRuleWithConfirmation(index, rule);
    }
}

// edit the theme for a rule
async function editTheme(index: number, rule: ThemeRule): Promise<void> {
    const selected = await selectTheme({
        title: `Edit Theme for: ${rule.name}`,
        currentTheme: rule.theme,
    });

    if (!selected) {
        return;
    }

    const newThemeName = selected.id || selected.label;

    if (newThemeName === rule.theme) {
        vscode.window.showInformationMessage("Theme unchanged.");
        return;
    }

    // update rule
    const updatedRule: ThemeRule = {
        ...rule,
        theme: newThemeName,
    };

    try {
        await updateRule(index, updatedRule);
        vscode.window.showInformationMessage(`Theme updated to "${newThemeName}"`);
    } catch (error) {
        // error already shown by updateRule helper
    }
}

// edit match conditions for a rule
async function editMatchConditions(index: number, rule: ThemeRule): Promise<void> {
    // determine current match type
    const hasLanguage = Boolean(rule.when.language);
    const hasPattern = Boolean(rule.when.pattern);
    const hasWorkspace = Boolean(rule.when.workspaceName);
    const hasDebugSession = rule.when.debugSession !== undefined;
    const hasDebugType = rule.when.debugType !== undefined;
    const hasTestState = rule.when.testState !== undefined;
    const hasViewMode = rule.when.viewMode !== undefined;
    const hasTimer = rule.when.timerInterval !== undefined;

    const options: Array<
        vscode.QuickPickItem & {
            type:
                | "language"
                | "pattern"
                | "workspace"
                | "debugSession"
                | "debugType"
                | "testState"
                | "viewMode"
                | "timerInterval";
        }
    > = [
        {
            label: "$(symbol-keyword) Language",
            description: hasLanguage ? `Current: ${rule.when.language}` : "Not set",
            type: "language",
        },
        {
            label: "$(file-code) Glob Pattern",
            description: hasPattern ? `Current: ${rule.when.pattern}` : "Not set",
            type: "pattern",
        },
        {
            label: "$(folder) Workspace Name",
            description: hasWorkspace ? `Current: ${rule.when.workspaceName}` : "Not set",
            type: "workspace",
        },
        {
            label: "$(debug-alt) Debug Session",
            description: hasDebugSession ? `Current: ${rule.when.debugSession}` : "Any",
            type: "debugSession",
        },
        {
            label: "$(gear) Debug Type",
            description: hasDebugType ? `Current: ${rule.when.debugType}` : "Any",
            type: "debugType",
        },
        {
            label: "$(beaker) Test State",
            description: hasTestState ? `Current: ${rule.when.testState}` : "Any",
            type: "testState",
        },
        {
            label: "$(eye) View Mode",
            description: hasViewMode ? `Current: ${rule.when.viewMode}` : "Any",
            type: "viewMode",
        },
        {
            label: "$(clock) Timer Interval (minutes)",
            description: hasTimer ? `Current: ${rule.when.timerInterval}m` : "Not set",
            type: "timerInterval",
        },
    ];

    const selected = await vscode.window.showQuickPick(options, {
        title: `Edit Match Conditions: ${rule.name}`,
        placeHolder: "Choose a condition to edit",
    });

    if (!selected) {
        return;
    }

    // get new value
    let updatedRule: ThemeRule = {
        ...rule,
        when: {
            ...rule.when,
        },
    };

    if (selected.type === "language") {
        const action = await vscode.window.showQuickPick(
            [
                { label: "Specific language", value: "set" as const },
                { label: "Any language (clear condition)", value: "clear" as const },
            ],
            { title: "Language condition" }
        );
        if (!action) {
            return;
        }
        if (action.value === "clear") {
            updatedRule.when.language = undefined;
        } else {
            const newValue = await vscode.window.showInputBox({
                prompt: "Enter language ID (e.g., typescript, python, javascript)",
                placeHolder: "typescript",
                value: rule.when.language,
                validateInput: (value) => validateLanguageId(value, { allowEmpty: true }),
            });
            if (newValue === undefined) {
                return;
            }
            updatedRule.when.language = newValue.trim() || undefined;
        }
    } else if (selected.type === "pattern") {
        const action = await vscode.window.showQuickPick(
            [
                { label: "Specific glob pattern", value: "set" as const },
                { label: "Any path (clear condition)", value: "clear" as const },
            ],
            { title: "File pattern condition" }
        );
        if (!action) {
            return;
        }
        if (action.value === "clear") {
            updatedRule.when.pattern = undefined;
        } else {
            const newValue = await vscode.window.showInputBox({
                prompt: "Enter glob pattern (e.g., **/*.test.ts, **/*.config.js)",
                placeHolder: "**/*.ts",
                value: rule.when.pattern,
                validateInput: (value) => validateGlobPattern(value, { allowEmpty: true }),
            });
            if (newValue === undefined) {
                return;
            }
            updatedRule.when.pattern = newValue.trim() || undefined;
        }
    } else if (selected.type === "workspace") {
        const action = await vscode.window.showQuickPick(
            [
                { label: "Specific workspace name", value: "set" as const },
                { label: "Any workspace (clear condition)", value: "clear" as const },
            ],
            { title: "Workspace condition" }
        );
        if (!action) {
            return;
        }
        if (action.value === "clear") {
            updatedRule.when.workspaceName = undefined;
        } else {
            const newValue = await vscode.window.showInputBox({
                prompt: "Enter workspace name",
                placeHolder: "my-project",
                value: rule.when.workspaceName,
                validateInput: (value) => validateWorkspaceName(value, { allowEmpty: true }),
            });
            if (newValue === undefined) {
                return;
            }
            updatedRule.when.workspaceName = newValue.trim() || undefined;
        }
    } else if (selected.type === "debugSession") {
        const choice = await vscode.window.showQuickPick(
            [
                { label: "Any (clear debug condition)", value: undefined },
                { label: "Active", value: "active" as const },
                { label: "Inactive", value: "inactive" as const },
            ],
            { title: "Debug session condition" }
        );
        if (!choice) {
            return;
        }
        updatedRule.when.debugSession = choice.value;
        if (!choice.value) {
            updatedRule.when.debugType = undefined;
        }
    } else if (selected.type === "debugType") {
        const newValue = await vscode.window.showInputBox({
            prompt: "Enter debug type (e.g., node, python, chrome) or leave blank to clear",
            placeHolder: "node",
            value: rule.when.debugType,
            validateInput: (value) => (value?.trim() ? validateDebugType(value) : undefined),
        });
        if (newValue === undefined) {
            return;
        }
        updatedRule.when.debugType = newValue.trim() || undefined;
    } else if (selected.type === "testState") {
        const choice = await vscode.window.showQuickPick(
            [
                { label: "Any (clear test condition)", value: undefined },
                { label: "Running", value: "running" as const },
                { label: "Failed", value: "failed" as const },
                { label: "Passed", value: "passed" as const },
                { label: "None", value: "none" as const },
            ],
            { title: "Test execution state" }
        );
        if (!choice) {
            return;
        }
        updatedRule.when.testState = choice.value;
    } else if (selected.type === "viewMode") {
        const choice = await vscode.window.showQuickPick(
            [
                { label: "Any (clear view mode)", value: undefined },
                { label: "Diff", value: "diff" as const },
                { label: "Merge", value: "merge" as const },
                { label: "Normal", value: "normal" as const },
            ],
            { title: "Editor view mode" }
        );
        if (!choice) {
            return;
        }
        updatedRule.when.viewMode = choice.value;
    } else if (selected.type === "timerInterval") {
        const newValue = await vscode.window.showInputBox({
            prompt: "Enter timer interval in minutes (leave blank to clear)",
            placeHolder: "5",
            value: rule.when.timerInterval?.toString(),
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return undefined;
                }
                return validateTimerInterval(value);
            },
        });
        if (newValue === undefined) {
            return;
        }
        const trimmed = newValue.trim();
        updatedRule.when.timerInterval = trimmed ? parseInt(trimmed, 10) : undefined;
    }

    try {
        await updateRule(index, updatedRule);
        vscode.window.showInformationMessage(`Match condition updated successfully`);
    } catch (error) {
        // error already shown by updateRule helper
    }
}

// rename a rule
async function renameRule(index: number, rule: ThemeRule): Promise<void> {
    const newName = await vscode.window.showInputBox({
        prompt: "Enter a new name for this rule",
        value: rule.name,
        validateInput: validateRuleName,
    });

    if (!newName) {
        return;
    }

    if (newName.trim() === rule.name) {
        vscode.window.showInformationMessage("Name unchanged.");
        return;
    }

    const updatedRule: ThemeRule = {
        ...rule,
        name: newName.trim(),
    };

    try {
        await updateRule(index, updatedRule);
        vscode.window.showInformationMessage(`Rule renamed to "${newName.trim()}"`);
    } catch (error) {
        // error already shown by updateRule helper
    }
}

// confirm and delete a rule
async function deleteRuleWithConfirmation(index: number, rule: ThemeRule): Promise<void> {
    const confirmed = await confirmDeleteRulePrompt(rule.name);

    if (!confirmed) {
        return;
    }

    try {
        await deleteRule(index);
        vscode.window.showInformationMessage(`Rule "${rule.name}" deleted successfully`);
    } catch (error) {
        // error already shown by deleteRule helper
    }
}
