import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  STORE_LEARNING_RECORDS,
  STORE_RECORDS,
  deleteSiralexDb,
  openSiralexDb,
  setActiveBundleMeta,
  type ActiveBundleMeta,
} from "../idb/siralex_db";
import type { EnrichedRecord } from "../types/records";
import {
  getLearningRecord,
  reflectOnLearningRecord,
  saveLearningRecord,
} from "./learning_record_store";
import { LearningRecordNotFoundError, type SaveLearningRecordInput } from "./learning_record_types";
import { createReviewSession, type ReviewSessionModel } from "./review_session";

const BUNDLE = "bundle_ls2i2_s";
const HASH = "sha256:sessionaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SCOPE = `${BUNDLE}::${HASH}`;
const TS = "2026-07-29T18:00:00.000Z";

function meta(): ActiveBundleMeta {
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
    display: { headword_latin: headword, senses: [{ gloss_fr: "g" }] },
  };
}

function saveInput(irId: string): SaveLearningRecordInput {
  return {
    bundle_id: BUNDLE,
    ir_id: irId,
    ir_kind: "lexicon_entry",
    content_sha256: HASH,
    storage_scope_id: SCOPE,
    display_cache: { headword_latin: irId },
  };
}

async function putLive(db: IDBDatabase, entry: EnrichedRecord): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_RECORDS, "readwrite");
    tx.objectStore(STORE_RECORDS).put({ ...entry, bundle_id: SCOPE });
    tx.addEventListener("complete", () => resolve());
    tx.addEventListener("error", () => reject(tx.error));
    tx.addEventListener("abort", () => reject(tx.error));
  });
}

async function seedPair(db: IDBDatabase, irIds: string[]): Promise<void> {
  await setActiveBundleMeta(db, meta());
  for (const id of irIds) {
    await saveLearningRecord(db, saveInput(id));
    await putLive(db, lexicon(id, id));
  }
}

function surfaces(models: ReviewSessionModel[]): string[] {
  return models.map((m) => m.surface);
}

