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

        const result = evaluateRules(rules, editor);
        assert.ok(result.matched);
        assert.strictEqual(result.theme, 'PatternTheme');
        assert.strictEqual(result.rule?.name, 'Pattern rule');
    });
});
