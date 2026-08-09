/**
 * ML1D3 — LookupMode-aware lexical gloss presentation (real browser).
 *
 * Fixture: public/debug-bundles/test_ml1d2_en_bundle (EN-capable, bilingual house).
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

test.describe("ML1D3 LookupMode lexical presentation", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    page.on("dialog", (dialog) => dialog.accept());
    await clearDbAndInstall(page, enBundleDir, EN_BUNDLE_ID);
    await setUiLocale(page, "en");
    await navigateUx2Primary(page, "search");
  });

  test("A: EN→MNK mapping→target prefers English gloss; Back restores EN→MNK", async ({
    page,
  }) => {
    const partner = page.locator('[data-testid="search-partner-language"]');

    await partner.selectOption("en");
    await page.locator("#searchInput").fill("house");
    await expect(page.locator(".ux2-result-row-mapping")).toBeVisible({ timeout: 10_000 });
    await page.locator(".ux2-result-row-mapping .result-open").click();
    await expect(page.locator(".ux2-entry-index")).toBeVisible();
    await page.locator(".ux2-entry-target-row").first().click();
    await expect(page.locator(".entry-headword")).toHaveText(/house_mnk/i, { timeout: 10_000 });
    const enGloss = page.locator('[data-testid="entry-gloss"]').first();
    await expect(enGloss).toHaveAttribute("data-gloss-lang", "en");
    await expect(enGloss).toHaveText("house");
    await clickEntryBack(page);
    await expect(page.locator("#searchLabel")).toContainText(/English\s*→\s*Maninka/i);
    await expect(partner).toHaveValue("en");
  });

  test("B: FR→MNK mapping→target prefers French gloss; Back restores FR→MNK", async ({
    page,
  }) => {
    const partner = page.locator('[data-testid="search-partner-language"]');

    await partner.selectOption("fr");
    await page.locator("#searchInput").fill("maison");
    await expect(page.locator(".ux2-result-row-mapping")).toBeVisible({ timeout: 10_000 });
    await page.locator(".ux2-result-row-mapping .result-open").click();
    await expect(page.locator(".ux2-entry-index")).toBeVisible();
    await page.locator(".ux2-entry-target-row").first().click();
    await expect(page.locator(".entry-headword")).toHaveText(/house_mnk/i, { timeout: 10_000 });
    const frGloss = page.locator('[data-testid="entry-gloss"]').first();
    await expect(frGloss).toHaveAttribute("data-gloss-lang", "fr");
    await expect(frGloss).toHaveText("maison");
    await clickEntryBack(page);
    await expect(page.locator("#searchLabel")).toContainText(/French\s*→\s*Maninka/i);
  });

  test("ML1D3A: stale EN mapping→target ignores later FR picker", async ({ page }) => {
    const partner = page.locator('[data-testid="search-partner-language"]');

    await partner.selectOption("en");
    await page.locator("#searchInput").fill("house");
    await expect(page.locator(".ux2-result-row-mapping")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(".ux2-result-row-mapping .result-found-entry")).toHaveText(
      /house/i,
    );

    // Without a new query: switch live partner to FR.
    await partner.selectOption("fr");
    await expect(partner).toHaveValue("fr");
    await expect(page.locator(".ux2-result-row-mapping")).toBeVisible();

    await page.locator(".ux2-result-row-mapping .result-open").click();
    await expect(page.locator(".ux2-entry-index")).toBeVisible();
    await page.locator(".ux2-entry-target-row").first().click();
    await expect(page.locator(".entry-headword")).toHaveText(/house_mnk/i, { timeout: 10_000 });
    const gloss = page.locator('[data-testid="entry-gloss"]').first();
    await expect(gloss).toHaveAttribute("data-gloss-lang", "en");
    await expect(gloss).toHaveText("house");
    await expect(gloss).not.toHaveText(/maison/i);

    await clickEntryBack(page);
    await expect(page.locator("#searchLabel")).toContainText(/English\s*→\s*Maninka/i);
    await expect(partner).toHaveValue("en");
  });

  test("ML1D3A: stale FR mapping→target ignores later EN picker", async ({ page }) => {
    const partner = page.locator('[data-testid="search-partner-language"]');

    await partner.selectOption("fr");
    await page.locator("#searchInput").fill("maison");
    await expect(page.locator(".ux2-result-row-mapping")).toBeVisible({ timeout: 10_000 });

    await partner.selectOption("en");
    await expect(partner).toHaveValue("en");
    await expect(page.locator(".ux2-result-row-mapping")).toBeVisible();

    await page.locator(".ux2-result-row-mapping .result-open").click();
    await expect(page.locator(".ux2-entry-index")).toBeVisible();
    await page.locator(".ux2-entry-target-row").first().click();
    await expect(page.locator(".entry-headword")).toHaveText(/house_mnk/i, { timeout: 10_000 });
    const gloss = page.locator('[data-testid="entry-gloss"]').first();
    await expect(gloss).toHaveAttribute("data-gloss-lang", "fr");
    await expect(gloss).toHaveText("maison");

    await clickEntryBack(page);
    await expect(page.locator("#searchLabel")).toContainText(/French\s*→\s*Maninka/i);
    await expect(partner).toHaveValue("fr");
  });

  test("C/D: MNK→EN and MNK→FR lexicon result glosses", async ({ page }) => {
    await page.locator("#langToggle").click();
    await expect(page.locator("#searchSourceLanguage")).toHaveText(/Maninka/i);

    await page
      .locator("#searchTargetLanguage")
      .locator('[data-testid="search-partner-language"]')
      .selectOption("en");
    await page.locator("#searchInput").fill("house_mnk");
    const mnkEnGloss = page.locator(
      '.ux2-result-row-lexicon [data-testid="result-gloss"]',
    );
    await expect(mnkEnGloss).toHaveAttribute("data-gloss-lang", "en", { timeout: 10_000 });
    await expect(mnkEnGloss).toHaveText("house");
    await page.locator(".ux2-result-row-lexicon .result-open").click();
    await expect(page.locator('[data-testid="entry-gloss"]').first()).toHaveAttribute(
      "data-gloss-lang",
      "en",
    );
    await clickEntryBack(page);
    await expect(page.locator("#searchLabel")).toContainText(/Maninka\s*→\s*English/i);

    await page
      .locator("#searchTargetLanguage")
      .locator('[data-testid="search-partner-language"]')
      .selectOption("fr");
    await page.locator("#searchInput").fill("house_mnk");
    const mnkFrGloss = page.locator(
      '.ux2-result-row-lexicon [data-testid="result-gloss"]',
    );
    await expect(mnkFrGloss).toHaveAttribute("data-gloss-lang", "fr", { timeout: 10_000 });
    await expect(mnkFrGloss).toHaveText("maison");
  });

  test("staleness: partner switch does not relabel settled EN results", async ({ page }) => {
    await page.locator("#langToggle").click();
    await page
      .locator("#searchTargetLanguage")
      .locator('[data-testid="search-partner-language"]')
      .selectOption("en");
    await page.locator("#searchInput").fill("house_mnk");
    await expect(
      page.locator('.ux2-result-row-lexicon [data-testid="result-gloss"]'),
    ).toHaveText("house", { timeout: 10_000 });

    await page
      .locator("#searchTargetLanguage")
      .locator('[data-testid="search-partner-language"]')
      .selectOption("fr");
    await expect(
      page.locator('.ux2-result-row-lexicon [data-testid="result-gloss"]'),
    ).toHaveText("house");
    await expect(
      page.locator('.ux2-result-row-lexicon [data-testid="result-gloss"]'),
    ).toHaveAttribute("data-gloss-lang", "en");
  });

  test("E: French UI + EN lookup keeps English lexical gloss", async ({ page }) => {
    await setUiLocale(page, "fr");
    await navigateUx2Primary(page, "search");
    await page.locator("#langToggle").click();
    await page
      .locator("#searchTargetLanguage")
      .locator('[data-testid="search-partner-language"]')
      .selectOption("en");
    await page.locator("#searchInput").fill("house_mnk");
    await expect(
      page.locator('.ux2-result-row-lexicon [data-testid="result-gloss"]'),
    ).toHaveText("house", { timeout: 10_000 });
    await expect(page.locator("#searchLabel")).toContainText(/Maninka/i);
  });
});

async function clickEntryBack(page: Page): Promise<void> {
  const back = page.locator(".ux2-entry-back");
  await expect(back).toBeVisible();
  await back.click({ force: true });
  await expect(page.locator("#searchInput")).toBeVisible();
}

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
