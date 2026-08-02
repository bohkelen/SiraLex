/**
 * CF1I5 — Executable lifecycle verification beyond isolated unit tests.
 *
 * Covers bundle removal/update retention through the management session,
 * CF1I3A stale-host boundaries, export provenance, and reminder counts.
 */

import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  STORE_CORRECTION_DRAFTS,
  STORE_LEARNING_RECORDS,
  STORE_QUERY_LOGS,
  STORE_RECORDS,
  deleteBundleData,
  deleteSiralexDb,
  openSiralexDb,
  putInstalledBundleMeta,
  type ActiveBundleMeta,
} from "../idb/siralex_db";
import type { EnrichedRecord } from "../types/records";
import {
  countCorrectionDrafts,
  createCorrectionDraft,
  getCorrectionDraft,
  listCorrectionDrafts,
} from "./correction_draft_store";
import { createCorrectionFormController } from "./correction_form_controller";
import { buildCorrectionEntryContext } from "./correction_form_model";
import {
  createCorrectionFeedbackExport,
} from "./correction_feedback_export";
import {
  CORRECTION_FEEDBACK_AUTHORITY_LABEL,
  parseCorrectionFeedbackJson,
} from "./correction_feedback_package";
import {
  createCorrectionManagementSession,
  type CorrectionManagementVm,
} from "./correction_management_session";

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

beforeEach(async () => {
  try {
    await deleteSiralexDb();
  } catch {
    // ok
  }
});

