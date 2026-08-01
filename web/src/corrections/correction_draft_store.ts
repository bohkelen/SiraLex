/**
 * CF1I2 — Local correction draft IndexedDB store.
 *
 * Persists validated correction_draft_v1 rows only.
 * Does not mutate dictionary, Learning, query-log, or bundle registry stores.
 * Does not perform export, UI, Phase 1.5 conversion, or corpus mutation.
 */

import { STORE_CORRECTION_DRAFTS } from "../idb/siralex_db";
import {
  CORRECTION_DRAFT_ID_MAX_CHARS,
  CORRECTION_DRAFT_SCHEMA_VERSION,
  cloneCorrectionDraft,
  cloneCorrectionDisplaySnapshot,
  cloneCorrectionTarget,
  countUnicodeCharacters,
  isValidCorrectionIsoTimestamp,
  parseCorrectionDraft,
  validateCorrectionDraftForWrite,
  type CorrectionDisplaySnapshot,
  type CorrectionDraftV1,
  type CorrectionIssueType,
  type CorrectionMode,
  type CorrectionTarget,
} from "./correction_draft_types";

export type CreateCorrectionDraftInput = {
  bundle_id: string;
  ir_id: string;
  ir_kind: "lexicon_entry";
  content_sha256: string;
  storage_scope_id: string;
  issue_type: CorrectionIssueType;
  mode: CorrectionMode;
  target: CorrectionTarget;
  display_snapshot: CorrectionDisplaySnapshot;
  problem_description: string;
  proposed_value?: string;
};

export type UpdateCorrectionDraftInput = {
  draft_id: string;
  expected_updated_at: string;
  issue_type: CorrectionIssueType;
  mode: CorrectionMode;
  target: CorrectionTarget;
  display_snapshot: CorrectionDisplaySnapshot;
  problem_description: string;
  proposed_value?: string;
};

export type CreateCorrectionDraftDeps = {
  now?: () => string;
  generateDraftId?: () => string;
  /** @internal Test-only: invoked after add is queued, before tx completion. */
  afterWriteQueued?: () => void | Promise<void>;
};

export type UpdateCorrectionDraftDeps = {
  now?: () => string;
  /** @internal Test-only: invoked after put is queued, before tx completion. */
  afterWriteQueued?: () => void | Promise<void>;
};

export type DeleteCorrectionDraftDeps = {
  /** @internal Test-only: invoked after delete is queued, before tx completion. */
  afterDeleteQueued?: () => void | Promise<void>;
};

export type CorrectionDraftStoreErrorCode =
  | "invalid_input"
  | "invalid_timestamp"
  | "invalid_draft_id"
  | "draft_id_conflict"
  | "not_found"
  | "stale_draft"
  | "invalid_stored_draft"
  | "database_read_failed"
  | "database_write_failed";

export class CorrectionDraftStoreError extends Error {
  readonly code: CorrectionDraftStoreErrorCode;

  constructor(code: CorrectionDraftStoreErrorCode, message?: string) {
    super(message ?? code);
    this.name = "CorrectionDraftStoreError";
    this.code = code;
  }
}

export type CreateCorrectionDraftResult =
  | {
      ok: true;
      draft: CorrectionDraftV1;
    }
  | {
      ok: false;
      code:
        | "invalid_input"
        | "invalid_timestamp"
        | "draft_id_conflict"
        | "database_write_failed";
    };

export type UpdateCorrectionDraftResult =
  | {
      ok: true;
      draft: CorrectionDraftV1;
    }
  | {
      ok: false;
      code:
        | "not_found"
        | "stale_draft"
        | "invalid_input"
        | "invalid_timestamp"
        | "invalid_stored_draft"
        | "database_write_failed";
    };

