// src/commands/explainTheme.ts
// Explains current theme selection w/ winning rule, shadowed rules, & context snapshot

import * as vscode from "vscode";
import { loadConfig, getCurrentTheme } from "../config";
import { getRuleMatchDetails, MatchOptions, extractFileContext } from "../ruleEngine";
import { ThemeManager } from "../themeManager";
import { Context, ContextFlags, ContextManager } from "../contextManager";
import { TimerTrigger } from "../triggers/timerTrigger";
import type { ThemeRule } from "../types";
import { getSharedOutputChannel } from "./uiHelpers";
import { formatRuleConditionsDetailed } from "../utils/ruleFormatters";

export interface ExplainThemeDependencies {
    themeManager?: ThemeManager;
    contextManager?: ContextManager;
    timerTrigger?: TimerTrigger;
}

interface RuleEvaluation {
    rule: ThemeRule;
    index: number;
    matched: boolean;
    reasons: string[];
    conditions: string[];
}

interface ThemeExplanation {
    currentTheme: string;
    appliedTheme?: string;
    originalTheme?: string;
    defaultTheme?: string;
    themeSource: "rule" | "default" | "manual" | "original";
    fileContext: {
        languageId?: string;
        filePath?: string;
        workspaceName?: string;
    };
    environmentContext: Pick<ContextFlags, "debugSession" | "debugType" | "testState" | "viewMode">;
    gitContext: {
        branch?: string;
        status?: "clean" | "dirty";
        available: boolean;
    };
    evaluations: RuleEvaluation[];
    winnerIndex?: number;
    whySummary: string;
}

let outputChannel: vscode.OutputChannel | undefined;

// * Registers explain/copy commands with injected dependencies to avoid circular imports
export function registerExplainThemeCommands(
    context: vscode.ExtensionContext,
    dependencies: ExplainThemeDependencies
): void {
    outputChannel = getSharedOutputChannel();

    const explain = vscode.commands.registerCommand(
        "reactiveThemes.explainCurrentTheme",
        async () => {
            await runExplainCommand(dependencies, false);
        }
    );

    const copy = vscode.commands.registerCommand(
        "reactiveThemes.copyThemeExplanation",
        async () => {
            await runExplainCommand(dependencies, true);
        }
    );

    context.subscriptions.push(explain, copy);
}

// * Main command handler - optionally copies to clipboard
async function runExplainCommand(
    dependencies: ExplainThemeDependencies,
    copyToClipboard: boolean
): Promise<void> {
    try {
        const explanation = gatherThemeExplanation(dependencies);
        if (copyToClipboard) {
            const markdown = formatExplanationAsMarkdown(explanation);
            await vscode.env.clipboard.writeText(markdown);
            vscode.window.showInformationMessage("Theme explanation copied to clipboard");
            return;
        }

        await displayExplanation(explanation);
    } catch (error) {
        vscode.window.showErrorMessage(
            `Failed to explain current theme: ${
                error instanceof Error ? error.message : String(error)
            }`
        );
    }
}

// * Determines theme source based on current state
function determineThemeSource(
    appliedTheme: string | undefined,
    winnerIndex: number | undefined,
    defaultTheme: string | undefined,
    currentTheme: string,
    originalTheme: string | undefined
): "rule" | "default" | "manual" | "original" {
    // Theme applied by a matching rule in this evaluation
    if (winnerIndex !== undefined && appliedTheme) {
        return "rule";
    }

    // Theme currently matches what the extension last applied
    if (appliedTheme && currentTheme === appliedTheme) {
        return appliedTheme === defaultTheme ? "default" : "rule";
    }

    // Theme matches original (extension hasn't changed it)
    if (currentTheme === originalTheme && !appliedTheme) {
        return "original";
    }

    // Theme was manually changed by user
    return "manual";
}

// * Gets git context from VSCode Git extension (placeholder for now)
function getGitContext(): { branch?: string; status?: "clean" | "dirty"; available: boolean } {
    // todo: integrate w/ VSCode Git extension API
    // for now return unavailable placeholder
    return {
        available: false,
    };
}