describe("CF1I5 lifecycle verification", () => {
  it("bundle removal: retain draft, unavailable UI path, editable text, export keeps H1 provenance", async () => {
    const db = await openSiralexDb();
    await putInstalledBundleMeta(db, meta());
    await putEntry(db, SCOPE_H1, lexicon());
    const created = await createCorrectionDraft(
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
        problem_description: "Before remove\nline2 ߞߎ߲",
      },
      { now: () => TS, generateDraftId: () => "cf1i5-remove-1" },
    );
    expect(created.ok).toBe(true);

    await deleteBundleData(db, BUNDLE_A);
    const retained = await getCorrectionDraft(db, "cf1i5-remove-1");
    expect(retained?.content_sha256).toBe(HASH_H1);
    expect(retained?.storage_scope_id).toBe(SCOPE_H1);
    expect(retained?.bundle_id).toBe(BUNDLE_A);
    expect(retained?.ir_id).toBe("lex-1");

    const models: CorrectionManagementVm[] = [];
    const session = createCorrectionManagementSession({
      openDb: async () => db,
      dbOwnership: "caller_owned",
      now: () => TS2,
      isCurrent: () => true,
      onModel: (vm) => models.push(vm),
      resolveLiveEntry: async () => undefined,
    });
    await session.load();
    expect(models.at(-1)?.items[0]?.availability).toBe("dictionary_unavailable");
    await session.openDetail("cf1i5-remove-1");
    expect(models.at(-1)?.availability).toBe("dictionary_unavailable");
    session.startEdit();
    expect(models.at(-1)?.editRetargetAllowed).toBe(false);
    session.setEditProblemDescription("Edited while unavailable ߞߎ߲");
    await session.saveEdit();
    expect(models.at(-1)?.phase).toBe("detail");
    expect((await getCorrectionDraft(db, "cf1i5-remove-1"))?.content_sha256).toBe(HASH_H1);

    const exported = await createCorrectionFeedbackExport(db, { exportedAt: EXPORTED_AT });
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    const parsed = parseCorrectionFeedbackJson(exported.artifact.text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.package.authority_label).toBe(CORRECTION_FEEDBACK_AUTHORITY_LABEL);
    expect(parsed.package.drafts[0]?.content_sha256).toBe(HASH_H1);
    expect(parsed.package.drafts[0]?.problem_description).toContain("ߞߎ߲");
    db.close();
  });

  it("bundle update H1→H2: retain draft, content_differs, export still H1, no rewrite", async () => {
    const db = await openSiralexDb();
    await putInstalledBundleMeta(db, meta());
    await putEntry(db, SCOPE_H1, lexicon());
    const created = await createCorrectionDraft(
      db,
      {
        bundle_id: BUNDLE_A,
        ir_id: "lex-1",
        ir_kind: "lexicon_entry",
        content_sha256: HASH_H1,
        storage_scope_id: SCOPE_H1,
        issue_type: "translation_or_gloss",
        mode: "proposed_correction",
        target: { type: "translation", sense_index: 0, gloss_lang: "fr" },
        display_snapshot: { headword_latin: "kùn", selected_gloss: "tête" },
        problem_description: "Gloss issue",
        proposed_value: "crâne",
      },
      { now: () => TS, generateDraftId: () => "cf1i5-update-1" },
    );
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
        senses: [{ gloss_fr: "changed" }],
      },
    });

    const after = await getCorrectionDraft(db, "cf1i5-update-1");
    expect(after?.content_sha256).toBe(HASH_H1);
    expect(after?.storage_scope_id).toBe(SCOPE_H1);

    const session = createCorrectionManagementSession({
      openDb: async () => db,
      dbOwnership: "caller_owned",
      now: () => TS2,
      isCurrent: () => true,
      onModel: () => undefined,
      resolveLiveEntry: async (_db, scope, irId) => {
        if (scope === SCOPE_H1) return undefined;
        if (scope === SCOPE_H2 && irId === "lex-1") {
          return {
            ...lexicon(),
            display: {
              headword_latin: "kùn",
              senses: [{ gloss_fr: "changed" }],
            },
          };
        }
        return undefined;
      },
    });
    await session.load();
    expect(session.getVm().items[0]?.availability).toBe("dictionary_content_differs");
    await session.openDetail("cf1i5-update-1");
    expect(session.getVm().availability).toBe("dictionary_content_differs");
    session.startEdit();
    expect(session.getVm().editRetargetAllowed).toBe(false);

    const exported = await createCorrectionFeedbackExport(db, { exportedAt: EXPORTED_AT });
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    const parsed = parseCorrectionFeedbackJson(exported.artifact.text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.package.drafts[0]?.content_sha256).toBe(HASH_H1);
    expect(parsed.package.drafts[0]?.storage_scope_id).toBe(SCOPE_H1);
    db.close();
  });

  it("CF1I3A: successful commit invalidates management generation even if form host is stale", async () => {
    const db = await openSiralexDb();
    await putInstalledBundleMeta(db, meta());
    await putEntry(db, SCOPE_H1, lexicon());
    const active = meta();
    const context = buildCorrectionEntryContext(lexicon(), active)!;

    let managementGeneration = 0;
    const invalidate = () => {
      managementGeneration += 1;
    };

    let formCurrent = true;
    const controller = createCorrectionFormController({
      context,
      openDb: async () => db,
      dbOwnership: "caller_owned",
      getActiveMeta: () => active,
      isCurrent: () => formCurrent,
      onModel: () => undefined,
      onCancel: () => undefined,
      onBackToEntry: () => undefined,
      onDraftSaved: invalidate,
      resolveLiveEntry: async () => lexicon(),
      createDraft: (draftDb, input) =>
        createCorrectionDraft(draftDb, input, {
          now: () => TS,
          generateDraftId: () => "cf1i5-stale-host",
          afterWriteQueued: async () => {
            // Host navigates away after the write is queued; commit must still notify.
            formCurrent = false;
          },
        }),
    });
    controller.setIssueType("spelling");
    controller.setTargetKey("headword");
    controller.setProblemDescription("Commit while host becomes stale");

    await controller.save();
    expect(managementGeneration).toBe(1);
    expect(await countCorrectionDrafts(db)).toBe(1);
    expect(await getCorrectionDraft(db, "cf1i5-stale-host")).toBeTruthy();
    db.close();
  });

  it("reminder count seam: 0 → create → edit → export → delete → 0; Learning/query untouched", async () => {
    const db = await openSiralexDb();
    await putInstalledBundleMeta(db, meta());
    await putEntry(db, SCOPE_H1, lexicon());

    const countStore = async (name: string) => {
      const tx = db.transaction(name, "readonly");
      const n = await new Promise<number>((resolve, reject) => {
        const req = tx.objectStore(name).count();
        req.addEventListener("success", () => resolve(req.result));
        req.addEventListener("error", () => reject(req.error));
      });
      await new Promise<void>((resolve, reject) => {
        tx.addEventListener("complete", () => resolve());
        tx.addEventListener("error", () => reject(tx.error));
      });
      return n;
    };

    expect(await countCorrectionDrafts(db)).toBe(0);
    const learningBefore = await countStore(STORE_LEARNING_RECORDS);
    const queryBefore = await countStore(STORE_QUERY_LOGS);

    await createCorrectionDraft(
      db,
      {
        bundle_id: BUNDLE_A,
        ir_id: "lex-1",
        ir_kind: "lexicon_entry",
        content_sha256: HASH_H1,
        storage_scope_id: SCOPE_H1,
        issue_type: "other",
        mode: "problem_report",
        target: { type: "entry" },
        display_snapshot: { headword_latin: "kùn" },
        problem_description: "Reminder draft",
      },
      { now: () => TS, generateDraftId: () => "cf1i5-reminder" },
    );
    expect(await countCorrectionDrafts(db)).toBe(1);

    const download = vi.fn();
    const session = createCorrectionManagementSession({
      openDb: async () => db,
      dbOwnership: "caller_owned",
      now: () => TS2,
      isCurrent: () => true,
      onModel: () => undefined,
      downloadArtifact: download,
      resolveLiveEntry: async () => lexicon(),
    });
    await session.load();
    await session.openDetail("cf1i5-reminder");
    session.startEdit();
    session.setEditProblemDescription("Edited reminder draft");
    await session.saveEdit();
    expect(await countCorrectionDrafts(db)).toBe(1);

    await session.exportAll();
    expect(download).toHaveBeenCalledTimes(1);
    expect(await countCorrectionDrafts(db)).toBe(1);

    session.acknowledgeExport();
    await session.openDetail("cf1i5-reminder");
    session.requestDelete();
    await session.confirmDelete();
    expect(await countCorrectionDrafts(db)).toBe(0);

    expect(await countStore(STORE_LEARNING_RECORDS)).toBe(learningBefore);
    expect(await countStore(STORE_QUERY_LOGS)).toBe(queryBefore);
    expect(await countStore(STORE_CORRECTION_DRAFTS)).toBe(0);

    db.close();
    await deleteSiralexDb();
    const reopened = await openSiralexDb();
    expect(await countCorrectionDrafts(reopened)).toBe(0);
    reopened.close();
  });

  it("listCorrectionDrafts after create remains available across connection reopen", async () => {
    const db = await openSiralexDb();
    await createCorrectionDraft(
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
        display_snapshot: { headword_latin: "kùn" },
        problem_description: "Persist me",
      },
      { now: () => TS, generateDraftId: () => "cf1i5-persist" },
    );
    db.close();

    const reopened = await openSiralexDb();
    try {
      const listed = await listCorrectionDrafts(reopened);
      expect(listed).toHaveLength(1);
      expect(listed[0]?.problem_description).toBe("Persist me");
    } finally {
      reopened.close();
    }
  });
});
