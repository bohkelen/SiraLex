/**
 * AL1B — Offline alias / content-gap candidate evidence report.
 *
 * Produces reviewer evidence only. Never approves aliases, never mutates
 * source_aliases_v1.jsonl / records.jsonl / search_index.jsonl, and never
 * changes runtime search, CF2, or query-log schemas.
 *
 * Pure module: no IndexedDB, DOM, network, fs writes, or UI.
 */

import { computeSearchKeys, normalizeNfc, normalizeWhitespace } from "../norm/norm_v1";
import type { SearchKeys } from "../norm/norm_v1";
import {
  indexFamilyForLookupInput,
  isValidLookupMode,
  lookupModeFromLegacySearchDirection,
  type LookupMode,
} from "../search/lookup_mode";
import { SEARCH_LADDER_KEY_TYPES } from "../search/search_query";
import { safeQueryVariants } from "../search/search_query_variants";
import {
  SEARCH_SUGGESTION_MAX_VISIBLE,
  countNormalizedCharacters,
  rankPrefixSuggestionKeys,
  shouldOfferPrefixSuggestions,
} from "../search/search_suggestions";
import {
  SEARCH_FEEDBACK_DRAFT_SCHEMA_VERSION_V2,
  type SearchFeedbackDraft,
  type SearchFeedbackDraftV2,
} from "../search_feedback/search_feedback_types";
import {
  QUERY_LOG_EVENT_V3,
  type QueryLogEvent,
  type QueryLogEventV3,
} from "../query_logging/query_log_types";

export const ALIAS_CANDIDATE_EVIDENCE_SCHEMA = "alias_candidate_evidence_v1" as const;

export const ALIAS_CANDIDATE_CATEGORIES = [
  "already_searchable",
  "possible_alias",
  "possible_content_gap",
  "likely_typo_or_noise",
  "ambiguous",
] as const;

export type AliasCandidateCategory = (typeof ALIAS_CANDIDATE_CATEGORIES)[number];

export const ALIAS_CANDIDATE_RECOMMENDED_ACTIONS = [
  "review_alias",
  "review_content_gap",
  "ignore_noise",
  "already_fixed_by_search",
  "needs_more_context",
] as const;

export type AliasCandidateRecommendedAction =
  (typeof ALIAS_CANDIDATE_RECOMMENDED_ACTIONS)[number];

export type AliasEvidenceSourceKind = "cf2" | "query_log" | "fixture" | "both";

export type AliasEvidenceIndexRow = {
  key_type: string;
  key: string;
  ir_ids: readonly string[];
};

export type ReviewedAliasTableRowSnapshot = {
  alias_source_term: string;
  status: "candidate" | "approved" | "rejected" | "deferred";
  canonical_source_terms?: readonly string[];
};

/** Normalized evidence unit before classification (no PII beyond query text). */
export type AliasEvidenceEvent = {
  query_raw: string;
  bundle_id: string;
  content_sha256?: string;
  lookup_mode: LookupMode;
  evidence_source: AliasEvidenceSourceKind;
  observed_at?: string;
  /** CF2 result_state or query-log result_status when known. */
  observed_result_hint?:
    | "no_result"
    | "results_not_useful"
    | "miss"
    | "hit_single"
    | "hit_multi";
  observed_result_count?: number;
};

export type AliasCandidateSearchStatus =
  | "exact_hit"
  | "variant_hit"
  | "prefix_suggestions"
  | "miss";

export type AliasCandidateReportRow = {
  schema_version: typeof ALIAS_CANDIDATE_EVIDENCE_SCHEMA;
  query_raw: string;
  normalized_query: string;
  lookup_mode: LookupMode;
  bundle_id: string;
  content_sha256: string | null;
  evidence_source: AliasEvidenceSourceKind;
  occurrence_count: number;
  last_seen: string | null;
  current_search_status: AliasCandidateSearchStatus;
  matched_key: string | null;
  separator_variant_query: string | null;
  prefix_suggestions: string[];
  closest_exact_or_prefix_keys: string[];
  candidate_category: AliasCandidateCategory;
  recommended_human_action: AliasCandidateRecommendedAction;
  classification_reason: string;
  reviewer_notes: "";
  review_status: "candidate";
};

