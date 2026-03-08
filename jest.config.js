const rootDir = __dirname;

const defaultModuleNameMapper = {
  '^uuid$': '<rootDir>/__mocks__/uuid.js',
  '^@/(.*)$': '<rootDir>/src/$1',
  '^react$': '<rootDir>/node_modules/react',
  '^react-dom$': '<rootDir>/node_modules/react-dom'
};

const sharedOptions = {
  testEnvironment: 'node',
  testTimeout: 90000,
  transform: { '^.+\\.ts$': 'ts-jest' },
  maxWorkers: 1,
  cache: false,
  cacheDirectory: '/tmp/jest-cache',
  clearMocks: true,
  restoreMocks: true
};

module.exports = {
  projects: [
    {
      ...sharedOptions,
      displayName: 'default',
      testMatch: ['**/src/**/*.test.ts'],
      testPathIgnorePatterns: ['/node_modules/', '/src/api/nextjs-backend/'],
      collectCoverageFrom: ['src/**/*.ts', '!src/**/*.test.ts', '!src/**/*.d.ts'],
      coverageDirectory: 'coverage',
      coverageReporters: ['text', 'lcov'],
      coverageThreshold: {
        global: {
          statements: 70,
          branches: 55,
          functions: 70,
          lines: 70
        }
      },
      moduleNameMapper: defaultModuleNameMapper
    },
    {
      ...sharedOptions,
      displayName: 'nextjs-backend',
      rootDir: rootDir + '/src/api/nextjs-backend',
      testMatch: ['**/*.test.ts'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^uuid$': rootDir + '/__mocks__/uuid.js'
      }
    }
  ]
};
