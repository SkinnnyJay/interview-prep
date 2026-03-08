# Search algorithms

String matching, phonetic, n-gram, and ranking algorithms implemented for study
and reuse. Part of the [API Patterns Sandbox](../../../README.md).

## Quick start

From repo root:

```bash
npm run search-algorithms:dev    # Port 3033
npm run search-algorithms:test
```

## Algorithm families

| Family       | Examples                           | Pros              | Cons               |
| ------------ | ---------------------------------- | ----------------- | ------------------ |
| **String**   | Exact, prefix, fuzzy, wildcard     | Flexible, tunable | Fuzzy cost/tuning  |
| **Phonetic** | Soundex, Metaphone, NYSIIS         | “Sounds like”     | Language-dependent |
| **N-gram**   | Character n-grams, Jaccard, cosine | Similarity        | Memory/CPU         |
| **Ranking**  | TF-IDF, BM25, custom               | Relevance         | More complexity    |

**When:** Exact/prefix for IDs and autocomplete; fuzzy for user query; phonetic
for names; BM25 for document ranking.

## Endpoints

- `POST /search` — Main search (query, algorithm, options)
- `GET /algorithms`, `POST /compare`, `GET /demo/:algorithm`
- `GET /metrics`, `GET /data`, `GET /health`

## Project structure

```text
src/
├── types.ts
├── algorithms/
│   ├── string-matching.ts
│   ├── phonetic-matching.ts
│   ├── ngram-matching.ts
│   └── ranking-algorithms.ts
├── search-engine.ts
└── server.ts
```
