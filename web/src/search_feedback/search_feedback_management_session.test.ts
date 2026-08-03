import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  STORE_CORRECTION_DRAFTS,
  STORE_LEARNING_RECORDS,
  STORE_QUERY_LOGS,
  STORE_SEARCH_FAILURE_FEEDBACK,
  deleteSiralexDb,
  openSiralexDb,
  putInstalledBundleMeta,
  type ActiveBundleMeta,
} from "../idb/siralex_db";
import {
  createSearchFeedbackManagementSession,
  deriveSearchFeedbackAvailability,
  type SearchFeedbackManagementVm,
} from "./search_feedback_management_session";
import {
  createSearchFeedbackDraft,
  getSearchFeedbackDraft,
  listSearchFeedbackDrafts,
  type CreateSearchFeedbackDraftInput,
} from "./search_feedback_store";

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
    imported_at_iso: "2026-08-02T18:00:00.000Z",
    ...overrides,
  };
}

function input(
  overrides: Partial<CreateSearchFeedbackDraftInput> = {},
): CreateSearchFeedbackDraftInput {
  return {
    bundle_id: "bundle_a",
    content_sha256: HASH,
    storage_scope_id: `bundle_a::${HASH}`,
    query_raw: "kùn",
    search_direction: "source_to_target",
    result_state: "no_result",
    result_count: 0,
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

async function countStore(db: IDBDatabase, name: string): Promise<number> {
  if (!db.objectStoreNames.contains(name)) return 0;
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

let sharedDb: IDBDatabase;
let clock = 0;

function nextIso(): string {
  clock += 1;
  return new Date(Date.UTC(2026, 7, 2, 18, 0, clock)).toISOString();
}

beforeEach(async () => {
  try {
    await deleteSiralexDb();
  } catch {
    // ok
  }
  sharedDb = await openSiralexDb();
  await putInstalledBundleMeta(sharedDb, meta());
  clock = 0;
});

afterEach(() => {
  try {
    sharedDb.close();
  } catch {
    // ok
  }
});

function createSession(options?: {
  ownership?: "controller_owned" | "caller_owned";
  isCurrent?: () => boolean;
  openDb?: () => Promise<IDBDatabase>;
  downloadArtifact?: ReturnType<typeof vi.fn>;
  onFeedbackChanged?: () => void;
  getInstalledMeta?: (
    db: IDBDatabase,
    bundleId: string,
  ) => Promise<ActiveBundleMeta | undefined>;
}) {
  const models: SearchFeedbackManagementVm[] = [];
  const session = createSearchFeedbackManagementSession({
    openDb: options?.openDb ?? (async () => sharedDb),
    dbOwnership: options?.ownership ?? "caller_owned",
    now: nextIso,
    appVersion: "test",
    isCurrent: options?.isCurrent ?? (() => true),
    onModel: (vm) => {
      models.push(vm);
    },
    onFeedbackChanged: options?.onFeedbackChanged,
    downloadArtifact: options?.downloadArtifact as never,
    getInstalledMeta: options?.getInstalledMeta,
  });
  return { session, models };
}

describe("deriveSearchFeedbackAvailability", () => {
  it("resolves current, content-diff, and unavailable", () => {
    const draft = {
      ...input(),
      schema_version: "search_failure_feedback_draft_v1" as const,
      feedback_id: "fb",
      created_at: nextIso(),
      updated_at: nextIso(),
      status: "draft" as const,
    };
    expect(deriveSearchFeedbackAvailability(draft, meta())).toBe(
      "dictionary_current",
    );
    expect(
      deriveSearchFeedbackAvailability(
        draft,
        meta({ expected_content_sha256: HASH_B }),
      ),
    ).toBe("dictionary_content_differs");
    expect(deriveSearchFeedbackAvailability(draft, undefined)).toBe(
      "dictionary_unavailable",
    );
  });
});

describe("search feedback management session", () => {
  it("loads empty then populated in management order", async () => {
    const { session, models } = createSession();
    await session.load();
    expect(models.some((m) => m.phase === "empty")).toBe(true);

    await createSearchFeedbackDraft(sharedDb, input({ query_raw: "first" }), {
      now: () => "2026-08-02T18:00:00.000Z",
      generateFeedbackId: () => "fb-a",
    });
    await createSearchFeedbackDraft(sharedDb, input({ query_raw: "second" }), {
      now: () => "2026-08-02T19:00:00.000Z",
      generateFeedbackId: () => "fb-b",
    });
    await session.load();
    const list = models.filter((m) => m.phase === "list").at(-1)!;
    expect(list.items.map((i) => i.feedback_id)).toEqual(["fb-b", "fb-a"]);
    expect(list.items[0]!.availability).toBe("dictionary_current");
  });

  it("corrupt row blocks the complete management surface", async () => {
    const tx = sharedDb.transaction(STORE_SEARCH_FAILURE_FEEDBACK, "readwrite");
    tx.objectStore(STORE_SEARCH_FAILURE_FEEDBACK).put({
      feedback_id: "bad",
      broken: true,
    });
    await new Promise<void>((resolve, reject) => {
      tx.addEventListener("complete", () => resolve());
      tx.addEventListener("error", () => reject(tx.error));
    });
    const { session, models } = createSession();
    await session.load();
    expect(models.at(-1)?.phase).toBe("error");
    expect(models.at(-1)?.errorCode).toBe("invalid_stored_feedback");
  });

  it("opens detail with availability states and edits only explanation fields", async () => {
    await createSearchFeedbackDraft(
      sharedDb,
      input({
        query_raw: "exact",
        requested_meaning: "old",
        result_state: "results_not_useful",
        result_count: 1,
        matched_ir_ids: ["lex-1"],
      }),
      { now: () => "2026-08-02T18:00:00.000Z", generateFeedbackId: () => "fb-1" },
    );
    const changed = vi.fn();
    const { session } = createSession({ onFeedbackChanged: changed });
    await session.load();
    await session.openDetail("fb-1");
    expect(session.getVm().phase).toBe("detail");
    expect(session.getVm().selected?.query_raw).toBe("exact");
    expect(session.getVm().availability).toBe("dictionary_current");

    session.startEdit();
    session.setEditRequestedMeaning("  greeting  ");
    session.setEditUserDescription("   ");
    await session.saveEdit();
    expect(session.getVm().phase).toBe("detail");
    const stored = await getSearchFeedbackDraft(sharedDb, "fb-1");
    expect(stored?.requested_meaning).toBe("  greeting  ");
    expect("user_description" in stored!).toBe(false);
    expect(stored?.query_raw).toBe("exact");
    expect(stored?.matched_ir_ids).toEqual(["lex-1"]);
    expect(stored?.updated_at).not.toBe("2026-08-02T18:00:00.000Z");
    expect(changed).toHaveBeenCalled();

    // content differs
    const { session: s2 } = createSession({
      getInstalledMeta: async () => meta({ expected_content_sha256: HASH_B }),
    });
    await s2.load();
    expect(s2.getVm().items[0]!.availability).toBe("dictionary_content_differs");

    // unavailable
    const { session: s3 } = createSession({
      getInstalledMeta: async () => undefined,
    });
    await s3.load();
    expect(s3.getVm().items[0]!.availability).toBe("dictionary_unavailable");
  });

  it("blocks stale edit/delete, reloads current, supports retry after failure", async () => {
    let nowMs = Date.parse("2026-08-02T20:00:00.000Z");
    const sessionNow = () => {
      nowMs += 1000;
      return new Date(nowMs).toISOString();
    };
    await createSearchFeedbackDraft(sharedDb, input(), {
      now: () => "2026-08-02T18:00:00.000Z",
      generateFeedbackId: () => "fb-stale",
    });
    const models: SearchFeedbackManagementVm[] = [];
    const session = createSearchFeedbackManagementSession({
      openDb: async () => sharedDb,
      dbOwnership: "caller_owned",
      now: sessionNow,
      appVersion: "test",
      isCurrent: () => true,
      onModel: (vm) => {
        models.push(vm);
      },
    });
    await session.load();
    await session.openDetail("fb-stale");
    session.startEdit();

    await createSearchFeedbackDraft(sharedDb, input({ query_raw: "other" }), {
      now: () => "2026-08-02T18:01:00.000Z",
      generateFeedbackId: () => "fb-other",
    });
    const { updateSearchFeedbackDraft } = await import("./search_feedback_store");
    await updateSearchFeedbackDraft(
      sharedDb,
      {
        feedback_id: "fb-stale",
        expected_updated_at: "2026-08-02T18:00:00.000Z",
        requested_meaning: "external",
      },
      { now: () => "2026-08-02T18:02:00.000Z" },
    );

    session.setEditRequestedMeaning("mine");
    await session.saveEdit();
    expect(session.getVm().phase).toBe("stale_edit");
    expect(session.getVm().selected?.requested_meaning).toBe("external");

    session.startEdit();
    session.setEditRequestedMeaning("retry ok");
    await session.saveEdit();
    expect(session.getVm().phase).toBe("detail");
    expect(session.getVm().selected?.requested_meaning).toBe("retry ok");

    session.requestDelete();
    expect(session.getVm().phase).toBe("confirm_delete");
    session.cancelDelete();
    expect(session.getVm().phase).toBe("detail");

    const expected = session.getVm().selected!.updated_at;
    await updateSearchFeedbackDraft(
      sharedDb,
      {
        feedback_id: "fb-stale",
        expected_updated_at: expected,
        requested_meaning: "again",
      },
      { now: () => new Date(nowMs + 60_000).toISOString() },
    );
    nowMs += 120_000;
    session.requestDelete();
    await session.confirmDelete();
    expect(session.getVm().phase).toBe("stale_delete");

    await session.openDetail("fb-stale");
    session.requestDelete();
    await session.confirmDelete();
    expect(session.getVm().phase).toBe("list");
    expect(await listSearchFeedbackDrafts(sharedDb)).toHaveLength(1);
    void models;
  });

  it("export invokes download once and does not mutate drafts; empty export no-op", async () => {
    const downloadArtifact = vi.fn();
    const empty = createSession({ downloadArtifact });
    await empty.session.load();
    await empty.session.exportAll();
    expect(downloadArtifact).not.toHaveBeenCalled();

    await createSearchFeedbackDraft(sharedDb, input(), {
      now: () => "2026-08-02T18:00:00.000Z",
      generateFeedbackId: () => "fb-x",
    });
    const { session } = createSession({ downloadArtifact });
    await session.load();
    const before = await listSearchFeedbackDrafts(sharedDb);
    await session.exportAll();
    expect(downloadArtifact).toHaveBeenCalledTimes(1);
    expect(session.getVm().phase).toBe("exported");
    expect(await listSearchFeedbackDrafts(sharedDb)).toEqual(before);
    session.acknowledgeExport();
    expect(session.getVm().phase).toBe("list");
    await session.exportAll();
    expect(downloadArtifact).toHaveBeenCalledTimes(2);
  });

  it("generation invalidation suppresses stale async rendering; DB ownership closes", async () => {
    let current = true;
    const { session, models } = createSession({ isCurrent: () => current });
    const load = session.load();
    current = false;
    await load;
    expect(models.every((m) => m.phase === "loading" || m.phase === undefined)).toBe(
      true,
    );

    const opened: TrackedDb[] = [];
    await createSearchFeedbackDraft(sharedDb, input(), {
      now: () => "2026-08-02T18:00:00.000Z",
      generateFeedbackId: () => "fb-own",
    });
    const owned = createSession({
      ownership: "controller_owned",
      openDb: async () => {
        const tracked = trackDb(await openSiralexDb());
        opened.push(tracked);
        return tracked.db;
      },
    });
    await owned.session.load();
    await owned.session.openDetail("fb-own");
    owned.session.startEdit();
    owned.session.setEditRequestedMeaning("n");
    await owned.session.saveEdit();
    expect(opened.length).toBeGreaterThan(0);
    expect(opened.every((d) => d.closed)).toBe(true);

    const callerTracked = trackDb(sharedDb);
    const caller = createSession({
      ownership: "caller_owned",
      openDb: async () => callerTracked.db,
    });
    await caller.session.load();
    expect(callerTracked.closed).toBe(false);
  });

  it("does not write query logs, CF1, or Learning stores", async () => {
    await createSearchFeedbackDraft(sharedDb, input(), {
      now: () => "2026-08-02T18:00:00.000Z",
      generateFeedbackId: () => "fb-iso",
    });
    const before = {
      ql: await countStore(sharedDb, STORE_QUERY_LOGS),
      cf1: await countStore(sharedDb, STORE_CORRECTION_DRAFTS),
      lr: await countStore(sharedDb, STORE_LEARNING_RECORDS),
    };
    const downloadArtifact = vi.fn();
    const { session } = createSession({ downloadArtifact });
    await session.load();
    await session.openDetail("fb-iso");
    session.startEdit();
    session.setEditUserDescription("note");
    await session.saveEdit();
    await session.exportAll();
    expect(await countStore(sharedDb, STORE_QUERY_LOGS)).toBe(before.ql);
    expect(await countStore(sharedDb, STORE_CORRECTION_DRAFTS)).toBe(before.cf1);
    expect(await countStore(sharedDb, STORE_LEARNING_RECORDS)).toBe(before.lr);
  });
});
