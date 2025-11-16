// src/commands/manageRules.ts
// Command for managing existing theme rules

import * as vscode from 'vscode';
import { ThemeRule } from '../types';
import { loadConfig, updateRule, deleteRule } from '../config';
import { getInstalledThemes, describeThemeType } from '../themeCatalog';
import { buildOverlapMap } from '../ruleOverlap';
import { getRuleDescription } from '../ruleEngine';

// * manage existing rules (view, edit, delete)
export async function manageRules(): Promise<void> {
    console.log('[Reactive Themes] Managing rules');

    const config = loadConfig();

    if (config.rules.length === 0) {
        const createNew = await vscode.window.showInformationMessage(
            'No rules configured yet.',
            'Create First Rule'
        );

        if (createNew === 'Create First Rule') {
            await vscode.commands.executeCommand('reactiveThemes.createRuleFromCurrentFile');
        }
        return;
    }

    // show list of rules
    const selectedRuleIndex = await selectRule(config.rules);
    if (selectedRuleIndex === undefined) {
        return; // user cancelled
    }

    // show actions for selected rule
    await showRuleActions(selectedRuleIndex, config.rules[selectedRuleIndex]);
}

// show list of rules & let user select one
async function selectRule(rules: ThemeRule[]): Promise<number | undefined> {
    const overlapsMap = buildOverlapMap(rules);

    const items: Array<vscode.QuickPickItem & { index: number }> = rules.map((rule, index) => {
        const description = getRuleDescription(rule);
        const overlapCount = overlapsMap.get(index)?.length ?? 0;
        const hasOverlaps = overlapCount > 0;

        return {
            label: hasOverlaps ? `$(warning) ${rule.name}` : `$(symbol-rule) ${rule.name}`,
            description: description,
            detail: hasOverlaps
                ? `Overlaps with ${overlapCount} rule(s) • Theme: ${rule.theme}`
                : `Theme: ${rule.theme}`,
            index: index
        };
    });

    // add option to find duplicates at the top
    const hasDuplicates = overlapsMap.size > 0;
    if (hasDuplicates) {
        items.unshift({
            label: '$(search) Find All Duplicate/Overlapping Rules',
            description: `${overlapsMap.size} rule(s) with overlaps detected`,
            detail: 'Review and clean up duplicate rules',
            index: -1 // special index for this action
        });
    }

    const selected = await vscode.window.showQuickPick(items, {
        title: 'Manage Rules - Select a Rule',
        placeHolder: 'Choose a rule to manage'
    });

    if (!selected) {
        return undefined;
    }

    // handle special "find duplicates" option
    if (selected.index === -1) {
        await showDuplicateRules(rules, overlapsMap);
        return undefined;
    }

    return selected.index;
}

// show all duplicate/overlapping rules
async function showDuplicateRules(rules: ThemeRule[], overlapsMap: Map<number, ThemeRule[]>): Promise<void> {
    const items: Array<vscode.QuickPickItem & { index: number }> = [];

    for (const [index, overlapping] of overlapsMap.entries()) {
        const rule = rules[index];
        items.push({
            label: `$(warning) ${rule.name}`,
            description: getRuleDescription(rule),
            detail: `Overlaps with: ${overlapping.map(r => r.name).join(', ')}`,
            index: index
        });
    }

    const selected = await vscode.window.showQuickPick(items, {
        title: `Duplicate/Overlapping Rules (${items.length} total)`,
        placeHolder: 'Select a rule to manage or delete'
    });

    if (selected) {
        await showRuleActions(selected.index, rules[selected.index]);
    }
}

// show actions for a selected rule
async function showRuleActions(index: number, rule: ThemeRule): Promise<void> {
    const actions: vscode.QuickPickItem[] = [
        {
            label: '$(paintcan) Edit Theme',
            description: 'Change the theme for this rule'
        },
        {
            label: '$(edit) Edit Match Conditions',
            description: 'Change when this rule applies'
        },
        {
            label: '$(symbol-text) Rename Rule',
            description: 'Change the rule name'
        },
        {
            label: '$(trash) Delete Rule',
            description: 'Remove this rule permanently'
        }
    ];

    const selected = await vscode.window.showQuickPick(actions, {
        title: `Manage Rule: ${rule.name}`,
        placeHolder: 'Choose an action'
    });

    if (!selected) {
        return; // user cancelled
    }

    // handle selected action
    if (selected.label.includes('Edit Theme')) {
        await editTheme(index, rule);
    } else if (selected.label.includes('Edit Match Conditions')) {
        await editMatchConditions(index, rule);
    } else if (selected.label.includes('Rename Rule')) {
        await renameRule(index, rule);
    } else if (selected.label.includes('Delete Rule')) {
        await confirmDeleteRule(index, rule);
    }
}

