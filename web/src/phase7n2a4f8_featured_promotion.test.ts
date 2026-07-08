/**
 * Phase 7N2A4F8 — Featured promotion of 7N2A via VITE_FEATURED_BUNDLE_ID.
 *
 * Proves production env selects 7N2A as featured/default while 7J remains
 * catalog-visible for rollback. Does not rely on catalog sort order.
 */
import "fake-indexeddb/auto";

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  parseAndValidateBundleCatalogJson,
  type BundleCatalogEntryV1,
} from "./bundle_catalog";
import {
  deleteSiralexDb,
  getActiveBundleId,
  getActiveBundleMeta,
  getInstalledBundleMeta,
  openSiralexDb,
} from "./idb/siralex_db";
import { installRemoteCatalogBundle } from "./install/bundle_install";
import { isIndexMappingDisplay } from "./types/records";
import { resolveRecords } from "./search/resolve_records";
import { searchQuery } from "./search/search_query";
import { runMatrixRegression } from "./search_regression/run_matrix";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const CATALOG_PATH = join(REPO_ROOT, "web/public/catalog.json");
const ENV_PRODUCTION_PATH = join(REPO_ROOT, "web/.env.production");
const PROMOTED_BUNDLE_ID = "bundle_full_20260708_27643bb0";
const FALLBACK_BUNDLE_ID = "bundle_full_20260616_phase7j_alias_round2_candidate";
const PROMOTED_DIR = join(REPO_ROOT, "web/public", PROMOTED_BUNDLE_ID);
const FALLBACK_DIR = join(REPO_ROOT, "web/public", FALLBACK_BUNDLE_ID);
const MATRIX_PATH = join(REPO_ROOT, "shared/search_regression/search_regression_matrix_v1.jsonl");

const EXPECTED_PROMOTED = {
  version: "norm-v3-featured-7n2a4f8-7l13-7n2a8-runtime-smoke-pass",
  content_sha256: "sha256:27643bb092ff31117a133378db7562080c8b1d0d87fe111f5b83973e15a08484",
  records_sha256: "sha256:2c67c3f5446bfbfb078ed60f8d6e073fd0b105b816e714b6e14369c197e75f9e",
  search_index_sha256: "sha256:b2ea152d8f83a0873111058f893e84435e3e0bda2d1f40afbaee0826f040bdd6",
} as const;

const EXPECTED_FALLBACK = {
  version: "norm-v3-prior-featured-fallback-phase7j",
  content_sha256: "sha256:e54b8fdf39558ecb639c0763ea9454f085aded7b48f867affe1f96a44709c2ef",
} as const;

function sha256File(path: string): string {
  return `sha256:${createHash("sha256").update(readFileSync(path)).digest("hex")}`;
}

function loadCatalogEntries(): BundleCatalogEntryV1[] {
  const parsed = parseAndValidateBundleCatalogJson(readFileSync(CATALOG_PATH, "utf-8"));
  expect(parsed.ok).toBe(true);
  expect(parsed.catalog).toBeDefined();
  return parsed.catalog!.bundles;
}

/** Mirrors web/src/main.ts getFeaturedCatalogEntry + FEATURED_BUNDLE_ID. */
function getFeaturedCatalogEntry(
  bundles: BundleCatalogEntryV1[],
  featuredBundleId: string | undefined,
): BundleCatalogEntryV1 {
  if (featuredBundleId) {
    const match = bundles.find((entry) => entry.bundle_id === featuredBundleId);
    if (!match) {
      throw new Error(`featured bundle_id not in catalog: ${featuredBundleId}`);
    }
    return match;
  }
  const first = bundles[0];
  if (!first) {
    throw new Error("catalog has no bundles");
  }
  return first;
}

function readProductionFeaturedBundleId(): string {
  const text = readFileSync(ENV_PRODUCTION_PATH, "utf-8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^VITE_FEATURED_BUNDLE_ID\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const value = match[1]!.trim().replace(/^['"]|['"]$/g, "");
    if (value === "") {
      throw new Error("VITE_FEATURED_BUNDLE_ID is empty in web/.env.production");
    }
    return value;
  }
  throw new Error("VITE_FEATURED_BUNDLE_ID missing from web/.env.production");
}

