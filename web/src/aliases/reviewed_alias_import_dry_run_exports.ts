/**
 * AL1D2 — Deterministic dry-run report export for reviewed alias import.
 *
 * Packages an AL1D1 dry-run result into stable reviewer artifacts:
 * accepted preview, rejected rows, skipped rows, summary markdown, manifest.
 *
 * Never writes source_aliases_v1.jsonl / records / search_index.
 * Pure module: no DOM, network, or filesystem I/O.
 */

import {
  REVIEWED_ALIAS_IMPORT_SCHEMA,
  type AcceptedAliasPreviewRow,
  type RejectedAliasImportRow,
  type ReviewedAliasDecisionRow,
  type ReviewedAliasImportDryRunResult,
  type ReviewedAliasRejectReason,
  type ReviewedAliasSkipReason,
  type SkippedAliasImportRow,
  emitAcceptedAliasesPreviewJsonl,
  emitRejectedAliasRowsJsonl,
  emitReviewedAliasImportSummaryMarkdown,
} from "./reviewed_alias_import";

export const REVIEWED_ALIAS_IMPORT_DRY_RUN_REPORT_SCHEMA =
  "reviewed_alias_import_dry_run_report_v1" as const;

export const REVIEWED_ALIAS_IMPORT_DRY_RUN_FILENAMES = {
  accepted_aliases_preview_jsonl: "accepted_aliases_preview.jsonl",
  rejected_alias_rows_jsonl: "rejected_alias_rows.jsonl",
  skipped_alias_rows_jsonl: "skipped_alias_rows.jsonl",
  import_summary_md: "import_summary.md",
  manifest_json: "import_dry_run_manifest.json",
} as const;

export type ReviewedAliasImportDryRunReportOptions = {
  /** Caller-supplied timestamp only; never read from local clock here. */
  generated_at?: string | null;
};

/** Privacy-minimized decision snapshot for reject/skip artifacts. */
export type ReviewedAliasDecisionExportSnapshot = {
  query_raw: string | null;
  normalized_query: string | null;
  lookup_mode: string | null;
  candidate_category: string | null;
  reviewer_decision: string | null;
  reviewer_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  alias_source_term: string | null;
  alias_lang: string | null;
  canonical_source_terms: string[];
  resolved_ir_ids: string[];
  evidence_ir_ids: string[];
  candidate_type: string | null;
  source_bundle_id: string | null;
  evidence_sources: string | null;
  evidence_count: number | null;
};

export type ExportedRejectedAliasRow = {
  row_index: number;
  reason: ReviewedAliasRejectReason;
  detail: string;
  decision: ReviewedAliasDecisionExportSnapshot;
};

export type ExportedSkippedAliasRow = {
  row_index: number;
  reason: ReviewedAliasSkipReason;
  detail: string;
  decision: ReviewedAliasDecisionExportSnapshot;
};

export type ReviewedAliasImportDryRunManifest = {
  schema_version: typeof REVIEWED_ALIAS_IMPORT_DRY_RUN_REPORT_SCHEMA;
  import_schema_version: typeof REVIEWED_ALIAS_IMPORT_SCHEMA;
  mode: "dry_run";
  writes_performed: false;
  generated_at: string | null;
  filenames: typeof REVIEWED_ALIAS_IMPORT_DRY_RUN_FILENAMES;
  summary: ReviewedAliasImportDryRunResult["summary"];
  authority_warning: "dry_run_preview_is_not_dictionary_truth";
};

export type ReviewedAliasImportDryRunReport = {
  schema_version: typeof REVIEWED_ALIAS_IMPORT_DRY_RUN_REPORT_SCHEMA;
  mode: "dry_run";
  writes_performed: false;
  generated_at: string | null;
  summary: ReviewedAliasImportDryRunResult["summary"];
  filenames: typeof REVIEWED_ALIAS_IMPORT_DRY_RUN_FILENAMES;
  artifacts: {
    accepted_aliases_preview_jsonl: string;
    rejected_alias_rows_jsonl: string;
    skipped_alias_rows_jsonl: string;
    import_summary_md: string;
    manifest_json: string;
  };
  /** Structured copies for tests / in-memory consumers. */
  accepted: AcceptedAliasPreviewRow[];
  rejected: ExportedRejectedAliasRow[];
  skipped: ExportedSkippedAliasRow[];
};

