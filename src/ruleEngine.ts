// src/ruleEngine.ts
// Rule matching & evaluation engine for Reactive Themes

import * as vscode from 'vscode';
import { ThemeRule, RuleMatchResult } from './types';

// * evaluate rules against current editor context
export function evaluateRules(rules: ThemeRule[], editor?: vscode.TextEditor): RuleMatchResult {
    // bail out if no editor to match against
    if (!editor) {
        return { matched: false };
    }

    const document = editor.document;
    const languageId = document.languageId;
    const filePath = document.uri.fsPath;
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    const workspaceName = workspaceFolder?.name;

    // return first matching rule (first-match-wins strategy)
    for (const rule of rules) {
        if (matchesRule(rule, languageId, filePath, workspaceName)) {
            return {
                matched: true,
                rule: rule,
                theme: rule.theme
            };
        }
    }

    return { matched: false };
}

// check if single rule matches current context
function matchesRule(
    rule: ThemeRule,
    languageId: string,
    filePath: string,
    workspaceName: string | undefined
): boolean {
    const when = rule.when;

    // check language condition
    if (when.language) {
        if (languageId !== when.language) {
            return false;
        }
    }

    // check file path pattern condition
    if (when.pattern) {
        if (!matchGlobPattern(filePath, when.pattern)) {
            return false;
        }
    }

    // check workspace name condition
    if (when.workspaceName) {
        if (workspaceName !== when.workspaceName) {
            return false;
        }
    }

    // all specified conditions matched
    return true;
}

// simple glob pattern matcher for file paths
function matchGlobPattern(filePath: string, pattern: string): boolean {
    // normalize path separators to forward slashes
    const normalizedPath = filePath.replace(/\\/g, '/');

    // convert glob pattern to regex
    let regexPattern = pattern
        .replace(/\\/g, '/') // normalize pattern separators
        .replace(/\./g, '\\.') // escape dots
        .replace(/\*\*/g, '§§') // temporarily replace ** w/ placeholder
        .replace(/\*/g, '[^/]*') // replace * w/ regex for any non-slash chars
        .replace(/§§/g, '.*'); // replace ** w/ regex for any chars including slashes

    // add anchors for full path matching
    regexPattern = '^' + regexPattern + '$';

    const regex = new RegExp(regexPattern);
    return regex.test(normalizedPath);
}

// generate human-readable description of rule conditions
export function getRuleDescription(rule: ThemeRule): string {
    const parts: string[] = [];

    if (rule.when.language) {
        parts.push(`language: ${rule.when.language}`);
    }

    if (rule.when.pattern) {
        parts.push(`pattern: ${rule.when.pattern}`);
    }

    if (rule.when.workspaceName) {
        parts.push(`workspace: ${rule.when.workspaceName}`);
    }

    return parts.join(', ');
}
