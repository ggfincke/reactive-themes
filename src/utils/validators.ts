// src/utils/validators.ts
// Centralized input validation functions for commands

import { minimatch } from "minimatch";

const MAX_TIMER_INTERVAL_MINUTES = 720; // 12 hours to prevent runaway timers

// * rule name validator
export function validateRuleName(value: string | undefined): string | undefined {
    if (!value || value.trim().length === 0) {
        return "Rule name cannot be empty";
    }
    return undefined;
}

// * file path validator
export function validateFilePath(value: string | undefined): string | undefined {
    if (!value || value.trim().length === 0) {
        return "File path cannot be empty";
    }
    return undefined;
}

// * language ID validator
export function validateLanguageId(
    value: string | undefined,
    options?: { allowEmpty?: boolean }
): string | undefined {
    const trimmed = value?.trim() ?? "";
    if (trimmed.length === 0) {
        return options?.allowEmpty ? undefined : "Language ID cannot be empty";
    }
    return undefined;
}

// * workspace name validator
export function validateWorkspaceName(
    value: string | undefined,
    options?: { allowEmpty?: boolean }
): string | undefined {
    const trimmed = value?.trim() ?? "";
    if (trimmed.length === 0) {
        return options?.allowEmpty ? undefined : "Workspace name cannot be empty";
    }
    return undefined;
}

// * glob pattern validator
export function validateGlobPattern(
    value: string | undefined,
    options?: { allowEmpty?: boolean }
): string | undefined {
    const trimmed = value?.trim() ?? "";
    if (trimmed.length === 0) {
        return options?.allowEmpty ? undefined : "Pattern cannot be empty";
    }

    const pattern = trimmed;

    // manual syntax check for common glob mistakes (brackets, braces, escape sequences)
    let escaped = false;
    let inCharClass = false;
    let braceDepth = 0;

    for (let i = 0; i < pattern.length; i++) {
        const char = pattern[i];

        if (escaped) {
            escaped = false;
            continue;
        }

        if (char === "\\") {
            escaped = true;
            continue;
        }

        if (char === "[") {
            if (inCharClass) {
                return "Unclosed character class";
            }
            inCharClass = true;
            continue;
        }

        if (char === "]") {
            if (!inCharClass) {
                return "Unmatched closing ]";
            }
            inCharClass = false;
            continue;
        }

        if (!inCharClass) {
            if (char === "{") {
                braceDepth++;
            } else if (char === "}") {
                if (braceDepth === 0) {
                    return "Unmatched closing }";
                }
                braceDepth--;
            }
        }
    }

    if (inCharClass) {
        return "Unclosed character class";
    }

    if (braceDepth !== 0) {
        return "Unbalanced {} brace expansion";
    }

    // test pattern w/ minimatch to catch remaining syntax errors
    try {
        minimatch("test.txt", pattern, { matchBase: true, dot: true });
        return undefined;
    } catch (error) {
        return `Invalid pattern syntax: ${error instanceof Error ? error.message : String(error)}`;
    }
}

// * debug type validator
export function validateDebugType(value: string | undefined): string | undefined {
    if (!value || value.trim().length === 0) {
        return "Debug type cannot be empty";
    }
    return undefined;
}

// * timer interval validator
export function validateTimerInterval(value: string | undefined): string | undefined {
    if (!value || value.trim().length === 0) {
        return "Timer interval cannot be empty";
    }

    const minutes = parseInt(value, 10);
    if (isNaN(minutes) || minutes <= 0) {
        return "Timer interval must be a positive number";
    }

    if (minutes > MAX_TIMER_INTERVAL_MINUTES) {
        return `Timer interval must be less than or equal to ${MAX_TIMER_INTERVAL_MINUTES} minutes`;
    }

    return undefined;
}
