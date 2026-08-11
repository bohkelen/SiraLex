/**
 * DU1 — Consumer dictionary update experience (real same-ID ML1E path).
 *
 * OLD featured hash 337619ff… → catalog NEW d076558b…, same bundle_id.
 */
import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

import {
  ensureSourceToTarget,
  navigateUx2Primary,
  openDictionariesAdvanced,
  openMoreAnd,
} from "./helpers/ux2_nav";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OLD_DIR = path.join(webRoot, "public/bundle_full_20260710_337619ff");
const NEW_DIR = path.join(webRoot, "public/bundle_full_20260710_337619ff__d076558b");
const BUNDLE_ID = "bundle_full_20260710_337619ff";
const OLD_HASH = "sha256:337619ff43131acde1390d7892d687372785729dac5d85abe82b61cc92285c3c";
const NEW_HASH = "sha256:d076558b2f668a06a5a30a143026433e9e0de3523e0397183cfd897b2641d90a";
const OLD_SCOPE = `${BUNDLE_ID}::${OLD_HASH}`;
const NEW_SCOPE = `${BUNDLE_ID}::${NEW_HASH}`;
const PREF_KEY = "siralex.search_lookup_lang";
const UI_LOCALE_KEY = "siralex.ui_locale";
const installTimeoutMs = 1_200_000;

