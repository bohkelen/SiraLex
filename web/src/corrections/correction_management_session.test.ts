/**
 * CF1I4 — Pending corrections management session tests.
 */

import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  STORE_CORRECTION_DRAFTS,
  STORE_LEARNING_RECORDS,
  STORE_QUERY_LOGS,
  deleteSiralexDb,
  openSiralexDb,
  putInstalledBundleMeta,
  type ActiveBundleMeta,
} from "../idb/siralex_db";
import type { EnrichedRecord } from "../types/records";
import {
  createCorrectionDraft,
  getCorrectionDraft,
  listCorrectionDrafts,
  updateCorrectionDraft,
  type CreateCorrectionDraftInput,
} from "./correction_draft_store";
import {
  createCorrectionManagementSession,
  deriveCorrectionAvailability,
  type CorrectionManagementVm,
} from "./correction_management_session";

const HASH =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const HASH_B =
  "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const TS = "2026-07-31T18:00:00.000Z";
const TS2 = "2026-07-31T19:00:00.000Z";
const TS3 = "2026-07-31T20:00:00.000Z";

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
    imported_at_iso: TS,
    ...overrides,
  };
}

function lexicon(overrides: Partial<EnrichedRecord> = {}): EnrichedRecord {
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
    ...overrides,
  };
}

function makeInput(
  overrides: Partial<CreateCorrectionDraftInput> = {},
): CreateCorrectionDraftInput {
  return {
    bundle_id: "bundle_a",
    ir_id: "lex-1",
    ir_kind: "lexicon_entry",
    content_sha256: HASH,
    storage_scope_id: `bundle_a::${HASH}`,
    issue_type: "spelling",
    mode: "problem_report",
    target: { type: "headword" },
    display_snapshot: { headword_latin: "kùn", headword_nko: "ߞߎ߲" },
    problem_description: "Spelling looks off.",
    ...overrides,
  };
}

type TrackedDb = { db: IDBDatabase; closed: boolean };

function trackDb(db: IDBDatabase): TrackedDb {
  const tracked: TrackedDb = { db, closed: false };
  const originalClose = db.close.bind(db);
  db.close = () => {
    tracked.closed = true;
    originalClose();
  };
  return tracked;
}

async function seedDraft(
  db: IDBDatabase,
  draftId: string,
  input: CreateCorrectionDraftInput = makeInput(),
  now = TS,
) {
  const result = await createCorrectionDraft(db, input, {
    now: () => now,
    generateDraftId: () => draftId,
  });
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("seed failed");
  return result.draft;
}

function lastVm(models: CorrectionManagementVm[]): CorrectionManagementVm {
  const vm = models[models.length - 1];
  if (!vm) throw new Error("no model");
  return vm;
}

describe("deriveCorrectionAvailability", () => {
  it("classifies matching, unavailable, and hash-mismatch neutrally", () => {
    const draft = {
      ...makeInput(),
      schema_version: "correction_draft_v1" as const,
      draft_id: "d1",
      created_at: TS,
      updated_at: TS,
      status: "draft" as const,
    };
    expect(deriveCorrectionAvailability(draft, undefined, lexicon())).toBe(
      "dictionary_unavailable",
    );
    expect(deriveCorrectionAvailability(draft, meta(), undefined)).toBe("entry_unavailable");
    expect(
      deriveCorrectionAvailability(
        draft,
        meta({ expected_content_sha256: HASH_B }),
        lexicon(),
      ),
    ).toBe("dictionary_content_differs");
    expect(deriveCorrectionAvailability(draft, meta(), lexicon())).toBe(
      "matching_live_content",
    );
  });
});

