# Sorting algorithms — When to use, complexity, and examples

**Module:** [src/algorithms](../src/algorithms/README.md)

This doc covers each sorting algorithm in `src/algorithms/sorting-algorithms.ts`: what it does, time/space complexity, when to use it, and minimal code examples.

---

## Bubble sort

**Method:** `SortingAlgorithms.bubbleSort(arr, compare?)`

### What it does

Repeatedly steps through the array, compares adjacent elements, and swaps them if they are in the wrong order. Passes continue until no swaps are needed.

### Complexity

- **Time:** O(n²) average and worst. O(n) when already sorted (with early exit).
- **Space:** O(1) on the copied array.

### When to use

- Learning and teaching only. Do not use in production for non-tiny inputs.

### When not to use

- Any real data: use merge sort, quick sort, or heap sort (or the engine’s built-in sort).

### Example

```ts
import { SortingAlgorithms } from "@/algorithms/sorting-algorithms";

const arr = [64, 34, 25, 12, 22, 11, 90];
const sorted = SortingAlgorithms.bubbleSort(arr);
// sorted: [11, 12, 22, 25, 34, 64, 90]; arr unchanged
```

---

## Insertion sort

**Method:** `SortingAlgorithms.insertionSort(arr, compare?)`

### What it does

Builds the sorted result one element at a time: for each element, inserts it into the correct position in the already-sorted prefix.

### Complexity

- **Time:** O(n²) worst. O(n) when input is nearly sorted.
- **Space:** O(1) on the copy.

### When to use

- Very small arrays (e.g. n &lt; 50).
- Input is almost sorted (e.g. re-sorting after a few insertions).

### When not to use

- Large or random data: use O(n log n) sorts.

### Example

```ts
const sorted = SortingAlgorithms.insertionSort([3, 1, 4, 1, 5]);
// [1, 1, 3, 4, 5]
```

---

## Selection sort

**Method:** `SortingAlgorithms.selectionSort(arr, compare?)`

### What it does

Repeatedly finds the minimum of the unsorted region and swaps it to the front. Simple but always Θ(n²) comparisons.

### Complexity

- **Time:** O(n²).
- **Space:** O(1) on the copy.

### When to use

- Learning, or when writes/swaps are expensive and you want to minimize them (at most n−1 swaps).

### When not to use

- General-purpose sorting: use merge/quick/heap.

### Example

```ts
const sorted = SortingAlgorithms.selectionSort([29, 10, 14, 37, 13]);
// [10, 13, 14, 29, 37]
```

---

## Merge sort

**Method:** `SortingAlgorithms.mergeSort(arr, compare?)`

### What it does

Divide and conquer: split in half, sort each half (recursively), then merge the two sorted halves. Stable (equal elements keep relative order).

### Complexity

- **Time:** O(n log n) always.
- **Space:** O(n) for temporary arrays during merge.

### When to use

- When you need stable sort or guaranteed O(n log n) (e.g. avoid quicksort’s worst case).
- Linked lists (merge sort is natural and O(1) extra space with pointer rewiring).

### When not to use

- When in-place and non-stable is fine: quick sort or heap sort may be faster in practice.

### Example

```ts
const sorted = SortingAlgorithms.mergeSort([38, 27, 43, 3, 9, 82, 10]);
// [3, 9, 10, 27, 38, 43, 82]
```

---

## Quick sort

**Method:** `SortingAlgorithms.quickSort(arr, compare?)`

### What it does

Chooses a pivot (this implementation uses the last element), partitions the array so smaller elements are left and larger are right of the pivot, then recurses on both sides.

### Complexity

- **Time:** O(n log n) average. O(n²) worst case (e.g. sorted or reverse-sorted input with last-element pivot).
- **Space:** O(log n) stack for recursion.

### When to use

- General-purpose in-memory sort when you don’t need stability; often fastest in practice.
- Random or shuffled data to reduce worst-case risk.

### When not to use

- When you need stability: use merge sort.
- When you must guarantee O(n log n): use merge or heap sort.

### Example

```ts
const sorted = SortingAlgorithms.quickSort([5, 2, 9, 1, 7, 6]);
// [1, 2, 5, 6, 7, 9]
```

---

## Heap sort

**Method:** `SortingAlgorithms.heapSort(arr, compare?)`

### What it does

Builds a max-heap from the array, then repeatedly extracts the maximum (swap with end, reduce heap size, heapify down). Sorts in place on the copy.

### Complexity

- **Time:** O(n log n) always.
- **Space:** O(1) on the copy.

### When to use

- When you need guaranteed O(n log n) and in-place (e.g. limited memory).
- When you want to avoid quicksort’s worst case and don’t need stability.

### When not to use

- When you need stable sort: use merge sort.
- When average-case speed matters more than worst case: quick sort is often faster.

### Example

```ts
const sorted = SortingAlgorithms.heapSort([12, 11, 13, 5, 6, 7]);
// [5, 6, 7, 11, 12, 13]
```

---

## Quick reference

| Algorithm   | Time (avg) | Time (worst) | Space | Stable |
|------------|------------|--------------|-------|--------|
| Bubble     | O(n²)      | O(n²)        | O(1)  | Yes    |
| Insertion  | O(n²)      | O(n²)        | O(1)  | Yes    |
| Selection  | O(n²)      | O(n²)        | O(1)  | No     |
| Merge      | O(n log n) | O(n log n)   | O(n)  | Yes    |
| Quick      | O(n log n) | O(n²)        | O(log n) | No  |
| Heap       | O(n log n) | O(n log n)   | O(1)  | No     |

## See also

- [Main README](../README.md#documentation) — documentation index and links to all algorithm docs
- Module README: [src/algorithms/README.md](../src/algorithms/README.md)
- [docs/sorting-data-generator.md](sorting-data-generator.md) — generate `sorting-data.json` for correctness and optional performance tests.
