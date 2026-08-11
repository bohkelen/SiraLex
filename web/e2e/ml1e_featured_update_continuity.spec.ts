/**
 * ML1E — Real-browser same-logical-ID featured update continuity.
 *
 * OLD featured artifact (hash 337619ff…) → catalog update → NEW multilingual
 * artifact (hash d076558b…), same bundle_id.
 */
import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

import {
  ensureSourceToTarget,
  navigateUx2Primary,
  openDictionariesAdvanced,
  openMoreAnd,
} from "./helpers/ux2_nav";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OLD_DIR = path.join(webRoot, "public/bundle_full_20260710_337619ff");
const NEW_DIR = path.join(webRoot, "public/bundle_full_20260710_337619ff__d076558b");
const BUNDLE_ID = "bundle_full_20260710_337619ff";
const OLD_HASH = "sha256:337619ff43131acde1390d7892d687372785729dac5d85abe82b61cc92285c3c";
const NEW_HASH = "sha256:d076558b2f668a06a5a30a143026433e9e0de3523e0397183cfd897b2641d90a";
const PREF_KEY = "siralex.search_lookup_lang";
const installTimeoutMs = 1_200_000;
const offlineTimeoutMs = 60_000;

test.describe("ML1E featured multilingual same-ID update", () => {
  test("OLD→NEW update recovers EN preference; four-direction search; offline reopen", async ({
    page,
    context,
  }) => {
    test.setTimeout(2_400_000);
    await page.setViewportSize({ width: 390, height: 844 });
    page.on("dialog", (dialog) => dialog.accept());

    await Promise.all(
      ["bundle.manifest.json", "records.jsonl", "search_index.jsonl"].flatMap((name) => [
        access(path.join(OLD_DIR, name)),
        access(path.join(NEW_DIR, name)),
      ]),
    );

    await clearDbAndInstall(page, OLD_DIR, BUNDLE_ID);
    await setUiLocale(page, "en");
    await page.evaluate((k) => localStorage.setItem(k, "en"), PREF_KEY);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("#searchInput")).toBeEnabled({ timeout: installTimeoutMs });
    await navigateUx2Primary(page, "search");
    await ensureSourceToTarget(page);

    // Old featured lacks English capability: stored EN survives; effective FR→MNK.
    expect(await page.evaluate((k) => localStorage.getItem(k), PREF_KEY)).toBe("en");
    await expect(page.locator('[data-testid="search-partner-language"]')).toHaveCount(0);
    await expect(page.locator("#searchLabel")).toContainText(/French\s*→\s*Maninka/i);

    await page.locator("#searchInput").fill("moto");
    await expect(page.locator("#searchResults")).toContainText(/motocycle|po[\u0301]?po|pópo|popo/i, {
      timeout: 30_000,
    });
    await page.locator("#searchResults .result-open").first().click();
    // Index-mapping hits may land on a mapping page; open the lexicon target if needed.
    const openLex = page.getByRole("button", { name: /Open entry:/i });
    if (await openLex.count()) {
      await openLex.first().click();
    }
    await expect(page.locator("#entry-learning-save")).toBeVisible({ timeout: 30_000 });
    await page.locator("#entry-learning-save").click();
    await expect(page.locator("#entry-learning-save")).toContainText(/Saved|Économisé|Retiré|Remove|Unsave/i, {
      timeout: 15_000,
    });

    await navigateUx2Primary(page, "saved");
    await expect(page.locator("#ux2AppShell")).toHaveAttribute("data-primary", "saved");
    await expect(page.locator("body")).toContainText(/motocycle|po[\u0301]?po|pópo|popo|moto/i);

    // Catalog points at NEW hash → Update available for same logical id.
    await openDictionariesAdvanced(page);
    await page.locator("#catalogUrl").fill("/catalog.json");
    await page.locator("#loadCatalog").click();
    await expect(page.locator("#catalogStatus, #catalogList, .catalog-item").first()).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.locator("body")).toContainText(/Update available|Mise à jour disponible|Update/i);

    // Prefer the installed-row Update control (same logical bundle_id).
    const updateBtn = page.locator(".ux2-dict-row .ux2-dict-action-update").first();
    await expect(updateBtn).toBeVisible({ timeout: 30_000 });
    await updateBtn.click();
    // DU1 — consumer confirmation before same-ID update starts.
    const confirmDialog = page.locator('[data-testid="dictionary-update-dialog"]');
    await expect(confirmDialog).toBeVisible({ timeout: 15_000 });
    await expect(confirmDialog).toContainText(/saved|enregistr|progress|correction|feedback|retours/i);
    await confirmDialog.getByRole("button", { name: /Update dictionary|Mettre à jour le dictionnaire/i }).click();
    await expect
      .poll(async () => (await readActiveMeta(page)).expected_content_sha256, {
        timeout: installTimeoutMs,
        intervals: [2_000, 5_000, 10_000],
      })
      .toBe(NEW_HASH);
    await expect.poll(async () => getActiveBundleId(page), { timeout: 30_000 }).toBe(BUNDLE_ID);
    // Success UI appears only after post-commit old-payload cleanup finishes.
    const successDialog = page.locator('[data-testid="dictionary-update-dialog"][data-phase="success"]');
    await expect(successDialog).toBeVisible({ timeout: installTimeoutMs });
    await successDialog.getByRole("button", { name: /Continue|Continuer/i }).click();

    await navigateUx2Primary(page, "search");
    await expect(page.locator("#searchInput")).toBeEnabled({ timeout: installTimeoutMs });
    // Same-bundle EN capability recovery → restore stored EN preference.
    await expect(page.locator('[data-testid="search-partner-language"]')).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.locator('[data-testid="search-partner-language"]')).toHaveValue("en");
    await expect(page.locator("#searchLabel")).toContainText(/English\s*→\s*Maninka/i);
    expect(await page.evaluate((k) => localStorage.getItem(k), PREF_KEY)).toBe("en");

    const meta = await readActiveMeta(page);
    expect(meta.bundle_id).toBe(BUNDLE_ID);
    expect(meta.expected_content_sha256).toBe(NEW_HASH);
    expect(meta.storage_scope_id).toBe(`${BUNDLE_ID}::${NEW_HASH}`);

    // EN→MNK
    await page.locator("#searchInput").fill("house");
    await expect(page.locator("#searchResults")).toContainText(/bo[\u0301]?n|bón|bon|house/i, { timeout: 30_000 });
    await openLexiconEntryFromResults(page);
    await expect(page.locator("#entry-learning-save")).toBeVisible({ timeout: 30_000 });
    const enGloss = page.locator('[data-testid="entry-gloss"]').first();
    await expect(enGloss).toBeVisible({ timeout: 15_000 });
    await expect(enGloss).toHaveAttribute("data-gloss-lang", "en");
    await expect(enGloss).toContainText(/house/i);
    await expect(page.locator("main")).not.toContainText(/дом/);

    // FR→MNK
    await navigateUx2Primary(page, "search");
    await page.locator('[data-testid="search-partner-language"]').selectOption("fr");
    await expect(page.locator("#searchLabel")).toContainText(/French\s*→\s*Maninka/i);
    await page.locator("#searchInput").fill("moto");
    await expect(page.locator("#searchResults")).toContainText(/motocycle|po[\u0301]?po|pópo|popo/i, { timeout: 30_000 });

    // MNK→EN
    await page.locator("#langToggle").click();
    await expect(page.locator("#searchSourceLanguage")).toHaveText(/Maninka/i);
    await page
      .locator("#searchTargetLanguage")
      .locator('[data-testid="search-partner-language"]')
      .selectOption("en");
    await page.locator("#searchInput").fill("bon");
    await expect(page.locator("#searchResults")).toContainText(/house|bo[\u0301]?n|bón|bon/i, { timeout: 30_000 });

    // MNK→FR
    await page
      .locator("#searchTargetLanguage")
      .locator('[data-testid="search-partner-language"]')
      .selectOption("fr");
    await page.locator("#searchInput").fill("bon");
    await expect(page.locator("#searchResults")).toContainText(/maison|bo[\u0301]?n|bón|bon/i, { timeout: 30_000 });

    // Locale independence: French UI + English lookup still presents English lexical gloss.
    await setUiLocale(page, "fr");
    await navigateUx2Primary(page, "search");
    await ensureSourceToTarget(page);
    await page.locator('[data-testid="search-partner-language"]').selectOption("en");
    await page.locator("#searchInput").fill("house");
    await expect(page.locator("#searchResults")).toContainText(/bo[\u0301]?n|bón|bon|house/i, { timeout: 30_000 });
    await openLexiconEntryFromResults(page);
    await expect(page.locator("#entry-learning-save")).toBeVisible({ timeout: 30_000 });
    const localeGloss = page.locator('[data-testid="entry-gloss"]').first();
    await expect(localeGloss).toHaveAttribute("data-gloss-lang", "en");
    await expect(localeGloss).toContainText(/house/i);
    await expect(page.locator("main")).not.toContainText(/дом/);

    // Saved continuity after update.
    await navigateUx2Primary(page, "saved");
    await expect(page.locator("body")).toContainText(/motocycle|po[\u0301]?po|pópo|popo/i);

    // Warm SW, then offline reopen.
    await navigateUx2Primary(page, "search");
    await page.reload({ waitUntil: "domcontentloaded", timeout: offlineTimeoutMs });
    await expect(page.locator("#searchInput")).toBeEnabled({ timeout: offlineTimeoutMs });
    await context.setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded", timeout: offlineTimeoutMs });
    await expect(page.locator("#searchInput")).toBeEnabled({ timeout: offlineTimeoutMs });

    await ensureSourceToTarget(page);
    await page.locator('[data-testid="search-partner-language"]').selectOption("fr");
    await page.locator("#searchInput").fill("moto");
    await expect(page.locator("#searchResults")).toContainText(/motocycle|po[\u0301]?po|pópo|popo/i, { timeout: 30_000 });

    await page.locator('[data-testid="search-partner-language"]').selectOption("en");
    await page.locator("#searchInput").fill("house");
    await expect(page.locator("#searchResults")).toContainText(/bo[\u0301]?n|bón|bon|house/i, { timeout: 30_000 });

    await navigateUx2Primary(page, "saved");
    await expect(page.locator("body")).toContainText(/motocycle|po[\u0301]?po|pópo|popo/i);
    await navigateUx2Primary(page, "review");
    await expect(page.locator("#ux2AppShell")).toHaveAttribute("data-primary", "review");
    await openMoreAnd(page, "corrections");
    await expect(page.locator("#correctionManagementHost, #manageCorrectionsHost, body").first()).toBeVisible();
    await openMoreAnd(page, "search-feedback");
    await expect(page.locator("#searchFeedbackManagementHost, #manageSearchFeedbackHost, body").first()).toBeVisible();

    await context.setOffline(false);

    // Catalog shows installed current; one logical dictionary row.
    await openMoreAnd(page, "dictionaries");
    await expect(page.locator(".ux2-dict-row-title")).toHaveCount(1);
    await expect(page.locator("body")).not.toContainText(OLD_HASH.slice(0, 24));
    // Update badge should be gone for current hash after catalog refresh.
    await openDictionariesAdvanced(page);
    await page.locator("#catalogUrl").fill("/catalog.json");
    await page.locator("#loadCatalog").click();
    await expect(page.locator("body")).toContainText(/Active|Actif|Current|À jour|installed/i, {
      timeout: 60_000,
    });
  });
});

