/**
 * CF1I1 — Correction draft model and validator tests.
 */

import { describe, expect, it } from "vitest";

import {
  CORRECTION_DRAFT_SCHEMA_VERSION,
  CORRECTION_ISSUE_TYPES,
  CORRECTION_OTHER_FIELD_LABEL_MAX_CHARS,
  CORRECTION_PROBLEM_DESCRIPTION_MAX_CHARS,
  CORRECTION_PROPOSED_VALUE_MAX_CHARS,
  CORRECTION_SNAPSHOT_FIELD_MAX_CHARS,
  areCorrectionDraftsEqual,
  cloneCorrectionDraft,
  compareCorrectionDraftsForExport,
  countUnicodeCharacters,
  hasDisallowedControlCharacters,
  isCorrectionIssueType,
  isValidCanonicalContentSha256,
  isValidCorrectionIsoTimestamp,
  parseCorrectionDraft,
  validateCorrectionDraftForWrite,
  type CorrectionDraftV1,
  type CorrectionIssueType,
  type CorrectionTarget,
} from "./correction_draft_types";

const HASH =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const TS = "2026-07-31T18:00:00.000Z";
const TS_LATER = "2026-07-31T19:00:00.000Z";

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
    problem_description: "The headword spelling looks wrong.",
    created_at: TS,
    updated_at: TS,
    status: "draft",
    ...overrides,
  };
}

function repeatCodePoint(ch: string, n: number): string {
  return Array.from({ length: n }, () => ch).join("");
}

describe("issue taxonomy", () => {
  it("exposes exactly the locked issue types", () => {
    expect([...CORRECTION_ISSUE_TYPES]).toEqual([
      "spelling",
      "translation_or_gloss",
      "part_of_speech",
      "nko",
      "example",
      "usage_or_context",
      "missing_information",
      "duplicate_or_wrong_sense",
      "other",
    ]);
    for (const issue of CORRECTION_ISSUE_TYPES) {
      expect(isCorrectionIssueType(issue)).toBe(true);
      const parsed = parseCorrectionDraft(makeDraft({ issue_type: issue }));
      expect(parsed.ok).toBe(true);
    }
    expect(isCorrectionIssueType("typo")).toBe(false);
  });
});

describe("valid drafts", () => {
  it("accepts problem report without proposed value", () => {
    const parsed = parseCorrectionDraft(makeDraft());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.draft.proposed_value).toBeUndefined();
  });

  it("accepts proposed correction with proposed value", () => {
    const parsed = parseCorrectionDraft(
      makeDraft({
        mode: "proposed_correction",
        proposed_value: "kún",
      }),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.draft.proposed_value).toBe("kún");
  });

  it("accepts each target variant, zero indices, and multi sense/example", () => {
    const targets: CorrectionTarget[] = [
      { type: "entry" },
      { type: "headword" },
      { type: "part_of_speech" },
      { type: "nko" },
      { type: "sense", sense_index: 0 },
      { type: "sense", sense_index: 3 },
      { type: "translation", sense_index: 0, gloss_lang: "fr" },
      { type: "translation", sense_index: 1, gloss_lang: "en" },
      { type: "example", sense_index: 0, example_index: 0 },
      { type: "example", sense_index: 2, example_index: 4 },
      { type: "usage_note", sense_index: 0 },
      { type: "other_field", field_label: "etymology" },
    ];
    for (const target of targets) {
      const parsed = parseCorrectionDraft(makeDraft({ target }));
      expect(parsed.ok).toBe(true);
    }
  });

  it("preserves N’Ko, combining diacritics, and multiline text", () => {
    const parsed = parseCorrectionDraft(
      makeDraft({
        issue_type: "nko",
        target: { type: "nko" },
        display_snapshot: {
          headword_latin: "kùn",
          headword_nko: "ߞߎ߲",
          selected_text: "á + è",
        },
        problem_description: "Line one\nLine two\r\nN’Ko: ߞߎ߲",
        mode: "proposed_correction",
        proposed_value: "ߞߎ߲\nsecond",
      }),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.draft.display_snapshot.headword_nko).toBe("ߞߎ߲");
    expect(parsed.draft.problem_description).toContain("\n");
    expect(parsed.draft.proposed_value).toBe("ߞߎ߲\nsecond");
  });

  it("accepts all optional snapshot fields", () => {
    const parsed = parseCorrectionDraft(
      makeDraft({
        display_snapshot: {
          headword_latin: "kùn",
          headword_nko: "ߞߎ߲",
          part_of_speech: "n",
          selected_text: "sense text",
          selected_gloss: "gloss",
          selected_example: "example",
          target_language_form: "kùn",
          source_language_text: "tête",
        },
      }),
    );
    expect(parsed.ok).toBe(true);
  });

  it("allows updated timestamp equal or later than created", () => {
    expect(parseCorrectionDraft(makeDraft({ created_at: TS, updated_at: TS })).ok).toBe(true);
    expect(
      parseCorrectionDraft(makeDraft({ created_at: TS, updated_at: TS_LATER })).ok,
    ).toBe(true);
  });

  it("preserves Russian translation target structurally without product expansion", () => {
    const parsed = parseCorrectionDraft(
      makeDraft({
        target: { type: "translation", sense_index: 0, gloss_lang: "ru" },
        display_snapshot: {
          headword_latin: "kùn",
          selected_gloss: "голова",
        },
      }),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.draft.target).toEqual({
      type: "translation",
      sense_index: 0,
      gloss_lang: "ru",
    });
  });
});

