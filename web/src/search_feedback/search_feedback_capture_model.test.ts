import { describe, expect, it } from "vitest";

import {
  SEARCH_FEEDBACK_MATCHED_IR_IDS_MAX,
  SEARCH_FEEDBACK_REQUESTED_MEANING_MAX_CHARS,
  countUnicodeCharacters,
} from "./search_feedback_types";
import {
  buildSearchFeedbackCaptureContext,
  canOfferSearchFeedbackCapture,
  canonicalizeOptionalCaptureField,
  createInitialSearchFeedbackCaptureFields,
  deriveMatchedIrIdsFromRecords,
  validateSearchFeedbackCaptureFields,
  type ExecutedSearchSnapshot,
} from "./search_feedback_capture_model";

const HASH =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function snapshot(
  overrides: Partial<ExecutedSearchSnapshot> = {},
): ExecutedSearchSnapshot {
  return {
    generation: 3,
    query_raw: "  kùn  ",
    search_direction: "source_to_target",
    result_state: "no_result",
    result_count: 0,
    bundle_id: "bundle_a",
    content_sha256: HASH,
    storage_scope_id: `bundle_a::${HASH}`,
    ...overrides,
  };
}

describe("search feedback capture model", () => {
  it("builds no_result context with count 0 and IDs absent", () => {
    const ctx = buildSearchFeedbackCaptureContext(snapshot());
    expect(ctx).toEqual({
      bundle_id: "bundle_a",
      content_sha256: HASH,
      storage_scope_id: `bundle_a::${HASH}`,
      query_raw: "  kùn  ",
      search_direction: "source_to_target",
      input_lang: "fr",
      output_lang: "mnk",
      result_state: "no_result",
      result_count: 0,
      search_generation: 3,
    });
    expect(ctx && "matched_ir_ids" in ctx).toBe(false);
  });

  it("builds results_not_useful context preserving exact query/direction/provenance", () => {
    const ids = ["a", "b", "c"];
    const ctx = buildSearchFeedbackCaptureContext(
      snapshot({
        result_state: "results_not_useful",
        result_count: 3,
        matched_ir_ids: ids,
        search_direction: "target_to_source",
        query_raw: "tête",
      }),
    );
    expect(ctx?.query_raw).toBe("tête");
    expect(ctx?.search_direction).toBe("target_to_source");
    expect(ctx?.input_lang).toBe("mnk");
    expect(ctx?.output_lang).toBe("fr");
    expect(ctx?.result_count).toBe(3);
    expect(ctx?.matched_ir_ids).toEqual(ids);
    expect(ctx?.matched_ir_ids).not.toBe(ids);
    expect(ctx?.bundle_id).toBe("bundle_a");
    expect(ctx?.content_sha256).toBe(HASH);
    expect(ctx?.storage_scope_id).toBe(`bundle_a::${HASH}`);
  });

  it("preserves explicit EN→MNK and MNK→EN snapshot pairs", () => {
    const enCtx = buildSearchFeedbackCaptureContext(
      snapshot({
        search_direction: "source_to_target",
        input_lang: "en",
        output_lang: "mnk",
        query_raw: "house",
      }),
    );
    expect(enCtx?.input_lang).toBe("en");
    expect(enCtx?.output_lang).toBe("mnk");

    const mnkEn = buildSearchFeedbackCaptureContext(
      snapshot({
        search_direction: "target_to_source",
        input_lang: "mnk",
        output_lang: "en",
        query_raw: "bón",
      }),
    );
    expect(mnkEn?.input_lang).toBe("mnk");
    expect(mnkEn?.output_lang).toBe("en");
  });

  it("rejects mismatched or partial language pairs on snapshots", () => {
    expect(
      buildSearchFeedbackCaptureContext(
        snapshot({ input_lang: "en", output_lang: undefined }),
      ),
    ).toBeUndefined();
    expect(
      buildSearchFeedbackCaptureContext(
        snapshot({
          search_direction: "source_to_target",
          input_lang: "mnk",
          output_lang: "en",
        }),
      ),
    ).toBeUndefined();
  });

  it("rejects blank query and missing provenance for capture offer", () => {
    expect(canOfferSearchFeedbackCapture(undefined)).toBe(false);
    expect(canOfferSearchFeedbackCapture(snapshot({ query_raw: "   " }))).toBe(
      false,
    );
    expect(
      canOfferSearchFeedbackCapture(snapshot({ content_sha256: "not-a-hash" })),
    ).toBe(false);
    expect(
      canOfferSearchFeedbackCapture(
        snapshot({
          result_state: "no_result",
          result_count: 0,
          matched_ir_ids: [],
        }),
      ),
    ).toBe(false);
  });

  it("derives matched IDs: stable order, unique, capped at 25", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ ir_id: `id-${i}` }));
    many.splice(2, 0, { ir_id: "id-1" }); // duplicate of earlier
    const derived = deriveMatchedIrIdsFromRecords(many);
    expect(derived).toHaveLength(SEARCH_FEEDBACK_MATCHED_IR_IDS_MAX);
    expect(derived?.[0]).toBe("id-0");
    expect(derived?.[1]).toBe("id-1");
    expect(derived?.[2]).toBe("id-2");
    expect(new Set(derived).size).toBe(SEARCH_FEEDBACK_MATCHED_IR_IDS_MAX);
  });

  it("canonicalizes blank optional fields to absence and preserves nonblank whitespace", () => {
    expect(canonicalizeOptionalCaptureField("")).toBeUndefined();
    expect(canonicalizeOptionalCaptureField("   ")).toBeUndefined();
    expect(canonicalizeOptionalCaptureField("  I meant greeting  ")).toBe(
      "  I meant greeting  ",
    );

    const ctx = buildSearchFeedbackCaptureContext(snapshot())!;
    const fields = createInitialSearchFeedbackCaptureFields();
    fields.requested_meaning = "   ";
    fields.user_description = "";
    const blank = validateSearchFeedbackCaptureFields(fields, ctx);
    expect(blank.ok).toBe(true);
    if (blank.ok) {
      expect("requested_meaning" in blank.input).toBe(false);
      expect("user_description" in blank.input).toBe(false);
    }

    fields.requested_meaning = "  I meant greeting  ";
    fields.user_description = "  note  ";
    const kept = validateSearchFeedbackCaptureFields(fields, ctx);
    expect(kept.ok).toBe(true);
    if (kept.ok) {
      expect(kept.input.requested_meaning).toBe("  I meant greeting  ");
      expect(kept.input.user_description).toBe("  note  ");
    }
  });

  it("counts Unicode/N’Ko code points and blocks over-limit fields", () => {
    const nko = "ߞߎ߲";
    expect(countUnicodeCharacters(nko)).toBe(3);
    const ctx = buildSearchFeedbackCaptureContext(snapshot())!;
    const fields = createInitialSearchFeedbackCaptureFields();
    fields.requested_meaning = "x".repeat(
      SEARCH_FEEDBACK_REQUESTED_MEANING_MAX_CHARS + 1,
    );
    const over = validateSearchFeedbackCaptureFields(fields, ctx);
    expect(over.ok).toBe(false);
    if (!over.ok) {
      expect(over.errors.requested_meaning).toBe("too_long");
    }
  });

  it("create input carries no linguistic diagnosis fields", () => {
    const ctx = buildSearchFeedbackCaptureContext(
      snapshot({
        result_state: "results_not_useful",
        result_count: 1,
        matched_ir_ids: ["lex-1"],
      }),
    )!;
    const validated = validateSearchFeedbackCaptureFields(
      createInitialSearchFeedbackCaptureFields(),
      ctx,
    );
    expect(validated.ok).toBe(true);
    if (validated.ok) {
      const keys = Object.keys(validated.input);
      expect(keys).not.toContain("missing_word");
      expect(keys).not.toContain("diagnosis");
      expect(keys).not.toContain("search_generation");
      expect(validated.input.result_state).toBe("results_not_useful");
      expect(validated.input.input_lang).toBe("fr");
      expect(validated.input.output_lang).toBe("mnk");
    }
  });
});
