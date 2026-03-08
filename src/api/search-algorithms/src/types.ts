/**
 * Type definitions for Search Algorithms
 *
 * This file defines all interfaces and types used throughout
 * the search algorithm implementations.
 */

export interface SearchableItem {
  id: string;
  title: string;
  description?: string;
  content?: string;
  tags?: string[];
  category?: string;
  metadata?: Record<string, unknown>;
}

export interface SearchResult<T = SearchableItem> {
  item: T;
  score: number;
  matches: SearchMatch[];
  highlightedFields?: Record<string, string>;
  algorithm: string;
  executionTime: number;
}

export interface SearchMatch {
  field: string;
  value: string;
  startIndex: number;
  endIndex: number;
  matchType: "exact" | "partial" | "fuzzy" | "phonetic" | "semantic";
}

export interface SearchOptions {
  algorithm: SearchAlgorithm;
  fields?: string[];
  caseSensitive?: boolean;
  wholeWords?: boolean;
  maxResults?: number;
  minScore?: number;
  highlightMatches?: boolean;
  fuzzyThreshold?: number; // 0-1, lower = more strict
  phoneticThreshold?: number; // 0-1 for phonetic matching
  semanticThreshold?: number; // 0-1 for semantic similarity
}

export type SearchAlgorithm =
  | "exact" // Exact string matching
  | "prefix" // Starts with query
  | "suffix" // Ends with query
  | "contains" // Contains query anywhere
  | "fuzzy" // Fuzzy string matching (Levenshtein-based)
  | "phonetic" // Phonetic matching (sounds like)
  | "regex" // Regular expression matching
  | "wildcard" // Wildcard pattern matching
  | "ngram" // N-gram based matching
  | "bm25" // BM25 ranking algorithm
  | "tfidf" // TF-IDF scoring
  | "semantic" // Semantic similarity (cosine similarity)
  | "compound"; // Multiple algorithms combined

export interface SearchRequest {
  query: string;
  options: SearchOptions;
  filters?: SearchFilter[];
}

export interface SearchFilter {
  field: string;
  operator: "equals" | "contains" | "startsWith" | "endsWith" | "in" | "range";
  value: unknown;
}

export interface SearchResponse<T = SearchableItem> {
  query: string;
  results: SearchResult<T>[];
  totalCount: number;
  executionTime: number;
  algorithm: SearchAlgorithm;
  suggestions?: string[];
  metadata: {
    searchType: string;
    resultsFound: number;
    maxScore: number;
    minScore: number;
  };
}

// Algorithm-specific configurations
export interface FuzzyConfig {
  maxDistance: number; // Maximum edit distance allowed
  insertCost: number; // Cost of character insertion
  deleteCost: number; // Cost of character deletion
  substituteCost: number; // Cost of character substitution
  transpositionCost: number; // Cost of character transposition
}

export interface NGramConfig {
  n: number; // Size of n-grams (2 = bigrams, 3 = trigrams)
  padding: boolean; // Add padding characters
  caseSensitive: boolean;
}

export interface BM25Config {
  k1: number; // Term frequency saturation parameter
  b: number; // Length normalization parameter
  avgDocLength?: number; // Average document length
}

export interface TFIDFConfig {
  useLogNormalization: boolean;
  useSublinearScaling: boolean;
  smoothIdf: boolean;
}

// Phonetic algorithm types
export type PhoneticAlgorithm = "soundex" | "metaphone" | "doubleMetaphone" | "nysiis";

// Index structures for efficient searching
export interface InvertedIndex {
  [term: string]: {
    documentFrequency: number;
    postings: Array<{
      documentId: string;
      termFrequency: number;
      positions: number[];
    }>;
  };
}

export interface NGramIndex {
  [ngram: string]: Set<string>; // Set of document IDs containing this n-gram
}

export interface TrieNode {
  children: Map<string, TrieNode>;
  isEndOfWord: boolean;
  documentIds: Set<string>;
  frequency: number;
}

// Performance metrics
export interface SearchMetrics {
  totalSearches: number;
  averageExecutionTime: number;
  algorithmUsage: Record<SearchAlgorithm, number>;
  popularQueries: Array<{
    query: string;
    count: number;
    avgExecutionTime: number;
  }>;
  indexSize: number;
  cacheHitRate: number;
}

// Search analytics
export interface SearchAnalytics {
  query: string;
  algorithm: SearchAlgorithm;
  resultCount: number;
  executionTime: number;
  timestamp: Date;
  userId?: string;
  clickedResults?: string[];
}

// Highlighting configuration
export interface HighlightConfig {
  preTag: string; // Tag before match (e.g., '<mark>')
  postTag: string; // Tag after match (e.g., '</mark>')
  maxFragments: number;
  fragmentSize: number;
  fragmentSeparator: string;
}

// Auto-complete and suggestions
export interface SuggestionConfig {
  maxSuggestions: number;
  minQueryLength: number;
  includePopular: boolean;
  includeSimilar: boolean;
  fuzzyCorrection: boolean;
}

// Search result ranking factors
export interface RankingFactors {
  textRelevance: number; // Weight for text matching score
  fieldBoosts: Record<string, number>; // Boost factors for different fields
  recency: number; // Weight for document recency
  popularity: number; // Weight for document popularity
  userPreference: number; // Weight for user-specific preferences
}
