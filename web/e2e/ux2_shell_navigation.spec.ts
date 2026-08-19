/**
 * UX2I2 — Responsive shell and primary navigation smoke.
 */

import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

import { navigateUx2Primary, openMoreAnd } from "./helpers/ux2_nav";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const usageBundleDir = path.join(webRoot, "public/debug-bundles/test_directional_bundle");
const installTimeoutMs = 90_000;
const DEBUG_BUNDLE_ID = "bundle_full_20260418_e1c98a70";
const THEME_KEY = "siralex.ui_theme";

test.describe("UX2I2 shell navigation", () => {
  test("mobile primary nav destinations and search-state preservation", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    page.on("dialog", (dialog) => dialog.accept());
    await installDebugBundle(page);
    await setUiLocale(page, "en");

    const mobileNav = page.locator(".ux2-primary-nav-host");
    await expect(mobileNav).toBeVisible();
    await expect(page.locator("#ux2AppShell")).toHaveAttribute("data-primary", "search");

    for (const destination of ["search", "saved", "review", "more"] as const) {
      const item = page.locator(`[data-testid="ux2-nav-${destination}"]`);
      await expect(item).toBeVisible();
      await expect(item.locator(".ux2-primary-nav-label")).toBeVisible();
      const box = await item.boundingBox();
      expect(box, `${destination} touch target`).toBeTruthy();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }

    await page.locator("#searchInput").fill("alpha_fr");
    await expect(page.locator("#searchResults .result-open").first()).toBeVisible({
      timeout: 15_000,
    });

    await navigateUx2Primary(page, "saved");
    await expect(page.locator("#saved-vocab-heading")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("#searchChrome")).toBeHidden();

    await navigateUx2Primary(page, "review");
    await expect(page.locator("#review-heading, .review-title").first()).toBeVisible({
      timeout: 15_000,
    });

    await navigateUx2Primary(page, "more");
    await expect(page.locator("#moreHeading")).toBeVisible();
    await expect(page.locator("#themeSelect")).toBeVisible();
    await expect(page.locator("#localeSelect")).toBeVisible();

    await page.locator("#themeSelect").selectOption("dark");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(await page.evaluate((key) => localStorage.getItem(key), THEME_KEY)).toBe("dark");

    await navigateUx2Primary(page, "search");
    await expect(page.locator("#searchChrome")).toBeVisible();
    await expect(page.locator("#searchInput")).toHaveValue("alpha_fr");
    await expect(page.locator("#searchResults .result-open").first()).toBeVisible();
  });

  test("desktop top nav and More management Back returns to More", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    page.on("dialog", (dialog) => dialog.accept());
    await installDebugBundle(page);
    await setUiLocale(page, "en");

    await expect(page.locator(".ux2-app-header .ux2-primary-nav")).toBeVisible();
    await expect(page.locator("#ux2Wordmark")).toBeVisible();
    await expect(page.locator("#ux2Wordmark")).toHaveAttribute(
      "aria-label",
      /SiraLex home|Accueil SiraLex/i,
    );
    const wordmarkMark = page.locator("#ux2Wordmark .ux2-wordmark-mark");
    await expect(wordmarkMark).toBeVisible();
    await expect(wordmarkMark).toHaveAttribute("src", "./logo/siralex-logo-mark-only.svg");
    await expect(wordmarkMark).toHaveAttribute("alt", "");
    await expect(page.locator("#ux2Wordmark .ux2-wordmark-text")).toHaveText("SiraLex");

    await navigateUx2Primary(page, "more");
    await expect(page.locator("#ux2AppShell")).toHaveAttribute("data-primary", "more");
    await page.locator("#ux2Wordmark").click();
    await expect(page.locator("#ux2AppShell")).toHaveAttribute("data-primary", "search");

    for (const destination of ["search", "saved", "review", "more"] as const) {
      await navigateUx2Primary(page, destination);
      await expect(
        page.locator(`[data-testid="ux2-nav-${destination}"]`),
      ).toHaveAttribute("aria-current", "page");
    }

    await openMoreAnd(page, "corrections");
    await expect(
      page.locator("[data-testid='correction-manage'], .correction-manage").first(),
    ).toBeVisible({ timeout: 15_000 });
    await page.locator(".correction-manage-back, [data-testid='correction-manage-back']").first().click();
    await expect(page.locator("#moreHeading")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("#ux2AppShell")).toHaveAttribute("data-primary", "more");

    await openMoreAnd(page, "search-feedback");
    await expect(
      page.locator("[data-testid='search-feedback-manage'], .search-feedback-manage").first(),
    ).toBeVisible({ timeout: 15_000 });
    await page
      .locator(".search-feedback-manage-back, [data-testid='search-feedback-manage-back']")
      .first()
      .click();
    await expect(page.locator("#moreHeading")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("#ux2AppShell")).toHaveAttribute("data-primary", "more");

    await expect(page.locator("#themeSelect")).toBeVisible();
    await expect(page.locator("#localeSelect")).toBeVisible();
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
