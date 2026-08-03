/**
 * CF2I3 — Search failure capture controller.
 *
 * Owns host generation, frozen search-event verification, save orchestration,
 * duplicate-save suppression, stale-context handling, and DB lifecycle.
 *
 * Database ownership (same corrected model as CF1I3A):
 * - default `controller_owned`: every connection from openDb is closed in finally;
 * - `caller_owned`: shared injected connection is never closed by the controller.
 *
 * Commit invalidation:
 * - successful store commit always invokes onFeedbackSaved exactly once;
 * - UI success rendering may still be suppressed when the host is stale/disposed.
 *
 * Does not call query logging, CF1, or Learning APIs.
 */

import type { ActiveBundleMeta } from "../idb/siralex_db";
import { getActiveBundleMeta } from "../idb/siralex_db";
import {
  createSearchFeedbackDraft,
  type CreateSearchFeedbackDraftDeps,
  type CreateSearchFeedbackDraftResult,
} from "./search_feedback_store";
import {
  buildSearchFeedbackCaptureViewModel,
  createInitialSearchFeedbackCaptureFields,
  validateSearchFeedbackCaptureFields,
  type ExecutedSearchSnapshot,
  type SearchFeedbackCaptureContext,
  type SearchFeedbackCaptureErrorCode,
  type SearchFeedbackCaptureFieldErrors,
  type SearchFeedbackCaptureFields,
  type SearchFeedbackCaptureViewModel,
} from "./search_feedback_capture_model";

export type SearchFeedbackCaptureDbOwnership = "controller_owned" | "caller_owned";

export type SearchFeedbackCaptureControllerDeps = {
  context: SearchFeedbackCaptureContext;
  openDb: () => Promise<IDBDatabase>;
  /**
   * Default: `controller_owned` (production).
   * Tests that inject one shared DB must set `caller_owned`.
   */
  dbOwnership?: SearchFeedbackCaptureDbOwnership;
  getActiveMeta: () => ActiveBundleMeta | undefined;
  /** Current settled executed-search snapshot (runtime source of truth). */
  getCurrentExecutedSearch: () => ExecutedSearchSnapshot | undefined;
  /** Returns true while this form host generation is still current. */
  isCurrent: () => boolean;
  onModel: (vm: SearchFeedbackCaptureViewModel) => void;
  onCancel: () => void;
  onBackToSearch: () => void;
  /** Invalidate future Manage Search Feedback / reminder caches (CF2I4 seam). */
  onFeedbackSaved?: () => void;
  createDraft?: (
    db: IDBDatabase,
    input: Parameters<typeof createSearchFeedbackDraft>[1],
    deps?: CreateSearchFeedbackDraftDeps,
  ) => Promise<CreateSearchFeedbackDraftResult>;
  resolveActiveMeta?: (db: IDBDatabase) => Promise<ActiveBundleMeta | undefined>;
};

function mapStoreFailure(
  code: Exclude<CreateSearchFeedbackDraftResult, { ok: true }>["code"],
): SearchFeedbackCaptureErrorCode {
  switch (code) {
    case "invalid_timestamp":
      return "invalid_timestamp";
    case "id_generation_failed":
      return "id_generation_failed";
    case "feedback_id_conflict":
      return "feedback_id_conflict";
    case "database_write_failed":
      return "database_write_failed";
    case "invalid_input":
      return "invalid_input";
  }
}

function closeIfControllerOwned(
  db: IDBDatabase | undefined,
  ownership: SearchFeedbackCaptureDbOwnership,
): void {
  if (!db) return;
  if (ownership !== "controller_owned") return;
  try {
    db.close();
  } catch {
    // Ignore close races; ownership duty is best-effort once opened.
  }
}

