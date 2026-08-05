import path from "node:path";
import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

import { ensureTargetToSource, navigateUx2Primary, openMoreAnd } from "../helpers/ux2_nav";

/**
 * LS2I5 — offline Review and Reflect browser verification.
 * Uses the local debug directional bundle (same fixture as LS1 offline Saved Vocabulary).
 */

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const usageBundleDir = path.join(webRoot, "public/debug-bundles/test_directional_bundle");
const installTimeoutMs = 90_000;
const offlineTimeoutMs = 30_000;
const DEBUG_BUNDLE_ID = "bundle_full_20260418_e1c98a70";

test.describe("LS2 offline Review lifecycle", () => {
  test("Saved Vocabulary → Review → offline reload persists reflections", async ({
    page,
    context,
  }) => {
    page.on("dialog", (dialog) => dialog.accept());

    await installDebugBundle(page);
    await setUiLocale(page, "en");
    await expect(page.locator("#searchInput")).toBeEnabled({ timeout: installTimeoutMs });
    await expect(page.locator("#startReview")).toHaveCount(0);

    await saveLexiconByQuery(page, "alpha_mnk");
    await saveLexiconByQuery(page, "beta_mnk");

    await page.locator("#openSavedVocabulary").click();
    await expect(page.locator("#saved-vocab-heading")).toBeVisible();
    await expect(page.locator(".saved-vocab-list .saved-vocab-row")).toHaveCount(2, {
      timeout: 15_000,
    });
    await expect(page.locator("[data-review-status='not_reviewed']")).toHaveCount(2);
    await expect(page.locator("#saved-vocab-start-review")).toBeVisible();
    await expect(page.locator("#saved-vocab-start-review")).toBeEnabled();
    await expect(page.locator("#startReview")).toHaveCount(0);

    // Accessibility: Start Review keyboard reachable
    await page.locator("#saved-vocab-start-review").focus();
    await expect(page.locator("#saved-vocab-start-review")).toBeFocused();

    await page.locator("#saved-vocab-start-review").click();
    await expect(page.locator("#review-heading")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".review-card")).toBeVisible();
    await expect(page.locator(".review-headword")).toBeVisible();
    // Card uses a semantic heading for the headword.
    await expect(page.locator(".review-card h3.review-headword, .review-card [role='heading']")).toBeVisible();
    await expect(page.locator(".review-reveal")).toHaveAttribute("type", "button");

    const firstHeadword = (await page.locator(".review-headword").textContent())?.trim() ?? "";
    expect(["alpha_mnk", "beta_mnk"]).toContain(firstHeadword);
    const firstGloss = firstHeadword === "alpha_mnk" ? "alpha_fr" : "beta_fr";
    await expectHiddenMeaning(page, firstGloss);

    await page.locator(".review-reveal").click();
    await expect(page.locator("#review-meaning-heading")).toBeVisible();
    await expect(page.locator("#review-meaning-heading")).toBeFocused();
    await expect(page.locator(".review-revealed")).toContainText(firstGloss);
    await expect(page.locator(".review-still-learning")).toBeVisible();
    await expect(page.locator(".review-remembered")).toBeVisible();

    await page.locator(".review-still-learning").click();
    // Wait for advance — the prior headword stays visible until the next card mounts.
    await expect(page.locator(".review-headword")).not.toHaveText(firstHeadword, {
      timeout: 15_000,
    });
    await expect(page.locator(".review-headword")).toBeFocused();
    const secondHeadword = (await page.locator(".review-headword").textContent())?.trim() ?? "";
    expect(["alpha_mnk", "beta_mnk"]).toContain(secondHeadword);
    const secondGloss = secondHeadword === "alpha_mnk" ? "alpha_fr" : "beta_fr";
    await expectHiddenMeaning(page, secondGloss);

    await page.locator(".review-reveal").click();
    await expect(page.locator(".review-revealed")).toContainText(secondGloss);
    await page.locator(".review-remembered").click();

    await expect(page.locator("#review-complete-heading")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("#review-complete-heading")).toBeFocused();
    await expect(page.locator(".review-complete-summary")).toContainText(/Reviewed:\s*2/);
    await expect(page.locator(".review-complete-summary")).toContainText(/Still learning:\s*1/);
    await expect(page.locator(".review-complete-summary")).toContainText(/Remembered:\s*1/);

    await page.locator(".review-back").click();
    await expect(page.locator("#saved-vocab-heading")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("[data-review-status='still_learning']")).toHaveCount(1);
    await expect(page.locator("[data-review-status='remembered']")).toHaveCount(1);
    await expect(page.locator(".saved-vocab-last-reviewed")).toHaveCount(2);
    await expect(page.locator("#saved-vocab-start-review")).toBeFocused();

    // Online reload retains statuses
    await page.reload({ waitUntil: "domcontentloaded", timeout: offlineTimeoutMs });
    await expect(page.locator("#searchInput")).toBeEnabled({ timeout: offlineTimeoutMs });
    await setUiLocale(page, "en");
    await page.locator("#openSavedVocabulary").click();
    await expect(page.locator("[data-review-status='still_learning']")).toHaveCount(1, {
      timeout: 15_000,
    });
    await expect(page.locator("[data-review-status='remembered']")).toHaveCount(1);

    // Offline Review + persistence
    await context.setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded", timeout: offlineTimeoutMs });
    await expect(page.locator("#searchInput")).toBeEnabled({ timeout: offlineTimeoutMs });
    await setUiLocale(page, "en");
    await page.locator("#openSavedVocabulary").click();
    await expect(page.locator(".saved-vocab-list .saved-vocab-row")).toHaveCount(2, {
      timeout: 15_000,
    });

    const beforeOffline = await readLearningRecord(page, DEBUG_BUNDLE_ID, "diag_lex_alpha");
    expect(beforeOffline?.review_count).toBeGreaterThanOrEqual(1);

    await page.locator("#saved-vocab-start-review").click();
    await expect(page.locator(".review-reveal")).toBeVisible({ timeout: 15_000 });
    const offlineHeadword = (await page.locator(".review-headword").textContent())?.trim() ?? "";
    await page.locator(".review-reveal").click();
    await expect(page.locator(".review-still-learning")).toBeVisible();
    await page.locator(".review-still-learning").click();

    // Advance or complete — proves the reflection transaction committed.
    await expect(
      page
        .locator("#review-complete-heading")
        .or(page.locator(".review-headword").filter({ hasNotText: offlineHeadword })),
    ).toBeVisible({ timeout: 15_000 });

    await page.locator(".review-back").click();
    await expect(page.locator("#saved-vocab-heading")).toBeVisible({ timeout: 15_000 });

    const afterOffline = await readLearningRecord(page, DEBUG_BUNDLE_ID, "diag_lex_alpha");
    const betaAfter = await readLearningRecord(page, DEBUG_BUNDLE_ID, "diag_lex_beta");
    const totalCount =
      (afterOffline?.review_count ?? 0) + (betaAfter?.review_count ?? 0);
    expect(totalCount).toBeGreaterThanOrEqual(3);

    await page.reload({ waitUntil: "domcontentloaded", timeout: offlineTimeoutMs });
    await expect(page.locator("#searchInput")).toBeEnabled({ timeout: offlineTimeoutMs });
    await setUiLocale(page, "en");
    await page.locator("#openSavedVocabulary").click();
    await expect(page.locator(".saved-vocab-list .saved-vocab-row")).toHaveCount(2, {
      timeout: 15_000,
    });
    const afterReloadOffline = await readLearningRecord(page, DEBUG_BUNDLE_ID, "diag_lex_alpha");
    const betaReload = await readLearningRecord(page, DEBUG_BUNDLE_ID, "diag_lex_beta");
    expect(
      (afterReloadOffline?.review_count ?? 0) + (betaReload?.review_count ?? 0),
    ).toBe(totalCount);
  });

  test("Reveal without Reflect is ephemeral across reload", async ({ page }) => {
    page.on("dialog", (dialog) => dialog.accept());
    await installDebugBundle(page);
    await setUiLocale(page, "en");

    await saveLexiconByQuery(page, "alpha_mnk");
    await page.locator("#openSavedVocabulary").click();
    await expect(page.locator("#saved-vocab-start-review")).toBeEnabled({ timeout: 15_000 });
    await page.locator("#saved-vocab-start-review").click();
    await expect(page.locator(".review-reveal")).toBeVisible({ timeout: 15_000 });
    await page.locator(".review-reveal").click();
    await expect(page.locator(".review-revealed")).toContainText("alpha_fr");

    const before = await readLearningRecord(page, DEBUG_BUNDLE_ID, "diag_lex_alpha");
    expect(before?.review_count ?? 0).toBe(0);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("#searchInput")).toBeEnabled({ timeout: offlineTimeoutMs });
    await setUiLocale(page, "en");
    await expect(page.locator(".review-surface")).toHaveCount(0);

    await page.locator("#openSavedVocabulary").click();
    await expect(page.locator("[data-review-status='not_reviewed']")).toHaveCount(1, {
      timeout: 15_000,
    });
    const after = await readLearningRecord(page, DEBUG_BUNDLE_ID, "diag_lex_alpha");
    expect(after?.review_count ?? 0).toBe(0);

    await page.locator("#saved-vocab-start-review").click();
    await expect(page.locator(".review-reveal")).toBeVisible({ timeout: 15_000 });
    await expectHiddenMeaning(page, "alpha_fr");
  });

  test("immediate persistence after one reflection survives reload", async ({ page }) => {
    page.on("dialog", (dialog) => dialog.accept());
    await installDebugBundle(page);
    await setUiLocale(page, "en");
    await saveLexiconByQuery(page, "alpha_mnk");
    await saveLexiconByQuery(page, "beta_mnk");

    await page.locator("#openSavedVocabulary").click();
    await page.locator("#saved-vocab-start-review").click();
    await expect(page.locator(".review-reveal")).toBeVisible({ timeout: 15_000 });
    const first = (await page.locator(".review-headword").textContent())?.trim() ?? "";
    await page.locator(".review-reveal").click();
    await page.locator(".review-still-learning").click();
    // Durable write completes before the next card / completion surface appears.
    await expect(
      page
        .locator("#review-complete-heading")
        .or(page.locator(".review-headword").filter({ hasNotText: first })),
    ).toBeVisible({ timeout: 15_000 });

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("#searchInput")).toBeEnabled({ timeout: offlineTimeoutMs });
    await setUiLocale(page, "en");
    await page.locator("#openSavedVocabulary").click();
    await expect(page.locator("[data-review-status='still_learning']")).toHaveCount(1, {
      timeout: 15_000,
    });
    const irId = first === "alpha_mnk" ? "diag_lex_alpha" : "diag_lex_beta";
    const row = await readLearningRecord(page, DEBUG_BUNDLE_ID, irId);
    expect(row?.status).toBe("still_learning");
    expect(row?.review_count).toBe(1);
  });

  test("French smoke labels for Start Review and Review actions", async ({ page }) => {
    page.on("dialog", (dialog) => dialog.accept());
    await installDebugBundle(page);
    await setUiLocale(page, "fr");
    await saveLexiconByQuery(page, "alpha_mnk");

    await page.locator("#openSavedVocabulary").click();
    await expect(page.locator("#saved-vocab-start-review")).toContainText("Commencer la révision", {
      timeout: 15_000,
    });
    await expect(page.locator("[data-review-status='not_reviewed']")).toContainText(
      "Pas encore révisé",
    );

    await page.locator("#saved-vocab-start-review").click();
    await expect(page.locator(".review-reveal")).toContainText("Révéler le sens", {
      timeout: 15_000,
    });
    await page.locator(".review-reveal").click();
    await expect(page.locator(".review-still-learning")).toContainText("Pas encore");
    await expect(page.locator(".review-remembered")).toContainText("Je l’ai");
  });

  test("double Start Review keeps a single Review surface", async ({ page }) => {
    page.on("dialog", (dialog) => dialog.accept());
    await installDebugBundle(page);
    await setUiLocale(page, "en");
    await saveLexiconByQuery(page, "alpha_mnk");
    await page.locator("#openSavedVocabulary").click();
    await expect(page.locator("#saved-vocab-start-review")).toBeEnabled({ timeout: 15_000 });

    await page.locator("#saved-vocab-start-review").dblclick();
    await expect(page.locator(".review-surface")).toHaveCount(1, { timeout: 15_000 });
    await expect(page.locator(".review-headword")).toHaveCount(1);
  });
});

