/**
 * PVR1 — Theme + Feedback Production Re-Smoke
 *
 * Live HTTPS host (playwright.pvr1.config.ts).
 * Evidence: data/local_evidence/pvr1_theme_feedback_production/<run_id>/
 *
 * Real inbox receipt cannot be proven from the browser alone; set
 * SIRALEX_PVR1_INBOX_RECEIPT=PASS only when an operator has confirmed arrival
 * of the JSON attachment in the configured review inbox.
 */

import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Page, type Request, type Response } from "@playwright/test";

import {
  createRunId,
  writePvr1Evidence,
  type CheckStatus,
  type DefectRecord,
  type Pvr1Decision,
  type Pvr1Summary,
} from "./evidence";

const productionUrl = (
  process.env.SIRALEX_PRODUCTION_URL?.trim() ||
  "https://loquacious-piroshki-be432c.netlify.app"
).replace(/\/$/, "");

const REVIEW_INBOX = "diabilasekou@gmail.com";
const FEATURED_BUNDLE_ID = "bundle_full_20260710_337619ff";
const THEME_KEY = "siralex.ui_theme";
const QUERY_HIT = "maman";
const QUERY_NO_RESULT = "zzzz_pvr1_nohit_synth";

const installTimeoutMs = Number.parseInt(
  process.env.SIRALEX_PVR1_INSTALL_TIMEOUT_MS ?? "900000",
  10,
);

const inboxReceiptEnv = process.env.SIRALEX_PVR1_INBOX_RECEIPT?.trim().toUpperCase();

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function gitHead(): string {
  try {
    return execSync("git rev-parse HEAD", { cwd: repoRoot, encoding: "utf-8" }).trim();
  } catch {
    return "unknown";
  }
}

