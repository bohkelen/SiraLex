import { describe, expect, it } from "vitest";

import type { ActiveBundleMeta } from "../idb/siralex_db";
import type { EnrichedRecord } from "../types/records";
import {
  CORRECTION_SNAPSHOT_FIELD_MAX_CHARS,
  countUnicodeCharacters,
} from "./correction_draft_types";
import {
  boundCorrectionSnapshotText,
  buildCorrectionDisplaySnapshot,
  buildCorrectionEntryContext,
  buildCorrectionTargetOptions,
  canOfferCorrectionSuggestion,
  correctionFormFieldsForMode,
  createInitialCorrectionFormFields,
  resolveCorrectionTargetOption,
  validateCorrectionFormFields,
} from "./correction_form_model";

const HASH =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function meta(overrides: Partial<ActiveBundleMeta> = {}): ActiveBundleMeta {
  return {
    bundle_id: "bundle_a",
    storage_scope_id: `bundle_a::${HASH}`,
    manifest_schema_version: "1",
    record_schema_id: "enriched_record_v1",
    record_schema_version: "1",
    normalization_ruleset: "norm_v3",
    update_mode: "replace",
    reconciliation_action: "none",
    expected_content_sha256: HASH,
    imported_at_iso: "2026-07-31T18:00:00.000Z",
    ...overrides,
  };
}

function lexicon(overrides: Partial<EnrichedRecord> = {}): EnrichedRecord {
  return {
    ir_id: "lex-1",
    ir_kind: "lexicon_entry",
    source_id: "src",
    norm_version: "n",
    preferred_form: "kùn",
    variant_forms: [],
    search_keys: {},
    display: {
      headword_latin: "kùn",
      headword_nko_provided: "ߞߎ߲",
      ps_raw: "n",
      senses: [
        {
          gloss_fr: "tête",
          gloss_en: "head",
          gloss_ru: "голова",
          usage_note: "body part",
          examples: [{ text_latin: "a kùn", trans_fr: "sa tête" }],
        },
        {
          gloss_fr: "sommet",
        },
      ],
    },
    ...overrides,
  };
}

describe("correction form model — context", () => {
  it("accepts genuine lexicon context and clones entry", () => {
    const entry = lexicon();
    const ctx = buildCorrectionEntryContext(entry, meta());
    expect(ctx).not.toBeNull();
    expect(ctx!.ir_kind).toBe("lexicon_entry");
    expect(ctx!.content_sha256).toBe(HASH);
    expect(ctx!.storage_scope_id).toBe(`bundle_a::${HASH}`);
    expect(ctx!.entry).not.toBe(entry);
    expect(ctx!.entry.display).not.toBe(entry.display);
  });

  it("rejects index_mapping and incomplete provenance", () => {
    const index: EnrichedRecord = {
      ...lexicon(),
      ir_kind: "index_mapping",
      display: { source_term: "x", source_lang: "fr" },
    };
    expect(buildCorrectionEntryContext(index, meta())).toBeNull();
    expect(canOfferCorrectionSuggestion(lexicon(), undefined)).toBe(false);
    expect(
      buildCorrectionEntryContext(lexicon(), meta({ expected_content_sha256: "sha256:abc" })),
    ).toBeNull();
  });
});

describe("correction form model — targets", () => {
  it("builds options from live entry structure only", () => {
    const options = buildCorrectionTargetOptions(lexicon());
    const keys = options.map((o) => o.key);
    expect(keys).toContain("entry");
    expect(keys).toContain("headword");
    expect(keys).toContain("part_of_speech");
    expect(keys).toContain("nko");
    expect(keys).toContain("sense:0");
    expect(keys).toContain("sense:1");
    expect(keys).toContain("translation:0:fr");
    expect(keys).toContain("translation:0:en");
    // RL1: live gloss_ru remains on the record but is not a new-capture target.
    expect(keys).not.toContain("translation:0:ru");
    expect(keys).toContain("example:0:0");
    expect(keys).toContain("usage_note:0");
    expect(keys).toContain("other_field");
    expect(keys).not.toContain("translation:1:en");
    expect(keys).not.toContain("usage_note:1");
  });

  it("RL1 never offers Russian meaning as a new consumer target", () => {
    const options = buildCorrectionTargetOptions(lexicon());
    expect(options.some((o) => o.key === "translation:0:ru")).toBe(false);
    expect(
      options.every(
        (o) => o.target.type !== "translation" || o.target.gloss_lang !== "ru",
      ),
    ).toBe(true);
    // Underlying record still carries Russian source data.
    const sense0 = (lexicon().display as { senses: { gloss_ru?: string }[] }).senses[0];
    expect(sense0?.gloss_ru).toBe("голова");
  });

  it("omits POS/N’Ko/EN when absent", () => {
    const entry = lexicon({
      display: {
        headword_latin: "x",
        senses: [{ gloss_fr: "y" }],
      },
    });
    const keys = buildCorrectionTargetOptions(entry).map((o) => o.key);
    expect(keys).not.toContain("part_of_speech");
    expect(keys).not.toContain("nko");
    expect(keys).not.toContain("translation:0:ru");
    expect(keys).not.toContain("translation:0:en");
  });

  it("maps option keys strictly to preconstructed options", () => {
    const options = buildCorrectionTargetOptions(lexicon());
    expect(resolveCorrectionTargetOption("sense:0", options)?.target).toEqual({
      type: "sense",
      sense_index: 0,
    });
    expect(resolveCorrectionTargetOption("sense:99", options)).toBeUndefined();
    expect(resolveCorrectionTargetOption("translation:0:de", options)).toBeUndefined();
  });
});