function compareCodePoints(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function splitList(value: string | readonly string[] | undefined): string[] {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter((v) => v !== "");
  }
  const text = String(value).trim();
  if (text === "") return [];
  return text
    .split(/[;|]/)
    .map((part) => part.trim())
    .filter((part) => part !== "");
}

export function toDecisionExportSnapshot(
  row: ReviewedAliasDecisionRow,
): ReviewedAliasDecisionExportSnapshot {
  return {
    query_raw: row.query_raw?.trim() ? row.query_raw.trim() : null,
    normalized_query: row.normalized_query?.trim() ? row.normalized_query.trim() : null,
    lookup_mode: row.lookup_mode?.trim() ? row.lookup_mode.trim() : null,
    candidate_category: row.candidate_category?.trim()
      ? row.candidate_category.trim()
      : null,
    reviewer_decision: row.reviewer_decision?.trim() ? row.reviewer_decision.trim() : null,
    reviewer_notes: row.reviewer_notes?.trim() ? row.reviewer_notes.trim() : null,
    reviewed_by: row.reviewed_by?.trim() ? row.reviewed_by.trim() : null,
    reviewed_at: row.reviewed_at?.trim() ? row.reviewed_at.trim() : null,
    alias_source_term: row.alias_source_term?.trim() ? row.alias_source_term.trim() : null,
    alias_lang: row.alias_lang?.trim() ? row.alias_lang.trim() : null,
    canonical_source_terms: splitList(row.canonical_source_terms),
    resolved_ir_ids: splitList(row.resolved_ir_ids),
    evidence_ir_ids: splitList(row.evidence_ir_ids),
    candidate_type: row.candidate_type?.trim() ? row.candidate_type.trim() : null,
    source_bundle_id: row.source_bundle_id?.trim() ? row.source_bundle_id.trim() : null,
    evidence_sources: row.evidence_sources?.trim() ? row.evidence_sources.trim() : null,
    evidence_count: typeof row.evidence_count === "number" ? row.evidence_count : null,
  };
}

function sortRejected(rows: readonly RejectedAliasImportRow[]): RejectedAliasImportRow[] {
  return [...rows].sort((a, b) => {
    const r = compareCodePoints(a.reason, b.reason);
    if (r !== 0) return r;
    if (a.row_index !== b.row_index) return a.row_index - b.row_index;
    return compareCodePoints(a.detail, b.detail);
  });
}

function sortSkipped(rows: readonly SkippedAliasImportRow[]): SkippedAliasImportRow[] {
  return [...rows].sort((a, b) => {
    const r = compareCodePoints(a.reason, b.reason);
    if (r !== 0) return r;
    if (a.row_index !== b.row_index) return a.row_index - b.row_index;
    return compareCodePoints(a.detail, b.detail);
  });
}

function sortAccepted(rows: readonly AcceptedAliasPreviewRow[]): AcceptedAliasPreviewRow[] {
  return [...rows].sort((a, b) => {
    const t = compareCodePoints(a.alias_source_term, b.alias_source_term);
    if (t !== 0) return t;
    return compareCodePoints(a.alias_id, b.alias_id);
  });
}

export function emitSkippedAliasRowsJsonl(
  rows: readonly ExportedSkippedAliasRow[],
): string {
  if (rows.length === 0) return "\n";
  return `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`;
}

export function emitExportedRejectedAliasRowsJsonl(
  rows: readonly ExportedRejectedAliasRow[],
): string {
  if (rows.length === 0) return "\n";
  return `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`;
}

