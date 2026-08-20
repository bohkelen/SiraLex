import { describe, expect, it } from "vitest";
import type { AliasCandidateReportRow } from "./alias_candidate_evidence";
import { ALIAS_CANDIDATE_EVIDENCE_SCHEMA } from "./alias_candidate_evidence";
import {
  ALIAS_REVIEWER_WORKSHEET_CSV_COLUMNS,
  ALIAS_REVIEWER_WORKSHEET_SCHEMA,
  exportAliasCandidateCsv,
  exportAliasCandidateJsonl,
  exportAliasCandidateMarkdown,
  sortAliasCandidatesForExport,
  summarizeAliasCandidatesForExport,
  toAliasReviewerWorksheetRow,
} from "./alias_candidate_exports";
import type { LookupMode } from "../search/lookup_mode";

const FR_MNK: LookupMode = { from: "fr", to: "mnk" };
const EN_MNK: LookupMode = { from: "en", to: "mnk" };

function row(
  partial: Partial<AliasCandidateReportRow> &
    Pick<
      AliasCandidateReportRow,
      "query_raw" | "normalized_query" | "candidate_category" | "recommended_human_action"
    >,
): AliasCandidateReportRow {
  return {
    schema_version: ALIAS_CANDIDATE_EVIDENCE_SCHEMA,
    lookup_mode: FR_MNK,
    bundle_id: "bundle_al1c",
    content_sha256: "b".repeat(64),
    evidence_source: "fixture",
    occurrence_count: 1,
    last_seen: "2026-08-20T12:00:00.000Z",
    current_search_status: "miss",
    matched_key: null,
    separator_variant_query: null,
    prefix_suggestions: [],
    closest_exact_or_prefix_keys: [],
    classification_reason: "fixture",
    reviewer_notes: "",
    review_status: "candidate",
    ...partial,
  };
}

describe("AL1C CSV worksheet", () => {
  it("emits header and privacy-minimized rows", () => {
    const csv = exportAliasCandidateCsv([
      row({
        query_raw: "bonjour",
        normalized_query: "bonjour",
        candidate_category: "possible_content_gap",
        recommended_human_action: "review_content_gap",
        occurrence_count: 3,
      }),
    ]);
    const lines = csv.trimEnd().split("\n");
    expect(lines[0]).toBe(ALIAS_REVIEWER_WORKSHEET_CSV_COLUMNS.join(","));
    expect(lines[1]).toContain("bonjour");
    expect(lines[1]).toContain("fr->mnk");
    expect(lines[1]).toContain("possible_content_gap");
    expect(lines[1]).not.toContain("bundle_al1c");
    expect(lines[1]).not.toContain("content_sha256");
    expect(lines[1]).not.toContain("classification_reason");
    expect(lines[1]).not.toContain("session");
  });

  it("escapes commas, quotes, and newlines", () => {
    const csv = exportAliasCandidateCsv([
      row({
        query_raw: 'say "hello", please',
        normalized_query: 'say "hello", please',
        candidate_category: "ambiguous",
        recommended_human_action: "needs_more_context",
        prefix_suggestions: ["a\nb"],
      }),
    ]);
    expect(csv).toContain('"say ""hello"", please"');
    expect(csv).toContain('"a\nb"');
  });

  it("joins arrays with '; ' and leaves reviewer fields blank", () => {
    const csv = exportAliasCandidateCsv([
      row({
        query_raw: "enf",
        normalized_query: "enf",
        candidate_category: "already_searchable",
        recommended_human_action: "already_fixed_by_search",
        current_search_status: "prefix_suggestions",
        prefix_suggestions: ["enfance", "enfant"],
        closest_exact_or_prefix_keys: ["enfance", "enfant"],
      }),
    ]);
    const dataLine = csv.trimEnd().split("\n")[1]!;
    expect(dataLine).toContain("enfance; enfant");
    expect(dataLine.endsWith(",,")).toBe(true);
  });
});

describe("AL1C JSONL worksheet", () => {
  it("emits one object per line with arrays preserved", () => {
    const jsonl = exportAliasCandidateJsonl([
      row({
        query_raw: "mains",
        normalized_query: "mains",
        candidate_category: "possible_alias",
        recommended_human_action: "review_alias",
        prefix_suggestions: [],
        closest_exact_or_prefix_keys: ["main"],
      }),
    ]);
    const lines = jsonl.trimEnd().split("\n");
    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]!) as Record<string, unknown>;
    expect(parsed.nearby_keys).toEqual(["main"]);
    expect(Array.isArray(parsed.prefix_suggestions)).toBe(true);
    expect(parsed.reviewer_decision).toBe("");
    expect(parsed.reviewer_notes).toBe("");
    expect(parsed).not.toHaveProperty("bundle_id");
    expect(parsed).not.toHaveProperty("content_sha256");
    expect(Object.keys(parsed)).toEqual([
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
    ]);
  });
});

