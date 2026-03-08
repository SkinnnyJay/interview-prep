/**
 * Big-O complexity demos with benchmarks.
 *
 * Each function performs work that scales by the given complexity.
 * Use BigO.benchmark() to run timing comparisons via performance.now().
 */

import { performance } from "perf_hooks";

export type BigOFn = (n: number) => number;

/** O(1) — constant. One step regardless of n. */
export function constant(n: number): number {
  return n > 0 ? 1 : 0;
}

/** O(log n) — logarithmic. Binary-search style: halve until done. */
export function logarithmic(n: number): number {
  let count = 0;
  let x = Math.max(1, n);
  while (x > 1) {
    x = Math.floor(x / 2);
    count++;
  }
  return count;
}

/** O(n) — linear. Single loop over n. */
export function linear(n: number): number {
  let sum = 0;
  for (let i = 0; i < n; i++) sum += 1;
  return sum;
}

/** O(n log n) — linearithmic. n steps, each doing log n work. */
export function linearithmic(n: number): number {
  let sum = 0;
  for (let i = 0; i < n; i++) {
    let x = Math.max(1, n);
    while (x > 1) {
      x = Math.floor(x / 2);
      sum += 1;
    }
  }
  return sum;
}

/** O(n²) — quadratic. Nested loops over n. */
export function quadratic(n: number): number {
  let sum = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) sum += 1;
  return sum;
}

/** O(2^n) — exponential. Only use with very small n. */
export function exponential(n: number): number {
  if (n <= 0) return 1;
  return exponential(n - 1) + exponential(n - 1);
}

export const BigO = {
  constant,
  logarithmic,
  linear,
  linearithmic,
  quadratic,
  exponential,
} as const;

/** Keys of the BigO object; use for type-safe benchmark row names. */
export type BigOKey = keyof typeof BigO;

export interface BenchmarkResult {
  name: BigOKey;
  complexity: string;
  n: number;
  ms: number;
  result: number;
}

const DEFAULT_SIZES: readonly number[] = [100, 1_000, 10_000, 50_000];
const EXP_SIZES: readonly number[] = [8, 10, 12, 14]; // keep 2^n small

/**
 * Run one function with size n and return elapsed ms and result.
 */
function measure(fn: BigOFn, n: number): { ms: number; result: number } {
  const start = performance.now();
  const result = fn(n);
  const ms = performance.now() - start;
  return { ms, result };
}

/**
 * Run benchmarks for all complexity classes and log a concise table.
 * Uses performance.now() for timings.
 */
interface BenchmarkRow {
  name: BigOKey;
  complexity: string;
  fn: BigOFn;
}

const BENCHMARK_ROWS: readonly BenchmarkRow[] = [
  { name: "constant", complexity: "O(1)", fn: constant },
  { name: "logarithmic", complexity: "O(log n)", fn: logarithmic },
  { name: "linear", complexity: "O(n)", fn: linear },
  { name: "linearithmic", complexity: "O(n log n)", fn: linearithmic },
  { name: "quadratic", complexity: "O(n²)", fn: quadratic },
] as const;

export function benchmark(sizes: number[] = [...DEFAULT_SIZES]): BenchmarkResult[] {
  const rows = BENCHMARK_ROWS;

  const results: BenchmarkResult[] = [];
  const logLines: string[] = [];

  logLines.push("");
  logLines.push("Big-O benchmark (ms)");
  logLines.push("-".repeat(56));

  const header = ["n", ...sizes.map((s) => s.toLocaleString())].join("\t");
  logLines.push(header);

  for (const { name, complexity, fn } of rows) {
    const times: number[] = [];
    for (const n of sizes) {
      const { ms, result } = measure(fn, n);
      times.push(ms);
      results.push({ name, complexity, n, ms, result });
    }
    logLines.push([complexity, ...times.map((t) => t.toFixed(3))].join("\t"));
  }

  // Exponential separately with small n
  logLines.push("-".repeat(56));
  const expHeader = ["n (exp)", ...EXP_SIZES.map((s) => s.toString())].join("\t");
  logLines.push(expHeader);
  const expTimes: number[] = [];
  for (const n of EXP_SIZES) {
    const { ms, result } = measure(exponential, n);
    expTimes.push(ms);
    results.push({ name: "exponential", complexity: "O(2^n)", n, ms, result });
  }
  logLines.push(["O(2^n)", ...expTimes.map((t) => t.toFixed(3))].join("\t"));
  logLines.push("");

  // eslint-disable-next-line no-console
  console.log(logLines.join("\n"));
  return results;
}
