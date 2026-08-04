/**
 * UXT1 — Theme preference browser smoke (UX2I2 shell navigation).
 *
 * Narrow checks for system/light/dark resolution, persistence, OS follow,
 * labels, and representative surface readability via CSS tokens.
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
const THEME_KEY = "siralex.ui_theme";

test.describe("UXT1 theme preference", () => {
  test("system follows OS light and dark; explicit themes persist; labels EN/FR", async ({
    page,
  }) => {
    page.on("dialog", (dialog) => dialog.accept());

    // 1. Clean context + OS light → System → data-theme=light
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.evaluate((key) => localStorage.removeItem(key), THEME_KEY);
    await page.reload({ waitUntil: "domcontentloaded" });
    await openMoreTheme(page);
    await expect(page.locator("#themeSelect")).toHaveValue("system");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expectTokensReadable(page);

    // 2. Clean context + OS dark → System → data-theme=dark
    await page.emulateMedia({ colorScheme: "dark" });
    await page.reload({ waitUntil: "domcontentloaded" });
    await openMoreTheme(page);
    await expect(page.locator("#themeSelect")).toHaveValue("system");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expectTokensReadable(page);

    // 3. Select Light while OS dark → immediate, no reload, persist across hard reload
    let navigated = false;
    const onNav = () => {
      navigated = true;
    };
    page.on("framenavigated", onNav);
    await page.locator("#themeSelect").selectOption("light");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    expect(navigated).toBe(false);
    page.off("framenavigated", onNav);
    expect(await page.evaluate((key) => localStorage.getItem(key), THEME_KEY)).toBe("light");
    await page.reload({ waitUntil: "domcontentloaded" });
    await openMoreTheme(page);
    await expect(page.locator("#themeSelect")).toHaveValue("light");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

    // 4. Select Dark while OS light → immediate + persist
    await page.emulateMedia({ colorScheme: "light" });
    await page.locator("#themeSelect").selectOption("dark");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(await page.evaluate((key) => localStorage.getItem(key), THEME_KEY)).toBe("dark");
    await page.reload({ waitUntil: "domcontentloaded" });
    await openMoreTheme(page);
    await expect(page.locator("#themeSelect")).toHaveValue("dark");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    // 5. Select System → follow OS color-scheme changes without reload
    await page.locator("#themeSelect").selectOption("system");
    expect(await page.evaluate((key) => localStorage.getItem(key), THEME_KEY)).toBe("system");
    await page.emulateMedia({ colorScheme: "light" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    // 6. Invalid stored value → System behavior
    await page.evaluate((key) => localStorage.setItem(key, "sepia"), THEME_KEY);
    await page.emulateMedia({ colorScheme: "dark" });
    await page.reload({ waitUntil: "domcontentloaded" });
    await openMoreTheme(page);
    await expect(page.locator("#themeSelect")).toHaveValue("system");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    // 7. EN / FR labels
    await setUiLocale(page, "en");
    await openMoreTheme(page);
    await expect(page.locator("#themeSelectorLabel")).toHaveText("Theme");
    await expect(page.locator("#themeSelect option[value='system']")).toHaveText("System");
    await expect(page.locator("#themeSelect option[value='light']")).toHaveText("Light");
    await expect(page.locator("#themeSelect option[value='dark']")).toHaveText("Dark");
    await setUiLocale(page, "fr");
    await openMoreTheme(page);
    await expect(page.locator("#themeSelectorLabel")).toHaveText("Thème");
    await expect(page.locator("#themeSelect option[value='system']")).toHaveText("Système");
    await expect(page.locator("#themeSelect option[value='light']")).toHaveText("Clair");
    await expect(page.locator("#themeSelect option[value='dark']")).toHaveText("Sombre");
  });

  test("storage throw still boots from system preference", async ({ browser }) => {
    const context = await browser.newContext({
      colorScheme: "dark",
    });
    await context.addInitScript(() => {
      const proto = Storage.prototype;
      proto.getItem = () => {
        throw new Error("storage blocked");
      };
      proto.setItem = () => {
        throw new Error("storage blocked");
      };
    });
    const page = await context.newPage();
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await openMoreTheme(page);
    await expect(page.locator("#themeSelect")).toHaveValue("system");
    await context.close();
  });

  test("representative surfaces remain readable in light and dark", async ({ page }) => {
    page.on("dialog", (dialog) => dialog.accept());
    await installDebugBundle(page);
    await setUiLocale(page, "en");

    for (const theme of ["light", "dark"] as const) {
      await openMoreTheme(page);
      await page.locator("#themeSelect").selectOption(theme);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expectTokensReadable(page);

      // Search
      await navigateUx2Primary(page, "search");
      await expect(page.locator("#searchInput")).toBeVisible();
      await ensureSourceToTarget(page);
      await page.locator("#searchInput").fill("alpha_fr");
      await expect(page.locator("#searchResults .result-open").first()).toBeVisible({
        timeout: 15_000,
      });

      // Entry
      await page.locator("#searchResults .result-open").first().click();
      await expect(page.locator(".entry-container, .entry-headword").first()).toBeVisible({
        timeout: 15_000,
      });
      await expectTokensReadable(page);

      // Saved Vocabulary via primary nav
      await navigateUx2Primary(page, "saved");
      await expect(page.locator("#saved-vocab-heading")).toBeVisible({ timeout: 15_000 });
      await expectTokensReadable(page);

      const startReview = page.locator("#saved-vocab-start-review");
      if (await startReview.count()) {
        await expect(startReview.first()).toBeVisible();
      }

      // Manage Dictionaries via More
      await openMoreAnd(page, "dictionaries");
      await expect(page.locator("#manageDictionariesPanel")).toBeVisible();
      await expectTokensReadable(page);

      // CF2 capture affordance from a miss
      await navigateUx2Primary(page, "search");
      await page.locator("#searchInput").fill("zzzz_uxt1_theme_miss");
      await page.waitForTimeout(250);
      const report = page.locator("[data-testid='search-feedback-report']");
      if (await report.isVisible()) {
        await report.click();
        await expect(page.locator("[data-testid='search-feedback-meaning']")).toBeVisible({
          timeout: 15_000,
        });
        await expectTokensReadable(page);
        const cancel = page.locator("[data-testid='search-feedback-cancel']");
        if (await cancel.isVisible()) await cancel.click();
      }

      // CF1 form from a resolved target entry
      const toggle = page.locator("#langToggle");
      const label = (await toggle.textContent()) ?? "";
      if (/→/.test(label)) {
        const left = label.split("→")[0] ?? "";
        if (!/Maninka|Target|Cible|mnk/i.test(left)) {
          await toggle.click();
        }
      }
      await page.locator("#searchInput").fill("alpha_mnk");
      await expect(page.locator("#searchResults .result-open").first()).toBeVisible({
        timeout: 15_000,
      });
      await page.locator("#searchResults .result-open").first().click();
      const suggest = page.locator("#entry-suggest-correction");
      if (await suggest.isVisible()) {
        await suggest.click();
        await expect(page.locator("[data-testid='correction-form']")).toBeVisible({
          timeout: 15_000,
        });
        await expectTokensReadable(page);
        const cancelCf1 = page.locator("#correction-form-cancel");
        if (await cancelCf1.isVisible()) await cancelCf1.click();
      }

      // Manage Corrections / Manage Search Feedback via More
      await openMoreAnd(page, "corrections");
      await expect(
        page.locator("[data-testid='correction-manage'], .correction-manage").first(),
      ).toBeVisible({ timeout: 15_000 });
      await expectTokensReadable(page);

      await openMoreAnd(page, "search-feedback");
      await expect(
        page.locator("[data-testid='search-feedback-manage'], .search-feedback-manage").first(),
      ).toBeVisible({ timeout: 15_000 });
      await expectTokensReadable(page);
    }
  });
});

async function openMoreTheme(page: Page): Promise<void> {
  await navigateUx2Primary(page, "more");
  await expect(page.locator("#themeSelect")).toBeVisible();
}

async function expectTokensReadable(page: Page): Promise<void> {
  const tokens = await page.evaluate(() => {
    const styles = getComputedStyle(document.documentElement);
    const read = (name: string) => styles.getPropertyValue(name).trim();
    return {
      theme: document.documentElement.getAttribute("data-theme"),
      text: read("--text"),
      background: read("--background"),
      surface: read("--surface"),
      muted: read("--muted-text"),
      border: read("--border"),
      inputBackground: read("--input-background"),
      buttonBackground: read("--button-background"),
    };
  });

  expect(tokens.theme === "light" || tokens.theme === "dark").toBe(true);
  for (const [name, value] of Object.entries(tokens)) {
    if (name === "theme") continue;
    expect(value, `${name} should resolve`).toMatch(/^#|[a-z]+/i);
    expect(value.length, `${name} should be non-empty`).toBeGreaterThan(0);
  }

  expect(tokens.text.toLowerCase()).not.toBe(tokens.background.toLowerCase());
  expect(tokens.text.toLowerCase()).not.toBe(tokens.surface.toLowerCase());
  expect(tokens.border.toLowerCase()).not.toBe(tokens.background.toLowerCase());
}

async function setUiLocale(page: Page, locale: "en" | "fr"): Promise<void> {
  await navigateUx2Primary(page, "more");
  const select = page.locator("#localeSelect");
  if ((await select.inputValue()) !== locale) {
    await select.selectOption(locale);
    await page.waitForLoadState("domcontentloaded");
    await navigateUx2Primary(page, "more");
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
