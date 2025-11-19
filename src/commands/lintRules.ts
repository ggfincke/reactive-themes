// src/commands/lintRules.ts
// Command for linting rules and detecting unreachable/duplicate rules

import * as vscode from "vscode";
import { ThemeRule } from "../types";
import { loadConfig, deleteRule, refreshConfig } from "../config";
import {
    lintRules,
    groupIssuesByType,
    getIssueTypeLabel,
    getSeverityIcon,
    LintIssue,
    LintResult,
} from "../ruleLinter";
import {
    confirmDeleteRule,
    deleteRules,
    moveRule,
    reorderRules,
    RuleMove,
} from "../utils/ruleOperations";
import { getSharedOutputChannel, confirmAction, showLintIssuePicker, trackOutputChannel } from "./uiHelpers";
import { formatRuleConditions } from "../utils/ruleFormatters";
import { wrapAsyncOperation } from "../utils/errorHandling";

// * lint all rules and show results
export async function lintRulesCommand(): Promise<void> {
    await wrapAsyncOperation(
        "lint rules",
        async () => {
            console.log("[Reactive Themes] Linting rules");

            const config = loadConfig();

            if (config.rules.length === 0) {
                vscode.window.showInformationMessage("No rules to lint.");
                return;
            }

            // use shared output channel for detailed results
            const outputChannel = getSharedOutputChannel();

            // run linting
            const lintResult = await lintRules(config.rules);

            // show detailed results in output channel
            logLintResults(outputChannel, lintResult, config.rules);

            if (lintResult.issues.length === 0) {
                vscode.window.showInformationMessage("✓ No issues found! All rules are valid.");
                return;
            }

            // show summary and let user choose what to do
            await showLintSummary(lintResult, config.rules, outputChannel);
        },
        { showUser: true, rethrow: false }
    );
}

// * log detailed lint results to output channel
function logLintResults(
    outputChannel: vscode.OutputChannel,
    lintResult: LintResult,
    rules: ThemeRule[]
): void {
    outputChannel.clear();
    outputChannel.appendLine("═══════════════════════════════════════════════════════");
    outputChannel.appendLine("  REACTIVE THEMES - RULE LINT REPORT");
    outputChannel.appendLine("═══════════════════════════════════════════════════════");
    outputChannel.appendLine("");

    if (lintResult.issues.length === 0) {
        outputChannel.appendLine("✓ No issues found! All rules are valid.");
        outputChannel.appendLine("");
        return;
    }

    // show stats
    outputChannel.appendLine(`Total Issues: ${lintResult.stats.total}`);
    outputChannel.appendLine(`  Errors:   ${lintResult.stats.errors}`);
    outputChannel.appendLine(`  Warnings: ${lintResult.stats.warnings}`);
    outputChannel.appendLine(`  Info:     ${lintResult.stats.infos}`);
    outputChannel.appendLine("");

    // group issues by type
    const grouped = groupIssuesByType(lintResult.issues);

    for (const [type, issues] of grouped.entries()) {
        const label = getIssueTypeLabel(type as LintIssue["type"]);
        outputChannel.appendLine(`───────────────────────────────────────────────────────`);
        outputChannel.appendLine(`${label} (${issues.length})`);
        outputChannel.appendLine(`───────────────────────────────────────────────────────`);
        outputChannel.appendLine("");

        for (const issue of issues) {
            const severityLabel = issue.severity.toUpperCase().padEnd(7);
            outputChannel.appendLine(
                `[${severityLabel}] Rule #${issue.ruleIndex + 1}: "${issue.rule.name}"`
            );
            const conditions =
                formatRuleConditions(issue.rule, { mode: "compact" }) || "always";
            outputChannel.appendLine(`  Conditions: ${conditions}`);
            outputChannel.appendLine(`  Theme: ${issue.rule.theme}`);
            outputChannel.appendLine(`  Issue: ${issue.message}`);

            if (issue.relatedRuleIndices && issue.relatedRuleIndices.length > 0) {
                const relatedNames = issue.relatedRuleIndices
                    .map((idx) => `#${idx + 1} "${rules[idx].name}"`)
                    .join(", ");
                outputChannel.appendLine(`  Related: ${relatedNames}`);
            }

            if (issue.suggestedFix) {
                outputChannel.appendLine(`  Fix: ${issue.suggestedFix.description}`);
            }

            outputChannel.appendLine("");
        }
    }

    outputChannel.appendLine("═══════════════════════════════════════════════════════");
    outputChannel.show(true);
}

