/**
 * CF2I6A — Human-style typing regression (Playwright .type(), not .fill()).
 *
 * Proves editable feedback controls keep focus across sequential keystrokes.
 */

import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

import { navigateUx2Primary, openMoreAnd } from "./helpers/ux2_nav";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const usageBundleDir = path.join(webRoot, "public/debug-bundles/test_directional_bundle");
const installTimeoutMs = 90_000;
const DEBUG_BUNDLE_ID = "bundle_full_20260418_e1c98a70";

test.describe("CF2I6A feedback input stability", () => {
  test("human typing retains focus on CF2 capture, CF2 manage edit, and CF1 correction", async ({
    page,
  }) => {
    page.on("dialog", (dialog) => dialog.accept());
    await installDebugBundle(page);
    await setUiLocale(page, "en");

    // --- CF2 capture ---
    await ensureSourceToTarget(page);
    await page.locator("#searchInput").fill("zzzz_cf2i6a_type");
    await page.waitForTimeout(250);
    await page.locator("[data-testid='search-feedback-report']").click();
    const captureMeaning = page.locator("[data-testid='search-feedback-meaning']");
    await expect(captureMeaning).toBeVisible();
    await captureMeaning.click();
    await typeAndAssertFocus(page, captureMeaning, "abcdef");
    await expect(captureMeaning).toHaveValue("abcdef");
    await page.locator("[data-testid='search-feedback-save']").click();
    await expect(page.locator("#search-feedback-capture-heading")).toContainText(/saved/i, {
      timeout: 15_000,
    });

    // --- CF2 management edit ---
    await openMoreAnd(page, "search-feedback");
    await expect(page.locator("[data-testid='search-feedback-manage-row']")).toHaveCount(1, {
      timeout: 15_000,
    });
    await page.locator("[data-testid='search-feedback-manage-row']").first().click();
    await page.getByRole("button", { name: "Edit notes" }).click();
    const manageMeaning = page.locator("#search-feedback-manage-meaning");
    await expect(manageMeaning).toBeVisible();
    await manageMeaning.click();
    await manageMeaning.fill("");
    await typeAndAssertFocus(page, manageMeaning, "edited");
    await expect(manageMeaning).toHaveValue("edited");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.locator(".search-feedback-manage-detail-meaning")).toContainText("edited", {
      timeout: 15_000,
    });
    await page.locator(".search-feedback-manage-back").click();
    await expect(page.locator("#moreHeading")).toBeVisible({ timeout: 15_000 });

    // --- CF1 suggest correction (FR label: Décrivez le problème) ---
    await setUiLocale(page, "fr");
    await navigateUx2Primary(page, "search");
    const toggle = page.locator("#langToggle");
    const label = (await toggle.textContent()) ?? "";
    if (!/Maninka|Target|Cible/.test(label.split("→")[0] ?? "")) {
      await toggle.click();
    }
    await page.locator("#searchInput").fill("alpha_mnk");
    await expect(page.locator("#searchResults .result-open").first()).toContainText("alpha_mnk", {
      timeout: 15_000,
    });
    await page.locator("#searchResults .result-open").first().click();
    await expect(page.locator("#entry-suggest-correction")).toBeVisible({ timeout: 15_000 });
    await page.locator("#entry-suggest-correction").click();
    await expect(page.locator("[data-testid='correction-form']")).toBeVisible();
    await expect(page.getByText("Décrivez le problème", { exact: true })).toBeVisible();
    await page.locator("#correction-form-issue").selectOption("spelling");
    await page.locator("#correction-form-target").selectOption({ index: 1 });
    const description = page.locator("#correction-form-description");
    await description.click();
    await typeAndAssertFocus(page, description, "bonjour");
    await expect(description).toHaveValue("bonjour");
    await page.locator("#correction-form-save").click();
    await expect(page.locator("#correction-form-success-heading")).toBeVisible({
      timeout: 15_000,
    });

    // --- CF1 manage edit (same FR description field; residual focus-steal path) ---
    await openMoreAnd(page, "corrections");
    await expect(page.locator("[data-testid='correction-manage']")).toBeVisible({
      timeout: 15_000,
    });
    await page.locator(".correction-manage-row-button").first().click();
    await page.getByRole("button", { name: "Modifier" }).click();
    const manageDescription = page.locator("#correction-manage-description");
    await expect(manageDescription).toBeVisible();
    await expect(page.getByText("Décrivez le problème", { exact: true })).toBeVisible();
    await manageDescription.click();
    await manageDescription.fill("");
    await typeAndAssertFocus(page, manageDescription, "corrige");
    await expect(manageDescription).toHaveValue("corrige");
  });
});

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
  await openMoreAnd(page, "dictionaries");
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

  await openManageDictionaries(page);
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
  await navigateUx2Primary(page, "search");
  await expect(page.locator("#searchInput")).toBeEnabled({ timeout: installTimeoutMs });
}
