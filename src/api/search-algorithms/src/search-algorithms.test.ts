/**
 * Comprehensive Tests for Search Algorithms
 *
 * These tests validate all the search algorithms implemented from scratch,
 * ensuring they work correctly and perform as expected.
 */

import { StringMatcher } from "./algorithms/string-matching";
import { PhoneticMatcher } from "./algorithms/phonetic-matching";
import { NGramMatcher } from "./algorithms/ngram-matching";
import { RankingAlgorithms } from "./algorithms/ranking-algorithms";
import { SearchEngine } from "./search-engine";
import { SearchableItem, SearchRequest } from "./types";

// Test data
const testItems: SearchableItem[] = [
  {
    id: "1",
    title: "JavaScript Programming",
    description: "Learn JavaScript programming from basics to advanced",
    content: "JavaScript is a versatile programming language",
    tags: ["javascript", "programming", "web"],
    category: "Programming",
  },
  {
    id: "2",
    title: "TypeScript Guide",
    description: "Complete TypeScript guide for developers",
    content: "TypeScript adds static typing to JavaScript",
    tags: ["typescript", "javascript", "types"],
    category: "Programming",
  },
  {
    id: "3",
    title: "React Components",
    description: "Building React components and patterns",
    content: "React is a library for building user interfaces",
    tags: ["react", "components", "frontend"],
    category: "Frontend",
  },
];

