import path from "node:path";
import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

import { navigateUx2Primary, openMoreAnd } from "../helpers/ux2_nav";

/**
 * LS1I4 — minimal offline Saved Vocabulary browser verification.
 * Uses the local debug directional bundle (not the featured full package).
 *
 * Soft-orphan browser scenario is intentionally omitted: no clean production
 * test seam exists without debug-only controls. Soft orphans are covered by
 * IndexedDB lifecycle / session tests.
 */

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const usageBundleDir = path.join(webRoot, "public/debug-bundles/test_directional_bundle");
const installTimeoutMs = 90_000;
const offlineTimeoutMs = 30_000;

test.describe("LS1 offline Saved Vocabulary", () => {
  test("save → reload offline → list → open → remove persists", async ({ page, context }) => {
    page.on("dialog", (dialog) => dialog.accept());

    await installDebugBundle(page);
    await expect(page.locator("#searchInput")).toBeEnabled({ timeout: installTimeoutMs });
    await expect(page.locator("#openSavedVocabulary")).toBeVisible();

    // Target → source so we open a lexicon_entry directly.
    await page.locator("#langToggle").click();
    await page.locator("#searchInput").fill("alpha_mnk");
    await expect(page.locator("#searchResults .result-open").first()).toBeVisible({
      timeout: 15_000,
    });
    await page.locator("#searchResults .result-open").first().click();

    await expect(page.locator("#entry-learning-save")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("#entry-learning-save")).toBeEnabled({ timeout: 15_000 });
    await expect(page.locator("#entry-learning-save")).toContainText(/Save|Enregistrer/);

    await page.locator("#entry-learning-save").click();
    await expect(page.locator("#entry-learning-save")).toContainText(/Saved|Enregistré/, {
      timeout: 15_000,
    });

    await page.locator("#openSavedVocabulary").click();
    await expect(page.locator("#saved-vocab-heading")).toBeVisible();
    await expect(page.locator(".saved-vocab-list .saved-vocab-row")).toHaveCount(1, {
      timeout: 15_000,
    });
    await expect(page.locator(".saved-vocab-primary")).toContainText("alpha_mnk");

    // Reload offline — Learning Records + installed dictionary must remain.
    await context.setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded", timeout: offlineTimeoutMs });
    await expect(page.locator("#searchInput")).toBeEnabled({ timeout: offlineTimeoutMs });

    await page.locator("#openSavedVocabulary").click();
    await expect(page.locator(".saved-vocab-list .saved-vocab-row")).toHaveCount(1, {
      timeout: 15_000,
    });

    await page.locator(".saved-vocab-open").click();
    await expect(page.locator(".entry-headword")).toContainText("alpha_mnk");
    await expect(page.locator("#entry-learning-save")).toContainText(/Saved|Enregistré/, {
      timeout: 15_000,
    });

    await page.locator(".entry-back").click();
    await expect(page.locator("#saved-vocab-heading")).toBeVisible();

    await page.locator(".saved-vocab-remove").click();
    await expect(page.locator(".saved-vocab-list .saved-vocab-row")).toHaveCount(0, {
      timeout: 15_000,
    });
    await expect(page.locator(".saved-vocab-status")).toContainText(/No saved words|Aucun mot/, {
      timeout: 15_000,
    });

    await page.reload({ waitUntil: "domcontentloaded", timeout: offlineTimeoutMs });
    await expect(page.locator("#searchInput")).toBeEnabled({ timeout: offlineTimeoutMs });
    await page.locator("#openSavedVocabulary").click();
    await expect(page.locator(".saved-vocab-list .saved-vocab-row")).toHaveCount(0, {
      timeout: 15_000,
    });
    await expect(page.locator(".saved-vocab-status")).toContainText(/No saved words|Aucun mot/);
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
  await expect(page.locator("#activeDictionarySummary")).not.toContainText(
    /No dictionary added|Aucun dictionnaire ajouté/,
    { timeout: 30_000 },
  );
}
