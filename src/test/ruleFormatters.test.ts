// src/test/ruleFormatters.test.ts
// Tests for centralized rule formatting utilities

import * as assert from "assert";
import {
	formatRuleConditions,
	formatRuleForQuickPick,
	formatRuleConditionsDetailed,
	formatRuleAsMarkdown,
} from "../utils/ruleFormatters";
import { ThemeRule } from "../types";

suite("Rule Formatters", () => {
	suite("formatRuleConditions", () => {
		test("compact mode: single file condition", () => {
			const rule: ThemeRule = {
				name: "TypeScript Rule",
				when: { language: "typescript" },
				theme: "Dark+",
			};

			const result = formatRuleConditions(rule, { mode: "compact" });
			assert.strictEqual(result, "Language: typescript");
		});

		test("compact mode: multiple file conditions", () => {
			const rule: ThemeRule = {
				name: "Multi Rule",
				when: {
					language: "python",
					pattern: "**/*.py",
					workspaceName: "my-project",
				},
				theme: "Monokai",
			};

			const result = formatRuleConditions(rule, { mode: "compact" });
			assert.strictEqual(
				result,
				"Language: python, Pattern: **/*.py, Workspace Name: my-project"
			);
		});

		test("compact mode: context conditions", () => {
			const rule: ThemeRule = {
				name: "Debug Rule",
				when: {
					debugSession: "active",
					debugType: "node",
					testState: "running",
					viewMode: "diff",
				},
				theme: "High Contrast",
			};

			const result = formatRuleConditions(rule, { mode: "compact" });
			assert.strictEqual(
				result,
				"Debug Session: active, Debug Type: node, Test State: running, View Mode: diff"
			);
		});

		test("compact mode: timer interval", () => {
			const rule: ThemeRule = {
				name: "Timer Rule",
				when: { timerInterval: 30 },
				theme: "Solarized Light",
			};

			const result = formatRuleConditions(rule, { mode: "compact" });
			assert.strictEqual(result, "Timer Interval: 30 min");
		});

		test("compact mode: mixed file and context conditions", () => {
			const rule: ThemeRule = {
				name: "Complex Rule",
				when: {
					language: "typescript",
					debugSession: "active",
					testState: "failed",
				},
				theme: "Red Alert",
			};

			const result = formatRuleConditions(rule, { mode: "compact" });
			assert.strictEqual(
				result,
				"Language: typescript, Debug Session: active, Test State: failed"
			);
		});

		test("compact mode: empty conditions returns empty string", () => {
			const rule: ThemeRule = {
				name: "Always Rule",
				when: {},
				theme: "Default",
			};

			const result = formatRuleConditions(rule, { mode: "compact" });
			assert.strictEqual(result, "");
		});

		test("compact mode: excludes timer when includeTimer is false", () => {
			const rule: ThemeRule = {
				name: "Timer Rule",
				when: { language: "typescript", timerInterval: 15 },
				theme: "Theme",
			};

			const result = formatRuleConditions(rule, {
				mode: "compact",
				includeTimer: false,
			});
			assert.strictEqual(result, "Language: typescript");
		});

		test("equality mode: single condition", () => {
			const rule: ThemeRule = {
				name: "Rule",
				when: { language: "javascript" },
				theme: "Theme",
			};

			const result = formatRuleConditions(rule, { mode: "equality" });
			assert.deepStrictEqual(result, ['Language == "javascript"']);
		});

		test("equality mode: multiple conditions", () => {
			const rule: ThemeRule = {
				name: "Rule",
				when: {
					language: "python",
					pattern: "src/**/*.py",
					debugSession: "inactive",
				},
				theme: "Theme",
			};

			const result = formatRuleConditions(rule, { mode: "equality" });
			assert.deepStrictEqual(result, [
				'Language == "python"',
				'Pattern == "src/**/*.py"',
				'Debug Session == "inactive"',
			]);
		});

		test("equality mode: timer interval", () => {
			const rule: ThemeRule = {
				name: "Rule",
				when: { timerInterval: 60 },
				theme: "Theme",
			};

			const result = formatRuleConditions(rule, { mode: "equality" });
			assert.deepStrictEqual(result, ['Timer Interval == "60 min"']);
		});

		test("markdown mode: single condition", () => {
			const rule: ThemeRule = {
				name: "Rule",
				when: { language: "rust" },
				theme: "Theme",
			};

			const result = formatRuleConditions(rule, { mode: "markdown" });
			assert.strictEqual(result, "- **Language**: rust");
		});

		test("markdown mode: multiple conditions", () => {
			const rule: ThemeRule = {
				name: "Rule",
				when: {
					pattern: "test/**/*.ts",
					testState: "passed",
					viewMode: "normal",
				},
				theme: "Theme",
			};

			const result = formatRuleConditions(rule, { mode: "markdown" });
			assert.strictEqual(
				result,
				"- **Pattern**: test/**/*.ts\n- **Test State**: passed\n- **View Mode**: normal"
			);
		});

		test("markdown mode: empty conditions", () => {
			const rule: ThemeRule = {
				name: "Rule",
				when: {},
				theme: "Theme",
			};

			const result = formatRuleConditions(rule, { mode: "markdown" });
			assert.strictEqual(result, "");
		});
	});

	suite("formatRuleForQuickPick", () => {
		test("formats rule with conditions", () => {
			const rule: ThemeRule = {
				name: "TypeScript Files",
				when: { language: "typescript", pattern: "src/**/*.ts" },
				theme: "Dark+",
			};

			const result = formatRuleForQuickPick(rule);
			assert.strictEqual(
				result,
				"TypeScript Files → Dark+ (Language: typescript, Pattern: src/**/*.ts)"
			);
		});

		test("formats rule without conditions as always", () => {
			const rule: ThemeRule = {
				name: "Default Theme",
				when: {},
				theme: "Monokai",
			};

			const result = formatRuleForQuickPick(rule);
			assert.strictEqual(result, "Default Theme → Monokai (always)");
		});

		test("formats rule with context conditions", () => {
			const rule: ThemeRule = {
				name: "Debug Mode",
				when: { debugSession: "active", debugType: "node" },
				theme: "High Contrast",
			};

			const result = formatRuleForQuickPick(rule);
			assert.strictEqual(
				result,
				"Debug Mode → High Contrast (Debug Session: active, Debug Type: node)"
			);
		});
	});

	suite("formatRuleConditionsDetailed", () => {
		test("returns array of equality statements", () => {
			const rule: ThemeRule = {
				name: "Rule",
				when: {
					language: "python",
					workspaceName: "backend",
					testState: "running",
				},
				theme: "Theme",
			};

			const result = formatRuleConditionsDetailed(rule);
			assert.deepStrictEqual(result, [
				'Language == "python"',
				'Workspace Name == "backend"',
				'Test State == "running"',
			]);
		});

		test("returns empty array for no conditions", () => {
			const rule: ThemeRule = {
				name: "Rule",
				when: {},
				theme: "Theme",
			};

			const result = formatRuleConditionsDetailed(rule);
			assert.deepStrictEqual(result, []);
		});
	});

	suite("formatRuleAsMarkdown", () => {
		test("formats complete rule with conditions", () => {
			const rule: ThemeRule = {
				name: "Production Debug",
				when: {
					workspaceName: "prod-api",
					debugSession: "active",
					debugType: "python",
				},
				theme: "Red Theme",
			};

			const result = formatRuleAsMarkdown(rule);
			const expected = `**Rule**: Production Debug
**Theme**: Red Theme

**Conditions**:
- **Workspace Name**: prod-api
- **Debug Session**: active
- **Debug Type**: python`;

			assert.strictEqual(result, expected);
		});

		test("formats rule without conditions", () => {
			const rule: ThemeRule = {
				name: "Always Active",
				when: {},
				theme: "Default Theme",
			};

			const result = formatRuleAsMarkdown(rule);
			const expected = `**Rule**: Always Active
**Theme**: Default Theme

**Conditions**:
- Always active`;

			assert.strictEqual(result, expected);
		});

		test("formats rule with timer interval", () => {
			const rule: ThemeRule = {
				name: "Break Reminder",
				when: { timerInterval: 45 },
				theme: "Light Theme",
			};

			const result = formatRuleAsMarkdown(rule);
			const expected = `**Rule**: Break Reminder
**Theme**: Light Theme

**Conditions**:
- **Timer Interval**: 45 min`;

			assert.strictEqual(result, expected);
		});
	});

	suite("Consistency across formats", () => {
		test("all formats handle all condition types", () => {
			const rule: ThemeRule = {
				name: "Complex Rule",
				when: {
					language: "typescript",
					pattern: "**/*.test.ts",
					workspaceName: "test-suite",
					debugSession: "active",
					debugType: "node",
					testState: "running",
					viewMode: "diff",
					timerInterval: 30,
				},
				theme: "Test Theme",
			};

			// All formats should handle all 8 conditions
			const compact = formatRuleConditions(rule, { mode: "compact" });
			const equality = formatRuleConditions(rule, { mode: "equality" });
			const markdown = formatRuleConditions(rule, { mode: "markdown" });

			// Compact: comma-separated string
			assert.ok(compact.includes("Language: typescript"));
			assert.ok(compact.includes("Timer Interval: 30 min"));
			const compactParts = (compact as string).split(", ");
			assert.strictEqual(compactParts.length, 8);

			// Equality: array of 8 items
			assert.ok(Array.isArray(equality));
			assert.strictEqual(equality.length, 8);
			assert.ok(
				equality.some((e: string) => e.includes('Language == "typescript"'))
			);

			// Markdown: 8 bulleted items
			const markdownLines = (markdown as string).split("\n");
			assert.strictEqual(markdownLines.length, 8);
			assert.ok(markdownLines.every((line: string) => line.startsWith("- ")));
		});

		test("condition ordering is consistent across formats", () => {
			const rule: ThemeRule = {
				name: "Rule",
				when: {
					viewMode: "diff",
					language: "python",
					testState: "passed",
					pattern: "**/*.py",
				},
				theme: "Theme",
			};

			// Expected order: language, pattern, workspace, debug*, test*, view*, timer*
			const compact = formatRuleConditions(rule, {
				mode: "compact",
			}) as string;
			const equality = formatRuleConditions(rule, { mode: "equality" });
			const markdown = formatRuleConditions(rule, {
				mode: "markdown",
			}) as string;

			// All should have same order: language, pattern, testState, viewMode
			const expectedOrder = ["language", "pattern", "test", "view"];

			// Check compact
			const compactLower = compact.toLowerCase();
			let lastIndex = -1;
			for (const term of expectedOrder) {
				const index = compactLower.indexOf(term);
				assert.ok(
					index > lastIndex,
					`Compact: ${term} should come after previous condition`
				);
				lastIndex = index;
			}

			// Check equality array order
			assert.ok(
				(equality as string[])[0].toLowerCase().includes("language")
			);
			assert.ok((equality as string[])[1].toLowerCase().includes("pattern"));
			assert.ok((equality as string[])[2].toLowerCase().includes("test"));
			assert.ok((equality as string[])[3].toLowerCase().includes("view"));

			// Check markdown
			const markdownLower = markdown.toLowerCase();
			lastIndex = -1;
			for (const term of expectedOrder) {
				const index = markdownLower.indexOf(term);
				assert.ok(
					index > lastIndex,
					`Markdown: ${term} should come after previous condition`
				);
				lastIndex = index;
			}
		});
	});
});
