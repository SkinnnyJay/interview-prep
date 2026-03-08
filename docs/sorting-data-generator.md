# Sorting test data generator

**Module:** [src/algorithms](../src/algorithms/README.md) · **Script:** `src/algorithms/generate-sorting-data.js`

One-off script that generates deterministic test data for sorting correctness and optional performance tests.

---

## What it does

- Uses a **seeded RNG** (same seed every run) so data is reproducible.
- Writes **`src/algorithms/sorting-data.json`** with keys: `tiny`, `small`, `medium`, `large`, `huge`.
- Each key holds an array of random integers (0–9999) with the following sizes:

| Key     | Length |
|---------|--------|
| tiny    | 5      |
| small   | 50     |
| medium  | 200    |
| large   | 2_000  |
| huge    | 10_000 |

---

## How to run

From repo root:

```bash
node src/algorithms/generate-sorting-data.js
```

Output: `Wrote .../sorting-data.json tiny:5, small:50, medium:200, large:2000, huge:10000`

---

## When to use

- **Correctness tests:** Feed `tiny` / `small` (or any key) into sorting tests.
- **Performance tests:** Use `medium`, `large`, or `huge` when running timing tests (e.g. `RUN_SORTING_PERF=1 npm test -- src/algorithms/sorting-algorithms.test.ts`).

---

## See also

- [Main README](../README.md#documentation) — documentation index and links to all algorithm docs
- [docs/sorting-algorithms.md](sorting-algorithms.md) — sorting algorithms and when to use each
- [src/algorithms/README.md](../src/algorithms/README.md) — test commands and optional perf run
