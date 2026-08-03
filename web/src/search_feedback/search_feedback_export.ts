/**
 * CF2I4 — Deterministic search-feedback export pipeline + download adapter.
 *
 * list → validate all → build → serialize → byte check → reparse → artifact → download.
 * No draft mutation, no query-log/CF1/Learning coupling, no server submission.
 */

import {
  SEARCH_FEEDBACK_MAX_BYTES,
  SearchFeedbackBuildError,
  buildSearchFeedbackFilename,
  buildSearchFeedbackPackage,
  getSearchFeedbackUtf8ByteLength,
  parseSearchFeedbackJson,
  serializeSearchFeedbackPackage,
  type ParseSearchFeedbackPackageResult,
  type SearchFeedbackPackageV1,
} from "./search_feedback_package";
import {
  SearchFeedbackStoreError,
  listSearchFeedbackDrafts,
} from "./search_feedback_store";
import type { SearchFeedbackDraftV1 } from "./search_feedback_types";
import { validateSearchFeedbackDraftForWrite } from "./search_feedback_validation";

export type SearchFeedbackExportArtifact = {
  filename: string;
  mediaType: "application/json";
  text: string;
  byteLength: number;
  feedbackCount: number;
  exportedAt: string;
};

export type SearchFeedbackExportErrorCode =
  | "no_search_feedback"
  | "invalid_local_feedback"
  | "duplicate_feedback_id"
  | "generated_package_invalid"
  | "generated_package_too_large"
  | "database_unavailable"
  | "database_read_failed";

export type CreateSearchFeedbackExportResult =
  | {
      ok: true;
      artifact: SearchFeedbackExportArtifact;
    }
  | {
      ok: false;
      code: SearchFeedbackExportErrorCode;
    };

export type BuildSearchFeedbackExportArtifactOptions = {
  exportedAt: string;
  appVersion?: string;
  maxBytes?: number;
  serialize?: (pkg: SearchFeedbackPackageV1) => string;
  parse?: (
    jsonText: string,
    options?: { byteLength?: number },
  ) => ParseSearchFeedbackPackageResult;
};

/**
 * Narrow injectable browser download seams (tests + production).
 */
export type SearchFeedbackDownloadAdapter = {
  createObjectURL(blob: Blob): string;
  clickDownload(url: string, filename: string): void;
  revokeObjectURL(url: string): void;
};

function fail(code: SearchFeedbackExportErrorCode): CreateSearchFeedbackExportResult {
  return { ok: false, code };
}

function mapBuildError(err: SearchFeedbackBuildError): CreateSearchFeedbackExportResult {
  switch (err.code) {
    case "empty_feedbacks":
      return fail("no_search_feedback");
    case "duplicate_feedback_id":
      return fail("duplicate_feedback_id");
    case "invalid_feedback":
      return fail("invalid_local_feedback");
    case "invalid_exported_at":
    case "invalid_app_version":
      return fail("generated_package_invalid");
    default:
      return fail("generated_package_invalid");
  }
}

function defaultDownloadAdapter(documentRef: Document = document): SearchFeedbackDownloadAdapter {
  return {
    createObjectURL: (blob) => URL.createObjectURL(blob),
    clickDownload: (url, filename) => {
      const link = documentRef.createElement("a");
      link.href = url;
      link.download = filename;
      link.rel = "noopener";
      documentRef.body.appendChild(link);
      link.click();
      link.remove();
    },
    revokeObjectURL: (url) => URL.revokeObjectURL(url),
  };
}

/**
 * Pure artifact builder from an in-memory feedback snapshot.
 * No IndexedDB, clock, DOM, Blob, or mutation.
 */
export function buildSearchFeedbackExportArtifact(
  feedbacks: readonly SearchFeedbackDraftV1[],
  options: BuildSearchFeedbackExportArtifactOptions,
): CreateSearchFeedbackExportResult {
  const maxBytes = options.maxBytes ?? SEARCH_FEEDBACK_MAX_BYTES;
  const serialize = options.serialize ?? serializeSearchFeedbackPackage;
  const parse = options.parse ?? parseSearchFeedbackJson;

  if (feedbacks.length === 0) {
    return fail("no_search_feedback");
  }

  const seen = new Set<string>();
  for (let i = 0; i < feedbacks.length; i += 1) {
    const draft = feedbacks[i]!;
    try {
      validateSearchFeedbackDraftForWrite(draft, `local_feedbacks[${i}]`);
    } catch {
      return fail("invalid_local_feedback");
    }
    if (seen.has(draft.feedback_id)) {
      return fail("duplicate_feedback_id");
    }
    seen.add(draft.feedback_id);
  }

  let pkg: SearchFeedbackPackageV1;
  try {
    pkg = buildSearchFeedbackPackage(feedbacks, {
      exportedAt: options.exportedAt,
      appVersion: options.appVersion,
    });
  } catch (err) {
    if (err instanceof SearchFeedbackBuildError) {
      return mapBuildError(err);
    }
    return fail("generated_package_invalid");
  }

  let text: string;
  let filename: string;
  try {
    text = serialize(pkg);
    filename = buildSearchFeedbackFilename(options.exportedAt);
  } catch {
    return fail("generated_package_invalid");
  }

  const byteLength = getSearchFeedbackUtf8ByteLength(text);
  if (byteLength > maxBytes) {
    return fail("generated_package_too_large");
  }

  const parsed = parse(text, { byteLength });
  if (!parsed.ok) {
    return fail("generated_package_invalid");
  }
  if (parsed.package.feedback_count !== pkg.feedback_count) {
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
      feedbackCount: pkg.feedback_count,
      exportedAt: options.exportedAt,
    },
  };
}

/**
 * One readonly list snapshot; all bundles; no active-bundle filter.
 * Does not mutate feedback rows. Caller owns the database connection.
 */
export async function createSearchFeedbackExport(
  db: IDBDatabase,
  options: {
    exportedAt: string;
    appVersion?: string;
    maxBytes?: number;
  },
): Promise<CreateSearchFeedbackExportResult> {
  let feedbacks: SearchFeedbackDraftV1[];
  try {
    feedbacks = await listSearchFeedbackDrafts(db);
  } catch (err) {
    if (
      err instanceof SearchFeedbackStoreError &&
      err.code === "invalid_stored_feedback"
    ) {
      return fail("invalid_local_feedback");
    }
    return fail("database_read_failed");
  }

  return buildSearchFeedbackExportArtifact(feedbacks, options);
}

/**
 * Trigger a browser download for a validated search-feedback artifact.
 * Always revokes the object URL in finally.
 */
export function downloadSearchFeedbackArtifact(
  artifact: SearchFeedbackExportArtifact,
  adapter: SearchFeedbackDownloadAdapter = defaultDownloadAdapter(),
): void {
  const blob = new Blob([artifact.text], { type: artifact.mediaType });
  const url = adapter.createObjectURL(blob);
  try {
    adapter.clickDownload(url, artifact.filename);
  } finally {
    adapter.revokeObjectURL(url);
  }
}
