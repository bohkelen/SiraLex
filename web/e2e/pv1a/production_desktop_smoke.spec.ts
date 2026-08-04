/**
 * PV1A — Production Identity and Desktop Smoke
 *
 * Targets the live HTTPS production URL (see playwright.pv1a.config.ts).
 * Evidence: data/local_evidence/pv1a_production_desktop/<run_id>/
 *
 * When deployment is behind the amended repository candidate (CF2I6A floor
 * 56cb76e), product-loop scenarios are recorded as FAIL/BLOCKED and the
 * overall decision is PV1A_PRODUCTION_DESKTOP_SMOKE_BLOCKED. The older host
 * is not treated as the amended release candidate.
 */

import { expect, test, type Page, type Request, type Response } from "@playwright/test";

import { parseLearningBackupJson } from "../../src/learning/learning_backup_package";

import {
  AMENDED_FLOOR_COMMIT,
  DEFAULT_PRODUCTION_URL,
  resolveFullIdentity,
  type IdentityReconciliation,
} from "./identity";
import {
  createRunId,
  mark,
  writePv1aEvidenceArtifacts,
  type DefectRecord,
  type Pv1aDecision,
  type Pv1aSummary,
  type ScenarioResult,
} from "./evidence";

const productionUrl = (
  process.env.SIRALEX_PRODUCTION_URL?.trim() || DEFAULT_PRODUCTION_URL
).replace(/\/$/, "");

const installTimeoutMs = Number.parseInt(
  process.env.SIRALEX_PV1A_INSTALL_TIMEOUT_MS ?? "900000",
  10,
);

/** Representative queries for repository featured bundle 7N2B contracts. */
const QUERY_SOURCE_HIT = "maman";
const QUERY_ACCENTED = "hôpital";
const QUERY_TARGET_HIT = "kun";
const QUERY_NO_RESULT = "zzzz_pv1a_nohit_9f3c";

const CF1_TYPE_TEXT = "pv1a";
const CF2_TYPE_TEXT = "smoke";