// * Builds human-readable "why" summary sentence
function buildWhySummary(
    winnerIndex: number | undefined,
    evaluations: RuleEvaluation[],
    defaultTheme: string | undefined,
    currentTheme: string
): string {
    if (winnerIndex !== undefined) {
        const winner = evaluations[winnerIndex];
        const matchedCount = evaluations.filter((e) => e.matched).length;
        const shadowedCount = matchedCount - 1;

        if (shadowedCount > 0) {
            return `Rule "${winner.rule.name}" (priority #${winnerIndex + 1}) matched & beat ${shadowedCount} other candidate rule${shadowedCount > 1 ? "s" : ""}`;
        } else {
            return `Rule "${winner.rule.name}" (priority #${winnerIndex + 1}) matched`;
        }
    } else if (defaultTheme) {
        return `No rules matched → using default theme "${defaultTheme}"`;
    } else {
        return `No rules matched & no default configured → theme unchanged (${currentTheme})`;
    }
}

function buildMatchOptions(timerTrigger?: TimerTrigger): MatchOptions | undefined {
    if (!timerTrigger) {
        return undefined;
    }

    const fireIndices = timerTrigger.getLastFiredRuleIndices();
    if (!fireIndices || fireIndices.length === 0) {
        return { allowTimerRules: false };
    }

    return {
        allowTimerRules: true,
        activeTimerRuleIndices: new Set<number>(fireIndices),
    };
}

// * Collects all theme evaluation data for current context
function gatherThemeExplanation(dependencies: ExplainThemeDependencies): ThemeExplanation {
    const config = loadConfig();
    const themeManager = dependencies.themeManager;
    const contextManager = dependencies.contextManager;

    const editor = vscode.window.activeTextEditor;

    // extract file context using centralized helper
    const fileContext = extractFileContext(editor);

    // Gather environment context from ContextManager
    const ctx: Context = contextManager?.getContext() || {};
    const environmentContext = {
        debugSession: ctx.debugSession,
        debugType: ctx.debugType,
        testState: ctx.testState,
        viewMode: ctx.viewMode,
    };

    // Get theme information
    const currentTheme = getCurrentTheme();
    const appliedTheme = themeManager?.getCurrentAppliedTheme();
    const originalTheme = themeManager?.getOriginalTheme();
    const defaultTheme = config.defaultTheme;

    // Get git context (placeholder for now)
    const gitContext = getGitContext();

    const matchOptions = buildMatchOptions(dependencies.timerTrigger);

    // Evaluate all rules to find winner, shadowed, & non-matching
    const rules = config.rules;
    const evaluations: RuleEvaluation[] = [];
    let winnerIndex: number | undefined = undefined;

    for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];
        const { matched, reasons } = getRuleMatchDetails(rule, fileContext, ctx, matchOptions, i);
        const conditions = formatRuleConditionsDetailed(rule);

        evaluations.push({
            rule,
            index: i,
            matched,
            reasons,
            conditions,
        });

        // First-match-wins: record first matching rule
        if (matched && winnerIndex === undefined) {
            winnerIndex = i;
        }
    }

    // Determine theme source
    const themeSource = determineThemeSource(
        appliedTheme,
        winnerIndex,
        defaultTheme,
        currentTheme,
        originalTheme
    );

    // Build why summary
    const whySummary = buildWhySummary(winnerIndex, evaluations, defaultTheme, currentTheme);

    return {
        currentTheme,
        appliedTheme,
        originalTheme,
        defaultTheme,
        themeSource,
        fileContext,
        environmentContext,
        gitContext,
        evaluations,
        winnerIndex,
        whySummary,
    };
}

interface EvaluationBuckets {
    winner?: RuleEvaluation;
    shadowedRules: RuleEvaluation[];
    nonMatchingRules: RuleEvaluation[];
    matchedCount: number;
    fallbackUsed: boolean;
}

function bucketEvaluations(explanation: ThemeExplanation): EvaluationBuckets {
    const winner =
        explanation.winnerIndex !== undefined
            ? explanation.evaluations[explanation.winnerIndex]
            : undefined;

    const matchedCount = explanation.evaluations.filter((e) => e.matched).length;
    const fallbackUsed =
        explanation.winnerIndex === undefined && explanation.defaultTheme !== undefined;

    const shadowedRules = explanation.evaluations.filter(
        (e, idx) => e.matched && idx !== explanation.winnerIndex
    );

    const nonMatchingRules = explanation.evaluations.filter((e) => !e.matched);

    return {
        winner,
        shadowedRules,
        nonMatchingRules,
        matchedCount,
        fallbackUsed,
    };
}

