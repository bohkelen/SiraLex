import { describe, expect, it } from "vitest";
import {
  emitAcceptedAliasesPreviewJsonl,
  emitRejectedAliasRowsJsonl,
  emitReviewedAliasImportSummaryMarkdown,
  parseReviewedAliasDecisionCsv,
  parseReviewedAliasDecisionJsonl,
  validateReviewedAliasImportDryRun,
  type ReviewedAliasDecisionRow,
  type ReviewedAliasImportContext,
} from "./reviewed_alias_import";

const IR_MAIN = "e79067fd41b59e85";
const IR_MERE = "e5164efcdf5e6ca4";
const IR_VOCATIVE = "0f51aaaa00000001";

function ctx(overrides: Partial<ReviewedAliasImportContext> = {}): ReviewedAliasImportContext {
  return {
    known_ir_ids: [IR_MAIN, IR_MERE, IR_VOCATIVE],
    index_rows: [
      { key_type: "src_casefold", key: "main", ir_ids: [IR_MAIN] },
      { key_type: "src_casefold", key: "mère", ir_ids: [IR_MERE, IR_VOCATIVE] },
      { key_type: "src_diacritics_insensitive", key: "mere", ir_ids: [IR_MERE, IR_VOCATIVE] },
    ],
    default_alias_table_version: "al1d1-test",
    default_source_norm_version: "norm_v3",
    ...overrides,
  };
}

function approveMains(partial: Partial<ReviewedAliasDecisionRow> = {}): ReviewedAliasDecisionRow {
  return {
    query_raw: "mains",
    normalized_query: "mains",
    lookup_mode: "fr->mnk",
    candidate_category: "possible_alias",
    reviewer_decision: "approve_alias",
    reviewer_notes: "plural of main",
    reviewed_by: "local_reviewer",
    reviewed_at: "2026-08-20",
    alias_source_term: "mains",
    alias_lang: "fr",
    canonical_source_terms: ["main"],
    resolved_ir_ids: [IR_MAIN],
    evidence_ir_ids: [IR_MAIN],
    candidate_type: "french_plural_singular_alias",
    source_bundle_id: "bundle_fixture",
    ...partial,
  };
}

describe("AL1D1 parse CSV/JSONL", () => {
  it("parses CSV with escaping", () => {
    const csv = [
      "candidate_category,reviewer_decision,alias_lang,alias_source_term,canonical_source_terms,resolved_ir_ids,candidate_type,source_bundle_id,lookup_mode,reviewer_notes",
      `possible_alias,approve_alias,fr,"mai,ns",main,${IR_MAIN},french_plural_singular_alias,bundle_fixture,fr->mnk,"note ""x"""`,
    ].join("\n");
    const rows = parseReviewedAliasDecisionCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.alias_source_term).toBe("mai,ns");
    expect(rows[0]?.reviewer_notes).toBe('note "x"');
  });

  it("parses JSONL objects", () => {
    const jsonl = `${JSON.stringify(approveMains())}\n`;
    expect(parseReviewedAliasDecisionJsonl(jsonl)).toHaveLength(1);
  });
});

