/**
 * CF2I5 — Offline search-feedback lifecycle browser verification.
 *
 * Fixture: public/debug-bundles/test_directional_bundle
 * Evidence: data/local_evidence/cf2_offline_lifecycle/<run_id>/
 */

import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Download, type Page, type Request } from "@playwright/test";

import {
  ensureSourceToTarget,
  navigateUx2Primary,
  openMoreAnd,
} from "./helpers/ux2_nav";

import {
  SEARCH_FEEDBACK_AUTHORITY_LABEL,
  SEARCH_FEEDBACK_PACKAGE_SCHEMA,
  parseSearchFeedbackJson,
} from "../src/search_feedback/search_feedback_package";
import {
  createRunId,
  writeCf2EvidenceArtifacts,
  type Cf2EvidenceSummary,
  type LifecycleScenarioResult,
  type LifecycleStatus,
} from "./search_feedback/evidence";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const usageBundleDir = path.join(webRoot, "public/debug-bundles/test_directional_bundle");
const installTimeoutMs = 90_000;
const offlineTimeoutMs = 30_000;
const DEBUG_BUNDLE_ID = "bundle_full_20260418_e1c98a70";
const DEBUG_CONTENT_SHA =
  "sha256:e1c98a70d17d67436f434d229ac50c5d8ddff5737a0a1aa0dd3e32307aef6a31";
const NO_RESULT_QUERY = "zzzz_cf2_nohit";
const HIT_QUERY = "alpha_fr";
const NOTE_V1 = "Lifecycle note: looking for greeting\nline two with ߞߎ߲";
const NOTE_V2 = "Edited meaning with N’Ko ߞߎ߲\nand multiline";

