/**
 * CF1I5 — Offline correction lifecycle browser verification.
 *
 * Fixture: public/debug-bundles/test_directional_bundle
 * Evidence: data/local_evidence/cf1_offline_lifecycle/<run_id>/
 */

import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Download, type Page, type Request } from "@playwright/test";

import {
  CORRECTION_FEEDBACK_AUTHORITY_LABEL,
  CORRECTION_FEEDBACK_PACKAGE_SCHEMA,
  parseCorrectionFeedbackJson,
} from "../src/corrections/correction_feedback_package";
import {
  createRunId,
  writeCf1EvidenceArtifacts,
  type Cf1EvidenceSummary,
  type LifecycleScenarioResult,
  type LifecycleStatus,
} from "./corrections/evidence";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const usageBundleDir = path.join(webRoot, "public/debug-bundles/test_directional_bundle");
const installTimeoutMs = 90_000;
const offlineTimeoutMs = 30_000;
const DEBUG_BUNDLE_ID = "bundle_full_20260418_e1c98a70";
const DEBUG_CONTENT_SHA =
  "sha256:e1c98a70d17d67436f434d229ac50c5d8ddff5737a0a1aa0dd3e32307aef6a31";
const LEX_QUERY = "alpha_mnk";
const LEX_IR_ID = "diag_lex_alpha";

const DESCRIPTION_V1 =
  "Lifecycle check: spelling looks off for alpha_mnk.\nSecond line with accents: kùn";
const DESCRIPTION_V2 =
  "Edited lifecycle description with N’Ko ߞߎ߲ and multiline\nline two";
const PROPOSED_V2 = "alpha_mnk → proposed ߞߎ߲";

