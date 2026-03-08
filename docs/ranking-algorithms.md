<p align="center">
  <img src="../asset.png" alt="API Patterns Sandbox" width="640" />
</p>

# Ranking algorithms — When to use, when not to, and examples

**Module:** [src/algorithms](../src/algorithms/README.md)

This doc covers each ranking algorithm in `src/algorithms`: what it does, when to use it, when to avoid it, and minimal code examples.

---

## How they differ: TF-IDF vs BM25 vs cosine vs the rest

| Aspect | TF-IDF | BM25 | Cosine similarity |
|--------|--------|------|-------------------|
| **Core idea** | Score = how often the term appears × how rare it is in the corpus. | Like TF-IDF but with **term saturation** and **length normalization**. | Score = angle between query and document vectors (direction, not magnitude). |
| **Term frequency** | Grows with count (or log/sublinear if configured). Repeated terms keep increasing score. | **Saturates**: extra occurrences add less and less. Tuned by `k1`. | Uses TF-IDF-style term weights in vectors; then compares direction only. |
| **Document length** | **No** length normalization. Long documents can get higher scores just by having more words. | **Yes.** Long docs are penalized relative to average length; tuned by `b`. | **Implicit**: vectors are often normalized, so length affects which terms appear, not raw magnitude. |
| **Output** | One score per document (sum over query terms). | One score per document (sum over query terms). | Similarity in [0, 1]; “how similar” not “how many matches.” |
| **Best for** | Simple relevance, keyword importance, small/medium corpora. | **Default for search**: variable-length docs, production relevance. | Similarity, clustering, “documents like this one,” recommendations. |

**In short:**

- **TF-IDF vs BM25:** BM25 is the modern upgrade: it caps how much one term can dominate (saturation) and corrects for document length, so long documents don’t get an unfair boost. Prefer BM25 for search unless you need maximum simplicity.
- **TF-IDF/BM25 vs cosine:** TF-IDF and BM25 rank by “relevance to the query” (term counts and rarity). Cosine measures “how similar is this document to the query?” (angle between vectors). Use TF-IDF/BM25 for search ranking; use cosine for similarity, clustering, or “more like this.”
- **Custom, phrase, field-weighted:** These build on top of BM25 (or TF-IDF) to add multiple signals (title, recency, popularity), exact-phrase boost, or per-field weights. Use them when you need more than plain text relevance.

---

## TF-IDF (Term Frequency–Inverse Document Frequency)

**Method:** `RankingAlgorithms.calculateTFIDF(documents, query, config?)`

### What it does

Scores documents by combining **term frequency** (how often the term appears in the document) with **inverse document frequency** (how rare the term is across the corpus). Formula: `TF(t,d) × IDF(t)` with `IDF(t) = log(N / df(t))`.

### When to use

- Document ranking by keyword relevance.
- Keyword extraction and term importance.
- Small to medium corpora where you want a simple, interpretable score.
- When you need configurable TF/IDF behavior (log normalization, sublinear scaling, smoothed IDF).

### When not to use

- Very long documents or heavy term repetition: TF can dominate; prefer BM25 (saturation).
- When you need length normalization: TF-IDF does not normalize by document length.
- For “similarity” between two texts (angle): use cosine similarity instead.
- For production search with best relevance: prefer BM25 unless you have a reason to stay with TF-IDF.

### Example

```ts
import { RankingAlgorithms } from "@/algorithms/ranking-algorithms";
import type { SearchableItem, TFIDFConfig } from "@/api/search-algorithms/src/types";

const documents: SearchableItem[] = [
  { id: "1", title: "Intro to TypeScript", content: "TypeScript is a typed superset of JavaScript...", tags: ["typescript"] },
  { id: "2", title: "JavaScript Basics", content: "JavaScript enables interactive web pages...", tags: ["javascript"] },
];

const config: TFIDFConfig = {
  useLogNormalization: true,
  useSublinearScaling: false,
  smoothIdf: true,
};

const results = RankingAlgorithms.calculateTFIDF(documents, "TypeScript", config);
// results: [{ item, score, termScores }, ...] sorted by score descending
```

