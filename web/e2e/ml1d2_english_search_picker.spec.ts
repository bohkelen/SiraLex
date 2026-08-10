/**
 * ML1D2A — Real-browser English partner picker + preference recovery.
 *
 * Fixture: public/debug-bundles/test_ml1d2_en_bundle (EN-capable)
 * FR-only contrast: public/debug-bundles/test_directional_bundle
 */

import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

import { getSearchFromLanguage, navigateUx2Primary, openMoreAnd } from "./helpers/ux2_nav";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const enBundleDir = path.join(webRoot, "public/debug-bundles/test_ml1d2_en_bundle");
const frOnlyBundleDir = path.join(webRoot, "public/debug-bundles/test_directional_bundle");
const EN_BUNDLE_ID = "bundle_ml1d2_en_debug_v1";
const FR_ONLY_BUNDLE_ID = "bundle_full_20260418_e1c98a70";
const installTimeoutMs = 90_000;
const PREF_KEY = "siralex.search_lookup_lang";

test.describe("ML1D2A English search picker", () => {
  test("EN-capable: picker visibility, swap movement, search, preference, FR UI", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    page.on("dialog", (dialog) => dialog.accept());
    await clearDbAndInstall(page, enBundleDir, EN_BUNDLE_ID);
    await setUiLocale(page, "en");
    await navigateUx2Primary(page, "search");

    const partner = page.locator('[data-testid="search-partner-language"]');
    await expect(partner).toBeVisible();
    await expect(partner).toHaveValue("fr");
    await expect(partner).toHaveAttribute("aria-label", /Choose search language/i);
    await expect(partner.locator('option[value="en"]')).toHaveCount(1);
    await expect(page.locator("#searchTargetLanguage")).toHaveText(/Maninka/i);

    // Native <select>: focus + keyboard changes the partner option.
    await partner.focus();
    await expect(partner).toBeFocused();
    await expect(partner).toHaveValue("fr");
    await page.keyboard.press("ArrowDown");
    await expect(partner).toHaveValue("en");
    await expect(page.locator("#searchLabel")).toContainText(/English\s*→\s*Maninka/i);

    await partner.selectOption("fr");
    await expect(partner).toHaveValue("fr");

    await partner.selectOption("en");
    await expect(partner).toHaveValue("en");
    await expect(page.locator("#searchLabel")).toContainText(/English\s*→\s*Maninka/i);
    await expect(page.locator("#searchInput")).toHaveAttribute(
      "placeholder",
      /English/i,
    );
    await expect(page.locator("#langToggle")).toHaveAttribute(
      "aria-label",
      /English to Maninka/i,
    );
    expect(await page.evaluate((k) => localStorage.getItem(k), PREF_KEY)).toBe("en");

    await page.locator("#searchInput").fill("house");
    await expect(page.locator("#searchResults")).toContainText(/house_mnk|house/i, {
      timeout: 10_000,
    });
    await expect(page.locator("#searchLabel")).toContainText(/English\s*→\s*Maninka/i);

    // French-only control must not resolve via EN index as a hit for maison.
    await page.locator("#searchInput").fill("ouverture");
    await expect(page.locator("#searchResults")).not.toContainText(/dàa|daa/i, {
      timeout: 5_000,
    });

    await page.locator("#langToggle").click();
    await expect(page.locator("#searchSourceLanguage")).toHaveText(/Maninka/i);
    await expect(page.locator("#searchTargetLanguage").locator('[data-testid="search-partner-language"]')).toBeVisible();
    await expect(
      page.locator("#searchTargetLanguage").locator('[data-testid="search-partner-language"]'),
    ).toHaveValue("en");
    await expect(page.locator("#langToggle")).toHaveAttribute(
      "aria-label",
      /Maninka to English/i,
    );

    await page.locator("#searchInput").fill("house_mnk");
    await expect(page.locator("#searchResults")).toContainText(/house_mnk|house/i, {
      timeout: 10_000,
    });

    await page
      .locator("#searchTargetLanguage")
      .locator('[data-testid="search-partner-language"]')
      .selectOption("fr");
    await expect(page.locator("#searchLabel")).toContainText(/Maninka\s*→\s*French/i);
    expect(await page.evaluate((k) => localStorage.getItem(k), PREF_KEY)).toBe("fr");

    await page.locator("#langToggle").click();
    await expect(page.locator("#searchLabel")).toContainText(/French\s*→\s*Maninka/i);

    // Preference reload: select EN, reload → forward EN→MNK (swap not persisted).
    await page.locator('[data-testid="search-partner-language"]').selectOption("en");
    await page.locator("#langToggle").click(); // MNK→EN
    await expect(page.locator("#searchSourceLanguage")).toHaveText(/Maninka/i);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("#searchInput")).toBeEnabled({ timeout: installTimeoutMs });
    await expect(page.locator('[data-testid="search-partner-language"]')).toHaveValue("en");
    await expect(page.locator("#searchLabel")).toContainText(/English\s*→\s*Maninka/i);

    // French UI + English lookup independence.
    await setUiLocale(page, "fr");
    await navigateUx2Primary(page, "search");
    const frPartner = page.locator('[data-testid="search-partner-language"]');
    await expect(frPartner).toBeVisible();
    await expect(frPartner.locator('option[value="en"]')).toHaveText(/Anglais/i);
    await expect(frPartner).toHaveAttribute("aria-label", /Choisir la langue de recherche/i);
    await frPartner.selectOption("en");
    expect(await page.evaluate((k) => localStorage.getItem(k), PREF_KEY)).toBe("en");
    await setUiLocale(page, "en");
    expect(await page.evaluate((k) => localStorage.getItem(k), PREF_KEY)).toBe("en");
    await navigateUx2Primary(page, "search");
    await page.locator('[data-testid="search-partner-language"]').selectOption("en");
    await page.locator("#searchInput").fill("house");
    await expect(page.locator("#searchResults")).toContainText(/house/i, { timeout: 10_000 });
  });

  test("FR-only fixture: partner select absent", async ({ page }) => {
    page.on("dialog", (dialog) => dialog.accept());
    await clearDbAndInstall(page, frOnlyBundleDir, FR_ONLY_BUNDLE_ID);
    await setUiLocale(page, "en");
    await navigateUx2Primary(page, "search");

    await expect(page.locator('[data-testid="search-partner-language"]')).toHaveCount(0);
    await expect(page.locator("#searchSourceLanguage")).toBeVisible();
    await expect(page.locator("#searchSourceLanguage")).toHaveText(/French|Français/i);
    await expect(page.locator("#searchTargetLanguage")).toHaveText(/Maninka/i);

    await page.locator("#langToggle").click();
    await expect(await getSearchFromLanguage(page)).toMatch(/Maninka/i);
    await expect(page.locator('[data-testid="search-partner-language"]')).toHaveCount(0);
  });

  test("same-bundle EN capability loss and recovery restores preference", async ({ page }) => {
    page.on("dialog", (dialog) => dialog.accept());
    await clearDbAndInstall(page, enBundleDir, EN_BUNDLE_ID);
    await setUiLocale(page, "en");
    await navigateUx2Primary(page, "search");

    const hookAvailable = await page.evaluate(
      () =>
        typeof (globalThis as { __siralexRefreshDbStatus?: unknown })
          .__siralexRefreshDbStatus === "function",
    );
    expect(hookAvailable).toBe(true);

    await page.locator('[data-testid="search-partner-language"]').selectOption("en");
    expect(await page.evaluate((k) => localStorage.getItem(k), PREF_KEY)).toBe("en");
    await expect(page.locator("#searchLabel")).toContainText(/English\s*→\s*Maninka/i);

    await setInstalledEnglishCapability(page, EN_BUNDLE_ID, false);
    await page.evaluate(async () => {
      const refresh = (globalThis as { __siralexRefreshDbStatus?: () => Promise<void> })
        .__siralexRefreshDbStatus;
      if (!refresh) throw new Error("E2E refresh hook missing");
      await refresh();
    });
    await expect(page.locator('[data-testid="search-partner-language"]')).toHaveCount(0);
    await expect(page.locator("#searchLabel")).toContainText(/French\s*→\s*Maninka/i);
    expect(await page.evaluate((k) => localStorage.getItem(k), PREF_KEY)).toBe("en");

    await setInstalledEnglishCapability(page, EN_BUNDLE_ID, true);
    await page.evaluate(async () => {
      const refresh = (globalThis as { __siralexRefreshDbStatus?: () => Promise<void> })
        .__siralexRefreshDbStatus;
      if (!refresh) throw new Error("E2E refresh hook missing");
      await refresh();
    });
    await expect(page.locator('[data-testid="search-partner-language"]')).toBeVisible();
    await expect(page.locator('[data-testid="search-partner-language"]')).toHaveValue("en");
    await expect(page.locator("#searchLabel")).toContainText(/English\s*→\s*Maninka/i);
    expect(await page.evaluate((k) => localStorage.getItem(k), PREF_KEY)).toBe("en");
  });
});

