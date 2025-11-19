import * as assert from "assert";
import { evaluateRules } from "../../ruleEngine";
import { ThemeManager } from "../../themeManager";
import { createMockContext, createMockEditor, createMockRule } from "../testUtils";

suite("Integration - Rule Evaluation to Theme Application", () => {
    test("applies matched theme via ThemeManager", async () => {
        const editor = createMockEditor("typescript", "/workspace/file.ts");
        const context = createMockContext();
        const rule = createMockRule({ theme: "My Theme" });

        const result = evaluateRules([rule], editor, context);
        assert.ok(result.matched, "Expected rule to match");

        const appliedThemes: string[] = [];
        const manager = new ThemeManager(
            0,
            async (theme: string) => {
                appliedThemes.push(theme);
            },
            () => "original-theme"
        );

        if (result.matched && result.theme) {
            manager.applyTheme(result.theme, "integration-test");
        }

        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.deepStrictEqual(appliedThemes, ["My Theme"]);
    });
});