---

## BM25 (Best Matching 25)

**Method:** `RankingAlgorithms.calculateBM25(documents, query, config?)`

### What it does

Improves on TF-IDF with **term frequency saturation** (repeated terms don’t grow score linearly) and **length normalization** (long documents don’t get an unfair boost). Parameters: `k1` (saturation), `b` (length normalization), optional `avgDocLength`.

### When to use

- Default choice for text search relevance (document or product search).
- When document lengths vary a lot and you want to avoid favoring long docs.
- When you want better behavior than TF-IDF with minimal extra complexity.
- Modern search engines and internal search features.

### When not to use

- Very small corpora and you need maximum simplicity: TF-IDF can be enough.
- When you only need “how similar is doc A to doc B?”: use cosine similarity.
- When you need to combine many non-text signals (recency, popularity, title): use custom scoring and use BM25 as one component.

### Example

```ts
import { RankingAlgorithms } from "@/algorithms/ranking-algorithms";
import type { SearchableItem, BM25Config } from "@/api/search-algorithms/src/types";

const documents: SearchableItem[] = [/* ... */];

const config: BM25Config = { k1: 1.2, b: 0.75 };
const results = RankingAlgorithms.calculateBM25(documents, "TypeScript programming", config);
// results: [{ item, score, termScores }, ...] sorted by score descending
```

---

## Cosine Similarity (with TF-IDF vectors)

**Method:** `RankingAlgorithms.calculateCosineSimilarity(documents, query)`

### What it does

Builds TF-IDF vectors for the query and each document, then scores by the **cosine of the angle** between query and document vectors (ignores magnitude, focuses on direction). Good for “how similar is this document to the query?” rather than “how many times do terms appear?”

### When to use

- Document similarity (e.g. “find documents similar to this one”).
- Clustering or grouping similar documents.
- Recommendation-style “similar items” when you represent items as text.
- When you care about term distribution, not raw counts.

### When not to use

- Primary ranking for a search box: BM25 or custom score usually perform better for that.
- When you need explainability per term: TF-IDF/BM25 expose term scores; cosine gives a single similarity value.
- Very small vocabularies or very short texts: vectors can be sparse and noisy.

### Example

```ts
import { RankingAlgorithms } from "@/algorithms/ranking-algorithms";
import type { SearchableItem } from "@/api/search-algorithms/src/types";

const documents: SearchableItem[] = [/* ... */];

const results = RankingAlgorithms.calculateCosineSimilarity(documents, "typed JavaScript");
// results: [{ item, score }, ...] with score in [0, 1]; higher = more similar
```

---

## Custom scoring (multi-signal)

**Method:** `RankingAlgorithms.customScore(documents, query, weights?)`

### What it does

Combines several signals into one score: **text relevance** (BM25), **title boost**, **recency boost**, and **popularity boost**. You set weights for each; the implementation normalizes and combines them. Supports optional `createdAt` and `metadata` (e.g. views, likes) on items.

### When to use

- Product or content search where title matches, recency, or popularity matter.
- When you have metadata (publish date, views, likes) and want them in ranking.
- When you need a single tunable ranking that’s better than “BM25 only”.

### When not to use

- Pure text relevance with no extra signals: use BM25 alone.
- When you don’t have recency/popularity data: those components will be zero or constant; you can still use it with title boost only.
- When you need completely custom signals: you may need to extend this or build your own combiner using BM25 + your scores.

### Example

```ts
import { RankingAlgorithms } from "@/algorithms/ranking-algorithms";
import type { SearchableItem } from "@/api/search-algorithms/src/types";

const documents: SearchableItem[] = [
  {
    id: "1",
    title: "TypeScript Guide",
    content: "...",
    metadata: { views: 1000, likes: 50 },
    createdAt: new Date("2024-01-15"),
  },
  // ...
];

const results = RankingAlgorithms.customScore(documents, "TypeScript", {
  textRelevance: 0.7,
  titleBoost: 0.2,
  recencyBoost: 0.05,
  popularityBoost: 0.05,
});
// results: [{ item, score, components }, ...]; components break down each signal
```

