/**
 * AL1C — Deterministic offline reviewer worksheet exports from AL1B candidates.
 *
 * Review artifacts only. Never approves aliases, never mutates dictionary /
 * alias / index files, never touches runtime search or UI.
 *
 * Pure module: no IndexedDB, DOM, network, or filesystem I/O.
 */

import {
  ALIAS_CANDIDATE_CATEGORIES,
  ALIAS_CANDIDATE_RECOMMENDED_ACTIONS,
  type AliasCandidateCategory,
  type AliasCandidateRecommendedAction,
  type AliasCandidateReport,
  type AliasCandidateReportRow,
  type AliasCandidateSearchStatus,
  type AliasEvidenceSourceKind,
} from "./alias_candidate_evidence";
import type { LookupMode } from "../search/lookup_mode";

export const ALIAS_REVIEWER_WORKSHEET_SCHEMA =
  "alias_content_gap_reviewer_worksheet_v1" as const;

/** Recommended download / artifact basenames for future consumers. */
export const ALIAS_REVIEWER_WORKSHEET_CSV_FILENAME =
  "alias_content_gap_candidates.csv" as const;
export const ALIAS_REVIEWER_WORKSHEET_JSONL_FILENAME =
  "alias_content_gap_candidates.jsonl" as const;
export const ALIAS_REVIEWER_WORKSHEET_MARKDOWN_FILENAME =
  "alias_content_gap_candidates.md" as const;

export const ALIAS_REVIEWER_WORKSHEET_CSV_COLUMNS = [
  "query_raw",
  "normalized_query",
  "lookup_mode",
  "evidence_sources",
  "evidence_count",
  "last_seen",
  "current_search_status",
  "prefix_suggestions",
  "nearby_keys",
  "candidate_category",
  "recommended_human_action",
  "reviewer_decision",
  "reviewer_notes",
] as const;

export type AliasReviewerWorksheetCsvColumn =
  (typeof ALIAS_REVIEWER_WORKSHEET_CSV_COLUMNS)[number];

/** Privacy-minimized worksheet row (no session/device/user ids). */
export type AliasReviewerWorksheetRow = {
  query_raw: string;
  normalized_query: string;
  lookup_mode: string;
  evidence_sources: AliasEvidenceSourceKind;
  evidence_count: number;
  last_seen: string | null;
  current_search_status: AliasCandidateSearchStatus;
  prefix_suggestions: string[];
  nearby_keys: string[];
  candidate_category: AliasCandidateCategory;
  recommended_human_action: AliasCandidateRecommendedAction;
  /** Blank placeholder for human fill-in. Never defaults to approved. */
  reviewer_decision: "";
  /** Blank placeholder for human fill-in. */
  reviewer_notes: "";
};

export type AliasReviewerExportSummary = {
  total_candidates: number;
  by_category: Record<AliasCandidateCategory, number>;
  by_recommended_action: Record<AliasCandidateRecommendedAction, number>;
};

export type AliasReviewerMarkdownOptions = {
  /** Optional caller-supplied timestamp; never generated from local clock here. */
  generated_at?: string | null;
  /** Max rows in the top-candidates table (default 25). */
  top_n?: number;
};

const ARRAY_JOIN = "; ";

const CATEGORY_DEFINITIONS: Record<AliasCandidateCategory, string> = {
  already_searchable:
    "Exact, SQ1 variant, or prefix suggestions already resolve on the snapshot.",
  possible_alias:
    "Miss with conservative nearby-key or pending alias-table evidence; heuristic only.",
  possible_content_gap:
    "Meaningful miss with no safe alias heuristic; may need supplement / new IR.",
  likely_typo_or_noise: "Too short, malformed, or non-linguistic noise.",
  ambiguous: "Insufficient evidence; needs human judgment.",
};

const ACTION_DEFINITIONS: Record<AliasCandidateRecommendedAction, string> = {
  review_alias: "Human should consider a reviewed alias candidate.",
  review_content_gap: "Human should consider a content-gap / supplement path.",
  ignore_noise: "Human may ignore as typo/noise.",
  already_fixed_by_search: "Search floor already covers this query.",
  needs_more_context: "Needs more evidence before any reviewed artifact.",
};

