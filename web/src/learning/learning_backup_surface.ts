/**
 * LP1I4 — Manage Learning Data surface controller (state machine).
 *
 * Presentation is separate (`render_learning_backup.ts`).
 */

import type { TranslationKey } from "../i18n";
import {
  createLearningBackupExport,
  type CreateLearningBackupExportResult,
  type LearningBackupExportArtifact,
} from "./learning_backup_export";
import {
  downloadLearningBackupArtifact,
  readLearningBackupFile,
  type DownloadLearningBackupDeps,
  type ReadLearningBackupFileResult,
} from "./learning_backup_file";
import {
  LEARNING_BACKUP_PACKAGE_SCHEMA,
  type LearningBackupRestorePolicy,
  type LearningBackupRestorePreview,
  type LearningBackupValidationError,
  type LearningBackupValidationErrorCode,
  type VerifiedLearningBackupPackage,
} from "./learning_backup_package";
import {
  analyzeLearningBackupRestore,
  commitLearningBackupRestore,
  type LearningBackupRestoreCommitResult,
} from "./learning_backup_restore";
import { countAllLearningRecords } from "./learning_record_store";

export type LearningBackupFocusTarget =
  | "none"
  | "invalid_heading"
  | "preview_heading"
  | "confirm_heading"
  | "result_heading"
  | "policy_add_missing"
  | "policy_replace_all";

export type LearningBackupMappedError = {
  code: string;
  messageKey: TranslationKey;
};

export type LearningBackupSurfaceVm = {
  generation: number;
  recordCount: number | null;
  exportBusy: boolean;
  restoreBusy: boolean;
  surfaceBusy: boolean;
  privacyVisible: true;
  exportEnabled: boolean;
  restoreFileEnabled: boolean;
  statusMessageKey?: TranslationKey;
  statusMessageVars?: Record<string, string | number>;
  focusTarget: LearningBackupFocusTarget;
  restore:
    | { phase: "idle" }
    | { phase: "reading"; filename: string }
    | { phase: "validating"; filename: string }
    | {
        phase: "invalid";
        filename: string;
        error: LearningBackupMappedError;
        detailCodes: string[];
      }
    | {
        phase: "preview";
        filename: string;
        preview: LearningBackupRestorePreview;
        selectedPolicy: LearningBackupRestorePolicy | null;
        addMissingAvailable: boolean;
      }
    | {
        phase: "confirming";
        filename: string;
        preview: LearningBackupRestorePreview;
        selectedPolicy: "replace_all";
      }
    | {
        phase: "restoring";
        filename: string;
        preview: LearningBackupRestorePreview;
        selectedPolicy: LearningBackupRestorePolicy;
      }
    | {
        phase: "success";
        policy: LearningBackupRestorePolicy;
        added_count?: number;
        skipped_existing_count?: number;
        unchanged_count?: number;
        previous_count?: number;
        restored_count?: number;
      }
    | {
        phase: "error";
        operation: "export" | "restore";
        messageKey: TranslationKey;
      };
  exportResult:
    | null
    | {
        kind: "success";
        recordCount: number;
        filename: string;
      }
    | {
        kind: "error";
        messageKey: TranslationKey;
      };
};

export type LearningBackupSurfaceCallbacks = {
  onModel: (vm: LearningBackupSurfaceVm) => void;
  onAfterRestoreSuccess?: () => void;
};

export type LearningBackupSurfaceDeps = {
  openDb: () => Promise<IDBDatabase>;
  now: () => string;
  appVersion?: string;
  createExport?: typeof createLearningBackupExport;
  analyzeRestore?: typeof analyzeLearningBackupRestore;
  commitRestore?: typeof commitLearningBackupRestore;
  readFile?: typeof readLearningBackupFile;
  downloadArtifact?: (
    artifact: LearningBackupExportArtifact,
    deps?: DownloadLearningBackupDeps,
  ) => void;
  countRecords?: typeof countAllLearningRecords;
  downloadDeps?: DownloadLearningBackupDeps;
};

const VALIDATION_MESSAGE_KEYS: Partial<
  Record<LearningBackupValidationErrorCode, TranslationKey>
