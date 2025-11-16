/// Bubble sort implementation in Rust
fn bubble_sort(arr: &mut [i32]) {
    let n = arr.len();
    for i in 0..n {
        for j in 0..n - i - 1 {
            if arr[j] > arr[j + 1] {
                // Swap elements
                arr.swap(j, j + 1);
            }
        }
    }
}

fn main() {
    let mut numbers = vec![64, 34, 25, 12, 22, 11, 90];
    println!("Original array: {:?}", numbers);

    bubble_sort(&mut numbers);

    println!("Sorted array: {:?}", numbers);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bubble_sort() {
        let mut arr = vec![5, 2, 8, 1, 9];
        bubble_sort(&mut arr);
        assert_eq!(arr, vec![1, 2, 5, 8, 9]);
    }
}