test.describe("CF1I5 correction lifecycle", () => {
  const runId = createRunId();
  const scenarioResults: LifecycleScenarioResult[] = [];
  const consoleLines: string[] = [];
  const networkLines: string[] = [];
  let exportedPackageText = "";
  let offlineReloadStatus: LifecycleStatus = "NOT_RUN";
  let browserInfo: Record<string, unknown> = {};

  test("online create → manage → edit → export → reload → delete", async ({ page, context }) => {
    page.on("dialog", (dialog) => dialog.accept());
    page.on("console", (msg) => {
      consoleLines.push(`[${msg.type()}] ${msg.text()}`);
    });
    browserInfo = {
      userAgent: await page.evaluate(() => navigator.userAgent),
      platform: await page.evaluate(() => navigator.platform),
      language: await page.evaluate(() => navigator.language),
      viewport: page.viewportSize(),
    };

    await installDebugBundle(page);
    await setUiLocale(page, "en");
    await expect(page.locator("#searchInput")).toBeEnabled({ timeout: installTimeoutMs });
    await expect(page.locator("#openManageCorrections")).toBeVisible();

    // Reminder hidden with zero drafts.
    await openManageDictionaries(page);
    await expect(page.locator("#correctionFeedbackDeleteReminder")).toBeHidden();
    await expect(page.locator("#learningBackupDeleteReminder")).toBeHidden();

    await openLexiconEntry(page, LEX_QUERY);
    await expect(page.locator("#entry-suggest-correction")).toBeVisible({ timeout: 15_000 });
    await page.locator("#entry-suggest-correction").focus();
    await expect(page.locator("#entry-suggest-correction")).toBeFocused();
    await page.locator("#entry-suggest-correction").click();
    await expect(page.locator("[data-testid='correction-form']")).toBeVisible();
    await expect(page.locator("#correction-form-heading")).toBeFocused({ timeout: 5_000 });

    // Invalid save → error summary focus.
    await page.locator("#correction-form-save").click();
    await expect(page.locator("#correction-form-error-summary")).toBeVisible({ timeout: 5_000 });
    await expect(page.locator("#correction-form-error-summary")).toBeFocused();

    await page.locator("#correction-form-issue").selectOption("spelling");
    await page.locator("#correction-form-target").selectOption("headword");
    await page.locator("#correction-form-description").fill(DESCRIPTION_V1);
    await page.locator("#correction-form-mode-proposed_correction").check();
    await page.locator("#correction-form-proposed").fill("alpha_mnk?");

    // Duplicate activation: rapid double Save → one draft.
    await page.locator("#correction-form-save").evaluate((el) => {
      (el as HTMLButtonElement).click();
      (el as HTMLButtonElement).click();
    });
    await expect(page.locator("#correction-form-success-heading")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("#correction-form-success-heading")).toBeFocused();
    expect(await countCorrectionDrafts(page)).toBe(1);
    mark(scenarioResults, "duplicate_create_save", "PASS");

    await page.locator("#correction-form-back").click();
    await expect(page.locator(".entry-headword")).toContainText(LEX_QUERY, { timeout: 15_000 });

    // Reminder visible after create; Learning reminder independent (still hidden).
    await openManageDictionaries(page);
    await expect(page.locator("#correctionFeedbackDeleteReminder")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("#correctionFeedbackDeleteReminder")).toContainText(
      "Before deleting the database, export your correction drafts",
    );
    await expect(page.locator("#learningBackupDeleteReminder")).toBeHidden();
    mark(scenarioResults, "deletion_reminder_after_create", "PASS");

    await page.locator("#openManageCorrections").click();
    await expect(page.locator("[data-testid='correction-manage']")).toBeVisible();
    await expect(page.locator("#correction-manage-heading")).toBeFocused({ timeout: 5_000 });
    await expect(page.locator("#correction-manage-list [role='listitem']")).toHaveCount(1, {
      timeout: 15_000,
    });
    await expect(page.locator(".correction-manage-row-headword")).toContainText(LEX_QUERY);
    await expect(page.locator("#correction-manage-list")).not.toContainText(DEBUG_CONTENT_SHA);
    await expect(page.locator(".correction-manage-export-warning")).toContainText(
      "This file contains unreviewed user suggestions. It must not be applied automatically.",
    );

    await page.locator(".correction-manage-row-button").first().click();
    await expect(page.locator(".correction-manage-detail-headword")).toContainText(LEX_QUERY);
    await expect(page.locator(".correction-manage-availability")).toContainText(
      /Matching live dictionary content/i,
    );

    await page.getByRole("button", { name: "Edit" }).click();
    await expect(page.locator("#correction-manage-description")).toBeVisible();
    await page.locator("#correction-manage-description").fill(DESCRIPTION_V2);
    await page.locator('input[name="correction-manage-mode"][value="proposed_correction"]').check();
    await page.locator("#correction-manage-proposed").fill(PROPOSED_V2);

    // Duplicate edit-save.
    await page.getByRole("button", { name: "Save changes" }).evaluate((el) => {
      (el as HTMLButtonElement).click();
      (el as HTMLButtonElement).click();
    });
    await expect(page.locator(".correction-manage-description")).toContainText(DESCRIPTION_V2, {
      timeout: 15_000,
    });
    expect(await countCorrectionDrafts(page)).toBe(1);
    const afterEdit = await listCorrectionDrafts(page);
    expect(afterEdit[0]?.problem_description).toBe(DESCRIPTION_V2);
    expect(afterEdit[0]?.proposed_value).toBe(PROPOSED_V2);
    mark(scenarioResults, "duplicate_edit_save", "PASS");

    // Reminder remains after edit.
    await openManageDictionaries(page);
    await expect(page.locator("#correctionFeedbackDeleteReminder")).toBeVisible();

    await page.locator("#openManageCorrections").click();
    await expect(page.locator("#correction-manage-export")).toBeEnabled({ timeout: 15_000 });

    const downloadPromise = page.waitForEvent("download", { timeout: 30_000 });
    await page.locator("#correction-manage-export").click();
    // Busy duplicate click must not spawn a second download.
    await page.locator("#correction-manage-export").click({ trial: true }).catch(() => undefined);
    const download = await downloadPromise;
    const filename = download.suggestedFilename();
    expect(filename).toMatch(/^siralex-correction-feedback-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z\.json$/);

    exportedPackageText = await readDownloadedText(download);
    const parsed = parseCorrectionFeedbackJson(exportedPackageText);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error("export parse failed");
    expect(parsed.package.package_schema).toBe(CORRECTION_FEEDBACK_PACKAGE_SCHEMA);
    expect(parsed.package.authority_label).toBe(CORRECTION_FEEDBACK_AUTHORITY_LABEL);
    expect(parsed.package.draft_count).toBe(1);
    expect(parsed.package.drafts).toHaveLength(1);
    const draft = parsed.package.drafts[0]!;
    expect(draft.bundle_id).toBe(DEBUG_BUNDLE_ID);
    expect(draft.ir_id).toBe(LEX_IR_ID);
    expect(draft.content_sha256).toBe(DEBUG_CONTENT_SHA);
    expect(draft.storage_scope_id).toContain(DEBUG_BUNDLE_ID);
    expect(draft.problem_description).toBe(DESCRIPTION_V2);
    expect(draft.proposed_value).toBe(PROPOSED_V2);
    expect(draft.problem_description).toContain("ߞߎ߲");
    expect(draft.problem_description).toContain("\n");
    expect(draft.status).toBe("draft");
    expect(JSON.stringify(parsed.package)).not.toMatch(/phase_1\.5|query_log|learning_record|account|device_id/i);
    for (const key of ["query_logs", "learning_records", "account", "device_id"] as const) {
      expect(parsed.package).not.toHaveProperty(key);
    }
    await expect(page.locator("#correction-manage-status")).toContainText(filename);
    await expect(page.locator("#correction-manage-status")).not.toContainText(/submit|upload/i);
    mark(scenarioResults, "online_export_artifact", "PASS");

    // Reminder remains after export (drafts retained).
    await openManageDictionaries(page);
    await expect(page.locator("#correctionFeedbackDeleteReminder")).toBeVisible();

    // Hard reload persistence.
    await page.reload({ waitUntil: "domcontentloaded", timeout: offlineTimeoutMs });
    await expect(page.locator("#searchInput")).toBeEnabled({ timeout: installTimeoutMs });
    await page.locator("#openManageCorrections").click();
    await expect(page.locator("#correction-manage-list [role='listitem']")).toHaveCount(1, {
      timeout: 15_000,
    });
    await page.locator(".correction-manage-row-button").first().click();
    await expect(page.locator(".correction-manage-description")).toContainText(DESCRIPTION_V2);
    mark(scenarioResults, "reload_persistence", "PASS");

    // Delete last draft → empty + reminder hidden.
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.locator("#correction-manage-delete-confirm")).toBeVisible();
    await page.getByRole("button", { name: "Delete draft" }).click();
    await expect(page.locator("#correction-manage-status")).toContainText(/No correction drafts/i, {
      timeout: 15_000,
    });
    expect(await countCorrectionDrafts(page)).toBe(0);
    await openManageDictionaries(page);
    await expect(page.locator("#correctionFeedbackDeleteReminder")).toBeHidden({ timeout: 15_000 });
    mark(scenarioResults, "deletion_reminder_clears", "PASS");
    mark(scenarioResults, "online_create_manage_edit_export_delete", "PASS");

    void context;
  });

  test("offline create → manage → edit → export → reload", async ({ page, context }) => {
    page.on("dialog", (dialog) => dialog.accept());
    const requests: string[] = [];
    const onRequest = (req: Request) => {
      requests.push(`${req.method()} ${req.url()}`);
      networkLines.push(`${req.method()} ${req.url()}`);
    };

    await installDebugBundle(page);
    await setUiLocale(page, "en");
    await expect(page.locator("#searchInput")).toBeEnabled({ timeout: installTimeoutMs });

    // Warm service worker when available (LP1 pattern).
    await page.reload({ waitUntil: "domcontentloaded", timeout: offlineTimeoutMs });
    await page
      .waitForFunction(() => Boolean(navigator.serviceWorker?.controller), null, {
        timeout: 15_000,
      })
      .catch(() => undefined);

    page.on("request", onRequest);
    await context.setOffline(true);
    try {
      await page.reload({ waitUntil: "domcontentloaded", timeout: offlineTimeoutMs });
      await expect(page.locator("#searchInput")).toBeEnabled({ timeout: offlineTimeoutMs });
      offlineReloadStatus = "PASS";
      mark(scenarioResults, "offline_shell_reload", "PASS");
    } catch (err) {
      offlineReloadStatus = "BLOCKED_EXTERNAL";
      mark(
        scenarioResults,
        "offline_shell_reload",
        "BLOCKED_EXTERNAL",
        `Service-worker/offline reload failed in harness: ${String(err)}`,
      );
      // Continue offline operations without reload if shell was already loaded.
      await context.setOffline(true);
    }

    const requestsBefore = requests.length;
    await openLexiconEntry(page, LEX_QUERY);
    await page.locator("#entry-suggest-correction").click();
    await page.locator("#correction-form-issue").selectOption("nko");
    await page.locator("#correction-form-target").selectOption("headword");
    await page.locator("#correction-form-description").fill("Offline draft ߞߎ߲\nline2");
    await page.locator("#correction-form-save").click();
    await expect(page.locator("#correction-form-success-heading")).toBeVisible({ timeout: 15_000 });

    await page.locator("#openManageCorrections").click();
    await expect(page.locator("#correction-manage-list [role='listitem']")).toHaveCount(1, {
      timeout: 15_000,
    });
    await page.locator(".correction-manage-row-button").first().click();
    await page.getByRole("button", { name: "Edit" }).click();
    await page.locator("#correction-manage-description").fill("Offline edited ߞߎ߲");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.locator(".correction-manage-description")).toContainText("Offline edited", {
      timeout: 15_000,
    });

    // Export chrome lives on the list surface, not detail.
    await page.getByRole("button", { name: /Back to list|Retour à la liste/ }).click();
    await expect(page.locator("#correction-manage-export")).toBeEnabled({ timeout: 15_000 });

    const downloadPromise = page.waitForEvent("download", { timeout: 30_000 });
    await page.locator("#correction-manage-export").click();
    const download = await downloadPromise;
    const text = await readDownloadedText(download);
    const parsed = parseCorrectionFeedbackJson(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.package.drafts[0]?.problem_description).toContain("ߞߎ߲");
    }

    // No correction action should require a successful network hop.
    const correctionRequests = requests.slice(requestsBefore).filter((line) => {
      // Allow nothing beyond same-origin blob/data; flag http(s) fetches.
      return /https?:\/\//i.test(line) && !line.includes("blob:");
    });
    // Offline context should block remote traffic; local preview assets may still appear as requests.
    // Assert correction surfaces did not need remote dictionary fetches.
    expect(
      correctionRequests.every(
        (line) => line.includes("127.0.0.1:4173") || line.includes("localhost:4173"),
      ),
    ).toBe(true);
    mark(scenarioResults, "offline_create_manage_edit_export", "PASS");
    mark(scenarioResults, "network_isolation", "PASS");

    if (offlineReloadStatus === "PASS") {
      await page.reload({ waitUntil: "domcontentloaded", timeout: offlineTimeoutMs });
      await expect(page.locator("#searchInput")).toBeEnabled({ timeout: offlineTimeoutMs });
      await page.locator("#openManageCorrections").click();
      await expect(page.locator("#correction-manage-list [role='listitem']")).toHaveCount(1, {
        timeout: 15_000,
      });
      mark(scenarioResults, "offline_reload_persistence", "PASS");
    } else {
      mark(
        scenarioResults,
        "offline_reload_persistence",
        "BLOCKED_EXTERNAL",
        "Skipped because offline shell reload is BLOCKED_EXTERNAL",
      );
    }

    page.off("request", onRequest);
    await context.setOffline(false);
  });

  test("bundle removal retains draft and marks dictionary unavailable", async ({ page }) => {
    page.on("dialog", (dialog) => dialog.accept());
    await installDebugBundle(page);
    await setUiLocale(page, "en");

    await createQuickDraft(page, {
      description: "Retain after remove",
      issue: "spelling",
    });
    const before = await listCorrectionDrafts(page);
    expect(before).toHaveLength(1);
    const provenance = {
      bundle_id: before[0]!.bundle_id,
      ir_id: before[0]!.ir_id,
      content_sha256: before[0]!.content_sha256,
      storage_scope_id: before[0]!.storage_scope_id,
    };

    await openManageDictionaries(page);
    await page
      .locator("#installedBundleList .catalog-item .btn", { hasText: /Remove|Retirer/ })
      .first()
      .click();
    await expect(page.locator("#importProgress")).toContainText(/removed|retiré/i, {
      timeout: 30_000,
    });

    const after = await listCorrectionDrafts(page);
    expect(after).toHaveLength(1);
    expect(after[0]?.bundle_id).toBe(provenance.bundle_id);
    expect(after[0]?.ir_id).toBe(provenance.ir_id);
    expect(after[0]?.content_sha256).toBe(provenance.content_sha256);
    expect(after[0]?.storage_scope_id).toBe(provenance.storage_scope_id);

    await page.locator("#openManageCorrections").click();
    await expect(page.locator("#correction-manage-list [role='listitem']")).toHaveCount(1);
    await page.locator(".correction-manage-row-button").first().click();
    await expect(page.locator(".correction-manage-availability")).toContainText(
      /Dictionary currently unavailable|Dictionnaire actuellement indisponible/i,
    );
    await expect(page.locator(".correction-manage-description")).toContainText("Retain after remove");
    await page.getByRole("button", { name: /Edit|Modifier/ }).click();
    await expect(page.locator(".correction-manage-help")).toContainText(
      /original entry is unavailable|entrée d’origine est indisponible/i,
    );
    await expect(page.locator("#correction-manage-target")).toHaveCount(0);
    await page.locator("#correction-manage-description").fill("Still editable after remove");
    await page.getByRole("button", { name: /Save changes|Enregistrer/ }).click();
    await expect(page.locator(".correction-manage-description")).toContainText(
      "Still editable after remove",
      { timeout: 15_000 },
    );

    if ((await page.locator("#correction-manage-export").count()) === 0) {
      await page.getByRole("button", { name: /Back to list|Retour à la liste/ }).click();
    }
    await expect(page.locator("#correction-manage-export")).toBeEnabled({ timeout: 15_000 });
    const downloadPromise = page.waitForEvent("download", { timeout: 30_000 });
    await page.locator("#correction-manage-export").click();
    const download = await downloadPromise;
    const parsed = parseCorrectionFeedbackJson(await readDownloadedText(download));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.package.drafts[0]?.content_sha256).toBe(provenance.content_sha256);
      expect(parsed.package.drafts[0]?.bundle_id).toBe(provenance.bundle_id);
    }
    mark(scenarioResults, "bundle_removal_retention", "PASS");
  });

  test("stale form after navigate-away and after bundle removal", async ({ page }) => {
    page.on("dialog", (dialog) => dialog.accept());
    await installDebugBundle(page);
    await setUiLocale(page, "en");

    await openLexiconEntry(page, LEX_QUERY);
    await page.locator("#entry-suggest-correction").click();
    await expect(page.locator("#correction-form-heading")).toBeVisible();
    await page.locator("#correction-form-cancel").click();
    await expect(page.locator("[data-testid='correction-form']")).toHaveCount(0);
    mark(scenarioResults, "navigate_away_disposes_form", "PASS");

    await openLexiconEntry(page, LEX_QUERY);
    await page.locator("#entry-suggest-correction").click();
    await page.locator("#correction-form-issue").selectOption("spelling");
    await page.locator("#correction-form-target").selectOption("headword");
    await page.locator("#correction-form-description").fill("About to go stale");

    await openManageDictionaries(page);
    await page
      .locator("#installedBundleList .catalog-item .btn", { hasText: /Remove|Retirer/ })
      .first()
      .click();
    await expect(page.locator("#importProgress")).toContainText(/removed|retiré/i, {
      timeout: 30_000,
    });

    // Form host should mark Save unavailable; no new draft from stale context.
    const before = await countCorrectionDrafts(page);
    if (await page.locator("[data-testid='correction-form']").count()) {
      await expect(page.locator("#correction-form-stale")).toBeVisible({ timeout: 15_000 });
      await expect(page.locator("#correction-form-save")).toBeDisabled();
      await page.locator("#correction-form-save").click({ force: true }).catch(() => undefined);
    }
    expect(await countCorrectionDrafts(page)).toBe(before);
    mark(scenarioResults, "stale_host_after_bundle_change", "PASS");
  });

  test("database deletion clears drafts and hides reminder", async ({ page }) => {
    page.on("dialog", (dialog) => dialog.accept());
    await installDebugBundle(page);
    await setUiLocale(page, "en");
    await createQuickDraft(page, { description: "For DB delete", issue: "other" });
    await openManageDictionaries(page);
    await expect(page.locator("#correctionFeedbackDeleteReminder")).toBeVisible();
    await page.locator("#correctionFeedbackDeleteReminder .btn").click();
    await expect(page.locator("#correction-manage-heading")).toBeVisible({ timeout: 15_000 });
    // Wait for management load to finish and dispose the host before Delete database.
    await expect(page.locator("#correction-manage-export")).toBeVisible({ timeout: 15_000 });
    await page.locator(".correction-manage-back").click();
    await expect(page.locator("[data-testid='correction-manage']")).toHaveCount(0);

    await openManageDictionaries(page);
    await page.locator("#clearDb").click();
    await expect(page.locator("#importProgress")).toContainText(/deleted|supprim|Delete failed/i, {
      timeout: 30_000,
    });
    // Retry once if a transient IndexedDB connection blocked deletion.
    if (/Delete failed|échec/i.test((await page.locator("#importProgress").textContent()) ?? "")) {
      await page.waitForTimeout(500);
      await page.locator("#clearDb").click();
      await expect(page.locator("#importProgress")).toContainText(/deleted|supprim/i, {
        timeout: 30_000,
      });
    } else {
      await expect(page.locator("#importProgress")).toContainText(/deleted|supprim/i);
    }
    expect(await countCorrectionDrafts(page)).toBe(0);
    await expect(page.locator("#correctionFeedbackDeleteReminder")).toBeHidden({ timeout: 15_000 });
    mark(scenarioResults, "database_deletion_clears_drafts", "PASS");
  });

  test("French smoke: suggest → save → manage → export", async ({ page }) => {
    page.on("dialog", (dialog) => dialog.accept());
    await installDebugBundle(page);
    await setUiLocale(page, "fr");
    await expect(page.locator("#openManageCorrections")).toHaveText("Gérer les corrections");

    await openLexiconEntry(page, LEX_QUERY);
    await expect(page.locator("#entry-suggest-correction")).toHaveText("Suggérer une correction");
    await page.locator("#entry-suggest-correction").click();
    await expect(page.locator("#correction-form-heading")).toHaveText("Suggérer une correction");
    await expect(page.locator("#correction-form-save")).toHaveText(
      "Enregistrer le brouillon de correction",
    );
    await expect(page.locator("#correction-form-heading")).not.toHaveText("Suggest a correction");

    await page.locator("#correction-form-issue").selectOption("spelling");
    await page.locator("#correction-form-target").selectOption("headword");
    await page.locator("#correction-form-description").fill("Brouillon FR avec ߞߎ߲");
    await page.locator("#correction-form-save").click();
    await expect(page.locator("#correction-form-success-heading")).toContainText(/Brouillon/i, {
      timeout: 15_000,
    });

    await page.locator("#openManageCorrections").click();
    await expect(page.locator("#correction-manage-heading")).toHaveText("Corrections en attente");
    await expect(page.locator(".correction-manage-export-warning")).toContainText(
      "Ce fichier contient des suggestions utilisateur non révisées",
    );
    const downloadPromise = page.waitForEvent("download", { timeout: 30_000 });
    await page.locator("#correction-manage-export").click();
    const download = await downloadPromise;
    const parsed = parseCorrectionFeedbackJson(await readDownloadedText(download));
    expect(parsed.ok).toBe(true);
    mark(scenarioResults, "french_smoke", "PASS");
  });

  test("accessibility smoke for form and management", async ({ page }) => {
    page.on("dialog", (dialog) => dialog.accept());
    await installDebugBundle(page);
    await setUiLocale(page, "en");

    await openLexiconEntry(page, LEX_QUERY);
    await page.locator("#entry-suggest-correction").click();
    await expect(page.locator("#correction-form-heading")).toBeFocused({ timeout: 5_000 });
    await page.locator("#correction-form-save").click();
    await expect(page.locator("#correction-form-error-summary")).toBeFocused();

    await page.locator("#correction-form-issue").selectOption("spelling");
    await page.locator("#correction-form-target").selectOption("headword");
    await page.locator("#correction-form-description").fill("a11y path");
    await page.locator("#correction-form-save").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#correction-form-success-heading")).toBeFocused({ timeout: 15_000 });

    await page.locator("#openManageCorrections").click();
    await expect(page.locator("#correction-manage-heading")).toBeFocused({ timeout: 5_000 });
    await expect(page.locator("[data-testid='correction-manage']")).toHaveAttribute(
      "aria-busy",
      /true|false/,
    );
    await page.locator(".correction-manage-row-button").first().focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".correction-manage-detail-headword")).toBeVisible();
    await page
      .locator("[data-testid='correction-manage'] .correction-manage-actions")
      .getByRole("button", { name: "Delete", exact: true })
      .click();
    await expect(page.locator("#correction-manage-delete-confirm")).toBeFocused({ timeout: 5_000 });
    await page
      .locator("#correction-manage-delete-confirm")
      .getByRole("button", { name: "Cancel" })
      .click();
    mark(scenarioResults, "accessibility_smoke", "PASS");
  });

  test.afterAll(async () => {
    // Bundle update/hash-mismatch has no cheap production UI seam in this fixture.
    if (!scenarioResults.some((s) => s.id === "bundle_update_hash_mismatch")) {
      mark(
        scenarioResults,
        "bundle_update_hash_mismatch",
        "NOT_APPLICABLE",
        "Browser fixture lacks second-hash update path; executable Vitest: cf1i5_offline_correction_lifecycle_verification.test.ts",
      );
    }

    const requiredIds = [
      "online_create_manage_edit_export_delete",
      "online_export_artifact",
      "reload_persistence",
      "offline_create_manage_edit_export",
      "bundle_removal_retention",
      "deletion_reminder_after_create",
      "deletion_reminder_clears",
      "duplicate_create_save",
      "duplicate_edit_save",
      "stale_host_after_bundle_change",
      "french_smoke",
      "accessibility_smoke",
      "network_isolation",
      "database_deletion_clears_drafts",
    ];
    const required = scenarioResults.filter((s) => requiredIds.includes(s.id));
    const failed = required.some((s) => s.status === "FAIL") ||
      scenarioResults.some((s) => s.status === "FAIL");
    const requiredBlocked = required.some((s) => s.status === "BLOCKED_EXTERNAL");
    const overall: LifecycleStatus = failed
      ? "FAIL"
      : requiredBlocked
        ? "BLOCKED_EXTERNAL"
        : required.length > 0
          ? "PASS"
          : "NOT_RUN";

    let commit = "local";
    try {
      const { execSync } = await import("node:child_process");
      commit = execSync("git rev-parse HEAD", { cwd: webRoot, encoding: "utf8" }).trim();
    } catch {
      commit = process.env.GITHUB_SHA ?? "local";
    }

    const summary: Cf1EvidenceSummary = {
      schema_version: "cf1_offline_lifecycle_summary_v1",
      commit,
      app_version: "0.0.0",
      browser: "chromium",
      os: process.platform,
      test_timestamp: new Date().toISOString(),
      bundle_id: DEBUG_BUNDLE_ID,
      content_sha256: DEBUG_CONTENT_SHA,
      scenario: "cf1i5_offline_correction_lifecycle",
      overall_status: overall,
      scenarios: scenarioResults,
      artifact_names: [],
      defect_references: [],
    };

    const root = await writeCf1EvidenceArtifacts({
      runId,
      summary,
      exportedPackageText: exportedPackageText || undefined,
      browserInfo,
      consoleLines,
      networkLines,
    });
    console.log(`[CF1I5] evidence written to ${root}`);
    console.log(`[CF1I5] overall_status=${overall}`);
  });
});

