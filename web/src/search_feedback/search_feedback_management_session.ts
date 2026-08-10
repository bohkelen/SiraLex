/**
 * CF2I4 — Manage Search Feedback session.
 *
 * List / detail / edit explanation / delete / export-all.
 * Does not mutate search-event provenance. No CF1, Learning, or query-log ops.
 */

import {
  getInstalledBundleMeta,
  type ActiveBundleMeta,
} from "../idb/siralex_db";
import {
  canonicalizeOptionalCaptureField,
} from "./search_feedback_capture_model";
import {
  createSearchFeedbackExport,
  downloadSearchFeedbackArtifact,
  type CreateSearchFeedbackExportResult,
  type SearchFeedbackDownloadAdapter,
  type SearchFeedbackExportArtifact,
} from "./search_feedback_export";
import {
  SearchFeedbackStoreError,
  countSearchFeedbackDrafts,
  deleteSearchFeedbackDraft,
  getSearchFeedbackDraft,
  listSearchFeedbackDrafts,
  updateSearchFeedbackDraft,
} from "./search_feedback_store";
import {
  SEARCH_FEEDBACK_REQUESTED_MEANING_MAX_CHARS,
  SEARCH_FEEDBACK_USER_DESCRIPTION_MAX_CHARS,
  cloneSearchFeedbackDraft,
  countUnicodeCharacters,
  hasDisallowedControlCharacters,
  isSearchFeedbackDraftV2,
  type SearchFeedbackDirection,
  type SearchFeedbackDraft,
  type SearchFeedbackResultState,
} from "./search_feedback_types";
import type {
  FeedbackHandoffResult,
  FeedbackHandoffSuccessMethod,
} from "../feedback/feedback_handoff";
import {
  lookupModeFromLegacySearchDirection,
  type LookupMode,
} from "../search/lookup_mode";

export type SearchFeedbackAvailabilityState =
  | "dictionary_current"
  | "dictionary_content_differs"
  | "dictionary_unavailable";

export type SearchFeedbackManagementPhase =
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
  | "error"
  | "stale_edit"
  | "stale_delete";

export type SearchFeedbackManagementErrorCode =
  | "invalid_stored_feedback"
  | "database_read_failed"
  | "database_write_failed"
  | "stale_edit"
  | "stale_delete"
  | "not_found"
  | "invalid_fields"
  | "invalid_timestamp"
  | "export_failed"
  | "no_search_feedback"
  | "invalid_local_feedback"
  | "duplicate_feedback_id"
  | "generated_package_too_large"
  | "generated_package_invalid"
  | "send_failed"
  | "send_unavailable";

export type SearchFeedbackEditFields = {
  requested_meaning: string;
  user_description: string;
};

export type SearchFeedbackEditFieldErrors = {
  requested_meaning?: "too_long" | "invalid_chars";
  user_description?: "too_long" | "invalid_chars";
};

export type SearchFeedbackManagementListItem = {
  feedback_id: string;
  query_raw: string;
  result_state: SearchFeedbackResultState;
  search_direction: SearchFeedbackDirection;
  updated_at: string;
  requested_meaning_preview?: string;
  availability: SearchFeedbackAvailabilityState;
};

