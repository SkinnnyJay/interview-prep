# Algorithms

This folder contains learning-oriented implementations of **ranking**,
**sorting**, and **Big-O complexity** demos in TypeScript.

---

## Testing and verification

**Run all algorithm tests** (from repo root):

```bash
npm run algorithms:test
```

Or run specific test files:

```bash
npx jest src/algorithms/big-o.test.ts src/algorithms/sorting-algorithms.test.ts src/algorithms/ranking-algorithms.test.ts
```

**Verify functionality** (exercises Big-O, Sorting, and Ranking outside Jest):

```bash
npm run algorithms:verify
```

Or directly:

```bash
npx tsx src/algorithms/run-verification.ts
```

The verification script runs complexity functions and benchmark, all six sort
algorithms with correctness checks, and all ranking methods (TF-IDF, BM25,
cosine similarity, custom score, phrase score, field-weighted) with sample
documents.

---

## Big-O complexity and benchmarks

Demonstrations of scaling behavior (O(1), O(log n), O(n), O(n log n), O(n²),
O(2^n)) with `performance.now()` benchmarks and concise console output.

### Complexity functions

| Complexity     | Function          | Description                        |
| -------------- | ----------------- | ---------------------------------- |
| **O(1)**       | `constant(n)`     | Single step                        |
| **O(log n)**   | `logarithmic(n)`  | Halve until done                   |
| **O(n)**       | `linear(n)`       | One loop over n                    |
| **O(n log n)** | `linearithmic(n)` | n × log n work                     |
| **O(n²)**      | `quadratic(n)`    | Nested loops                       |
| **O(2^n)**     | `exponential(n)`  | Recursive branching (small n only) |

### Usage and benchmark

```ts
import { BigO, benchmark } from "./big-o";

// Call any complexity function (returns a numeric result)
BigO.linear(10_000); // 10000
BigO.quadratic(100); // 10000

// Run benchmark: logs a table of timings (ms) for default sizes
benchmark(); // [100, 1_000, 10_000, 50_000]

// Custom sizes
const results = benchmark([500, 5_000, 20_000]);
// results: { name, complexity, n, ms, result }[]
```

Benchmark uses `perf_hooks.performance.now()` and prints a clean table to the
console. Run via tests or by importing and calling `benchmark()` in a script.

### Tests

From repo root: `npm run algorithms:test` (or run `src/algorithms/big-o.test.ts`
explicitly).

---

## Ranking Algorithms

Text ranking and scoring algorithms for search and information retrieval.
Implementations work with the shared `SearchableItem` type from the
search-algorithms API.

### Algorithms

| Algorithm             | Method                      | Best for                                                           |
| --------------------- | --------------------------- | ------------------------------------------------------------------ |
| **TF-IDF**            | `calculateTFIDF`            | Classic relevance, keyword extraction, small/medium corpora        |
| **BM25**              | `calculateBM25`             | Modern search ranking, term saturation, length normalization       |
| **Cosine Similarity** | `calculateCosineSimilarity` | Document similarity, clustering, recommendations                   |
| **Custom Score**      | `customScore`               | Multi-signal ranking (relevance + title + recency + popularity)    |
| **Phrase Score**      | `phraseScore`               | Boosting exact phrase matches                                      |
| **Field-weighted**    | `fieldWeightedScore`        | Different importance per field (title, description, content, tags) |

## Usage

```ts
import { RankingAlgorithms } from "./ranking-algorithms";
import type {
  SearchableItem,
  BM25Config,
} from "@/api/search-algorithms/src/types";

const documents: SearchableItem[] = [
  /* ... */
];
const query = "TypeScript programming";

// BM25 (recommended default for search)
const bm25 = RankingAlgorithms.calculateBM25(documents, query, {
  k1: 1.2,
  b: 0.75,
});

// Custom ranking with multiple signals
const custom = RankingAlgorithms.customScore(documents, query, {
  textRelevance: 0.7,
  titleBoost: 0.2,
  recencyBoost: 0.05,
  popularityBoost: 0.05,
});
```

## Tests

From repo root: `npm run algorithms:test` or see **Testing and verification** at
the top of this README.

### Documentation

See [docs/ranking-algorithms.md](../../docs/ranking-algorithms.md) for when to
use each algorithm, when to avoid them, and examples.

---

## Sorting Algorithms

Classic comparison-based sorting algorithms: bubble, insertion, selection,
merge, quick, and heap sort. Each returns a new sorted array (input is not
mutated).

### Algorithms

| Algorithm       | Method          | Time         | Notes                          |
| --------------- | --------------- | ------------ | ------------------------------ |
| **Bubble sort** | `bubbleSort`    | O(n²)        | Educational only               |
| **Insertion**   | `insertionSort` | O(n²)        | Good for small / nearly sorted |
| **Selection**   | `selectionSort` | O(n²)        | Minimal swaps                  |
| **Merge sort**  | `mergeSort`     | O(n log n)   | Stable, predictable            |
| **Quick sort**  | `quickSort`     | O(n log n)\* | Fast in practice               |
| **Heap sort**   | `heapSort`      | O(n log n)   | In-place, no bad worst case    |

\*Quick sort worst case O(n²) with last-element pivot.

### Usage

```ts
import { SortingAlgorithms } from "./sorting-algorithms";

const arr = [3, 1, 4, 1, 5];

SortingAlgorithms.mergeSort(arr); // [1, 1, 3, 4, 5]
SortingAlgorithms.quickSort(arr); // [1, 1, 3, 4, 5]
SortingAlgorithms.isSorted(arr); // false (arr unchanged)

// With custom comparator (e.g. descending)
SortingAlgorithms.mergeSort(arr, (a, b) => b - a); // [5, 4, 3, 1, 1]
```

### Test data

Optional dataset for correctness and performance:

- Generate: `node src/algorithms/generate-sorting-data.js`
- Writes `sorting-data.json` with keys: `tiny` (5), `small` (50), `medium`
  (200), `large` (2000), `huge` (10000).

### Tests

From repo root: `npm run algorithms:test`. Optional performance (logs timings
per algorithm on medium/large/huge):

```bash
RUN_SORTING_PERF=1 npx jest src/algorithms/sorting-algorithms.test.ts
```

### Documentation

See [docs/sorting-algorithms.md](../../docs/sorting-algorithms.md) for when to
use each sort and complexity notes.
