// src/ruleEngine.ts
// Rule matching & evaluation engine for Reactive Themes

import * as vscode from "vscode";
import { minimatch } from "minimatch";
import { ThemeRule, RuleMatchResult } from "./types";
import { Context } from "./contextManager";

// file context for rule evaluation
export interface FileContext {
    languageId?: string;
    filePath?: string;
    workspaceName?: string;
}

// * evaluate rules against current editor context and environment context
export interface MatchOptions {
    allowTimerRules?: boolean;
    activeTimerRuleIndices?: Set<number>;
    timerOnly?: boolean;
}

export interface RuleMatchDetails {
    matched: boolean;
    reasons: string[];
}

// * evaluate rules against current editor context and environment context
export function evaluateRules(
    rules: ThemeRule[],
    editor: vscode.TextEditor | undefined,
    context: Context,
    options: MatchOptions = {}
): RuleMatchResult {
    const fileContext = extractFileContext(editor);

    // return first matching rule (first-match-wins strategy)
    for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];
        const match = getRuleMatchDetails(rule, fileContext, context, options, i);
        if (match.matched) {
            return {
                matched: true,
                rule: rule,
                theme: rule.theme,
            };
        }
    }

    return { matched: false };
}

// * check if single rule matches current context & optionally collect reasons
export function getRuleMatchDetails(
    rule: ThemeRule,
    fileContext: FileContext,
    context: Context,
    options: MatchOptions = {},
    ruleIndex: number = -1
): RuleMatchDetails {
    const when = rule.when;
    const reasons: string[] = [];
    let matched = true;

    if (options.timerOnly && when.timerInterval === undefined) {
        return { matched: false, reasons: ["✗ Timer-only evaluation: rule has no timer interval"] };
    }

    if (when.language !== undefined) {
        const languageMatches = fileContext.languageId === when.language;
        matched = matched && languageMatches;
        reasons.push(
            languageMatches
                ? `✓ Language matches: "${fileContext.languageId}" === "${when.language}"`
                : `✗ Language mismatch: "${fileContext.languageId ?? "(none)"}" !== "${when.language}"`
        );
    }

    if (when.pattern) {
        const normalizedPath = fileContext.filePath?.replace(/\\/g, "/") ?? "(missing file path)";
        let patternMatches = false;

        try {
            patternMatches = Boolean(
                fileContext.filePath && matchGlobPattern(fileContext.filePath, when.pattern)
            );
        } catch (error) {
            matched = false;
            reasons.push(
                `✗ Invalid pattern "${when.pattern}": ${error instanceof Error ? error.message : String(error)}`
            );
        }

        if (!reasons[reasons.length - 1]?.startsWith("✗ Invalid pattern")) {
            matched = matched && patternMatches;
            reasons.push(
                patternMatches
                    ? `✓ Path matches pattern: "${normalizedPath}" matches "${when.pattern}"`
                    : `✗ Path doesn't match: "${normalizedPath}" doesn't match "${when.pattern}"`
            );
        }
    }

    if (when.workspaceName) {
        const workspaceMatches = fileContext.workspaceName === when.workspaceName;
        const contextWorkspace = fileContext.workspaceName || "(none)";
        matched = matched && workspaceMatches;
        reasons.push(
            workspaceMatches
                ? `✓ Workspace matches: "${contextWorkspace}" === "${when.workspaceName}"`
                : `✗ Workspace mismatch: "${contextWorkspace}" !== "${when.workspaceName}"`
        );
    }

    if (when.debugSession !== undefined) {
        const matches = context.debugSession === when.debugSession;
        const contextDebug = context.debugSession || "(none)";
        matched = matched && matches;
        reasons.push(
            matches
                ? `✓ Debug session matches: "${contextDebug}" === "${when.debugSession}"`
                : `✗ Debug session mismatch: "${contextDebug}" !== "${when.debugSession}"`
        );
    }

    if (when.debugType !== undefined) {
        const matches = context.debugType === when.debugType;
        const contextType = context.debugType || "(none)";
        matched = matched && matches;
        reasons.push(
            matches
                ? `✓ Debug type matches: "${contextType}" === "${when.debugType}"`
                : `✗ Debug type mismatch: "${contextType}" !== "${when.debugType}"`
        );
    }

    if (when.testState !== undefined) {
        const matches = context.testState === when.testState;
        const contextState = context.testState || "(none)";
        matched = matched && matches;
        reasons.push(
            matches
                ? `✓ Test state matches: "${contextState}" === "${when.testState}"`
                : `✗ Test state mismatch: "${contextState}" !== "${when.testState}"`
        );
    }

    if (when.viewMode !== undefined) {
        const matches = context.viewMode === when.viewMode;
        const contextView = context.viewMode || "(none)";
        matched = matched && matches;
        reasons.push(
            matches
                ? `✓ View mode matches: "${contextView}" === "${when.viewMode}"`
                : `✗ View mode mismatch: "${contextView}" !== "${when.viewMode}"`
        );
    }

    if (when.timerInterval !== undefined) {
        const timerAllowed = options.allowTimerRules === true;
        const timerActive = options.activeTimerRuleIndices
            ? options.activeTimerRuleIndices.has(ruleIndex)
            : undefined;

        if (!timerAllowed) {
            matched = false;
            reasons.push("✗ Timer rule skipped: timer trigger not active");
        } else if (timerActive === false) {
            matched = false;
            reasons.push("✗ Timer rule skipped: timer event not fired for this rule");
        } else {
            reasons.push(`✓ Timer rule allowed (interval ${when.timerInterval}m)`);
        }
    }

    if (reasons.length === 0) {
        reasons.push("⚠ Rule has no conditions");
        matched = false;
    }

    return { matched, reasons };
}

// glob pattern matcher for file paths using minimatch
export function matchGlobPattern(filePath: string, pattern: string): boolean {
    const normalizedPath = filePath.replace(/\\/g, "/");
    const matchBase = !pattern.includes("/");

    return minimatch(normalizedPath, pattern, {
        dot: true,
        matchBase,
    });
}

// * extract file context from editor or document
export function extractFileContext(
    editorOrDocument: vscode.TextEditor | vscode.TextDocument | undefined
): FileContext {
    const document =
        editorOrDocument && "document" in editorOrDocument
            ? editorOrDocument.document
            : editorOrDocument;

    if (!document) {
        return {};
    }

    return {
        languageId: document.languageId,
        filePath: document.uri.fsPath,
        workspaceName: vscode.workspace.getWorkspaceFolder(document.uri)?.name,
    };
}