async function setUiLocale(page: Page, locale: "en" | "fr"): Promise<void> {
  await page.evaluate((next) => {
    localStorage.setItem("siralex.ui_locale", next);
  }, locale);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("#app")).toBeVisible();
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

async function clearDbAndInstall(
  page: Page,
  bundleDir: string,
  expectedBundleId: string,
): Promise<void> {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#app")).toBeVisible();

  const searchInput = page.locator("#searchInput");
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
    path.join(bundleDir, "bundle.manifest.json"),
    path.join(bundleDir, "records.jsonl"),
    path.join(bundleDir, "search_index.jsonl"),
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
  await expect.poll(async () => getActiveBundleId(page)).toBe(expectedBundleId);
}

async function setInstalledEnglishCapability(
  page: Page,
  bundleId: string,
  enabled: boolean,
): Promise<void> {
  await page.evaluate(
    async ({ id, en }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open("siralex_db");
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      try {
        const meta = await new Promise<Record<string, unknown> | undefined>((resolve, reject) => {
          const tx = db.transaction("bundles_registry", "readonly");
          const req = tx.objectStore("bundles_registry").get(id);
          req.onsuccess = () => resolve(req.result as Record<string, unknown> | undefined);
          req.onerror = () => reject(req.error);
        });
        if (!meta) throw new Error(`missing installed meta for ${id}`);
        if (en) {
          meta.lookup_languages = ["fr", "en", "mnk"];
          meta.search_key_families = ["src", "en", "tgt"];
        } else {
          meta.lookup_languages = ["fr", "mnk"];
          meta.search_key_families = ["src", "tgt"];
        }
        // Keep bundle_id stable; only capability fields change.
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction("bundles_registry", "readwrite");
          tx.objectStore("bundles_registry").put(meta);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      } finally {
        db.close();
      }
    },
    { id: bundleId, en: enabled },
  );
}