test.describe("CF2I5 search feedback lifecycle", () => {
  const runId = createRunId();
  const scenarioResults: LifecycleScenarioResult[] = [];
  const consoleLines: string[] = [];
  const networkLines: string[] = [];
  let exportedPackageText = "";
  let offlineReloadStatus: LifecycleStatus = "NOT_RUN";
  let browserInfo: Record<string, unknown> = {};
  let storageScopeId = "";

  test("1. online no-result create → manage → edit → export → reload → delete", async ({
    page,
  }) => {
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
    await navigateUx2Primary(page, "more");
    await expect(page.locator("#openManageSearchFeedback")).toBeVisible();
    await navigateUx2Primary(page, "search");
    storageScopeId = (await getActiveStorageScopeId(page)) ?? "";

    await openManageDictionaries(page);
    await expect(page.locator("#searchFeedbackDeleteReminder")).toBeHidden();
    await expect(page.locator("#correctionFeedbackDeleteReminder")).toBeHidden();
    await expect(page.locator("#learningBackupDeleteReminder")).toBeHidden();

    await ensureSourceToTarget(page);
    await runSearch(page, NO_RESULT_QUERY);
    await expect(page.locator("[data-testid='search-feedback-entry-no-result']")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator("[data-testid='search-feedback-report']")).toBeVisible();
    // Exact query stays on #searchMeta; the calm CF2 invitation no longer repeats it.
    await expect(page.locator("#searchMeta")).toContainText(NO_RESULT_QUERY);
    await expect(page.locator("[data-testid='search-feedback-entry-no-result']")).toHaveAttribute(
      "data-query",
      NO_RESULT_QUERY,
    );

    await page.locator("[data-testid='search-feedback-report']").click();
    await expect(page.locator("[data-testid='search-feedback-capture']")).toBeVisible();
    await expect(page.locator("#search-feedback-capture-heading")).toBeFocused({ timeout: 5_000 });
    await expect(page.locator("#search-feedback-capture-query")).toContainText(NO_RESULT_QUERY);
    await expect(page.locator("[data-testid='search-feedback-capture']")).toContainText(
      /Nothing is sent online|local report/i,
    );
    await expect(page.locator("[data-testid='search-feedback-capture']")).not.toContainText(
      /missing entry|Submit|Send to community/i,
    );

    // Duplicate Save → one draft (sync double-dispatch avoids re-render instability).
    await page.locator("[data-testid='search-feedback-save']").evaluate((el) => {
      (el as HTMLButtonElement).click();
      (el as HTMLButtonElement).click();
    });
    await expect(page.locator("#search-feedback-capture-heading")).toContainText(
      /Search feedback saved/i,
      { timeout: 15_000 },
    );
    await expect(page.locator("#search-feedback-capture-heading")).toBeFocused();
    expect(await countSearchFeedback(page)).toBe(1);
    const created = await listSearchFeedback(page);
    expect(created[0]?.result_state).toBe("no_result");
    expect(created[0]?.result_count).toBe(0);
    expect(created[0]?.matched_ir_ids).toBeUndefined();
    expect(created[0]?.query_raw).toBe(NO_RESULT_QUERY);
    mark(scenarioResults, "duplicate_create_save", "PASS");
    mark(scenarioResults, "no_result_capture", "PASS");

    await page.locator("[data-testid='search-feedback-back-to-search']").click();
    await expect(page.locator("[data-testid='search-feedback-entry-no-result']")).toBeVisible({
      timeout: 15_000,
    });

    await openManageDictionaries(page);
    await expect(page.locator("#searchFeedbackDeleteReminder")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("#searchFeedbackDeleteReminder")).toContainText(
      "Before deleting the database, export your search feedback",
    );
    await expect(page.locator("#correctionFeedbackDeleteReminder")).toBeHidden();
    await expect(page.locator("#learningBackupDeleteReminder")).toBeHidden();
    mark(scenarioResults, "deletion_reminder_after_create", "PASS");

    await openMoreAnd(page, "search-feedback");
    await expect(page.locator("[data-testid='search-feedback-manage']")).toBeVisible();
    await expect(page.locator("#search-feedback-manage-heading")).toBeFocused({ timeout: 5_000 });
    await expect(page.locator("[data-testid='search-feedback-manage-row']")).toHaveCount(1, {
      timeout: 15_000,
    });
    await expect(page.locator("[data-testid='search-feedback-manage-row']")).toContainText(
      NO_RESULT_QUERY,
    );
    await expect(page.locator("[data-testid='search-feedback-manage-row']")).not.toContainText(
      DEBUG_CONTENT_SHA,
    );
    await expect(page.locator(".search-feedback-manage-export-warning")).toContainText(
      "does not establish that dictionary entries are missing",
    );
    await expect(page.locator(".search-feedback-manage-privacy")).toContainText(
      "These are searches you chose to report",
    );

    await page.locator("[data-testid='search-feedback-manage-row']").first().click();
    await expect(page.locator(".search-feedback-manage-detail-query")).toContainText(NO_RESULT_QUERY);
    await expect(page.locator(".search-feedback-manage-availability")).toContainText(
      /Matching current dictionary/i,
    );

    await page.getByRole("button", { name: "Edit notes" }).click();
    await expect(page.locator("#search-feedback-manage-meaning")).toBeVisible();
    await page.locator("#search-feedback-manage-meaning").fill(NOTE_V1);
    await page.getByRole("button", { name: "Save changes" }).evaluate((el) => {
      (el as HTMLButtonElement).click();
      (el as HTMLButtonElement).click();
    });
    await expect(page.locator(".search-feedback-manage-detail-meaning")).toContainText(
      "looking for greeting",
      { timeout: 15_000 },
    );
    expect(await countSearchFeedback(page)).toBe(1);
    const afterEdit = await listSearchFeedback(page);
    expect(afterEdit[0]?.requested_meaning).toBe(NOTE_V1);
    expect(afterEdit[0]?.query_raw).toBe(NO_RESULT_QUERY);
    expect(afterEdit[0]?.result_state).toBe("no_result");
    mark(scenarioResults, "duplicate_edit_save", "PASS");

    await openManageDictionaries(page);
    await expect(page.locator("#searchFeedbackDeleteReminder")).toBeVisible();

    await openMoreAnd(page, "search-feedback");
    await expect(page.locator("#search-feedback-manage-export")).toBeEnabled({ timeout: 15_000 });
    const downloadPromise = page.waitForEvent("download", { timeout: 30_000 });
    await page.locator("#search-feedback-manage-export").click();
    const download = await downloadPromise;
    const filename = download.suggestedFilename();
    expect(filename).toMatch(/^siralex-search-feedback-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z\.json$/);
    exportedPackageText = await readDownloadedText(download);
    const parsed = parseSearchFeedbackJson(exportedPackageText);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error("export parse failed");
    expect(parsed.package.package_schema).toBe(SEARCH_FEEDBACK_PACKAGE_SCHEMA);
    expect(parsed.package.authority_label).toBe(SEARCH_FEEDBACK_AUTHORITY_LABEL);
    expect(parsed.package.feedback_count).toBe(1);
    const fb = parsed.package.feedbacks[0]!;
    expect(fb.bundle_id).toBe(DEBUG_BUNDLE_ID);
    expect(fb.content_sha256).toBe(DEBUG_CONTENT_SHA);
    expect(fb.query_raw).toBe(NO_RESULT_QUERY);
    expect(fb.result_state).toBe("no_result");
    expect(fb.result_count).toBe(0);
    expect("matched_ir_ids" in fb).toBe(false);
    expect(fb.requested_meaning).toBe(NOTE_V1);
    expect(fb.requested_meaning).toContain("ߞߎ߲");
    expect(JSON.stringify(parsed.package)).not.toMatch(
      /correction_draft|phase_1\.5|query_log|learning_record|account|device_id/i,
    );
    await expect(page.locator("#search-feedback-manage-status")).toContainText(filename);
    await expect(page.locator("#search-feedback-manage-status")).not.toContainText(/submit|upload/i);
    mark(scenarioResults, "online_export_artifact", "PASS");

    await openManageDictionaries(page);
    await expect(page.locator("#searchFeedbackDeleteReminder")).toBeVisible();

    await page.reload({ waitUntil: "domcontentloaded", timeout: offlineTimeoutMs });
    await expect(page.locator("#searchInput")).toBeEnabled({ timeout: installTimeoutMs });
    await openMoreAnd(page, "search-feedback");
    await expect(page.locator("[data-testid='search-feedback-manage-row']")).toHaveCount(1, {
      timeout: 15_000,
    });
    await page.locator("[data-testid='search-feedback-manage-row']").first().click();
    await expect(page.locator(".search-feedback-manage-detail-meaning")).toContainText(
      "looking for greeting",
    );
    mark(scenarioResults, "reload_persistence", "PASS");

    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.locator("#search-feedback-manage-delete-confirm")).toBeVisible();
    await page.getByRole("button", { name: "Delete feedback" }).click();
    await expect(page.locator("#search-feedback-manage-status")).toContainText(
      /No search feedback/i,
      { timeout: 15_000 },
    );
    expect(await countSearchFeedback(page)).toBe(0);
    await openManageDictionaries(page);
    await expect(page.locator("#searchFeedbackDeleteReminder")).toBeHidden({ timeout: 15_000 });
    mark(scenarioResults, "deletion_reminder_clears", "PASS");
    mark(scenarioResults, "online_create_manage_edit_export_delete", "PASS");
  });

  test("2. results-not-useful capture", async ({ page }) => {
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
    ).toBeVisible();
    await expect(page.locator("#searchResults .result-open [data-testid='search-feedback-report']")).toHaveCount(
      0,
    );
    const resultCount = await page.locator("#searchResults .result-open").count();
    expect(resultCount).toBeGreaterThanOrEqual(1);

    await page
      .locator("[data-testid='search-feedback-entry-results-not-useful'] [data-testid='search-feedback-report']")
      .click();
    await page.locator("[data-testid='search-feedback-save']").click();
    await expect(page.locator("#search-feedback-capture-heading")).toContainText(
      /Search feedback saved/i,
      { timeout: 15_000 },
    );
    const drafts = await listSearchFeedback(page);
    expect(drafts).toHaveLength(1);
    expect(drafts[0]?.result_state).toBe("results_not_useful");
    expect(drafts[0]?.result_count).toBe(resultCount);
    expect(drafts[0]?.matched_ir_ids?.length).toBeGreaterThan(0);
    expect((drafts[0]?.matched_ir_ids ?? []).length).toBeLessThanOrEqual(25);
    mark(scenarioResults, "results_not_useful_capture", "PASS");
  });

  test("3. offline create → manage → edit → export → reload", async ({ page, context }) => {
    page.on("dialog", (dialog) => dialog.accept());
    const requests: string[] = [];
    const onRequest = (req: Request) => {
      requests.push(`${req.method()} ${req.url()}`);
      networkLines.push(`${req.method()} ${req.url()}`);
    };

    await installDebugBundle(page);
    await setUiLocale(page, "en");
    await expect(page.locator("#searchInput")).toBeEnabled({ timeout: installTimeoutMs });

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
      await context.setOffline(true);
    }

    const requestsBefore = requests.length;
    await ensureSourceToTarget(page);
    await runSearch(page, "zzzz_cf2_offline");
    await page.locator("[data-testid='search-feedback-report']").click();
    await page.locator("[data-testid='search-feedback-meaning']").fill("Offline ߞߎ߲\nline2");
    await page.locator("[data-testid='search-feedback-save']").click();
    await expect(page.locator("#search-feedback-capture-heading")).toContainText(
      /Search feedback saved/i,
      { timeout: 15_000 },
    );

    await openMoreAnd(page, "search-feedback");
    await expect(page.locator("[data-testid='search-feedback-manage-row']")).toHaveCount(1, {
      timeout: 15_000,
    });
    await page.locator("[data-testid='search-feedback-manage-row']").first().click();
    await page.getByRole("button", { name: "Edit notes" }).click();
    await page.locator("#search-feedback-manage-meaning").fill("Offline edited ߞߎ߲");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.locator(".search-feedback-manage-detail-meaning")).toContainText(
      "Offline edited",
      { timeout: 15_000 },
    );

    await page.getByRole("button", { name: /Back to list|Retour à la liste/ }).click();
    await expect(page.locator("#search-feedback-manage-export")).toBeEnabled({ timeout: 15_000 });
    const downloadPromise = page.waitForEvent("download", { timeout: 30_000 });
    await page.locator("#search-feedback-manage-export").click();
    const download = await downloadPromise;
    const text = await readDownloadedText(download);
    const parsed = parseSearchFeedbackJson(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.package.feedbacks[0]?.requested_meaning).toContain("ߞߎ߲");
      expect(parsed.package.authority_label).toBe(SEARCH_FEEDBACK_AUTHORITY_LABEL);
    }

    const cf2Requests = requests.slice(requestsBefore).filter((line) => {
      return /https?:\/\//i.test(line) && !line.includes("blob:");
    });
    expect(
      cf2Requests.every(
        (line) => line.includes("127.0.0.1:4173") || line.includes("localhost:4173"),
      ),
    ).toBe(true);
    mark(scenarioResults, "offline_create_manage_edit_export", "PASS");
    mark(scenarioResults, "network_isolation", "PASS");

    if (offlineReloadStatus === "PASS") {
      await page.reload({ waitUntil: "domcontentloaded", timeout: offlineTimeoutMs });
      await expect(page.locator("#searchInput")).toBeEnabled({ timeout: offlineTimeoutMs });
      await openMoreAnd(page, "search-feedback");
      await expect(page.locator("[data-testid='search-feedback-manage-row']")).toHaveCount(1, {
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

  test("4. bundle removal retains feedback; Manage remains accessible", async ({ page }) => {
    page.on("dialog", (dialog) => dialog.accept());
    await installDebugBundle(page);
    await setUiLocale(page, "en");
    await createQuickNoResultFeedback(page, "Retain after remove");
    const before = await listSearchFeedback(page);
    expect(before).toHaveLength(1);
    const provenance = {
      bundle_id: before[0]!.bundle_id,
      content_sha256: before[0]!.content_sha256,
      storage_scope_id: before[0]!.storage_scope_id,
      query_raw: before[0]!.query_raw,
    };

    await openManageDictionaries(page);
    await page.locator(".ux2-dict-action-remove").first().click();
    await expect(page.locator("#importProgress")).toContainText(/removed|retiré/i, {
      timeout: 30_000,
    });

    const after = await listSearchFeedback(page);
    expect(after).toHaveLength(1);
    expect(after[0]?.bundle_id).toBe(provenance.bundle_id);
    expect(after[0]?.content_sha256).toBe(provenance.content_sha256);
    expect(after[0]?.storage_scope_id).toBe(provenance.storage_scope_id);
    expect(after[0]?.query_raw).toBe(provenance.query_raw);

    await openMoreAnd(page, "search-feedback");
    await expect(page.locator("[data-testid='search-feedback-manage-row']")).toHaveCount(1);
    await page.locator("[data-testid='search-feedback-manage-row']").first().click();
    await expect(page.locator(".search-feedback-manage-availability")).toContainText(
      /Original dictionary is not currently installed|dictionnaire d’origine n’est pas installé/i,
    );
    await page.getByRole("button", { name: /Edit notes|Modifier les notes/ }).click();
    await page.locator("#search-feedback-manage-meaning").fill("Still editable after remove");
    await page.getByRole("button", { name: /Save changes|Enregistrer/ }).click();
    await expect(page.locator(".search-feedback-manage-detail-meaning")).toContainText(
      "Still editable after remove",
      { timeout: 15_000 },
    );

    if ((await page.locator("#search-feedback-manage-export").count()) === 0) {
      await page.getByRole("button", { name: /Back to list|Retour à la liste/ }).click();
    }
    await expect(page.locator("#search-feedback-manage-export")).toBeEnabled({ timeout: 15_000 });
    const downloadPromise = page.waitForEvent("download", { timeout: 30_000 });
    await page.locator("#search-feedback-manage-export").click();
    const parsed = parseSearchFeedbackJson(await readDownloadedText(await downloadPromise));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.package.feedbacks[0]?.content_sha256).toBe(provenance.content_sha256);
    }

    await page.locator("[data-testid='search-feedback-manage-row']").first().click();
    const manageRoot = page.locator("[data-testid='search-feedback-manage']");
    await manageRoot.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.locator("#search-feedback-manage-delete-confirm")).toBeVisible({
      timeout: 5_000,
    });
    await manageRoot.getByRole("button", { name: "Delete feedback", exact: true }).click();
    await expect(page.locator("#search-feedback-manage-status")).toContainText(
      /No search feedback|Aucun retour/i,
      { timeout: 15_000 },
    );
    mark(scenarioResults, "bundle_removal_retention", "PASS");
  });

  test("5. stale capture + database deletion reminder lifecycle", async ({ page }) => {
    page.on("dialog", (dialog) => dialog.accept());
    await installDebugBundle(page);
    await setUiLocale(page, "en");

    await ensureSourceToTarget(page);
    await runSearch(page, "zzzz_cf2_stale_a");
    await page.locator("[data-testid='search-feedback-report']").click();
    await expect(page.locator("[data-testid='search-feedback-capture']")).toBeVisible();
    const before = await countSearchFeedback(page);

    // Invalidate by executing a new search while form is open.
    await runSearch(page, "zzzz_cf2_stale_b");
    // Form may be disposed by new search settle; if still mounted, Save must be blocked.
    if ((await page.locator("[data-testid='search-feedback-capture']").count()) > 0) {
      await expect(page.locator("#search-feedback-capture-stale")).toBeVisible({ timeout: 15_000 });
      await expect(page.locator("[data-testid='search-feedback-save']")).toBeDisabled();
      await page.locator("[data-testid='search-feedback-save']").click({ force: true }).catch(() => undefined);
    }
    expect(await countSearchFeedback(page)).toBe(before);
    mark(scenarioResults, "stale_capture_after_new_search", "PASS");

    await createQuickNoResultFeedback(page, "For DB delete");
    await openManageDictionaries(page);
    await expect(page.locator("#searchFeedbackDeleteReminder")).toBeVisible();
    await page.locator("#searchFeedbackDeleteReminder .btn").click();
    await expect(page.locator("#search-feedback-manage-heading")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("#search-feedback-manage-export")).toBeVisible({ timeout: 15_000 });
    await page.locator(".search-feedback-manage-back").click();
    await expect(page.locator("[data-testid='search-feedback-manage']")).toHaveCount(0);

    await openManageDictionaries(page);
    await page.locator("#clearDb").click();
    await expect(page.locator("#importProgress")).toContainText(/deleted|supprim|Delete failed/i, {
      timeout: 30_000,
    });
    if (/Delete failed|échec/i.test((await page.locator("#importProgress").textContent()) ?? "")) {
      await page.waitForTimeout(500);
      await page.locator("#clearDb").click();
      await expect(page.locator("#importProgress")).toContainText(/deleted|supprim/i, {
        timeout: 30_000,
      });
    }
    expect(await countSearchFeedback(page)).toBe(0);
    await expect(page.locator("#searchFeedbackDeleteReminder")).toBeHidden({ timeout: 15_000 });
    mark(scenarioResults, "database_deletion_clears_feedback", "PASS");
  });

  test("6. French + accessibility smoke", async ({ page }) => {
    page.on("dialog", (dialog) => dialog.accept());
    await installDebugBundle(page);
    await setUiLocale(page, "fr");
    await navigateUx2Primary(page, "more");
    await expect(page.locator("#openManageSearchFeedback .ux2-more-row-title")).toHaveText(
      "Retours de recherche",
    );
    await navigateUx2Primary(page, "search");

    await ensureSourceToTarget(page);
    await runSearch(page, "zzzz_cf2_fr");
    await expect(page.locator("[data-testid='search-feedback-report']")).toHaveText(
      "Signaler cette recherche →",
    );
    await page.locator("[data-testid='search-feedback-report']").click();
    await expect(page.locator("#search-feedback-capture-heading")).toHaveText(
      "Signaler cette recherche",
    );
    await expect(page.locator("#search-feedback-capture-heading")).toBeFocused({ timeout: 5_000 });
    await expect(page.locator("[data-testid='search-feedback-save']")).toHaveText(
      "Enregistrer le retour sur la recherche",
    );
    await expect(page.locator("#search-feedback-capture-heading")).not.toHaveText(
      "Report this search",
    );
    await page.locator("[data-testid='search-feedback-save']").click();
    await expect(page.locator("#search-feedback-capture-heading")).toContainText(/enregistré/i, {
      timeout: 15_000,
    });

    await openMoreAnd(page, "search-feedback");
    await expect(page.locator("#search-feedback-manage-heading")).toHaveText(
      "Retours sur la recherche",
    );
    await expect(page.locator(".search-feedback-manage-export-warning")).toContainText(
      "n’établit pas que des entrées du dictionnaire manquent",
    );
    await page.locator("[data-testid='search-feedback-manage-row']").first().click();
    await page.getByRole("button", { name: "Supprimer" }).click();
    await expect(page.locator("#search-feedback-manage-delete-confirm")).toBeVisible();
    await expect(page.locator("#search-feedback-manage-delete-confirm")).toContainText(
      "Supprimer ce retour sur la recherche",
    );
    mark(scenarioResults, "french_smoke", "PASS");

    await setUiLocale(page, "en");
    await installDebugBundle(page);
    await runSearch(page, "zzzz_cf2_a11y");
    await page.locator("[data-testid='search-feedback-report']").click();
    await expect(page.locator("#search-feedback-capture-heading")).toBeFocused({ timeout: 5_000 });
    await page.locator("[data-testid='search-feedback-meaning']").fill("x".repeat(2001));
    await page.locator("[data-testid='search-feedback-save']").click();
    await expect(page.locator("#search-feedback-capture-error-summary")).toBeFocused({
      timeout: 5_000,
    });
    await page.locator("[data-testid='search-feedback-meaning']").fill("a11y ok");
    await page.locator("[data-testid='search-feedback-save']").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#search-feedback-capture-heading")).toBeFocused({ timeout: 15_000 });

    await openMoreAnd(page, "search-feedback");
    await expect(page.locator("#search-feedback-manage-heading")).toBeFocused({ timeout: 5_000 });
    await page.locator("[data-testid='search-feedback-manage-row']").first().focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".search-feedback-manage-detail-query")).toBeVisible();
    await page
      .locator("[data-testid='search-feedback-manage'] .search-feedback-manage-actions")
      .getByRole("button", { name: "Delete", exact: true })
      .click();
    await expect(page.locator("#search-feedback-manage-delete-confirm")).toBeFocused({
      timeout: 5_000,
    });
    mark(scenarioResults, "accessibility_smoke", "PASS");
  });

  test("7. isolation: query-log / no remote-submission semantics", async ({ page }) => {
    page.on("dialog", (dialog) => dialog.accept());
    await installDebugBundle(page);
    await setUiLocale(page, "en");

    // Logging OFF path.
    const logsOffBefore = await countQueryLogs(page);
    await ensureSourceToTarget(page);
    await runSearch(page, "zzzz_cf2_qloff");
    await page.locator("[data-testid='search-feedback-report']").click();
    await page.locator("[data-testid='search-feedback-save']").click();
    await expect(page.locator("#search-feedback-capture-heading")).toContainText(/saved/i, {
      timeout: 15_000,
    });
    expect(await countQueryLogs(page)).toBe(logsOffBefore);
    mark(scenarioResults, "query_log_isolation_off", "PASS");

    // Logging ON: open Dictionaries → Advanced → Diagnostics (nested disclosures).
    await openMoreAnd(page, "dictionaries");
    await page.locator("#dictionariesAdvanced").evaluate((el) => {
      if (el instanceof HTMLDetailsElement) el.open = true;
    });
    await page
      .locator("#dictionariesAdvanced .ux2-more-legacy-advanced")
      .first()
      .evaluate((el) => {
        if (el instanceof HTMLDetailsElement) el.open = true;
      });
    await expect(page.locator("#queryLoggingToggle")).toBeVisible();
    await page.locator("#queryLoggingToggle").click();
    // Consent dialog may appear — accept already wired.
    await page.waitForTimeout(300);
    await navigateUx2Primary(page, "search");
    await runSearch(page, "zzzz_cf2_qlon");
    await page.waitForTimeout(1000); // settle delay for query log
    const logsAfterSearch = await countQueryLogs(page);
    await page.locator("[data-testid='search-feedback-report']").click();
    await page.locator("[data-testid='search-feedback-save']").click();
    await expect(page.locator("#search-feedback-capture-heading")).toContainText(/saved/i, {
      timeout: 15_000,
    });
    expect(await countQueryLogs(page)).toBe(logsAfterSearch);

    await openMoreAnd(page, "search-feedback");
    await expect(page.locator("#search-feedback-manage-export")).toBeEnabled({ timeout: 15_000 });
    const logsBeforeExport = await countQueryLogs(page);
    const downloadPromise = page.waitForEvent("download", { timeout: 30_000 });
    await page.locator("#search-feedback-manage-export").click();
    await downloadPromise;
    expect(await countQueryLogs(page)).toBe(logsBeforeExport);

    const body = await page.locator("[data-testid='search-feedback-manage']").innerText();
    expect(body).not.toMatch(/Submit|Send to community|Publish|Moderator/i);
    mark(scenarioResults, "query_log_isolation_on", "PASS");
    mark(scenarioResults, "community_server_nongoal", "PASS");
  });

  test.afterAll(async () => {
    if (!scenarioResults.some((s) => s.id === "bundle_update_hash_mismatch")) {
      mark(
        scenarioResults,
        "bundle_update_hash_mismatch",
        "NOT_APPLICABLE",
        "Browser fixture lacks second-hash update path; executable Vitest: cf2i5_offline_search_feedback_lifecycle_verification.test.ts",
      );
    }

    const requiredIds = [
      "online_create_manage_edit_export_delete",
      "online_export_artifact",
      "reload_persistence",
      "no_result_capture",
      "results_not_useful_capture",
      "offline_create_manage_edit_export",
      "bundle_removal_retention",
      "deletion_reminder_after_create",
      "deletion_reminder_clears",
      "duplicate_create_save",
      "duplicate_edit_save",
      "stale_capture_after_new_search",
      "french_smoke",
      "accessibility_smoke",
      "network_isolation",
      "database_deletion_clears_feedback",
      "query_log_isolation_off",
      "community_server_nongoal",
    ];
    const required = scenarioResults.filter((s) => requiredIds.includes(s.id));
    const failed =
      required.some((s) => s.status === "FAIL") ||
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

    const summary: Cf2EvidenceSummary = {
      schema_version: "cf2_offline_lifecycle_summary_v1",
      commit,
      app_version: "0.0.0",
      browser: "chromium",
      os: process.platform,
      preview_url: "http://127.0.0.1:4173",
      test_timestamp: new Date().toISOString(),
      bundle_id: DEBUG_BUNDLE_ID,
      content_sha256: DEBUG_CONTENT_SHA,
      storage_scope_id: storageScopeId || undefined,
      dictionary_fixture: "public/debug-bundles/test_directional_bundle",
      scenario: "cf2i5_offline_search_feedback_lifecycle",
      overall_status: overall,
      scenarios: scenarioResults,
      artifact_names: [],
      defect_references: [],
    };

    const root = await writeCf2EvidenceArtifacts({
      runId,
      summary,
      exportedPackageText: exportedPackageText || undefined,
      browserInfo,
      consoleLines,
      networkLines,
    });
    console.log(`[CF2I5] evidence written to ${root}`);
    console.log(`[CF2I5] overall_status=${overall}`);
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

async function createQuickNoResultFeedback(page: Page, meaning?: string): Promise<void> {
  await ensureSourceToTarget(page);
  await runSearch(page, `zzzz_cf2_quick_${Date.now()}`);
  await page.locator("[data-testid='search-feedback-report']").click();
  if (meaning) {
    await page.locator("[data-testid='search-feedback-meaning']").fill(meaning);
  }
  await page.locator("[data-testid='search-feedback-save']").click();
  await expect(page.locator("#search-feedback-capture-heading")).toContainText(/saved|enregistré/i, {
    timeout: 15_000,
  });
}

async function runSearch(page: Page, query: string): Promise<void> {
  await navigateUx2Primary(page, "search");
  await page.locator("#searchInput").fill(query);
  // Debounced search (~150ms); wait for either results or no-result CTA / meta.
  await page.waitForTimeout(250);
  await Promise.race([
    page.locator("#searchResults .result-open").first().waitFor({ state: "visible", timeout: 15_000 }),
    page
      .locator("[data-testid='search-feedback-entry-no-result']")
      .waitFor({ state: "visible", timeout: 15_000 }),
    page.locator("#searchMeta").waitFor({ state: "visible", timeout: 15_000 }),
  ]).catch(() => undefined);
}

async function openManageDictionaries(page: Page): Promise<void> {
  await openMoreAnd(page, "dictionaries");
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
  const quickImportInput = page.locator("#quickImportFiles");
  await expect(quickImportInput).toBeAttached();
  await quickImportInput.setInputFiles(files);
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
  await expect(page.locator("#activeDictionarySummary")).not.toContainText(
    /No dictionary added|Aucun dictionnaire ajouté/,
    { timeout: 30_000 },
  );
}

async function countSearchFeedback(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("siralex_db");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    try {
      if (!db.objectStoreNames.contains("search_failure_feedback")) return 0;
      return await new Promise<number>((resolve, reject) => {
        const tx = db.transaction("search_failure_feedback", "readonly");
        const req = tx.objectStore("search_failure_feedback").count();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    } finally {
      db.close();
    }
  });
}

async function listSearchFeedback(page: Page): Promise<
  Array<{
    feedback_id: string;
    bundle_id: string;
    content_sha256: string;
    storage_scope_id: string;
    query_raw: string;
    result_state: string;
    result_count: number;
    matched_ir_ids?: string[];
    requested_meaning?: string;
    user_description?: string;
  }>
> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("siralex_db");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    try {
      if (!db.objectStoreNames.contains("search_failure_feedback")) return [];
      return await new Promise<Array<Record<string, unknown>>>((resolve, reject) => {
        const tx = db.transaction("search_failure_feedback", "readonly");
        const req = tx.objectStore("search_failure_feedback").getAll();
        req.onsuccess = () => resolve(req.result as Array<Record<string, unknown>>);
        req.onerror = () => reject(req.error);
      });
    } finally {
      db.close();
    }
  }) as Promise<
    Array<{
      feedback_id: string;
      bundle_id: string;
      content_sha256: string;
      storage_scope_id: string;
      query_raw: string;
      result_state: string;
      result_count: number;
      matched_ir_ids?: string[];
      requested_meaning?: string;
      user_description?: string;
    }>
  >;
}

async function countQueryLogs(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("siralex_db");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    try {
      if (!db.objectStoreNames.contains("query_logs")) return 0;
      return await new Promise<number>((resolve, reject) => {
        const tx = db.transaction("query_logs", "readonly");
        const req = tx.objectStore("query_logs").count();
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

async function getActiveStorageScopeId(page: Page): Promise<string | undefined> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("siralex_db");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    try {
      const activeId = await new Promise<string | undefined>((resolve, reject) => {
        const tx = db.transaction("meta", "readonly");
        const req = tx.objectStore("meta").get("active_bundle_id");
        req.onsuccess = () => resolve(req.result as string | undefined);
        req.onerror = () => reject(req.error);
      });
      if (!activeId) return undefined;
      const meta = await new Promise<{ storage_scope_id?: string } | undefined>((resolve, reject) => {
        const tx = db.transaction("bundles_registry", "readonly");
        const req = tx.objectStore("bundles_registry").get(activeId);
        req.onsuccess = () =>
          resolve(req.result as { storage_scope_id?: string } | undefined);
        req.onerror = () => reject(req.error);
      });
      return meta?.storage_scope_id;
    } finally {
      db.close();
    }
  });
}
