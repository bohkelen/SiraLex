/**
 * AL1D4 — Pure governed alias source append transform.
 *
 * Revalidates AL1D1/AL1D2 accepted candidates and returns updated
 * source_aliases_v1 JSONL content only when the full batch is safe.
 *
 * Never writes files, never approves, never applies/publishes search indexes.
 * Pure module: no DOM, network, or filesystem I/O.
 */

import { computeSearchKeys, normalizeNfc } from "../norm/norm_v1";
import {
  SOURCE_ALIAS_TABLE_SCHEMA,
  validateReviewedAliasImportDryRun,
  type AcceptedAliasPreviewRow,
  type ReviewedAliasDecisionRow,
  type ReviewedAliasImportContext,
  type ReviewedAliasIndexRow,
} from "./reviewed_alias_import";

export const GOVERNED_ALIAS_APPEND_SCHEMA = "governed_alias_append_v1" as const;

export type GovernedAliasAppendOptions = {
  expected_bundle_id: string;
  source_label: string;
  reviewed_by?: string;
  /** Explicit ISO timestamp for report provenance only (not written as schema fields). */
  reviewed_at?: string;
  write_mode?: "all_or_nothing";
  duplicate_policy?: "skip_exact";
};

export type AppendedAliasCandidateRow = {
  schema_version: typeof SOURCE_ALIAS_TABLE_SCHEMA;
  alias_table_version: string;
  alias_id: string;
  status: "candidate";
  direction: "source_to_target";
  alias_source_term: string;
  canonical_source_terms: string[];
  resolved_ir_ids: string[];
  candidate_type: AcceptedAliasPreviewRow["candidate_type"];
  evidence_ir_ids: string[];
  rationale: string;
  source_bundle_id: string;
  source_norm_version: string;
};

export type GovernedAliasAppendSkip = {
  alias_source_term: string;
  alias_id?: string;
  reason:
    | "exact_duplicate_existing"
    | "exact_duplicate_input"
    | "identical_index_postings";
  detail: string;
};

export type GovernedAliasAppendError = {
  code: string;
  detail: string;
  alias_source_term?: string;
  alias_id?: string;
};

export type GovernedAliasAppendSuccess = {
  ok: true;
  updated_source_aliases_jsonl: string;
  appended_rows: AppendedAliasCandidateRow[];
  skipped_rows: GovernedAliasAppendSkip[];
  rejected_rows: [];
  errors: [];
  summary: {
    existing_row_count: number;
    input_candidate_count: number;
    appended_count: number;
    skipped_duplicate_count: number;
  };
  report: {
    source_label: string;
    reviewed_by: string | null;
    reviewed_at: string | null;
    expected_bundle_id: string;
  };
  writes_performed: false;
};

export type GovernedAliasAppendFailure = {
  ok: false;
  appended_rows: [];
  skipped_rows: GovernedAliasAppendSkip[];
  rejected_rows: Array<{ alias_source_term?: string; reason: string; detail: string }>;
  errors: GovernedAliasAppendError[];
  summary: {
    existing_row_count: number;
    input_candidate_count: number;
    appended_count: 0;
    skipped_duplicate_count: number;
  };
  report: {
    source_label: string;
    reviewed_by: string | null;
    reviewed_at: string | null;
    expected_bundle_id: string;
  };
  writes_performed: false;
};

export type GovernedAliasAppendResult =
  | GovernedAliasAppendSuccess
  | GovernedAliasAppendFailure;

type ParsedExistingRow = {
  raw_line: string;
  row: Record<string, unknown>;
  alias_source_term: string;
  resolved_ir_ids: string[];
  alias_id: string;
  status: string;
};

const ALLOWED_STATUSES = new Set(["candidate", "approved", "rejected", "deferred"]);
const ALLOWED_CANDIDATE_TYPES = new Set([
  "french_plural_singular_alias",
  "french_gender_alias",
  "hyphenation_or_compound_alias",
  "french_common_form_alias",
]);

function primaryCasefold(term: string): string {
  const trimmed = term.trim();
  if (trimmed === "") return "";
  return computeSearchKeys([normalizeNfc(trimmed)]).casefold[0] ?? "";
}

