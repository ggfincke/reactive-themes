package main

import "fmt"

// bubbleSort sorts an array of integers using bubble sort algorithm
func bubbleSort(arr []int) []int {
	n := len(arr)
	for i := 0; i < n; i++ {
		for j := 0; j < n-i-1; j++ {
			if arr[j] > arr[j+1] {
				// Swap elements
				arr[j], arr[j+1] = arr[j+1], arr[j]
			}
		}
	}
	return arr
}

func main() {
	numbers := []int{64, 34, 25, 12, 22, 11, 90}
	fmt.Println("Original array:", numbers)

	// Create a copy to preserve original
	sorted := make([]int, len(numbers))
	copy(sorted, numbers)
	bubbleSort(sorted)

	fmt.Println("Sorted array:", sorted)
}
