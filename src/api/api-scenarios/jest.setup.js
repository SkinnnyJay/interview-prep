/**
 * Silence console.warn and console.error during tests to keep output readable.
 * Application code in streaming-service, crud-service, and user-controller
 * logs liberally; tests still pass and assertions are unaffected.
 */
beforeAll(() => {
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});
