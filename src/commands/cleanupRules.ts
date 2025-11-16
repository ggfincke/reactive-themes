// src/commands/cleanupRules.ts
// Command for finding and removing duplicate/overlapping rules

import * as vscode from 'vscode';
import { ThemeRule } from '../types';
import { loadConfig, deleteRule } from '../config';
import { buildOverlapMap } from '../ruleOverlap';
import { getRuleDescription } from '../ruleEngine';

// * find & clean up duplicate/overlapping rules
export async function cleanupDuplicateRules(): Promise<void> {
    console.log('[Reactive Themes] Cleaning up duplicate rules');

    const config = loadConfig();

    if (config.rules.length === 0) {
        vscode.window.showInformationMessage('No rules configured yet.');
        return;
    }

    // find all overlapping rules
    const overlapsMap = buildOverlapMap(config.rules);

    if (overlapsMap.size === 0) {
        vscode.window.showInformationMessage('No duplicate or overlapping rules found!');
        return;
    }

    // show summary
    const summary = await vscode.window.showInformationMessage(
        `Found ${overlapsMap.size} rule(s) with overlaps.\n\nDo you want to review and clean them up?`,
        { modal: true },
        'Review Rules',
        'Cancel'
    );

    if (summary !== 'Review Rules') {
        return;
    }

    // show overlapping rules and allow deletion
    await reviewOverlappingRules(config.rules, overlapsMap);
}

// review overlapping rules & allow selective deletion
async function reviewOverlappingRules(rules: ThemeRule[], overlapsMap: Map<number, ThemeRule[]>): Promise<void> {
    // build list of overlapping rules
    const items: Array<vscode.QuickPickItem & { index: number; canPick: boolean }> = [];

    for (const [index, overlapping] of overlapsMap.entries()) {
        const rule = rules[index];
        items.push({
            label: `$(warning) ${rule.name}`,
            description: getRuleDescription(rule),
            detail: `Overlaps with: ${overlapping.map(r => r.name).join(', ')}`,
            index: index,
            canPick: true
        });
    }

    // add bulk delete option at the top
    items.unshift({
        label: '$(trash) Delete All Overlapping Rules',
        description: `Remove all ${overlapsMap.size} overlapping rules`,
        detail: 'WARNING: This will delete all rules shown below',
        index: -1,
        canPick: true
    });

    const selected = await vscode.window.showQuickPick(items, {
        title: `Overlapping Rules (${overlapsMap.size} total)`,
        placeHolder: 'Select a rule to delete, or choose bulk delete',
        canPickMany: false
    });

    if (!selected) {
        return;
    }

    // handle bulk delete
    if (selected.index === -1) {
        await bulkDeleteOverlappingRules(rules, overlapsMap);
        return;
    }

    // handle single rule deletion
    const rule = rules[selected.index];
    const confirmation = await vscode.window.showWarningMessage(
        `Delete overlapping rule "${rule.name}"?\n\n${getRuleDescription(rule)}`,
        { modal: true },
        'Delete',
        'Cancel'
    );

    if (confirmation === 'Delete') {
        try {
            await deleteRule(selected.index);
            vscode.window.showInformationMessage(`Rule "${rule.name}" deleted successfully`);

            // ask if user wants to continue reviewing
            const continueReview = await vscode.window.showInformationMessage(
                'Continue reviewing overlapping rules?',
                'Yes',
                'No'
            );

            if (continueReview === 'Yes') {
                // reload and continue
                await cleanupDuplicateRules();
            }
        } catch (error) {
            // error already shown by deleteRule helper
        }
    }
}

// bulk delete all overlapping rules
async function bulkDeleteOverlappingRules(rules: ThemeRule[], overlapsMap: Map<number, ThemeRule[]>): Promise<void> {
    const confirmation = await vscode.window.showWarningMessage(
        `Delete ${overlapsMap.size} overlapping rules?\n\nThis action cannot be undone.`,
        { modal: true },
        'Delete All',
        'Cancel'
    );

    if (confirmation !== 'Delete All') {
        return;
    }

    // delete rules in reverse order to maintain indices
    const indicesToDelete = Array.from(overlapsMap.keys()).sort((a, b) => b - a);

    let deletedCount = 0;
    let failedCount = 0;

    for (const index of indicesToDelete) {
        try {
            await deleteRule(index);
            deletedCount++;
        } catch (error) {
            failedCount++;
            console.error('[Reactive Themes] Failed to delete rule at index', index, error);
        }
    }

    if (failedCount === 0) {
        vscode.window.showInformationMessage(`Successfully deleted ${deletedCount} overlapping rule(s)`);
    } else {
        vscode.window.showWarningMessage(
            `Deleted ${deletedCount} rule(s), but ${failedCount} failed to delete. Check the console for details.`
        );
    }
}
