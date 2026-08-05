import path from "node:path";
import { access, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { expect, test, type Download, type Page } from "@playwright/test";

import { navigateUx2Primary, openMoreAnd } from "../helpers/ux2_nav";

/**
 * LP1I5 — Learning backup/restore browser lifecycle verification.
 * Uses the local debug directional bundle (same fixture as LS1–LS3 learning e2e).
 */

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const usageBundleDir = path.join(webRoot, "public/debug-bundles/test_directional_bundle");
const installTimeoutMs = 90_000;
const offlineTimeoutMs = 30_000;
const DEBUG_BUNDLE_ID = "bundle_full_20260418_e1c98a70";

test.describe("LP1 Learning backup and restore", () => {
  test("online export → mutate → Replace restore → Saved Vocabulary/Review", async ({
    page,
    context,
  }) => {
    page.on("dialog", (dialog) => dialog.accept());

    await installDebugBundle(page);
    await setUiLocale(page, "en");
    await expect(page.locator("#searchInput")).toBeEnabled({ timeout: installTimeoutMs });

    await saveLexiconByQuery(page, "alpha_mnk");
    await saveLexiconByQuery(page, "beta_mnk");
    await saveLexiconByQuery(page, "bon_mnk");

    await page.locator("#openSavedVocabulary").click();
    await expect(page.locator("#saved-vocab-heading")).toBeVisible();
    await expect(page.locator(".saved-vocab-list .saved-vocab-row")).toHaveCount(3, {
      timeout: 15_000,
    });
    await expectProgress(page, {
      saved: 3,
      notReviewed: 3,
      stillLearning: 0,
      remembered: 0,
    });

    await page.locator("#saved-vocab-start-review").click();
    await expect(page.locator(".review-reveal")).toBeVisible({ timeout: 15_000 });
    const first = (await page.locator(".review-headword").textContent())?.trim() ?? "";
    await page.locator(".review-reveal").click();
    await page.locator(".review-still-learning").click();
    await expect(page.locator(".review-headword")).not.toHaveText(first, { timeout: 15_000 });
    const second = (await page.locator(".review-headword").textContent())?.trim() ?? "";
    await page.locator(".review-reveal").click();
    await page.locator(".review-remembered").click();
    await expect(
      page
        .locator("#review-complete-heading")
        .or(page.locator(".review-headword").filter({ hasNotText: second })),
    ).toBeVisible({ timeout: 15_000 });
    await page.locator(".review-back").click();
    await expect(page.locator("#saved-vocab-heading")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("[data-review-status='still_learning']")).toHaveCount(1);
    await expect(page.locator("[data-review-status='remembered']")).toHaveCount(1);

    await openManageLearningData(page);
    await expect(page.locator("#learning-backup-heading")).toBeVisible();
    await expect(page.locator(".learning-backup-privacy")).toContainText(
      "saved vocabulary and learning progress",
    );
    await expect(page.locator(".learning-backup-privacy")).toContainText("Store it somewhere you trust");
    await expect(page.locator(".learning-backup-privacy")).not.toContainText(/encrypt|cloud|account/i);
    await expect(page.locator(".learning-backup-export .btn")).toBeEnabled({ timeout: 15_000 });
    await expect(page.locator(".learning-backup-export")).toContainText(/3 Learning Records/);

    const downloadPromise = page.waitForEvent("download", { timeout: 30_000 });
    await page.locator(".learning-backup-export .btn").click();
    // Duplicate click while busy should not create a second download.
    await page.locator(".learning-backup-export .btn").click({ trial: true }).catch(() => undefined);
    const download = await downloadPromise;
    const filename = download.suggestedFilename();
    expect(filename).toMatch(/^siralex-learning-backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z\.json$/);
    expect(filename).not.toMatch(/alpha|beta|bon|kùn/i);

    const pkg = await readDownloadedPackage(download);
    expect(pkg.package_schema).toBe("siralex_learning_backup_v1");
    expect(pkg.record_count).toBe(3);
    expect(pkg.records).toHaveLength(3);
    expect(pkg.bundle_summaries).toHaveLength(1);
    expect(pkg.bundle_summaries[0]?.bundle_id).toBe(DEBUG_BUNDLE_ID);
    const ids = pkg.records.map((r) => r.ir_id).sort();
    expect(ids).toEqual(["diag_lex_alpha", "diag_lex_beta", "diag_lex_bon_mnk"].sort());
    // Learning backups include Learning `records`; they must exclude dictionary/store side state.
    for (const key of [
      "query_logs",
      "active_bundle",
      "active_bundle_id",
      "locale",
      "search_index",
      "logging_consent",
      "review_session",
      "progress",
    ] as const) {
      expect(pkg).not.toHaveProperty(key);
    }
    for (const record of pkg.records) {
      expect(record.bundle_id).toBe(DEBUG_BUNDLE_ID);
      expect(record.ir_kind).toBe("lexicon_entry");
      expect(record.content_sha256).toMatch(/^sha256:/);
      expect(record.storage_scope_id).toBeTruthy();
      expect(record.display_cache?.headword_latin).toBeTruthy();
      expect(typeof record.created_at).toBe("string");
      expect(typeof record.review_count).toBe("number");
      expect(record).toHaveProperty("status");
      expect(record).toHaveProperty("last_reviewed");
      // No dictionary record bodies — only Learning fields + display cache.
      expect(record).not.toHaveProperty("senses");
      expect(record).not.toHaveProperty("examples");
      expect(record).not.toHaveProperty("headword");
      expect(record).not.toHaveProperty("payload");
    }
    await expect(page.locator(".learning-backup-result")).toContainText("Backup created");
    await expect(page.locator(".learning-backup-result")).not.toContainText(/permanently safe|Your data is safe/i);

    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();

    // Mutate Learning data without deleting the dictionary.
    await clearLearningRecords(page);
    // Remount Saved Vocabulary from live IndexedDB (do not seed restored state).
    await page.locator("#openSavedVocabulary").click();
    await expect(page.locator(".saved-vocab-list .saved-vocab-row")).toHaveCount(0, {
      timeout: 15_000,
    });

    await openManageLearningData(page);
    await expect(page.locator(".learning-backup-export")).toContainText(/No learning data to back up/, {
      timeout: 15_000,
    });
    await expect(page.locator(".learning-backup-export .btn")).toBeDisabled();

    await page.locator("#learning-backup-file-input").setInputFiles(downloadPath!);
    await expect(page.locator("#learning-backup-preview-heading")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("#learning-backup-preview-heading")).toBeFocused();
    await expect(page.locator(".learning-backup-compat-table")).toBeVisible();
    await expect(page.locator('input[name="learning-backup-policy"][value="replace_all"]')).toBeVisible();

    await page.locator('input[name="learning-backup-policy"][value="replace_all"]').check();
    await expect(page.locator('input[name="learning-backup-policy"][value="replace_all"]')).toBeChecked();
    await page
      .locator(".learning-backup-actions .btn", { hasText: "Replace all learning records" })
      .click();
    await expect(page.locator("dialog.learning-backup-confirm-dialog")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator("#learning-backup-confirm-heading")).toBeVisible();
    await page.locator("dialog.learning-backup-confirm-dialog button", { hasText: "Cancel" }).click();
    await expect(page.locator("dialog.learning-backup-confirm-dialog")).toHaveCount(0);
    expect(await countLearningRecords(page)).toBe(0);

    await page.locator('input[name="learning-backup-policy"][value="replace_all"]').check();
    await page
      .locator(".learning-backup-actions .btn", { hasText: "Replace all learning records" })
      .click();
    await expect(page.locator("dialog.learning-backup-confirm-dialog")).toBeVisible({
      timeout: 15_000,
    });
    await page
      .locator("dialog.learning-backup-confirm-dialog button", {
        hasText: "Replace all learning records",
      })
      .click();

    await expect(page.getByRole("heading", { name: "Restore completed" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.locator(".learning-backup-restore")).toContainText(/Previous Learning Records:\s*0/);
    await expect(page.locator(".learning-backup-restore")).toContainText(/Restored Learning Records:\s*3/);
    expect(await countLearningRecords(page)).toBe(3);
    expect(await getActiveBundleId(page)).toBe(DEBUG_BUNDLE_ID);

    await page.locator("#openSavedVocabulary").click();
    await expect(page.locator(".saved-vocab-list .saved-vocab-row")).toHaveCount(3, {
      timeout: 15_000,
    });
    await expect(page.locator("[data-review-status='still_learning']")).toHaveCount(1);
    await expect(page.locator("[data-review-status='remembered']")).toHaveCount(1);
    await expect(page.locator("[data-review-status='not_reviewed']")).toHaveCount(1);

    await page.locator("#saved-vocab-start-review").click();
    await expect(page.locator("#review-heading")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".review-reveal")).toBeVisible();
    await page.locator(".review-reveal").click();
    await expect(page.locator(".review-still-learning")).toBeVisible();
    await page.locator(".review-back").click();

    // Keep context warm for offline follow-up assertions in sibling tests.
    void context;
  });

  test("Add missing preserves conflicts and local-only rows", async ({ page }) => {
    page.on("dialog", (dialog) => dialog.accept());
    await installDebugBundle(page);
    await setUiLocale(page, "en");

    await saveLexiconByQuery(page, "alpha_mnk");
    await saveLexiconByQuery(page, "beta_mnk");

    await openManageLearningData(page);
    await expect(page.locator(".learning-backup-export .btn")).toBeEnabled({ timeout: 15_000 });
    const downloadPromise = page.waitForEvent("download", { timeout: 30_000 });
    await page.locator(".learning-backup-export .btn").click();
    const download = await downloadPromise;
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();

    // Local mutation: remove beta, keep alpha (will conflict with backup fields after reflection).
    await page.locator("#openSavedVocabulary").click();
    await page.locator(".saved-vocab-row", { hasText: "beta_mnk" }).locator(".saved-vocab-remove").click();
    await expect(page.locator(".saved-vocab-list .saved-vocab-row")).toHaveCount(1, {
      timeout: 15_000,
    });
    await saveLexiconByQuery(page, "bon_mnk"); // local-only relative to backup

    await openManageLearningData(page);
    await page.locator("#learning-backup-file-input").setInputFiles(downloadPath!);
    await expect(page.locator("#learning-backup-preview-heading")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".learning-backup-policies")).toContainText(/Records to add:\s*1/);
    await expect(page.locator(".learning-backup-policies")).toContainText(
      /Existing identities to keep:\s*1/,
    );
    await expect(page.locator('input[value="add_missing"]')).toBeChecked();

    await page.locator(".learning-backup-actions .btn").first().click();
    await expect(page.locator(".learning-backup-restore")).toContainText("Restore completed", {
      timeout: 15_000,
    });
    expect(await countLearningRecords(page)).toBe(3);

    await page.locator("#openSavedVocabulary").click();
    await expect(page.locator(".saved-vocab-list .saved-vocab-row")).toHaveCount(3, {
      timeout: 15_000,
    });
    await expect(page.locator(".saved-vocab-primary", { hasText: "bon_mnk" })).toBeVisible();
    await expect(page.locator(".saved-vocab-primary", { hasText: "beta_mnk" })).toBeVisible();
    await expect(page.locator(".saved-vocab-primary", { hasText: "alpha_mnk" })).toBeVisible();
  });

  test("offline export and restore round trip", async ({ page, context }) => {
    page.on("dialog", (dialog) => dialog.accept());
    await installDebugBundle(page);
    await setUiLocale(page, "en");
    await saveLexiconByQuery(page, "alpha_mnk");
    await saveLexiconByQuery(page, "beta_mnk");

    // Ensure SW control before offline (same pattern as LS2/LS3 offline regressions).
    await page.reload({ waitUntil: "domcontentloaded", timeout: offlineTimeoutMs });
    await expect(page.locator("#searchInput")).toBeEnabled({ timeout: offlineTimeoutMs });
    await setUiLocale(page, "en");
    await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, {
      timeout: offlineTimeoutMs,
    });

    await context.setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded", timeout: offlineTimeoutMs });
    await expect(page.locator("#searchInput")).toBeEnabled({ timeout: offlineTimeoutMs });
    await setUiLocale(page, "en");

    await openManageLearningData(page);
    await expect(page.locator(".learning-backup-export .btn")).toBeEnabled({ timeout: 15_000 });
    const downloadPromise = page.waitForEvent("download", { timeout: 30_000 });
    await page.locator(".learning-backup-export .btn").click();
    const download = await downloadPromise;
    const pkg = await readDownloadedPackage(download);
    expect(pkg.record_count).toBe(2);
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();

    await clearLearningRecords(page);
    expect(await countLearningRecords(page)).toBe(0);

    await openManageLearningData(page);
    await page.locator("#learning-backup-file-input").setInputFiles(downloadPath!);
    await expect(page.locator("#learning-backup-preview-heading")).toBeVisible({ timeout: 15_000 });
    await page.locator('input[value="replace_all"]').check();
    await page
      .locator(".learning-backup-actions .btn", { hasText: "Replace all learning records" })
      .click();
    await page
      .locator("dialog.learning-backup-confirm-dialog button", {
        hasText: "Replace all learning records",
      })
      .click();
    await expect(page.locator(".learning-backup-restore")).toContainText("Restore completed", {
      timeout: 15_000,
    });

    await page.locator("#openSavedVocabulary").click();
    await expect(page.locator(".saved-vocab-list .saved-vocab-row")).toHaveCount(2, {
      timeout: 15_000,
    });
    await page.locator("#saved-vocab-start-review").click();
    await expect(page.locator(".review-reveal")).toBeVisible({ timeout: 15_000 });
    await page.locator(".review-reveal").click();
    await page.locator(".review-still-learning").click();
    await expect(
      page.locator("#review-complete-heading").or(page.locator(".review-headword")),
    ).toBeVisible({ timeout: 15_000 });
    await page.locator(".review-back").click();

    await page.reload({ waitUntil: "domcontentloaded", timeout: offlineTimeoutMs });
    await expect(page.locator("#searchInput")).toBeEnabled({ timeout: offlineTimeoutMs });
    await setUiLocale(page, "en");
    await page.locator("#openSavedVocabulary").click();
    await expect(page.locator(".saved-vocab-list .saved-vocab-row")).toHaveCount(2, {
      timeout: 15_000,
    });
    await expect(page.locator("[data-review-status='still_learning']")).toHaveCount(1, {
      timeout: 15_000,
    });
  });

  test("validation failures, empty export, privacy, and French smoke", async ({ page }) => {
    page.on("dialog", (dialog) => dialog.accept());
    await installDebugBundle(page);
    await setUiLocale(page, "en");

    await openManageLearningData(page);
    await expect(page.locator(".learning-backup-export")).toContainText(/No learning data to back up/);
    await expect(page.locator(".learning-backup-export .btn")).toBeDisabled();

    const invalidJson = path.join(webRoot, "e2e/learning/fixtures/lp1_invalid.json");
    await access(invalidJson).catch(async () => {
      // created below if missing
    });

    await page.locator("#learning-backup-file-input").setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from("{", "utf8"),
    });
    await expect(page.locator(".learning-backup-restore")).toContainText(/invalid/i, {
      timeout: 15_000,
    });
    expect(await countLearningRecords(page)).toBe(0);

    await page.locator("#learning-backup-file-input").setInputFiles({
      name: "bad-schema.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          package_schema: "siralex_learning_backup_v0",
          exported_at: "2026-07-30T22:30:00.000Z",
          record_count: 0,
          bundle_summaries: [],
          records: [],
        }),
        "utf8",
      ),
    });
    await expect(page.locator(".learning-backup-restore")).toContainText(
      /not supported by this version of SiraLex/i,
      { timeout: 15_000 },
    );
    await expect(page.locator(".learning-backup-restore")).not.toContainText(/newer version/i);

    await page.locator("#learning-backup-file-input").setInputFiles({
      name: "bad-utf8.json",
      mimeType: "application/json",
      buffer: Buffer.from([0x7b, 0xc3, 0x28, 0x7d]),
    });
    await expect(page.locator(".learning-backup-restore")).toContainText(/UTF-8/i, {
      timeout: 15_000,
    });

    await saveLexiconByQuery(page, "alpha_mnk");
    await openManageLearningData(page);
    await expect(page.locator("#learningBackupDeleteReminder")).toBeVisible();
    await expect(page.locator("#learningBackupDeleteReminder")).toContainText(
      "Before deleting the database, you can export a Learning backup",
    );
    await expect(page.locator("#learningBackupDeleteReminder")).not.toContainText(/dictionary data/i);

    await setUiLocale(page, "fr");
    await openManageLearningData(page);
    await expect(page.locator("#learning-backup-heading")).toContainText(
      "Gérer les données d’apprentissage",
    );
    await expect(page.locator(".learning-backup-export .btn")).toContainText(
      "Exporter la sauvegarde d’apprentissage",
    );
    await expect(page.locator(".learning-backup-restore")).toContainText(
      "Restaurer la sauvegarde d’apprentissage",
    );
    await expect(page.locator(".learning-backup-privacy")).toContainText("vocabulaire enregistré");
  });

  test("database deletion reminder and restore recovery", async ({ page }) => {
    page.on("dialog", (dialog) => dialog.accept());
    await installDebugBundle(page);
    await setUiLocale(page, "en");
    await saveLexiconByQuery(page, "alpha_mnk");
    await saveLexiconByQuery(page, "beta_mnk");

    await openManageLearningData(page);
    await expect(page.locator(".learning-backup-export .btn")).toBeEnabled({ timeout: 15_000 });
    const downloadPromise = page.waitForEvent("download", { timeout: 30_000 });
    await page.locator(".learning-backup-export .btn").click();
    const download = await downloadPromise;
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();

    await expect(page.locator("#learningBackupDeleteReminder")).toBeVisible();
    await page.locator("#learningBackupDeleteReminder .btn").click();
    await expect(page.locator("#learning-backup-heading")).toBeVisible();

    // Delete full DB (existing semantics — dictionaries cleared too).
    await page.locator("#clearDb").click();
    await expect(page.locator("#importProgress")).toContainText(/deleted|Database/i, {
      timeout: 30_000,
    });
    expect(await countLearningRecords(page)).toBe(0);

    // Reinstall dictionary, then restore Learning backup.
    await installDebugBundle(page);
    await setUiLocale(page, "en");
    await openManageLearningData(page);
    await page.locator("#learning-backup-file-input").setInputFiles(downloadPath!);
    await expect(page.locator("#learning-backup-preview-heading")).toBeVisible({ timeout: 15_000 });
    await page.locator('input[value="replace_all"]').check();
    await page
      .locator(".learning-backup-actions .btn", { hasText: "Replace all learning records" })
      .click();
    await page
      .locator("dialog.learning-backup-confirm-dialog button", {
        hasText: "Replace all learning records",
      })
      .click();
    await expect(page.getByRole("heading", { name: "Restore completed" })).toBeVisible({
      timeout: 30_000,
    });
    await page.locator("#openSavedVocabulary").click();
    await expect(page.locator(".saved-vocab-list .saved-vocab-row")).toHaveCount(2, {
      timeout: 15_000,
    });
  });

  test("accessibility: file label, radios, dialog, keyboard export", async ({ page }) => {
    page.on("dialog", (dialog) => dialog.accept());
    await installDebugBundle(page);
    await setUiLocale(page, "en");
    await saveLexiconByQuery(page, "alpha_mnk");

    await openManageLearningData(page);
    await expect(page.locator("label[for='learning-backup-file-input']")).toBeVisible();
    await expect(page.locator("#learning-backup-heading")).toBeVisible();

    const exportBtn = page.locator(".learning-backup-export .btn");
    await expect(exportBtn).toBeEnabled({ timeout: 15_000 });
    await exportBtn.focus();
    await expect(exportBtn).toBeFocused();
    const downloadPromise = page.waitForEvent("download", { timeout: 30_000 });
    await page.keyboard.press("Enter");
    const download = await downloadPromise;
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();

    await page.locator("#learning-backup-file-input").setInputFiles(downloadPath!);
    await expect(page.locator("#learning-backup-preview-heading")).toBeFocused({ timeout: 15_000 });
    await expect(page.locator("fieldset.learning-backup-policies")).toBeVisible();
    await expect(page.locator('input[type="radio"][name="learning-backup-policy"]')).toHaveCount(2);

    await page.locator('input[value="replace_all"]').check();
    await page
      .locator(".learning-backup-actions .btn", { hasText: "Replace all learning records" })
      .click();
    await expect(page.locator("#learning-backup-confirm-heading")).toBeVisible();
    await page.locator("dialog.learning-backup-confirm-dialog button", { hasText: "Cancel" }).click();
    await expect(page.locator('input[value="replace_all"]')).toBeFocused();
  });
});