// edit the theme for a rule
async function editTheme(index: number, rule: ThemeRule): Promise<void> {
    const installedThemes = getInstalledThemes();

    if (installedThemes.length === 0) {
        vscode.window.showWarningMessage('No themes found.');
        return;
    }

    // sort themes alphabetically
    installedThemes.sort((a, b) => a.label.localeCompare(b.label));

    // build QuickPick items
    const items: vscode.QuickPickItem[] = installedThemes.map(theme => {
        // mark current theme
        const isCurrent = theme.label === rule.theme;

        return {
            label: isCurrent ? `$(check) ${theme.label}` : theme.label,
            description: theme.extensionName,
            detail: describeThemeType(theme.uiTheme)
        };
    });

    const selected = await vscode.window.showQuickPick(items, {
        title: `Edit Theme for: ${rule.name}`,
        placeHolder: 'Select a new theme',
        matchOnDescription: true,
        matchOnDetail: true
    });

    if (!selected) {
        return;
    }

    // extract theme name (remove checkmark if present)
    const newThemeName = selected.label.replace('$(check) ', '');

    if (newThemeName === rule.theme) {
        vscode.window.showInformationMessage('Theme unchanged.');
        return;
    }

    // update rule
    const updatedRule: ThemeRule = {
        ...rule,
        theme: newThemeName
    };

    try {
        await updateRule(index, updatedRule);
        vscode.window.showInformationMessage(`Theme updated to "${newThemeName}"`);
    } catch (error) {
        // error already shown by updateRule helper
    }
}

// edit match conditions for a rule
async function editMatchConditions(index: number, rule: ThemeRule): Promise<void> {
    // determine current match type
    const hasLanguage = Boolean(rule.when.language);
    const hasPattern = Boolean(rule.when.pattern);
    const hasWorkspace = Boolean(rule.when.workspaceName);

    const options: Array<vscode.QuickPickItem & { type: 'language' | 'pattern' | 'workspace' }> = [
        {
            label: '$(symbol-keyword) Language',
            description: hasLanguage ? `Current: ${rule.when.language}` : 'Not set',
            type: 'language'
        },
        {
            label: '$(file-code) Glob Pattern',
            description: hasPattern ? `Current: ${rule.when.pattern}` : 'Not set',
            type: 'pattern'
        },
        {
            label: '$(folder) Workspace Name',
            description: hasWorkspace ? `Current: ${rule.when.workspaceName}` : 'Not set',
            type: 'workspace'
        }
    ];

    const selected = await vscode.window.showQuickPick(options, {
        title: `Edit Match Conditions: ${rule.name}`,
        placeHolder: 'Choose a condition to edit'
    });

    if (!selected) {
        return;
    }

    // get new value
    let newValue: string | undefined;
    let prompt: string;
    let placeholder: string;
    let currentValue: string | undefined;

    if (selected.type === 'language') {
        prompt = 'Enter language ID (e.g., typescript, python, javascript)';
        placeholder = 'typescript';
        currentValue = rule.when.language;
    } else if (selected.type === 'pattern') {
        prompt = 'Enter glob pattern (e.g., **/*.test.ts, **/*.config.js)';
        placeholder = '**/*.ts';
        currentValue = rule.when.pattern;
    } else {
        prompt = 'Enter workspace name';
        placeholder = 'my-project';
        currentValue = rule.when.workspaceName;
    }

    newValue = await vscode.window.showInputBox({
        prompt: prompt,
        placeHolder: placeholder,
        value: currentValue,
        validateInput: (value) => {
            if (!value || value.trim().length === 0) {
                return 'Value cannot be empty';
            }
            return undefined;
        }
    });

    if (!newValue) {
        return;
    }

    // build updated rule with new condition while preserving other predicates
    const updatedRule: ThemeRule = {
        ...rule,
        when: {
            ...rule.when
        }
    };

    if (selected.type === 'language') {
        updatedRule.when.language = newValue.trim();
    } else if (selected.type === 'pattern') {
        updatedRule.when.pattern = newValue.trim();
    } else {
        updatedRule.when.workspaceName = newValue.trim();
    }

    try {
        await updateRule(index, updatedRule);
        vscode.window.showInformationMessage(`Match condition updated successfully`);
    } catch (error) {
        // error already shown by updateRule helper
    }
}

// rename a rule
async function renameRule(index: number, rule: ThemeRule): Promise<void> {
    const newName = await vscode.window.showInputBox({
        prompt: 'Enter a new name for this rule',
        value: rule.name,
        validateInput: (value) => {
            if (!value || value.trim().length === 0) {
                return 'Rule name cannot be empty';
            }
            return undefined;
        }
    });

    if (!newName) {
        return;
    }

    if (newName.trim() === rule.name) {
        vscode.window.showInformationMessage('Name unchanged.');
        return;
    }

    const updatedRule: ThemeRule = {
        ...rule,
        name: newName.trim()
    };

    try {
        await updateRule(index, updatedRule);
        vscode.window.showInformationMessage(`Rule renamed to "${newName.trim()}"`);
    } catch (error) {
        // error already shown by updateRule helper
    }
}

// confirm and delete a rule
async function confirmDeleteRule(index: number, rule: ThemeRule): Promise<void> {
    const confirmation = await vscode.window.showWarningMessage(
        `Delete rule "${rule.name}"?`,
        { modal: true },
        'Delete',
        'Cancel'
    );

    if (confirmation !== 'Delete') {
        return;
    }

    try {
        await deleteRule(index);
        vscode.window.showInformationMessage(`Rule "${rule.name}" deleted successfully`);
    } catch (error) {
        // error already shown by deleteRule helper
    }
}
