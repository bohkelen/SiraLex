/**
 * UX2I6B2 — Learning Data / Backup & Restore consumer surface smoke.
 *
 * CF1_CF2_VISUAL_MIGRATION_DEFERRED_TO_UX2I7
 * MISSING_DICTIONARY_RESTORE_VISUAL_EVIDENCE_NOT_AVAILABLE
 * CORRUPT_LOCAL_RECOVERY_VISUAL_EVIDENCE_NOT_AVAILABLE
 */

import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Download, type Page } from "@playwright/test";

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
  "../data/local_evidence/ux2_learning_data",
  new Date().toISOString().replace(/[:.]/g, "-"),
);

test.describe("UX2I6B2 learning data", () => {
  test("mobile ready state, export, privacy, dictionaries separation, Back", async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    page.on("dialog", (dialog) => dialog.accept());
    await installDebugBundle(page);
    await setUiLocale(page, "en");
    await saveLexiconByQuery(page, "alpha_mnk");
    await saveLexiconByQuery(page, "beta_mnk");

    await openMoreAnd(page, "learning-data");
    await expect(page.locator("#ux2AppShell")).toHaveAttribute("data-primary", "more");
    await expect(page.locator("#ux2AppShell")).toHaveAttribute(
      "data-more-management",
      "learning-data",
    );
    await expect(page.locator("[data-testid='ux2-nav-more']")).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.locator("#learning-backup-heading")).toBeVisible();
    await expect(page.locator("#learning-backup-heading")).toBeFocused();
    await expect(page.locator("#dictionaryManagementSurface")).toBeHidden();
    await expect(page.locator("#bundleSelect")).toBeHidden();
    await expect(page.locator("#packageImport")).toBeHidden();
    await expect(page.locator(".ux2-learning-backup")).toBeVisible();
    await expect(page.locator(".learning-backup-privacy")).toContainText(
      "saved vocabulary and learning progress",
    );
    await expect(page.locator(".learning-backup-export")).toContainText(/2 Learning Records/i);
    await expect(page.locator(".learning-backup-export .btn")).toBeEnabled();

    await mkdir(evidenceRoot, { recursive: true });
    await page.screenshot({
      path: path.join(evidenceRoot, "mobile-light-learning-data-ready.png"),
      fullPage: true,
    });

    await page.locator("#moreManagementBack").click();
    await page.locator("#themeSelect").selectOption("dark");
    await openMoreAnd(page, "learning-data");
    await page.screenshot({
      path: path.join(evidenceRoot, "mobile-dark-learning-data-ready.png"),
      fullPage: true,
    });
    await page.locator("#moreManagementBack").click();
    await page.locator("#themeSelect").selectOption("light");

    await openMoreAnd(page, "learning-data");
    const downloadPromise = page.waitForEvent("download", { timeout: 30_000 });
    await page.locator(".learning-backup-export .btn").click();
    const download = await downloadPromise;
    const pkg = await readDownloadedPackage(download);
    expect(pkg.package_schema).toBe("siralex_learning_backup_v1");
    expect(pkg.records).toHaveLength(2);
    expect(pkg).not.toHaveProperty("correction_drafts");
    expect(pkg).not.toHaveProperty("search_failure_feedback");
    expect(pkg).not.toHaveProperty("query_logs");
    await expect(page.locator(".learning-backup-result")).toContainText("Backup created");

    // Bottom-nav clearance + no horizontal overflow
    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollWidth > doc.clientWidth + 1;
    });
    expect(overflow).toBe(false);
    const lastBox = await page.locator(".learning-backup-export .btn").boundingBox();
    expect(lastBox).toBeTruthy();
    if (lastBox) {
      expect(lastBox.y + lastBox.height).toBeLessThan(844 - 56);
    }

    await page.locator("#moreManagementBack").click();
    await expect(page.locator("#moreHeading")).toBeFocused();
    await expect(page.locator("#ux2AppShell")).toHaveAttribute("data-primary", "more");
    void context;
  });

  test("mobile restore preview, replace confirm/cancel/commit, invalid file", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    page.on("dialog", (dialog) => dialog.accept());
    await installDebugBundle(page);
    await setUiLocale(page, "en");
    await saveLexiconByQuery(page, "alpha_mnk");
    await saveLexiconByQuery(page, "beta_mnk");

    await openMoreAnd(page, "learning-data");
    const downloadPromise = page.waitForEvent("download", { timeout: 30_000 });
    await page.locator(".learning-backup-export .btn").click();
    const download = await downloadPromise;
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();

    // Mutate: remove beta locally
    await navigateUx2Primary(page, "saved");
    await page.locator(".saved-vocab-row", { hasText: "beta_mnk" }).locator(".saved-vocab-remove").click();
    await expect(page.locator(".saved-vocab-list .saved-vocab-row")).toHaveCount(1, {
      timeout: 15_000,
    });

    await openMoreAnd(page, "learning-data");
    await page.locator("#learning-backup-file-input").setInputFiles(downloadPath!);
    await expect(page.locator("#learning-backup-preview-heading")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("#learning-backup-preview-heading")).toBeFocused();
    await expect(page.locator(".learning-backup-restore")).toContainText(/Records in backup:\s*2/);
    await expect(page.locator(".learning-backup-restore")).toContainText(
      /Records currently on this device:\s*1/,
    );
    await expect(page.locator(".learning-backup-compat-table")).toBeVisible();
    await expect(page.locator('input[name="learning-backup-policy"][value="add_missing"]')).toBeVisible();
    await expect(page.locator('input[name="learning-backup-policy"][value="replace_all"]')).toBeVisible();
    expect(await countLearningRecords(page)).toBe(1);

    await mkdir(evidenceRoot, { recursive: true });
    await page.screenshot({
      path: path.join(evidenceRoot, "mobile-light-restore-preview.png"),
      fullPage: true,
    });

    // Add missing path
    await page.locator('input[name="learning-backup-policy"][value="add_missing"]').check();
    await page
      .locator(".learning-backup-actions .btn", { hasText: "Restore learning data" })
      .click();
    await expect(page.getByRole("heading", { name: "Restore completed" })).toBeVisible({
      timeout: 30_000,
    });
    expect(await countLearningRecords(page)).toBe(2);
    await expect(page.locator(".learning-backup-restore")).toContainText(/Added:\s*1/);
    await page.screenshot({
      path: path.join(evidenceRoot, "mobile-light-restore-success.png"),
      fullPage: true,
    });

    await page.locator(".learning-backup-restore .btn", { hasText: "Open saved vocabulary" }).click();
    await expect(page.locator("#ux2AppShell")).toHaveAttribute("data-primary", "saved");
    await expect(page.locator(".saved-vocab-list .saved-vocab-row")).toHaveCount(2, {
      timeout: 15_000,
    });

    // Replace-all cancel then confirm
    await openMoreAnd(page, "learning-data");
    await page.locator("#learning-backup-file-input").setInputFiles(downloadPath!);
    await expect(page.locator("#learning-backup-preview-heading")).toBeVisible({ timeout: 15_000 });
    await page.locator('input[name="learning-backup-policy"][value="replace_all"]').check();
    await page.locator(".learning-backup-actions .btn", { hasText: "Continue" }).click();
    await expect(page.locator("dialog.learning-backup-confirm-dialog")).toBeVisible();
    await expect(page.locator("dialog.learning-backup-confirm-dialog")).toContainText(
      "Dictionary data will not be changed",
    );
    await page.screenshot({
      path: path.join(evidenceRoot, "mobile-light-replace-confirm.png"),
      fullPage: true,
    });
    await page.locator("dialog.learning-backup-confirm-dialog button", { hasText: "Cancel" }).click();
    expect(await countLearningRecords(page)).toBe(2);

    await page.locator(".learning-backup-actions .btn", { hasText: "Continue" }).click();
    await page
      .locator("dialog.learning-backup-confirm-dialog button", {
        hasText: "Replace all learning records",
      })
      .click();
    await expect(page.getByRole("heading", { name: "Restore completed" })).toBeVisible({
      timeout: 30_000,
    });
    expect(await countLearningRecords(page)).toBe(2);

    // Invalid JSON
    const badPath = path.join(evidenceRoot, "invalid-backup.json");
    await writeFile(badPath, "{ not json", "utf8");
    await page.locator("#learning-backup-file-input").setInputFiles(badPath);
    await expect(page.locator(".learning-backup-restore")).toContainText("Backup file is invalid", {
      timeout: 15_000,
    });
    await expect(page.locator(".learning-backup-restore")).toContainText(
      "No Learning data was changed",
    );
    await expect(page.locator(".learning-backup-restore")).toContainText(
      "Dictionary data was not changed",
    );
    await expect(page.locator(".learning-backup-restore")).not.toContainText("TypeError");
    await page.screenshot({
      path: path.join(evidenceRoot, "mobile-invalid-backup.png"),
      fullPage: true,
    });
    expect(await countLearningRecords(page)).toBe(2);
  });

  test("desktop composition and offline export smoke", async ({ page, context }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    page.on("dialog", (dialog) => dialog.accept());
    await installDebugBundle(page);
    await setUiLocale(page, "en");
    await saveLexiconByQuery(page, "alpha_mnk");

    await openMoreAnd(page, "learning-data");
    await expect(page.locator("#learning-backup-heading")).toBeVisible();
    await expect(page.locator(".learning-backup-export .btn")).toBeEnabled({ timeout: 15_000 });
    // Desktop idle layout places Backup and Restore side-by-side.
    const exportBox = await page.locator(".learning-backup-export").boundingBox();
    const restoreBox = await page.locator(".learning-backup-restore").boundingBox();
    expect(exportBox && restoreBox).toBeTruthy();
    expect(exportBox!.x).toBeLessThan(restoreBox!.x);
    expect(Math.abs(exportBox!.y - restoreBox!.y)).toBeLessThan(80);

    await mkdir(evidenceRoot, { recursive: true });
    await page.screenshot({
      path: path.join(evidenceRoot, "desktop-light-learning-data-ready.png"),
      fullPage: true,
    });

    await page.locator("#moreManagementBack").click();
    await page.locator("#themeSelect").selectOption("dark");
    await openMoreAnd(page, "learning-data");
    await page.screenshot({
      path: path.join(evidenceRoot, "desktop-dark-learning-data-ready.png"),
      fullPage: true,
    });
    await page.locator("#moreManagementBack").click();
    await page.locator("#themeSelect").selectOption("light");

    await openMoreAnd(page, "learning-data");
    const downloadPromise = page.waitForEvent("download", { timeout: 30_000 });
    await page.locator(".learning-backup-export .btn").click();
    const download = await downloadPromise;
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();

    await page.locator("#learning-backup-file-input").setInputFiles(downloadPath!);
    await expect(page.locator("#learning-backup-preview-heading")).toBeVisible({ timeout: 15_000 });
    await page.screenshot({
      path: path.join(evidenceRoot, "desktop-light-restore-preview.png"),
      fullPage: true,
    });

    // Offline export still available
    await context.setOffline(true);
    await openMoreAnd(page, "learning-data");
    await expect(page.locator(".learning-backup-export .btn")).toBeEnabled({ timeout: 15_000 });
    const offlineDownload = page.waitForEvent("download", { timeout: 30_000 });
    await page.locator(".learning-backup-export .btn").click();
    await offlineDownload;
    await context.setOffline(false);
  });
});