// * Displays explanation in QuickPick UI & logs to output channel
async function displayExplanation(explanation: ThemeExplanation): Promise<void> {
    const items = buildQuickPickItems(explanation);
    const summary = buildSummary(explanation);

    // Initialize output channel if not already created
    if (!outputChannel) {
        outputChannel = getSharedOutputChannel();
    }

    // Log detailed explanation to output channel
    logDetailedExplanation(explanation, outputChannel);

    // Show QuickPick UI
    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: summary,
        matchOnDescription: true,
        matchOnDetail: true,
    });

    // If user selected a rule, show detailed info in output channel
    if (selected && selected.ruleIndex !== undefined) {
        outputChannel.show();
        outputChannel.appendLine("\n" + "=".repeat(80));
        outputChannel.appendLine(`RULE DETAILS: ${selected.label.replace(/\$\([^)]+\)\s*/, "")}`);
        outputChannel.appendLine("=".repeat(80));
        const evaluation = explanation.evaluations[selected.ruleIndex];

        outputChannel.appendLine(`Rule:     ${evaluation.rule.name} (#${evaluation.index + 1})`);
        outputChannel.appendLine(
            `Source:   settings.json → reactiveThemes.rules[${evaluation.index}]`
        );
        outputChannel.appendLine(`Theme:    ${evaluation.rule.theme}`);
        outputChannel.appendLine(`Matched:  ${evaluation.matched ? "yes" : "no"}`);
        outputChannel.appendLine("");

        if (evaluation.conditions.length > 0) {
            outputChannel.appendLine("Conditions:");
            evaluation.conditions.forEach((condition) => {
                outputChannel!.appendLine(`  • ${condition}`);
            });
            outputChannel.appendLine("");
        }

        outputChannel.appendLine("Evaluation:");
        evaluation.reasons.forEach((reason) => {
            outputChannel!.appendLine(`  ${reason}`);
        });
    }
}

