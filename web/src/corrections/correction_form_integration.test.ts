/**
 * CF1I3 focused integration: live entry → form → save → isolation + stale block.
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
  STORE_SEARCH_INDEX,
  deleteBundleData,
  deleteSiralexDb,
  openSiralexDb,
  putInstalledBundleMeta,
  type ActiveBundleMeta,
} from "../idb/siralex_db";
import { LEARNING_RECORD_SCHEMA_VERSION } from "../learning/learning_record_types";
import { saveLearningRecord } from "../learning/learning_record_store";
import type { EnrichedRecord } from "../types/records";
import { getCorrectionDraft, listCorrectionDrafts } from "./correction_draft_store";
import { createCorrectionFormController } from "./correction_form_controller";
import { buildCorrectionEntryContext } from "./correction_form_model";

const HASH =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const HASH_B =
  "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

function meta(overrides: Partial<ActiveBundleMeta> = {}): ActiveBundleMeta {
  return {
    bundle_id: "bundle_a",
    storage_scope_id: `bundle_a::${HASH}`,
    manifest_schema_version: "1",
    record_schema_id: "enriched_record_v1",
    record_schema_version: "1",
    normalization_ruleset: "norm_v3",
    update_mode: "replace",
    reconciliation_action: "none",
    expected_content_sha256: HASH,
    imported_at_iso: "2026-07-31T18:00:00.000Z",
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
      senses: [{ gloss_fr: "tête", gloss_en: "head" }],
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
  ];
  const out: Record<string, number> = {};
  for (const name of names) {
    if (db.objectStoreNames.contains(name)) {
      out[name] = await countStore(db, name);
    }
  }
  return out;
}

beforeEach(async () => {
  try {
    await deleteSiralexDb();
  } catch {
    // ok
  }
});

describe("CF1I3 correction form integration", () => {
  it("saves a draft from a live entry with isolation and exact provenance", async () => {
    const active = meta();
    const entry = lexicon();
    const db = await openSiralexDb();
    await putInstalledBundleMeta(db, active);

    const tx = db.transaction([STORE_RECORDS, STORE_SEARCH_INDEX, STORE_QUERY_LOGS], "readwrite");
    tx.objectStore(STORE_RECORDS).put({ ...entry, bundle_id: active.storage_scope_id });
    tx.objectStore(STORE_SEARCH_INDEX).put({
      bundle_id: active.storage_scope_id,
      key_type: "casefold",
      key: "kun",
      ir_id: entry.ir_id,
    });
    tx.objectStore(STORE_QUERY_LOGS).put({
      id: "ql-1",
      created_at: "2026-07-31T18:00:00.000Z",
      query_text: "kun",
    });
    await new Promise<void>((resolve, reject) => {
      tx.addEventListener("complete", () => resolve());
      tx.addEventListener("error", () => reject(tx.error));
    });

    await saveLearningRecord(db, {
      bundle_id: active.bundle_id,
      ir_id: entry.ir_id,
      ir_kind: "lexicon_entry",
      content_sha256: HASH,
      storage_scope_id: active.storage_scope_id!,
      display_cache: { headword_latin: "kùn" },
    });

    const before = await snapshot(db);
    const context = buildCorrectionEntryContext(entry, active)!;
    const onDraftSaved = vi.fn();
    let lastState = "";
    const controller = createCorrectionFormController({
      context,
      openDb: async () => db,
      dbOwnership: "caller_owned",
      getActiveMeta: () => active,
      isCurrent: () => true,
      onModel: (vm) => {
        lastState = vm.state;
      },
      onCancel: () => undefined,
      onBackToEntry: () => undefined,
      onDraftSaved,
      resolveLiveEntry: async (_db, scope, irId) => {
        const rows = await new Promise<EnrichedRecord | undefined>((resolve, reject) => {
          const rtx = db.transaction(STORE_RECORDS, "readonly");
          const req = rtx.objectStore(STORE_RECORDS).get([scope, irId]);
          req.addEventListener("success", () => resolve(req.result as EnrichedRecord | undefined));
          req.addEventListener("error", () => reject(req.error));
        });
        return rows;
      },
    });

    controller.setIssueType("translation_or_gloss");
    controller.setTargetKey("translation:0:fr");
    controller.setProblemDescription("Meaning seems off");
    await controller.save();
    expect(lastState).toBe("saved");
    expect(onDraftSaved).toHaveBeenCalledTimes(1);

    const after = await snapshot(db);
    for (const key of Object.keys(before)) {
      if (key === STORE_CORRECTION_DRAFTS) {
        expect(after[key]).toBe((before[key] ?? 0) + 1);
      } else {
        expect(after[key]).toBe(before[key]);
      }
    }

    const drafts = await listCorrectionDrafts(db);
    expect(drafts).toHaveLength(1);
    expect(drafts[0]!.bundle_id).toBe(active.bundle_id);
    expect(drafts[0]!.ir_id).toBe(entry.ir_id);
    expect(drafts[0]!.content_sha256).toBe(HASH);
    expect(drafts[0]!.storage_scope_id).toBe(active.storage_scope_id);
    expect(drafts[0]!.target).toEqual({
      type: "translation",
      sense_index: 0,
      gloss_lang: "fr",
    });

    const stored = await getCorrectionDraft(db, drafts[0]!.draft_id);
    expect(stored?.problem_description).toBe("Meaning seems off");
    expect(LEARNING_RECORD_SCHEMA_VERSION).toBeTruthy();
    db.close();
  });

  it("blocks Save after bundle removal/update with no draft created", async () => {
    const active = meta();
    const entry = lexicon();
    const db = await openSiralexDb();
    await putInstalledBundleMeta(db, active);
    const tx = db.transaction(STORE_RECORDS, "readwrite");
    tx.objectStore(STORE_RECORDS).put({ ...entry, bundle_id: active.storage_scope_id });
    await new Promise<void>((resolve, reject) => {
      tx.addEventListener("complete", () => resolve());
      tx.addEventListener("error", () => reject(tx.error));
    });

    let currentMeta: ActiveBundleMeta | undefined = active;
    const context = buildCorrectionEntryContext(entry, active)!;
    const createSpy = vi.fn();
    let lastState = "";
    const controller = createCorrectionFormController({
      context,
      openDb: async () => db,
      dbOwnership: "caller_owned",
      getActiveMeta: () => currentMeta,
      isCurrent: () => true,
      onModel: (vm) => {
        lastState = vm.state;
      },
      onCancel: () => undefined,
      onBackToEntry: () => undefined,
      createDraft: createSpy,
      resolveLiveEntry: async () => entry,
    });
    controller.setIssueType("spelling");
    controller.setProblemDescription("note");

    await deleteBundleData(db, active.bundle_id);
    currentMeta = undefined;
    controller.notifyBundleLifecycleChanged();
    await controller.save();
    expect(lastState).toBe("stale_context");
    expect(createSpy).not.toHaveBeenCalled();

    // Bundle update path: hash changes while meta still present.
    currentMeta = meta({
      expected_content_sha256: HASH_B,
      storage_scope_id: `bundle_a::${HASH_B}`,
    });
    const controller2 = createCorrectionFormController({
      context,
      openDb: async () => db,
      dbOwnership: "caller_owned",
      getActiveMeta: () => currentMeta,
      isCurrent: () => true,
      onModel: (vm) => {
        lastState = vm.state;
      },
      onCancel: () => undefined,
      onBackToEntry: () => undefined,
      createDraft: createSpy,
      resolveLiveEntry: async () => entry,
    });
    controller2.setIssueType("spelling");
    controller2.setProblemDescription("note");
    await controller2.save();
    expect(lastState).toBe("stale_context");
    expect(createSpy).not.toHaveBeenCalled();
    db.close();
  });
});