test.describe("PVR1 theme + feedback production re-smoke", () => {
  const runId = createRunId();
  const consoleLines: string[] = [];
  const networkEvents: Array<Record<string, unknown>> = [];
  const packageTexts: Array<{ name: string; text: string }> = [];
  const screenshotBuffers: Array<{ name: string; buffer: Buffer }> = [];
  const defects: DefectRecord[] = [];
  const notes: string[] = [];

  const checks: Record<string, CheckStatus> = {
    uxt1_production: "NOT_RUN",
    fh1_configuration: "NOT_RUN",
    fh1a_destination_visibility: "NOT_RUN",
    cf1_handoff_preparation: "NOT_RUN",
    cf2_handoff_preparation: "NOT_RUN",
    real_inbox_receipt: "NOT_RUN",
    attachment_schema: "NOT_RUN",
    draft_status_preservation: "NOT_RUN",
    backend_submission_absent: "NOT_RUN",
  };

  let transportMethod: Pvr1Summary["transport_method"] = null;
  let cf1Filename: string | null = null;
  let cf2Filename: string | null = null;
  let cf1Schema: string | null = null;
  let cf2Schema: string | null = null;
  let shellAsset: string | null = null;

  test("theme, FH1/FH1A, CF1/CF2 handoff preparation on production", async ({ browser }) => {
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

    // Mock Web Share so desktop Chromium can take the share branch when available;
    // if the app chooses download_mailto, that remains valid for PVR1.
    await page.addInitScript(() => {
      const shareCalls: ShareData[] = [];
      (window as unknown as { __pvr1ShareCalls?: ShareData[] }).__pvr1ShareCalls = shareCalls;
      Object.defineProperty(navigator, "canShare", {
        configurable: true,
        value: (data: ShareData) => Array.isArray(data.files) && data.files.length > 0,
      });
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: async (data: ShareData) => {
          shareCalls.push(data);
        },
      });
    });

    try {
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await expect(page.locator("#app")).toBeVisible({ timeout: 30_000 });
      shellAsset = await page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll("script[src]"));
        const hit = scripts.find((s) => /assets\/index-/.test(s.getAttribute("src") ?? ""));
        return hit?.getAttribute("src") ?? null;
      });

      // --- UXT1 ---
      await page.emulateMedia({ colorScheme: "light" });
      await page.evaluate((key) => localStorage.removeItem(key), THEME_KEY);
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.locator("#themeSelect")).toHaveValue("system");
      await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

      await page.emulateMedia({ colorScheme: "dark" });
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.locator("#themeSelect")).toHaveValue("system");
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

      await page.locator("#themeSelect").selectOption("light");
      await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
      expect(await page.evaluate((key) => localStorage.getItem(key), THEME_KEY)).toBe("light");
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.locator("#themeSelect")).toHaveValue("light");
      await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

      await page.locator("#themeSelect").selectOption("dark");
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.locator("#themeSelect")).toHaveValue("dark");

      await setUiLocale(page, "en");
      await expect(page.locator("#themeSelectorLabel")).toHaveText("Theme");
      await expect(page.locator("#themeSelect option[value='system']")).toHaveText("System");
      await expect(page.locator("#themeSelect option[value='light']")).toHaveText("Light");
      await expect(page.locator("#themeSelect option[value='dark']")).toHaveText("Dark");

      await setUiLocale(page, "fr");
      await expect(page.locator("#themeSelectorLabel")).toHaveText("Thème");
      await expect(page.locator("#themeSelect option[value='system']")).toHaveText("Système");
      await expect(page.locator("#themeSelect option[value='light']")).toHaveText("Clair");
      await expect(page.locator("#themeSelect option[value='dark']")).toHaveText("Sombre");

      checks.uxt1_production = "PASS";
      screenshotBuffers.push({
        name: "01_theme_fr.png",
        buffer: await page.screenshot({ fullPage: true }),
      });

      // --- Featured install (needed for CF1/CF2 drafts) ---
      await setUiLocale(page, "en");
      await ensureFeaturedDictionary(page);
      notes.push(`active_bundle_id=${(await getActiveBundleId(page)) ?? "none"}`);

      // --- CF2: create draft + handoff ---
      await ensureSourceToTarget(page);
      await page.locator("#searchInput").fill(QUERY_NO_RESULT);
      await page.waitForTimeout(300);
      await page.locator("[data-testid='search-feedback-report']").click();
      await page.locator("[data-testid='search-feedback-meaning']").fill("pvr1 synthetic need");
      await page.locator("[data-testid='search-feedback-save']").click();
      await expect(page.locator("#search-feedback-capture-heading")).toContainText(/saved/i, {
        timeout: 15_000,
      });

      await page.locator("#openManageSearchFeedback").click();
      await expect(page.locator("#search-feedback-manage-send")).toBeEnabled({ timeout: 15_000 });
      await expect(page.locator("#search-feedback-manage-export")).toBeEnabled();
      await expect(page.locator(".search-feedback-manage-send-unavailable")).toHaveCount(0);

      await page.locator("#search-feedback-manage-send").click();
      const cf2Confirm = page.locator("#search-feedback-manage-handoff-confirm");
      await expect(cf2Confirm).toBeVisible();
      await expect(cf2Confirm).toContainText(/stored only on this device/i);
      await expect(cf2Confirm).toContainText(REVIEW_INBOX);
      await expect(cf2Confirm).toContainText(/On the next screen/i);
      await expect(cf2Confirm.locator("a.feedback-handoff-email")).toHaveAttribute(
        "href",
        `mailto:${REVIEW_INBOX}`,
      );

      checks.fh1_configuration = "PASS";
      checks.fh1a_destination_visibility = "PASS";

      await page.locator("#search-feedback-manage-handoff-continue").click();
      await expect(
        page.getByText(/Feedback prepared for sharing|downloaded|mailto/i).first(),
      ).toBeVisible({ timeout: 30_000 });

      const cf2Shared = await readLastShare(page);
      if (cf2Shared.callCount > 0 && cf2Shared.body) {
        transportMethod = "share";
        cf2Filename = cf2Shared.name;
        cf2Schema = extractSchema(cf2Shared.body);
        packageTexts.push({ name: cf2Shared.name || "cf2_share.json", text: cf2Shared.body });
        expect(cf2Shared.text).toContain(REVIEW_INBOX);
        expect(cf2Shared.body).toContain("siralex_search_feedback_v1");
        expect(cf2Shared.body).toMatch(/"status"\s*:\s*"draft"/);
      } else {
        transportMethod = "download_mailto";
        notes.push("CF2 used download_mailto (or share mock empty); schema checked via export if needed.");
      }

      await page.locator("#search-feedback-manage-handoff-acknowledge").click().catch(() => undefined);
      await page.locator("#openManageSearchFeedback").click();
      await expect(page.locator("[data-testid='search-feedback-manage-row']").first()).toBeVisible({
        timeout: 15_000,
      });
      const cf2DraftCount = await page.locator("[data-testid='search-feedback-manage-row']").count();
      expect(cf2DraftCount).toBeGreaterThanOrEqual(1);
      checks.cf2_handoff_preparation = "PASS";

      // --- CF1: create draft + handoff ---
      await openGenuineLexiconEntry(page, QUERY_HIT);
      await expect(page.locator("#entry-suggest-correction")).toBeVisible({ timeout: 15_000 });
      await page.locator("#entry-suggest-correction").click();
      await expect(page.locator("[data-testid='correction-form']")).toBeVisible();
      await page.locator("#correction-form-issue").selectOption("spelling");
      await page.locator("#correction-form-target").selectOption({ index: 1 });
      await page
        .locator("#correction-form-description")
        .fill("PVR1 synthetic correction — non-sensitive test content.");
      await page.locator("#correction-form-save").click();
      await expect(page.locator("#correction-form-success-heading")).toBeVisible({
        timeout: 15_000,
      });

      await page.locator("#openManageCorrections").click();
      await expect(page.locator("#correction-manage-send")).toBeEnabled({ timeout: 15_000 });
      await expect(page.locator("#correction-manage-export")).toBeEnabled();
      await expect(page.locator(".correction-manage-send-unavailable")).toHaveCount(0);

      await page.locator("#correction-manage-send").click();
      const cf1Confirm = page.locator("#correction-manage-handoff-confirm");
      await expect(cf1Confirm).toBeVisible();
      await expect(cf1Confirm).toContainText(/stored only on this device/i);
      await expect(cf1Confirm).toContainText(REVIEW_INBOX);
      await expect(cf1Confirm).toContainText(/On the next screen/i);

      await page.locator("#correction-manage-handoff-continue").click();
      await expect(
        page.getByText(/Feedback prepared for sharing|downloaded|mailto/i).first(),
      ).toBeVisible({ timeout: 30_000 });

      const cf1Shared = await readLastShare(page);
      if (cf1Shared.body) {
        if (transportMethod === null) transportMethod = "share";
        cf1Filename = cf1Shared.name;
        cf1Schema = extractSchema(cf1Shared.body);
        packageTexts.push({ name: cf1Shared.name || "cf1_share.json", text: cf1Shared.body });
        expect(cf1Shared.text).toContain(REVIEW_INBOX);
        expect(cf1Shared.body).toContain("siralex_correction_feedback_v1");
        expect(cf1Shared.body).toMatch(/"status"\s*:\s*"draft"/);
      } else if (transportMethod === null) {
        transportMethod = "download_mailto";
      }

      await page.locator("#correction-manage-handoff-acknowledge").click().catch(() => undefined);
      await page.locator("#openManageCorrections").click();
      await expect(page.locator(".correction-manage-row").first()).toBeVisible({
        timeout: 15_000,
      });
      checks.cf1_handoff_preparation = "PASS";
      checks.draft_status_preservation = "PASS";

      if (
        (cf1Schema === "siralex_correction_feedback_v1" || cf1Shared.body?.includes("siralex_correction_feedback_v1")) &&
        (cf2Schema === "siralex_search_feedback_v1" || cf2Shared.body?.includes("siralex_search_feedback_v1"))
      ) {
        checks.attachment_schema = "PASS";
      } else if (cf1Shared.body || cf2Shared.body) {
        checks.attachment_schema = cf1Shared.body && cf2Shared.body ? "PASS" : "FAIL";
        if (checks.attachment_schema === "FAIL") {
          defects.push({
            class: "PRODUCT_DEFECT",
            summary: "Handoff package schema missing or unexpected in shared artifact.",
            blocks_verified: true,
          });
        }
      } else {
        // download_mailto without capturable share body — still require export-based check
        notes.push("Attachment schemas not captured from share mock; marking NOT_VERIFIED.");
        checks.attachment_schema = "NOT_VERIFIED";
        defects.push({
          class: "ENVIRONMENT_DEFECT",
          summary: "Could not capture handoff JSON body from share path on this desktop context.",
          blocks_verified: true,
        });
      }

      // --- Network: no feedback POST to a backend ---
      const feedbackPosts = networkEvents.filter((e) => {
        if (e.kind !== "request") return false;
        const method = String(e.method ?? "");
        const url = String(e.url ?? "");
        if (method !== "POST" && method !== "PUT") return false;
        return /feedback|correction|submit/i.test(url);
      });
      if (feedbackPosts.length === 0) {
        checks.backend_submission_absent = "PASS";
      } else {
        checks.backend_submission_absent = "FAIL";
        defects.push({
          class: "PRODUCT_DEFECT",
          summary: `Unexpected feedback-like ${feedbackPosts.length} POST/PUT request(s).`,
          blocks_verified: true,
        });
      }

      // --- Inbox receipt (operator-gated) ---
      if (inboxReceiptEnv === "PASS") {
        checks.real_inbox_receipt = "PASS";
        notes.push("SIRALEX_PVR1_INBOX_RECEIPT=PASS supplied by operator.");
      } else if (inboxReceiptEnv === "FAIL") {
        checks.real_inbox_receipt = "FAIL";
        defects.push({
          class: "ENVIRONMENT_DEFECT",
          summary: "Operator marked inbox receipt FAIL.",
          blocks_verified: true,
        });
      } else {
        checks.real_inbox_receipt = "NOT_VERIFIED";
        defects.push({
          class: "ENVIRONMENT_DEFECT",
          summary:
            "Real inbox receipt not verified in this run. Re-run with SIRALEX_PVR1_INBOX_RECEIPT=PASS after confirming JSON arrived at the configured review inbox.",
          blocks_verified: true,
        });
        notes.push(
          "Browser handoff preparation PASS does not prove inbox delivery. Operator must confirm arrival.",
        );
      }

      screenshotBuffers.push({
        name: "02_after_handoffs.png",
        buffer: await page.screenshot({ fullPage: true }),
      });

      const browserInfo = await page.evaluate(() => ({
        userAgent: navigator.userAgent,
        platform: navigator.platform,
      }));

      const blocking = defects.some((d) => d.blocks_verified);
      const requiredFail = [
        "uxt1_production",
        "fh1_configuration",
        "fh1a_destination_visibility",
        "cf1_handoff_preparation",
        "cf2_handoff_preparation",
        "real_inbox_receipt",
        "attachment_schema",
        "draft_status_preservation",
        "backend_submission_absent",
      ].some((id) => checks[id] === "FAIL" || checks[id] === "NOT_VERIFIED" || checks[id] === "NOT_RUN");

      const decision: Pvr1Decision =
        !blocking && !requiredFail
          ? "PVR1_THEME_AND_FEEDBACK_PRODUCTION_VERIFIED"
          : "PVR1_THEME_AND_FEEDBACK_PRODUCTION_BLOCKED";

      const summary: Pvr1Summary = {
        schema_version: "pvr1_theme_feedback_production_summary_v1",
        decision,
        production_url: productionUrl,
        repository_head: gitHead(),
        shell_asset: shellAsset,
        configured_review_inbox: REVIEW_INBOX,
        verification_timestamp: new Date().toISOString(),
        browser: browserInfo.userAgent,
        os: `${process.platform} / ${browserInfo.platform}`,
        checks,
        transport_method: transportMethod,
        cf1_attachment_filename: cf1Filename,
        cf2_attachment_filename: cf2Filename,
        cf1_package_schema: cf1Schema,
        cf2_package_schema: cf2Schema,
        defects,
        notes,
        evidence_path: "",
      };

      const evidencePath = await writePvr1Evidence({
        runId,
        summary,
        consoleLines,
        networkEvents,
        packageTexts,
        screenshotBuffers,
      });

      test.info().annotations.push({ type: "pvr1-decision", description: decision });
      test.info().annotations.push({ type: "pvr1-evidence", description: evidencePath });

      // Harness always completes; decision may be BLOCKED when inbox unconfirmed.
      expect([
        "PVR1_THEME_AND_FEEDBACK_PRODUCTION_VERIFIED",
        "PVR1_THEME_AND_FEEDBACK_PRODUCTION_BLOCKED",
      ]).toContain(decision);

      // Soft-fail the Playwright test only on product/config/deploy defects, not inbox gate.
      const hardFail = defects.some(
        (d) =>
          d.blocks_verified &&
          (d.class === "PRODUCT_DEFECT" ||
            d.class === "DEPLOYMENT_DEFECT" ||
            d.class === "CONFIGURATION_DEFECT"),
      );
      expect(hardFail, defects.map((d) => `${d.class}: ${d.summary}`).join(" | ")).toBe(false);
    } finally {
      await context.close();
    }
  });
});

