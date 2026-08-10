/**
 * Phase 7N2A4F6 runtime smoke — retargeted in Phase 7N2B4G11.
 *
 * Historical F6 (pre-promotion) asserted 7J as featured and 7N2A as a
 * catalog-visible candidate only. That evidence remains archived in
 * docs/reports/phase7n2a4f6_runtime_candidate_smoke_test_report.md.
 * F11 retarget tracked 7N2A as featured after F8.
 *
 * After G11 promotion, this file verifies current catalog/runtime truth:
 * 7N2B is featured via VITE_FEATURED_BUNDLE_ID; 7N2A/7J remain fallback/rollback.
 * Full featured-promotion install proofs live in phase7n2b4g11_*.test.ts.
 */
import "fake-indexeddb/auto";

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
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
import { importRecordsJsonl } from "./import/import_records";
import { importSearchIndexJsonl } from "./import/import_search_index";
import { installRemoteCatalogBundle } from "./install/bundle_install";
import { isIndexMappingDisplay } from "./types/records";
import { resolveRecords } from "./search/resolve_records";
import { searchQuery } from "./search/search_query";
import { runMatrixRegression } from "./search_regression/run_matrix";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const CATALOG_PATH = join(REPO_ROOT, "web/public/catalog.json");
const ENV_PRODUCTION_PATH = join(REPO_ROOT, "web/.env.production");
const FEATURED_BUNDLE_ID = "bundle_full_20260710_337619ff";
const PRIOR_FEATURED_BUNDLE_ID = "bundle_full_20260708_27643bb0";
const FALLBACK_BUNDLE_ID = "bundle_full_20260616_phase7j_alias_round2_candidate";
const FEATURED_DIR = join(REPO_ROOT, "web/public", `${FEATURED_BUNDLE_ID}__d076558b`);
const FALLBACK_DIR = join(REPO_ROOT, "web/public", FALLBACK_BUNDLE_ID);
const MATRIX_PATH = join(REPO_ROOT, "shared/search_regression/search_regression_matrix_v1.jsonl");

const EXPECTED_FEATURED = {
  version: "norm-v3-featured-ml1e-multilingual-en-index",
  content_sha256: "sha256:d076558b2f668a06a5a30a143026433e9e0de3523e0397183cfd897b2641d90a",
  records_sha256: "sha256:d99242ed0c049759ec265f3583683c99a3146854b4481b6d3de86cbd33f50a90",
  search_index_sha256: "sha256:1b436fd77dc5404631ac6e91e5d02a38f419a58984f0ccf27bfba4ca7cb0d892",
} as const;

