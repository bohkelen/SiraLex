/**
 * CF2I5 — Executable lifecycle verification beyond isolated unit tests.
 *
 * Covers H1→H2 retention (browser fixture lacks genuine update UI),
 * CF1/Learning/query-log isolation, and dictionary non-mutation on CF2 ops.
 */

import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import {
  STORE_CORRECTION_DRAFTS,
  STORE_LEARNING_RECORDS,
  STORE_QUERY_LOGS,
  STORE_RECORDS,
  STORE_SEARCH_INDEX,
  deleteBundleData,
  deleteSiralexDb,
  openSiralexDb,
  putInstalledBundleMeta,
  type ActiveBundleMeta,
} from "../idb/siralex_db";
import type { EnrichedRecord } from "../types/records";
import { createCorrectionDraft } from "../corrections/correction_draft_store";
import {
  LEARNING_RECORD_SCHEMA_VERSION,
  type LearningRecordV1,
} from "../learning/learning_record_types";
import {
  createSearchFeedbackExport,
} from "./search_feedback_export";
import {
  createSearchFeedbackManagementSession,
} from "./search_feedback_management_session";
import {
  SEARCH_FEEDBACK_AUTHORITY_LABEL,
  parseSearchFeedbackJson,
} from "./search_feedback_package";
import {
  createSearchFeedbackDraft,
  getSearchFeedbackDraft,
  listSearchFeedbackDrafts,
  type CreateSearchFeedbackDraftInput,
} from "./search_feedback_store";

const HASH_H1 =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const HASH_H2 =
  "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const BUNDLE_A = "bundle_a";
const SCOPE_H1 = `${BUNDLE_A}::${HASH_H1}`;
const SCOPE_H2 = `${BUNDLE_A}::${HASH_H2}`;
const TS = "2026-08-02T12:00:00.000Z";
const TS2 = "2026-08-02T13:00:00.000Z";
const EXPORTED_AT = "2026-08-02T14:00:00.000Z";

function meta(overrides: Partial<ActiveBundleMeta> = {}): ActiveBundleMeta {
  return {
    bundle_id: BUNDLE_A,
    storage_scope_id: SCOPE_H1,
    manifest_schema_version: "1",
    record_schema_id: "enriched_record_v1",
    record_schema_version: "1",
    normalization_ruleset: "norm_v3",
    update_mode: "replace",
    reconciliation_action: "none",
    expected_content_sha256: HASH_H1,
    imported_at_iso: TS,
    ...overrides,
  };
}

function input(overrides: Partial<CreateSearchFeedbackDraftInput> = {}): CreateSearchFeedbackDraftInput {
  return {
    bundle_id: BUNDLE_A,
    content_sha256: HASH_H1,
    storage_scope_id: SCOPE_H1,
    query_raw: "zzzz_cf2i5",
    search_direction: "source_to_target",
    result_state: "no_result",
    result_count: 0,
    requested_meaning: "Need greeting\nline2 ߞߎ߲",
    ...overrides,
  };
}

function lexicon(): EnrichedRecord {
  return {
    ir_id: "lex-1",
    ir_kind: "lexicon_entry",
    source_id: "src",
    norm_version: "n",
    preferred_form: "kùn",
    variant_forms: [],
    search_keys: {},
    display: {
      headword_latin: "kùn",
      headword_nko_provided: "ߞߎ߲",
      ps_raw: "n",
      senses: [{ gloss_fr: "tête" }],
    },
  };
}

async function putEntry(db: IDBDatabase, scope: string, entry: EnrichedRecord): Promise<void> {
  const tx = db.transaction(STORE_RECORDS, "readwrite");
  tx.objectStore(STORE_RECORDS).put({ ...entry, bundle_id: scope });
  await new Promise<void>((resolve, reject) => {
    tx.addEventListener("complete", () => resolve());
    tx.addEventListener("error", () => reject(tx.error));
  });
}