// * show lint summary and action menu
async function showLintSummary(
    lintResult: LintResult,
    rules: ThemeRule[],
    outputChannel: vscode.OutputChannel
): Promise<void> {
    const grouped = groupIssuesByType(lintResult.issues);

    // build menu items
    const items: Array<vscode.QuickPickItem & { action: string }> = [];

    // add "view all issues" option
    items.push({
        label: "$(output) View Detailed Report",
        description: `${lintResult.stats.total} issue(s) found`,
        detail: `Errors: ${lintResult.stats.errors}, Warnings: ${lintResult.stats.warnings}, Info: ${lintResult.stats.infos}`,
        action: "view-report",
    });

    items.push({
        label: "",
        description: "",
        detail: "",
        action: "separator",
        kind: vscode.QuickPickItemKind.Separator,
    });

    // add issue type categories
    for (const [type, issues] of grouped.entries()) {
        const firstIssue = issues[0];
        const icon = getSeverityIcon(firstIssue.severity);
        const label = getIssueTypeLabel(type as LintIssue["type"]);

        items.push({
            label: `${icon} ${label}`,
            description: `${issues.length} issue(s)`,
            detail: "Click to see details and fix options",
            action: `view-${type}`,
        });
    }

    // add auto-fix options if available
    const hasFixableIssues = lintResult.issues.some((i) => i.suggestedFix);
    if (hasFixableIssues) {
        items.push({
            label: "",
            description: "",
            detail: "",
            action: "separator2",
            kind: vscode.QuickPickItemKind.Separator,
        });

        const duplicates = lintResult.issues.filter((i) => i.type === "duplicate");
        if (duplicates.length > 0) {
            items.push({
                label: "$(trash) Delete All Duplicates",
                description: `Remove ${duplicates.length} duplicate rule(s)`,
                detail: "Automatically delete all exact duplicate rules",
                action: "fix-duplicates",
            });
        }

        const unreachable = lintResult.issues.filter((i) => i.type === "unreachable");
        if (unreachable.length > 0) {
            items.push({
                label: "$(warning) Review Unreachable Rules",
                description: `${unreachable.length} shadowed rule(s)`,
                detail: "Review and fix rules that will never match",
                action: "fix-unreachable",
            });
        }

        const reorderSuggestions = lintResult.issues.filter((i) => i.type === "reorder-suggestion");
        if (reorderSuggestions.length > 0) {
            items.push({
                label: "$(arrow-swap) Auto-Reorder Rules",
                description: `Optimize order of ${reorderSuggestions.length} rule(s)`,
                detail: "Automatically reorder rules by specificity",
                action: "fix-reorder",
            });
        }
    }

    const selected = await vscode.window.showQuickPick(items, {
        title: `Rule Lint Results - ${lintResult.stats.total} Issue(s) Found`,
        placeHolder: "Choose an action",
    });

    if (!selected || selected.action === "separator" || selected.action === "separator2") {
        return;
    }

    // handle actions
    if (selected.action === "view-report") {
        outputChannel.show(true);
    } else if (selected.action.startsWith("view-")) {
        const type = selected.action.replace("view-", "");
        const issues = grouped.get(type) || [];
        await showIssueDetails(issues, rules);
    } else if (selected.action === "fix-duplicates") {
        await fixDuplicates(lintResult.issues.filter((i) => i.type === "duplicate"));
    } else if (selected.action === "fix-unreachable") {
        await fixUnreachable(
            lintResult.issues.filter((i) => i.type === "unreachable"),
            rules
        );
    } else if (selected.action === "fix-reorder") {
        await autoReorderRules(
            lintResult.issues.filter((i) => i.type === "reorder-suggestion"),
            rules
        );
    }
}

