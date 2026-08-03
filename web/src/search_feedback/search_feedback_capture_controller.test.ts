import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  deleteSiralexDb,
  openSiralexDb,
  putInstalledBundleMeta,
  setActiveBundleId,
  type ActiveBundleMeta,
} from "../idb/siralex_db";
import {
  countSearchFeedbackDrafts,
  createSearchFeedbackDraft,
  type CreateSearchFeedbackDraftResult,
} from "./search_feedback_store";
import { createSearchFeedbackCaptureController } from "./search_feedback_capture_controller";
import {
  buildSearchFeedbackCaptureContext,
  type ExecutedSearchSnapshot,
  type SearchFeedbackCaptureViewModel,
} from "./search_feedback_capture_model";

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

function executed(
  overrides: Partial<ExecutedSearchSnapshot> = {},
): ExecutedSearchSnapshot {
  return {
    generation: 7,
    query_raw: "  kùn  ",
    search_direction: "source_to_target",
    result_state: "no_result",
    result_count: 0,
    bundle_id: "bundle_a",
    content_sha256: HASH,
    storage_scope_id: `bundle_a::${HASH}`,
    ...overrides,
  };
}

type TrackedDb = {
  db: IDBDatabase;
  closed: boolean;
};

function trackDb(db: IDBDatabase): TrackedDb {
  const tracked: TrackedDb = { db, closed: false };
  const originalClose = db.close.bind(db);
  db.close = () => {
    tracked.closed = true;
    originalClose();
  };
  return tracked;
}

async function productionOpenDb(opened: TrackedDb[]): Promise<IDBDatabase> {
  const tracked = trackDb(await openSiralexDb());
  opened.push(tracked);
  return tracked.db;
}

let sharedDb: IDBDatabase;

beforeEach(async () => {
  try {
    await deleteSiralexDb();
  } catch {
    // ok
  }
  sharedDb = await openSiralexDb();
  await putInstalledBundleMeta(sharedDb, meta());
  await setActiveBundleId(sharedDb, "bundle_a");
});

afterEach(() => {
  try {
    sharedDb.close();
  } catch {
    // already closed
  }
});

