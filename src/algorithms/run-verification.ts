/**
 * Runnable verification for src/algorithms: Big-O, Sorting, and Ranking.
 * Confirms that exported functions and functionality work as expected.
 *
 * Run from repo root:
 *   npx tsx src/algorithms/run-verification.ts
 *
 * Or after build:
 *   node dist/algorithms/run-verification.js
 */

import { BigO, benchmark } from "./big-o";
import { SortingAlgorithms } from "./sorting-algorithms";
import { RankingAlgorithms } from "./ranking-algorithms";
import type { SearchableItem } from "../api/search-algorithms/src/types";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function section(name: string): void {
  console.warn("\n" + "=".repeat(60));
  console.warn(name);
  console.warn("=".repeat(60));
}

// --- Big-O ---
section("Big-O complexity functions");
const n = 100;
assert(BigO.constant(n) === 1, "constant(n) === 1");
assert(BigO.logarithmic(8) === 3, "logarithmic(8) === 3");
assert(BigO.linear(n) === n, "linear(n) === n");
assert(BigO.quadratic(10) === 100, "quadratic(10) === 100");
assert(BigO.exponential(3) === 8, "exponential(3) === 8");
console.warn("  constant(100):", BigO.constant(100));
console.warn("  logarithmic(1024):", BigO.logarithmic(1024));
console.warn("  linear(1000):", BigO.linear(1000));
console.warn("  quadratic(50):", BigO.quadratic(50));
console.warn("  exponential(5):", BigO.exponential(5));
console.warn("  Big-O function results: OK");

section("Big-O benchmark (small sizes)");
const benchmarkResults = benchmark([100, 500, 1000]);
assert(benchmarkResults.length > 0, "benchmark returns results");
assert(
  benchmarkResults.every((r) => typeof r.ms === "number" && r.n > 0),
  "each result has ms and n"
);
console.warn("  Benchmark completed: OK");

// --- Sorting ---
section("Sorting algorithms");
const input = [3, 1, 4, 1, 5, 9, 2, 6];
const expected = [1, 1, 2, 3, 4, 5, 6, 9];

const sorts: Array<{ name: string; fn: (arr: number[]) => number[] }> = [
  { name: "bubbleSort", fn: (a) => SortingAlgorithms.bubbleSort(a) },
  { name: "insertionSort", fn: (a) => SortingAlgorithms.insertionSort(a) },
  { name: "selectionSort", fn: (a) => SortingAlgorithms.selectionSort(a) },
  { name: "mergeSort", fn: (a) => SortingAlgorithms.mergeSort(a) },
  { name: "quickSort", fn: (a) => SortingAlgorithms.quickSort(a) },
  { name: "heapSort", fn: (a) => SortingAlgorithms.heapSort(a) },
];

for (const { name, fn } of sorts) {
  const copy = input.slice();
  const result = fn(copy);
  assert(result !== copy, `${name}: returns new array`);
  assert(JSON.stringify(copy) === JSON.stringify(input), `${name}: does not mutate input`);
  assert(SortingAlgorithms.isSorted(result), `${name}: result is sorted`);
  assert(JSON.stringify(result) === JSON.stringify(expected), `${name}: result matches expected`);
  console.warn(`  ${name}: OK`);
}

const descending = SortingAlgorithms.mergeSort(input.slice(), (a, b) => b - a);
assert(descending[0] === 9 && descending[7] === 1, "custom comparator (descending)");
console.warn("  custom comparator: OK");

// --- Ranking ---
section("Ranking algorithms");
const documents: SearchableItem[] = [
  {
    id: "1",
    title: "TypeScript Guide",
    description: "Learn TypeScript",
    content: "TypeScript adds static types to JavaScript.",
    tags: ["typescript", "javascript"],
    metadata: { views: 100, likes: 10 },
  },
  {
    id: "2",
    title: "JavaScript Basics",
    description: "Introduction to JavaScript",
    content: "JavaScript is a programming language for the web.",
    tags: ["javascript", "web"],
    metadata: { views: 200, likes: 20 },
  },
  {
    id: "3",
    title: "React and TypeScript",
    description: "Build apps with React and TypeScript",
    content: "React with TypeScript for type-safe components.",
    tags: ["react", "typescript"],
    metadata: { views: 150, likes: 15 },
  },
];

const query = "TypeScript";

const tfidf = RankingAlgorithms.calculateTFIDF(documents, query);
assert(tfidf.length >= 1, "TF-IDF returns at least one result");
assert(tfidf[0].score > 0 && tfidf[0].termScores != null, "TF-IDF result shape");
console.warn("  calculateTFIDF:", tfidf.length, "results, top score:", tfidf[0]?.score?.toFixed(4));

const bm25 = RankingAlgorithms.calculateBM25(documents, query);
assert(bm25.length >= 1, "BM25 returns at least one result");
assert(bm25[0].score > 0, "BM25 positive score");
console.warn("  calculateBM25:", bm25.length, "results, top score:", bm25[0]?.score?.toFixed(4));

const cosine = RankingAlgorithms.calculateCosineSimilarity(documents, query);
assert(cosine.length >= 1, "Cosine similarity returns results");
assert(cosine[0].score >= 0 && cosine[0].score <= 1, "Cosine score in [0,1]");
console.warn(
  "  calculateCosineSimilarity:",
  cosine.length,
  "results, top score:",
  cosine[0]?.score?.toFixed(4)
);

const custom = RankingAlgorithms.customScore(documents, query);
assert(custom.length >= 1, "customScore returns results");
assert(
  (custom[0] as { components?: Record<string, number> }).components != null,
  "customScore has components"
);
console.warn("  customScore:", custom.length, "results");

const phrase = RankingAlgorithms.phraseScore(documents, query);
assert(phrase.length >= 1, "phraseScore returns results");
assert((phrase[0] as { hasPhrase?: boolean }).hasPhrase !== undefined, "phraseScore has hasPhrase");
console.warn("  phraseScore:", phrase.length, "results");

const fieldWeighted = RankingAlgorithms.fieldWeightedScore(documents, query);
assert(fieldWeighted.length >= 1, "fieldWeightedScore returns results");
assert(
  (fieldWeighted[0] as { fieldScores?: Record<string, number> }).fieldScores != null,
  "fieldWeightedScore has fieldScores"
);
console.warn("  fieldWeightedScore:", fieldWeighted.length, "results");

// Empty query edge case
const emptyTfidf = RankingAlgorithms.calculateTFIDF(documents, "");
assert(emptyTfidf.length === 0, "TF-IDF empty query returns []");
console.warn("  Ranking edge cases: OK");

section("Summary");
console.warn("  All algorithm modules verified: Big-O, Sorting, Ranking.");
console.warn(
  "  Run tests: npx jest src/algorithms/big-o.test.ts src/algorithms/sorting-algorithms.test.ts src/algorithms/ranking-algorithms.test.ts"
);
console.warn("");
