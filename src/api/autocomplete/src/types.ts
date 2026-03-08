/**
 * Type definitions for the Autocomplete API system
 *
 * This file defines all the interfaces and types used throughout
 * the autocomplete system, including search results, configurations,
 * and API request/response structures.
 */

export interface AutocompleteItem {
  id: string;
  title: string;
  description?: string;
  category: string;
  tags: string[];
  metadata?: Record<string, unknown>;
  score?: number; // Relevance score from search
  createdAt: Date;
  updatedAt: Date;
}

export interface SearchResult {
  item: AutocompleteItem;
  score: number;
  matches: SearchMatch[];
  highlightedTitle?: string;
  highlightedDescription?: string;
}

export interface SearchMatch {
  field: string;
  value: string;
  indices: [number, number][];
}

export interface AutocompleteRequest {
  query: string;
  limit?: number;
  category?: string;
  tags?: string[];
  fuzzy?: boolean;
  threshold?: number; // Minimum score threshold (0-1)
  fields?: string[]; // Fields to search/return (used in cache key)
}

export interface AutocompleteResponse {
  query: string;
  results: SearchResult[];
  totalCount: number;
  executionTime: number;
  suggestions?: string[]; // Alternative query suggestions
  metadata: {
    searchType: "exact" | "fuzzy" | "prefix";
    cacheHit: boolean;
    indexSize: number;
  };
}

export interface SearchConfig {
  // Fuse.js configuration options
  keys: SearchKey[];
  threshold: number; // 0.0 = perfect match, 1.0 = match anything
  distance: number; // Maximum distance for fuzzy matching
  includeScore: boolean;
  includeMatches: boolean;
  minMatchCharLength: number;
  shouldSort: boolean;
  findAllMatches: boolean;
  location: number; // Where in the text to start looking
  ignoreLocation: boolean;
  ignoreFieldNorm: boolean;
}

export interface SearchKey {
  name: string;
  weight: number; // Importance of this field in search (0-1)
}

export interface CacheConfig {
  enabled: boolean;
  ttl: number; // Time to live in seconds
  maxSize: number; // Maximum number of cached items
  keyPrefix: string;
  provider?: "memory" | "redis";
  redisUrl?: string;
  invalidationPatterns?: string[];
}

export interface IndexConfig {
  rebuildInterval: number; // How often to rebuild search index (ms)
  batchSize: number; // Items to process in each batch
  enableBackgroundUpdates: boolean;
}

export interface AutocompleteConfig {
  search: SearchConfig;
  cache: CacheConfig;
  index: IndexConfig;
  api: {
    defaultLimit: number;
    maxLimit: number;
    debounceMs: number;
    enableAnalytics: boolean;
  };
}

export interface SearchAnalytics {
  query: string;
  resultCount: number;
  executionTime: number;
  timestamp: Date;
  userAgent?: string;
  ip?: string;
  cacheHit: boolean;
}

/** Config shapes per source type (discriminated by DataSource.type). */
export interface StaticDataSourceConfig {
  data: AutocompleteItem[];
}
export interface FileDataSourceConfig {
  filePath: string;
  format?: "json" | "csv" | "yaml";
}
export interface ApiDataSourceConfig {
  url: string;
  headers?: Record<string, string>;
  transform?: (raw: unknown) => AutocompleteItem;
}
export interface DatabaseDataSourceConfig {
  connectionString: string;
  tableName: string;
  query?: string;
}

export type DataSource =
  | {
      id: string;
      name: string;
      type: "static";
      config: StaticDataSourceConfig;
      lastSync?: Date;
      itemCount: number;
    }
  | {
      id: string;
      name: string;
      type: "file";
      config: FileDataSourceConfig;
      lastSync?: Date;
      itemCount: number;
    }
  | {
      id: string;
      name: string;
      type: "api";
      config: ApiDataSourceConfig;
      lastSync?: Date;
      itemCount: number;
    }
  | {
      id: string;
      name: string;
      type: "database";
      config: DatabaseDataSourceConfig;
      lastSync?: Date;
      itemCount: number;
    };

export interface IndexStats {
  totalItems: number;
  lastUpdated: Date;
  indexSize: number; // Size in bytes
  averageSearchTime: number;
  cacheHitRate: number;
  popularQueries: Array<{
    query: string;
    count: number;
    avgExecutionTime: number;
  }>;
}

// Frontend-specific types
export interface AutocompleteProps {
  placeholder?: string;
  minChars?: number;
  maxResults?: number;
  debounceMs?: number;
  category?: string;
  tags?: string[];
  onSelect?: (item: AutocompleteItem) => void;
  onSearch?: (query: string, results: SearchResult[]) => void;
  className?: string;
  disabled?: boolean;
}

export interface AutocompleteState {
  query: string;
  results: SearchResult[];
  isLoading: boolean;
  isOpen: boolean;
  selectedIndex: number;
  error?: string;
}

// API Error types
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: Date;
}

export interface ValidationError extends ApiError {
  field: string;
  value: unknown;
  constraint: string;
}

// Utility types
export type SearchMode = "instant" | "debounced" | "manual";
export type SortOrder = "relevance" | "alphabetical" | "date" | "category";
export type HighlightStyle = "bold" | "underline" | "background" | "custom";

// Advanced search features
export interface SearchFilter {
  field: string;
  operator: "equals" | "contains" | "startsWith" | "endsWith" | "regex";
  value: unknown;
}

export interface SearchSort {
  field: string;
  order: "asc" | "desc";
}

export interface AdvancedSearchRequest extends AutocompleteRequest {
  filters?: SearchFilter[];
  sort?: SearchSort[];
  facets?: string[]; // Fields to generate facet counts for
  highlight?: {
    enabled: boolean;
    style: HighlightStyle;
    maxLength?: number;
  };
}

export interface SearchFacet {
  field: string;
  values: Array<{
    value: string;
    count: number;
  }>;
}

export interface AdvancedSearchResponse extends AutocompleteResponse {
  facets?: SearchFacet[];
  filters?: SearchFilter[];
  sort?: SearchSort[];
}
