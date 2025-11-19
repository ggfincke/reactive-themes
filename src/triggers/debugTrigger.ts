// src/triggers/debugTrigger.ts
// Listen for debug session lifecycle & update context

import * as vscode from "vscode";
import { ContextManager } from "../contextManager";

export class DebugTrigger implements vscode.Disposable {
    private disposables: vscode.Disposable[] = [];

    constructor(
        private contextManager: ContextManager,
        private debugApi: typeof vscode.debug = vscode.debug
    ) {
        this.initialize();
    }

    private initialize(): void {
        // Listen for debug session start
        this.disposables.push(
            this.debugApi.onDidStartDebugSession((session) => {
                this.contextManager.setDebugSession("active", session.type);
            })
        );

        // Listen for debug session termination
        this.disposables.push(
            this.debugApi.onDidTerminateDebugSession((session) => {
                // Check if there are any other active debug sessions
                const hasActiveSession = this.debugApi.activeDebugSession !== undefined;
                if (!hasActiveSession) {
                    this.contextManager.setDebugSession("inactive", undefined);
                } else {
                    // Update to the current active session
                    this.contextManager.setDebugSession(
                        "active",
                        this.debugApi.activeDebugSession?.type
                    );
                }
            })
        );

        // Initialize with current state
        if (this.debugApi.activeDebugSession) {
            this.contextManager.setDebugSession("active", this.debugApi.activeDebugSession.type);
        }
    }

    public dispose(): void {
        this.disposables.forEach((d) => d.dispose());
    }
}
