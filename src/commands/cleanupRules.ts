// src/commands/cleanupRules.ts
// Command for finding and removing duplicate/overlapping rules

import * as vscode from "vscode";
import { ThemeRule } from "../types";
import { loadConfig } from "../config";
import { lintRules, LintIssue } from "../ruleLinter";
import { confirmDeleteRule as confirmDeleteRulePrompt, deleteRules } from "../utils/ruleOperations";
import { handleOperationError } from "../utils/errorHandling";
import { confirmAction, showLintIssuePicker } from "./uiHelpers";

// * find & clean up duplicate/overlapping rules
export async function cleanupDuplicateRules(): Promise<void> {
    console.log("[Reactive Themes] Cleaning up duplicate rules");

    const config = loadConfig();

    if (config.rules.length === 0) {
        vscode.window.showInformationMessage("No rules configured yet.");
        return;
    }

    // reuse the linter so overlap/duplicate logic stays centralized
    const lintResult = await lintRules(config.rules);
    const cleanupCandidates = lintResult.issues.filter(
        (issue) => issue.type === "duplicate" || issue.type === "unreachable"
    );

    if (cleanupCandidates.length === 0) {
        vscode.window.showInformationMessage("No duplicate or overlapping rules found!");
        return;
    }

    await reviewLintIssues(config.rules, cleanupCandidates);
}

async function reviewLintIssues(rules: ThemeRule[], issues: LintIssue[]): Promise<void> {
    const duplicateCount = issues.filter((i) => i.type === "duplicate").length;
    const extraItems =
        duplicateCount > 0
            ? [
                  {
                      label: "$(trash) Delete All Duplicates",
                      description: `Remove ${duplicateCount} duplicate rule(s)`,
                      action: "delete-duplicates",
                  },
              ]
            : [];

    const selected = await showLintIssuePicker(issues, {
        title: `Duplicate/Overlapping Rules (${issues.length} total)`,
        placeHolder: "Select a rule to delete or choose bulk delete",
        extraItems,
    });

    if (!selected) {
        return;
    }

    if (selected.action === "delete-duplicates") {
        const duplicateIndices = issues
            .filter((i) => i.type === "duplicate")
            .map((i) => i.ruleIndex)
            .sort((a, b) => b - a);

        if (duplicateIndices.length === 0) {
            vscode.window.showInformationMessage("No duplicate rules to delete.");
            return;
        }

        const confirmed = await confirmAction(
            `Delete ${duplicateIndices.length} duplicate rule(s)?`,
            {
                confirmLabel: "Delete",
                modal: true,
                severity: "warning",
            }
        );
        if (!confirmed) {
            return;
        }

        try {
            await deleteRules(duplicateIndices);
            vscode.window.showInformationMessage(
                `Deleted ${duplicateIndices.length} duplicate rule(s)`
            );
        } catch (error) {
            handleOperationError("delete duplicate rules", error, { showUser: true });
        }
        return;
    }

    if (selected.issue) {
        const rule = rules[selected.issue.ruleIndex];
        const confirmed = await confirmDeleteRulePrompt(rule.name);

        if (confirmed) {
            try {
                await deleteRules([selected.issue.ruleIndex]);
                vscode.window.showInformationMessage(`Rule "${rule.name}" deleted successfully`);
            } catch (error) {
                handleOperationError("delete rule", error, { showUser: true });
            }
        }
    }
}
