/**
 * CF2I2 — Local search-failure feedback IndexedDB store.
 *
 * Persists validated search_failure_feedback_draft_v1 rows only.
 * Does not mutate dictionary, Learning, query-log, CF1, or bundle registry stores.
 * Does not perform export, UI, Phase 1.5 conversion, or corpus mutation.
 *
 * Invariant: the saved search event is immutable historical evidence.
 * Only the user's explanation of what they wanted may change.
 */

import { STORE_SEARCH_FAILURE_FEEDBACK } from "../idb/siralex_db";
import {
  SEARCH_FEEDBACK_DRAFT_SCHEMA_VERSION,
  SEARCH_FEEDBACK_ID_MAX_CHARS,
  cloneSearchFeedbackDraft,
  countUnicodeCharacters,
  isValidSearchFeedbackIsoTimestamp,
  type SearchFeedbackDirection,
  type SearchFeedbackDraftV1,
  type SearchFeedbackResultState,
} from "./search_feedback_types";
import {
  validateSearchFeedbackDraft,
  validateSearchFeedbackDraftForWrite,
} from "./search_feedback_validation";

export type CreateSearchFeedbackDraftInput = {
  bundle_id: string;
  content_sha256: string;
  storage_scope_id: string;
  query_raw: string;
  search_direction: SearchFeedbackDirection;
  result_state: SearchFeedbackResultState;
  result_count: number;
  matched_ir_ids?: string[];
  requested_meaning?: string;
  user_description?: string;
};

/**
 * Update replaces editable user-evidence fields only.
 * Omit optional fields (or pass `undefined`) to store canonical absence.
 * Search-event provenance fields are never accepted here.
 */
export type UpdateSearchFeedbackDraftInput = {
  feedback_id: string;
  expected_updated_at: string;
  requested_meaning?: string;
  user_description?: string;
};

export type CreateSearchFeedbackDraftDeps = {
  now?: () => string;
  generateFeedbackId?: () => string;
  /**
   * @internal Test-only and must remain immediate.
   * Do not introduce production async work while a transaction is open.
   */
  afterWriteQueued?: () => void | Promise<void>;
};

export type UpdateSearchFeedbackDraftDeps = {
  now?: () => string;
  /**
   * @internal Test-only and must remain immediate.
   * Do not introduce production async work while a transaction is open.
   */
  afterWriteQueued?: () => void | Promise<void>;
};

export type DeleteSearchFeedbackDraftDeps = {
  /**
   * @internal Test-only and must remain immediate.
   * Do not introduce production async work while a transaction is open.
   */
  afterDeleteQueued?: () => void | Promise<void>;
};

export type SearchFeedbackStoreErrorCode =
  | "invalid_input"
  | "invalid_timestamp"
  | "invalid_feedback_id"
  | "id_generation_failed"
  | "feedback_id_conflict"
  | "not_found"
  | "stale_feedback"
  | "invalid_stored_feedback"
  | "database_read_failed"
  | "database_write_failed";

export class SearchFeedbackStoreError extends Error {
  readonly code: SearchFeedbackStoreErrorCode;

  constructor(code: SearchFeedbackStoreErrorCode, message?: string) {
    super(message ?? code);
    this.name = "SearchFeedbackStoreError";
    this.code = code;
  }
}

export type CreateSearchFeedbackDraftResult =
  | {
      ok: true;
      draft: SearchFeedbackDraftV1;
    }
  | {
      ok: false;
      code:
        | "invalid_input"
        | "invalid_timestamp"
        | "id_generation_failed"
        | "feedback_id_conflict"
        | "database_write_failed";
    };

export type UpdateSearchFeedbackDraftResult =
  | {
      ok: true;
      draft: SearchFeedbackDraftV1;
    }
  | {
      ok: false;
      code:
        | "not_found"
        | "stale_feedback"
        | "invalid_input"
        | "invalid_timestamp"
        | "invalid_stored_feedback"
        | "database_write_failed";
    };

