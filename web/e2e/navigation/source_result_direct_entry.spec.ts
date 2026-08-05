import path from "node:path";
import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

import { navigateUx2Primary, openMoreAnd } from "../helpers/ux2_nav";

/**
 * Post-LS1 — Source→Target target links open lexicon entries by ir_id
 * (no second search). Uses debug directional bundle.
 */

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const usageBundleDir = path.join(webRoot, "public/debug-bundles/test_directional_bundle");
const installTimeoutMs = 90_000;

test.describe("Source→Target direct entry navigation", () => {
  test("target link opens lexicon entry, switches direction, preserves query", async ({ page }) => {
    await installDebugBundle(page);
    await expect(page.locator("#searchInput")).toBeEnabled({ timeout: installTimeoutMs });

    // Stay in Source → Target (French → Maninka for this fixture).
    await expect(page.locator("#searchSourceLanguage")).toHaveText(/French|Français|Source/i);
    await expect(page.locator("#searchTargetLanguage")).toHaveText(/Maninka|Target|Cible/i);
    await expect(page.locator("#searchLabel")).toContainText(
      /French\s*→\s*Maninka|Source\s*→\s*Target|Source\s*→\s*Cible|Français\s*→\s*Maninka/,
    );

    await page.locator("#searchInput").fill("alpha_fr");
    await expect(page.locator("#searchResults .result-open").first()).toBeVisible({
      timeout: 15_000,
    });
    await page.locator("#searchResults .result-open").first().click();

    await expect(page.locator(".entry-index .target-link").first()).toBeVisible();
    await expect(page.locator("#searchInput")).toHaveValue("alpha_fr");

    await page.locator(".entry-index .target-link").first().click();

    await expect(page.locator(".entry-detail.entry-lexicon")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".entry-headword")).toContainText("alpha_mnk");
    await expect(page.locator("#entry-learning-save")).toBeVisible();
    await expect(page.locator("#searchSourceLanguage")).toHaveText(/Maninka|Target|Cible/i);
    await expect(page.locator("#searchTargetLanguage")).toHaveText(/French|Français|Source/i);
    await expect(page.locator("#searchLabel")).toContainText(
      /Maninka\s*→\s*French|Target\s*→\s*Source|Cible\s*→\s*Source|Maninka\s*→\s*Français/,
    );
    await expect(page.locator("#searchInput")).toHaveValue("alpha_fr");

    await page.locator(".entry-back").click();
    await expect(page.locator("#searchResults .result-open").first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator("#searchSourceLanguage")).toHaveText(/French|Français|Source/i);
    await expect(page.locator("#searchTargetLanguage")).toHaveText(/Maninka|Target|Cible/i);
    await expect(page.locator("#searchLabel")).toContainText(
      /French\s*→\s*Maninka|Source\s*→\s*Target|Source\s*→\s*Cible|Français\s*→\s*Maninka/,
    );
    await expect(page.locator("#searchInput")).toHaveValue("alpha_fr");
    await expect(page.locator("#searchResults")).toContainText(/alpha_fr|alpha_mnk/);
  });
});

async function installDebugBundle(page: Page): Promise<void> {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#app")).toBeVisible();

  const searchInput = page.locator("#searchInput");
  if (await searchInput.isEnabled()) {
    return;
  }

  const files = [
    path.join(usageBundleDir, "bundle.manifest.json"),
    path.join(usageBundleDir, "records.jsonl"),
    path.join(usageBundleDir, "search_index.jsonl"),
  ];
  await Promise.all(files.map((file) => access(file)));

  await openMoreAnd(page, "dictionaries");

  const quickImportInput = page.locator("#quickImportFiles");
  await expect(quickImportInput).toBeAttached();
  await quickImportInput.setInputFiles(files);
  await page.evaluate(() => {
    document.getElementById("quickImportFiles")?.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(page.locator("#importProgress")).toContainText(/Installing|Complete|already installed/i, {
    timeout: 30_000,
  });
  await navigateUx2Primary(page, "search");
  await expect(page.locator("#searchInput")).toBeEnabled({ timeout: installTimeoutMs });
}
