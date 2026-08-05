/**
 * UX2I7B / UX2I7B1 — CF2 search-feedback consumer presentation smoke.
 *
 * Evidence filenames must match the viewport used when capturing
 * (mobile ≈ 390×844, desktop = 1280×800).
 */

import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

import {
  ensureSourceToTarget,
  navigateUx2Primary,
  openMoreAnd,
} from "./helpers/ux2_nav";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const usageBundleDir = path.join(webRoot, "public/debug-bundles/test_directional_bundle");
const installTimeoutMs = 90_000;
const DEBUG_BUNDLE_ID = "bundle_full_20260418_e1c98a70";
const NO_RESULT_QUERY = "zzzz_cf2_nohit";
const HIT_QUERY = "alpha_fr";
const MOBILE = { width: 390, height: 844 } as const;
const DESKTOP = { width: 1280, height: 800 } as const;
const evidenceRoot = path.resolve(
  webRoot,
  "../data/local_evidence/ux2_search_feedback",
  new Date().toISOString().replace(/[:.]/g, "-"),
);

test.describe("UX2I7B CF2 search feedback experience", () => {
  test("mobile no-result capture → save → back → management → Back to More", async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE);
    page.on("dialog", (dialog) => dialog.accept());
    await installDebugBundle(page);
    await setUiLocale(page, "en");

    await ensureSourceToTarget(page);
    await runSearch(page, NO_RESULT_QUERY);
    await expect(page.locator("[data-testid='search-feedback-entry-no-result']")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator("[data-testid='search-feedback-report']")).toBeVisible();
    await page.locator("[data-testid='search-feedback-report']").click();

    await expect(page.locator("[data-testid='search-feedback-capture']")).toBeVisible();
    await expect(page.locator(".ux2-search-feedback-capture")).toBeVisible();
    await expect(page.locator("#search-feedback-capture-heading")).toBeVisible();
    await expect(page.locator("#search-feedback-capture-heading")).toContainText(
      "Report this search",
    );
    await expect(page.locator("#search-feedback-capture-query")).toContainText(NO_RESULT_QUERY);
    await expect(page.locator("[data-testid='search-feedback-meaning']")).toBeVisible();
    await expect(page.locator("[data-testid='search-feedback-details']")).toBeVisible();
    await expect(page.locator(".search-feedback-capture-privacy")).toContainText(
      "local report about this search",
    );
    await expect(page.locator(".search-feedback-capture-privacy")).toContainText(
      "Nothing is sent online",
    );
    await expect(page.locator("[data-testid='search-feedback-capture']")).not.toContainText(
      /missing entry|Submit|Add word|Request word|Suggest a correction|Pending corrections/i,
    );
    // UX2I7A1 lesson: hidden field errors must not be browser-visible.
    await expect(page.locator(".search-feedback-capture-field-error").first()).not.toBeVisible();
    await expectHiddenDisplayNone(page, ".search-feedback-capture-field-error");
    await expectNoHorizontalOverflow(page);
    await expectActionClearOfBottomNav(page, "[data-testid='search-feedback-save']");

    await mkdir(evidenceRoot, { recursive: true });
    expect(page.viewportSize()).toEqual(MOBILE);
    await page.screenshot({
      path: path.join(evidenceRoot, "mobile-light-no-result-feedback.png"),
      fullPage: true,
    });

    await page.locator("[data-testid='search-feedback-meaning']").fill("greeting");
    await page.locator("[data-testid='search-feedback-save']").click();
    await expect(page.locator("#search-feedback-capture-heading")).toContainText(
      /Search feedback saved/i,
      { timeout: 15_000 },
    );
    await expect(page.locator("[data-testid='search-feedback-capture']")).toContainText(
      /not been sent online|does not change the dictionary/i,
    );

    await page.locator("[data-testid='search-feedback-back-to-search']").click();
    await expect(page.locator("#searchInput")).toBeVisible();
    await expect(page.locator("#searchInput")).toHaveValue(NO_RESULT_QUERY);

    await openMoreAnd(page, "search-feedback");
    await expect(page.locator("#ux2AppShell")).toHaveAttribute("data-primary", "more");
    await expect(page.locator("[data-testid='search-feedback-manage']")).toBeVisible();
    await expect(page.locator(".ux2-search-feedback-manage")).toBeVisible();
    await expect(page.locator("#search-feedback-manage-heading")).toBeVisible();
    await expect(page.locator("#search-feedback-manage-heading")).toContainText("Search feedback");
    await expect(page.locator(".search-feedback-manage-row-button").first()).toBeVisible();
    await expect(page.locator("#search-feedback-manage-export")).toBeVisible();
    await expect(page.locator("#search-feedback-manage-send")).toBeVisible();
    await expect(page.locator("[data-testid='search-feedback-manage']")).toContainText(
      "These are searches you chose to report",
    );
    await expect(page.locator("[data-testid='search-feedback-manage']")).not.toContainText(
      HASH_FRAGMENT,
    );
    await expect(page.locator("[data-testid='search-feedback-manage']")).not.toContainText(
      /Pending corrections|Suggest a correction/i,
    );

    expect(page.viewportSize()).toEqual(MOBILE);
    await page.screenshot({
      path: path.join(evidenceRoot, "mobile-light-search-feedback-management.png"),
      fullPage: true,
    });

    await page.locator("[data-testid='search-feedback-manage-row']").first().click();
    await expect(page.locator(".search-feedback-manage-detail-query")).toContainText(
      NO_RESULT_QUERY,
    );
    await page.locator("button", { hasText: "Edit notes" }).click();
    await expect(page.locator("#search-feedback-manage-meaning")).toBeVisible();
    await page.locator("#search-feedback-manage-meaning").fill("greeting (edited)");
    await page.locator("button", { hasText: "Save changes" }).click();
    await expect(page.locator(".search-feedback-manage-detail-meaning")).toContainText(
      "greeting (edited)",
      { timeout: 15_000 },
    );

    await page
      .locator("[data-testid='search-feedback-manage']")
      .getByRole("button", { name: "Delete", exact: true })
      .click();
    await expect(page.locator("#search-feedback-manage-delete-confirm")).toBeVisible();
    await page
      .locator("#search-feedback-manage-delete-confirm")
      .getByRole("button", { name: "Cancel" })
      .click();
    await expect(page.locator("#search-feedback-manage-delete-confirm")).toHaveCount(0);

    await page.locator(".search-feedback-manage-back-list").click();
    await page.locator(".search-feedback-manage-back").click();
    await expect(page.locator("#moreHeading")).toBeFocused();
    await expect(page.locator("#ux2AppShell")).toHaveAttribute("data-primary", "more");

    await expectNoHorizontalOverflow(page);
  });

  test("mobile results-not-useful capture evidence", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    page.on("dialog", (dialog) => dialog.accept());
    await installDebugBundle(page);
    await setUiLocale(page, "en");

    await ensureSourceToTarget(page);
    await runSearch(page, HIT_QUERY);
    await expect(page.locator("#searchResults .result-open").first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.locator("[data-testid='search-feedback-entry-results-not-useful']"),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("[data-testid='search-feedback-report']")).toBeVisible();
    await page.locator("[data-testid='search-feedback-report']").click();

    await expect(page.locator(".ux2-search-feedback-capture")).toBeVisible();
    await expect(page.locator("#search-feedback-capture-heading")).toContainText(
      "Report this search",
    );
    await expect(page.locator("#search-feedback-capture-query")).toContainText(HIT_QUERY);
    await expect(page.locator(".search-feedback-capture-search-meta")).toContainText(
      /Results|useful|result/i,
    );
    await expect(page.locator("[data-testid='search-feedback-meaning']")).toBeVisible();
    await expect(page.locator("[data-testid='search-feedback-details']")).toBeVisible();
    await expect(page.locator(".search-feedback-capture-privacy")).toContainText(
      "local report about this search",
    );
    await expect(page.locator(".search-feedback-capture-privacy")).toContainText(
      "Nothing is sent online",
    );
    await expect(page.locator("[data-testid='search-feedback-capture']")).not.toContainText(
      /missing entry|Submit|Add word|Request word|Suggest a correction|Pending corrections/i,
    );
    await expect(page.locator(".search-feedback-capture-field-error").first()).not.toBeVisible();
    await expectHiddenDisplayNone(page, ".search-feedback-capture-field-error");
    await expectNoHorizontalOverflow(page);
    await expectActionClearOfBottomNav(page, "[data-testid='search-feedback-save']");

    await mkdir(evidenceRoot, { recursive: true });
    expect(page.viewportSize()).toEqual(MOBILE);
    await page.screenshot({
      path: path.join(evidenceRoot, "mobile-light-results-not-useful-feedback.png"),
      fullPage: true,
    });
  });

  test("desktop capture + management + dark evidence; handoff confirm when configured", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    page.on("dialog", (dialog) => dialog.accept());
    await installDebugBundle(page);
    await setUiLocale(page, "en");

    await ensureSourceToTarget(page);
    await runSearch(page, HIT_QUERY);
    await expect(
      page.locator("[data-testid='search-feedback-entry-results-not-useful']"),
    ).toBeVisible({ timeout: 15_000 });
    await page.locator("[data-testid='search-feedback-report']").click();
    await expect(page.locator(".ux2-search-feedback-capture")).toBeVisible();
    await expect(page.locator("#search-feedback-capture-heading")).toContainText(
      "Report this search",
    );
    await expect(page.locator("#search-feedback-capture-query")).toContainText(HIT_QUERY);
    await expect(page.locator(".search-feedback-capture-search-meta")).toContainText(
      /Results|useful|result/i,
    );
    await expect(page.locator(".search-feedback-capture-field-error").first()).not.toBeVisible();
    await expectHiddenDisplayNone(page, ".search-feedback-capture-field-error");
    await expect(page.locator("[data-testid='search-feedback-capture']")).not.toContainText(
      /Suggest a correction|Pending corrections/i,
    );

    await mkdir(evidenceRoot, { recursive: true });
    expect(page.viewportSize()).toEqual(DESKTOP);
    await page.screenshot({
      path: path.join(evidenceRoot, "desktop-light-search-feedback.png"),
      fullPage: true,
    });

    await page.locator("[data-testid='search-feedback-details']").fill("Looking for a different sense.");
    await page.locator("[data-testid='search-feedback-save']").click();
    await expect(page.locator("#search-feedback-capture-heading")).toContainText(
      /Search feedback saved/i,
      { timeout: 15_000 },
    );
    await page.locator("[data-testid='search-feedback-back-to-search']").click();

    await openMoreAnd(page, "search-feedback");
    await expect(page.locator(".ux2-search-feedback-manage")).toBeVisible();
    await expect(page.locator("#search-feedback-manage-heading")).toContainText("Search feedback");
    expect(page.viewportSize()).toEqual(DESKTOP);
    await page.screenshot({
      path: path.join(evidenceRoot, "desktop-light-search-feedback-management.png"),
      fullPage: true,
    });

    const sendEnabled = await page.locator("#search-feedback-manage-send").isEnabled();
    if (sendEnabled) {
      await page.locator("#search-feedback-manage-send").click();
      await expect(page.locator("#search-feedback-manage-handoff-confirm")).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.locator("#search-feedback-manage-handoff-confirm")).toContainText(
        /review|email|privacy|destination|device/i,
      );
      expect(page.viewportSize()).toEqual(DESKTOP);
      await page.screenshot({
        path: path.join(evidenceRoot, "desktop-light-search-feedback-handoff-confirm.png"),
        fullPage: true,
      });
      await page.locator("#search-feedback-manage-handoff-cancel").click();
      await expect(page.locator("#search-feedback-manage-handoff-confirm")).toHaveCount(0);

      await page.locator("#search-feedback-manage-send").click();
      await expect(page.locator("#search-feedback-manage-handoff-confirm")).toBeVisible();
      await page.locator("#search-feedback-manage-handoff-continue").click();
      await expect(page.locator("#search-feedback-manage-status")).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.locator("#search-feedback-manage-status")).toContainText(
        /prepared for sharing|downloaded|attach/i,
      );
      await expect(page.locator(".search-feedback-manage-row-button").first()).toBeVisible();
      const rows = await listSearchFeedback(page);
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.status === "draft")).toBe(true);
      await page.locator("#search-feedback-manage-handoff-acknowledge").click();
    }

    await page.locator(".search-feedback-manage-back").click();
    await page.locator("#themeSelect").selectOption("dark");
    await navigateUx2Primary(page, "search");
    await ensureSourceToTarget(page);
    await runSearch(page, NO_RESULT_QUERY);
    await expect(page.locator("[data-testid='search-feedback-entry-no-result']")).toBeVisible({
      timeout: 15_000,
    });
    await page.locator("[data-testid='search-feedback-report']").click();
    await expect(page.locator(".ux2-search-feedback-capture")).toBeVisible();
    expect(page.viewportSize()).toEqual(DESKTOP);
    await page.screenshot({
      path: path.join(evidenceRoot, "desktop-dark-search-feedback.png"),
      fullPage: true,
    });
    await page.locator("[data-testid='search-feedback-cancel']").click();
  });

  test("mobile dark capture evidence", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    page.on("dialog", (dialog) => dialog.accept());
    await installDebugBundle(page);
    await setUiLocale(page, "en");
    await navigateUx2Primary(page, "more");
    await page.locator("#themeSelect").selectOption("dark");
    await navigateUx2Primary(page, "search");
    await ensureSourceToTarget(page);
    await runSearch(page, NO_RESULT_QUERY);
    await expect(page.locator("[data-testid='search-feedback-entry-no-result']")).toBeVisible({
      timeout: 15_000,
    });
    await page.locator("[data-testid='search-feedback-report']").click();
    await expect(page.locator(".ux2-search-feedback-capture")).toBeVisible();
    await expect(page.locator("#search-feedback-capture-heading")).toContainText(
      "Report this search",
    );
    await mkdir(evidenceRoot, { recursive: true });
    expect(page.viewportSize()).toEqual(MOBILE);
    await page.screenshot({
      path: path.join(evidenceRoot, "mobile-dark-search-feedback.png"),
      fullPage: true,
    });
  });
});

