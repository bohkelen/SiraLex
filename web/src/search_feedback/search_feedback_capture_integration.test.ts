/**
 * CF2I3 focused integration: executed search → capture → save → isolation + stale.
 */
import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  STORE_BUNDLES_REGISTRY,
  STORE_CORRECTION_DRAFTS,
  STORE_LEARNING_RECORDS,
  STORE_META,
  STORE_QUERY_LOGS,
  STORE_RECORDS,
  STORE_SEARCH_FAILURE_FEEDBACK,
  STORE_SEARCH_INDEX,
  deleteSiralexDb,
  openSiralexDb,
  putInstalledBundleMeta,
  setActiveBundleId,
  type ActiveBundleMeta,
} from "../idb/siralex_db";
import { resolveRecords } from "../search/resolve_records";
import { searchQuery } from "../search/search_query";
import { appendQueryLog } from "../query_logging/query_log_store";
import type { EnrichedRecord } from "../types/records";
import { createSearchFeedbackCaptureController } from "./search_feedback_capture_controller";
import {
  buildSearchFeedbackCaptureContext,
  deriveMatchedIrIdsFromRecords,
  type ExecutedSearchSnapshot,
} from "./search_feedback_capture_model";
import {
  countSearchFeedbackDrafts,
  getSearchFeedbackDraft,
  listSearchFeedbackDrafts,
} from "./search_feedback_store";

const HASH =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const HASH_B =
  "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const SCOPE = `bundle_a::${HASH}`;

function meta(overrides: Partial<ActiveBundleMeta> = {}): ActiveBundleMeta {
  return {
    bundle_id: "bundle_a",
    storage_scope_id: SCOPE,
    manifest_schema_version: "1",
    record_schema_id: "enriched_record_v1",
    record_schema_version: "1",
    normalization_ruleset: "norm_v3",
    update_mode: "replace",
    reconciliation_action: "none",
    expected_content_sha256: HASH,
    imported_at_iso: "2026-08-02T18:00:00.000Z",
    ...overrides,
  };
}

function lexicon(irId: string, headword: string): EnrichedRecord {
  return {
    ir_id: irId,
    ir_kind: "lexicon_entry",
    source_id: "src",
    norm_version: "n",
    preferred_form: headword,
    variant_forms: [],
    search_keys: {},
    display: {
      headword_latin: headword,
      ps_raw: "n",
      senses: [{ gloss_fr: "x", gloss_en: "x" }],
    },
  };
}

async function countStore(db: IDBDatabase, name: string): Promise<number> {
  const tx = db.transaction(name, "readonly");
  const count = await new Promise<number>((resolve, reject) => {
    const req = tx.objectStore(name).count();
    req.addEventListener("success", () => resolve(req.result));
    req.addEventListener("error", () => reject(req.error));
  });
  await new Promise<void>((resolve, reject) => {
    tx.addEventListener("complete", () => resolve());
    tx.addEventListener("error", () => reject(tx.error));
  });
  return count;
}

async function snapshot(db: IDBDatabase): Promise<Record<string, number>> {
  const names = [
    STORE_META,
    STORE_RECORDS,
    STORE_SEARCH_INDEX,
    STORE_BUNDLES_REGISTRY,
    STORE_QUERY_LOGS,
    STORE_LEARNING_RECORDS,
    STORE_CORRECTION_DRAFTS,
    STORE_SEARCH_FAILURE_FEEDBACK,
  ];
  const out: Record<string, number> = {};
  for (const name of names) {
    if (db.objectStoreNames.contains(name)) {
      out[name] = await countStore(db, name);
    }
  }
  return out;
}

