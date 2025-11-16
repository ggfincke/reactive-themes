// src/themeManager.ts
// Theme application manager w/ debouncing & state tracking

import * as vscode from 'vscode';
import { getCurrentTheme, setCurrentTheme } from './config';

// debounce timeout to prevent rapid theme switching
const DEBOUNCE_MS = 300;

// * manages theme application w/ debouncing & state tracking
export class ThemeManager {
    // timer for debouncing theme changes
    private debounceTimer: NodeJS.Timeout | undefined;
    // currently applied theme name
    private currentAppliedTheme: string | undefined;
    // original theme when extension activated
    private originalTheme: string | undefined;
    // whether theme switching is enabled
    private isEnabled: boolean = true;

    // initialize manager & store original theme
    constructor() {
        this.originalTheme = getCurrentTheme();
    }

    // apply theme w/ debouncing to prevent rapid changes
    applyTheme(themeName: string, reason?: string): void {
        // clear any existing debounce timer
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        // bail out if disabled
        if (!this.isEnabled) {
            return;
        }

        // debounce theme change
        this.debounceTimer = setTimeout(() => {
            this.applyThemeImmediate(themeName, reason);
        }, DEBOUNCE_MS);
    }

    // * immediately apply theme without debouncing
    private async applyThemeImmediate(themeName: string, reason?: string): Promise<void> {
        // skip if already applied
        if (this.currentAppliedTheme === themeName) {
            return;
        }

        try {
            await setCurrentTheme(themeName);
            this.currentAppliedTheme = themeName;

            // log w/ reason for debugging
            if (reason) {
                console.log(`[Reactive Themes] Applied theme "${themeName}" (${reason})`);
            }
        } catch (error) {
            console.error(`[Reactive Themes] Failed to apply theme "${themeName}":`, error);
            vscode.window.showErrorMessage(
                `Reactive Themes: Failed to apply theme "${themeName}". The theme may not be installed.`
            );
        }
    }

    // restore original theme from extension activation
    async restoreOriginalTheme(): Promise<void> {
        if (this.originalTheme && this.currentAppliedTheme !== this.originalTheme) {
            await this.applyThemeImmediate(this.originalTheme, 'restoring original');
        }
    }

    // apply fallback theme when no rules match
    applyFallback(fallbackTheme?: string): void {
        const themeToApply = fallbackTheme || this.originalTheme;
        if (themeToApply) {
            this.applyTheme(themeToApply, 'fallback - no rules matched');
        }
    }

    // enable or disable theme switching
    setEnabled(enabled: boolean): void {
        this.isEnabled = enabled;

        // restore original theme when disabling
        if (!enabled) {
            this.restoreOriginalTheme();
        }
    }

    // get whether theme switching is enabled
    getEnabled(): boolean {
        return this.isEnabled;
    }

    // get currently applied theme
    getCurrentAppliedTheme(): string | undefined {
        return this.currentAppliedTheme;
    }

    // get original theme from extension activation
    getOriginalTheme(): string | undefined {
        return this.originalTheme;
    }

    // cleanup resources & cancel pending timers
    dispose(): void {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
    }
}