test.describe("PV1A production identity and desktop smoke", () => {
  const runId = createRunId();
  const scenarios: ScenarioResult[] = [];
  const defects: DefectRecord[] = [];
  const consoleLines: string[] = [];
  const networkEvents: Array<Record<string, unknown>> = [];
  const screenshotBuffers: Array<{ name: string; buffer: Buffer }> = [];
  const downloadTexts: Array<{ name: string; text: string }> = [];

  let identity: IdentityReconciliation;
  let decision: Pv1aDecision = "PV1A_PRODUCTION_DESKTOP_SMOKE_BLOCKED";

  test("resolve identity, smoke production desktop loops, write evidence", async ({
    browser,
  }) => {
    identity = await resolveFullIdentity(productionUrl);
    mark(
      scenarios,
      "production_identity_resolved",
      "PASS",
      [
        `repository HEAD ${identity.repository.git_head_short}`,
        `repo featured ${identity.repository.featured_bundle_id}`,
        `deployed bundles [${identity.deployed.catalog_bundle_ids.join(", ")}]`,
        `alignment ${identity.alignment_status}`,
        ...identity.alignment_notes,
      ].join(" | "),
    );

    const assetsOk =
      identity.deployed.root_http_status === 200 &&
      identity.deployed.catalog_http_status === 200 &&
      identity.deployed.webmanifest_http_status === 200 &&
      identity.deployed.featured_manifest_http_status === 200 &&
      identity.deployed.featured_records_http_status === 200 &&
      identity.deployed.featured_search_index_http_status === 200 &&
      identity.bundle_id_reconciled &&
      identity.catalog_hash_reconciled;

    if (assetsOk) {
      mark(
        scenarios,
        "https_root_catalog_manifest",
        "PASS",
        "Root, webmanifest, catalog, featured manifest, records, and search_index reconcile over HTTPS.",
      );
    } else {
      mark(
        scenarios,
        "https_root_catalog_manifest",
        "FAIL",
        [
          `root=${identity.deployed.root_http_status}`,
          `catalog=${identity.deployed.catalog_http_status}`,
          `webmanifest=${identity.deployed.webmanifest_http_status}`,
          `featured_manifest=${identity.deployed.featured_manifest_http_status}`,
          `records=${identity.deployed.featured_records_http_status}`,
          `search_index=${identity.deployed.featured_search_index_http_status}`,
          `bundle_id_reconciled=${identity.bundle_id_reconciled}`,
          `hash_reconciled=${identity.catalog_hash_reconciled}`,
        ].join(" "),
      );
      defects.push({
        class: "DEPLOYMENT_DEFECT",
        summary:
          "Deployed catalog/manifest/payload set does not fully reconcile with the repository featured candidate.",
        blocks_verified: true,
      });
    }

    mark(
      scenarios,
      "repository_deployment_alignment",
      identity.alignment_status === "ALIGNED" ? "PASS" : "FAIL",
      identity.alignment_notes.join(" "),
    );
    if (identity.alignment_status !== "ALIGNED") {
      defects.push({
        class: "DEPLOYMENT_DEFECT",
        summary: `Deployment alignment is ${identity.alignment_status}; amended floor commit ${AMENDED_FLOOR_COMMIT} is not the deployed candidate.`,
        blocks_verified: true,
      });
    }

    const context = await browser.newContext({
      baseURL: productionUrl,
      ignoreHTTPSErrors: false,
    });
    const page = await context.newPage();

    page.on("console", (msg) => {
      consoleLines.push(`[${msg.type()}] ${msg.text()}`);
    });
    page.on("pageerror", (err) => {
      consoleLines.push(`[pageerror] ${err.message}`);
    });
    page.on("request", (req: Request) => {
      networkEvents.push({
        kind: "request",
        method: req.method(),
        url: req.url(),
        resourceType: req.resourceType(),
      });
    });
    page.on("response", (res: Response) => {
      networkEvents.push({
        kind: "response",
        status: res.status(),
        url: res.url(),
        resourceType: res.request().resourceType(),
      });
    });

    try {
      if (identity.alignment_status !== "ALIGNED") {
        await runMisalignedProductionProbe(page, identity, scenarios, screenshotBuffers);
      } else {
        await runAlignedProductionSmoke({
          page,
          context,
          identity,
          scenarios,
          defects,
          screenshotBuffers,
          downloadTexts,
          consoleLines,
        });
      }

      await classifyConsole(scenarios, consoleLines, defects);
      await classifyNetworkBoundary(scenarios, networkEvents, defects);

      const requiredIds = [
        "production_identity_resolved",
        "https_root_catalog_manifest",
        "shell_capability_gate",
        "clean_first_run_install",
        "source_to_target_search",
        "target_to_source_search",
        "accented_unicode_search",
        "entry_detail",
        "learning_smoke",
        "lp1_smoke",
        "cf1_human_typing_save_manage_export",
        "cf2_human_typing_save_manage_export",
        "feedback_input_amendment_regression",
        "hard_reload_persistence",
        "offline_desktop_reload_search",
        "pwa_service_worker",
        "en_fr_locale_smoke",
        "console_clean_or_explained",
        "network_boundary",
        "repository_deployment_alignment",
        "indexeddb_schema_observation",
      ];

      for (const id of requiredIds) {
        if (!scenarios.some((s) => s.id === id)) {
          mark(scenarios, id, "FAIL", "Scenario was not executed.");
        }
      }

      const blockingDefect = defects.some((d) => d.blocks_verified);
      const requiredFailed = requiredIds.some((id) => {
        const s = scenarios.find((x) => x.id === id);
        return !s || s.status === "FAIL";
      });

      decision =
        !blockingDefect &&
        !requiredFailed &&
        identity.alignment_status === "ALIGNED"
          ? "PV1A_PRODUCTION_DESKTOP_SMOKE_VERIFIED"
          : "PV1A_PRODUCTION_DESKTOP_SMOKE_BLOCKED";

      await page.goto("/", { waitUntil: "domcontentloaded" });
      await expect(page.locator("#app")).toBeVisible({ timeout: 30_000 });
      const browserInfo = await page.evaluate(() => ({
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
      }));
      const browserInfoFull = {
        ...browserInfo,
        viewport: page.viewportSize(),
      };

      const summary: Pv1aSummary = {
        schema_version: "pv1a_production_desktop_smoke_summary_v1",
        decision,
        alignment_status: identity.alignment_status,
        repository_head: identity.repository.git_head,
        amended_floor_commit: AMENDED_FLOOR_COMMIT,
        production_url: productionUrl,
        verification_timestamp: new Date().toISOString(),
        browser: String(browserInfoFull.userAgent),
        os: `${process.platform} / ${String(browserInfoFull.platform)}`,
        scenarios,
        defects,
        artifact_names: [],
        evidence_path: "",
      };

      const evidencePath = await writePv1aEvidenceArtifacts({
        runId,
        summary,
        identity: {
          verification_tuple: {
            git_commit: identity.repository.git_head,
            app_build_version: identity.repository.app_package_version,
            production_url: productionUrl,
            catalog_url: `${productionUrl}/catalog.json`,
            catalog_version_repo_featured: identity.repository.featured_catalog_version,
            catalog_version_deployed_primary:
              identity.deployed.catalog_primary_bundle?.version ?? null,
            featured_bundle_id_repo: identity.repository.featured_bundle_id,
            featured_bundle_id_deployed:
              identity.deployed.catalog_featured_match?.bundle_id ??
              identity.deployed.catalog_primary_bundle?.bundle_id ??
              null,
            content_sha256_repo: identity.repository.content_sha256,
            content_sha256_deployed:
              identity.deployed.featured_manifest?.content_sha256 ??
              identity.deployed.primary_manifest?.content_sha256 ??
              null,
            storage_scope_id: identity.repository.storage_scope_id_pattern,
            normalization_ruleset: identity.repository.normalization_ruleset,
            manifest_identity: {
              repo: {
                bundle_id: identity.repository.manifest_bundle_id,
                content_sha256: identity.repository.manifest_content_sha256,
                git_commit: identity.repository.manifest_git_commit,
              },
              deployed_featured: identity.deployed.featured_manifest ?? null,
              deployed_primary: identity.deployed.primary_manifest ?? null,
            },
            verification_timestamp: summary.verification_timestamp,
            browser: summary.browser,
            os: summary.os,
          },
          repository_candidate: identity.repository,
          deployed_production_candidate: identity.deployed,
          alignment_status: identity.alignment_status,
          alignment_notes: identity.alignment_notes,
          catalog_hash_reconciled: identity.catalog_hash_reconciled,
          bundle_id_reconciled: identity.bundle_id_reconciled,
          amended_runtime_markers_present: identity.amended_runtime_markers_present,
          browser_info: browserInfoFull,
        },
        network: {
          events: networkEvents,
          classification: classifyNetworkEvents(networkEvents),
        },
        consoleLines,
        screenshotBuffers,
        downloadTexts,
      });

      test.info().annotations.push({
        type: "pv1a-decision",
        description: decision,
      });
      test.info().annotations.push({
        type: "pv1a-evidence",
        description: evidencePath,
      });

      // Harness records VERIFIED only when aligned and all required scenarios pass.
      expect(["PV1A_PRODUCTION_DESKTOP_SMOKE_VERIFIED", "PV1A_PRODUCTION_DESKTOP_SMOKE_BLOCKED"]).toContain(
        decision,
      );
      if (identity.alignment_status !== "ALIGNED") {
        expect(decision).toBe("PV1A_PRODUCTION_DESKTOP_SMOKE_BLOCKED");
      } else {
        expect(
          decision,
          `Aligned production must verify; failed scenarios: ${scenarios
            .filter((s) => s.status === "FAIL")
            .map((s) => s.id)
            .join(", ")}`,
        ).toBe("PV1A_PRODUCTION_DESKTOP_SMOKE_VERIFIED");
      }
    } finally {
      await context.close();
    }
  });
});

