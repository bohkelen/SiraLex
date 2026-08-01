/**
 * CF1I3 — Correction suggestion form controller.
 *
 * Owns host generation, live-entry binding, save orchestration,
 * duplicate-save suppression, and stale-context handling.
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

export type CorrectionFormControllerDeps = {
  context: CorrectionEntryContext;
  openDb: () => Promise<IDBDatabase>;
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

export function createCorrectionFormController(deps: CorrectionFormControllerDeps) {
  const bound = deps.context;
  let fields: CorrectionFormFields = createInitialCorrectionFormFields();
  let state: CorrectionFormViewModel["state"] = "ready";
  let errors: CorrectionFormFieldErrors = {};
  let errorCode: CorrectionFormErrorCode | undefined;
  let draftId: string | undefined;
  let savePromise: Promise<void> | null = null;
  let completedSuccessfully = false;
  let disposed = false;

  const createDraft = deps.createDraft ?? createCorrectionDraft;
  const resolveLive = deps.resolveLiveEntry ?? defaultResolveLiveEntry;

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

    try {
      const db = await deps.openDb();
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

        try {
          const db = await deps.openDb();
          if (!deps.isCurrent()) {
            markStale();
            return;
          }

          const result = await createDraft(db, {
            bundle_id: bound.bundle_id,
            ir_id: bound.ir_id,
            ir_kind: "lexicon_entry",
            content_sha256: bound.content_sha256,
            storage_scope_id: bound.storage_scope_id,
            ...validated.input,
          });

          if (!deps.isCurrent()) {
            markStale();
            return;
          }

          if (!result.ok) {
            state = "error";
            errorCode = mapStoreFailure(result.code);
            emit();
            return;
          }

          completedSuccessfully = true;
          draftId = result.draft.draft_id;
          state = "saved";
          errorCode = undefined;
          emit();
          deps.onDraftSaved?.();
        } catch {
          if (!deps.isCurrent()) {
            markStale();
            return;
          }
          state = "error";
          errorCode = "database_write_failed";
          emit();
        }
      })().finally(() => {
        savePromise = null;
      });

      return savePromise;
    },
  };
}

export type CorrectionFormController = ReturnType<typeof createCorrectionFormController>;
