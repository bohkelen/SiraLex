/**
 * CF1I3 / CF1I3A — Correction suggestion form controller.
 *
 * Owns host generation, live-entry binding, save orchestration,
 * duplicate-save suppression, stale-context handling, and DB lifecycle.
 *
 * Database ownership (CF1I3A):
 * - default `controller_owned`: every connection from openDb is closed in finally;
 * - `caller_owned`: shared injected connection is never closed by the controller.
 *
 * Commit invalidation (CF1I3A):
 * - successful store commit always invokes onDraftSaved exactly once;
 * - UI success rendering may still be suppressed when the host is stale/disposed.
 */

import type { ActiveBundleMeta } from "../idb/siralex_db";
import { resolveRecords } from "../search/resolve_records";
import type { EnrichedRecord } from "../types/records";
import {
  createCorrectionDraft,
  type CreateCorrectionDraftDeps,
  type CreateCorrectionDraftResult,
} from "./correction_draft_store";
import {
  buildCorrectionFormViewModel,
  buildCorrectionTargetOptions,
  correctionFormFieldsForMode,
  createInitialCorrectionFormFields,
  validateCorrectionFormFields,
  type CorrectionEntryContext,
  type CorrectionFormErrorCode,
  type CorrectionFormFieldErrors,
  type CorrectionFormFields,
  type CorrectionFormViewModel,
} from "./correction_form_model";
import type { CorrectionIssueType, CorrectionMode } from "./correction_draft_types";

/**
 * Explicit IndexedDB ownership for correction-form operations.
 *
 * - controller_owned (production default): controller closes each opened connection.
 * - caller_owned: openDb returns a shared connection the controller must not close.
 */
export type CorrectionFormDbOwnership = "controller_owned" | "caller_owned";

export type CorrectionFormControllerDeps = {
  context: CorrectionEntryContext;
  openDb: () => Promise<IDBDatabase>;
  /**
   * Default: `controller_owned` (production).
   * Tests that inject one shared DB must set `caller_owned`.
   */
  dbOwnership?: CorrectionFormDbOwnership;
  getActiveMeta: () => ActiveBundleMeta | undefined;
  /** Returns true while this form host generation is still current. */
  isCurrent: () => boolean;
  onModel: (vm: CorrectionFormViewModel) => void;
  onCancel: () => void;
  onBackToEntry: () => void;
  /** Invalidate future Manage Corrections list/count generation (CF1I4 seam). */
  onDraftSaved?: () => void;
  createDraft?: (
    db: IDBDatabase,
    input: Parameters<typeof createCorrectionDraft>[1],
    deps?: CreateCorrectionDraftDeps,
  ) => Promise<CreateCorrectionDraftResult>;
  resolveLiveEntry?: (
    db: IDBDatabase,
    storageScopeId: string,
    irId: string,
  ) => Promise<EnrichedRecord | undefined>;
};

async function defaultResolveLiveEntry(
  db: IDBDatabase,
  storageScopeId: string,
  irId: string,
): Promise<EnrichedRecord | undefined> {
  const rows = await resolveRecords(db, storageScopeId, [irId]);
  return rows[0];
}

function mapStoreFailure(
  code: Exclude<CreateCorrectionDraftResult, { ok: true }>["code"],
): CorrectionFormErrorCode {
  switch (code) {
    case "invalid_timestamp":
      return "invalid_timestamp";
    case "id_generation_failed":
      return "id_generation_failed";
    case "draft_id_conflict":
      return "draft_id_conflict";
    case "database_write_failed":
      return "database_write_failed";
    case "invalid_input":
      return "invalid_input";
  }
}

function closeIfControllerOwned(
  db: IDBDatabase | undefined,
  ownership: CorrectionFormDbOwnership,
): void {
  if (!db) return;
  if (ownership !== "controller_owned") return;
  try {
    db.close();
  } catch {
    // Ignore close races; ownership duty is best-effort once opened.
  }
}

