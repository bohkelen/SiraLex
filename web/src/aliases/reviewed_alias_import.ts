/**
 * AL1D1 — Reviewed alias import parser / validator (dry-run only).
 *
 * Parses Layer B reviewed-decision rows, validates against AL1D +
 * source_alias_table_v1 rules, and emits preview / reject / skip artifacts.
 *
 * Never writes source_aliases_v1.jsonl, records, search_index, or runtime search.
 * Pure module: no DOM, network, or filesystem I/O.
 */

import { computeSearchKeys, normalizeNfc } from "../norm/norm_v1";
import type { SearchKeys } from "../norm/norm_v1";

export const REVIEWED_ALIAS_IMPORT_SCHEMA =
  "reviewed_alias_import_decision_v1" as const;

export const SOURCE_ALIAS_TABLE_SCHEMA = "source_alias_table_v1" as const;

export const REVIEWED_ALIAS_DECISIONS = [
  "approve_alias",
  "reject",
  "needs_more_context",
  "content_gap",
  "already_searchable",
  "typo_or_noise",
] as const;

export type ReviewedAliasDecision = (typeof REVIEWED_ALIAS_DECISIONS)[number];

export const SOURCE_ALIAS_CANDIDATE_TYPES = [
  "french_plural_singular_alias",
  "french_gender_alias",
  "hyphenation_or_compound_alias",
  "french_common_form_alias",
] as const;

export type SourceAliasCandidateType = (typeof SOURCE_ALIAS_CANDIDATE_TYPES)[number];

export const REVIEWED_ALIAS_REJECT_REASONS = [
  "malformed_row",
  "unknown_reviewer_decision",
  "category_not_possible_alias",
  "missing_alias_source_term",
  "missing_alias_lang",
  "unsupported_alias_lang",
  "russian_excluded",
  "nko_excluded",
  "lookup_mode_not_fr_mnk",
  "missing_canonical_source_terms",
  "missing_resolved_ir_ids",
  "invalid_candidate_type",
  "missing_source_bundle_id",
  "ir_not_found",
  "canonical_term_unresolved",
  "resolved_ir_ids_mismatch",
  "common_form_evidence_mismatch",
  "common_form_order_invalid",
  "index_key_conflict",
  "duplicate_alias_conflict",
  "status_approved_forbidden",
] as const;

export type ReviewedAliasRejectReason = (typeof REVIEWED_ALIAS_REJECT_REASONS)[number];

export const REVIEWED_ALIAS_SKIP_REASONS = [
  "not_reviewed",
  "decision_not_alias_import",
  "identical_existing_alias",
  "identical_index_postings",
] as const;

export type ReviewedAliasSkipReason = (typeof REVIEWED_ALIAS_SKIP_REASONS)[number];

/** Layer B reviewed-decision row (human-filled worksheet). */
export type ReviewedAliasDecisionRow = {
  query_raw?: string;
  normalized_query?: string;
  lookup_mode?: string;
  candidate_category?: string;
  reviewer_decision?: string;
  reviewer_notes?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  alias_source_term?: string;
  alias_lang?: string;
  canonical_source_terms?: string | readonly string[];
  resolved_ir_ids?: string | readonly string[];
  evidence_ir_ids?: string | readonly string[];
  candidate_type?: string;
  source_bundle_id?: string;
  source_norm_version?: string;
  alias_table_version?: string;
  evidence_sources?: string;
  evidence_count?: number;
  evidence_queries?: readonly string[];
  /** Forbidden on import path — must never be approved from worksheet. */
  status?: string;
};

export type ReviewedAliasIndexRow = {
  key_type: string;
  key: string;
  ir_ids: readonly string[];
};

export type ExistingAliasSnapshotRow = {
  alias_source_term: string;
  resolved_ir_ids: readonly string[];
  status?: string;
};

export type ReviewedAliasImportContext = {
  known_ir_ids: ReadonlySet<string> | readonly string[];
  index_rows: readonly ReviewedAliasIndexRow[];
  existing_alias_rows?: readonly ExistingAliasSnapshotRow[];
  default_alias_table_version?: string;
  default_source_norm_version?: string;
};