export type AliasCandidateReport = {
  schema_version: typeof ALIAS_CANDIDATE_EVIDENCE_SCHEMA;
  authority_label: "unreviewed_alias_content_gap_evidence_must_not_be_treated_as_dictionary_truth";
  generated_for_bundle_id: string | null;
  candidate_count: number;
  candidates: AliasCandidateReportRow[];
};

export type AliasCandidateClassifyContext = {
  index_rows: readonly AliasEvidenceIndexRow[];
  reviewed_alias_rows?: readonly ReviewedAliasTableRowSnapshot[];
  /** Default true for multilingual featured indexes. */
  search_index_directional?: boolean;
};

const AUTHORITY_LABEL =
  "unreviewed_alias_content_gap_evidence_must_not_be_treated_as_dictionary_truth" as const;

const LETTER_RE = /\p{L}/u;
const ONLY_NOISE_RE = /^[\p{P}\p{S}\p{N}\s]+$/u;

function compareCodePoints(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function primaryCasefold(query: string): string {
  const trimmed = query.trim();
  if (trimmed === "") return "";
  return computeSearchKeys([normalizeNfc(trimmed)]).casefold[0] ?? "";
}

export function normalizeCandidateQuery(query: string): string {
  return normalizeWhitespace(normalizeNfc(query.trim()));
}

function storageKeyType(
  mode: LookupMode,
  keyType: keyof SearchKeys,
  directional: boolean,
): string {
  if (!directional) return keyType;
  return `${indexFamilyForLookupInput(mode.from)}_${keyType}`;
}

function buildIndexMap(
  rows: readonly AliasEvidenceIndexRow[],
): Map<string, readonly string[]> {
  const map = new Map<string, readonly string[]>();
  for (const row of rows) {
    if (!row.key || !row.key_type) continue;
    if (!Array.isArray(row.ir_ids) || row.ir_ids.length === 0) continue;
    map.set(`${row.key_type}\0${row.key}`, row.ir_ids);
  }
  return map;
}

function keysForFamily(
  rows: readonly AliasEvidenceIndexRow[],
  familyPrefix: string,
  directional: boolean,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row.key || row.ir_ids.length === 0) continue;
    const ok = directional
      ? row.key_type.startsWith(`${familyPrefix}_`)
      : SEARCH_LADDER_KEY_TYPES.includes(row.key_type as keyof SearchKeys);
    if (!ok) continue;
    if (seen.has(row.key)) continue;
    seen.add(row.key);
    out.push(row.key);
  }
  return out;
}

function lookupExactInMap(
  map: Map<string, readonly string[]>,
  mode: LookupMode,
  query: string,
  directional: boolean,
): { ir_ids: readonly string[]; matched_key: string | null; matched_key_type: keyof SearchKeys | null } {
  const trimmed = query.trim();
  if (trimmed === "") {
    return { ir_ids: [], matched_key: null, matched_key_type: null };
  }
  const keys = computeSearchKeys([normalizeNfc(trimmed)]);
  for (const keyType of SEARCH_LADDER_KEY_TYPES) {
    for (const normalizedKey of keys[keyType] ?? []) {
      if (!normalizedKey) continue;
      const storage = storageKeyType(mode, keyType, directional);
      const hit = map.get(`${storage}\0${normalizedKey}`);
      if (hit && hit.length > 0) {
        return { ir_ids: hit, matched_key: normalizedKey, matched_key_type: keyType };
      }
    }
  }
  return { ir_ids: [], matched_key: null, matched_key_type: null };
}

function lookupPrefixInMemory(
  indexRows: readonly AliasEvidenceIndexRow[],
  mode: LookupMode,
  query: string,
  directional: boolean,
): string[] {
  const trimmed = query.trim();
  if (trimmed === "") return [];
  const keys = computeSearchKeys([normalizeNfc(trimmed)]);
  const family = indexFamilyForLookupInput(mode.from);
  const familyKeys = keysForFamily(indexRows, family, directional);

  for (const keyType of SEARCH_LADDER_KEY_TYPES) {
    const normalizedKey = keys[keyType]?.[0];
    if (!normalizedKey || !shouldOfferPrefixSuggestions(normalizedKey)) continue;
    const prefixMatches = familyKeys.filter((key) => key.startsWith(normalizedKey));
    const ranked = rankPrefixSuggestionKeys(
      prefixMatches,
      normalizedKey,
      SEARCH_SUGGESTION_MAX_VISIBLE,
    );
    if (ranked.length > 0) return ranked;
  }
  return [];
}