export function createCorrectionFormController(deps: CorrectionFormControllerDeps) {
  const bound = deps.context;
  const dbOwnership: CorrectionFormDbOwnership = deps.dbOwnership ?? "controller_owned";
  let fields: CorrectionFormFields = createInitialCorrectionFormFields();
  let state: CorrectionFormViewModel["state"] = "ready";
  let errors: CorrectionFormFieldErrors = {};
  let errorCode: CorrectionFormErrorCode | undefined;
  let draftId: string | undefined;
  let savePromise: Promise<void> | null = null;
  let completedSuccessfully = false;
  let draftSavedNotified = false;
  let disposed = false;

  const createDraft = deps.createDraft ?? createCorrectionDraft;
  const resolveLive = deps.resolveLiveEntry ?? defaultResolveLiveEntry;

  function notifyDraftSavedOnce(): void {
    if (draftSavedNotified) return;
    draftSavedNotified = true;
    deps.onDraftSaved?.();
  }

  function emit(options?: { force?: boolean }): void {
    if (disposed) return;
    // Allow forced stale/error paints after host invalidation even if generation advanced.
    if (!options?.force && !deps.isCurrent()) return;
    deps.onModel(
      buildCorrectionFormViewModel({
        state,
        context: bound,
        fields,
        errors,
        errorCode,
        draft_id: draftId,
      }),
    );
  }

  function markStale(): void {
    if (completedSuccessfully || disposed) return;
    state = "stale_context";
    errorCode = "entry_context_changed";
    errors = {};
    emit({ force: true });
  }

  async function verifyEntryContext(): Promise<boolean> {
    if (!deps.isCurrent()) {
      markStale();
      return false;
    }

    const meta = deps.getActiveMeta();
    if (!meta) {
      markStale();
      return false;
    }

    const storageScopeId = meta.storage_scope_id ?? meta.bundle_id;
    if (
      meta.bundle_id !== bound.bundle_id ||
      meta.expected_content_sha256 !== bound.content_sha256 ||
      storageScopeId !== bound.storage_scope_id
    ) {
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
      const live = await resolveLive(db, bound.storage_scope_id, bound.ir_id);
      if (!deps.isCurrent()) {
        markStale();
        return false;
      }
      if (!live || live.ir_kind !== "lexicon_entry" || live.ir_id !== bound.ir_id) {
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
    getViewModel(): CorrectionFormViewModel {
      return buildCorrectionFormViewModel({
        state,
        context: bound,
        fields,
        errors,
        errorCode,
        draft_id: draftId,
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

    setIssueType(issueType: CorrectionIssueType | ""): void {
      if (state === "saving" || state === "saved" || state === "stale_context") return;
      fields = { ...fields, issue_type: issueType };
      if (state === "invalid" || state === "error") {
        state = "ready";
        errors = {};
        errorCode = undefined;
      }
      emit();
    },

    setTargetKey(key: string): void {
      if (state === "saving" || state === "saved" || state === "stale_context") return;
      fields = { ...fields, target_key: key };
      if (key !== "other_field") {
        fields = { ...fields, other_field_label: "" };
      }
      if (state === "invalid" || state === "error") {
        state = "ready";
        errors = {};
        errorCode = undefined;
      }
      emit();
    },

    setMode(mode: CorrectionMode): void {
      if (state === "saving" || state === "saved" || state === "stale_context") return;
      fields = correctionFormFieldsForMode(fields, mode);
      if (state === "invalid" || state === "error") {
        state = "ready";
        errors = {};
        errorCode = undefined;
      }
      emit();
    },

    setProblemDescription(value: string): void {
      if (state === "saving" || state === "saved" || state === "stale_context") return;
      fields = { ...fields, problem_description: value };
      if (state === "invalid" || state === "error") {
        state = "ready";
        errors = {};
        errorCode = undefined;
      }
      emit();
    },

    setProposedValue(value: string): void {
      if (state === "saving" || state === "saved" || state === "stale_context") return;
      if (fields.mode !== "proposed_correction") return;
      fields = { ...fields, proposed_value: value };
      if (state === "invalid" || state === "error") {
        state = "ready";
        errors = {};
        errorCode = undefined;
      }
      emit();
    },

    setOtherFieldLabel(value: string): void {
      if (state === "saving" || state === "saved" || state === "stale_context") return;
      if (fields.target_key !== "other_field") return;
      fields = { ...fields, other_field_label: value };
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

    backToEntry(): void {
      deps.onBackToEntry();
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
        const validated = validateCorrectionFormFields(
          fields,
          bound,
          buildCorrectionTargetOptions(bound.entry),
        );

        if (!validated.ok) {
          state = "invalid";
          errors = validated.errors;
          errorCode = "invalid_fields";
          emit();
          return;
        }

        const contextOk = await verifyEntryContext();
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

          const result = await createDraft(db, {
            bundle_id: bound.bundle_id,
            ir_id: bound.ir_id,
            ir_kind: "lexicon_entry",
            content_sha256: bound.content_sha256,
            storage_scope_id: bound.storage_scope_id,
            ...validated.input,
          });

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
          draftId = result.draft.draft_id;
          notifyDraftSavedOnce();

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

export type CorrectionFormController = ReturnType<typeof createCorrectionFormController>;
