import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  deleteSiralexDb,
  openSiralexDb,
  putInstalledBundleMeta,
  type ActiveBundleMeta,
} from "../idb/siralex_db";
import type { EnrichedRecord } from "../types/records";
import {
  countCorrectionDrafts,
  createCorrectionDraft,
  type CreateCorrectionDraftResult,
} from "./correction_draft_store";
import { createCorrectionFormController } from "./correction_form_controller";
import {
  buildCorrectionEntryContext,
  type CorrectionFormViewModel,
} from "./correction_form_model";

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
});

afterEach(() => {
  try {
    sharedDb.close();
  } catch {
    // already closed in controller-owned tests that reopen
  }
});

describe("correction form controller", () => {
  it("saves once with exact provenance/target/snapshot and coalesces double Save", async () => {
    const active = meta();
    const context = buildCorrectionEntryContext(lexicon(), active)!;
    const models: CorrectionFormViewModel[] = [];
    const createDraft = vi.fn(
      async (...args: Parameters<typeof createCorrectionDraft>) => createCorrectionDraft(...args),
    );
    const onDraftSaved = vi.fn();
    const onCancel = vi.fn();
    const controller = createCorrectionFormController({
      context,
      openDb: async () => sharedDb,
      dbOwnership: "caller_owned",
      getActiveMeta: () => active,
      isCurrent: () => true,
      onModel: (vm) => {
        models.push(vm);
      },
      onCancel,
      onBackToEntry: () => undefined,
      onDraftSaved,
      createDraft,
      resolveLiveEntry: async () => lexicon(),
    });

    controller.start();
    controller.setIssueType("spelling");
    controller.setTargetKey("translation:0:fr");
    controller.setProblemDescription("Gloss looks wrong");
    controller.setMode("proposed_correction");
    controller.setProposedValue("crâne");

    await Promise.all([controller.save(), controller.save()]);

    expect(createDraft).toHaveBeenCalledTimes(1);
    const input = createDraft.mock.calls[0]![1];
    expect(input.bundle_id).toBe("bundle_a");
    expect(input.ir_id).toBe("lex-1");
    expect(input.content_sha256).toBe(HASH);
    expect(input.storage_scope_id).toBe(`bundle_a::${HASH}`);
    expect(input.target).toEqual({
      type: "translation",
      sense_index: 0,
      gloss_lang: "fr",
    });
    expect(input.display_snapshot.selected_gloss).toBe("tête");
    expect(input.problem_description).toBe("Gloss looks wrong");
    expect(input.proposed_value).toBe("crâne");
    expect(await countCorrectionDrafts(sharedDb)).toBe(1);
    expect(models.some((m) => m.state === "saved")).toBe(true);
    expect(onDraftSaved).toHaveBeenCalledTimes(1);

    await controller.save();
    expect(createDraft).toHaveBeenCalledTimes(1);

    controller.cancel();
    expect(onCancel).toHaveBeenCalled();
  });

  it("blocks invalid fields and maps store failures; retry after failure works", async () => {
    const active = meta();
    const context = buildCorrectionEntryContext(lexicon(), active)!;
    let failOnce = true;
    const createDraft = vi.fn(
      async (): Promise<CreateCorrectionDraftResult> => {
        if (failOnce) {
          failOnce = false;
          return { ok: false, code: "id_generation_failed" };
        }
        return {
          ok: true,
          draft: {
            schema_version: "correction_draft_v1",
            draft_id: "d1",
            bundle_id: context.bundle_id,
            ir_id: context.ir_id,
            ir_kind: "lexicon_entry",
            content_sha256: context.content_sha256,
            storage_scope_id: context.storage_scope_id,
            issue_type: "other",
            mode: "problem_report",
            target: { type: "entry" },
            display_snapshot: { headword_latin: "kùn" },
            problem_description: "x",
            created_at: "2026-07-31T18:00:00.000Z",
            updated_at: "2026-07-31T18:00:00.000Z",
            status: "draft",
          },
        };
      },
    );
    let last: CorrectionFormViewModel | undefined;
    const controller = createCorrectionFormController({
      context,
      openDb: async () => sharedDb,
      dbOwnership: "caller_owned",
      getActiveMeta: () => active,
      isCurrent: () => true,
      onModel: (vm) => {
        last = vm;
      },
      onCancel: () => undefined,
      onBackToEntry: () => undefined,
      createDraft,
      resolveLiveEntry: async () => lexicon(),
    });

    await controller.save();
    expect(createDraft).not.toHaveBeenCalled();
    expect(last?.state).toBe("invalid");

    controller.setIssueType("other");
    controller.setProblemDescription("needs note");
    await controller.save();
    expect(createDraft).toHaveBeenCalledTimes(1);
    expect(last?.state).toBe("error");
    expect(last?.errorCode).toBe("id_generation_failed");

    await controller.save();
    expect(createDraft).toHaveBeenCalledTimes(2);
    expect(last?.state).toBe("saved");
  });

  it("marks stale on bundle hash change and blocks Save", async () => {
    let active: ActiveBundleMeta | undefined = meta();
    const context = buildCorrectionEntryContext(lexicon(), active)!;
    const createDraft = vi.fn();
    let last: CorrectionFormViewModel | undefined;
    const controller = createCorrectionFormController({
      context,
      openDb: async () => sharedDb,
      dbOwnership: "caller_owned",
      getActiveMeta: () => active,
      isCurrent: () => true,
      onModel: (vm) => {
        last = vm;
      },
      onCancel: () => undefined,
      onBackToEntry: () => undefined,
      createDraft,
      resolveLiveEntry: async () => lexicon(),
    });
    controller.setIssueType("spelling");
    controller.setProblemDescription("note");

    active = meta({
      expected_content_sha256: HASH_B,
      storage_scope_id: `bundle_a::${HASH_B}`,
    });
    controller.notifyBundleLifecycleChanged();
    expect(last?.state).toBe("stale_context");
    await controller.save();
    expect(createDraft).not.toHaveBeenCalled();
  });

  it("marks stale when active meta or live entry disappears", async () => {
    const context = buildCorrectionEntryContext(lexicon(), meta())!;
    const createDraft = vi.fn();
    let last: CorrectionFormViewModel | undefined;
    const controller = createCorrectionFormController({
      context,
      openDb: async () => sharedDb,
      dbOwnership: "caller_owned",
      getActiveMeta: () => undefined,
      isCurrent: () => true,
      onModel: (vm) => {
        last = vm;
      },
      onCancel: () => undefined,
      onBackToEntry: () => undefined,
      createDraft,
      resolveLiveEntry: async () => undefined,
    });
    controller.setIssueType("spelling");
    controller.setProblemDescription("note");
    await controller.save();
    expect(last?.state).toBe("stale_context");
    expect(createDraft).not.toHaveBeenCalled();
  });

  it("ignores stale host navigation during save verification", async () => {
    const active = meta();
    const context = buildCorrectionEntryContext(lexicon(), active)!;
    let current = true;
    const createDraft = vi.fn();
    let last: CorrectionFormViewModel | undefined;
    const controller = createCorrectionFormController({
      context,
      openDb: async () => sharedDb,
      dbOwnership: "caller_owned",
      getActiveMeta: () => active,
      isCurrent: () => current,
      onModel: (vm) => {
        last = vm;
      },
      onCancel: () => undefined,
      onBackToEntry: () => undefined,
      createDraft,
      resolveLiveEntry: async () => {
        current = false;
        return lexicon();
      },
    });
    controller.setIssueType("other");
    controller.setProblemDescription("x");
    await controller.save();
    expect(createDraft).not.toHaveBeenCalled();
    expect(last?.state).toBe("stale_context");
  });

  it("leaves caller-owned DB open when explicitly configured", async () => {
    const active = meta();
    await putInstalledBundleMeta(sharedDb, active);
    const context = buildCorrectionEntryContext(lexicon(), active)!;
    const tracked = trackDb(sharedDb);
    let last: CorrectionFormViewModel | undefined;
    const controller = createCorrectionFormController({
      context,
      openDb: async () => tracked.db,
      dbOwnership: "caller_owned",
      getActiveMeta: () => active,
      isCurrent: () => true,
      onModel: (vm) => {
        last = vm;
      },
      onCancel: () => undefined,
      onBackToEntry: () => undefined,
      resolveLiveEntry: async () => lexicon(),
    });
    controller.setIssueType("nko");
    controller.setTargetKey("nko");
    controller.setProblemDescription("N’Ko form issue");
    await controller.save();
    expect(last?.state).toBe("saved");
    expect(tracked.closed).toBe(false);
    expect(await countCorrectionDrafts(tracked.db)).toBe(1);
  });
});

