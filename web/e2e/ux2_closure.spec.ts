/**
 * UX2I8 — UX2 integration / accessibility / boundary closure audit.
 *
 * Audit suite: representative contracts, not a duplicate of every surface E2E.
 */

import { access, mkdir } from "node:fs/promises";
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
const NO_RESULT_QUERY = "zzzz_ux2i8_nohit";
const MOBILE = { width: 390, height: 844 } as const;
const DESKTOP = { width: 1280, height: 800 } as const;
const evidenceRoot = path.resolve(
  webRoot,
  "../data/local_evidence/ux2_closure",
  new Date().toISOString().replace(/[:.]/g, "-"),
);

test.describe("UX2I8 closure audit", () => {
  test.describe.configure({ timeout: 180_000 });

  test("ready-state a11y, Advanced boundary, Delete DB copy, nav + search preserve", async ({
    page,
  }) => {
    page.setDefaultTimeout(30_000);
    await page.setViewportSize(MOBILE);
    page.on("dialog", (dialog) => dialog.accept());
    await installDebugBundle(page);
    await setUiLocale(page, "en");

    // --- Ready-state accessibility ---
    await expect(page.locator("#searchChrome")).toHaveAttribute("data-search-ready", "true");
    await expect(page.locator("#dictStatus")).toBeHidden();
    await expect(page.locator("#dictStatus")).toHaveAttribute("aria-hidden", "true");
    await expect(page.locator("#activeDictionaryRow")).toBeHidden();
    await expect(page.locator("#activeDictionaryRow")).toHaveAttribute("aria-hidden", "true");
    await expect(page.locator(".ux2-search-setup-copy")).toBeHidden();
    await expect(page.locator(".ux2-search-setup-copy")).toHaveAttribute("aria-hidden", "true");
    const readyDisplay = await page.locator("#dictStatus").evaluate((el) => getComputedStyle(el).display);
    expect(readyDisplay).toBe("none");

    await expect(page.locator("[data-testid='ux2-nav-search']")).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expectNoHorizontalOverflow(page);

    await mkdir(evidenceRoot, { recursive: true });
    await page.screenshot({
      path: path.join(evidenceRoot, "mobile-light-search.png"),
      fullPage: false,
    });

    // --- Search state preservation ---
    await ensureSourceToTarget(page);
    await page.locator("#searchInput").fill("alpha_fr");
    await expect(page.locator("#searchResults .result-open").first()).toBeVisible({
      timeout: 15_000,
    });
    await navigateUx2Primary(page, "more");
    await navigateUx2Primary(page, "search");
    await expect(page.locator("#searchInput")).toHaveValue("alpha_fr");
    await expect(page.locator("#searchResults .result-open").first()).toBeVisible();

    // --- CF2 capture back to Search ---
    await page.locator("#searchInput").fill(NO_RESULT_QUERY);
    await expect(page.locator("[data-testid='search-feedback-entry-no-result']")).toBeVisible({
      timeout: 15_000,
    });
    await page.locator("[data-testid='search-feedback-report']").click();
    await expect(page.locator(".ux2-search-feedback-capture")).toBeVisible();
    await expect(page.locator("[data-testid='search-feedback-capture']")).not.toContainText(
      /Suggest a correction|Pending corrections/i,
    );
    await page.screenshot({
      path: path.join(evidenceRoot, "mobile-light-cf2.png"),
      fullPage: false,
    });
    await page.locator("[data-testid='search-feedback-cancel']").click();
    await expect(page.locator("#searchInput")).toHaveValue(NO_RESULT_QUERY);

    // --- Entry → CF1 cancel (authoritative CF1 E2E covers deep lifecycle) ---
    await ensureTargetToSource(page);
    await page.locator("#searchInput").fill("alpha_mnk");
    await expect(page.locator("#searchResults .result-open").first()).toBeVisible({
      timeout: 15_000,
    });
    await page.locator("#searchResults .result-open").first().click();
    await expect(page.locator("#ux2AppShell")).toHaveAttribute("data-search-view", "entry", {
      timeout: 15_000,
    });
    await expect(page.locator("#entry-suggest-correction")).toBeVisible({ timeout: 15_000 });
    await page.locator("#entry-suggest-correction").click();
    await expect(page.locator(".ux2-correction-form")).toBeVisible();
    await page.locator("#correction-form-cancel").click();
    await expect(page.locator("#entry-suggest-correction")).toBeVisible();
    await page.locator(".entry-back").click();
    await expect(page.locator("#ux2AppShell")).toHaveAttribute("data-primary", "search");
    await expect(page.locator("#ux2AppShell")).toHaveAttribute("data-search-view", "search");

    // --- More → Dictionaries Advanced / Delete DB boundary ---
    await openMoreAnd(page, "dictionaries");
    await expect(page.locator("#dictionary-management-heading")).toBeFocused();
    await expect(page.locator("#moreDestination")).toBeHidden();
    await expect(page.locator("#dictionariesAdvanced")).toBeVisible();
    expect(
      await page.locator("#dictionariesAdvanced").evaluate((el) => (el as HTMLDetailsElement).open),
    ).toBe(false);
    await expect(page.locator("#queryLoggingToggle")).not.toBeVisible();
    await expect(page.locator("#clearDb")).toBeVisible();
    await expect(page.locator("#dictionariesDestructive")).toContainText(
      /whole local database|not the same as removing one dictionary/i,
    );
    await expect(page.locator("#dictionariesDestructive")).not.toContainText(/Remove dictionary/i);

    await page.locator("#dictionariesAdvanced > summary").click();
    await expect(page.locator("#catalogUrl")).toBeVisible();
    await expect(
      page.locator("#dictionariesAdvanced .ux2-more-legacy-advanced").first().locator(":scope > summary"),
    ).toBeVisible();
    await page
      .locator("#dictionariesAdvanced .ux2-more-legacy-advanced")
      .first()
      .locator(":scope > summary")
      .click();
    await expect(page.locator("#queryLoggingToggle")).toBeVisible();
    await page.screenshot({
      path: path.join(evidenceRoot, "mobile-light-dictionaries.png"),
      fullPage: false,
    });

    await page.locator("#moreManagementBack").click();
    await expect(page.locator("#moreHeading")).toBeFocused();
    await expect(page.locator("#ux2AppShell")).toHaveAttribute("data-primary", "more");
    await page.screenshot({
      path: path.join(evidenceRoot, "mobile-light-more.png"),
      fullPage: false,
    });

    // Learning Data: Diagnostics remain unavailable; Delete DB + reminders stay reachable.
    await openMoreAnd(page, "learning-data");
    await expect(page.locator("#learning-backup-heading")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("#dictionaryManagementSurface")).toBeHidden();
    await expect(page.locator("#queryLoggingToggle")).not.toBeVisible();
    await expect(page.locator("#clearDb")).toBeVisible();
    await page.screenshot({
      path: path.join(evidenceRoot, "mobile-light-learning-data.png"),
      fullPage: false,
    });
    await page.locator("#moreManagementBack").click();

    // More → Corrections / Search feedback → Back → More
    await openMoreAnd(page, "corrections");
    await expect(page.locator(".ux2-correction-manage")).toBeVisible();
    await page.locator(".correction-manage-back").click();
    await expect(page.locator("#moreHeading")).toBeFocused();

    await openMoreAnd(page, "search-feedback");
    await expect(page.locator(".ux2-search-feedback-manage")).toBeVisible();
    await page.locator(".search-feedback-manage-back").click();
    await expect(page.locator("#moreHeading")).toBeFocused();

    await expectNoHorizontalOverflow(page);
  });

  test("mobile dark entry/review + FR smoke; desktop representative captures", async ({
    page,
  }) => {
    page.setDefaultTimeout(30_000);
    await page.setViewportSize(MOBILE);
    page.on("dialog", (dialog) => dialog.accept());
    await installDebugBundle(page);
    await setUiLocale(page, "en");
    await mkdir(evidenceRoot, { recursive: true });

    await saveEntryFromSearch(page, "alpha_mnk");

    await setTheme(page, "dark");
    await openEntryFromSearch(page, "alpha_mnk");
    await expect(page.locator(".entry-headword")).toBeVisible();
    await page.screenshot({
      path: path.join(evidenceRoot, "mobile-dark-entry.png"),
      fullPage: false,
    });

    await setTheme(page, "light");
    await navigateUx2Primary(page, "saved");
    await expect(page.locator("#saved-vocab-heading")).toBeVisible({ timeout: 15_000 });
    await page.screenshot({
      path: path.join(evidenceRoot, "mobile-light-saved.png"),
      fullPage: false,
    });

    await setTheme(page, "dark");
    await navigateUx2Primary(page, "review");
    await expect(page.locator("#review-heading, .review-title").first()).toBeVisible({
      timeout: 15_000,
    });
    await page.screenshot({
      path: path.join(evidenceRoot, "mobile-dark-review.png"),
      fullPage: false,
    });

    await setTheme(page, "light");
    await openEntryFromSearch(page, "alpha_mnk");
    await expect(page.locator("#entry-suggest-correction")).toBeVisible({ timeout: 15_000 });
    await page.locator("#entry-suggest-correction").click();
    await expect(page.locator(".ux2-correction-form")).toBeVisible();
    await page.screenshot({
      path: path.join(evidenceRoot, "mobile-light-cf1.png"),
      fullPage: false,
    });
    // Leave via primary nav (avoids cancel-button detach races after theme switches).
    await navigateUx2Primary(page, "more");

    // FR smoke — More + Dictionaries
    await setUiLocale(page, "fr");
    await navigateUx2Primary(page, "more");
    await expect(page.locator("#moreHeading")).toBeVisible();
    await openMoreAnd(page, "dictionaries");
    await expect(page.locator("#dictionary-management-heading")).toBeVisible();
    await expect(page.locator("#clearDb")).toBeVisible();
    await page.locator("#moreManagementBack").click();

    // Desktop captures
    await page.setViewportSize(DESKTOP);
    await setUiLocale(page, "en");
    await setTheme(page, "light");
    await navigateUx2Primary(page, "search");
    await page.screenshot({
      path: path.join(evidenceRoot, "desktop-light-search.png"),
      fullPage: false,
    });

    await setTheme(page, "dark");
    await openEntryFromSearch(page, "alpha_mnk");
    await page.screenshot({
      path: path.join(evidenceRoot, "desktop-dark-entry.png"),
      fullPage: false,
    });

    await setTheme(page, "light");
    await navigateUx2Primary(page, "saved");
    await page.screenshot({
      path: path.join(evidenceRoot, "desktop-light-saved.png"),
      fullPage: false,
    });

    await setTheme(page, "dark");
    await navigateUx2Primary(page, "review");
    await page.screenshot({
      path: path.join(evidenceRoot, "desktop-dark-review.png"),
      fullPage: false,
    });

    await setTheme(page, "light");
    await page.screenshot({
      path: path.join(evidenceRoot, "desktop-light-more.png"),
      fullPage: false,
    });

    await openMoreAnd(page, "dictionaries");
    await page.screenshot({
      path: path.join(evidenceRoot, "desktop-light-dictionaries.png"),
      fullPage: false,
    });
    await page.locator("#moreManagementBack").click();

    await openMoreAnd(page, "learning-data");
    await expect(page.locator("#learning-backup-heading")).toBeVisible({ timeout: 15_000 });
    await page.screenshot({
      path: path.join(evidenceRoot, "desktop-light-learning-data.png"),
      fullPage: false,
    });
    await page.locator("#moreManagementBack").click();

    await openEntryFromSearch(page, "beta_mnk");
    await expect(page.locator("#entry-suggest-correction")).toBeVisible({ timeout: 15_000 });
    await page.locator("#entry-suggest-correction").click();
    await expect(page.locator(".ux2-correction-form")).toBeVisible();
    await page.screenshot({
      path: path.join(evidenceRoot, "desktop-light-cf1.png"),
      fullPage: false,
    });
    await navigateUx2Primary(page, "search");

    await ensureSourceToTarget(page);
    await page.locator("#searchInput").fill(NO_RESULT_QUERY);
    await expect(page.locator("[data-testid='search-feedback-entry-no-result']")).toBeVisible({
      timeout: 15_000,
    });
    await page.locator("[data-testid='search-feedback-report']").click();
    await page.screenshot({
      path: path.join(evidenceRoot, "desktop-light-cf2.png"),
      fullPage: false,
    });
    await page.locator("[data-testid='search-feedback-cancel']").click();

    await expectNoHorizontalOverflow(page);
  });
});

