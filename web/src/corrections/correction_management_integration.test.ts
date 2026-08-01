/**
 * CF1I4 focused integration: create → manage → edit → export → delete + isolation.
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
  deleteSiralexDb,
  openSiralexDb,
  putInstalledBundleMeta,
  type ActiveBundleMeta,
} from "../idb/siralex_db";
import { saveLearningRecord } from "../learning/learning_record_store";
import type { EnrichedRecord } from "../types/records";
import {
  countCorrectionDrafts,
  createCorrectionDraft,
  getCorrectionDraft,
  listCorrectionDrafts,
} from "./correction_draft_store";
import { createCorrectionFormController } from "./correction_form_controller";
import { buildCorrectionEntryContext } from "./correction_form_model";
import { createCorrectionManagementSession } from "./correction_management_session";
import { parseCorrectionFeedbackJson } from "./correction_feedback_package";

const HASH =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

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

describe("CF1I4 correction management integration", () => {
  beforeEach(async () => {
    try {
      await deleteSiralexDb();
    } catch {
      // ok
    }
  });

  it("create → manage → edit → export → delete with store isolation and reminder count", async () => {
    const db = await openSiralexDb();
    const active = meta();
    await putInstalledBundleMeta(db, active);
    const entry = lexicon();
    const tx = db.transaction([STORE_RECORDS, STORE_SEARCH_INDEX, STORE_QUERY_LOGS], "readwrite");
    tx.objectStore(STORE_RECORDS).put({ ...entry, bundle_id: active.storage_scope_id });
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

    const context = buildCorrectionEntryContext(entry, active)!;
    let formState = "";
    const form = createCorrectionFormController({
      context,
      openDb: async () => db,
      dbOwnership: "caller_owned",
      getActiveMeta: () => active,
      isCurrent: () => true,
      onModel: (vm) => {
        formState = vm.state;
      },
      onCancel: () => undefined,
      onBackToEntry: () => undefined,
      onDraftSaved: () => undefined,
      resolveLiveEntry: async () => entry,
      createDraft: (draftDb, input) =>
        createCorrectionDraft(draftDb, input, {
          now: () => "2026-07-31T18:00:00.000Z",
          generateDraftId: () => "integration-draft-1",
        }),
    });
    form.setIssueType("spelling");
    form.setTargetKey("headword");
    form.setProblemDescription("Needs a look");
    form.setMode("problem_report");
    await form.save();
    expect(formState).toBe("saved");

    expect(await countCorrectionDrafts(db)).toBe(1);
    const baseline = await snapshot(db);

    const downloaded: string[] = [];
    const session = createCorrectionManagementSession({
      openDb: async () => db,
      dbOwnership: "caller_owned",
      now: () => "2026-07-31T21:00:00.000Z",
      appVersion: "0.1.0",
      isCurrent: () => true,
      onModel: () => undefined,
      resolveLiveEntry: async () => entry,
      downloadArtifact: (artifact) => {
        downloaded.push(artifact.text);
      },
    });

    await session.load();
    expect(session.getVm().phase).toBe("list");
    expect(session.getVm().draftCount).toBe(1);

    const draftId = session.getVm().items[0]!.draft_id;
    await session.openDetail(draftId);
    session.startEdit();
    session.setEditProblemDescription("Edited from Manage Corrections");
    await session.saveEdit();
    expect(session.getVm().phase).toBe("detail");
    expect(session.getVm().errorCode).toBeUndefined();

    const afterEdit = await snapshot(db);
    expect(afterEdit[STORE_CORRECTION_DRAFTS]).toBe(baseline[STORE_CORRECTION_DRAFTS]);
    for (const key of Object.keys(baseline)) {
      if (key === STORE_CORRECTION_DRAFTS) continue;
      expect(afterEdit[key]).toBe(baseline[key]);
    }
    expect((await getCorrectionDraft(db, draftId))?.problem_description).toBe(
      "Edited from Manage Corrections",
    );

    const beforeExport = await listCorrectionDrafts(db);
    await session.exportAll();
    expect(session.getVm().phase).toBe("exported");
    expect(downloaded).toHaveLength(1);
    const parsed = parseCorrectionFeedbackJson(downloaded[0]!);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.package.draft_count).toBe(1);
      expect(parsed.package.drafts[0]!.problem_description).toBe(
        "Edited from Manage Corrections",
      );
    }
    expect(await listCorrectionDrafts(db)).toEqual(beforeExport);
    expect(await snapshot(db)).toEqual(afterEdit);

    session.acknowledgeExport();
    await session.openDetail(draftId);
    session.requestDelete();
    await session.confirmDelete();
    expect(session.getVm().phase).toBe("empty");
    expect(await countCorrectionDrafts(db)).toBe(0);

    const afterDelete = await snapshot(db);
    expect(afterDelete[STORE_CORRECTION_DRAFTS]).toBe(0);
    for (const key of Object.keys(baseline)) {
      if (key === STORE_CORRECTION_DRAFTS) continue;
      expect(afterDelete[key]).toBe(baseline[key]);
    }

    // Reminder count seam: count goes 1 → 0 across create/delete.
    expect(await countCorrectionDrafts(db)).toBe(0);
    await createCorrectionDraft(
      db,
      {
        bundle_id: active.bundle_id,
        ir_id: entry.ir_id,
        ir_kind: "lexicon_entry",
        content_sha256: HASH,
        storage_scope_id: active.storage_scope_id!,
        issue_type: "other",
        mode: "problem_report",
        target: { type: "entry" },
        display_snapshot: { headword_latin: "kùn" },
        problem_description: "Another draft for reminder",
      },
      {
        now: () => "2026-07-31T22:00:00.000Z",
        generateDraftId: () => "reminder-draft",
      },
    );
    expect(await countCorrectionDrafts(db)).toBe(1);

    db.close();
  });

  it("blocks export when any local row is invalid and creates no download", async () => {
    const db = await openSiralexDb();
    try {
      await createCorrectionDraft(
        db,
        {
          bundle_id: "bundle_a",
          ir_id: "lex-1",
          ir_kind: "lexicon_entry",
          content_sha256: HASH,
          storage_scope_id: `bundle_a::${HASH}`,
          issue_type: "spelling",
          mode: "problem_report",
          target: { type: "headword" },
          display_snapshot: { headword_latin: "kùn" },
          problem_description: "ok",
        },
        {
          now: () => "2026-07-31T18:00:00.000Z",
          generateDraftId: () => "ok",
        },
      );
      const tx = db.transaction(STORE_CORRECTION_DRAFTS, "readwrite");
      tx.objectStore(STORE_CORRECTION_DRAFTS).put({
        draft_id: "bad",
        schema_version: "correction_draft_v1",
        problem_description: "",
      });
      await new Promise<void>((resolve, reject) => {
        tx.addEventListener("complete", () => resolve());
        tx.addEventListener("error", () => reject(tx.error));
      });

      const { createCorrectionFeedbackExport } = await import("./correction_feedback_export");
      const result = await createCorrectionFeedbackExport(db, {
        exportedAt: "2026-07-31T22:30:00.000Z",
      });
      expect(result).toEqual({ ok: false, code: "invalid_local_draft" });
    } finally {
      db.close();
    }
  });
});