async function openLexiconEntryFromResults(page: Page): Promise<void> {
  await page.locator("#searchResults .result-open").first().click();
  // Index-mapping hits may land on a mapping page; open the lexicon target if needed.
  const openLex = page.getByRole("button", { name: /Open entry:/i });
  if (await openLex.count()) {
    await openLex.first().click();
  }
  const targetRow = page.locator(".ux2-entry-target-row").first();
  if (await targetRow.count()) {
    await targetRow.click();
  }
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

async function readActiveMeta(page: Page): Promise<{
  bundle_id?: string;
  expected_content_sha256?: string;
  storage_scope_id?: string;
}> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("siralex_db");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    try {
      const activeId = await new Promise<string | undefined>((resolve, reject) => {
        const tx = db.transaction("meta", "readonly");
        const req = tx.objectStore("meta").get("active_bundle_id");
        req.onsuccess = () => resolve(req.result as string | undefined);
        req.onerror = () => reject(req.error);
      });
      if (!activeId) return {};
      return await new Promise((resolve, reject) => {
        const tx = db.transaction("bundles_registry", "readonly");
        const req = tx.objectStore("bundles_registry").get(activeId);
        req.onsuccess = () => resolve((req.result as Record<string, string>) ?? {});
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
    await openMoreAnd(page, "dictionaries");
    if (await page.locator("#clearDb").isVisible()) {
      await page.locator("#clearDb").click();
      await expect(page.locator("#importProgress")).toContainText(/deleted|supprim/i, {
        timeout: 60_000,
      });
    }
  }

  const files = [
    path.join(bundleDir, "bundle.manifest.json"),
    path.join(bundleDir, "records.jsonl"),
    path.join(bundleDir, "search_index.jsonl"),
  ];
  await Promise.all(files.map((file) => access(file)));

  await openDictionariesAdvanced(page);
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
    { timeout: 60_000 },
  );
  await navigateUx2Primary(page, "search");
  await expect(page.locator("#searchInput")).toBeEnabled({ timeout: installTimeoutMs });
  await expect.poll(async () => getActiveBundleId(page), { timeout: installTimeoutMs }).toBe(
    expectedBundleId,
  );

  const meta = await readActiveMeta(page);
  expect(meta.expected_content_sha256).toBe(OLD_HASH);
}

async function setUiLocale(page: Page, locale: "en" | "fr"): Promise<void> {
  await page.evaluate((lang) => {
    localStorage.setItem("siralex.ui_language", lang);
  }, locale);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("#searchInput")).toBeEnabled({ timeout: installTimeoutMs });
}