describe("correction form model — snapshot", () => {
  it("builds bounded target-relevant snapshots and preserves Unicode", () => {
    const entry = lexicon();
    const head = buildCorrectionDisplaySnapshot(entry, { type: "headword" });
    expect(head.headword_latin).toBe("kùn");
    expect(head.headword_nko).toBe("ߞߎ߲");
    expect(JSON.stringify(head).includes("senses")).toBe(false);

    const gloss = buildCorrectionDisplaySnapshot(entry, {
      type: "translation",
      sense_index: 0,
      gloss_lang: "fr",
    });
    expect(gloss.selected_gloss).toBe("tête");

    const example = buildCorrectionDisplaySnapshot(entry, {
      type: "example",
      sense_index: 0,
      example_index: 0,
    });
    expect(example.selected_example).toBe("a kùn");
  });

  it("truncates oversized live content deterministically", () => {
    const long = "a".repeat(CORRECTION_SNAPSHOT_FIELD_MAX_CHARS + 50);
    const truncated = boundCorrectionSnapshotText(long, CORRECTION_SNAPSHOT_FIELD_MAX_CHARS);
    expect(countUnicodeCharacters(truncated)).toBe(CORRECTION_SNAPSHOT_FIELD_MAX_CHARS);
    expect(truncated.endsWith("…")).toBe(true);

    const entry = lexicon({
      display: { headword_latin: long, senses: [{ gloss_fr: long }] },
    });
    const snap = buildCorrectionDisplaySnapshot(entry, {
      type: "translation",
      sense_index: 0,
      gloss_lang: "fr",
    });
    expect(countUnicodeCharacters(snap.headword_latin)).toBe(CORRECTION_SNAPSHOT_FIELD_MAX_CHARS);
    expect(countUnicodeCharacters(snap.selected_gloss!)).toBe(CORRECTION_SNAPSHOT_FIELD_MAX_CHARS);
  });
});

describe("correction form model — validation", () => {
  it("validates fields, Unicode counters, and mode/proposed rules", () => {
    const ctx = buildCorrectionEntryContext(lexicon(), meta())!;
    const options = buildCorrectionTargetOptions(ctx.entry);
    const empty = validateCorrectionFormFields(createInitialCorrectionFormFields(), ctx, options);
    expect(empty.ok).toBe(false);
    if (empty.ok) return;
    expect(empty.errors.issue_type).toBe("required");
    expect(empty.errors.problem_description).toBe("required");

    const fields = createInitialCorrectionFormFields();
    fields.issue_type = "spelling";
    fields.target_key = "translation:0:fr";
    fields.problem_description = "  bad gloss  ";
    fields.mode = "proposed_correction";
    fields.proposed_value = "";
    const missingProposed = validateCorrectionFormFields(fields, ctx, options);
    expect(missingProposed.ok).toBe(false);

    fields.proposed_value = "tête corrigée";
    const ok = validateCorrectionFormFields(fields, ctx, options);
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect(ok.input.problem_description).toBe("  bad gloss  ");
    expect(ok.input.proposed_value).toBe("tête corrigée");
    expect(ok.target).toEqual({
      type: "translation",
      sense_index: 0,
      gloss_lang: "fr",
    });

    const cleared = correctionFormFieldsForMode(fields, "problem_report");
    expect(cleared.proposed_value).toBe("");
    const report = validateCorrectionFormFields(cleared, ctx, options);
    expect(report.ok).toBe(true);
    if (!report.ok) return;
    expect(report.input.proposed_value).toBeUndefined();
  });

  it("requires other-field label and rejects over-limit description", () => {
    const ctx = buildCorrectionEntryContext(lexicon(), meta())!;
    const options = buildCorrectionTargetOptions(ctx.entry);
    const fields = createInitialCorrectionFormFields();
    fields.issue_type = "other";
    fields.target_key = "other_field";
    fields.problem_description = "x";
    expect(validateCorrectionFormFields(fields, ctx, options).ok).toBe(false);
    fields.other_field_label = "etymology";
    expect(validateCorrectionFormFields(fields, ctx, options).ok).toBe(true);
    fields.problem_description = "x".repeat(2001);
    const tooLong = validateCorrectionFormFields(fields, ctx, options);
    expect(tooLong.ok).toBe(false);
    if (tooLong.ok) return;
    expect(tooLong.errors.problem_description).toBe("too_long");
  });
});
