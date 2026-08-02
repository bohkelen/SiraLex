/**
 * CF1I4 — Deterministic correction-feedback export pipeline.
 *
 * list → validate all → build → serialize → byte check → reparse → artifact.
 * No download, no draft mutation, no Phase 1.5 conversion.
 */

import {
  CORRECTION_FEEDBACK_MAX_BYTES,
  CorrectionFeedbackBuildError,
  buildCorrectionFeedbackFilename,
  buildCorrectionFeedbackPackage,
  getCorrectionFeedbackUtf8ByteLength,
  parseCorrectionFeedbackJson,
  serializeCorrectionFeedbackPackage,
  type CorrectionFeedbackPackageV1,
  type ParseCorrectionFeedbackResult,
} from "./correction_feedback_package";
import {
  CorrectionDraftStoreError,
  listCorrectionDrafts,
} from "./correction_draft_store";
import {
  validateCorrectionDraftForWrite,
  type CorrectionDraftV1,
} from "./correction_draft_types";
import type { CorrectionFeedbackExportArtifact } from "./correction_feedback_file";

export type CorrectionFeedbackExportErrorCode =
  | "no_correction_drafts"
  | "invalid_local_draft"
  | "duplicate_draft_id"
  | "generated_package_invalid"
  | "generated_package_too_large"
  | "database_unavailable"
  | "database_read_failed";

export type CreateCorrectionFeedbackExportResult =
  | {
      ok: true;
      artifact: CorrectionFeedbackExportArtifact;
    }
  | {
      ok: false;
      code: CorrectionFeedbackExportErrorCode;
    };

export type BuildCorrectionFeedbackExportArtifactOptions = {
  exportedAt: string;
  appVersion?: string;
  maxBytes?: number;
  serialize?: (pkg: CorrectionFeedbackPackageV1) => string;
  parse?: (
    jsonText: string,
    options?: { byteLength?: number },
  ) => ParseCorrectionFeedbackResult;
};

function fail(code: CorrectionFeedbackExportErrorCode): CreateCorrectionFeedbackExportResult {
  return { ok: false, code };
}

function mapBuildError(err: CorrectionFeedbackBuildError): CreateCorrectionFeedbackExportResult {
  switch (err.code) {
    case "empty_drafts":
      return fail("no_correction_drafts");
    case "duplicate_draft_id":
      return fail("duplicate_draft_id");
    case "invalid_draft":
      return fail("invalid_local_draft");
    case "invalid_exported_at":
    case "invalid_app_version":
      return fail("generated_package_invalid");
    default:
      return fail("generated_package_invalid");
  }
}

/**
 * Pure artifact builder from an in-memory draft snapshot.
 * No IndexedDB, clock, DOM, Blob, or mutation.
 */
export function buildCorrectionFeedbackExportArtifact(
  drafts: readonly CorrectionDraftV1[],
  options: BuildCorrectionFeedbackExportArtifactOptions,
): CreateCorrectionFeedbackExportResult {
  const maxBytes = options.maxBytes ?? CORRECTION_FEEDBACK_MAX_BYTES;
  const serialize = options.serialize ?? serializeCorrectionFeedbackPackage;
  const parse = options.parse ?? parseCorrectionFeedbackJson;

  if (drafts.length === 0) {
    return fail("no_correction_drafts");
  }

  const seen = new Set<string>();
  for (let i = 0; i < drafts.length; i += 1) {
    const draft = drafts[i]!;
    try {
      validateCorrectionDraftForWrite(draft, `local_drafts[${i}]`);
    } catch {
      return fail("invalid_local_draft");
    }
    if (seen.has(draft.draft_id)) {
      return fail("duplicate_draft_id");
    }
    seen.add(draft.draft_id);
  }

  let pkg: CorrectionFeedbackPackageV1;
  try {
    pkg = buildCorrectionFeedbackPackage(drafts, {
      exportedAt: options.exportedAt,
      appVersion: options.appVersion,
    });
  } catch (err) {
    if (err instanceof CorrectionFeedbackBuildError) {
      return mapBuildError(err);
    }
    return fail("generated_package_invalid");
  }

  let text: string;
  let filename: string;
  try {
    text = serialize(pkg);
    filename = buildCorrectionFeedbackFilename(options.exportedAt);
  } catch {
    return fail("generated_package_invalid");
  }

  const byteLength = getCorrectionFeedbackUtf8ByteLength(text);
  if (byteLength > maxBytes) {
    return fail("generated_package_too_large");
  }

  const parsed = parse(text, { byteLength });
  if (!parsed.ok) {
    return fail("generated_package_invalid");
  }
  if (parsed.package.draft_count !== pkg.draft_count) {
    return fail("generated_package_invalid");
  }
  if (parsed.package.authority_label !== pkg.authority_label) {
    return fail("generated_package_invalid");
  }

  return {
    ok: true,
    artifact: {
      filename,
      mediaType: "application/json",
      text,
      byteLength,
      draftCount: pkg.draft_count,
      exportedAt: options.exportedAt,
    },
  };
}

/**
 * One readonly list snapshot; all bundles; no active-bundle filter.
 * Does not mutate drafts. Caller owns the database connection.
 */
export async function createCorrectionFeedbackExport(
  db: IDBDatabase,
  options: {
    exportedAt: string;
    appVersion?: string;
    maxBytes?: number;
  },
): Promise<CreateCorrectionFeedbackExportResult> {
  let drafts: CorrectionDraftV1[];
  try {
    drafts = await listCorrectionDrafts(db);
  } catch (err) {
    if (err instanceof CorrectionDraftStoreError && err.code === "invalid_stored_draft") {
      return fail("invalid_local_draft");
    }
    return fail("database_read_failed");
  }

  return buildCorrectionFeedbackExportArtifact(drafts, options);
}