export type DeleteSearchFeedbackDraftResult =
  | {
      ok: true;
      deleted: true;
    }
  | {
      ok: false;
      code:
        | "not_found"
        | "stale_feedback"
        | "invalid_stored_feedback"
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

/**
 * Production feedback ID policy:
 * 1. Prefer crypto.randomUUID()
 * 2. Else construct a UUID-compatible ID via crypto.getRandomValues()
 * 3. If neither secure API exists, fail closed (never Math.random / timestamp IDs)
 */
function tryDefaultGenerateFeedbackId():
  | { ok: true; feedbackId: string }
  | { ok: false; code: "id_generation_failed" } {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return { ok: true, feedbackId: crypto.randomUUID() };
  }
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    // RFC 4122 version 4 / variant 1 layout for UUID-compatible identifiers.
    bytes[6] = (bytes[6]! & 0x0f) | 0x40;
    bytes[8] = (bytes[8]! & 0x3f) | 0x80;
    const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
    return {
      ok: true,
      feedbackId: `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`,
    };
  }
  return { ok: false, code: "id_generation_failed" };
}

function isValidFeedbackIdInput(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.trim() === "" || value !== value.trim()) return false;
  const len = countUnicodeCharacters(value);
  return len >= 1 && len <= SEARCH_FEEDBACK_ID_MAX_CHARS;
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
 * 3. feedback_id ascending
 *
 * Distinct from CF2I1 export ordering (bundle_id → created_at → feedback_id).
 */
export function compareSearchFeedbackDraftsForManagement(
  a: SearchFeedbackDraftV1,
  b: SearchFeedbackDraftV1,
): number {
  const byUpdated = compareCodePoints(b.updated_at, a.updated_at);
  if (byUpdated !== 0) return byUpdated;
  const byCreated = compareCodePoints(b.created_at, a.created_at);
  if (byCreated !== 0) return byCreated;
  return compareCodePoints(a.feedback_id, b.feedback_id);
}

function buildDraftFromCreateInput(
  input: CreateSearchFeedbackDraftInput,
  feedbackId: string,
  timestamp: string,
): SearchFeedbackDraftV1 {
  return {
    schema_version: SEARCH_FEEDBACK_DRAFT_SCHEMA_VERSION,
    feedback_id: feedbackId,
    bundle_id: input.bundle_id,
    content_sha256: input.content_sha256,
    storage_scope_id: input.storage_scope_id,
    query_raw: input.query_raw,
    search_direction: input.search_direction,
    result_state: input.result_state,
    result_count: input.result_count,
    ...(input.matched_ir_ids !== undefined
      ? { matched_ir_ids: [...input.matched_ir_ids] }
      : {}),
    ...(input.requested_meaning !== undefined
      ? { requested_meaning: input.requested_meaning }
      : {}),
    ...(input.user_description !== undefined
      ? { user_description: input.user_description }
      : {}),
    created_at: timestamp,
    updated_at: timestamp,
    status: "draft",
  };
}

function parseStoredFeedbackOrThrow(
  value: unknown,
  label: string,
): SearchFeedbackDraftV1 {
  const parsed = validateSearchFeedbackDraft(value);
  if (!parsed.ok) {
    throw new SearchFeedbackStoreError("invalid_stored_feedback", label);
  }
  return parsed.value;
}

/**
 * Create a search-feedback draft.
 *
 * Store-level guarantee: same feedback_id cannot overwrite via add().
 * Duplicate UI activation is a later capture-surface responsibility.
 */
export async function createSearchFeedbackDraft(
  db: IDBDatabase,
  input: CreateSearchFeedbackDraftInput,
  deps?: CreateSearchFeedbackDraftDeps,
): Promise<CreateSearchFeedbackDraftResult> {
  const nowFn = deps?.now ?? defaultNow;

  const timestamp = nowFn();
  if (!isValidSearchFeedbackIsoTimestamp(timestamp)) {
    return { ok: false, code: "invalid_timestamp" };
  }

  let feedbackId: string;
  if (deps?.generateFeedbackId) {
    feedbackId = deps.generateFeedbackId();
  } else {
    const generated = tryDefaultGenerateFeedbackId();
    if (!generated.ok) {
      return { ok: false, code: "id_generation_failed" };
    }
    feedbackId = generated.feedbackId;
  }
  if (!isValidFeedbackIdInput(feedbackId)) {
    return { ok: false, code: "invalid_input" };
  }

  let draft: SearchFeedbackDraftV1;
  try {
    draft = buildDraftFromCreateInput(input, feedbackId, timestamp);
    validateSearchFeedbackDraftForWrite(draft, "createSearchFeedbackDraft");
  } catch {
    return { ok: false, code: "invalid_input" };
  }

  const toStore = cloneSearchFeedbackDraft(draft);
  const tx = db.transaction(STORE_SEARCH_FAILURE_FEEDBACK, "readwrite");
  const store = tx.objectStore(STORE_SEARCH_FAILURE_FEEDBACK);

  try {
    await reqToPromise(store.add(toStore));
    if (deps?.afterWriteQueued) {
      await deps.afterWriteQueued();
    }
    await txDone(tx);
    return { ok: true, draft: cloneSearchFeedbackDraft(toStore) };
  } catch (err) {
    try {
      tx.abort();
    } catch {
      // already aborted or complete
    }
    if (isConstraintError(err)) {
      return { ok: false, code: "feedback_id_conflict" };
    }
    return { ok: false, code: "database_write_failed" };
  }
}

