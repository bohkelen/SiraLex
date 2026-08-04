import { defineConfig, devices } from "@playwright/test";

/**
 * FH1 handoff smoke uses a dedicated build output so VITE_FEEDBACK_EMAIL=review@example.org
 * never overwrites the production dist/ artifact.
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: /feedback_handoff\.spec\.ts/,
  timeout: 900_000,
  expect: {
    timeout: 30_000,
  },
  fullyParallel: false,
  outputDir: "test-results/handoff-automation",
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4174",
    trace: "off",
    screenshot: "only-on-failure",
  },
  webServer: {
    command:
      "VITE_FEEDBACK_EMAIL=review@example.org node ./node_modules/vite/bin/vite.js build --outDir dist-handoff-e2e && node ./node_modules/vite/bin/vite.js preview --outDir dist-handoff-e2e --host 127.0.0.1 --port 4174",
    url: "http://127.0.0.1:4174",
    reuseExistingServer: false,
    timeout: 180_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
