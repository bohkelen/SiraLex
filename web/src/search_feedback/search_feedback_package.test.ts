/**
 * CF2I1 — Search feedback package model tests.
 */

import { describe, expect, it } from "vitest";

import {
  SEARCH_FEEDBACK_DRAFT_SCHEMA_VERSION,
  type SearchFeedbackDraftV1,
} from "./search_feedback_types";
import {
  SEARCH_FEEDBACK_AUTHORITY_LABEL,
  SEARCH_FEEDBACK_MAX_BYTES,
  SEARCH_FEEDBACK_PACKAGE_MAX_VALIDATION_ERRORS,
  SEARCH_FEEDBACK_PACKAGE_SCHEMA,
  SearchFeedbackBuildError,
  buildSearchFeedbackFilename,
  buildSearchFeedbackPackage,
  getSearchFeedbackUtf8ByteLength,
  parseSearchFeedbackJson,
  serializeSearchFeedbackPackage,
} from "./search_feedback_package";

const HASH =
  "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const TS = "2026-08-02T16:00:00.000Z";
const EXPORTED_AT = "2026-08-02T20:30:00.000Z";

function makeDraft(overrides: Partial<SearchFeedbackDraftV1> = {}): SearchFeedbackDraftV1 {
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

describe("package constants", () => {
  it("locks schema, authority label, and dedicated size bound", () => {
    expect(SEARCH_FEEDBACK_PACKAGE_SCHEMA).toBe("siralex_search_feedback_v1");
    expect(SEARCH_FEEDBACK_AUTHORITY_LABEL).toBe(
      "unreviewed_search_failure_feedback_must_not_be_treated_as_missing_entry_truth",
    );
    expect(SEARCH_FEEDBACK_MAX_BYTES).toBe(25 * 1024 * 1024);
  });
});

describe("package validation", () => {
  it("rejects invalid JSON, primitives, unknown fields, wrong schema/label", () => {
    expect(parseSearchFeedbackJson("{").ok).toBe(false);
    expect(parseSearchFeedbackJson("null").ok).toBe(false);
    expect(parseSearchFeedbackJson("[]").ok).toBe(false);

    const pkg = buildSearchFeedbackPackage([makeDraft()], {
      exportedAt: EXPORTED_AT,
    });
    const obj = JSON.parse(serializeSearchFeedbackPackage(pkg)) as Record<
      string,
      unknown
    >;
    expect(
      parseSearchFeedbackJson(JSON.stringify({ ...obj, extra: true })).ok,
    ).toBe(false);
    expect(
      parseSearchFeedbackJson(
        JSON.stringify({ ...obj, package_schema: "siralex_search_feedback_v2" }),
      ).ok,
    ).toBe(false);
    expect(
      parseSearchFeedbackJson(
        JSON.stringify({ ...obj, authority_label: "missing_entry_confirmed" }),
      ).ok,
    ).toBe(false);
  });

  it("rejects empty package, count mismatch, invalid nested feedback, duplicates, oversized", () => {
    const pkg = buildSearchFeedbackPackage([makeDraft()], {
      exportedAt: EXPORTED_AT,
    });
    const obj = JSON.parse(serializeSearchFeedbackPackage(pkg)) as Record<
      string,
      unknown
    >;

    expect(
      parseSearchFeedbackJson(
        JSON.stringify({ ...obj, feedback_count: 0, feedbacks: [] }),
      ).ok,
    ).toBe(false);
    expect(
      parseSearchFeedbackJson(
        JSON.stringify({ ...obj, feedback_count: 2 }),
      ).ok,
    ).toBe(false);

    const invalidNested = {
      ...obj,
      feedbacks: [{ ...makeDraft(), query_raw: "" }],
      feedback_count: 1,
    };
    expect(parseSearchFeedbackJson(JSON.stringify(invalidNested)).ok).toBe(false);

    const dup = {
      ...obj,
      feedback_count: 2,
      feedbacks: [
        makeDraft({ feedback_id: "same" }),
        makeDraft({ feedback_id: "same", query_raw: "other" }),
      ],
    };
    const dupResult = parseSearchFeedbackJson(JSON.stringify(dup));
    expect(dupResult.ok).toBe(false);
    if (!dupResult.ok) {
      expect(dupResult.errors.some((e) => e.code === "duplicate_feedback_id")).toBe(
        true,
      );
    }

    expect(
      parseSearchFeedbackJson(serializeSearchFeedbackPackage(pkg), {
        byteLength: SEARCH_FEEDBACK_MAX_BYTES + 1,
      }).ok,
    ).toBe(false);
  });

  it("accepts one and multiple records and preserves Unicode/N’Ko/multiline", () => {
    const multi = buildSearchFeedbackPackage(
      [
        makeDraft({
          feedback_id: "cf2-fixture-nko",
          query_raw: "ߞߎ߲",
          user_description: "line1\nline2",
        }),
        makeDraft({
          feedback_id: "cf2-fixture-fr",
          bundle_id: "bundle_b",
          query_raw: "à cause de",
          result_state: "results_not_useful",
          result_count: 2,
          matched_ir_ids: ["lex-1"],
        }),
      ],
      { exportedAt: EXPORTED_AT },
    );
    const json = serializeSearchFeedbackPackage(multi);
    const parsed = parseSearchFeedbackJson(json);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.package.feedback_count).toBe(2);
    expect(parsed.package.feedbacks[0]?.query_raw).toBe("ߞߎ߲");
    expect(parsed.package.feedbacks[0]?.user_description).toBe("line1\nline2");
  });

  it("rejects CF1 / Phase 1.5 / account / query-log / Learning fields on package", () => {
    const pkg = buildSearchFeedbackPackage([makeDraft()], {
      exportedAt: EXPORTED_AT,
    });
    const obj = JSON.parse(serializeSearchFeedbackPackage(pkg)) as Record<
      string,
      unknown
    >;
    for (const field of [
      "drafts",
      "correction_id",
      "patch",
      "query_log_id",
      "consent_version",
      "learning_record_id",
      "account_id",
      "device_id",
      "review_status",
    ]) {
      expect(
        parseSearchFeedbackJson(JSON.stringify({ ...obj, [field]: "x" })).ok,
      ).toBe(false);
    }
  });
});