export type AliasCandidateReplay = {
  status: AliasCandidateSearchStatus;
  matched_key: string | null;
  separator_variant_query: string | null;
  prefix_suggestions: string[];
  closest_exact_or_prefix_keys: string[];
};

/**
 * Replay SQ1 floor against an in-memory index snapshot (exact → variants → prefix).
 */
export function replayAliasCandidateSearch(
  query: string,
  mode: LookupMode,
  ctx: AliasCandidateClassifyContext,
): AliasCandidateReplay {
  const directional = ctx.search_index_directional !== false;
  const map = buildIndexMap(ctx.index_rows);

  const exact = lookupExactInMap(map, mode, query, directional);
  if (exact.ir_ids.length > 0) {
    return {
      status: "exact_hit",
      matched_key: exact.matched_key,
      separator_variant_query: null,
      prefix_suggestions: [],
      closest_exact_or_prefix_keys: exact.matched_key ? [exact.matched_key] : [],
    };
  }

  for (const variant of safeQueryVariants(query, mode)) {
    const expanded = lookupExactInMap(map, mode, variant, directional);
    if (expanded.ir_ids.length > 0) {
      return {
        status: "variant_hit",
        matched_key: expanded.matched_key,
        separator_variant_query: variant,
        prefix_suggestions: [],
        closest_exact_or_prefix_keys: expanded.matched_key ? [expanded.matched_key] : [],
      };
    }
  }

  const suggestions = lookupPrefixInMemory(ctx.index_rows, mode, query, directional);
  if (suggestions.length > 0) {
    return {
      status: "prefix_suggestions",
      matched_key: null,
      separator_variant_query: null,
      prefix_suggestions: suggestions,
      closest_exact_or_prefix_keys: suggestions.slice(0, 5),
    };
  }

  return {
    status: "miss",
    matched_key: null,
    separator_variant_query: null,
    prefix_suggestions: [],
    closest_exact_or_prefix_keys: [],
  };
}

function looksPluralIsh(normalized: string): boolean {
  return countNormalizedCharacters(normalized) > 3 && normalized.endsWith("s");
}

function singularCandidate(normalized: string): string | null {
  if (!looksPluralIsh(normalized)) return null;
  return normalized.slice(0, -1);
}

function isLikelyTypoOrNoise(normalized: string): boolean {
  if (normalized === "") return true;
  const len = countNormalizedCharacters(normalized);
  if (len < 2) return true;
  if (ONLY_NOISE_RE.test(normalized) && !LETTER_RE.test(normalized)) return true;
  // Single token with almost no letters (e.g. "!!!a!!!") still allowed if len>=2 and has letter.
  if (len <= 2 && !LETTER_RE.test(normalized)) return true;
  return false;
}

function tokenCount(normalized: string): number {
  if (normalized === "") return 0;
  return normalized.split(/\s+/).filter(Boolean).length;
}

function indexHasCasefoldKey(
  ctx: AliasCandidateClassifyContext,
  mode: LookupMode,
  casefoldKey: string,
): boolean {
  const directional = ctx.search_index_directional !== false;
  const storage = storageKeyType(mode, "casefold", directional);
  const map = buildIndexMap(ctx.index_rows);
  const hit = map.get(`${storage}\0${casefoldKey}`);
  return Boolean(hit && hit.length > 0);
}

function pendingAliasTableMatch(
  normalized: string,
  rows: readonly ReviewedAliasTableRowSnapshot[] | undefined,
): ReviewedAliasTableRowSnapshot | null {
  if (!rows || rows.length === 0) return null;
  const needle = primaryCasefold(normalized);
  if (!needle) return null;
  for (const row of rows) {
    if (row.status === "rejected") continue;
    const aliasKey = primaryCasefold(row.alias_source_term);
    if (aliasKey === needle) return row;
  }
  return null;
}

