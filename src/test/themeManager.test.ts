import * as assert from "assert";
import { ThemeManager } from "../themeManager";

suite("ThemeManager", () => {
    test("restores original theme when disabled", async () => {
        const appliedThemes: string[] = [];
        const manager = new ThemeManager(
            0,
            async (theme) => {
                appliedThemes.push(theme);
            },
            () => "original-theme"
        );

        (manager as any).currentAppliedTheme = "other-theme";

        await manager.setEnabled(false);
        assert.deepStrictEqual(appliedThemes, ["original-theme"]);
    });

    test("ignores queued theme changes while disabled", async () => {
        const appliedThemes: string[] = [];
        const manager = new ThemeManager(
            0,
            async (theme) => {
                appliedThemes.push(theme);
            },
            () => "original-theme"
        );

        await manager.setEnabled(false);
        appliedThemes.length = 0; // reset counts after restore

        manager.applyTheme("new-theme");
        await new Promise((resolve) => setTimeout(resolve, 5));

        assert.strictEqual(appliedThemes.length, 0);
    });
});