// * Builds QuickPick items from explanation
function buildQuickPickItems(
    explanation: ThemeExplanation
): Array<vscode.QuickPickItem & { ruleIndex?: number }> {
    const { winner, shadowedRules, nonMatchingRules } = bucketEvaluations(explanation);
    const items: Array<vscode.QuickPickItem & { ruleIndex?: number }> = [];

    // Section: Theme & Context Info
    items.push({
        label: "$(symbol-color) Theme Information",
        kind: vscode.QuickPickItemKind.Separator,
    });

    items.push({
        label: `  Current Theme: ${explanation.currentTheme}`,
        description: explanation.appliedTheme ? "(Applied by Reactive Themes)" : "(Not managed)",
    });

    if (explanation.originalTheme) {
        items.push({
            label: `  Original Theme: ${explanation.originalTheme}`,
            description: "(Theme before extension activated)",
        });
    }

    if (explanation.defaultTheme) {
        items.push({
            label: `  Default Theme: ${explanation.defaultTheme}`,
            description: "(Fallback when no rules match)",
        });
    }

    // Section: Context Snapshot
    items.push({
        label: "$(info) Context Snapshot",
        kind: vscode.QuickPickItemKind.Separator,
    });

    const { fileContext, environmentContext } = explanation;

    if (fileContext.languageId) {
        items.push({
            label: `  Language: ${fileContext.languageId}`,
        });
    }

    if (fileContext.filePath) {
        items.push({
            label: `  Path: ${fileContext.filePath}`,
        });
    }

    if (fileContext.workspaceName) {
        items.push({
            label: `  Workspace: ${fileContext.workspaceName}`,
        });
    }

    if (environmentContext.debugSession) {
        items.push({
            label: `  Debug: ${environmentContext.debugSession}`,
            description: environmentContext.debugType
                ? `(${environmentContext.debugType})`
                : undefined,
        });
    }

    if (environmentContext.testState) {
        items.push({
            label: `  Test: ${environmentContext.testState}`,
        });
    }

    if (environmentContext.viewMode) {
        items.push({
            label: `  View: ${environmentContext.viewMode}`,
        });
    }

    // Section: Winning Rule
    if (winner) {
        items.push({
            label: "$(pass-filled) Winning Rule",
            kind: vscode.QuickPickItemKind.Separator,
        });

        items.push({
            label: `$(star) ${winner.rule.name}`,
            description: `→ ${winner.rule.theme}`,
            detail: `rules[${winner.index}] • Priority #${winner.index + 1} • Click to view details`,
            ruleIndex: winner.index,
        });
    } else {
        items.push({
            label: "$(circle-slash) No Rules Matched",
            kind: vscode.QuickPickItemKind.Separator,
        });

        if (explanation.defaultTheme) {
            items.push({
                label: `  Using default theme: ${explanation.defaultTheme}`,
            });
        }
    }

    // Section: Shadowed Rules (matched but lost to priority)
    if (shadowedRules.length > 0) {
        items.push({
            label: "$(warning) Shadowed Rules (matched but lost to priority)",
            kind: vscode.QuickPickItemKind.Separator,
        });

        shadowedRules.forEach((shadowed) => {
            items.push({
                label: `$(pass) ${shadowed.rule.name}`,
                description: `→ ${shadowed.rule.theme}`,
                detail: `rules[${shadowed.index}] • Lost to rule #${winner ? winner.index + 1 : "?"} (first-match-wins)`,
                ruleIndex: shadowed.index,
            });
        });
    }

    // Section: Non-Matching Rules
    if (nonMatchingRules.length > 0) {
        items.push({
            label: "$(circle-slash) Non-Matching Rules",
            kind: vscode.QuickPickItemKind.Separator,
        });

        nonMatchingRules.forEach((nonMatch) => {
            const failedConditions = nonMatch.reasons.filter((r) => r.startsWith("✗")).length;
            items.push({
                label: `$(circle-slash) ${nonMatch.rule.name}`,
                description: `→ ${nonMatch.rule.theme}`,
                detail: `rules[${nonMatch.index}] • ${failedConditions} condition(s) failed`,
                ruleIndex: nonMatch.index,
            });
        });
    }

    return items;
}

// * Builds summary text for QuickPick placeholder
function buildSummary(explanation: ThemeExplanation): string {
    return explanation.whySummary;
}

