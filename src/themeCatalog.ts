// src/themeCatalog.ts
// Theme discovery and metadata utilities

import * as vscode from "vscode";

export interface InstalledTheme {
    label: string;
    id: string;
    extensionName: string;
    uiTheme?: string;
}

const THEME_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let cachedThemes: InstalledTheme[] | undefined;
let cachedAt: number | undefined;

// * collect installed themes from all extensions with caching to avoid repeated scans
export function getInstalledThemes(options?: { forceRefresh?: boolean }): InstalledTheme[] {
    const now = Date.now();
    const isCacheValid =
        cachedThemes &&
        cachedAt !== undefined &&
        now - cachedAt < THEME_CACHE_TTL_MS &&
        !options?.forceRefresh;

    if (isCacheValid) {
        return cachedThemes!;
    }

    const themes: InstalledTheme[] = [];

    for (const extension of vscode.extensions.all) {
        const packageJson = extension.packageJSON;

        if (packageJson.contributes && packageJson.contributes.themes) {
            const extensionName = packageJson.displayName || packageJson.name || "Unknown";

            for (const theme of packageJson.contributes.themes) {
                themes.push({
                    label: theme.label || theme.id || "Unnamed Theme",
                    id: theme.id || theme.label || "",
                    extensionName,
                    uiTheme: theme.uiTheme,
                });
            }
        }
    }

    cachedThemes = themes;
    cachedAt = now;

    return themes;
}

export function resetThemeCache(): void {
    cachedThemes = undefined;
    cachedAt = undefined;
}

// * normalize VS Code uiTheme metadata into a readable label
export function describeThemeType(uiTheme?: string): string {
    if (!uiTheme) {
        return "Unknown theme type";
    }

    if (uiTheme === "vs-dark" || uiTheme === "hc-black") {
        return "Dark theme";
    }

    if (uiTheme === "vs" || uiTheme === "hc-light") {
        return "Light theme";
    }

    return "Unknown theme type";
}

// * ensure a theme is installed before saving or applying it
export function validateInstalledTheme(themeName: string): { valid: boolean; message?: string } {
    const installedThemes = getInstalledThemes();
    const themeExists = installedThemes.some(
        (theme) => theme.label === themeName || theme.id === themeName
    );

    if (!themeExists) {
        return {
            valid: false,
            message: `Theme "${themeName}" is not installed. Please install it or choose a different theme.`,
        };
    }

    return { valid: true };
}