async function runMisalignedProductionProbe(
  page: Page,
  identity: IdentityReconciliation,
  scenarios: ScenarioResult[],
  screenshotBuffers: Array<{ name: string; buffer: Buffer }>,
): Promise<void> {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#app")).toBeVisible({ timeout: 30_000 });
  screenshotBuffers.push({
    name: "01_production_shell.png",
    buffer: await page.screenshot({ fullPage: true }),
  });

  const featuredInstall = page.locator("#featuredInstall");
  const searchInput = page.locator("#searchInput");
  const hasFirstRun = await featuredInstall.isVisible().catch(() => false);
  const searchEnabled = await searchInput.isEnabled().catch(() => false);

  mark(
    scenarios,
    "clean_first_run_install",
    "FAIL",
    hasFirstRun || searchEnabled
      ? `First-run/shell visible on misaligned deployment (featuredInstall=${hasFirstRun}, searchEnabled=${searchEnabled}). Not exercised as amended-candidate install because alignment is ${identity.alignment_status}.`
      : "Production shell did not expose first-run install controls.",
  );

  const hasCf1 = (await page.locator("#openManageCorrections").count()) > 0;
  const hasCf2 = (await page.locator("#openManageSearchFeedback").count()) > 0;
  const hasLearning = (await page.locator("#openSavedVocabulary").count()) > 0;
  const hasLocale = (await page.locator("#localeSelect").count()) > 0;

  const blockedNote = `Skipped against amended candidate: deployment alignment ${identity.alignment_status}. Deployed shell markers: CF1=${hasCf1}, CF2=${hasCf2}, Learning=${hasLearning}. Deployed catalog featured match=${Boolean(identity.deployed.catalog_featured_match)}.`;

  mark(scenarios, "shell_capability_gate", "FAIL", blockedNote);
  for (const id of [
    "source_to_target_search",
    "target_to_source_search",
    "accented_unicode_search",
    "entry_detail",
    "learning_smoke",
    "lp1_smoke",
    "cf1_human_typing_save_manage_export",
    "cf2_human_typing_save_manage_export",
    "feedback_input_amendment_regression",
    "hard_reload_persistence",
    "offline_desktop_reload_search",
    "indexeddb_schema_observation",
  ]) {
    mark(scenarios, id, "FAIL", blockedNote);
  }

  // PWA / locale can still be observed on the live host without claiming amended-candidate PASS.
  await observePwa(page, scenarios);
  if (hasLocale) {
    const defaultLocale = await page.locator("#localeSelect").inputValue();
    await setUiLocale(page, "en");
    await setUiLocale(page, "fr");
    mark(
      scenarios,
      "en_fr_locale_smoke",
      "FAIL",
      `Locale selector present; observed default=${defaultLocale}. Full EN/FR product-loop copy not verified because deployment is not the amended candidate.`,
    );
  } else {
    mark(scenarios, "en_fr_locale_smoke", "FAIL", "No #localeSelect on deployed shell.");
  }
}

