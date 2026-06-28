import { defineConfig } from "vitest/config";

/**
 * Opt-in Vitest profile for rollout checks under web/tools/.
 * Root vitest.config.ts excludes tools/** so `npm run test` stays fast.
 */
export default defineConfig({
  root: ".",
  test: {
    include: ["tools/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    testTimeout: 180_000,
  },
});