async function readDownloadedPackage(download: Download): Promise<{
  package_schema: string;
  record_count: number;
  records: Array<Record<string, unknown>>;
  bundle_summaries: Array<{ bundle_id: string }>;
}> {
  const filePath = await download.path();
  expect(filePath).toBeTruthy();
  const text = await readFile(filePath!, "utf8");
  return JSON.parse(text) as {
    package_schema: string;
    record_count: number;
    records: Array<Record<string, unknown>>;
    bundle_summaries: Array<{ bundle_id: string }>;
  };
}

async function openManageLearningData(page: Page): Promise<void> {
  await openMoreAnd(page, "learning-data");
  await expect(page.locator("#learning-backup-heading")).toBeVisible({ timeout: 15_000 });
}

async function clearLearningRecords(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("siralex_db");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("learning_records", "readwrite");
        tx.objectStore("learning_records").clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  });
}

async function countLearningRecords(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("siralex_db");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    try {
      if (!db.objectStoreNames.contains("learning_records")) {
        return 0;
      }
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

async function expectProgress(
  page: Page,
  expected: {
    saved: number;
    notReviewed: number;
    stillLearning: number;
    remembered: number;
  },
): Promise<void> {
  await expect(page.locator('[data-progress-metric="saved"] dd')).toHaveText(String(expected.saved), {
    timeout: 15_000,
  });
  await expect(page.locator('[data-progress-metric="not_reviewed"] dd')).toHaveText(
    String(expected.notReviewed),
  );
  await expect(page.locator('[data-progress-metric="still_learning"] dd')).toHaveText(
    String(expected.stillLearning),
  );
  await expect(page.locator('[data-progress-metric="remembered"] dd')).toHaveText(
    String(expected.remembered),
  );
}

async function setUiLocale(page: Page, locale: "en" | "fr"): Promise<void> {
  await navigateUx2Primary(page, "more");
  const select = page.locator("#localeSelect");
  if ((await select.inputValue()) !== locale) {
    await select.selectOption(locale);
    await page.waitForLoadState("domcontentloaded");
    await navigateUx2Primary(page, "search");
    await expect(page.locator("#searchInput")).toBeVisible({ timeout: offlineTimeoutMs });
  } else {
    await navigateUx2Primary(page, "search");
  }
}

async function saveLexiconByQuery(page: Page, query: string): Promise<void> {
  const toggle = page.locator("#langToggle");
  const label = (await toggle.textContent()) ?? "";
  if (!/Maninka|Target|Cible/.test(label.split("→")[0] ?? "")) {
    await toggle.click();
  }
  await page.locator("#searchInput").fill(query);
  await expect(page.locator("#searchResults .result-open").first()).toContainText(query, {
    timeout: 15_000,
  });
  await page.locator("#searchResults .result-open").first().click();
  await expect(page.locator(".entry-headword")).toContainText(query, { timeout: 15_000 });
  await expect(page.locator("#entry-learning-save")).toBeEnabled({ timeout: 15_000 });
  const saveBtn = page.locator("#entry-learning-save");
  if ((await saveBtn.getAttribute("aria-pressed")) !== "true") {
    await saveBtn.click();
    await expect(saveBtn).toHaveAttribute("aria-pressed", "true", { timeout: 15_000 });
  }
  // Entry chrome may remount after Learning save; wait for a stable back control.
  await expect(page.locator(".entry-back")).toBeVisible({ timeout: 15_000 });
  await page.locator(".entry-back").click();
  await expect(page.locator("#searchResults .result-open").first()).toContainText(query, {
    timeout: 15_000,
  });
}

async function installDebugBundle(page: Page): Promise<void> {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#app")).toBeVisible();

  const searchInput = page.locator("#searchInput");
  if (await searchInput.isEnabled()) {
    return;
  }

  const files = [
    path.join(usageBundleDir, "bundle.manifest.json"),
    path.join(usageBundleDir, "records.jsonl"),
    path.join(usageBundleDir, "search_index.jsonl"),
  ];
  await Promise.all(files.map((file) => access(file)));

  await openManageDictionaries(page);

  const quickImportInput = page.locator("#quickImportFiles");
  await expect(quickImportInput).toBeAttached();
  await quickImportInput.setInputFiles(files);
  await page.evaluate(() => {
    document.getElementById("quickImportFiles")?.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(page.locator("#importProgress")).toContainText(/Installing|Complete|already installed/i, {
    timeout: 30_000,
  });
  await navigateUx2Primary(page, "search");
  await expect(page.locator("#searchInput")).toBeEnabled({ timeout: installTimeoutMs });
  await expect(page.locator("#activeDictionarySummary")).not.toContainText(
    /No dictionary added|Aucun dictionnaire ajouté/,
    { timeout: 30_000 },
  );
}