describe("correction management session", () => {
  let sharedDb: IDBDatabase;
  let opened: TrackedDb[];

  beforeEach(async () => {
    try {
      await deleteSiralexDb();
    } catch {
      // ok
    }
    sharedDb = await openSiralexDb();
    opened = [];
  });

  afterEach(() => {
    try {
      sharedDb.close();
    } catch {
      // ok
    }
  });

  function createSession(options?: {
    isCurrent?: () => boolean;
    ownership?: "controller_owned" | "caller_owned";
    now?: () => string;
    onDraftsChanged?: () => void;
    downloadArtifact?: ReturnType<typeof vi.fn>;
    createExport?: ReturnType<typeof vi.fn>;
  }) {
    const models: CorrectionManagementVm[] = [];
    const session = createCorrectionManagementSession({
      openDb: async () => {
        if (options?.ownership === "caller_owned") {
          return sharedDb;
        }
        const tracked = trackDb(await openSiralexDb());
        opened.push(tracked);
        return tracked.db;
      },
      dbOwnership: options?.ownership ?? "controller_owned",
      now: options?.now ?? (() => TS2),
      appVersion: "9.9.9",
      isCurrent: options?.isCurrent ?? (() => true),
      onModel: (vm) => {
        models.push(structuredClone(vm));
      },
      onDraftsChanged: options?.onDraftsChanged,
      getInstalledMeta: async (db, bundleId) => {
        const { getInstalledBundleMeta } = await import("../idb/siralex_db");
        return getInstalledBundleMeta(db, bundleId);
      },
      resolveLiveEntry: async (_db, _scope, irId) => {
        if (irId === "lex-1") return lexicon();
        return undefined;
      },
      downloadArtifact: options?.downloadArtifact as never,
      createExport: options?.createExport as never,
    });
    return { session, models };
  }

  it("loading → empty", async () => {
    const { session, models } = createSession({ ownership: "caller_owned" });
    await session.load();
    expect(models.some((m) => m.phase === "loading")).toBe(true);
    expect(lastVm(models).phase).toBe("empty");
    expect(lastVm(models).draftCount).toBe(0);
  });

  it("loading → populated with deterministic management order", async () => {
    await seedDraft(sharedDb, "z-id", makeInput({ ir_id: "lex-1" }), TS);
    await seedDraft(
      sharedDb,
      "a-id",
      makeInput({ ir_id: "lex-2", display_snapshot: { headword_latin: "aba" } }),
      TS2,
    );
    await putInstalledBundleMeta(sharedDb, meta());

    const { session, models } = createSession({ ownership: "caller_owned" });
    await session.load();
    const vm = lastVm(models);
    expect(vm.phase).toBe("list");
    expect(vm.items.map((i) => i.draft_id)).toEqual(["a-id", "z-id"]);
    expect(vm.items.every((i) => !("content_sha256" in i))).toBe(true);
  });

  it("corrupt stored row blocks the complete list surface", async () => {
    await seedDraft(sharedDb, "ok", makeInput());
    const tx = sharedDb.transaction(STORE_CORRECTION_DRAFTS, "readwrite");
    tx.objectStore(STORE_CORRECTION_DRAFTS).put({ draft_id: "bad", broken: true });
    await new Promise<void>((resolve, reject) => {
      tx.addEventListener("complete", () => resolve());
      tx.addEventListener("error", () => reject(tx.error));
    });

    const { session, models } = createSession({ ownership: "caller_owned" });
    await session.load();
    expect(lastVm(models).phase).toBe("error");
    expect(lastVm(models).errorCode).toBe("invalid_stored_draft");
  });

  it("opens detail and retains unavailable dictionary", async () => {
    await seedDraft(sharedDb, "d1", makeInput());
    const { session, models } = createSession({ ownership: "caller_owned" });
    await session.load();
    await session.openDetail("d1");
    const vm = lastVm(models);
    expect(vm.phase).toBe("detail");
    expect(vm.selected?.draft_id).toBe("d1");
    expect(vm.availability).toBe("dictionary_unavailable");
  });

  it("shows hash mismatch neutrally when dictionary content differs", async () => {
    await seedDraft(sharedDb, "d1", makeInput());
    await putInstalledBundleMeta(
      sharedDb,
      meta({ expected_content_sha256: HASH_B, storage_scope_id: `bundle_a::${HASH_B}` }),
    );
    const { session, models } = createSession({ ownership: "caller_owned" });
    await session.load();
    await session.openDetail("d1");
    expect(lastVm(models).availability).toBe("dictionary_content_differs");
  });

  it("valid edit preserves immutable fields and refreshes list", async () => {
    const draft = await seedDraft(sharedDb, "d1", makeInput());
    await putInstalledBundleMeta(sharedDb, meta());
    const changed = vi.fn();
    const { session, models } = createSession({
      ownership: "caller_owned",
      now: () => TS2,
      onDraftsChanged: changed,
    });
    await session.load();
    await session.openDetail("d1");
    session.startEdit();
    expect(lastVm(models).focusTarget).toBe("heading");
    session.setEditIssueType("nko");
    expect(lastVm(models).focusTarget).toBe("none");
    session.setEditProblemDescription("N’Ko form looks wrong");
    expect(lastVm(models).focusTarget).toBe("none");
    await session.saveEdit();

    const vm = lastVm(models);
    expect(vm.phase).toBe("detail");
    expect(vm.selected?.issue_type).toBe("nko");
    expect(vm.selected?.problem_description).toBe("N’Ko form looks wrong");
    expect(vm.selected?.draft_id).toBe(draft.draft_id);
    expect(vm.selected?.bundle_id).toBe(draft.bundle_id);
    expect(vm.selected?.ir_id).toBe(draft.ir_id);
    expect(vm.selected?.content_sha256).toBe(draft.content_sha256);
    expect(vm.selected?.storage_scope_id).toBe(draft.storage_scope_id);
    expect(vm.selected?.created_at).toBe(draft.created_at);
    expect(vm.selected?.status).toBe("draft");
    expect(vm.selected?.updated_at).toBe(TS2);
    expect(vm.items.find((i) => i.draft_id === "d1")?.issue_type).toBe("nko");
    expect(changed).toHaveBeenCalled();
  });

  it("stale edit reloads current draft and blocks overwrite; retry succeeds", async () => {
    await seedDraft(sharedDb, "d1", makeInput());
    await putInstalledBundleMeta(sharedDb, meta());
    const { session, models } = createSession({
      ownership: "caller_owned",
      now: () => TS3,
    });
    await session.load();
    await session.openDetail("d1");
    session.startEdit();

    // Concurrent update makes the opened expected_updated_at stale.
    const concurrent = await updateCorrectionDraft(
      sharedDb,
      {
        draft_id: "d1",
        expected_updated_at: TS,
        issue_type: "example",
        mode: "problem_report",
        target: { type: "headword" },
        display_snapshot: { headword_latin: "kùn" },
        problem_description: "Updated elsewhere",
      },
      { now: () => TS2 },
    );
    expect(concurrent.ok).toBe(true);

    session.setEditProblemDescription("My concurrent edit");
    await session.saveEdit();
    expect(lastVm(models).errorCode).toBe("stale_draft");
    expect(lastVm(models).phase).toBe("editing");
    expect(lastVm(models).selected?.problem_description).toBe("Updated elsewhere");
    expect(lastVm(models).selected?.updated_at).toBe(TS2);

    session.setEditProblemDescription("Retry after reload");
    await session.saveEdit();
    expect(lastVm(models).phase).toBe("detail");
    expect(lastVm(models).selected?.problem_description).toBe("Retry after reload");
    expect(lastVm(models).errorCode).toBeUndefined();
  });

  it("confirmed delete refreshes list; cancelled delete keeps draft", async () => {
    await seedDraft(sharedDb, "keep", makeInput({ ir_id: "lex-keep" }));
    await seedDraft(
      sharedDb,
      "gone",
      makeInput({ ir_id: "lex-gone", display_snapshot: { headword_latin: "gone" } }),
    );
    const changed = vi.fn();
    const { session, models } = createSession({
      ownership: "caller_owned",
      onDraftsChanged: changed,
    });
    await session.load();
    await session.openDetail("gone");
    session.requestDelete();
    expect(lastVm(models).phase).toBe("confirm_delete");
    session.cancelDelete();
    expect(lastVm(models).phase).toBe("detail");
    expect(await getCorrectionDraft(sharedDb, "gone")).toBeTruthy();

    session.requestDelete();
    await session.confirmDelete();
    expect(lastVm(models).phase).toBe("list");
    expect(lastVm(models).items.map((i) => i.draft_id)).toEqual(["keep"]);
    expect(await getCorrectionDraft(sharedDb, "gone")).toBeUndefined();
    expect(changed).toHaveBeenCalled();
  });

  it("stale delete is blocked and does not remove the draft", async () => {
    await seedDraft(sharedDb, "d1", makeInput());
    const { session, models } = createSession({ ownership: "caller_owned" });
    await session.load();
    await session.openDetail("d1");
    session.requestDelete();

    await updateCorrectionDraft(
      sharedDb,
      {
        draft_id: "d1",
        expected_updated_at: TS,
        issue_type: "other",
        mode: "problem_report",
        target: { type: "headword" },
        display_snapshot: { headword_latin: "kùn" },
        problem_description: "Touched",
      },
      { now: () => TS2 },
    );

    await session.confirmDelete();
    expect(lastVm(models).errorCode).toBe("stale_draft");
    expect(await getCorrectionDraft(sharedDb, "d1")).toBeTruthy();
  });

  it("generation invalidation ignores stale async results", async () => {
    await seedDraft(sharedDb, "d1", makeInput());
    let current = true;
    const { session, models } = createSession({
      ownership: "caller_owned",
      isCurrent: () => current,
    });
    const loadPromise = session.load();
    current = false;
    await loadPromise;
    expect(models.filter((m) => m.phase === "list" || m.phase === "empty")).toHaveLength(0);
  });

  it("closes controller-owned DB connections", async () => {
    await seedDraft(sharedDb, "d1", makeInput());
    const { session } = createSession({ ownership: "controller_owned" });
    await session.load();
    expect(opened.length).toBeGreaterThan(0);
    expect(opened.every((o) => o.closed)).toBe(true);
  });

  it("export-all downloads once, leaves drafts unchanged, and allows repeat", async () => {
    await seedDraft(sharedDb, "d1", makeInput());
    await seedDraft(
      sharedDb,
      "d2",
      makeInput({ ir_id: "lex-2", display_snapshot: { headword_latin: "aba" } }),
    );
    const download = vi.fn();
    const { session, models } = createSession({
      ownership: "caller_owned",
      now: () => "2026-07-31T22:30:00.000Z",
      downloadArtifact: download,
    });
    await session.load();
    expect(lastVm(models).draftCount).toBe(2);

    // Empty export path: disabled when count is zero — covered by session guard.
    const empty = createCorrectionManagementSession({
      openDb: async () => sharedDb,
      dbOwnership: "caller_owned",
      now: () => TS,
      isCurrent: () => true,
      onModel: () => undefined,
    });
    // freshly empty db path checked separately below

    const before = await listCorrectionDrafts(sharedDb);
    await session.exportAll();
    expect(download).toHaveBeenCalledTimes(1);
    expect(lastVm(models).phase).toBe("exported");
    expect(lastVm(models).exportFilename).toMatch(/siralex-correction-feedback-/);
    expect(lastVm(models).exportDraftCount).toBe(2);
    expect(await listCorrectionDrafts(sharedDb)).toEqual(before);

    session.acknowledgeExport();
    await session.exportAll();
    expect(download).toHaveBeenCalledTimes(2);

    void empty;
  });

  it("empty export is a no-op when draftCount is zero", async () => {
    const download = vi.fn();
    const { session, models } = createSession({
      ownership: "caller_owned",
      downloadArtifact: download,
    });
    await session.load();
    expect(lastVm(models).phase).toBe("empty");
    await session.exportAll();
    expect(download).not.toHaveBeenCalled();
    expect(lastVm(models).phase).toBe("empty");
  });

  it("does not touch Learning or query-log stores during edit/delete/export", async () => {
    await seedDraft(sharedDb, "d1", makeInput());
    await putInstalledBundleMeta(sharedDb, meta());

    const count = async (name: string) => {
      const tx = sharedDb.transaction(name, "readonly");
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

    const learningBefore = await count(STORE_LEARNING_RECORDS);
    const queryBefore = await count(STORE_QUERY_LOGS);

    const download = vi.fn();
    const { session } = createSession({
      ownership: "caller_owned",
      now: () => TS2,
      downloadArtifact: download,
    });
    await session.load();
    await session.openDetail("d1");
    session.startEdit();
    session.setEditProblemDescription("Edited text");
    await session.saveEdit();
    await session.exportAll();
    session.requestDelete();
    await session.confirmDelete();

    expect(await count(STORE_LEARNING_RECORDS)).toBe(learningBefore);
    expect(await count(STORE_QUERY_LOGS)).toBe(queryBefore);
  });
});