// * Logs comprehensive explanation to output channel
function logDetailedExplanation(
    explanation: ThemeExplanation,
    channel: vscode.OutputChannel
): void {
    const { winner, shadowedRules, nonMatchingRules, matchedCount, fallbackUsed } =
        bucketEvaluations(explanation);

    channel.clear();
    channel.appendLine("╔" + "═".repeat(78) + "╗");
    channel.appendLine("║" + " ".repeat(20) + "REACTIVE THEMES EXPLANATION" + " ".repeat(31) + "║");
    channel.appendLine("╚" + "═".repeat(78) + "╝");
    channel.appendLine("");

    // Why Summary (explicit reason)
    channel.appendLine("┌─ WHY THIS THEME?");
    channel.appendLine(`│  ${explanation.whySummary}`);
    channel.appendLine("└─");
    channel.appendLine("");

    // Theme Information
    channel.appendLine("┌─ THEME INFORMATION");
    channel.appendLine(`│  Current Theme:  ${explanation.currentTheme}`);
    channel.appendLine(`│  Theme Source:   ${explanation.themeSource}`);
    if (explanation.appliedTheme) {
        channel.appendLine(`│  Applied By:     Reactive Themes (${explanation.appliedTheme})`);
    } else {
        channel.appendLine(`│  Applied By:     Not managed by Reactive Themes`);
    }
    if (explanation.originalTheme) {
        channel.appendLine(`│  Original Theme: ${explanation.originalTheme}`);
    }
    if (explanation.defaultTheme) {
        channel.appendLine(`│  Default Theme:  ${explanation.defaultTheme}`);
    }
    channel.appendLine("└─");
    channel.appendLine("");

    // Context Snapshot
    channel.appendLine("┌─ CONTEXT SNAPSHOT");
    const { fileContext, environmentContext } = explanation;

    if (fileContext.languageId || fileContext.filePath || fileContext.workspaceName) {
        channel.appendLine("│  File Context:");
        if (fileContext.languageId) {
            channel.appendLine(`│    Language:   ${fileContext.languageId}`);
        }
        if (fileContext.filePath) {
            channel.appendLine(`│    Path:       ${fileContext.filePath}`);
        }
        if (fileContext.workspaceName) {
            channel.appendLine(`│    Workspace:  ${fileContext.workspaceName}`);
        }
    }

    if (
        environmentContext.debugSession ||
        environmentContext.testState ||
        environmentContext.viewMode
    ) {
        channel.appendLine("│  Environment Context:");
        if (environmentContext.debugSession) {
            const debugInfo = environmentContext.debugType
                ? `${environmentContext.debugSession} (${environmentContext.debugType})`
                : environmentContext.debugSession;
            channel.appendLine(`│    Debug:      ${debugInfo}`);
        }
        if (environmentContext.testState) {
            channel.appendLine(`│    Test:       ${environmentContext.testState}`);
        }
        if (environmentContext.viewMode) {
            channel.appendLine(`│    View:       ${environmentContext.viewMode}`);
        }
    }

    // Git context (placeholder for future)
    if (explanation.gitContext.available) {
        channel.appendLine("│  Git Context:");
        if (explanation.gitContext.branch) {
            const status = explanation.gitContext.status
                ? ` (${explanation.gitContext.status})`
                : "";
            channel.appendLine(`│    Branch:     ${explanation.gitContext.branch}${status}`);
        }
    } else {
        channel.appendLine("│  Git:          unavailable (placeholder for future)");
    }

    channel.appendLine("└─");
    channel.appendLine("");

    // Rule Evaluation Results summary
    channel.appendLine("┌─ RULE EVALUATION RESULTS");
    channel.appendLine(`│  Total Rules:     ${explanation.evaluations.length}`);
    channel.appendLine(`│  Matching Rules:  ${matchedCount}`);
    if (winner) {
        channel.appendLine(`│  Winning Rule:    ${winner.rule.name} (#${winner.index + 1})`);
    } else {
        channel.appendLine(`│  Winning Rule:    none`);
    }
    channel.appendLine(`│  Fallback Used:   ${fallbackUsed ? "yes" : "no"}`);
    channel.appendLine("└─");
    channel.appendLine("");

    // Winning Rule
    if (winner) {
        channel.appendLine("┌─ ★ WINNING RULE (First Match)");
        channel.appendLine(`│  Rule:     ${winner.rule.name} (#${winner.index + 1})`);
        channel.appendLine(`│  Source:   settings.json → reactiveThemes.rules[${winner.index}]`);
        channel.appendLine(`│  Theme:    ${winner.rule.theme}`);
        if (winner.conditions.length > 0) {
            channel.appendLine("│  Conditions:");
            winner.conditions.forEach((condition) => {
                channel.appendLine(`│    • ${condition}`);
            });
        }
        channel.appendLine("│  Evaluation:");
        winner.reasons.forEach((reason) => {
            channel.appendLine(`│    ${reason}`);
        });
        channel.appendLine("└─");
        channel.appendLine("");
    } else {
        channel.appendLine("┌─ NO RULES MATCHED");
        channel.appendLine(`│  Reason: ${explanation.whySummary}`);
        if (explanation.defaultTheme) {
            channel.appendLine(`│  Action: Using default theme "${explanation.defaultTheme}"`);
        } else {
            channel.appendLine(`│  Action: Theme unchanged`);
        }
        channel.appendLine("└─");
        channel.appendLine("");
    }

    // Shadowed Rules (matched but lost due to first-match-wins)
    if (shadowedRules.length > 0) {
        channel.appendLine("┌─ ⚠ SHADOWED RULES (Matched but Lost to Priority)");
        shadowedRules.forEach((shadowed, idx) => {
            if (idx > 0) {
                channel.appendLine(`│`);
            }
            channel.appendLine(`│  Rule:     ${shadowed.rule.name} (#${shadowed.index + 1})`);
            channel.appendLine(
                `│  Source:   settings.json → reactiveThemes.rules[${shadowed.index}]`
            );
            channel.appendLine(`│  Theme:    ${shadowed.rule.theme}`);
            channel.appendLine(
                `│  Why Lost: Lower priority (first-match-wins) - rule #${winner ? winner.index + 1 : "?"} matched first`
            );
            if (shadowed.conditions.length > 0) {
                channel.appendLine("│  Conditions:");
                shadowed.conditions.forEach((condition) => {
                    channel.appendLine(`│    • ${condition}`);
                });
            }
            channel.appendLine("│  Evaluation:");
            shadowed.reasons.forEach((reason) => {
                channel.appendLine(`│    ${reason}`);
            });
        });
        channel.appendLine("└─");
        channel.appendLine("");
    }

    // Non-Matching Rules
    if (nonMatchingRules.length > 0) {
        channel.appendLine("┌─ NON-MATCHING RULES");
        nonMatchingRules.forEach((nonMatch, idx) => {
            if (idx > 0) {
                channel.appendLine(`│`);
            }
            channel.appendLine(`│  Rule:     ${nonMatch.rule.name} (#${nonMatch.index + 1})`);
            channel.appendLine(
                `│  Source:   settings.json → reactiveThemes.rules[${nonMatch.index}]`
            );
            channel.appendLine(`│  Theme:    ${nonMatch.rule.theme}`);
            if (nonMatch.conditions.length > 0) {
                channel.appendLine("│  Conditions:");
                nonMatch.conditions.forEach((condition) => {
                    channel.appendLine(`│    • ${condition}`);
                });
            }
            channel.appendLine("│  Evaluation:");
            nonMatch.reasons.forEach((reason) => {
                channel.appendLine(`│    ${reason}`);
            });
        });
        channel.appendLine("└─");
    }

    channel.appendLine("");
    channel.appendLine("─".repeat(80));
    channel.appendLine(`Generated: ${new Date().toLocaleString()}`);
}

