/**
 * Phase 7N2A4F6 — Runtime smoke for the catalog-visible 7N2A candidate.
 *
 * Proves discovery, load, and search of bundle_full_20260708_27643bb0 without
 * changing the catalog featured/default pointer (Phase 7J).
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
  setActiveBundleId,
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
const FEATURED_BUNDLE_ID = "bundle_full_20260616_phase7j_alias_round2_candidate";
const CANDIDATE_BUNDLE_ID = "bundle_full_20260708_27643bb0";
const FEATURED_DIR = join(REPO_ROOT, "web/public", FEATURED_BUNDLE_ID);
const CANDIDATE_DIR = join(REPO_ROOT, "web/public", CANDIDATE_BUNDLE_ID);
const MATRIX_PATH = join(REPO_ROOT, "shared/search_regression/search_regression_matrix_v1.jsonl");
const MANIFEST_PATH = join(REPO_ROOT, "shared/search_regression/matrix_manifest_v1.json");

const EXPECTED_CANDIDATE = {
  version: "norm-v3-candidate-catalog-visible-7n2a4f5-7l13-7n2a8",
  content_sha256: "sha256:27643bb092ff31117a133378db7562080c8b1d0d87fe111f5b83973e15a08484",
  records_sha256: "sha256:2c67c3f5446bfbfb078ed60f8d6e073fd0b105b816e714b6e14369c197e75f9e",
  search_index_sha256: "sha256:b2ea152d8f83a0873111058f893e84435e3e0bda2d1f40afbaee0826f040bdd6",
} as const;

const EXPECTED_FEATURED = {
  version: "norm-v3-featured-enriched-source-aliases-3-source-index-supplements-2",
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

/** Mirrors main.ts getFeaturedCatalogEntry when VITE_FEATURED_BUNDLE_ID is unset. */
function getFeaturedCatalogEntry(bundles: BundleCatalogEntryV1[]): BundleCatalogEntryV1 {
  const featured = bundles[0];
  if (!featured) {
    throw new Error("catalog has no bundles");
  }
  return featured;
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

function targetDisplayTexts(
  records: Awaited<ReturnType<typeof resolveRecords>>,
): string[] {
  const out: string[] = [];
  for (const record of records) {
    if (!isIndexMappingDisplay(record)) continue;
    for (const target of record.display.target_entries ?? []) {
      // Compare NFC so NFD stored forms match the smoke-spec spellings.
      out.push(target.display_text.normalize("NFC"));
    }
  }
  return out;
}

describe("Phase 7N2A4F6 runtime candidate smoke", () => {
  beforeEach(async () => {
    await deleteSiralexDb().catch(() => undefined);
  });

  afterEach(async () => {
    await deleteSiralexDb().catch(() => undefined);
  });

  it("catalog discovers candidate while featured/default remains Phase 7J", () => {
    const bundles = loadCatalogEntries();
    const featured = getFeaturedCatalogEntry(bundles);
    const candidate = bundles.find((entry) => entry.bundle_id === CANDIDATE_BUNDLE_ID);

    expect(featured.bundle_id).toBe(FEATURED_BUNDLE_ID);
    expect(featured.version).toBe(EXPECTED_FEATURED.version);
    expect(featured.content_sha256).toBe(EXPECTED_FEATURED.content_sha256);

    expect(candidate).toBeDefined();
    expect(candidate!.version).toBe(EXPECTED_CANDIDATE.version);
    expect(candidate!.content_sha256).toBe(EXPECTED_CANDIDATE.content_sha256);
    expect(candidate!.url_base).toBe(`./${CANDIDATE_BUNDLE_ID}/`);

    expect(sha256File(join(CANDIDATE_DIR, "records.jsonl"))).toBe(EXPECTED_CANDIDATE.records_sha256);
    expect(sha256File(join(CANDIDATE_DIR, "search_index.jsonl"))).toBe(
      EXPECTED_CANDIDATE.search_index_sha256,
    );
    const manifest = JSON.parse(readFileSync(join(CANDIDATE_DIR, "bundle.manifest.json"), "utf-8")) as {
      bundle_id: string;
      content_sha256: string;
    };
    expect(manifest.bundle_id).toBe(CANDIDATE_BUNDLE_ID);
    expect(manifest.content_sha256).toBe(EXPECTED_CANDIDATE.content_sha256);
  });

  it(
    "loads candidate via remote catalog install without auto-switching featured default",
    async () => {
      const bundles = loadCatalogEntries();
      const featuredEntry = getFeaturedCatalogEntry(bundles);
      const candidateEntry = bundles.find((entry) => entry.bundle_id === CANDIDATE_BUNDLE_ID);
      expect(candidateEntry).toBeDefined();

      const db = await openSiralexDb();
      try {
        // Featured install path (activateOnCommit true) — mirrors first-run featured install.
        await installRemoteCatalogBundle(db, featuredEntry, "https://example.test/catalog.json", {
          fetchImpl: fileFetchImpl(FEATURED_DIR),
          activateOnCommit: true,
        });
        let active = await getActiveBundleMeta(db);
        expect(active?.bundle_id).toBe(FEATURED_BUNDLE_ID);
        expect(await getActiveBundleId(db)).toBe(FEATURED_BUNDLE_ID);

        // Candidate install with activateOnCommit false — loadable without stealing active/default.
        // (Catalog UI activates newly installed entries when none is active; here featured is active.)
        const { manifest, result } = await installRemoteCatalogBundle(
          db,
          candidateEntry!,
          "https://example.test/catalog.json",
          {
            fetchImpl: fileFetchImpl(CANDIDATE_DIR),
            activateOnCommit: false,
          },
        );
        expect(manifest.bundle_id).toBe(CANDIDATE_BUNDLE_ID);
        expect(result.recordsCount).toBeGreaterThan(0);
        expect(result.indexCount).toBeGreaterThan(0);

        active = await getActiveBundleMeta(db);
        expect(active?.bundle_id).toBe(FEATURED_BUNDLE_ID);
        expect(await getActiveBundleId(db)).toBe(FEATURED_BUNDLE_ID);

        const installedCandidate = await getInstalledBundleMeta(db, CANDIDATE_BUNDLE_ID);
        expect(installedCandidate?.expected_content_sha256).toBe(EXPECTED_CANDIDATE.content_sha256);
        expect(installedCandidate?.version).toBe(EXPECTED_CANDIDATE.version);

        // Explicit user selection of candidate (bundle select / setActive), not featured pointer change.
        await setActiveBundleId(db, CANDIDATE_BUNDLE_ID);
        active = await getActiveBundleMeta(db);
        expect(active?.bundle_id).toBe(CANDIDATE_BUNDLE_ID);
        const scope = active!.storage_scope_id!;

        const smoke: Array<{
          query: string;
          direction?: "source_to_target" | "target_to_source";
          expectedIds: string[];
        }> = [
          { query: "maman", expectedIds: ["e5164efcdf5e6ca4"] },
          { query: "móbaa", direction: "target_to_source", expectedIds: ["c5f78c8ac66eac6b"] },
          {
            query: "hôpital",
            expectedIds: ["61843e6630c1fbae", "ff4ee495ef997adf"],
          },
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

        const hopitalRecords = await resolveRecords(
          db,
          scope,
          await searchIds(db, scope, "hôpital"),
        );
        expect(targetDisplayTexts(hopitalRecords)).toEqual([
          "dándaso",
          "ndándayoro",
          "ndándadiya",
        ]);

        const cliniqueRecords = await resolveRecords(
          db,
          scope,
          await searchIds(db, scope, "clinique"),
        );
        expect(targetDisplayTexts(cliniqueRecords)).toEqual(["ndándayoro", "ndándadiya"]);

        const centreRecords = await resolveRecords(
          db,
          scope,
          await searchIds(db, scope, "centre de santé"),
        );
        expect(targetDisplayTexts(centreRecords)).toEqual(["ndándayoro", "ndándadiya"]);

        // Featured/default catalog pointer still 7J after candidate selection.
        const featuredAfter = getFeaturedCatalogEntry(loadCatalogEntries());
        expect(featuredAfter.bundle_id).toBe(FEATURED_BUNDLE_ID);
      } finally {
        db.close();
      }
    },
    600_000,
  );

  it(
    "featured Phase 7J runtime search non-regression remains 13/13",
    async () => {
      const result = await runMatrixRegression({
        matrixPath: MATRIX_PATH,
        manifestPath: MANIFEST_PATH,
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
    "candidate search_index loads through the same IndexedDB import path used by runtime",
    async () => {
      const db = await openSiralexDb();
      try {
        const indexText = readFileSync(join(CANDIDATE_DIR, "search_index.jsonl"));
        const recordsText = readFileSync(join(CANDIDATE_DIR, "records.jsonl"));
        await importSearchIndexJsonl(db, new Blob([indexText]), {
          bundleId: CANDIDATE_BUNDLE_ID,
          batchSize: 500,
        });
        await importRecordsJsonl(db, new Blob([recordsText]), {
          bundleId: CANDIDATE_BUNDLE_ID,
          batchSize: 500,
        });

        const ids = await searchIds(db, CANDIDATE_BUNDLE_ID, "maman");
        expect(ids).toEqual(["e5164efcdf5e6ca4"]);
        const hopital = await searchIds(db, CANDIDATE_BUNDLE_ID, "hôpital");
        expect(hopital).toEqual(["61843e6630c1fbae", "ff4ee495ef997adf"]);
      } finally {
        db.close();
      }
    },
    600_000,
  );
});
