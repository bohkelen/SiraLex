import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  deleteSiralexDb,
  openSiralexDb,
  type ActiveBundleMeta,
} from "../idb/siralex_db";
import { buildDisplayCache } from "./build_display_cache";
import { saveLearningRecord } from "./learning_record_store";
import {
  buildSavedVocabularyRowVm,
  createSavedVocabularySession,
  type SavedVocabularyModel,
} from "./saved_vocabulary_session";
import type { EnrichedRecord } from "../types/records";
import { STORE_RECORDS } from "../idb/siralex_db";

const BUNDLE_A = "bundle_sv_a";
const BUNDLE_B = "bundle_sv_b";
const SCOPE_A = `${BUNDLE_A}::sha256:aaa`;
const HASH_A = "sha256:aaa";

function makeMeta(overrides: Partial<ActiveBundleMeta> = {}): ActiveBundleMeta {
  return {
    bundle_id: BUNDLE_A,
    storage_scope_id: SCOPE_A,
    expected_content_sha256: HASH_A,
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

function makeLexicon(irId: string, headword: string): EnrichedRecord {
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
      senses: [{ gloss_fr: `${headword}-fr` }],
    },
  };
}

async function putDictionaryRecord(
  db: IDBDatabase,
  storageScopeId: string,
  record: EnrichedRecord,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_RECORDS, "readwrite");
    tx.objectStore(STORE_RECORDS).put({ ...record, bundle_id: storageScopeId });
    tx.addEventListener("complete", () => resolve());
    tx.addEventListener("error", () => reject(tx.error));
    tx.addEventListener("abort", () => reject(tx.error));
  });
}

