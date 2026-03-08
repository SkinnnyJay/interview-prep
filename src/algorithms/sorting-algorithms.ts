/**
 * Classic Sorting Algorithms
 *
 * Learning-oriented implementations of comparison-based sorting algorithms.
 * Each method returns a new sorted array (does not mutate input).
 *
 * Algorithms implemented:
 * - Bubble sort    O(n²) — educational, avoid in production
 * - Insertion sort O(n²) — good for small or nearly sorted data
 * - Selection sort O(n²) — simple, always n²
 * - Merge sort     O(n log n) — stable, predictable
 * - Quick sort     O(n log n) avg — fast in practice, in-place
 * - Heap sort      O(n log n) — in-place, no worst-case quicksort blowup
 */

/** Comparator: return negative if a < b, zero if equal, positive if a > b. */
export type CompareFn<T> = (a: T, b: T) => number;

/** In-place sort signature used internally (mutates array, no return). */
export type InPlaceSortFn<T> = (arr: T[], compare: CompareFn<T>) => void;

const defaultCompare: CompareFn<number> = (a, b) => a - b;

/**
 * Copy array and run sort in-place on the copy; return the copy.
 */
function sortCopy<T>(arr: T[], compare: CompareFn<T>, sortFn: InPlaceSortFn<T>): T[] {
  const out = arr.slice();
  sortFn(out, compare);
  return out;
}

function defaultCompareOr<T>(compare: CompareFn<T> | undefined): CompareFn<T> {
  return (compare ?? defaultCompare) as CompareFn<T>;
}

export class SortingAlgorithms {
  /**
   * Bubble sort
   *
   * Why: Simplest sort; repeatedly swap adjacent pairs until no swaps needed.
   * When: Learning only. Use merge/quick/heap for real data.
   * Complexity: O(n²) time, O(1) space (on the copy).
   */
  static bubbleSort(arr: number[]): number[];
  static bubbleSort<T>(arr: T[], compare: CompareFn<T>): T[];
  static bubbleSort<T>(arr: T[], compare?: CompareFn<T>): T[] {
    return sortCopy(arr, defaultCompareOr(compare), (a, cmp) => {
      for (let i = 0; i < a.length; i++) {
        let swapped = false;
        for (let j = 0; j < a.length - 1 - i; j++) {
          if (cmp(a[j], a[j + 1]) > 0) {
            [a[j], a[j + 1]] = [a[j + 1], a[j]];
            swapped = true;
          }
        }
        if (!swapped) break;
      }
    });
  }

  /**
   * Insertion sort
   *
   * Why: Build sorted region one element at a time; efficient for small n or nearly sorted.
   * When: Small arrays (< ~50), or when input is almost sorted (e.g. re-sorting after small changes).
   * Complexity: O(n²) worst, O(n) when nearly sorted; O(1) extra space.
   */
  static insertionSort(arr: number[]): number[];
  static insertionSort<T>(arr: T[], compare: CompareFn<T>): T[];
  static insertionSort<T>(arr: T[], compare?: CompareFn<T>): T[] {
    return sortCopy(arr, defaultCompareOr(compare), (a, cmp) => {
      for (let i = 1; i < a.length; i++) {
        const v = a[i];
        let j = i - 1;
        while (j >= 0 && cmp(a[j], v) > 0) {
          a[j + 1] = a[j];
          j--;
        }
        a[j + 1] = v;
      }
    });
  }

  /**
   * Selection sort
   *
   * Why: Find min of unsorted region, swap to front; simple but always Θ(n²).
   * When: Learning or when writes are expensive (minimal swaps).
   * Complexity: O(n²) time, O(1) extra space.
   */
  static selectionSort(arr: number[]): number[];
  static selectionSort<T>(arr: T[], compare: CompareFn<T>): T[];
  static selectionSort<T>(arr: T[], compare?: CompareFn<T>): T[] {
    return sortCopy(arr, defaultCompareOr(compare), (a, cmp) => {
      for (let i = 0; i < a.length - 1; i++) {
        let minIdx = i;
        for (let j = i + 1; j < a.length; j++) {
          if (cmp(a[j], a[minIdx]) < 0) minIdx = j;
        }
        if (minIdx !== i) [a[i], a[minIdx]] = [a[minIdx], a[i]];
      }
    });
  }