async function runAlignedProductionSmoke(options: {
  page: Page;
  context: import("@playwright/test").BrowserContext;
  identity: IdentityReconciliation;
  scenarios: ScenarioResult[];
  defects: DefectRecord[];
  screenshotBuffers: Array<{ name: string; buffer: Buffer }>;
  downloadTexts: Array<{ name: string; text: string }>;
  consoleLines: string[];
}): Promise<void> {
  const { page, context, identity, scenarios, defects, screenshotBuffers, downloadTexts } =
    options;

  // Clean first-run install (no IndexedDB seeding).
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#app")).toBeVisible({ timeout: 30_000 });
  screenshotBuffers.push({
    name: "01_first_run.png",
    buffer: await page.screenshot({ fullPage: true }),
  });

  const defaultLocale = await page.locator("#localeSelect").inputValue();

  // Shell capability sanity gate before install/smoke.
  const hasSaved = (await page.locator("#openSavedVocabulary").count()) > 0;
  const hasCf1 = (await page.locator("#openManageCorrections").count()) > 0;
  const hasCf2 = (await page.locator("#openManageSearchFeedback").count()) > 0;
  await page.locator("#openManageDictionaries").click();
  await page.locator("#manageDictionariesPanel").evaluate((el) => {
    if (el instanceof HTMLDetailsElement) el.open = true;
  });
  const hasLearningData = (await page.locator("#learningBackupHost").count()) > 0;
  if (hasSaved && hasCf1 && hasCf2 && hasLearningData) {
    mark(
      scenarios,
      "shell_capability_gate",
      "PASS",
      "Saved Vocabulary, Manage Corrections, Manage Search Feedback, and Learning-data host present.",
    );
  } else {
    mark(
      scenarios,
      "shell_capability_gate",
      "FAIL",
      `saved=${hasSaved} cf1=${hasCf1} cf2=${hasCf2} learningData=${hasLearningData}`,
    );
    defects.push({
      class: "DEPLOYMENT_DEFECT",
      summary: "Deployed shell missing Learning/CF1/CF2 management surfaces.",
      blocks_verified: true,
    });
    return;
  }

  await setUiLocale(page, "fr");
  await expect(page.locator("#featuredInstall")).toBeVisible();
  await page.locator("#featuredInstall").click();
  await expect(page.locator("#searchInput")).toBeEnabled({ timeout: installTimeoutMs });
  const activeBundle = await getActiveBundleId(page);
  if (activeBundle !== identity.repository.featured_bundle_id) {
    mark(
      scenarios,
      "clean_first_run_install",
      "FAIL",
      `Expected active bundle ${identity.repository.featured_bundle_id}, got ${activeBundle}`,
    );
    defects.push({
      class: "PRODUCT_DEFECT",
      summary: "Featured install did not activate repository featured bundle.",
      blocks_verified: true,
    });
    return;
  }
  mark(
    scenarios,
    "clean_first_run_install",
    "PASS",
    `Featured dictionary installed and active. Observed default locale before switch: ${defaultLocale}.`,
  );

  await setUiLocale(page, "en");

  // Search smoke
  await ensureSourceToTarget(page);
  await runSearch(page, QUERY_SOURCE_HIT);
  await expect(page.locator("#searchResults .result-open").first()).toBeVisible({
    timeout: 15_000,
  });
  mark(scenarios, "source_to_target_search", "PASS", `Query ${QUERY_SOURCE_HIT}`);

  await runSearch(page, QUERY_ACCENTED);
  await expect(page.locator("#searchResults .result-open").first()).toBeVisible({
    timeout: 15_000,
  });
  mark(scenarios, "accented_unicode_search", "PASS", `Query ${QUERY_ACCENTED}`);

  await ensureTargetToSource(page);
  await runSearch(page, QUERY_TARGET_HIT);
  await expect(page.locator("#searchResults .result-open").first()).toBeVisible({
    timeout: 15_000,
  });
  mark(scenarios, "target_to_source_search", "PASS", `Query ${QUERY_TARGET_HIT}`);

  await ensureSourceToTarget(page);
  await runSearch(page, QUERY_NO_RESULT);
  await expect(page.locator("[data-testid='search-feedback-entry-no-result']")).toBeVisible({
    timeout: 15_000,
  });

  // Entry detail (genuine lexicon_entry, not source-result shell)
  await openGenuineLexiconEntry(page, QUERY_SOURCE_HIT);
  await expect(page.locator(".entry-detail.entry-lexicon")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".entry-headword")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("#entry-learning-save")).toBeVisible();
  await expect(page.locator("#entry-suggest-correction")).toBeVisible();
  const entryText = (await page.locator(".entry-detail.entry-lexicon").innerText()) ?? "";
  if (/storage_scope_id|content_sha256|git_commit/i.test(entryText)) {
    mark(
      scenarios,
      "entry_detail",
      "FAIL",
      "Consumer entry surface leaked internal metadata.",
    );
    defects.push({
      class: "PRODUCT_DEFECT",
      summary: "Entry detail leaked internal metadata.",
      blocks_verified: true,
    });
  } else {
    mark(
      scenarios,
      "entry_detail",
      "PASS",
      "Genuine lexicon entry rendered with Save/Suggest; no metadata leak.",
    );
  }
  screenshotBuffers.push({
    name: "02_entry_detail.png",
    buffer: await page.screenshot({ fullPage: true }),
  });

  // Learning smoke
  await page.locator("#entry-learning-save").click();
  await page.locator("#openSavedVocabulary").click();
  await expect(page.locator("#saved-vocab-heading")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".saved-vocab-list .saved-vocab-row").first()).toBeVisible();
  await expect(page.locator("#saved-vocab-progress-heading")).toBeVisible();
  await page.locator("#saved-vocab-start-review").click();
  await expect(page.locator(".review-reveal").or(page.locator("#review-complete-heading"))).toBeVisible(
    { timeout: 15_000 },
  );
  if (await page.locator(".review-reveal").isVisible()) {
    await page.locator(".review-reveal").click();
    await page.locator(".review-still-learning").click();
  }
  await page.locator(".review-back").click();
  await expect(page.locator("#saved-vocab-heading")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("#saved-vocab-progress-heading")).toBeVisible({ timeout: 15_000 });
  mark(scenarios, "learning_smoke", "PASS", "Save → Saved Vocabulary → Review → Progress.");

  // LP1 export + preview cancel
  await openManageLearningData(page);
  await expect(page.locator("#learning-backup-heading")).toBeVisible({ timeout: 15_000 });
  const learningDownloadPromise = page.waitForEvent("download", { timeout: 30_000 });
  await page.locator(".learning-backup-export .btn").click();
  const learningDownload = await learningDownloadPromise;
  const learningPath = await learningDownload.path();
  if (!learningPath) {
    throw new Error(`Learning download failed: ${await learningDownload.failure()}`);
  }
  const { readFile } = await import("node:fs/promises");
  const learningText = await readFile(learningPath, "utf8");
  downloadTexts.push({ name: learningDownload.suggestedFilename(), text: learningText });
  const parsedLearning = parseLearningBackupJson(learningText, {
    byteLength: Buffer.byteLength(learningText, "utf8"),
  });
  if (!parsedLearning.ok) {
    mark(
      scenarios,
      "lp1_smoke",
      "FAIL",
      `LP1 parser rejected export: ${parsedLearning.errors.map((e) => e.code).join(",")}`,
    );
    defects.push({
      class: "PRODUCT_DEFECT",
      summary: "LP1 export failed production parser schema check.",
      blocks_verified: true,
    });
  } else {
    const restoreInput = page.locator("#learning-backup-file-input");
    if ((await restoreInput.count()) > 0) {
      await restoreInput.setInputFiles(learningPath);
      await expect(page.locator("#learning-backup-preview-heading")).toBeVisible({
        timeout: 15_000,
      });
      // Bounded restore: abandon preview by returning to search shell (no apply).
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await expect(page.locator("#searchInput")).toBeEnabled({ timeout: 30_000 });
    }
    mark(
      scenarios,
      "lp1_smoke",
      "PASS",
      "Export validated by parseLearningBackupJson; restore preview opened then abandoned without apply.",
    );
  }

  // CF1 human typing
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await openGenuineLexiconEntry(page, QUERY_SOURCE_HIT);
  await expect(page.locator("#entry-suggest-correction")).toBeVisible({ timeout: 15_000 });
  await page.locator("#entry-suggest-correction").click();
  await expect(page.locator("[data-testid='correction-form']")).toBeVisible();
  await page.locator("#correction-form-issue").selectOption({ index: 1 });
  await page.locator("#correction-form-target").selectOption({ index: 1 });
  const cf1Desc = page.locator("#correction-form-description");
  await cf1Desc.click();
  await page.evaluate(() => {
    (window as unknown as { __pv1aCf1Node?: Element | null }).__pv1aCf1Node =
      document.getElementById("correction-form-description");
  });
  await typeAndAssertFocus(page, cf1Desc, CF1_TYPE_TEXT);
  const cf1SameNode = await page.evaluate(() => {
    const w = window as unknown as { __pv1aCf1Node?: Element | null };
    return document.getElementById("correction-form-description") === w.__pv1aCf1Node;
  });
  expect(cf1SameNode).toBe(true);
  await expect(cf1Desc).toHaveValue(CF1_TYPE_TEXT);
  await page.locator("#correction-form-save").click();
  await expect(page.locator("#correction-form-success-heading")).toBeVisible({ timeout: 15_000 });
  await page.locator("#openManageCorrections").click();
  await expect(page.locator("[data-testid='correction-manage']")).toBeVisible({ timeout: 15_000 });
  await page.locator(".correction-manage-row-button").first().click();
  await page.getByRole("button", { name: /Edit|Modifier/i }).click();
  const manageDesc = page.locator("#correction-manage-description");
  await manageDesc.click();
  await manageDesc.fill("");
  await typeAndAssertFocus(page, manageDesc, "edit");
  await expect(manageDesc).toHaveValue("edit");
  await page.getByRole("button", { name: /Save changes|Enregistrer/i }).click();
  await expect(page.locator(".correction-manage-description")).toContainText("edit", {
    timeout: 15_000,
  });
  await page.getByRole("button", { name: /Back to list|Retour à la liste/i }).click();
  await expect(page.locator("#correction-manage-export")).toBeEnabled({ timeout: 15_000 });
  const cf1ExportPromise = page.waitForEvent("download", { timeout: 30_000 });
  await page.locator("#correction-manage-export").click();
  const cf1Download = await cf1ExportPromise;
  const cf1Path = await cf1Download.path();
  if (cf1Path) {
    downloadTexts.push({
      name: cf1Download.suggestedFilename(),
      text: await readFile(cf1Path, "utf8"),
    });
  }
  mark(
    scenarios,
    "cf1_human_typing_save_manage_export",
    "PASS",
    "Suggest → sequential typing → save → manage → edit → export.",
  );

  // CF2 human typing (no_result path)
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await ensureSourceToTarget(page);
  await runSearch(page, QUERY_NO_RESULT);
  await page.locator("[data-testid='search-feedback-report']").click();
  const meaning = page.locator("[data-testid='search-feedback-meaning']");
  await meaning.click();
  await typeAndAssertFocus(page, meaning, CF2_TYPE_TEXT);
  await expect(meaning).toHaveValue(CF2_TYPE_TEXT);
  await page.locator("[data-testid='search-feedback-save']").click();
  await expect(page.locator("#search-feedback-capture-heading")).toContainText(/saved|enregistr/i, {
    timeout: 15_000,
  });

  // results_not_useful entry point visible on a hit search
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await runSearch(page, QUERY_SOURCE_HIT);
  await expect(
    page.locator("[data-testid='search-feedback-entry-results-not-useful']"),
  ).toBeVisible({ timeout: 15_000 });

  await page.locator("#openManageSearchFeedback").click();
  await expect(page.locator("[data-testid='search-feedback-manage-row']").first()).toBeVisible({
    timeout: 15_000,
  });
  await page.locator("[data-testid='search-feedback-manage-row']").first().click();
  await page.getByRole("button", { name: /Edit notes|Modifier/i }).click();
  const manageMeaning = page.locator("#search-feedback-manage-meaning");
  await manageMeaning.click();
  await manageMeaning.fill("");
  await typeAndAssertFocus(page, manageMeaning, "ok");
  await expect(manageMeaning).toHaveValue("ok");
  await page.getByRole("button", { name: /Save changes|Enregistrer/i }).click();
  await expect(page.locator(".search-feedback-manage-detail-meaning")).toContainText("ok", {
    timeout: 15_000,
  });
  await page.locator(".search-feedback-manage-back-list").click();
  await expect(page.locator("#search-feedback-manage-export")).toBeEnabled({ timeout: 15_000 });
  const cf2ExportPromise = page.waitForEvent("download", { timeout: 30_000 });
  await page.locator("#search-feedback-manage-export").click();
  const cf2Download = await cf2ExportPromise;
  const cf2Path = await cf2Download.path();
  if (cf2Path) {
    downloadTexts.push({
      name: cf2Download.suggestedFilename(),
      text: await readFile(cf2Path, "utf8"),
    });
  }
  mark(
    scenarios,
    "cf2_human_typing_save_manage_export",
    "PASS",
    "no_result report + results_not_useful entry; manage/edit/export with sequential typing.",
  );
  mark(
    scenarios,
    "feedback_input_amendment_regression",
    "PASS",
    "Sequential key presses retained focus on CF1 capture, CF1 manage edit, CF2 capture, and CF2 manage edit.",
  );

  // Hard reload persistence
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("#openSavedVocabulary").click();
  await expect(page.locator(".saved-vocab-list .saved-vocab-row").first()).toBeVisible({
    timeout: 15_000,
  });
  await page.locator("#openManageCorrections").click();
  await expect(page.locator(".correction-manage-row-button").first()).toBeVisible({
    timeout: 15_000,
  });
  await page.locator("#openManageSearchFeedback").click();
  await expect(page.locator("[data-testid='search-feedback-manage-row']").first()).toBeVisible({
    timeout: 15_000,
  });
  mark(scenarios, "hard_reload_persistence", "PASS");

  // Offline desktop
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("#searchInput")).toBeEnabled({ timeout: 30_000 });
  await openGenuineLexiconEntry(page, QUERY_SOURCE_HIT);
  await expect(page.locator(".entry-detail.entry-lexicon")).toBeVisible({ timeout: 15_000 });
  await page.locator("#openSavedVocabulary").click();
  await expect(page.locator("#saved-vocab-heading")).toBeVisible({ timeout: 15_000 });
  await page.locator("#openManageCorrections").click();
  await expect(page.locator("[data-testid='correction-manage']")).toBeVisible({ timeout: 15_000 });
  await page.locator("#openManageSearchFeedback").click();
  await expect(page.locator("[data-testid='search-feedback-manage']")).toBeVisible({
    timeout: 15_000,
  });
  mark(
    scenarios,
    "offline_desktop_reload_search",
    "PASS",
    "Core shipped desktop functionality remains usable without a remote network dependency after the application shell and dictionary are locally available.",
  );
  await context.setOffline(false);
  // Allow SW to claim the page after returning online.
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("#searchInput")).toBeEnabled({ timeout: 30_000 });

  await observePwa(page, scenarios);
  await observeIndexedDb(page, scenarios);

  // Locale EN/FR smoke on primary chrome
  await setUiLocale(page, "en");
  await expect(page.locator("#openSavedVocabulary")).toContainText(/Saved Vocabulary/i);
  await setUiLocale(page, "fr");
  await expect(page.locator("#openSavedVocabulary")).toContainText(/vocabulaire|enregistr/i);
  mark(
    scenarios,
    "en_fr_locale_smoke",
    "PASS",
    `Default locale observed at first-run: ${defaultLocale}. EN/FR chrome labels switch without obvious fallback keys.`,
  );
}

