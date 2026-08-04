/**
 * CF1I4 — Pending corrections management session.
 *
 * List / detail / edit / delete / export. No Learning or query-log operations.
 */

import {
  getInstalledBundleMeta,
  type ActiveBundleMeta,
} from "../idb/siralex_db";
import { resolveRecords } from "../search/resolve_records";
import type { EnrichedRecord } from "../types/records";
import {
  CorrectionDraftStoreError,
  countCorrectionDrafts,
  deleteCorrectionDraft,
  getCorrectionDraft,
  listCorrectionDrafts,
  updateCorrectionDraft,
  type UpdateCorrectionDraftInput,
} from "./correction_draft_store";
import {
  cloneCorrectionDraft,
  cloneCorrectionDisplaySnapshot,
  cloneCorrectionTarget,
  type CorrectionDraftV1,
  type CorrectionIssueType,
  type CorrectionMode,
  type CorrectionTarget,
} from "./correction_draft_types";
import {
  createCorrectionFeedbackExport,
  type CreateCorrectionFeedbackExportResult,
} from "./correction_feedback_export";
import {
  downloadCorrectionFeedbackArtifact,
  type CorrectionFeedbackExportArtifact,
  type DownloadCorrectionFeedbackDeps,
} from "./correction_feedback_file";
import {
  buildCorrectionTargetOptions,
  correctionFormFieldsForMode,
  createInitialCorrectionFormFields,
  encodeCorrectionTargetOptionKey,
  resolveCorrectionTargetOption,
  validateCorrectionFormFields,
  type CorrectionFormFieldErrors,
  type CorrectionFormFields,
  type CorrectionTargetOption,
} from "./correction_form_model";
import type {
  FeedbackHandoffResult,
  FeedbackHandoffSuccessMethod,
} from "../feedback/feedback_handoff";

export type CorrectionAvailabilityState =
  | "matching_live_content"
  | "dictionary_unavailable"
  | "entry_unavailable"
  | "dictionary_content_differs";

export type CorrectionManagementPhase =
  | "loading"
  | "empty"
  | "list"
  | "detail"
  | "editing"
  | "confirm_delete"
  | "confirm_handoff"
  | "exporting"
  | "exported"
  | "handoff_preparing"
  | "handoff_prepared"
  | "error";

export type CorrectionManagementErrorCode =
  | "invalid_stored_draft"
  | "database_read_failed"
  | "database_write_failed"
  | "stale_draft"
  | "not_found"
  | "invalid_fields"
  | "invalid_timestamp"
  | "export_failed"
  | "no_correction_drafts"
  | "invalid_local_draft"
  | "duplicate_draft_id"
  | "generated_package_too_large"
  | "generated_package_invalid"
  | "send_failed"
  | "send_unavailable";

export type CorrectionManagementListItem = {
  draft_id: string;
  headword: string;
  issue_type: CorrectionIssueType;
  mode: CorrectionMode;
  target: CorrectionTarget;
  updated_at: string;
  availability: CorrectionAvailabilityState;
};

export type CorrectionManagementVm = {
  generation: number;
  phase: CorrectionManagementPhase;
  draftCount: number;
  items: CorrectionManagementListItem[];
  selected?: CorrectionDraftV1;
  availability?: CorrectionAvailabilityState;
  liveEntry?: EnrichedRecord;
  editFields?: CorrectionFormFields;
  editTargetOptions?: CorrectionTargetOption[];
  editErrors?: CorrectionFormFieldErrors;
  editRetargetAllowed: boolean;
  busy: boolean;
  errorCode?: CorrectionManagementErrorCode;
  exportFilename?: string;
  exportDraftCount?: number;
  sendForReviewAvailable: boolean;
  /** Configured review inbox when handoff is available; never from translations. */
  reviewEmail?: string;
  handoffMethod?: FeedbackHandoffSuccessMethod;
  focusTarget:
    | "none"
    | "heading"
    | "status"
    | "error_summary"
    | "delete_confirm"
    | "list";
};

