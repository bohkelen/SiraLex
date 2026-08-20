import { describe, expect, it } from "vitest";
import {
  validateReviewedAliasImportDryRun,
  type ReviewedAliasDecisionRow,
  type ReviewedAliasImportContext,
} from "./reviewed_alias_import";
import {
  REVIEWED_ALIAS_IMPORT_DRY_RUN_FILENAMES,
  REVIEWED_ALIAS_IMPORT_DRY_RUN_REPORT_SCHEMA,
  buildReviewedAliasImportDryRunReport,
} from "./reviewed_alias_import_dry_run_exports";

const IR_MAIN = "e79067fd41b59e85";

function ctx(): ReviewedAliasImportContext {
  return {
    known_ir_ids: [IR_MAIN],
    index_rows: [{ key_type: "src_casefold", key: "main", ir_ids: [IR_MAIN] }],
    default_alias_table_version: "al1d2-test",
    default_source_norm_version: "norm_v3",
  };
}

function approveMains(partial: Partial<ReviewedAliasDecisionRow> = {}): ReviewedAliasDecisionRow {
  return {
    query_raw: "mains",
    normalized_query: "mains",
    lookup_mode: "fr->mnk",
    candidate_category: "possible_alias",
    reviewer_decision: "approve_alias",
    alias_source_term: "mains",
    alias_lang: "fr",
    canonical_source_terms: ["main"],
    resolved_ir_ids: [IR_MAIN],
    evidence_ir_ids: [IR_MAIN],
    candidate_type: "french_plural_singular_alias",
    source_bundle_id: "bundle_fixture",
    evidence_sources: "fixture",
    evidence_count: 2,
    ...partial,
  };
}

describe("AL1D2 dry-run report export", () => {
  it("builds deterministic multi-artifact package", () => {
    const dryRun = validateReviewedAliasImportDryRun(
      [
        approveMains(),
        approveMains({ reviewer_decision: "", query_raw: "blank" }),
        approveMains({ alias_lang: "en", query_raw: "houses", alias_source_term: "houses" }),
        approveMains({ reviewer_decision: "content_gap", query_raw: "bonjour" }),
      ],
      ctx(),
    );

    const reportA = buildReviewedAliasImportDryRunReport(dryRun, {
      generated_at: "2026-08-20T14:00:00.000Z",
    });
    const reportB = buildReviewedAliasImportDryRunReport(dryRun, {
      generated_at: "2026-08-20T14:00:00.000Z",
    });

    expect(reportA.schema_version).toBe(REVIEWED_ALIAS_IMPORT_DRY_RUN_REPORT_SCHEMA);
    expect(reportA.mode).toBe("dry_run");
    expect(reportA.writes_performed).toBe(false);
    expect(reportA.filenames).toEqual(REVIEWED_ALIAS_IMPORT_DRY_RUN_FILENAMES);
    expect(reportA.summary.accepted_count).toBe(1);
    expect(reportA.summary.rejected_count).toBe(1);
    expect(reportA.summary.skipped_count).toBe(2);
    expect(reportA.accepted[0]?.status).toBe("candidate");

    expect(reportA.artifacts.accepted_aliases_preview_jsonl).toBe(
      reportB.artifacts.accepted_aliases_preview_jsonl,
    );
    expect(reportA.artifacts.rejected_alias_rows_jsonl).toBe(
      reportB.artifacts.rejected_alias_rows_jsonl,
    );
    expect(reportA.artifacts.skipped_alias_rows_jsonl).toBe(
      reportB.artifacts.skipped_alias_rows_jsonl,
    );
    expect(reportA.artifacts.import_summary_md).toBe(reportB.artifacts.import_summary_md);
    expect(reportA.artifacts.manifest_json).toBe(reportB.artifacts.manifest_json);

    expect(reportA.artifacts.accepted_aliases_preview_jsonl).toContain('"status":"candidate"');
    expect(reportA.artifacts.rejected_alias_rows_jsonl).toContain("unsupported_alias_lang");
    expect(reportA.artifacts.skipped_alias_rows_jsonl).toContain("not_reviewed");
    expect(reportA.artifacts.skipped_alias_rows_jsonl).toContain("decision_not_alias_import");
    expect(reportA.artifacts.import_summary_md).toContain("Dry-run only");
    expect(reportA.artifacts.import_summary_md).toContain("generated_at");
    expect(reportA.artifacts.import_summary_md).toContain(
      REVIEWED_ALIAS_IMPORT_DRY_RUN_FILENAMES.accepted_aliases_preview_jsonl,
    );
    expect(reportA.artifacts.manifest_json).toContain(
      "dry_run_preview_is_not_dictionary_truth",
    );
    expect(reportA.artifacts.manifest_json).not.toMatch(/"writes_performed": true/);
  });

  it("privacy-minimizes decision snapshots and omits session-like fields", () => {
    const dryRun = validateReviewedAliasImportDryRun(
      [
        {
          ...approveMains({ alias_lang: "en" }),
          ...({
            session_bucket_id: "should-not-export",
            user_id: "should-not-export",
          } as Record<string, string>),
        } as ReviewedAliasDecisionRow,
      ],
      ctx(),
    );
    const report = buildReviewedAliasImportDryRunReport(dryRun);
    expect(report.rejected).toHaveLength(1);
    const decision = report.rejected[0]!.decision;
    expect(decision).not.toHaveProperty("session_bucket_id");
    expect(decision).not.toHaveProperty("user_id");
    expect(Object.keys(decision).sort()).toEqual(
      [
        "alias_lang",
        "alias_source_term",
        "candidate_category",
        "candidate_type",
        "canonical_source_terms",
        "evidence_count",
        "evidence_ir_ids",
        "evidence_sources",
        "lookup_mode",
        "normalized_query",
        "query_raw",
        "resolved_ir_ids",
        "reviewed_at",
        "reviewed_by",
        "reviewer_decision",
        "reviewer_notes",
        "source_bundle_id",
      ].sort(),
    );
    expect(JSON.stringify(report.artifacts)).not.toContain("should-not-export");
  });

  it("does not mutate the AL1D1 dry-run result", () => {
    const dryRun = validateReviewedAliasImportDryRun(
      [approveMains(), approveMains({ reviewer_decision: "reject" })],
      ctx(),
    );
    const snapshot = structuredClone(dryRun);
    buildReviewedAliasImportDryRunReport(dryRun);
    expect(dryRun).toEqual(snapshot);
  });

  it("rejects non-dry-run results", () => {
    const dryRun = validateReviewedAliasImportDryRun([approveMains()], ctx());
    expect(() =>
      buildReviewedAliasImportDryRunReport({
        ...dryRun,
        mode: "write" as unknown as "dry_run",
        writes_performed: false,
      }),
    ).toThrow(/dry-run/i);
  });
});