function compareCodePoints(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function categoryPriority(category: AliasCandidateCategory): number {
  switch (category) {
    case "possible_alias":
      return 0;
    case "possible_content_gap":
      return 1;
    case "ambiguous":
      return 2;
    case "already_searchable":
      return 3;
    case "likely_typo_or_noise":
      return 4;
  }
}

function formatLookupMode(mode: LookupMode): string {
  return `${mode.from}->${mode.to}`;
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

function joinArrayField(values: readonly string[]): string {
  return values.join(ARRAY_JOIN);
}

/**
 * Map an AL1B candidate row to the privacy-minimized worksheet shape.
 * Copies arrays; never mutates the input row.
 */
export function toAliasReviewerWorksheetRow(
  row: AliasCandidateReportRow,
): AliasReviewerWorksheetRow {
  return {
    query_raw: row.query_raw,
    normalized_query: row.normalized_query,
    lookup_mode: formatLookupMode(row.lookup_mode),
    evidence_sources: row.evidence_source,
    evidence_count: row.occurrence_count,
    last_seen: row.last_seen,
    current_search_status: row.current_search_status,
    prefix_suggestions: [...row.prefix_suggestions],
    nearby_keys: [...row.closest_exact_or_prefix_keys],
    candidate_category: row.candidate_category,
    recommended_human_action: row.recommended_human_action,
    reviewer_decision: "",
    reviewer_notes: "",
  };
}

/**
 * Deterministic sort for exports.
 * 1. category priority (possible_alias … likely_typo_or_noise)
 * 2. evidence_count descending
 * 3. normalized_query ascending
 * 4. lookup_mode ascending
 * 5. query_raw ascending
 */
export function sortAliasCandidatesForExport(
  rows: readonly AliasCandidateReportRow[],
): AliasCandidateReportRow[] {
  return [...rows].sort((a, b) => {
    const p = categoryPriority(a.candidate_category) - categoryPriority(b.candidate_category);
    if (p !== 0) return p;
    if (b.occurrence_count !== a.occurrence_count) {
      return b.occurrence_count - a.occurrence_count;
    }
    const n = compareCodePoints(a.normalized_query, b.normalized_query);
    if (n !== 0) return n;
    const modeCmp = compareCodePoints(
      formatLookupMode(a.lookup_mode),
      formatLookupMode(b.lookup_mode),
    );
    if (modeCmp !== 0) return modeCmp;
    return compareCodePoints(a.query_raw, b.query_raw);
  });
}

function isAliasCandidateReport(
  input: AliasCandidateReport | readonly AliasCandidateReportRow[],
): input is AliasCandidateReport {
  return (
    typeof input === "object" &&
    input !== null &&
    !Array.isArray(input) &&
    "candidates" in input
  );
}

function rowsFromInput(
  input: AliasCandidateReport | readonly AliasCandidateReportRow[],
): AliasCandidateReportRow[] {
  if (isAliasCandidateReport(input)) {
    return sortAliasCandidatesForExport(input.candidates);
  }
  return sortAliasCandidatesForExport(input);
}

export function summarizeAliasCandidatesForExport(
  input: AliasCandidateReport | readonly AliasCandidateReportRow[],
): AliasReviewerExportSummary {
  const rows = rowsFromInput(input);
  const by_category: Record<AliasCandidateCategory, number> = {
    already_searchable: 0,
    possible_alias: 0,
    possible_content_gap: 0,
    likely_typo_or_noise: 0,
    ambiguous: 0,
  };
  const by_recommended_action: Record<AliasCandidateRecommendedAction, number> = {
    review_alias: 0,
    review_content_gap: 0,
    ignore_noise: 0,
    already_fixed_by_search: 0,
    needs_more_context: 0,
  };
  for (const row of rows) {
    by_category[row.candidate_category] += 1;
    by_recommended_action[row.recommended_human_action] += 1;
  }
  return {
    total_candidates: rows.length,
    by_category,
    by_recommended_action,
  };
}

/**
 * CSV worksheet. Arrays joined with "; ". Reviewer fields always blank.
 */
export function exportAliasCandidateCsv(
  input: AliasCandidateReport | readonly AliasCandidateReportRow[],
): string {
  const rows = rowsFromInput(input);
  const lines = [ALIAS_REVIEWER_WORKSHEET_CSV_COLUMNS.join(",")];
  for (const source of rows) {
    const row = toAliasReviewerWorksheetRow(source);
    const values = [
      row.query_raw,
      row.normalized_query,
      row.lookup_mode,
      row.evidence_sources,
      String(row.evidence_count),
      row.last_seen ?? "",
      row.current_search_status,
      joinArrayField(row.prefix_suggestions),
      joinArrayField(row.nearby_keys),
      row.candidate_category,
      row.recommended_human_action,
      row.reviewer_decision,
      row.reviewer_notes,
    ];
    lines.push(values.map(csvEscape).join(","));
  }
  return `${lines.join("\n")}\n`;
}

/**
 * JSONL worksheet: one privacy-minimized candidate object per line.
 * Stable key insertion order. Reviewer fields are empty strings.
 */
export function exportAliasCandidateJsonl(
  input: AliasCandidateReport | readonly AliasCandidateReportRow[],
): string {
  const rows = rowsFromInput(input);
  const lines: string[] = [];
  for (const source of rows) {
    const row = toAliasReviewerWorksheetRow(source);
    // Explicit key order for deterministic JSON.
    const payload: AliasReviewerWorksheetRow = {
      query_raw: row.query_raw,
      normalized_query: row.normalized_query,
      lookup_mode: row.lookup_mode,
      evidence_sources: row.evidence_sources,
      evidence_count: row.evidence_count,
      last_seen: row.last_seen,
      current_search_status: row.current_search_status,
      prefix_suggestions: row.prefix_suggestions,
      nearby_keys: row.nearby_keys,
      candidate_category: row.candidate_category,
      recommended_human_action: row.recommended_human_action,
      reviewer_decision: "",
      reviewer_notes: "",
    };
    lines.push(JSON.stringify(payload));
  }
  return lines.length === 0 ? "\n" : `${lines.join("\n")}\n`;
}

/**
 * Markdown reviewer worksheet summary.
 */
export function exportAliasCandidateMarkdown(
  input: AliasCandidateReport | readonly AliasCandidateReportRow[],
  options: AliasReviewerMarkdownOptions = {},
): string {
  const rows = rowsFromInput(input);
  const summary = summarizeAliasCandidatesForExport(rows);
  const topN = options.top_n ?? 25;
  const top = rows.slice(0, topN);

  const lines: string[] = [
    "# Alias / Content-Gap Reviewer Worksheet",
    "",
    "```text",
    "Evidence is not dictionary authority. Do not approve aliases without human review.",
    "```",
    "",
    `- schema: \`${ALIAS_REVIEWER_WORKSHEET_SCHEMA}\``,
    `- total candidates: **${summary.total_candidates}**`,
  ];
  if (options.generated_at) {
    lines.push(`- generated_at: \`${options.generated_at}\``);
  }
  lines.push(
    "",
    "## Reviewer instructions",
    "",
    "1. Read each candidate as **evidence**, not dictionary truth.",
    "2. Fill `reviewer_decision` and `reviewer_notes` outside this file (CSV/JSONL blanks).",
    "3. Possible later reviewed artifacts: alias row, supplement / new IR, or no change.",
    "4. Do **not** treat recommended_human_action as approval.",
    "",
    "## Counts by category",
    "",
    "| Category | Count |",
    "|----------|------:|",
  );
  for (const category of ALIAS_CANDIDATE_CATEGORIES) {
    lines.push(`| ${category} | ${summary.by_category[category]} |`);
  }
  lines.push(
    "",
    "## Counts by recommended human action",
    "",
    "| Recommended action | Count |",
    "|--------------------|------:|",
  );
  for (const action of ALIAS_CANDIDATE_RECOMMENDED_ACTIONS) {
    lines.push(`| ${action} | ${summary.by_recommended_action[action]} |`);
  }

  lines.push("", "## Category definitions", "");
  for (const category of ALIAS_CANDIDATE_CATEGORIES) {
    lines.push(`- **${category}** — ${CATEGORY_DEFINITIONS[category]}`);
  }
  lines.push("", "## Recommended action definitions", "");
  for (const action of ALIAS_CANDIDATE_RECOMMENDED_ACTIONS) {
    lines.push(`- **${action}** — ${ACTION_DEFINITIONS[action]}`);
  }

  lines.push(
    "",
    `## Top candidates (first ${top.length})`,
    "",
    "| query_raw | category | action | count | lookup_mode |",
    "|-----------|----------|--------|------:|-------------|",
  );
  for (const row of top) {
    const q = row.query_raw.replaceAll("|", "\\|");
    lines.push(
      `| ${q} | ${row.candidate_category} | ${row.recommended_human_action} | ${row.occurrence_count} | ${formatLookupMode(row.lookup_mode)} |`,
    );
  }

  lines.push(
    "",
    "## Authority boundary",
    "",
    "- This worksheet does **not** approve aliases.",
    "- This worksheet does **not** mutate `source_aliases_v1.jsonl`, supplements, `records.jsonl`, or `search_index.jsonl`.",
    "- Reviewed alias / content-gap decisions remain a later human + publish step.",
    "",
  );
  return lines.join("\n");
}

/** Alias of exportAliasCandidateCsv for callers that prefer the shorter name. */
export const exportAliasCandidateCsvWorksheet = exportAliasCandidateCsv;