describe("invalid draft shape", () => {
  it("rejects null, array, and primitives", () => {
    expect(parseCorrectionDraft(null).ok).toBe(false);
    expect(parseCorrectionDraft([]).ok).toBe(false);
    expect(parseCorrectionDraft("x").ok).toBe(false);
    expect(parseCorrectionDraft(1).ok).toBe(false);
  });

  it("rejects unknown fields, wrong schema, and identity/provenance failures", () => {
    expect(parseCorrectionDraft({ ...makeDraft(), extra: true }).ok).toBe(false);
    expect(
      parseCorrectionDraft({ ...makeDraft(), schema_version: "correction_draft_v0" }).ok,
    ).toBe(false);
    expect(parseCorrectionDraft(makeDraft({ draft_id: "" })).ok).toBe(false);
    expect(parseCorrectionDraft(makeDraft({ bundle_id: "" })).ok).toBe(false);
    expect(parseCorrectionDraft(makeDraft({ ir_id: "" })).ok).toBe(false);
    expect(
      parseCorrectionDraft({ ...makeDraft(), ir_kind: "index_mapping" }).ok,
    ).toBe(false);
    expect(parseCorrectionDraft(makeDraft({ content_sha256: "not-a-hash" })).ok).toBe(false);
    expect(parseCorrectionDraft(makeDraft({ storage_scope_id: "" })).ok).toBe(false);
    expect(
      parseCorrectionDraft(makeDraft({ issue_type: "typo" as CorrectionIssueType })).ok,
    ).toBe(false);
    expect(parseCorrectionDraft({ ...makeDraft(), mode: "submit" }).ok).toBe(false);
    expect(parseCorrectionDraft({ ...makeDraft(), status: "submitted" }).ok).toBe(false);
  });

  it("rejects missing/malformed target, snapshot, description, and timestamps", () => {
    const base = makeDraft();
    const { target: _t, ...noTarget } = base;
    expect(parseCorrectionDraft(noTarget).ok).toBe(false);
    expect(
      parseCorrectionDraft(makeDraft({ display_snapshot: { headword_latin: "" } })).ok,
    ).toBe(false);
    expect(parseCorrectionDraft(makeDraft({ problem_description: "" })).ok).toBe(false);
    expect(parseCorrectionDraft(makeDraft({ problem_description: "   " })).ok).toBe(false);
    expect(parseCorrectionDraft(makeDraft({ created_at: "yesterday" })).ok).toBe(false);
    expect(
      parseCorrectionDraft(makeDraft({ created_at: "2026-07-31T18:00:00+00:00" })).ok,
    ).toBe(false);
    expect(
      parseCorrectionDraft(makeDraft({ created_at: TS_LATER, updated_at: TS })).ok,
    ).toBe(false);
  });
});

describe("mode rules", () => {
  it("accepts problem report with absent or valid proposed value", () => {
    expect(parseCorrectionDraft(makeDraft()).ok).toBe(true);
    expect(
      parseCorrectionDraft(
        makeDraft({ mode: "problem_report", proposed_value: "optional note" }),
      ).ok,
    ).toBe(true);
  });

  it("rejects empty present proposed value on problem report", () => {
    expect(
      parseCorrectionDraft(makeDraft({ mode: "problem_report", proposed_value: "" })).ok,
    ).toBe(false);
    expect(
      parseCorrectionDraft(makeDraft({ mode: "problem_report", proposed_value: "   " })).ok,
    ).toBe(false);
  });

  it("requires non-empty proposed value for proposed_correction", () => {
    expect(
      parseCorrectionDraft(makeDraft({ mode: "proposed_correction" })).ok,
    ).toBe(false);
    expect(
      parseCorrectionDraft(
        makeDraft({ mode: "proposed_correction", proposed_value: "   " }),
      ).ok,
    ).toBe(false);
    expect(
      parseCorrectionDraft(
        makeDraft({
          mode: "proposed_correction",
          proposed_value: "line1\nline2",
        }),
      ).ok,
    ).toBe(true);
  });
});

