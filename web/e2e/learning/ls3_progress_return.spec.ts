import path from "node:path";
import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

import { ensureTargetToSource, navigateUx2Primary, openMoreAnd } from "../helpers/ux2_nav";

/**
 * LS3I4 — offline Progress & Return browser verification.
 * Uses the local debug directional bundle (same fixture as LS1/LS2 learning e2e).
 */

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const usageBundleDir = path.join(webRoot, "public/debug-bundles/test_directional_bundle");
const installTimeoutMs = 90_000;
const offlineTimeoutMs = 30_000;

test.describe("LS3 Progress & Return offline lifecycle", () => {
  test("Progress → Review → refresh → reload → offline Continue", async ({ page, context }) => {
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
      unavailable: null,
    });
    await expect(page.locator("#saved-vocab-start-review")).toHaveText("Start review");
    await expect(page.locator(".saved-vocab-return-cue")).toHaveText("Review new saved words");
    await expect(page.locator("#saved-vocab-progress-heading")).toBeVisible();
    await expect(page.locator("dl.saved-vocab-progress-list")).toHaveCount(1);
    await expect(page.locator('[role="progressbar"]')).toHaveCount(0);
    await expect(page.locator(".saved-vocab-progress")).not.toContainText(/%|Mastered|Resume/i);

    await page.locator("#saved-vocab-start-review").focus();
    await expect(page.locator("#saved-vocab-start-review")).toBeFocused();
    await page.locator("#saved-vocab-start-review").click();
    await expect(page.locator("#review-heading")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".review-card")).toBeVisible();

    const first = (await page.locator(".review-headword").textContent())?.trim() ?? "";
    await page.locator(".review-reveal").click();
    await expect(page.locator("#review-meaning-heading")).toBeFocused();
    await page.locator(".review-still-learning").click();
    await expect(page.locator(".review-headword")).not.toHaveText(first, { timeout: 15_000 });
    await expect(page.locator(".review-headword")).toBeFocused();

    const second = (await page.locator(".review-headword").textContent())?.trim() ?? "";
    await page.locator(".review-reveal").click();
    await page.locator(".review-remembered").click();
    await expect(
      page
        .locator("#review-complete-heading")
        .or(page.locator(".review-headword").filter({ hasNotText: second })),
    ).toBeVisible({ timeout: 15_000 });

    // Leave remaining card(s) by returning — Progress must refresh without completing all.
    await page.locator(".review-back").click();
    await expect(page.locator("#saved-vocab-heading")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("#saved-vocab-start-review")).toHaveText("Continue review");
    await expect(page.locator("#saved-vocab-start-review")).toBeFocused();
    await expect(page.locator("#saved-vocab-start-review")).not.toContainText(/Resume/i);

    await expectProgress(page, {
      saved: 3,
      notReviewed: 1,
      stillLearning: 1,
      remembered: 1,
      unavailable: null,
    });
    await expect(page.locator(".saved-vocab-return-cue")).toHaveText("Review new saved words");

    // Online reload retains Progress
    await page.reload({ waitUntil: "domcontentloaded", timeout: offlineTimeoutMs });
    await expect(page.locator("#searchInput")).toBeEnabled({ timeout: offlineTimeoutMs });
    await setUiLocale(page, "en");
    await page.locator("#openSavedVocabulary").click();
    await expectProgress(page, {
      saved: 3,
      notReviewed: 1,
      stillLearning: 1,
      remembered: 1,
      unavailable: null,
    });
    await expect(page.locator("#saved-vocab-start-review")).toHaveText("Continue review");

    // Offline Progress + Continue + reflection + reload
    await context.setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded", timeout: offlineTimeoutMs });
    await expect(page.locator("#searchInput")).toBeEnabled({ timeout: offlineTimeoutMs });
    await setUiLocale(page, "en");
    await page.locator("#openSavedVocabulary").click();
    await expectProgress(page, {
      saved: 3,
      notReviewed: 1,
      stillLearning: 1,
      remembered: 1,
      unavailable: null,
    });

    await page.locator("#saved-vocab-start-review").click();
    await expect(page.locator(".review-reveal")).toBeVisible({ timeout: 15_000 });
    const offlineHead = (await page.locator(".review-headword").textContent())?.trim() ?? "";
    await page.locator(".review-reveal").click();
    await page.locator(".review-still-learning").click();
    await expect(
      page
        .locator("#review-complete-heading")
        .or(page.locator(".review-headword").filter({ hasNotText: offlineHead })),
    ).toBeVisible({ timeout: 15_000 });

    await page.locator(".review-back").click();
    await expect(page.locator("#saved-vocab-heading")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-progress-metric="not_reviewed"] dd')).toHaveText("0");
    await expect(page.locator('[data-progress-metric="still_learning"] dd')).toHaveText("2");
    await expect(page.locator("#saved-vocab-start-review")).toHaveText("Continue review");

    await page.reload({ waitUntil: "domcontentloaded", timeout: offlineTimeoutMs });
    await expect(page.locator("#searchInput")).toBeEnabled({ timeout: offlineTimeoutMs });
    await setUiLocale(page, "en");
    await page.locator("#openSavedVocabulary").click();
    await expect(page.locator('[data-progress-metric="not_reviewed"] dd')).toHaveText("0", {
      timeout: 15_000,
    });
    await expect(page.locator('[data-progress-metric="still_learning"] dd')).toHaveText("2");
    await expect(page.locator('[data-progress-metric="remembered"] dd')).toHaveText("1");
  });

  test("Reveal-only reload leaves Progress unchanged; fresh Continue starts hidden", async ({
    page,
  }) => {
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
    await expect(
      page
        .locator("#review-complete-heading")
        .or(page.locator(".review-headword").filter({ hasNotText: first })),
    ).toBeVisible({ timeout: 15_000 });
    await page.locator(".review-back").click();
    await expect(page.locator("#saved-vocab-start-review")).toHaveText("Continue review");

    await page.locator("#saved-vocab-start-review").click();
    await expect(page.locator(".review-reveal")).toBeVisible({ timeout: 15_000 });
    const glossHint = ((await page.locator(".review-headword").textContent()) ?? "").includes(
      "alpha",
    )
      ? "alpha_fr"
      : "beta_fr";
    await page.locator(".review-reveal").click();
    await expect(page.locator(".review-revealed")).toBeVisible();

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("#searchInput")).toBeEnabled({ timeout: offlineTimeoutMs });
    await setUiLocale(page, "en");
    await expect(page.locator(".review-surface")).toHaveCount(0);

    await page.locator("#openSavedVocabulary").click();
    await expectProgress(page, {
      saved: 2,
      notReviewed: 1,
      stillLearning: 1,
      remembered: 0,
      unavailable: null,
    });
    await page.locator("#saved-vocab-start-review").click();
    await expect(page.locator(".review-reveal")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".review-revealed")).toHaveCount(0);
    await expect(page.locator(".review-card")).not.toContainText(glossHint);
  });

  test("immediate Progress durability after one reflection", async ({ page }) => {
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
    await expect(
      page
        .locator("#review-complete-heading")
        .or(page.locator(".review-headword").filter({ hasNotText: first })),
    ).toBeVisible({ timeout: 15_000 });

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("#searchInput")).toBeEnabled({ timeout: offlineTimeoutMs });
    await setUiLocale(page, "en");
    await page.locator("#openSavedVocabulary").click();
    await expect(page.locator('[data-progress-metric="still_learning"] dd')).toHaveText("1", {
      timeout: 15_000,
    });
    await expect(page.locator("#saved-vocab-start-review")).toHaveText("Continue review");
  });

  test("double Continue keeps one Review surface; removal to empty hides Progress", async ({
    page,
  }) => {
    page.on("dialog", (dialog) => dialog.accept());
    await installDebugBundle(page);
    await setUiLocale(page, "en");
    await saveLexiconByQuery(page, "alpha_mnk");
    await saveLexiconByQuery(page, "beta_mnk");

    await page.locator("#openSavedVocabulary").click();
    await expect(page.locator("#saved-vocab-start-review")).toBeEnabled({ timeout: 15_000 });
    await page.locator("#saved-vocab-start-review").dblclick();
    await expect(page.locator(".review-surface")).toHaveCount(1, { timeout: 15_000 });
    await expect(page.locator(".review-headword")).toHaveCount(1);

    const first = (await page.locator(".review-headword").textContent())?.trim() ?? "";
    await page.locator(".review-reveal").click();
    await expect(page.locator(".review-still-learning")).toBeVisible();
    // Duplicate reflection while busy must not double-write.
    await page.locator(".review-still-learning").dblclick();
    await expect(
      page
        .locator("#review-complete-heading")
        .or(page.locator(".review-headword").filter({ hasNotText: first })),
    ).toBeVisible({ timeout: 15_000 });
    await page.locator(".review-back").click();
    await expect(page.locator('[data-progress-metric="still_learning"] dd')).toHaveText("1", {
      timeout: 15_000,
    });
    await expect(page.locator('[data-progress-metric="saved"] dd')).toHaveText("2");

    await page.locator(".saved-vocab-remove").first().click();
    await expect(page.locator(".saved-vocab-list .saved-vocab-row")).toHaveCount(1, {
      timeout: 15_000,
    });
    await expect(page.locator('[data-progress-metric="saved"] dd')).toHaveText("1");
    await page.locator(".saved-vocab-remove").click();
    await expect(page.locator(".saved-vocab-progress")).toHaveCount(0, { timeout: 15_000 });
    await expect(page.locator("#saved-vocab-start-review")).toHaveCount(0);
    await expect(page.locator(".ux2-saved-empty-lead")).toContainText(/No saved words|Aucun mot/);
  });

  test("French Progress smoke Start → Continue", async ({ page }) => {
    page.on("dialog", (dialog) => dialog.accept());
    await installDebugBundle(page);
    await setUiLocale(page, "fr");
    await saveLexiconByQuery(page, "alpha_mnk");

    await page.locator("#openSavedVocabulary").click();
    await expect(page.locator("#saved-vocab-progress-heading")).toHaveText("Aperçu du vocabulaire", {
      timeout: 15_000,
    });
    await expect(page.locator('[data-progress-metric="saved"] dt')).toHaveText("Enregistrés");
    await expect(page.locator('[data-progress-metric="not_reviewed"] dt')).toHaveText(
      "Pas encore révisés",
    );
    await expect(page.locator("#saved-vocab-start-review")).toHaveText("Commencer la révision");
    await expect(page.locator(".saved-vocab-return-cue")).toHaveText(
      "Réviser les nouveaux mots enregistrés",
    );

    await page.locator("#saved-vocab-start-review").click();
    await expect(page.locator(".review-reveal")).toBeVisible({ timeout: 15_000 });
    await page.locator(".review-reveal").click();
    await page.locator(".review-still-learning").click();
    await expect(page.locator("#review-complete-heading")).toBeVisible({ timeout: 15_000 });
    await page.locator(".review-back").click();

    await expect(page.locator("#saved-vocab-start-review")).toHaveText("Continuer la révision", {
      timeout: 15_000,
    });
    await expect(page.locator('[data-progress-metric="still_learning"] dd')).toHaveText("1");
    await expect(page.locator(".saved-vocab-return-cue")).toHaveText(
      "Réviser les mots encore en apprentissage",
    );
  });

  test("ordinary open does not steal focus; Back restores Continue once", async ({ page }) => {
    page.on("dialog", (dialog) => dialog.accept());
    await installDebugBundle(page);
    await setUiLocale(page, "en");
    await saveLexiconByQuery(page, "alpha_mnk");
    await saveLexiconByQuery(page, "beta_mnk");

    await page.locator("#openSavedVocabulary").click();
    await expect(page.locator("#saved-vocab-start-review")).toBeEnabled({ timeout: 15_000 });
    await expect(page.locator("#saved-vocab-start-review")).not.toBeFocused();

    await page.locator("#saved-vocab-start-review").click();
    await expect(page.locator(".review-reveal")).toBeVisible({ timeout: 15_000 });
    const first = (await page.locator(".review-headword").textContent())?.trim() ?? "";
    await page.locator(".review-reveal").click();
    await page.locator(".review-still-learning").click();
    await expect(
      page
        .locator("#review-complete-heading")
        .or(page.locator(".review-headword").filter({ hasNotText: first })),
    ).toBeVisible({ timeout: 15_000 });
    await page.locator(".review-back").click();
    await expect(page.locator("#saved-vocab-start-review")).toHaveText("Continue review");
    await expect(page.locator("#saved-vocab-start-review")).toBeFocused();

    await navigateUx2Primary(page, "search");
    await navigateUx2Primary(page, "saved");
    await expect(page.locator("#saved-vocab-start-review")).toBeEnabled({ timeout: 15_000 });
    await expect(page.locator("#saved-vocab-start-review")).not.toBeFocused();
  });
});

async function expectProgress(
  page: Page,
  counts: {
    saved: number;
    notReviewed: number;
    stillLearning: number;
    remembered: number;
    unavailable: number | null;
  },
): Promise<void> {
  await expect(page.locator("#saved-vocab-progress-heading")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[data-progress-metric="saved"] dd')).toHaveText(String(counts.saved));
  await expect(page.locator('[data-progress-metric="not_reviewed"] dd')).toHaveText(
    String(counts.notReviewed),
  );
  await expect(page.locator('[data-progress-metric="still_learning"] dd')).toHaveText(
    String(counts.stillLearning),
  );
  await expect(page.locator('[data-progress-metric="remembered"] dd')).toHaveText(
    String(counts.remembered),
  );
  if (counts.unavailable === null) {
    await expect(page.locator('[data-progress-metric="unavailable"]')).toHaveCount(0);
    await expect(page.locator("#saved-vocab-unavailable-explanation")).toHaveCount(0);
  } else {
    await expect(page.locator('[data-progress-metric="unavailable"] dd')).toHaveText(
      String(counts.unavailable),
    );
  }
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
  await ensureTargetToSource(page);
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
