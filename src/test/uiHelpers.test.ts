// src/test/uiHelpers.test.ts
// Tests for UI helper functions

import * as assert from "assert";
import { getSharedOutputChannel } from "../commands/uiHelpers";

suite("UI Helpers", () => {
    suite("getSharedOutputChannel", () => {
        test("returns singleton output channel", () => {
            const channel1 = getSharedOutputChannel();
            const channel2 = getSharedOutputChannel();

            // both calls should return same instance
            assert.strictEqual(channel1, channel2);
        });

        test("creates output channel with fixed name", () => {
            const channel = getSharedOutputChannel();
            assert.ok(channel);
            assert.strictEqual(channel.name, "Reactive Themes");
        });
    });

    // note: selectTheme, selectRule, and confirmAction require mocking VSCode QuickPick
    // and window.show* methods, which is out of scope for this basic test setup
    // future enhancement: add proper VSCode API mocks

    suite("selectTheme", () => {
        test("placeholder for selectTheme tests", function () {
            this.skip(); // requires VSCode QuickPick mock
        });
    });

    suite("selectRule", () => {
        test("placeholder for selectRule tests", function () {
            this.skip(); // requires VSCode QuickPick mock
        });
    });

    suite("confirmAction", () => {
        test("placeholder for confirmAction modal tests", function () {
            this.skip(); // requires VSCode window.show* mocks
        });

        test("placeholder for confirmAction severity tests", function () {
            this.skip(); // requires VSCode window.show* mocks
        });
    });
});