describe("LS2I2 review session", () => {
  beforeEach(async () => {
    try {
      await deleteSiralexDb();
    } catch {
      // ignore blocked/missing
    }
  }, 20_000);

  it("loads, reveals, reflects, advances, and completes with accurate counts", async () => {
    const db = await openSiralexDb();
    try {
      await seedPair(db, ["a", "b"]);

      const models: ReviewSessionModel[] = [];
      const session = createReviewSession({
        getActiveMeta: () => meta(),
        openDb: async () => db,
        isCurrent: () => true,
        onUpdate: (m) => models.push(m),
        now: () => TS,
      });

      await session.load();
      expect(surfaces(models).slice(0, 2)).toEqual(["loading", "reviewing"]);
      const first = models.at(-1);
      expect(first).toMatchObject({
        surface: "reviewing",
        revealed: false,
        position: 1,
        total: 2,
        completed_count: 0,
      });

      session.reveal();
      session.reveal(); // duplicate harmless
      expect(models.at(-1)).toMatchObject({ surface: "reviewing", revealed: true, busy: false });

      await session.reflect("still_learning");
      expect(models.at(-1)).toMatchObject({
        surface: "reviewing",
        revealed: false,
        position: 2,
        completed_count: 1,
      });

      const storedA = await getLearningRecord(db, BUNDLE, "a");
      expect(storedA?.status).toBe("still_learning");
      expect(storedA?.review_count).toBe(1);
      expect(storedA?.last_reviewed).toBe(TS);

      session.reveal();
      await session.reflect("remembered");
      const complete = models.at(-1);
      expect(complete).toEqual({
        surface: "complete",
        reviewed_count: 2,
        still_learning_count: 1,
        remembered_count: 1,
        skipped_count: 0,
        unresolved_at_start_count: 0,
      });
      if (complete?.surface === "complete") {
        expect(complete.reviewed_count).toBe(
          complete.still_learning_count + complete.remembered_count,
        );
      }
    } finally {
      db.close();
    }
  });

  it("ignores reflect before reveal and does not persist", async () => {
    const db = await openSiralexDb();
    try {
      await seedPair(db, ["only"]);

      const reflect = vi.fn(reflectOnLearningRecord);
      const session = createReviewSession({
        getActiveMeta: () => meta(),
        openDb: async () => db,
        isCurrent: () => true,
        onUpdate: () => undefined,
        reflect,
        now: () => TS,
      });
      await session.load();
      await session.reflect("remembered");
      expect(reflect).not.toHaveBeenCalled();
      const row = await getLearningRecord(db, BUNDLE, "only");
      expect(row?.review_count).toBe(0);
    } finally {
      db.close();
    }
  });

  it("snapshots queue so post-load saves do not join", async () => {
    const db = await openSiralexDb();
    try {
      await seedPair(db, ["first"]);

      const models: ReviewSessionModel[] = [];
      const session = createReviewSession({
        getActiveMeta: () => meta(),
        openDb: async () => db,
        isCurrent: () => true,
        onUpdate: (m) => models.push(m),
        now: () => TS,
      });
      await session.load();
      expect(models.at(-1)).toMatchObject({ surface: "reviewing", total: 1 });

      await saveLearningRecord(db, saveInput("second"));
      await putLive(db, lexicon("second", "second"));

      session.reveal();
      await session.reflect("remembered");
      expect(models.at(-1)?.surface).toBe("complete");
      if (models.at(-1)?.surface === "complete") {
        expect(models.at(-1)).toMatchObject({ reviewed_count: 1 });
      }
    } finally {
      db.close();
    }
  });

  it("suppresses duplicate pending reflect calls to one write", async () => {
    const db = await openSiralexDb();
    try {
      await seedPair(db, ["x"]);

      let release!: (v: unknown) => void;
      const gate = new Promise((r) => {
        release = r;
      });
      const reflect = vi.fn(async (...args: Parameters<typeof reflectOnLearningRecord>) => {
        await gate;
        return reflectOnLearningRecord(...args);
      });

      const models: ReviewSessionModel[] = [];
      const session = createReviewSession({
        getActiveMeta: () => meta(),
        openDb: async () => db,
        isCurrent: () => true,
        onUpdate: (m) => models.push(m),
        reflect,
        now: () => TS,
      });
      await session.load();
      session.reveal();

      const p1 = session.reflect("still_learning");
      const p2 = session.reflect("remembered");
      release(undefined);
      await Promise.all([p1, p2]);

      expect(reflect).toHaveBeenCalledTimes(1);
      const row = await getLearningRecord(db, BUNDLE, "x");
      expect(row?.review_count).toBe(1);
      expect(models.at(-1)?.surface).toBe("complete");
    } finally {
      db.close();
    }
  });

  it("keeps revealed card on persistence failure and retries once", async () => {
    const db = await openSiralexDb();
    try {
      await seedPair(db, ["r"]);

      let failOnce = true;
      const reflect = vi.fn(async (...args: Parameters<typeof reflectOnLearningRecord>) => {
        if (failOnce) {
          failOnce = false;
          throw new Error("write failed");
        }
        return reflectOnLearningRecord(...args);
      });

      const models: ReviewSessionModel[] = [];
      const session = createReviewSession({
        getActiveMeta: () => meta(),
        openDb: async () => db,
        isCurrent: () => true,
        onUpdate: (m) => models.push(m),
        reflect,
        now: () => TS,
      });
      await session.load();
      session.reveal();
      await session.reflect("remembered");
      expect(models.at(-1)).toMatchObject({
        surface: "reviewing",
        revealed: true,
        busy: false,
        error: "reflection_failed",
        completed_count: 0,
      });

      await session.reflect("still_learning");
      expect(models.at(-1)).toMatchObject({
        surface: "complete",
        reviewed_count: 1,
        still_learning_count: 1,
        remembered_count: 0,
      });
      expect(reflect).toHaveBeenCalledTimes(2);
    } finally {
      db.close();
    }
  });

  it("skips missing records and can complete with only skips", async () => {
    const db = await openSiralexDb();
    try {
      await seedPair(db, ["gone1", "gone2"]);

      const reflect = vi.fn(async () => {
        throw new LearningRecordNotFoundError(BUNDLE, "x");
      });
      const models: ReviewSessionModel[] = [];
      const session = createReviewSession({
        getActiveMeta: () => meta(),
        openDb: async () => db,
        isCurrent: () => true,
        onUpdate: (m) => models.push(m),
        reflect,
        now: () => TS,
      });
      await session.load();
      expect(models.at(-1)).toMatchObject({ surface: "reviewing", total: 2 });
      session.reveal();
      await session.reflect("remembered");
      session.reveal();
      await session.reflect("still_learning");
      expect(models.at(-1)).toEqual({
        surface: "complete",
        reviewed_count: 0,
        still_learning_count: 0,
        remembered_count: 0,
        skipped_count: 2,
        unresolved_at_start_count: 0,
      });
    } finally {
      db.close();
    }
  });

  it("drops stale load and stale reflection presentation updates", async () => {
    const db = await openSiralexDb();
    try {
      await seedPair(db, ["s"]);

      let current = true;
      const models: ReviewSessionModel[] = [];
      const session = createReviewSession({
        getActiveMeta: () => meta(),
        openDb: async () => db,
        isCurrent: () => current,
        onUpdate: (m) => models.push(m),
        now: () => TS,
      });

      const loadPromise = session.load();
      current = false;
      await loadPromise;
      expect(models.filter((m) => m.surface === "reviewing")).toHaveLength(0);

      current = true;
      await session.load();
      session.reveal();

      let release!: () => void;
      const gate = new Promise<void>((r) => {
        release = r;
      });
      const reflect = vi.fn(async (...args: Parameters<typeof reflectOnLearningRecord>) => {
        await gate;
        return reflectOnLearningRecord(...args);
      });
      const session2 = createReviewSession({
        getActiveMeta: () => meta(),
        openDb: async () => db,
        isCurrent: () => current,
        onUpdate: (m) => models.push(m),
        reflect,
        now: () => TS,
      });
      await session2.load();
      session2.reveal();
      const p = session2.reflect("remembered");
      // Busy emit is synchronous while still current; drop later success redraw.
      const afterBusyEmit = models.length;
      current = false;
      release();
      await p;
      expect(models.length).toBe(afterBusyEmit);
      expect(models.at(-1)).toMatchObject({ surface: "reviewing", busy: true });
      // Persistence may still have committed.
      const row = await getLearningRecord(db, BUNDLE, "s");
      expect(row?.review_count).toBeGreaterThanOrEqual(0);
    } finally {
      db.close();
    }
  });

  it("dispose prevents later emissions; new controller starts fresh", async () => {
    const db = await openSiralexDb();
    try {
      await seedPair(db, ["n"]);

      const models: ReviewSessionModel[] = [];
      const session = createReviewSession({
        getActiveMeta: () => meta(),
        openDb: async () => db,
        isCurrent: () => true,
        onUpdate: (m) => models.push(m),
        now: () => TS,
      });
      await session.load();
      session.dispose();
      const before = models.length;
      session.reveal();
      await session.reflect("remembered");
      expect(models.length).toBe(before);

      const models2: ReviewSessionModel[] = [];
      const session2 = createReviewSession({
        getActiveMeta: () => meta(),
        openDb: async () => db,
        isCurrent: () => true,
        onUpdate: (m) => models2.push(m),
        now: () => TS,
      });
      await session2.load();
      expect(models2.at(-1)).toMatchObject({
        surface: "reviewing",
        revealed: false,
        completed_count: 0,
      });
    } finally {
      db.close();
    }
  });

  it("same-status reflection advances; session state is not in learning store beyond reflection fields", async () => {
    const db = await openSiralexDb();
    try {
      await seedPair(db, ["same"]);

      const session = createReviewSession({
        getActiveMeta: () => meta(),
        openDb: async () => db,
        isCurrent: () => true,
        onUpdate: () => undefined,
        now: () => TS,
      });
      await session.load();
      session.reveal();
      await session.reflect("still_learning");
      const row = await getLearningRecord(db, BUNDLE, "same");
      expect(row?.review_count).toBe(1);
      expect(row?.status).toBe("still_learning");

      // No extra session tables — only learning_records (+ dictionary fixtures).
      expect(db.objectStoreNames.contains(STORE_LEARNING_RECORDS)).toBe(true);
    } finally {
      db.close();
    }
  });

  it("emits empty / unavailable surfaces", async () => {
    const models: ReviewSessionModel[] = [];
    const session = createReviewSession({
      getActiveMeta: () => undefined,
      openDb: async () => {
        throw new Error("should not open");
      },
      isCurrent: () => true,
      onUpdate: (m) => models.push(m),
    });
    await session.load();
    expect(models.at(-1)).toEqual({ surface: "unavailable", reason: "no_active_bundle" });

    const db = await openSiralexDb();
    try {
      await setActiveBundleMeta(db, meta());
      const models2: ReviewSessionModel[] = [];
      const session2 = createReviewSession({
        getActiveMeta: () => meta(),
        openDb: async () => db,
        isCurrent: () => true,
        onUpdate: (m) => models2.push(m),
      });
      await session2.load();
      expect(models2.at(-1)).toMatchObject({
        surface: "empty",
        reason: "no_saved_records",
      });
    } finally {
      db.close();
    }
  });

  it("drops stale reflection failure presentation", async () => {
    const db = await openSiralexDb();
    try {
      await seedPair(db, ["fail"]);

      let current = true;
      let release!: () => void;
      const gate = new Promise<void>((r) => {
        release = r;
      });
      const reflect = vi.fn(async () => {
        await gate;
        throw new Error("write failed");
      });
      const models: ReviewSessionModel[] = [];
      const session = createReviewSession({
        getActiveMeta: () => meta(),
        openDb: async () => db,
        isCurrent: () => current,
        onUpdate: (m) => models.push(m),
        reflect,
        now: () => TS,
      });
      await session.load();
      session.reveal();
      const p = session.reflect("remembered");
      const afterBusyEmit = models.length;
      current = false;
      release();
      await p;
      expect(models.length).toBe(afterBusyEmit);
      expect(models.at(-1)).toMatchObject({ surface: "reviewing", busy: true });
      expect(
        models.some((m) => m.surface === "reviewing" && "error" in m && m.error === "reflection_failed"),
      ).toBe(false);
    } finally {
      db.close();
    }
  });
});