export async function getSearchFeedbackDraft(
  db: IDBDatabase,
  feedbackId: string,
): Promise<SearchFeedbackDraftV1 | undefined> {
  if (!isValidFeedbackIdInput(feedbackId)) {
    throw new SearchFeedbackStoreError("invalid_feedback_id");
  }

  try {
    const tx = db.transaction(STORE_SEARCH_FAILURE_FEEDBACK, "readonly");
    const value = await reqToPromise(
      tx.objectStore(STORE_SEARCH_FAILURE_FEEDBACK).get(feedbackId),
    );
    await txDone(tx);
    if (value === undefined) return undefined;
    return cloneSearchFeedbackDraft(
      parseStoredFeedbackOrThrow(value, "getSearchFeedbackDraft"),
    );
  } catch (err) {
    if (err instanceof SearchFeedbackStoreError) throw err;
    throw new SearchFeedbackStoreError("database_read_failed");
  }
}

export async function listSearchFeedbackDrafts(
  db: IDBDatabase,
): Promise<SearchFeedbackDraftV1[]> {
  try {
    const tx = db.transaction(STORE_SEARCH_FAILURE_FEEDBACK, "readonly");
    const rows = await reqToPromise(
      tx.objectStore(STORE_SEARCH_FAILURE_FEEDBACK).getAll(),
    );
    await txDone(tx);

    const drafts: SearchFeedbackDraftV1[] = [];
    for (let i = 0; i < rows.length; i += 1) {
      drafts.push(
        cloneSearchFeedbackDraft(
          parseStoredFeedbackOrThrow(rows[i], `listSearchFeedbackDrafts[${i}]`),
        ),
      );
    }
    drafts.sort(compareSearchFeedbackDraftsForManagement);
    return drafts;
  } catch (err) {
    if (err instanceof SearchFeedbackStoreError) throw err;
    throw new SearchFeedbackStoreError("database_read_failed");
  }
}

export async function countSearchFeedbackDrafts(db: IDBDatabase): Promise<number> {
  try {
    const tx = db.transaction(STORE_SEARCH_FAILURE_FEEDBACK, "readonly");
    const count = await reqToPromise(
      tx.objectStore(STORE_SEARCH_FAILURE_FEEDBACK).count(),
    );
    await txDone(tx);
    return count;
  } catch {
    throw new SearchFeedbackStoreError("database_read_failed");
  }
}

/**
 * Update mutable user-evidence fields only.
 * Immutable search-event provenance / identity / created_at / status come from
 * the stored row and cannot be changed through this API.
 *
 * Timestamp policy: injected `now()` must be strictly greater than the previous
 * `updated_at`. Same-timestamp clocks are rejected (`invalid_timestamp`).
 */
