// src/utils/ruleFormatters.ts
// Centralized rule condition formatting utilities

import { ThemeRule } from "../types";

export type FormatMode = "compact" | "equality" | "markdown";

export interface FormatOptions {
	mode: FormatMode;
	includeTimer?: boolean;
}

// * Format rule conditions into human-readable strings
// Consolidates formatting logic previously scattered across ruleEngine, explainTheme, & extension
export function formatRuleConditions(
	rule: ThemeRule,
	options: FormatOptions = { mode: "compact" }
): string | string[] {
	const { mode, includeTimer = true } = options;
	const when = rule.when;

	// Build array of condition strings based on mode
	const conditions: string[] = [];

	if (when.language) {
		conditions.push(formatCondition("language", when.language, mode));
	}
	if (when.pattern) {
		conditions.push(formatCondition("pattern", when.pattern, mode));
	}
	if (when.workspaceName) {
		conditions.push(
			formatCondition("workspaceName", when.workspaceName, mode)
		);
	}
	if (when.debugSession) {
		conditions.push(
			formatCondition("debugSession", when.debugSession, mode)
		);
	}
	if (when.debugType) {
		conditions.push(formatCondition("debugType", when.debugType, mode));
	}
	if (when.testState) {
		conditions.push(formatCondition("testState", when.testState, mode));
	}
	if (when.viewMode) {
		conditions.push(formatCondition("viewMode", when.viewMode, mode));
	}
	// Timer interval handled separately since it's numeric & needs special formatting
	if (includeTimer && when.timerInterval !== undefined) {
		conditions.push(
			formatCondition(
				"timerInterval",
				`${when.timerInterval} min`,
				mode
			)
		);
	}

	// Return format depends on mode
	if (mode === "compact") {
		return conditions.join(", ");
	} else if (mode === "equality") {
		return conditions;
	} else {
		// markdown mode
		return conditions.map((c) => `- ${c}`).join("\n");
	}
}

// Format a single condition based on mode
function formatCondition(
	key: string,
	value: string,
	mode: FormatMode
): string {
	// Convert camelCase to readable format
	const readableKey = camelCaseToReadable(key);

	if (mode === "compact") {
		return `${readableKey}: ${value}`;
	} else if (mode === "equality") {
		return `${readableKey} == "${value}"`;
	} else {
		// markdown mode
		return `**${readableKey}**: ${value}`;
	}
}

// Convert camelCase to readable format w/ proper capitalization
function camelCaseToReadable(str: string): string {
	// Special cases for acronyms & compound words
	const specialCases: Record<string, string> = {
		debugSession: "Debug Session",
		debugType: "Debug Type",
		testState: "Test State",
		viewMode: "View Mode",
		timerInterval: "Timer Interval",
		workspaceName: "Workspace Name",
	};

	if (specialCases[str]) {
		return specialCases[str];
	}

	// Default: capitalize first letter
	return str.charAt(0).toUpperCase() + str.slice(1);
}

// * Generate a concise description of a rule for QuickPick displays
// Replaces getRuleDescription from ruleEngine.ts
export function formatRuleForQuickPick(rule: ThemeRule): string {
	const conditions = formatRuleConditions(rule, { mode: "compact" });
	return `${rule.name} → ${rule.theme} (${conditions || "always"})`;
}

// * Generate detailed condition list for explanations
// Replaces getRuleConditions from explainTheme.ts
export function formatRuleConditionsDetailed(rule: ThemeRule): string[] {
	const result = formatRuleConditions(rule, { mode: "equality" });
	return Array.isArray(result) ? result : [result];
}

// * Generate markdown-formatted rule description
// Replaces inline formatting in extension.ts showActiveRule
export function formatRuleAsMarkdown(rule: ThemeRule): string {
	const conditions = formatRuleConditions(rule, { mode: "markdown" });
	return `**Rule**: ${rule.name}\n**Theme**: ${rule.theme}\n\n**Conditions**:\n${conditions || "- Always active"}`;
}
