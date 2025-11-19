// src/commands/testRule.ts
// Command for testing/previewing theme rules without switching buffers

import * as vscode from "vscode";
import { ThemeRule } from "../types";
import { loadConfig } from "../config";
import { extractFileContext, getRuleMatchDetails, FileContext } from "../ruleEngine";
import { findOverlappingRules } from "../ruleOverlap";
import { formatRuleConditions } from "../utils/ruleFormatters";
import { ContextFlags } from "../contextManager";
import { trackOutputChannel } from "./uiHelpers";

let testRuleOutputChannel: vscode.OutputChannel | undefined;

function getTestRuleOutputChannel(): vscode.OutputChannel {
    if (!testRuleOutputChannel) {
        testRuleOutputChannel = trackOutputChannel(
            vscode.window.createOutputChannel("Reactive Themes: Test Rule")
        );
    }
    return testRuleOutputChannel;
}

export function disposeTestRuleOutputChannel(): void {
    if (testRuleOutputChannel) {
        testRuleOutputChannel.dispose();
        testRuleOutputChannel = undefined;
    }
}

interface TestContext extends FileContext, ContextFlags {
    languageId: string;
    filePath: string;
    timerFired?: boolean;
}

interface RuleTestResult {
    rule: ThemeRule;
    index: number;
    matched: boolean;
    reasons: string[];
}

type ContextChoice<T> = vscode.QuickPickItem & { value: T };

function ruleHasContextCondition(rule: ThemeRule): boolean {
    const when = rule.when;
    return Boolean(
        when.debugSession !== undefined ||
            when.debugType !== undefined ||
            when.testState !== undefined ||
            when.viewMode !== undefined ||
            when.timerInterval !== undefined
    );
}

// * test rules against current file or custom inputs
export async function testRule(): Promise<void> {
    console.log("[Reactive Themes] Testing rules");

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

    // step 1: choose test mode
    const mode = await selectTestMode();
    if (!mode) {
        return; // user cancelled
    }

    // step 2: get test context (from current file or custom input)
    let testContext: TestContext | undefined;

    if (mode === "current") {
        testContext = getCurrentFileContext();
        if (!testContext) {
            vscode.window.showWarningMessage("No active file to test against.");
            return;
        }
    } else {
        testContext = await getCustomTestContext();
        if (!testContext) {
            return; // user cancelled
        }
    }

    // step 3: allow setting context-based conditions when rules use them
    testContext = await maybeApplyContextFilters(testContext, config.rules, mode);
    if (!testContext) {
        return;
    }

    // step 4: evaluate all rules against test context
    const results = evaluateAllRules(config.rules, testContext);

    // step 5: display results
    await displayTestResults(testContext, results);
}

// choose between testing current file or custom inputs
async function selectTestMode(): Promise<"current" | "custom" | undefined> {
    const items: Array<vscode.QuickPickItem & { mode: "current" | "custom" }> = [
        {
            label: "$(file) Test Against Current File",
            description: "See which rule would match the active editor",
            mode: "current",
        },
        {
            label: "$(beaker) Custom Test Scenario",
            description: "Enter custom language/path/workspace values",
            mode: "custom",
        },
    ];

    const selected = await vscode.window.showQuickPick(items, {
        title: "Rule Tester - Select Test Mode",
        placeHolder: "Choose how to test your rules",
    });

    return selected?.mode;
}

async function maybeApplyContextFilters(
    context: TestContext,
    rules: ThemeRule[],
    mode: "current" | "custom"
): Promise<TestContext | undefined> {
    const hasContextRules = rules.some(ruleHasContextCondition);
    if (!hasContextRules) {
        return context;
    }

    const choice = await vscode.window.showQuickPick<ContextChoice<"defaults" | "custom">>(
        [
            {
                label: "Use detected context",
                description:
                    mode === "current"
                        ? "Use your current debug/view/test state"
                        : "Use default context values",
                value: "defaults",
            },
            {
                label: "Customize context conditions",
                description: "Set debug session, test state, view mode, or timer tick",
                value: "custom",
            },
        ],
        {
            title: "Context-based rules detected. Provide context for testing?",
            placeHolder: "Rules use debug/test/view/timer conditions",
        }
    );

    if (!choice) {
        return undefined;
    }

    if (choice.value === "defaults") {
        return context;
    }

    return await promptForContextValues(context);
}

