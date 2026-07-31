/**
 * CF1I1 — Correction feedback package model tests.
 */

import { describe, expect, it } from "vitest";

import {
  CORRECTION_DRAFT_SCHEMA_VERSION,
  cloneCorrectionDraft,
  type CorrectionDraftV1,
} from "./correction_draft_types";
import {
  CORRECTION_FEEDBACK_AUTHORITY_LABEL,
  CORRECTION_FEEDBACK_MAX_BYTES,
  CORRECTION_FEEDBACK_PACKAGE_SCHEMA,
  CorrectionFeedbackBuildError,
  buildCorrectionFeedbackFilename,
  buildCorrectionFeedbackPackage,
  getCorrectionFeedbackUtf8ByteLength,
  parseCorrectionFeedbackJson,
  serializeCorrectionFeedbackPackage,
} from "./correction_feedback_package";

const HASH =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const TS = "2026-07-31T18:00:00.000Z";
const EXPORTED_AT = "2026-07-31T22:30:00.000Z";

function makeDraft(overrides: Partial<CorrectionDraftV1> = {}): CorrectionDraftV1 {
  return {
    schema_version: CORRECTION_DRAFT_SCHEMA_VERSION,
    draft_id: "draft-1",
    bundle_id: "bundle_a",
    ir_id: "lex-1",
    ir_kind: "lexicon_entry",
    content_sha256: HASH,
    storage_scope_id: `bundle_a::${HASH}`,
    issue_type: "spelling",
    mode: "problem_report",
    target: { type: "headword" },
    display_snapshot: { headword_latin: "kùn" },
    problem_description: "Spelling looks off.",
    created_at: TS,
    updated_at: TS,
    status: "draft",
    ...overrides,
  };
}

describe("package constants", () => {
  it("locks schema, authority label, and size bound", () => {
    expect(CORRECTION_FEEDBACK_PACKAGE_SCHEMA).toBe("siralex_correction_feedback_v1");
    expect(CORRECTION_FEEDBACK_AUTHORITY_LABEL).toBe(
      "unreviewed_user_suggestions_must_not_be_applied_automatically",
    );
    expect(CORRECTION_FEEDBACK_MAX_BYTES).toBe(25 * 1024 * 1024);
  });
});

describe("package validation", () => {
  it("rejects invalid JSON, primitives, unknown fields, wrong schema/label", () => {
    expect(parseCorrectionFeedbackJson("{").ok).toBe(false);
    expect(parseCorrectionFeedbackJson("null").ok).toBe(false);
    expect(parseCorrectionFeedbackJson("[]").ok).toBe(false);
    expect(parseCorrectionFeedbackJson('"x"').ok).toBe(false);

    const pkg = buildCorrectionFeedbackPackage([makeDraft()], { exportedAt: EXPORTED_AT });
    const obj = JSON.parse(serializeCorrectionFeedbackPackage(pkg)) as Record<string, unknown>;
    expect(
      parseCorrectionFeedbackJson(JSON.stringify({ ...obj, extra: true })).ok,
    ).toBe(false);
    expect(
      parseCorrectionFeedbackJson(
        JSON.stringify({ ...obj, package_schema: "siralex_correction_feedback_v2" }),
      ).ok,
    ).toBe(false);
    expect(
      parseCorrectionFeedbackJson(
        JSON.stringify({ ...obj, exported_at: "yesterday" }),
      ).ok,
    ).toBe(false);
    expect(
      parseCorrectionFeedbackJson(
        JSON.stringify({ ...obj, authority_label: "approved_corrections" }),
      ).ok,
    ).toBe(false);
  });

  it("rejects empty package, count mismatch, invalid draft, duplicates, oversized", () => {
    const pkg = buildCorrectionFeedbackPackage([makeDraft()], { exportedAt: EXPORTED_AT });
    const obj = JSON.parse(serializeCorrectionFeedbackPackage(pkg)) as Record<string, unknown>;

    expect(
      parseCorrectionFeedbackJson(
        JSON.stringify({ ...obj, draft_count: 0, drafts: [] }),
      ).ok,
    ).toBe(false);
    expect(
      parseCorrectionFeedbackJson(
        JSON.stringify({ ...obj, draft_count: 2 }),
      ).ok,
    ).toBe(false);
    expect(
      parseCorrectionFeedbackJson(
        JSON.stringify({
          ...obj,
          drafts: [{ ...makeDraft(), problem_description: "" }],
        }),
      ).ok,
    ).toBe(false);

    const dup = buildCorrectionFeedbackPackage(
      [makeDraft({ draft_id: "a" }), makeDraft({ draft_id: "b" })],
      { exportedAt: EXPORTED_AT },
    );
    const dupObj = JSON.parse(serializeCorrectionFeedbackPackage(dup)) as {
      drafts: CorrectionDraftV1[];
      draft_count: number;
    };
    dupObj.drafts[1] = { ...dupObj.drafts[1]!, draft_id: dupObj.drafts[0]!.draft_id };
    expect(parseCorrectionFeedbackJson(JSON.stringify(dupObj)).ok).toBe(false);

    expect(
      parseCorrectionFeedbackJson("{}", { byteLength: CORRECTION_FEEDBACK_MAX_BYTES + 1 }).ok,
    ).toBe(false);
  });

  it("accepts noncanonical draft order from parser", () => {
    const a = makeDraft({ draft_id: "z", bundle_id: "bundle_b", ir_id: "lex-9" });
    const b = makeDraft({ draft_id: "a", bundle_id: "bundle_a", ir_id: "lex-1" });
    const built = buildCorrectionFeedbackPackage([a, b], { exportedAt: EXPORTED_AT });
    // Reverse the already-canonical drafts to simulate noncanonical input order.
    const reversed = {
      ...built,
      drafts: [...built.drafts].reverse(),
    };
    const json = JSON.stringify(reversed);
    const parsed = parseCorrectionFeedbackJson(json);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.package.drafts.map((d) => d.draft_id)).toEqual(["z", "a"]);
  });
});