function sameStringList(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  if (!value.every((v) => typeof v === "string" && v.trim() !== "")) return null;
  return value.map((v) => String(v));
}

function fail(
  partial: {
    skipped_rows: GovernedAliasAppendSkip[];
    rejected_rows?: GovernedAliasAppendFailure["rejected_rows"];
    errors: GovernedAliasAppendError[];
    summary: {
      existing_row_count: number;
      input_candidate_count: number;
      skipped_duplicate_count: number;
    };
    report: GovernedAliasAppendFailure["report"];
  },
): GovernedAliasAppendFailure {
  return {
    ok: false,
    appended_rows: [],
    skipped_rows: partial.skipped_rows,
    rejected_rows: partial.rejected_rows ?? [],
    errors: partial.errors,
    summary: {
      existing_row_count: partial.summary.existing_row_count,
      input_candidate_count: partial.summary.input_candidate_count,
      appended_count: 0,
      skipped_duplicate_count: partial.summary.skipped_duplicate_count,
    },
    report: partial.report,
    writes_performed: false,
  };
}

/**
 * Split JSONL into raw lines without the final trailing newline marker.
 * Empty string / "\n" → zero rows. Internal blank lines are invalid.
 */
export function splitSourceAliasJsonlRawLines(jsonl: string): {
  ok: true;
  raw_lines: string[];
  had_trailing_newline: boolean;
} | { ok: false; detail: string } {
  if (jsonl === "") {
    return { ok: true, raw_lines: [], had_trailing_newline: false };
  }
  const hadTrailing = jsonl.endsWith("\n");
  const body = hadTrailing ? jsonl.slice(0, -1) : jsonl;
  if (body === "") {
    return { ok: true, raw_lines: [], had_trailing_newline: true };
  }
  const raw_lines = body.split("\n");
  for (let i = 0; i < raw_lines.length; i++) {
    if (raw_lines[i]!.trim() === "") {
      return { ok: false, detail: `Blank line at index ${i} is not allowed.` };
    }
  }
  return { ok: true, raw_lines, had_trailing_newline: hadTrailing };
}

function parseExistingAliasTable(jsonl: string): {
  ok: true;
  raw_lines: string[];
  rows: ParsedExistingRow[];
} | { ok: false; detail: string } {
  const split = splitSourceAliasJsonlRawLines(jsonl);
  if (!split.ok) return split;

  const rows: ParsedExistingRow[] = [];
  const seenAliasIds = new Set<string>();

  for (let i = 0; i < split.raw_lines.length; i++) {
    const raw_line = split.raw_lines[i]!;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw_line);
    } catch {
      return { ok: false, detail: `Malformed JSON at line ${i + 1}.` };
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { ok: false, detail: `Expected object at line ${i + 1}.` };
    }
    const row = parsed as Record<string, unknown>;
    if (row.schema_version !== SOURCE_ALIAS_TABLE_SCHEMA) {
      return { ok: false, detail: `Invalid schema_version at line ${i + 1}.` };
    }
    if (typeof row.status !== "string" || !ALLOWED_STATUSES.has(row.status)) {
      return { ok: false, detail: `Invalid status at line ${i + 1}.` };
    }
    if (row.direction !== "source_to_target") {
      return { ok: false, detail: `Invalid direction at line ${i + 1}.` };
    }
    if (typeof row.alias_id !== "string" || row.alias_id.trim() === "") {
      return { ok: false, detail: `Invalid alias_id at line ${i + 1}.` };
    }
    if (seenAliasIds.has(row.alias_id)) {
      return { ok: false, detail: `Duplicate alias_id ${row.alias_id} in existing table.` };
    }
    seenAliasIds.add(row.alias_id);
    if (typeof row.alias_source_term !== "string" || row.alias_source_term.trim() === "") {
      return { ok: false, detail: `Invalid alias_source_term at line ${i + 1}.` };
    }
    if (typeof row.candidate_type !== "string" || !ALLOWED_CANDIDATE_TYPES.has(row.candidate_type)) {
      return { ok: false, detail: `Invalid candidate_type at line ${i + 1}.` };
    }
    const resolved = asStringArray(row.resolved_ir_ids);
    const canonical = asStringArray(row.canonical_source_terms);
    const evidence = asStringArray(row.evidence_ir_ids);
    if (!resolved || !canonical || !evidence) {
      return { ok: false, detail: `Invalid id/term arrays at line ${i + 1}.` };
    }
    for (const field of ["rationale", "source_bundle_id", "source_norm_version", "alias_table_version"] as const) {
      if (typeof row[field] !== "string" || String(row[field]).trim() === "") {
        return { ok: false, detail: `Invalid ${field} at line ${i + 1}.` };
      }
    }
    rows.push({
      raw_line,
      row,
      alias_source_term: row.alias_source_term,
      resolved_ir_ids: resolved,
      alias_id: row.alias_id,
      status: row.status,
    });
  }

  return { ok: true, raw_lines: split.raw_lines, rows };
}

