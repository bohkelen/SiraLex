// @vitest-environment jsdom
/**
 * LS3I4 — Progress lifecycle verification (integration).
 * Browser offline Progress product flow lives in e2e/learning/ls3_progress_return.spec.ts.
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
import { setCurrentLocale, t } from "../i18n";
import { appendQueryLog } from "../query_logging/query_log_store";
import { renderSavedVocabulary } from "../render/render_saved_vocabulary";
import { buildDisplayCache } from "./build_display_cache";
import {
  getLearningRecord,
  listLearningRecordsByBundle,
  reflectOnLearningRecord,
  removeLearningRecord,
  saveLearningRecord,
} from "./learning_record_store";
import { LEARNING_RECORD_SCHEMA_VERSION } from "./learning_record_types";
import { buildReviewQueue } from "./review_queue";
import { createReviewSurfaceHost } from "./review_surface_host";
import {
  deriveSavedVocabularyProgress,
  type SavedVocabularyProgressVm,
} from "./saved_vocabulary_progress";
import {
  createSavedVocabularySession,
  type SavedVocabularyModel,
  type SavedVocabularyRowVm,
} from "./saved_vocabulary_session";
import type { EnrichedRecord } from "../types/records";

const BUNDLE_A = "bundle_ls3i4_a";
const BUNDLE_B = "bundle_ls3i4_b";
const HASH_1 = "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const HASH_2 = "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const SCOPE_1 = `${BUNDLE_A}::${HASH_1}`;
const SCOPE_2 = `${BUNDLE_A}::${HASH_2}`;
const SCOPE_B = `${BUNDLE_B}::${HASH_1}`;
const TS1 = "2026-07-01T10:00:00.000Z";
const TS2 = "2026-07-02T10:00:00.000Z";
const TS3 = "2026-07-03T10:00:00.000Z";

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
    imported_at_iso: "2026-07-30T00:00:00.000Z",
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

async function loadProgress(
  db: IDBDatabase,
  meta: ActiveBundleMeta | undefined,
): Promise<{ model: SavedVocabularyModel; progress?: SavedVocabularyProgressVm }> {
  const updates: SavedVocabularyModel[] = [];
  const session = createSavedVocabularySession({
    openDb: async () => db,
    getActiveMeta: () => meta,
    isCurrent: () => true,
    onUpdate: (m) => updates.push(m),
    confirmRemove: () => true,
  });
  await session.load();
  const model = updates.at(-1)!;
  if (model.surface === "populated" || model.surface === "removing") {
    return { model, progress: model.progress };
  }
  return { model };
}

function renderProgressHtml(model: SavedVocabularyModel): HTMLElement {
  const { root } = renderSavedVocabulary(model, {
    onSearch: () => undefined,
    onOpen: () => undefined,
    onRemove: () => undefined,
    onStartReview: () => undefined,
  });
  return root;
}

beforeEach(async () => {
  setCurrentLocale("en");
  await deleteSiralexDb();
  document.body.innerHTML = "";
});

describe("LS3I4 Progress lifecycle verification", () => {
  it("exact orthogonal counts for mixed resolved/unresolved fixture", async () => {
    const db = await openSiralexDb();
    try {
      await setActiveBundleMeta(db, makeMeta(BUNDLE_A, SCOPE_1, HASH_1));
      await saveEntry(db, BUNDLE_A, SCOPE_1, HASH_1, makeLexicon("nr", "nr", "ng"));
      await saveEntry(db, BUNDLE_A, SCOPE_1, HASH_1, makeLexicon("sl", "sl", "sg"));
      await saveEntry(db, BUNDLE_A, SCOPE_1, HASH_1, makeLexicon("rm", "rm", "rg"));
      await reflectOnLearningRecord(db, BUNDLE_A, "sl", "still_learning", TS1);
      await reflectOnLearningRecord(db, BUNDLE_A, "rm", "remembered", TS2);

      await deleteBundleData(db, BUNDLE_A);
      await setActiveBundleMeta(db, makeMeta(BUNDLE_A, SCOPE_2, HASH_2));
      await putRecord(db, SCOPE_2, makeLexicon("nr", "nr", "ng"));

      const { progress } = await loadProgress(db, makeMeta(BUNDLE_A, SCOPE_2, HASH_2));
      expect(progress).toBeDefined();
      expect(progress!.total_saved).toBe(3);
      expect(progress!.not_reviewed).toBe(1);
      expect(progress!.still_learning).toBe(1);
      expect(progress!.remembered).toBe(1);
      expect(progress!.unavailable).toBe(2);
      expect(progress!.reviewable).toBe(1);
      expect(
        progress!.not_reviewed + progress!.still_learning + progress!.remembered,
      ).toBe(progress!.total_saved);
      expect(progress!.total_saved).not.toBe(
        progress!.not_reviewed +
          progress!.still_learning +
          progress!.remembered +
          progress!.unavailable,
      );

      const rows: SavedVocabularyRowVm[] = [
        {
          state: "resolved",
          bundle_id: BUNDLE_A,
          ir_id: "nr",
          learningRecord: {
            schema_version: LEARNING_RECORD_SCHEMA_VERSION,
            bundle_id: BUNDLE_A,
            ir_id: "nr",
            ir_kind: "lexicon_entry",
            content_sha256: HASH_2,
            storage_scope_id: SCOPE_2,
            status: "still_learning",
            created_at: TS1,
            display_cache: { headword_latin: "nr" },
            last_reviewed: null,
            review_count: 0,
          },
          liveEntry: makeLexicon("nr", "nr", "ng"),
          primaryText: "nr",
          reviewStatus: { state: "not_reviewed", labelKey: "review.notReviewed" },
        },
        {
          state: "unresolved",
          bundle_id: BUNDLE_A,
          ir_id: "sl",
          learningRecord: {
            schema_version: LEARNING_RECORD_SCHEMA_VERSION,
            bundle_id: BUNDLE_A,
            ir_id: "sl",
            ir_kind: "lexicon_entry",
            content_sha256: HASH_1,
            storage_scope_id: SCOPE_1,
            status: "still_learning",
            created_at: TS1,
            display_cache: { headword_latin: "sl" },
            last_reviewed: TS1,
            review_count: 1,
          },
          primaryText: "sl",
          reason: "entry_missing",
          reviewStatus: {
            state: "still_learning",
            labelKey: "review.stillLearning",
            last_reviewed: TS1,
          },
        },
        {
          state: "unresolved",
          bundle_id: BUNDLE_A,
          ir_id: "rm",
          learningRecord: {
            schema_version: LEARNING_RECORD_SCHEMA_VERSION,
            bundle_id: BUNDLE_A,
            ir_id: "rm",
            ir_kind: "lexicon_entry",
            content_sha256: HASH_1,
            storage_scope_id: SCOPE_1,
            status: "remembered",
            created_at: TS1,
            display_cache: { headword_latin: "rm" },
            last_reviewed: TS2,
            review_count: 1,
          },
          primaryText: "rm",
          reason: "entry_missing",
          reviewStatus: {
            state: "remembered",
            labelKey: "review.remembered",
            last_reviewed: TS2,
          },
        },
      ];
      const model: SavedVocabularyModel = {
        surface: "populated",
        rows,
        rowErrors: {},
        progress: deriveSavedVocabularyProgress(rows).progress,
      };
      const root = renderProgressHtml(model);
      expect(root.querySelector('[data-progress-metric="saved"] dd')?.textContent).toBe("3");
      expect(root.querySelector('[data-progress-metric="not_reviewed"] dd')?.textContent).toBe("1");
      expect(root.querySelector('[data-progress-metric="still_learning"] dd')?.textContent).toBe(
        "1",
      );
      expect(root.querySelector('[data-progress-metric="remembered"] dd')?.textContent).toBe("1");
      expect(root.querySelector('[data-progress-metric="unavailable"] dd')?.textContent).toBe("2");
      expect(root.textContent).not.toMatch(/3\s*=\s*1\s*\+\s*1\s*\+\s*1\s*\+\s*2/);
    } finally {
      db.close();
    }
  });

  it("Start → Continue transition after any completed reflection", async () => {
    const db = await openSiralexDb();
    try {
      await setActiveBundleMeta(db, makeMeta(BUNDLE_A, SCOPE_1, HASH_1));
      await saveEntry(db, BUNDLE_A, SCOPE_1, HASH_1, makeLexicon("a", "a", "ag"));
      await saveEntry(db, BUNDLE_A, SCOPE_1, HASH_1, makeLexicon("b", "b", "bg"));

      let { progress } = await loadProgress(db, makeMeta(BUNDLE_A, SCOPE_1, HASH_1));
      expect(progress!.reviewable).toBe(2);
      expect(progress!.still_learning).toBe(0);
      expect(progress!.remembered).toBe(0);
      expect(progress!.reviewAction).toEqual({ state: "enabled", label: "start" });

      await reflectOnLearningRecord(db, BUNDLE_A, "a", "still_learning", TS1);
      ({ progress } = await loadProgress(db, makeMeta(BUNDLE_A, SCOPE_1, HASH_1)));
      expect(progress!.not_reviewed).toBe(1);
      expect(progress!.still_learning).toBe(1);
      expect(progress!.reviewAction).toEqual({ state: "enabled", label: "continue" });
      expect(progress!.returnCue).toBe("review_new");
    } finally {
      db.close();
    }
  });

  it("immediate persistence is reflected in Progress without session completion", async () => {
    const db = await openSiralexDb();
    try {
      await setActiveBundleMeta(db, makeMeta(BUNDLE_A, SCOPE_1, HASH_1));
      await saveEntry(db, BUNDLE_A, SCOPE_1, HASH_1, makeLexicon("a", "a", "ag"));
      await saveEntry(db, BUNDLE_A, SCOPE_1, HASH_1, makeLexicon("b", "b", "bg"));
      await reflectOnLearningRecord(db, BUNDLE_A, "a", "remembered", TS1);

      const { progress } = await loadProgress(db, makeMeta(BUNDLE_A, SCOPE_1, HASH_1));
      expect(progress!.remembered).toBe(1);
      expect(progress!.not_reviewed).toBe(1);
      expect(progress!.reviewAction).toEqual({ state: "enabled", label: "continue" });
      const row = await getLearningRecord(db, BUNDLE_A, "a");
      expect(row?.status).toBe("remembered");
      expect(row?.review_count).toBe(1);
    } finally {
      db.close();
    }
  });

  it("remove resolved decreases Saved/status/reviewable; cancel leaves unchanged", async () => {
    const db = await openSiralexDb();
    try {
      await setActiveBundleMeta(db, makeMeta(BUNDLE_A, SCOPE_1, HASH_1));
      await saveEntry(db, BUNDLE_A, SCOPE_1, HASH_1, makeLexicon("keep", "keep", "kg"));
      await saveEntry(db, BUNDLE_A, SCOPE_1, HASH_1, makeLexicon("drop", "drop", "dg"));
      await reflectOnLearningRecord(db, BUNDLE_A, "drop", "still_learning", TS1);

      const before = (await loadProgress(db, makeMeta(BUNDLE_A, SCOPE_1, HASH_1))).progress!;
      expect(before.total_saved).toBe(2);
      expect(before.still_learning).toBe(1);
      expect(before.reviewable).toBe(2);

      const updates: SavedVocabularyModel[] = [];
      const cancelSession = createSavedVocabularySession({
        openDb: async () => db,
        getActiveMeta: () => makeMeta(BUNDLE_A, SCOPE_1, HASH_1),
        isCurrent: () => true,
        onUpdate: (m) => updates.push(m),
        confirmRemove: () => false,
      });
      await cancelSession.load();
      const cancelResult = await cancelSession.remove(BUNDLE_A, "drop");
      expect(cancelResult).toBe("cancelled");
      expect(await getLearningRecord(db, BUNDLE_A, "drop")).toBeTruthy();
      expect((await loadProgress(db, makeMeta(BUNDLE_A, SCOPE_1, HASH_1))).progress!.total_saved).toBe(
        2,
      );

      await removeLearningRecord(db, BUNDLE_A, "drop");
      const after = (await loadProgress(db, makeMeta(BUNDLE_A, SCOPE_1, HASH_1))).progress!;
      expect(after.total_saved).toBe(1);
      expect(after.still_learning).toBe(0);
      expect(after.not_reviewed).toBe(1);
      expect(after.unavailable).toBe(0);
      expect(after.reviewable).toBe(1);
      expect(after.reviewAction).toEqual({ state: "enabled", label: "start" });
    } finally {
      db.close();
    }
  });

  it("remove unresolved decreases Saved, unavailable, and associated status bucket", async () => {
    const db = await openSiralexDb();
    try {
      await setActiveBundleMeta(db, makeMeta(BUNDLE_A, SCOPE_1, HASH_1));
      await saveEntry(db, BUNDLE_A, SCOPE_1, HASH_1, makeLexicon("live", "live", "lg"));
      await saveEntry(db, BUNDLE_A, SCOPE_1, HASH_1, makeLexicon("gone", "gone", "gg"));
      await reflectOnLearningRecord(db, BUNDLE_A, "gone", "remembered", TS1);
      await deleteBundleData(db, BUNDLE_A);
      await setActiveBundleMeta(db, makeMeta(BUNDLE_A, SCOPE_2, HASH_2));
      await putRecord(db, SCOPE_2, makeLexicon("live", "live", "lg"));

      const before = (await loadProgress(db, makeMeta(BUNDLE_A, SCOPE_2, HASH_2))).progress!;
      expect(before.total_saved).toBe(2);
      expect(before.unavailable).toBe(1);
      expect(before.remembered).toBe(1);
      expect(before.reviewable).toBe(1);

      await removeLearningRecord(db, BUNDLE_A, "gone");
      const after = (await loadProgress(db, makeMeta(BUNDLE_A, SCOPE_2, HASH_2))).progress!;
      expect(after.total_saved).toBe(1);
      expect(after.unavailable).toBe(0);
      expect(after.remembered).toBe(0);
      expect(after.reviewable).toBe(1);
      expect(after.not_reviewed).toBe(1);
    } finally {
      db.close();
    }
  });

  it("removal to empty hides Progress and Review action", async () => {
    const db = await openSiralexDb();
    try {
      await setActiveBundleMeta(db, makeMeta(BUNDLE_A, SCOPE_1, HASH_1));
      await saveEntry(db, BUNDLE_A, SCOPE_1, HASH_1, makeLexicon("only", "only", "og"));

      const updates: SavedVocabularyModel[] = [];
      const session = createSavedVocabularySession({
        openDb: async () => db,
        getActiveMeta: () => makeMeta(BUNDLE_A, SCOPE_1, HASH_1),
        isCurrent: () => true,
        onUpdate: (m) => updates.push(m),
        confirmRemove: () => true,
      });
      await session.load();
      expect(updates.at(-1)?.surface).toBe("populated");
      expect(await session.remove(BUNDLE_A, "only")).toBe("ok");
      expect(updates.at(-1)?.surface).toBe("empty");
      const root = renderProgressHtml(updates.at(-1)!);
      expect(root.querySelector(".saved-vocab-progress")).toBeNull();
      expect(root.querySelector("#saved-vocab-start-review")).toBeNull();
    } finally {
      db.close();
    }
  });

  it("unresolved overlap disables Review when no reviewable rows remain", async () => {
    const db = await openSiralexDb();
    try {
      await setActiveBundleMeta(db, makeMeta(BUNDLE_A, SCOPE_1, HASH_1));
      await saveEntry(db, BUNDLE_A, SCOPE_1, HASH_1, makeLexicon("x", "x", "xg"));
      await reflectOnLearningRecord(db, BUNDLE_A, "x", "still_learning", TS1);
      await deleteBundleData(db, BUNDLE_A);
      await setActiveBundleMeta(db, makeMeta(BUNDLE_A, SCOPE_2, HASH_2));

      const { progress } = await loadProgress(db, makeMeta(BUNDLE_A, SCOPE_2, HASH_2));
      expect(progress!.total_saved).toBe(1);
      expect(progress!.still_learning).toBe(1);
      expect(progress!.unavailable).toBe(1);
      expect(progress!.reviewable).toBe(0);
      expect(progress!.reviewAction).toEqual({
        state: "disabled",
        reason: "no_reviewable_entries",
      });
      expect(progress!.showUnavailable).toBe(true);
    } finally {
      db.close();
    }
  });

  it("bundle removal/reinstall restores reviewability and keeps Continue", async () => {
    const db = await openSiralexDb();
    try {
      await setActiveBundleMeta(db, makeMeta(BUNDLE_A, SCOPE_1, HASH_1));
      await saveEntry(db, BUNDLE_A, SCOPE_1, HASH_1, makeLexicon("keep", "keep", "kg"));
      await reflectOnLearningRecord(db, BUNDLE_A, "keep", "still_learning", TS1);

      await deleteBundleData(db, BUNDLE_A);
      let { progress } = await loadProgress(db, makeMeta(BUNDLE_A, SCOPE_1, HASH_1));
      expect(progress!.total_saved).toBe(1);
      expect(progress!.still_learning).toBe(1);
      expect(progress!.unavailable).toBe(1);
      expect(progress!.reviewable).toBe(0);
      expect(progress!.reviewAction.state).toBe("disabled");
      expect(await countStore(db, STORE_LEARNING_RECORDS)).toBe(1);

      await setActiveBundleMeta(db, makeMeta(BUNDLE_A, SCOPE_2, HASH_2));
      await putRecord(db, SCOPE_2, makeLexicon("keep", "keep-v2", "kg2"));
      ({ progress } = await loadProgress(db, makeMeta(BUNDLE_A, SCOPE_2, HASH_2)));
      expect(progress!.unavailable).toBe(0);
      expect(progress!.reviewable).toBe(1);
      expect(progress!.still_learning).toBe(1);
      expect(progress!.reviewAction).toEqual({ state: "enabled", label: "continue" });
    } finally {
      db.close();
    }
  });

  it("bundle update retains status for kept ir_id; removed ir_id becomes unavailable", async () => {
    const db = await openSiralexDb();
    try {
      await setActiveBundleMeta(db, makeMeta(BUNDLE_A, SCOPE_1, HASH_1));
      await saveEntry(db, BUNDLE_A, SCOPE_1, HASH_1, makeLexicon("stay", "stay", "sg"));
      await saveEntry(db, BUNDLE_A, SCOPE_1, HASH_1, makeLexicon("gone", "gone", "gg"));
      await reflectOnLearningRecord(db, BUNDLE_A, "stay", "remembered", TS1);

      await deleteBundleData(db, BUNDLE_A);
      await setActiveBundleMeta(db, makeMeta(BUNDLE_A, SCOPE_2, HASH_2));
      await putRecord(db, SCOPE_2, makeLexicon("stay", "stay-new", "sg-new"));

      const { progress } = await loadProgress(db, makeMeta(BUNDLE_A, SCOPE_2, HASH_2));
      expect(progress!.total_saved).toBe(2);
      expect(progress!.remembered).toBe(1);
      expect(progress!.not_reviewed).toBe(1);
      expect(progress!.unavailable).toBe(1);
      expect(progress!.reviewable).toBe(1);
      expect(progress!.reviewAction).toEqual({ state: "enabled", label: "continue" });

      const listed = await listLearningRecordsByBundle(db, BUNDLE_A);
      expect(listed).toHaveLength(2);
      expect(listed.find((r) => r.ir_id === "stay")?.status).toBe("remembered");
      const queue = await buildReviewQueue(db, makeMeta(BUNDLE_A, SCOPE_2, HASH_2));
      expect(queue.state).toBe("ready");
      if (queue.state === "ready") {
        expect(queue.items.map((i) => i.identity.ir_id)).toEqual(["stay"]);
      }
    } finally {
      db.close();
    }
  });

  it("active-bundle isolation shows only the active Progress profile", async () => {
    const db = await openSiralexDb();
    try {
      await setActiveBundleMeta(db, makeMeta(BUNDLE_A, SCOPE_1, HASH_1));
      await saveEntry(db, BUNDLE_A, SCOPE_1, HASH_1, makeLexicon("a1", "a1", "ag"));
      await saveEntry(db, BUNDLE_A, SCOPE_1, HASH_1, makeLexicon("a2", "a2", "ag2"));
      await reflectOnLearningRecord(db, BUNDLE_A, "a1", "remembered", TS1);

      await setActiveBundleMeta(db, makeMeta(BUNDLE_B, SCOPE_B, HASH_1));
      await saveEntry(db, BUNDLE_B, SCOPE_B, HASH_1, makeLexicon("b1", "b1", "bg"));

      let { progress } = await loadProgress(db, makeMeta(BUNDLE_B, SCOPE_B, HASH_1));
      expect(progress!.total_saved).toBe(1);
      expect(progress!.not_reviewed).toBe(1);
      expect(progress!.remembered).toBe(0);
      expect(progress!.reviewAction).toEqual({ state: "enabled", label: "start" });

      ({ progress } = await loadProgress(db, makeMeta(BUNDLE_A, SCOPE_1, HASH_1)));
      expect(progress!.total_saved).toBe(2);
      expect(progress!.remembered).toBe(1);
      expect(progress!.not_reviewed).toBe(1);
      expect(progress!.reviewAction).toEqual({ state: "enabled", label: "continue" });
    } finally {
      db.close();
    }
  });

  it("database deletion clears Progress and Learning Records", async () => {
    let db = await openSiralexDb();
    await setActiveBundleMeta(db, makeMeta(BUNDLE_A, SCOPE_1, HASH_1));
    await saveEntry(db, BUNDLE_A, SCOPE_1, HASH_1, makeLexicon("z", "z", "zg"));
    await reflectOnLearningRecord(db, BUNDLE_A, "z", "still_learning", TS1);
    db.close();

    await deleteSiralexDb();
    db = await openSiralexDb();
    try {
      expect(await countStore(db, STORE_LEARNING_RECORDS)).toBe(0);
      const { model } = await loadProgress(db, undefined);
      expect(model.surface === "empty" || model.surface === "unavailable").toBe(true);
      const root = renderProgressHtml(model);
      expect(root.querySelector(".saved-vocab-progress")).toBeNull();
      expect(root.querySelector("#saved-vocab-start-review")).toBeNull();
    } finally {
      db.close();
    }
  });

  it("locale change does not alter Progress numbers or write Learning Records", async () => {
    const db = await openSiralexDb();
    try {
      await setActiveBundleMeta(db, makeMeta(BUNDLE_A, SCOPE_1, HASH_1));
      await saveEntry(db, BUNDLE_A, SCOPE_1, HASH_1, makeLexicon("l1", "l1", "lg"));
      await reflectOnLearningRecord(db, BUNDLE_A, "l1", "still_learning", TS1);
      const beforeSnap = await snapshotIsolation(db);
      const beforeLr = await getLearningRecord(db, BUNDLE_A, "l1");

      setCurrentLocale("en");
      const en = (await loadProgress(db, makeMeta(BUNDLE_A, SCOPE_1, HASH_1))).progress!;
      setCurrentLocale("fr");
      const fr = (await loadProgress(db, makeMeta(BUNDLE_A, SCOPE_1, HASH_1))).progress!;

      expect(fr.total_saved).toBe(en.total_saved);
      expect(fr.not_reviewed).toBe(en.not_reviewed);
      expect(fr.still_learning).toBe(en.still_learning);
      expect(fr.remembered).toBe(en.remembered);
      expect(fr.unavailable).toBe(en.unavailable);
      expect(fr.reviewable).toBe(en.reviewable);
      expect(fr.reviewAction).toEqual(en.reviewAction);

      expect(t("progress.continueReview")).toBe("Continuer la révision");
      setCurrentLocale("en");
      expect(t("progress.continueReview")).toBe("Continue review");

      expect(await snapshotIsolation(db)).toEqual(beforeSnap);
      expect(await getLearningRecord(db, BUNDLE_A, "l1")).toEqual(beforeLr);
    } finally {
      db.close();
    }
  });

  it("storage and query-log isolation around Progress load/render/reflection", async () => {
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

      const { progress } = await loadProgress(db, makeMeta(BUNDLE_A, SCOPE_1, HASH_1));
      expect(progress!.total_saved).toBe(1);
      expect(await snapshotIsolation(db)).toEqual(before);

      const rows: SavedVocabularyRowVm[] = [
        {
          state: "resolved",
          bundle_id: BUNDLE_A,
          ir_id: "iso",
          learningRecord: beforeLr!,
          liveEntry: makeLexicon("iso", "iso", "ig"),
          primaryText: "iso",
          reviewStatus: { state: "not_reviewed", labelKey: "review.notReviewed" },
        },
      ];
      renderProgressHtml({
        surface: "populated",
        rows,
        rowErrors: {},
        progress: deriveSavedVocabularyProgress(rows).progress,
      });
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
      expect(afterLr?.last_reviewed).toBe(TS2);
    } finally {
      db.close();
    }
  });

  it("stale Saved Vocabulary model cannot replace an active Review surface", async () => {
    const db = await openSiralexDb();
    try {
      await setActiveBundleMeta(db, makeMeta(BUNDLE_A, SCOPE_1, HASH_1));
      await saveEntry(db, BUNDLE_A, SCOPE_1, HASH_1, makeLexicon("s1", "s1", "sg"));

      const mount = document.createElement("div");
      document.body.appendChild(mount);
      let hostContext: "saved_vocabulary" | "review" = "saved_vocabulary";
      let reviewHost: ReturnType<typeof createReviewSurfaceHost> | undefined;
      let generation = 0;
      let savedGeneration = 0;

      const paintSaved = (html: string, gen: number) => {
        if (hostContext !== "saved_vocabulary") return;
        if (gen !== generation) return;
        mount.innerHTML = html;
      };

      const showReview = () => {
        if (reviewHost?.isActive()) return;
        hostContext = "review";
        generation += 1;
        reviewHost?.dispose();
        const host = createReviewSurfaceHost({
          mount,
          getActiveMeta: () => makeMeta(BUNDLE_A, SCOPE_1, HASH_1),
          openDb: async () => db,
          isHostCurrent: () => hostContext === "review" && reviewHost === host,
          onBack: () => undefined,
          now: () => TS1,
        });
        reviewHost = host;
        host.start();
      };

      savedGeneration = generation;
      paintSaved('<div class="saved-vocab-progress">stale-progress</div>', savedGeneration);
      showReview();
      await vi.waitFor(() => expect(mount.querySelector(".review-surface")).not.toBeNull());

      paintSaved('<div class="saved-vocab-progress">late-stale</div>', savedGeneration);
      expect(mount.querySelector(".review-surface")).not.toBeNull();
      expect(mount.textContent).not.toContain("late-stale");
      reviewHost?.dispose();
    } finally {
      db.close();
      document.body.innerHTML = "";
    }
  });

  it("duplicate Start/Continue activation yields one Review host and one queue load", async () => {
    const db = await openSiralexDb();
    try {
      await setActiveBundleMeta(db, makeMeta(BUNDLE_A, SCOPE_1, HASH_1));
      await saveEntry(db, BUNDLE_A, SCOPE_1, HASH_1, makeLexicon("d1", "d1", "dg"));
      await saveEntry(db, BUNDLE_A, SCOPE_1, HASH_1, makeLexicon("d2", "d2", "dg2"));

      const mount = document.createElement("div");
      document.body.appendChild(mount);
      let activeHost: ReturnType<typeof createReviewSurfaceHost> | undefined;
      let starts = 0;
      const openDb = vi.fn(async () => db);

      const startReview = () => {
        if (activeHost?.isActive()) return;
        starts += 1;
        activeHost?.dispose();
        const host = createReviewSurfaceHost({
          mount,
          getActiveMeta: () => makeMeta(BUNDLE_A, SCOPE_1, HASH_1),
          openDb,
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
      expect(openDb.mock.calls.length).toBe(1);
      activeHost?.dispose();
    } finally {
      db.close();
      document.body.innerHTML = "";
    }
  });

  it("when all reviewable rows disappear, Review action disables and Progress remains", async () => {
    const db = await openSiralexDb();
    try {
      await setActiveBundleMeta(db, makeMeta(BUNDLE_A, SCOPE_1, HASH_1));
      await saveEntry(db, BUNDLE_A, SCOPE_1, HASH_1, makeLexicon("only", "only", "og"));
      await reflectOnLearningRecord(db, BUNDLE_A, "only", "remembered", TS1);
      await deleteBundleData(db, BUNDLE_A);

      const { progress } = await loadProgress(db, makeMeta(BUNDLE_A, SCOPE_1, HASH_1));
      expect(progress!.total_saved).toBe(1);
      expect(progress!.remembered).toBe(1);
      expect(progress!.reviewable).toBe(0);
      expect(progress!.reviewAction).toEqual({
        state: "disabled",
        reason: "no_reviewable_entries",
      });
      expect(progress!.returnCue).toBe("none");

      const rows: SavedVocabularyRowVm[] = [
        {
          state: "unresolved",
          bundle_id: BUNDLE_A,
          ir_id: "only",
          learningRecord: {
            schema_version: LEARNING_RECORD_SCHEMA_VERSION,
            bundle_id: BUNDLE_A,
            ir_id: "only",
            ir_kind: "lexicon_entry",
            content_sha256: HASH_1,
            storage_scope_id: SCOPE_1,
            status: "remembered",
            created_at: TS1,
            display_cache: { headword_latin: "only" },
            last_reviewed: TS1,
            review_count: 1,
          },
          primaryText: "only",
          reason: "entry_missing",
          reviewStatus: {
            state: "remembered",
            labelKey: "review.remembered",
            last_reviewed: TS1,
          },
        },
      ];
      const root = renderProgressHtml({
        surface: "populated",
        rows,
        rowErrors: {},
        progress: progress!,
      });
      const btn = root.querySelector<HTMLButtonElement>("#saved-vocab-start-review");
      expect(btn).not.toBeNull();
      expect(btn!.disabled).toBe(true);
      expect(root.querySelector(".saved-vocab-progress")).not.toBeNull();
    } finally {
      db.close();
    }
  });

  it("reflection failure leaves Progress counts unchanged until successful write", async () => {
    const db = await openSiralexDb();
    try {
      await setActiveBundleMeta(db, makeMeta(BUNDLE_A, SCOPE_1, HASH_1));
      await saveEntry(db, BUNDLE_A, SCOPE_1, HASH_1, makeLexicon("fail", "fail", "fg"));
      const before = (await loadProgress(db, makeMeta(BUNDLE_A, SCOPE_1, HASH_1))).progress!;

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
        now: () => TS3,
        reflect,
      });
      host.start();
      await vi.waitFor(() => expect(mount.querySelector(".review-reveal")).not.toBeNull());
      mount.querySelector<HTMLButtonElement>(".review-reveal")!.click();
      await vi.waitFor(() => expect(mount.querySelector(".review-remembered")).not.toBeNull());
      mount.querySelector<HTMLButtonElement>(".review-remembered")!.click();
      await vi.waitFor(() => expect(mount.querySelector("#review-card-error")).not.toBeNull());

      const mid = (await loadProgress(db, makeMeta(BUNDLE_A, SCOPE_1, HASH_1))).progress!;
      expect(mid).toEqual(before);

      mount.querySelector<HTMLButtonElement>(".review-still-learning")!.click();
      await vi.waitFor(() => expect(mount.querySelector("#review-complete-heading")).not.toBeNull());
      const after = (await loadProgress(db, makeMeta(BUNDLE_A, SCOPE_1, HASH_1))).progress!;
      expect(after.still_learning).toBe(1);
      expect(after.reviewAction).toEqual({ state: "enabled", label: "continue" });
    } finally {
      db.close();
      document.body.innerHTML = "";
    }
  });
});