function matchedIdsEqual(
  a: string[] | undefined,
  b: string[] | undefined,
): boolean {
  if (a === undefined && b === undefined) return true;
  if (a === undefined || b === undefined) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function searchEventMatchesBound(
  bound: SearchFeedbackCaptureContext,
  current: ExecutedSearchSnapshot,
): boolean {
  if (current.generation !== bound.search_generation) return false;
  if (current.query_raw !== bound.query_raw) return false;
  if (current.search_direction !== bound.search_direction) return false;
  if (current.result_state !== bound.result_state) return false;
  if (current.result_count !== bound.result_count) return false;
  if (!matchedIdsEqual(current.matched_ir_ids, bound.matched_ir_ids)) return false;
  if (current.bundle_id !== bound.bundle_id) return false;
  if (current.content_sha256 !== bound.content_sha256) return false;
  if (current.storage_scope_id !== bound.storage_scope_id) return false;
  return true;
}

function provenanceMatches(
  bound: SearchFeedbackCaptureContext,
  meta: ActiveBundleMeta,
): boolean {
  const storageScopeId = meta.storage_scope_id ?? meta.bundle_id;
  return (
    meta.bundle_id === bound.bundle_id &&
    meta.expected_content_sha256 === bound.content_sha256 &&
    storageScopeId === bound.storage_scope_id
  );
}

export function createSearchFeedbackCaptureController(
  deps: SearchFeedbackCaptureControllerDeps,
) {
  const bound = deps.context;
  const dbOwnership: SearchFeedbackCaptureDbOwnership =
    deps.dbOwnership ?? "controller_owned";
  let fields: SearchFeedbackCaptureFields =
    createInitialSearchFeedbackCaptureFields();
  let state: SearchFeedbackCaptureViewModel["state"] = "ready";
  let errors: SearchFeedbackCaptureFieldErrors = {};
  let errorCode: SearchFeedbackCaptureErrorCode | undefined;
  let feedbackId: string | undefined;
  let savePromise: Promise<void> | null = null;
  let completedSuccessfully = false;
  let feedbackSavedNotified = false;
  let disposed = false;

  const createDraft = deps.createDraft ?? createSearchFeedbackDraft;
  const resolveActiveMeta = deps.resolveActiveMeta ?? getActiveBundleMeta;

  function notifyFeedbackSavedOnce(): void {
    if (feedbackSavedNotified) return;
    feedbackSavedNotified = true;
    deps.onFeedbackSaved?.();
  }

  function emit(options?: { force?: boolean }): void {
    if (disposed) return;
    if (!options?.force && !deps.isCurrent()) return;
    deps.onModel(
      buildSearchFeedbackCaptureViewModel({
        state,
        context: bound,
        fields,
        errors,
        errorCode,
        feedback_id: feedbackId,
      }),
    );
  }

  function markStale(): void {
    if (completedSuccessfully || disposed) return;
    state = "stale_context";
    errorCode = "search_context_changed";
    errors = {};
    emit({ force: true });
  }

  async function verifySearchContext(): Promise<boolean> {
    if (!deps.isCurrent()) {
      markStale();
      return false;
    }

    const memoryMeta = deps.getActiveMeta();
    if (!memoryMeta || !provenanceMatches(bound, memoryMeta)) {
      markStale();
      return false;
    }

    const currentSearch = deps.getCurrentExecutedSearch();
    if (!currentSearch || !searchEventMatchesBound(bound, currentSearch)) {
      markStale();
      return false;
    }

    let db: IDBDatabase | undefined;
    try {
      db = await deps.openDb();
      if (!deps.isCurrent()) {
        markStale();
        return false;
      }
      const liveMeta = await resolveActiveMeta(db);
      if (!deps.isCurrent()) {
        markStale();
        return false;
      }
      if (!liveMeta || !provenanceMatches(bound, liveMeta)) {
        markStale();
        return false;
      }

      // Re-check bound search event after await (context drift protection).
      const afterSearch = deps.getCurrentExecutedSearch();
      if (!afterSearch || !searchEventMatchesBound(bound, afterSearch)) {
        markStale();
        return false;
      }
      return true;
    } catch {
      markStale();
      return false;
    } finally {
      closeIfControllerOwned(db, dbOwnership);
    }
  }

  return {
    getViewModel(): SearchFeedbackCaptureViewModel {
      return buildSearchFeedbackCaptureViewModel({
        state,
        context: bound,
        fields,
        errors,
        errorCode,
        feedback_id: feedbackId,
      });
    },

    start(): void {
      emit();
    },

    dispose(): void {
      disposed = true;
    },

    notifyHostInvalidated(): void {
      markStale();
    },

    notifyBundleLifecycleChanged(): void {
      markStale();
    },

    notifySearchChanged(): void {
      markStale();
    },

    setRequestedMeaning(value: string): void {
      if (state === "saving" || state === "saved" || state === "stale_context") return;
      fields = { ...fields, requested_meaning: value };
      if (state === "invalid" || state === "error") {
        state = "ready";
        errors = {};
        errorCode = undefined;
      }
      emit();
    },

    setUserDescription(value: string): void {
      if (state === "saving" || state === "saved" || state === "stale_context") return;
      fields = { ...fields, user_description: value };
      if (state === "invalid" || state === "error") {
        state = "ready";
        errors = {};
        errorCode = undefined;
      }
      emit();
    },

    cancel(): void {
      if (state === "saving") return;
      deps.onCancel();
    },

    backToSearch(): void {
      deps.onBackToSearch();
    },

    async save(): Promise<void> {
      if (disposed || completedSuccessfully) return;
      if (savePromise) return savePromise;
      if (state === "stale_context" || state === "saving" || state === "saved") return;
      if (!deps.isCurrent()) {
        markStale();
        return;
      }

      savePromise = (async () => {
        const validated = validateSearchFeedbackCaptureFields(fields, bound);

        if (!validated.ok) {
          state = "invalid";
          errors = validated.errors;
          errorCode = "invalid_fields";
          emit();
          return;
        }

        const contextOk = await verifySearchContext();
        if (!contextOk) return;
        if (!deps.isCurrent()) {
          markStale();
          return;
        }

        state = "saving";
        errors = {};
        errorCode = undefined;
        emit();

        let db: IDBDatabase | undefined;
        try {
          db = await deps.openDb();

          const result = await createDraft(db, validated.input);

          if (!result.ok) {
            if (!deps.isCurrent() || disposed) {
              markStale();
              return;
            }
            state = "error";
            errorCode = mapStoreFailure(result.code);
            emit();
            return;
          }

          // Persistent commit side-effect: always invalidate dependent data once.
          completedSuccessfully = true;
          feedbackId = result.draft.feedback_id;
          notifyFeedbackSavedOnce();

          // UI presentation may be discarded when stale/disposed.
          if (disposed || !deps.isCurrent()) {
            return;
          }
          state = "saved";
          errorCode = undefined;
          emit();
        } catch {
          if (!deps.isCurrent() || disposed) {
            markStale();
            return;
          }
          state = "error";
          errorCode = "database_write_failed";
          emit();
        } finally {
          closeIfControllerOwned(db, dbOwnership);
        }
      })().finally(() => {
        savePromise = null;
      });

      return savePromise;
    },
  };
}

export type SearchFeedbackCaptureController = ReturnType<
  typeof createSearchFeedbackCaptureController
>;