/** Preview row compatible with source_alias_table_v1 (always status: candidate). */
export type AcceptedAliasPreviewRow = {
  schema_version: typeof SOURCE_ALIAS_TABLE_SCHEMA;
  alias_table_version: string;
  alias_id: string;
  status: "candidate";
  direction: "source_to_target";
  alias_source_term: string;
  canonical_source_terms: string[];
  resolved_ir_ids: string[];
  candidate_type: SourceAliasCandidateType;
  evidence_ir_ids: string[];
  rationale: string;
  source_bundle_id: string;
  source_norm_version: string;
  provenance_source: "worksheet_manual";
};

export type RejectedAliasImportRow = {
  row_index: number;
  reason: ReviewedAliasRejectReason;
  detail: string;
  decision_row: ReviewedAliasDecisionRow;
};

export type SkippedAliasImportRow = {
  row_index: number;
  reason: ReviewedAliasSkipReason;
  detail: string;
  decision_row: ReviewedAliasDecisionRow;
};

export type ReviewedAliasImportDryRunResult = {
  schema_version: typeof REVIEWED_ALIAS_IMPORT_SCHEMA;
  mode: "dry_run";
  writes_performed: false;
  accepted: AcceptedAliasPreviewRow[];
  rejected: RejectedAliasImportRow[];
  skipped: SkippedAliasImportRow[];
  summary: {
    input_count: number;
    accepted_count: number;
    rejected_count: number;
    skipped_count: number;
  };
};

const LADDER: readonly (keyof SearchKeys)[] = [
  "casefold",
  "diacritics_insensitive",
  "punct_stripped",
  "nospace",
];

const DECISION_SET = new Set<string>(REVIEWED_ALIAS_DECISIONS);
const CANDIDATE_TYPE_SET = new Set<string>(SOURCE_ALIAS_CANDIDATE_TYPES);
const NON_IMPORT_DECISIONS = new Set<string>([
  "reject",
  "needs_more_context",
  "content_gap",
  "already_searchable",
  "typo_or_noise",
]);

const NKO_RE = /[\u07C0-\u07FF]/u;
const CYRILLIC_RE = /[\u0400-\u04FF]/u;

