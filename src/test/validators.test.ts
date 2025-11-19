// src/test/validators.test.ts
// Tests for validation functions

import * as assert from "assert";
import {
    validateRuleName,
    validateGlobPattern,
    validateLanguageId,
    validateWorkspaceName,
    validateDebugType,
    validateTimerInterval,
    validateFilePath,
} from "../utils/validators";

suite("Validators", () => {
    suite("validateRuleName", () => {
        test("rejects empty string", () => {
            assert.strictEqual(validateRuleName(""), "Rule name cannot be empty");
        });

        test("rejects whitespace-only string", () => {
            assert.strictEqual(validateRuleName("   "), "Rule name cannot be empty");
        });

        test("rejects undefined", () => {
            assert.strictEqual(validateRuleName(undefined), "Rule name cannot be empty");
        });

        test("accepts valid rule name", () => {
            assert.strictEqual(validateRuleName("Dark theme for TypeScript"), undefined);
        });

        test("accepts name with special characters", () => {
            assert.strictEqual(validateRuleName("Test-Rule_123"), undefined);
        });
    });

    suite("validateGlobPattern", () => {
        test("rejects empty string", () => {
            assert.strictEqual(validateGlobPattern(""), "Pattern cannot be empty");
        });

        test("rejects whitespace-only string", () => {
            assert.strictEqual(validateGlobPattern("  "), "Pattern cannot be empty");
        });

        test("rejects undefined", () => {
            assert.strictEqual(validateGlobPattern(undefined), "Pattern cannot be empty");
        });

        test("rejects unclosed character class", () => {
            const result = validateGlobPattern("**/*.ts[abc");
            assert.ok(result?.includes("Unclosed character class"));
        });

        test("rejects unmatched closing bracket", () => {
            const result = validateGlobPattern("**/*.ts]");
            assert.ok(result?.includes("Unmatched closing ]"));
        });

        test("rejects unbalanced brace expansion", () => {
            const result = validateGlobPattern("**/*.{ts,js");
            assert.ok(result?.includes("Unbalanced {} brace expansion"));
        });

        test("rejects unmatched closing brace", () => {
            const result = validateGlobPattern("**/*.ts}");
            assert.ok(result?.includes("Unmatched closing }"));
        });

        test("accepts valid simple pattern", () => {
            assert.strictEqual(validateGlobPattern("**/*.ts"), undefined);
        });

        test("accepts pattern with brace expansion", () => {
            assert.strictEqual(validateGlobPattern("**/*.{ts,js,vue}"), undefined);
        });

        test("accepts pattern with character class", () => {
            assert.strictEqual(validateGlobPattern("**/[Tt]est*.ts"), undefined);
        });

        test("accepts pattern with negation", () => {
            assert.strictEqual(validateGlobPattern("!**/node_modules/**"), undefined);
        });

        test("accepts complex nested pattern", () => {
            assert.strictEqual(validateGlobPattern("src/{components,utils}/**/*.{ts,tsx}"), undefined);
        });
    });

    suite("validateLanguageId", () => {
        test("rejects empty string", () => {
            assert.strictEqual(validateLanguageId(""), "Language ID cannot be empty");
        });

        test("rejects whitespace-only string", () => {
            assert.strictEqual(validateLanguageId("   "), "Language ID cannot be empty");
        });

        test("rejects undefined", () => {
            assert.strictEqual(validateLanguageId(undefined), "Language ID cannot be empty");
        });

        test("accepts valid language ID", () => {
            assert.strictEqual(validateLanguageId("typescript"), undefined);
        });

        test("accepts hyphenated language ID", () => {
            assert.strictEqual(validateLanguageId("objective-c"), undefined);
        });
    });

    suite("validateWorkspaceName", () => {
        test("rejects empty string", () => {
            assert.strictEqual(validateWorkspaceName(""), "Workspace name cannot be empty");
        });

        test("rejects whitespace-only string", () => {
            assert.strictEqual(validateWorkspaceName("  "), "Workspace name cannot be empty");
        });

        test("rejects undefined", () => {
            assert.strictEqual(validateWorkspaceName(undefined), "Workspace name cannot be empty");
        });

        test("accepts valid workspace name", () => {
            assert.strictEqual(validateWorkspaceName("my-project"), undefined);
        });

        test("accepts workspace name with spaces", () => {
            assert.strictEqual(validateWorkspaceName("My Project"), undefined);
        });
    });

    suite("validateDebugType", () => {
        test("rejects empty string", () => {
            assert.strictEqual(validateDebugType(""), "Debug type cannot be empty");
        });

        test("rejects whitespace-only string", () => {
            assert.strictEqual(validateDebugType("   "), "Debug type cannot be empty");
        });

        test("rejects undefined", () => {
            assert.strictEqual(validateDebugType(undefined), "Debug type cannot be empty");
        });

        test("accepts valid debug type", () => {
            assert.strictEqual(validateDebugType("node"), undefined);
        });

        test("accepts chrome debug type", () => {
            assert.strictEqual(validateDebugType("chrome"), undefined);
        });
    });

    suite("validateTimerInterval", () => {
        test("rejects empty string", () => {
            assert.strictEqual(validateTimerInterval(""), "Timer interval cannot be empty");
        });

        test("rejects whitespace-only string", () => {
            assert.strictEqual(validateTimerInterval("   "), "Timer interval cannot be empty");
        });

        test("rejects undefined", () => {
            assert.strictEqual(validateTimerInterval(undefined), "Timer interval cannot be empty");
        });

        test("rejects non-numeric string", () => {
            assert.strictEqual(validateTimerInterval("abc"), "Timer interval must be a positive number");
        });

        test("rejects negative number", () => {
            assert.strictEqual(validateTimerInterval("-5"), "Timer interval must be a positive number");
        });

        test("rejects zero", () => {
            assert.strictEqual(validateTimerInterval("0"), "Timer interval must be a positive number");
        });

        test("accepts positive integer", () => {
            assert.strictEqual(validateTimerInterval("5"), undefined);
        });

        test("accepts large number", () => {
            assert.strictEqual(validateTimerInterval("120"), undefined);
        });
    });

    suite("validateFilePath", () => {
        test("rejects empty string", () => {
            assert.strictEqual(validateFilePath(""), "File path cannot be empty");
        });

        test("rejects whitespace-only string", () => {
            assert.strictEqual(validateFilePath("   "), "File path cannot be empty");
        });

        test("rejects undefined", () => {
            assert.strictEqual(validateFilePath(undefined), "File path cannot be empty");
        });

        test("accepts valid Unix path", () => {
            assert.strictEqual(validateFilePath("/home/user/project/file.ts"), undefined);
        });

        test("accepts valid Windows path", () => {
            assert.strictEqual(validateFilePath("C:\\Users\\user\\project\\file.ts"), undefined);
        });

        test("accepts relative path", () => {
            assert.strictEqual(validateFilePath("./src/index.ts"), undefined);
        });
    });
});