const EXPECTED_PRIOR = {
  version: "norm-v3-prior-featured-fallback-7n2a4f8",
  content_sha256: "sha256:27643bb092ff31117a133378db7562080c8b1d0d87fe111f5b83973e15a08484",
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

describe("Phase 7N2A4F6 runtime smoke (retargeted post-promotion)", () => {
  beforeEach(async () => {
    await deleteSiralexDb().catch(() => undefined);
  });

  afterEach(async () => {
    await deleteSiralexDb().catch(() => undefined);
  });

  it("catalog lists three bundles; production env selects 7N2B as featured; 7J remains rollback", () => {
    const featuredBundleId = readProductionFeaturedBundleId();
    expect(featuredBundleId).toBe(FEATURED_BUNDLE_ID);

    const bundles = loadCatalogEntries();
    expect(bundles).toHaveLength(3);

    const featured = getFeaturedCatalogEntry(bundles, featuredBundleId);
    const sortFirst = getFeaturedCatalogEntry(bundles, undefined);
    const fallback = bundles.find((entry) => entry.bundle_id === FALLBACK_BUNDLE_ID);
    const promoted = bundles.find((entry) => entry.bundle_id === FEATURED_BUNDLE_ID);
    const prior7n2a = bundles.find((entry) => entry.bundle_id === PRIOR_FEATURED_BUNDLE_ID);
    expect(prior7n2a).toBeDefined();
    expect(prior7n2a!.version).toBe(EXPECTED_PRIOR.version);
    expect(prior7n2a!.content_sha256).toBe(EXPECTED_PRIOR.content_sha256);

    expect(featured.bundle_id).toBe(FEATURED_BUNDLE_ID);
    expect(featured.version).toBe(EXPECTED_FEATURED.version);
    expect(featured.content_sha256).toBe(EXPECTED_FEATURED.content_sha256);

    // Sort-order alone still prefers 7J — featured selection is VITE, not sort.
    expect(sortFirst.bundle_id).toBe(FALLBACK_BUNDLE_ID);

    expect(fallback).toBeDefined();
    expect(fallback!.version).toBe(EXPECTED_FALLBACK.version);
    expect(fallback!.content_sha256).toBe(EXPECTED_FALLBACK.content_sha256);
    expect(promoted).toBeDefined();
    expect(promoted!.url_base).toBe(`./${FEATURED_BUNDLE_ID}__d076558b/`);

    expect(sha256File(join(FEATURED_DIR, "records.jsonl"))).toBe(EXPECTED_FEATURED.records_sha256);
    expect(sha256File(join(FEATURED_DIR, "search_index.jsonl"))).toBe(
      EXPECTED_FEATURED.search_index_sha256,
    );
    const manifest = JSON.parse(readFileSync(join(FEATURED_DIR, "bundle.manifest.json"), "utf-8")) as {
      bundle_id: string;
      content_sha256: string;
    };
    expect(manifest.bundle_id).toBe(FEATURED_BUNDLE_ID);
    expect(manifest.content_sha256).toBe(EXPECTED_FEATURED.content_sha256);
  });

  it(
    "featured install activates 7N2B; search smoke passes; 7J remains installable as fallback",
    async () => {
      const featuredBundleId = readProductionFeaturedBundleId();
      const bundles = loadCatalogEntries();
      const featuredEntry = getFeaturedCatalogEntry(bundles, featuredBundleId);
      expect(featuredEntry.bundle_id).toBe(FEATURED_BUNDLE_ID);

      const db = await openSiralexDb();
      try {
        await installRemoteCatalogBundle(db, featuredEntry, "https://example.test/catalog.json", {
          fetchImpl: fileFetchImpl(FEATURED_DIR),
          activateOnCommit: true,
        });
        let active = await getActiveBundleMeta(db);
        expect(active?.bundle_id).toBe(FEATURED_BUNDLE_ID);
        expect(await getActiveBundleId(db)).toBe(FEATURED_BUNDLE_ID);
        const scope = active!.storage_scope_id!;

        const smoke: Array<{
          query: string;
          direction?: "source_to_target" | "target_to_source";
          expectedIds: string[];
        }> = [
          { query: "moto", expectedIds: ["b5c9a49f6db2a991", "0a56b8047aeaf117"] },
          { query: "prix", expectedIds: ["ffbf014bd96ffabf"] },
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

        expect(targetDisplayTexts(await resolveRecords(db, scope, await searchIds(db, scope, "hôpital")))).toEqual([
          "dándaso",
          "ndándayoro",
          "ndándadiya",
        ]);
        expect(
          targetDisplayTexts(await resolveRecords(db, scope, await searchIds(db, scope, "clinique"))),
        ).toEqual(["ndándayoro", "ndándadiya"]);
        expect(
          targetDisplayTexts(await resolveRecords(db, scope, await searchIds(db, scope, "centre de santé"))),
        ).toEqual(["ndándayoro", "ndándadiya"]);

        const fallbackEntry = bundles.find((entry) => entry.bundle_id === FALLBACK_BUNDLE_ID)!;
        await installRemoteCatalogBundle(db, fallbackEntry, "https://example.test/catalog.json", {
          fetchImpl: fileFetchImpl(FALLBACK_DIR),
          activateOnCommit: false,
        });
        const installedFallback = await getInstalledBundleMeta(db, FALLBACK_BUNDLE_ID);
        expect(installedFallback?.expected_content_sha256).toBe(EXPECTED_FALLBACK.content_sha256);
        expect(await getActiveBundleId(db)).toBe(FEATURED_BUNDLE_ID);
      } finally {
        db.close();
      }
    },
    600_000,
  );

  it(
    "promoted featured 7N2B passes frozen 7L runtime matrix 13/13",
    async () => {
      const tempManifestPath = join("/tmp", "phase7n2b4g11_f6_retarget_7l_manifest.json");
      writeFileSync(
        tempManifestPath,
        `${JSON.stringify(
          {
            schema_version: "search_regression_matrix_manifest_v1",
            matrix_schema_version: "search_regression_case_v1",
            bundle_id: FEATURED_BUNDLE_ID,
            catalog_version: EXPECTED_FEATURED.version,
            norm_version: "norm_v3",
            search_index_sha256: EXPECTED_FEATURED.search_index_sha256,
            bundle_content_sha256: EXPECTED_FEATURED.content_sha256,
            case_count: 13,
            purpose: "Temporary G11 retargeted F6 7L runtime matrix (tracked matrices untouched).",
          },
          null,
          2,
        )}\n`,
        "utf-8",
      );

      const result = await runMatrixRegression({
        matrixPath: MATRIX_PATH,
        manifestPath: tempManifestPath,
        bundleDir: FEATURED_DIR,
        catalogPath: CATALOG_PATH,
      });
      expect(result.bundle_id).toBe(FEATURED_BUNDLE_ID);
      expect(result.catalog_version).toBe(EXPECTED_FEATURED.version);
      expect(result.passed_case_count).toBe(13);
      expect(result.failed_case_count).toBe(0);
    },
    180_000,
  );

  it(
    "featured search_index loads through the same IndexedDB import path used by runtime",
    async () => {
      const db = await openSiralexDb();
      try {
        const indexText = readFileSync(join(FEATURED_DIR, "search_index.jsonl"));
        const recordsText = readFileSync(join(FEATURED_DIR, "records.jsonl"));
        await importSearchIndexJsonl(db, new Blob([indexText]), {
          bundleId: FEATURED_BUNDLE_ID,
          batchSize: 500,
        });
        await importRecordsJsonl(db, new Blob([recordsText]), {
          bundleId: FEATURED_BUNDLE_ID,
          batchSize: 500,
        });

        expect(await searchIds(db, FEATURED_BUNDLE_ID, "maman")).toEqual(["e5164efcdf5e6ca4"]);
        expect(await searchIds(db, FEATURED_BUNDLE_ID, "hôpital")).toEqual([
          "61843e6630c1fbae",
          "ff4ee495ef997adf",
        ]);
      } finally {
        db.close();
      }
    },
    600_000,
  );
});
