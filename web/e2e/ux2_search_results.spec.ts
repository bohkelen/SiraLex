/**
 * UX2I3 — Search Home and Search Results presentation smoke.
 */

import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

import { navigateUx2Primary, openMoreAnd } from "./helpers/ux2_nav";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const usageBundleDir = path.join(webRoot, "public/debug-bundles/test_directional_bundle");
const installTimeoutMs = 90_000;
const DEBUG_BUNDLE_ID = "bundle_full_20260418_e1c98a70";
const evidenceRoot = path.resolve(
  webRoot,
  "../data/local_evidence/ux2_search_results",
  new Date().toISOString().replace(/[:.]/g, "-"),
);

test.describe("UX2I3 Search Home and Results", () => {
  test("mobile Search Home, results, CF2, and no-result", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    page.on("dialog", (dialog) => dialog.accept());
    await installDebugBundle(page);
    await setUiLocale(page, "en");

    await expect(page.locator("#ux2AppShell")).toHaveAttribute("data-primary", "search");
    await expect(page.locator("#searchHeading")).toBeAttached();
    await expect(page.locator("#searchSourceLanguage")).toBeVisible();
    await expect(page.locator("#searchTargetLanguage")).toBeVisible();
    await expect(page.locator("#searchSourceLanguage")).toHaveText(/French|Français/i);
    await expect(page.locator("#searchTargetLanguage")).toHaveText(/Maninka/i);
    await expect(page.locator("#langToggle")).toBeVisible();

    const swapBox = await page.locator("#langToggle").boundingBox();
    expect(swapBox, "swap touch target").toBeTruthy();
    expect(swapBox!.width).toBeGreaterThanOrEqual(44);
    expect(swapBox!.height).toBeGreaterThanOrEqual(44);

    const inputBox = await page.locator("#searchInput").boundingBox();
    const chromeBox = await page.locator("#searchChrome").boundingBox();
    expect(inputBox && chromeBox).toBeTruthy();
    expect(inputBox!.width / chromeBox!.width).toBeGreaterThan(0.7);

    // Ready-state diagnostics remain in the DOM for compatibility but must not be
    // visible or available to ordinary assistive technology (UX2I8).
    await expect(page.locator("#dictStatus")).not.toBeInViewport();
    await expect(page.locator("#activeDictionarySummary")).not.toBeInViewport();
    await expect(page.locator("#searchChrome .ux2-search-setup-copy")).not.toBeInViewport();
    await expect(page.locator("#dictStatus")).toHaveAttribute("aria-hidden", "true");
    await expect(page.locator("#dictStatus")).toBeHidden();
    await expect(page.locator("#activeDictionaryRow")).toHaveAttribute("aria-hidden", "true");
    await expect(page.locator("#activeDictionaryRow")).toBeHidden();
    await expect(page.locator("#searchChrome .ux2-search-setup-copy")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    await expect(page.locator("#dbOut")).toBeHidden();
    await expect(page.locator("#searchChrome #openManageDictionaries")).toHaveCount(0);
    await expect(page.locator("#moreDestination")).toBeHidden();

    await page.locator("#searchInput").fill("alpha_fr");
    await expect(page.locator("#searchResults .result-open").first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator("#searchMeta")).toContainText(/\d+\s+results/i);
    await expect(page.locator(".ux2-result-row").first()).toBeVisible();

    await expect(
      page.locator("[data-testid='search-feedback-entry-results-not-useful']"),
    ).toHaveCount(1);
    await expect(
      page.locator(
        "[data-testid='search-feedback-entry-results-not-useful'] [data-testid='search-feedback-report']",
      ),
    ).toContainText(/Tell us what you were looking for/i);

    const cta = page.locator(
      "[data-testid='search-feedback-entry-results-not-useful'] [data-testid='search-feedback-report']",
    );
    await cta.scrollIntoViewIfNeeded();
    await expect(cta).toBeInViewport();

    await mkdir(evidenceRoot, { recursive: true });
    await page.screenshot({
      path: path.join(evidenceRoot, "mobile-light-results.png"),
      fullPage: true,
    });

    await navigateUx2Primary(page, "more");
    await page.locator("#themeSelect").selectOption("dark");
    await navigateUx2Primary(page, "search");
    await expect(page.locator("#searchResults .result-open").first()).toBeVisible();
    await page.screenshot({
      path: path.join(evidenceRoot, "mobile-dark-results.png"),
      fullPage: true,
    });

    await navigateUx2Primary(page, "more");
    await page.locator("#themeSelect").selectOption("light");
    await navigateUx2Primary(page, "search");
    await page.locator("#searchInput").fill("");
    await expect(page.locator("#searchResults .result-open")).toHaveCount(0);
    await page.screenshot({
      path: path.join(evidenceRoot, "mobile-light-search-home.png"),
      fullPage: true,
    });

    await page.locator("#searchInput").fill("zzzz_ux2i3_miss");
    await expect(page.locator("#searchMeta")).toContainText(/No results/i, {
      timeout: 15_000,
    });
    await expect(
      page.locator("[data-testid='search-feedback-entry-no-result']"),
    ).toBeVisible();
    await expect(
      page.locator(
        "[data-testid='search-feedback-entry-no-result'] [data-testid='search-feedback-report']",
      ),
    ).toBeVisible();
    await page.screenshot({
      path: path.join(evidenceRoot, "mobile-no-result.png"),
      fullPage: true,
    });
  });

  test("desktop Search rail and More→Search state preservation", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    page.on("dialog", (dialog) => dialog.accept());
    await installDebugBundle(page);
    await setUiLocale(page, "en");

    const chromeBox = await page.locator("#searchChrome").boundingBox();
    const resultsBox = await page.locator("#searchResults").boundingBox();
    expect(chromeBox && resultsBox).toBeTruthy();
    expect(chromeBox!.x).toBeLessThan(resultsBox!.x);
    expect(chromeBox!.width).toBeGreaterThanOrEqual(286);
    expect(chromeBox!.width).toBeLessThanOrEqual(320);

    await page.locator("#searchInput").fill("alpha_fr");
    await expect(page.locator("#searchResults .result-open").first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator("#searchMeta")).toContainText(/\d+\s+results/i);

    await navigateUx2Primary(page, "more");
    await expect(page.locator("#moreHeading")).toBeVisible();
    await navigateUx2Primary(page, "search");
    await expect(page.locator("#searchInput")).toHaveValue("alpha_fr");
    await expect(page.locator("#searchResults .result-open").first()).toBeVisible();
    await expect(page.locator(".ux2-app-header .ux2-primary-nav")).toBeVisible();

    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
    });
    expect(overflow).toBe(false);

    await mkdir(evidenceRoot, { recursive: true });
    await page.screenshot({
      path: path.join(evidenceRoot, "desktop-light-results.png"),
      fullPage: true,
    });

    await navigateUx2Primary(page, "more");
    await page.locator("#themeSelect").selectOption("dark");
    await navigateUx2Primary(page, "search");
    await page.screenshot({
      path: path.join(evidenceRoot, "desktop-dark-results.png"),
      fullPage: true,
    });
  });

  test("SQ1B prefix suggestions on exact miss, not on exact hit", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    page.on("dialog", (dialog) => dialog.accept());
    await installDebugBundle(page);
    await setUiLocale(page, "en");

    await page.locator("#searchInput").fill("a");
    await expect(page.locator("#searchMeta")).toContainText(/No results/i, { timeout: 15_000 });
    await expect(page.locator("[data-testid='search-suggestions']")).toHaveCount(0);

    await page.locator("#searchInput").fill("al");
    await expect(page.locator("#searchMeta")).toContainText(/No results/i, { timeout: 15_000 });
    await expect(page.locator("[data-testid='search-suggestions']")).toHaveCount(0);

    await page.locator("#searchInput").fill("alp");
    await expect(page.locator("#searchMeta")).toHaveText(/No exact match/i, { timeout: 15_000 });
    await expect(page.locator("[data-testid='search-suggestions']")).toBeVisible();
    await expect(page.locator("[data-testid='search-suggestion']").first()).toContainText("alpha_fr");
    await expect(
      page.locator("[data-testid='search-feedback-entry-no-result']"),
    ).toBeVisible();

    await page.locator("[data-testid='search-suggestion']").first().click();
    await expect(page.locator("#searchInput")).toHaveValue("alpha_fr");
    await expect(page.locator("#searchResults .result-open").first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator("[data-testid='search-suggestions']")).toHaveCount(0);

    await page.locator("#searchInput").fill("alpha_fr");
    await expect(page.locator("#searchResults .result-open").first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator("[data-testid='search-suggestions']")).toHaveCount(0);
  });

  test("SQ1C1 hyphen/space variant hit shows results without suggestions", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    page.on("dialog", (dialog) => dialog.accept());
    await installDebugBundle(page);
    await setUiLocale(page, "en");

    await page.locator("#searchInput").fill("bon-travail");
    await expect(page.locator("#searchResults .result-open").first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator("#searchMeta")).toHaveText(/Showing results for "bon travail"/i);
    await expect(page.locator("[data-testid='search-suggestions']")).toHaveCount(0);
    await expect(
      page.locator("[data-testid='search-feedback-entry-results-not-useful']"),
    ).toHaveCount(1);
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
