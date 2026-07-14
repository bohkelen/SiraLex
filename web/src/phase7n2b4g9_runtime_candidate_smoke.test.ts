/**
 * Phase 7N2B4G9 — Runtime candidate smoke test.
 *
 * Proves catalog-visible 7N2B can be discovered, installed without activation,
 * explicitly selected, and searched — while featured/default remains 7N2A via
 * VITE_FEATURED_BUNDLE_ID. Does not promote 7N2B.
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
import { installRemoteCatalogBundle } from "./install/bundle_install";
import { isIndexMappingDisplay, isLexiconDisplay } from "./types/records";
import { resolveRecords } from "./search/resolve_records";
import { searchQuery } from "./search/search_query";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const CATALOG_PATH = join(REPO_ROOT, "web/public/catalog.json");
const ENV_PRODUCTION_PATH = join(REPO_ROOT, "web/.env.production");

const FEATURED_BUNDLE_ID = "bundle_full_20260708_27643bb0";
const FALLBACK_BUNDLE_ID = "bundle_full_20260616_phase7j_alias_round2_candidate";
const CANDIDATE_BUNDLE_ID = "bundle_full_20260710_337619ff";

const FEATURED_DIR = join(REPO_ROOT, "web/public", FEATURED_BUNDLE_ID);
const CANDIDATE_DIR = join(REPO_ROOT, "web/public", CANDIDATE_BUNDLE_ID);

const EXPECTED_FEATURED = {
  version: "norm-v3-featured-7n2a4f8-7l13-7n2a8-runtime-smoke-pass",
  content_sha256: "sha256:27643bb092ff31117a133378db7562080c8b1d0d87fe111f5b83973e15a08484",
} as const;

const EXPECTED_FALLBACK = {
  version: "norm-v3-prior-featured-fallback-phase7j",
  content_sha256: "sha256:e54b8fdf39558ecb639c0763ea9454f085aded7b48f867affe1f96a44709c2ef",
} as const;

const EXPECTED_CANDIDATE = {
  version: "norm-v3-candidate-catalog-visible-7n2b4g8-7l13-7n2a8-7n2b9",
  content_sha256: "sha256:337619ff43131acde1390d7892d687372785729dac5d85abe82b61cc92285c3c",
  records_sha256: "sha256:d99242ed0c049759ec265f3583683c99a3146854b4481b6d3de86cbd33f50a90",
  search_index_sha256: "sha256:55bf98fc99a592f7003aa338fc7b4790bc9cd642b676c99a725d83a5f9ca79e3",
  prix_direct_id: "ffbf014bd96ffabf",
  prix_owner_ir_id: "3b8c3b7a0c5e897d",
} as const;

const ENV_PRODUCTION_EXPECTED = `# Non-secret production featured bundle selector (Phase 7N2A4F8).
# Public identity also present in web/public/catalog.json.
VITE_FEATURED_BUNDLE_ID=bundle_full_20260708_27643bb0
`;

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

describe("Phase 7N2B4G9 runtime candidate smoke", () => {
  beforeEach(async () => {
    await deleteSiralexDb().catch(() => undefined);
  });

  afterEach(async () => {
    await deleteSiralexDb().catch(() => undefined);
  });

  it("catalog contains 7J, featured 7N2A, and candidate 7N2B; production env selects 7N2A", () => {
    expect(readFileSync(ENV_PRODUCTION_PATH, "utf-8")).toBe(ENV_PRODUCTION_EXPECTED);

    const featuredBundleId = readProductionFeaturedBundleId();
    expect(featuredBundleId).toBe(FEATURED_BUNDLE_ID);

    const bundles = loadCatalogEntries();
    expect(bundles).toHaveLength(3);

    const featured = getFeaturedCatalogEntry(bundles, featuredBundleId);
    const sortFirst = getFeaturedCatalogEntry(bundles, undefined);
    const fallback = bundles.find((entry) => entry.bundle_id === FALLBACK_BUNDLE_ID);
    const candidate = bundles.find((entry) => entry.bundle_id === CANDIDATE_BUNDLE_ID);

    expect(featured.bundle_id).toBe(FEATURED_BUNDLE_ID);
    expect(featured.version).toBe(EXPECTED_FEATURED.version);
    expect(featured.content_sha256).toBe(EXPECTED_FEATURED.content_sha256);
    expect(featured.bundle_id).not.toBe(CANDIDATE_BUNDLE_ID);

    expect(sortFirst.bundle_id).toBe(FALLBACK_BUNDLE_ID);

    expect(fallback).toBeDefined();
    expect(fallback!.version).toBe(EXPECTED_FALLBACK.version);
    expect(fallback!.content_sha256).toBe(EXPECTED_FALLBACK.content_sha256);

    expect(candidate).toBeDefined();
    expect(candidate!.version).toBe(EXPECTED_CANDIDATE.version);
    expect(candidate!.content_sha256).toBe(EXPECTED_CANDIDATE.content_sha256);
    expect(candidate!.url_base).toBe(`./${CANDIDATE_BUNDLE_ID}/`);

    expect(sha256File(join(CANDIDATE_DIR, "records.jsonl"))).toBe(EXPECTED_CANDIDATE.records_sha256);
    expect(sha256File(join(CANDIDATE_DIR, "search_index.jsonl"))).toBe(
      EXPECTED_CANDIDATE.search_index_sha256,
    );
    const manifest = JSON.parse(
      readFileSync(join(CANDIDATE_DIR, "bundle.manifest.json"), "utf-8"),
    ) as { bundle_id: string; content_sha256: string };
    expect(manifest.bundle_id).toBe(CANDIDATE_BUNDLE_ID);
    expect(manifest.content_sha256).toBe(EXPECTED_CANDIDATE.content_sha256);
  });

  it(
    "installs featured 7N2A; installing 7N2B without activate leaves 7N2A active; explicit select searches 7N2B",
    async () => {
      const featuredBundleId = readProductionFeaturedBundleId();
      const bundles = loadCatalogEntries();
      const featuredEntry = getFeaturedCatalogEntry(bundles, featuredBundleId);
      const candidateEntry = bundles.find((entry) => entry.bundle_id === CANDIDATE_BUNDLE_ID)!;
      expect(featuredEntry.bundle_id).toBe(FEATURED_BUNDLE_ID);
      expect(candidateEntry.bundle_id).toBe(CANDIDATE_BUNDLE_ID);

      const db = await openSiralexDb();
      try {
        await installRemoteCatalogBundle(db, featuredEntry, "https://example.test/catalog.json", {
          fetchImpl: fileFetchImpl(FEATURED_DIR),
          activateOnCommit: true,
        });
        expect(await getActiveBundleId(db)).toBe(FEATURED_BUNDLE_ID);
        const featuredScope = (await getActiveBundleMeta(db))!.storage_scope_id!;
        expect(await searchIds(db, featuredScope, "maman")).toEqual(["e5164efcdf5e6ca4"]);
        // Featured 7N2A does not yet have moto / prix (those are 7N2B deltas).
        expect(await searchIds(db, featuredScope, "moto")).toEqual([]);
        expect(await searchIds(db, featuredScope, "prix")).toEqual([]);

        await installRemoteCatalogBundle(db, candidateEntry, "https://example.test/catalog.json", {
          fetchImpl: fileFetchImpl(CANDIDATE_DIR),
          activateOnCommit: false,
        });
        const installedCandidate = await getInstalledBundleMeta(db, CANDIDATE_BUNDLE_ID);
        expect(installedCandidate?.expected_content_sha256).toBe(EXPECTED_CANDIDATE.content_sha256);
        expect(await getActiveBundleId(db)).toBe(FEATURED_BUNDLE_ID);
        expect((await getActiveBundleMeta(db))?.bundle_id).toBe(FEATURED_BUNDLE_ID);

        // Explicit user selection required to search 7N2B.
        await setActiveBundleId(db, CANDIDATE_BUNDLE_ID);
        expect(await getActiveBundleId(db)).toBe(CANDIDATE_BUNDLE_ID);
        const candidateScope = (await getActiveBundleMeta(db))!.storage_scope_id!;
        expect(candidateScope).toBeTruthy();

        const smoke: Array<{
          query: string;
          expectedIds: string[];
          expectedDisplays?: string[];
        }> = [
          {
            query: "moto",
            expectedIds: ["b5c9a49f6db2a991", "0a56b8047aeaf117"],
            expectedDisplays: ["pópo", "pópo"],
          },
          {
            query: "prix",
            expectedIds: [EXPECTED_CANDIDATE.prix_direct_id],
            expectedDisplays: ["Son"],
          },
          { query: "maman", expectedIds: ["e5164efcdf5e6ca4"] },
          { query: "fièvre", expectedIds: [] },
          { query: "comment dit-on école", expectedIds: [] },
          { query: "combien ça coûte", expectedIds: [] },
          { query: "merci beaucoup", expectedIds: [] },
          {
            query: "papa",
            expectedIds: ["b8053579e3035e88"],
            expectedDisplays: ["bàba", "bàwa"],
          },
          { query: "père", expectedIds: ["423369d78d42c100"], expectedDisplays: ["fà"] },
          { query: "hôpital", expectedIds: ["61843e6630c1fbae", "ff4ee495ef997adf"] },
          { query: "clinique", expectedIds: ["ff42659295a657dc"] },
          { query: "centre de santé", expectedIds: ["ffb73938da1a4576"] },
          { query: "place", expectedIds: ["96b72ff71179d689"] },
          { query: "location", expectedIds: [] },
          { query: "yoro", expectedIds: [] },
        ];

        for (const caseRow of smoke) {
          const ids = await searchIds(db, candidateScope, caseRow.query);
          expect(ids, caseRow.query).toEqual(caseRow.expectedIds);
          if (caseRow.expectedDisplays) {
            const displays = targetDisplayTexts(
              await resolveRecords(db, candidateScope, ids),
            );
            expect(displays, `${caseRow.query} displays`).toEqual(caseRow.expectedDisplays);
          }
        }

        // prix resolved owner lexicon target Son (3b8c3b7a0c5e897d).
        const prixRecords = await resolveRecords(db, candidateScope, [
          EXPECTED_CANDIDATE.prix_direct_id,
        ]);
        expect(prixRecords).toHaveLength(1);
        expect(isIndexMappingDisplay(prixRecords[0]!)).toBe(true);
        if (isIndexMappingDisplay(prixRecords[0]!)) {
          const targets = prixRecords[0]!.display.target_entries ?? [];
          expect(targets).toHaveLength(1);
          expect(targets[0]!.display_text.normalize("NFC")).toBe("Son");
          expect(targets[0]!.anchor).toBe("7n2b_son_v1");
        }
        const sonRecords = await resolveRecords(db, candidateScope, [
          EXPECTED_CANDIDATE.prix_owner_ir_id,
        ]);
        expect(sonRecords).toHaveLength(1);
        expect(isLexiconDisplay(sonRecords[0]!)).toBe(true);
        if (isLexiconDisplay(sonRecords[0]!)) {
          expect(sonRecords[0]!.preferred_form.normalize("NFC")).toBe("Son");
          expect(sonRecords[0]!.ir_id).toBe(EXPECTED_CANDIDATE.prix_owner_ir_id);
          expect(sonRecords[0]!.display.headword_latin.normalize("NFC")).toBe("Son");
        }

        expect(
          targetDisplayTexts(await resolveRecords(db, candidateScope, await searchIds(db, candidateScope, "hôpital"))),
        ).toEqual(["dándaso", "ndándayoro", "ndándadiya"]);
        expect(
          targetDisplayTexts(await resolveRecords(db, candidateScope, await searchIds(db, candidateScope, "clinique"))),
        ).toEqual(["ndándayoro", "ndándadiya"]);
        expect(
          targetDisplayTexts(
            await resolveRecords(db, candidateScope, await searchIds(db, candidateScope, "centre de santé")),
          ),
        ).toEqual(["ndándayoro", "ndándadiya"]);

        const placeDisplays = targetDisplayTexts(
          await resolveRecords(db, candidateScope, await searchIds(db, candidateScope, "place")),
        );
        expect(placeDisplays).not.toContain("ndándayoro");
        expect(placeDisplays).not.toContain("ndándadiya");

        // Switch back to featured 7N2A remains installable/active.
        await setActiveBundleId(db, FEATURED_BUNDLE_ID);
        expect(await getActiveBundleId(db)).toBe(FEATURED_BUNDLE_ID);
        expect(await searchIds(db, featuredScope, "maman")).toEqual(["e5164efcdf5e6ca4"]);
        expect(await searchIds(db, featuredScope, "moto")).toEqual([]);
      } finally {
        db.close();
      }

      expect(readFileSync(ENV_PRODUCTION_PATH, "utf-8")).toBe(ENV_PRODUCTION_EXPECTED);
    },
    600_000,
  );
});
