import { describe, expect, it } from "vitest";
import {
  ALIAS_CANDIDATE_EVIDENCE_SCHEMA,
  aliasCandidateReportToCsv,
  aliasCandidateReportToJsonl,
  aliasCandidateReportToMarkdown,
  buildAliasCandidateReport,
  classifyAliasEvidenceCandidate,
  evidenceEventsFromCf2Drafts,
  evidenceEventsFromQueryLogs,
  normalizeCandidateQuery,
  summarizeAliasEvidence,
  type AliasEvidenceEvent,
  type AliasEvidenceIndexRow,
  type ReviewedAliasTableRowSnapshot,
} from "./alias_candidate_evidence";
import { SEARCH_FEEDBACK_DRAFT_SCHEMA_VERSION_V2 } from "../search_feedback/search_feedback_types";
import { QUERY_LOG_EVENT_V3 } from "../query_logging/query_log_types";
import type { LookupMode } from "../search/lookup_mode";

const FR_MNK: LookupMode = { from: "fr", to: "mnk" };
const BUNDLE = "bundle_fixture_al1b";
const HASH = "a".repeat(64);

function src(key: string, ir = "ir_1"): AliasEvidenceIndexRow {
  return { key_type: "src_casefold", key, ir_ids: [ir] };
}

function baseCtx(rows: AliasEvidenceIndexRow[], aliases: ReviewedAliasTableRowSnapshot[] = []) {
  return {
    index_rows: rows,
    reviewed_alias_rows: aliases,
    search_index_directional: true,
  };
}

function event(
  query: string,
  overrides: Partial<AliasEvidenceEvent> = {},
): AliasEvidenceEvent {
  return {
    query_raw: query,
    bundle_id: BUNDLE,
    content_sha256: HASH,
    lookup_mode: FR_MNK,
    evidence_source: "fixture",
    observed_at: "2026-08-20T12:00:00.000Z",
    observed_result_hint: "no_result",
    ...overrides,
  };
}

describe("AL1B normalizeCandidateQuery", () => {
  it("trims and collapses whitespace under NFC", () => {
    expect(normalizeCandidateQuery("  Bon Jour  ")).toBe("Bon Jour");
  });
});

describe("AL1B already_searchable", () => {
  it("classifies exact hit", () => {
    const result = classifyAliasEvidenceCandidate(
      "maison",
      FR_MNK,
      baseCtx([src("maison")]),
    );
    expect(result.category).toBe("already_searchable");
    expect(result.replay.status).toBe("exact_hit");
    expect(result.recommended_human_action).toBe("already_fixed_by_search");
  });

  it("classifies SQ1 hyphen/space variant hit", () => {
    const result = classifyAliasEvidenceCandidate(
      "grand pere",
      FR_MNK,
      baseCtx([src("grand-pere")]),
    );
    expect(result.category).toBe("already_searchable");
    expect(result.replay.status).toBe("variant_hit");
    expect(result.replay.separator_variant_query).toBe("grand-pere");
  });

  it("classifies SQ1 ligature variant hit", () => {
    const result = classifyAliasEvidenceCandidate(
      "sœur",
      FR_MNK,
      baseCtx([src("soeur")]),
    );
    expect(result.category).toBe("already_searchable");
    expect(result.replay.status).toBe("variant_hit");
  });

  it("classifies when prefix suggestions exist", () => {
    const result = classifyAliasEvidenceCandidate(
      "enf",
      FR_MNK,
      baseCtx([src("enfant"), src("enfance")]),
    );
    expect(result.category).toBe("already_searchable");
    expect(result.replay.status).toBe("prefix_suggestions");
    expect(result.replay.prefix_suggestions).toEqual(
      expect.arrayContaining(["enfance", "enfant"]),
    );
  });
});