async function setTheme(page: Page, theme: "light" | "dark"): Promise<void> {
  await navigateUx2Primary(page, "more");
  await page.locator("#themeSelect").selectOption(theme);
}

async function openEntryFromSearch(page: Page, query: string): Promise<void> {
  await navigateUx2Primary(page, "search");
  await ensureTargetToSource(page);
  await page.locator("#searchInput").fill(query);
  await expect(page.locator("#searchResults .result-open").first()).toContainText(query, {
    timeout: 15_000,
  });
  await page.locator("#searchResults .result-open").first().click();
  await expect(page.locator("#ux2AppShell")).toHaveAttribute("data-search-view", "entry", {
    timeout: 15_000,
  });
}

async function saveEntryFromSearch(page: Page, query: string): Promise<void> {
  await openEntryFromSearch(page, query);
  const save = page.locator("#entry-learning-save");
  await expect(save).toBeVisible({ timeout: 15_000 });
  await expect(save).toBeEnabled({ timeout: 15_000 });
  if ((await save.getAttribute("aria-pressed")) !== "true") {
    await save.click();
    await expect(save).toHaveAttribute("aria-pressed", "true", { timeout: 15_000 });
  }
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflow).toBe(false);
}

async function setUiLocale(page: Page, locale: "en" | "fr"): Promise<void> {
  await navigateUx2Primary(page, "more");
  const select = page.locator("#localeSelect");
  if ((await select.inputValue()) !== locale) {
    await select.selectOption(locale);
    await page.waitForLoadState("domcontentloaded");
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
  await expect(page.locator("#importProgress")).toContainText(/Complete|already installed/i, {
    timeout: 30_000,
  });
  await navigateUx2Primary(page, "search");
  await expect(page.locator("#searchInput")).toBeEnabled({ timeout: installTimeoutMs });
}