> = {
  file_too_large: "learningBackup.error.fileTooLarge",
  invalid_utf8: "learningBackup.error.invalidUtf8",
  invalid_json: "learningBackup.error.invalidJson",
  unsupported_package_schema: "learningBackup.error.unsupportedSchema",
  invalid_package_field: "learningBackup.error.invalidPackage",
  invalid_exported_at: "learningBackup.error.invalidPackage",
  record_count_mismatch: "learningBackup.error.invalidPackage",
  invalid_bundle_summary: "learningBackup.error.invalidPackage",
  bundle_summary_mismatch: "learningBackup.error.invalidPackage",
  invalid_learning_record: "learningBackup.error.invalidPackage",
  inconsistent_review_fields: "learningBackup.error.invalidPackage",
  duplicate_learning_identity: "learningBackup.error.invalidPackage",
  invalid_top_level: "learningBackup.error.invalidPackage",
  error_limit_reached: "learningBackup.error.invalidPackage",
};

function mapFileFailure(result: Extract<ReadLearningBackupFileResult, { ok: false }>): {
  error: LearningBackupMappedError;
  detailCodes: string[];
} {
  if (result.code === "file_too_large") {
    return {
      error: { code: result.code, messageKey: "learningBackup.error.fileTooLarge" },
      detailCodes: [result.code],
    };
  }
  if (result.code === "invalid_utf8") {
    return {
      error: { code: result.code, messageKey: "learningBackup.error.invalidUtf8" },
      detailCodes: [result.code],
    };
  }
  if (result.code === "no_file" || result.code === "file_read_failed") {
    return {
      error: { code: result.code, messageKey: "learningBackup.error.readFailed" },
      detailCodes: [result.code],
    };
  }
  const codes = (result.validationErrors ?? []).map((e) => e.code);
  const primary = result.validationErrors?.[0]?.code;
  const messageKey =
    (primary && VALIDATION_MESSAGE_KEYS[primary]) || "learningBackup.error.invalidPackage";
  return {
    error: { code: primary ?? "invalid_backup", messageKey },
    detailCodes: codes.length > 0 ? codes : ["invalid_backup"],
  };
}

