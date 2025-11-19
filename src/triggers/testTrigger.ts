// src/triggers/testTrigger.ts
// Track task execution to infer test running state

import * as vscode from "vscode";
import { ContextManager } from "../contextManager";

export class TestTrigger implements vscode.Disposable {
    private disposables: vscode.Disposable[] = [];
    private resetTimeout?: NodeJS.Timeout;
    private activeTaskRuns = 0;
    private activeApiRuns = 0;

    constructor(
        private contextManager: ContextManager,
        private tasksApi: typeof vscode.tasks = vscode.tasks,
        private testsApi: {
            onDidStartTestRun?: vscode.Event<vscode.TestRunRequest>;
            onDidEndTestRun?: vscode.Event<vscode.TestRunRequest>;
        } = vscode.tests as unknown as {
            onDidStartTestRun?: vscode.Event<vscode.TestRunRequest>;
            onDidEndTestRun?: vscode.Event<vscode.TestRunRequest>;
        }
    ) {
        this.initialize();
    }

    private initialize(): void {
        // Listen for task start events
        this.disposables.push(
            this.tasksApi.onDidStartTask((e) => {
                if (this.isTestTask(e.execution.task)) {
                    this.activeTaskRuns += 1;
                    this.setRunning();
                }
            })
        );

        // Listen for task end events
        this.disposables.push(
            this.tasksApi.onDidEndTask((e) => {
                if (this.isTestTask(e.execution.task)) {
                    this.activeTaskRuns = Math.max(0, this.activeTaskRuns - 1);
                    this.handleRunCompletion();
                }
            })
        );

        // Listen for task process end to get exit code
        this.disposables.push(
            this.tasksApi.onDidEndTaskProcess((e) => {
                if (this.isTestTask(e.execution.task)) {
                    this.activeTaskRuns = Math.max(0, this.activeTaskRuns - 1);
                    const result = e.exitCode === 0 ? "passed" : "failed";
                    this.handleRunCompletion(result);
                }
            })
        );

        if (this.testsApi?.onDidStartTestRun) {
            this.disposables.push(
                this.testsApi.onDidStartTestRun(() => {
                    this.activeApiRuns += 1;
                    this.setRunning();
                })
            );
        }

        if (this.testsApi?.onDidEndTestRun) {
            this.disposables.push(
                this.testsApi.onDidEndTestRun(() => {
                    this.activeApiRuns = Math.max(0, this.activeApiRuns - 1);
                    this.handleRunCompletion();
                })
            );
        }
    }

    private isTestTask(task: vscode.Task): boolean {
        const taskName = task.name.toLowerCase();
        const taskSource = task.source?.toLowerCase() || "";

        // Common test-related keywords
        const testKeywords = [
            "test",
            "jest",
            "mocha",
            "jasmine",
            "karma",
            "vitest",
            "pytest",
            "unittest",
            "spec",
        ];

        return testKeywords.some(
            (keyword) => taskName.includes(keyword) || taskSource.includes(keyword)
        );
    }

    private setRunning(): void {
        if (this.resetTimeout) {
            clearTimeout(this.resetTimeout);
        }
        this.contextManager.setTestState("running");
    }

    private handleRunCompletion(result?: "passed" | "failed"): void {
        if (this.activeTaskRuns > 0 || this.activeApiRuns > 0) {
            return;
        }

        if (this.resetTimeout) {
            clearTimeout(this.resetTimeout);
        }

        if (result) {
            this.contextManager.setTestState(result);
            this.resetTimeout = setTimeout(() => {
                this.contextManager.setTestState("none");
            }, 5000);
        } else {
            this.resetTimeout = setTimeout(() => {
                this.contextManager.setTestState("none");
            }, 2000);
        }
    }

    public dispose(): void {
        if (this.resetTimeout) {
            clearTimeout(this.resetTimeout);
        }
        this.disposables.forEach((d) => d.dispose());
    }
}
