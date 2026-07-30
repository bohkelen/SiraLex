// @vitest-environment jsdom
/**
 * LS2I5 — Review lifecycle verification (integration).
 * Browser offline product flow lives in e2e/learning/ls2_offline_review.spec.ts.
 */

import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  STORE_BUNDLES_REGISTRY,
  STORE_LEARNING_RECORDS,
  STORE_QUERY_LOGS,
  STORE_RECORDS,
  STORE_SEARCH_INDEX,
  deleteBundleData,
  deleteSiralexDb,
  openSiralexDb,
  setActiveBundleMeta,
  type ActiveBundleMeta,
} from "../idb/siralex_db";
import { setCurrentLocale } from "../i18n";
import { appendQueryLog } from "../query_logging/query_log_store";
import { renderSavedVocabulary } from "../render/render_saved_vocabulary";
import { buildDisplayCache } from "./build_display_cache";
import {
  getLearningRecord,
  listLearningRecordsByBundle,
  reflectOnLearningRecord,
  saveLearningRecord,
} from "./learning_record_store";
import { LEARNING_RECORD_SCHEMA_VERSION } from "./learning_record_types";
import { buildReviewQueue } from "./review_queue";
import { createReviewSurfaceHost } from "./review_surface_host";
import { deriveSavedVocabularyProgress } from "./saved_vocabulary_progress";
import {
  createSavedVocabularySession,
  type SavedVocabularyModel,
} from "./saved_vocabulary_session";
import type { EnrichedRecord } from "../types/records";

const BUNDLE_A = "bundle_ls2i5_a";
const BUNDLE_B = "bundle_ls2i5_b";
const HASH_1 = "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const HASH_2 = "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const SCOPE_1 = `${BUNDLE_A}::${HASH_1}`;
const SCOPE_2 = `${BUNDLE_A}::${HASH_2}`;
const SCOPE_B = `${BUNDLE_B}::${HASH_1}`;
const TS1 = "2026-07-01T10:00:00.000Z";
const TS2 = "2026-07-02T10:00:00.000Z";
const TS3 = "2026-07-03T10:00:00.000Z";
const TS4 = "2026-07-04T10:00:00.000Z";

function makeMeta(
  bundleId: string,
  scope: string,
  hash: string,
  overrides: Partial<ActiveBundleMeta> = {},
): ActiveBundleMeta {
  return {
    bundle_id: bundleId,
    storage_scope_id: scope,
    expected_content_sha256: hash,
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

function makeLexicon(irId: string, headword: string, gloss: string): EnrichedRecord {
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
      senses: [{ gloss_fr: gloss }],
    },
  };
}

async function countStore(db: IDBDatabase, storeName: string): Promise<number> {
  const tx = db.transaction(storeName, "readonly");
  return await new Promise((resolve, reject) => {
    const req = tx.objectStore(storeName).count();
    req.addEventListener("success", () => resolve(req.result));
    req.addEventListener("error", () => reject(req.error));
  });
}

async function putRecord(db: IDBDatabase, scope: string, record: EnrichedRecord): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_RECORDS, "readwrite");
    tx.objectStore(STORE_RECORDS).put({ ...record, bundle_id: scope });
    tx.addEventListener("complete", () => resolve());
    tx.addEventListener("error", () => reject(tx.error));
    tx.addEventListener("abort", () => reject(tx.error));
  });
}

async function snapshotIsolation(db: IDBDatabase) {
  return {
    records: await countStore(db, STORE_RECORDS),
    search: await countStore(db, STORE_SEARCH_INDEX),
    registry: await countStore(db, STORE_BUNDLES_REGISTRY),
    logs: await countStore(db, STORE_QUERY_LOGS),
    learning: await countStore(db, STORE_LEARNING_RECORDS),
  };
}