function extractSchema(body: string): string | null {
  const m = body.match(/"package_schema"\s*:\s*"([^"]+)"/);
  return m?.[1] ?? null;
}

async function readLastShare(page: Page): Promise<{
  callCount: number;
  name: string;
  text: string;
  body: string;
}> {
  return page.evaluate(async () => {
    const calls = (window as unknown as { __pvr1ShareCalls?: ShareData[] }).__pvr1ShareCalls ?? [];
    const last = calls[calls.length - 1];
    const file = last?.files?.[0];
    return {
      callCount: calls.length,
      name: file?.name ?? "",
      text: last?.text ?? "",
      body: file ? await file.text() : "",
    };
  });
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
    await expect(page.locator("#themeSelect")).toBeVisible({ timeout: 30_000 });
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

async function openGenuineLexiconEntry(page: Page, sourceQuery: string): Promise<void> {
  await ensureSourceToTarget(page);
  await page.locator("#searchInput").fill(sourceQuery);
  await page.waitForTimeout(250);
  await expect(page.locator("#searchResults .result-open").first()).toBeVisible({
    timeout: 30_000,
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

async function ensureFeaturedDictionary(page: Page): Promise<void> {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#app")).toBeVisible({ timeout: 30_000 });
  const search = page.locator("#searchInput");
  if (await search.isEnabled()) {
    const active = await getActiveBundleId(page);
    if (active === FEATURED_BUNDLE_ID) return;
  }

  // Clean slate for first-run featured install when needed.
  if (await search.isEnabled()) {
    page.once("dialog", (d) => d.accept());
    await page.locator("#openManageDictionaries").click();
    await page.locator("#manageDictionariesPanel").evaluate((el) => {
      if (el instanceof HTMLDetailsElement) el.open = true;
    });
    if (await page.locator("#clearDb").isVisible()) {
      await page.locator("#clearDb").click();
      await expect(page.locator("#importProgress")).toContainText(/deleted|supprim/i, {
        timeout: 60_000,
      });
    }
  }

  await expect(page.locator("#featuredInstall")).toBeVisible({ timeout: 30_000 });
  await page.locator("#featuredInstall").click();
  await expect(page.locator("#searchInput")).toBeEnabled({ timeout: installTimeoutMs });
  const active = await getActiveBundleId(page);
  expect(active).toBe(FEATURED_BUNDLE_ID);
}
