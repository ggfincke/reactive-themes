/**
 * Test file for bubble sort - TypeScript
 * This file demonstrates pattern matching (*.test.*)
 */
import { bubbleSort } from './bubble_sort';

describe('bubbleSort', () => {
    it('should sort an array of numbers in ascending order', () => {
        const input = [64, 34, 25, 12, 22, 11, 90];
        const expected = [11, 12, 22, 25, 34, 64, 90];
        const result = bubbleSort([...input]);
        expect(result).toEqual(expected);
    });

    it('should handle an already sorted array', () => {
        const input = [1, 2, 3, 4, 5];
        const expected = [1, 2, 3, 4, 5];
        const result = bubbleSort([...input]);
        expect(result).toEqual(expected);
    });

    it('should handle a reverse sorted array', () => {
        const input = [5, 4, 3, 2, 1];
        const expected = [1, 2, 3, 4, 5];
        const result = bubbleSort([...input]);
        expect(result).toEqual(expected);
    });

    it('should handle an empty array', () => {
        const input: number[] = [];
        const expected: number[] = [];
        const result = bubbleSort([...input]);
        expect(result).toEqual(expected);
    });

    it('should handle a single element array', () => {
        const input = [42];
        const expected = [42];
        const result = bubbleSort([...input]);
        expect(result).toEqual(expected);
    });
});