describe("builder and deterministic output", () => {
  it("rejects empty drafts and duplicate draft IDs with typed errors", () => {
    expect(() =>
      buildCorrectionFeedbackPackage([], { exportedAt: EXPORTED_AT }),
    ).toThrow(CorrectionFeedbackBuildError);
    try {
      buildCorrectionFeedbackPackage([], { exportedAt: EXPORTED_AT });
    } catch (e) {
      expect((e as CorrectionFeedbackBuildError).code).toBe("empty_drafts");
    }
    try {
      buildCorrectionFeedbackPackage(
        [makeDraft({ draft_id: "same" }), makeDraft({ draft_id: "same" })],
        { exportedAt: EXPORTED_AT },
      );
    } catch (e) {
      expect((e as CorrectionFeedbackBuildError).code).toBe("duplicate_draft_id");
      expect((e as CorrectionFeedbackBuildError).message).not.toContain("kùn");
    }
  });

  it("sorts drafts canonically and leaves input unchanged", () => {
    const a = makeDraft({
      draft_id: "b",
      bundle_id: "bundle_a",
      ir_id: "lex-2",
      created_at: TS,
    });
    const b = makeDraft({
      draft_id: "a",
      bundle_id: "bundle_a",
      ir_id: "lex-1",
      created_at: TS,
    });
    const c = makeDraft({
      draft_id: "c",
      bundle_id: "bundle_b",
      ir_id: "lex-1",
      created_at: TS,
    });
    const inputs = [c, a, b];
    const before = inputs.map((d) => cloneCorrectionDraft(d));
    const pkg = buildCorrectionFeedbackPackage(inputs, { exportedAt: EXPORTED_AT });
    expect(pkg.drafts.map((d) => d.draft_id)).toEqual(["a", "b", "c"]);
    expect(inputs).toEqual(before);
  });

  it("keeps separate drafts for the same dictionary target", () => {
    const pkg = buildCorrectionFeedbackPackage(
      [
        makeDraft({ draft_id: "d1", issue_type: "spelling" }),
        makeDraft({ draft_id: "d2", issue_type: "example" }),
      ],
      { exportedAt: EXPORTED_AT },
    );
    expect(pkg.draft_count).toBe(2);
    expect(pkg.drafts.every((d) => d.ir_id === "lex-1")).toBe(true);
  });

  it("omits optional app_version and proposed_value consistently", () => {
    const pkg = buildCorrectionFeedbackPackage([makeDraft()], { exportedAt: EXPORTED_AT });
    const json = serializeCorrectionFeedbackPackage(pkg);
    expect(json).not.toContain("app_version");
    expect(json).not.toContain("proposed_value");
    const withApp = buildCorrectionFeedbackPackage([makeDraft()], {
      exportedAt: EXPORTED_AT,
      appVersion: "1.2.3",
    });
    expect(serializeCorrectionFeedbackPackage(withApp)).toContain('"app_version": "1.2.3"');
  });

  it("produces identical serialization from different input order", () => {
    const d1 = makeDraft({
      draft_id: "z",
      bundle_id: "bundle_b",
      target: { type: "sense", sense_index: 1 },
      display_snapshot: {
        headword_latin: "kùn",
        headword_nko: "ߞߎ߲",
        selected_text: "sense",
      },
      mode: "proposed_correction",
      proposed_value: "fix\nline",
    });
    const d2 = makeDraft({
      draft_id: "a",
      bundle_id: "bundle_a",
      target: { type: "other_field", field_label: "note" },
    });
    const s1 = serializeCorrectionFeedbackPackage(
      buildCorrectionFeedbackPackage([d1, d2], { exportedAt: EXPORTED_AT }),
    );
    const s2 = serializeCorrectionFeedbackPackage(
      buildCorrectionFeedbackPackage([d2, d1], { exportedAt: EXPORTED_AT }),
    );
    expect(s1).toBe(s2);
    expect(s1.endsWith("\n")).toBe(true);
    expect(s1.includes('\n  "package_schema"')).toBe(true);
    expect(s1).toContain('"type": "sense"');
    expect(s1).toContain('"sense_index": 1');
    expect(s1).toContain("ߞߎ߲");
  });

  it("round-trips build → serialize → parse exactly", () => {
    const pkg = buildCorrectionFeedbackPackage(
      [
        makeDraft({
          draft_id: "d1",
          mode: "proposed_correction",
          proposed_value: "ߞߎ߲\né",
          display_snapshot: {
            headword_latin: "kùn",
            headword_nko: "ߞߎ߲",
            part_of_speech: "n",
          },
        }),
        makeDraft({ draft_id: "d2", bundle_id: "bundle_b", ir_id: "lex-9" }),
      ],
      { exportedAt: EXPORTED_AT, appVersion: "test" },
    );
    const json = serializeCorrectionFeedbackPackage(pkg);
    const bytes = getCorrectionFeedbackUtf8ByteLength(json);
    const parsed = parseCorrectionFeedbackJson(json, { byteLength: bytes });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.package).toEqual(pkg);
    expect(serializeCorrectionFeedbackPackage(parsed.package)).toBe(json);
  });
});