export function createLearningBackupSurface(
  deps: LearningBackupSurfaceDeps,
  callbacks: LearningBackupSurfaceCallbacks,
) {
  let generation = 0;
  let disposed = false;
  let recordCount: number | null = null;
  let exportBusy = false;
  let restoreBusy = false;
  let fileToken = 0;
  let verified: VerifiedLearningBackupPackage | null = null;
  let restorePhase: LearningBackupSurfaceVm["restore"] = { phase: "idle" };
  let exportResult: LearningBackupSurfaceVm["exportResult"] = null;
  let focusTarget: LearningBackupFocusTarget = "none";

  const createExport = deps.createExport ?? createLearningBackupExport;
  const analyzeRestore = deps.analyzeRestore ?? analyzeLearningBackupRestore;
  const commitRestore = deps.commitRestore ?? commitLearningBackupRestore;
  const readFile = deps.readFile ?? readLearningBackupFile;
  const downloadArtifact = deps.downloadArtifact ?? downloadLearningBackupArtifact;
  const countRecords = deps.countRecords ?? countAllLearningRecords;

  function isCurrent(gen: number): boolean {
    return !disposed && gen === generation;
  }

  function buildVm(): LearningBackupSurfaceVm {
    const surfaceBusy = exportBusy || restoreBusy;
    const exportEnabled =
      !surfaceBusy && recordCount !== null && recordCount > 0 && restorePhase.phase !== "confirming";
    const restoreFileEnabled = !surfaceBusy;
    return {
      generation,
      recordCount,
      exportBusy,
      restoreBusy,
      surfaceBusy,
      privacyVisible: true,
      exportEnabled,
      restoreFileEnabled,
      focusTarget,
      restore: restorePhase,
      exportResult,
    };
  }

  function emit(): void {
    if (disposed) return;
    callbacks.onModel(buildVm());
  }

  function bumpGeneration(): number {
    generation += 1;
    return generation;
  }

  async function refreshCount(): Promise<void> {
    const gen = generation;
    recordCount = null;
    emit();
    try {
      const db = await deps.openDb();
      try {
        const count = await countRecords(db);
        if (!isCurrent(gen)) return;
        recordCount = count;
        emit();
      } finally {
        // Caller-owned in app; tests may reuse. Do not close here.
      }
    } catch {
      if (!isCurrent(gen)) return;
      recordCount = 0;
      emit();
    }
  }

  function clearRestoreSelection(): void {
    verified = null;
    restorePhase = { phase: "idle" };
    focusTarget = "none";
  }

  async function startExport(): Promise<void> {
    if (disposed || exportBusy || restoreBusy) return;
    if (recordCount === null || recordCount === 0) return;

    exportBusy = true;
    exportResult = null;
    const gen = generation;
    emit();

    let result: CreateLearningBackupExportResult;
    try {
      result = await createExport({
        openDb: deps.openDb,
        now: deps.now,
        appVersion: deps.appVersion,
      });
    } catch {
      if (!isCurrent(gen)) return;
      exportBusy = false;
      exportResult = { kind: "error", messageKey: "learningBackup.export.failed" };
      focusTarget = "result_heading";
      emit();
      return;
    }

    if (!isCurrent(gen)) return;

    if (!result.ok) {
      exportBusy = false;
      const key: TranslationKey =
        result.code === "no_learning_records"
          ? "learningBackup.export.empty"
          : "learningBackup.export.failed";
      exportResult = { kind: "error", messageKey: key };
      focusTarget = "result_heading";
      emit();
      return;
    }

    try {
      downloadArtifact(result.artifact, deps.downloadDeps);
    } catch {
      if (!isCurrent(gen)) return;
      exportBusy = false;
      exportResult = { kind: "error", messageKey: "learningBackup.export.failed" };
      focusTarget = "result_heading";
      emit();
      return;
    }

    if (!isCurrent(gen)) return;
    exportBusy = false;
    exportResult = {
      kind: "success",
      recordCount: result.artifact.recordCount,
      filename: result.artifact.filename,
    };
    focusTarget = "result_heading";
    emit();
  }

  async function selectRestoreFile(file: File | null): Promise<void> {
    if (disposed || exportBusy || restoreBusy) return;

    exportResult = null;
    const token = ++fileToken;
    const gen = generation;

    if (file == null) {
      clearRestoreSelection();
      emit();
      return;
    }

    verified = null;
    restorePhase = { phase: "reading", filename: file.name };
    focusTarget = "none";
    emit();

    restorePhase = { phase: "validating", filename: file.name };
    emit();

    const readResult = await readFile(file);
    if (!isCurrent(gen) || token !== fileToken) return;

    if (!readResult.ok) {
      const mapped = mapFileFailure(readResult);
      restorePhase = {
        phase: "invalid",
        filename: file.name,
        error: mapped.error,
        detailCodes: mapped.detailCodes,
      };
      focusTarget = "invalid_heading";
      emit();
      return;
    }

    verified = readResult.verified;
    restorePhase = { phase: "validating", filename: readResult.filename };
    emit();

    let db: IDBDatabase;
    try {
      db = await deps.openDb();
    } catch {
      if (!isCurrent(gen) || token !== fileToken) return;
      restorePhase = {
        phase: "error",
        operation: "restore",
        messageKey: "learningBackup.restore.failed",
      };
      focusTarget = "result_heading";
      emit();
      return;
    }

    const previewResult = await analyzeRestore(db, readResult.verified);
    if (!isCurrent(gen) || token !== fileToken) return;

    if (!previewResult.ok) {
      restorePhase = {
        phase: "invalid",
        filename: readResult.filename,
        error: {
          code: previewResult.code,
          messageKey: "learningBackup.error.invalidPackage",
        },
        detailCodes: [previewResult.code],
      };
      focusTarget = "invalid_heading";
      emit();
      return;
    }

    const addMissingAvailable =
      previewResult.preview.add_missing.state === "available";
    restorePhase = {
      phase: "preview",
      filename: readResult.filename,
      preview: previewResult.preview,
      selectedPolicy: addMissingAvailable ? "add_missing" : null,
      addMissingAvailable,
    };
    focusTarget = "preview_heading";
    emit();
  }

  function selectPolicy(policy: LearningBackupRestorePolicy): void {
    if (disposed || restoreBusy || exportBusy) return;
    if (restorePhase.phase !== "preview") return;
    if (policy === "add_missing" && !restorePhase.addMissingAvailable) return;
    restorePhase = { ...restorePhase, selectedPolicy: policy };
    emit();
  }

  function requestCommit(): void {
    if (disposed || restoreBusy || exportBusy) return;
    if (restorePhase.phase !== "preview" || restorePhase.selectedPolicy == null) return;

    if (restorePhase.selectedPolicy === "replace_all") {
      restorePhase = {
        phase: "confirming",
        filename: restorePhase.filename,
        preview: restorePhase.preview,
        selectedPolicy: "replace_all",
      };
      focusTarget = "confirm_heading";
      emit();
      return;
    }

    void commitSelected("add_missing");
  }

  function cancelConfirm(): void {
    if (disposed || restoreBusy) return;
    if (restorePhase.phase !== "confirming") return;
    restorePhase = {
      phase: "preview",
      filename: restorePhase.filename,
      preview: restorePhase.preview,
      selectedPolicy: "replace_all",
      addMissingAvailable: restorePhase.preview.add_missing.state === "available",
    };
    focusTarget = "policy_replace_all";
    emit();
  }

  function confirmReplaceAll(): void {
    if (disposed || restoreBusy || exportBusy) return;
    if (restorePhase.phase !== "confirming") return;
    void commitSelected("replace_all");
  }

  async function commitSelected(policy: LearningBackupRestorePolicy): Promise<void> {
    if (disposed || restoreBusy || exportBusy) return;
    if (!verified) return;
    if (
      restorePhase.phase !== "preview" &&
      restorePhase.phase !== "confirming" &&
      restorePhase.phase !== "restoring"
    ) {
      return;
    }

    const filename =
      restorePhase.phase === "preview" ||
      restorePhase.phase === "confirming" ||
      restorePhase.phase === "restoring"
        ? restorePhase.filename
        : "";
    const preview =
      restorePhase.phase === "preview" ||
      restorePhase.phase === "confirming" ||
      restorePhase.phase === "restoring"
        ? restorePhase.preview
        : null;
    if (!preview) return;

    restoreBusy = true;
    restorePhase = {
      phase: "restoring",
      filename,
      preview,
      selectedPolicy: policy,
    };
    const gen = generation;
    const packageRef = verified;
    emit();

    let result: LearningBackupRestoreCommitResult;
    try {
      result = await commitRestore({
        openDb: deps.openDb,
        verified: packageRef,
        policy,
      });
    } catch {
      if (!isCurrent(gen)) return;
      restoreBusy = false;
      restorePhase = {
        phase: "error",
        operation: "restore",
        messageKey: "learningBackup.restore.failed",
      };
      focusTarget = "result_heading";
      emit();
      return;
    }

    // Committed restore remains durable even if surface becomes stale.
    if (!result.ok) {
      if (!isCurrent(gen)) return;
      restoreBusy = false;
      restorePhase = {
        phase: "error",
        operation: "restore",
        messageKey: "learningBackup.restore.failed",
      };
      focusTarget = "result_heading";
      emit();
      return;
    }

    if (!isCurrent(gen)) {
      // Data committed; do not redraw this surface.
      return;
    }

    restoreBusy = false;
    verified = null;
    if (result.policy === "add_missing") {
      restorePhase = {
        phase: "success",
        policy: "add_missing",
        added_count: result.added_count,
        skipped_existing_count: result.skipped_existing_count,
        unchanged_count: result.unchanged_count,
      };
    } else {
      restorePhase = {
        phase: "success",
        policy: "replace_all",
        previous_count: result.previous_count,
        restored_count: result.restored_count,
      };
    }
    focusTarget = "result_heading";
    emit();
    callbacks.onAfterRestoreSuccess?.();
    await refreshCount();
  }

  function cancelRestore(): void {
    if (disposed || restoreBusy) return;
    clearRestoreSelection();
    emit();
  }

  function invalidatePreviewForBundleChange(): void {
    if (disposed) return;
    if (
      restorePhase.phase === "preview" ||
      restorePhase.phase === "confirming" ||
      restorePhase.phase === "validating" ||
      restorePhase.phase === "reading"
    ) {
      clearRestoreSelection();
      emit();
    }
  }

  function dispose(): void {
    disposed = true;
    bumpGeneration();
    verified = null;
  }

  // Initial load
  void refreshCount();

  return {
    getVm: buildVm,
    refreshCount,
    startExport,
    selectRestoreFile,
    selectPolicy,
    requestCommit,
    cancelConfirm,
    confirmReplaceAll,
    cancelRestore,
    invalidatePreviewForBundleChange,
    dispose,
    /** Test seam: current generation */
    getGeneration: () => generation,
  };
}

export type LearningBackupSurface = ReturnType<typeof createLearningBackupSurface>;

export { LEARNING_BACKUP_PACKAGE_SCHEMA };