// * show details for specific issue type
async function showIssueDetails(issues: LintIssue[], rules: ThemeRule[]): Promise<void> {
    const selected = await showLintIssuePicker(issues, {
        title: `${getIssueTypeLabel(issues[0].type)} - ${issues.length} Issue(s)`,
        placeHolder: "Select an issue to see fix options",
    });

    if (!selected?.issue) {
        return;
    }

    // show fix options for this issue
    await showFixOptions(selected.issue, rules);
}

// * show fix options for a specific issue
async function showFixOptions(issue: LintIssue, rules: ThemeRule[]): Promise<void> {
    const actions: vscode.QuickPickItem[] = [];

    if (issue.suggestedFix) {
        if (issue.suggestedFix.action === "delete") {
            actions.push({
                label: "$(trash) Delete This Rule",
                description: issue.suggestedFix.description,
            });
        } else if (issue.suggestedFix.action === "reorder") {
            actions.push({
                label: "$(arrow-swap) Reorder Rule",
                description: issue.suggestedFix.description,
            });
        }
    }

    actions.push({
        label: "$(go-to-file) View Rule",
        description: "Open settings to view this rule",
    });

    const selected = await vscode.window.showQuickPick(actions, {
        title: `Fix Issue: "${issue.rule.name}"`,
        placeHolder: "Choose an action",
    });

    if (!selected) {
        return;
    }

    if (selected.label.includes("Delete")) {
        await confirmDeleteSingleRule(issue.ruleIndex, issue.rule);
    } else if (selected.label.includes("Reorder")) {
        await reorderSingleRule(issue, rules);
    } else if (selected.label.includes("View")) {
        await vscode.commands.executeCommand(
            "workbench.action.openSettings",
            "reactiveThemes.rules"
        );
    }
}

// * auto-fix: delete all duplicate rules
async function fixDuplicates(duplicates: LintIssue[]): Promise<void> {
    if (duplicates.length === 0) {
        return;
    }

    const confirmed = await confirmAction(
        `Delete ${duplicates.length} duplicate rule(s)?`,
        {
            confirmLabel: "Delete All",
            modal: true,
            severity: "warning",
        }
    );

    if (!confirmed) {
        return;
    }

    try {
        const indicesToDelete = duplicates.map((d) => d.ruleIndex);
        await deleteRules(indicesToDelete);
        vscode.window.showInformationMessage(
            `Successfully deleted ${duplicates.length} duplicate rule(s)`
        );
    } catch (error) {
        vscode.window.showErrorMessage(
            `Failed to delete duplicates: ${error instanceof Error ? error.message : "unknown error"}`
        );
    }
}

// * auto-fix: review and fix unreachable rules
async function fixUnreachable(unreachable: LintIssue[], rules: ThemeRule[]): Promise<void> {
    if (unreachable.length === 0) {
        return;
    }

    // show each unreachable rule and let user decide
    for (const issue of unreachable) {
        const shadowingIndex = issue.relatedRuleIndices?.[0];
        if (shadowingIndex === undefined) {
            continue;
        }

        const shadowingRule = rules[shadowingIndex];

        const actions = await vscode.window.showWarningMessage(
            `Rule "${issue.rule.name}" is unreachable (shadowed by "${shadowingRule.name}")`,
            { modal: true },
            "Delete This Rule",
            "Move Before Shadowing Rule",
            "Skip",
            "Cancel"
        );

        if (actions === "Cancel" || !actions) {
            break;
        }

        if (actions === "Delete This Rule") {
            await deleteRule(issue.ruleIndex);
            vscode.window.showInformationMessage(`Deleted rule "${issue.rule.name}"`);
            // need to reload config and re-run after this
            break;
        } else if (actions === "Move Before Shadowing Rule") {
            await moveRule(issue.ruleIndex, shadowingIndex);
            vscode.window.showInformationMessage(
                `Moved rule "${issue.rule.name}" before "${shadowingRule.name}"`
            );
            break;
        }
    }
}

