/**
 * PRODUCT2E — Featured lineage update + catalog semantic identity install.
 */
import "fake-indexeddb/auto";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { parseAndValidateBundleCatalogJson } from "./bundle_catalog";
import type { BundleCatalogEntryV1 } from "./bundle_catalog";
import {
  getFeaturedUpdateKind,
  isActiveFeaturedUpdateAvailable,
} from "./dictionary_update/dictionary_update_availability";
import { normalizeUpdateSummary } from "./dictionary_update/dictionary_update_summary";
import { shouldShowSearchUpdateNotice } from "./dictionary_update/dictionary_update_consumer_state";
import {
  deleteSiralexDb,
  getActiveBundleMeta,
  openSiralexDb,
} from "./idb/siralex_db";
import { installRemoteCatalogBundle } from "./install/bundle_install";
import { parseAndValidateManifestJson } from "./bundle_manifest";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const PUBLIC_NEW = join(REPO_ROOT, "web/public/bundle_noncommercial_dfd5ba62__51c38a75");
const PUBLIC_OLD = join(REPO_ROOT, "web/public/bundle_full_20260710_337619ff__d076558b");
const CATALOG_PATH = join(REPO_ROOT, "web/public/catalog.json");

const OLD_ID = "bundle_full_20260710_337619ff";
const OLD_HASH = "sha256:d076558b2f668a06a5a30a143026433e9e0de3523e0397183cfd897b2641d90a";
const NEW_ID = "bundle_noncommercial_dfd5ba62";
const NEW_HASH = "sha256:dfd5ba62514caa72f9e282d16160ded01c26164c5c982fd6d164b78b6f7aeb33";

function loadCatalogEntry(bundleId: string): BundleCatalogEntryV1 {
  const validated = parseAndValidateBundleCatalogJson(readFileSync(CATALOG_PATH, "utf-8"));
  expect(validated.ok).toBe(true);
  const entry = validated.catalog!.bundles.find((b) => b.bundle_id === bundleId);
  expect(entry).toBeDefined();
  return entry!;
}

function fileResponse(path: string, contentType: string): Response {
  const body = readFileSync(path);
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": contentType },
  });
}

function catalogFetchImpl(baseDir: string): typeof fetch {
  return async (input: RequestInfo | URL) => {
    const url = String(input);
    const name = url.split("/").pop() ?? "";
    if (name === "bundle.manifest.json") {
      return fileResponse(join(baseDir, name), "application/json");
    }
    if (name === "records.jsonl" || name === "search_index.jsonl") {
      return fileResponse(join(baseDir, name), "application/x-ndjson");
    }
    return new Response("not found", { status: 404 });
  };
}

describe("PRODUCT2E featured lineage update", () => {
  beforeEach(async () => {
    await deleteSiralexDb().catch(() => undefined);
  });

  afterEach(async () => {
    await deleteSiralexDb().catch(() => undefined);
  });

  it("catalog exposes bilingual update_summary for the featured noncommercial release", () => {
    const entry = loadCatalogEntry(NEW_ID);
    expect(entry.update_summary?.short_summary).toMatch(/Credits|Sources|search/i);
    expect(entry.update_summary?.short_summary_fr).toMatch(/Crédits|sources|recherche/i);
    expect(entry.update_summary?.applies_from_bundle_ids).toContain(OLD_ID);
    expect(normalizeUpdateSummary(entry.update_summary)?.short_summary_fr).toBeTruthy();
  });

  it("new user (no install) is not shown an out-of-date update notice", () => {
    const featured = loadCatalogEntry(NEW_ID);
    expect(
      isActiveFeaturedUpdateAvailable({
        featuredEntry: featured,
      }),
    ).toBe(false);
    expect(
      shouldShowSearchUpdateNotice({
        updateAvailable: false,
        noticeDismissedThisSession: false,
        phase: "idle",
      }),
    ).toBe(false);
  });

  it("existing old featured lineage → UPDATE_AVAILABLE to new featured", () => {
    const featured = loadCatalogEntry(NEW_ID);
    expect(
      getFeaturedUpdateKind({
        active: { bundle_id: OLD_ID, expected_content_sha256: OLD_HASH },
        featuredEntry: featured,
      }),
    ).toBe("featured_lineage");
  });

  it("already-current featured install suppresses update", () => {
    const featured = loadCatalogEntry(NEW_ID);
    expect(
      isActiveFeaturedUpdateAvailable({
        active: { bundle_id: NEW_ID, expected_content_sha256: NEW_HASH },
        featuredEntry: featured,
      }),
    ).toBe(false);
  });

  it(
    "catalog install remaps sealed manifest build id to catalog semantic bundle_id",
    async () => {
      const entry = loadCatalogEntry(NEW_ID);
      const manifestText = readFileSync(join(PUBLIC_NEW, "bundle.manifest.json"), "utf-8");
      const parsed = parseAndValidateManifestJson(manifestText);
      expect(parsed.ok).toBe(true);
      expect(parsed.manifest!.bundle_id).not.toBe(entry.bundle_id);
      expect(parsed.manifest!.content_sha256).toBe(entry.content_sha256);

      const db = await openSiralexDb();
      try {
        const { manifest, result } = await installRemoteCatalogBundle(
          db,
          entry,
          "https://example.test/catalog.json",
          {
            fetchImpl: catalogFetchImpl(PUBLIC_NEW),
            activateOnCommit: true,
            progressMode: "consumer",
          },
        );
        expect(result.skippedBecauseCurrent).not.toBe(true);
        expect(manifest.bundle_id).toBe(NEW_ID);
        const active = await getActiveBundleMeta(db);
        expect(active?.bundle_id).toBe(NEW_ID);
        expect(active?.expected_content_sha256).toBe(NEW_HASH);
        expect(active?.manifest_schema_version).toBe("bundle_manifest_v2");
        expect(active?.source_credits).toBeTruthy();
      } finally {
        db.close();
      }
    },
    180_000,
  );

  it(
    "failed update leaves previously active old bundle usable",
    async () => {
      const oldEntry = loadCatalogEntry(OLD_ID);
      const newEntry = loadCatalogEntry(NEW_ID);
      const db = await openSiralexDb();
      try {
        await installRemoteCatalogBundle(db, oldEntry, "https://example.test/catalog.json", {
          fetchImpl: catalogFetchImpl(PUBLIC_OLD),
          activateOnCommit: true,
        });
        const before = await getActiveBundleMeta(db);
        expect(before?.bundle_id).toBe(OLD_ID);

        const failingFetch: typeof fetch = async (input) => {
          const url = String(input);
          if (url.includes("records.jsonl")) {
            return new Response("fail", { status: 500 });
          }
          return catalogFetchImpl(PUBLIC_NEW)(input);
        };

        await expect(
          installRemoteCatalogBundle(db, newEntry, "https://example.test/catalog.json", {
            fetchImpl: failingFetch,
            activateOnCommit: true,
          }),
        ).rejects.toThrow();

        const after = await getActiveBundleMeta(db);
        expect(after?.bundle_id).toBe(OLD_ID);
        expect(after?.expected_content_sha256).toBe(OLD_HASH);
      } finally {
        db.close();
      }
    },
    180_000,
  );

  it("offline notice path: without updateAvailable, notice stays hidden", () => {
    expect(
      shouldShowSearchUpdateNotice({
        updateAvailable: false,
        noticeDismissedThisSession: false,
        phase: "idle",
      }),
    ).toBe(false);
  });
});
