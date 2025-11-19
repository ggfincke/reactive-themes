import * as assert from "assert";
import {
    buildOverlapMap,
    findOverlappingRules,
    getRuleConditionKey,
    rulesHaveIdenticalConditions,
    rulesOverlap,
} from "../ruleOverlap";
import { ThemeRule } from "../types";

suite("Rule Overlap Detection", () => {
    const rules: ThemeRule[] = [
        { name: "TypeScript Language", when: { language: "typescript" }, theme: "Dark" },
        { name: "TypeScript Pattern", when: { pattern: "**/*.ts" }, theme: "Light" },
        { name: "Workspace Specific", when: { workspaceName: "demo" }, theme: "Blue" },
        { name: "Exact Duplicate", when: { language: "typescript" }, theme: "Dark Variant" },
    ];

    test("findOverlappingRules returns functional overlaps without duplicates", () => {
        const overlaps = findOverlappingRules(rules[1], rules);
        assert.strictEqual(overlaps.length, 3);
        assert.deepStrictEqual(
            overlaps.map((rule) => rule.name).sort(),
            ["Exact Duplicate", "TypeScript Language", "Workspace Specific"].sort()
        );
    });

    test("buildOverlapMap counts each overlapping pair once", () => {
        const overlapMap = buildOverlapMap(rules);

        assert.deepStrictEqual(
            overlapMap
                .get(0)
                ?.map((rule) => rule.name)
                .sort(),
            ["Exact Duplicate", "TypeScript Pattern", "Workspace Specific"].sort()
        );
        assert.strictEqual(overlapMap.get(1)?.length, 3);

        // ensure symmetry and no double counting
        assert.deepStrictEqual(
            overlapMap.get(3)?.map((rule) => rule.name),
            ["TypeScript Language", "TypeScript Pattern", "Workspace Specific"]
        );
    });

    test("rulesHaveIdenticalConditions accounts for timer & context fields", () => {
        const timerRule: ThemeRule = {
            name: "Timer",
            when: { timerInterval: 5, debugSession: "active" },
            theme: "TimerTheme",
        };
        const timerRuleDuplicate: ThemeRule = {
            name: "Timer Duplicate",
            when: { timerInterval: 5, debugSession: "active" },
            theme: "AnotherTheme",
        };
        const differentTimerRule: ThemeRule = {
            name: "Timer Different",
            when: { timerInterval: 10, debugSession: "active" },
            theme: "TimerTheme",
        };

        assert.ok(rulesHaveIdenticalConditions(timerRule, timerRuleDuplicate));
        assert.strictEqual(getRuleConditionKey(timerRule), getRuleConditionKey(timerRuleDuplicate));
        assert.ok(!rulesHaveIdenticalConditions(timerRule, differentTimerRule));
    });

    suite("Pattern Overlap Detection (Improved)", () => {
        test("detects non-overlap: specific subdirectory vs general pattern", () => {
            const ruleA: ThemeRule = {
                name: "All TypeScript",
                when: { pattern: "**/*.ts" },
                theme: "Dark",
            };
            const ruleB: ThemeRule = {
                name: "Src TypeScript",
                when: { pattern: "src/**/*.ts" },
                theme: "Light",
            };

            // src/**/*.ts is a subset of **/*.ts, so they DO overlap
            assert.ok(rulesOverlap(ruleA, ruleB));
        });

        test("detects overlap: different directory patterns with same extension", () => {
            const ruleA: ThemeRule = {
                name: "Test Files",
                when: { pattern: "test/**/*.ts" },
                theme: "Dark",
            };
            const ruleB: ThemeRule = {
                name: "Src Files",
                when: { pattern: "src/**/*.ts" },
                theme: "Light",
            };

            // no overlap: mutually exclusive directories
            assert.ok(!rulesOverlap(ruleA, ruleB));
        });

        test("detects non-overlap: tsx vs ts patterns", () => {
            const ruleA: ThemeRule = {
                name: "TypeScript",
                when: { pattern: "**/*.ts" },
                theme: "Dark",
            };
            const ruleB: ThemeRule = {
                name: "TSX React",
                when: { pattern: "**/*.tsx" },
                theme: "Light",
            };

            // .ts and .tsx are different extensions, no overlap
            assert.ok(!rulesOverlap(ruleA, ruleB));
        });

        test("detects overlap: matchBase behavior with nested paths", () => {
            const ruleA: ThemeRule = {
                name: "Test Files",
                when: { pattern: "*.test.ts" },
                theme: "Dark",
            };
            const ruleB: ThemeRule = {
                name: "All Tests",
                when: { pattern: "**/*.test.ts" },
                theme: "Light",
            };

            // *.test.ts with matchBase matches anywhere, overlaps with **/*.test.ts
            assert.ok(rulesOverlap(ruleA, ruleB));
        });

        test("context conditions prevent overlap", () => {
            const ruleA: ThemeRule = {
                name: "TypeScript Debug",
                when: { language: "typescript", debugSession: "active" },
                theme: "Dark",
            };
            const ruleB: ThemeRule = {
                name: "TypeScript Normal",
                when: { language: "typescript", debugSession: "inactive" },
                theme: "Light",
            };

            // same language but incompatible debug states
            assert.ok(!rulesOverlap(ruleA, ruleB));
        });

        test("context wildcard (undefined) allows overlap", () => {
            const ruleA: ThemeRule = {
                name: "TypeScript Any",
                when: { language: "typescript" },
                theme: "Dark",
            };
            const ruleB: ThemeRule = {
                name: "TypeScript Debug",
                when: { language: "typescript", debugSession: "active" },
                theme: "Light",
            };

            // ruleA has no debug constraint (wildcard), so it overlaps with ruleB
            assert.ok(rulesOverlap(ruleA, ruleB));
        });

        test("timer-only rules don't overlap with non-timer rules", () => {
            const ruleA: ThemeRule = {
                name: "TypeScript",
                when: { language: "typescript" },
                theme: "Dark",
            };
            const ruleB: ThemeRule = {
                name: "Timer",
                when: { timerInterval: 15 },
                theme: "Light",
            };

            // timer rules evaluated separately
            assert.ok(!rulesOverlap(ruleA, ruleB));
        });

        test("language + pattern overlap when pattern matches language extensions", () => {
            const ruleA: ThemeRule = {
                name: "Python Language",
                when: { language: "python" },
                theme: "Dark",
            };
            const ruleB: ThemeRule = {
                name: "Python Files",
                when: { pattern: "**/*.py" },
                theme: "Light",
            };

            // language: python overlaps with pattern: **/*.py
            assert.ok(rulesOverlap(ruleA, ruleB));
        });

        test("no false positive: general language doesn't overlap with specific other pattern", () => {
            const ruleA: ThemeRule = {
                name: "TypeScript",
                when: { language: "typescript" },
                theme: "Dark",
            };
            const ruleB: ThemeRule = {
                name: "Python Pattern",
                when: { pattern: "**/*.py" },
                theme: "Light",
            };

            // typescript language doesn't overlap with .py pattern
            assert.ok(!rulesOverlap(ruleA, ruleB));
        });

        test("workspace constraint creates non-overlap", () => {
            const ruleA: ThemeRule = {
                name: "Workspace A",
                when: { language: "typescript", workspaceName: "project-a" },
                theme: "Dark",
            };
            const ruleB: ThemeRule = {
                name: "Workspace B",
                when: { language: "typescript", workspaceName: "project-b" },
                theme: "Light",
            };

            // different workspaces don't overlap
            assert.ok(!rulesOverlap(ruleA, ruleB));
        });

        test("undefined workspace acts as wildcard", () => {
            const ruleA: ThemeRule = {
                name: "Any Workspace",
                when: { language: "typescript" },
                theme: "Dark",
            };
            const ruleB: ThemeRule = {
                name: "Specific Workspace",
                when: { language: "typescript", workspaceName: "my-project" },
                theme: "Light",
            };

            // ruleA has no workspace constraint, overlaps with ruleB
            assert.ok(rulesOverlap(ruleA, ruleB));
        });
    });
});