export type DeleteCorrectionDraftResult =
  | {
      ok: true;
      deleted: true;
    }
  | {
      ok: false;
      code:
        | "not_found"
        | "stale_draft"
        | "invalid_stored_draft"
        | "database_write_failed";
    };

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.addEventListener("success", () => resolve(req.result));
    req.addEventListener("error", () => reject(req.error));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.addEventListener("complete", () => resolve());
    tx.addEventListener("error", () => reject(tx.error));
    tx.addEventListener("abort", () => reject(tx.error));
  });
}

function isConstraintError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "name" in err &&
    (err as { name: string }).name === "ConstraintError"
  );
}

function defaultNow(): string {
  return new Date().toISOString();
}

function defaultGenerateDraftId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Collision-resistant fallback when randomUUID is unavailable.
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function isValidDraftIdInput(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.trim() === "" || value !== value.trim()) return false;
  const len = countUnicodeCharacters(value);
  return len >= 1 && len <= CORRECTION_DRAFT_ID_MAX_CHARS;
}

function compareCodePoints(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Management list ordering:
 * 1. updated_at descending
 * 2. created_at descending
 * 3. draft_id ascending
 *
 * Distinct from CF1I1 export ordering.
 */
export function compareCorrectionDraftsForManagement(
  a: CorrectionDraftV1,
  b: CorrectionDraftV1,
): number {
  const byUpdated = compareCodePoints(b.updated_at, a.updated_at);
  if (byUpdated !== 0) return byUpdated;
  const byCreated = compareCodePoints(b.created_at, a.created_at);
  if (byCreated !== 0) return byCreated;
  return compareCodePoints(a.draft_id, b.draft_id);
}

function buildDraftFromCreateInput(
  input: CreateCorrectionDraftInput,
  draftId: string,
  timestamp: string,
): CorrectionDraftV1 {
  return {
    schema_version: CORRECTION_DRAFT_SCHEMA_VERSION,
    draft_id: draftId,
    bundle_id: input.bundle_id,
    ir_id: input.ir_id,
    ir_kind: "lexicon_entry",
    content_sha256: input.content_sha256,
    storage_scope_id: input.storage_scope_id,
    issue_type: input.issue_type,
    mode: input.mode,
    target: cloneCorrectionTarget(input.target),
    display_snapshot: cloneCorrectionDisplaySnapshot(input.display_snapshot),
    problem_description: input.problem_description,
    ...(input.proposed_value !== undefined ? { proposed_value: input.proposed_value } : {}),
    created_at: timestamp,
    updated_at: timestamp,
    status: "draft",
  };
}

function parseStoredDraftOrThrow(value: unknown, label: string): CorrectionDraftV1 {
  const parsed = parseCorrectionDraft(value);
  if (!parsed.ok) {
    throw new CorrectionDraftStoreError("invalid_stored_draft", label);
  }
  return parsed.draft;
}

/**
 * Create a correction draft.
 *
 * Duplicate UI activation (same form save twice) is a CF1I3 controller
 * responsibility. Store-level guarantee: same draft_id cannot overwrite via add.
 */
export async function createCorrectionDraft(
  db: IDBDatabase,
  input: CreateCorrectionDraftInput,
  deps?: CreateCorrectionDraftDeps,
): Promise<CreateCorrectionDraftResult> {
  const nowFn = deps?.now ?? defaultNow;
  const idFn = deps?.generateDraftId ?? defaultGenerateDraftId;

  const timestamp = nowFn();
  if (!isValidCorrectionIsoTimestamp(timestamp)) {
    return { ok: false, code: "invalid_timestamp" };
  }

  const draftId = idFn();
  if (!isValidDraftIdInput(draftId)) {
    return { ok: false, code: "invalid_input" };
  }

  let draft: CorrectionDraftV1;
  try {
    draft = buildDraftFromCreateInput(input, draftId, timestamp);
    validateCorrectionDraftForWrite(draft, "createCorrectionDraft");
  } catch {
    return { ok: false, code: "invalid_input" };
  }

  const toStore = cloneCorrectionDraft(draft);
  const tx = db.transaction(STORE_CORRECTION_DRAFTS, "readwrite");
  const store = tx.objectStore(STORE_CORRECTION_DRAFTS);

  try {
    await reqToPromise(store.add(toStore));
    if (deps?.afterWriteQueued) {
      await deps.afterWriteQueued();
    }
    await txDone(tx);
    return { ok: true, draft: cloneCorrectionDraft(toStore) };
  } catch (err) {
    try {
      tx.abort();
    } catch {
      // already aborted or complete
    }
    if (isConstraintError(err)) {
      return { ok: false, code: "draft_id_conflict" };
    }
    return { ok: false, code: "database_write_failed" };
  }
}

export async function getCorrectionDraft(
  db: IDBDatabase,
  draftId: string,
): Promise<CorrectionDraftV1 | undefined> {
  if (!isValidDraftIdInput(draftId)) {
    throw new CorrectionDraftStoreError("invalid_draft_id");
  }

  try {
    const tx = db.transaction(STORE_CORRECTION_DRAFTS, "readonly");
    const value = await reqToPromise(tx.objectStore(STORE_CORRECTION_DRAFTS).get(draftId));
    await txDone(tx);
    if (value === undefined) return undefined;
    return cloneCorrectionDraft(parseStoredDraftOrThrow(value, "getCorrectionDraft"));
  } catch (err) {
    if (err instanceof CorrectionDraftStoreError) throw err;
    throw new CorrectionDraftStoreError("database_read_failed");
  }
}

export async function listCorrectionDrafts(db: IDBDatabase): Promise<CorrectionDraftV1[]> {
  try {
    const tx = db.transaction(STORE_CORRECTION_DRAFTS, "readonly");
    const rows = await reqToPromise(tx.objectStore(STORE_CORRECTION_DRAFTS).getAll());
    await txDone(tx);

    const drafts: CorrectionDraftV1[] = [];
    for (let i = 0; i < rows.length; i += 1) {
      drafts.push(
        cloneCorrectionDraft(
          parseStoredDraftOrThrow(rows[i], `listCorrectionDrafts[${i}]`),
        ),
      );
    }
    drafts.sort(compareCorrectionDraftsForManagement);
    return drafts;
  } catch (err) {
    if (err instanceof CorrectionDraftStoreError) throw err;
    throw new CorrectionDraftStoreError("database_read_failed");
  }
}

export async function countCorrectionDrafts(db: IDBDatabase): Promise<number> {
  try {
    const tx = db.transaction(STORE_CORRECTION_DRAFTS, "readonly");
    const count = await reqToPromise(tx.objectStore(STORE_CORRECTION_DRAFTS).count());
    await txDone(tx);
    return count;
  } catch {
    throw new CorrectionDraftStoreError("database_read_failed");
  }
}

/**
 * Update mutable user fields only.
 * Immutable identity/provenance/`created_at`/`status` come from the stored row.
 *
 * Timestamp policy: injected `now()` must be strictly greater than the previous
 * `updated_at`. Same-timestamp clocks are rejected (`invalid_timestamp`) rather
 * than silently advanced.
 */
export async function updateCorrectionDraft(
  db: IDBDatabase,
  input: UpdateCorrectionDraftInput,
  deps?: UpdateCorrectionDraftDeps,
): Promise<UpdateCorrectionDraftResult> {
  if (!isValidDraftIdInput(input.draft_id)) {
    return { ok: false, code: "invalid_input" };
  }
  if (!isValidCorrectionIsoTimestamp(input.expected_updated_at)) {
    return { ok: false, code: "invalid_input" };
  }

  const nowFn = deps?.now ?? defaultNow;
  const tx = db.transaction(STORE_CORRECTION_DRAFTS, "readwrite");
  const store = tx.objectStore(STORE_CORRECTION_DRAFTS);

  const abortAnd = async <T extends UpdateCorrectionDraftResult>(result: T): Promise<T> => {
    try {
      tx.abort();
    } catch {
      // already aborted or complete
    }
    return result;
  };

  try {
    const existingRaw = await reqToPromise(store.get(input.draft_id));
    if (existingRaw === undefined) {
      return await abortAnd({ ok: false, code: "not_found" });
    }

    let current: CorrectionDraftV1;
    try {
      current = parseStoredDraftOrThrow(existingRaw, "updateCorrectionDraft:current");
    } catch {
      return await abortAnd({ ok: false, code: "invalid_stored_draft" });
    }

    if (current.updated_at !== input.expected_updated_at) {
      return await abortAnd({ ok: false, code: "stale_draft" });
    }

    const timestamp = nowFn();
    if (!isValidCorrectionIsoTimestamp(timestamp)) {
      return await abortAnd({ ok: false, code: "invalid_timestamp" });
    }
    if (!(Date.parse(timestamp) > Date.parse(current.updated_at))) {
      return await abortAnd({ ok: false, code: "invalid_timestamp" });
    }

    const updated: CorrectionDraftV1 = {
      schema_version: current.schema_version,
      draft_id: current.draft_id,
      bundle_id: current.bundle_id,
      ir_id: current.ir_id,
      ir_kind: current.ir_kind,
      content_sha256: current.content_sha256,
      storage_scope_id: current.storage_scope_id,
      issue_type: input.issue_type,
      mode: input.mode,
      target: cloneCorrectionTarget(input.target),
      display_snapshot: cloneCorrectionDisplaySnapshot(input.display_snapshot),
      problem_description: input.problem_description,
      ...(input.proposed_value !== undefined ? { proposed_value: input.proposed_value } : {}),
      created_at: current.created_at,
      updated_at: timestamp,
      status: "draft",
    };

    try {
      validateCorrectionDraftForWrite(updated, "updateCorrectionDraft");
    } catch {
      return await abortAnd({ ok: false, code: "invalid_input" });
    }

    const toStore = cloneCorrectionDraft(updated);
    await reqToPromise(store.put(toStore));
    if (deps?.afterWriteQueued) {
      await deps.afterWriteQueued();
    }
    await txDone(tx);
    return { ok: true, draft: cloneCorrectionDraft(toStore) };
  } catch {
    return await abortAnd({ ok: false, code: "database_write_failed" });
  }
}

export async function deleteCorrectionDraft(
  db: IDBDatabase,
  draftId: string,
  options?: {
    expectedUpdatedAt?: string;
  },
  deps?: DeleteCorrectionDraftDeps,
): Promise<DeleteCorrectionDraftResult> {
  if (!isValidDraftIdInput(draftId)) {
    return { ok: false, code: "not_found" };
  }
  if (
    options?.expectedUpdatedAt !== undefined &&
    !isValidCorrectionIsoTimestamp(options.expectedUpdatedAt)
  ) {
    return { ok: false, code: "stale_draft" };
  }

  const tx = db.transaction(STORE_CORRECTION_DRAFTS, "readwrite");
  const store = tx.objectStore(STORE_CORRECTION_DRAFTS);

  const abortAnd = async <T extends DeleteCorrectionDraftResult>(result: T): Promise<T> => {
    try {
      tx.abort();
    } catch {
      // already aborted or complete
    }
    return result;
  };

  try {
    const existingRaw = await reqToPromise(store.get(draftId));
    if (existingRaw === undefined) {
      return await abortAnd({ ok: false, code: "not_found" });
    }

    let current: CorrectionDraftV1;
    try {
      current = parseStoredDraftOrThrow(existingRaw, "deleteCorrectionDraft");
    } catch {
      return await abortAnd({ ok: false, code: "invalid_stored_draft" });
    }

    if (
      options?.expectedUpdatedAt !== undefined &&
      current.updated_at !== options.expectedUpdatedAt
    ) {
      return await abortAnd({ ok: false, code: "stale_draft" });
    }

    await reqToPromise(store.delete(draftId));
    if (deps?.afterDeleteQueued) {
      await deps.afterDeleteQueued();
    }
    await txDone(tx);
    return { ok: true, deleted: true };
  } catch {
    return await abortAnd({ ok: false, code: "database_write_failed" });
  }
}
