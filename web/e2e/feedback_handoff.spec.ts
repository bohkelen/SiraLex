/**
 * FH1 — Feedback review handoff browser smoke.
 *
 * Expects preview build with VITE_FEEDBACK_EMAIL set (see npm run test:e2e:handoff).
 * Web Share API is mocked; physical Android sharing remains PV1B.
 */

import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const usageBundleDir = path.join(webRoot, "public/debug-bundles/test_directional_bundle");
const installTimeoutMs = 90_000;
const DEBUG_BUNDLE_ID = "bundle_full_20260418_e1c98a70";

test.describe("FH1 feedback handoff", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const shareCalls: ShareData[] = [];
      (window as unknown as { __fh1ShareCalls?: ShareData[] }).__fh1ShareCalls = shareCalls;
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
  });

  test("CF2 Send for review shares governed package via mocked Web Share; drafts stay draft", async ({
    page,
  }) => {
    page.on("dialog", (dialog) => dialog.accept());
    await installDebugBundle(page);
    await setUiLocale(page, "en");

    await ensureSourceToTarget(page);
    await page.locator("#searchInput").fill("zzzz_fh1_handoff_share");
    await page.waitForTimeout(250);
    await page.locator("[data-testid='search-feedback-report']").click();
    await page.locator("[data-testid='search-feedback-meaning']").fill("needed sense");
    await page.locator("[data-testid='search-feedback-save']").click();
    await expect(page.locator("#search-feedback-capture-heading")).toContainText(/saved/i, {
      timeout: 15_000,
    });

    await page.locator("#openManageSearchFeedback").click();
    await expect(page.locator("#search-feedback-manage-send")).toBeEnabled({ timeout: 15_000 });
    await expect(page.locator("#search-feedback-manage-export")).toBeEnabled();

    // Privacy confirmation EN
    await page.locator("#search-feedback-manage-send").click();
    await expect(page.locator("#search-feedback-manage-handoff-confirm")).toBeVisible();
    await expect(page.locator("#search-feedback-manage-handoff-confirm")).toContainText(
      /stored only on this device/i,
    );
    await expect(page.locator("#search-feedback-manage-handoff-cancel")).toHaveText("Cancel");
    await expect(page.locator("#search-feedback-manage-handoff-continue")).toHaveText("Continue");

    // Cancel leaves drafts untouched and does not share
    await page.locator("#search-feedback-manage-handoff-cancel").click();
    await expect(page.locator("#search-feedback-manage-handoff-confirm")).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as { __fh1ShareCalls?: ShareData[] }).__fh1ShareCalls?.length ?? 0)).toBe(0);

    // Continue → mocked share receives governed JSON file
    await page.locator("#search-feedback-manage-send").click();
    await page.locator("#search-feedback-manage-handoff-continue").click();
    await expect(page.getByText("Feedback prepared for sharing.")).toBeVisible({
      timeout: 15_000,
    });

    const shared = await page.evaluate(async () => {
      const calls = (window as unknown as { __fh1ShareCalls?: ShareData[] }).__fh1ShareCalls ?? [];
      const file = calls[0]?.files?.[0];
      return {
        callCount: calls.length,
        name: file?.name ?? "",
        type: file?.type ?? "",
        body: file ? await file.text() : "",
      };
    });
    expect(shared.callCount).toBe(1);
    expect(shared.name).toMatch(/^siralex-search-feedback-.+\.json$/);
    expect(shared.type).toBe("application/json");
    expect(shared.body).toContain("siralex_search_feedback_v1");
    expect(shared.body).toMatch(/"status"\s*:\s*"draft"/);

    // Rows still listed (draft unchanged)
    await page.locator("#search-feedback-manage-handoff-acknowledge").click();
    await expect(page.locator("[data-testid='search-feedback-manage-row']")).toHaveCount(1);

    // FR privacy labels
    await setUiLocale(page, "fr");
    await page.locator("#openManageSearchFeedback").click();
    await page.locator("#search-feedback-manage-send").click();
    await expect(page.locator("#search-feedback-manage-handoff-confirm")).toContainText(
      /uniquement sur cet appareil/i,
    );
    await expect(page.locator("#search-feedback-manage-handoff-cancel")).toHaveText("Annuler");
    await expect(page.locator("#search-feedback-manage-handoff-continue")).toHaveText("Continuer");
  });

  test("CF1 Send for review share branch + Export still independent", async ({ page }) => {
    page.on("dialog", (dialog) => dialog.accept());
    await installDebugBundle(page);
    await setUiLocale(page, "en");

    // Open a target entry and save a correction draft
    const toggle = page.locator("#langToggle");
    const label = (await toggle.textContent()) ?? "";
    if (/→/.test(label)) {
      const left = label.split("→")[0] ?? "";
      if (!/Maninka|Target|Cible|mnk/i.test(left)) await toggle.click();
    }
    await page.locator("#searchInput").fill("alpha_mnk");
    await expect(page.locator("#searchResults .result-open").first()).toBeVisible({
      timeout: 15_000,
    });
    await page.locator("#searchResults .result-open").first().click();
    await page.locator("#entry-suggest-correction").click();
    await expect(page.locator("[data-testid='correction-form']")).toBeVisible();
    await page.locator("#correction-form-issue").selectOption("spelling");
    await page.locator("#correction-form-target").selectOption({ index: 1 });
    await page.locator("#correction-form-description").fill("FH1 correction draft");
    await page.locator("#correction-form-save").click();
    await expect(page.locator("#correction-form-success-heading")).toBeVisible({
      timeout: 15_000,
    });

    await page.locator("#openManageCorrections").click();
    await expect(page.locator("#correction-manage-send")).toBeEnabled({ timeout: 15_000 });
    await expect(page.locator("#correction-manage-export")).toBeEnabled();

    await page.locator("#correction-manage-send").click();
    await expect(page.locator("#correction-manage-handoff-confirm")).toContainText(
      /stored only on this device/i,
    );
    await page.locator("#correction-manage-handoff-continue").click();
    await expect(page.getByText("Feedback prepared for sharing.")).toBeVisible({
      timeout: 15_000,
    });

    const shared = await page.evaluate(async () => {
      const calls = (window as unknown as { __fh1ShareCalls?: ShareData[] }).__fh1ShareCalls ?? [];
      const file = calls[calls.length - 1]?.files?.[0];
      return {
        name: file?.name ?? "",
        body: file ? await file.text() : "",
      };
    });
    expect(shared.name).toMatch(/^siralex-correction-feedback-.+\.json$/);
    expect(shared.body).toContain("siralex_correction_feedback_v1");
    expect(shared.body).toMatch(/"status"\s*:\s*"draft"/);
  });
});

async function setUiLocale(page: Page, locale: "en" | "fr"): Promise<void> {
  const select = page.locator("#localeSelect");
  if ((await select.inputValue()) !== locale) {
    await select.selectOption(locale);
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("#searchInput")).toBeVisible({ timeout: 30_000 });
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

async function openManageDictionaries(page: Page): Promise<void> {
  await page.locator("#openManageDictionaries").click();
  await page.locator("#manageDictionariesPanel").evaluate((el) => {
    if (el instanceof HTMLDetailsElement) el.open = true;
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

  await page.locator("#manageDictionariesPanel").evaluate((el) => {
    if (el instanceof HTMLDetailsElement) el.open = true;
  });
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
  await expect(page.locator("#searchInput")).toBeEnabled({ timeout: installTimeoutMs });
}
