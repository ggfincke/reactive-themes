import * as assert from 'assert';
import * as vscode from 'vscode';
import { lintRules, groupIssuesByType, getIssueTypeLabel, getSeverityIcon } from '../ruleLinter';
import { ThemeRule } from '../types';

suite('Rule Linter', () => {
    suite('Exact Duplicate Detection', () => {
        test('detects exact duplicate rules', async () => {
            const rules: ThemeRule[] = [
                { name: 'TypeScript', when: { language: 'typescript' }, theme: 'Dark' },
                { name: 'TypeScript Duplicate', when: { language: 'typescript' }, theme: 'Dark' }
            ];

            const result = await lintRules(rules);
            const duplicates = result.issues.filter(i => i.type === 'duplicate');

            assert.strictEqual(duplicates.length, 1);
            assert.strictEqual(duplicates[0].ruleIndex, 1);
            assert.strictEqual(duplicates[0].severity, 'error');
        });

        test('detects duplicates with multiple conditions', async () => {
            const rules: ThemeRule[] = [
                { name: 'Test Files', when: { language: 'typescript', pattern: '**/*.test.ts' }, theme: 'Dark' },
                { name: 'Test Files Duplicate', when: { language: 'typescript', pattern: '**/*.test.ts' }, theme: 'Dark' }
            ];

            const result = await lintRules(rules);
            const duplicates = result.issues.filter(i => i.type === 'duplicate');

            assert.strictEqual(duplicates.length, 1);
        });

        test('does not flag similar but non-duplicate rules', async () => {
            const rules: ThemeRule[] = [
                { name: 'TypeScript Dark', when: { language: 'typescript' }, theme: 'Dark' },
                { name: 'TypeScript Light', when: { language: 'typescript' }, theme: 'Light' }
            ];

            const result = await lintRules(rules);
            const duplicates = result.issues.filter(i => i.type === 'duplicate');

            // these overlap but have different themes, so not exact duplicates
            assert.strictEqual(duplicates.length, 0);
        });
    });

    suite('Unreachable Rule Detection', () => {
        test('detects rule shadowed by earlier more general rule', async () => {
            const rules: ThemeRule[] = [
                { name: 'All TypeScript', when: { language: 'typescript' }, theme: 'Dark' },
                { name: 'TypeScript Tests', when: { language: 'typescript', pattern: '**/*.test.ts' }, theme: 'Light' }
            ];

            const result = await lintRules(rules);
            const unreachable = result.issues.filter(i => i.type === 'unreachable');

            assert.strictEqual(unreachable.length, 1);
            assert.strictEqual(unreachable[0].ruleIndex, 1);
            assert.strictEqual(unreachable[0].severity, 'warning');
            assert.strictEqual(unreachable[0].relatedRuleIndices?.[0], 0);
        });

        test('does not flag more specific rule before general rule', async () => {
            const rules: ThemeRule[] = [
                { name: 'TypeScript Tests', when: { language: 'typescript', pattern: '**/*.test.ts' }, theme: 'Light' },
                { name: 'All TypeScript', when: { language: 'typescript' }, theme: 'Dark' }
            ];

            const result = await lintRules(rules);
            const unreachable = result.issues.filter(i => i.type === 'unreachable');

            // second rule is more general but comes after, so both are reachable
            assert.strictEqual(unreachable.length, 0);
        });

        test('detects exact duplicate shadowing', async () => {
            const rules: ThemeRule[] = [
                { name: 'Python', when: { language: 'python' }, theme: 'Dark' },
                { name: 'Python Again', when: { language: 'python' }, theme: 'Light' }
            ];

            const result = await lintRules(rules);
            const unreachable = result.issues.filter(i => i.type === 'unreachable');

            // second rule is shadowed by first (same conditions)
            assert.strictEqual(unreachable.length, 1);
            assert.strictEqual(unreachable[0].ruleIndex, 1);
        });
    });

    suite('Invalid Pattern Detection', () => {
        test('detects invalid glob patterns', async () => {
            const rules: ThemeRule[] = [
                { name: 'Valid Pattern', when: { pattern: '**/*.ts' }, theme: 'Dark' },
                { name: 'Invalid Pattern', when: { pattern: '[invalid' }, theme: 'Light' }
            ];

            const result = await lintRules(rules);
            const invalidPatterns = result.issues.filter(i => i.type === 'invalid-pattern');

            // unclosed bracket should be reported as invalid
            assert.ok(invalidPatterns.length > 0);
        });
    });

    suite('Invalid Language Detection', () => {
        test('detects unknown language IDs', async () => {
            const rules: ThemeRule[] = [
                { name: 'Valid Language', when: { language: 'typescript' }, theme: 'Dark' },
                { name: 'Unknown Language', when: { language: 'unknownlang12345' }, theme: 'Light' }
            ];

            const result = await lintRules(rules);
            const invalidLanguages = result.issues.filter(i => i.type === 'invalid-language');

            assert.strictEqual(invalidLanguages.length, 1);
            assert.strictEqual(invalidLanguages[0].ruleIndex, 1);
            assert.strictEqual(invalidLanguages[0].severity, 'info');
        });

        test('allows known language IDs', async () => {
            const rules: ThemeRule[] = [
                { name: 'TypeScript', when: { language: 'typescript' }, theme: 'Dark' },
                { name: 'Python', when: { language: 'python' }, theme: 'Light' },
                { name: 'JavaScript', when: { language: 'javascript' }, theme: 'Blue' }
            ];

            const result = await lintRules(rules);
            const invalidLanguages = result.issues.filter(i => i.type === 'invalid-language');

            assert.strictEqual(invalidLanguages.length, 0);
        });

        test('accepts languages discovered at runtime', async () => {
            const rules: ThemeRule[] = [
                { name: 'CustomLang', when: { language: 'mycustomlang' }, theme: 'Dark' }
            ];

            const originalGetLanguages = vscode.languages.getLanguages;
            (vscode.languages as any).getLanguages = async () => ['mycustomlang'];

            try {
                const result = await lintRules(rules);
                const invalidLanguages = result.issues.filter(i => i.type === 'invalid-language');
                assert.strictEqual(invalidLanguages.length, 0);
            } finally {
                (vscode.languages as any).getLanguages = originalGetLanguages;
            }
        });
    });

    suite('Reordering Suggestions', () => {
        test('suggests moving specific rules before general ones', async () => {
            const rules: ThemeRule[] = [
                { name: 'All TypeScript', when: { language: 'typescript' }, theme: 'Dark' },
                { name: 'TypeScript in Workspace', when: { language: 'typescript', workspaceName: 'myproject' }, theme: 'Light' }
            ];

            const result = await lintRules(rules);
            const suggestions = result.issues.filter(i => i.type === 'reorder-suggestion');

            assert.strictEqual(suggestions.length, 1);
            assert.strictEqual(suggestions[0].ruleIndex, 1);
            assert.strictEqual(suggestions[0].severity, 'info');
        });

        test('skips reorder when specific rule already precedes general', async () => {
            const rules: ThemeRule[] = [
                { name: 'TypeScript in Workspace', when: { language: 'typescript', workspaceName: 'myproject' }, theme: 'Light' },
                { name: 'All TypeScript', when: { language: 'typescript' }, theme: 'Dark' }
            ];

            const result = await lintRules(rules);
            const suggestions = result.issues.filter(i => i.type === 'reorder-suggestion');

            assert.strictEqual(suggestions.length, 0);
        });

        test('prefers language + pattern before pattern-only', async () => {
            const rules: ThemeRule[] = [
                { name: 'Test Files', when: { pattern: '**/*.test.ts' }, theme: 'Dark' },
                { name: 'TypeScript Tests', when: { language: 'typescript', pattern: '**/*.test.ts' }, theme: 'Light' }
            ];

            const result = await lintRules(rules);
            const suggestions = result.issues.filter(i => i.type === 'reorder-suggestion');

            // more specific (language + pattern) should come before less specific (pattern only)
            assert.strictEqual(suggestions.length, 1);
            assert.strictEqual(suggestions[0].ruleIndex, 1);
        });
    });

    suite('Issue Grouping and Utilities', () => {
        test('groups issues by type', async () => {
            const rules: ThemeRule[] = [
                { name: 'Duplicate 1', when: { language: 'typescript' }, theme: 'Dark' },
                { name: 'Duplicate 2', when: { language: 'typescript' }, theme: 'Dark' },
                { name: 'Unknown Lang', when: { language: 'unknownlang' }, theme: 'Light' }
            ];

            const result = await lintRules(rules);
            const grouped = groupIssuesByType(result.issues);

            const duplicates = grouped.get('duplicate');
            const invalidLanguages = grouped.get('invalid-language');

            assert.ok(duplicates);
            assert.strictEqual(duplicates?.length, 1);
            assert.ok(invalidLanguages);
            assert.strictEqual(invalidLanguages?.length, 1);
        });

        test('maps issue types and severity icons', async () => {
            assert.strictEqual(getIssueTypeLabel('duplicate'), 'Duplicate Rules');
            assert.strictEqual(getIssueTypeLabel('unreachable'), 'Unreachable Rules');
            assert.strictEqual(getIssueTypeLabel('invalid-pattern'), 'Invalid Patterns');
            assert.strictEqual(getIssueTypeLabel('invalid-language'), 'Unknown Languages');
            assert.strictEqual(getIssueTypeLabel('missing-theme'), 'Missing Themes');
            assert.strictEqual(getIssueTypeLabel('reorder-suggestion'), 'Reordering Suggestions');
        });

        test('calculates stats totals', async () => {
            assert.strictEqual(getSeverityIcon('error'), '$(error)');
            assert.strictEqual(getSeverityIcon('warning'), '$(warning)');
            assert.strictEqual(getSeverityIcon('info'), '$(info)');
        });
    });

    suite('Statistics', () => {
        test('calculates stats totals for mixed severities', async () => {
            const rules: ThemeRule[] = [
                { name: 'Duplicate 1', when: { language: 'typescript' }, theme: 'Dark' },
                { name: 'Duplicate 2', when: { language: 'typescript' }, theme: 'Dark' },
                { name: 'General', when: { language: 'python' }, theme: 'Light' },
                { name: 'Specific', when: { language: 'python', workspaceName: 'test' }, theme: 'Blue' },
                { name: 'Unknown', when: { language: 'unknownlang' }, theme: 'Dark' }
            ];

            const result = await lintRules(rules);

            assert.ok(result.stats.total > 0);
            assert.strictEqual(
                result.stats.total,
                result.stats.errors + result.stats.warnings + result.stats.infos
            );
        });

        test('handles multiple overlapping issues correctly', async () => {
            const rules: ThemeRule[] = [
                { name: 'TypeScript', when: { language: 'typescript' }, theme: 'Default Dark+' },
                { name: 'Python', when: { language: 'python' }, theme: 'Default Light+' },
                { name: 'Markdown', when: { language: 'markdown' }, theme: 'Default High Contrast' }
            ];

            const result = await lintRules(rules);

            // these are valid, non-overlapping rules
            assert.strictEqual(result.stats.total, 0);
            assert.strictEqual(result.issues.length, 0);
        });
    });

    suite('Complex Scenarios', () => {
        test('handles multiple overlapping issues correctly', async () => {
            const rules: ThemeRule[] = [
                { name: 'TypeScript', when: { language: 'typescript' }, theme: 'Dark' },
                { name: 'TypeScript Duplicate', when: { language: 'typescript' }, theme: 'Dark' },
                { name: 'TypeScript Tests', when: { language: 'typescript', pattern: '**/*.test.ts' }, theme: 'Light' },
                { name: 'Unknown Lang', when: { language: 'unknownlang123' }, theme: 'Dark' }
            ];

            const result = await lintRules(rules);

            // should have duplicates, unreachable, and invalid language issues
            const duplicates = result.issues.filter(i => i.type === 'duplicate');
            const unreachable = result.issues.filter(i => i.type === 'unreachable');
            const invalidLangs = result.issues.filter(i => i.type === 'invalid-language');

            assert.ok(duplicates.length > 0, 'Should detect duplicates');
            assert.ok(unreachable.length > 0, 'Should detect unreachable rules');
            assert.ok(invalidLangs.length > 0, 'Should detect invalid languages');
        });

        test('handles empty rule list', async () => {
            const rules: ThemeRule[] = [];
            const result = await lintRules(rules);

            assert.strictEqual(result.issues.length, 0);
            assert.strictEqual(result.stats.total, 0);
        });

        test('handles single rule', async () => {
            const rules: ThemeRule[] = [
                { name: 'Only Rule', when: { language: 'typescript' }, theme: 'Default Dark+' }
            ];

            const result = await lintRules(rules);

            // single valid rule should have no issues
            assert.strictEqual(result.issues.length, 0);
        });
    });

    suite('Suggested Fixes', () => {
        test('provides delete suggestion for duplicates', async () => {
            const rules: ThemeRule[] = [
                { name: 'Original', when: { language: 'typescript' }, theme: 'Default Dark+' },
                { name: 'Duplicate', when: { language: 'typescript' }, theme: 'Default Dark+' }
            ];

            const result = await lintRules(rules);
            const duplicate = result.issues.find(i => i.type === 'duplicate');

            assert.ok(duplicate?.suggestedFix);
            assert.strictEqual(duplicate?.suggestedFix.action, 'delete');
        });

        test('provides reorder suggestion for unreachable rules', async () => {
            const rules: ThemeRule[] = [
                { name: 'General', when: { language: 'typescript' }, theme: 'Default Dark+' },
                { name: 'Specific', when: { language: 'typescript', pattern: '**/*.test.ts' }, theme: 'Default Light+' }
            ];

            const result = await lintRules(rules);
            const unreachable = result.issues.find(i => i.type === 'unreachable');

            assert.ok(unreachable?.suggestedFix);
            assert.strictEqual(unreachable?.suggestedFix.action, 'reorder');
        });
    });
});
