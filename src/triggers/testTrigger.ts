// src/triggers/testTrigger.ts
// Track task execution to infer test running state

import * as vscode from 'vscode';
import { ContextManager } from '../contextManager';

export class TestTrigger implements vscode.Disposable {
    private disposables: vscode.Disposable[] = [];
    private testTimeout?: NodeJS.Timeout;

    constructor(private contextManager: ContextManager) {
        this.initialize();
    }

    private initialize(): void {
        // Listen for task start events
        this.disposables.push(
            vscode.tasks.onDidStartTask((e) => {
                if (this.isTestTask(e.execution.task)) {
                    this.contextManager.setTestState('running');

                    // Clear any existing timeout
                    if (this.testTimeout) {
                        clearTimeout(this.testTimeout);
                    }
                }
            })
        );

        // Listen for task end events
        this.disposables.push(
            vscode.tasks.onDidEndTask((e) => {
                if (this.isTestTask(e.execution.task)) {
                    // Check exit code to determine pass/fail
                    // Note: Unfortunately, TaskEndEvent doesn't provide exit code directly
                    // We'll use a timeout to reset to 'none' state
                    this.testTimeout = setTimeout(() => {
                        this.contextManager.setTestState('none');
                    }, 2000);
                }
            })
        );

        // Listen for task process end to get exit code
        this.disposables.push(
            vscode.tasks.onDidEndTaskProcess((e) => {
                if (this.isTestTask(e.execution.task)) {
                    if (this.testTimeout) {
                        clearTimeout(this.testTimeout);
                    }

                    // Exit code 0 = success, non-zero = failure
                    if (e.exitCode === 0) {
                        this.contextManager.setTestState('passed');
                    } else {
                        this.contextManager.setTestState('failed');
                    }

                    // Reset to 'none' after a delay
                    this.testTimeout = setTimeout(() => {
                        this.contextManager.setTestState('none');
                    }, 5000);
                }
            })
        );
    }

    private isTestTask(task: vscode.Task): boolean {
        const taskName = task.name.toLowerCase();
        const taskSource = task.source?.toLowerCase() || '';

        // Common test-related keywords
        const testKeywords = [
            'test',
            'jest',
            'mocha',
            'jasmine',
            'karma',
            'vitest',
            'pytest',
            'unittest',
            'spec'
        ];

        return testKeywords.some(keyword =>
            taskName.includes(keyword) || taskSource.includes(keyword)
        );
    }

    public dispose(): void {
        if (this.testTimeout) {
            clearTimeout(this.testTimeout);
        }
        this.disposables.forEach(d => d.dispose());
    }
}
