// src/test/errorHandling.test.ts
// Tests for error handling utilities

import * as assert from "assert";
import { handleOperationError, wrapAsyncOperation } from "../utils/errorHandling";

suite("Error Handling", () => {
    suite("handleOperationError", () => {
        test("rethrows error when rethrow option is true", () => {
            const error = new Error("Test error");

            assert.throws(() => {
                handleOperationError("test operation", error, {
                    showUser: false,
                    logToConsole: false,
                    rethrow: true,
                });
            });
        });

        test("does not rethrow when rethrow option is false", () => {
            const error = new Error("Test error");

            assert.doesNotThrow(() => {
                handleOperationError("test operation", error, {
                    showUser: false,
                    logToConsole: false,
                    rethrow: false,
                });
            });
        });

        test("handles Error objects without throwing when rethrow is false", () => {
            const error = new Error("Test error");

            assert.doesNotThrow(() => {
                handleOperationError("save file", error, {
                    showUser: false,
                    logToConsole: false,
                    rethrow: false,
                });
            });
        });

        test("handles string errors without throwing when rethrow is false", () => {
            const error = "Simple error string";

            assert.doesNotThrow(() => {
                handleOperationError("delete rule", error, {
                    showUser: false,
                    logToConsole: false,
                    rethrow: false,
                });
            });
        });

        test("handles unknown error types without throwing when rethrow is false", () => {
            const error = { custom: "object" };

            assert.doesNotThrow(() => {
                handleOperationError("custom operation", error, {
                    showUser: false,
                    logToConsole: false,
                    rethrow: false,
                });
            });
        });
    });

    suite("wrapAsyncOperation", () => {
        test("returns result on success", async () => {
            const result = await wrapAsyncOperation(
                "test operation",
                async () => {
                    return "success";
                },
                { rethrow: false }
            );

            assert.strictEqual(result, "success");
        });

        test("handles errors and returns undefined when rethrow is false", async () => {
            const result = await wrapAsyncOperation(
                "failing operation",
                async () => {
                    throw new Error("Operation failed");
                },
                { showUser: false, logToConsole: false, rethrow: false }
            );

            assert.strictEqual(result, undefined);
        });

        test("rethrows errors when rethrow is true", async () => {
            await assert.rejects(
                async () => {
                    await wrapAsyncOperation(
                        "failing operation",
                        async () => {
                            throw new Error("Operation failed");
                        },
                        { showUser: false, logToConsole: false, rethrow: true }
                    );
                },
                {
                    message: "Operation failed",
                }
            );
        });

        test("handles async errors gracefully", async () => {
            // just verify it doesn't crash the test
            await assert.doesNotReject(
                async () => {
                    await wrapAsyncOperation(
                        "test operation",
                        async () => {
                            throw new Error("Test");
                        },
                        { showUser: false, logToConsole: false, rethrow: false }
                    );
                }
            );
        });
    });
});
