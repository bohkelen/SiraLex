/**
 * RL1 — Russian consumer-surface removal (real browser).
 *
 * Fixture: public/debug-bundles/test_ml1d2_en_bundle (FR+EN+RU on house_mnk).
 * Proves Search/Entry suppress RU and Suggest Correction omits RU targets.
 */

import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

import { navigateUx2Primary, openMoreAnd } from "./helpers/ux2_nav";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const enBundleDir = path.join(webRoot, "public/debug-bundles/test_ml1d2_en_bundle");
const EN_BUNDLE_ID = "bundle_ml1d2_en_debug_v1";
const installTimeoutMs = 90_000;
const RU_MARKERS = ["дом"];

test.describe("RL1 Russian consumer surfaces removed", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    page.on("dialog", (dialog) => dialog.accept());
    await clearDbAndInstall(page, enBundleDir, EN_BUNDLE_ID);
    await setUiLocale(page, "en");
    await navigateUx2Primary(page, "search");
  });

  test("A: EN→MNK result shows English gloss and never Russian", async ({ page }) => {
    const partner = page.locator('[data-testid="search-partner-language"]');
    await partner.selectOption("en");
    await page.locator("#searchInput").fill("house");
    await expect(page.locator(".ux2-result-row-mapping")).toBeVisible({ timeout: 10_000 });
    await page.locator(".ux2-result-row-mapping .result-open").click();
    await expect(page.locator(".ux2-entry-index")).toBeVisible();
    await page.locator(".ux2-entry-target-row").first().click();
    await expect(page.locator(".entry-headword")).toHaveText(/house_mnk/i, { timeout: 10_000 });

    const gloss = page.locator('[data-testid="entry-gloss"]').first();
    await expect(gloss).toHaveAttribute("data-gloss-lang", "en");
    await expect(gloss).toHaveText("house");
    for (const marker of RU_MARKERS) {
      await expect(gloss).not.toContainText(marker);
    }
    await expect(page.locator(".ux2-entry-sense").first()).not.toContainText("дом");
  });

  test("B: FR→MNK result shows French gloss and never Russian", async ({ page }) => {
    const partner = page.locator('[data-testid="search-partner-language"]');
    await partner.selectOption("fr");
    await page.locator("#searchInput").fill("maison");
    await expect(page.locator(".ux2-result-row-mapping")).toBeVisible({ timeout: 10_000 });
    await page.locator(".ux2-result-row-mapping .result-open").click();
    await expect(page.locator(".ux2-entry-index")).toBeVisible();
    await page.locator(".ux2-entry-target-row").first().click();
    await expect(page.locator(".entry-headword")).toHaveText(/house_mnk/i, { timeout: 10_000 });

    const gloss = page.locator('[data-testid="entry-gloss"]').first();
    await expect(gloss).toHaveAttribute("data-gloss-lang", "fr");
    await expect(gloss).toHaveText("maison");
    await expect(page.locator(".ux2-entry-sense").first()).not.toContainText("дом");
  });

  test("C: Entry detail suppresses sense RU and example trans_ru", async ({ page }) => {
    const partner = page.locator('[data-testid="search-partner-language"]');
    await partner.selectOption("en");
    await page.locator("#searchInput").fill("house");
    await expect(page.locator(".ux2-result-row-mapping")).toBeVisible({ timeout: 10_000 });
    await page.locator(".ux2-result-row-mapping .result-open").click();
    await page.locator(".ux2-entry-target-row").first().click();
    await expect(page.locator(".entry-headword")).toHaveText(/house_mnk/i, { timeout: 10_000 });

    await expect(page.locator('[data-testid="entry-gloss"]').first()).toHaveText("house");
    const exampleTrans = page.locator('[data-testid="entry-example-trans"]').first();
    await expect(exampleTrans).toBeVisible();
    await expect(exampleTrans).toHaveText("a house");
    await expect(exampleTrans).not.toContainText("дом");
    await expect(page.locator(".ux2-entry-sense").first()).not.toContainText("дом");
  });

  test("D: Suggest Correction offers FR+EN meanings but not Russian", async ({ page }) => {
    const partner = page.locator('[data-testid="search-partner-language"]');
    await partner.selectOption("en");
    await page.locator("#searchInput").fill("house");
    await expect(page.locator(".ux2-result-row-mapping")).toBeVisible({ timeout: 10_000 });
    await page.locator(".ux2-result-row-mapping .result-open").click();
    await page.locator(".ux2-entry-target-row").first().click();
    await expect(page.locator(".entry-headword")).toHaveText(/house_mnk/i, { timeout: 10_000 });

    await page.locator("#entry-suggest-correction").click();
    await expect(page.locator("[data-testid='correction-form']")).toBeVisible();
    const target = page.locator("#correction-form-target");
    await expect(target).toBeVisible();

    const optionTexts = await target.locator("option").allTextContents();
    expect(optionTexts.some((t) => /French meaning/i.test(t))).toBe(true);
    expect(optionTexts.some((t) => /English meaning/i.test(t))).toBe(true);
    expect(optionTexts.some((t) => /Russian meaning|Traduction russe/i.test(t))).toBe(false);
    expect(optionTexts.some((t) => t.includes("дом"))).toBe(false);

    const optionValues = await target.locator("option").evaluateAll((opts) =>
      opts.map((o) => (o as HTMLOptionElement).value),
    );
    expect(optionValues).toContain("translation:0:fr");
    expect(optionValues).toContain("translation:0:en");
    expect(optionValues).not.toContain("translation:0:ru");
  });
});