// * auto-fix: reorder rules by specificity
async function autoReorderRules(suggestions: LintIssue[], rules: ThemeRule[]): Promise<void> {
    if (suggestions.length === 0) {
        return;
    }

    const moves = buildRuleMovesFromSuggestions(suggestions, rules);
    if (moves.length === 0) {
        vscode.window.showWarningMessage("No valid reorder suggestions to apply.");
        return;
    }

    const confirmation = await vscode.window.showInformationMessage(
        `Auto-reorder ${moves.length} rule(s) by specificity?\n\nMore specific rules will be moved before more general ones.`,
        { modal: true },
        "Reorder",
        "Show Preview",
        "Cancel"
    );

    if (confirmation === "Cancel" || !confirmation) {
        return;
    }

    if (confirmation === "Show Preview") {
        // show before/after preview
        const preview = generateReorderPreview(suggestions, rules);
        const outputChannel = trackOutputChannel(
            vscode.window.createOutputChannel("Reactive Themes: Reorder Preview")
        );
        outputChannel.clear();
        outputChannel.appendLine(preview);
        outputChannel.show(true);

        const proceed = await vscode.window.showInformationMessage(
            "Preview shown in output. Proceed with reordering?",
            "Reorder",
            "Cancel"
        );

        if (proceed !== "Reorder") {
            return;
        }
    }

    // apply reordering
    try {
        refreshConfig();
        await applyReordering(moves);
        vscode.window.showInformationMessage(
            `Successfully reordered ${moves.length} rule(s)`
        );
    } catch (error) {
        vscode.window.showErrorMessage(
            `Failed to reorder rules: ${error instanceof Error ? error.message : "unknown error"}`
        );
    }
}

// * generate preview of reordering
function generateReorderPreview(suggestions: LintIssue[], rules: ThemeRule[]): string {
    let preview = "REORDER PREVIEW\n";
    preview += "═══════════════════════════════════════════════════════\n\n";

    for (const suggestion of suggestions) {
        const targetIndex = suggestion.suggestedFix?.targetIndices?.[1];
        if (targetIndex === undefined) {
            continue;
        }

        const targetRule = rules[targetIndex];
        if (!targetRule) {
            continue;
        }

        preview += `Move Rule #${suggestion.ruleIndex + 1} "${suggestion.rule.name}"\n`;
        preview += `  From position: ${suggestion.ruleIndex + 1}\n`;
        preview += `  To position: ${targetIndex + 1} (before "${targetRule.name}")\n`;
        preview += `  Reason: ${suggestion.message}\n\n`;
    }

    return preview;
}

function buildRuleMovesFromSuggestions(
    suggestions: LintIssue[],
    rules: ThemeRule[]
): RuleMove[] {
    return suggestions
        .map((suggestion) => {
            const targetIndex =
                suggestion.suggestedFix?.targetIndices?.[1] ??
                suggestion.relatedRuleIndices?.[0];
            if (targetIndex === undefined) {
                return undefined;
            }

            const targetRule = rules[targetIndex];
            const ruleToMove = suggestion.rule;

            if (!ruleToMove || !targetRule) {
                return undefined;
            }

            return {
                rule: ruleToMove,
                targetRule,
            } as RuleMove;
        })
        .filter((move): move is RuleMove => Boolean(move));
}

// * apply reordering suggestions
async function applyReordering(moves: RuleMove[]): Promise<void> {
    return reorderRules(moves);
}

// * helper: delete single rule with confirmation
async function confirmDeleteSingleRule(index: number, rule: ThemeRule): Promise<void> {
    const confirmed = await confirmDeleteRule(rule.name);

    if (!confirmed) {
        return;
    }

    try {
        await deleteRule(index);
        vscode.window.showInformationMessage(`Rule "${rule.name}" deleted successfully`);
    } catch (error) {
        vscode.window.showErrorMessage(
            `Failed to delete rule: ${error instanceof Error ? error.message : "unknown error"}`
        );
    }
}

// * helper: reorder single rule
async function reorderSingleRule(issue: LintIssue, rules: ThemeRule[]): Promise<void> {
    const targetIndex = issue.suggestedFix?.targetIndices?.[1];
    if (targetIndex === undefined) {
        return;
    }

    const confirmation = await vscode.window.showInformationMessage(
        `Move "${issue.rule.name}" before "${rules[targetIndex].name}"?`,
        { modal: true },
        "Move",
        "Cancel"
    );

    if (confirmation !== "Move") {
        return;
    }

    await moveRule(issue.ruleIndex, targetIndex);
    vscode.window.showInformationMessage(`Rule reordered successfully`);
}