test.describe("DU1 dictionary update experience", () => {
  test("Search notice → confirm → update → overlays retained → old payload gone", async ({
    page,
    context,
  }) => {
    test.setTimeout(2_400_000);
    await page.setViewportSize({ width: 390, height: 844 });
    page.on("dialog", (dialog) => dialog.accept());

    await Promise.all(
      ["bundle.manifest.json", "records.jsonl", "search_index.jsonl"].flatMap((name) => [
        access(path.join(OLD_DIR, name)),
        access(path.join(NEW_DIR, name)),
      ]),
    );

    await clearDbAndInstall(page, OLD_DIR, BUNDLE_ID);
    await setUiLocale(page, "en");
    await page.evaluate((k) => localStorage.setItem(k, "en"), PREF_KEY);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("#searchInput")).toBeEnabled({ timeout: installTimeoutMs });

    // Personal overlays before update.
    await navigateUx2Primary(page, "search");
    await ensureSourceToTarget(page);
    await page.locator("#searchInput").fill("moto");
    await expect(page.locator("#searchResults")).toContainText(/motocycle|po[\u0301]?po|pópo|popo/i, {
      timeout: 30_000,
    });
    await page.locator("#searchResults .result-open").first().click();
    const openLex = page.getByRole("button", { name: /Open entry:/i });
    if (await openLex.count()) {
      await openLex.first().click();
    }
    await expect(page.locator("#entry-learning-save")).toBeVisible({ timeout: 30_000 });
    await page.locator("#entry-learning-save").click();
    await expect(page.locator("#entry-learning-save")).toContainText(/Saved|Économisé|Retiré|Remove|Unsave/i, {
      timeout: 15_000,
    });

    // CF1 + CF2 drafts via management surfaces if capture buttons exist; otherwise seed via IDB.
    await seedOverlaysViaIdb(page, OLD_SCOPE, OLD_HASH);

    // Catalog refresh → Search notice.
    await openDictionariesAdvanced(page);
    await page.locator("#catalogUrl").fill("/catalog.json");
    await page.locator("#loadCatalog").click();
    await expect(page.locator("#catalogStatus, #catalogList, .catalog-item").first()).toBeVisible({
      timeout: 60_000,
    });

    await navigateUx2Primary(page, "search");
    const notice = page.locator('[data-testid="dictionary-update-notice"]');
    await expect(notice).toBeVisible({ timeout: 60_000 });
    await expect(notice).toContainText(/Dictionary update available|Mise à jour/i);
    await expect(page.locator("#searchInput")).toBeEnabled();

    // Dictionaries update card — one logical row.
    await openMoreAnd(page, "dictionaries");
    await expect(page.locator(".ux2-dict-row")).toHaveCount(1);
    await expect(page.locator(".ux2-dict-row")).toContainText(/New version available|Nouvelle version/i);
    const dictUpdateBtn = page.locator(".ux2-dict-row .ux2-dict-action-update");
    await expect(dictUpdateBtn).toBeVisible();
    await expect(page.locator("#clearDb")).toBeVisible();
    await expect(page.locator("#dictionariesDestructive")).toContainText(
      /permanently deletes|supprime définitivement|whole local database|toute la base/i,
    );

    // Confirm retained-data explanation, then update.
    await dictUpdateBtn.click();
    const dialog = page.locator('[data-testid="dictionary-update-dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/saved words|mots enregistrés|review|révision|corrections|search feedback|retours/i);
    await expect(dialog).toContainText(/current dictionary stays available|dictionnaire actuel reste/i);
    await dialog.getByRole("button", { name: /Update dictionary|Mettre à jour le dictionnaire/i }).click();

    await expect
      .poll(async () => (await readActiveMeta(page)).expected_content_sha256, {
        timeout: installTimeoutMs,
        intervals: [2_000, 5_000, 10_000],
      })
      .toBe(NEW_HASH);

    // Success UI appears only after post-commit old-payload cleanup finishes (can be long).
    const success = page.locator('[data-testid="dictionary-update-dialog"][data-phase="success"]');
    await expect(success).toBeVisible({ timeout: installTimeoutMs });
    await expect(success).toContainText(/Dictionary updated|Dictionnaire mis à jour/i);
    await success.getByRole("button", { name: /Continue|Continuer/i }).click();

    // Notice gone; one row; NEW active; OLD payload empty.
    await navigateUx2Primary(page, "search");
    await expect(page.locator('[data-testid="dictionary-update-notice"]')).toHaveCount(0);
    const meta = await readActiveMeta(page);
    expect(meta.bundle_id).toBe(BUNDLE_ID);
    expect(meta.expected_content_sha256).toBe(NEW_HASH);
    expect(meta.storage_scope_id).toBe(NEW_SCOPE);

    const scopeCounts = await countScopePayload(page, OLD_SCOPE, NEW_SCOPE);
    expect(scopeCounts.oldRecords).toBe(0);
    expect(scopeCounts.oldIndex).toBe(0);
    expect(scopeCounts.newRecords).toBeGreaterThan(0);
    expect(scopeCounts.newIndex).toBeGreaterThan(0);

    // Overlays retained with old provenance.
    const overlays = await readOverlayProvenance(page);
    expect(overlays.learningCount).toBeGreaterThan(0);
    expect(overlays.cf1Count).toBeGreaterThan(0);
    expect(overlays.cf2Count).toBeGreaterThan(0);
    expect(overlays.cf1Scope).toBe(OLD_SCOPE);
    expect(overlays.cf1Hash).toBe(OLD_HASH);
    expect(overlays.cf2Scope).toBe(OLD_SCOPE);
    expect(overlays.cf2Hash).toBe(OLD_HASH);
    expect(overlays.queryLogCount).toBeGreaterThan(0);
    expect(await page.evaluate((k) => localStorage.getItem(k), PREF_KEY)).toBe("en");
    expect(await page.evaluate((k) => localStorage.getItem(k), UI_LOCALE_KEY)).toBe("en");

    await navigateUx2Primary(page, "saved");
    await expect(page.locator("body")).toContainText(/motocycle|po[\u0301]?po|pópo|popo|moto/i);
    await navigateUx2Primary(page, "review");
    await expect(page.locator("#ux2AppShell")).toHaveAttribute("data-primary", "review");

    // NEW FR + EN search.
    await navigateUx2Primary(page, "search");
    await ensureSourceToTarget(page);
    await expect(page.locator('[data-testid="search-partner-language"]')).toBeVisible({
      timeout: 60_000,
    });
    await page.locator('[data-testid="search-partner-language"]').selectOption("fr");
    await page.locator("#searchInput").fill("moto");
    await expect(page.locator("#searchResults")).toContainText(/motocycle|po[\u0301]?po|pópo|popo/i, {
      timeout: 30_000,
    });
    await page.locator('[data-testid="search-partner-language"]').selectOption("en");
    await page.locator("#searchInput").fill("house");
    await expect(page.locator("#searchResults")).toContainText(/bo[\u0301]?n|bón|bon|house/i, {
      timeout: 30_000,
    });

    await openMoreAnd(page, "dictionaries");
    await expect(page.locator(".ux2-dict-row")).toHaveCount(1);
    await expect(page.locator(".ux2-dict-row .ux2-dict-action-update")).toHaveCount(0);

    // Offline: current dictionary usable; update does not destructively start.
    await context.setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("#searchInput")).toBeEnabled({ timeout: 60_000 });
    await navigateUx2Primary(page, "search");
    await ensureSourceToTarget(page);
    await expect(page.locator('[data-testid="search-partner-language"]')).toBeVisible({
      timeout: 60_000,
    });
    await page.locator('[data-testid="search-partner-language"]').selectOption("fr");
    await page.locator("#searchInput").fill("moto");
    await expect(page.locator("#searchResults")).toContainText(/motocycle|po[\u0301]?po|pópo|popo/i, {
      timeout: 30_000,
    });
    await context.setOffline(false);
  });

  test("failed update leaves OLD dictionary usable", async ({ page }) => {
    test.setTimeout(2_400_000);
    await page.setViewportSize({ width: 390, height: 844 });
    page.on("dialog", (dialog) => dialog.accept());

    await clearDbAndInstall(page, OLD_DIR, BUNDLE_ID);
    await setUiLocale(page, "en");

    await openDictionariesAdvanced(page);
    await page.locator("#catalogUrl").fill("/catalog.json");
    await page.locator("#loadCatalog").click();
    await expect(page.locator(".ux2-dict-row .ux2-dict-action-update").first()).toBeVisible({
      timeout: 60_000,
    });

    // Inject bad checksum before commit (corrupt NEW manifest body).
    await page.route("**/bundle_full_20260710_337619ff__d076558b/bundle.manifest.json", async (route) => {
      const response = await route.fetch();
      const text = await response.text();
      const corrupted = text.replace(NEW_HASH, "sha256:deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: corrupted,
      });
    });

    await page.locator(".ux2-dict-row .ux2-dict-action-update").first().click();
    const dialog = page.locator('[data-testid="dictionary-update-dialog"]');
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: /Update dictionary|Mettre à jour le dictionnaire/i }).click();

    const failure = page.locator('[data-testid="dictionary-update-dialog"][data-phase="failure"]');
    await expect(failure).toBeVisible({ timeout: 120_000 });
    await expect(failure).toContainText(/couldn't be completed|n’a pas pu aboutir|still available|toujours disponible/i);
    await failure.getByRole("button", { name: /Close|Fermer/i }).click();

    const meta = await readActiveMeta(page);
    expect(meta.expected_content_sha256).toBe(OLD_HASH);
    expect(meta.storage_scope_id).toBe(OLD_SCOPE);

    await navigateUx2Primary(page, "search");
    await ensureSourceToTarget(page);
    await page.locator("#searchInput").fill("moto");
    await expect(page.locator("#searchResults")).toContainText(/motocycle|po[\u0301]?po|pópo|popo/i, {
      timeout: 30_000,
    });
  });
});

