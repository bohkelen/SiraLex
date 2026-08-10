/**
 * ML1E — Featured multilingual publication identity + same-ID update continuity.
 *
 * Uses real public artifacts:
 * - OLD: web/public/bundle_full_20260710_337619ff (hash 337619ff…)
 * - NEW: web/public/bundle_full_20260710_337619ff__d076558b (hash d076558b…)
 */
import "fake-indexeddb/auto";

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  compareCatalogEntryToInstalled,
  parseAndValidateBundleCatalogJson,
  type BundleCatalogEntryV1,
} from "./bundle_catalog";
import { createCorrectionDraft, getCorrectionDraft, listCorrectionDrafts } from "./corrections/correction_draft_store";
import { buildCorrectionEntryContext, buildCorrectionTargetOptions } from "./corrections/correction_form_model";
import { createCorrectionManagementSession } from "./corrections/correction_management_session";
import {
  deleteSiralexDb,
  getActiveBundleId,
  getActiveBundleMeta,
  getInstalledBundleMeta,
  openSiralexDb,
  SIRALEX_DB_VERSION,
  STORE_SEARCH_FAILURE_FEEDBACK,
} from "./idb/siralex_db";
import { installRemoteCatalogBundle } from "./install/bundle_install";
import { buildDisplayCache } from "./learning/build_display_cache";
import { getLearningRecord, listLearningRecordsByBundle, saveLearningRecord } from "./learning/learning_record_store";
import { resolveLearningRecordForUi } from "./learning/learning_record_resolve";
import { appendQueryLogV3, listQueryLogs } from "./query_logging/query_log_store";
import {
  QUERY_LOG_CONSENT_VERSION,
  type AppendQueryLogV3Input,
  type QueryLogLookupLanguage,
} from "./query_logging/query_log_types";
import { resolvePreferredGloss } from "./search/resolve_preferred_gloss";
import { resolveRecords } from "./search/resolve_records";
import {
  decideLookupModeActiveBundleSync,
} from "./search/lookup_mode_active_bundle_sync";
import {
  bundleSupportsEnglishLookup,
  restoreForwardLookupModeFromPreference,
  type LookupMode,
} from "./search/lookup_mode";
import { searchQuery, searchQueryForLookupMode } from "./search/search_query";
import {
  readSearchLookupLangPreference,
  writeSearchLookupLangPreference,
} from "./search/search_lookup_lang_preference";
import { runMatrixRegression } from "./search_regression/run_matrix";
import {
  createSearchFeedbackDraft,
  getSearchFeedbackDraft,
  listSearchFeedbackDrafts,
} from "./search_feedback/search_feedback_store";
import {
  SEARCH_FEEDBACK_DRAFT_SCHEMA_VERSION_V1,
  SEARCH_FEEDBACK_DRAFT_SCHEMA_VERSION_V2,
} from "./search_feedback/search_feedback_types";
import { isLexiconDisplay } from "./types/records";
import { isQueryLogEventV3 } from "./query_logging/query_log_derive";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const CATALOG_PATH = join(REPO_ROOT, "web/public/catalog.json");
const ENV_PRODUCTION_PATH = join(REPO_ROOT, "web/.env.production");
const MATRIX_PATH = join(REPO_ROOT, "shared/search_regression/search_regression_matrix_v1.jsonl");

const BUNDLE_ID = "bundle_full_20260710_337619ff";
const OLD_HASH = "sha256:337619ff43131acde1390d7892d687372785729dac5d85abe82b61cc92285c3c";
const NEW_HASH = "sha256:d076558b2f668a06a5a30a143026433e9e0de3523e0397183cfd897b2641d90a";
const OLD_SCOPE = `${BUNDLE_ID}::${OLD_HASH}`;
const NEW_SCOPE = `${BUNDLE_ID}::${NEW_HASH}`;
const OLD_DIR = join(REPO_ROOT, "web/public", BUNDLE_ID);
const NEW_DIR = join(REPO_ROOT, "web/public", `${BUNDLE_ID}__d076558b`);
const CANDIDATE_DIR = join(
  REPO_ROOT,
  "data/local_evidence/ml1c1_english_index_candidate/bundles",
  `${BUNDLE_ID}__d076558b`,
);

const HOUSE_IR = "211060723bc2edc5";
const EN_CAPABLE = {
  lookup_languages: ["fr", "en", "mnk"] as string[],
  search_key_families: ["en", "src", "tgt"] as string[],
};