function fileFetchImpl(bundleDir: string): typeof fetch {
  return async (input) => {
    const url = String(input);
    const name = url.split("/").pop() ?? "";
    const path = join(bundleDir, name);
    const body = readFileSync(path);
    const contentType = name.endsWith(".json") ? "application/json" : "application/x-ndjson";
    const response = new Response(body, {
      status: 200,
      headers: {
        "content-type": contentType,
        "content-length": String(body.byteLength),
      },
    });
    Object.defineProperty(response, "url", { value: url, configurable: true });
    return response;
  };
}

async function searchIds(
  db: IDBDatabase,
  storageScopeId: string,
  query: string,
  direction: "source_to_target" | "target_to_source" = "source_to_target",
): Promise<string[]> {
  const result = await searchQuery(db, storageScopeId, direction, query, true);
  return result.ir_ids;
}

function targetDisplayTexts(records: Awaited<ReturnType<typeof resolveRecords>>): string[] {
  const out: string[] = [];
  for (const record of records) {
    if (!isIndexMappingDisplay(record)) continue;
    for (const target of record.display.target_entries ?? []) {
      out.push(target.display_text.normalize("NFC"));
    }
  }
  return out;
}

describe("Phase 7N2A4F8 featured promotion", () => {
  beforeEach(async () => {
    await deleteSiralexDb().catch(() => undefined);
  });

  afterEach(async () => {
    await deleteSiralexDb().catch(() => undefined);
  });

  it("production env selects 7N2A as featured without relying on catalog sort", () => {
    const featuredBundleId = readProductionFeaturedBundleId();
    expect(featuredBundleId).toBe(PROMOTED_BUNDLE_ID);

    const bundles = loadCatalogEntries();
    const featured = getFeaturedCatalogEntry(bundles, featuredBundleId);
    const sortFirst = getFeaturedCatalogEntry(bundles, undefined);
    const fallback = bundles.find((entry) => entry.bundle_id === FALLBACK_BUNDLE_ID);
    const promoted = bundles.find((entry) => entry.bundle_id === PROMOTED_BUNDLE_ID);

    expect(featured.bundle_id).toBe(PROMOTED_BUNDLE_ID);
    expect(featured.version).toBe(EXPECTED_PROMOTED.version);
    expect(featured.content_sha256).toBe(EXPECTED_PROMOTED.content_sha256);

    // Sort-order alone still prefers 7J — proving VITE override is the promotion mechanism.
    expect(sortFirst.bundle_id).toBe(FALLBACK_BUNDLE_ID);

    expect(fallback).toBeDefined();
    expect(fallback!.version).toBe(EXPECTED_FALLBACK.version);
    expect(fallback!.content_sha256).toBe(EXPECTED_FALLBACK.content_sha256);
    expect(promoted).toBeDefined();
    expect(bundles).toHaveLength(2);

    expect(sha256File(join(PROMOTED_DIR, "records.jsonl"))).toBe(EXPECTED_PROMOTED.records_sha256);
    expect(sha256File(join(PROMOTED_DIR, "search_index.jsonl"))).toBe(
      EXPECTED_PROMOTED.search_index_sha256,
    );
    const manifest = JSON.parse(readFileSync(join(PROMOTED_DIR, "bundle.manifest.json"), "utf-8")) as {
      bundle_id: string;
      content_sha256: string;
    };
    expect(manifest.bundle_id).toBe(PROMOTED_BUNDLE_ID);
    expect(manifest.content_sha256).toBe(EXPECTED_PROMOTED.content_sha256);
  });

  it(
    "featured install path installs 7N2A and smoke search passes",
    async () => {
      const featuredBundleId = readProductionFeaturedBundleId();
      const bundles = loadCatalogEntries();
      const featuredEntry = getFeaturedCatalogEntry(bundles, featuredBundleId);
      expect(featuredEntry.bundle_id).toBe(PROMOTED_BUNDLE_ID);

      const db = await openSiralexDb();
      try {
        const { manifest, result } = await installRemoteCatalogBundle(
          db,
          featuredEntry,
          "https://example.test/catalog.json",
          {
            fetchImpl: fileFetchImpl(PROMOTED_DIR),
            activateOnCommit: true,
          },
        );
        expect(manifest.bundle_id).toBe(PROMOTED_BUNDLE_ID);
        expect(result.recordsCount).toBeGreaterThan(0);
        expect(result.indexCount).toBeGreaterThan(0);

        const active = await getActiveBundleMeta(db);
        expect(active?.bundle_id).toBe(PROMOTED_BUNDLE_ID);
        expect(await getActiveBundleId(db)).toBe(PROMOTED_BUNDLE_ID);
        const scope = active!.storage_scope_id!;

        const smoke: Array<{
          query: string;
          direction?: "source_to_target" | "target_to_source";
          expectedIds: string[];
        }> = [
          { query: "maman", expectedIds: ["e5164efcdf5e6ca4"] },
          { query: "móbaa", direction: "target_to_source", expectedIds: ["c5f78c8ac66eac6b"] },
          { query: "hôpital", expectedIds: ["61843e6630c1fbae", "ff4ee495ef997adf"] },
          { query: "clinique", expectedIds: ["ff42659295a657dc"] },
          { query: "centre de santé", expectedIds: ["ffb73938da1a4576"] },
          { query: "place", expectedIds: ["96b72ff71179d689"] },
          { query: "location", expectedIds: [] },
          { query: "yoro", expectedIds: [] },
        ];
        for (const caseRow of smoke) {
          const ids = await searchIds(db, scope, caseRow.query, caseRow.direction ?? "source_to_target");
          expect(ids, caseRow.query).toEqual(caseRow.expectedIds);
        }

        const hopitalRecords = await resolveRecords(db, scope, await searchIds(db, scope, "hôpital"));
        expect(targetDisplayTexts(hopitalRecords)).toEqual([
          "dándaso",
          "ndándayoro",
          "ndándadiya",
        ]);

        // 7J remains installable as explicit catalog fallback.
        const fallbackEntry = bundles.find((entry) => entry.bundle_id === FALLBACK_BUNDLE_ID)!;
        await installRemoteCatalogBundle(db, fallbackEntry, "https://example.test/catalog.json", {
          fetchImpl: fileFetchImpl(FALLBACK_DIR),
          activateOnCommit: false,
        });
        const installedFallback = await getInstalledBundleMeta(db, FALLBACK_BUNDLE_ID);
        expect(installedFallback?.expected_content_sha256).toBe(EXPECTED_FALLBACK.content_sha256);
        expect(await getActiveBundleId(db)).toBe(PROMOTED_BUNDLE_ID);
      } finally {
        db.close();
      }
    },
    600_000,
  );

  it(
    "promoted featured 7N2A passes frozen 7L runtime matrix 13/13",
    async () => {
      const tempManifestPath = join("/tmp", "phase7n2a4f8_featured_promotion_7l_manifest.json");
      const manifest = {
        schema_version: "search_regression_matrix_manifest_v1",
        matrix_schema_version: "search_regression_case_v1",
        bundle_id: PROMOTED_BUNDLE_ID,
        catalog_version: EXPECTED_PROMOTED.version,
        norm_version: "norm_v3",
        search_index_sha256: EXPECTED_PROMOTED.search_index_sha256,
        bundle_content_sha256: EXPECTED_PROMOTED.content_sha256,
        case_count: 13,
        purpose: "Temporary F8 featured-promotion 7L runtime matrix (tracked matrices untouched).",
      };
      const { writeFileSync } = await import("node:fs");
      writeFileSync(tempManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");

      const result = await runMatrixRegression({
        matrixPath: MATRIX_PATH,
        manifestPath: tempManifestPath,
        bundleDir: PROMOTED_DIR,
        catalogPath: CATALOG_PATH,
      });
      expect(result.bundle_id).toBe(PROMOTED_BUNDLE_ID);
      expect(result.catalog_version).toBe(EXPECTED_PROMOTED.version);
      expect(result.passed_case_count).toBe(13);
      expect(result.failed_case_count).toBe(0);
    },
    180_000,
  );
});