describe("StringMatcher", () => {
  describe("exactMatch", () => {
    it("should find exact matches", () => {
      const matches = StringMatcher.exactMatch("JavaScript Programming", "JavaScript");
      expect(matches).toHaveLength(1);
      expect(matches[0].value).toBe("JavaScript");
      expect(matches[0].startIndex).toBe(0);
      expect(matches[0].matchType).toBe("exact");
    });

    it("should handle case sensitivity", () => {
      const caseSensitive = StringMatcher.exactMatch("JavaScript", "javascript", true);
      const caseInsensitive = StringMatcher.exactMatch("JavaScript", "javascript", false);

      expect(caseSensitive).toHaveLength(0);
      expect(caseInsensitive).toHaveLength(1);
    });

    it("should find multiple matches", () => {
      const matches = StringMatcher.exactMatch("test test test", "test");
      expect(matches).toHaveLength(3);
    });
  });

  describe("prefixMatch", () => {
    it("should match prefixes", () => {
      const matches = StringMatcher.prefixMatch("JavaScript", "Java");
      expect(matches).toHaveLength(1);
      expect(matches[0].value).toBe("Java");
    });

    it("should not match non-prefixes", () => {
      const matches = StringMatcher.prefixMatch("JavaScript", "Script");
      expect(matches).toHaveLength(0);
    });
  });

  describe("suffixMatch", () => {
    it("should match suffixes", () => {
      const matches = StringMatcher.suffixMatch("JavaScript", "Script");
      expect(matches).toHaveLength(1);
      expect(matches[0].value).toBe("Script");
    });

    it("should not match non-suffixes", () => {
      const matches = StringMatcher.suffixMatch("JavaScript", "Java");
      expect(matches).toHaveLength(0);
    });
  });

  describe("fuzzyMatch", () => {
    it("should handle typos", () => {
      const result = StringMatcher.fuzzyMatch("JavaScript", "Javscript", {
        maxDistance: 2,
        insertCost: 1,
        deleteCost: 1,
        substituteCost: 1,
        transpositionCost: 1,
      });

      expect(result.distance).toBeLessThanOrEqual(2);
      expect(result.matches).toHaveLength(1);
    });

    it("should reject strings too different", () => {
      const result = StringMatcher.fuzzyMatch("JavaScript", "Python", {
        maxDistance: 2,
        insertCost: 1,
        deleteCost: 1,
        substituteCost: 1,
        transpositionCost: 1,
      });

      expect(result.matches).toHaveLength(0);
    });
  });

  describe("levenshteinDistance", () => {
    it("should calculate correct edit distance", () => {
      const distance = StringMatcher.levenshteinDistance("kitten", "sitting", {
        maxDistance: 10,
        insertCost: 1,
        deleteCost: 1,
        substituteCost: 1,
        transpositionCost: 1,
      });

      expect(distance).toBe(3); // k->s, e->i, insert g
    });

    it("should handle identical strings", () => {
      const distance = StringMatcher.levenshteinDistance("test", "test", {
        maxDistance: 10,
        insertCost: 1,
        deleteCost: 1,
        substituteCost: 1,
        transpositionCost: 1,
      });

      expect(distance).toBe(0);
    });
  });

  describe("wildcardMatch", () => {
    it("should match wildcard patterns", () => {
      expect(StringMatcher.wildcardMatch("JavaScript", "Java*")).toBe(true);
      expect(StringMatcher.wildcardMatch("JavaScript", "*Script")).toBe(true);
      expect(StringMatcher.wildcardMatch("JavaScript", "Java?cript")).toBe(true);
      expect(StringMatcher.wildcardMatch("JavaScript", "Java*Script")).toBe(true);
    });

    it("should handle complex patterns", () => {
      expect(StringMatcher.wildcardMatch("test.js", "*.js")).toBe(true);
      expect(StringMatcher.wildcardMatch("test.ts", "*.js")).toBe(false);
      expect(StringMatcher.wildcardMatch("a", "?")).toBe(true);
      expect(StringMatcher.wildcardMatch("ab", "?")).toBe(false);
    });
  });

  describe("calculateSimilarity", () => {
    it("should calculate similarity scores", () => {
      const similarity1 = StringMatcher.calculateSimilarity(
        "JavaScript",
        "JavaScript",
        "levenshtein"
      );
      const similarity2 = StringMatcher.calculateSimilarity(
        "JavaScript",
        "Javscript",
        "levenshtein"
      );
      const similarity3 = StringMatcher.calculateSimilarity("JavaScript", "Python", "levenshtein");

      expect(similarity1).toBeCloseTo(1.0, 10);
      expect(similarity2).toBeGreaterThanOrEqual(0.8);
      expect(similarity3).toBeLessThan(0.5);
    });

    it("should work with different algorithms", () => {
      const levenshtein = StringMatcher.calculateSimilarity("test", "test", "levenshtein");
      const jaroWinkler = StringMatcher.calculateSimilarity("test", "test", "jaro-winkler");
      const lcs = StringMatcher.calculateSimilarity("test", "test", "lcs");

      expect(levenshtein).toBe(1.0);
      expect(jaroWinkler).toBe(1.0);
      expect(lcs).toBe(1.0);
    });
  });
});

