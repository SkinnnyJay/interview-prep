import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { RankingAlgorithms } from "./ranking-algorithms";
import { SearchableItem, BM25Config, TFIDFConfig } from "../api/search-algorithms/src/types";

// Mock data for testing
const createMockDocument = (
  id: string,
  title: string,
  content: string,
  options: Partial<SearchableItem> = {}
): SearchableItem => ({
  id,
  title,
  content,
  description: options.description,
  tags: options.tags,
  category: options.category,
  metadata: options.metadata,
  ...options,
});

// Test setup and cleanup
beforeEach(() => {
  // Clear any state if needed
});

afterEach(() => {
  // Clear any timers that might be running
  jest.clearAllTimers();

  // Clear all mocks
  jest.clearAllMocks();
});

describe("RankingAlgorithms", () => {
  // Sample documents for testing
  let documents: SearchableItem[];

  beforeEach(() => {
    documents = [
      createMockDocument(
        "1",
        "Introduction to TypeScript",
        "TypeScript is a typed superset of JavaScript that compiles to plain JavaScript. TypeScript adds optional types to JavaScript.",
        {
          description: "Learn TypeScript basics",
          tags: ["typescript", "javascript", "programming"],
          metadata: { views: 1000, likes: 50, shares: 10 },
        }
      ),
      createMockDocument(
        "2",
        "JavaScript Fundamentals",
        "JavaScript is a programming language that enables interactive web pages. It is an essential part of web applications.",
        {
          description: "Master JavaScript fundamentals",
          tags: ["javascript", "web", "programming"],
          metadata: { views: 800, likes: 40, shares: 5 },
        }
      ),
      createMockDocument(
        "3",
        "Python Programming",
        "Python is a high-level programming language known for its simplicity and readability. Python is used in web development.",
        {
          description: "Learn Python programming",
          tags: ["python", "programming"],
          metadata: { views: 500, likes: 25, shares: 3 },
        }
      ),
      createMockDocument(
        "4",
        "Advanced TypeScript Patterns",
        "Advanced patterns in TypeScript including generics, decorators, and type guards. TypeScript TypeScript TypeScript.",
        {
          description: "Master advanced TypeScript",
          tags: ["typescript", "advanced", "patterns"],
          metadata: { views: 300, likes: 15, shares: 2 },
        }
      ),
    ];
  });

  describe("calculateTFIDF", () => {
    describe("Happy Path", () => {
      it("should return ranked results for a valid query", () => {
        const results = RankingAlgorithms.calculateTFIDF(documents, "TypeScript");

        expect(results.length).toBeGreaterThan(0);
        expect(results[0].item.id).toBeDefined();
        expect(results[0].score).toBeGreaterThan(0);
        expect(results[0].termScores).toBeDefined();
      });

      it("should rank documents with more term occurrences higher", () => {
        const results = RankingAlgorithms.calculateTFIDF(documents, "TypeScript");

        // Document 4 has "TypeScript" repeated multiple times
        expect(results[0].item.title).toContain("TypeScript");
        expect(results[0].score).toBeGreaterThan(results[results.length - 1].score);
      });

      it("should handle multi-word queries", () => {
        const results = RankingAlgorithms.calculateTFIDF(documents, "JavaScript programming");

        expect(results.length).toBeGreaterThan(0);
        expect(results[0].termScores).toHaveProperty("javascript");
        expect(results[0].termScores).toHaveProperty("programming");
      });

      it("should apply log normalization when configured", () => {
        const config: TFIDFConfig = {
          useLogNormalization: true,
          useSublinearScaling: false,
          smoothIdf: true,
        };

        const results = RankingAlgorithms.calculateTFIDF(documents, "TypeScript", config);
        expect(results.length).toBeGreaterThan(0);
      });

      it("should apply sublinear scaling when configured", () => {
        const config: TFIDFConfig = {
          useLogNormalization: false,
          useSublinearScaling: true,
          smoothIdf: true,
        };

        const results = RankingAlgorithms.calculateTFIDF(documents, "TypeScript", config);
        expect(results.length).toBeGreaterThan(0);
      });

      it("should use raw term frequency when no scaling configured", () => {
        const config: TFIDFConfig = {
          useLogNormalization: false,
          useSublinearScaling: false,
          smoothIdf: true,
        };

        const results = RankingAlgorithms.calculateTFIDF(documents, "TypeScript", config);
        expect(results.length).toBeGreaterThan(0);
      });

      it("should use smooth IDF when configured", () => {
        const config: TFIDFConfig = {
          useLogNormalization: true,
          useSublinearScaling: false,
          smoothIdf: true,
        };

        const results = RankingAlgorithms.calculateTFIDF(documents, "TypeScript", config);
        expect(results.length).toBeGreaterThan(0);
      });

      it("should calculate unsmoothed IDF when disabled", () => {
        const config: TFIDFConfig = {
          useLogNormalization: true,
          useSublinearScaling: false,
          smoothIdf: false,
        };

        const results = RankingAlgorithms.calculateTFIDF(documents, "TypeScript", config);
        expect(results.length).toBeGreaterThan(0);
      });

      it("should return results sorted by score descending", () => {
        const results = RankingAlgorithms.calculateTFIDF(documents, "programming");

        for (let i = 1; i < results.length; i++) {
          expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
        }
      });
    });

    describe("Error Cases", () => {
      it("should return empty array for empty query", () => {
        const results = RankingAlgorithms.calculateTFIDF(documents, "");
        expect(results).toEqual([]);
      });

      it("should return empty array for whitespace-only query", () => {
        const results = RankingAlgorithms.calculateTFIDF(documents, "   ");
        expect(results).toEqual([]);
      });

      it("should handle query with no matches", () => {
        const results = RankingAlgorithms.calculateTFIDF(documents, "nonexistentterm");
        expect(results).toEqual([]);
      });

      it("should handle empty document array", () => {
        const results = RankingAlgorithms.calculateTFIDF([], "TypeScript");
        expect(results).toEqual([]);
      });
    });

    describe("Edge Cases", () => {
      it("should handle single document", () => {
        const results = RankingAlgorithms.calculateTFIDF([documents[0]], "TypeScript");
        expect(results.length).toBe(1);
        expect(results[0].score).toBeGreaterThan(0);
      });

      it("should handle documents with special characters", () => {
        const specialDocs = [
          createMockDocument("1", "Test@Document!", "Content with special chars: #$%^&*()"),
        ];

        const results = RankingAlgorithms.calculateTFIDF(specialDocs, "test document");
        expect(results.length).toBeGreaterThan(0);
      });

      it("should be case-insensitive", () => {
        const resultsLower = RankingAlgorithms.calculateTFIDF(documents, "typescript");
        const resultsUpper = RankingAlgorithms.calculateTFIDF(documents, "TYPESCRIPT");
        const resultsMixed = RankingAlgorithms.calculateTFIDF(documents, "TypeScript");

        expect(resultsLower.length).toBe(resultsUpper.length);
        expect(resultsLower.length).toBe(resultsMixed.length);
      });

      it("should handle documents with missing optional fields", () => {
        const minimalDocs = [createMockDocument("1", "Title Only", "Some content")];

        const results = RankingAlgorithms.calculateTFIDF(minimalDocs, "title");
        expect(results.length).toBeGreaterThan(0);
      });

      it("should handle very long documents", () => {
        const longContent = "TypeScript ".repeat(1000);
        const longDocs = [createMockDocument("1", "Long Document", longContent)];

        const results = RankingAlgorithms.calculateTFIDF(longDocs, "TypeScript");
        expect(results.length).toBe(1);
        expect(results[0].score).toBeGreaterThan(0);
      });
    });
  });

  describe("calculateBM25", () => {
    describe("Happy Path", () => {
      it("should return ranked results for a valid query", () => {
        const results = RankingAlgorithms.calculateBM25(documents, "TypeScript");

        expect(results.length).toBeGreaterThan(0);
        expect(results[0].item.id).toBeDefined();
        expect(results[0].score).toBeGreaterThan(0);
        expect(results[0].termScores).toBeDefined();
      });

      it("should handle custom k1 parameter", () => {
        const config: BM25Config = {
          k1: 2.0,
          b: 0.75,
        };

        const results = RankingAlgorithms.calculateBM25(documents, "TypeScript", config);
        expect(results.length).toBeGreaterThan(0);
      });

      it("should handle custom b parameter (length normalization)", () => {
        const config: BM25Config = {
          k1: 1.2,
          b: 0.5,
        };

        const results = RankingAlgorithms.calculateBM25(documents, "TypeScript", config);
        expect(results.length).toBeGreaterThan(0);
      });

      it("should use avgDocLength if provided", () => {
        const config: BM25Config = {
          k1: 1.2,
          b: 0.75,
          avgDocLength: 50,
        };

        const results = RankingAlgorithms.calculateBM25(documents, "TypeScript", config);
        expect(results.length).toBeGreaterThan(0);
      });

      it("should return results sorted by score descending", () => {
        const results = RankingAlgorithms.calculateBM25(documents, "programming");

        for (let i = 1; i < results.length; i++) {
          expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
        }
      });

      it("should handle multi-word queries", () => {
        const results = RankingAlgorithms.calculateBM25(documents, "TypeScript JavaScript");

        expect(results.length).toBeGreaterThan(0);
        expect(results[0].termScores).toBeDefined();
      });
    });

    describe("Error Cases", () => {
      it("should return empty array for empty query", () => {
        const results = RankingAlgorithms.calculateBM25(documents, "");
        expect(results).toEqual([]);
      });

      it("should return empty array for whitespace-only query", () => {
        const results = RankingAlgorithms.calculateBM25(documents, "   ");
        expect(results).toEqual([]);
      });

      it("should handle query with no matches", () => {
        const results = RankingAlgorithms.calculateBM25(documents, "nonexistentterm");
        expect(results).toEqual([]);
      });

      it("should handle empty document array", () => {
        const results = RankingAlgorithms.calculateBM25([], "TypeScript");
        expect(results).toEqual([]);
      });
    });

    describe("Edge Cases", () => {
      it("should handle single document", () => {
        const results = RankingAlgorithms.calculateBM25([documents[0]], "TypeScript");
        expect(results.length).toBe(1);
      });

      it("should be case-insensitive", () => {
        const resultsLower = RankingAlgorithms.calculateBM25(documents, "typescript");
        const resultsUpper = RankingAlgorithms.calculateBM25(documents, "TYPESCRIPT");

        expect(resultsLower.length).toBe(resultsUpper.length);
      });

      it("should handle extreme k1 values", () => {
        const configLowK1: BM25Config = { k1: 0.1, b: 0.75 };
        const configHighK1: BM25Config = { k1: 10, b: 0.75 };

        const resultsLow = RankingAlgorithms.calculateBM25(documents, "TypeScript", configLowK1);
        const resultsHigh = RankingAlgorithms.calculateBM25(documents, "TypeScript", configHighK1);

        expect(resultsLow.length).toBeGreaterThan(0);
        expect(resultsHigh.length).toBeGreaterThan(0);
      });

      it("should handle extreme b values (no length normalization vs full)", () => {
        const configNoNorm: BM25Config = { k1: 1.2, b: 0 };
        const configFullNorm: BM25Config = { k1: 1.2, b: 1 };

        const resultsNoNorm = RankingAlgorithms.calculateBM25(
          documents,
          "TypeScript",
          configNoNorm
        );
        const resultsFullNorm = RankingAlgorithms.calculateBM25(
          documents,
          "TypeScript",
          configFullNorm
        );

        expect(resultsNoNorm.length).toBeGreaterThan(0);
        expect(resultsFullNorm.length).toBeGreaterThan(0);
      });
    });
  });

  describe("calculateCosineSimilarity", () => {
    describe("Happy Path", () => {
      it("should return ranked results for a valid query", () => {
        const results = RankingAlgorithms.calculateCosineSimilarity(documents, "TypeScript");

        expect(results.length).toBeGreaterThan(0);
        expect(results[0].item.id).toBeDefined();
        expect(results[0].score).toBeGreaterThan(0);
        expect(results[0].score).toBeLessThanOrEqual(1); // Cosine similarity is 0-1
      });

      it("should return scores between 0 and 1", () => {
        const results = RankingAlgorithms.calculateCosineSimilarity(documents, "programming");

        results.forEach((result) => {
          expect(result.score).toBeGreaterThanOrEqual(0);
          expect(result.score).toBeLessThanOrEqual(1);
        });
      });

      it("should return results sorted by score descending", () => {
        const results = RankingAlgorithms.calculateCosineSimilarity(documents, "JavaScript");

        for (let i = 1; i < results.length; i++) {
          expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
        }
      });

      it("should handle multi-word queries", () => {
        const results = RankingAlgorithms.calculateCosineSimilarity(
          documents,
          "TypeScript programming"
        );

        expect(results.length).toBeGreaterThan(0);
      });
    });

    describe("Error Cases", () => {
      it("should return empty array for empty query", () => {
        const results = RankingAlgorithms.calculateCosineSimilarity(documents, "");
        expect(results).toEqual([]);
      });

      it("should return empty array for whitespace-only query", () => {
        const results = RankingAlgorithms.calculateCosineSimilarity(documents, "   ");
        expect(results).toEqual([]);
      });

      it("should handle query with no matches", () => {
        const results = RankingAlgorithms.calculateCosineSimilarity(documents, "nonexistentterm");
        expect(results).toEqual([]);
      });

      it("should handle empty document array", () => {
        const results = RankingAlgorithms.calculateCosineSimilarity([], "TypeScript");
        expect(results).toEqual([]);
      });
    });

    describe("Edge Cases", () => {
      it("should handle single document", () => {
        const results = RankingAlgorithms.calculateCosineSimilarity([documents[0]], "TypeScript");
        expect(results.length).toBe(1);
        expect(results[0].score).toBeGreaterThan(0);
      });

      it("should be case-insensitive", () => {
        const resultsLower = RankingAlgorithms.calculateCosineSimilarity(documents, "typescript");
        const resultsUpper = RankingAlgorithms.calculateCosineSimilarity(documents, "TYPESCRIPT");

        expect(resultsLower.length).toBe(resultsUpper.length);
      });

      it("should handle documents with identical content", () => {
        const identicalDocs = [
          createMockDocument("1", "Same", "TypeScript content"),
          createMockDocument("2", "Same", "TypeScript content"),
        ];

        const results = RankingAlgorithms.calculateCosineSimilarity(identicalDocs, "TypeScript");
        expect(results.length).toBe(2);
        // Identical documents should have same or very similar scores
        expect(Math.abs(results[0].score - results[1].score)).toBeLessThan(0.01);
      });
    });
  });

  describe("customScore", () => {
    describe("Happy Path", () => {
      it("should return ranked results with custom weights", () => {
        const results = RankingAlgorithms.customScore(documents, "TypeScript");

        expect(results.length).toBeGreaterThan(0);
        expect(results[0].item.id).toBeDefined();
        expect(results[0].score).toBeGreaterThan(0);
        expect(results[0].components).toBeDefined();
        expect(results[0].components).toHaveProperty("textRelevance");
        expect(results[0].components).toHaveProperty("titleBoost");
        expect(results[0].components).toHaveProperty("recencyBoost");
        expect(results[0].components).toHaveProperty("popularityBoost");
      });

      it("should apply custom weights correctly", () => {
        const weights = {
          textRelevance: 0.5,
          titleBoost: 0.3,
          recencyBoost: 0.1,
          popularityBoost: 0.1,
        };

        const results = RankingAlgorithms.customScore(documents, "TypeScript", weights);
        expect(results.length).toBeGreaterThan(0);
      });

      it("should boost documents with query term in title", () => {
        const results = RankingAlgorithms.customScore(documents, "TypeScript");

        // Find documents with TypeScript in title
        const withTitle = results.find((r) => r.item.title.includes("TypeScript"));
        expect(withTitle).toBeDefined();
        expect(withTitle!.components.titleBoost).toBeGreaterThan(0);
      });

      it("should apply popularity boost based on metadata", () => {
        const results = RankingAlgorithms.customScore(documents, "TypeScript");

        // Document with higher views should have popularity boost
        results.forEach((result) => {
          if (result.item.metadata?.views) {
            expect(result.components.popularityBoost).toBeGreaterThanOrEqual(0);
          }
        });
      });

      it("should return results sorted by final score", () => {
        const results = RankingAlgorithms.customScore(documents, "programming");

        for (let i = 1; i < results.length; i++) {
          expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
        }
      });
    });

    describe("Error Cases", () => {
      it("should return empty array for empty query", () => {
        const results = RankingAlgorithms.customScore(documents, "");
        expect(results).toEqual([]);
      });

      it("should handle empty document array", () => {
        const results = RankingAlgorithms.customScore([], "TypeScript");
        expect(results).toEqual([]);
      });

      it("should return empty results when query has no matching terms", () => {
        const results = RankingAlgorithms.customScore(documents, "nonexistent", {
          textRelevance: 1,
          titleBoost: 0,
          recencyBoost: 0,
          popularityBoost: 0,
        });
        expect(results).toEqual([]);
      });
    });

    describe("Edge Cases", () => {
      it("should handle documents without metadata", () => {
        const docsNoMeta = [createMockDocument("1", "Test", "TypeScript content")];

        const results = RankingAlgorithms.customScore(docsNoMeta, "TypeScript");
        expect(results.length).toBe(1);
        expect(results[0].components.popularityBoost).toBe(0);
      });

      it("should handle documents without createdAt date", () => {
        const results = RankingAlgorithms.customScore(documents, "TypeScript");
        expect(results.length).toBeGreaterThan(0);
      });

      it("should handle weights that sum to more than 1", () => {
        const weights = {
          textRelevance: 1.0,
          titleBoost: 1.0,
          recencyBoost: 1.0,
          popularityBoost: 1.0,
        };

        const results = RankingAlgorithms.customScore(documents, "TypeScript", weights);
        expect(results.length).toBeGreaterThan(0);
      });

      it("should handle zero weights", () => {
        const weights = {
          textRelevance: 0,
          titleBoost: 0,
          recencyBoost: 0,
          popularityBoost: 1.0,
        };

        const results = RankingAlgorithms.customScore(documents, "TypeScript", weights);
        expect(results.length).toBeGreaterThan(0);
      });
    });
  });

  describe("phraseScore", () => {
    describe("Happy Path", () => {
      it("should return ranked results with phrase detection", () => {
        const results = RankingAlgorithms.phraseScore(documents, "typed superset");

        expect(results.length).toBeGreaterThan(0);
        expect(results[0]).toHaveProperty("hasPhrase");
      });

      it("should boost documents containing exact phrase", () => {
        const results = RankingAlgorithms.phraseScore(documents, "typed superset");

        const withPhrase = results.find((r) => r.hasPhrase);
        const withoutPhrase = results.find((r) => !r.hasPhrase);

        if (withPhrase && withoutPhrase) {
          expect(withPhrase.score).toBeGreaterThan(withoutPhrase.score);
        }
      });

      it("should apply custom phrase boost", () => {
        const results1 = RankingAlgorithms.phraseScore(documents, "typed superset", 2.0);
        const results2 = RankingAlgorithms.phraseScore(documents, "typed superset", 5.0);

        // Higher boost should result in higher scores for phrase matches
        const phrase1 = results1.find((r) => r.hasPhrase);
        const phrase2 = results2.find((r) => r.hasPhrase);

        if (phrase1 && phrase2) {
          expect(phrase2.score).toBeGreaterThan(phrase1.score);
        }
      });

      it("should be case-insensitive for phrase matching", () => {
        const resultsLower = RankingAlgorithms.phraseScore(documents, "typed superset");
        const resultsUpper = RankingAlgorithms.phraseScore(documents, "TYPED SUPERSET");

        expect(resultsLower.length).toBe(resultsUpper.length);
      });
    });

    describe("Error Cases", () => {
      it("should return empty array for empty query", () => {
        const results = RankingAlgorithms.phraseScore(documents, "");
        expect(results).toEqual([]);
      });

      it("should handle empty document array", () => {
        const results = RankingAlgorithms.phraseScore([], "TypeScript");
        expect(results).toEqual([]);
      });
    });

    describe("Edge Cases", () => {
      it("should handle phrase not found in any document", () => {
        const results = RankingAlgorithms.phraseScore(documents, "nonexistent phrase here");
        expect(results).toEqual([]);
      });

      it("should handle single-word queries", () => {
        const results = RankingAlgorithms.phraseScore(documents, "TypeScript");
        expect(results.length).toBeGreaterThan(0);
      });
    });
  });

  describe("fieldWeightedScore", () => {
    describe("Happy Path", () => {
      it("should return ranked results with field-specific scoring", () => {
        const results = RankingAlgorithms.fieldWeightedScore(documents, "TypeScript");

        expect(results.length).toBeGreaterThan(0);
        expect(results[0].item.id).toBeDefined();
        expect(results[0].score).toBeGreaterThan(0);
        expect(results[0].fieldScores).toBeDefined();
      });

      it("should apply custom field weights", () => {
        const weights = {
          title: 5.0,
          description: 1.0,
          content: 1.0,
          tags: 1.0,
        };

        const results = RankingAlgorithms.fieldWeightedScore(documents, "TypeScript", weights);
        expect(results.length).toBeGreaterThan(0);
      });

      it("should boost matches in title field", () => {
        const results = RankingAlgorithms.fieldWeightedScore(documents, "TypeScript");

        const titleMatch = results.find((r) => r.item.title.toLowerCase().includes("typescript"));
        if (titleMatch) {
          expect(titleMatch.fieldScores.title).toBeGreaterThan(0);
        }
      });

      it("should score tags field when query matches tags", () => {
        const results = RankingAlgorithms.fieldWeightedScore(documents, "javascript");

        const tagMatch = results.find((r) => r.item.tags?.includes("javascript"));
        if (tagMatch) {
          expect(tagMatch.fieldScores.tags).toBeGreaterThan(0);
        }
      });

      it("should return results sorted by score descending", () => {
        const results = RankingAlgorithms.fieldWeightedScore(documents, "programming");

        for (let i = 1; i < results.length; i++) {
          expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
        }
      });
    });

    describe("Error Cases", () => {
      it("should return empty array for empty query", () => {
        const results = RankingAlgorithms.fieldWeightedScore(documents, "");
        expect(results).toEqual([]);
      });

      it("should handle empty document array", () => {
        const results = RankingAlgorithms.fieldWeightedScore([], "TypeScript");
        expect(results).toEqual([]);
      });

      it("should return empty results when query terms are absent", () => {
        const results = RankingAlgorithms.fieldWeightedScore(documents, "nonexistent");
        expect(results).toEqual([]);
      });
    });

    describe("Edge Cases", () => {
      it("should handle documents with missing fields", () => {
        const minimalDocs = [createMockDocument("1", "Title", "Content")];

        const results = RankingAlgorithms.fieldWeightedScore(minimalDocs, "title");
        expect(results.length).toBeGreaterThan(0);
      });

      it("should handle empty field weights", () => {
        const results = RankingAlgorithms.fieldWeightedScore(documents, "TypeScript", {});
        expect(results).toEqual([]);
      });

      it("should handle zero weights for all fields", () => {
        const weights = {
          title: 0,
          description: 0,
          content: 0,
          tags: 0,
        };

        const results = RankingAlgorithms.fieldWeightedScore(documents, "TypeScript", weights);
        expect(results).toEqual([]);
      });

      it("should handle documents with empty tags array", () => {
        const docsEmptyTags = [createMockDocument("1", "Test", "Content", { tags: [] })];

        const results = RankingAlgorithms.fieldWeightedScore(docsEmptyTags, "test");
        expect(results.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Internal Helpers", () => {
    const helpers = RankingAlgorithms as unknown as {
      tokenize: (text: string) => string[];
      calculateDocumentFrequencies: (terms: string[][]) => Record<string, number>;
      cosineSimilarityVectors: (vec1: number[], vec2: number[]) => number;
      calculateTitleBoost: (title: string, queryTerms: string[]) => number;
      calculateRecencyBoost: (createdAt: Date) => number;
      calculatePopularityBoost: (metadata?: Record<string, number>) => number;
      calculateFieldScore: (fieldText: string, queryTerms: string[]) => number;
    };

    it("should tokenize text by normalizing and stripping punctuation", () => {
      const tokens = helpers.tokenize("Hello, WORLD!! TypeScript???");

      expect(tokens).toEqual(["hello", "world", "typescript"]);
    });

    it("should calculate document frequencies using unique terms", () => {
      const frequencies = helpers.calculateDocumentFrequencies([
        ["typescript", "typescript", "javascript"],
        ["javascript", "python"],
      ]);

      expect(frequencies.typescript).toBe(1);
      expect(frequencies.javascript).toBe(2);
      expect(frequencies.python).toBe(1);
    });

    it("should return zero cosine similarity for mismatched vector lengths", () => {
      const similarity = helpers.cosineSimilarityVectors([1, 0], [1]);
      expect(similarity).toBe(0);
    });

    it("should return zero cosine similarity when a vector has zero magnitude", () => {
      const similarity = helpers.cosineSimilarityVectors([0, 0], [1, 0]);
      expect(similarity).toBe(0);
    });

    it("should calculate title boost as ratio of matching terms", () => {
      const boost = helpers.calculateTitleBoost("Advanced TypeScript Guide", [
        "typescript",
        "guide",
        "missing",
      ]);

      expect(boost).toBeCloseTo(2 / 3);
    });

    it("should decay recency boost for older documents", () => {
      const nowBoost = helpers.calculateRecencyBoost(new Date());
      const fiveYearsAgo = new Date();
      fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

      const oldBoost = helpers.calculateRecencyBoost(fiveYearsAgo);

      expect(nowBoost).toBeGreaterThan(oldBoost);
      expect(oldBoost).toBeGreaterThan(0);
    });

    it("should handle popularity boost with and without metadata", () => {
      expect(helpers.calculatePopularityBoost()).toBe(0);

      const modestPopularity = helpers.calculatePopularityBoost({ views: 10, likes: 2, shares: 1 });
      const viralPopularity = helpers.calculatePopularityBoost({
        views: 1_000_000,
        likes: 50_000,
        shares: 10_000,
      });

      expect(modestPopularity).toBeGreaterThan(0);
      expect(viralPopularity).toBe(1);
    });

    it("should calculate field score using term frequency", () => {
      const score = helpers.calculateFieldScore("TypeScript TypeScript", [
        "typescript",
        "javascript",
      ]);
      const noMatchScore = helpers.calculateFieldScore("rust", ["typescript"]);

      expect(score).toBeGreaterThan(0);
      expect(noMatchScore).toBe(0);
    });
  });

  describe("Integration Tests", () => {
    it("should produce consistent results across multiple runs", () => {
      const results1 = RankingAlgorithms.calculateTFIDF(documents, "TypeScript programming");
      const results2 = RankingAlgorithms.calculateTFIDF(documents, "TypeScript programming");

      expect(results1.length).toBe(results2.length);

      for (let i = 0; i < results1.length; i++) {
        expect(results1[i].item.id).toBe(results2[i].item.id);
        expect(results1[i].score).toBeCloseTo(results2[i].score, 5);
      }
    });

    it("should handle large number of documents", () => {
      const largeDocs = Array.from({ length: 100 }, (_, i) =>
        createMockDocument(`${i}`, `Document ${i}`, `Content with TypeScript and programming ${i}`)
      );

      const results = RankingAlgorithms.calculateBM25(largeDocs, "TypeScript");
      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(100);
    });

    it("should handle documents with various content lengths", () => {
      const mixedLengthDocs = [
        createMockDocument("1", "Short", "TypeScript"),
        createMockDocument("2", "Medium", "TypeScript ".repeat(10)),
        createMockDocument("3", "Long", "TypeScript ".repeat(100)),
      ];

      const results = RankingAlgorithms.calculateBM25(mixedLengthDocs, "TypeScript");
      expect(results.length).toBe(3);
    });

    it("should produce different rankings for different algorithms", () => {
      const tfidfResults = RankingAlgorithms.calculateTFIDF(documents, "TypeScript");
      const bm25Results = RankingAlgorithms.calculateBM25(documents, "TypeScript");
      const cosineResults = RankingAlgorithms.calculateCosineSimilarity(documents, "TypeScript");

      expect(tfidfResults.length).toBeGreaterThan(0);
      expect(bm25Results.length).toBeGreaterThan(0);
      expect(cosineResults.length).toBeGreaterThan(0);
    });

    it("should handle special characters in query and content", () => {
      const specialDocs = [
        createMockDocument("1", "C++ Programming", "C++ is a programming language"),
        createMockDocument("2", "C# Guide", "C# is another language"),
      ];

      const results = RankingAlgorithms.calculateBM25(specialDocs, "C++");
      expect(results.length).toBeGreaterThan(0);
    });
  });
});
