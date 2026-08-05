/**
 * UX2I7A / UX2I7A1 — CF1 correction consumer presentation smoke.
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
  "../data/local_evidence/ux2_corrections",
  new Date().toISOString().replace(/[:.]/g, "-"),
);

test.describe("UX2I7A CF1 correction experience", () => {
  test("mobile capture, success, management list, Back to More", async ({ page }) => {
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
    await expect(page.locator("#entry-suggest-correction")).toBeVisible();
    await page.locator("#entry-suggest-correction").click();

    await expect(page.locator("[data-testid='correction-form']")).toBeVisible();
    await expect(page.locator(".ux2-correction-form")).toBeVisible();
    await expect(page.locator("#correction-form-heading")).toBeVisible();
    await expect(page.locator(".correction-form-privacy")).toContainText("local draft only");
    await expect(page.locator("#correction-form-issue")).toBeVisible();
    await expect(page.locator("#correction-form-target")).toBeVisible();
    await expect(page.locator("#correction-form-mode-problem_report")).toBeVisible();
    await expect(page.locator("#correction-form-description")).toBeVisible();
    await expect(page.locator("#correction-form-field-label")).not.toBeVisible();
    await expect(page.locator("#correction-form-proposed")).not.toBeVisible();
    await expectHiddenFieldDisplayNone(page, "#correction-form-field-label");
    await expectHiddenFieldDisplayNone(page, "#correction-form-proposed");

    await mkdir(evidenceRoot, { recursive: true });
    await page.screenshot({
      path: path.join(evidenceRoot, "mobile-light-correction-capture.png"),
      fullPage: true,
    });

    await page.locator("#correction-form-issue").selectOption("spelling");
    await page.locator("#correction-form-target").selectOption({ index: 1 });
    await page.locator("#correction-form-description").fill("UX2 visual check: spelling looks off.");
    await page.locator("#correction-form-save").click();
    await expect(page.locator("#correction-form-success-heading")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator("[data-testid='correction-form']")).toContainText(
      "not been submitted or applied",
    );

    await page.locator("#correction-form-back").click();
    await expect(page.locator(".entry-headword")).toContainText("alpha_mnk");

    await openMoreAnd(page, "corrections");
    await expect(page.locator("#ux2AppShell")).toHaveAttribute("data-primary", "more");
    await expect(page.locator("[data-testid='ux2-nav-more']")).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.locator("[data-testid='correction-manage']")).toBeVisible();
    await expect(page.locator(".ux2-correction-manage")).toBeVisible();
    await expect(page.locator("#correction-manage-heading")).toBeVisible();
    await expect(page.locator(".correction-manage-row-button").first()).toBeVisible();
    await expect(page.locator("#correction-manage-export")).toBeVisible();
    await expect(page.locator("#correction-manage-send")).toBeVisible();

    await page.screenshot({
      path: path.join(evidenceRoot, "mobile-light-correction-management.png"),
      fullPage: true,
    });

    await page.locator(".correction-manage-back").click();
    await expect(page.locator("#moreHeading")).toBeFocused();
    await expect(page.locator("#ux2AppShell")).toHaveAttribute("data-primary", "more");

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflow).toBe(false);
  });

  test("desktop capture + management + dark evidence; handoff confirm when configured", async ({
    page,
  }) => {
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
    await page.locator("#entry-suggest-correction").click();
    await expect(page.locator(".ux2-correction-form")).toBeVisible();
    await expect(page.locator("#correction-form-field-label")).not.toBeVisible();
    await expect(page.locator("#correction-form-proposed")).not.toBeVisible();

    await mkdir(evidenceRoot, { recursive: true });
    await page.screenshot({
      path: path.join(evidenceRoot, "desktop-light-correction-capture.png"),
      fullPage: true,
    });

    await page.locator("#correction-form-issue").selectOption("spelling");
    await page.locator("#correction-form-target").selectOption({ index: 1 });
    await page.locator("#correction-form-description").fill("Desktop UX2 correction draft.");
    await page.locator("#correction-form-save").click();
    await expect(page.locator("#correction-form-success-heading")).toBeVisible({
      timeout: 15_000,
    });
    await page.locator("#correction-form-back").click();

    await openMoreAnd(page, "corrections");
    await expect(page.locator(".ux2-correction-manage")).toBeVisible();
    await page.screenshot({
      path: path.join(evidenceRoot, "desktop-light-correction-management.png"),
      fullPage: true,
    });

    const sendEnabled = await page.locator("#correction-manage-send").isEnabled();
    if (sendEnabled) {
      await page.locator("#correction-manage-send").click();
      await expect(page.locator("#correction-manage-handoff-confirm")).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.locator("#correction-manage-handoff-confirm")).toContainText(
        /review|email|privacy|destination/i,
      );
      await page.screenshot({
        path: path.join(evidenceRoot, "desktop-light-handoff-confirm.png"),
        fullPage: true,
      });
      await page.locator("#correction-manage-handoff-cancel").click();
    }

    await page.locator(".correction-manage-back").click();
    await page.locator("#themeSelect").selectOption("dark");
    await openMoreAnd(page, "corrections");
    await page.screenshot({
      path: path.join(evidenceRoot, "desktop-dark-correction-management.png"),
      fullPage: true,
    });

    await navigateUx2Primary(page, "search");
    await ensureTargetToSource(page);
    await page.locator("#searchInput").fill("beta_mnk");
    await expect(page.locator("#searchResults .result-open").first()).toBeVisible({
      timeout: 15_000,
    });
    await page.locator("#searchResults .result-open").first().click();
    await page.locator("#entry-suggest-correction").click();
    await page.screenshot({
      path: path.join(evidenceRoot, "desktop-dark-correction-capture.png"),
      fullPage: true,
    });
    await page.locator("#correction-form-cancel").click();
  });

  test("mobile dark capture evidence", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    page.on("dialog", (dialog) => dialog.accept());
    await installDebugBundle(page);
    await setUiLocale(page, "en");
    await navigateUx2Primary(page, "more");
    await page.locator("#themeSelect").selectOption("dark");
    await navigateUx2Primary(page, "search");
    await ensureTargetToSource(page);
    await page.locator("#searchInput").fill("alpha_mnk");
    await expect(page.locator("#searchResults .result-open").first()).toBeVisible({
      timeout: 15_000,
    });
    await page.locator("#searchResults .result-open").first().click();
    await page.locator("#entry-suggest-correction").click();
    await expect(page.locator(".ux2-correction-form")).toBeVisible();
    await expect(page.locator("#correction-form-field-label")).not.toBeVisible();
    await expect(page.locator("#correction-form-proposed")).not.toBeVisible();
    await mkdir(evidenceRoot, { recursive: true });
    await page.screenshot({
      path: path.join(evidenceRoot, "mobile-dark-correction-capture.png"),
      fullPage: true,
    });
  });

  test("conditional Field label / Proposed correction visibility", async ({ page }) => {
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
    await page.locator("#entry-suggest-correction").click();
    await expect(page.locator(".ux2-correction-form")).toBeVisible();

    const fieldLabel = page.locator("#correction-form-field-label");
    const proposed = page.locator("#correction-form-proposed");
    const description = page.locator("#correction-form-description");

    await expect(fieldLabel).not.toBeVisible();
    await expect(proposed).not.toBeVisible();
    await expectHiddenFieldDisplayNone(page, "#correction-form-field-label");
    await expectHiddenFieldDisplayNone(page, "#correction-form-proposed");

    await page.locator("#correction-form-target").selectOption("other_field");
    await expect(fieldLabel).toBeVisible();
    await expect(fieldLabel).toBeEnabled();

    await page.locator("#correction-form-target").selectOption("entry");
    await expect(fieldLabel).not.toBeVisible();
    await expectHiddenFieldDisplayNone(page, "#correction-form-field-label");

    await page.locator("#correction-form-mode-proposed_correction").check();
    await expect(proposed).toBeVisible();
    await expect(proposed).toBeEnabled();

    // Stable node: same textarea remains after mode toggle (CF2I6A caret/IME).
    await proposed.evaluate((el) => {
      (window as unknown as { __ux2PropNode?: Element }).__ux2PropNode = el;
    });
    await page.locator("#correction-form-mode-problem_report").check();
    await expect(proposed).not.toBeVisible();
    await expectHiddenFieldDisplayNone(page, "#correction-form-proposed");
    expect(
      await proposed.evaluate(
        (el) => el === (window as unknown as { __ux2PropNode?: Element }).__ux2PropNode,
      ),
    ).toBe(true);

    await description.fill("stable description node");
    await description.evaluate((el) => {
      (window as unknown as { __ux2DescNode?: Element }).__ux2DescNode = el;
    });
    await page.locator("#correction-form-mode-proposed_correction").check();
    await page.locator("#correction-form-mode-problem_report").check();
    expect(
      await description.evaluate(
        (el) => el === (window as unknown as { __ux2DescNode?: Element }).__ux2DescNode,
      ),
    ).toBe(true);
    await expect(description).toHaveValue("stable description node");
  });
});

async function expectHiddenFieldDisplayNone(page: Page, controlSelector: string): Promise<void> {
  const display = await page.locator(controlSelector).evaluate((el) => {
    const field = el.closest(".field");
    if (!(field instanceof HTMLElement)) return null;
    return getComputedStyle(field).display;
  });
  expect(display).toBe("none");
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