function sha256File(path: string): string {
  return `sha256:${createHash("sha256").update(readFileSync(path)).digest("hex")}`;
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

function loadFeaturedCatalogEntry(): BundleCatalogEntryV1 {
  const parsed = parseAndValidateBundleCatalogJson(readFileSync(CATALOG_PATH, "utf-8"));
  expect(parsed.ok).toBe(true);
  const entry = parsed.catalog!.bundles.find((b) => b.bundle_id === BUNDLE_ID);
  expect(entry).toBeDefined();
  return entry!;
}


function memoryStorage(seed?: Record<string, string>) {
  const map = new Map<string, string>(Object.entries(seed ?? {}));
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
  };
}

function makeQueryLogV3(args: {
  event_id: string;
  query_raw: string;
  storage_scope_id: string;
  input_lang: QueryLogLookupLanguage;
  output_lang: QueryLogLookupLanguage;
  direction: "source_to_target" | "target_to_source";
  result_count: number;
  top_ir_ids: string[];
  matched_key_type: "casefold" | "diacritics_insensitive" | "punct_stripped" | "nospace" | "none";
  timestamp_iso: string;
}): AppendQueryLogV3Input {
  return {
    event_id: args.event_id,
    timestamp_iso: args.timestamp_iso,
    app_version: "ml1e-test",
    bundle_id: BUNDLE_ID,
    storage_scope_id: args.storage_scope_id,
    norm_version: "norm_v3",
    query_raw: args.query_raw,
    query_normalized_primary: args.query_raw,
    query_normalized_keys: {
      casefold: [args.query_raw],
      diacritics_insensitive: [args.query_raw],
      punct_stripped: [args.query_raw],
      nospace: [args.query_raw],
    },
    direction: args.direction,
    input_lang: args.input_lang,
    output_lang: args.output_lang,
    ui_language: "en",
    result_status: args.result_count === 0 ? "miss" : args.result_count === 1 ? "hit_single" : "hit_multi",
    result_count: args.result_count,
    top_ir_ids: args.top_ir_ids,
    matched_key_type: args.matched_key_type,
    matched_key: args.query_raw,
    matched_deep_ladder: false,
    latency_ms: 1,
    offline_or_online: true,
    session_bucket_id: "ml1e-session",
    logging_enabled: true,
    consent_version: QUERY_LOG_CONSENT_VERSION,
  };
}

async function searchIds(
  db: IDBDatabase,
  scope: string,
  query: string,
  direction: "source_to_target" | "target_to_source" = "source_to_target",
): Promise<string[]> {
  return (await searchQuery(db, scope, direction, query, true)).ir_ids;
}

async function searchLookup(
  db: IDBDatabase,
  scope: string,
  mode: LookupMode,
  query: string,
  capability: typeof EN_CAPABLE | Record<string, never>,
): Promise<string[]> {
  return (
    await searchQueryForLookupMode(db, scope, mode, query, true, capability)
  ).ir_ids;
}