  /**
   * Merge sort
   *
   * Why: Divide and conquer; merge two sorted halves. Stable and predictable O(n log n).
   * When: When you need stable sort or guaranteed n log n (e.g. avoid quicksort worst case).
   * Complexity: O(n log n) time, O(n) extra space for temp arrays.
   */
  static mergeSort(arr: number[]): number[];
  static mergeSort<T>(arr: T[], compare: CompareFn<T>): T[];
  static mergeSort<T>(arr: T[], compare?: CompareFn<T>): T[] {
    const cmp = defaultCompareOr(compare);
    const out = arr.slice();
    const merge = (a: T[], lo: number, mid: number, hi: number): void => {
      const left = a.slice(lo, mid + 1);
      const right = a.slice(mid + 1, hi + 1);
      let i = 0,
        j = 0,
        k = lo;
      while (i < left.length && j < right.length) {
        if (cmp(left[i], right[j]) <= 0) a[k++] = left[i++];
        else a[k++] = right[j++];
      }
      while (i < left.length) a[k++] = left[i++];
      while (j < right.length) a[k++] = right[j++];
    };
    const rec = (a: T[], lo: number, hi: number): void => {
      if (lo >= hi) return;
      const mid = Math.floor((lo + hi) / 2);
      rec(a, lo, mid);
      rec(a, mid + 1, hi);
      merge(a, lo, mid, hi);
    };
    if (out.length > 0) rec(out, 0, out.length - 1);
    return out;
  }

  /**
   * Quick sort (Lomuto partition, pivot = last)
   *
   * Why: Partition around pivot; fast average case, cache-friendly.
   * When: General-purpose in-memory sort when you don't need stability.
   * Complexity: O(n log n) average, O(n²) worst (e.g. sorted input with last-element pivot); O(log n) stack.
   */
  static quickSort(arr: number[]): number[];
  static quickSort<T>(arr: T[], compare: CompareFn<T>): T[];
  static quickSort<T>(arr: T[], compare?: CompareFn<T>): T[] {
    const cmp = defaultCompareOr(compare);
    const out = arr.slice();
    const partition = (a: T[], lo: number, hi: number): number => {
      const pivot = a[hi];
      let i = lo - 1;
      for (let j = lo; j < hi; j++) {
        if (cmp(a[j], pivot) <= 0) {
          i++;
          [a[i], a[j]] = [a[j], a[i]];
        }
      }
      [a[i + 1], a[hi]] = [a[hi], a[i + 1]];
      return i + 1;
    };
    const rec = (a: T[], lo: number, hi: number): void => {
      if (lo >= hi) return;
      const p = partition(a, lo, hi);
      rec(a, lo, p - 1);
      rec(a, p + 1, hi);
    };
    if (out.length > 0) rec(out, 0, out.length - 1);
    return out;
  }

  /**
   * Heap sort
   *
   * Why: Build max-heap, repeatedly extract max to end of array. In-place, no worst-case quicksort.
   * When: When you need O(n log n) guaranteed and in-place (e.g. limited memory).
   * Complexity: O(n log n) time, O(1) extra space.
   */
  static heapSort(arr: number[]): number[];
  static heapSort<T>(arr: T[], compare: CompareFn<T>): T[];
  static heapSort<T>(arr: T[], compare?: CompareFn<T>): T[] {
    const compareFn = defaultCompareOr(compare);
    const out = arr.slice();
    const cmp = (a: T[], i: number, j: number): number => compareFn(a[i], a[j]);
    const swap = (a: T[], i: number, j: number): void => {
      [a[i], a[j]] = [a[j], a[i]];
    };
    const heapifyDown = (a: T[], n: number, i: number): void => {
      let largest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < n && cmp(a, left, largest) > 0) largest = left;
      if (right < n && cmp(a, right, largest) > 0) largest = right;
      if (largest !== i) {
        swap(a, i, largest);
        heapifyDown(a, n, largest);
      }
    };
    const n = out.length;
    for (let i = Math.floor(n / 2) - 1; i >= 0; i--) heapifyDown(out, n, i);
    for (let size = n - 1; size > 0; size--) {
      swap(out, 0, size);
      heapifyDown(out, size, 0);
    }
    return out;
  }

  /**
   * Returns true if the array is sorted according to compare.
   */
  static isSorted(arr: number[]): boolean;
  static isSorted<T>(arr: T[], compare: CompareFn<T>): boolean;
  static isSorted<T>(arr: T[], compare?: CompareFn<T>): boolean {
    const cmp = defaultCompareOr(compare);
    for (let i = 1; i < arr.length; i++) {
      if (cmp(arr[i - 1], arr[i]) > 0) return false;
    }
    return true;
  }
}
