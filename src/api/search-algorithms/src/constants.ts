/** HTTP status codes used by search-algorithms API. */
export const HttpStatus = {
  BAD_REQUEST: 400,
  INTERNAL_SERVER_ERROR: 500,
} as const;

/** Search engine config limits and algorithm names */
export const SearchEngineLimit = {
  MAX_ANALYTICS_SIZE: 1000,
  POPULAR_QUERIES_TOP: 20,
  DEFAULT_ANALYTICS_LIMIT: 100,
} as const;

/** Search algorithm identifier (used in options and responses) */
export const SearchAlgorithmName = {
  BM25: "bm25",
} as const;
