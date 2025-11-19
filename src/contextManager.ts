// src/contextManager.ts
// Track VS Code context state for debug/test/view/timer triggers

import * as vscode from "vscode";
import { RuleCondition } from "./types";

export type ContextFlags = Pick<
    RuleCondition,
    "debugSession" | "debugType" | "testState" | "viewMode"
> & {
    timerTick?: number; // Internal counter for timer-based rules
};

// current VS Code context snapshot
export interface Context extends ContextFlags {}

export class ContextManager {
    private context: Context = {
        debugSession: "inactive",
        testState: "none",
        viewMode: "normal",
        timerTick: 0,
    };

    private readonly onDidChangeContextEmitter = new vscode.EventEmitter<Context>();
    public readonly onDidChangeContext = this.onDidChangeContextEmitter.event;

    public getContext(): Readonly<Context> {
        return { ...this.context };
    }

    public setDebugSession(state: "active" | "inactive", debugType?: string): void {
        const changed = this.context.debugSession !== state || this.context.debugType !== debugType;

        this.context.debugSession = state;
        this.context.debugType = debugType;

        if (changed) {
            this.onDidChangeContextEmitter.fire(this.getContext());
        }
    }

    public setTestState(state: "running" | "failed" | "passed" | "none"): void {
        if (this.context.testState !== state) {
            this.context.testState = state;
            this.onDidChangeContextEmitter.fire(this.getContext());
        }
    }

    public setViewMode(mode: "diff" | "merge" | "normal"): void {
        if (this.context.viewMode !== mode) {
            this.context.viewMode = mode;
            this.onDidChangeContextEmitter.fire(this.getContext());
        }
    }

    public incrementTimerTick(): void {
        this.context.timerTick = (this.context.timerTick || 0) + 1;
        this.onDidChangeContextEmitter.fire(this.getContext());
    }

    public dispose(): void {
        this.onDidChangeContextEmitter.dispose();
    }
}