async function observePwa(page: Page, scenarios: ScenarioResult[]): Promise<void> {
  const manifestOk = await page.evaluate(async () => {
    const link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
    if (!link?.href) return { ok: false, href: null as string | null, status: 0 };
    const res = await fetch(link.href);
    return { ok: res.ok, href: link.href, status: res.status };
  });

  // Allow install/activate on first clean visit before reading controller state.
  const sw = await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) {
      return { supported: false as const };
    }
    try {
      const ready = await Promise.race([
        navigator.serviceWorker.ready.then((reg) => ({
          ok: true as const,
          scope: reg.scope,
          active: reg.active?.state ?? null,
          installing: reg.installing?.state ?? null,
          waiting: reg.waiting?.state ?? null,
        })),
        new Promise<{ ok: false; error: string }>((resolve) =>
          setTimeout(() => resolve({ ok: false, error: "serviceWorker.ready timeout" }), 15_000),
        ),
      ]);
      return {
        supported: true as const,
        controller: Boolean(navigator.serviceWorker.controller),
        ...ready,
      };
    } catch (e) {
      return {
        supported: true as const,
        controller: Boolean(navigator.serviceWorker.controller),
        ok: false as const,
        error: String(e),
      };
    }
  });

  if (
    manifestOk.ok &&
    sw.supported &&
    "ok" in sw &&
    sw.ok &&
    sw.controller &&
    "active" in sw &&
    sw.active
  ) {
    mark(
      scenarios,
      "pwa_service_worker",
      "PASS",
      `manifest status=${manifestOk.status}; sw controller=${sw.controller}; scope=${"scope" in sw ? sw.scope : null}; active=${"active" in sw ? sw.active : null}`,
    );
  } else {
    mark(
      scenarios,
      "pwa_service_worker",
      "FAIL",
      `manifest=${JSON.stringify(manifestOk)} sw=${JSON.stringify(sw)}`,
    );
  }
}