describe("AL1D1 dry-run accept / reject / skip", () => {
  it("accepts eligible FR approve_alias as status=candidate", () => {
    const result = validateReviewedAliasImportDryRun([approveMains()], ctx());
    expect(result.mode).toBe("dry_run");
    expect(result.writes_performed).toBe(false);
    expect(result.accepted).toHaveLength(1);
    expect(result.accepted[0]?.status).toBe("candidate");
    expect(result.accepted[0]?.schema_version).toBe("source_alias_table_v1");
    expect(result.accepted[0]?.direction).toBe("source_to_target");
    expect(result.accepted[0]?.provenance_source).toBe("worksheet_manual");
    expect(result.rejected).toHaveLength(0);
  });

  it("skips blank and non-import decisions", () => {
    const result = validateReviewedAliasImportDryRun(
      [
        { ...approveMains(), reviewer_decision: "" },
        { ...approveMains(), reviewer_decision: "content_gap" },
        { ...approveMains(), reviewer_decision: "typo_or_noise" },
        { ...approveMains(), reviewer_decision: "already_searchable" },
        { ...approveMains(), reviewer_decision: "reject" },
        { ...approveMains(), reviewer_decision: "needs_more_context" },
      ],
      ctx(),
    );
    expect(result.accepted).toHaveLength(0);
    expect(result.skipped).toHaveLength(6);
    expect(result.rejected).toHaveLength(0);
  });

  it("rejects wrong category, EN/MNK, Russian, N’Ko, missing IR, conflicts", () => {
    const cases: ReviewedAliasDecisionRow[] = [
      approveMains({ candidate_category: "possible_content_gap" }),
      approveMains({ alias_lang: "en" }),
      approveMains({ alias_lang: "mnk" }),
      approveMains({ alias_lang: "ru" }),
      approveMains({ alias_source_term: "привет" }),
      approveMains({ alias_source_term: "ߒߞߏ" }),
      approveMains({ lookup_mode: "en->mnk" }),
      approveMains({ resolved_ir_ids: ["missing_ir"] }),
      approveMains({ status: "approved" }),
      approveMains({
        alias_source_term: "mains",
        // conflict: index already has different postings for a generated key — use term that collides
      }),
    ];
    // Force index conflict: alias term already indexed with different IR
    const conflictCtx = ctx({
      index_rows: [
        ...ctx().index_rows,
        { key_type: "src_casefold", key: "mains", ir_ids: [IR_MERE] },
      ],
    });
    const result = validateReviewedAliasImportDryRun(cases, conflictCtx);
    expect(result.accepted).toHaveLength(0);
    expect(result.rejected.length).toBeGreaterThanOrEqual(9);
    const reasons = new Set(result.rejected.map((r) => r.reason));
    expect(reasons.has("unsupported_alias_lang")).toBe(true);
    expect(reasons.has("russian_excluded")).toBe(true);
    expect(reasons.has("nko_excluded")).toBe(true);
    expect(reasons.has("ir_not_found")).toBe(true);
    expect(reasons.has("status_approved_forbidden")).toBe(true);
    expect(reasons.has("index_key_conflict")).toBe(true);
    expect(reasons.has("category_not_possible_alias")).toBe(true);
    expect(reasons.has("lookup_mode_not_fr_mnk")).toBe(true);
  });

  it("skips identical existing alias / identical index postings", () => {
    const withExisting = validateReviewedAliasImportDryRun([approveMains()], ctx({
      existing_alias_rows: [
        { alias_source_term: "mains", resolved_ir_ids: [IR_MAIN], status: "candidate" },
      ],
    }));
    expect(withExisting.skipped[0]?.reason).toBe("identical_existing_alias");

    const withIndex = validateReviewedAliasImportDryRun([approveMains()], ctx({
      index_rows: [
        ...ctx().index_rows,
        { key_type: "src_casefold", key: "mains", ir_ids: [IR_MAIN] },
        { key_type: "src_diacritics_insensitive", key: "mains", ir_ids: [IR_MAIN] },
        { key_type: "src_punct_stripped", key: "mains", ir_ids: [IR_MAIN] },
        { key_type: "src_nospace", key: "mains", ir_ids: [IR_MAIN] },
      ],
    }));
    expect(withIndex.skipped.some((s) => s.reason === "identical_index_postings")).toBe(true);
  });

  it("validates french_common_form_alias ordered subset", () => {
    const ok = validateReviewedAliasImportDryRun(
      [
        approveMains({
          alias_source_term: "maman",
          query_raw: "maman",
          normalized_query: "maman",
          canonical_source_terms: ["mère"],
          resolved_ir_ids: [IR_MERE],
          evidence_ir_ids: [IR_MERE],
          candidate_type: "french_common_form_alias",
        }),
      ],
      ctx(),
    );
    expect(ok.accepted).toHaveLength(1);

    const badOrder = validateReviewedAliasImportDryRun(
      [
        approveMains({
          alias_source_term: "maman",
          canonical_source_terms: ["mère"],
          resolved_ir_ids: [IR_VOCATIVE, IR_MERE],
          evidence_ir_ids: [IR_VOCATIVE, IR_MERE],
          candidate_type: "french_common_form_alias",
        }),
      ],
      ctx(),
    );
    expect(badOrder.rejected.some((r) => r.reason === "common_form_order_invalid")).toBe(true);
  });
});

describe("AL1D1 emitters + immutability", () => {
  it("emits preview/reject JSONL and summary markdown", () => {
    const result = validateReviewedAliasImportDryRun(
      [approveMains(), approveMains({ alias_lang: "en", query_raw: "houses" })],
      ctx(),
    );
    const preview = emitAcceptedAliasesPreviewJsonl(result);
    const rejected = emitRejectedAliasRowsJsonl(result);
    const md = emitReviewedAliasImportSummaryMarkdown(result);
    expect(preview).toContain('"status":"candidate"');
    expect(rejected).toContain("unsupported_alias_lang");
    expect(md).toContain("Dry-run only");
    expect(md).toContain("writes_performed: **false**");
    expect(md).not.toMatch(/approved alias/i);
  });

  it("does not mutate input rows", () => {
    const row = approveMains({
      canonical_source_terms: ["main"],
      resolved_ir_ids: [IR_MAIN],
    });
    const snapshot = structuredClone(row);
    validateReviewedAliasImportDryRun([row], ctx());
    expect(row).toEqual(snapshot);
  });
});