function recommendedActionFor(
  category: AliasCandidateCategory,
): AliasCandidateRecommendedAction {
  switch (category) {
    case "already_searchable":
      return "already_fixed_by_search";
    case "possible_alias":
      return "review_alias";
    case "possible_content_gap":
      return "review_content_gap";
    case "likely_typo_or_noise":
      return "ignore_noise";
    case "ambiguous":
      return "needs_more_context";
  }
}

export type AliasCandidateClassification = {
  category: AliasCandidateCategory;
  reason: string;
  recommended_human_action: AliasCandidateRecommendedAction;
  replay: AliasCandidateReplay;
};

/**
 * Conservative evidence classification. Never implies approval.
 */
export function classifyAliasEvidenceCandidate(
  query: string,
  mode: LookupMode,
  ctx: AliasCandidateClassifyContext,
  opts?: {
    observed_result_hint?: AliasEvidenceEvent["observed_result_hint"];
    observed_result_count?: number;
  },
): AliasCandidateClassification {
  const normalized = normalizeCandidateQuery(query);
  const replay = replayAliasCandidateSearch(query, mode, ctx);

  if (isLikelyTypoOrNoise(normalized)) {
    return {
      category: "likely_typo_or_noise",
      reason: "Query is empty, too short, or non-linguistic noise.",
      recommended_human_action: recommendedActionFor("likely_typo_or_noise"),
      replay,
    };
  }

  if (opts?.observed_result_hint === "results_not_useful") {
    return {
      category: "ambiguous",
      reason:
        "CF2 results_not_useful: search returned something the user rejected; ranking/content review, not an alias miss.",
      recommended_human_action: recommendedActionFor("ambiguous"),
      replay,
    };
  }

  if (
    replay.status === "exact_hit" ||
    replay.status === "variant_hit" ||
    replay.status === "prefix_suggestions"
  ) {
    return {
      category: "already_searchable",
      reason:
        replay.status === "exact_hit"
          ? "Exact ladder hit on the current index snapshot."
          : replay.status === "variant_hit"
            ? `SQ1 variant retry hits via "${replay.separator_variant_query}".`
            : "Prefix suggestions exist on the current index snapshot (SQ1B).",
      recommended_human_action: recommendedActionFor("already_searchable"),
      replay,
    };
  }

  const aliasRow = pendingAliasTableMatch(normalized, ctx.reviewed_alias_rows);
  if (aliasRow) {
    return {
      category: "possible_alias",
      reason: `Reviewed alias table already lists "${aliasRow.alias_source_term}" (status=${aliasRow.status}); human review/publish may still be needed. Not auto-approved.`,
      recommended_human_action: recommendedActionFor("possible_alias"),
      replay,
    };
  }

  const singular = singularCandidate(primaryCasefold(normalized));
  if (singular && indexHasCasefoldKey(ctx, mode, singular)) {
    return {
      category: "possible_alias",
      reason: `Plural-ish miss with indexed singular casefold "${singular}". Heuristic only; not auto-approved.`,
      recommended_human_action: recommendedActionFor("possible_alias"),
      replay,
    };
  }

  if (tokenCount(normalized) >= 2) {
    return {
      category: "ambiguous",
      reason:
        "Multi-token miss may be phrase, content gap, or misunderstanding; needs human judgment.",
      recommended_human_action: recommendedActionFor("ambiguous"),
      replay,
    };
  }

  if (
    countNormalizedCharacters(normalized) >= 3 &&
    LETTER_RE.test(normalized) &&
    mode.from === "fr"
  ) {
    return {
      category: "possible_content_gap",
      reason:
        "Meaningful single-token FR miss with no plural/alias-table heuristic; may be a true content gap.",
      recommended_human_action: recommendedActionFor("possible_content_gap"),
      replay,
    };
  }

  if (countNormalizedCharacters(normalized) >= 3 && LETTER_RE.test(normalized)) {
    return {
      category: "ambiguous",
      reason:
        "Non-FR miss without a safe FR alias heuristic; defer (EN/MNK alias tables are out of AL1B).",
      recommended_human_action: recommendedActionFor("ambiguous"),
      replay,
    };
  }

  return {
    category: "ambiguous",
    reason: "Insufficient evidence for a conservative classification.",
    recommended_human_action: recommendedActionFor("ambiguous"),
    replay,
  };
}

