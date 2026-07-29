import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  STORE_RECORDS,
  deleteSiralexDb,
  openSiralexDb,
  type ActiveBundleMeta,
} from "../idb/siralex_db";
import type { EnrichedRecord } from "../types/records";
import { saveLearningRecord } from "./learning_record_store";
import {
  createSavedVocabularySession,
  filterRecordsForActiveScope,
  type SavedVocabularyViewModel,
} from "./saved_vocabulary_session";

const BUNDLE = "bundle_sv";
const SCOPE = `${BUNDLE}::sha256:scope-a`;
const SCOPE_OTHER = `${BUNDLE}::sha256:scope-b`;
const HASH = "sha256:scope-a";

function makeMeta(overrides: Partial<ActiveBundleMeta> = {}): ActiveBundleMeta {
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
      senses: [{ gloss_fr: `${headword}-gloss` }],
    },
  };
}

async function putLive(db: IDBDatabase, scope: string, entry: EnrichedRecord): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_RECORDS, "readwrite");
    tx.objectStore(STORE_RECORDS).put({ ...entry, bundle_id: scope });
    tx.addEventListener("complete", () => resolve());
    tx.addEventListener("error", () => reject(tx.error));
  });
}

async function seedSaved(
  db: IDBDatabase,
  irId: string,
  headword: string,
  scope = SCOPE,
  hash = HASH,
): Promise<void> {
  await saveLearningRecord(db, {
    bundle_id: BUNDLE,
    ir_id: irId,
    ir_kind: "lexicon_entry",
    content_sha256: hash,
    storage_scope_id: scope,
    display_cache: { headword_latin: headword, gloss_short: `${headword}-cache` },
  });
}

describe("filterRecordsForActiveScope", () => {
  it("keeps only matching bundle_id and storage_scope_id", () => {
    const rows = filterRecordsForActiveScope(
      [
        {
          schema_version: "learning_record_v1",
          bundle_id: BUNDLE,
          ir_id: "a",
          ir_kind: "lexicon_entry",
          content_sha256: HASH,
          storage_scope_id: SCOPE,
          status: "still_learning",
          created_at: "2026-07-29T00:00:00.000Z",
          display_cache: { headword_latin: "a" },
          last_reviewed: null,
          review_count: 0,
        },
        {
          schema_version: "learning_record_v1",
          bundle_id: BUNDLE,
          ir_id: "b",
          ir_kind: "lexicon_entry",
          content_sha256: "sha256:scope-b",
          storage_scope_id: SCOPE_OTHER,
          status: "still_learning",
          created_at: "2026-07-29T00:00:01.000Z",
          display_cache: { headword_latin: "b" },
          last_reviewed: null,
          review_count: 0,
        },
      ],
      BUNDLE,
      SCOPE,
    );
    expect(rows.map((r) => r.ir_id)).toEqual(["a"]);
  });
});

