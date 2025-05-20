/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.test.ts"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.json",
      },
    ],
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  setupFiles: ["<rootDir>/src/__tests__/setup.ts"],
  // Force exit after tests complete to prevent hanging
  forceExit: true,
  // Set a reasonable default timeout for all tests
  testTimeout: 10000,
  // Clean up any remaining handles after tests
  detectOpenHandles: true,
  // Ignore standard directories
  testPathIgnorePatterns: ["/node_modules/", "/dist/", "/coverage/"],
};