describe("PhoneticMatcher", () => {
  describe("soundex", () => {
    it("should generate correct Soundex codes", () => {
      expect(PhoneticMatcher.soundex("Smith")).toBe("S530");
      expect(PhoneticMatcher.soundex("Smyth")).toBe("S530");
      expect(PhoneticMatcher.soundex("Johnson")).toBe("J525");
      expect(PhoneticMatcher.soundex("")).toBe("0000");
    });

    it("should handle similar sounding names", () => {
      const code1 = PhoneticMatcher.soundex("Jackson");
      const code2 = PhoneticMatcher.soundex("Jakson");
      expect(code1).toBe(code2);
    });
  });

  describe("metaphone", () => {
    it("should generate Metaphone codes", () => {
      const code1 = PhoneticMatcher.metaphone("Smith");
      const code2 = PhoneticMatcher.metaphone("Smyth");
      expect(code1).toBe(code2);
      expect(code1).toBeTruthy();
    });

    it("should handle complex words", () => {
      const code = PhoneticMatcher.metaphone("JavaScript");
      expect(code).toBeTruthy();
      expect(typeof code).toBe("string");
    });
  });

  describe("nysiis", () => {
    it("should generate NYSIIS codes", () => {
      const code1 = PhoneticMatcher.nysiis("Smith");
      const code2 = PhoneticMatcher.nysiis("Smyth");
      expect(code1).toBe(code2);
      expect(code1.length).toBeLessThanOrEqual(6);
    });

    it("should limit code length", () => {
      const code = PhoneticMatcher.nysiis("VeryLongNameThatShouldBeTruncated");
      expect(code.length).toBeLessThanOrEqual(6);
    });
  });

  describe("phoneticMatch", () => {
    it("should match phonetically similar words", () => {
      const result = PhoneticMatcher.phoneticMatch("Smith", "Smyth", "soundex");
      expect(result.matches).toBe(true);
      expect(result.codes.text).toBe(result.codes.query);
    });

    it("should not match phonetically different words", () => {
      const result = PhoneticMatcher.phoneticMatch("Smith", "Johnson", "soundex");
      expect(result.matches).toBe(false);
    });
  });

  describe("phoneticSimilarity", () => {
    it("should calculate phonetic similarity", () => {
      const similarity1 = PhoneticMatcher.phoneticSimilarity("Smith", "Smyth", "soundex");
      const similarity2 = PhoneticMatcher.phoneticSimilarity("Smith", "Johnson", "soundex");

      expect(similarity1).toBeCloseTo(1.0, 10);
      expect(similarity2).toBeLessThan(1.0);
    });
  });
});

describe("NGramMatcher", () => {
  describe("generateCharacterNGrams", () => {
    it("should generate bigrams", () => {
      const bigrams = NGramMatcher.generateCharacterNGrams("test", 2);
      expect(bigrams).toContain("te");
      expect(bigrams).toContain("es");
      expect(bigrams).toContain("st");
    });

    it("should handle padding", () => {
      const withPadding = NGramMatcher.generateCharacterNGrams("ab", 2, true);
      const withoutPadding = NGramMatcher.generateCharacterNGrams("ab", 2, false);

      expect(withPadding.length).toBeGreaterThan(withoutPadding.length);
    });

    it("should generate trigrams", () => {
      const trigrams = NGramMatcher.generateCharacterNGrams("test", 3);
      expect(trigrams).toContain("tes");
      expect(trigrams).toContain("est");
    });
  });

  describe("generateWordNGrams", () => {
    it("should generate word bigrams", () => {
      const bigrams = NGramMatcher.generateWordNGrams("hello world test", 2);
      expect(bigrams).toContain("hello world");
      expect(bigrams).toContain("world test");
    });

    it("should handle insufficient words", () => {
      const bigrams = NGramMatcher.generateWordNGrams("hello", 2);
      expect(bigrams).toHaveLength(0);
    });
  });

  describe("jaccardSimilarity", () => {
    it("should calculate Jaccard similarity", () => {
      const similarity1 = NGramMatcher.jaccardSimilarity("test", "test", 2);
      const similarity2 = NGramMatcher.jaccardSimilarity("test", "best", 2);
      const similarity3 = NGramMatcher.jaccardSimilarity("test", "xyz", 2);

      expect(similarity1).toBeCloseTo(1.0, 10);
      expect(similarity2).toBeGreaterThan(0);
      expect(similarity2).toBeLessThan(1.0);
      expect(similarity3).toBeLessThan(similarity2);
    });

    it("should handle identical strings", () => {
      const similarity = NGramMatcher.jaccardSimilarity("identical", "identical", 2);
      expect(similarity).toBe(1.0);
    });
  });

  describe("cosineSimilarity", () => {
    it("should calculate cosine similarity", () => {
      const similarity1 = NGramMatcher.cosineSimilarity("test", "test", 2);
      const similarity2 = NGramMatcher.cosineSimilarity("test", "best", 2);

      expect(similarity1).toBeCloseTo(1.0, 10);
      expect(similarity2).toBeGreaterThan(0);
      expect(similarity2).toBeLessThan(1.0);
    });
  });

  describe("diceCoefficient", () => {
    it("should calculate Dice coefficient", () => {
      const dice1 = NGramMatcher.diceCoefficient("test", "test", 2);
      const dice2 = NGramMatcher.diceCoefficient("test", "best", 2);

      expect(dice1).toBe(1.0);
      expect(dice2).toBeGreaterThan(0);
      expect(dice2).toBeLessThan(1.0);
    });
  });

  describe("ngramFuzzyMatch", () => {
    it("should perform n-gram fuzzy matching", () => {
      const result1 = NGramMatcher.ngramFuzzyMatch("JavaScript", "JavaScript", 0.5, 2);
      const result2 = NGramMatcher.ngramFuzzyMatch("JavaScript", "Javscript", 0.5, 2);
      const result3 = NGramMatcher.ngramFuzzyMatch("JavaScript", "Python", 0.5, 2);

      expect(result1.matches).toBe(true);
      expect(result1.score).toBe(1.0);
      expect(result2.matches).toBe(true);
      expect(result2.score).toBeGreaterThan(0.5);
      expect(result3.matches).toBe(false);
    });
  });
});

