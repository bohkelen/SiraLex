import { defineConfig, devices } from "@playwright/test";

/**
 * PVR1 — Theme + Feedback Production Re-Smoke against the live HTTPS host.
 * Override with SIRALEX_PRODUCTION_URL when needed.
 */
const productionUrl = (
  process.env.SIRALEX_PRODUCTION_URL?.trim() ||
  "https://loquacious-piroshki-be432c.netlify.app"
).replace(/\/$/, "");

export default defineConfig({
  testDir: "./e2e/pvr1",
  timeout: 2_700_000,
  expect: {
    timeout: 30_000,
  },
  fullyParallel: false,
  workers: 1,
  outputDir: "test-results/pvr1",
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