---

## Phrase scoring

**Method:** `RankingAlgorithms.phraseScore(documents, query, phraseBoost?)`

### What it does

Uses BM25 as the base score, then **multiplies** the score by `phraseBoost` (default 2.0) when the document contains the **exact query string** (case-insensitive). So exact phrase matches rank above documents that only contain the terms separately.

### When to use

- Queries that are phrases (e.g. “machine learning”, “user authentication”).
- When exact phrase match should be strongly preferred over bag-of-words match.
- When you want a simple boost on top of BM25 without building a full phrase index.

### When not to use

- Single-word queries: phrase vs non-phrase is irrelevant; use BM25 (or custom) only.
- When the “phrase” must respect word boundaries or proximity: this checks substring containment; for true phrase/proximity you’d need a different implementation.
- When you need multiple phrase boosts with different weights: this is one global phrase boost.

### Example

```ts
import { RankingAlgorithms } from "@/algorithms/ranking-algorithms";
import type { SearchableItem } from "@/api/search-algorithms/src/types";

const documents: SearchableItem[] = [/* ... */];

const results = RankingAlgorithms.phraseScore(documents, "machine learning", 2.0);
// results: [{ item, score, hasPhrase }, ...]; hasPhrase true when exact phrase appears
```

---

## Field-weighted scoring

**Method:** `RankingAlgorithms.fieldWeightedScore(documents, query, fieldWeights?)`

### What it does

Scores **each field** (title, description, content, tags) separately and combines them with configurable weights. Default weights favor title and description over content. Good when “match in title” should count more than “match in body”.

### When to use

- Documents with clear fields (title, description, body, tags) and you want title/description to matter more.
- Product or article search where title and summary are more important than full text.
- When you want to tune importance per field without writing custom logic.

### When not to use

- Flat or single-field text: use BM25 or TF-IDF on that single field.
- When you need recency/popularity or phrase logic: use custom score or phrase score (or combine with field-weighted in your own layer).
- When your schema doesn’t match the expected fields (title, description, content, tags): you’d need to map your fields or extend the implementation.

### Example

```ts
import { RankingAlgorithms } from "@/algorithms/ranking-algorithms";
import type { SearchableItem } from "@/api/search-algorithms/src/types";

const documents: SearchableItem[] = [/* ... */];

const results = RankingAlgorithms.fieldWeightedScore(documents, "TypeScript", {
  title: 3.0,
  description: 2.0,
  content: 1.0,
  tags: 1.5,
});
// results: [{ item, score, fieldScores }, ...]; fieldScores per field
```

---

## Quick reference

| Algorithm           | Use for                                      | Avoid for                          |
|--------------------|-----------------------------------------------|------------------------------------|
| **TF-IDF**         | Simple relevance, keyword importance          | Long docs; need length norm        |
| **BM25**           | Default search ranking, variable doc length   | Pure similarity; multi-signal UI   |
| **Cosine**         | Similarity, clustering, “like this”           | Primary search ranking             |
| **Custom**         | Relevance + title + recency + popularity      | Text-only relevance                |
| **Phrase**         | Exact phrase boost on top of BM25            | Single-word or proximity phrases   |
| **Field-weighted** | Title/description more important than body   | Single field; need other signals   |

## See also

- [Main README](../README.md#documentation) — documentation index and links to all algorithm docs
- Module README: [src/algorithms/README.md](../src/algorithms/README.md)
- [docs/search-algorithms.md](search-algorithms.md) for matching and indexing (exact, fuzzy, BM25 in the API).
- [docs/autocomplete.md](autocomplete.md) for search UX and suggestions.
