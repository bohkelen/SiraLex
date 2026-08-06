/**
 * UX2I6B1 — Dictionary management consumer surface smoke.
 *
 * LEARNING_DATA_VISUAL_MIGRATION_DEFERRED_TO_UX2I6B2
 * PACKAGE_INSTALL_UX2_E2E_NOT_AVAILABLE (no public .siralex.zip fixture)
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
const evidenceRoot = path.resolve(
  webRoot,
  "../data/local_evidence/ux2_dictionaries",
  new Date().toISOString().replace(/[:.]/g, "-"),
);

test.describe("UX2I6B1 dictionary management", () => {
  test("mobile installed Dictionaries hierarchy, Advanced, Back, Learning Data separation", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    page.on("dialog", (dialog) => dialog.accept());
    await installDebugBundle(page);
    await setUiLocale(page, "en");

    await openMoreAnd(page, "dictionaries");
    await expect(page.locator("#ux2AppShell")).toHaveAttribute("data-primary", "more");
    await expect(page.locator("#ux2AppShell")).toHaveAttribute(
      "data-more-management",
      "dictionaries",
    );
    await expect(page.locator("[data-testid='ux2-nav-more']")).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.locator("#dictionary-management-heading")).toBeVisible();
    await expect(page.locator("#dictionary-management-heading")).toBeFocused();
    await expect(page.locator("#dictionary-management-heading")).toHaveText("Dictionaries");
    await expect(page.locator("#dictionaries-installed-heading")).toBeVisible();
    await expect(page.locator("#dictionaries-add-heading")).toBeVisible();
    await expect(page.locator("#packageImport")).toBeVisible();
    await expect(page.locator("#bundleSelect")).toBeVisible();

    await expect(page.locator("#learningDataSurface")).toBeHidden();
    await expect(page.locator("#learningDataSurface #learning-backup-heading")).toBeHidden();

    const advanced = page.locator("#dictionariesAdvanced");
    await expect(advanced).toBeVisible();
    expect(await advanced.evaluate((el) => (el as HTMLDetailsElement).open)).toBe(false);

    await advanced.locator(":scope > summary").click();
    expect(await advanced.evaluate((el) => (el as HTMLDetailsElement).open)).toBe(true);
    await expect(page.locator("#catalogUrl")).toBeVisible();
    await expect(page.locator("#quickImport")).toBeVisible();
    await expect(page.locator("#dictionariesAdvanced")).toContainText(/Advanced diagnostics|Developer/i);

    await mkdir(evidenceRoot, { recursive: true });
    await page.screenshot({
      path: path.join(evidenceRoot, "mobile-light-dictionaries-advanced.png"),
      fullPage: true,
    });
    await advanced.locator(":scope > summary").click();

    await expect(page.locator(".ux2-dict-row-title").first()).toBeVisible();
    await expect(page.locator(".ux2-dict-row-active").first()).toBeVisible();
    // Delete DB remains below Advanced on Dictionaries (not on Learning Data).
    await expect(page.locator("#dictionariesDestructive")).toBeVisible();
    await expect(page.locator("#clearDb")).toBeVisible();
    await expect(page.locator("#dictionariesDestructive")).toContainText(
      /whole local database|not the same as removing one dictionary/i,
    );
    // Closed Advanced: Diagnostics / Developer tools are not peer open controls.
    await expect(page.locator("#queryLoggingToggle")).not.toBeVisible();
    await expect(page.locator("#dictionaryManagementSurface")).not.toContainText(
      /Manage dictionaries \(optional\)/i,
    );

    await page.screenshot({
      path: path.join(evidenceRoot, "mobile-light-dictionaries-installed.png"),
      fullPage: true,
    });

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflow).toBe(false);

    await page.locator("#clearDb").scrollIntoViewIfNeeded();
    const clearance = await page.evaluate(() => {
      const last = document.querySelector("#clearDb");
      const nav = document.querySelector(".ux2-primary-nav");
      if (!(last instanceof HTMLElement) || !(nav instanceof HTMLElement)) return null;
      return nav.getBoundingClientRect().top - last.getBoundingClientRect().bottom;
    });
    expect(clearance).not.toBeNull();
    expect(clearance!).toBeGreaterThanOrEqual(0);

    await page.locator("#moreManagementBack").click();
    await expect(page.locator("#moreHeading")).toBeVisible();
    await page.locator("#themeSelect").selectOption("dark");
    await openMoreAnd(page, "dictionaries");
    await page.screenshot({
      path: path.join(evidenceRoot, "mobile-dark-dictionaries-installed.png"),
      fullPage: true,
    });

    await page.locator("#moreManagementBack").click();
    await expect(page.locator("#moreHeading")).toBeFocused();
    await expect(page.locator("#ux2AppShell")).toHaveAttribute("data-more-view", "landing");
    await page.locator("#themeSelect").selectOption("light");

    await openMoreAnd(page, "learning-data");
    await expect(page.locator("#learning-backup-heading")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("#dictionaryManagementSurface")).toBeHidden();
    await expect(page.locator("#ux2AppShell")).toHaveAttribute(
      "data-more-management",
      "learning-data",
    );
  });

  test("empty Dictionaries state without Learning Backup UI", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    page.on("dialog", (dialog) => dialog.accept());
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await setUiLocale(page, "en");

    // Prefer Remove over Delete Database so parallel workers do not block IndexedDB.deleteDatabase.
    await openMoreAnd(page, "dictionaries");
    while ((await page.locator(".ux2-dict-action-remove").count()) > 0) {
      await page.locator(".ux2-dict-action-remove").first().click();
      await page.waitForTimeout(400);
    }
    await expect(page.locator(".ux2-dict-empty-lead")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(".ux2-dict-empty-lead")).toContainText(/No dictionaries installed/i);
    await expect(page.locator("#packageImport")).toBeVisible();
    await expect(page.locator("#learningDataSurface")).toBeHidden();
    await expect(page.locator("[data-testid='ux2-nav-search']")).toBeVisible();

    await mkdir(evidenceRoot, { recursive: true });
    await page.screenshot({
      path: path.join(evidenceRoot, "mobile-light-dictionaries-empty.png"),
      fullPage: true,
    });
  });

  test("desktop Dictionaries composition and Advanced reachability", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    page.on("dialog", (dialog) => dialog.accept());
    await installDebugBundle(page);
    await setUiLocale(page, "en");

    await openMoreAnd(page, "dictionaries");
    await expect(page.locator("#dictionary-management-heading")).toBeVisible();
    const layout = await page.locator(".ux2-dict-layout").evaluate((el) => getComputedStyle(el).display);
    expect(layout).toBe("grid");

    await mkdir(evidenceRoot, { recursive: true });
    await page.screenshot({
      path: path.join(evidenceRoot, "desktop-light-dictionaries-installed.png"),
      fullPage: true,
    });

    await page.locator("#moreManagementBack").click();
    await page.locator("#themeSelect").selectOption("dark");
    await openMoreAnd(page, "dictionaries");
    await page.screenshot({
      path: path.join(evidenceRoot, "desktop-dark-dictionaries-installed.png"),
      fullPage: true,
    });

    // Search-state preservation across Dictionaries without active-bundle change
    await page.locator("#moreManagementBack").click();
    await navigateUx2Primary(page, "search");
    await ensureTargetToSource(page);
    await page.locator("#searchInput").fill("alpha_mnk");
    await expect(page.locator("#searchResults .result-open").first()).toBeVisible({
      timeout: 15_000,
    });
    const count = await page.locator("#searchResults .result-open").count();
    await openMoreAnd(page, "dictionaries");
    await page.locator("#moreManagementBack").click();
    await navigateUx2Primary(page, "search");
    await expect(page.locator("#searchInput")).toHaveValue("alpha_mnk");
    await expect(page.locator("#searchResults .result-open")).toHaveCount(count);
  });

  test("bundle removal retains Learning / CF1 / CF2 personal records", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    page.on("dialog", (dialog) => dialog.accept());
    await installDebugBundle(page);
    await setUiLocale(page, "en");

    await navigateUx2Primary(page, "search");
    await ensureTargetToSource(page);
    await page.locator("#searchInput").fill("alpha_mnk");
    await expect(page.locator("#searchResults .result-open").first()).toBeVisible({
      timeout: 15_000,
    });
    await page.locator("#searchResults .result-open").first().click();
    await expect(page.locator(".entry-headword")).toContainText("alpha_mnk", { timeout: 15_000 });
    const save = page.locator("#entry-learning-save");
    await expect(save).toBeEnabled({ timeout: 15_000 });
    if ((await save.getAttribute("aria-pressed")) !== "true") {
      await save.click();
      await expect(save).toHaveAttribute("aria-pressed", "true", { timeout: 15_000 });
    }
    await page.locator("#entry-suggest-correction").click();
    await page.locator("#correction-form-issue").selectOption("spelling");
    await page.locator("#correction-form-target").selectOption({ index: 1 });
    await page.locator("#correction-form-description").fill("UX2I6B1 retention draft");
    await page.locator("#correction-form-save").click();
    await expect(page.locator("#correction-form-success-heading")).toBeVisible({ timeout: 15_000 });

    await navigateUx2Primary(page, "search");
    await ensureSourceToTargetSafe(page);
    await page.locator("#searchInput").fill("zzzz_ux2i6b1_miss");
    await page.waitForTimeout(300);
    await page.locator("[data-testid='search-feedback-report']").click();
    await page.locator("[data-testid='search-feedback-meaning']").fill("needed");
    await page.locator("[data-testid='search-feedback-save']").click();
    await expect(page.locator("#search-feedback-capture-heading")).toContainText(/saved/i, {
      timeout: 15_000,
    });

    const learningBefore = await countStore(page, "learning_records");
    const correctionsBefore = await countStore(page, "correction_drafts");
    const feedbackBefore = await countStore(page, "search_failure_feedback");
    expect(learningBefore).toBeGreaterThan(0);
    expect(correctionsBefore).toBeGreaterThan(0);
    expect(feedbackBefore).toBeGreaterThan(0);

    await openMoreAnd(page, "dictionaries");
    await page.locator(".ux2-dict-action-remove").first().click();
    await expect(page.locator(".ux2-dict-empty-lead")).toBeVisible({ timeout: 30_000 });

    expect(await countStore(page, "learning_records")).toBe(learningBefore);
    expect(await countStore(page, "correction_drafts")).toBe(correctionsBefore);
    expect(await countStore(page, "search_failure_feedback")).toBe(feedbackBefore);

    await openMoreAnd(page, "corrections");
    await expect(
      page.locator("[data-testid='correction-manage-row'], .correction-manage-row-button").first(),
    ).toBeVisible({ timeout: 15_000 });
    await page.locator(".correction-manage-back, [data-testid='correction-manage-back']").first().click();

    await openMoreAnd(page, "search-feedback");
    await expect(
      page.locator("[data-testid='search-feedback-manage-row'], .search-feedback-manage-row-button").first(),
    ).toBeVisible({ timeout: 15_000 });
  });
});

async function countStore(page: Page, storeName: string): Promise<number> {
  return page.evaluate(async (store) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("siralex_db");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    try {
      if (![...db.objectStoreNames].includes(store)) return 0;
      return await new Promise<number>((resolve, reject) => {
        const tx = db.transaction(store, "readonly");
        const req = tx.objectStore(store).count();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    } finally {
      db.close();
    }
  }, storeName);
}

async function ensureSourceToTargetSafe(page: Page): Promise<void> {
  const from = ((await page.locator("#searchSourceLanguage").textContent()) ?? "").trim();
  if (/Maninka|Target|Cible|^mnk$/i.test(from)) {
    await page.locator("#langToggle").click();
  }
}

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
    await openMoreAnd(page, "dictionaries");
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

  await openMoreAnd(page, "dictionaries");
  await page.locator("#dictionariesAdvanced").evaluate((el) => {
    if (el instanceof HTMLDetailsElement) el.open = true;
  });
  await page.locator("#quickImportFiles").setInputFiles(files);
  await page.evaluate(() => {
    document
      .getElementById("quickImportFiles")
      ?.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(page.locator("#searchInput")).toBeEnabled({ timeout: installTimeoutMs });
}