export type CorrectionManagementSessionDeps = {
  openDb: () => Promise<IDBDatabase>;
  dbOwnership?: "controller_owned" | "caller_owned";
  now: () => string;
  appVersion?: string;
  isCurrent: () => boolean;
  onModel: (vm: CorrectionManagementVm) => void;
  /** Notify host after create/edit/delete so reminders refresh. */
  onDraftsChanged?: () => void;
  downloadArtifact?: typeof downloadCorrectionFeedbackArtifact;
  downloadDeps?: DownloadCorrectionFeedbackDeps;
  createExport?: typeof createCorrectionFeedbackExport;
  /** When false/omitted, Send for review stays unavailable. */
  sendForReviewAvailable?: boolean;
  /** Configured review inbox (from VITE_FEEDBACK_EMAIL). Shown in handoff UI. */
  reviewEmail?: string;
  /**
   * Transport handoff for a governed export artifact.
   * Must not mutate drafts. Privacy confirmation is handled by the UI before calling sendForReview.
   */
  performHandoff?: (
    artifact: CorrectionFeedbackExportArtifact,
  ) => Promise<FeedbackHandoffResult>;
  getInstalledMeta?: (
    db: IDBDatabase,
    bundleId: string,
  ) => Promise<ActiveBundleMeta | undefined>;
  resolveLiveEntry?: (
    db: IDBDatabase,
    storageScopeId: string,
    irId: string,
  ) => Promise<EnrichedRecord | undefined>;
};

function closeIfOwned(
  db: IDBDatabase | undefined,
  ownership: "controller_owned" | "caller_owned",
): void {
  if (!db || ownership !== "controller_owned") return;
  try {
    db.close();
  } catch {
    // ignore
  }
}

async function defaultResolveLive(
  db: IDBDatabase,
  storageScopeId: string,
  irId: string,
): Promise<EnrichedRecord | undefined> {
  const rows = await resolveRecords(db, storageScopeId, [irId]);
  return rows[0];
}

export function deriveCorrectionAvailability(
  draft: CorrectionDraftV1,
  installed: ActiveBundleMeta | undefined,
  live: EnrichedRecord | undefined,
): CorrectionAvailabilityState {
  if (!installed) return "dictionary_unavailable";
  const installedHash = installed.expected_content_sha256;
  if (
    typeof installedHash === "string" &&
    installedHash.trim() !== "" &&
    installedHash !== draft.content_sha256
  ) {
    return "dictionary_content_differs";
  }
  if (!live || live.ir_kind !== "lexicon_entry" || live.ir_id !== draft.ir_id) {
    return "entry_unavailable";
  }
  return "matching_live_content";
}

function listItemFromDraft(
  draft: CorrectionDraftV1,
  availability: CorrectionAvailabilityState,
): CorrectionManagementListItem {
  return {
    draft_id: draft.draft_id,
    headword: draft.display_snapshot.headword_latin,
    issue_type: draft.issue_type,
    mode: draft.mode,
    target: cloneCorrectionTarget(draft.target),
    updated_at: draft.updated_at,
    availability,
  };
}

function fieldsFromDraft(draft: CorrectionDraftV1): CorrectionFormFields {
  const fields = createInitialCorrectionFormFields();
  fields.issue_type = draft.issue_type;
  fields.mode = draft.mode;
  fields.problem_description = draft.problem_description;
  fields.proposed_value = draft.proposed_value ?? "";
  fields.target_key = encodeCorrectionTargetOptionKey(draft.target);
  if (draft.target.type === "other_field") {
    fields.other_field_label = draft.target.field_label;
  }
  return fields;
}

function mapExportFailure(
  result: Extract<CreateCorrectionFeedbackExportResult, { ok: false }>,
): CorrectionManagementErrorCode {
  switch (result.code) {
    case "no_correction_drafts":
      return "no_correction_drafts";
    case "invalid_local_draft":
      return "invalid_local_draft";
    case "duplicate_draft_id":
      return "duplicate_draft_id";
    case "generated_package_too_large":
      return "generated_package_too_large";
    case "generated_package_invalid":
      return "generated_package_invalid";
    case "database_unavailable":
    case "database_read_failed":
      return "database_read_failed";
  }
}

