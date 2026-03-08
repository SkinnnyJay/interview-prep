import { describe, it, expect, afterEach } from "@jest/globals";
import { SortingAlgorithms } from "./sorting-algorithms";
import * as fs from "fs";
import * as path from "path";

const RUN_PERF = process.env.RUN_SORTING_PERF === "1";

/** Keys and sizes from generate-sorting-data.js */
export interface SortingDataSets {
  tiny?: number[];
  small?: number[];
  medium?: number[];
  large?: number[];
  huge?: number[];
}

const tiny: number[] = [3, 1, 4, 1, 5];
const small: number[] = [64, 34, 25, 12, 22, 11, 90];

function loadSortingData(): SortingDataSets | null {
  const p = path.join(__dirname, "sorting-data.json");
  if (!fs.existsSync(p)) return null;
  const raw = fs.readFileSync(p, "utf8");
  return JSON.parse(raw) as SortingDataSets;
}

function sortedCopy(arr: number[]): number[] {
  return arr.slice().sort((a, b) => a - b);
}

function expectSorted(arr: number[]): void {
  expect(SortingAlgorithms.isSorted(arr)).toBe(true);
  for (let i = 1; i < arr.length; i++) {
    expect(arr[i]).toBeGreaterThanOrEqual(arr[i - 1]);
  }
}

afterEach(() => {
  jest.clearAllTimers();
  jest.clearAllMocks();
});

type SortFn = (arr: number[]) => number[];

const algorithms: ReadonlyArray<{ name: string; sort: SortFn }> = [
  { name: "bubbleSort", sort: (a) => SortingAlgorithms.bubbleSort(a) },
  { name: "insertionSort", sort: (a) => SortingAlgorithms.insertionSort(a) },
  { name: "selectionSort", sort: (a) => SortingAlgorithms.selectionSort(a) },
  { name: "mergeSort", sort: (a) => SortingAlgorithms.mergeSort(a) },
  { name: "quickSort", sort: (a) => SortingAlgorithms.quickSort(a) },
  { name: "heapSort", sort: (a) => SortingAlgorithms.heapSort(a) },
] as const;

describe("SortingAlgorithms", () => {
  describe("correctness", () => {
    algorithms.forEach(({ name, sort }) => {
      describe(name, () => {
        it("returns a new array and does not mutate input", () => {
          const input = tiny.slice();
          const result = sort(input);
          expect(result).not.toBe(input);
          expect(input).toEqual(tiny);
        });

        it("sorts tiny array correctly", () => {
          const result = sort(tiny);
          expectSorted(result);
          expect(result).toEqual(sortedCopy(tiny));
        });

        it("sorts small array correctly", () => {
          const result = sort(small);
          expectSorted(result);
          expect(result).toEqual(sortedCopy(small));
        });

        it("handles empty array", () => {
          const result = sort([]);
          expect(result).toEqual([]);
        });

        it("handles single element", () => {
          const result = sort([42]);
          expect(result).toEqual([42]);
        });

        it("handles two elements (ordered)", () => {
          const result = sort([1, 2]);
          expect(result).toEqual([1, 2]);
        });

        it("handles two elements (reverse)", () => {
          const result = sort([2, 1]);
          expect(result).toEqual([1, 2]);
        });

        it("handles duplicates", () => {
          const arr = [2, 1, 2, 1, 2];
          const result = sort(arr);
          expectSorted(result);
          expect(result).toEqual([1, 1, 2, 2, 2]);
        });

        it("handles descending array", () => {
          const arr = [5, 4, 3, 2, 1];
          const result = sort(arr);
          expect(result).toEqual([1, 2, 3, 4, 5]);
        });
      });
    });
  });

  describe("custom comparator", () => {
    it("sorts with descending comparator", () => {
      const arr = [1, 2, 3, 4, 5];
      const desc = (a: number, b: number): number => b - a;
      expect(SortingAlgorithms.mergeSort(arr, desc)).toEqual([5, 4, 3, 2, 1]);
      expect(SortingAlgorithms.quickSort(arr, desc)).toEqual([5, 4, 3, 2, 1]);
    });

    it("sorts objects by key with mergeSort", () => {
      const arr = [{ x: 3 }, { x: 1 }, { x: 2 }];
      const result = SortingAlgorithms.mergeSort(
        arr,
        (a: { x: number }, b: { x: number }): number => a.x - b.x
      );
      expect(result.map((o) => o.x)).toEqual([1, 2, 3]);
    });
  });

  describe("isSorted", () => {
    it("returns true for sorted array", () => {
      expect(SortingAlgorithms.isSorted([1, 2, 3])).toBe(true);
      expect(SortingAlgorithms.isSorted([])).toBe(true);
      expect(SortingAlgorithms.isSorted([1])).toBe(true);
    });

    it("returns false for unsorted array", () => {
      expect(SortingAlgorithms.isSorted([2, 1, 3])).toBe(false);
      expect(SortingAlgorithms.isSorted([3, 2, 1])).toBe(false);
    });
  });

  describe("sorting-data.json datasets", () => {
    const data = loadSortingData();
    if (!data) {
      it("skips when sorting-data.json is missing (run node src/algorithms/generate-sorting-data.js)", () => {
        expect(loadSortingData()).toBeNull();
      });
      return;
    }

    const sizes = ["tiny", "small", "medium", "large"] as const;
    sizes.forEach((size) => {
      if (!data[size]) return;
      algorithms.forEach(({ name, sort }) => {
        it(`${name} sorts ${size} (n=${data[size].length}) correctly`, () => {
          const input = data[size].slice();
          const expected = sortedCopy(input);
          const result = sort(input);
          expectSorted(result);
          expect(result).toEqual(expected);
        });
      });
    });

    // Huge: only run merge/quick/heap to avoid timeout
    if (data.huge) {
      const fastAlgorithms = algorithms.filter((a) =>
        ["mergeSort", "quickSort", "heapSort"].includes(a.name)
      );
      fastAlgorithms.forEach(({ name, sort }) => {
        it(`${name} sorts huge (n=${data.huge!.length}) correctly`, () => {
          const input = data.huge!.slice();
          const result = sort(input);
          expectSorted(result);
          expect(result.length).toBe(data.huge!.length);
          const expected = sortedCopy(data.huge!);
          expect(result).toEqual(expected);
        }, 15000);
      });
    }
  });

  describe("performance (optional)", () => {
    const data = loadSortingData();
    if (!RUN_PERF || !data) {
      it.skip("optional perf: set RUN_SORTING_PERF=1 and add sorting-data.json to run", () => {});
      return;
    }

    function timeMs(fn: () => void): number {
      const start = performance.now();
      fn();
      return performance.now() - start;
    }

    (["medium", "large", "huge"] as const).forEach((size) => {
      if (!data[size]) return;
      it(`reports time for ${size} (n=${data[size].length})`, () => {
        const times: Record<string, number> = {};
        algorithms.forEach(({ name, sort }) => {
          const input = data[size].slice();
          const ms = timeMs(() => sort(input));
          times[name] = ms;
        });
        // Log for learning; no assertion so test always passes
        console.warn(`\n  ${size} (n=${data[size].length}):`, times);
      }, 30000);
    });
  });
});
