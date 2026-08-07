/**
 * CF2I1 — Search feedback draft validation tests.
 */

import { describe, expect, it } from "vitest";

import {
  SEARCH_FEEDBACK_DRAFT_SCHEMA_VERSION,
  SEARCH_FEEDBACK_DRAFT_SCHEMA_VERSION_V2,
  SEARCH_FEEDBACK_MATCHED_IR_IDS_MAX,
  SEARCH_FEEDBACK_MAX_VALIDATION_ERRORS,
  SEARCH_FEEDBACK_QUERY_RAW_MAX_CHARS,
  SEARCH_FEEDBACK_REQUESTED_MEANING_MAX_CHARS,
  compareSearchFeedbackDraftsForExport,
  countUnicodeCharacters,
  hasDisallowedControlCharacters,
  isValidCanonicalContentSha256,
  type SearchFeedbackDraftV1,
  type SearchFeedbackDraftV2,
} from "./search_feedback_types";
import {
  validateSearchFeedbackDraft,
  validateSearchFeedbackDraftForWrite,
} from "./search_feedback_validation";

const HASH =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const TS = "2026-08-02T16:00:00.000Z";

function makeNoResult(
  overrides: Partial<SearchFeedbackDraftV1> = {},
): SearchFeedbackDraftV1 {
  return {
    schema_version: SEARCH_FEEDBACK_DRAFT_SCHEMA_VERSION,
    feedback_id: "cf2-fixture-no-result-mnk",
    bundle_id: "bundle_a",
    content_sha256: HASH,
    storage_scope_id: `bundle_a::${HASH}`,
    query_raw: "kùn",
    search_direction: "target_to_source",
    result_state: "no_result",
    result_count: 0,
    created_at: TS,
    updated_at: TS,
    status: "draft",
    ...overrides,
  };
}

function makeResultsNotUseful(
  overrides: Partial<SearchFeedbackDraftV1> = {},
): SearchFeedbackDraftV1 {
  return {
    schema_version: SEARCH_FEEDBACK_DRAFT_SCHEMA_VERSION,
    feedback_id: "cf2-fixture-results-not-useful",
    bundle_id: "bundle_a",
    content_sha256: HASH,
    storage_scope_id: `bundle_a::${HASH}`,
    query_raw: "amour",
    search_direction: "source_to_target",
    result_state: "results_not_useful",
    result_count: 6,
    matched_ir_ids: ["lex-a", "lex-b", "lex-c"],
    created_at: TS,
    updated_at: TS,
    status: "draft",
    ...overrides,
  };
}

function makeV2(
  overrides: Partial<SearchFeedbackDraftV2> = {},
): SearchFeedbackDraftV2 {
  return {
    schema_version: SEARCH_FEEDBACK_DRAFT_SCHEMA_VERSION_V2,
    feedback_id: "cf2-fixture-v2",
    bundle_id: "bundle_a",
    content_sha256: HASH,
    storage_scope_id: `bundle_a::${HASH}`,
    query_raw: "kùn",
    search_direction: "target_to_source",
    input_lang: "mnk",
    output_lang: "fr",
    result_state: "no_result",
    result_count: 0,
    created_at: TS,
    updated_at: TS,
    status: "draft",
    ...overrides,
  };
}

describe("CF2 evidence semantics", () => {
  it("accepts query-only no_result without asserting missing_entry fields", () => {
    const result = validateSearchFeedbackDraft(makeNoResult());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.requested_meaning).toBeUndefined();
    expect(result.value.user_description).toBeUndefined();
    expect(result.value.matched_ir_ids).toBeUndefined();
    expect(
      Object.prototype.hasOwnProperty.call(result.value, "missing_entry"),
    ).toBe(false);
    expect(
      Object.prototype.hasOwnProperty.call(result.value, "diagnosis"),
    ).toBe(false);
  });
});