async function saveEntry(
  db: IDBDatabase,
  bundleId: string,
  scope: string,
  hash: string,
  entry: EnrichedRecord,
): Promise<void> {
  await putRecord(db, scope, entry);
  await saveLearningRecord(db, {
    bundle_id: bundleId,
    ir_id: entry.ir_id,
    ir_kind: "lexicon_entry",
    content_sha256: hash,
    storage_scope_id: scope,
    display_cache: buildDisplayCache(entry),
  });
}

describe("LS2I5 review lifecycle verification", () => {
  beforeEach(async () => {
    setCurrentLocale("en");
    try {
      await deleteSiralexDb();
    } catch {
      await new Promise((r) => setTimeout(r, 20));
      try {
        await deleteSiralexDb();
      } catch {
        // ignore
      }
    }
  }, 20_000);

  it("orders queue exactly after persistence groups", async () => {
    const db = await openSiralexDb();
    try {
      await setActiveBundleMeta(db, makeMeta(BUNDLE_A, SCOPE_1, HASH_1));
      const specs = [
        { id: "never-old", head: "n1", gloss: "g1", created: "2026-01-01T00:00:00.000Z" },
        { id: "never-new", head: "n2", gloss: "g2", created: "2026-01-02T00:00:00.000Z" },
        { id: "sl-old", head: "s1", gloss: "g3", created: "2026-01-01T00:00:00.000Z" },
        { id: "sl-new", head: "s2", gloss: "g4", created: "2026-01-01T00:00:00.000Z" },
        { id: "rem-old", head: "r1", gloss: "g5", created: "2026-01-01T00:00:00.000Z" },
        { id: "rem-new", head: "r2", gloss: "g6", created: "2026-01-01T00:00:00.000Z" },
      ];
      for (const s of specs) {
        await saveEntry(db, BUNDLE_A, SCOPE_1, HASH_1, makeLexicon(s.id, s.head, s.gloss));
      }
      // Force created_at / review fields via raw put after save (stable fixtures).
      const rows = await listLearningRecordsByBundle(db, BUNDLE_A);
      for (const row of rows) {
        const patch =
          row.ir_id === "never-old"
            ? { created_at: "2026-01-01T00:00:00.000Z", review_count: 0, last_reviewed: null, status: "still_learning" as const }
            : row.ir_id === "never-new"
              ? { created_at: "2026-01-02T00:00:00.000Z", review_count: 0, last_reviewed: null, status: "still_learning" as const }
              : row.ir_id === "sl-old"
                ? {
                    created_at: "2026-01-01T00:00:00.000Z",
                    review_count: 1,
                    last_reviewed: TS1,
                    status: "still_learning" as const,
                  }
                : row.ir_id === "sl-new"
                  ? {
                      created_at: "2026-01-01T00:00:00.000Z",
                      review_count: 1,
                      last_reviewed: TS2,
                      status: "still_learning" as const,
                    }
                  : row.ir_id === "rem-old"
                    ? {
                        created_at: "2026-01-01T00:00:00.000Z",
                        review_count: 1,
                        last_reviewed: TS3,
                        status: "remembered" as const,
                      }
                    : {
                        created_at: "2026-01-01T00:00:00.000Z",
                        review_count: 1,
                        last_reviewed: TS4,
                        status: "remembered" as const,
                      };
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE_LEARNING_RECORDS, "readwrite");
          tx.objectStore(STORE_LEARNING_RECORDS).put({
            ...row,
            schema_version: LEARNING_RECORD_SCHEMA_VERSION,
            ...patch,
          });
          tx.addEventListener("complete", () => resolve());
          tx.addEventListener("error", () => reject(tx.error));
        });
      }

      const before = await snapshotIsolation(db);
      const queue = await buildReviewQueue(db, makeMeta(BUNDLE_A, SCOPE_1, HASH_1));
      expect(queue.state).toBe("ready");
      if (queue.state !== "ready") return;
      expect(queue.items.map((i) => i.identity.ir_id)).toEqual([
        "never-old",
        "never-new",
        "sl-old",
        "sl-new",
        "rem-old",
        "rem-new",
      ]);
      expect(await snapshotIsolation(db)).toEqual(before);
    } finally {
      db.close();
    }
  });

  it("same-status Still learning increments count and updates last_reviewed", async () => {
    const db = await openSiralexDb();
    try {
      await setActiveBundleMeta(db, makeMeta(BUNDLE_A, SCOPE_1, HASH_1));
      await saveEntry(db, BUNDLE_A, SCOPE_1, HASH_1, makeLexicon("x", "x", "xg"));
      await reflectOnLearningRecord(db, BUNDLE_A, "x", "still_learning", TS1);
      const first = await getLearningRecord(db, BUNDLE_A, "x");
      expect(first?.review_count).toBe(1);
      await reflectOnLearningRecord(db, BUNDLE_A, "x", "still_learning", TS2);
      const second = await getLearningRecord(db, BUNDLE_A, "x");
      expect(second?.status).toBe("still_learning");
      expect(second?.review_count).toBe(2);
      expect(second?.last_reviewed).toBe(TS2);
      expect(second?.created_at).toBe(first?.created_at);
      expect(second?.display_cache).toEqual(first?.display_cache);
    } finally {
      db.close();
    }
  });

  it("Remembered can return to Still learning with incremented count", async () => {
    const db = await openSiralexDb();
    try {
      await setActiveBundleMeta(db, makeMeta(BUNDLE_A, SCOPE_1, HASH_1));
      await saveEntry(db, BUNDLE_A, SCOPE_1, HASH_1, makeLexicon("y", "y", "yg"));
      await reflectOnLearningRecord(db, BUNDLE_A, "y", "remembered", TS1);
      await reflectOnLearningRecord(db, BUNDLE_A, "y", "still_learning", TS2);
      const row = await getLearningRecord(db, BUNDLE_A, "y");
      expect(row?.status).toBe("still_learning");
      expect(row?.review_count).toBe(2);
      expect(row?.last_reviewed).toBe(TS2);

      const updates: SavedVocabularyModel[] = [];
      const session = createSavedVocabularySession({
        getActiveMeta: () => makeMeta(BUNDLE_A, SCOPE_1, HASH_1),
        openDb: async () => db,
        isCurrent: () => true,
        onUpdate: (m) => updates.push(m),
        confirmRemove: () => true,
      });
      await session.load();
      const last = updates.at(-1)!;
      expect(last.surface).toBe("populated");
      if (last.surface === "populated") {
        expect(last.rows[0]!.reviewStatus.state).toBe("still_learning");
      }
    } finally {
      db.close();
    }
  });

  it("unresolved rows stay visible, excluded from Review, and re-resolve with status", async () => {
    const db = await openSiralexDb();
    try {
      await setActiveBundleMeta(db, makeMeta(BUNDLE_A, SCOPE_1, HASH_1));
      const entry = makeLexicon("orphan", "orphan", "og");
      await saveEntry(db, BUNDLE_A, SCOPE_1, HASH_1, entry);
      await reflectOnLearningRecord(db, BUNDLE_A, "orphan", "remembered", TS1);

      // Remove live dictionary row only.
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_RECORDS, "readwrite");
        tx.objectStore(STORE_RECORDS).delete([SCOPE_1, "orphan"]);
        tx.addEventListener("complete", () => resolve());
        tx.addEventListener("error", () => reject(tx.error));
      });

      const updates: SavedVocabularyModel[] = [];
      const session = createSavedVocabularySession({
        getActiveMeta: () => makeMeta(BUNDLE_A, SCOPE_1, HASH_1),
        openDb: async () => db,
        isCurrent: () => true,
        onUpdate: (m) => updates.push(m),
        confirmRemove: () => true,
      });
      await session.load();
      const populated = updates.at(-1)!;
      expect(populated.surface).toBe("populated");
      if (populated.surface === "populated") {
        expect(populated.rows[0]!.state).toBe("unresolved");
        expect(populated.canStartReview).toBe(false);
        expect(populated.rows[0]!.reviewStatus.state).toBe("remembered");
      }

      const queue = await buildReviewQueue(db, makeMeta(BUNDLE_A, SCOPE_1, HASH_1));
      expect(queue.state).toBe("empty");
      if (queue.state === "empty") {
        expect(queue.reason).toBe("no_resolved_records");
        expect(queue.unresolved_count).toBe(1);
      }

      // Restore live entry
      await putRecord(db, SCOPE_1, entry);
      await session.load();
      const restored = updates.at(-1)!;
      expect(restored.surface).toBe("populated");
      if (restored.surface === "populated") {
        expect(restored.rows[0]!.state).toBe("resolved");
        expect(restored.rows[0]!.reviewStatus.state).toBe("remembered");
        expect(restored.canStartReview).toBe(true);
      }
      const lr = await getLearningRecord(db, BUNDLE_A, "orphan");
      expect(lr?.review_count).toBe(1);
      expect(lr?.last_reviewed).toBe(TS1);
    } finally {
      db.close();
    }
  });

  it("bundle removal preserves Learning Records; reinstall restores resolution", async () => {
    const db = await openSiralexDb();
    try {
      await setActiveBundleMeta(db, makeMeta(BUNDLE_A, SCOPE_1, HASH_1));
      await saveEntry(db, BUNDLE_A, SCOPE_1, HASH_1, makeLexicon("keep", "keep", "kg"));
      await reflectOnLearningRecord(db, BUNDLE_A, "keep", "still_learning", TS1);
      const before = await getLearningRecord(db, BUNDLE_A, "keep");

      await deleteBundleData(db, BUNDLE_A);
      expect(await countStore(db, STORE_RECORDS)).toBe(0);
      expect(await countStore(db, STORE_LEARNING_RECORDS)).toBe(1);
      const afterRemove = await getLearningRecord(db, BUNDLE_A, "keep");
      expect(afterRemove).toEqual(before);

      await setActiveBundleMeta(db, makeMeta(BUNDLE_A, SCOPE_2, HASH_2));
      await putRecord(db, SCOPE_2, makeLexicon("keep", "keep-v2", "kg2"));
      const queue = await buildReviewQueue(db, makeMeta(BUNDLE_A, SCOPE_2, HASH_2));
      expect(queue.state).toBe("ready");
      if (queue.state === "ready") {
        expect(queue.items[0]!.liveEntry.display).toMatchObject({ headword_latin: "keep-v2" });
        expect(queue.items[0]!.learningRecord.review_count).toBe(1);
        expect(queue.items[0]!.learningRecord.last_reviewed).toBe(TS1);
        expect(queue.items[0]!.learningRecord.display_cache.headword_latin).toBe("keep");
      }
    } finally {
      db.close();
    }
  });

  it("bundle update keeps identity/status; removed ir_id becomes unresolved", async () => {
    const db = await openSiralexDb();
    try {
      await setActiveBundleMeta(db, makeMeta(BUNDLE_A, SCOPE_1, HASH_1));
      await saveEntry(db, BUNDLE_A, SCOPE_1, HASH_1, makeLexicon("stay", "stay", "sg"));
      await saveEntry(db, BUNDLE_A, SCOPE_1, HASH_1, makeLexicon("gone", "gone", "gg"));
      await reflectOnLearningRecord(db, BUNDLE_A, "stay", "remembered", TS1);

      await deleteBundleData(db, BUNDLE_A);
      await setActiveBundleMeta(db, makeMeta(BUNDLE_A, SCOPE_2, HASH_2));
      await putRecord(db, SCOPE_2, makeLexicon("stay", "stay-new", "sg-new"));

      const queue = await buildReviewQueue(db, makeMeta(BUNDLE_A, SCOPE_2, HASH_2));
      expect(queue.state).toBe("ready");
      if (queue.state === "ready") {
        expect(queue.items.map((i) => i.identity.ir_id)).toEqual(["stay"]);
        expect(queue.unresolved_count).toBe(1);
        expect(
          (queue.items[0]!.liveEntry.display as { senses?: { gloss_fr?: string }[] }).senses?.[0]
            ?.gloss_fr,
        ).toBe("sg-new");
        expect(queue.items[0]!.learningRecord.status).toBe("remembered");
      }
      const listed = await listLearningRecordsByBundle(db, BUNDLE_A);
      expect(listed).toHaveLength(2);
    } finally {
      db.close();
    }
  });

  it("active-bundle isolation keeps Review/Saved Vocabulary per bundle", async () => {
    const db = await openSiralexDb();
    try {
      await setActiveBundleMeta(db, makeMeta(BUNDLE_A, SCOPE_1, HASH_1));
      await saveEntry(db, BUNDLE_A, SCOPE_1, HASH_1, makeLexicon("a1", "a1", "ag"));
      await reflectOnLearningRecord(db, BUNDLE_A, "a1", "remembered", TS1);

      await setActiveBundleMeta(db, makeMeta(BUNDLE_B, SCOPE_B, HASH_1));
      await saveEntry(db, BUNDLE_B, SCOPE_B, HASH_1, makeLexicon("b1", "b1", "bg"));

      let queue = await buildReviewQueue(db, makeMeta(BUNDLE_B, SCOPE_B, HASH_1));
      expect(queue.state).toBe("ready");
      if (queue.state === "ready") {
        expect(queue.items.map((i) => i.identity.ir_id)).toEqual(["b1"]);
      }

      queue = await buildReviewQueue(db, makeMeta(BUNDLE_A, SCOPE_1, HASH_1));
      expect(queue.state).toBe("ready");
      if (queue.state === "ready") {
        expect(queue.items.map((i) => i.identity.ir_id)).toEqual(["a1"]);
        expect(queue.items[0]!.learningRecord.status).toBe("remembered");
      }
    } finally {
      db.close();
    }
  });

  it("database deletion removes Learning Records and blocks Review", async () => {
    let db = await openSiralexDb();
    await setActiveBundleMeta(db, makeMeta(BUNDLE_A, SCOPE_1, HASH_1));
    await saveEntry(db, BUNDLE_A, SCOPE_1, HASH_1, makeLexicon("z", "z", "zg"));
    await reflectOnLearningRecord(db, BUNDLE_A, "z", "still_learning", TS1);
    db.close();

    await deleteSiralexDb();
    db = await openSiralexDb();
    try {
      expect(await countStore(db, STORE_LEARNING_RECORDS)).toBe(0);
      const queue = await buildReviewQueue(db, undefined);
      expect(queue).toEqual({ state: "unavailable", reason: "no_active_bundle" });
    } finally {
      db.close();
    }
  });

  it("storage and query-log isolation around Review actions", async () => {
    const db = await openSiralexDb();
    try {
      await setActiveBundleMeta(db, makeMeta(BUNDLE_A, SCOPE_1, HASH_1));
      await saveEntry(db, BUNDLE_A, SCOPE_1, HASH_1, makeLexicon("iso", "iso", "ig"));
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
        bundle_id: BUNDLE_A,
        storage_scope_id: SCOPE_1,
        norm_version: "norm_v3",
        app_version: "t",
        timestamp_iso: TS1,
        logging_enabled: true,
      });
      const before = await snapshotIsolation(db);
      const beforeLr = await getLearningRecord(db, BUNDLE_A, "iso");

      await buildReviewQueue(db, makeMeta(BUNDLE_A, SCOPE_1, HASH_1));
      expect(await snapshotIsolation(db)).toEqual(before);

      await reflectOnLearningRecord(db, BUNDLE_A, "iso", "remembered", TS2);
      const after = await snapshotIsolation(db);
      expect(after.records).toBe(before.records);
      expect(after.search).toBe(before.search);
      expect(after.registry).toBe(before.registry);
      expect(after.logs).toBe(before.logs);
      expect(after.learning).toBe(before.learning);

      const afterLr = await getLearningRecord(db, BUNDLE_A, "iso");
      expect(afterLr?.created_at).toBe(beforeLr?.created_at);
      expect(afterLr?.display_cache).toEqual(beforeLr?.display_cache);
      expect(afterLr?.content_sha256).toBe(beforeLr?.content_sha256);
      expect(afterLr?.status).toBe("remembered");
      expect(afterLr?.review_count).toBe(1);
    } finally {
      db.close();
    }
  });

  it("duplicate Start Review activation yields one active host", async () => {
    const db = await openSiralexDb();
    try {
      await setActiveBundleMeta(db, makeMeta(BUNDLE_A, SCOPE_1, HASH_1));
      await saveEntry(db, BUNDLE_A, SCOPE_1, HASH_1, makeLexicon("d1", "d1", "dg"));
      await saveEntry(db, BUNDLE_A, SCOPE_1, HASH_1, makeLexicon("d2", "d2", "dg2"));

      const mount = document.createElement("div");
      document.body.appendChild(mount);
      let activeHost: ReturnType<typeof createReviewSurfaceHost> | undefined;
      let starts = 0;

      const startReview = () => {
        if (activeHost?.isActive()) return;
        starts += 1;
        activeHost?.dispose();
        const host = createReviewSurfaceHost({
          mount,
          getActiveMeta: () => makeMeta(BUNDLE_A, SCOPE_1, HASH_1),
          openDb: async () => db,
          isHostCurrent: () => activeHost === host,
          onBack: () => undefined,
          now: () => TS1,
        });
        activeHost = host;
        host.start();
      };

      startReview();
      startReview();
      expect(starts).toBe(1);
      await vi.waitFor(() => expect(mount.querySelector(".review-headword")).not.toBeNull());
      expect(mount.querySelectorAll(".review-surface")).toHaveLength(1);
      activeHost?.dispose();
    } finally {
      db.close();
      document.body.innerHTML = "";
    }
  });

  it("busy reflection suppresses duplicate writes; stale host drops redraw", async () => {
    const db = await openSiralexDb();
    try {
      await setActiveBundleMeta(db, makeMeta(BUNDLE_A, SCOPE_1, HASH_1));
      await saveEntry(db, BUNDLE_A, SCOPE_1, HASH_1, makeLexicon("busy", "busy", "bg"));

      const mount = document.createElement("div");
      let release!: () => void;
      const gate = new Promise<void>((r) => {
        release = r;
      });
      const reflect = vi.fn(async (...args: Parameters<typeof reflectOnLearningRecord>) => {
        await gate;
        return reflectOnLearningRecord(...args);
      });
      let current = true;
      const host = createReviewSurfaceHost({
        mount,
        getActiveMeta: () => makeMeta(BUNDLE_A, SCOPE_1, HASH_1),
        openDb: async () => db,
        isHostCurrent: () => current,
        onBack: () => undefined,
        now: () => TS1,
        reflect,
      });
      host.start();
      await vi.waitFor(() => expect(mount.querySelector(".review-reveal")).not.toBeNull());
      mount.querySelector<HTMLButtonElement>(".review-reveal")!.click();
      await vi.waitFor(() => expect(mount.querySelector(".review-still-learning")).not.toBeNull());
      mount.querySelector<HTMLButtonElement>(".review-still-learning")!.click();
      mount.querySelector<HTMLButtonElement>(".review-still-learning")?.click();
      await vi.waitFor(() => expect(mount.querySelector(".review-busy-status")).not.toBeNull());
      expect(reflect).toHaveBeenCalledTimes(1);

      const before = mount.innerHTML;
      current = false;
      release();
      await new Promise((r) => setTimeout(r, 30));
      expect(mount.innerHTML).toBe(before);

      const row = await getLearningRecord(db, BUNDLE_A, "busy");
      expect(row?.review_count).toBe(1);
    } finally {
      db.close();
      document.body.innerHTML = "";
    }
  });

  it("French smoke copy for Start Review and status labels", () => {
    setCurrentLocale("fr");
    const rows = [
      {
        state: "resolved" as const,
        bundle_id: BUNDLE_A,
        ir_id: "f1",
        learningRecord: {
          schema_version: LEARNING_RECORD_SCHEMA_VERSION,
          bundle_id: BUNDLE_A,
          ir_id: "f1",
          ir_kind: "lexicon_entry" as const,
          content_sha256: HASH_1,
          storage_scope_id: SCOPE_1,
          status: "still_learning" as const,
          created_at: TS1,
          display_cache: { headword_latin: "f1" },
          last_reviewed: null,
          review_count: 0,
        },
        liveEntry: makeLexicon("f1", "f1", "fg"),
        primaryText: "f1",
        reviewStatus: { state: "not_reviewed" as const, labelKey: "review.notReviewed" as const },
      },
    ];
    const model: SavedVocabularyModel = {
      surface: "populated",
      rows,
      rowErrors: {},
      progress: deriveSavedVocabularyProgress(rows).progress,
      canStartReview: true,
    };
    const { root } = renderSavedVocabulary(model, {
      onBack: () => undefined,
      onOpen: () => undefined,
      onRemove: () => undefined,
      onStartReview: () => undefined,
    });
    expect(root.textContent).toContain("Commencer la révision");
    expect(root.textContent).toContain("Pas encore révisé");
  });

  it("reflection failure retains revealed card; retry increments once", async () => {
    const db = await openSiralexDb();
    try {
      await setActiveBundleMeta(db, makeMeta(BUNDLE_A, SCOPE_1, HASH_1));
      await saveEntry(db, BUNDLE_A, SCOPE_1, HASH_1, makeLexicon("fail", "fail", "fg"));
      const mount = document.createElement("div");
      let failOnce = true;
      const reflect = vi.fn(async (...args: Parameters<typeof reflectOnLearningRecord>) => {
        if (failOnce) {
          failOnce = false;
          throw new Error("fail");
        }
        return reflectOnLearningRecord(...args);
      });
      const host = createReviewSurfaceHost({
        mount,
        getActiveMeta: () => makeMeta(BUNDLE_A, SCOPE_1, HASH_1),
        openDb: async () => db,
        isHostCurrent: () => true,
        onBack: () => undefined,
        now: () => TS1,
        reflect,
      });
      host.start();
      await vi.waitFor(() => expect(mount.querySelector(".review-reveal")).not.toBeNull());
      mount.querySelector<HTMLButtonElement>(".review-reveal")!.click();
      await vi.waitFor(() => expect(mount.querySelector(".review-remembered")).not.toBeNull());
      mount.querySelector<HTMLButtonElement>(".review-remembered")!.click();
      await vi.waitFor(() => expect(mount.querySelector("#review-card-error")).not.toBeNull());
      expect(mount.querySelector(".review-headword")?.textContent).toBe("fail");
      expect(mount.querySelector("#review-complete-heading")).toBeNull();
      mount.querySelector<HTMLButtonElement>(".review-still-learning")!.click();
      await vi.waitFor(() => expect(mount.querySelector("#review-complete-heading")).not.toBeNull());
      expect(reflect).toHaveBeenCalledTimes(2);
      const row = await getLearningRecord(db, BUNDLE_A, "fail");
      expect(row?.review_count).toBe(1);
    } finally {
      db.close();
      document.body.innerHTML = "";
    }
  });
});