describe("ML1E featured multilingual publication", () => {
  beforeEach(async () => {
    await deleteSiralexDb().catch(() => undefined);
  }, 120_000);

  afterEach(async () => {
    await deleteSiralexDb().catch(() => undefined);
  }, 120_000);

  it("catalog + env pin logical id to immutable new artifact; candidate payload unchanged", () => {
    expect(SIRALEX_DB_VERSION).toBe(6);

    const env = readFileSync(ENV_PRODUCTION_PATH, "utf-8");
    expect(env).toMatch(/VITE_FEATURED_BUNDLE_ID\s*=\s*bundle_full_20260710_337619ff\b/);

    const featured = loadFeaturedCatalogEntry();
    expect(featured.bundle_id).toBe(BUNDLE_ID);
    expect(featured.content_sha256).toBe(NEW_HASH);
    expect(featured.url_base).toBe(`./${BUNDLE_ID}__d076558b/`);
    expect(featured.size_bytes).toBe(29793679);
    expect(featured.version).toBe("norm-v3-featured-ml1e-multilingual-en-index");

    const bundles = parseAndValidateBundleCatalogJson(readFileSync(CATALOG_PATH, "utf-8")).catalog!
      .bundles;
    expect(bundles.filter((b) => b.bundle_id === BUNDLE_ID)).toHaveLength(1);

    const newManifest = JSON.parse(readFileSync(join(NEW_DIR, "bundle.manifest.json"), "utf-8")) as {
      bundle_id: string;
      content_sha256: string;
      search_index_directional: boolean;
      search_key_families: string[];
      languages: {
        source_lang: string;
        target_lang: string;
        lexical_language?: string;
        lookup_languages?: string[];
      };
    };
    expect(newManifest.bundle_id).toBe(BUNDLE_ID);
    expect(newManifest.content_sha256).toBe(NEW_HASH);
    expect(newManifest.search_index_directional).toBe(true);
    expect(newManifest.search_key_families).toEqual(["en", "src", "tgt"]);
    expect(newManifest.languages).toEqual({
      source_lang: "fr",
      target_lang: "mnk",
      lexical_language: "mnk",
      lookup_languages: ["fr", "en", "mnk"],
    });

    for (const name of [
      "bundle.manifest.json",
      "records.jsonl",
      "search_index.jsonl",
      "checksums.sha256",
    ] as const) {
      expect(sha256File(join(NEW_DIR, name))).toBe(sha256File(join(CANDIDATE_DIR, name)));
    }

    const oldManifest = JSON.parse(readFileSync(join(OLD_DIR, "bundle.manifest.json"), "utf-8")) as {
      content_sha256: string;
    };
    expect(oldManifest.content_sha256).toBe(OLD_HASH);
    expect(sha256File(join(OLD_DIR, "records.jsonl"))).toBe(
      sha256File(join(NEW_DIR, "records.jsonl")),
    );
  });

  it(
    "featured NEW install: continuity overlays, EN recovery, four-direction search",
    async () => {
      // Full OLD→NEW dual-scope staging of featured payloads is pathological under
      // fake-indexeddb. Browser E2E covers real same-ID update; here we install the
      // published NEW artifact once and prove mixed-history overlays + multilingual search.
      const db = await openSiralexDb();
      try {
        const newEntry = loadFeaturedCatalogEntry();
        const oldInstalledStub = {
          bundle_id: BUNDLE_ID,
          storage_scope_id: OLD_SCOPE,
          expected_content_sha256: OLD_HASH,
          manifest_schema_version: "bundle_manifest_v1",
          record_schema_id: "normalized_v1",
          record_schema_version: "1",
          normalization_ruleset: "norm_v3",
          update_mode: "REPLACE_ALL",
          reconciliation_action: "REPLACE_ALL",
          imported_at_iso: "2026-08-10T11:00:00.000Z",
        } as const;
        expect(compareCatalogEntryToInstalled(newEntry, oldInstalledStub).state).toBe(
          "update_available",
        );

        const frOnlyMeta = {
          lookup_languages: ["fr", "mnk"],
          search_key_families: ["src", "tgt"],
        };
        const storage = memoryStorage();
        writeSearchLookupLangPreference("en", storage);
        expect(restoreForwardLookupModeFromPreference("en", frOnlyMeta)).toEqual({
          from: "fr",
          to: "mnk",
        });
        expect(readSearchLookupLangPreference(storage)).toBe("en");

        await installRemoteCatalogBundle(db, newEntry, "https://example.test/catalog.json", {
          fetchImpl: fileFetchImpl(NEW_DIR),
          activateOnCommit: true,
        });
        expect(await getActiveBundleId(db)).toBe(BUNDLE_ID);
        const newMeta = (await getActiveBundleMeta(db))!;
        expect(newMeta.expected_content_sha256).toBe(NEW_HASH);
        expect(newMeta.storage_scope_id).toBe(NEW_SCOPE);
        expect(bundleSupportsEnglishLookup(newMeta)).toBe(true);
        expect(newMeta.lookup_languages).toEqual(["fr", "en", "mnk"]);
        expect(newMeta.search_key_families).toEqual(["en", "src", "tgt"]);

        const sync = decideLookupModeActiveBundleSync({
          hydrated: true,
          previousBundleId: BUNDLE_ID,
          nextBundleId: BUNDLE_ID,
          previousEnglishAvailable: false,
          nextEnglishAvailable: true,
        });
        expect(sync).toBe("restore_preference_forward");
        expect(
          restoreForwardLookupModeFromPreference(
            readSearchLookupLangPreference(storage),
            newMeta,
          ),
        ).toEqual({ from: "en", to: "mnk" });

        const liveHouse = (await resolveRecords(db, NEW_SCOPE, [HOUSE_IR]))[0];
        expect(isLexiconDisplay(liveHouse!)).toBe(true);
        if (!isLexiconDisplay(liveHouse!)) return;

        // Historical overlays retain OLD provenance under the same logical bundle_id.
        const learning = await saveLearningRecord(db, {
          bundle_id: BUNDLE_ID,
          ir_id: HOUSE_IR,
          ir_kind: "lexicon_entry",
          content_sha256: OLD_HASH,
          storage_scope_id: OLD_SCOPE,
          display_cache: buildDisplayCache(liveHouse),
        });
        expect(learning.bundle_id).toBe(BUNDLE_ID);
        expect(learning.ir_id).toBe(HOUSE_IR);

        const cf1 = await createCorrectionDraft(
          db,
          {
            bundle_id: BUNDLE_ID,
            ir_id: HOUSE_IR,
            ir_kind: "lexicon_entry",
            content_sha256: OLD_HASH,
            storage_scope_id: OLD_SCOPE,
            issue_type: "translation_or_gloss",
            mode: "proposed_correction",
            target: { type: "translation", sense_index: 0, gloss_lang: "fr" },
            display_snapshot: {
              headword_latin: liveHouse.display.headword_latin,
              selected_gloss: liveHouse.display.senses?.[0]?.gloss_fr ?? "maison",
            },
            problem_description: "ML1E historical CF1",
            proposed_value: "maison (test)",
          },
          { now: () => "2026-08-10T12:00:00.000Z", generateDraftId: () => "ml1e-cf1-old" },
        );
        expect(cf1.ok).toBe(true);

        const v1Row = {
          schema_version: SEARCH_FEEDBACK_DRAFT_SCHEMA_VERSION_V1,
          feedback_id: "ml1e-cf2-v1-old",
          bundle_id: BUNDLE_ID,
          content_sha256: OLD_HASH,
          storage_scope_id: OLD_SCOPE,
          query_raw: "maison_ml1e_preupdate",
          search_direction: "source_to_target" as const,
          result_state: "no_result" as const,
          result_count: 0,
          created_at: "2026-08-10T12:00:00.000Z",
          updated_at: "2026-08-10T12:00:00.000Z",
          status: "draft" as const,
        };
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE_SEARCH_FAILURE_FEEDBACK, "readwrite");
          tx.objectStore(STORE_SEARCH_FAILURE_FEEDBACK).put(v1Row);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });

        await appendQueryLogV3(
          db,
          makeQueryLogV3({
            event_id: "ml1e-fr-pre",
            query_raw: "moto",
            storage_scope_id: OLD_SCOPE,
            input_lang: "fr",
            output_lang: "mnk",
            direction: "source_to_target",
            result_count: 2,
            top_ir_ids: ["b5c9a49f6db2a991"],
            matched_key_type: "casefold",
            timestamp_iso: "2026-08-10T12:01:00.000Z",
          }),
        );

        const learningAfter = await getLearningRecord(db, BUNDLE_ID, HOUSE_IR);
        expect(learningAfter).toEqual(learning);
        expect(await listLearningRecordsByBundle(db, BUNDLE_ID)).toHaveLength(1);
        expect((await resolveLearningRecordForUi(db, learningAfter!, newMeta)).state).toBe(
          "resolved",
        );

        const cf1After = await getCorrectionDraft(db, "ml1e-cf1-old");
        expect(cf1After?.content_sha256).toBe(OLD_HASH);
        expect(cf1After?.storage_scope_id).toBe(OLD_SCOPE);
        const manage = createCorrectionManagementSession({
          openDb: async () => db,
          dbOwnership: "caller_owned",
          now: () => "2026-08-10T13:00:00.000Z",
          isCurrent: () => true,
          onModel: () => undefined,
        });
        await manage.load();
        expect(manage.getVm().items[0]?.availability).toBe("dictionary_content_differs");

        const cf2V1 = await getSearchFeedbackDraft(db, "ml1e-cf2-v1-old");
        expect(cf2V1?.schema_version).toBe(SEARCH_FEEDBACK_DRAFT_SCHEMA_VERSION_V1);
        expect(cf2V1?.content_sha256).toBe(OLD_HASH);
        expect(cf2V1?.storage_scope_id).toBe(OLD_SCOPE);

        const cf1New = await createCorrectionDraft(
          db,
          {
            bundle_id: BUNDLE_ID,
            ir_id: HOUSE_IR,
            ir_kind: "lexicon_entry",
            content_sha256: NEW_HASH,
            storage_scope_id: NEW_SCOPE,
            issue_type: "translation_or_gloss",
            mode: "proposed_correction",
            target: { type: "translation", sense_index: 0, gloss_lang: "en" },
            display_snapshot: {
              headword_latin: "bón",
              selected_gloss: "house",
            },
            problem_description: "ML1E post-update CF1",
            proposed_value: "house (test)",
          },
          { now: () => "2026-08-10T13:10:00.000Z", generateDraftId: () => "ml1e-cf1-new" },
        );
        expect(cf1New.ok).toBe(true);
        if (cf1New.ok) {
          expect(cf1New.draft.content_sha256).toBe(NEW_HASH);
          expect(cf1New.draft.storage_scope_id).toBe(NEW_SCOPE);
        }

        const ctx = buildCorrectionEntryContext(liveHouse, newMeta)!;
        const options = buildCorrectionTargetOptions(ctx.entry);
        const langs = new Set(
          options
            .filter((o) => o.target.type === "translation")
            .map((o) => (o.target.type === "translation" ? o.target.gloss_lang : "")),
        );
        expect(langs.has("fr")).toBe(true);
        expect(langs.has("en")).toBe(true);
        expect(langs.has("ru")).toBe(false);

        const sense0 = liveHouse.display.senses?.[0];
        expect(sense0?.gloss_ru).toBeTruthy();
        for (const mode of [
          { from: "en", to: "mnk" },
          { from: "fr", to: "mnk" },
          { from: "mnk", to: "en" },
          { from: "mnk", to: "fr" },
        ] as LookupMode[]) {
          const preferred = mode.from === "mnk" ? mode.to : mode.from;
          const gloss = resolvePreferredGloss({
            glossFr: sense0?.gloss_fr,
            glossEn: sense0?.gloss_en,
            preferred: preferred === "en" ? "en" : "fr",
          });
          expect(gloss.language).toBe(preferred === "en" ? "en" : "fr");
          expect(gloss.text).not.toMatch(/дом/);
        }

        const cf2En = await createSearchFeedbackDraft(
          db,
          {
            bundle_id: BUNDLE_ID,
            content_sha256: NEW_HASH,
            storage_scope_id: NEW_SCOPE,
            query_raw: "house",
            search_direction: "source_to_target",
            input_lang: "en",
            output_lang: "mnk",
            result_state: "results_not_useful",
            result_count: 1,
            matched_ir_ids: [HOUSE_IR],
            user_description: "ML1E EN CF2",
          },
          { now: () => "2026-08-10T13:20:00.000Z", generateFeedbackId: () => "ml1e-cf2-en" },
        );
        if (!cf2En.ok) {
          expect.fail(`cf2En create failed: ${JSON.stringify(cf2En)}`);
        }
        expect(cf2En.draft.schema_version).toBe(SEARCH_FEEDBACK_DRAFT_SCHEMA_VERSION_V2);
        expect(cf2En.draft.content_sha256).toBe(NEW_HASH);
        expect(
          cf2En.draft.schema_version === SEARCH_FEEDBACK_DRAFT_SCHEMA_VERSION_V2
            ? cf2En.draft.input_lang
            : undefined,
        ).toBe("en");
        expect(
          cf2En.draft.schema_version === SEARCH_FEEDBACK_DRAFT_SCHEMA_VERSION_V2
            ? cf2En.draft.output_lang
            : undefined,
        ).toBe("mnk");

        const cf2MnkEn = await createSearchFeedbackDraft(
          db,
          {
            bundle_id: BUNDLE_ID,
            content_sha256: NEW_HASH,
            storage_scope_id: NEW_SCOPE,
            query_raw: "bon",
            search_direction: "target_to_source",
            input_lang: "mnk",
            output_lang: "en",
            result_state: "results_not_useful",
            result_count: 1,
            matched_ir_ids: [HOUSE_IR],
            user_description: "ML1E MNK→EN CF2",
          },
          { now: () => "2026-08-10T13:21:00.000Z", generateFeedbackId: () => "ml1e-cf2-mnk-en" },
        );
        expect(cf2MnkEn.ok).toBe(true);

        await appendQueryLogV3(
          db,
          makeQueryLogV3({
            event_id: "ml1e-en-post",
            query_raw: "house",
            storage_scope_id: NEW_SCOPE,
            input_lang: "en",
            output_lang: "mnk",
            direction: "source_to_target",
            result_count: 1,
            top_ir_ids: [HOUSE_IR],
            matched_key_type: "casefold",
            timestamp_iso: "2026-08-10T13:22:00.000Z",
          }),
        );
        await appendQueryLogV3(
          db,
          makeQueryLogV3({
            event_id: "ml1e-mnk-en-post",
            query_raw: "bon",
            storage_scope_id: NEW_SCOPE,
            input_lang: "mnk",
            output_lang: "en",
            direction: "target_to_source",
            result_count: 1,
            top_ir_ids: [HOUSE_IR],
            matched_key_type: "casefold",
            timestamp_iso: "2026-08-10T13:23:00.000Z",
          }),
        );

        const logs = await listQueryLogs(db, { limit: 20 });
        expect(
          logs.some((r) => isQueryLogEventV3(r) && r.input_lang === "fr" && r.query_raw === "moto"),
        ).toBe(true);
        expect(
          logs.some(
            (r) =>
              isQueryLogEventV3(r) &&
              r.input_lang === "en" &&
              r.output_lang === "mnk" &&
              r.query_raw === "house",
          ),
        ).toBe(true);
        expect(
          logs.some(
            (r) =>
              isQueryLogEventV3(r) &&
              r.input_lang === "mnk" &&
              r.output_lang === "en" &&
              r.query_raw === "bon",
          ),
        ).toBe(true);

        expect(await searchIds(db, NEW_SCOPE, "moto")).toEqual([
          "b5c9a49f6db2a991",
          "0a56b8047aeaf117",
        ]);
        expect(
          await searchLookup(db, NEW_SCOPE, { from: "fr", to: "mnk" }, "maison", EN_CAPABLE),
        ).toContain("4f4808e24076f18b");
        expect(
          await searchLookup(db, NEW_SCOPE, { from: "en", to: "mnk" }, "house", EN_CAPABLE),
        ).toEqual([HOUSE_IR]);
        expect(
          await searchLookup(db, NEW_SCOPE, { from: "mnk", to: "fr" }, "bon", EN_CAPABLE),
        ).toContain(HOUSE_IR);
        expect(
          await searchLookup(db, NEW_SCOPE, { from: "mnk", to: "en" }, "bon", EN_CAPABLE),
        ).toContain(HOUSE_IR);

        expect(await listCorrectionDrafts(db)).toHaveLength(2);
        expect(await listSearchFeedbackDrafts(db)).toHaveLength(3);

        // Bundle-removal retention of Learning/CF across full featured payload deletion is
        // covered by ls1i4/cf1i5/cf2i5 and e2e; fake-indexeddb cannot delete ~147k index
        // rows in bounded time.
        expect(
          compareCatalogEntryToInstalled(newEntry, await getInstalledBundleMeta(db, BUNDLE_ID))
            .state,
        ).toBe("installed_current");
      } finally {
        db.close();
      }
    },
    600_000,
  );

  it("Phase 7L matrix still passes on published multilingual featured artifact", async () => {
    const tempManifestPath = join("/tmp", "ml1e_featured_7l_manifest.json");
    const featured = loadFeaturedCatalogEntry();
    writeFileSync(
      tempManifestPath,
      `${JSON.stringify(
        {
          schema_version: "search_regression_matrix_manifest_v1",
          matrix_schema_version: "search_regression_case_v1",
          bundle_id: BUNDLE_ID,
          catalog_version: featured.version,
          norm_version: "norm_v3",
          search_index_sha256: sha256File(join(NEW_DIR, "search_index.jsonl")),
          bundle_content_sha256: NEW_HASH,
          case_count: 13,
          purpose: "Temporary ML1E featured-publication 7L runtime matrix.",
        },
        null,
        2,
      )}\n`,
      "utf-8",
    );
    const result = await runMatrixRegression({
      matrixPath: MATRIX_PATH,
      manifestPath: tempManifestPath,
      bundleDir: NEW_DIR,
      catalogPath: CATALOG_PATH,
    });
    expect(result.bundle_id).toBe(BUNDLE_ID);
    expect(result.catalog_version).toBe(featured.version);
    expect(result.passed_case_count).toBe(13);
    expect(result.failed_case_count).toBe(0);
  }, 180_000);
});
