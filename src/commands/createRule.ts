// src/commands/createRule.ts
// Command for creating a new theme rule from the current file

import * as vscode from "vscode";
import * as path from "path";
import { ThemeRule } from "../types";
import { saveRule, loadConfig, updateRule } from "../config";
import { findOverlappingRules } from "../ruleOverlap";
import { selectTheme, confirmAction } from "./uiHelpers";
import { validateRuleName } from "../utils/validators";
import { formatRuleConditions } from "../utils/ruleFormatters";

// * create a new rule based on the current active editor
export async function createRuleFromCurrentFile(): Promise<void> {
    console.log("[Reactive Themes] Creating rule from current file");

    // check for active editor
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage("No active editor. Please open a file first.");
        return;
    }

    const document = editor.document;
    const languageId = document.languageId;
    const fileName = path.basename(document.fileName);
    const fileExtension = path.extname(fileName);

    // step 1: choose match type
    const matchType = await selectMatchType(languageId, fileName, fileExtension);
    if (!matchType) {
        return; // user cancelled
    }

    // step 2: select theme
    const selected = await selectTheme({
        title: "Create Rule: Step 2 of 3 - Choose Theme",
    });
    if (!selected) {
        return; // user cancelled
    }

    const selectedTheme = {
        name: selected.id || selected.label,
        displayName: selected.label,
    };

    // step 3: confirm and save
    await confirmAndSaveRule(matchType, selectedTheme);
}

// step 1: select match type (language or glob pattern)
async function selectMatchType(
    languageId: string,
    fileName: string,
    fileExtension: string
): Promise<{ type: "language" | "glob"; value: string; displayName: string } | undefined> {
    const items: vscode.QuickPickItem[] = [];

    // option 1: match by language
    if (languageId && languageId !== "plaintext") {
        items.push({
            label: `$(symbol-keyword) Language: ${languageId}`,
            description: "Match all files with this language",
            detail: `Will apply to all ${languageId} files`,
        });
    }

    // option 2: match by glob pattern (inferred from file extension)
    if (fileExtension) {
        const globPattern = `**/*${fileExtension}`;
        items.push({
            label: `$(file-code) Glob pattern: ${globPattern}`,
            description: "Match files by pattern",
            detail: `Will apply to all files matching ${globPattern}`,
        });
    } else {
        // fallback glob based on full filename
        const globPattern = `**/${fileName}`;
        items.push({
            label: `$(file-code) Glob pattern: ${globPattern}`,
            description: "Match files by pattern",
            detail: `Will apply to all files matching ${globPattern}`,
        });
    }

    // handle edge case: no useful match options
    if (items.length === 0) {
        vscode.window.showWarningMessage("Cannot infer match conditions from the current file.");
        return undefined;
    }

    const selected = await vscode.window.showQuickPick(items, {
        title: "Create Rule: Step 1 of 3 - Choose Match Type",
        placeHolder: "How should this rule match files?",
    });

    if (!selected) {
        return undefined;
    }

    // parse selection
    if (selected.label.includes("Language:")) {
        return {
            type: "language",
            value: languageId,
            displayName: `Language: ${languageId}`,
        };
    } else {
        const globPattern = fileExtension ? `**/*${fileExtension}` : `**/${fileName}`;
        return {
            type: "glob",
            value: globPattern,
            displayName: `Pattern: ${globPattern}`,
        };
    }
}

// step 3: confirm and save rule
async function confirmAndSaveRule(
    matchType: { type: "language" | "glob"; value: string; displayName: string },
    theme: { name: string; displayName: string }
): Promise<void> {
    // generate rule name
    const ruleName = await vscode.window.showInputBox({
        prompt: "Enter a name for this rule",
        placeHolder: 'e.g., "Dark theme for TypeScript"',
        value: `${theme.displayName} for ${matchType.displayName}`,
        validateInput: validateRuleName,
    });

    if (!ruleName) {
        return; // user cancelled
    }

    // build rule object
    const rule: ThemeRule = {
        name: ruleName.trim(),
        when:
            matchType.type === "language"
                ? { language: matchType.value }
                : { pattern: matchType.value },
        theme: theme.name,
    };

    // check for overlapping rules
    const config = loadConfig();
    const overlappingRules = findOverlappingRules(rule, config.rules);

    if (overlappingRules.length > 0) {
        // show warning about overlapping rules
        const overlapMessage =
            overlappingRules.length === 1
                ? `This rule overlaps with existing rule:\n"${overlappingRules[0].name}"`
                : `This rule overlaps with ${overlappingRules.length} existing rules:\n${overlappingRules.map((r) => `• "${r.name}"`).join("\n")}`;

        const action = await vscode.window.showWarningMessage(
            `Duplicate Rule Detected\n\n${overlapMessage}\n\nBecause rules use first-match-wins strategy, the new rule may never be applied.`,
            { modal: true },
            "Replace Existing",
            "Cancel"
        );

        if (action === "Cancel" || !action) {
            return;
        }

        if (action === "Replace Existing") {
            // if multiple overlaps, let user choose which to replace
            let ruleToReplace = overlappingRules[0];

            if (overlappingRules.length > 1) {
                const items = overlappingRules.map((r) => ({
                    label: r.name,
                    description: formatRuleConditions(r, { mode: "compact" }) as string,
                    rule: r,
                }));

                const selected = await vscode.window.showQuickPick(items, {
                    title: "Select Rule to Replace",
                    placeHolder: "Which rule should be replaced?",
                });

                if (!selected) {
                    return;
                }

                ruleToReplace = selected.rule;
            }

            // find index and replace
            const indexToReplace = config.rules.findIndex((r) => r === ruleToReplace);
            if (indexToReplace !== -1) {
                try {
                    await updateRule(indexToReplace, rule);
                    vscode.window.showInformationMessage(
                        `Rule "${ruleName}" replaced "${ruleToReplace.name}" successfully!`
                    );
                    console.log("[Reactive Themes] Rule replaced:", rule);
                } catch (error) {
                    console.error("[Reactive Themes] Failed to replace rule:", error);
                    vscode.window.showErrorMessage(
                        `Failed to replace rule "${ruleToReplace.name}": ${error instanceof Error ? error.message : String(error)}`
                    );
                }
            }
            return;
        }
    }

    // confirm with summary
    const matchInfo =
        matchType.type === "language"
            ? `Language: ${matchType.value}`
            : `Pattern: ${matchType.value}`;

    const confirmed = await confirmAction(
        `Create rule: [${matchInfo}] → [${theme.displayName}]`,
        {
            confirmLabel: "Save Rule",
            modal: true,
            severity: "info",
        }
    );

    if (!confirmed) {
        return;
    }

    // save the rule
    try {
        await saveRule(rule);
        vscode.window.showInformationMessage(`Rule "${ruleName}" created successfully!`);
        console.log("[Reactive Themes] Rule created:", rule);
    } catch (error) {
        // error already shown by saveRule helper
        console.error("[Reactive Themes] Failed to create rule:", error);
    }
}
