/** HTTP status codes used by rate-limiter API. */
export const HttpStatus = {
  CREATED: 201,
  BAD_REQUEST: 400,
  TOO_MANY_REQUESTS: 429,
} as const;
