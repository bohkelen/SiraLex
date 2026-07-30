import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  STORE_LEARNING_RECORDS,
  STORE_QUERY_LOGS,
  STORE_RECORDS,
  STORE_SEARCH_INDEX,
  deleteSiralexDb,
  openSiralexDb,
  setActiveBundleMeta,
  type ActiveBundleMeta,
} from "../idb/siralex_db";
import { appendQueryLog } from "../query_logging/query_log_store";
import type { EnrichedRecord } from "../types/records";
import { saveLearningRecord } from "./learning_record_store";
import type { LearningRecordV1, SaveLearningRecordInput } from "./learning_record_types";
import { LEARNING_RECORD_SCHEMA_VERSION } from "./learning_record_types";
import {
  buildReviewQueue,
  compareReviewQueueItems,
  hasConsistentReviewFields,
  hasLearningRecordBeenReviewed,
  isNeverReviewed,
  isResolvedLexiconReviewEligible,
  type ReviewQueueItem,
} from "./review_queue";
import { isSavedVocabularyRowReviewable } from "./saved_vocabulary_progress";
import { buildSavedVocabularyRowVm } from "./saved_vocabulary_session";

const BUNDLE = "bundle_ls2i2_q";
const OTHER = "bundle_other";
const HASH = "sha256:queueaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SCOPE = `${BUNDLE}::${HASH}`;
const SCOPE_OTHER = `${OTHER}::${HASH}`;

function meta(overrides: Partial<ActiveBundleMeta> = {}): ActiveBundleMeta {
  return {
    bundle_id: BUNDLE,
    storage_scope_id: SCOPE,
    expected_content_sha256: HASH,
    manifest_schema_version: "bundle_manifest_v1",
    record_schema_id: "normalized_v1",
    record_schema_version: "1",
    normalization_ruleset: "norm_v3",
    update_mode: "REPLACE_ALL",
    reconciliation_action: "REPLACE_ALL",
    imported_at_iso: "2026-07-29T00:00:00.000Z",
    ...overrides,
  };
}

function lexicon(irId: string, headword: string): EnrichedRecord {
  return {
    ir_id: irId,
    ir_kind: "lexicon_entry",
    source_id: "s",
    norm_version: "norm_v3",
    preferred_form: headword,
    variant_forms: [],
    search_keys: {},
    display: {
      headword_latin: headword,
      senses: [{ gloss_fr: `gloss-${headword}` }],
    },
  };
}

function saveInput(irId: string, headword: string): SaveLearningRecordInput {
  return {
    bundle_id: BUNDLE,
    ir_id: irId,
    ir_kind: "lexicon_entry",
    content_sha256: HASH,
    storage_scope_id: SCOPE,
    display_cache: { headword_latin: headword, gloss_short: "cache-only" },
  };
}

async function putLive(db: IDBDatabase, scope: string, entry: EnrichedRecord): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_RECORDS, "readwrite");
    tx.objectStore(STORE_RECORDS).put({ ...entry, bundle_id: scope });
    tx.addEventListener("complete", () => resolve());
    tx.addEventListener("error", () => reject(tx.error));
    tx.addEventListener("abort", () => reject(tx.error));
  });
}

async function putRawLearning(db: IDBDatabase, record: unknown): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_LEARNING_RECORDS, "readwrite");
    tx.objectStore(STORE_LEARNING_RECORDS).put(record);
    tx.addEventListener("complete", () => resolve());
    tx.addEventListener("error", () => reject(tx.error));
    tx.addEventListener("abort", () => reject(tx.error));
  });
}

async function countStore(db: IDBDatabase, name: string): Promise<number> {
  const tx = db.transaction(name, "readonly");
  return await new Promise((resolve, reject) => {
    const req = tx.objectStore(name).count();
    req.addEventListener("success", () => resolve(req.result));
    req.addEventListener("error", () => reject(req.error));
  });
}