async function readDownloadedPackage(download: Download): Promise<Record<string, unknown> & {
  package_schema?: string;
  records?: unknown[];
}> {
  const p = await download.path();
  expect(p).toBeTruthy();
  const { readFile } = await import("node:fs/promises");
  return JSON.parse(await readFile(p!, "utf8")) as Record<string, unknown> & {
    package_schema?: string;
    records?: unknown[];
  };
}

async function countLearningRecords(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("siralex_db");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    try {
      if (!db.objectStoreNames.contains("learning_records")) return 0;
      return await new Promise<number>((resolve, reject) => {
        const tx = db.transaction("learning_records", "readonly");
        const req = tx.objectStore("learning_records").count();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    } finally {
      db.close();
    }
  });
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

async function saveLexiconByQuery(page: Page, query: string): Promise<void> {
  await navigateUx2Primary(page, "search");
  await ensureTargetToSource(page);
  await expect(page.locator("#searchInput")).toBeVisible({ timeout: 15_000 });
  await page.locator("#searchInput").fill(query);
  await expect(page.locator("#searchResults .result-open").first()).toContainText(query, {
    timeout: 15_000,
  });
  await page.locator("#searchResults .result-open").first().click();
  await expect(page.locator(".entry-headword")).toContainText(query, { timeout: 15_000 });
  const saveBtn = page.locator("#entry-learning-save");
  await expect(saveBtn).toBeEnabled({ timeout: 15_000 });
  if ((await saveBtn.getAttribute("aria-pressed")) !== "true") {
    await saveBtn.click();
    await expect(saveBtn).toHaveAttribute("aria-pressed", "true", { timeout: 15_000 });
  }
  await expect(page.locator(".entry-back")).toBeVisible({ timeout: 15_000 });
  await page.locator(".entry-back").click();
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