function countByReason<T extends string>(
  rows: readonly { reason: T }[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[row.reason] = (counts[row.reason] ?? 0) + 1;
  }
  return counts;
}

/**
 * Richer dry-run markdown than AL1D1 summary: includes skip reasons + artifact list.
 */
export function emitReviewedAliasImportDryRunReportMarkdown(
  result: ReviewedAliasImportDryRunResult,
  exportedRejected: readonly ExportedRejectedAliasRow[],
  exportedSkipped: readonly ExportedSkippedAliasRow[],
  options: ReviewedAliasImportDryRunReportOptions = {},
): string {
  const rejectCounts = countByReason(exportedRejected);
  const skipCounts = countByReason(exportedSkipped);
  const lines: string[] = [
    "# Reviewed Alias Import Dry-Run Report",
    "",
    "```text",
    "Evidence is not dictionary authority. Do not approve aliases without human review.",
    "Dry-run only — no writes to source_aliases_v1.jsonl.",
    "```",
    "",
    `- report schema: \`${REVIEWED_ALIAS_IMPORT_DRY_RUN_REPORT_SCHEMA}\``,
    `- import schema: \`${result.schema_version}\``,
    `- mode: \`${result.mode}\``,
    `- writes_performed: **${result.writes_performed}**`,
  ];
  if (options.generated_at) {
    lines.push(`- generated_at: \`${options.generated_at}\``);
  }
  lines.push(
    `- input: ${result.summary.input_count}`,
    `- accepted (candidate preview): ${result.summary.accepted_count}`,
    `- rejected: ${result.summary.rejected_count}`,
    `- skipped: ${result.summary.skipped_count}`,
    "",
    "## Artifacts",
    "",
    `| File | Role |`,
    `|------|------|`,
    `| \`${REVIEWED_ALIAS_IMPORT_DRY_RUN_FILENAMES.accepted_aliases_preview_jsonl}\` | Proposed \`source_alias_table_v1\` candidates (\`status: candidate\`) |`,
    `| \`${REVIEWED_ALIAS_IMPORT_DRY_RUN_FILENAMES.rejected_alias_rows_jsonl}\` | Fail-closed rejects with reasons |`,
    `| \`${REVIEWED_ALIAS_IMPORT_DRY_RUN_FILENAMES.skipped_alias_rows_jsonl}\` | Non-import / duplicate skips |`,
    `| \`${REVIEWED_ALIAS_IMPORT_DRY_RUN_FILENAMES.import_summary_md}\` | This summary |`,
    `| \`${REVIEWED_ALIAS_IMPORT_DRY_RUN_FILENAMES.manifest_json}\` | Counts + filenames |`,
    "",
    "## Authority boundary",
    "",
    "- Accepted rows are **preview candidates only**.",
    "- No alias approval.",
    "- No mutation of \`source_aliases_v1.jsonl\`, supplements, records, or search index.",
    "",
    "## Language boundary",
    "",
    "- FR only into \`source_alias_table_v1\`",
    "- EN / MNK / Russian / N’Ko rejected or out of scope",
    "",
  );

  if (Object.keys(rejectCounts).length > 0) {
    lines.push("## Reject reason counts", "");
    for (const reason of Object.keys(rejectCounts).sort(compareCodePoints)) {
      lines.push(`- \`${reason}\`: ${rejectCounts[reason]}`);
    }
    lines.push("");
  }

  if (Object.keys(skipCounts).length > 0) {
    lines.push("## Skip reason counts", "");
    for (const reason of Object.keys(skipCounts).sort(compareCodePoints)) {
      lines.push(`- \`${reason}\`: ${skipCounts[reason]}`);
    }
    lines.push("");
  }

  if (result.accepted.length > 0) {
    lines.push(
      "## Accepted preview (top)",
      "",
      "| alias_source_term | candidate_type | alias_id | status |",
      "|-------------------|----------------|----------|--------|",
    );
    for (const row of result.accepted.slice(0, 25)) {
      lines.push(
        `| ${row.alias_source_term} | ${row.candidate_type} | \`${row.alias_id}\` | ${row.status} |`,
      );
    }
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

/**
 * Build a deterministic multi-artifact dry-run report from an AL1D1 result.
 * Does not mutate the input result object.
 */
export function buildReviewedAliasImportDryRunReport(
  result: ReviewedAliasImportDryRunResult,
  options: ReviewedAliasImportDryRunReportOptions = {},
): ReviewedAliasImportDryRunReport {
  if (result.mode !== "dry_run" || result.writes_performed !== false) {
    throw new Error("AL1D2 requires a dry-run result with writes_performed=false");
  }

  const accepted = sortAccepted(result.accepted).map((row) => ({ ...row }));
  const rejectedSorted = sortRejected(result.rejected);
  const skippedSorted = sortSkipped(result.skipped);

  const rejected: ExportedRejectedAliasRow[] = rejectedSorted.map((row) => ({
    row_index: row.row_index,
    reason: row.reason,
    detail: row.detail,
    decision: toDecisionExportSnapshot(row.decision_row),
  }));
  const skipped: ExportedSkippedAliasRow[] = skippedSorted.map((row) => ({
    row_index: row.row_index,
    reason: row.reason,
    detail: row.detail,
    decision: toDecisionExportSnapshot(row.decision_row),
  }));

  const generated_at = options.generated_at ?? null;

  const manifest: ReviewedAliasImportDryRunManifest = {
    schema_version: REVIEWED_ALIAS_IMPORT_DRY_RUN_REPORT_SCHEMA,
    import_schema_version: REVIEWED_ALIAS_IMPORT_SCHEMA,
    mode: "dry_run",
    writes_performed: false,
    generated_at,
    filenames: REVIEWED_ALIAS_IMPORT_DRY_RUN_FILENAMES,
    summary: { ...result.summary },
    authority_warning: "dry_run_preview_is_not_dictionary_truth",
  };

  // Reuse AL1D1 accepted emitter on a sorted shallow result copy.
  const sortedResult: ReviewedAliasImportDryRunResult = {
    ...result,
    accepted,
    rejected: rejectedSorted,
    skipped: skippedSorted,
    writes_performed: false,
    mode: "dry_run",
  };

  const artifacts = {
    accepted_aliases_preview_jsonl: emitAcceptedAliasesPreviewJsonl(sortedResult),
    rejected_alias_rows_jsonl: emitExportedRejectedAliasRowsJsonl(rejected),
    skipped_alias_rows_jsonl: emitSkippedAliasRowsJsonl(skipped),
    import_summary_md: emitReviewedAliasImportDryRunReportMarkdown(
      sortedResult,
      rejected,
      skipped,
      { generated_at },
    ),
    manifest_json: `${JSON.stringify(manifest, null, 2)}\n`,
  };

  return {
    schema_version: REVIEWED_ALIAS_IMPORT_DRY_RUN_REPORT_SCHEMA,
    mode: "dry_run",
    writes_performed: false,
    generated_at,
    summary: { ...result.summary },
    filenames: REVIEWED_ALIAS_IMPORT_DRY_RUN_FILENAMES,
    artifacts,
    accepted,
    rejected,
    skipped,
  };
}

/** Convenience: keep AL1D1 markdown available alongside AL1D2 report markdown. */
export function emitLegacyAl1d1SummaryMarkdown(
  result: ReviewedAliasImportDryRunResult,
): string {
  return emitReviewedAliasImportSummaryMarkdown(result);
}

/** Convenience: keep AL1D1 rejected emitter for raw validator rows. */
export function emitLegacyAl1d1RejectedJsonl(
  result: ReviewedAliasImportDryRunResult,
): string {
  return emitRejectedAliasRowsJsonl(result);
}