export function createCorrectionManagementSession(deps: CorrectionManagementSessionDeps) {
  const ownership = deps.dbOwnership ?? "controller_owned";
  const createExport = deps.createExport ?? createCorrectionFeedbackExport;
  const download = deps.downloadArtifact ?? downloadCorrectionFeedbackArtifact;
  const getInstalled = deps.getInstalledMeta ?? getInstalledBundleMeta;
  const resolveLive = deps.resolveLiveEntry ?? defaultResolveLive;
  const sendForReviewAvailable = deps.sendForReviewAvailable === true;
  const reviewEmail =
    sendForReviewAvailable && typeof deps.reviewEmail === "string" && deps.reviewEmail.trim() !== ""
      ? deps.reviewEmail.trim()
      : undefined;
  const performHandoff = deps.performHandoff;

  let generation = 0;
  let phase: CorrectionManagementPhase = "loading";
  let draftCount = 0;
  let items: CorrectionManagementListItem[] = [];
  let selected: CorrectionDraftV1 | undefined;
  let availability: CorrectionAvailabilityState | undefined;
  let liveEntry: EnrichedRecord | undefined;
  let editFields: CorrectionFormFields | undefined;
  let editTargetOptions: CorrectionTargetOption[] | undefined;
  let editErrors: CorrectionFormFieldErrors | undefined;
  let editRetargetAllowed = false;
  let busy = false;
  let errorCode: CorrectionManagementErrorCode | undefined;
  let exportFilename: string | undefined;
  let exportDraftCount: number | undefined;
  let handoffMethod: FeedbackHandoffSuccessMethod | undefined;
  let focusTarget: CorrectionManagementVm["focusTarget"] = "heading";
  let disposed = false;
  let loadPromise: Promise<void> | null = null;
  let writePromise: Promise<void> | null = null;

  function emit(): void {
    if (disposed || !deps.isCurrent()) return;
    deps.onModel({
      generation,
      phase,
      draftCount,
      items: items.map((item) => ({
        ...item,
        target: cloneCorrectionTarget(item.target),
      })),
      selected: selected ? cloneCorrectionDraft(selected) : undefined,
      availability,
      liveEntry,
      editFields: editFields ? { ...editFields } : undefined,
      editTargetOptions,
      editErrors: editErrors ? { ...editErrors } : undefined,
      editRetargetAllowed,
      busy,
      errorCode,
      exportFilename,
      exportDraftCount,
      sendForReviewAvailable,
      reviewEmail,
      handoffMethod,
      focusTarget,
    });
  }

  async function withDb<T>(fn: (db: IDBDatabase) => Promise<T>): Promise<T> {
    let db: IDBDatabase | undefined;
    try {
      db = await deps.openDb();
      return await fn(db);
    } finally {
      closeIfOwned(db, ownership);
    }
  }

  async function availabilityFor(
    db: IDBDatabase,
    draft: CorrectionDraftV1,
  ): Promise<{
    availability: CorrectionAvailabilityState;
    live?: EnrichedRecord;
  }> {
    const installed = await getInstalled(db, draft.bundle_id);
    const live = await resolveLive(db, draft.storage_scope_id, draft.ir_id);
    return {
      availability: deriveCorrectionAvailability(draft, installed, live),
      live,
    };
  }

  async function reloadList(options?: { focus?: CorrectionManagementVm["focusTarget"] }): Promise<void> {
    const gen = ++generation;
    phase = "loading";
    busy = true;
    errorCode = undefined;
    exportFilename = undefined;
    exportDraftCount = undefined;
    handoffMethod = undefined;
    focusTarget = options?.focus ?? "heading";
    emit();

    try {
      await withDb(async (db) => {
        if (!deps.isCurrent() || gen !== generation) return;
        const drafts = await listCorrectionDrafts(db);
        if (!deps.isCurrent() || gen !== generation) return;
        draftCount = drafts.length;
        const nextItems: CorrectionManagementListItem[] = [];
        for (const draft of drafts) {
          const { availability: avail } = await availabilityFor(db, draft);
          if (!deps.isCurrent() || gen !== generation) return;
          nextItems.push(listItemFromDraft(draft, avail));
        }
        items = nextItems;
        selected = undefined;
        availability = undefined;
        liveEntry = undefined;
        editFields = undefined;
        editTargetOptions = undefined;
        editErrors = undefined;
        editRetargetAllowed = false;
        phase = drafts.length === 0 ? "empty" : "list";
        busy = false;
        focusTarget = options?.focus ?? "heading";
        emit();
      });
    } catch (err) {
      if (!deps.isCurrent() || gen !== generation) return;
      busy = false;
      phase = "error";
      errorCode =
        err instanceof CorrectionDraftStoreError && err.code === "invalid_stored_draft"
          ? "invalid_stored_draft"
          : "database_read_failed";
      focusTarget = "status";
      emit();
    }
  }

  return {
    getVm(): CorrectionManagementVm {
      return {
        generation,
        phase,
        draftCount,
        items,
        selected,
        availability,
        liveEntry,
        editFields,
        editTargetOptions,
        editErrors,
        editRetargetAllowed,
        busy,
        errorCode,
        exportFilename,
        exportDraftCount,
        sendForReviewAvailable,
        reviewEmail,
        handoffMethod,
        focusTarget,
      };
    },

    dispose(): void {
      disposed = true;
    },

    async load(): Promise<void> {
      if (loadPromise) return loadPromise;
      loadPromise = reloadList().finally(() => {
        loadPromise = null;
      });
      return loadPromise;
    },

    async refreshCount(): Promise<number> {
      return withDb(async (db) => {
        const count = await countCorrectionDrafts(db);
        if (deps.isCurrent()) {
          draftCount = count;
          emit();
        }
        return count;
      });
    },

    async openDetail(draftId: string): Promise<void> {
      if (busy || writePromise) return;
      busy = true;
      errorCode = undefined;
      emit();
      try {
        await withDb(async (db) => {
          if (!deps.isCurrent()) return;
          const draft = await getCorrectionDraft(db, draftId);
          if (!deps.isCurrent()) return;
          if (!draft) {
            await reloadList({ focus: "list" });
            return;
          }
          const resolved = await availabilityFor(db, draft);
          if (!deps.isCurrent()) return;
          selected = draft;
          availability = resolved.availability;
          liveEntry = resolved.live;
          phase = "detail";
          busy = false;
          focusTarget = "heading";
          emit();
        });
      } catch (err) {
        if (!deps.isCurrent()) return;
        busy = false;
        phase = "error";
        errorCode =
          err instanceof CorrectionDraftStoreError && err.code === "invalid_stored_draft"
            ? "invalid_stored_draft"
            : "database_read_failed";
        focusTarget = "status";
        emit();
      }
    },

    backToList(): void {
      if (busy || writePromise) return;
      selected = undefined;
      availability = undefined;
      liveEntry = undefined;
      editFields = undefined;
      editTargetOptions = undefined;
      editErrors = undefined;
      phase = draftCount === 0 ? "empty" : "list";
      focusTarget = "list";
      emit();
    },

    startEdit(): void {
      if (!selected || busy || writePromise) return;
      if (phase !== "detail" && phase !== "editing") return;
      editRetargetAllowed =
        availability === "matching_live_content" && liveEntry != null;
      editFields = fieldsFromDraft(selected);
      editTargetOptions = editRetargetAllowed
        ? buildCorrectionTargetOptions(liveEntry!)
        : [];
      // Ensure current target key remains selectable even when not retargeting.
      if (
        editRetargetAllowed &&
        !resolveCorrectionTargetOption(editFields.target_key, editTargetOptions)
      ) {
        editRetargetAllowed = false;
        editTargetOptions = [];
      }
      editErrors = undefined;
      phase = "editing";
      focusTarget = "heading";
      emit();
    },

    cancelEdit(): void {
      if (busy || writePromise) return;
      editFields = undefined;
      editTargetOptions = undefined;
      editErrors = undefined;
      phase = "detail";
      focusTarget = "heading";
      emit();
    },

    setEditIssueType(value: CorrectionIssueType | ""): void {
      if (phase !== "editing" || !editFields || busy) return;
      editFields = { ...editFields, issue_type: value };
      editErrors = undefined;
      errorCode = undefined;
      focusTarget = "none";
      emit();
    },

    setEditMode(mode: CorrectionMode): void {
      if (phase !== "editing" || !editFields || busy) return;
      editFields = correctionFormFieldsForMode(editFields, mode);
      editErrors = undefined;
      errorCode = undefined;
      focusTarget = "none";
      emit();
    },

    setEditTargetKey(key: string): void {
      if (phase !== "editing" || !editFields || busy || !editRetargetAllowed) return;
      editFields = {
        ...editFields,
        target_key: key,
        other_field_label: key === "other_field" ? editFields.other_field_label : "",
      };
      editErrors = undefined;
      errorCode = undefined;
      focusTarget = "none";
      emit();
    },

    setEditProblemDescription(value: string): void {
      if (phase !== "editing" || !editFields || busy) return;
      editFields = { ...editFields, problem_description: value };
      editErrors = undefined;
      errorCode = undefined;
      focusTarget = "none";
      emit();
    },

    setEditProposedValue(value: string): void {
      if (phase !== "editing" || !editFields || busy) return;
      if (editFields.mode !== "proposed_correction") return;
      editFields = { ...editFields, proposed_value: value };
      editErrors = undefined;
      errorCode = undefined;
      focusTarget = "none";
      emit();
    },

    setEditOtherFieldLabel(value: string): void {
      if (phase !== "editing" || !editFields || busy) return;
      if (editFields.target_key !== "other_field") return;
      editFields = { ...editFields, other_field_label: value };
      editErrors = undefined;
      errorCode = undefined;
      focusTarget = "none";
      emit();
    },

    async saveEdit(): Promise<void> {
      if (!selected || !editFields || phase !== "editing" || writePromise) return;

      writePromise = (async () => {
        let target: CorrectionTarget;
        let snapshot = cloneCorrectionDisplaySnapshot(selected!.display_snapshot);

        if (editRetargetAllowed && liveEntry) {
          const options = editTargetOptions ?? buildCorrectionTargetOptions(liveEntry);
          const validated = validateCorrectionFormFields(
            editFields!,
            {
              bundle_id: selected!.bundle_id,
              ir_id: selected!.ir_id,
              ir_kind: "lexicon_entry",
              content_sha256: selected!.content_sha256,
              storage_scope_id: selected!.storage_scope_id,
              entry: liveEntry,
            },
            options,
          );
          if (!validated.ok) {
            editErrors = validated.errors;
            errorCode = "invalid_fields";
            focusTarget = "error_summary";
            emit();
            return;
          }
          target = validated.target;
          snapshot = validated.snapshot;
        } else {
          // Retain existing target/snapshot; validate user-authored fields only.
          const errors: CorrectionFormFieldErrors = {};
          if (!editFields!.issue_type) errors.issue_type = "required";
          if (editFields!.problem_description.trim() === "") {
            errors.problem_description = "required";
          }
          if (
            editFields!.mode === "proposed_correction" &&
            editFields!.proposed_value.trim() === ""
          ) {
            errors.proposed_value = "required";
          }
          if (Object.keys(errors).length > 0) {
            editErrors = errors;
            errorCode = "invalid_fields";
            focusTarget = "error_summary";
            emit();
            return;
          }
          target = cloneCorrectionTarget(selected!.target);
          snapshot = cloneCorrectionDisplaySnapshot(selected!.display_snapshot);
        }

        const input: UpdateCorrectionDraftInput = {
          draft_id: selected!.draft_id,
          expected_updated_at: selected!.updated_at,
          issue_type: editFields!.issue_type as CorrectionIssueType,
          mode: editFields!.mode,
          target,
          display_snapshot: snapshot,
          problem_description: editFields!.problem_description,
          ...(editFields!.mode === "proposed_correction"
            ? { proposed_value: editFields!.proposed_value }
            : {}),
        };

        busy = true;
        emit();

        try {
          await withDb(async (db) => {
            if (!deps.isCurrent()) return;
            const result = await updateCorrectionDraft(db, input, { now: deps.now });
            if (!deps.isCurrent()) return;

            if (!result.ok) {
              if (result.code === "stale_draft") {
                const fresh = await getCorrectionDraft(db, selected!.draft_id);
                if (!deps.isCurrent()) return;
                if (fresh) {
                  selected = fresh;
                  const resolved = await availabilityFor(db, fresh);
                  availability = resolved.availability;
                  liveEntry = resolved.live;
                  editFields = fieldsFromDraft(fresh);
                  editRetargetAllowed =
                    availability === "matching_live_content" && liveEntry != null;
                  editTargetOptions = editRetargetAllowed
                    ? buildCorrectionTargetOptions(liveEntry!)
                    : [];
                  editErrors = undefined;
                  errorCode = "stale_draft";
                  phase = "editing";
                  busy = false;
                  focusTarget = "error_summary";
                  emit();
                  return;
                }
              }
              busy = false;
              errorCode =
                result.code === "not_found"
                  ? "not_found"
                  : result.code === "invalid_timestamp"
                    ? "invalid_timestamp"
                    : result.code === "invalid_input"
                      ? "invalid_fields"
                      : "database_write_failed";
              focusTarget = "error_summary";
              emit();
              return;
            }

            const resolved = await availabilityFor(db, result.draft);
            if (!deps.isCurrent()) return;
            selected = result.draft;
            availability = resolved.availability;
            liveEntry = resolved.live;
            items = items.map((item) =>
              item.draft_id === result.draft.draft_id
                ? listItemFromDraft(result.draft, resolved.availability)
                : item,
            );
            editFields = undefined;
            editTargetOptions = undefined;
            editErrors = undefined;
            errorCode = undefined;
            phase = "detail";
            busy = false;
            focusTarget = "heading";
            emit();
            deps.onDraftsChanged?.();
          });
        } catch {
          if (!deps.isCurrent()) return;
          busy = false;
          errorCode = "database_write_failed";
          focusTarget = "error_summary";
          emit();
        }
      })().finally(() => {
        writePromise = null;
      });

      return writePromise;
    },

    requestDelete(): void {
      if (!selected || busy || writePromise) return;
      phase = "confirm_delete";
      focusTarget = "delete_confirm";
      emit();
    },

    cancelDelete(): void {
      if (busy || writePromise) return;
      phase = "detail";
      focusTarget = "heading";
      emit();
    },

    async confirmDelete(): Promise<void> {
      if (!selected || phase !== "confirm_delete" || writePromise) return;
      const draftId = selected.draft_id;
      const expected = selected.updated_at;
      writePromise = (async () => {
        busy = true;
        emit();
        try {
          await withDb(async (db) => {
            if (!deps.isCurrent()) return;
            const result = await deleteCorrectionDraft(db, draftId, {
              expectedUpdatedAt: expected,
            });
            if (!deps.isCurrent()) return;
            if (!result.ok) {
              busy = false;
              errorCode =
                result.code === "stale_draft"
                  ? "stale_draft"
                  : result.code === "not_found"
                    ? "not_found"
                    : "database_write_failed";
              phase = "detail";
              focusTarget = "error_summary";
              if (result.code === "stale_draft") {
                const fresh = await getCorrectionDraft(db, draftId);
                if (fresh && deps.isCurrent()) {
                  selected = fresh;
                  const resolved = await availabilityFor(db, fresh);
                  availability = resolved.availability;
                  liveEntry = resolved.live;
                }
              }
              emit();
              return;
            }
            deps.onDraftsChanged?.();
            await reloadList({ focus: "list" });
          });
        } catch {
          if (!deps.isCurrent()) return;
          busy = false;
          errorCode = "database_write_failed";
          phase = "detail";
          focusTarget = "error_summary";
          emit();
        }
      })().finally(() => {
        writePromise = null;
      });
      return writePromise;
    },

    async exportAll(): Promise<void> {
      if (busy || writePromise || draftCount === 0) return;
      writePromise = (async () => {
        busy = true;
        phase = "exporting";
        errorCode = undefined;
        exportFilename = undefined;
        exportDraftCount = undefined;
        emit();
        try {
          await withDb(async (db) => {
            if (!deps.isCurrent()) return;
            const result = await createExport(db, {
              exportedAt: deps.now(),
              appVersion: deps.appVersion,
            });
            if (!deps.isCurrent()) return;
            if (!result.ok) {
              busy = false;
              phase = items.length === 0 ? "empty" : "list";
              errorCode = mapExportFailure(result);
              focusTarget = "status";
              emit();
              return;
            }
            download(result.artifact, deps.downloadDeps);
            if (!deps.isCurrent()) return;
            // Export must not mutate drafts — reload list to prove unchanged.
            const after = await listCorrectionDrafts(db);
            if (!deps.isCurrent()) return;
            busy = false;
            phase = "exported";
            exportFilename = result.artifact.filename;
            exportDraftCount = result.artifact.draftCount;
            draftCount = after.length;
            focusTarget = "status";
            emit();
          });
        } catch {
          if (!deps.isCurrent()) return;
          busy = false;
          phase = items.length === 0 ? "empty" : "list";
          errorCode = "export_failed";
          focusTarget = "status";
          emit();
        }
      })().finally(() => {
        writePromise = null;
      });
      return writePromise;
    },

    acknowledgeExport(): void {
      if (phase !== "exported") return;
      phase = draftCount === 0 ? "empty" : "list";
      exportFilename = undefined;
      exportDraftCount = undefined;
      focusTarget = "list";
      emit();
    },

    requestSendForReview(): void {
      if (busy || writePromise || draftCount === 0) return;
      if (!sendForReviewAvailable || typeof performHandoff !== "function") {
        errorCode = "send_unavailable";
        focusTarget = "status";
        emit();
        return;
      }
      if (phase !== "list" && phase !== "empty" && phase !== "exported" && phase !== "handoff_prepared") {
        return;
      }
      phase = "confirm_handoff";
      errorCode = undefined;
      focusTarget = "status";
      emit();
    },

    cancelSendForReview(): void {
      if (phase !== "confirm_handoff") return;
      phase = draftCount === 0 ? "empty" : "list";
      focusTarget = "list";
      emit();
    },

    async confirmSendForReview(): Promise<void> {
      if (phase !== "confirm_handoff" || busy || writePromise || draftCount === 0) return;
      if (!sendForReviewAvailable || typeof performHandoff !== "function") {
        errorCode = "send_unavailable";
        phase = draftCount === 0 ? "empty" : "list";
        focusTarget = "status";
        emit();
        return;
      }
      writePromise = (async () => {
        busy = true;
        phase = "handoff_preparing";
        errorCode = undefined;
        exportFilename = undefined;
        exportDraftCount = undefined;
        handoffMethod = undefined;
        emit();
        try {
          await withDb(async (db) => {
            if (!deps.isCurrent()) return;
            const result = await createExport(db, {
              exportedAt: deps.now(),
              appVersion: deps.appVersion,
            });
            if (!deps.isCurrent()) return;
            if (!result.ok) {
              busy = false;
              phase = items.length === 0 ? "empty" : "list";
              errorCode = mapExportFailure(result);
              focusTarget = "status";
              emit();
              return;
            }
            // Privacy already confirmed in confirm_handoff UI.
            const handoff = await performHandoff(result.artifact);
            if (!deps.isCurrent()) return;
            if (!handoff.ok) {
              busy = false;
              phase = items.length === 0 ? "empty" : "list";
              if (handoff.reason === "cancelled") {
                errorCode = undefined;
              } else if (handoff.reason === "unavailable_email") {
                errorCode = "send_unavailable";
              } else {
                errorCode = "send_failed";
              }
              focusTarget = "status";
              emit();
              return;
            }
            const after = await listCorrectionDrafts(db);
            if (!deps.isCurrent()) return;
            busy = false;
            phase = "handoff_prepared";
            handoffMethod = handoff.method;
            exportFilename = result.artifact.filename;
            exportDraftCount = result.artifact.draftCount;
            draftCount = after.length;
            focusTarget = "status";
            emit();
          });
        } catch {
          if (!deps.isCurrent()) return;
          busy = false;
          phase = items.length === 0 ? "empty" : "list";
          errorCode = "send_failed";
          focusTarget = "status";
          emit();
        }
      })().finally(() => {
        writePromise = null;
      });
      return writePromise;
    },

    acknowledgeHandoff(): void {
      if (phase !== "handoff_prepared") return;
      phase = draftCount === 0 ? "empty" : "list";
      exportFilename = undefined;
      exportDraftCount = undefined;
      handoffMethod = undefined;
      focusTarget = "list";
      emit();
    },
  };
}

export type CorrectionManagementSession = ReturnType<
  typeof createCorrectionManagementSession
>;
