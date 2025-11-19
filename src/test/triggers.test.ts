import * as assert from "assert";
import * as vscode from "vscode";
import { ContextManager } from "../contextManager";
import { DebugTrigger } from "../triggers/debugTrigger";
import { ViewTrigger } from "../triggers/viewTrigger";
import { TimerTrigger } from "../triggers/timerTrigger";
import { TestTrigger } from "../triggers/testTrigger";
import { ThemeRule } from "../types";

suite("Triggers", () => {
    test("DebugTrigger updates context on start/stop", () => {
        const startEmitter = new vscode.EventEmitter<vscode.DebugSession>();
        const endEmitter = new vscode.EventEmitter<vscode.DebugSession>();

        const manager = new ContextManager();
        const debugApi = {
            onDidStartDebugSession: startEmitter.event,
            onDidTerminateDebugSession: endEmitter.event,
            activeDebugSession: undefined,
        };

        const trigger = new DebugTrigger(manager, debugApi as any);

        startEmitter.fire({ type: "node" } as vscode.DebugSession);
        let ctx = manager.getContext();
        assert.strictEqual(ctx.debugSession, "active");
        assert.strictEqual(ctx.debugType, "node");

        endEmitter.fire({ type: "node" } as vscode.DebugSession);
        ctx = manager.getContext();
        assert.strictEqual(ctx.debugSession, "inactive");
        assert.strictEqual(ctx.debugType, undefined);

        trigger.dispose();
    });

    test("ViewTrigger detects merge and diff view modes", () => {
        const visibleEmitter = new vscode.EventEmitter<vscode.TextEditor[]>();
        const activeEmitter = new vscode.EventEmitter<vscode.TextEditor | undefined>();

        const mergeDoc = {
            uri: vscode.Uri.file("/workspace/conflicted.ts"),
            getText: () => "<<<<<<< ours\n=======\n>>>>>>> theirs",
        } as vscode.TextDocument;
        const mergeEditor = { document: mergeDoc, viewColumn: 1 } as vscode.TextEditor;

        const windowStub = {
            visibleTextEditors: [mergeEditor],
            activeTextEditor: mergeEditor,
            onDidChangeVisibleTextEditors: visibleEmitter.event,
            onDidChangeActiveTextEditor: activeEmitter.event,
        };

        const manager = new ContextManager();
        const trigger = new ViewTrigger(manager, windowStub as any);

        (trigger as any).updateViewMode();
        assert.strictEqual(manager.getContext().viewMode, "merge");

        const diffDoc = {
            uri: vscode.Uri.parse("git:/diff/file"),
            getText: () => "",
        } as vscode.TextDocument;
        const diffEditor = { document: diffDoc, viewColumn: 1 } as vscode.TextEditor;
        windowStub.visibleTextEditors = [diffEditor];
        windowStub.activeTextEditor = diffEditor;

        (trigger as any).updateViewMode();
        assert.strictEqual(manager.getContext().viewMode, "diff");

        trigger.dispose();
    });

    test("TimerTrigger dispatches pending ticks", () => {
        const originalSetTimeout = global.setTimeout;
        const originalSetInterval = global.setInterval;
        const timeouts: Function[] = [];

        (global as any).setTimeout = (fn: any) => {
            timeouts.push(fn);
            return 0 as any;
        };
        (global as any).setInterval = () => 0 as any;

        const manager = new ContextManager();
        let lastFired: number[] | undefined;
        const rules: ThemeRule[] = [
            { name: "Timer", when: { timerInterval: 1 }, theme: "Theme" },
        ];
        const trigger = new TimerTrigger(manager, (indices) => {
            lastFired = indices;
        });

        trigger.registerTimerRules(rules);
        (trigger as any).pendingTicks.add(0);
        manager.incrementTimerTick();
        (trigger as any).scheduleDispatch();

        timeouts.forEach((fn) => fn());

        assert.deepStrictEqual(lastFired, [0]);

        trigger.dispose();
        (global as any).setTimeout = originalSetTimeout;
        (global as any).setInterval = originalSetInterval;
    });

    test("TestTrigger tracks task and testing API runs", () => {
        const startTaskEmitter = new vscode.EventEmitter<vscode.TaskStartEvent>();
        const endTaskEmitter = new vscode.EventEmitter<vscode.TaskEndEvent>();
        const endProcessEmitter = new vscode.EventEmitter<vscode.TaskProcessEndEvent>();
        const startRunEmitter = new vscode.EventEmitter<vscode.TestRunRequest>();
        const endRunEmitter = new vscode.EventEmitter<vscode.TestRunRequest>();

        const tasksApi = {
            onDidStartTask: startTaskEmitter.event,
            onDidEndTask: endTaskEmitter.event,
            onDidEndTaskProcess: endProcessEmitter.event,
        };
        const testsApi = {
            onDidStartTestRun: startRunEmitter.event,
            onDidEndTestRun: endRunEmitter.event,
        };

        const originalSetTimeout = global.setTimeout;
        let timeoutCallbacks: Function[] = [];
        (global as any).setTimeout = (fn: any) => {
            timeoutCallbacks.push(fn);
            return 0 as any;
        };

        const manager = new ContextManager();
        const trigger = new TestTrigger(manager, tasksApi as any, testsApi as any);

        const task = { name: "jest", source: "npm" } as vscode.Task;
        const execution = { task } as vscode.TaskExecution;
        startTaskEmitter.fire({ execution } as vscode.TaskStartEvent);
        assert.strictEqual(manager.getContext().testState, "running");

        endProcessEmitter.fire({ execution, exitCode: 0 } as vscode.TaskProcessEndEvent);
        assert.strictEqual(manager.getContext().testState, "passed");

        timeoutCallbacks.forEach((fn) => fn());
        assert.strictEqual(manager.getContext().testState, "none");

        timeoutCallbacks = [];
        startRunEmitter.fire({} as vscode.TestRunRequest);
        assert.strictEqual(manager.getContext().testState, "running");

        endRunEmitter.fire({} as vscode.TestRunRequest);
        timeoutCallbacks.forEach((fn) => fn());
        assert.strictEqual(manager.getContext().testState, "none");

        trigger.dispose();
        (global as any).setTimeout = originalSetTimeout;
    });
});
