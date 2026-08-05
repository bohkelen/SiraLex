/**
 * UX2I5B — Review and Reflect presentation smoke.
 *
 * NKO_REVIEW_VISUAL_EVIDENCE_NOT_AVAILABLE_IN_E2E_FIXTURE
 * (debug directional bundle has no headword_nko_provided; N’Ko covered by unit tests)
 *
 * REFLECTION_FAILURE_E2E_NOT_AVAILABLE
 * (no clean production-equivalent seam to inject one failed persistence attempt)
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
  "../data/local_evidence/ux2_review",
  new Date().toISOString().replace(/[:.]/g, "-"),
);

test.describe("UX2I5B review and reflect", () => {
  test("mobile empty Review, full session, completion, Back → Saved", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    page.on("dialog", (dialog) => dialog.accept());
    await installDebugBundle(page);
    await setUiLocale(page, "en");

    await navigateUx2Primary(page, "review");
    await expect(page.locator("#ux2AppShell")).toHaveAttribute("data-primary", "review");
    await expect(page.locator("#review-heading")).toBeVisible();
    await expect(page.locator(".review-card")).toHaveCount(0);
    await expect(page.locator(".ux2-review-empty-lead")).toContainText(/Nothing to review/i);
    await expect(page.locator(".review-complete-summary")).toHaveCount(0);
    await page.locator(".review-back").click();
    await expect(page.locator("#ux2AppShell")).toHaveAttribute("data-primary", "saved");

    await navigateUx2Primary(page, "search");
    await saveLexiconEntry(page, "alpha_mnk");
    await saveLexiconEntry(page, "beta_mnk");

    await navigateUx2Primary(page, "review");
    await expect(page.locator("#review-heading")).toBeVisible();
    await expect(page.locator(".review-position")).toBeVisible();
    await expect(page.locator("#review-headword")).toBeVisible();
    await expect(page.locator(".review-reveal")).toBeVisible();
    await expect(page.locator(".review-revealed")).toHaveCount(0);
    await expect(page.locator(".review-still-learning")).toHaveCount(0);
    await expect(page.locator(".review-remembered")).toHaveCount(0);

    const cardRadius = await page.locator(".review-card").evaluate((el) => {
      return getComputedStyle(el).borderRadius;
    });
    expect(cardRadius === "0px" || cardRadius === "0" || cardRadius === "").toBe(true);

    const headwordSize = await page.locator("#review-headword").evaluate((el) => {
      return Number.parseFloat(getComputedStyle(el).fontSize);
    });
    const bodySize = await page.locator(".review-prompt").evaluate((el) => {
      return Number.parseFloat(getComputedStyle(el).fontSize);
    });
    expect(headwordSize).toBeGreaterThan(bodySize);

    await mkdir(evidenceRoot, { recursive: true });
    await page.screenshot({
      path: path.join(evidenceRoot, "mobile-light-review-hidden.png"),
      fullPage: true,
    });

    await page.locator(".review-reveal").click();
    await expect(page.locator("#review-meaning-heading")).toBeVisible();
    await expect(page.locator("#review-meaning-heading")).toBeFocused();
    await expect(page.locator(".review-revealed")).toBeVisible();
    await expect(page.locator(".review-still-learning")).toHaveText("Not yet");
    await expect(page.locator(".review-remembered")).toHaveText("Got it");

    const outcomeBox = await page.locator(".review-still-learning").boundingBox();
    expect(outcomeBox).not.toBeNull();
    expect(outcomeBox!.height).toBeGreaterThanOrEqual(44);

    await page.screenshot({
      path: path.join(evidenceRoot, "mobile-light-review-revealed.png"),
      fullPage: true,
    });

    const first = (await page.locator(".review-headword").textContent())?.trim() ?? "";
    await page.locator(".review-still-learning").click();
    await expect(page.locator(".review-headword")).not.toHaveText(first, { timeout: 15_000 });
    await expect(page.locator(".review-reveal")).toBeVisible();
    await expect(page.locator(".review-revealed")).toHaveCount(0);

    await page.locator(".review-reveal").click();
    await page.locator(".review-remembered").click();
    await expect(page.locator("#review-complete-heading")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".review-complete-summary")).toContainText(/Reviewed:\s*2/);
    await expect(page.locator(".review-complete-summary")).toContainText(/Still learning:\s*1/);
    await expect(page.locator(".review-complete-summary")).toContainText(/Remembered:\s*1/);
    await expect(page.locator(".review-complete-summary")).not.toContainText(/%|mastery|score/i);

    await page.screenshot({
      path: path.join(evidenceRoot, "mobile-light-review-complete.png"),
      fullPage: true,
    });

    await page.locator(".review-again").click();
    await expect(page.locator(".review-reveal")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".review-revealed")).toHaveCount(0);
    await expect(page.locator(".review-position")).toContainText(/1 of 2|1 of/);

    await page.locator(".review-back").click();
    await expect(page.locator("#saved-vocab-heading")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("[data-review-status='still_learning']")).toHaveCount(1);
    await expect(page.locator("[data-review-status='remembered']")).toHaveCount(1);

    await navigateUx2Primary(page, "more");
    await page.locator("#themeSelect").selectOption("dark");
    await navigateUx2Primary(page, "review");
    await expect(page.locator(".review-reveal")).toBeVisible({ timeout: 15_000 });
    await page.screenshot({
      path: path.join(evidenceRoot, "mobile-dark-review-hidden.png"),
      fullPage: true,
    });
    await page.locator(".review-reveal").click();
    await page.screenshot({
      path: path.join(evidenceRoot, "mobile-dark-review-revealed.png"),
      fullPage: true,
    });

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflow).toBe(false);

    await page.locator(".review-remembered").scrollIntoViewIfNeeded();
    const clearance = await page.evaluate(() => {
      const btn = document.querySelector(".review-remembered");
      const nav = document.querySelector(".ux2-primary-nav");
      if (!(btn instanceof HTMLElement) || !(nav instanceof HTMLElement)) return null;
      return {
        btnBottom: btn.getBoundingClientRect().bottom,
        navTop: nav.getBoundingClientRect().top,
      };
    });
    expect(clearance).not.toBeNull();
    expect(clearance!.btnBottom).toBeLessThanOrEqual(clearance!.navTop + 1);

    await writeFile(
      path.join(evidenceRoot, "NKO_REVIEW_VISUAL_EVIDENCE_NOT_AVAILABLE_IN_E2E_FIXTURE.txt"),
      "Debug directional fixture has no headword_nko_provided; N’Ko semantics covered by unit tests.\n",
      "utf8",
    );
    await writeFile(
      path.join(evidenceRoot, "REFLECTION_FAILURE_E2E_NOT_AVAILABLE.txt"),
      "No clean production-equivalent browser seam to inject one failed persistence attempt; host/unit coverage retained.\n",
      "utf8",
    );
  });

  test("desktop Review workspace and complete evidence", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    page.on("dialog", (dialog) => dialog.accept());
    await installDebugBundle(page);
    await setUiLocale(page, "en");

    await saveLexiconEntry(page, "alpha_mnk");
    await saveLexiconEntry(page, "beta_mnk");

    await navigateUx2Primary(page, "review");
    await expect(page.locator("#review-heading")).toBeVisible();
    await expect(page.locator(".ux2-review-workspace")).toBeVisible();
    const workspaceWidth = await page.evaluate(() => {
      const ws = document.querySelector(".ux2-review-workspace");
      return ws ? ws.getBoundingClientRect().width : 0;
    });
    expect(workspaceWidth).toBeGreaterThan(0);
    expect(workspaceWidth).toBeLessThanOrEqual(720.5);

    await mkdir(evidenceRoot, { recursive: true });
    await page.screenshot({
      path: path.join(evidenceRoot, "desktop-light-review-hidden.png"),
      fullPage: true,
    });

    await page.locator(".review-reveal").click();
    await page.screenshot({
      path: path.join(evidenceRoot, "desktop-light-review-revealed.png"),
      fullPage: true,
    });

    await page.locator(".review-still-learning").click();
    await expect(page.locator(".review-reveal")).toBeVisible({ timeout: 15_000 });
    await page.locator(".review-reveal").click();
    await page.locator(".review-remembered").click();
    await expect(page.locator("#review-complete-heading")).toBeVisible({ timeout: 15_000 });
    await page.screenshot({
      path: path.join(evidenceRoot, "desktop-light-review-complete.png"),
      fullPage: true,
    });

    await navigateUx2Primary(page, "more");
    await page.locator("#themeSelect").selectOption("dark");
    await navigateUx2Primary(page, "review");
    await expect(page.locator(".review-reveal")).toBeVisible({ timeout: 15_000 });
    await page.screenshot({
      path: path.join(evidenceRoot, "desktop-dark-review-hidden.png"),
      fullPage: true,
    });
    await page.locator(".review-reveal").click();
    await page.screenshot({
      path: path.join(evidenceRoot, "desktop-dark-review-revealed.png"),
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
  await expect(page.locator("#searchResults .result-open").first()).toContainText(query, {
    timeout: 15_000,
  });
  await page.locator("#searchResults .result-open").first().click();
  await expect(page.locator(".entry-headword")).toContainText(query, { timeout: 15_000 });
  const save = page.locator("#entry-learning-save");
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
