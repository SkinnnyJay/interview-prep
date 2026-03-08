# Big-O complexity — Demos and benchmarks

**Module:** [src/algorithms](../src/algorithms/README.md) · **Source:** `src/algorithms/big-o.ts`

This doc describes the Big-O complexity demos and benchmark harness in `src/algorithms/big-o.ts`: what each function does, how to run benchmarks, and how to use the results.

---

## What it does

The module provides **concrete functions** that perform work scaling by classic complexity classes, plus a **benchmark** that measures them with `performance.now()` and prints a timing table. Use it to build intuition for how O(1), O(log n), O(n), O(n log n), O(n²), and O(2^n) behave as input size grows.

---

## Complexity functions

| Complexity   | Function         | Description |
|-------------|------------------|-------------|
| **O(1)**    | `constant(n)`    | Single step; result does not scale with n. |
| **O(log n)**| `logarithmic(n)` | Halve until done (binary-search style); returns number of steps. |
| **O(n)**    | `linear(n)`      | One loop over n; returns sum of n steps. |
| **O(n log n)** | `linearithmic(n)` | n iterations, each doing log n work. |
| **O(n²)**   | `quadratic(n)`   | Nested loops over n; returns n². |
| **O(2^n)**  | `exponential(n)` | Recursive branching; **use only with very small n** (e.g. &lt; 20). |

All are exported as standalone functions and as `BigO.constant`, `BigO.linear`, etc.

---

## Usage

### Call a complexity function

```ts
import { BigO } from "@/algorithms/big-o";

BigO.constant(1_000_000);   // 1
BigO.linear(10_000);        // 10000
BigO.quadratic(100);        // 10000
BigO.logarithmic(1024);    // 10 (halve 1024 → 1 in 10 steps)
```

### Run the benchmark

```ts
import { benchmark } from "@/algorithms/big-o";

// Default sizes: [100, 1_000, 10_000, 50_000]; exponential uses [8, 10, 12, 14]
benchmark();

// Custom sizes (e.g. for demos or CI)
const results = benchmark([500, 5_000, 20_000]);
// results: { name, complexity, n, ms, result }[]
```

The benchmark logs a table to the console with timings (ms) per complexity and size. Exponential is run separately with small n to avoid freezing.

---

## When to use

- **Learning:** See how each complexity class scales in practice.
- **Teaching:** Show a live timing table in talks or workshops.
- **Sanity checks:** Verify that quadratic really blows up vs linear as n grows.
- **Tests:** The benchmark returns structured results for assertions (e.g. linear time &lt; quadratic for the same n).

---

## When not to use

- **Production performance:** These are synthetic workloads; real code has I/O, allocations, and different cache behavior.
- **Large n for exponential:** Keep n small (single digits to low teens) or the process will hang.

---

## Tests

From repo root:

```bash
npm test -- src/algorithms/big-o.test.ts
```

---

## See also

- [Main README](../README.md#documentation) — documentation index and links to all algorithm docs
- Module README: [src/algorithms/README.md](../src/algorithms/README.md)
- [docs/sorting-algorithms.md](sorting-algorithms.md) for O(n log n) sorting and complexity notes.