async function seedOverlaysViaIdb(page: Page, scopeId: string, contentHash: string): Promise<void> {
  await page.evaluate(
    async ({ scopeId: scope, contentHash: hash }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open("siralex_db");
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      try {
        const now = new Date().toISOString();
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(
            ["correction_drafts", "search_failure_feedback", "query_logs"],
            "readwrite",
          );
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);

          const cf1 = {
            draft_id: "du1-cf1",
            schema_version: 1,
            created_at: now,
            updated_at: now,
            status: "draft",
            target: {
              kind: "sense_gloss",
              ir_id: "b5c9a49f6db2a991",
              sense_id: "s1",
              language: "fr",
            },
            proposed_text: "du1 correction",
            note: "",
            content_sha256: hash,
            storage_scope_id: scope,
            bundle_id: "bundle_full_20260710_337619ff",
          };
          tx.objectStore("correction_drafts").put(cf1);

          const cf2 = {
            feedback_id: "du1-cf2",
            schema_version: 1,
            created_at: now,
            updated_at: now,
            status: "draft",
            query_raw: "du1-missing",
            lookup_mode: "fr_mnk",
            content_sha256: hash,
            storage_scope_id: scope,
            bundle_id: "bundle_full_20260710_337619ff",
            kind: "no_result",
          };
          tx.objectStore("search_failure_feedback").put(cf2);

          const log = {
            event_id: "du1-ql",
            schema_version: 3,
            timestamp_iso: now,
            query_raw: "moto",
            storage_scope_id: scope,
            input_lang: "fr",
            output_lang: "mnk",
            direction: "source_to_target",
            result_count: 1,
            top_ir_ids: ["b5c9a49f6db2a991"],
            matched_key_type: "casefold",
          };
          tx.objectStore("query_logs").put(log);
        });
      } finally {
        db.close();
      }
    },
    { scopeId, contentHash },
  );
}