describe("CF1I3A database ownership", () => {
  it("closes fresh verification and save connections under controller_owned", async () => {
    const active = meta();
    const context = buildCorrectionEntryContext(lexicon(), active)!;
    const opened: TrackedDb[] = [];
    const controller = createCorrectionFormController({
      context,
      openDb: () => productionOpenDb(opened),
      dbOwnership: "controller_owned",
      getActiveMeta: () => active,
      isCurrent: () => true,
      onModel: () => undefined,
      onCancel: () => undefined,
      onBackToEntry: () => undefined,
      resolveLiveEntry: async () => lexicon(),
    });
    controller.setIssueType("other");
    controller.setProblemDescription("note");
    await controller.save();

    // One connection for verify + one for save.
    expect(opened.length).toBe(2);
    expect(opened.every((entry) => entry.closed)).toBe(true);
  });

  it("closes save connection after store failure", async () => {
    const active = meta();
    const context = buildCorrectionEntryContext(lexicon(), active)!;
    const opened: TrackedDb[] = [];
    const controller = createCorrectionFormController({
      context,
      openDb: () => productionOpenDb(opened),
      dbOwnership: "controller_owned",
      getActiveMeta: () => active,
      isCurrent: () => true,
      onModel: () => undefined,
      onCancel: () => undefined,
      onBackToEntry: () => undefined,
      createDraft: async () => ({ ok: false, code: "database_write_failed" }),
      resolveLiveEntry: async () => lexicon(),
    });
    controller.setIssueType("other");
    controller.setProblemDescription("note");
    await controller.save();
    expect(opened.length).toBe(2);
    expect(opened.every((entry) => entry.closed)).toBe(true);
  });

  it("closes save connection after thrown error", async () => {
    const active = meta();
    const context = buildCorrectionEntryContext(lexicon(), active)!;
    const opened: TrackedDb[] = [];
    const controller = createCorrectionFormController({
      context,
      openDb: () => productionOpenDb(opened),
      dbOwnership: "controller_owned",
      getActiveMeta: () => active,
      isCurrent: () => true,
      onModel: () => undefined,
      onCancel: () => undefined,
      onBackToEntry: () => undefined,
      createDraft: async () => {
        throw new Error("boom");
      },
      resolveLiveEntry: async () => lexicon(),
    });
    controller.setIssueType("other");
    controller.setProblemDescription("note");
    await controller.save();
    expect(opened.length).toBe(2);
    expect(opened.every((entry) => entry.closed)).toBe(true);
  });

  it("closes verification connection when live entry is stale/missing", async () => {
    const active = meta();
    const context = buildCorrectionEntryContext(lexicon(), active)!;
    const opened: TrackedDb[] = [];
    const controller = createCorrectionFormController({
      context,
      openDb: () => productionOpenDb(opened),
      dbOwnership: "controller_owned",
      getActiveMeta: () => active,
      isCurrent: () => true,
      onModel: () => undefined,
      onCancel: () => undefined,
      onBackToEntry: () => undefined,
      resolveLiveEntry: async () => undefined,
    });
    controller.setIssueType("other");
    controller.setProblemDescription("note");
    await controller.save();
    expect(opened.length).toBe(1);
    expect(opened[0]!.closed).toBe(true);
  });
});