function mergeEvidenceSource(
  a: AliasEvidenceSourceKind,
  b: AliasEvidenceSourceKind,
): AliasEvidenceSourceKind {
  if (a === b) return a;
  if (a === "fixture" || b === "fixture") {
    if (a === "fixture") return b;
    return a;
  }
  return "both";
}

function groupKey(event: AliasEvidenceEvent): string {
  return [
    primaryCasefold(event.query_raw),
    event.lookup_mode.from,
    event.lookup_mode.to,
    event.bundle_id,
  ].join("\0");
}

/**
 * Ingest CF2 V2 drafts as evidence events. V1 drafts are ignored (no LookupMode).
 */
export function evidenceEventsFromCf2Drafts(
  drafts: readonly SearchFeedbackDraft[],
): AliasEvidenceEvent[] {
  const out: AliasEvidenceEvent[] = [];
  for (const draft of drafts) {
    if (draft.schema_version !== SEARCH_FEEDBACK_DRAFT_SCHEMA_VERSION_V2) continue;
    const v2 = draft as SearchFeedbackDraftV2;
    const mode = { from: v2.input_lang, to: v2.output_lang };
    if (!isValidLookupMode(mode)) continue;
    out.push({
      query_raw: v2.query_raw,
      bundle_id: v2.bundle_id,
      content_sha256: v2.content_sha256,
      lookup_mode: mode,
      evidence_source: "cf2",
      observed_at: v2.updated_at || v2.created_at,
      observed_result_hint: v2.result_state,
      observed_result_count: v2.result_count,
    });
  }
  return out;
}