describe("AL1B possible_alias", () => {
  it("flags plural-ish miss when singular is indexed", () => {
    const result = classifyAliasEvidenceCandidate(
      "mains",
      FR_MNK,
      baseCtx([src("main")]),
    );
    expect(result.category).toBe("possible_alias");
    expect(result.recommended_human_action).toBe("review_alias");
    expect(result.replay.status).toBe("miss");
    expect(result.reason).toMatch(/not auto-approved/i);
  });

  it("flags pending reviewed alias table row without approving", () => {
    const result = classifyAliasEvidenceCandidate(
      "maman",
      FR_MNK,
      baseCtx([], [
        {
          alias_source_term: "maman",
          status: "candidate",
          canonical_source_terms: ["mère"],
        },
      ]),
    );
    expect(result.category).toBe("possible_alias");
    expect(result.reason).toMatch(/Not auto-approved/);
  });
});

describe("AL1B possible_content_gap", () => {
  it("flags meaningful FR miss with no nearby key heuristic", () => {
    const result = classifyAliasEvidenceCandidate(
      "bonjour",
      FR_MNK,
      baseCtx([src("maison"), src("enfant")]),
    );
    expect(result.category).toBe("possible_content_gap");
    expect(result.recommended_human_action).toBe("review_content_gap");
  });
});

describe("AL1B likely_typo_or_noise", () => {
  it("flags too-short queries", () => {
    expect(
      classifyAliasEvidenceCandidate("a", FR_MNK, baseCtx([src("alpha")])).category,
    ).toBe("likely_typo_or_noise");
  });

  it("flags malformed punctuation-only noise", () => {
    expect(
      classifyAliasEvidenceCandidate("!!!", FR_MNK, baseCtx([])).category,
    ).toBe("likely_typo_or_noise");
  });
});

describe("AL1B ambiguous", () => {
  it("flags multi-token misses", () => {
    const result = classifyAliasEvidenceCandidate(
      "ferme la bouche",
      FR_MNK,
      baseCtx([src("maison")]),
    );
    expect(result.category).toBe("ambiguous");
    expect(result.recommended_human_action).toBe("needs_more_context");
  });

  it("flags CF2 results_not_useful as ambiguous", () => {
    const result = classifyAliasEvidenceCandidate(
      "mère",
      FR_MNK,
      baseCtx([src("mere")]),
      { observed_result_hint: "results_not_useful", observed_result_count: 3 },
    );
    expect(result.category).toBe("ambiguous");
  });
});

describe("AL1B report build + determinism", () => {
  it("aggregates frequency and sorts stably", () => {
    const ctx = baseCtx([src("main"), src("maison"), src("enfant"), src("enfance")]);
    const events: AliasEvidenceEvent[] = [
      event("bonjour"),
      event("bonjour", { observed_at: "2026-08-21T00:00:00.000Z" }),
      event("mains"),
      event("enf"),
      event("!!!"),
      event("grand pere"),
      event("ferme la bouche"),
      event("mains", { evidence_source: "cf2" }),
      event("mains", { evidence_source: "query_log", observed_at: "2026-08-22T00:00:00.000Z" }),
    ];
    // Add hyphen index so grand pere is already_searchable
    const withHyphen = baseCtx([
      ...ctx.index_rows,
      src("grand-pere"),
    ]);
    const report = buildAliasCandidateReport(events, withHyphen);
    expect(report.schema_version).toBe(ALIAS_CANDIDATE_EVIDENCE_SCHEMA);
    expect(report.authority_label).toMatch(/must_not_be_treated_as_dictionary_truth/);
    expect(report.candidate_count).toBe(6);

    const mains = report.candidates.find((c) => c.normalized_query === "mains");
    expect(mains?.occurrence_count).toBe(3);
    expect(mains?.evidence_source).toBe("both");
    expect(mains?.candidate_category).toBe("possible_alias");
    expect(mains?.review_status).toBe("candidate");
    expect(mains?.reviewer_notes).toBe("");

    const again = buildAliasCandidateReport(events, withHyphen);
    expect(aliasCandidateReportToMarkdown(report)).toBe(
      aliasCandidateReportToMarkdown(again),
    );
    expect(aliasCandidateReportToJsonl(report)).toBe(aliasCandidateReportToJsonl(again));
    expect(aliasCandidateReportToCsv(report)).toBe(aliasCandidateReportToCsv(again));

    // possible_alias before possible_content_gap before ambiguous...
    const categories = report.candidates.map((c) => c.candidate_category);
    expect(categories.indexOf("possible_alias")).toBeLessThan(
      categories.indexOf("possible_content_gap"),
    );
  });

  it("markdown worksheet includes blank reviewer notes and no approval language", () => {
    const report = buildAliasCandidateReport(
      [event("bonjour"), event("mains")],
      baseCtx([src("main")]),
    );
    const md = aliasCandidateReportToMarkdown(report);
    expect(md).toContain("AL1B reviewer evidence only");
    expect(md).toContain("reviewer_notes");
    expect(md).toContain("No aliases approved");
    expect(md).not.toMatch(/status:\s*approved/i);
    const summary = summarizeAliasEvidence(report);
    expect(summary.possible_alias).toBe(1);
    expect(summary.possible_content_gap).toBe(1);
  });
});