async function observeIndexedDb(page: Page, scenarios: ScenarioResult[]): Promise<void> {
  const info = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("siralex_db");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    try {
      return {
        name: db.name,
        version: db.version,
        stores: Array.from(db.objectStoreNames),
      };
    } finally {
      db.close();
    }
  });
  const expected = [
    "learning_records",
    "correction_drafts",
    "search_failure_feedback",
    "query_logs",
    "records",
    "search_index",
    "bundles_registry",
    "meta",
  ];
  const missing = expected.filter((s) => !info.stores.includes(s));
  if (info.version === 6 && missing.length === 0) {
    mark(
      scenarios,
      "indexeddb_schema_observation",
      "PASS",
      `siralex_db version=${info.version}; stores ok`,
    );
  } else {
    mark(
      scenarios,
      "indexeddb_schema_observation",
      "FAIL",
      `version=${info.version} missing=${missing.join(",") || "none"} stores=${info.stores.join(",")}`,
    );
  }
}

async function classifyConsole(
  scenarios: ScenarioResult[],
  consoleLines: string[],
  defects: DefectRecord[],
): Promise<void> {
  const unexpected = consoleLines.filter((line) => {
    const lower = line.toLowerCase();
    return (
      lower.startsWith("[error]") ||
      lower.startsWith("[pageerror]") ||
      lower.includes("uncaught") ||
      lower.includes("indexeddb") && lower.includes("error")
    );
  });
  if (unexpected.length === 0) {
    mark(
      scenarios,
      "console_clean_or_explained",
      "PASS",
      `No unexpected console errors (${consoleLines.length} total lines captured).`,
    );
  } else {
    mark(
      scenarios,
      "console_clean_or_explained",
      "FAIL",
      unexpected.slice(0, 20).join(" || "),
    );
    defects.push({
      class: "PRODUCT_DEFECT",
      summary: "Unexpected browser console errors during PV1A smoke.",
      blocks_verified: true,
    });
  }
}