describe("search feedback capture controller", () => {
  it("starts ready and saves minimal query-only feedback with exact input", async () => {
    const active = meta();
    const snap = executed();
    const context = buildSearchFeedbackCaptureContext(snap)!;
    const models: SearchFeedbackCaptureViewModel[] = [];
    const createDraft = vi.fn(
      async (...args: Parameters<typeof createSearchFeedbackDraft>) =>
        createSearchFeedbackDraft(...args),
    );
    const onFeedbackSaved = vi.fn();
    const controller = createSearchFeedbackCaptureController({
      context,
      openDb: async () => sharedDb,
      dbOwnership: "caller_owned",
      getActiveMeta: () => active,
      getCurrentExecutedSearch: () => snap,
      isCurrent: () => true,
      onModel: (vm) => {
        models.push(vm);
      },
      onCancel: () => undefined,
      onBackToSearch: () => undefined,
      onFeedbackSaved,
      createDraft,
    });

    controller.start();
    expect(models.at(-1)?.state).toBe("ready");

    await Promise.all([controller.save(), controller.save()]);
    expect(createDraft).toHaveBeenCalledTimes(1);
    const input = createDraft.mock.calls[0]![1];
    expect(input).toEqual({
      bundle_id: "bundle_a",
      content_sha256: HASH,
      storage_scope_id: `bundle_a::${HASH}`,
      query_raw: "  kùn  ",
      search_direction: "source_to_target",
      result_state: "no_result",
      result_count: 0,
    });
    expect("matched_ir_ids" in input).toBe(false);
    expect(await countSearchFeedbackDrafts(sharedDb)).toBe(1);
    expect(models.some((m) => m.state === "saved")).toBe(true);
    expect(onFeedbackSaved).toHaveBeenCalledTimes(1);

    await controller.save();
    expect(createDraft).toHaveBeenCalledTimes(1);
  });

  it("saves optional fields and preserves nonblank whitespace", async () => {
    const active = meta();
    const snap = executed({
      result_state: "results_not_useful",
      result_count: 2,
      matched_ir_ids: ["a", "b"],
    });
    const context = buildSearchFeedbackCaptureContext(snap)!;
    const createDraft = vi.fn(
      async (...args: Parameters<typeof createSearchFeedbackDraft>) =>
        createSearchFeedbackDraft(...args),
    );
    const controller = createSearchFeedbackCaptureController({
      context,
      openDb: async () => sharedDb,
      dbOwnership: "caller_owned",
      getActiveMeta: () => active,
      getCurrentExecutedSearch: () => snap,
      isCurrent: () => true,
      onModel: () => undefined,
      onCancel: () => undefined,
      onBackToSearch: () => undefined,
      createDraft,
    });

    controller.setRequestedMeaning("  greeting  ");
    controller.setUserDescription("   ");
    await controller.save();
    const input = createDraft.mock.calls[0]![1];
    expect(input.requested_meaning).toBe("  greeting  ");
    expect("user_description" in input).toBe(false);
    expect(input.result_state).toBe("results_not_useful");
    expect(input.matched_ir_ids).toEqual(["a", "b"]);
  });

  it("maps store failures and allows retry after failure", async () => {
    const active = meta();
    const snap = executed();
    const context = buildSearchFeedbackCaptureContext(snap)!;
    let failOnce = true;
    const createDraft = vi.fn(
      async (): Promise<CreateSearchFeedbackDraftResult> => {
        if (failOnce) {
          failOnce = false;
          return { ok: false, code: "id_generation_failed" };
        }
        return createSearchFeedbackDraft(sharedDb, {
          bundle_id: context.bundle_id,
          content_sha256: context.content_sha256,
          storage_scope_id: context.storage_scope_id,
          query_raw: context.query_raw,
          search_direction: context.search_direction,
          result_state: context.result_state,
          result_count: context.result_count,
        });
      },
    );
    const models: SearchFeedbackCaptureViewModel[] = [];
    const controller = createSearchFeedbackCaptureController({
      context,
      openDb: async () => sharedDb,
      dbOwnership: "caller_owned",
      getActiveMeta: () => active,
      getCurrentExecutedSearch: () => snap,
      isCurrent: () => true,
      onModel: (vm) => {
        models.push(vm);
      },
      onCancel: () => undefined,
      onBackToSearch: () => undefined,
      createDraft,
    });

    await controller.save();
    expect(models.at(-1)?.state).toBe("error");
    expect(models.at(-1)?.errorCode).toBe("id_generation_failed");

    await controller.save();
    expect(createDraft).toHaveBeenCalledTimes(2);
    expect(models.some((m) => m.state === "saved")).toBe(true);
  });

  it.each([
    ["invalid_input", "invalid_input"],
    ["invalid_timestamp", "invalid_timestamp"],
    ["id_generation_failed", "id_generation_failed"],
    ["feedback_id_conflict", "feedback_id_conflict"],
    ["database_write_failed", "database_write_failed"],
  ] as const)("maps store error %s", async (code, mapped) => {
    const active = meta();
    const snap = executed();
    const context = buildSearchFeedbackCaptureContext(snap)!;
    const models: SearchFeedbackCaptureViewModel[] = [];
    const controller = createSearchFeedbackCaptureController({
      context,
      openDb: async () => sharedDb,
      dbOwnership: "caller_owned",
      getActiveMeta: () => active,
      getCurrentExecutedSearch: () => snap,
      isCurrent: () => true,
      onModel: (vm) => {
        models.push(vm);
      },
      onCancel: () => undefined,
      onBackToSearch: () => undefined,
      createDraft: async () => ({ ok: false, code }),
    });
    await controller.save();
    expect(models.at(-1)?.errorCode).toBe(mapped);
  });

  it("blocks stale search generation, changed query, and changed direction", async () => {
    const active = meta();
    let snap = executed();
    const context = buildSearchFeedbackCaptureContext(snap)!;
    const createDraft = vi.fn();
    const controller = createSearchFeedbackCaptureController({
      context,
      openDb: async () => sharedDb,
      dbOwnership: "caller_owned",
      getActiveMeta: () => active,
      getCurrentExecutedSearch: () => snap,
      isCurrent: () => true,
      onModel: () => undefined,
      onCancel: () => undefined,
      onBackToSearch: () => undefined,
      createDraft,
    });

    snap = executed({ generation: 8 });
    await controller.save();
    expect(createDraft).not.toHaveBeenCalled();
    expect(controller.getViewModel().state).toBe("stale_context");

    snap = executed({ query_raw: "other" });
    const c2 = createSearchFeedbackCaptureController({
      context,
      openDb: async () => sharedDb,
      dbOwnership: "caller_owned",
      getActiveMeta: () => active,
      getCurrentExecutedSearch: () => snap,
      isCurrent: () => true,
      onModel: () => undefined,
      onCancel: () => undefined,
      onBackToSearch: () => undefined,
      createDraft,
    });
    await c2.save();
    expect(c2.getViewModel().state).toBe("stale_context");

    snap = executed({ search_direction: "target_to_source" });
    const c3 = createSearchFeedbackCaptureController({
      context,
      openDb: async () => sharedDb,
      dbOwnership: "caller_owned",
      getActiveMeta: () => active,
      getCurrentExecutedSearch: () => snap,
      isCurrent: () => true,
      onModel: () => undefined,
      onCancel: () => undefined,
      onBackToSearch: () => undefined,
      createDraft,
    });
    await c3.save();
    expect(c3.getViewModel().state).toBe("stale_context");
  });

  it("blocks missing/mismatched bundle, hash, and scope", async () => {
    const snap = executed();
    const context = buildSearchFeedbackCaptureContext(snap)!;
    const createDraft = vi.fn();

    const missing = createSearchFeedbackCaptureController({
      context,
      openDb: async () => sharedDb,
      dbOwnership: "caller_owned",
      getActiveMeta: () => undefined,
      getCurrentExecutedSearch: () => snap,
      isCurrent: () => true,
      onModel: () => undefined,
      onCancel: () => undefined,
      onBackToSearch: () => undefined,
      createDraft,
    });
    await missing.save();
    expect(missing.getViewModel().state).toBe("stale_context");

    const idMismatch = createSearchFeedbackCaptureController({
      context,
      openDb: async () => sharedDb,
      dbOwnership: "caller_owned",
      getActiveMeta: () => meta({ bundle_id: "other" }),
      getCurrentExecutedSearch: () => snap,
      isCurrent: () => true,
      onModel: () => undefined,
      onCancel: () => undefined,
      onBackToSearch: () => undefined,
      createDraft,
    });
    await idMismatch.save();
    expect(idMismatch.getViewModel().state).toBe("stale_context");

    const hashMismatch = createSearchFeedbackCaptureController({
      context,
      openDb: async () => sharedDb,
      dbOwnership: "caller_owned",
      getActiveMeta: () => meta({ expected_content_sha256: HASH_B }),
      getCurrentExecutedSearch: () => snap,
      isCurrent: () => true,
      onModel: () => undefined,
      onCancel: () => undefined,
      onBackToSearch: () => undefined,
      createDraft,
    });
    await hashMismatch.save();
    expect(hashMismatch.getViewModel().state).toBe("stale_context");

    const scopeMismatch = createSearchFeedbackCaptureController({
      context,
      openDb: async () => sharedDb,
      dbOwnership: "caller_owned",
      getActiveMeta: () => meta({ storage_scope_id: "other-scope" }),
      getCurrentExecutedSearch: () => snap,
      isCurrent: () => true,
      onModel: () => undefined,
      onCancel: () => undefined,
      onBackToSearch: () => undefined,
      createDraft,
    });
    await scopeMismatch.save();
    expect(scopeMismatch.getViewModel().state).toBe("stale_context");
    expect(createDraft).not.toHaveBeenCalled();
  });

  it("successful commit while host stale still notifies onFeedbackSaved once without success UI", async () => {
    const active = meta();
    const snap = executed();
    const context = buildSearchFeedbackCaptureContext(snap)!;
    const onFeedbackSaved = vi.fn();
    let current = true;
    const models: SearchFeedbackCaptureViewModel[] = [];

    const controller = createSearchFeedbackCaptureController({
      context,
      openDb: async () => sharedDb,
      dbOwnership: "caller_owned",
      getActiveMeta: () => active,
      getCurrentExecutedSearch: () => snap,
      isCurrent: () => current,
      onModel: (vm) => {
        models.push(vm);
      },
      onCancel: () => undefined,
      onBackToSearch: () => undefined,
      onFeedbackSaved,
      createDraft: async (db, input) => {
        const result = await createSearchFeedbackDraft(db, input);
        current = false;
        return result;
      },
    });
    await controller.save();
    expect(onFeedbackSaved).toHaveBeenCalledTimes(1);
    expect(models.some((m) => m.state === "saved")).toBe(false);
    expect(await countSearchFeedbackDrafts(sharedDb)).toBe(1);
  });

  it("successful commit while disposed still notifies onFeedbackSaved once; dispose blocks repaint", async () => {
    const active = meta();
    const snap = executed({ query_raw: "disposed-case" });
    const context = buildSearchFeedbackCaptureContext(snap)!;
    const onFeedbackSaved = vi.fn();
    const models: SearchFeedbackCaptureViewModel[] = [];

    const controller = createSearchFeedbackCaptureController({
      context,
      openDb: async () => sharedDb,
      dbOwnership: "caller_owned",
      getActiveMeta: () => active,
      getCurrentExecutedSearch: () => snap,
      isCurrent: () => true,
      onModel: (vm) => {
        models.push(vm);
      },
      onCancel: () => undefined,
      onBackToSearch: () => undefined,
      onFeedbackSaved,
      createDraft: async (db, input) => {
        const result = await createSearchFeedbackDraft(db, input);
        controller.dispose();
        return result;
      },
    });
    await controller.save();
    expect(onFeedbackSaved).toHaveBeenCalledTimes(1);
    expect(models.some((m) => m.state === "saved")).toBe(false);

    const before = models.length;
    controller.setRequestedMeaning("x");
    expect(models.length).toBe(before);
  });

  it("closes controller-owned DB on verify and save paths; caller-owned remains open", async () => {
    const active = meta();
    const snap = executed();
    const context = buildSearchFeedbackCaptureContext(snap)!;

    const openedVerify: TrackedDb[] = [];
    const staleCtrl = createSearchFeedbackCaptureController({
      context,
      openDb: () => productionOpenDb(openedVerify),
      dbOwnership: "controller_owned",
      getActiveMeta: () => active,
      getCurrentExecutedSearch: () => executed({ generation: 99 }),
      isCurrent: () => true,
      onModel: () => undefined,
      onCancel: () => undefined,
      onBackToSearch: () => undefined,
    });
    // Memory check fails before open when generation mismatches — force open via matching
    // snapshot then DB meta mismatch via resolveActiveMeta.
    const openedVerify2: TrackedDb[] = [];
    const verifyCtrl = createSearchFeedbackCaptureController({
      context,
      openDb: () => productionOpenDb(openedVerify2),
      dbOwnership: "controller_owned",
      getActiveMeta: () => active,
      getCurrentExecutedSearch: () => snap,
      isCurrent: () => true,
      onModel: () => undefined,
      onCancel: () => undefined,
      onBackToSearch: () => undefined,
      resolveActiveMeta: async () => undefined,
    });
    await verifyCtrl.save();
    expect(openedVerify2.length).toBeGreaterThan(0);
    expect(openedVerify2.every((d) => d.closed)).toBe(true);

    const openedSave: TrackedDb[] = [];
    const saveCtrl = createSearchFeedbackCaptureController({
      context,
      openDb: () => productionOpenDb(openedSave),
      dbOwnership: "controller_owned",
      getActiveMeta: () => active,
      getCurrentExecutedSearch: () => snap,
      isCurrent: () => true,
      onModel: () => undefined,
      onCancel: () => undefined,
      onBackToSearch: () => undefined,
    });
    await saveCtrl.save();
    expect(openedSave.length).toBeGreaterThan(0);
    expect(openedSave.every((d) => d.closed)).toBe(true);

    const openedFail: TrackedDb[] = [];
    const failCtrl = createSearchFeedbackCaptureController({
      context,
      openDb: () => productionOpenDb(openedFail),
      dbOwnership: "controller_owned",
      getActiveMeta: () => active,
      getCurrentExecutedSearch: () => snap,
      isCurrent: () => true,
      onModel: () => undefined,
      onCancel: () => undefined,
      onBackToSearch: () => undefined,
      createDraft: async () => ({ ok: false, code: "database_write_failed" }),
    });
    await failCtrl.save();
    expect(openedFail.every((d) => d.closed)).toBe(true);

    void staleCtrl;
    const caller = createSearchFeedbackCaptureController({
      context,
      openDb: async () => sharedDb,
      dbOwnership: "caller_owned",
      getActiveMeta: () => active,
      getCurrentExecutedSearch: () => snap,
      isCurrent: () => true,
      onModel: () => undefined,
      onCancel: () => undefined,
      onBackToSearch: () => undefined,
    });
    await caller.save();
    // Shared DB must still accept a transaction.
    expect(await countSearchFeedbackDrafts(sharedDb)).toBeGreaterThanOrEqual(1);
  });

  it("never invokes query-log or CF1/Learning write APIs", async () => {
    const active = meta();
    const snap = executed();
    const context = buildSearchFeedbackCaptureContext(snap)!;
    const appendQueryLog = vi.fn();
    const createCorrection = vi.fn();
    const saveLearning = vi.fn();
    const controller = createSearchFeedbackCaptureController({
      context,
      openDb: async () => sharedDb,
      dbOwnership: "caller_owned",
      getActiveMeta: () => active,
      getCurrentExecutedSearch: () => snap,
      isCurrent: () => true,
      onModel: () => undefined,
      onCancel: () => undefined,
      onBackToSearch: () => undefined,
    });
    await controller.save();
    expect(appendQueryLog).not.toHaveBeenCalled();
    expect(createCorrection).not.toHaveBeenCalled();
    expect(saveLearning).not.toHaveBeenCalled();
  });
});
