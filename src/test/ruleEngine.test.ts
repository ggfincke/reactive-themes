import * as assert from 'assert';
import * as vscode from 'vscode';
import { evaluateRules, matchGlobPattern } from '../ruleEngine';
import { ThemeRule } from '../types';

suite('Rule Engine', () => {
    test('matches common glob features (braces, negation, matchBase)', () => {
        assert.ok(matchGlobPattern('/workspace/src/index.ts', '*.ts'), 'matchBase should match *.ts');
        assert.ok(matchGlobPattern('/workspace/src/button.test.ts', '**/*.test.{ts,js}'));
        assert.strictEqual(matchGlobPattern('/workspace/node_modules/pkg/index.js', '!**/node_modules/**'), false);
        assert.ok(matchGlobPattern('C:/dev/project/src/App.vue'.replace(/\\/g, '/'), '**/*.{ts,js,vue}'));
    });

    test('returns first matching rule with language + pattern conditions', () => {
        const rules: ThemeRule[] = [
            { name: 'Pattern rule', when: { pattern: '**/*.ts' }, theme: 'PatternTheme' },
            { name: 'Language rule', when: { language: 'typescript' }, theme: 'LanguageTheme' }
        ];

        const editor = {
            document: {
                languageId: 'typescript',
                uri: vscode.Uri.file('/workspace/src/main.ts')
            }
        } as unknown as vscode.TextEditor;

        const context = { debugSession: 'inactive' as const, testState: 'none' as const, viewMode: 'normal' as const, timerTick: 0 };
        const result = evaluateRules(rules, editor, context);
        assert.ok(result.matched);
        assert.strictEqual(result.theme, 'PatternTheme');
        assert.strictEqual(result.rule?.name, 'Pattern rule');
    });

    test('matches context-based conditions for debug/test/view modes', () => {
        const rules: ThemeRule[] = [
            {
                name: 'Debug diff view',
                when: { debugSession: 'active', testState: 'running', viewMode: 'diff' },
                theme: 'DebugTheme'
            },
            { name: 'Fallback', when: {}, theme: 'FallbackTheme' }
        ];

        const editor = {
            document: {
                languageId: 'typescript',
                uri: vscode.Uri.file('/workspace/src/main.ts')
            }
        } as unknown as vscode.TextEditor;

        const context = {
            debugSession: 'active' as const,
            testState: 'running' as const,
            viewMode: 'diff' as const,
            timerTick: 0
        };

        const result = evaluateRules(rules, editor, context);
        assert.ok(result.matched);
        assert.strictEqual(result.theme, 'DebugTheme');
    });

    test('timer-based rules only match on timer ticks', () => {
        const rules: ThemeRule[] = [
            { name: 'Timer rule', when: { timerInterval: 5 }, theme: 'TimerTheme' }
        ];

        const editor = {
            document: {
                languageId: 'typescript',
                uri: vscode.Uri.file('/workspace/src/main.ts')
            }
        } as unknown as vscode.TextEditor;

        const context = {
            debugSession: 'inactive' as const,
            testState: 'none' as const,
            viewMode: 'normal' as const,
            timerTick: 0
        };

        const inactiveResult = evaluateRules(rules, editor, context);
        assert.strictEqual(inactiveResult.matched, false);

        const activeResult = evaluateRules(rules, editor, context, {
            allowTimerRules: true,
            activeTimerRuleIndices: new Set([0]),
            timerOnly: true
        });
        assert.ok(activeResult.matched);
        assert.strictEqual(activeResult.theme, 'TimerTheme');
    });
});
