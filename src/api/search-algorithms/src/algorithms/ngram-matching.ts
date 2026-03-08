/**
 * N-gram Based Matching Algorithms
 *
 * This module implements n-gram based text matching and similarity algorithms.
 * N-grams are contiguous sequences of n characters from a text, useful for
 * fuzzy matching, similarity detection, and approximate string matching.
 *
 * Algorithms implemented:
 * - Character n-grams (bigrams, trigrams, etc.)
 * - Word n-grams
 * - Skip-grams (n-grams with gaps)
 * - Jaccard similarity using n-grams
 * - Cosine similarity using n-grams
 */

import { SearchMatch } from "../types";

export class NGramMatcher {
  /**
   * Generate Character N-grams
   *
   * Why: Break text into overlapping character sequences for fuzzy matching
   * When: Fuzzy search, spell checking, similarity detection
   * Time Complexity: O(n) where n is string length
   */
  static generateCharacterNGrams(
    text: string,
    n: number = 2,
    padding: boolean = true,
    caseSensitive: boolean = false
  ): string[] {
    if (!text || n <= 0) return [];

    const processedText = caseSensitive ? text : text.toLowerCase();
    let workingText = processedText;

    // Add padding characters if requested
    if (padding) {
      const paddingChar = " ";
      workingText = paddingChar.repeat(n - 1) + processedText + paddingChar.repeat(n - 1);
    }

    const ngrams: string[] = [];

    for (let i = 0; i <= workingText.length - n; i++) {
      ngrams.push(workingText.substring(i, i + n));
    }

    return ngrams;
  }

  /**
   * Generate Word N-grams
   *
   * Why: Create sequences of words for phrase matching and context analysis
   * When: Phrase search, context matching, document similarity
   * Time Complexity: O(w) where w is number of words
   */
  static generateWordNGrams(text: string, n: number = 2): string[] {
    if (!text || n <= 0) return [];

    // Split into words and clean
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 0);

    if (words.length < n) return [];

    const ngrams: string[] = [];

    for (let i = 0; i <= words.length - n; i++) {
      ngrams.push(words.slice(i, i + n).join(" "));
    }