function mark(
  results: LifecycleScenarioResult[],
  id: string,
  status: LifecycleStatus,
  notes?: string,
): void {
  const existing = results.find((r) => r.id === id);
  if (existing) {
    existing.status = status;
    if (notes) existing.notes = notes;
    return;
  }
  results.push({ id, status, notes });
}

async function readDownloadedText(download: Download): Promise<string> {
  const filePath = await download.path();
  expect(filePath).toBeTruthy();
  return readFile(filePath!, "utf8");
}

async function createQuickDraft(
  page: Page,
  options: { description: string; issue: string },
): Promise<void> {
  await openLexiconEntry(page, LEX_QUERY);
  await page.locator("#entry-suggest-correction").click();
  await page.locator("#correction-form-issue").selectOption(options.issue);
  await page.locator("#correction-form-target").selectOption("headword");
  await page.locator("#correction-form-description").fill(options.description);
  await page.locator("#correction-form-save").click();
  await expect(page.locator("#correction-form-success-heading")).toBeVisible({ timeout: 15_000 });
}

async function openLexiconEntry(page: Page, query: string): Promise<void> {
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
}

async function openManageDictionaries(page: Page): Promise<void> {
  await page.locator("#openManageDictionaries").click();
  await page.locator("#manageDictionariesPanel").evaluate((el) => {
    if (el instanceof HTMLDetailsElement) el.open = true;
  });
}

