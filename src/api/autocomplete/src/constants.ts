/** HTTP status codes used by autocomplete API. */
export const HttpStatus = {
  BAD_REQUEST: 400,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

/** Default and max limits for search and analytics */
export const SearchLimit = {
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
  MAX_ANALYTICS_SIZE: 1000,
  POPULAR_QUERIES_TOP: 50,
  RECENT_SEARCHES_COUNT: 100,
  ESTIMATED_BYTES_PER_CHAR: 2,
  MAX_ITEM_SIZE_BYTES: 100,
} as const;
