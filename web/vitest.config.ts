import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // One-off rollout validation: run with
    // `vitest run -c vitest.tools.config.ts` (see norm_v3_matrix_runner.test.ts).
    exclude: ["**/node_modules/**", "**/dist/**", "**/tools/**", "**/e2e/**"],
  },
});
