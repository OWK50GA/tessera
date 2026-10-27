import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    /* Run tests in Node — no DOM needed for the core package */
    environment: "node",

    /* Glob patterns */
    include: ["tests/**/*.test.ts"],
    exclude: ["node_modules", "dist"],

    /* Always show individual test names */
    reporter: "verbose",

    /* Global timeout — N=4 generation can take up to ~30 s per puzzle.
       Individual tests that need more override via { timeout: ... }. */
    testTimeout: 90_000,

    /* Coverage via v8 (opt-in with pnpm test:coverage) */
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/index.ts"],
      reporter: ["text", "lcov"],
      reportsDirectory: "./coverage",
    },
  },
});
