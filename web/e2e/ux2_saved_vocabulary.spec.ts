/**
 * UX2I5A — Saved Vocabulary + Progress presentation smoke.
 *
 * UNRESOLVED_VISUAL_EVIDENCE_NOT_AVAILABLE_IN_E2E_FIXTURE
 * (no clean deterministic soft-orphan path without debug-only controls;
 * unresolved presentation covered by renderer unit tests)
 *
 * REVIEW_VISUAL_MIGRATION_DEFERRED_TO_UX2I5B
 */

import { access, mkdir, writeFile } from "node:fs/promises";
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
  "../data/local_evidence/ux2_saved_vocabulary",
  new Date().toISOString().replace(/[:.]/g, "-"),
);

test.describe("UX2I5A saved vocabulary and progress", () => {
  test("mobile populated, entry round-trip, remove, review progression, empty", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    page.on("dialog", (dialog) => dialog.accept());
    await installDebugBundle(page);
    await setUiLocale(page, "en");

    await navigateUx2Primary(page, "saved");
    await expect(page.locator("#saved-vocab-heading")).toBeVisible();
    await expect(page.locator(".saved-vocab-back")).toHaveCount(0);
    await expect(page.locator(".saved-vocab-progress")).toHaveCount(0);
    await expect(page.locator(".ux2-saved-search-cta")).toBeVisible();
    await mkdir(evidenceRoot, { recursive: true });
    await page.screenshot({
      path: path.join(evidenceRoot, "mobile-light-saved-empty.png"),
      fullPage: true,
    });

    await navigateUx2Primary(page, "search");
    await ensureTargetToSource(page);
    await saveLexiconEntry(page, "alpha_mnk");
    await saveLexiconEntry(page, "beta_mnk");

    await navigateUx2Primary(page, "saved");
    await expect(page.locator("#saved-vocab-heading")).toBeVisible();
    await expect(page.locator(".saved-vocab-back")).toHaveCount(0);
    await expect(page.locator(".saved-vocab-progress")).toBeVisible();
    await expect(page.locator('[data-progress-metric="saved"] dd')).toHaveText("2");
    await expect(page.locator("#saved-vocab-start-review")).toBeVisible();
    await expect(page.locator("#saved-vocab-start-review")).toContainText(/Start review/i);
    await expect(page.locator(".saved-vocab-list .saved-vocab-row")).toHaveCount(2);
    const rowRadius = await page.locator(".saved-vocab-row").first().evaluate((el) => {
      return getComputedStyle(el).borderRadius;
    });
    expect(rowRadius === "0px" || rowRadius === "0" || rowRadius === "").toBe(true);
    await expect(page.locator("#saved-vocab-start-review")).not.toBeFocused();

    await page.locator(".saved-vocab-open").first().click();
    await expect(page.locator(".entry-headword")).toBeVisible();
    await page.locator(".entry-back").click();
    await expect(page.locator("#saved-vocab-heading")).toBeVisible();
    await expect(page.locator("#ux2AppShell")).toHaveAttribute("data-primary", "saved");

    await page.screenshot({
      path: path.join(evidenceRoot, "mobile-light-saved-populated.png"),
      fullPage: true,
    });

    await navigateUx2Primary(page, "more");
    await page.locator("#themeSelect").selectOption("dark");
    await navigateUx2Primary(page, "saved");
    await page.screenshot({
      path: path.join(evidenceRoot, "mobile-dark-saved-populated.png"),
      fullPage: true,
    });
    await navigateUx2Primary(page, "more");
    await page.locator("#themeSelect").selectOption("light");
    await navigateUx2Primary(page, "saved");

    await page.locator("#saved-vocab-start-review").click();
    await expect(page.locator(".review-reveal")).toBeVisible({ timeout: 15_000 });
    await page.locator(".review-reveal").click();
    await page.locator(".review-still-learning").click();
    await expect(
      page.locator("#review-complete-heading").or(page.locator(".review-headword")),
    ).toBeVisible({ timeout: 15_000 });
    await page.locator(".review-back").click();
    await expect(page.locator("#saved-vocab-heading")).toBeVisible();
    await expect(page.locator("#saved-vocab-start-review")).toHaveText(/Continue review/i);
    await expect(page.locator("#saved-vocab-start-review")).toBeFocused();
    await expect(page.locator('[data-progress-metric="still_learning"] dd')).not.toHaveText("0");
    await expect(page.locator("[data-review-status='still_learning']").first()).toBeVisible();

    const beforeRemove = Number(
      (await page.locator('[data-progress-metric="saved"] dd').textContent()) ?? "0",
    );
    await page.locator(".saved-vocab-remove").first().click();
    await expect(page.locator('[data-progress-metric="saved"] dd')).toHaveText(
      String(beforeRemove - 1),
      { timeout: 15_000 },
    );

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflow).toBe(false);

    const lastRow = page.locator(".saved-vocab-row").last();
    await lastRow.scrollIntoViewIfNeeded();
    const clearance = await page.evaluate(() => {
      const row = document.querySelector(".saved-vocab-row:last-child");
      const nav = document.querySelector(".ux2-primary-nav");
      if (!(row instanceof HTMLElement) || !(nav instanceof HTMLElement)) return null;
      return {
        rowBottom: row.getBoundingClientRect().bottom,
        navTop: nav.getBoundingClientRect().top,
      };
    });
    expect(clearance).not.toBeNull();
    expect(clearance!.rowBottom).toBeLessThanOrEqual(clearance!.navTop + 1);

    await writeFile(
      path.join(evidenceRoot, "UNRESOLVED_VISUAL_EVIDENCE_NOT_AVAILABLE_IN_E2E_FIXTURE.txt"),
      "No clean deterministic unresolved/soft-orphan path in E2E fixture without debug-only controls; unresolved presentation covered by renderer unit tests.\n",
      "utf8",
    );
  });

  test("desktop Saved rail and collection pane", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    page.on("dialog", (dialog) => dialog.accept());
    await installDebugBundle(page);
    await setUiLocale(page, "en");

    await ensureTargetToSource(page);
    await saveLexiconEntry(page, "alpha_mnk");
    await saveLexiconEntry(page, "beta_mnk");

    await navigateUx2Primary(page, "saved");
    await expect(page.locator("#ux2AppShell")).toHaveAttribute("data-primary", "saved");
    await expect(page.locator('[data-testid="ux2-nav-search"]')).toBeVisible();
    await expect(page.locator(".ux2-saved-context")).toBeVisible();
    await expect(page.locator(".ux2-saved-collection")).toBeVisible();
    await expect(page.locator(".saved-vocab-progress")).toBeVisible();
    await expect(page.locator(".saved-vocab-list .saved-vocab-row")).toHaveCount(2, {
      timeout: 15_000,
    });

    const layout = page.locator(".ux2-saved-layout");
    await expect(layout).toHaveCSS("display", "grid");
    const progressShadow = await page.locator(".saved-vocab-progress-item").first().evaluate((el) => {
      return getComputedStyle(el).boxShadow;
    });
    expect(progressShadow === "none" || progressShadow === "").toBe(true);

    await mkdir(evidenceRoot, { recursive: true });
    await page.screenshot({
      path: path.join(evidenceRoot, "desktop-light-saved-populated.png"),
      fullPage: true,
    });

    await navigateUx2Primary(page, "more");
    await page.locator("#themeSelect").selectOption("dark");
    await navigateUx2Primary(page, "saved");
    await page.screenshot({
      path: path.join(evidenceRoot, "desktop-dark-saved-populated.png"),
      fullPage: true,
    });

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflow).toBe(false);
  });
});

async function saveLexiconEntry(page: Page, query: string): Promise<void> {
  await navigateUx2Primary(page, "search");
  await ensureTargetToSource(page);
  await page.locator("#searchInput").fill(query);
  // Wait for the *new* result — stale prior results remain until debounce/search completes.
  await expect(page.locator("#searchResults .result-open").first()).toContainText(query, {
    timeout: 15_000,
  });
  await page.locator("#searchResults .result-open").first().click();
  await expect(page.locator(".entry-headword")).toContainText(query, { timeout: 15_000 });
  const save = page.locator("#entry-learning-save");
  await expect(save).toBeVisible({ timeout: 15_000 });
  await expect(save).toBeEnabled({ timeout: 15_000 });
  if ((await save.getAttribute("aria-pressed")) !== "true") {
    await save.click();
    await expect(save).toHaveAttribute("aria-pressed", "true", { timeout: 15_000 });
  }
  await page.locator(".entry-back").click();
  await expect(page.locator("#searchResults .result-open").first()).toContainText(query, {
    timeout: 15_000,
  });
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
