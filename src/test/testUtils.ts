// src/test/testUtils.ts
// Shared test utilities & mock builders

import * as vscode from "vscode";
import { ThemeRule } from "../types";
import { Context } from "../contextManager";

// * create mock editor w/ specified language & path
export function createMockEditor(languageId: string, filePath: string): vscode.TextEditor {
    return {
        document: {
            languageId,
            uri: vscode.Uri.file(filePath),
            // additional VSCode document properties as needed
        } as unknown as vscode.TextDocument,
    } as unknown as vscode.TextEditor;
}

// * create mock rule w/ optional overrides
export function createMockRule(overrides?: Partial<ThemeRule>): ThemeRule {
    const defaults: ThemeRule = {
        name: "Test Rule",
        when: {
            language: "typescript",
        },
        theme: "TestTheme",
    };

    return {
        ...defaults,
        ...overrides,
        when: {
            ...defaults.when,
            ...(overrides?.when || {}),
        },
    };
}

// * create mock context w/ optional overrides
export function createMockContext(overrides?: Partial<Context>): Context {
    const defaults: Context = {
        debugSession: "inactive",
        debugType: undefined,
        testState: "none",
        viewMode: "normal",
        timerTick: 0,
    };

    return {
        ...defaults,
        ...overrides,
    };
}

// * assert rule matches context
export function assertRuleMatches(
    rule: ThemeRule,
    editor: vscode.TextEditor,
    context: Context
): boolean {
    // import here to avoid circular dependencies in test setup
    const { getRuleMatchDetails } = require("../ruleEngine");

    const fileContext = {
        languageId: editor.document.languageId,
        filePath: editor.document.uri.fsPath,
        workspaceName: undefined,
    };

    const result = getRuleMatchDetails(rule, fileContext, context);
    return result.matched;
}

// * create collection of rules w/ varied conditions for testing
export function createMockRuleSet(): ThemeRule[] {
    return [
        createMockRule({
            name: "TypeScript Light Theme",
            when: { language: "typescript" },
            theme: "GitHub Light",
        }),
        createMockRule({
            name: "Python Debug Theme",
            when: { language: "python", debugSession: "active" },
            theme: "Dracula",
        }),
        createMockRule({
            name: "Test Files Dark Theme",
            when: { pattern: "**/*.test.ts" },
            theme: "One Dark Pro",
        }),
        createMockRule({
            name: "Workspace-Specific Theme",
            when: { workspaceName: "my-project" },
            theme: "Nord",
        }),
    ];
}
