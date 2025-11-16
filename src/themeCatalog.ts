// src/themeCatalog.ts
// Theme discovery and metadata utilities

import * as vscode from 'vscode';

export interface InstalledTheme {
    label: string;
    id: string;
    extensionName: string;
    uiTheme?: string;
}

// * collect installed themes from all extensions
export function getInstalledThemes(): InstalledTheme[] {
    const themes: InstalledTheme[] = [];

    for (const extension of vscode.extensions.all) {
        const packageJson = extension.packageJSON;

        if (packageJson.contributes && packageJson.contributes.themes) {
            const extensionName = packageJson.displayName || packageJson.name || 'Unknown';

            for (const theme of packageJson.contributes.themes) {
                themes.push({
                    label: theme.label || theme.id || 'Unnamed Theme',
                    id: theme.id || theme.label || '',
                    extensionName,
                    uiTheme: theme.uiTheme
                });
            }
        }
    }

    return themes;
}

// * normalize VS Code uiTheme metadata into a readable label
export function describeThemeType(uiTheme?: string): string {
    if (!uiTheme) {
        return 'Unknown theme type';
    }

    if (uiTheme === 'vs-dark' || uiTheme === 'hc-black') {
        return 'Dark theme';
    }

    if (uiTheme === 'vs' || uiTheme === 'hc-light') {
        return 'Light theme';
    }

    return 'Unknown theme type';
}

// * ensure a theme is installed before saving or applying it
export function validateInstalledTheme(themeName: string): { valid: boolean; message?: string } {
    const installedThemes = getInstalledThemes();
    const themeExists = installedThemes.some(
        theme => theme.label === themeName || theme.id === themeName
    );

    if (!themeExists) {
        return {
            valid: false,
            message: `Theme "${themeName}" is not installed. Please install it or choose a different theme.`
        };
    }

    return { valid: true };
}