describe("minimal valid drafts", () => {
  it("accepts minimal no_result and results_not_useful", () => {
    expect(validateSearchFeedbackDraft(makeNoResult()).ok).toBe(true);
    expect(validateSearchFeedbackDraft(makeResultsNotUseful()).ok).toBe(true);
    expect(
      validateSearchFeedbackDraft(
        makeResultsNotUseful({ matched_ir_ids: undefined }),
      ).ok,
    ).toBe(true);
  });

  it("accepts optional requested_meaning and user_description", () => {
    const result = validateSearchFeedbackDraft(
      makeNoResult({
        feedback_id: "cf2-fixture-fr-query",
        query_raw: "bonjour",
        search_direction: "source_to_target",
        requested_meaning: "a greeting",
        user_description: "wanted a common greeting entry",
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.requested_meaning).toBe("a greeting");
    expect(result.value.user_description).toBe("wanted a common greeting entry");
  });
});

describe("query preservation", () => {
  it("preserves Unicode, N’Ko, accents, punctuation, and internal whitespace", () => {
    const query = "  à l'insu de ߞߎ߲  ";
    const result = validateSearchFeedbackDraft(
      makeNoResult({
        feedback_id: "cf2-fixture-nko-multiword",
        query_raw: query,
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.query_raw).toBe(query);
  });

  it("rejects empty/blank query and over-limit query", () => {
    expect(validateSearchFeedbackDraft(makeNoResult({ query_raw: "" })).ok).toBe(
      false,
    );
    expect(
      validateSearchFeedbackDraft(makeNoResult({ query_raw: "   " })).ok,
    ).toBe(false);
    const long = "a".repeat(SEARCH_FEEDBACK_QUERY_RAW_MAX_CHARS + 1);
    expect(
      validateSearchFeedbackDraft(makeNoResult({ query_raw: long })).ok,
    ).toBe(false);
  });

  it("rejects disallowed control characters in query", () => {
    expect(
      validateSearchFeedbackDraft(makeNoResult({ query_raw: "a\u0000b" })).ok,
    ).toBe(false);
    expect(hasDisallowedControlCharacters("a\nb")).toBe(false);
    expect(
      validateSearchFeedbackDraft(makeNoResult({ query_raw: "line\nbreak" })).ok,
    ).toBe(true);
  });
});

describe("provenance and identity", () => {
  it("accepts exact canonical SHA and rejects malformed/uppercase/bare hashes", () => {
    expect(isValidCanonicalContentSha256(HASH)).toBe(true);
    expect(
      validateSearchFeedbackDraft(
        makeNoResult({
          content_sha256:
            "sha256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        }),
      ).ok,
    ).toBe(false);
    expect(
      validateSearchFeedbackDraft(
        makeNoResult({
          content_sha256:
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        }),
      ).ok,
    ).toBe(false);
    expect(
      validateSearchFeedbackDraft(
        makeNoResult({ content_sha256: "sha256:abcd" }),
      ).ok,
    ).toBe(false);
  });

  it("rejects missing provenance and invalid direction/status/schema", () => {
    expect(
      validateSearchFeedbackDraft(makeNoResult({ bundle_id: "" })).ok,
    ).toBe(false);
    expect(
      validateSearchFeedbackDraft(makeNoResult({ storage_scope_id: "  " })).ok,
    ).toBe(false);
    expect(
      validateSearchFeedbackDraft({
        ...makeNoResult(),
        search_direction: "fr_to_mnk",
      } as unknown).ok,
    ).toBe(false);
    expect(
      validateSearchFeedbackDraft(makeNoResult({ status: "submitted" as "draft" }))
        .ok,
    ).toBe(false);
    expect(
      validateSearchFeedbackDraft(
        makeNoResult({
          schema_version: "search_failure_feedback_draft_v0" as "search_failure_feedback_draft_v1",
        }),
      ).ok,
    ).toBe(false);
  });

  it("rejects unknown top-level fields", () => {
    const result = validateSearchFeedbackDraft({
      ...makeNoResult(),
      missing_entry: true,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.code === "unknown_field")).toBe(true);
  });

  it("treats feedback_id as identity and allows duplicate query contexts", () => {
    const a = makeNoResult({ feedback_id: "id-a", query_raw: "same" });
    const b = makeNoResult({ feedback_id: "id-b", query_raw: "same" });
    expect(validateSearchFeedbackDraft(a).ok).toBe(true);
    expect(validateSearchFeedbackDraft(b).ok).toBe(true);
  });
});

describe("result-state invariants", () => {
  it("requires no_result ⇒ count 0 and matched_ir_ids absent", () => {
    expect(validateSearchFeedbackDraft(makeNoResult()).ok).toBe(true);
    expect(
      validateSearchFeedbackDraft(makeNoResult({ result_count: 1 })).ok,
    ).toBe(false);
    expect(
      validateSearchFeedbackDraft(makeNoResult({ matched_ir_ids: [] })).ok,
    ).toBe(false);
    expect(
      validateSearchFeedbackDraft(
        makeNoResult({ matched_ir_ids: ["lex-1"] }),
      ).ok,
    ).toBe(false);
  });

  it("requires results_not_useful ⇒ positive count; IDs optional/bounded", () => {
    expect(
      validateSearchFeedbackDraft(
        makeResultsNotUseful({ result_count: 0, matched_ir_ids: undefined }),
      ).ok,
    ).toBe(false);
    expect(
      validateSearchFeedbackDraft(
        makeResultsNotUseful({ result_count: 3, matched_ir_ids: undefined }),
      ).ok,
    ).toBe(true);

    const ids = Array.from(
      { length: SEARCH_FEEDBACK_MATCHED_IR_IDS_MAX },
      (_, i) => `lex-${i}`,
    );
    expect(
      validateSearchFeedbackDraft(
        makeResultsNotUseful({ result_count: 40, matched_ir_ids: ids }),
      ).ok,
    ).toBe(true);
    expect(
      validateSearchFeedbackDraft(
        makeResultsNotUseful({
          result_count: 40,
          matched_ir_ids: [...ids, "lex-extra"],
        }),
      ).ok,
    ).toBe(false);
  });

  it("rejects negative/fractional/NaN counts and duplicate matched IDs", () => {
    expect(
      validateSearchFeedbackDraft(
        makeResultsNotUseful({ result_count: -1 as unknown as number }),
      ).ok,
    ).toBe(false);
    expect(
      validateSearchFeedbackDraft(
        makeResultsNotUseful({ result_count: 1.5 as unknown as number }),
      ).ok,
    ).toBe(false);
    expect(
      validateSearchFeedbackDraft(
        makeResultsNotUseful({ result_count: Number.NaN }),
      ).ok,
    ).toBe(false);
    expect(
      validateSearchFeedbackDraft(
        makeResultsNotUseful({
          matched_ir_ids: ["lex-a", "lex-a"],
        }),
      ).ok,
    ).toBe(false);
  });

  it("preserves matched_ir_ids order and allows count > matched length", () => {
    const result = validateSearchFeedbackDraft(
      makeResultsNotUseful({
        result_count: 10,
        matched_ir_ids: ["z", "a", "m"],
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.matched_ir_ids).toEqual(["z", "a", "m"]);
    expect(result.value.result_count).toBe(10);
  });
});

describe("optional user evidence", () => {
  it("rejects empty optional strings and over-limit text", () => {
    expect(
      validateSearchFeedbackDraft(makeNoResult({ requested_meaning: "" })).ok,
    ).toBe(false);
    expect(
      validateSearchFeedbackDraft(makeNoResult({ user_description: "   " })).ok,
    ).toBe(false);
    const long = "x".repeat(SEARCH_FEEDBACK_REQUESTED_MEANING_MAX_CHARS + 1);
    expect(
      validateSearchFeedbackDraft(makeNoResult({ requested_meaning: long })).ok,
    ).toBe(false);
  });

  it("preserves multiline user_description exactly", () => {
    const text = "first line\nsecond line\r\nthird";
    const result = validateSearchFeedbackDraft(
      makeNoResult({
        feedback_id: "cf2-fixture-multiline",
        user_description: text,
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.user_description).toBe(text);
  });

  it("rejects disallowed controls in optional fields", () => {
    expect(
      validateSearchFeedbackDraft(
        makeNoResult({ requested_meaning: "a\u0007b" }),
      ).ok,
    ).toBe(false);
  });
});

describe("timestamps and write assert", () => {
  it("rejects invalid timestamps and updated-before-created", () => {
    expect(
      validateSearchFeedbackDraft(makeNoResult({ created_at: "yesterday" })).ok,
    ).toBe(false);
    expect(
      validateSearchFeedbackDraft(
        makeNoResult({
          created_at: "2026-08-02T17:00:00.000Z",
          updated_at: "2026-08-02T16:00:00.000Z",
        }),
      ).ok,
    ).toBe(false);
  });

  it("validateSearchFeedbackDraftForWrite throws on invalid drafts", () => {
    expect(() =>
      validateSearchFeedbackDraftForWrite(makeNoResult({ query_raw: "" })),
    ).toThrow(/invalid_query/);
    expect(() => validateSearchFeedbackDraftForWrite(makeNoResult())).not.toThrow();
  });
});

describe("schema versioning (ML1C2A)", () => {
  it("accepts V1 drafts without language fields", () => {
    const result = validateSearchFeedbackDraft(
      makeNoResult({ search_direction: "source_to_target", query_raw: "maison" }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.schema_version).toBe(SEARCH_FEEDBACK_DRAFT_SCHEMA_VERSION);
    expect(
      Object.prototype.hasOwnProperty.call(result.value, "input_lang"),
    ).toBe(false);
    expect(
      Object.prototype.hasOwnProperty.call(result.value, "output_lang"),
    ).toBe(false);
  });

  it("rejects input_lang/output_lang on V1 as unknown_field", () => {
    const result = validateSearchFeedbackDraft({
      ...makeNoResult(),
      input_lang: "fr",
      output_lang: "mnk",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.code === "unknown_field")).toBe(true);
  });

  it("accepts V2 EN→MNK and MNK→EN pairs and requires both langs", () => {
    const en = validateSearchFeedbackDraft(
      makeV2({
        query_raw: "house",
        search_direction: "source_to_target",
        input_lang: "en",
        output_lang: "mnk",
      }),
    );
    expect(en.ok).toBe(true);
    if (en.ok && en.value.schema_version === SEARCH_FEEDBACK_DRAFT_SCHEMA_VERSION_V2) {
      expect(en.value.input_lang).toBe("en");
      expect(en.value.output_lang).toBe("mnk");
    }

    const mnkEn = validateSearchFeedbackDraft(
      makeV2({
        query_raw: "bón",
        search_direction: "target_to_source",
        input_lang: "mnk",
        output_lang: "en",
      }),
    );
    expect(mnkEn.ok).toBe(true);
    if (
      mnkEn.ok &&
      mnkEn.value.schema_version === SEARCH_FEEDBACK_DRAFT_SCHEMA_VERSION_V2
    ) {
      expect(mnkEn.value.input_lang).toBe("mnk");
      expect(mnkEn.value.output_lang).toBe("en");
    }

    const { input_lang: _i, output_lang: _o, ...withoutLangs } = makeV2();
    expect(validateSearchFeedbackDraft(withoutLangs).ok).toBe(false);
  });

  it("rejects invalid V2 language pairs and direction mismatches", () => {
    expect(
      validateSearchFeedbackDraft(
        makeV2({
          search_direction: "source_to_target",
          input_lang: "fr",
          output_lang: "en",
        }),
      ).ok,
    ).toBe(false);
    expect(
      validateSearchFeedbackDraft(
        makeV2({
          search_direction: "target_to_source",
          input_lang: "mnk",
          output_lang: "mnk",
        }),
      ).ok,
    ).toBe(false);
    expect(
      validateSearchFeedbackDraft(
        makeV2({
          search_direction: "source_to_target",
          input_lang: "en",
          output_lang: undefined as unknown as "mnk",
        }),
      ).ok,
    ).toBe(false);
    expect(
      validateSearchFeedbackDraft(
        makeV2({
          search_direction: "source_to_target",
          input_lang: "mnk",
          output_lang: "en",
        }),
      ).ok,
    ).toBe(false);
  });
});

describe("error cap and helpers", () => {
  it("caps validation errors at 100 with error_limit_reached", () => {
    const huge: Record<string, unknown> = {
      ...makeNoResult(),
    };
    for (let i = 0; i < 120; i += 1) {
      huge[`extra_${i}`] = true;
    }
    const result = validateSearchFeedbackDraft(huge);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.length).toBe(SEARCH_FEEDBACK_MAX_VALIDATION_ERRORS);
    expect(result.errors[result.errors.length - 1]?.code).toBe(
      "error_limit_reached",
    );
    expect(result.truncated).toBe(true);
  });

  it("counts Unicode code points and sorts by code points", () => {
    expect(countUnicodeCharacters("ߞߎ߲")).toBe(3);
    const a = makeNoResult({
      feedback_id: "b",
      bundle_id: "bundle_a",
      created_at: "2026-08-02T16:00:00.000Z",
    });
    const b = makeNoResult({
      feedback_id: "a",
      bundle_id: "bundle_a",
      created_at: "2026-08-02T16:00:00.000Z",
    });
    const c = makeNoResult({
      feedback_id: "a",
      bundle_id: "bundle_b",
      created_at: "2026-08-02T15:00:00.000Z",
    });
    const sorted = [a, b, c].sort(compareSearchFeedbackDraftsForExport);
    // bundle_id → created_at → feedback_id
    expect(sorted.map((d) => `${d.bundle_id}|${d.feedback_id}`)).toEqual([
      "bundle_a|a",
      "bundle_a|b",
      "bundle_b|a",
    ]);
  });
});
