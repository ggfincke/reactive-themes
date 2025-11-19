// src/commands/uiHelpers.ts
// Shared UI component helpers for QuickPick flows & output management

import * as vscode from "vscode";
import { ThemeRule } from "../types";
import { describeThemeType, getInstalledThemes, InstalledTheme } from "../themeCatalog";
import { LintIssue, getSeverityIcon } from "../ruleLinter";
import { formatRuleConditions } from "../utils/ruleFormatters";

// ? singleton output channel - prevents resource leaks from multiple channel creation
let sharedOutputChannel: vscode.OutputChannel | undefined;
const adHocChannels: vscode.OutputChannel[] = [];

// * get or create shared output channel
// uses fixed channel name for all extension output
export function getSharedOutputChannel(): vscode.OutputChannel {
    if (!sharedOutputChannel) {
        sharedOutputChannel = vscode.window.createOutputChannel("Reactive Themes");
        adHocChannels.push(sharedOutputChannel);
    }
    return sharedOutputChannel;
}

export function trackOutputChannel(channel: vscode.OutputChannel): vscode.OutputChannel {
    adHocChannels.push(channel);
    return channel;
}

export function disposeOutputChannels(): void {
    adHocChannels.forEach((channel) => channel.dispose());
    adHocChannels.length = 0;
    sharedOutputChannel = undefined;
}

interface ThemeQuickPickItem extends vscode.QuickPickItem {
    theme: InstalledTheme;
}

// * select a theme from installed themes
export async function selectTheme(options?: {
    title?: string;
    currentTheme?: string;
}): Promise<InstalledTheme | undefined> {
    const installedThemes = getInstalledThemes();
    installedThemes.sort((a, b) => a.label.localeCompare(b.label));

    // build quickpick items w/ descriptive info
    const items: ThemeQuickPickItem[] = installedThemes.map((theme) => {
        return {
            label: theme.label,
            description: theme.extensionName,
            detail: describeThemeType(theme.uiTheme),
            picked:
                options?.currentTheme === theme.id ||
                options?.currentTheme === theme.label,
            theme,
        };
    });

    const selected = await vscode.window.showQuickPick<ThemeQuickPickItem>(items, {
        title: options?.title || "Select a theme",
        matchOnDescription: true,
        matchOnDetail: true,
    });

    if (!selected) {
        return undefined;
    }

    return selected.theme;
}

interface RuleSelectOptions {
    title?: string;
    placeHolder?: string;
    description?: (rule: ThemeRule, index: number) => string | undefined;
    overlapsMap?: Map<number, ThemeRule[]>;
    includeFindDuplicatesItem?: boolean;
}

// * select a rule from list
export async function selectRule(
    rules: ThemeRule[],
    options?: RuleSelectOptions
): Promise<number | undefined> {
    if (rules.length === 0) {
        return undefined;
    }

    const items: (vscode.QuickPickItem & { ruleIndex: number })[] = rules.map((rule, index) => {
        const overlapCount = options?.overlapsMap?.get(index)?.length ?? 0;
        const hasOverlaps = overlapCount > 0;
        const defaultDescription =
            options?.description?.(rule, index) ||
            (formatRuleConditions(rule, { mode: "compact" }) as string);

        return {
            label: hasOverlaps ? `$(warning) ${rule.name}` : `$(symbol-rule) ${rule.name}`,
            description: defaultDescription,
            detail: hasOverlaps
                ? `Overlaps with ${overlapCount} rule(s) • Theme: ${rule.theme}`
                : `Theme: ${rule.theme}`,
            ruleIndex: index,
        };
    });

    if (options?.includeFindDuplicatesItem && (options.overlapsMap?.size ?? 0) > 0) {
        items.unshift({
            label: "$(search) Find All Duplicate/Overlapping Rules",
            description: `${options.overlapsMap?.size ?? 0} rule(s) with overlaps detected`,
            detail: "Review and clean up duplicate rules",
            ruleIndex: -1,
        });
    }

    const selected = await vscode.window.showQuickPick(items, {
        title: options?.title || "Select a rule",
        placeHolder: options?.placeHolder,
    });

    return selected?.ruleIndex;
}

export interface LintIssueQuickPickItem extends vscode.QuickPickItem {
    issue?: LintIssue;
    action?: string;
}

// * shared lint issue picker for cleanup & lint commands
export async function showLintIssuePicker(
    issues: LintIssue[],
    options?: {
        title?: string;
        placeHolder?: string;
        extraItems?: LintIssueQuickPickItem[];
    }
): Promise<LintIssueQuickPickItem | undefined> {
    const items: LintIssueQuickPickItem[] = issues.map((issue) => ({
        label: `${getSeverityIcon(issue.severity)} Rule #${issue.ruleIndex + 1}: "${issue.rule.name}"`,
        description: formatRuleConditions(issue.rule, { mode: "compact" }) as string,
        detail: issue.message,
        issue,
    }));

    const mergedItems: LintIssueQuickPickItem[] = [
        ...(options?.extraItems || []),
        ...items,
    ];

    const selected = await vscode.window.showQuickPick<LintIssueQuickPickItem>(mergedItems, {
        title: options?.title,
        placeHolder: options?.placeHolder,
        matchOnDescription: true,
        matchOnDetail: true,
    });

    return selected;
}

// * confirm an action w/ user
export async function confirmAction(
    title: string,
    options?: {
        confirmLabel?: string;
        cancelLabel?: string;
        modal?: boolean;
        severity?: "info" | "warning" | "error";
    }
): Promise<boolean> {
    const confirmLabel = options?.confirmLabel || "Confirm";
    const cancelLabel = options?.cancelLabel || "Cancel";

    let result: string | undefined;

    if (options?.modal) {
        // use modal version
        switch (options?.severity) {
            case "info":
                result = await vscode.window.showInformationMessage(
                    title,
                    { modal: true },
                    confirmLabel,
                    cancelLabel
                );
                break;
            case "error":
                result = await vscode.window.showErrorMessage(
                    title,
                    { modal: true },
                    confirmLabel,
                    cancelLabel
                );
                break;
            case "warning":
            default:
                result = await vscode.window.showWarningMessage(
                    title,
                    { modal: true },
                    confirmLabel,
                    cancelLabel
                );
                break;
        }
    } else {
        // use non-modal version
        switch (options?.severity) {
            case "info":
                result = await vscode.window.showInformationMessage(title, confirmLabel, cancelLabel);
                break;
            case "error":
                result = await vscode.window.showErrorMessage(title, confirmLabel, cancelLabel);
                break;
            case "warning":
            default:
                result = await vscode.window.showWarningMessage(title, confirmLabel, cancelLabel);
                break;
        }
    }

    return result === confirmLabel;
}
