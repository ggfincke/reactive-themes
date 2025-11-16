/**
 * Bubble sort implementation in TypeScript
 */
function bubbleSort(arr: number[]): number[] {
    const n = arr.length;
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n - i - 1; j++) {
            if (arr[j] > arr[j + 1]) {
                // Swap elements
                [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
            }
        }
    }
    return arr;
}

// Example usage
const numbers: number[] = [64, 34, 25, 12, 22, 11, 90];
console.log("Original array:", numbers);
const sortedNumbers = bubbleSort([...numbers]);
console.log("Sorted array:", sortedNumbers);

export { bubbleSort };