    return ngrams;
  }

  /**
   * Generate Skip-grams
   *
   * Why: Capture non-contiguous patterns with gaps
   * When: Flexible pattern matching, handling word order variations
   * Time Complexity: O(n^k) where k is the skip distance
   */
  static generateSkipGrams(
    text: string,
    n: number = 2,
    k: number = 1,
    caseSensitive: boolean = false
  ): string[] {
    if (!text || n <= 0) return [];

    const processedText = caseSensitive ? text : text.toLowerCase();
    const skipgrams: string[] = [];

    for (let i = 0; i <= processedText.length - n - k; i++) {
      let skipgram = "";
      let pos = i;

      for (let j = 0; j < n; j++) {
        if (pos < processedText.length) {
          skipgram += processedText[pos];
          pos += j === n - 2 ? k + 1 : 1; // Add skip before last character
        }
      }

      if (skipgram.length === n) {
        skipgrams.push(skipgram);
      }
    }

    return skipgrams;
  }

  /**
   * Jaccard Similarity using N-grams
   *
   * Why: Measure similarity as intersection over union of n-gram sets
   * When: Document similarity, fuzzy matching with set-based approach
   * Time Complexity: O(n + m) where n,m are text lengths
   */
  static jaccardSimilarity(
    text1: string,
    text2: string,
    n: number = 2,
    caseSensitive: boolean = false
  ): number {
    const ngrams1 = new Set(this.generateCharacterNGrams(text1, n, true, caseSensitive));
    const ngrams2 = new Set(this.generateCharacterNGrams(text2, n, true, caseSensitive));

    if (ngrams1.size === 0 && ngrams2.size === 0) return 1.0;
    if (ngrams1.size === 0 || ngrams2.size === 0) return 0.0;

    // Calculate intersection
    const intersection = new Set([...ngrams1].filter((x) => ngrams2.has(x)));

    // Calculate union
    const union = new Set([...ngrams1, ...ngrams2]);

    return intersection.size / union.size;
  }

  /**
   * Cosine Similarity using N-grams
   *
   * Why: Measure similarity using vector space model with n-gram frequencies
   * When: Document similarity, information retrieval, text classification
   * Time Complexity: O(n + m)
   */
  static cosineSimilarity(
    text1: string,
    text2: string,
    n: number = 2,
    caseSensitive: boolean = false
  ): number {
    const ngrams1 = this.generateCharacterNGrams(text1, n, true, caseSensitive);
    const ngrams2 = this.generateCharacterNGrams(text2, n, true, caseSensitive);

    if (ngrams1.length === 0 && ngrams2.length === 0) return 1.0;
    if (ngrams1.length === 0 || ngrams2.length === 0) return 0.0;

    // Create frequency vectors
    const freq1 = this.createFrequencyVector(ngrams1);
    const freq2 = this.createFrequencyVector(ngrams2);

    // Get all unique n-grams
    const allNGrams = new Set([...Object.keys(freq1), ...Object.keys(freq2)]);

    // Calculate dot product and magnitudes
    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;

    for (const ngram of allNGrams) {
      const f1 = freq1[ngram] || 0;
      const f2 = freq2[ngram] || 0;

      dotProduct += f1 * f2;
      magnitude1 += f1 * f1;
      magnitude2 += f2 * f2;
    }

    if (magnitude1 === 0 || magnitude2 === 0) return 0.0;

    return dotProduct / (Math.sqrt(magnitude1) * Math.sqrt(magnitude2));
  }

  /**
   * Dice Coefficient using N-grams
   *
   * Why: Alternative similarity measure, more forgiving than Jaccard
   * When: Fuzzy matching where partial matches should score higher
   * Formula: 2 * |intersection| / (|set1| + |set2|)
   */
  static diceCoefficient(
    text1: string,
    text2: string,
    n: number = 2,
    caseSensitive: boolean = false
  ): number {
    const ngrams1 = new Set(this.generateCharacterNGrams(text1, n, true, caseSensitive));
    const ngrams2 = new Set(this.generateCharacterNGrams(text2, n, true, caseSensitive));

    if (ngrams1.size === 0 && ngrams2.size === 0) return 1.0;
    if (ngrams1.size === 0 || ngrams2.size === 0) return 0.0;

    const intersection = new Set([...ngrams1].filter((x) => ngrams2.has(x)));

    return (2 * intersection.size) / (ngrams1.size + ngrams2.size);
  }

  /**
   * N-gram based fuzzy matching
   *
   * Why: Find approximate matches using n-gram similarity
   * When: Fuzzy search, typo tolerance, approximate string matching
   */
  static ngramFuzzyMatch(
    text: string,
    query: string,
    threshold: number = 0.3,
    n: number = 2,
    similarityMethod: "jaccard" | "cosine" | "dice" = "jaccard"
  ): { matches: boolean; score: number; method: string } {
    let score: number;

    switch (similarityMethod) {
      case "jaccard":
        score = this.jaccardSimilarity(text, query, n);
        break;
      case "cosine":
        score = this.cosineSimilarity(text, query, n);
        break;
      case "dice":
        score = this.diceCoefficient(text, query, n);
        break;
      default:
        score = this.jaccardSimilarity(text, query, n);
    }

    return {
      matches: score >= threshold,
      score,
      method: similarityMethod,
    };
  }

  /**
   * Multi-gram Analysis
   *
   * Why: Use multiple n-gram sizes for more robust matching
   * When: You want to balance precision (large n) with recall (small n)
   */
  static multiGramSimilarity(
    text1: string,
    text2: string,
    ngramSizes: number[] = [2, 3, 4],
    weights?: number[]
  ): number {
    if (ngramSizes.length === 0) return 0;

    // Use equal weights if not provided
    const actualWeights = weights || ngramSizes.map(() => 1 / ngramSizes.length);

    if (actualWeights.length !== ngramSizes.length) {
      throw new Error("Number of weights must match number of n-gram sizes");
    }

    let weightedScore = 0;
    let totalWeight = 0;

    for (let i = 0; i < ngramSizes.length; i++) {
      const n = ngramSizes[i];
      const weight = actualWeights[i];
      const score = this.jaccardSimilarity(text1, text2, n);

      weightedScore += score * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? weightedScore / totalWeight : 0;
  }

  /**
   * N-gram based substring matching
   *
   * Why: Find all substrings that have sufficient n-gram overlap
   * When: Partial matching, finding similar segments within text
   */
  static ngramSubstringMatch(
    text: string,
    query: string,
    threshold: number = 0.5,
    n: number = 2,
    windowSize?: number
  ): SearchMatch[] {
    if (!text || !query) return [];

    const matches: SearchMatch[] = [];
    const queryNGrams = new Set(this.generateCharacterNGrams(query, n, true, false));
    const actualWindowSize = windowSize || query.length;

    // Slide window across text
    for (let i = 0; i <= text.length - actualWindowSize; i++) {
      const substring = text.substring(i, i + actualWindowSize);
      const substringNGrams = new Set(this.generateCharacterNGrams(substring, n, true, false));

      // Calculate Jaccard similarity
      const intersection = new Set([...queryNGrams].filter((x) => substringNGrams.has(x)));
      const union = new Set([...queryNGrams, ...substringNGrams]);
      const similarity = intersection.size / union.size;

      if (similarity >= threshold) {
        matches.push({
          field: "text",
          value: substring,
          startIndex: i,
          endIndex: i + actualWindowSize - 1,
          matchType: "fuzzy",
        });
      }
    }

    return matches;
  }

  /**
   * Language Detection using N-grams
   *
   * Why: Identify language based on character n-gram patterns
   * When: Multi-language search, content classification
   * Note: This is a simplified example - real language detection needs training data
   */
  static detectLanguagePattern(
    text: string,
    n: number = 3
  ): { pattern: string[]; signature: string } {
    const ngrams = this.generateCharacterNGrams(text, n, true, false);
    const frequency = this.createFrequencyVector(ngrams);

    // Get most common n-grams as language signature
    const sortedNGrams = Object.entries(frequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([ngram]) => ngram);

    return {
      pattern: sortedNGrams,
      signature: sortedNGrams.join("|"),
    };
  }

  /**
   * N-gram based spell checking suggestions
   *
   * Why: Generate spelling suggestions based on n-gram similarity
   * When: Spell checking, query suggestion, typo correction
   */
  static generateSpellingSuggestions(
    word: string,
    dictionary: string[],
    maxSuggestions: number = 5,
    threshold: number = 0.3,
    n: number = 2
  ): Array<{ word: string; score: number }> {
    const suggestions: Array<{ word: string; score: number }> = [];

    for (const dictWord of dictionary) {
      const score = this.jaccardSimilarity(word, dictWord, n);

      if (score >= threshold) {
        suggestions.push({ word: dictWord, score });
      }
    }

    // Sort by score (descending) and limit results
    return suggestions.sort((a, b) => b.score - a.score).slice(0, maxSuggestions);
  }

  /**
   * Positional N-grams
   *
   * Why: Include position information in n-grams for order-sensitive matching
   * When: Sequence matching where order matters
   */
  static generatePositionalNGrams(
    text: string,
    n: number = 2,
    caseSensitive: boolean = false
  ): Array<{ ngram: string; position: number }> {
    const processedText = caseSensitive ? text : text.toLowerCase();
    const positionalNGrams: Array<{ ngram: string; position: number }> = [];

    for (let i = 0; i <= processedText.length - n; i++) {
      positionalNGrams.push({
        ngram: processedText.substring(i, i + n),
        position: i,
      });
    }

    return positionalNGrams;
  }

  /**
   * Weighted N-gram similarity
   *
   * Why: Give different weights to n-grams based on their importance
   * When: Some n-grams are more discriminative than others
   */
  static weightedNGramSimilarity(
    text1: string,
    text2: string,
    weights: Map<string, number>,
    n: number = 2
  ): number {
    const ngrams1 = this.generateCharacterNGrams(text1, n, true, false);
    const ngrams2 = this.generateCharacterNGrams(text2, n, true, false);

    const freq1 = this.createFrequencyVector(ngrams1);
    const freq2 = this.createFrequencyVector(ngrams2);

    const allNGrams = new Set([...Object.keys(freq1), ...Object.keys(freq2)]);

    let weightedDotProduct = 0;
    let weightedMagnitude1 = 0;
    let weightedMagnitude2 = 0;

    for (const ngram of allNGrams) {
      const f1 = freq1[ngram] || 0;
      const f2 = freq2[ngram] || 0;
      const weight = weights.get(ngram) || 1.0;

      const weightedF1 = f1 * weight;
      const weightedF2 = f2 * weight;

      weightedDotProduct += weightedF1 * weightedF2;
      weightedMagnitude1 += weightedF1 * weightedF1;
      weightedMagnitude2 += weightedF2 * weightedF2;
    }

    if (weightedMagnitude1 === 0 || weightedMagnitude2 === 0) return 0.0;

    return weightedDotProduct / (Math.sqrt(weightedMagnitude1) * Math.sqrt(weightedMagnitude2));
  }

  /**
   * Create frequency vector from n-grams
   */
  private static createFrequencyVector(ngrams: string[]): Record<string, number> {
    const frequency: Record<string, number> = {};

    for (const ngram of ngrams) {
      frequency[ngram] = (frequency[ngram] || 0) + 1;
    }

    return frequency;
  }

  /**
   * N-gram based text fingerprinting
   *
   * Why: Create a compact representation of text for fast similarity comparison
   * When: Large-scale duplicate detection, plagiarism detection
   */
  static createTextFingerprint(text: string, n: number = 3, fingerprintSize: number = 64): string {
    const ngrams = this.generateCharacterNGrams(text, n, true, false);
    const frequency = this.createFrequencyVector(ngrams);

    // Get most frequent n-grams
    const topNGrams = Object.entries(frequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, fingerprintSize)
      .map(([ngram]) => ngram);

    // Create a hash-like fingerprint
    return topNGrams.join("").substring(0, fingerprintSize);
  }
}