describe("LS1I3 Saved Vocabulary session", () => {
  beforeEach(async () => {
    try {
      await deleteSiralexDb();
    } catch {
      // fine
    }
  });

  it("lists only active-bundle records in store order and resolves live content", async () => {
    const db = await openSiralexDb();
    const older = makeLexicon("lex-old", "older");
    const newer = makeLexicon("lex-new", "newer");
    await putDictionaryRecord(db, SCOPE_A, older);
    await putDictionaryRecord(db, SCOPE_A, newer);

    await saveLearningRecord(db, {
      bundle_id: BUNDLE_A,
      ir_id: "lex-old",
      ir_kind: "lexicon_entry",
      content_sha256: HASH_A,
      storage_scope_id: SCOPE_A,
      display_cache: buildDisplayCache(older),
    });
    await new Promise((r) => setTimeout(r, 5));
    await saveLearningRecord(db, {
      bundle_id: BUNDLE_A,
      ir_id: "lex-new",
      ir_kind: "lexicon_entry",
      content_sha256: HASH_A,
      storage_scope_id: SCOPE_A,
      display_cache: buildDisplayCache(newer),
    });
    await saveLearningRecord(db, {
      bundle_id: BUNDLE_B,
      ir_id: "lex-other",
      ir_kind: "lexicon_entry",
      content_sha256: "sha256:b",
      storage_scope_id: `${BUNDLE_B}::sha256:b`,
      display_cache: { headword_latin: "other" },
    });

    const updates: SavedVocabularyModel[] = [];
    const session = createSavedVocabularySession({
      getActiveMeta: () => makeMeta(),
      openDb: async () => db,
      isCurrent: () => true,
      onUpdate: (m) => updates.push(m),
      confirmRemove: () => true,
    });
    await session.load();
    const last = updates.at(-1)!;
    expect(last.surface).toBe("populated");
    if (last.surface === "populated" || last.surface === "removing") {
      expect(last.rows.map((r) => r.ir_id)).toEqual(["lex-new", "lex-old"]);
      expect(last.rows.every((r) => r.state === "resolved")).toBe(true);
      expect(last.rows[0]!.primaryText).toBe("newer");
      expect(last.rows.some((r) => r.bundle_id === BUNDLE_B)).toBe(false);
    }
    db.close();
  });

  it("keeps unresolved soft orphans and does not call list without active bundle", async () => {
    const db = await openSiralexDb();
    await saveLearningRecord(db, {
      bundle_id: BUNDLE_A,
      ir_id: "missing",
      ir_kind: "lexicon_entry",
      content_sha256: HASH_A,
      storage_scope_id: SCOPE_A,
      display_cache: { headword_latin: "ghost", gloss_short: "cache" },
    });

    const updates: SavedVocabularyModel[] = [];
    const session = createSavedVocabularySession({
      getActiveMeta: () => makeMeta(),
      openDb: async () => db,
      isCurrent: () => true,
      onUpdate: (m) => updates.push(m),
      confirmRemove: () => true,
    });
    await session.load();
    const last = updates.at(-1)!;
    expect(last.surface).toBe("populated");
    if (last.surface === "populated" || last.surface === "removing") {
      expect(last.rows[0]!.state).toBe("unresolved");
      if (last.rows[0]!.state === "unresolved") {
        expect(last.rows[0]!.primaryText).toBe("ghost");
        expect(last.rows[0]!.reason).toBe("entry_missing");
      }
    }

    const noBundleUpdates: SavedVocabularyModel[] = [];
    let listed = false;
    const noBundle = createSavedVocabularySession({
      getActiveMeta: () => undefined,
      openDb: async () => {
        listed = true;
        return db;
      },
      isCurrent: () => true,
      onUpdate: (m) => noBundleUpdates.push(m),
      confirmRemove: () => true,
    });
    await noBundle.load();
    expect(listed).toBe(false);
    expect(noBundleUpdates.at(-1)?.surface).toBe("unavailable");
    db.close();
  });

  it("remove cancel / confirm / failure / absent / stale-drop", async () => {
    const db = await openSiralexDb();
    const entry = makeLexicon("lex-1", "word");
    await putDictionaryRecord(db, SCOPE_A, entry);
    await saveLearningRecord(db, {
      bundle_id: BUNDLE_A,
      ir_id: "lex-1",
      ir_kind: "lexicon_entry",
      content_sha256: HASH_A,
      storage_scope_id: SCOPE_A,
      display_cache: buildDisplayCache(entry),
    });

    let confirm = false;
    const updates: SavedVocabularyModel[] = [];
    let current = true;
    const session = createSavedVocabularySession({
      getActiveMeta: () => makeMeta(),
      openDb: async () => db,
      isCurrent: () => current,
      onUpdate: (m) => updates.push(m),
      confirmRemove: () => confirm,
    });
    await session.load();

    expect(await session.remove(BUNDLE_A, "lex-1")).toBe("cancelled");
    expect(session.getRows().length).toBe(1);

    confirm = true;
    expect(await session.remove(BUNDLE_A, "lex-1")).toBe("ok");
    expect(session.getRows().length).toBe(0);
    expect(updates.at(-1)?.surface).toBe("empty");

    // Already absent behaves as success when somehow still in memory — re-save and remove via API first
    await saveLearningRecord(db, {
      bundle_id: BUNDLE_A,
      ir_id: "lex-1",
      ir_kind: "lexicon_entry",
      content_sha256: HASH_A,
      storage_scope_id: SCOPE_A,
      display_cache: buildDisplayCache(entry),
    });
    await session.load();
    // Delete underneath then remove again
    const { removeLearningRecord } = await import("./learning_record_store");
    await removeLearningRecord(db, BUNDLE_A, "lex-1");
    expect(await session.remove(BUNDLE_A, "lex-1")).toBe("ok");

    await saveLearningRecord(db, {
      bundle_id: BUNDLE_A,
      ir_id: "lex-2",
      ir_kind: "lexicon_entry",
      content_sha256: HASH_A,
      storage_scope_id: SCOPE_A,
      display_cache: { headword_latin: "late" },
    });
    await session.load();
    current = false;
    const before = updates.length;
    expect(await session.remove(BUNDLE_A, "lex-2")).toBe("stale");
    expect(updates.length).toBe(before);
    db.close();
  });

  it("remove failure retains row with row error", async () => {
    const db = await openSiralexDb();
    const entry = makeLexicon("lex-fail", "fail");
    await putDictionaryRecord(db, SCOPE_A, entry);
    await saveLearningRecord(db, {
      bundle_id: BUNDLE_A,
      ir_id: "lex-fail",
      ir_kind: "lexicon_entry",
      content_sha256: HASH_A,
      storage_scope_id: SCOPE_A,
      display_cache: buildDisplayCache(entry),
    });

    const updates: SavedVocabularyModel[] = [];
    let openCount = 0;
    const session = createSavedVocabularySession({
      getActiveMeta: () => makeMeta(),
      openDb: async () => {
        openCount += 1;
        if (openCount === 1) return db; // load
        throw new Error("remove db fail");
      },
      isCurrent: () => true,
      onUpdate: (m) => updates.push(m),
      confirmRemove: () => true,
    });
    await session.load();
    expect(await session.remove(BUNDLE_A, "lex-fail")).toBe("failed");
    expect(session.getRows().length).toBe(1);
    const last = updates.at(-1)!;
    expect(last.surface).toBe("populated");
    if (last.surface === "populated" || last.surface === "removing") {
      expect(Object.keys(last.rowErrors).length).toBe(1);
    }
    db.close();
  });

  it("buildSavedVocabularyRowVm uses live vs cache correctly", () => {
    const lr = {
      schema_version: "learning_record_v1" as const,
      bundle_id: BUNDLE_A,
      ir_id: "lex-1",
      ir_kind: "lexicon_entry" as const,
      content_sha256: HASH_A,
      storage_scope_id: SCOPE_A,
      status: "still_learning" as const,
      created_at: "2026-07-29T12:00:00.000Z",
      display_cache: { headword_latin: "cached", gloss_short: "old" },
      last_reviewed: null,
      review_count: 0,
    };
    const live = makeLexicon("lex-1", "live");
    const resolved = buildSavedVocabularyRowVm({
      state: "resolved",
      learningRecord: lr,
      liveEntry: live,
    });
    expect(resolved.state).toBe("resolved");
    if (resolved.state === "resolved") {
      expect(resolved.primaryText).toBe("live");
      expect(resolved.secondaryText).toBe("live-fr");
    }
    const unresolved = buildSavedVocabularyRowVm({
      state: "unresolved",
      learningRecord: lr,
      reason: "entry_missing",
    });
    expect(unresolved.state).toBe("unresolved");
    if (unresolved.state === "unresolved") {
      expect(unresolved.primaryText).toBe("cached");
      expect(unresolved.secondaryText).toBe("old");
    }
  });

  it("drops late load updates after navigation", async () => {
    const db = await openSiralexDb();
    let current = true;
    const onUpdate = vi.fn();
    const session = createSavedVocabularySession({
      getActiveMeta: () => makeMeta(),
      openDb: async () => {
        current = false;
        return db;
      },
      isCurrent: () => current,
      onUpdate,
      confirmRemove: () => true,
    });
    await session.load();
    // loading may have been emitted before openDb; after current=false, no populated update
    expect(onUpdate.mock.calls.every((c) => c[0].surface !== "populated")).toBe(true);
    db.close();
  });
});