async function countScopePayload(
  page: Page,
  oldScope: string,
  newScope: string,
): Promise<{ oldRecords: number; oldIndex: number; newRecords: number; newIndex: number }> {
  return page.evaluate(
    async ({ oldScope: oldId, newScope: newId }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open("siralex_db");
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const countFor = (store: string, scope: string) =>
        new Promise<number>((resolve, reject) => {
          const tx = db.transaction(store, "readonly");
          const req = tx.objectStore(store).index("by_bundle_id").count(IDBKeyRange.only(scope));
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
      try {
        return {
          oldRecords: await countFor("records", oldId),
          oldIndex: await countFor("search_index", oldId),
          newRecords: await countFor("records", newId),
          newIndex: await countFor("search_index", newId),
        };
      } finally {
        db.close();
      }
    },
    { oldScope, newScope },
  );
}

async function readOverlayProvenance(page: Page): Promise<{
  learningCount: number;
  cf1Count: number;
  cf2Count: number;
  cf1Scope?: string;
  cf1Hash?: string;
  cf2Scope?: string;
  cf2Hash?: string;
  queryLogCount: number;
}> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("siralex_db");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const countStore = (name: string) =>
      new Promise<number>((resolve, reject) => {
        const tx = db.transaction(name, "readonly");
        const req = tx.objectStore(name).count();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    const first = (name: string) =>
      new Promise<Record<string, string> | undefined>((resolve, reject) => {
        const tx = db.transaction(name, "readonly");
        const req = tx.objectStore(name).getAll();
        req.onsuccess = () => {
          const rows = (req.result as Record<string, string>[]) ?? [];
          resolve(rows[0]);
        };
        req.onerror = () => reject(req.error);
      });
    try {
      const cf1 = await first("correction_drafts");
      const cf2 = await first("search_failure_feedback");
      return {
        learningCount: await countStore("learning_records"),
        cf1Count: await countStore("correction_drafts"),
        cf2Count: await countStore("search_failure_feedback"),
        cf1Scope: cf1?.storage_scope_id,
        cf1Hash: cf1?.content_sha256,
        cf2Scope: cf2?.storage_scope_id,
        cf2Hash: cf2?.content_sha256,
        queryLogCount: await countStore("query_logs"),
      };
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

async function readActiveMeta(page: Page): Promise<{
  bundle_id?: string;
  expected_content_sha256?: string;
  storage_scope_id?: string;
}> {
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
      if (!activeId) return {};
      return await new Promise((resolve, reject) => {
        const tx = db.transaction("bundles_registry", "readonly");
        const req = tx.objectStore("bundles_registry").get(activeId);
        req.onsuccess = () => resolve((req.result as Record<string, string>) ?? {});
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
    await openMoreAnd(page, "dictionaries");
    if (await page.locator("#clearDb").isVisible()) {
      await page.locator("#clearDb").click();
      await expect(page.locator("#importProgress")).toContainText(/deleted|supprim/i, {
        timeout: 60_000,
      });
    }
  }

  const files = [
    path.join(bundleDir, "bundle.manifest.json"),
    path.join(bundleDir, "records.jsonl"),
    path.join(bundleDir, "search_index.jsonl"),
  ];
  await Promise.all(files.map((file) => access(file)));

  await openDictionariesAdvanced(page);
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
    { timeout: 60_000 },
  );
  await navigateUx2Primary(page, "search");
  await expect(page.locator("#searchInput")).toBeEnabled({ timeout: installTimeoutMs });
  await expect.poll(async () => getActiveBundleId(page), { timeout: installTimeoutMs }).toBe(
    expectedBundleId,
  );

  const meta = await readActiveMeta(page);
  expect(meta.expected_content_sha256).toBe(OLD_HASH);
}

async function setUiLocale(page: Page, locale: "en" | "fr"): Promise<void> {
  await page.evaluate((lang) => {
    localStorage.setItem("siralex.ui_locale", lang);
  }, locale);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("#searchInput")).toBeEnabled({ timeout: installTimeoutMs });
}
