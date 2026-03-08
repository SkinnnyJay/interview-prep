const path = require("path");

module.exports = {
  rootDir: __dirname,
  testEnvironment: "node",
  testTimeout: 90000,
  testMatch: ["<rootDir>/src/**/*.test.ts"],
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: path.join(__dirname, "tsconfig.json") }],
  },
  moduleNameMapper: {
    "^uuid$": path.join(__dirname, "../../../__mocks__/uuid.js"),
    "^socket.io-client$": path.join(__dirname, "../../../node_modules/socket.io-client"),
    "^react$": path.join(__dirname, "../../../node_modules/react"),
    "^react-dom$": path.join(__dirname, "../../../node_modules/react-dom"),
  },
  collectCoverageFrom: ["src/**/*.ts", "!src/**/*.test.ts", "!src/frontend/**"],
  coverageDirectory: path.join(__dirname, "coverage"),
  clearMocks: true,
  restoreMocks: true,
  maxWorkers: 1,
  cache: false,
  watchman: false,
};