function serializeCandidateRow(row: AppendedAliasCandidateRow): string {
  // Stable key order; omit reviewer/reviewed_at/provenance_source (report-only).
  const payload: Record<string, unknown> = {
    schema_version: row.schema_version,
    alias_table_version: row.alias_table_version,
    alias_id: row.alias_id,
    status: "candidate",
    direction: "source_to_target",
    alias_source_term: row.alias_source_term,
    canonical_source_terms: row.canonical_source_terms,
    resolved_ir_ids: row.resolved_ir_ids,
    candidate_type: row.candidate_type,
    evidence_ir_ids: row.evidence_ir_ids,
    rationale: row.rationale,
    source_bundle_id: row.source_bundle_id,
    source_norm_version: row.source_norm_version,
  };
  return JSON.stringify(payload);
}

function buildAppendRationale(
  candidate: AcceptedAliasPreviewRow,
  options: GovernedAliasAppendOptions,
): string {
  const parts = [
    candidate.rationale.trim(),
    `source_label=${options.source_label}`,
    "append_status=candidate",
    "governed_append=al1d4",
  ];
  if (options.reviewed_by?.trim()) {
    parts.push(`reviewed_by=${options.reviewed_by.trim()}`);
  }
  if (options.reviewed_at?.trim()) {
    parts.push(`reviewed_at=${options.reviewed_at.trim()}`);
  }
  return parts.join(" | ");
}

function candidateToDecisionRow(candidate: AcceptedAliasPreviewRow): ReviewedAliasDecisionRow {
  return {
    query_raw: candidate.alias_source_term,
    normalized_query: candidate.alias_source_term,
    lookup_mode: "fr->mnk",
    candidate_category: "possible_alias",
    reviewer_decision: "approve_alias",
    alias_source_term: candidate.alias_source_term,
    alias_lang: "fr",
    canonical_source_terms: [...candidate.canonical_source_terms],
    resolved_ir_ids: [...candidate.resolved_ir_ids],
    evidence_ir_ids: [...candidate.evidence_ir_ids],
    candidate_type: candidate.candidate_type,
    source_bundle_id: candidate.source_bundle_id,
    source_norm_version: candidate.source_norm_version,
    alias_table_version: candidate.alias_table_version,
    status: "candidate",
  };
}

/**
 * Pure all-or-nothing append transform for source_aliases_v1 content.
 */