/** Ingest query-log V3 miss rows (hits are ignored for gap candidates). */
export function evidenceEventsFromQueryLogs(
  events: readonly QueryLogEvent[],
): AliasEvidenceEvent[] {
  const out: AliasEvidenceEvent[] = [];
  for (const event of events) {
    if (event.schema_version !== QUERY_LOG_EVENT_V3) continue;
    const v3 = event as QueryLogEventV3;
    if (v3.result_status !== "miss") continue;
    const mode = { from: v3.input_lang, to: v3.output_lang };
    if (!isValidLookupMode(mode)) continue;
    out.push({
      query_raw: v3.query_raw,
      bundle_id: v3.bundle_id,
      lookup_mode: mode,
      evidence_source: "query_log",
      observed_at: v3.timestamp_iso,
      observed_result_hint: "miss",
      observed_result_count: v3.result_count,
    });
  }
  return out;
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

/**
 * Build a deterministic candidate report. Sort:
 * category priority → occurrence_count desc → normalized_query → from→to → bundle_id.
 */
export function buildAliasCandidateReport(
  events: readonly AliasEvidenceEvent[],
  ctx: AliasCandidateClassifyContext,
): AliasCandidateReport {
  type Acc = {
    query_raw: string;
    normalized_query: string;
    lookup_mode: LookupMode;
    bundle_id: string;
    content_sha256: string | null;
    evidence_source: AliasEvidenceSourceKind;
    occurrence_count: number;
    last_seen: string | null;
    observed_result_hint?: AliasEvidenceEvent["observed_result_hint"];
    observed_result_count?: number;
  };

  const groups = new Map<string, Acc>();
  for (const event of events) {
    const normalized = normalizeCandidateQuery(event.query_raw);
    const key = groupKey(event);
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        query_raw: event.query_raw,
        normalized_query: normalized,
        lookup_mode: event.lookup_mode,
        bundle_id: event.bundle_id,
        content_sha256: event.content_sha256 ?? null,
        evidence_source: event.evidence_source,
        occurrence_count: 1,
        last_seen: event.observed_at ?? null,
        observed_result_hint: event.observed_result_hint,
        observed_result_count: event.observed_result_count,
      });
      continue;
    }
    existing.occurrence_count += 1;
    existing.evidence_source = mergeEvidenceSource(
      existing.evidence_source,
      event.evidence_source,
    );
    if (event.content_sha256 && !existing.content_sha256) {
      existing.content_sha256 = event.content_sha256;
    }
    if (
      event.observed_at &&
      (!existing.last_seen || event.observed_at > existing.last_seen)
    ) {
      existing.last_seen = event.observed_at;
    }
    if (event.observed_result_hint === "results_not_useful") {
      existing.observed_result_hint = "results_not_useful";
    }
  }

  const candidates: AliasCandidateReportRow[] = [];
  for (const group of groups.values()) {
    const classified = classifyAliasEvidenceCandidate(
      group.query_raw,
      group.lookup_mode,
      ctx,
      {
        observed_result_hint: group.observed_result_hint,
        observed_result_count: group.observed_result_count,
      },
    );
    candidates.push({
      schema_version: ALIAS_CANDIDATE_EVIDENCE_SCHEMA,
      query_raw: group.query_raw,
      normalized_query: group.normalized_query,
      lookup_mode: group.lookup_mode,
      bundle_id: group.bundle_id,
      content_sha256: group.content_sha256,
      evidence_source: group.evidence_source,
      occurrence_count: group.occurrence_count,
      last_seen: group.last_seen,
      current_search_status: classified.replay.status,
      matched_key: classified.replay.matched_key,
      separator_variant_query: classified.replay.separator_variant_query,
      prefix_suggestions: classified.replay.prefix_suggestions,
      closest_exact_or_prefix_keys: classified.replay.closest_exact_or_prefix_keys,
      candidate_category: classified.category,
      recommended_human_action: classified.recommended_human_action,
      classification_reason: classified.reason,
      reviewer_notes: "",
      review_status: "candidate",
    });
  }

  candidates.sort((a, b) => {
    const p = categoryPriority(a.candidate_category) - categoryPriority(b.candidate_category);
    if (p !== 0) return p;
    if (b.occurrence_count !== a.occurrence_count) {
      return b.occurrence_count - a.occurrence_count;
    }
    const n = compareCodePoints(a.normalized_query, b.normalized_query);
    if (n !== 0) return n;
    const modeA = `${a.lookup_mode.from}->${a.lookup_mode.to}`;
    const modeB = `${b.lookup_mode.from}->${b.lookup_mode.to}`;
    const m = compareCodePoints(modeA, modeB);
    if (m !== 0) return m;
    return compareCodePoints(a.bundle_id, b.bundle_id);
  });

  const bundleIds = [...new Set(candidates.map((c) => c.bundle_id))].sort(compareCodePoints);

  return {
    schema_version: ALIAS_CANDIDATE_EVIDENCE_SCHEMA,
    authority_label: AUTHORITY_LABEL,
    generated_for_bundle_id: bundleIds.length === 1 ? bundleIds[0]! : null,
    candidate_count: candidates.length,
    candidates,
  };
}

export function summarizeAliasEvidence(report: AliasCandidateReport): Record<
  AliasCandidateCategory,
  number
> {
  const summary: Record<AliasCandidateCategory, number> = {
    already_searchable: 0,
    possible_alias: 0,
    possible_content_gap: 0,
    likely_typo_or_noise: 0,
    ambiguous: 0,
  };
  for (const row of report.candidates) {
    summary[row.candidate_category] += 1;
  }
  return summary;
}

/** Future export shape (JSONL one object per line). */
export function aliasCandidateReportToJsonl(report: AliasCandidateReport): string {
  const header = JSON.stringify({
    schema_version: report.schema_version,
    authority_label: report.authority_label,
    generated_for_bundle_id: report.generated_for_bundle_id,
    candidate_count: report.candidate_count,
    record_kind: "alias_candidate_evidence_header_v1",
  });
  const lines = [header];
  for (const row of report.candidates) {
    lines.push(JSON.stringify(row));
  }
  return `${lines.join("\n")}\n`;
}

