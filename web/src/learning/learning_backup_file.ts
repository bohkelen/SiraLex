/**
 * LP1I4 — Learning backup file adapter (size, UTF-8, parse, download).
 *
 * No IndexedDB. No restore. No UI.
 */

import {
  LEARNING_BACKUP_FILE_SUFFIX,
  LEARNING_BACKUP_MAX_BYTES,
  parseLearningBackupJson,
  type LearningBackupValidationError,
  type VerifiedLearningBackupPackage,
} from "./learning_backup_package";
import type { LearningBackupExportArtifact } from "./learning_backup_export";

export type ReadLearningBackupFileResult =
  | {
      ok: true;
      filename: string;
      byteLength: number;
      verified: VerifiedLearningBackupPackage;
    }
  | {
      ok: false;
      code:
        | "no_file"
        | "file_too_large"
        | "file_read_failed"
        | "invalid_utf8"
        | "invalid_backup";
      validationErrors?: LearningBackupValidationError[];
    };

export type DownloadLearningBackupDeps = {
  createObjectUrl?: (blob: Blob) => string;
  revokeObjectUrl?: (url: string) => void;
  documentRef?: Document;
};

export const LEARNING_BACKUP_FILE_ACCEPT =
  "application/json,.json,.siralex-learning-backup.json";

export { LEARNING_BACKUP_FILE_SUFFIX, LEARNING_BACKUP_MAX_BYTES };

/**
 * Strict UTF-8 decode. Malformed sequences throw TypeError (fatal: true).
 */
export function decodeLearningBackupUtf8(bytes: ArrayBuffer): string {
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

export function getUtf8ByteLengthFromBuffer(bytes: ArrayBuffer): number {
  return bytes.byteLength;
}

/**
 * Read one File: size → bytes → strict UTF-8 → parseLearningBackupJson.
 */
export async function readLearningBackupFile(
  file: File | null | undefined,
): Promise<ReadLearningBackupFileResult> {
  if (file == null) {
    return { ok: false, code: "no_file" };
  }

  const byteLength = file.size;
  if (byteLength > LEARNING_BACKUP_MAX_BYTES) {
    return { ok: false, code: "file_too_large" };
  }

  let buffer: ArrayBuffer;
  try {
    buffer = await file.arrayBuffer();
  } catch {
    return { ok: false, code: "file_read_failed" };
  }

  if (buffer.byteLength > LEARNING_BACKUP_MAX_BYTES) {
    return { ok: false, code: "file_too_large" };
  }

  let text: string;
  try {
    text = decodeLearningBackupUtf8(buffer);
  } catch {
    return { ok: false, code: "invalid_utf8" };
  }

  const parsed = parseLearningBackupJson(text, { byteLength: buffer.byteLength });
  if (!parsed.ok) {
    return {
      ok: false,
      code: "invalid_backup",
      validationErrors: parsed.errors,
    };
  }

  return {
    ok: true,
    filename: file.name,
    byteLength: buffer.byteLength,
    verified: parsed.verified,
  };
}

/**
 * Trigger a browser download for a validated export artifact.
 * Caller must only invoke after createLearningBackupExport succeeds.
 */
export function downloadLearningBackupArtifact(
  artifact: LearningBackupExportArtifact,
  deps: DownloadLearningBackupDeps = {},
): void {
  const documentRef = deps.documentRef ?? document;
  const createObjectUrl =
    deps.createObjectUrl ?? ((blob: Blob) => URL.createObjectURL(blob));
  const revokeObjectUrl =
    deps.revokeObjectUrl ?? ((url: string) => URL.revokeObjectURL(url));

  const blob = new Blob([artifact.text], { type: artifact.mediaType });
  const url = createObjectUrl(blob);
  try {
    const link = documentRef.createElement("a");
    link.href = url;
    link.download = artifact.filename;
    link.rel = "noopener";
    documentRef.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    revokeObjectUrl(url);
  }
}
