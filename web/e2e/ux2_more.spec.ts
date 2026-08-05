/**
 * UX2I6A — More landing, preferences, and management routing smoke.
 *
 * DICTIONARY_VISUAL_MIGRATION_DEFERRED_TO_UX2I6B
 * LEARNING_DATA_VISUAL_MIGRATION_DEFERRED_TO_UX2I6B
 * CF1_CF2_VISUAL_MIGRATION_DEFERRED_TO_UX2I7
 */

import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

import {
  ensureTargetToSource,
  navigateUx2Primary,
  openMoreAnd,
} from "./helpers/ux2_nav";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const usageBundleDir = path.join(webRoot, "public/debug-bundles/test_directional_bundle");
const installTimeoutMs = 90_000;
const DEBUG_BUNDLE_ID = "bundle_full_20260418_e1c98a70";
const THEME_KEY = "siralex.ui_theme";
const LOCALE_KEY = "siralex.ui_locale";
const evidenceRoot = path.resolve(
  webRoot,
  "../data/local_evidence/ux2_more",
  new Date().toISOString().replace(/[:.]/g, "-"),
);

test.describe("UX2I6A More landing and preferences", () => {
  test("mobile More landing hierarchy, routes, theme, locale, search preserve", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    page.on("dialog", (dialog) => dialog.accept());
    await installDebugBundle(page);
    await setUiLocale(page, "en");

    await navigateUx2Primary(page, "more");
    await expect(page.locator("#ux2AppShell")).toHaveAttribute("data-primary", "more");
    await expect(page.locator("#ux2AppShell")).toHaveAttribute("data-more-view", "landing");
    await expect(page.locator("#moreHeading")).toBeVisible();
    await expect(page.locator("[data-testid='ux2-nav-more']")).toHaveAttribute(
      "aria-current",
      "page",
    );

    const sectionHeadings = page.locator(".ux2-more-section-heading");
    await expect(sectionHeadings).toHaveCount(4);
    await expect(sectionHeadings.nth(0)).toHaveText("Contribute");
    await expect(sectionHeadings.nth(1)).toHaveText("Dictionary & data");
    await expect(sectionHeadings.nth(2)).toHaveText("Preferences");
    await expect(sectionHeadings.nth(3)).toHaveText("About");

    await expect(page.locator("#openManageCorrections")).toBeVisible();
    await expect(page.locator("#openManageSearchFeedback")).toBeVisible();
    await expect(page.locator("#openManageDictionaries")).toBeVisible();
    await expect(page.locator("#openManageLearningData")).toBeVisible();
    await expect(page.locator("#themeSelect")).toBeVisible();
    await expect(page.locator("#localeSelect")).toBeVisible();
    await expect(page.locator(".ux2-more-about-version")).toContainText(/Version/i);
    await expect(page.locator(".ux2-more-about-local")).toContainText(
      /Dictionary stored on this device|No dictionary stored/i,
    );

    await expect(page.locator("#moreDestination")).not.toContainText(
      /Validation diagnostics|Developer tools|Delete database|community score|streak/i,
    );
    await expect(page.locator("#moreDestination #queryLoggingToggle")).toHaveCount(0);
    await expect(page.locator("#moreDestination #clearDb")).toHaveCount(0);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflow).toBe(false);

    await page.locator(".ux2-more-about-local").scrollIntoViewIfNeeded();
    const clearance = await page.evaluate(() => {
      const last = document.querySelector(".ux2-more-about-local");
      const nav = document.querySelector(".ux2-primary-nav");
      if (!(last instanceof HTMLElement) || !(nav instanceof HTMLElement)) return null;
      const lastBox = last.getBoundingClientRect();
      const navBox = nav.getBoundingClientRect();
      return navBox.top - lastBox.bottom;
    });
    expect(clearance).not.toBeNull();
    expect(clearance!).toBeGreaterThanOrEqual(8);

    await mkdir(evidenceRoot, { recursive: true });
    await page.screenshot({
      path: path.join(evidenceRoot, "mobile-light-more.png"),
      fullPage: true,
    });

    // Contribute routes
    await page.locator("#openManageCorrections").click();
    await expect(
      page.locator("[data-testid='correction-manage'], .correction-manage").first(),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("#ux2AppShell")).toHaveAttribute("data-primary", "more");
    await page.locator(".correction-manage-back, [data-testid='correction-manage-back']").first().click();
    await expect(page.locator("#moreHeading")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("#moreHeading")).toBeFocused();

    await page.locator("#openManageSearchFeedback").click();
    await expect(
      page.locator("[data-testid='search-feedback-manage'], .search-feedback-manage").first(),
    ).toBeVisible({ timeout: 15_000 });
    await page
      .locator(".search-feedback-manage-back, [data-testid='search-feedback-manage-back']")
      .first()
      .click();
    await expect(page.locator("#moreHeading")).toBeVisible({ timeout: 15_000 });

    // Dictionary bridge
    await page.locator("#openManageDictionaries").click();
    await expect(page.locator("#moreManagementHost")).toBeVisible();
    await expect(page.locator("#moreManagementBack")).toBeVisible();
    await expect(page.locator("#manageDictionariesPanel")).toBeVisible();
    await expect(page.locator("#ux2AppShell")).toHaveAttribute("data-more-view", "management");
    await expect(page.locator("[data-testid='ux2-nav-more']")).toHaveAttribute(
      "aria-current",
      "page",
    );
    await page.screenshot({
      path: path.join(evidenceRoot, "mobile-dictionaries-bridge.png"),
      fullPage: true,
    });
    await page.locator("#moreManagementBack").click();
    await expect(page.locator("#moreHeading")).toBeVisible();
    await expect(page.locator("#ux2AppShell")).toHaveAttribute("data-more-view", "landing");

    // Learning data bridge
    await page.locator("#openManageLearningData").click();
    await expect(page.locator("#moreManagementHost")).toBeVisible();
    await expect(page.locator("#learning-backup-heading")).toBeVisible({ timeout: 15_000 });
    await page.screenshot({
      path: path.join(evidenceRoot, "mobile-learning-data-bridge.png"),
      fullPage: true,
    });
    await page.locator("#moreManagementBack").click();
    await expect(page.locator("#moreHeading")).toBeVisible();

    // Theme smoke (UXT1 storage key preserved)
    await page.locator("#themeSelect").selectOption("light");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    expect(await page.evaluate((key) => localStorage.getItem(key), THEME_KEY)).toBe("light");

    await page.locator("#themeSelect").selectOption("dark");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(await page.evaluate((key) => localStorage.getItem(key), THEME_KEY)).toBe("dark");
    await page.screenshot({
      path: path.join(evidenceRoot, "mobile-dark-more.png"),
      fullPage: true,
    });

    await page.locator("#themeSelect").selectOption("system");
    expect(await page.evaluate((key) => localStorage.getItem(key), THEME_KEY)).toBe("system");

    // Search-state preservation across More
    await navigateUx2Primary(page, "search");
    await ensureTargetToSource(page);
    await page.locator("#searchInput").fill("alpha_mnk");
    await expect(page.locator("#searchResults .result-open").first()).toBeVisible({
      timeout: 15_000,
    });
    const resultCount = await page.locator("#searchResults .result-open").count();

    await navigateUx2Primary(page, "more");
    await expect(page.locator("#moreHeading")).toBeVisible();
    await navigateUx2Primary(page, "search");
    await expect(page.locator("#searchInput")).toHaveValue("alpha_mnk");
    await expect(page.locator("#searchResults .result-open")).toHaveCount(resultCount);

    // Locale FR smoke
    await navigateUx2Primary(page, "more");
    await page.locator("#localeSelect").selectOption("fr");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("#app")).toBeVisible({ timeout: 30_000 });
    expect(await page.evaluate((key) => localStorage.getItem(key), LOCALE_KEY)).toBe("fr");
    await navigateUx2Primary(page, "more");
    await expect(page.locator("#moreHeading")).toHaveText("Plus");
    await expect(page.locator("#more-contribute-heading")).toHaveText("Contribuer");
    await expect(page.locator("#openManageSearchFeedback .ux2-more-row-title")).toHaveText(
      "Retours de recherche",
    );
    await expect(page.locator("#localeSelect")).toHaveValue("fr");

    await page.locator("#localeSelect").selectOption("en");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("#app")).toBeVisible({ timeout: 30_000 });
  });

  test("desktop More two-column composition", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    page.on("dialog", (dialog) => dialog.accept());
    await installDebugBundle(page);
    await setUiLocale(page, "en");

    await navigateUx2Primary(page, "more");
    await page.locator("#themeSelect").selectOption("light");
    await expect(page.locator("#moreHeading")).toBeVisible();
    await expect(page.locator(".ux2-more-layout")).toBeVisible();

    const layout = await page.locator(".ux2-more-layout").evaluate((el) => {
      const style = getComputedStyle(el);
      return {
        display: style.display,
        columns: style.gridTemplateColumns,
      };
    });
    expect(layout.display).toBe("grid");
    expect(layout.columns.split(" ").length).toBeGreaterThanOrEqual(2);

    await mkdir(evidenceRoot, { recursive: true });
    await page.screenshot({
      path: path.join(evidenceRoot, "desktop-light-more.png"),
      fullPage: true,
    });

    await page.locator("#themeSelect").selectOption("dark");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.screenshot({
      path: path.join(evidenceRoot, "desktop-dark-more.png"),
      fullPage: true,
    });

    await openMoreAnd(page, "dictionaries");
    await expect(page.locator("#moreManagementBack")).toBeVisible();
    await page.locator("#moreManagementBack").click();
    await expect(page.locator("#moreHeading")).toBeVisible();

    await openMoreAnd(page, "learning-data");
    await expect(page.locator("#learning-backup-heading")).toBeVisible();
    await page.locator("#moreManagementBack").click();
    await expect(page.locator("#moreHeading")).toBeFocused();
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
  await expect(page.locator("#searchInput")).toBeEnabled({ timeout: installTimeoutMs });
}