describe("RankingAlgorithms", () => {
  describe("calculateTFIDF", () => {
    it("should calculate TF-IDF scores", () => {
      const results = RankingAlgorithms.calculateTFIDF(testItems, "JavaScript");

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].score).toBeGreaterThan(0);
      expect(results[0].termScores).toHaveProperty("javascript");
    });

    it("should rank relevant documents higher", () => {
      const results = RankingAlgorithms.calculateTFIDF(testItems, "JavaScript programming");

      // Document with "JavaScript Programming" in title should rank highest
      expect(results[0].item.id).toBe("1");
      expect(results[0].score).toBeGreaterThan(results[1]?.score || 0);
    });
  });

  describe("calculateBM25", () => {
    it("should calculate BM25 scores", () => {
      const results = RankingAlgorithms.calculateBM25(testItems, "JavaScript");

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].score).toBeGreaterThan(0);
      expect(results[0].termScores).toHaveProperty("javascript");
    });

    it("should handle different k1 and b parameters", () => {
      const results1 = RankingAlgorithms.calculateBM25(testItems, "JavaScript", {
        k1: 1.2,
        b: 0.75,
      });
      const results2 = RankingAlgorithms.calculateBM25(testItems, "JavaScript", {
        k1: 2.0,
        b: 0.5,
      });

      expect(results1.length).toBeGreaterThan(0);
      expect(results2.length).toBeGreaterThan(0);
      // Scores should be different with different parameters
      expect(results1[0].score).not.toBe(results2[0].score);
    });
  });

  describe("calculateCosineSimilarity", () => {
    it("should calculate cosine similarity", () => {
      const results = RankingAlgorithms.calculateCosineSimilarity(
        testItems,
        "JavaScript programming"
      );

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].score).toBeGreaterThan(0);
      expect(results[0].score).toBeLessThanOrEqual(1.0);
    });
  });
});

