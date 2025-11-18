// src/triggers/timerTrigger.ts
// Register timer-based rules & emit ticks for matching

import * as vscode from 'vscode';
import { ContextManager } from '../contextManager';
import { ThemeRule } from '../types';

export class TimerTrigger implements vscode.Disposable {
    private timers: Map<string, NodeJS.Timeout> = new Map();
    private registeredRules: ThemeRule[] = [];
    private pendingTicks: Set<number> = new Set();
    private dispatchHandle: NodeJS.Timeout | undefined;

    constructor(
        private contextManager: ContextManager,
        private onTimerTick: (ruleIndices: number[], rules: ThemeRule[]) => void
    ) {}

    public registerTimerRules(rules: ThemeRule[]): void {
        // Clear existing timers
        this.clearTimers();
        this.registeredRules = rules;

        // Set up new timers for rules with timerInterval
        rules.forEach((rule, index) => {
            if (rule.when.timerInterval && rule.when.timerInterval > 0) {
                const intervalMs = rule.when.timerInterval * 60 * 1000;
                const ruleId = `timer_${index}`;

                const timer = setInterval(() => {
                    this.contextManager.incrementTimerTick();
                    this.pendingTicks.add(index);
                    this.scheduleDispatch();
                }, intervalMs);

                this.timers.set(ruleId, timer);
            }
        });
    }

    private scheduleDispatch(): void {
        if (this.dispatchHandle) {
            return;
        }

        this.dispatchHandle = setTimeout(() => {
            this.dispatchHandle = undefined;
            const firedRules = Array.from(this.pendingTicks.values());
            this.pendingTicks.clear();

            if (firedRules.length > 0) {
                this.onTimerTick(firedRules, this.registeredRules);
            }
        }, 0);
    }

    private clearTimers(): void {
        this.timers.forEach(timer => clearInterval(timer));
        this.timers.clear();
        this.pendingTicks.clear();
        if (this.dispatchHandle) {
            clearTimeout(this.dispatchHandle);
            this.dispatchHandle = undefined;
        }
    }

    public dispose(): void {
        this.clearTimers();
        this.registeredRules = [];
    }
}