describe("deterministic build/serialize", () => {
  it("orders by bundle_id → created_at → feedback_id and is byte-identical", () => {
    const drafts = [
      makeDraft({
        feedback_id: "z",
        bundle_id: "bundle_b",
        created_at: "2026-08-02T10:00:00.000Z",
        updated_at: "2026-08-02T10:00:00.000Z",
      }),
      makeDraft({
        feedback_id: "a",
        bundle_id: "bundle_a",
        created_at: "2026-08-02T12:00:00.000Z",
        updated_at: "2026-08-02T12:00:00.000Z",
      }),
      makeDraft({
        feedback_id: "b",
        bundle_id: "bundle_a",
        created_at: "2026-08-02T11:00:00.000Z",
        updated_at: "2026-08-02T11:00:00.000Z",
      }),
    ];
    const pkg = buildSearchFeedbackPackage(drafts, { exportedAt: EXPORTED_AT });
    expect(pkg.feedbacks.map((d) => d.feedback_id)).toEqual(["b", "a", "z"]);

    const s1 = serializeSearchFeedbackPackage(pkg);
    const s2 = serializeSearchFeedbackPackage(
      buildSearchFeedbackPackage(drafts, { exportedAt: EXPORTED_AT }),
    );
    expect(s1).toBe(s2);
    expect(s1.endsWith("\n")).toBe(true);

    const reparsed = parseSearchFeedbackJson(s1);
    expect(reparsed.ok).toBe(true);
    if (!reparsed.ok) return;
    expect(serializeSearchFeedbackPackage(reparsed.package)).toBe(s1);
  });

  it("computes UTF-8 byte length and enforces exact size boundary", () => {
    const pkg = buildSearchFeedbackPackage([makeDraft()], {
      exportedAt: EXPORTED_AT,
    });
    const json = serializeSearchFeedbackPackage(pkg);
    const bytes = getSearchFeedbackUtf8ByteLength(json);
    expect(bytes).toBe(new TextEncoder().encode(json).byteLength);
    expect(parseSearchFeedbackJson(json, { byteLength: bytes }).ok).toBe(true);
    expect(
      parseSearchFeedbackJson(json, { byteLength: SEARCH_FEEDBACK_MAX_BYTES }).ok,
    ).toBe(true);
  });

  it("builds deterministic filename", () => {
    expect(buildSearchFeedbackFilename(EXPORTED_AT)).toBe(
      "siralex-search-feedback-2026-08-02T20-30-00Z.json",
    );
    expect(() => buildSearchFeedbackFilename("yesterday")).toThrow(/exportedAt/);
  });

  it("build rejects empty/duplicate/invalid and surfaces typed errors", () => {
    expect(() =>
      buildSearchFeedbackPackage([], { exportedAt: EXPORTED_AT }),
    ).toThrow(SearchFeedbackBuildError);
    try {
      buildSearchFeedbackPackage([], { exportedAt: EXPORTED_AT });
    } catch (err) {
      expect(err).toBeInstanceOf(SearchFeedbackBuildError);
      expect((err as SearchFeedbackBuildError).code).toBe("empty_feedbacks");
    }

    expect(() =>
      buildSearchFeedbackPackage(
        [makeDraft(), makeDraft({ feedback_id: "cf2-fixture-no-result-mnk" })],
        { exportedAt: EXPORTED_AT },
      ),
    ).toThrow(/duplicate feedback_id/);

    expect(() =>
      buildSearchFeedbackPackage([makeDraft({ query_raw: "" })], {
        exportedAt: EXPORTED_AT,
      }),
    ).toThrow(/invalid search feedback draft/);
  });

  it("caps package validation errors", () => {
    const pkg = buildSearchFeedbackPackage([makeDraft()], {
      exportedAt: EXPORTED_AT,
    });
    const obj = JSON.parse(serializeSearchFeedbackPackage(pkg)) as Record<
      string,
      unknown
    >;
    for (let i = 0; i < 120; i += 1) {
      obj[`extra_${i}`] = true;
    }
    const result = parseSearchFeedbackJson(JSON.stringify(obj));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.length).toBe(
      SEARCH_FEEDBACK_PACKAGE_MAX_VALIDATION_ERRORS,
    );
    expect(result.errors[result.errors.length - 1]?.code).toBe(
      "error_limit_reached",
    );
    expect(result.truncated).toBe(true);
  });
});