function lr(partial: Partial<LearningRecordV1> & Pick<LearningRecordV1, "ir_id" | "created_at">): LearningRecordV1 {
  return {
    schema_version: LEARNING_RECORD_SCHEMA_VERSION,
    bundle_id: BUNDLE,
    ir_kind: "lexicon_entry",
    content_sha256: HASH,
    storage_scope_id: SCOPE,
    status: "still_learning",
    display_cache: { headword_latin: partial.ir_id },
    last_reviewed: null,
    review_count: 0,
    ...partial,
  };
}

function itemFrom(record: LearningRecordV1): ReviewQueueItem {
  return {
    identity: { bundle_id: record.bundle_id, ir_id: record.ir_id },
    learningRecord: record,
    liveEntry: lexicon(record.ir_id, record.display_cache.headword_latin),
  };
}

describe("LS2I2 review queue", () => {
  beforeEach(async () => {
    try {
      await deleteSiralexDb();
    } catch {
      // ignore blocked/missing
    }
  }, 20_000);

  it("derives never-reviewed from count and last_reviewed, not status", () => {
    const never = lr({ ir_id: "a", created_at: "2026-01-01T00:00:00.000Z" });
    expect(isNeverReviewed(never)).toBe(true);
    expect(hasLearningRecordBeenReviewed(never)).toBe(false);

    const reviewed = lr({
      ir_id: "b",
      created_at: "2026-01-01T00:00:00.000Z",
      status: "still_learning",
      review_count: 1,
      last_reviewed: "2026-01-02T00:00:00.000Z",
    });
    expect(hasLearningRecordBeenReviewed(reviewed)).toBe(true);
    expect(isNeverReviewed(reviewed)).toBe(false);

    expect(
      hasConsistentReviewFields(
        lr({
          ir_id: "c",
          created_at: "2026-01-01T00:00:00.000Z",
          review_count: 0,
          last_reviewed: "2026-01-02T00:00:00.000Z",
        }),
      ),
    ).toBe(false);
    expect(
      hasConsistentReviewFields(
        lr({
          ir_id: "d",
          created_at: "2026-01-01T00:00:00.000Z",
          review_count: 2,
          last_reviewed: null,
        }),
      ),
    ).toBe(false);
  });

  it("orders never-reviewed → still_learning → remembered with exact tie-breaks", () => {
    const items = [
      itemFrom(
        lr({
          ir_id: "rem-new",
          created_at: "2026-01-01T00:00:00.000Z",
          status: "remembered",
          review_count: 1,
          last_reviewed: "2026-02-02T00:00:00.000Z",
        }),
      ),
      itemFrom(
        lr({
          ir_id: "never-b",
          created_at: "2026-01-02T00:00:00.000Z",
        }),
      ),
      itemFrom(
        lr({
          ir_id: "sl-old",
          created_at: "2026-01-01T00:00:00.000Z",
          status: "still_learning",
          review_count: 1,
          last_reviewed: "2026-02-01T00:00:00.000Z",
        }),
      ),
      itemFrom(
        lr({
          ir_id: "never-a",
          created_at: "2026-01-01T00:00:00.000Z",
        }),
      ),
      itemFrom(
        lr({
          ir_id: "rem-old",
          created_at: "2026-01-01T00:00:00.000Z",
          status: "remembered",
          review_count: 3,
          last_reviewed: "2026-02-01T00:00:00.000Z",
        }),
      ),
      itemFrom(
        lr({
          ir_id: "sl-new",
          created_at: "2026-01-01T00:00:00.000Z",
          status: "still_learning",
          review_count: 2,
          last_reviewed: "2026-02-03T00:00:00.000Z",
        }),
      ),
    ];

    const sorted = [...items].sort(compareReviewQueueItems);
    expect(sorted.map((i) => i.identity.ir_id)).toEqual([
      "never-a",
      "never-b",
      "sl-old",
      "sl-new",
      "rem-old",
      "rem-new",
    ]);
  });

  it("returns unavailable without active bundle", async () => {
    const db = await openSiralexDb();
    try {
      expect(await buildReviewQueue(db, undefined)).toEqual({
        state: "unavailable",
        reason: "no_active_bundle",
      });
    } finally {
      db.close();
    }
  });

  it("returns empty when no saved records", async () => {
    const db = await openSiralexDb();
    try {
      await setActiveBundleMeta(db, meta());
      expect(await buildReviewQueue(db, meta())).toMatchObject({
        state: "empty",
        reason: "no_saved_records",
        total_saved_count: 0,
        unresolved_count: 0,
      });
    } finally {
      db.close();
    }
  });

  it("excludes unresolved, uses live entry, ignores store order and display cache", async () => {
    const db = await openSiralexDb();
    try {
      await setActiveBundleMeta(db, meta());

      // Save z before a so created_at order is z then a (oldest-first among never-reviewed).
      await saveLearningRecord(db, saveInput("z-never", "zeta"));
      await saveLearningRecord(db, saveInput("a-never", "alpha"));
      await saveLearningRecord(db, saveInput("missing", "ghost"));

      await putLive(db, SCOPE, lexicon("a-never", "alpha-live"));
      await putLive(db, SCOPE, lexicon("z-never", "zeta-live"));
      // Cross-bundle live entry must not resolve active-bundle record.
      await putLive(db, SCOPE_OTHER, lexicon("missing", "other-scope"));

      const beforeLearning = await countStore(db, STORE_LEARNING_RECORDS);
      const beforeRecords = await countStore(db, STORE_RECORDS);

      const result = await buildReviewQueue(db, meta());
      expect(result.state).toBe("ready");
      if (result.state !== "ready") return;

      expect(result.items.map((i) => i.identity.ir_id)).toEqual(["z-never", "a-never"]);
      expect(result.unresolved_count).toBe(1);
      expect(result.total_saved_count).toBe(3);
      expect(result.items[0]!.liveEntry.display).toMatchObject({ headword_latin: "zeta-live" });
      expect(result.items[0]!.learningRecord.display_cache.headword_latin).toBe("zeta");
      expect(result.items[1]!.liveEntry.display).toMatchObject({ headword_latin: "alpha-live" });
      expect(await countStore(db, STORE_LEARNING_RECORDS)).toBe(beforeLearning);
      expect(await countStore(db, STORE_RECORDS)).toBe(beforeRecords);
    } finally {
      db.close();
    }
  });

  it("empty no_resolved when all saved rows fail to resolve", async () => {
    const db = await openSiralexDb();
    try {
      await setActiveBundleMeta(db, meta());
      await saveLearningRecord(db, saveInput("gone", "g"));
      const result = await buildReviewQueue(db, meta());
      expect(result).toMatchObject({
        state: "empty",
        reason: "no_resolved_records",
        total_saved_count: 1,
        unresolved_count: 1,
      });
    } finally {
      db.close();
    }
  });

  it("excludes malformed and inconsistent rows without crashing valid ones", async () => {
    const db = await openSiralexDb();
    try {
      await setActiveBundleMeta(db, meta());
      await saveLearningRecord(db, saveInput("ok", "ok"));
      await putLive(db, SCOPE, lexicon("ok", "ok-live"));

      await putRawLearning(db, {
        schema_version: LEARNING_RECORD_SCHEMA_VERSION,
        bundle_id: BUNDLE,
        ir_id: "bad",
        ir_kind: "lexicon_entry",
        content_sha256: HASH,
        storage_scope_id: SCOPE,
        status: "still_learning",
        created_at: "not-iso",
        display_cache: { headword_latin: "bad" },
        last_reviewed: null,
        review_count: 0,
      });
      await putRawLearning(db, {
        ...lr({
          ir_id: "inconsistent",
          created_at: "2026-01-01T00:00:00.000Z",
          review_count: 0,
          last_reviewed: "2026-01-02T00:00:00.000Z",
        }),
      });
      await putLive(db, SCOPE, lexicon("inconsistent", "x"));

      const result = await buildReviewQueue(db, meta());
      expect(result.state).toBe("ready");
      if (result.state !== "ready") return;
      expect(result.items.map((i) => i.identity.ir_id)).toEqual(["ok"]);
      expect(result.unresolved_count).toBe(2);
    } finally {
      db.close();
    }
  });

  it("does not cross-resolve another active bundle’s records", async () => {
    const db = await openSiralexDb();
    try {
      await setActiveBundleMeta(db, meta());
      await saveLearningRecord(db, {
        ...saveInput("only-a", "a"),
        bundle_id: OTHER,
        storage_scope_id: SCOPE_OTHER,
      });
      await putLive(db, SCOPE, lexicon("only-a", "should-not-use"));
      await putLive(db, SCOPE_OTHER, lexicon("only-a", "other-live"));

      await saveLearningRecord(db, saveInput("in-a", "in-a"));
      await putLive(db, SCOPE, lexicon("in-a", "in-a-live"));

      const result = await buildReviewQueue(db, meta());
      expect(result.state).toBe("ready");
      if (result.state !== "ready") return;
      expect(result.items.map((i) => i.identity.ir_id)).toEqual(["in-a"]);
    } finally {
      db.close();
    }
  });

  it("does not mutate query logs during queue build", async () => {
    const db = await openSiralexDb();
    try {
      await setActiveBundleMeta(db, meta());
      await saveLearningRecord(db, saveInput("x", "x"));
      await putLive(db, SCOPE, lexicon("x", "x"));
      await appendQueryLog(db, {
        query_raw: "q",
        query_normalized_keys: {
          casefold: ["q"],
          diacritics_insensitive: ["q"],
          punct_stripped: ["q"],
          nospace: ["q"],
        },
        direction: "source_to_target",
        ladder_level_hit: "none",
        ir_ids_count: 0,
        bundle_id: BUNDLE,
        storage_scope_id: SCOPE,
        norm_version: "norm_v3",
        app_version: "t",
        timestamp_iso: "2026-07-29T00:00:00.000Z",
        logging_enabled: true,
      });
      const logsBefore = await countStore(db, STORE_QUERY_LOGS);
      const searchBefore = await countStore(db, STORE_SEARCH_INDEX);
      await buildReviewQueue(db, meta());
      expect(await countStore(db, STORE_QUERY_LOGS)).toBe(logsBefore);
      expect(await countStore(db, STORE_SEARCH_INDEX)).toBe(searchBefore);
    } finally {
      db.close();
    }
  });

  it("shared eligibility helper matches queue inclusion for resolved lexicon rows", async () => {
    const db = await openSiralexDb();
    try {
      await setActiveBundleMeta(db, meta());
      await saveLearningRecord(db, saveInput("ok", "ok"));
      await putLive(db, SCOPE, lexicon("ok", "ok"));
      await saveLearningRecord(db, saveInput("missing", "missing"));
      const queue = await buildReviewQueue(db, meta());
      expect(queue.state).toBe("ready");
      if (queue.state !== "ready") return;

      const okLr = queue.items[0]!.learningRecord;
      const okLive = queue.items[0]!.liveEntry;
      expect(isResolvedLexiconReviewEligible(okLr, okLive)).toBe(true);

      const okRow = buildSavedVocabularyRowVm({
        state: "resolved",
        learningRecord: okLr,
        liveEntry: okLive,
      });
      expect(isSavedVocabularyRowReviewable(okRow)).toBe(true);

      const ghost: LearningRecordV1 = {
        schema_version: LEARNING_RECORD_SCHEMA_VERSION,
        bundle_id: BUNDLE,
        ir_id: "missing",
        ir_kind: "lexicon_entry",
        content_sha256: HASH,
        storage_scope_id: SCOPE,
        status: "still_learning",
        created_at: "2026-07-29T00:00:00.000Z",
        display_cache: { headword_latin: "missing" },
        last_reviewed: null,
        review_count: 0,
      };
      const unresolvedRow = buildSavedVocabularyRowVm({
        state: "unresolved",
        learningRecord: ghost,
        reason: "entry_missing",
      });
      expect(isSavedVocabularyRowReviewable(unresolvedRow)).toBe(false);
      expect(queue.items.some((i) => i.identity.ir_id === "missing")).toBe(false);
    } finally {
      db.close();
    }
  });
});