async function setUiLocale(page: Page, locale: "en" | "fr"): Promise<void> {
  await page.evaluate((next) => {
    localStorage.setItem("siralex.ui_locale", next);
  }, locale);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("#app")).toBeVisible();
}

async function openManageDictionaries(page: Page): Promise<void> {
  await openMoreAnd(page, "dictionaries");
}

async function getActiveBundleId(page: Page): Promise<string | undefined> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("siralex_db");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    try {
      return await new Promise<string | undefined>((resolve, reject) => {
        const tx = db.transaction("meta", "readonly");
        const req = tx.objectStore("meta").get("active_bundle_id");
        req.onsuccess = () => resolve(req.result as string | undefined);
        req.onerror = () => reject(req.error);
      });
    } finally {
      db.close();
    }
  });
}

async function clearDbAndInstall(
  page: Page,
  bundleDir: string,
  expectedBundleId: string,
): Promise<void> {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#app")).toBeVisible();

  const searchInput = page.locator("#searchInput");
  if (await searchInput.isEnabled()) {
    page.once("dialog", (d) => d.accept());
    await openManageDictionaries(page);
    if (await page.locator("#clearDb").isVisible()) {
      await page.locator("#clearDb").click();
      await expect(page.locator("#importProgress")).toContainText(/deleted|supprim/i, {
        timeout: 30_000,
      });
    }
  }

  const files = [
    path.join(bundleDir, "bundle.manifest.json"),
    path.join(bundleDir, "records.jsonl"),
    path.join(bundleDir, "search_index.jsonl"),
  ];
  await Promise.all(files.map((file) => access(file)));

  await openManageDictionaries(page);
  const quickImportInput = page.locator("#quickImportFiles");
  await expect(quickImportInput).toBeAttached();
  await quickImportInput.setInputFiles(files);
  await page.evaluate(() => {
    document
      .getElementById("quickImportFiles")
      ?.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(page.locator("#importProgress")).toContainText(
    /Installing|Complete|already installed/i,
    { timeout: 30_000 },
  );
  await navigateUx2Primary(page, "search");
  await expect(page.locator("#searchInput")).toBeEnabled({ timeout: installTimeoutMs });
  await expect.poll(async () => getActiveBundleId(page)).toBe(expectedBundleId);
}
