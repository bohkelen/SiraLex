import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  deleteSiralexDb,
  openSiralexDb,
  type ActiveBundleMeta,
} from "../idb/siralex_db";
import type { EnrichedRecord } from "../types/records";
import { buildDisplayCache } from "./build_display_cache";
import {
  buildSaveInputFromActiveEntry,
  canOfferLearningSave,
  createEntryLearningSession,
  type LearningSaveControlState,
} from "./entry_learning_session";
import { getLearningRecord, isLearningRecordSaved } from "./learning_record_store";

const BUNDLE_ID = "bundle_ls1i2";
const SCOPE = `${BUNDLE_ID}::sha256:abc`;
const HASH = "sha256:abc";

const LEXICON: EnrichedRecord = {
  ir_id: "lex-1",
  ir_kind: "lexicon_entry",
  source_id: "s",
  norm_version: "norm_v3",
  preferred_form: "kùn",
  variant_forms: [],
  search_keys: {},
  display: {
    headword_latin: "kùn",
    headword_nko_provided: "ߞߎ߲",
    senses: [{ gloss_fr: "tête" }],
  },
};

const INDEX: EnrichedRecord = {
  ir_id: "map-1",
  ir_kind: "index_mapping",
  source_id: "s",
  norm_version: "norm_v3",
  preferred_form: "tête",
  variant_forms: [],
  search_keys: {},
  display: { source_term: "tête", source_lang: "fr", target_entries: [] },
};

function makeMeta(overrides: Partial<ActiveBundleMeta> = {}): ActiveBundleMeta {
  return {
    bundle_id: BUNDLE_ID,
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

describe("LS1I2 entry learning session / Save input", () => {
  beforeEach(async () => {
    try {
      await deleteSiralexDb();
    } catch {
      // fine
    }
  });

  it("builds Save input from active logical bundle id and stamps", () => {
    const input = buildSaveInputFromActiveEntry(LEXICON, makeMeta());
    expect(input).toEqual({
      bundle_id: BUNDLE_ID,
      ir_id: "lex-1",
      ir_kind: "lexicon_entry",
      content_sha256: HASH,
      storage_scope_id: SCOPE,
      display_cache: buildDisplayCache(LEXICON),
    });
  });

  it("does not offer Save for index mappings or missing stamps", () => {
    expect(canOfferLearningSave(INDEX, makeMeta())).toBe(false);
    expect(buildSaveInputFromActiveEntry(INDEX, makeMeta())).toBeNull();
    expect(
      buildSaveInputFromActiveEntry(LEXICON, makeMeta({ expected_content_sha256: undefined })),
    ).toBeNull();
    expect(canOfferLearningSave(LEXICON, undefined)).toBe(false);
  });

  it("loadInitial uses active logical bundle_id and sets saved/not_saved", async () => {
    const db = await openSiralexDb();
    const states: LearningSaveControlState[] = [];
    const session = createEntryLearningSession({
      record: LEXICON,
      getActiveMeta: () => makeMeta(),
      openDb: async () => db,
      isCurrent: () => true,
      setState: (s) => states.push(s),
    });

    await session.loadInitial();
    expect(states.at(-1)).toBe("not_saved");

    await session.save();
    expect(states.at(-1)).toBe("saved");
    expect(await isLearningRecordSaved(db, BUNDLE_ID, "lex-1")).toBe(true);

    const saved = await getLearningRecord(db, BUNDLE_ID, "lex-1");
    expect(saved?.bundle_id).toBe(BUNDLE_ID);
    expect(saved?.content_sha256).toBe(HASH);
    expect(saved?.storage_scope_id).toBe(SCOPE);
    expect(saved?.display_cache).toEqual(buildDisplayCache(LEXICON));
    db.close();
  });

  it("unsave succeeds when already absent and maps to not_saved", async () => {
    const db = await openSiralexDb();
    const states: LearningSaveControlState[] = [];
    const session = createEntryLearningSession({
      record: LEXICON,
      getActiveMeta: () => makeMeta(),
      openDb: async () => db,
      isCurrent: () => true,
      setState: (s) => states.push(s),
    });
    await session.unsave();
    expect(states).toContain("removing");
    expect(states.at(-1)).toBe("not_saved");
    db.close();
  });

  it("maps persistence failures without clearing prior knowledge of entry", async () => {
    const states: LearningSaveControlState[] = [];
    const session = createEntryLearningSession({
      record: LEXICON,
      getActiveMeta: () => makeMeta(),
      openDb: async () => {
        throw new Error("idb down");
      },
      isCurrent: () => true,
      setState: (s) => states.push(s),
    });
    await session.loadInitial();
    expect(states.at(-1)).toBe("error_not_saved");
    await session.save();
    expect(states.at(-1)).toBe("error_not_saved");
  });

  it("ignores stale async updates after navigation away", async () => {
    const db = await openSiralexDb();
    let current = true;
    const setState = vi.fn();
    const session = createEntryLearningSession({
      record: LEXICON,
      getActiveMeta: () => makeMeta(),
      openDb: async () => {
        current = false;
        return db;
      },
      isCurrent: () => current,
      setState,
    });
    await session.loadInitial();
    expect(setState).not.toHaveBeenCalled();
    db.close();
  });

  it("sets unavailable when metadata is insufficient", async () => {
    const states: LearningSaveControlState[] = [];
    const session = createEntryLearningSession({
      record: LEXICON,
      getActiveMeta: () => makeMeta({ expected_content_sha256: undefined }),
      openDb: openSiralexDb,
      isCurrent: () => true,
      setState: (s) => states.push(s),
    });
    await session.loadInitial();
    expect(states.at(-1)).toBe("unavailable");
    await session.save();
    expect(states.at(-1)).toBe("unavailable");
  });

  it("suppresses parallel save actions while inflight", async () => {
    const db = await openSiralexDb();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const states: LearningSaveControlState[] = [];
    const session = createEntryLearningSession({
      record: LEXICON,
      getActiveMeta: () => makeMeta(),
      openDb: async () => {
        await gate;
        return db;
      },
      isCurrent: () => true,
      setState: (s) => states.push(s),
    });

    const first = session.save();
    const second = session.save();
    release();
    await Promise.all([first, second]);
    expect(states.filter((s) => s === "saving").length).toBe(1);
    expect(states.at(-1)).toBe("saved");
    expect(await isLearningRecordSaved(db, BUNDLE_ID, "lex-1")).toBe(true);
    db.close();
  });
});