export async function updateSearchFeedbackDraft(
  db: IDBDatabase,
  input: UpdateSearchFeedbackDraftInput,
  deps?: UpdateSearchFeedbackDraftDeps,
): Promise<UpdateSearchFeedbackDraftResult> {
  if (!isValidFeedbackIdInput(input.feedback_id)) {
    return { ok: false, code: "invalid_input" };
  }
  if (!isValidSearchFeedbackIsoTimestamp(input.expected_updated_at)) {
    return { ok: false, code: "invalid_input" };
  }

  const nowFn = deps?.now ?? defaultNow;
  const tx = db.transaction(STORE_SEARCH_FAILURE_FEEDBACK, "readwrite");
  const store = tx.objectStore(STORE_SEARCH_FAILURE_FEEDBACK);

  const abortAnd = async <T extends UpdateSearchFeedbackDraftResult>(
    result: T,
  ): Promise<T> => {
    try {
      tx.abort();
    } catch {
      // already aborted or complete
    }
    return result;
  };

  try {
    const existingRaw = await reqToPromise(store.get(input.feedback_id));
    if (existingRaw === undefined) {
      return await abortAnd({ ok: false, code: "not_found" });
    }

    let current: SearchFeedbackDraftV1;
    try {
      current = parseStoredFeedbackOrThrow(
        existingRaw,
        "updateSearchFeedbackDraft:current",
      );
    } catch {
      return await abortAnd({ ok: false, code: "invalid_stored_feedback" });
    }

    if (current.updated_at !== input.expected_updated_at) {
      return await abortAnd({ ok: false, code: "stale_feedback" });
    }

    const timestamp = nowFn();
    if (!isValidSearchFeedbackIsoTimestamp(timestamp)) {
      return await abortAnd({ ok: false, code: "invalid_timestamp" });
    }
    if (!(Date.parse(timestamp) > Date.parse(current.updated_at))) {
      return await abortAnd({ ok: false, code: "invalid_timestamp" });
    }

    const updated: SearchFeedbackDraftV1 = {
      schema_version: current.schema_version,
      feedback_id: current.feedback_id,
      bundle_id: current.bundle_id,
      content_sha256: current.content_sha256,
      storage_scope_id: current.storage_scope_id,
      query_raw: current.query_raw,
      search_direction: current.search_direction,
      result_state: current.result_state,
      result_count: current.result_count,
      ...(current.matched_ir_ids !== undefined
        ? { matched_ir_ids: [...current.matched_ir_ids] }
        : {}),
      ...(input.requested_meaning !== undefined
        ? { requested_meaning: input.requested_meaning }
        : {}),
      ...(input.user_description !== undefined
        ? { user_description: input.user_description }
        : {}),
      created_at: current.created_at,
      updated_at: timestamp,
      status: "draft",
    };

    try {
      validateSearchFeedbackDraftForWrite(updated, "updateSearchFeedbackDraft");
    } catch {
      return await abortAnd({ ok: false, code: "invalid_input" });
    }

    const toStore = cloneSearchFeedbackDraft(updated);
    await reqToPromise(store.put(toStore));
    if (deps?.afterWriteQueued) {
      await deps.afterWriteQueued();
    }
    await txDone(tx);
    return { ok: true, draft: cloneSearchFeedbackDraft(toStore) };
  } catch {
    return await abortAnd({ ok: false, code: "database_write_failed" });
  }
}

export async function deleteSearchFeedbackDraft(
  db: IDBDatabase,
  feedbackId: string,
  options?: {
    expectedUpdatedAt?: string;
  },
  deps?: DeleteSearchFeedbackDraftDeps,
): Promise<DeleteSearchFeedbackDraftResult> {
  if (!isValidFeedbackIdInput(feedbackId)) {
    return { ok: false, code: "not_found" };
  }
  if (
    options?.expectedUpdatedAt !== undefined &&
    !isValidSearchFeedbackIsoTimestamp(options.expectedUpdatedAt)
  ) {
    return { ok: false, code: "stale_feedback" };
  }

  const tx = db.transaction(STORE_SEARCH_FAILURE_FEEDBACK, "readwrite");
  const store = tx.objectStore(STORE_SEARCH_FAILURE_FEEDBACK);

  const abortAnd = async <T extends DeleteSearchFeedbackDraftResult>(
    result: T,
  ): Promise<T> => {
    try {
      tx.abort();
    } catch {
      // already aborted or complete
    }
    return result;
  };

  try {
    const existingRaw = await reqToPromise(store.get(feedbackId));
    if (existingRaw === undefined) {
      return await abortAnd({ ok: false, code: "not_found" });
    }

    let current: SearchFeedbackDraftV1;
    try {
      current = parseStoredFeedbackOrThrow(existingRaw, "deleteSearchFeedbackDraft");
    } catch {
      return await abortAnd({ ok: false, code: "invalid_stored_feedback" });
    }

    if (
      options?.expectedUpdatedAt !== undefined &&
      current.updated_at !== options.expectedUpdatedAt
    ) {
      return await abortAnd({ ok: false, code: "stale_feedback" });
    }

    await reqToPromise(store.delete(feedbackId));
    if (deps?.afterDeleteQueued) {
      await deps.afterDeleteQueued();
    }
    await txDone(tx);
    return { ok: true, deleted: true };
  } catch {
    return await abortAnd({ ok: false, code: "database_write_failed" });
  }
}