describe("Saved Vocabulary session", () => {
  beforeEach(async () => {
    try {
      await deleteSiralexDb();
    } catch {
      // fine
    }
  });

  it("loads from loading to populated using display cache and active scope", async () => {
    const db = await openSiralexDb();
    await putLive(db, SCOPE, makeLexicon("lex-1", "live-head"));
    await seedSaved(db, "lex-1", "cached-head");
    const vms: SavedVocabularyViewModel[] = [];
    const session = createSavedVocabularySession({
      getActiveMeta: () => makeMeta(),
      openDb: async () => db,
      isCurrent: () => true,
      isBindingCurrent: () => true,
      publish: (vm) => vms.push(vm),
      onOpenEntry: () => undefined,
      confirmRemove: () => true,
    });
    await session.load();
    expect(vms[0]?.state).toBe("loading");
    const last = vms.at(-1)!;
    expect(last.state).toBe("populated");
    expect(last.rows).toHaveLength(1);
    expect(last.rows[0]?.headword_latin).toBe("cached-head");
    expect(last.rows[0]?.gloss_short).toBe("cached-head-cache");
    expect(last.rows[0]?.openable).toBe(true);
    db.close();
  });

  it("loads to empty when no scoped records exist", async () => {
    const db = await openSiralexDb();
    await seedSaved(db, "lex-other-scope", "x", SCOPE_OTHER, "sha256:scope-b");
    const vms: SavedVocabularyViewModel[] = [];
    const session = createSavedVocabularySession({
      getActiveMeta: () => makeMeta(),
      openDb: async () => db,
      isCurrent: () => true,
      isBindingCurrent: () => true,
      publish: (vm) => vms.push(vm),
      onOpenEntry: () => undefined,
      confirmRemove: () => true,
    });
    await session.load();
    expect(vms.at(-1)?.state).toBe("empty");
    expect(vms.at(-1)?.rows).toEqual([]);
    db.close();
  });

  it("opens entry by saved ir_id without reconstructing from cache as authority", async () => {
    const db = await openSiralexDb();
    const live = makeLexicon("lex-1", "live-head");
    await putLive(db, SCOPE, live);
    await seedSaved(db, "lex-1", "cached-head");
    const onOpenEntry = vi.fn();
    const session = createSavedVocabularySession({
      getActiveMeta: () => makeMeta(),
      openDb: async () => db,
      isCurrent: () => true,
      isBindingCurrent: () => true,
      publish: () => undefined,
      onOpenEntry,
      confirmRemove: () => true,
    });
    await session.load();
    await session.openRow("lex-1");
    expect(onOpenEntry).toHaveBeenCalledTimes(1);
    expect(onOpenEntry.mock.calls[0]![0].ir_id).toBe("lex-1");
    expect(onOpenEntry.mock.calls[0]![0].display?.headword_latin).toBe("live-head");
    db.close();
  });

  it("removes successfully and refreshes the list", async () => {
    const db = await openSiralexDb();
    await putLive(db, SCOPE, makeLexicon("lex-1", "a"));
    await seedSaved(db, "lex-1", "a");
    const vms: SavedVocabularyViewModel[] = [];
    const session = createSavedVocabularySession({
      getActiveMeta: () => makeMeta(),
      openDb: async () => db,
      isCurrent: () => true,
      isBindingCurrent: () => true,
      publish: (vm) => vms.push(vm),
      onOpenEntry: () => undefined,
      confirmRemove: () => true,
    });
    await session.load();
    await session.removeRow("lex-1");
    expect(vms.some((vm) => vm.state === "removing")).toBe(true);
    expect(vms.at(-1)?.state).toBe("empty");
    db.close();
  });

  it("failed removal leaves the item visible and recoverable", async () => {
    const db = await openSiralexDb();
    await putLive(db, SCOPE, makeLexicon("lex-1", "a"));
    await seedSaved(db, "lex-1", "a");
    let call = 0;
    const vms: SavedVocabularyViewModel[] = [];
    const session = createSavedVocabularySession({
      getActiveMeta: () => makeMeta(),
      openDb: async () => {
        call += 1;
        if (call === 1) return db; // load
        throw new Error("remove boom");
      },
      isCurrent: () => true,
      isBindingCurrent: () => true,
      publish: (vm) => vms.push(vm),
      onOpenEntry: () => undefined,
      confirmRemove: () => true,
    });
    await session.load();
    await session.removeRow("lex-1");
    const last = vms.at(-1)!;
    expect(last.state).toBe("populated");
    expect(last.rows).toHaveLength(1);
    expect(last.statusMessage).toBe("remove_failed");
    db.close();
  });

  it("suppresses repeated removal clicks while busy", async () => {
    const db = await openSiralexDb();
    await putLive(db, SCOPE, makeLexicon("lex-1", "a"));
    await seedSaved(db, "lex-1", "a");
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let openCount = 0;
    const session = createSavedVocabularySession({
      getActiveMeta: () => makeMeta(),
      openDb: async () => {
        openCount += 1;
        if (openCount === 1) return db;
        await gate;
        return db;
      },
      isCurrent: () => true,
      isBindingCurrent: () => true,
      publish: () => undefined,
      onOpenEntry: () => undefined,
      confirmRemove: () => true,
    });
    await session.load();
    const first = session.removeRow("lex-1");
    const second = session.removeRow("lex-1");
    release();
    await Promise.all([first, second]);
    // load + one remove path (second suppressed before openDb)
    expect(openCount).toBeLessThanOrEqual(3);
    db.close();
  });

  it("publishes unavailable when storage/meta is missing", async () => {
    const vms: SavedVocabularyViewModel[] = [];
    const session = createSavedVocabularySession({
      getActiveMeta: () => undefined,
      openDb: openSiralexDb,
      isCurrent: () => true,
      isBindingCurrent: () => true,
      publish: (vm) => vms.push(vm),
      onOpenEntry: () => undefined,
      confirmRemove: () => true,
    });
    await session.load();
    expect(vms.at(-1)?.state).toBe("unavailable");
  });

  it("publishes error on initial load failure", async () => {
    const vms: SavedVocabularyViewModel[] = [];
    const session = createSavedVocabularySession({
      getActiveMeta: () => makeMeta(),
      openDb: async () => {
        throw new Error("idb down");
      },
      isCurrent: () => true,
      isBindingCurrent: () => true,
      publish: (vm) => vms.push(vm),
      onOpenEntry: () => undefined,
      confirmRemove: () => true,
    });
    await session.load();
    expect(vms[0]?.state).toBe("loading");
    expect(vms.at(-1)?.state).toBe("error");
  });

  it("drops stale load results", async () => {
    const db = await openSiralexDb();
    await seedSaved(db, "lex-1", "a");
    let current = true;
    const publish = vi.fn();
    const session = createSavedVocabularySession({
      getActiveMeta: () => makeMeta(),
      openDb: async () => {
        current = false;
        return db;
      },
      isCurrent: () => current,
      isBindingCurrent: () => true,
      publish,
      onOpenEntry: () => undefined,
      confirmRemove: () => true,
    });
    await session.load();
    // loading may publish once while current; later result must be dropped
    expect(publish.mock.calls.every((c) => c[0].state !== "populated")).toBe(true);
    db.close();
  });

  it("drops stale removal results", async () => {
    const db = await openSiralexDb();
    await putLive(db, SCOPE, makeLexicon("lex-1", "a"));
    await seedSaved(db, "lex-1", "a");
    let current = true;
    let opens = 0;
    const publish = vi.fn();
    const session = createSavedVocabularySession({
      getActiveMeta: () => makeMeta(),
      openDb: async () => {
        opens += 1;
        if (opens === 1) return db;
        current = false;
        return db;
      },
      isCurrent: () => current,
      isBindingCurrent: () => true,
      publish,
      onOpenEntry: () => undefined,
      confirmRemove: () => true,
    });
    await session.load();
    const before = publish.mock.calls.length;
    await session.removeRow("lex-1");
    const afterStates = publish.mock.calls.slice(before).map((c) => c[0].state);
    expect(afterStates.includes("empty")).toBe(false);
    db.close();
  });
});