export function buildGovernedAliasAppend(args: {
  existing_source_aliases_jsonl: string;
  accepted_candidates: readonly AcceptedAliasPreviewRow[];
  known_ir_ids: ReviewedAliasImportContext["known_ir_ids"];
  index_rows: readonly ReviewedAliasIndexRow[];
  options: GovernedAliasAppendOptions;
}): GovernedAliasAppendResult {
  const options = args.options;
  const report = {
    source_label: options.source_label,
    reviewed_by: options.reviewed_by?.trim() ? options.reviewed_by.trim() : null,
    reviewed_at: options.reviewed_at?.trim() ? options.reviewed_at.trim() : null,
    expected_bundle_id: options.expected_bundle_id,
  };
  const writeMode = options.write_mode ?? "all_or_nothing";
  if (writeMode !== "all_or_nothing") {
    return fail({
      skipped_rows: [],
      errors: [{ code: "unsupported_write_mode", detail: `write_mode=${writeMode}` }],
      summary: {
        existing_row_count: 0,
        input_candidate_count: args.accepted_candidates.length,
        skipped_duplicate_count: 0,
      },
      report,
    });
  }
  if (!options.expected_bundle_id.trim() || !options.source_label.trim()) {
    return fail({
      skipped_rows: [],
      errors: [
        {
          code: "missing_options",
          detail: "expected_bundle_id and source_label are required.",
        },
      ],
      summary: {
        existing_row_count: 0,
        input_candidate_count: args.accepted_candidates.length,
        skipped_duplicate_count: 0,
      },
      report,
    });
  }

  const parsed = parseExistingAliasTable(args.existing_source_aliases_jsonl);
  if (!parsed.ok) {
    return fail({
      skipped_rows: [],
      errors: [{ code: "existing_table_invalid", detail: parsed.detail }],
      summary: {
        existing_row_count: 0,
        input_candidate_count: args.accepted_candidates.length,
        skipped_duplicate_count: 0,
      },
      report,
    });
  }

  const existingCount = parsed.rows.length;
  const skipped_rows: GovernedAliasAppendSkip[] = [];

  // Validate existing IR references when possible.
  const known = args.known_ir_ids instanceof Set
    ? args.known_ir_ids
    : new Set(args.known_ir_ids);
  for (const existing of parsed.rows) {
    for (const irId of existing.resolved_ir_ids) {
      if (!known.has(irId)) {
        return fail({
          skipped_rows: [],
          errors: [
            {
              code: "existing_table_ir_missing",
              detail: `Existing alias ${existing.alias_id} references unknown ir_id ${irId}`,
              alias_id: existing.alias_id,
              alias_source_term: existing.alias_source_term,
            },
          ],
          summary: {
            existing_row_count: existingCount,
            input_candidate_count: args.accepted_candidates.length,
            skipped_duplicate_count: 0,
          },
          report,
        });
      }
    }
  }

  // Input duplicate detection (same alias, different postings → fail).
  const inputByCasefold = new Map<string, AcceptedAliasPreviewRow>();
  const dedupedInput: AcceptedAliasPreviewRow[] = [];
  for (const candidate of args.accepted_candidates) {
    if (candidate.status !== "candidate") {
      return fail({
        skipped_rows,
        rejected_rows: [
          {
            alias_source_term: candidate.alias_source_term,
            reason: "status_not_candidate",
            detail: `Input status must be candidate; got ${candidate.status}`,
          },
        ],
        errors: [
          {
            code: "status_not_candidate",
            detail: `Input status must be candidate; got ${String(candidate.status)}`,
            alias_source_term: candidate.alias_source_term,
            alias_id: candidate.alias_id,
          },
        ],
        summary: {
          existing_row_count: existingCount,
          input_candidate_count: args.accepted_candidates.length,
          skipped_duplicate_count: skipped_rows.length,
        },
        report,
      });
    }
    if (candidate.source_bundle_id !== options.expected_bundle_id) {
      return fail({
        skipped_rows,
        rejected_rows: [
          {
            alias_source_term: candidate.alias_source_term,
            reason: "bundle_id_mismatch",
            detail: `expected ${options.expected_bundle_id}; got ${candidate.source_bundle_id}`,
          },
        ],
        errors: [
          {
            code: "bundle_id_mismatch",
            detail: `expected ${options.expected_bundle_id}; got ${candidate.source_bundle_id}`,
            alias_source_term: candidate.alias_source_term,
            alias_id: candidate.alias_id,
          },
        ],
        summary: {
          existing_row_count: existingCount,
          input_candidate_count: args.accepted_candidates.length,
          skipped_duplicate_count: skipped_rows.length,
        },
        report,
      });
    }

    const key = primaryCasefold(candidate.alias_source_term);
    const prior = inputByCasefold.get(key);
    if (prior) {
      if (
        sameStringList(prior.resolved_ir_ids, candidate.resolved_ir_ids) &&
        sameStringList(prior.canonical_source_terms, candidate.canonical_source_terms)
      ) {
        skipped_rows.push({
          alias_source_term: candidate.alias_source_term,
          alias_id: candidate.alias_id,
          reason: "exact_duplicate_input",
          detail: "Duplicate candidate in input with identical postings; keeping first.",
        });
        continue;
      }
      return fail({
        skipped_rows,
        rejected_rows: [
          {
            alias_source_term: candidate.alias_source_term,
            reason: "input_conflict",
            detail: "Same alias appears in input with different postings.",
          },
        ],
        errors: [
          {
            code: "input_conflict",
            detail: "Same alias appears in input with different postings.",
            alias_source_term: candidate.alias_source_term,
            alias_id: candidate.alias_id,
          },
        ],
        summary: {
          existing_row_count: existingCount,
          input_candidate_count: args.accepted_candidates.length,
          skipped_duplicate_count: skipped_rows.length,
        },
        report,
      });
    }
    inputByCasefold.set(key, candidate);
    dedupedInput.push(candidate);
  }

  // Existing table conflicts vs exact duplicates.
  const toValidate: AcceptedAliasPreviewRow[] = [];
  for (const candidate of dedupedInput) {
    const key = primaryCasefold(candidate.alias_source_term);
    let exactExisting = false;
    for (const existing of parsed.rows) {
      if (primaryCasefold(existing.alias_source_term) !== key) continue;
      if (sameStringList(existing.resolved_ir_ids, candidate.resolved_ir_ids)) {
        exactExisting = true;
        skipped_rows.push({
          alias_source_term: candidate.alias_source_term,
          alias_id: candidate.alias_id,
          reason: "exact_duplicate_existing",
          detail: `Exact duplicate of existing alias_id=${existing.alias_id}`,
        });
        break;
      }
      return fail({
        skipped_rows,
        rejected_rows: [
          {
            alias_source_term: candidate.alias_source_term,
            reason: "alias_conflict",
            detail: `Conflicts with existing alias_id=${existing.alias_id} (different postings).`,
          },
        ],
        errors: [
          {
            code: "alias_conflict",
            detail: `Conflicts with existing alias_id=${existing.alias_id} (different postings).`,
            alias_source_term: candidate.alias_source_term,
            alias_id: candidate.alias_id,
          },
        ],
        summary: {
          existing_row_count: existingCount,
          input_candidate_count: args.accepted_candidates.length,
          skipped_duplicate_count: skipped_rows.length,
        },
        report,
      });
    }
    if (!exactExisting) toValidate.push(candidate);
  }

  if (toValidate.length === 0) {
    // Nothing to append — success with unchanged content (still final newline).
    const unchanged =
      parsed.raw_lines.length === 0
        ? "\n"
        : `${parsed.raw_lines.join("\n")}\n`;
    return {
      ok: true,
      updated_source_aliases_jsonl: unchanged,
      appended_rows: [],
      skipped_rows,
      rejected_rows: [],
      errors: [],
      summary: {
        existing_row_count: existingCount,
        input_candidate_count: args.accepted_candidates.length,
        appended_count: 0,
        skipped_duplicate_count: skipped_rows.length,
      },
      report,
      writes_performed: false,
    };
  }

  // alias_id collisions against existing table
  const existingIds = new Set(parsed.rows.map((r) => r.alias_id));
  for (const candidate of toValidate) {
    if (existingIds.has(candidate.alias_id)) {
      return fail({
        skipped_rows,
        rejected_rows: [
          {
            alias_source_term: candidate.alias_source_term,
            reason: "alias_id_conflict",
            detail: `alias_id already exists: ${candidate.alias_id}`,
          },
        ],
        errors: [
          {
            code: "alias_id_conflict",
            detail: `alias_id already exists: ${candidate.alias_id}`,
            alias_id: candidate.alias_id,
            alias_source_term: candidate.alias_source_term,
          },
        ],
        summary: {
          existing_row_count: existingCount,
          input_candidate_count: args.accepted_candidates.length,
          skipped_duplicate_count: skipped_rows.length,
        },
        report,
      });
    }
  }

  const decisionRows = toValidate.map(candidateToDecisionRow);
  const dryRun = validateReviewedAliasImportDryRun(decisionRows, {
    known_ir_ids: args.known_ir_ids,
    index_rows: args.index_rows,
    existing_alias_rows: parsed.rows.map((r) => ({
      alias_source_term: r.alias_source_term,
      resolved_ir_ids: r.resolved_ir_ids,
      status: r.status,
    })),
  });

  if (dryRun.rejected.length > 0) {
    return fail({
      skipped_rows,
      rejected_rows: dryRun.rejected.map((r) => ({
        alias_source_term: r.decision_row.alias_source_term,
        reason: r.reason,
        detail: r.detail,
      })),
      errors: dryRun.rejected.map((r) => ({
        code: r.reason,
        detail: r.detail,
        alias_source_term: r.decision_row.alias_source_term,
      })),
      summary: {
        existing_row_count: existingCount,
        input_candidate_count: args.accepted_candidates.length,
        skipped_duplicate_count: skipped_rows.length,
      },
      report,
    });
  }

  // Map revalidation skips (identical index) — non-fatal.
  const acceptedByTerm = new Map(
    dryRun.accepted.map((row) => [primaryCasefold(row.alias_source_term), row]),
  );
  for (const skip of dryRun.skipped) {
    if (
      skip.reason === "identical_existing_alias" ||
      skip.reason === "identical_index_postings"
    ) {
      skipped_rows.push({
        alias_source_term: skip.decision_row.alias_source_term ?? "",
        reason:
          skip.reason === "identical_existing_alias"
            ? "exact_duplicate_existing"
            : "identical_index_postings",
        detail: skip.detail,
      });
      continue;
    }
    // Unexpected skip during approve_alias revalidation is fatal.
    return fail({
      skipped_rows,
      rejected_rows: [
        {
          alias_source_term: skip.decision_row.alias_source_term,
          reason: skip.reason,
          detail: skip.detail,
        },
      ],
      errors: [
        {
          code: skip.reason,
          detail: skip.detail,
          alias_source_term: skip.decision_row.alias_source_term,
        },
      ],
      summary: {
        existing_row_count: existingCount,
        input_candidate_count: args.accepted_candidates.length,
        skipped_duplicate_count: skipped_rows.length,
      },
      report,
    });
  }

  const appended_rows: AppendedAliasCandidateRow[] = [];
  for (const candidate of toValidate) {
    const key = primaryCasefold(candidate.alias_source_term);
    if (!acceptedByTerm.has(key)) {
      // Skipped by revalidation (e.g. identical index).
      continue;
    }
    appended_rows.push({
      schema_version: SOURCE_ALIAS_TABLE_SCHEMA,
      alias_table_version: candidate.alias_table_version,
      alias_id: candidate.alias_id,
      status: "candidate",
      direction: "source_to_target",
      alias_source_term: candidate.alias_source_term,
      canonical_source_terms: [...candidate.canonical_source_terms],
      resolved_ir_ids: [...candidate.resolved_ir_ids],
      candidate_type: candidate.candidate_type,
      evidence_ir_ids: [...candidate.evidence_ir_ids],
      rationale: buildAppendRationale(candidate, options),
      source_bundle_id: candidate.source_bundle_id,
      source_norm_version: candidate.source_norm_version,
    });
  }

  const newLines = appended_rows.map(serializeCandidateRow);
  const updated =
    parsed.raw_lines.length === 0
      ? `${newLines.join("\n")}${newLines.length ? "\n" : "\n"}`
      : `${parsed.raw_lines.join("\n")}\n${newLines.join("\n")}\n`;

  // Ensure existing prefix preserved exactly when there were existing rows.
  if (parsed.raw_lines.length > 0) {
    const prefix = `${parsed.raw_lines.join("\n")}\n`;
    if (!updated.startsWith(prefix)) {
      return fail({
        skipped_rows,
        errors: [
          {
            code: "preserve_existing_failed",
            detail: "Updated JSONL would not preserve existing raw lines.",
          },
        ],
        summary: {
          existing_row_count: existingCount,
          input_candidate_count: args.accepted_candidates.length,
          skipped_duplicate_count: skipped_rows.length,
        },
        report,
      });
    }
  }

  return {
    ok: true,
    updated_source_aliases_jsonl: updated,
    appended_rows,
    skipped_rows,
    rejected_rows: [],
    errors: [],
    summary: {
      existing_row_count: existingCount,
      input_candidate_count: args.accepted_candidates.length,
      appended_count: appended_rows.length,
      skipped_duplicate_count: skipped_rows.length,
    },
    report,
    writes_performed: false,
  };
}