describe("target strictness", () => {
  it("rejects extra fields and invalid indices/languages", () => {
    expect(
      parseCorrectionDraft(
        makeDraft({
          target: { type: "sense", sense_index: 0, example_index: 1 } as CorrectionTarget,
        }),
      ).ok,
    ).toBe(false);
    expect(
      parseCorrectionDraft(
        makeDraft({
          target: {
            type: "translation",
            sense_index: 0,
            gloss_lang: "mnk",
          } as unknown as CorrectionTarget,
        }),
      ).ok,
    ).toBe(false);
    expect(
      parseCorrectionDraft(
        makeDraft({ target: { type: "sense", sense_index: -1 } }),
      ).ok,
    ).toBe(false);
    expect(
      parseCorrectionDraft(
        makeDraft({ target: { type: "sense", sense_index: 1.5 } }),
      ).ok,
    ).toBe(false);
    expect(
      parseCorrectionDraft(
        makeDraft({
          target: { type: "sense", sense_index: Number.MAX_SAFE_INTEGER + 1 },
        }),
      ).ok,
    ).toBe(false);
    expect(
      parseCorrectionDraft(
        makeDraft({
          target: { type: "sense", sense_index: "0" as unknown as number },
        }),
      ).ok,
    ).toBe(false);
    expect(
      parseCorrectionDraft(
        makeDraft({
          target: {
            type: "other_field",
            field_label: repeatCodePoint("a", CORRECTION_OTHER_FIELD_LABEL_MAX_CHARS + 1),
          },
        }),
      ).ok,
    ).toBe(false);
    expect(
      parseCorrectionDraft(
        makeDraft({
          target: { type: "other_field", field_label: "bad\u0000label" },
        }),
      ).ok,
    ).toBe(false);
  });

  it("allows multiple drafts against the same dictionary entry", () => {
    const a = makeDraft({ draft_id: "d1", issue_type: "spelling" });
    const b = makeDraft({ draft_id: "d2", issue_type: "example", target: { type: "example", sense_index: 0, example_index: 0 } });
    expect(parseCorrectionDraft(a).ok).toBe(true);
    expect(parseCorrectionDraft(b).ok).toBe(true);
    expect(a.bundle_id).toBe(b.bundle_id);
    expect(a.ir_id).toBe(b.ir_id);
  });
});

describe("text limits and unicode counting", () => {
  it("counts Unicode code points, not UTF-16 units", () => {
    expect(countUnicodeCharacters("a")).toBe(1);
    expect(countUnicodeCharacters("𐍈")).toBe(1); // astral
    expect("𐍈".length).toBe(2);
  });

  it("enforces exact boundaries for description, proposed value, label, snapshot", () => {
    const descOk = repeatCodePoint("é", CORRECTION_PROBLEM_DESCRIPTION_MAX_CHARS);
    const descBad = repeatCodePoint("é", CORRECTION_PROBLEM_DESCRIPTION_MAX_CHARS + 1);
    expect(parseCorrectionDraft(makeDraft({ problem_description: descOk })).ok).toBe(true);
    expect(parseCorrectionDraft(makeDraft({ problem_description: descBad })).ok).toBe(false);

    const propOk = repeatCodePoint("𐍈", CORRECTION_PROPOSED_VALUE_MAX_CHARS);
    const propBad = repeatCodePoint("𐍈", CORRECTION_PROPOSED_VALUE_MAX_CHARS + 1);
    expect(
      parseCorrectionDraft(
        makeDraft({ mode: "proposed_correction", proposed_value: propOk }),
      ).ok,
    ).toBe(true);
    expect(
      parseCorrectionDraft(
        makeDraft({ mode: "proposed_correction", proposed_value: propBad }),
      ).ok,
    ).toBe(false);

    const labelOk = repeatCodePoint("a", CORRECTION_OTHER_FIELD_LABEL_MAX_CHARS);
    const labelBad = repeatCodePoint("a", CORRECTION_OTHER_FIELD_LABEL_MAX_CHARS + 1);
    expect(
      parseCorrectionDraft(
        makeDraft({ target: { type: "other_field", field_label: labelOk } }),
      ).ok,
    ).toBe(true);
    expect(
      parseCorrectionDraft(
        makeDraft({ target: { type: "other_field", field_label: labelBad } }),
      ).ok,
    ).toBe(false);

    const snapOk = repeatCodePoint("x", CORRECTION_SNAPSHOT_FIELD_MAX_CHARS);
    const snapBad = repeatCodePoint("x", CORRECTION_SNAPSHOT_FIELD_MAX_CHARS + 1);
    expect(
      parseCorrectionDraft(makeDraft({ display_snapshot: { headword_latin: snapOk } })).ok,
    ).toBe(true);
    expect(
      parseCorrectionDraft(makeDraft({ display_snapshot: { headword_latin: snapBad } })).ok,
    ).toBe(false);
  });
});