/** Future CSV worksheet columns (stable header). */
export const ALIAS_CANDIDATE_CSV_COLUMNS = [
  "query_raw",
  "normalized_query",
  "lookup_from",
  "lookup_to",
  "bundle_id",
  "evidence_source",
  "occurrence_count",
  "last_seen",
  "current_search_status",
  "candidate_category",
  "recommended_human_action",
  "classification_reason",
  "prefix_suggestions",
  "closest_keys",
  "reviewer_notes",
  "review_status",
] as const;

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

export function aliasCandidateReportToCsv(report: AliasCandidateReport): string {
  const lines = [ALIAS_CANDIDATE_CSV_COLUMNS.join(",")];
  for (const row of report.candidates) {
    const values = [
      row.query_raw,
      row.normalized_query,
      row.lookup_mode.from,
      row.lookup_mode.to,
      row.bundle_id,
      row.evidence_source,
      String(row.occurrence_count),
      row.last_seen ?? "",
      row.current_search_status,
      row.candidate_category,
      row.recommended_human_action,
      row.classification_reason,
      row.prefix_suggestions.join("|"),
      row.closest_exact_or_prefix_keys.join("|"),
      row.reviewer_notes,
      row.review_status,
    ];
    lines.push(values.map(csvEscape).join(","));
  }
  return `${lines.join("\n")}\n`;
}

/**
 * Deterministic Markdown reviewer worksheet for fixtures/tests.
 */
export function aliasCandidateReportToMarkdown(report: AliasCandidateReport): string {
  const summary = summarizeAliasEvidence(report);
  const lines: string[] = [
    "# Alias / Content-Gap Candidate Evidence Report",
    "",
    "```text",
    "AL1B reviewer evidence only — not dictionary truth",
    "```",
    "",
    `- schema: \`${report.schema_version}\``,
    `- authority: \`${report.authority_label}\``,
    `- bundle: \`${report.generated_for_bundle_id ?? "(mixed)"}\``,
    `- candidates: **${report.candidate_count}**`,
    "",
    "## Summary",
    "",
    "| Category | Count |",
    "|----------|------:|",
  ];
  for (const category of ALIAS_CANDIDATE_CATEGORIES) {
    lines.push(`| ${category} | ${summary[category]} |`);
  }
  lines.push("", "## Candidates", "");

  for (const [index, row] of report.candidates.entries()) {
    lines.push(
      `### ${index + 1}. \`${row.query_raw}\``,
      "",
      `| Field | Value |`,
      `|-------|-------|`,
      `| normalized_query | \`${row.normalized_query}\` |`,
      `| lookup_mode | \`${row.lookup_mode.from}→${row.lookup_mode.to}\` |`,
      `| bundle_id | \`${row.bundle_id}\` |`,
      `| evidence_source | ${row.evidence_source} |`,
      `| occurrence_count | ${row.occurrence_count} |`,
      `| last_seen | ${row.last_seen ?? "—"} |`,
      `| current_search_status | ${row.current_search_status} |`,
      `| matched_key | ${row.matched_key ? `\`${row.matched_key}\`` : "—"} |`,
      `| variant | ${row.separator_variant_query ? `\`${row.separator_variant_query}\`` : "—"} |`,
      `| prefix_suggestions | ${row.prefix_suggestions.length ? row.prefix_suggestions.map((k) => `\`${k}\``).join(", ") : "—"} |`,
      `| closest_keys | ${row.closest_exact_or_prefix_keys.length ? row.closest_exact_or_prefix_keys.map((k) => `\`${k}\``).join(", ") : "—"} |`,
      `| candidate_category | **${row.candidate_category}** |`,
      `| recommended_human_action | ${row.recommended_human_action} |`,
      `| review_status | ${row.review_status} |`,
      `| reviewer_notes | _(blank)_ |`,
      "",
      row.classification_reason,
      "",
    );
  }

  lines.push(
    "## Authority boundary",
    "",
    "- No aliases approved by this report.",
    "- No `source_aliases_v1.jsonl` / `records.jsonl` / `search_index.jsonl` mutation.",
    "- Human review must approve any later alias or supplement row.",
    "",
  );
  return lines.join("\n");
}

/** Helper for fixtures that only know legacy direction. */
export function fixtureLookupModeFromDirection(
  direction: "source_to_target" | "target_to_source",
): LookupMode {
  return lookupModeFromLegacySearchDirection(direction);
}
