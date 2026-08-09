import { defineConfig, devices } from "@playwright/test";

/**
 * ML1D2A1 — Picker E2E uses a dedicated build so VITE_E2E_TEST_HOOKS=true
 * never overwrites the ordinary production dist/ artifact.
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: /ml1d[23]_.*\.spec\.ts/,
  timeout: 900_000,
  expect: {
    timeout: 30_000,
  },
  fullyParallel: false,
  outputDir: "test-results/ml1d-picker",
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4175",
    trace: "off",
    screenshot: "only-on-failure",
  },
  webServer: {
    command:
      "VITE_E2E_TEST_HOOKS=true node ./node_modules/vite/bin/vite.js build --outDir dist-ml1d2-e2e && node ./node_modules/vite/bin/vite.js preview --outDir dist-ml1d2-e2e --host 127.0.0.1 --port 4175",
    url: "http://127.0.0.1:4175",
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