describe("CF1I3A post-commit invalidation", () => {
  it("invokes onDraftSaved once when host goes stale after successful commit", async () => {
    const active = meta();
    const context = buildCorrectionEntryContext(lexicon(), active)!;
    let current = true;
    const onDraftSaved = vi.fn();
    const models: CorrectionFormViewModel[] = [];
    const createDraft = vi.fn(
      async (...args: Parameters<typeof createCorrectionDraft>) => {
        const result = await createCorrectionDraft(...args);
        current = false; // host invalidated after IndexedDB commit returns
        return result;
      },
    );
    const controller = createCorrectionFormController({
      context,
      openDb: async () => sharedDb,
      dbOwnership: "caller_owned",
      getActiveMeta: () => active,
      isCurrent: () => current,
      onModel: (vm) => {
        models.push(vm);
      },
      onCancel: () => undefined,
      onBackToEntry: () => undefined,
      onDraftSaved,
      createDraft,
      resolveLiveEntry: async () => lexicon(),
    });
    controller.setIssueType("other");
    controller.setProblemDescription("persisted note");
    await controller.save();

    expect(createDraft).toHaveBeenCalledTimes(1);
    expect(onDraftSaved).toHaveBeenCalledTimes(1);
    expect(models.some((m) => m.state === "saved")).toBe(false);
    expect(await countCorrectionDrafts(sharedDb)).toBe(1);
  });

  it("invokes onDraftSaved once when disposed after successful commit", async () => {
    const active = meta();
    const context = buildCorrectionEntryContext(lexicon(), active)!;
    const onDraftSaved = vi.fn();
    const models: CorrectionFormViewModel[] = [];
    let controller: ReturnType<typeof createCorrectionFormController>;
    const createDraft = vi.fn(
      async (...args: Parameters<typeof createCorrectionDraft>) => {
        const result = await createCorrectionDraft(...args);
        controller.dispose();
        return result;
      },
    );
    controller = createCorrectionFormController({
      context,
      openDb: async () => sharedDb,
      dbOwnership: "caller_owned",
      getActiveMeta: () => active,
      isCurrent: () => true,
      onModel: (vm) => {
        models.push(vm);
      },
      onCancel: () => undefined,
      onBackToEntry: () => undefined,
      onDraftSaved,
      createDraft,
      resolveLiveEntry: async () => lexicon(),
    });
    controller.setIssueType("other");
    controller.setProblemDescription("persisted after dispose");
    await controller.save();

    expect(onDraftSaved).toHaveBeenCalledTimes(1);
    expect(models.some((m) => m.state === "saved")).toBe(false);
    expect(await countCorrectionDrafts(sharedDb)).toBe(1);
  });
});