function compareCodePoints(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function asIrSet(ids: ReviewedAliasImportContext["known_ir_ids"]): Set<string> {
  return ids instanceof Set ? new Set(ids) : new Set(ids);
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

function primaryCasefold(term: string): string {
  const trimmed = term.trim();
  if (trimmed === "") return "";
  return computeSearchKeys([normalizeNfc(trimmed)]).casefold[0] ?? "";
}

function buildIndexMap(
  rows: readonly ReviewedAliasIndexRow[],
): Map<string, readonly string[]> {
  const map = new Map<string, readonly string[]>();
  for (const row of rows) {
    if (!row.key || !row.key_type || row.ir_ids.length === 0) continue;
    map.set(`${row.key_type}\0${row.key}`, row.ir_ids);
  }
  return map;
}

function searchKeysForSourceTerm(term: string): Array<{ key_type: string; key: string }> {
  const keys = computeSearchKeys([normalizeNfc(term.trim())]);
  const out: Array<{ key_type: string; key: string }> = [];
  const seen = new Set<string>();
  for (const rung of LADDER) {
    for (const key of keys[rung] ?? []) {
      if (!key) continue;
      const keyType = `src_${rung}`;
      const compound = `${keyType}\0${key}`;
      if (seen.has(compound)) continue;
      seen.add(compound);
      out.push({ key_type: keyType, key });
    }
  }
  return out;
}

function lookupSourceTerm(
  index: Map<string, readonly string[]>,
  term: string,
): string[] {
  for (const { key_type, key } of searchKeysForSourceTerm(term)) {
    const hit = index.get(`${key_type}\0${key}`);
    if (hit && hit.length > 0) return [...hit];
  }
  return [];
}

function resolveCanonicalSourceTerms(
  index: Map<string, readonly string[]>,
  terms: readonly string[],
): { ok: true; ir_ids: string[] } | { ok: false; term: string } {
  const resolved: string[] = [];
  const seen = new Set<string>();
  for (const term of terms) {
    const postings = lookupSourceTerm(index, term);
    if (postings.length === 0) return { ok: false, term };
    for (const irId of postings) {
      if (seen.has(irId)) continue;
      seen.add(irId);
      resolved.push(irId);
    }
  }
  return { ok: true, ir_ids: resolved };
}

function isOrderedSubsequence(candidate: readonly string[], reference: readonly string[]): boolean {
  if (candidate.length === 0) return true;
  let cursor = 0;
  for (const value of reference) {
    if (value === candidate[cursor]) {
      cursor += 1;
      if (cursor === candidate.length) return true;
    }
  }
  return false;
}

function sameStringList(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function stableAliasId(
  aliasSourceTerm: string,
  resolvedIrIds: readonly string[],
  bundleId: string,
): string {
  const key = `${aliasSourceTerm}\0${resolvedIrIds.join(",")}\0${bundleId}`;
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `src_alias_al1d1_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function buildRationale(row: ReviewedAliasDecisionRow, aliasSourceTerm: string): string {
  const parts = [
    "AL1D1 dry-run worksheet import preview (status=candidate; not approved).",
    `alias_source_term=${aliasSourceTerm}`,
    row.reviewer_decision ? `reviewer_decision=${row.reviewer_decision}` : null,
    row.evidence_sources ? `evidence_sources=${row.evidence_sources}` : null,
    typeof row.evidence_count === "number" ? `evidence_count=${row.evidence_count}` : null,
    row.reviewed_by ? `reviewed_by=${row.reviewed_by}` : null,
    row.reviewed_at ? `reviewed_at=${row.reviewed_at}` : null,
    row.reviewer_notes?.trim() ? `notes=${row.reviewer_notes.trim()}` : null,
    "provenance_source=worksheet_manual",
  ];
  return parts.filter(Boolean).join(" | ");
}

/** Minimal RFC4180 CSV parser (header + rows). */
export function parseReviewedAliasDecisionCsv(text: string): ReviewedAliasDecisionRow[] {
  const rows = parseCsvRecords(text);
  if (rows.length === 0) return [];
  const header = rows[0]!.map((h) => h.trim());
  const out: ReviewedAliasDecisionRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i]!;
    if (cells.every((c) => c.trim() === "")) continue;
    const obj: Record<string, string> = {};
    for (let c = 0; c < header.length; c++) {
      obj[header[c]!] = cells[c] ?? "";
    }
    out.push(csvObjectToDecisionRow(obj));
  }
  return out;
}

function csvObjectToDecisionRow(obj: Record<string, string>): ReviewedAliasDecisionRow {
  const evidenceCountRaw = obj.evidence_count?.trim() ?? "";
  return {
    query_raw: obj.query_raw,
    normalized_query: obj.normalized_query,
    lookup_mode: obj.lookup_mode,
    candidate_category: obj.candidate_category,
    reviewer_decision: obj.reviewer_decision,
    reviewer_notes: obj.reviewer_notes,
    reviewed_by: obj.reviewed_by,
    reviewed_at: obj.reviewed_at,
    alias_source_term: obj.alias_source_term,
    alias_lang: obj.alias_lang,
    canonical_source_terms: obj.canonical_source_terms,
    resolved_ir_ids: obj.resolved_ir_ids,
    evidence_ir_ids: obj.evidence_ir_ids,
    candidate_type: obj.candidate_type,
    source_bundle_id: obj.source_bundle_id,
    source_norm_version: obj.source_norm_version,
    alias_table_version: obj.alias_table_version,
    evidence_sources: obj.evidence_sources,
    evidence_count: evidenceCountRaw === "" ? undefined : Number(evidenceCountRaw),
    evidence_queries: splitList(obj.evidence_queries),
    status: obj.status,
  };
}

function parseCsvRecords(text: string): string[][] {
  const records: string[][] = [];
  let row: string[] = [];
  let field = "";
  let i = 0;
  let inQuotes = false;
  const input = text.replace(/^\uFEFF/, "");
  while (i < input.length) {
    const ch = input[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      row.push(field);
      field = "";
      records.push(row);
      row = [];
      if (ch === "\r" && input[i + 1] === "\n") i += 2;
      else i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    records.push(row);
  }
  return records;
}

/** Parse JSONL Layer B rows (one object per line). */
export function parseReviewedAliasDecisionJsonl(text: string): ReviewedAliasDecisionRow[] {
  const out: ReviewedAliasDecisionRow[] = [];
  const lines = text.replace(/^\uFEFF/, "").split(/\n/);
  for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
    const line = lines[lineNumber]!.trim();
    if (line === "") continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      throw new Error(`JSONL line ${lineNumber + 1}: malformed JSON`);
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error(`JSONL line ${lineNumber + 1}: expected object`);
    }
    out.push(parsed as ReviewedAliasDecisionRow);
  }
  return out;
}

function cloneDecisionRow(row: ReviewedAliasDecisionRow): ReviewedAliasDecisionRow {
  return {
    ...row,
    canonical_source_terms: Array.isArray(row.canonical_source_terms)
      ? [...row.canonical_source_terms]
      : row.canonical_source_terms,
    resolved_ir_ids: Array.isArray(row.resolved_ir_ids)
      ? [...row.resolved_ir_ids]
      : row.resolved_ir_ids,
    evidence_ir_ids: Array.isArray(row.evidence_ir_ids)
      ? [...row.evidence_ir_ids]
      : row.evidence_ir_ids,
    evidence_queries: row.evidence_queries ? [...row.evidence_queries] : undefined,
  };
}

/**
 * Dry-run validate Layer B rows → accepted candidate previews / rejects / skips.
 * Never mutates inputs or writes alias/dictionary artifacts.
 */
export function validateReviewedAliasImportDryRun(
  rows: readonly ReviewedAliasDecisionRow[],
  ctx: ReviewedAliasImportContext,
): ReviewedAliasImportDryRunResult {
  const knownIrIds = asIrSet(ctx.known_ir_ids);
  const index = buildIndexMap(ctx.index_rows);
  const existingAliases = ctx.existing_alias_rows ?? [];
  const accepted: AcceptedAliasPreviewRow[] = [];
  const rejected: RejectedAliasImportRow[] = [];
  const skipped: SkippedAliasImportRow[] = [];

  const pushReject = (
    rowIndex: number,
    row: ReviewedAliasDecisionRow,
    reason: ReviewedAliasRejectReason,
    detail: string,
  ) => {
    rejected.push({
      row_index: rowIndex,
      reason,
      detail,
      decision_row: cloneDecisionRow(row),
    });
  };

  const pushSkip = (
    rowIndex: number,
    row: ReviewedAliasDecisionRow,
    reason: ReviewedAliasSkipReason,
    detail: string,
  ) => {
    skipped.push({
      row_index: rowIndex,
      reason,
      detail,
      decision_row: cloneDecisionRow(row),
    });
  };

  rows.forEach((row, rowIndex) => {
    const decision = (row.reviewer_decision ?? "").trim();
    if (decision === "") {
      pushSkip(rowIndex, row, "not_reviewed", "Blank reviewer_decision; not eligible for import.");
      return;
    }
    if (NON_IMPORT_DECISIONS.has(decision)) {
      pushSkip(
        rowIndex,
        row,
        "decision_not_alias_import",
        `Decision ${decision} does not import into source_aliases_v1.`,
      );
      return;
    }
    if (!DECISION_SET.has(decision)) {
      pushReject(rowIndex, row, "unknown_reviewer_decision", `Unknown decision ${decision!}`);
      return;
    }
    if (decision !== "approve_alias") {
      pushReject(rowIndex, row, "unknown_reviewer_decision", `Unhandled decision ${decision}`);
      return;
    }

    if ((row.status ?? "").trim() === "approved") {
      pushReject(
        rowIndex,
        row,
        "status_approved_forbidden",
        "Worksheet import may not set status=approved; candidate only.",
      );
      return;
    }

    if ((row.candidate_category ?? "").trim() !== "possible_alias") {
      pushReject(
        rowIndex,
        row,
        "category_not_possible_alias",
        `candidate_category must be possible_alias; got ${row.candidate_category ?? ""}`,
      );
      return;
    }

    const aliasLang = (row.alias_lang ?? "").trim().toLowerCase();
    if (aliasLang === "") {
      pushReject(rowIndex, row, "missing_alias_lang", "alias_lang is required for approve_alias.");
      return;
    }
    if (aliasLang === "ru" || aliasLang === "russian") {
      pushReject(rowIndex, row, "russian_excluded", "Russian aliases are excluded.");
      return;
    }
    if (aliasLang === "nko" || aliasLang === "nqo") {
      pushReject(rowIndex, row, "nko_excluded", "N’Ko aliases are excluded.");
      return;
    }
    if (aliasLang === "en" || aliasLang === "mnk") {
      pushReject(
        rowIndex,
        row,
        "unsupported_alias_lang",
        `alias_lang=${aliasLang} is out of source_alias_table_v1 scope (FR only).`,
      );
      return;
    }
    if (aliasLang !== "fr") {
      pushReject(
        rowIndex,
        row,
        "unsupported_alias_lang",
        `alias_lang=${aliasLang} is not allowed; FR only.`,
      );
      return;
    }

    const lookupMode = (row.lookup_mode ?? "").trim();
    if (lookupMode !== "" && lookupMode !== "fr->mnk" && lookupMode !== "fr→mnk") {
      pushReject(
        rowIndex,
        row,
        "lookup_mode_not_fr_mnk",
        `lookup_mode must be fr->mnk when present; got ${lookupMode}`,
      );
      return;
    }

    const aliasSourceTerm = (
      row.alias_source_term ??
      row.normalized_query ??
      row.query_raw ??
      ""
    ).trim();
    if (aliasSourceTerm === "") {
      pushReject(rowIndex, row, "missing_alias_source_term", "alias_source_term is blank.");
      return;
    }
    if (NKO_RE.test(aliasSourceTerm)) {
      pushReject(rowIndex, row, "nko_excluded", "Alias string contains N’Ko characters.");
      return;
    }
    if (CYRILLIC_RE.test(aliasSourceTerm)) {
      pushReject(rowIndex, row, "russian_excluded", "Alias string contains Cyrillic characters.");
      return;
    }

    const canonical = splitList(row.canonical_source_terms);
    if (canonical.length === 0) {
      pushReject(
        rowIndex,
        row,
        "missing_canonical_source_terms",
        "canonical_source_terms required.",
      );
      return;
    }

    const resolved = splitList(row.resolved_ir_ids);
    if (resolved.length === 0) {
      pushReject(rowIndex, row, "missing_resolved_ir_ids", "resolved_ir_ids required.");
      return;
    }

    const candidateType = (row.candidate_type ?? "").trim();
    if (!CANDIDATE_TYPE_SET.has(candidateType)) {
      pushReject(
        rowIndex,
        row,
        "invalid_candidate_type",
        `Invalid candidate_type ${candidateType || "(blank)"}`,
      );
      return;
    }

    const bundleId = (row.source_bundle_id ?? "").trim();
    if (bundleId === "") {
      pushReject(rowIndex, row, "missing_source_bundle_id", "source_bundle_id required.");
      return;
    }

    for (const irId of resolved) {
      if (!knownIrIds.has(irId)) {
        pushReject(rowIndex, row, "ir_not_found", `resolved_ir_id not found: ${irId}`);
        return;
      }
    }

    const recomputed = resolveCanonicalSourceTerms(index, canonical);
    if (!recomputed.ok) {
      pushReject(
        rowIndex,
        row,
        "canonical_term_unresolved",
        `canonical source term does not resolve: ${recomputed.term}`,
      );
      return;
    }

    const typedCandidate = candidateType as SourceAliasCandidateType;
    let evidence = splitList(row.evidence_ir_ids);
    if (evidence.length === 0) evidence = [...resolved];

    if (typedCandidate === "french_common_form_alias") {
      if (!sameStringList(evidence, resolved)) {
        pushReject(
          rowIndex,
          row,
          "common_form_evidence_mismatch",
          "french_common_form_alias requires evidence_ir_ids === resolved_ir_ids.",
        );
        return;
      }
      const missing = resolved.filter((id) => !recomputed.ir_ids.includes(id));
      if (missing.length > 0) {
        pushReject(
          rowIndex,
          row,
          "resolved_ir_ids_mismatch",
          `resolved_ir_ids not in canonical postings: ${missing.join(",")}`,
        );
        return;
      }
      if (!isOrderedSubsequence(resolved, recomputed.ir_ids)) {
        pushReject(
          rowIndex,
          row,
          "common_form_order_invalid",
          "resolved_ir_ids must preserve canonical posting order.",
        );
        return;
      }
    } else if (!sameStringList(resolved, recomputed.ir_ids)) {
      pushReject(
        rowIndex,
        row,
        "resolved_ir_ids_mismatch",
        `resolved_ir_ids mismatch; declared=[${resolved.join(",")}] recomputed=[${recomputed.ir_ids.join(",")}]`,
      );
      return;
    }

    const aliasCasefold = primaryCasefold(aliasSourceTerm);
    for (const existing of existingAliases) {
      if (primaryCasefold(existing.alias_source_term) !== aliasCasefold) continue;
      if (sameStringList(existing.resolved_ir_ids, resolved)) {
        pushSkip(
          rowIndex,
          row,
          "identical_existing_alias",
          "Identical alias already present in alias table snapshot.",
        );
        return;
      }
      pushReject(
        rowIndex,
        row,
        "duplicate_alias_conflict",
        "Alias source term already maps to a different resolved_ir_ids set.",
      );
      return;
    }

    const generatedKeys = searchKeysForSourceTerm(aliasSourceTerm);
    let identicalIndex = true;
    let sawAny = false;
    for (const { key_type, key } of generatedKeys) {
      const existing = index.get(`${key_type}\0${key}`);
      if (!existing) {
        identicalIndex = false;
        continue;
      }
      sawAny = true;
      if (!sameStringList(existing, resolved)) {
        pushReject(
          rowIndex,
          row,
          "index_key_conflict",
          `Index key conflict on ${key_type}/${key}`,
        );
        return;
      }
    }
    if (sawAny && identicalIndex && generatedKeys.every(({ key_type, key }) => index.has(`${key_type}\0${key}`))) {
      pushSkip(
        rowIndex,
        row,
        "identical_index_postings",
        "All alias-derived index keys already exist with identical postings.",
      );
      return;
    }

    const tableVersion =
      (row.alias_table_version ?? "").trim() ||
      ctx.default_alias_table_version ||
      "al1d1-dry-run";
    const normVersion =
      (row.source_norm_version ?? "").trim() ||
      ctx.default_source_norm_version ||
      "norm_v3";

    accepted.push({
      schema_version: SOURCE_ALIAS_TABLE_SCHEMA,
      alias_table_version: tableVersion,
      alias_id: stableAliasId(aliasSourceTerm, resolved, bundleId),
      status: "candidate",
      direction: "source_to_target",
      alias_source_term: aliasSourceTerm,
      canonical_source_terms: canonical,
      resolved_ir_ids: resolved,
      candidate_type: typedCandidate,
      evidence_ir_ids: evidence,
      rationale: buildRationale(row, aliasSourceTerm),
      source_bundle_id: bundleId,
      source_norm_version: normVersion,
      provenance_source: "worksheet_manual",
    });
  });

  accepted.sort((a, b) => {
    const t = compareCodePoints(a.alias_source_term, b.alias_source_term);
    if (t !== 0) return t;
    return compareCodePoints(a.alias_id, b.alias_id);
  });

  return {
    schema_version: REVIEWED_ALIAS_IMPORT_SCHEMA,
    mode: "dry_run",
    writes_performed: false,
    accepted,
    rejected,
    skipped,
    summary: {
      input_count: rows.length,
      accepted_count: accepted.length,
      rejected_count: rejected.length,
      skipped_count: skipped.length,
    },
  };
}

export function emitAcceptedAliasesPreviewJsonl(
  result: ReviewedAliasImportDryRunResult,
): string {
  if (result.accepted.length === 0) return "\n";
  return `${result.accepted.map((row) => JSON.stringify(row)).join("\n")}\n`;
}

export function emitRejectedAliasRowsJsonl(result: ReviewedAliasImportDryRunResult): string {
  if (result.rejected.length === 0) return "\n";
  return `${result.rejected.map((row) => JSON.stringify(row)).join("\n")}\n`;
}

export function emitReviewedAliasImportSummaryMarkdown(
  result: ReviewedAliasImportDryRunResult,
): string {
  const lines = [
    "# Reviewed Alias Import Dry-Run Summary",
    "",
    "```text",
    "Evidence is not dictionary authority. Do not approve aliases without human review.",
    "Dry-run only — no writes to source_aliases_v1.jsonl.",
    "```",
    "",
    `- schema: \`${result.schema_version}\``,
    `- mode: \`${result.mode}\``,
    `- writes_performed: **${result.writes_performed}**`,
    `- input: ${result.summary.input_count}`,
    `- accepted (candidate preview): ${result.summary.accepted_count}`,
    `- rejected: ${result.summary.rejected_count}`,
    `- skipped: ${result.summary.skipped_count}`,
    "",
    "## Language boundary",
    "",
    "- FR aliases only into `source_alias_table_v1`",
    "- EN / MNK / Russian / N’Ko rejected or out of scope",
    "",
    "## Accepted preview status",
    "",
    "All accepted rows use `status: candidate` (never `approved`).",
    "",
  ];
  if (result.rejected.length > 0) {
    lines.push("## Reject reasons", "");
    const counts = new Map<string, number>();
    for (const row of result.rejected) {
      counts.set(row.reason, (counts.get(row.reason) ?? 0) + 1);
    }
    for (const [reason, count] of [...counts.entries()].sort((a, b) =>
      compareCodePoints(a[0], b[0]),
    )) {
      lines.push(`- \`${reason}\`: ${count}`);
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}