async function seedHit(db: IDBDatabase): Promise<void> {
  const entry = lexicon("lex-1", "bonjour");
  const tx = db.transaction(
    [STORE_RECORDS, STORE_SEARCH_INDEX, STORE_QUERY_LOGS],
    "readwrite",
  );
  tx.objectStore(STORE_RECORDS).put({ ...entry, bundle_id: SCOPE });
  tx.objectStore(STORE_SEARCH_INDEX).put({
    bundle_id: SCOPE,
    key_type: "src_casefold",
    key: "bonjour",
    ir_ids: ["lex-1"],
  });
  tx.objectStore(STORE_QUERY_LOGS).put({
    schema_version: "query_log_event_v1",
    query_raw: "seed",
    query_normalized_keys: {
      casefold: ["seed"],
      diacritics_insensitive: ["seed"],
      punct_stripped: ["seed"],
      nospace: ["seed"],
    },
    direction: "source_to_target",
    ladder_level_hit: "casefold",
    ir_ids_count: 0,
    bundle_id: "bundle_a",
    storage_scope_id: SCOPE,
    norm_version: "norm_v3",
    app_version: "test",
    timestamp_iso: "2026-08-02T18:00:00.000Z",
    logging_enabled: true,
  });
  await new Promise<void>((resolve, reject) => {
    tx.addEventListener("complete", () => resolve());
    tx.addEventListener("error", () => reject(tx.error));
  });
}

function buildSnapshotFromSearch(args: {
  generation: number;
  query_raw: string;
  direction: "source_to_target" | "target_to_source";
  result_count: number;
  records: EnrichedRecord[];
  active: ActiveBundleMeta;
}): ExecutedSearchSnapshot {
  const contentSha = args.active.expected_content_sha256;
  const scopeId = args.active.storage_scope_id;
  if (!contentSha || !scopeId) {
    throw new Error("test active meta missing provenance");
  }
  if (args.result_count === 0) {
    return {
      generation: args.generation,
      query_raw: args.query_raw,
      search_direction: args.direction,
      result_state: "no_result",
      result_count: 0,
      bundle_id: args.active.bundle_id,
      content_sha256: contentSha,
      storage_scope_id: scopeId,
    };
  }
  const matched = deriveMatchedIrIdsFromRecords(args.records);
  return {
    generation: args.generation,
    query_raw: args.query_raw,
    search_direction: args.direction,
    result_state: "results_not_useful",
    result_count: args.result_count,
    ...(matched !== undefined ? { matched_ir_ids: matched } : {}),
    bundle_id: args.active.bundle_id,
    content_sha256: contentSha,
    storage_scope_id: scopeId,
  };
}

beforeEach(async () => {
  try {
    await deleteSiralexDb();
  } catch {
    // ok
  }
});

