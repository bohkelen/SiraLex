/**
 * UX2I4 — Lexical Entry Detail presentation smoke.
 *
 * NKO_VISUAL_EVIDENCE_NOT_AVAILABLE_IN_E2E_FIXTURE
 * (debug directional bundle has no headword_nko_provided; N’Ko covered by unit tests)
 */

import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

import {
  ensureSourceToTarget,
  ensureTargetToSource,
  navigateUx2Primary,
  openMoreAnd,
} from "./helpers/ux2_nav";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const usageBundleDir = path.join(webRoot, "public/debug-bundles/test_directional_bundle");
const installTimeoutMs = 90_000;
const DEBUG_BUNDLE_ID = "bundle_full_20260418_e1c98a70";
const evidenceRoot = path.resolve(
  webRoot,
  "../data/local_evidence/ux2_entry_detail",
  new Date().toISOString().replace(/[:.]/g, "-"),
);

test.describe("UX2I4 lexical entry detail", () => {
  test("mobile lexicon entry, CF1 round-trip, Back, and Save", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    page.on("dialog", (dialog) => dialog.accept());
    await installDebugBundle(page);
    await setUiLocale(page, "en");

    await ensureTargetToSource(page);
    await page.locator("#searchInput").fill("alpha_mnk");
    await expect(page.locator("#searchResults .result-open").first()).toBeVisible({
      timeout: 15_000,
    });
    await page.locator("#searchResults .result-open").first().click();

    await expect(page.locator("#ux2AppShell")).toHaveAttribute("data-search-view", "entry");
    await expect(page.locator("#searchChrome")).toBeHidden();
    await expect(page.locator(".entry-back")).toBeVisible();
    await expect(page.locator(".entry-back")).toContainText(/Back to results/i);
    await expect(page.locator(".entry-headword")).toBeVisible();
    await expect(page.locator(".entry-headword")).toHaveText("alpha_mnk");
    await expect(page.locator(".entry-nko")).toHaveCount(0);

    const save = page.locator("#entry-learning-save");
    await expect(save).toBeVisible();
    await expect(save).toBeEnabled({ timeout: 15_000 });
    await expect(save).toContainText(/Save/);
    await save.click();
    await expect(save).toContainText(/Saved/, { timeout: 15_000 });
    await expect(save).toHaveAttribute("aria-pressed", "true");

    await expect(page.locator("#entry-suggest-correction")).toBeVisible();
    await page.locator("#entry-suggest-correction").click();
    await expect(page.locator("#correction-form-heading")).toBeVisible({ timeout: 15_000 });
    await page.locator("#correction-form-cancel").click();
    await expect(page.locator(".entry-headword")).toHaveText("alpha_mnk");
    await expect(page.locator("#ux2AppShell")).toHaveAttribute("data-search-view", "entry");
    await expect(save).toContainText(/Saved/);

    await mkdir(evidenceRoot, { recursive: true });
    await page.screenshot({
      path: path.join(evidenceRoot, "mobile-light-lexicon-entry.png"),
      fullPage: true,
    });

    await navigateUx2Primary(page, "more");
    await page.locator("#themeSelect").selectOption("dark");
    await navigateUx2Primary(page, "search");
    await ensureTargetToSource(page);
    await page.locator("#searchInput").fill("alpha_mnk");
    await expect(page.locator("#searchResults .result-open").first()).toBeVisible({
      timeout: 15_000,
    });
    await page.locator("#searchResults .result-open").first().click();
    await page.screenshot({
      path: path.join(evidenceRoot, "mobile-dark-lexicon-entry.png"),
      fullPage: true,
    });

    await page.locator(".entry-back").click();
    await expect(page.locator("#ux2AppShell")).toHaveAttribute("data-search-view", "search");
    await expect(page.locator("#searchChrome")).toBeVisible();
    await expect(page.locator("#searchInput")).toHaveValue("alpha_mnk");
    await expect(page.locator("#searchResults .result-open").first()).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflow).toBe(false);

    await writeFile(
      path.join(evidenceRoot, "NKO_VISUAL_EVIDENCE_NOT_AVAILABLE_IN_E2E_FIXTURE.txt"),
      "Debug directional fixture has no headword_nko_provided; N’Ko semantics covered by unit tests.\n",
      "utf8",
    );
  });

  test("mobile index mapping → direct target entry → Back", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    page.on("dialog", (dialog) => dialog.accept());
    await installDebugBundle(page);
    await setUiLocale(page, "en");

    await ensureSourceToTarget(page);
    await page.locator("#searchInput").fill("alpha_fr");
    await expect(page.locator("#searchResults .result-open").first()).toBeVisible({
      timeout: 15_000,
    });
    await page.locator("#searchResults .result-open").first().click();

    await expect(page.locator(".entry-index .entry-headword")).toHaveText("alpha_fr");
    await expect(page.locator("#entry-learning-save")).toHaveCount(0);
    await expect(page.locator("#entry-suggest-correction")).toHaveCount(0);
    const targets = page.locator(".entry-index button.target-link");
    await expect(targets).toHaveCount(1);
    await expect(targets.first()).toContainText("alpha_mnk");

    await mkdir(evidenceRoot, { recursive: true });
    await page.screenshot({
      path: path.join(evidenceRoot, "mobile-index-mapping.png"),
      fullPage: true,
    });

    await targets.first().click();
    await expect(page.locator(".entry-detail.entry-lexicon .entry-headword")).toHaveText(
      "alpha_mnk",
      { timeout: 15_000 },
    );
    await expect(page.locator("#searchInput")).toHaveValue("alpha_fr");
    await expect(page.locator("#searchSourceLanguage")).toHaveText(/Maninka/i);

    await page.locator(".entry-back").click();
    await expect(page.locator("#searchResults .result-open").first()).toBeVisible();
    await expect(page.locator("#searchInput")).toHaveValue("alpha_fr");
    await expect(page.locator("#ux2AppShell")).toHaveAttribute("data-search-view", "search");
  });

  test("Saved-origin Back copy and return path", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    page.on("dialog", (dialog) => dialog.accept());
    await installDebugBundle(page);
    await setUiLocale(page, "en");

    await ensureTargetToSource(page);
    await page.locator("#searchInput").fill("beta_mnk");
    await expect(page.locator("#searchResults .result-open").first()).toBeVisible({
      timeout: 15_000,
    });
    await page.locator("#searchResults .result-open").first().click();
    await expect(page.locator("#entry-learning-save")).toBeEnabled({ timeout: 15_000 });
    await page.locator("#entry-learning-save").click();
    await expect(page.locator("#entry-learning-save")).toContainText(/Saved/, { timeout: 15_000 });

    await navigateUx2Primary(page, "saved");
    await expect(page.locator("#saved-vocab-heading")).toBeVisible({ timeout: 15_000 });
    await page.locator(".saved-vocab-open").first().click();
    await expect(page.locator(".entry-headword")).toContainText("beta_mnk", { timeout: 15_000 });
    await expect(page.locator(".entry-back")).toContainText(/Back to saved/i);
    await page.locator(".entry-back").click();
    await expect(page.locator("#saved-vocab-heading")).toBeVisible({ timeout: 15_000 });
  });

  test("desktop reading pane with Search rail", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    page.on("dialog", (dialog) => dialog.accept());
    await installDebugBundle(page);
    await setUiLocale(page, "en");

    await ensureTargetToSource(page);
    await page.locator("#searchInput").fill("alpha_mnk");
    await expect(page.locator("#searchResults .result-open").first()).toBeVisible({
      timeout: 15_000,
    });
    await page.locator("#searchResults .result-open").first().click();

    await expect(page.locator("#searchChrome")).toBeVisible();
    await expect(page.locator(".ux2-app-header .ux2-primary-nav")).toBeVisible();
    await expect(page.locator(".entry-headword")).toBeVisible();

    const entryBox = await page.locator(".ux2-entry-container").boundingBox();
    expect(entryBox).toBeTruthy();
    expect(entryBox!.width).toBeLessThanOrEqual(860);

    await mkdir(evidenceRoot, { recursive: true });
    await page.screenshot({
      path: path.join(evidenceRoot, "desktop-light-lexicon-entry.png"),
      fullPage: true,
    });

    await navigateUx2Primary(page, "more");
    await page.locator("#themeSelect").selectOption("dark");
    await navigateUx2Primary(page, "search");
    await ensureTargetToSource(page);
    await page.locator("#searchInput").fill("alpha_mnk");
    await expect(page.locator("#searchResults .result-open").first()).toBeVisible({
      timeout: 15_000,
    });
    await page.locator("#searchResults .result-open").first().click();
    await page.screenshot({
      path: path.join(evidenceRoot, "desktop-dark-lexicon-entry.png"),
      fullPage: true,
    });

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflow).toBe(false);
  });
});

async function setUiLocale(page: Page, locale: "en" | "fr"): Promise<void> {
  await navigateUx2Primary(page, "more");
  const select = page.locator("#localeSelect");
  if ((await select.inputValue()) !== locale) {
    await select.selectOption(locale);
    await page.waitForLoadState("domcontentloaded");
    await navigateUx2Primary(page, "more");
    await expect(page.locator("#themeSelect")).toBeVisible({ timeout: 30_000 });
  }
  await navigateUx2Primary(page, "search");
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

async function installDebugBundle(page: Page): Promise<void> {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#app")).toBeVisible();

  const searchInput = page.locator("#searchInput");
  if (await searchInput.isEnabled()) {
    const active = await getActiveBundleId(page);
    if (active === DEBUG_BUNDLE_ID) return;
  }

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
    path.join(usageBundleDir, "bundle.manifest.json"),
    path.join(usageBundleDir, "records.jsonl"),
    path.join(usageBundleDir, "search_index.jsonl"),
  ];
  await Promise.all(files.map((file) => access(file)));

  await openManageDictionaries(page);
  await page.locator("#quickImportFiles").setInputFiles(files);
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
}
