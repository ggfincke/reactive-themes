// src/triggers/viewTrigger.ts
// Track diff/merge/normal view modes & update context

import * as vscode from "vscode";
import { ContextManager } from "../contextManager";

export class ViewTrigger implements vscode.Disposable {
    private disposables: vscode.Disposable[] = [];

    constructor(
        private contextManager: ContextManager,
        private windowApi: typeof vscode.window = vscode.window
    ) {
        this.initialize();
    }

    private initialize(): void {
        // Monitor visible editors to detect diff/merge views
        this.disposables.push(
            this.windowApi.onDidChangeVisibleTextEditors(() => {
                this.updateViewMode();
            })
        );

        this.disposables.push(
            this.windowApi.onDidChangeActiveTextEditor(() => {
                this.updateViewMode();
            })
        );

        // Initialize with current state
        this.updateViewMode();
    }

    private updateViewMode(): void {
        const activeEditor = this.windowApi.activeTextEditor;
        const visibleEditors = this.windowApi.visibleTextEditors;

        // Check for merge conflict markers in active editor
        if (activeEditor && this.hasMergeConflicts(activeEditor.document)) {
            this.contextManager.setViewMode("merge");
            return;
        }

        // Check for diff view by analyzing URI schemes and editor layout
        if (this.isDiffView(activeEditor, visibleEditors)) {
            this.contextManager.setViewMode("diff");
            return;
        }

        // Default to normal view
        this.contextManager.setViewMode("normal");
    }

    private isDiffView(
        activeEditor: vscode.TextEditor | undefined,
        visibleEditors: readonly vscode.TextEditor[]
    ): boolean {
        if (!activeEditor) {
            return false;
        }

        // Check for git diff schemes
        const diffSchemes = ["git", "vscode-scm", "review"];
        if (diffSchemes.includes(activeEditor.document.uri.scheme)) {
            return true;
        }

        // Check if there are multiple editors in the same column (side-by-side comparison)
        const activeColumn = activeEditor.viewColumn;
        if (activeColumn !== undefined) {
            const editorsInSameColumn = visibleEditors.filter((e) => e.viewColumn === activeColumn);

            // If multiple editors share the same column, it's likely a diff view
            if (editorsInSameColumn.length > 1) {
                return true;
            }
        }

        // Check for side-by-side editors with similar file names (common in diff views)
        if (visibleEditors.length >= 2) {
            const baseName = this.getBaseName(activeEditor.document.uri.fsPath);
            const hasSimilarFile = visibleEditors.some(
                (e) => e !== activeEditor && this.getBaseName(e.document.uri.fsPath) === baseName
            );
            if (hasSimilarFile) {
                return true;
            }
        }

        return false;
    }

    private hasMergeConflicts(document: vscode.TextDocument): boolean {
        const text = document.getText();

        // Look for standard git merge conflict markers
        const conflictMarkers = [
            /^<<<<<<< /m, // Conflict start
            /^=======/m, // Conflict separator
            /^>>>>>>> /m, // Conflict end
        ];

        return conflictMarkers.every((marker) => marker.test(text));
    }

    private getBaseName(filePath: string): string {
        const parts = filePath.split(/[\\/]/);
        const fileName = parts[parts.length - 1];
        return fileName.replace(/\.[^.]+$/, "");
    }

    public dispose(): void {
        this.disposables.forEach((d) => d.dispose());
    }
}