describe("control characters", () => {
  it("accepts newline, CR/LF, N’Ko, and combining marks", () => {
    expect(hasDisallowedControlCharacters("a\nb")).toBe(false);
    expect(hasDisallowedControlCharacters("a\r\nb")).toBe(false);
    expect(hasDisallowedControlCharacters("ߞߎ߲")).toBe(false);
    expect(hasDisallowedControlCharacters("e\u0301")).toBe(false);
  });

  it("rejects null byte, disallowed C0, DEL, and isolated surrogate", () => {
    expect(hasDisallowedControlCharacters("a\u0000b")).toBe(true);
    expect(hasDisallowedControlCharacters("a\u0007b")).toBe(true);
    expect(hasDisallowedControlCharacters("a\u007fb")).toBe(true);
    expect(hasDisallowedControlCharacters("a\uD800b")).toBe(true);
    expect(
      parseCorrectionDraft(makeDraft({ problem_description: "bad\u0000text" })).ok,
    ).toBe(false);
  });
});

describe("cloning, equality, ordering, and write assert", () => {
  it("clones without shared nested references and without normalizing text", () => {
    const original = makeDraft({
      target: { type: "example", sense_index: 1, example_index: 2 },
      display_snapshot: { headword_latin: "kùn", selected_example: "ex" },
      proposed_value: undefined,
    });
    const cloned = cloneCorrectionDraft(original);
    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
    expect(cloned.target).not.toBe(original.target);
    expect(cloned.display_snapshot).not.toBe(original.display_snapshot);
    (cloned.target as { sense_index?: number }).sense_index = 99;
    expect((original.target as { sense_index?: number }).sense_index).toBe(1);
  });

  it("compares supported fields exactly", () => {
    const a = makeDraft();
    const b = cloneCorrectionDraft(a);
    expect(areCorrectionDraftsEqual(a, b)).toBe(true);
    expect(areCorrectionDraftsEqual(a, makeDraft({ problem_description: "other" }))).toBe(
      false,
    );
  });

  it("orders by bundle_id, ir_id, created_at, draft_id without localeCompare", () => {
    const a = makeDraft({
      draft_id: "b",
      bundle_id: "bundle_a",
      ir_id: "lex-1",
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
      bundle_id: "bundle_a",
      ir_id: "lex-0",
      created_at: TS,
    });
    const d = makeDraft({
      draft_id: "d",
      bundle_id: "bundle_b",
      ir_id: "lex-1",
      created_at: TS,
    });
    const sorted = [d, a, b, c].sort(compareCorrectionDraftsForExport);
    expect(sorted.map((x) => x.draft_id)).toEqual(["c", "a", "b", "d"]);
  });

  it("validateCorrectionDraftForWrite throws without leaking vocabulary", () => {
    expect(() => validateCorrectionDraftForWrite(makeDraft())).not.toThrow();
    expect(() => validateCorrectionDraftForWrite({ bad: true })).toThrow(
      /unknown_field|invalid/,
    );
  });
});

describe("helpers", () => {
  it("validates hash and timestamp shapes", () => {
    expect(isValidCanonicalContentSha256(HASH)).toBe(true);
    expect(isValidCanonicalContentSha256("sha256:abc")).toBe(true);
    expect(isValidCanonicalContentSha256("abc")).toBe(false);
    expect(isValidCorrectionIsoTimestamp(TS)).toBe(true);
    expect(isValidCorrectionIsoTimestamp("2026-07-31T18:00:00+00:00")).toBe(false);
  });

  it("errors omit user vocabulary", () => {
    const secret = "SECRET_HEADWORD_VOCAB";
    const parsed = parseCorrectionDraft(
      makeDraft({
        problem_description: secret,
        display_snapshot: { headword_latin: secret },
        issue_type: "not-real" as CorrectionIssueType,
      }),
    );
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    const blob = JSON.stringify(parsed.errors);
    expect(blob).not.toContain(secret);
  });
});