async function countStore(db: IDBDatabase, name: string): Promise<number> {
  if (!db.objectStoreNames.contains(name)) return 0;
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

beforeEach(async () => {
  try {
    await deleteSiralexDb();
  } catch {
    // ok
  }
}, 15_000);

describe("CF2I5 lifecycle verification", () => {
  it("bundle removal: retain feedback, unavailable, editable, export keeps H1 provenance", async () => {
    const db = await openSiralexDb();
    await putInstalledBundleMeta(db, meta());
    await putEntry(db, SCOPE_H1, lexicon());
    const created = await createSearchFeedbackDraft(db, input(), {
      now: () => TS,
      generateFeedbackId: () => "cf2i5-remove-1",
    });
    expect(created.ok).toBe(true);

    await deleteBundleData(db, BUNDLE_A);
    const retained = await getSearchFeedbackDraft(db, "cf2i5-remove-1");
    expect(retained?.content_sha256).toBe(HASH_H1);
    expect(retained?.storage_scope_id).toBe(SCOPE_H1);
    expect(retained?.bundle_id).toBe(BUNDLE_A);
    expect(retained?.query_raw).toBe("zzzz_cf2i5");

    const session = createSearchFeedbackManagementSession({
      openDb: async () => db,
      dbOwnership: "caller_owned",
      now: () => TS2,
      isCurrent: () => true,
      onModel: () => undefined,
      getInstalledMeta: async () => undefined,
    });
    await session.load();
    expect(session.getVm().items[0]?.availability).toBe("dictionary_unavailable");
    await session.openDetail("cf2i5-remove-1");
    expect(session.getVm().availability).toBe("dictionary_unavailable");
    session.startEdit();
    session.setEditRequestedMeaning("Edited while unavailable ߞߎ߲");
    await session.saveEdit();
    expect(session.getVm().phase).toBe("detail");
    expect((await getSearchFeedbackDraft(db, "cf2i5-remove-1"))?.content_sha256).toBe(HASH_H1);

    const exported = await createSearchFeedbackExport(db, { exportedAt: EXPORTED_AT });
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    const parsed = parseSearchFeedbackJson(exported.artifact.text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.package.authority_label).toBe(SEARCH_FEEDBACK_AUTHORITY_LABEL);
    expect(parsed.package.feedbacks[0]?.content_sha256).toBe(HASH_H1);
    expect(parsed.package.feedbacks[0]?.requested_meaning).toContain("ߞߎ߲");
    session.dispose();
    db.close();
  });

  it("bundle update H1→H2: retain feedback, content_differs, export still H1, no rewrite", async () => {
    const db = await openSiralexDb();
    await putInstalledBundleMeta(db, meta());
    await putEntry(db, SCOPE_H1, lexicon());
    const created = await createSearchFeedbackDraft(db, input(), {
      now: () => TS,
      generateFeedbackId: () => "cf2i5-update-1",
    });
    expect(created.ok).toBe(true);

    await putInstalledBundleMeta(
      db,
      meta({
        storage_scope_id: SCOPE_H2,
        expected_content_sha256: HASH_H2,
      }),
    );
    await putEntry(db, SCOPE_H2, {
      ...lexicon(),
      display: {
        headword_latin: "kùn",
        headword_nko_provided: "ߞߎ߲",
        ps_raw: "n",
        senses: [{ gloss_fr: "crâne" }],
      },
    });

    const retained = await getSearchFeedbackDraft(db, "cf2i5-update-1");
    expect(retained?.content_sha256).toBe(HASH_H1);
    expect(retained?.storage_scope_id).toBe(SCOPE_H1);
    expect(retained?.result_state).toBe("no_result");
    expect(retained?.requested_meaning).toContain("greeting");

    const h2Meta = meta({
      storage_scope_id: SCOPE_H2,
      expected_content_sha256: HASH_H2,
    });
    const session = createSearchFeedbackManagementSession({
      openDb: async () => db,
      dbOwnership: "caller_owned",
      now: () => TS2,
      isCurrent: () => true,
      onModel: () => undefined,
      getInstalledMeta: async () => h2Meta,
    });
    await session.load();
    expect(session.getVm().items[0]?.availability).toBe("dictionary_content_differs");
    await session.openDetail("cf2i5-update-1");
    expect(session.getVm().availability).toBe("dictionary_content_differs");
    session.startEdit();
    session.setEditRequestedMeaning("Still editable after H2");
    await session.saveEdit();
    const afterEdit = await getSearchFeedbackDraft(db, "cf2i5-update-1");
    expect(afterEdit?.content_sha256).toBe(HASH_H1);
    expect(afterEdit?.storage_scope_id).toBe(SCOPE_H1);
    expect(afterEdit?.requested_meaning).toBe("Still editable after H2");

    const exported = await createSearchFeedbackExport(db, { exportedAt: EXPORTED_AT });
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    const parsed = parseSearchFeedbackJson(exported.artifact.text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.package.feedbacks[0]?.content_sha256).toBe(HASH_H1);
    expect(parsed.package.feedbacks[0]?.storage_scope_id).toBe(SCOPE_H1);
    expect(parsed.package.feedbacks[0]?.status).toBe("draft");
    expect(parsed.package.authority_label).toBe(SEARCH_FEEDBACK_AUTHORITY_LABEL);
    session.dispose();
    db.close();
  });

  it(
    "CF2 mutations isolate CF1, Learning, query logs, and dictionary stores",
    async () => {
    const db = await openSiralexDb();
    await putInstalledBundleMeta(db, meta());
    await putEntry(db, SCOPE_H1, lexicon());

    const cf1 = await createCorrectionDraft(
      db,
      {
        bundle_id: BUNDLE_A,
        ir_id: "lex-1",
        ir_kind: "lexicon_entry",
        content_sha256: HASH_H1,
        storage_scope_id: SCOPE_H1,
        issue_type: "spelling",
        mode: "problem_report",
        target: { type: "headword" },
        display_snapshot: { headword_latin: "kùn", headword_nko: "ߞߎ߲" },
        problem_description: "CF1 seed for isolation",
      },
      { now: () => TS, generateDraftId: () => "cf1-seed-1" },
    );
    expect(cf1.ok).toBe(true);

    const learning: LearningRecordV1 = {
      schema_version: LEARNING_RECORD_SCHEMA_VERSION,
      bundle_id: BUNDLE_A,
      ir_id: "lex-learn",
      ir_kind: "lexicon_entry",
      content_sha256: HASH_H1,
      storage_scope_id: SCOPE_H1,
      status: "still_learning",
      created_at: TS,
      display_cache: { headword_latin: "kùn" },
      last_reviewed: null,
      review_count: 0,
    };
    const lrTx = db.transaction(STORE_LEARNING_RECORDS, "readwrite");
    lrTx.objectStore(STORE_LEARNING_RECORDS).put(learning);
    await new Promise<void>((resolve, reject) => {
      lrTx.addEventListener("complete", () => resolve());
      lrTx.addEventListener("error", () => reject(lrTx.error));
    });

    const qlTx = db.transaction(STORE_QUERY_LOGS, "readwrite");
    qlTx.objectStore(STORE_QUERY_LOGS).put({
      log_id: "ql-1",
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
      bundle_id: BUNDLE_A,
      storage_scope_id: SCOPE_H1,
      norm_version: "norm_v3",
      app_version: "test",
      timestamp_iso: TS,
      logging_enabled: true,
    });
    await new Promise<void>((resolve, reject) => {
      qlTx.addEventListener("complete", () => resolve());
      qlTx.addEventListener("error", () => reject(qlTx.error));
    });

    const before = {
      cf1: await countStore(db, STORE_CORRECTION_DRAFTS),
      learning: await countStore(db, STORE_LEARNING_RECORDS),
      queryLogs: await countStore(db, STORE_QUERY_LOGS),
      records: await countStore(db, STORE_RECORDS),
      searchIndex: await countStore(db, STORE_SEARCH_INDEX),
    };

    const created = await createSearchFeedbackDraft(db, input(), {
      now: () => TS,
      generateFeedbackId: () => "cf2i5-iso-1",
    });
    expect(created.ok).toBe(true);

    const session = createSearchFeedbackManagementSession({
      openDb: async () => db,
      dbOwnership: "caller_owned",
      now: () => TS2,
      isCurrent: () => true,
      onModel: () => undefined,
      getInstalledMeta: async () => meta(),
    });
    await session.load();
    await session.openDetail("cf2i5-iso-1");
    session.startEdit();
    session.setEditRequestedMeaning("isolation edit");
    await session.saveEdit();
    const exported = await createSearchFeedbackExport(db, { exportedAt: EXPORTED_AT });
    expect(exported.ok).toBe(true);
    if (exported.ok) {
      const text = exported.artifact.text;
      expect(text).not.toMatch(/correction_draft|learning_record|query_log|account|device/i);
      expect(parseSearchFeedbackJson(text).ok).toBe(true);
    }
    await session.openDetail("cf2i5-iso-1");
    session.requestDelete();
    await session.confirmDelete();
    expect(await listSearchFeedbackDrafts(db)).toHaveLength(0);

    expect(await countStore(db, STORE_CORRECTION_DRAFTS)).toBe(before.cf1);
    expect(await countStore(db, STORE_LEARNING_RECORDS)).toBe(before.learning);
    expect(await countStore(db, STORE_QUERY_LOGS)).toBe(before.queryLogs);
    expect(await countStore(db, STORE_RECORDS)).toBe(before.records);
    expect(await countStore(db, STORE_SEARCH_INDEX)).toBe(before.searchIndex);
    session.dispose();
    db.close();
  },
    15_000,
  );
});