export type SearchFeedbackManagementVm = {
  generation: number;
  phase: SearchFeedbackManagementPhase;
  feedbackCount: number;
  items: SearchFeedbackManagementListItem[];
  selected?: SearchFeedbackDraft;
  availability?: SearchFeedbackAvailabilityState;
  editFields?: SearchFeedbackEditFields;
  editErrors?: SearchFeedbackEditFieldErrors;
  requestedMeaningCount: number;
  userDescriptionCount: number;
  busy: boolean;
  errorCode?: SearchFeedbackManagementErrorCode;
  exportFilename?: string;
  exportFeedbackCount?: number;
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

export type SearchFeedbackManagementSessionDeps = {
  openDb: () => Promise<IDBDatabase>;
  dbOwnership?: "controller_owned" | "caller_owned";
  now: () => string;
  appVersion?: string;
  isCurrent: () => boolean;
  onModel: (vm: SearchFeedbackManagementVm) => void;
  /** Notify host after edit/delete so reminders refresh. */
  onFeedbackChanged?: () => void;
  downloadArtifact?: typeof downloadSearchFeedbackArtifact;
  downloadAdapter?: SearchFeedbackDownloadAdapter;
  createExport?: typeof createSearchFeedbackExport;
  sendForReviewAvailable?: boolean;
  /** Configured review inbox (from VITE_FEEDBACK_EMAIL). Shown in handoff UI. */
  reviewEmail?: string;
  performHandoff?: (
    artifact: SearchFeedbackExportArtifact,
  ) => Promise<FeedbackHandoffResult>;
  getInstalledMeta?: (
    db: IDBDatabase,
    bundleId: string,
  ) => Promise<ActiveBundleMeta | undefined>;
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

/**
 * Resolve dictionary lifecycle without mutating persisted feedback.
 * Uses logical bundle_id + content hash only (storage_scope_id is historical).
 */
export function deriveSearchFeedbackAvailability(
  draft: SearchFeedbackDraft,
  installed: ActiveBundleMeta | undefined,
): SearchFeedbackAvailabilityState {
  if (!installed) return "dictionary_unavailable";
  const installedHash = installed.expected_content_sha256;
  if (
    typeof installedHash === "string" &&
    installedHash.trim() !== "" &&
    installedHash !== draft.content_sha256
  ) {
    return "dictionary_content_differs";
  }
  return "dictionary_current";
}

/**
 * Resolve LookupMode for management display/provenance without mutating storage.
 * V2 uses stored language pair; V1 maps legacy search_direction → FR↔MNK.
 */
export function resolveLookupModeForManagement(
  draft: SearchFeedbackDraft,
): LookupMode {
  if (isSearchFeedbackDraftV2(draft)) {
    return { from: draft.input_lang, to: draft.output_lang };
  }
  return lookupModeFromLegacySearchDirection(draft.search_direction);
}

function listItemFromDraft(
  draft: SearchFeedbackDraft,
  availability: SearchFeedbackAvailabilityState,
): SearchFeedbackManagementListItem {
  const preview = draft.requested_meaning?.trim();
  return {
    feedback_id: draft.feedback_id,
    query_raw: draft.query_raw,
    result_state: draft.result_state,
    search_direction: draft.search_direction,
    updated_at: draft.updated_at,
    ...(preview ? { requested_meaning_preview: preview } : {}),
    availability,
  };
}

function fieldsFromDraft(draft: SearchFeedbackDraft): SearchFeedbackEditFields {
  return {
    requested_meaning: draft.requested_meaning ?? "",
    user_description: draft.user_description ?? "",
  };
}

function validateOptionalEditField(
  value: string,
  maxChars: number,
): "too_long" | "invalid_chars" | undefined {
  if (value.trim() === "") return undefined;
  if (countUnicodeCharacters(value) > maxChars) return "too_long";
  if (hasDisallowedControlCharacters(value)) return "invalid_chars";
  return undefined;
}

function validateEditFields(
  fields: SearchFeedbackEditFields,
):
  | { ok: true; requested_meaning?: string; user_description?: string }
  | { ok: false; errors: SearchFeedbackEditFieldErrors } {
  const errors: SearchFeedbackEditFieldErrors = {};
  const meaningErr = validateOptionalEditField(
    fields.requested_meaning,
    SEARCH_FEEDBACK_REQUESTED_MEANING_MAX_CHARS,
  );
  if (meaningErr) errors.requested_meaning = meaningErr;
  const detailsErr = validateOptionalEditField(
    fields.user_description,
    SEARCH_FEEDBACK_USER_DESCRIPTION_MAX_CHARS,
  );
  if (detailsErr) errors.user_description = detailsErr;
  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    requested_meaning: canonicalizeOptionalCaptureField(fields.requested_meaning),
    user_description: canonicalizeOptionalCaptureField(fields.user_description),
  };
}

function mapExportFailure(
  result: Extract<CreateSearchFeedbackExportResult, { ok: false }>,
): SearchFeedbackManagementErrorCode {
  switch (result.code) {
    case "no_search_feedback":
      return "no_search_feedback";
    case "invalid_local_feedback":
      return "invalid_local_feedback";
    case "duplicate_feedback_id":
      return "duplicate_feedback_id";
    case "generated_package_too_large":
      return "generated_package_too_large";
    case "generated_package_invalid":
      return "generated_package_invalid";
    case "database_unavailable":
    case "database_read_failed":
      return "database_read_failed";
  }
}

export function createSearchFeedbackManagementSession(
  deps: SearchFeedbackManagementSessionDeps,
) {
  const ownership = deps.dbOwnership ?? "controller_owned";
  const createExport = deps.createExport ?? createSearchFeedbackExport;
  const download = deps.downloadArtifact ?? downloadSearchFeedbackArtifact;
  const getInstalled = deps.getInstalledMeta ?? getInstalledBundleMeta;
  const sendForReviewAvailable = deps.sendForReviewAvailable === true;
  const reviewEmail =
    sendForReviewAvailable && typeof deps.reviewEmail === "string" && deps.reviewEmail.trim() !== ""
      ? deps.reviewEmail.trim()
      : undefined;
  const performHandoff = deps.performHandoff;

  let generation = 0;
  let phase: SearchFeedbackManagementPhase = "loading";
  let feedbackCount = 0;
  let items: SearchFeedbackManagementListItem[] = [];
  let selected: SearchFeedbackDraft | undefined;
  let availability: SearchFeedbackAvailabilityState | undefined;
  let editFields: SearchFeedbackEditFields | undefined;
  let editErrors: SearchFeedbackEditFieldErrors | undefined;
  let busy = false;
  let errorCode: SearchFeedbackManagementErrorCode | undefined;
  let exportFilename: string | undefined;
  let exportFeedbackCount: number | undefined;
  let handoffMethod: FeedbackHandoffSuccessMethod | undefined;
  let focusTarget: SearchFeedbackManagementVm["focusTarget"] = "heading";
  let disposed = false;
  let loadPromise: Promise<void> | null = null;
  let writePromise: Promise<void> | null = null;

  function emit(): void {
    if (disposed || !deps.isCurrent()) return;
    deps.onModel({
      generation,
      phase,
      feedbackCount,
      items: items.map((item) => ({ ...item })),
      selected: selected ? cloneSearchFeedbackDraft(selected) : undefined,
      availability,
      editFields: editFields ? { ...editFields } : undefined,
      editErrors: editErrors ? { ...editErrors } : undefined,
      requestedMeaningCount: countUnicodeCharacters(
        editFields?.requested_meaning ?? "",
      ),
      userDescriptionCount: countUnicodeCharacters(
        editFields?.user_description ?? "",
      ),
      busy,
      errorCode,
      exportFilename,
      exportFeedbackCount,
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
    draft: SearchFeedbackDraft,
  ): Promise<SearchFeedbackAvailabilityState> {
    const installed = await getInstalled(db, draft.bundle_id);
    return deriveSearchFeedbackAvailability(draft, installed);
  }

  async function reloadList(options?: {
    focus?: SearchFeedbackManagementVm["focusTarget"];
  }): Promise<void> {
    const gen = ++generation;
    phase = "loading";
    busy = true;
    errorCode = undefined;
    exportFilename = undefined;
    exportFeedbackCount = undefined;
    handoffMethod = undefined;
    focusTarget = options?.focus ?? "heading";
    emit();

    try {
      await withDb(async (db) => {
        if (!deps.isCurrent() || gen !== generation) return;
        const drafts = await listSearchFeedbackDrafts(db);
        if (!deps.isCurrent() || gen !== generation) return;
        feedbackCount = drafts.length;
        const nextItems: SearchFeedbackManagementListItem[] = [];
        for (const draft of drafts) {
          const avail = await availabilityFor(db, draft);
          if (!deps.isCurrent() || gen !== generation) return;
          nextItems.push(listItemFromDraft(draft, avail));
        }
        items = nextItems;
        selected = undefined;
        availability = undefined;
        editFields = undefined;
        editErrors = undefined;
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
        err instanceof SearchFeedbackStoreError &&
        err.code === "invalid_stored_feedback"
          ? "invalid_stored_feedback"
          : "database_read_failed";
      focusTarget = "status";
      emit();
    }
  }

  return {
    getVm(): SearchFeedbackManagementVm {
      return {
        generation,
        phase,
        feedbackCount,
        items,
        selected,
        availability,
        editFields,
        editErrors,
        requestedMeaningCount: countUnicodeCharacters(
          editFields?.requested_meaning ?? "",
        ),
        userDescriptionCount: countUnicodeCharacters(
          editFields?.user_description ?? "",
        ),
        busy,
        errorCode,
        exportFilename,
        exportFeedbackCount,
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
        const count = await countSearchFeedbackDrafts(db);
        if (deps.isCurrent()) {
          feedbackCount = count;
          emit();
        }
        return count;
      });
    },

    async openDetail(feedbackId: string): Promise<void> {
      if (busy || writePromise) return;
      busy = true;
      errorCode = undefined;
      emit();
      try {
        await withDb(async (db) => {
          if (!deps.isCurrent()) return;
          const draft = await getSearchFeedbackDraft(db, feedbackId);
          if (!deps.isCurrent()) return;
          if (!draft) {
            await reloadList({ focus: "list" });
            return;
          }
          const avail = await availabilityFor(db, draft);
          if (!deps.isCurrent()) return;
          selected = draft;
          availability = avail;
          editFields = undefined;
          editErrors = undefined;
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
          err instanceof SearchFeedbackStoreError &&
          err.code === "invalid_stored_feedback"
            ? "invalid_stored_feedback"
            : "database_read_failed";
        focusTarget = "status";
        emit();
      }
    },

    backToList(): void {
      if (busy || writePromise) return;
      selected = undefined;
      availability = undefined;
      editFields = undefined;
      editErrors = undefined;
      phase = feedbackCount === 0 ? "empty" : "list";
      focusTarget = "list";
      emit();
    },

    startEdit(): void {
      if (!selected || busy || writePromise) return;
      if (
        phase !== "detail" &&
        phase !== "editing" &&
        phase !== "stale_edit"
      ) {
        return;
      }
      editFields = fieldsFromDraft(selected);
      editErrors = undefined;
      errorCode = undefined;
      phase = "editing";
      focusTarget = "heading";
      emit();
    },

    cancelEdit(): void {
      if (busy || writePromise) return;
      editFields = undefined;
      editErrors = undefined;
      errorCode = undefined;
      phase = "detail";
      focusTarget = "heading";
      emit();
    },

    setEditRequestedMeaning(value: string): void {
      if (phase !== "editing" || !editFields || busy) return;
      editFields = { ...editFields, requested_meaning: value };
      editErrors = undefined;
      errorCode = undefined;
      emit();
    },

    setEditUserDescription(value: string): void {
      if (phase !== "editing" || !editFields || busy) return;
      editFields = { ...editFields, user_description: value };
      editErrors = undefined;
      errorCode = undefined;
      emit();
    },

    async saveEdit(): Promise<void> {
      if (!selected || !editFields || phase !== "editing" || writePromise) return;

      writePromise = (async () => {
        const validated = validateEditFields(editFields!);
        if (!validated.ok) {
          editErrors = validated.errors;
          errorCode = "invalid_fields";
          focusTarget = "error_summary";
          emit();
          return;
        }

        const expectedUpdatedAt = selected!.updated_at;
        busy = true;
        emit();

        try {
          await withDb(async (db) => {
            if (!deps.isCurrent()) return;
            const result = await updateSearchFeedbackDraft(
              db,
              {
                feedback_id: selected!.feedback_id,
                expected_updated_at: expectedUpdatedAt,
                requested_meaning: validated.requested_meaning,
                user_description: validated.user_description,
              },
              { now: deps.now },
            );
            if (!deps.isCurrent()) return;

            if (!result.ok) {
              if (result.code === "stale_feedback") {
                const fresh = await getSearchFeedbackDraft(
                  db,
                  selected!.feedback_id,
                );
                if (!deps.isCurrent()) return;
                if (fresh) {
                  selected = fresh;
                  availability = await availabilityFor(db, fresh);
                  editFields = undefined;
                  editErrors = undefined;
                  errorCode = "stale_edit";
                  phase = "stale_edit";
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

            const avail = await availabilityFor(db, result.draft);
            if (!deps.isCurrent()) return;
            selected = result.draft;
            availability = avail;
            items = items.map((item) =>
              item.feedback_id === result.draft.feedback_id
                ? listItemFromDraft(result.draft, avail)
                : item,
            );
            editFields = undefined;
            editErrors = undefined;
            errorCode = undefined;
            phase = "detail";
            busy = false;
            focusTarget = "heading";
            emit();
            deps.onFeedbackChanged?.();
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
      errorCode = undefined;
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
      const feedbackId = selected.feedback_id;
      const expected = selected.updated_at;
      writePromise = (async () => {
        busy = true;
        emit();
        try {
          await withDb(async (db) => {
            if (!deps.isCurrent()) return;
            const result = await deleteSearchFeedbackDraft(db, feedbackId, {
              expectedUpdatedAt: expected,
            });
            if (!deps.isCurrent()) return;
            if (!result.ok) {
              busy = false;
              if (result.code === "stale_feedback") {
                const fresh = await getSearchFeedbackDraft(db, feedbackId);
                if (fresh && deps.isCurrent()) {
                  selected = fresh;
                  availability = await availabilityFor(db, fresh);
                }
                errorCode = "stale_delete";
                phase = "stale_delete";
                focusTarget = "error_summary";
                emit();
                return;
              }
              if (result.code === "invalid_stored_feedback") {
                errorCode = "invalid_stored_feedback";
                phase = "error";
                focusTarget = "status";
                emit();
                return;
              }
              errorCode =
                result.code === "not_found" ? "not_found" : "database_write_failed";
              phase = "detail";
              focusTarget = "error_summary";
              emit();
              return;
            }
            deps.onFeedbackChanged?.();
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
      if (busy || writePromise || feedbackCount === 0) return;
      writePromise = (async () => {
        busy = true;
        phase = "exporting";
        errorCode = undefined;
        exportFilename = undefined;
        exportFeedbackCount = undefined;
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
            download(result.artifact, deps.downloadAdapter);
            if (!deps.isCurrent()) return;
            const after = await listSearchFeedbackDrafts(db);
            if (!deps.isCurrent()) return;
            busy = false;
            phase = "exported";
            exportFilename = result.artifact.filename;
            exportFeedbackCount = result.artifact.feedbackCount;
            feedbackCount = after.length;
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
      phase = feedbackCount === 0 ? "empty" : "list";
      exportFilename = undefined;
      exportFeedbackCount = undefined;
      focusTarget = "list";
      emit();
    },

    requestSendForReview(): void {
      if (busy || writePromise || feedbackCount === 0) return;
      if (!sendForReviewAvailable || typeof performHandoff !== "function") {
        errorCode = "send_unavailable";
        focusTarget = "status";
        emit();
        return;
      }
      if (
        phase !== "list" &&
        phase !== "empty" &&
        phase !== "exported" &&
        phase !== "handoff_prepared"
      ) {
        return;
      }
      phase = "confirm_handoff";
      errorCode = undefined;
      focusTarget = "status";
      emit();
    },

    cancelSendForReview(): void {
      if (phase !== "confirm_handoff") return;
      phase = feedbackCount === 0 ? "empty" : "list";
      focusTarget = "list";
      emit();
    },

    async confirmSendForReview(): Promise<void> {
      if (phase !== "confirm_handoff" || busy || writePromise || feedbackCount === 0) return;
      if (!sendForReviewAvailable || typeof performHandoff !== "function") {
        errorCode = "send_unavailable";
        phase = feedbackCount === 0 ? "empty" : "list";
        focusTarget = "status";
        emit();
        return;
      }
      writePromise = (async () => {
        busy = true;
        phase = "handoff_preparing";
        errorCode = undefined;
        exportFilename = undefined;
        exportFeedbackCount = undefined;
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
            const after = await listSearchFeedbackDrafts(db);
            if (!deps.isCurrent()) return;
            busy = false;
            phase = "handoff_prepared";
            handoffMethod = handoff.method;
            exportFilename = result.artifact.filename;
            exportFeedbackCount = result.artifact.feedbackCount;
            feedbackCount = after.length;
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
      phase = feedbackCount === 0 ? "empty" : "list";
      exportFilename = undefined;
      exportFeedbackCount = undefined;
      handoffMethod = undefined;
      focusTarget = "list";
      emit();
    },
  };
}

export type SearchFeedbackManagementSession = ReturnType<
  typeof createSearchFeedbackManagementSession
>;