// * Formats explanation as markdown for copying to clipboard
function formatExplanationAsMarkdown(explanation: ThemeExplanation): string {
    const { winner, shadowedRules, nonMatchingRules, matchedCount, fallbackUsed } =
        bucketEvaluations(explanation);

    let md = "# Reactive Themes Explanation\n\n";

    // Why summary
    md += `## Why This Theme?\n\n`;
    md += `${explanation.whySummary}\n\n`;

    // Theme Information
    md += `## Theme Information\n\n`;
    md += `- **Current Theme:** ${explanation.currentTheme}\n`;
    md += `- **Theme Source:** ${explanation.themeSource}\n`;
    if (explanation.appliedTheme) {
        md += `- **Applied By:** Reactive Themes (${explanation.appliedTheme})\n`;
    }
    if (explanation.originalTheme) {
        md += `- **Original Theme:** ${explanation.originalTheme}\n`;
    }
    if (explanation.defaultTheme) {
        md += `- **Default Theme:** ${explanation.defaultTheme}\n`;
    }
    md += "\n";

    // Context Snapshot
    md += `## Context Snapshot\n\n`;

    const { fileContext, environmentContext, gitContext } = explanation;

    if (fileContext.languageId || fileContext.filePath || fileContext.workspaceName) {
        md += `### File Context\n\n`;
        if (fileContext.languageId) {
            md += `- **Language:** ${fileContext.languageId}\n`;
        }
        if (fileContext.filePath) {
            md += `- **Path:** \`${fileContext.filePath}\`\n`;
        }
        if (fileContext.workspaceName) {
            md += `- **Workspace:** ${fileContext.workspaceName}\n`;
        }
        md += "\n";
    }

    if (
        environmentContext.debugSession ||
        environmentContext.testState ||
        environmentContext.viewMode
    ) {
        md += `### Environment Context\n\n`;
        if (environmentContext.debugSession) {
            const debugInfo = environmentContext.debugType
                ? `${environmentContext.debugSession} (${environmentContext.debugType})`
                : environmentContext.debugSession;
            md += `- **Debug:** ${debugInfo}\n`;
        }
        if (environmentContext.testState) {
            md += `- **Test:** ${environmentContext.testState}\n`;
        }
        if (environmentContext.viewMode) {
            md += `- **View:** ${environmentContext.viewMode}\n`;
        }
        md += "\n";
    }

    if (gitContext.available && gitContext.branch) {
        md += `### Git Context\n\n`;
        const status = gitContext.status ? ` (${gitContext.status})` : "";
        md += `- **Branch:** ${gitContext.branch}${status}\n\n`;
    }

    md += `## Rule Evaluation Results\n\n`;
    md += `- **Total Rules:** ${explanation.evaluations.length}\n`;
    md += `- **Matching Rules:** ${matchedCount}\n`;
    md += `- **Winning Rule:** ${winner ? `${winner.rule.name} (#${winner.index + 1})` : "none"}\n`;
    md += `- **Fallback Used:** ${fallbackUsed ? "yes" : "no"}\n\n`;

    // Winning Rule
    if (winner) {
        md += `### ★ Winning Rule (First Match)\n\n`;
        md += `- **Rule:** ${winner.rule.name} (#${winner.index + 1})\n`;
        md += `- **Source:** \`settings.json → reactiveThemes.rules[${winner.index}]\`\n`;
        md += `- **Theme:** ${winner.rule.theme}\n\n`;

        if (winner.conditions.length > 0) {
            md += `**Conditions:**\n\n`;
            winner.conditions.forEach((condition) => {
                md += `  - ${condition}\n`;
            });
            md += "\n";
        }

        md += `**Evaluation:**\n\n`;
        winner.reasons.forEach((reason) => {
            md += `  - ${reason}\n`;
        });
        md += "\n";
    } else {
        md += `### No Rules Matched\n\n`;
        md += `**Reason:** ${explanation.whySummary}\n\n`;
        if (explanation.defaultTheme) {
            md += `**Action:** Using default theme "${explanation.defaultTheme}"\n\n`;
        } else {
            md += `**Action:** Theme unchanged\n\n`;
        }
    }

    // Shadowed Rules
    if (shadowedRules.length > 0) {
        md += `### ⚠ Shadowed Rules (Matched but Lost to Priority)\n\n`;
        shadowedRules.forEach((shadowed) => {
            md += `#### ${shadowed.rule.name} (#${shadowed.index + 1})\n\n`;
            md += `- **Source:** \`settings.json → reactiveThemes.rules[${shadowed.index}]\`\n`;
            md += `- **Theme:** ${shadowed.rule.theme}\n`;
            md += `- **Why Lost:** Lower priority (first-match-wins) - rule #${winner ? winner.index + 1 : "?"} matched first\n\n`;

            if (shadowed.conditions.length > 0) {
                md += `**Conditions:**\n\n`;
                shadowed.conditions.forEach((condition) => {
                    md += `  - ${condition}\n`;
                });
                md += "\n";
            }

            md += `**Evaluation:**\n\n`;
            shadowed.reasons.forEach((reason) => {
                md += `  - ${reason}\n`;
            });
            md += "\n";
        });
    }

    // Non-Matching Rules (optional - can be verbose)
    if (nonMatchingRules.length > 0 && nonMatchingRules.length <= 10) {
        md += `### Non-Matching Rules\n\n`;
        nonMatchingRules.forEach((nonMatch) => {
            md += `#### ${nonMatch.rule.name} (#${nonMatch.index + 1})\n\n`;
            md += `- **Source:** \`settings.json → reactiveThemes.rules[${nonMatch.index}]\`\n`;
            md += `- **Theme:** ${nonMatch.rule.theme}\n\n`;

            if (nonMatch.conditions.length > 0) {
                md += `**Conditions:**\n\n`;
                nonMatch.conditions.forEach((condition) => {
                    md += `  - ${condition}\n`;
                });
                md += "\n";
            }

            md += `**Evaluation:**\n\n`;
            nonMatch.reasons.forEach((reason) => {
                md += `  - ${reason}\n`;
            });
            md += "\n";
        });
    } else if (nonMatchingRules.length > 10) {
        md += `### Non-Matching Rules\n\n`;
        md += `${nonMatchingRules.length} rules did not match (omitted for brevity)\n\n`;
    }

    md += `---\n\n`;
    md += `*Generated: ${new Date().toLocaleString()}*\n`;

    return md;
}