// get context from current active editor
function getCurrentFileContext(): TestContext | undefined {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return undefined;
    }

    const fileContext = extractFileContext(editor);
    if (!fileContext.languageId || !fileContext.filePath) {
        return undefined;
    }

    return {
        ...fileContext,
        languageId: fileContext.languageId,
        filePath: fileContext.filePath,
        debugSession: vscode.debug.activeDebugSession ? "active" : "inactive",
        debugType: vscode.debug.activeDebugSession?.type,
        testState: "none",
        viewMode: "normal",
        timerFired: false,
    };
}

// get custom test context from user input
async function getCustomTestContext(): Promise<TestContext | undefined> {
    // step 1: get language ID
    const languageId = await vscode.window.showInputBox({
        prompt: "Enter language ID to test",
        placeHolder: "e.g., typescript, python, javascript",
        validateInput: (value) => {
            if (!value || value.trim().length === 0) {
                return "Language ID cannot be empty";
            }
            return undefined;
        },
    });

    if (!languageId) {
        return undefined;
    }

    // step 2: get file path
    const filePath = await vscode.window.showInputBox({
        prompt: "Enter file path to test (can be hypothetical)",
        placeHolder: "e.g., /src/components/Button.tsx",
        validateInput: (value) => {
            if (!value || value.trim().length === 0) {
                return "File path cannot be empty";
            }
            return undefined;
        },
    });

    if (!filePath) {
        return undefined;
    }

    // step 3: get workspace name (optional)
    const workspaceName = await vscode.window.showInputBox({
        prompt: "Enter workspace name (optional - leave empty to skip)",
        placeHolder: "e.g., my-project",
    });

    const defaultContext: TestContext = {
        languageId: languageId.trim(),
        filePath: filePath.trim(),
        workspaceName:
            workspaceName && workspaceName.trim().length > 0 ? workspaceName.trim() : undefined,
        debugSession: "inactive",
        testState: "none",
        viewMode: "normal",
        timerFired: false,
    };
    const derivedFileContext = deriveFileContext(defaultContext);

    return {
        ...defaultContext,
        workspaceName: defaultContext.workspaceName ?? derivedFileContext.workspaceName,
    };
}

function deriveFileContext(
    context: Pick<TestContext, "languageId" | "filePath" | "workspaceName">
): FileContext {
    const uri = vscode.Uri.file(context.filePath);
    const document = {
        languageId: context.languageId,
        uri,
    } as vscode.TextDocument;

    const extracted = extractFileContext(document);
    return {
        ...extracted,
        languageId: context.languageId,
        filePath: context.filePath,
        workspaceName: context.workspaceName ?? extracted.workspaceName,
    };
}

