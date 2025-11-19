import * as assert from "assert";
import { ContextManager } from "../contextManager";

suite("ContextManager", () => {
    test("increments timer ticks and emits updates", (done) => {
        const manager = new ContextManager();
        let receivedTick: number | undefined;

        const disposable = manager.onDidChangeContext((context) => {
            receivedTick = context.timerTick;
            disposable.dispose();
            assert.strictEqual(receivedTick, 1);
            done();
        });

        manager.incrementTimerTick();
    });

    test("updates debug session and clears debug type when inactive", () => {
        const manager = new ContextManager();
        manager.setDebugSession("active", "node");
        const activeContext = manager.getContext();
        assert.strictEqual(activeContext.debugSession, "active");
        assert.strictEqual(activeContext.debugType, "node");

        manager.setDebugSession("inactive");
        const inactiveContext = manager.getContext();
        assert.strictEqual(inactiveContext.debugSession, "inactive");
        assert.strictEqual(inactiveContext.debugType, undefined);
    });
});
