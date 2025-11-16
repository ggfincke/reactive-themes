import * as assert from 'assert';
import { buildOverlapMap, findOverlappingRules } from '../ruleOverlap';
import { ThemeRule } from '../types';

suite('Rule Overlap Detection', () => {
    const rules: ThemeRule[] = [
        { name: 'TypeScript Language', when: { language: 'typescript' }, theme: 'Dark' },
        { name: 'TypeScript Pattern', when: { pattern: '**/*.ts' }, theme: 'Light' },
        { name: 'Workspace Specific', when: { workspaceName: 'demo' }, theme: 'Blue' },
        { name: 'Exact Duplicate', when: { language: 'typescript' }, theme: 'Dark Variant' }
    ];

    test('findOverlappingRules returns functional overlaps without duplicates', () => {
        const overlaps = findOverlappingRules(rules[1], rules);
        assert.strictEqual(overlaps.length, 2);
        assert.deepStrictEqual(
            overlaps.map(rule => rule.name).sort(),
            ['Exact Duplicate', 'TypeScript Language'].sort()
        );
    });

    test('buildOverlapMap counts each overlapping pair once', () => {
        const overlapMap = buildOverlapMap(rules);

        assert.deepStrictEqual(
            overlapMap.get(0)?.map(rule => rule.name).sort(),
            ['Exact Duplicate', 'TypeScript Pattern'].sort()
        );
        assert.strictEqual(overlapMap.get(1)?.length, 2);

        // ensure symmetry and no double counting
        assert.deepStrictEqual(
            overlapMap.get(3)?.map(rule => rule.name),
            ['TypeScript Language', 'TypeScript Pattern']
        );
    });
});