describe("CF2I3 search feedback capture integration", () => {
  it("no_result path: genuine miss → save → isolation + IDs absent", async () => {
    const active = meta();
    const db = await openSiralexDb();
    await putInstalledBundleMeta(db, active);
    await setActiveBundleId(db, active.bundle_id);
    await seedHit(db);

    const query_raw = "  missing-xyzzy  ";
    const result = await searchQuery(
      db,
      SCOPE,
      "source_to_target",
      query_raw,
      true,
    );
    expect(result.ir_ids).toEqual([]);

    const snap = buildSnapshotFromSearch({
      generation: 1,
      query_raw,
      direction: "source_to_target",
      result_count: 0,
      records: [],
      active,
    });
    const context = buildSearchFeedbackCaptureContext(snap)!;
    const before = await snapshot(db);
    const appendSpy = vi.spyOn(
      await import("../query_logging/query_log_store"),
      "appendQueryLog",
    );

    let lastState = "";
    const controller = createSearchFeedbackCaptureController({
      context,
      openDb: async () => db,
      dbOwnership: "caller_owned",
      getActiveMeta: () => active,
      getCurrentExecutedSearch: () => snap,
      isCurrent: () => true,
      onModel: (vm) => {
        lastState = vm.state;
      },
      onCancel: () => undefined,
      onBackToSearch: () => undefined,
    });
    await controller.save();
    expect(lastState).toBe("saved");
    expect(appendSpy).not.toHaveBeenCalled();

    const after = await snapshot(db);
    for (const key of Object.keys(before)) {
      if (key === STORE_SEARCH_FAILURE_FEEDBACK) {
        expect(after[key]).toBe((before[key] ?? 0) + 1);
      } else {
        expect(after[key]).toBe(before[key]);
      }
    }

    const drafts = await listSearchFeedbackDrafts(db);
    expect(drafts).toHaveLength(1);
    expect(drafts[0]!.query_raw).toBe(query_raw);
    expect(drafts[0]!.result_state).toBe("no_result");
    expect(drafts[0]!.result_count).toBe(0);
    expect("matched_ir_ids" in drafts[0]!).toBe(false);
    appendSpy.mockRestore();
    db.close();
  });

  it("results_not_useful path: hit → exact count + matched IDs policy", async () => {
    const active = meta();
    const db = await openSiralexDb();
    await putInstalledBundleMeta(db, active);
    await setActiveBundleId(db, active.bundle_id);
    await seedHit(db);

    const query_raw = "bonjour";
    const result = await searchQuery(
      db,
      SCOPE,
      "source_to_target",
      query_raw,
      true,
    );
    expect(result.ir_ids.length).toBeGreaterThan(0);
    const records = await resolveRecords(db, SCOPE, result.ir_ids);
    expect(records.length).toBe(result.ir_ids.length);

    const snap = buildSnapshotFromSearch({
      generation: 2,
      query_raw,
      direction: "source_to_target",
      result_count: records.length,
      records,
      active,
    });
    const context = buildSearchFeedbackCaptureContext(snap)!;
    const before = await snapshot(db);

    const controller = createSearchFeedbackCaptureController({
      context,
      openDb: async () => db,
      dbOwnership: "caller_owned",
      getActiveMeta: () => active,
      getCurrentExecutedSearch: () => snap,
      isCurrent: () => true,
      onModel: () => undefined,
      onCancel: () => undefined,
      onBackToSearch: () => undefined,
    });
    await controller.save();

    const after = await snapshot(db);
    expect(after[STORE_SEARCH_FAILURE_FEEDBACK]).toBe(
      (before[STORE_SEARCH_FAILURE_FEEDBACK] ?? 0) + 1,
    );
    expect(after[STORE_QUERY_LOGS]).toBe(before[STORE_QUERY_LOGS]);
    expect(after[STORE_CORRECTION_DRAFTS]).toBe(before[STORE_CORRECTION_DRAFTS]);
    expect(after[STORE_LEARNING_RECORDS]).toBe(before[STORE_LEARNING_RECORDS]);

    const drafts = await listSearchFeedbackDrafts(db);
    expect(drafts[0]!.result_state).toBe("results_not_useful");
    expect(drafts[0]!.result_count).toBe(records.length);
    expect(drafts[0]!.matched_ir_ids).toEqual(
      deriveMatchedIrIdsFromRecords(records),
    );
    expect(drafts[0]!.search_direction).toBe("source_to_target");
    expect(drafts[0]!.query_raw).toBe(query_raw);
    db.close();
  });

  it("stale query / generation / bundle lifecycle blocks Save with 0 new feedback", async () => {
    const active = meta();
    const db = await openSiralexDb();
    await putInstalledBundleMeta(db, active);
    await setActiveBundleId(db, active.bundle_id);

    let snap = buildSnapshotFromSearch({
      generation: 5,
      query_raw: "alpha",
      direction: "source_to_target",
      result_count: 0,
      records: [],
      active,
    });
    const context = buildSearchFeedbackCaptureContext(snap)!;
    const createSpy = vi.fn();

    const controller = createSearchFeedbackCaptureController({
      context,
      openDb: async () => db,
      dbOwnership: "caller_owned",
      getActiveMeta: () => active,
      getCurrentExecutedSearch: () => snap,
      isCurrent: () => true,
      onModel: () => undefined,
      onCancel: () => undefined,
      onBackToSearch: () => undefined,
      createDraft: createSpy,
    });

    snap = { ...snap, generation: 6, query_raw: "beta" };
    controller.notifySearchChanged();
    await controller.save();
    expect(controller.getViewModel().state).toBe("stale_context");
    expect(createSpy).not.toHaveBeenCalled();
    expect(await countSearchFeedbackDrafts(db)).toBe(0);

    let currentMeta: ActiveBundleMeta | undefined = active;
    const snap2 = buildSnapshotFromSearch({
      generation: 1,
      query_raw: "gamma",
      direction: "source_to_target",
      result_count: 0,
      records: [],
      active,
    });
    const c2 = createSearchFeedbackCaptureController({
      context: buildSearchFeedbackCaptureContext(snap2)!,
      openDb: async () => db,
      dbOwnership: "caller_owned",
      getActiveMeta: () => currentMeta,
      getCurrentExecutedSearch: () => snap2,
      isCurrent: () => true,
      onModel: () => undefined,
      onCancel: () => undefined,
      onBackToSearch: () => undefined,
      createDraft: createSpy,
    });
    currentMeta = undefined;
    c2.notifyBundleLifecycleChanged();
    await c2.save();
    expect(c2.getViewModel().state).toBe("stale_context");
    expect(await countSearchFeedbackDrafts(db)).toBe(0);

    currentMeta = meta({
      expected_content_sha256: HASH_B,
      storage_scope_id: `bundle_a::${HASH_B}`,
    });
    const c3 = createSearchFeedbackCaptureController({
      context: buildSearchFeedbackCaptureContext(snap2)!,
      openDb: async () => db,
      dbOwnership: "caller_owned",
      getActiveMeta: () => currentMeta,
      getCurrentExecutedSearch: () => snap2,
      isCurrent: () => true,
      onModel: () => undefined,
      onCancel: () => undefined,
      onBackToSearch: () => undefined,
      createDraft: createSpy,
    });
    await c3.save();
    expect(c3.getViewModel().state).toBe("stale_context");
    expect(createSpy).not.toHaveBeenCalled();
    db.close();
  });

  it("CF2 save does not append query logs (logging-independent)", async () => {
    const active = meta();
    const db = await openSiralexDb();
    await putInstalledBundleMeta(db, active);
    await setActiveBundleId(db, active.bundle_id);

    // Simulate that a prior consented search may have logged — CF2 must not add more.
    await appendQueryLog(db, {
      query_raw: "prior",
      query_normalized_keys: {
        casefold: ["prior"],
        diacritics_insensitive: ["prior"],
        punct_stripped: ["prior"],
        nospace: ["prior"],
      },
      direction: "source_to_target",
      ladder_level_hit: "casefold",
      ir_ids_count: 0,
      bundle_id: active.bundle_id,
      storage_scope_id: SCOPE,
      norm_version: "norm_v3",
      app_version: "test",
      timestamp_iso: "2026-08-02T18:00:00.000Z",
      logging_enabled: true,
    });

    const logsBefore = await countStore(db, STORE_QUERY_LOGS);
    const snap = buildSnapshotFromSearch({
      generation: 1,
      query_raw: "report-me",
      direction: "source_to_target",
      result_count: 0,
      records: [],
      active,
    });
    const controller = createSearchFeedbackCaptureController({
      context: buildSearchFeedbackCaptureContext(snap)!,
      openDb: async () => db,
      dbOwnership: "caller_owned",
      getActiveMeta: () => active,
      getCurrentExecutedSearch: () => snap,
      isCurrent: () => true,
      onModel: () => undefined,
      onCancel: () => undefined,
      onBackToSearch: () => undefined,
    });
    await controller.save();
    expect(await countStore(db, STORE_QUERY_LOGS)).toBe(logsBefore);
    const draft = (await listSearchFeedbackDrafts(db))[0]!;
    const stored = await getSearchFeedbackDraft(db, draft.feedback_id);
    expect(stored?.query_raw).toBe("report-me");
    db.close();
  });
});
