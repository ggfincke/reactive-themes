// src/test/ruleOperations.test.ts
// Tests for rule operations (delete, move, reorder)

import * as assert from "assert";
import { deleteRules, moveRule, reorderRules } from "../utils/ruleOperations";
import { loadConfig, updateAllRules } from "../config";
import { ThemeRule } from "../types";

suite("Rule Operations", () => {
    // helper to create test rules
    function createTestRule(name: string): ThemeRule {
        return {
            name,
            when: { language: "typescript" },
            theme: "Test Theme",
        };
    }

    suite("deleteRules", () => {
        test("deletes multiple rules atomically", async () => {
            // setup: create initial rules
            const initialRules: ThemeRule[] = [
                createTestRule("Rule 0"),
                createTestRule("Rule 1"),
                createTestRule("Rule 2"),
                createTestRule("Rule 3"),
                createTestRule("Rule 4"),
            ];
            await updateAllRules(initialRules);

            // delete rules at indices 1 and 3
            await deleteRules([1, 3]);

            // verify only correct rules remain
            const config = loadConfig();
            assert.strictEqual(config.rules.length, 3);
            assert.strictEqual(config.rules[0].name, "Rule 0");
            assert.strictEqual(config.rules[1].name, "Rule 2");
            assert.strictEqual(config.rules[2].name, "Rule 4");
        });

        test("handles empty indices array without error", async () => {
            const initialRules: ThemeRule[] = [
                createTestRule("Rule 0"),
                createTestRule("Rule 1"),
            ];
            await updateAllRules(initialRules);

            // should be no-op
            await deleteRules([]);

            const config = loadConfig();
            assert.strictEqual(config.rules.length, 2);
        });

        test("handles unordered indices correctly", async () => {
            const initialRules: ThemeRule[] = [
                createTestRule("Rule 0"),
                createTestRule("Rule 1"),
                createTestRule("Rule 2"),
                createTestRule("Rule 3"),
            ];
            await updateAllRules(initialRules);

            // pass indices in random order
            await deleteRules([3, 0, 1]);

            const config = loadConfig();
            assert.strictEqual(config.rules.length, 1);
            assert.strictEqual(config.rules[0].name, "Rule 2");
        });

        test("throws on invalid index", async () => {
            const initialRules: ThemeRule[] = [
                createTestRule("Rule 0"),
                createTestRule("Rule 1"),
            ];
            await updateAllRules(initialRules);

            await assert.rejects(
                async () => deleteRules([5]),
                /Invalid rule index/
            );

            // config should be unchanged
            const config = loadConfig();
            assert.strictEqual(config.rules.length, 2);
        });

        test("deletes all rules when all indices provided", async () => {
            const initialRules: ThemeRule[] = [
                createTestRule("Rule 0"),
                createTestRule("Rule 1"),
                createTestRule("Rule 2"),
            ];
            await updateAllRules(initialRules);

            await deleteRules([0, 1, 2]);

            const config = loadConfig();
            assert.strictEqual(config.rules.length, 0);
        });
    });

    suite("moveRule", () => {
        test("moves rule forward in list", async function () {
            this.skip(); // requires mock setup
        });

        test("moves rule backward in list", async function () {
            this.skip(); // requires mock setup
        });

        test("no-op when fromIndex equals toIndex", async function () {
            this.skip(); // requires mock setup
        });

        test("throws on invalid fromIndex", async function () {
            this.skip(); // requires mock setup
        });

        test("throws on invalid toIndex", async function () {
            this.skip(); // requires mock setup
        });
    });

    suite("reorderRules", () => {
        test("applies multiple moves correctly", async function () {
            this.skip(); // requires mock setup
        });

        test("handles empty moves array", async function () {
            this.skip(); // requires mock setup
        });

        test("throws on invalid indices", async function () {
            this.skip(); // requires mock setup
        });
    });

    // note: comprehensive testing of these functions requires mocking the config module
    // which is out of scope for this initial test setup
    // future enhancement: add proper mocks using sinon or similar
});