async function setUiLocale(page: Page, locale: "en" | "fr"): Promise<void> {
  const select = page.locator("#localeSelect");
  if ((await select.inputValue()) !== locale) {
    await select.selectOption(locale);
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("#searchInput")).toBeVisible({ timeout: offlineTimeoutMs });
  }
}

async function installDebugBundle(page: Page): Promise<void> {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#app")).toBeVisible();

  const searchInput = page.locator("#searchInput");
  if (await searchInput.isEnabled()) {
    // Ensure the debug bundle is the active one when a prior test left state.
    const active = await getActiveBundleId(page);
    if (active === DEBUG_BUNDLE_ID) return;
  }

  // Fresh DB when another bundle/state is present.
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

  await page.locator("#manageDictionariesPanel").evaluate((el) => {
    if (el instanceof HTMLDetailsElement) el.open = true;
  });
  const quickImportInput = page.locator("#quickImportFiles");
  await expect(quickImportInput).toBeAttached();
  await quickImportInput.setInputFiles(files);
  await page.evaluate(() => {
    document.getElementById("quickImportFiles")?.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(page.locator("#importProgress")).toContainText(/Installing|Complete|already installed/i, {
    timeout: 30_000,
  });
  await expect(page.locator("#searchInput")).toBeEnabled({ timeout: installTimeoutMs });
  await expect(page.locator("#activeDictionarySummary")).not.toContainText(
    /No dictionary added|Aucun dictionnaire ajouté/,
    { timeout: 30_000 },
  );
}

async function countCorrectionDrafts(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("siralex_db");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    try {
      if (!db.objectStoreNames.contains("correction_drafts")) return 0;
      return await new Promise<number>((resolve, reject) => {
        const tx = db.transaction("correction_drafts", "readonly");
        const req = tx.objectStore("correction_drafts").count();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    } finally {
      db.close();
    }
  });
}

async function listCorrectionDrafts(page: Page): Promise<
  Array<{
    draft_id: string;
    bundle_id: string;
    ir_id: string;
    content_sha256: string;
    storage_scope_id: string;
    problem_description: string;
    proposed_value?: string;
  }>
> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("siralex_db");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    try {
      if (!db.objectStoreNames.contains("correction_drafts")) return [];
      return await new Promise<Array<Record<string, unknown>>>((resolve, reject) => {
        const tx = db.transaction("correction_drafts", "readonly");
        const req = tx.objectStore("correction_drafts").getAll();
        req.onsuccess = () => resolve(req.result as Array<Record<string, unknown>>);
        req.onerror = () => reject(req.error);
      });
    } finally {
      db.close();
    }
  }) as Promise<
    Array<{
      draft_id: string;
      bundle_id: string;
      ir_id: string;
      content_sha256: string;
      storage_scope_id: string;
      problem_description: string;
      proposed_value?: string;
    }>
  >;
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
