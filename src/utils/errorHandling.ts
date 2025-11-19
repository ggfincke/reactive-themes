// src/utils/errorHandling.ts
// Unified error handling utilities

import * as vscode from "vscode";

interface ErrorHandlingOptions {
    showUser?: boolean;
    rethrow?: boolean;
    logToConsole?: boolean;
}

// * handle operation error w/ consistent messaging & logging
export function handleOperationError(
    operation: string,
    error: unknown,
    options: ErrorHandlingOptions = {}
): void {
    const { showUser = true, rethrow = true, logToConsole = true } = options;

    const message = `Failed to ${operation}: ${error instanceof Error ? error.message : String(error)}`;

    if (logToConsole) {
        console.error("[Reactive Themes]", message);
    }

    if (showUser) {
        vscode.window.showErrorMessage(message);
    }

    if (rethrow) {
        throw error;
    }
}

// * wrap async operation w/ error handling & logging
export async function wrapAsyncOperation<T>(
    operation: string,
    fn: () => Promise<T>,
    options: ErrorHandlingOptions = {}
): Promise<T> {
    try {
        return await fn();
    } catch (error) {
        handleOperationError(operation, error, options);
        // if not rethrowing, return undefined - caller should handle gracefully
        return undefined as unknown as T;
    }
}

// * show success message w/ optional action buttons
export async function showSuccessMessage(
    message: string,
    ...actions: string[]
): Promise<string | undefined> {
    return vscode.window.showInformationMessage(message, ...actions);
}

// * show warning w/ optional action buttons
export async function showWarningMessage(
    message: string,
    ...actions: string[]
): Promise<string | undefined> {
    return vscode.window.showWarningMessage(message, ...actions);
}
