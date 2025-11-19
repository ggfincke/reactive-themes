// src/utils/ruleOperations.ts
// Common rule operations extracted from multiple commands

import * as vscode from "vscode";
import { loadConfig, updateAllRules } from "../config";
import { ThemeRule } from "../types";
import { rulesMatchExactly } from "../ruleOverlap";

// * delete multiple rules by their indices
// performs single atomic operation instead of multiple config writes
export async function deleteRules(indices: number[]): Promise<void> {
    if (indices.length === 0) {
        return;
    }

    const config = loadConfig();

    // validate all indices before making changes
    for (const index of indices) {
        if (index < 0 || index >= config.rules.length) {
            throw new Error(`Invalid rule index: ${index}`);
        }
    }

    // create set for O(1) lookup
    const indicesToDelete = new Set(indices);

    // filter out rules at specified indices
    const newRules = config.rules.filter((_, idx) => !indicesToDelete.has(idx));

    // single atomic update
    await updateAllRules(newRules);
}

// * move a rule from one position to another
export async function moveRule(fromIndex: number, toIndex: number): Promise<void> {
    const config = loadConfig();

    if (fromIndex < 0 || fromIndex >= config.rules.length) {
        throw new Error(`Invalid source index: ${fromIndex}`);
    }

    if (toIndex < 0 || toIndex > config.rules.length) {
        throw new Error(`Invalid destination index: ${toIndex}`);
    }

    if (fromIndex === toIndex) {
        return; // no-op
    }

    const rule = config.rules[fromIndex];
    config.rules.splice(fromIndex, 1);
    config.rules.splice(toIndex, 0, rule);

    // update config w/ reordered rules using mutex
    await updateAllRules(config.rules);
}

export interface RuleMove {
    fromIndex?: number;
    toIndex?: number;
    rule?: ThemeRule;
    targetRule?: ThemeRule;
}

// * reorder rules by applying a series of moves
export async function reorderRules(moves: RuleMove[]): Promise<void> {
    const config = loadConfig();
    const newRules = [...config.rules];

    const resolveIndex = (rule?: ThemeRule, fallback?: number): number => {
        if (fallback !== undefined) {
            return fallback;
        }
        if (!rule) {
            return -1;
        }

        return newRules.findIndex((candidate) => rulesMatchExactly(candidate, rule));
    };

    // apply all moves to build new order
    for (const { fromIndex, toIndex, rule, targetRule } of moves) {
        const sourceIndex = resolveIndex(rule, fromIndex);
        const targetIndex = resolveIndex(targetRule, toIndex);

        if (sourceIndex < 0 || sourceIndex >= newRules.length) {
            throw new Error(`Invalid source index: ${sourceIndex}`);
        }

        if (targetIndex < 0 || targetIndex > newRules.length) {
            throw new Error(`Invalid destination index: ${targetIndex}`);
        }

        if (sourceIndex === targetIndex) {
            continue;
        }

        const [ruleToMove] = newRules.splice(sourceIndex, 1);
        const adjustedIndex =
            targetRule !== undefined && sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;

        newRules.splice(adjustedIndex, 0, ruleToMove);
    }

    // update config w/ reordered rules using mutex
    await updateAllRules(newRules);
}
// * centralized confirmation for deleting a rule
export async function confirmDeleteRule(ruleName: string): Promise<boolean> {
    const response = await vscode.window.showWarningMessage(
        `Delete rule "${ruleName}"?`,
        { modal: true },
        "Delete",
        "Cancel"
    );
    return response === "Delete";
}