describe("AL1B CF2 / query-log ingest", () => {
  it("reads CF2 V2 drafts and query-log V3 misses", () => {
    const cf2 = evidenceEventsFromCf2Drafts([
      {
        schema_version: SEARCH_FEEDBACK_DRAFT_SCHEMA_VERSION_V2,
        feedback_id: "fb1",
        bundle_id: BUNDLE,
        content_sha256: HASH,
        storage_scope_id: "scope",
        query_raw: "poulet",
        search_direction: "source_to_target",
        input_lang: "fr",
        output_lang: "mnk",
        result_state: "no_result",
        result_count: 0,
        created_at: "2026-08-20T10:00:00.000Z",
        updated_at: "2026-08-20T10:00:00.000Z",
        status: "draft",
      },
    ]);
    expect(cf2).toHaveLength(1);
    expect(cf2[0]?.evidence_source).toBe("cf2");

    const logs = evidenceEventsFromQueryLogs([
      {
        schema_version: QUERY_LOG_EVENT_V3,
        event_id: "e1",
        timestamp_iso: "2026-08-20T11:00:00.000Z",
        app_version: "test",
        bundle_id: BUNDLE,
        storage_scope_id: "scope",
        norm_version: "norm_v3",
        query_raw: "hello",
        query_normalized_primary: "hello",
        query_normalized_keys: {
          casefold: ["hello"],
          diacritics_insensitive: ["hello"],
          punct_stripped: ["hello"],
          nospace: ["hello"],
        },
        direction: "source_to_target",
        ui_language: "en",
        result_status: "miss",
        result_count: 0,
        top_ir_ids: [],
        matched_key_type: "none",
        matched_key: null,
        matched_deep_ladder: false,
        latency_ms: 1,
        offline_or_online: true,
        session_bucket_id: "s",
        logging_enabled: true,
        consent_version: "phase7k_tester_consent_v1",
        input_lang: "en",
        output_lang: "mnk",
      },
    ]);
    expect(logs).toHaveLength(1);
    expect(logs[0]?.lookup_mode).toEqual({ from: "en", to: "mnk" });
  });
});

describe("AL1B authority boundary", () => {
  it("never exposes an approve or mutate API on the report", () => {
    const report = buildAliasCandidateReport([event("bonjour")], baseCtx([]));
    for (const row of report.candidates) {
      expect(row.review_status).toBe("candidate");
      expect(row).not.toHaveProperty("approved");
      expect(row.recommended_human_action).not.toBe("approve_alias");
    }
    expect(JSON.stringify(report)).not.toMatch(/auto-approv/i);
  });
});