async function expectHiddenMeaning(page: Page, gloss: string): Promise<void> {
  await expect(page.locator(".review-reveal")).toBeVisible();
  await expect(page.locator(".review-still-learning")).toHaveCount(0);
  await expect(page.locator(".review-remembered")).toHaveCount(0);
  await expect(page.locator(".review-revealed")).toHaveCount(0);
  await expect(page.locator(".review-card")).not.toContainText(gloss);
  await expect(page.locator(".review-card")).not.toContainText("cache-gloss-secret");
}

async function setUiLocale(page: Page, locale: "en" | "fr"): Promise<void> {
  await navigateUx2Primary(page, "more");
  const select = page.locator("#localeSelect");
  if ((await select.inputValue()) !== locale) {
    await select.selectOption(locale);
    await page.waitForLoadState("domcontentloaded");
    await navigateUx2Primary(page, "search");
    await expect(page.locator("#searchInput")).toBeVisible({ timeout: 30_000 });
  } else {
    await navigateUx2Primary(page, "search");
  }
}

async function saveLexiconByQuery(page: Page, query: string): Promise<void> {
  // Target → Source opens lexicon_entry rows for this fixture.
  await ensureTargetToSource(page);
  await page.locator("#searchInput").fill(query);
  // Wait for the *new* result — stale prior results remain until debounce/search completes.
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
  await page.locator(".entry-back").click();
  await expect(page.locator("#searchResults .result-open").first()).toContainText(query, {
    timeout: 15_000,
  });
}

async function readLearningRecord(
  page: Page,
  bundleId: string,
  irId: string,
): Promise<{ status: string; review_count: number; last_reviewed: string | null } | undefined> {
  return page.evaluate(
    async ({ bundleId: b, irId: id }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open("siralex_db");
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      try {
        const row = await new Promise<Record<string, unknown> | undefined>((resolve, reject) => {
          const tx = db.transaction("learning_records", "readonly");
          const req = tx.objectStore("learning_records").get([b, id]);
          req.onsuccess = () => resolve(req.result as Record<string, unknown> | undefined);
          req.onerror = () => reject(req.error);
        });
        if (!row) return undefined;
        return {
          status: String(row.status),
          review_count: Number(row.review_count),
          last_reviewed: (row.last_reviewed as string | null) ?? null,
        };
      } finally {
        db.close();
      }
    },
    { bundleId, irId },
  );
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

  await openMoreAnd(page, "dictionaries");

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