describe("SearchEngine", () => {
  let searchEngine: SearchEngine;

  beforeEach(() => {
    searchEngine = new SearchEngine(testItems);
  });

  describe("initialization", () => {
    it("should initialize with items", () => {
      const metrics = searchEngine.getMetrics();
      expect(metrics.indexSize).toBe(testItems.length);
    });

    it("should handle empty initialization", () => {
      const emptyEngine = new SearchEngine();
      const metrics = emptyEngine.getMetrics();
      expect(metrics.indexSize).toBe(0);
    });
  });

  describe("search methods", () => {
    it("should perform exact search", async () => {
      const request: SearchRequest = {
        query: "JavaScript",
        options: {
          algorithm: "exact",
          fields: ["title", "description", "content"],
        },
      };

      const response = await searchEngine.search(request);

      expect(response.results.length).toBeGreaterThan(0);
      expect(response.algorithm).toBe("exact");
      expect(response.executionTime).toBeGreaterThanOrEqual(0);
    });

    it("should perform fuzzy search", async () => {
      const request: SearchRequest = {
        query: "Javscript", // Typo
        options: {
          algorithm: "fuzzy",
          fuzzyThreshold: 0.7,
        },
      };

      const response = await searchEngine.search(request);

      expect(response.results.length).toBeGreaterThan(0);
      expect(response.algorithm).toBe("fuzzy");
    });

    it("should perform phonetic search", async () => {
      const request: SearchRequest = {
        query: "Smith",
        options: {
          algorithm: "phonetic",
          phoneticThreshold: 0.8,
        },
      };

      const response = await searchEngine.search(request);
      expect(response.algorithm).toBe("phonetic");
    });

    it("should perform BM25 search", async () => {
      const request: SearchRequest = {
        query: "JavaScript programming",
        options: {
          algorithm: "bm25",
        },
      };

      const response = await searchEngine.search(request);

      expect(response.results.length).toBeGreaterThan(0);
      expect(response.algorithm).toBe("bm25");
    });

    it("should perform compound search", async () => {
      const request: SearchRequest = {
        query: "JavaScript",
        options: {
          algorithm: "compound",
        },
      };

      const response = await searchEngine.search(request);

      expect(response.results.length).toBeGreaterThan(0);
      expect(response.algorithm).toBe("compound");
    });
  });

  describe("search options", () => {
    it("should respect maxResults option", async () => {
      const request: SearchRequest = {
        query: "JavaScript",
        options: {
          algorithm: "contains",
          maxResults: 1,
        },
      };

      const response = await searchEngine.search(request);
      expect(response.results.length).toBeLessThanOrEqual(1);
    });

    it("should respect minScore option", async () => {
      const request: SearchRequest = {
        query: "JavaScript",
        options: {
          algorithm: "fuzzy",
          minScore: 0.9,
        },
      };

      const response = await searchEngine.search(request);

      for (const result of response.results) {
        expect(result.score).toBeGreaterThanOrEqual(0.9);
      }
    });

    it("should highlight matches when requested", async () => {
      const request: SearchRequest = {
        query: "JavaScript",
        options: {
          algorithm: "exact",
          highlightMatches: true,
        },
      };

      const response = await searchEngine.search(request);

      if (response.results.length > 0) {
        expect(response.results[0].highlightedFields).toBeDefined();
      }
    });
  });

  describe("filters", () => {
    it("should apply filters", async () => {
      const request: SearchRequest = {
        query: "JavaScript",
        options: {
          algorithm: "contains",
        },
        filters: [
          {
            field: "category",
            operator: "equals",
            value: "Programming",
          },
        ],
      };

      const response = await searchEngine.search(request);

      for (const result of response.results) {
        expect(result.item.category).toBe("Programming");
      }
    });
  });

  describe("item management", () => {
    it("should add items", () => {
      const newItem: SearchableItem = {
        id: "4",
        title: "Vue.js Guide",
        description: "Learn Vue.js framework",
        tags: ["vue", "javascript", "frontend"],
        category: "Frontend",
      };

      searchEngine.addItems([newItem]);
      const metrics = searchEngine.getMetrics();
      expect(metrics.indexSize).toBe(testItems.length + 1);
    });

    it("should remove items", () => {
      searchEngine.removeItems(["1"]);
      const metrics = searchEngine.getMetrics();
      expect(metrics.indexSize).toBe(testItems.length - 1);
    });

    it("should update items", () => {
      const updatedItem: SearchableItem = {
        ...testItems[0],
        title: "Updated JavaScript Guide",
      };

      searchEngine.updateItems([updatedItem]);
      const metrics = searchEngine.getMetrics();
      expect(metrics.indexSize).toBe(testItems.length);
    });
  });

  describe("analytics", () => {
    it("should track search analytics", async () => {
      const request: SearchRequest = {
        query: "JavaScript",
        options: { algorithm: "exact" },
      };

      await searchEngine.search(request);

      const metrics = searchEngine.getMetrics();
      expect(metrics.totalSearches).toBe(1);
      expect(metrics.algorithmUsage.exact).toBe(1);
    });

    it("should track popular queries", async () => {
      const request: SearchRequest = {
        query: "JavaScript",
        options: { algorithm: "exact" },
      };

      await searchEngine.search(request);
      await searchEngine.search(request);

      const metrics = searchEngine.getMetrics();
      expect(metrics.popularQueries.length).toBeGreaterThan(0);
      expect(metrics.popularQueries[0].query).toBe("javascript");
      expect(metrics.popularQueries[0].count).toBe(2);
    });

    it("should provide recent analytics", async () => {
      const request: SearchRequest = {
        query: "test",
        options: { algorithm: "exact" },
      };

      await searchEngine.search(request);

      const analytics = searchEngine.getAnalytics(10);
      expect(analytics.length).toBe(1);
      expect(analytics[0].query).toBe("test");
    });

    it("should clear analytics", async () => {
      const request: SearchRequest = {
        query: "test",
        options: { algorithm: "exact" },
      };

      await searchEngine.search(request);
      searchEngine.clearAnalytics();

      const metrics = searchEngine.getMetrics();
      expect(metrics.totalSearches).toBe(0);
    });
  });

  describe("error handling", () => {
    it("should handle empty queries", async () => {
      const request: SearchRequest = {
        query: "",
        options: { algorithm: "exact" },
      };

      const response = await searchEngine.search(request);
      expect(response.results).toHaveLength(0);
    });

    it("should handle invalid regex patterns", async () => {
      const request: SearchRequest = {
        query: "[invalid regex",
        options: { algorithm: "regex" },
      };

      const response = await searchEngine.search(request);
      expect(response.results).toHaveLength(0);
    });
  });
});

