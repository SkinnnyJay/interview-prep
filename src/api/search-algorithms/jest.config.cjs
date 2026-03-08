/** Jest config for search-algorithms (TypeScript + ts-jest). */
module.exports = {
  preset: "ts-jest/presets/default",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/*.test.ts"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        useESM: false,
        tsconfig: { module: "CommonJS" },
      },
    ],
  },
  moduleFileExtensions: ["ts", "js", "json"],
  detectOpenHandles: true,
  testTimeout: 90000,
};
