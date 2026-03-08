<p align="center">
  <img src="../asset.png" alt="API Patterns Sandbox" width="640" />
</p>

# Search algorithms — Technical concept & lessons

**Project:** [search-algorithms](../src/api/search-algorithms/README.md)

## What it solves

Matching and ranking text: exact match, prefix, fuzzy (typos), phonetic (“sounds like”), n-gram similarity, and relevance (TF-IDF, BM25).

## Concepts

- **Exact / prefix:** Fast; no typo or similarity. Good for IDs and autocomplete.
- **Fuzzy (e.g. Levenshtein):** Edit distance; handles typos. Cost and threshold tuning.
- **Phonetic (Soundex, Metaphone):** Encode pronunciation; “Smith” ≈ “Smythe.” Language-dependent.
- **N-gram / similarity:** Overlapping character chunks; Jaccard or cosine. Good for “similar” strings.
- **Ranking:** TF-IDF (term weight); BM25 (saturation and length normalization). For “best” documents for a query.

## Lessons

1. **Match type by use case** — Exact for keys; prefix for autocomplete; fuzzy for free text; phonetic for names; BM25 for document search.
2. **Index when possible** — Don’t scan the whole set for every query. Build an index (inverted, trie, etc.) for the algorithm you use.
3. **Combine signals** — Production search often combines exact boost + fuzzy + recency + business rules. Start simple; add signals when needed.
4. **Language** — Phonetic and stemming are language-specific. Document and test for your locale.

## Pros & cons

| Family       | Pros                 | Cons                    |
|--------------|----------------------|-------------------------|
| Exact/prefix | Fast, simple         | No typo or similarity   |
| Fuzzy        | Typo-tolerant        | Cost and tuning         |
| Phonetic     | “Sounds like”        | Language-dependent      |
| BM25         | Good relevance       | More implementation     |

## When to use

- **Exact/prefix:** IDs, codes, autocomplete.
- **Fuzzy:** User-typed search.
- **Phonetic:** Names, genealogy.
- **BM25:** Document or product search with relevance ranking.

## See also

- Project README: [src/api/search-algorithms/README.md](../src/api/search-algorithms/README.md)
- [docs/autocomplete.md](autocomplete.md) for end-to-end search UX.