describe("filename and UTF-8 sizing", () => {
  it("builds UTC filename without vocabulary", () => {
    expect(buildCorrectionFeedbackFilename(EXPORTED_AT)).toBe(
      "siralex-correction-feedback-2026-07-31T22-30-00Z.json",
    );
    expect(() => buildCorrectionFeedbackFilename("yesterday")).toThrow(/exportedAt/);
  });

  it("measures UTF-8 bytes for N’Ko, combining marks, and multiline", () => {
    const sample = "ߞߎ߲\né\nline";
    expect(getCorrectionFeedbackUtf8ByteLength(sample)).toBe(
      new TextEncoder().encode(sample).byteLength,
    );
    expect(getCorrectionFeedbackUtf8ByteLength(sample)).toBeGreaterThan(sample.length);
  });
});

describe("purity and Phase 1.5 boundary", () => {
  it("does not claim Phase 1.5 schemas or patch fields", () => {
    const pkg = buildCorrectionFeedbackPackage([makeDraft()], { exportedAt: EXPORTED_AT });
    const json = serializeCorrectionFeedbackPackage(pkg);
    expect(json).not.toContain("correction_record_v1");
    expect(json).not.toContain("correctionset");
    expect(json).not.toContain('"patch"');
    expect(json).toContain(CORRECTION_FEEDBACK_AUTHORITY_LABEL);
  });
});