async function promptForContextValues(base: TestContext): Promise<TestContext | undefined> {
    const debugSessionChoice = await vscode.window.showQuickPick<
        ContextChoice<"keep" | "any" | "active" | "inactive">
    >(
        [
            { label: `Keep current (${base.debugSession ?? "any"})`, value: "keep" },
            { label: "Any (ignore debug state)", value: "any" },
            { label: "Active debug session", value: "active" },
            { label: "Inactive debug session", value: "inactive" },
        ],
        {
            title: "Debug session condition",
            placeHolder: "Select debug session state for testing",
        }
    );

    if (!debugSessionChoice) {
        return undefined;
    }

    let debugSession = base.debugSession;
    if (debugSessionChoice.value === "any") {
        debugSession = undefined;
    } else if (debugSessionChoice.value !== "keep") {
        debugSession = debugSessionChoice.value;
    }

    let debugType: string | undefined = debugSession === "active" ? base.debugType : undefined;
    if (debugSession === "active") {
        const debugTypeInput = await vscode.window.showInputBox({
            prompt: "Specify debug type (optional)",
            placeHolder: "e.g., node, python, chrome",
            value: debugType || "",
        });

        if (debugTypeInput === undefined) {
            return undefined;
        }

        debugType = debugTypeInput.trim() ? debugTypeInput.trim() : undefined;
    }

    const testStateChoice = await vscode.window.showQuickPick<
        ContextChoice<"keep" | "any" | TestContext["testState"]>
    >(
        [
            { label: `Keep current (${base.testState ?? "none"})`, value: "keep" },
            { label: "Any (ignore test state)", value: "any" },
            { label: "Running", value: "running" },
            { label: "Failed", value: "failed" },
            { label: "Passed", value: "passed" },
            { label: "None", value: "none" },
        ],
        {
            title: "Test execution state",
            placeHolder: "Select test state for matching",
        }
    );

    if (!testStateChoice) {
        return undefined;
    }

    let testState = base.testState;
    if (testStateChoice.value === "any") {
        testState = undefined;
    } else if (testStateChoice.value !== "keep") {
        testState = testStateChoice.value;
    }

    const viewModeChoice = await vscode.window.showQuickPick<
        ContextChoice<"keep" | "any" | TestContext["viewMode"]>
    >(
        [
            { label: `Keep current (${base.viewMode ?? "normal"})`, value: "keep" },
            { label: "Any (ignore view mode)", value: "any" },
            { label: "Diff view", value: "diff" },
            { label: "Merge/conflict view", value: "merge" },
            { label: "Normal editing", value: "normal" },
        ],
        {
            title: "View mode",
            placeHolder: "Select editor view mode",
        }
    );

    if (!viewModeChoice) {
        return undefined;
    }

    let viewMode = base.viewMode;
    if (viewModeChoice.value === "any") {
        viewMode = undefined;
    } else if (viewModeChoice.value !== "keep") {
        viewMode = viewModeChoice.value;
    }

    const timerFiredChoice = await vscode.window.showQuickPick<ContextChoice<"keep" | boolean>>(
        [
            {
                label: `Keep current (${base.timerFired ? "timer fired" : "timer idle"})`,
                value: "keep",
            },
            { label: "Timer fired (simulate interval tick)", value: true },
            { label: "Timer idle (no timer event)", value: false },
        ],
        {
            title: "Timer condition",
            placeHolder: "Timer-based rules only match when the timer fires",
        }
    );

    if (!timerFiredChoice) {
        return undefined;
    }

    let timerFired = base.timerFired ?? false;
    if (timerFiredChoice.value !== "keep") {
        timerFired = timerFiredChoice.value;
    }

    return {
        ...base,
        debugSession,
        debugType,
        testState,
        viewMode,
        timerFired,
    };
}

// evaluate all rules against a test context
function evaluateAllRules(rules: ThemeRule[], context: TestContext): RuleTestResult[] {
    const results: RuleTestResult[] = [];

    const fileContext = deriveFileContext(context);

    const baseContext: ContextFlags = {
        debugSession: context.debugSession,
        debugType: context.debugType,
        testState: context.testState,
        viewMode: context.viewMode,
        timerTick: 0,
    };

    for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];
        const ruleOptions = {
            allowTimerRules: context.timerFired,
            activeTimerRuleIndices: context.timerFired ? new Set([i]) : undefined,
            timerOnly: context.timerFired,
        } as const;

        const testResult = getRuleMatchDetails(rule, fileContext, baseContext, ruleOptions, i);

        results.push({
            rule,
            index: i,
            matched: testResult.matched,
            reasons: testResult.reasons,
        });
    }

    return results;
}