describe("Integration Tests", () => {
  let searchEngine: SearchEngine;

  beforeEach(() => {
    searchEngine = new SearchEngine(testItems);
  });

  describe("algorithm comparison", () => {
    it("should produce different results for different algorithms", async () => {
      const query = "JavaScript";

      const exactResults = await searchEngine.search({
        query,
        options: { algorithm: "exact" },
      });

      const fuzzyResults = await searchEngine.search({
        query: "Javscript", // Typo
        options: { algorithm: "fuzzy" },
      });

      const bm25Results = await searchEngine.search({
        query,
        options: { algorithm: "bm25" },
      });

      // All should find results, but potentially different ones
      expect(exactResults.results.length).toBeGreaterThan(0);
      expect(fuzzyResults.results.length).toBeGreaterThan(0);
      expect(bm25Results.results.length).toBeGreaterThan(0);

      // Exact search should not find typo, but fuzzy should
      const exactTypoResults = await searchEngine.search({
        query: "Javscript",
        options: { algorithm: "exact" },
      });

      expect(exactTypoResults.results.length).toBe(0);
      expect(fuzzyResults.results.length).toBeGreaterThan(0);
    });
  });

  describe("performance characteristics", () => {
    it("should complete searches within reasonable time", async () => {
      const startTime = Date.now();

      await searchEngine.search({
        query: "JavaScript programming",
        options: { algorithm: "bm25" },
      });

      const executionTime = Date.now() - startTime;
      expect(executionTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it("should handle multiple concurrent searches", async () => {
      const searches = Array.from({ length: 10 }, (_, i) =>
        searchEngine.search({
          query: `query ${i}`,
          options: { algorithm: "contains" },
        })
      );

      const results = await Promise.all(searches);
      expect(results).toHaveLength(10);

      const metrics = searchEngine.getMetrics();
      expect(metrics.totalSearches).toBe(10);
    });
  });
});