async function classifyNetworkBoundary(
  scenarios: ScenarioResult[],
  networkEvents: Array<Record<string, unknown>>,
  defects: DefectRecord[],
): Promise<void> {
  const classification = classifyNetworkEvents(networkEvents);
  const badUploads = classification.unexpected_feedback_or_backup_posts;
  if (badUploads.length === 0) {
    mark(
      scenarios,
      "network_boundary",
      "PASS",
      `No remote CF1/CF2/Learning payload posts observed. Failed responses: ${classification.failed.length}. Third-party: ${classification.third_party.length}.`,
    );
  } else {
    mark(
      scenarios,
      "network_boundary",
      "FAIL",
      `Unexpected remote posts: ${badUploads.join(", ")}`,
    );
    defects.push({
      class: "PRODUCT_DEFECT",
      summary: "Save/Export appeared to post feedback or learning payloads remotely.",
      blocks_verified: true,
    });
  }
}

function classifyNetworkEvents(networkEvents: Array<Record<string, unknown>>): {
  expected_production: string[];
  failed: string[];
  third_party: string[];
  unexpected_feedback_or_backup_posts: string[];
} {
  const expected_production: string[] = [];
  const failed: string[] = [];
  const third_party: string[] = [];
  const unexpected_feedback_or_backup_posts: string[] = [];

  for (const ev of networkEvents) {
    if (ev.kind !== "response" && ev.kind !== "request") continue;
    const url = String(ev.url ?? "");
    const method = String(ev.method ?? "");
    const status = Number(ev.status ?? 0);

    if (ev.kind === "response" && status >= 400) {
      failed.push(`${status} ${url}`);
    }

    try {
      const u = new URL(url);
      const isProd = u.href.startsWith(productionUrl);
      if (!isProd && !u.protocol.startsWith("blob") && u.protocol !== "data:") {
        third_party.push(url);
      }
      if (isProd) expected_production.push(`${method || "GET"} ${u.pathname}`);
    } catch {
      // ignore
    }

    if (
      (method === "POST" || method === "PUT" || method === "PATCH") &&
      /correction|search-feedback|learning-backup|feedback/i.test(url)
    ) {
      unexpected_feedback_or_backup_posts.push(`${method} ${url}`);
    }
  }

  return {
    expected_production: [...new Set(expected_production)].slice(0, 200),
    failed: [...new Set(failed)].slice(0, 100),
    third_party: [...new Set(third_party)].slice(0, 100),
    unexpected_feedback_or_backup_posts: [...new Set(unexpected_feedback_or_backup_posts)],
  };
}