const HASH_FRAGMENT = "sha256:";

async function expectHiddenDisplayNone(page: Page, selector: string): Promise<void> {
  const display = await page.locator(selector).first().evaluate((el) => getComputedStyle(el).display);
  expect(display).toBe("none");
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflow).toBe(false);
}

/** Final actionable control must sit above the mobile bottom nav when scrolled into view. */
async function expectActionClearOfBottomNav(page: Page, actionSelector: string): Promise<void> {
  const action = page.locator(actionSelector);
  await action.scrollIntoViewIfNeeded();
  await expect(action).toBeVisible();
  const clear = await page.evaluate((selector) => {
    const el = document.querySelector(selector);
    const nav = document.querySelector("[data-testid='ux2-nav-search']")?.closest("nav");
    if (!(el instanceof HTMLElement) || !(nav instanceof HTMLElement)) return false;
    const actionRect = el.getBoundingClientRect();
    const navRect = nav.getBoundingClientRect();
    return actionRect.bottom <= navRect.top + 1;
  }, actionSelector);
  expect(clear).toBe(true);
}

async function runSearch(page: Page, query: string): Promise<void> {
  await navigateUx2Primary(page, "search");
  await page.locator("#searchInput").fill(query);
  await page.waitForTimeout(250);
  await Promise.race([
    page.locator("#searchResults .result-open").first().waitFor({ state: "visible", timeout: 15_000 }),
    page
      .locator("[data-testid='search-feedback-entry-no-result']")
      .waitFor({ state: "visible", timeout: 15_000 }),
    page.locator("#searchMeta").waitFor({ state: "visible", timeout: 15_000 }),
  ]).catch(() => undefined);
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

async function listSearchFeedback(
  page: Page,
): Promise<Array<{ status: string }>> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("siralex_db");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    try {
      if (!db.objectStoreNames.contains("search_failure_feedback")) return [];
      return await new Promise<Array<{ status: string }>>((resolve, reject) => {
        const tx = db.transaction("search_failure_feedback", "readonly");
        const req = tx.objectStore("search_failure_feedback").getAll();
        req.onsuccess = () =>
          resolve((req.result as Array<{ status: string }>).map((r) => ({ status: r.status })));
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