// display test results to user
async function displayTestResults(context: TestContext, results: RuleTestResult[]): Promise<void> {
    const matchingResults = results.filter((r) => r.matched);
    const firstMatch = matchingResults.length > 0 ? matchingResults[0] : undefined;

    // build summary message
    let summaryLines: string[] = [];
    summaryLines.push("**Test Context:**");
    summaryLines.push(`• Language: \`${context.languageId}\``);
    summaryLines.push(`• Path: \`${context.filePath}\``);
    summaryLines.push(`• Workspace: \`${context.workspaceName || "(none)"}\``);
    summaryLines.push("**Context Conditions:**");
    summaryLines.push(
        `• Debug: \`${context.debugSession ?? "any"}\`${context.debugType ? ` (${context.debugType})` : ""}`
    );
    summaryLines.push(`• Test: \`${context.testState ?? "any"}\``);
    summaryLines.push(`• View: \`${context.viewMode ?? "any"}\``);
    summaryLines.push(`• Timer tick: \`${context.timerFired ? "fired" : "not fired"}\``);
    summaryLines.push("");

    if (firstMatch) {
        summaryLines.push(`**Result:** ✓ Rule would match`);
        summaryLines.push(`• Winning rule: **${firstMatch.rule.name}**`);
        summaryLines.push(`• Theme: **${firstMatch.rule.theme}**`);
        summaryLines.push(`• Rule index: #${firstMatch.index + 1} (first match wins)`);

        // check for overlapping matches
        if (matchingResults.length > 1) {
            summaryLines.push("");
            summaryLines.push(
                `⚠ **Warning:** ${matchingResults.length - 1} other rule(s) also match but are shadowed:`
            );
            for (let i = 1; i < matchingResults.length; i++) {
                const shadowed = matchingResults[i];
                summaryLines.push(`  • ${shadowed.rule.name} (theme: ${shadowed.rule.theme})`);
            }
        }

        // check for configured overlaps with ALL rules
        const overlappingRules = findOverlappingRules(
            firstMatch.rule,
            results.map((r) => r.rule)
        );
        const activeOverlaps = overlappingRules.filter(
            (or) => !matchingResults.find((mr) => mr.rule === or)
        );
        if (activeOverlaps.length > 0) {
            summaryLines.push("");
            summaryLines.push(
                `ℹ This rule overlaps with ${activeOverlaps.length} other rule(s) (might match similar files)`
            );
        }
    } else {
        summaryLines.push(`**Result:** ✗ No rules match`);
        summaryLines.push("");
        summaryLines.push("*No theme would be applied (fallback to default theme)*");
    }

    // create QuickPick items for each rule
    const items: Array<vscode.QuickPickItem & { result: RuleTestResult }> = results.map(
        (result) => {
            const rule = result.rule;
            const icon = result.matched ? "$(pass-filled)" : "$(circle-slash)";
            const matchStatus = result.matched ? "MATCH" : "No match";

            return {
                label: `${icon} ${rule.name}`,
                description: `${matchStatus} • ${formatRuleConditions(rule, { mode: "compact" }) || "always"}`,
                detail: result.reasons.join(" • "),
                result,
            };
        }
    );

    // show results in QuickPick
    const selected = await vscode.window.showQuickPick(items, {
        title: "Rule Test Results",
        placeHolder: summaryLines.join("\n"),
        matchOnDescription: true,
        matchOnDetail: true,
    });

    // if user selected a rule, offer to view details
    if (selected) {
        await showRuleDetails(selected.result, context);
    }
}

// show detailed information about a specific rule test
async function showRuleDetails(result: RuleTestResult, context: TestContext): Promise<void> {
    const rule = result.rule;

    const detailLines: string[] = [];
    detailLines.push(`**Rule:** ${rule.name}`);
    detailLines.push(`**Theme:** ${rule.theme}`);
    detailLines.push(`**Status:** ${result.matched ? "✓ MATCH" : "✗ NO MATCH"}`);
    detailLines.push("");
    detailLines.push("**Conditions:**");

    for (const reason of result.reasons) {
        detailLines.push(`  ${reason}`);
    }

    detailLines.push("");
    detailLines.push("**Test Context:**");
    detailLines.push(`  • Language: ${context.languageId}`);
    detailLines.push(`  • Path: ${context.filePath}`);
    detailLines.push(`  • Workspace: ${context.workspaceName || "(none)"}`);

    // show in information message with markdown support
    const message = detailLines.join("\n");

    await vscode.window.showInformationMessage(
        `Rule: ${rule.name}\n\n${result.matched ? "✓ This rule matches" : "✗ This rule does not match"}\n\nSee Output panel for details`
    );

    // also log to output channel for better viewing
    const outputChannel = getTestRuleOutputChannel();
    outputChannel.clear();
    outputChannel.appendLine("=".repeat(60));
    outputChannel.appendLine("RULE TEST DETAILS");
    outputChannel.appendLine("=".repeat(60));
    outputChannel.appendLine("");
    outputChannel.appendLine(detailLines.join("\n"));
    outputChannel.appendLine("");
    outputChannel.appendLine("=".repeat(60));
    outputChannel.show(true);
}