async function typeAndAssertFocus(
  page: Page,
  locator: ReturnType<Page["locator"]>,
  text: string,
): Promise<void> {
  for (const ch of text) {
    await locator.press(ch === " " ? "Space" : ch);
    await expect(locator).toBeFocused();
  }
}

async function setUiLocale(page: Page, locale: "en" | "fr"): Promise<void> {
  const select = page.locator("#localeSelect");
  await expect(select).toBeVisible({ timeout: 30_000 });
  if ((await select.inputValue()) !== locale) {
    await Promise.all([
      page.waitForLoadState("domcontentloaded"),
      select.selectOption(locale),
    ]);
    await expect(page.locator("#app")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("#localeSelect")).toHaveValue(locale, { timeout: 30_000 });
  }
}

async function ensureSourceToTarget(page: Page): Promise<void> {
  const toggle = page.locator("#langToggle");
  const label = (await toggle.textContent()) ?? "";
  if (/→/.test(label)) {
    const left = label.split("→")[0] ?? "";
    if (/Maninka|Target|Cible|mnk/i.test(left)) {
      await toggle.click();
    }
  }
}

async function ensureTargetToSource(page: Page): Promise<void> {
  const toggle = page.locator("#langToggle");
  const label = (await toggle.textContent()) ?? "";
  if (/→/.test(label)) {
    const left = label.split("→")[0] ?? "";
    if (!/Maninka|Target|Cible|mnk/i.test(left)) {
      await toggle.click();
    }
  }
}

async function runSearch(page: Page, query: string): Promise<void> {
  await page.locator("#searchInput").fill(query);
  await page.waitForTimeout(300);
}

/** Open a genuine lexicon_entry (via target link when source-result shell is shown). */
async function openGenuineLexiconEntry(page: Page, sourceQuery: string): Promise<void> {
  await ensureSourceToTarget(page);
  await runSearch(page, sourceQuery);
  await expect(page.locator("#searchResults .result-open").first()).toBeVisible({
    timeout: 15_000,
  });
  await page.locator("#searchResults .result-open").first().click();
  await expect(page.locator(".entry-headword")).toBeVisible({ timeout: 15_000 });

  if (await page.locator(".entry-detail.entry-lexicon").isVisible().catch(() => false)) {
    return;
  }

  const targetLink = page.locator(".entry-index .target-link").first();
  await expect(targetLink).toBeVisible({ timeout: 15_000 });
  await targetLink.click();
  await expect(page.locator(".entry-detail.entry-lexicon")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("#entry-learning-save")).toBeVisible({ timeout: 15_000 });
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

async function openManageLearningData(page: Page): Promise<void> {
  await page.locator("#openManageDictionaries").click();
  await expect(page.locator("#manageDictionariesPanel")).toBeVisible();
  await page.locator("#manageDictionariesPanel").evaluate((el) => {
    if (el instanceof HTMLDetailsElement) el.open = true;
  });
  await expect(page.locator("#learning-backup-heading")).toBeVisible({ timeout: 15_000 });
}
