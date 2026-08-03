import { defineConfig, devices } from "@playwright/test";

/**
 * PV1A targets the live HTTPS production host (no local vite preview webServer).
 * Override with SIRALEX_PRODUCTION_URL when needed.
 */
const productionUrl = (
  process.env.SIRALEX_PRODUCTION_URL?.trim() ||
  "https://loquacious-piroshki-be432c.netlify.app"
).replace(/\/$/, "");

export default defineConfig({
  testDir: "./e2e/pv1a",
  timeout: 900_000,
  expect: {
    timeout: 30_000,
  },
  fullyParallel: false,
  workers: 1,
  outputDir: "test-results/pv1a",
  reporter: [["list"]],
  use: {
    baseURL: productionUrl,
    trace: "off",
    screenshot: "only-on-failure",
    ignoreHTTPSErrors: false,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
