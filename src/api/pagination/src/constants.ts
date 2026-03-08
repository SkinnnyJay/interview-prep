/**
 * HTTP status codes used by pagination API responses.
 * Replaces magic number literals for consistency.
 */
export const HttpStatus = {
  OK: 200,
  BAD_REQUEST: 400,
  INTERNAL_SERVER_ERROR: 500,
} as const;