describe("AL1C Markdown worksheet", () => {
  it("includes authority warning, counts, and definitions", () => {
    const md = exportAliasCandidateMarkdown(
      [
        row({
          query_raw: "bonjour",
          normalized_query: "bonjour",
          candidate_category: "possible_content_gap",
          recommended_human_action: "review_content_gap",
        }),
        row({
          query_raw: "mains",
          normalized_query: "mains",
          candidate_category: "possible_alias",
          recommended_human_action: "review_alias",
          occurrence_count: 2,
        }),
      ],
      { generated_at: "2026-08-20T15:00:00.000Z" },
    );
    expect(md).toContain(ALIAS_REVIEWER_WORKSHEET_SCHEMA);
    expect(md).toContain(
      "Evidence is not dictionary authority. Do not approve aliases without human review.",
    );
    expect(md).toContain("generated_at");
    expect(md).toContain("| possible_alias | 1 |");
    expect(md).toContain("| review_alias | 1 |");
    expect(md).toContain("**possible_alias**");
    expect(md).toContain("**review_content_gap**");
    expect(md).toContain("does **not** approve aliases");
    expect(md).not.toMatch(/approved alias/i);
  });
});

describe("AL1C ordering + summary", () => {
  it("sorts by category priority then evidence_count then keys", () => {
    const unordered = [
      row({
        query_raw: "zzz",
        normalized_query: "zzz",
        candidate_category: "likely_typo_or_noise",
        recommended_human_action: "ignore_noise",
      }),
      row({
        query_raw: "bonjour",
        normalized_query: "bonjour",
        candidate_category: "possible_content_gap",
        recommended_human_action: "review_content_gap",
        occurrence_count: 1,
      }),
      row({
        query_raw: "mains",
        normalized_query: "mains",
        candidate_category: "possible_alias",
        recommended_human_action: "review_alias",
        occurrence_count: 5,
      }),
      row({
        query_raw: "hello",
        normalized_query: "hello",
        candidate_category: "ambiguous",
        recommended_human_action: "needs_more_context",
        lookup_mode: EN_MNK,
      }),
      row({
        query_raw: "alpha",
        normalized_query: "alpha",
        candidate_category: "already_searchable",
        recommended_human_action: "already_fixed_by_search",
        current_search_status: "exact_hit",
      }),
    ];
    const sorted = sortAliasCandidatesForExport(unordered);
    expect(sorted.map((r) => r.normalized_query)).toEqual([
      "mains",
      "bonjour",
      "hello",
      "alpha",
      "zzz",
    ]);

    const csvA = exportAliasCandidateCsv(unordered);
    const csvB = exportAliasCandidateCsv([...unordered].reverse());
    expect(csvA).toBe(csvB);
    expect(exportAliasCandidateJsonl(unordered)).toBe(
      exportAliasCandidateJsonl([...unordered].reverse()),
    );

    const summary = summarizeAliasCandidatesForExport(unordered);
    expect(summary.total_candidates).toBe(5);
    expect(summary.by_category.possible_alias).toBe(1);
    expect(summary.by_recommended_action.review_alias).toBe(1);
  });
});

describe("AL1C authority + privacy + immutability", () => {
  it("never defaults reviewer decision to approved and does not mutate inputs", () => {
    const original = row({
      query_raw: "mains",
      normalized_query: "mains",
      candidate_category: "possible_alias",
      recommended_human_action: "review_alias",
      prefix_suggestions: ["x"],
      closest_exact_or_prefix_keys: ["main"],
    });
    const snapshot = structuredClone(original);
    const worksheet = toAliasReviewerWorksheetRow(original);
    expect(worksheet.reviewer_decision).toBe("");
    expect(worksheet.reviewer_notes).toBe("");
    expect(JSON.stringify(worksheet)).not.toMatch(/approved/i);

    exportAliasCandidateCsv([original]);
    exportAliasCandidateJsonl([original]);
    exportAliasCandidateMarkdown([original]);
    sortAliasCandidatesForExport([original]);

    expect(original).toEqual(snapshot);
    worksheet.prefix_suggestions.push("mutated");
    expect(original.prefix_suggestions).toEqual(["x"]);
  });
});
