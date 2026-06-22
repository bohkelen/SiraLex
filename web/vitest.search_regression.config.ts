import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/search_regression/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    testTimeout: 180_000,
  },
});
