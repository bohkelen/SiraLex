/**
 * CF1I3 — Correction suggestion form model (pure).
 *
 * Builds target options, display snapshots, and form-level validation.
 * No IndexedDB, clock, DOM, network, or dictionary mutation.
 */

import type { ActiveBundleMeta } from "../idb/siralex_db";
import { getBundleStorageScopeId } from "../idb/siralex_db";
import type { EnrichedRecord, ExampleRaw, LexiconDisplayFields, SenseRaw } from "../types/records";
import { isLexiconDisplay } from "../types/records";
import {
  CORRECTION_ISSUE_TYPES,
  CORRECTION_OTHER_FIELD_LABEL_MAX_CHARS,
  CORRECTION_PROBLEM_DESCRIPTION_MAX_CHARS,
  CORRECTION_PROPOSED_VALUE_MAX_CHARS,
  CORRECTION_SNAPSHOT_FIELD_MAX_CHARS,
  cloneCorrectionDisplaySnapshot,
  cloneCorrectionTarget,
  countUnicodeCharacters,
  hasDisallowedControlCharacters,
  isCorrectionIssueType,
  isCorrectionMode,
  isValidCanonicalContentSha256,
  type CorrectionDisplaySnapshot,
  type CorrectionIssueType,
  type CorrectionMode,
  type CorrectionTarget,
} from "./correction_draft_types";
import type { CreateCorrectionDraftInput } from "./correction_draft_store";

export type CorrectionEntryContext = {
  bundle_id: string;
  ir_id: string;
  ir_kind: "lexicon_entry";
  content_sha256: string;
  storage_scope_id: string;
  entry: EnrichedRecord;
};

export type CorrectionTargetOptionLabel =
  | { kind: "entry" }
  | { kind: "headword"; headword: string }
  | { kind: "part_of_speech"; pos: string }
  | { kind: "nko"; nko: string }
  | { kind: "sense"; senseNumber: number }
  | {
      kind: "translation";
      senseNumber: number;
      gloss_lang: "fr" | "en" | "ru";
      gloss: string;
    }
  | {
      kind: "example";
      senseNumber: number;
      exampleNumber: number;
      text: string;
    }
  | { kind: "usage_note"; senseNumber: number }
  | { kind: "other_field" };

export type CorrectionTargetOption = {
  key: string;
  target: CorrectionTarget;
  label: CorrectionTargetOptionLabel;
  previewText?: string;
};

export type CorrectionFormFieldErrors = {
  issue_type?: "required";
  target?: "required" | "invalid";
  problem_description?: "required" | "too_long" | "invalid_chars";
  proposed_value?: "required" | "too_long" | "invalid_chars";
  field_label?: "required" | "too_long" | "invalid_chars";
};

export type CorrectionFormErrorCode =
  | "entry_context_changed"
  | "invalid_fields"
  | "invalid_timestamp"
  | "id_generation_failed"
  | "draft_id_conflict"
  | "database_write_failed"
  | "invalid_input";

export type CorrectionFormFields = {
  issue_type: CorrectionIssueType | "";
  target_key: string;
  mode: CorrectionMode;
  problem_description: string;
  proposed_value: string;
  other_field_label: string;
};

export type CorrectionFormViewModel = {
  state: "ready" | "saving" | "saved" | "invalid" | "stale_context" | "error";
  context: CorrectionEntryContext;
  fields: CorrectionFormFields;
  targetOptions: CorrectionTargetOption[];
  selectedTarget?: CorrectionTarget;
  displaySnapshot?: CorrectionDisplaySnapshot;
  targetPreview?: string;
  errors: CorrectionFormFieldErrors;
  errorCode?: CorrectionFormErrorCode;
  draft_id?: string;
  descriptionCount: number;
  proposedCount: number;
  fieldLabelCount: number;
  saveDisabled: boolean;
  busy: boolean;
};

const TARGET_LABEL_PREVIEW_MAX = 80;

function cloneLexiconEntry(entry: EnrichedRecord): EnrichedRecord {
  return structuredClone(entry);
}

function lexiconDisplay(entry: EnrichedRecord): LexiconDisplayFields | undefined {
  return isLexiconDisplay(entry) ? entry.display : undefined;
}

function posText(d: LexiconDisplayFields): string | undefined {
  const value = d.pos_hint ?? d.ps_raw;
  if (typeof value !== "string" || value.trim() === "") return undefined;
  return value;
}

function boundPreview(value: string): string {
  return boundCorrectionSnapshotText(value, TARGET_LABEL_PREVIEW_MAX);
}

/**
 * Deterministic Unicode-code-point truncation for snapshot evidence only.
 * Does not mutate dictionary content. Does not apply to user-authored fields.
 */
export function boundCorrectionSnapshotText(value: string, maxChars: number): string {
  if (!Number.isInteger(maxChars) || maxChars < 0) return "";
  const chars = Array.from(value);
  if (chars.length <= maxChars) return value;
  if (maxChars === 0) return "";
  if (maxChars === 1) return "…";
  return `${chars.slice(0, maxChars - 1).join("")}…`;
}

export function buildCorrectionEntryContext(
  entry: EnrichedRecord,
  activeMeta: ActiveBundleMeta,
): CorrectionEntryContext | null {
  if (entry.ir_kind !== "lexicon_entry") return null;
  if (!isLexiconDisplay(entry)) return null;
  if (typeof entry.ir_id !== "string" || entry.ir_id.trim() === "") return null;
  if (typeof activeMeta.bundle_id !== "string" || activeMeta.bundle_id.trim() === "") return null;

  const contentSha = activeMeta.expected_content_sha256;
  if (!isValidCanonicalContentSha256(contentSha)) return null;

  const storageScopeId = getBundleStorageScopeId(activeMeta);
  if (typeof storageScopeId !== "string" || storageScopeId.trim() === "") return null;

  return {
    bundle_id: activeMeta.bundle_id,
    ir_id: entry.ir_id,
    ir_kind: "lexicon_entry",
    content_sha256: contentSha,
    storage_scope_id: storageScopeId,
    entry: cloneLexiconEntry(entry),
  };
}

export function canOfferCorrectionSuggestion(
  entry: EnrichedRecord,
  activeMeta: ActiveBundleMeta | undefined,
): boolean {
  if (!activeMeta) return false;
  return buildCorrectionEntryContext(entry, activeMeta) != null;
}

export function encodeCorrectionTargetOptionKey(target: CorrectionTarget): string {
  switch (target.type) {
    case "entry":
      return "entry";
    case "headword":
      return "headword";
    case "part_of_speech":
      return "part_of_speech";
    case "nko":
      return "nko";
    case "sense":
      return `sense:${target.sense_index}`;
    case "translation":
      return `translation:${target.sense_index}:${target.gloss_lang}`;
    case "example":
      return `example:${target.sense_index}:${target.example_index}`;
    case "usage_note":
      return `usage_note:${target.sense_index}`;
    case "other_field":
      return "other_field";
  }
}

export function buildCorrectionTargetOptions(entry: EnrichedRecord): CorrectionTargetOption[] {
  const d = lexiconDisplay(entry);
  if (!d) return [];

  const options: CorrectionTargetOption[] = [
    {
      key: "entry",
      target: { type: "entry" },
      label: { kind: "entry" },
      previewText: boundPreview(d.headword_latin),
    },
    {
      key: "headword",
      target: { type: "headword" },
      label: { kind: "headword", headword: boundPreview(d.headword_latin) },
      previewText: boundPreview(d.headword_latin),
    },
  ];

  const pos = posText(d);
  if (pos) {
    options.push({
      key: "part_of_speech",
      target: { type: "part_of_speech" },
      label: { kind: "part_of_speech", pos: boundPreview(pos) },
      previewText: boundPreview(pos),
    });
  }

  if (d.headword_nko_provided && d.headword_nko_provided.trim() !== "") {
    options.push({
      key: "nko",
      target: { type: "nko" },
      label: { kind: "nko", nko: boundPreview(d.headword_nko_provided) },
      previewText: boundPreview(d.headword_nko_provided),
    });
  }

  const senses = d.senses ?? [];
  senses.forEach((sense, senseIndex) => {
    const senseNumber = senseIndex + 1;
    options.push({
      key: `sense:${senseIndex}`,
      target: { type: "sense", sense_index: senseIndex },
      label: { kind: "sense", senseNumber },
    });

    if (typeof sense.gloss_fr === "string" && sense.gloss_fr.trim() !== "") {
      options.push({
        key: `translation:${senseIndex}:fr`,
        target: { type: "translation", sense_index: senseIndex, gloss_lang: "fr" },
        label: {
          kind: "translation",
          senseNumber,
          gloss_lang: "fr",
          gloss: boundPreview(sense.gloss_fr),
        },
        previewText: boundPreview(sense.gloss_fr),
      });
    }
    if (typeof sense.gloss_en === "string" && sense.gloss_en.trim() !== "") {
      options.push({
        key: `translation:${senseIndex}:en`,
        target: { type: "translation", sense_index: senseIndex, gloss_lang: "en" },
        label: {
          kind: "translation",
          senseNumber,
          gloss_lang: "en",
          gloss: boundPreview(sense.gloss_en),
        },
        previewText: boundPreview(sense.gloss_en),
      });
    }
    if (typeof sense.gloss_ru === "string" && sense.gloss_ru.trim() !== "") {
      options.push({
        key: `translation:${senseIndex}:ru`,
        target: { type: "translation", sense_index: senseIndex, gloss_lang: "ru" },
        label: {
          kind: "translation",
          senseNumber,
          gloss_lang: "ru",
          gloss: boundPreview(sense.gloss_ru),
        },
        previewText: boundPreview(sense.gloss_ru),
      });
    }

    const examples = sense.examples ?? [];
    examples.forEach((example, exampleIndex) => {
      const text = exampleText(example);
      options.push({
        key: `example:${senseIndex}:${exampleIndex}`,
        target: {
          type: "example",
          sense_index: senseIndex,
          example_index: exampleIndex,
        },
        label: {
          kind: "example",
          senseNumber,
          exampleNumber: exampleIndex + 1,
          text: boundPreview(text),
        },
        previewText: boundPreview(text),
      });
    });

    if (typeof sense.usage_note === "string" && sense.usage_note.trim() !== "") {
      options.push({
        key: `usage_note:${senseIndex}`,
        target: { type: "usage_note", sense_index: senseIndex },
        label: { kind: "usage_note", senseNumber },
        previewText: boundPreview(sense.usage_note),
      });
    }
  });

  options.push({
    key: "other_field",
    target: { type: "other_field", field_label: "" },
    label: { kind: "other_field" },
  });

  return options;
}

function exampleText(example: ExampleRaw): string {
  return example.text_latin;
}

/**
 * Map a structural option key to a preconstructed option only.
 * Does not invent targets from arbitrary string decomposition.
 */
export function resolveCorrectionTargetOption(
  key: string,
  options: readonly CorrectionTargetOption[],
): CorrectionTargetOption | undefined {
  if (typeof key !== "string" || key.trim() === "") return undefined;
  return options.find((option) => option.key === key);
}

function senseAt(entry: EnrichedRecord, index: number): SenseRaw | undefined {
  const senses = lexiconDisplay(entry)?.senses;
  if (!senses || index < 0 || index >= senses.length) return undefined;
  return senses[index];
}

export function buildCorrectionDisplaySnapshot(
  entry: EnrichedRecord,
  target: CorrectionTarget,
): CorrectionDisplaySnapshot {
  const d = lexiconDisplay(entry);
  if (!d) {
    return { headword_latin: boundCorrectionSnapshotText("", CORRECTION_SNAPSHOT_FIELD_MAX_CHARS) };
  }

  const headword = boundCorrectionSnapshotText(d.headword_latin, CORRECTION_SNAPSHOT_FIELD_MAX_CHARS);
  const snapshot: CorrectionDisplaySnapshot = { headword_latin: headword };

  if (d.headword_nko_provided && d.headword_nko_provided.trim() !== "") {
    snapshot.headword_nko = boundCorrectionSnapshotText(
      d.headword_nko_provided,
      CORRECTION_SNAPSHOT_FIELD_MAX_CHARS,
    );
  }

  const pos = posText(d);
  if (pos) {
    snapshot.part_of_speech = boundCorrectionSnapshotText(pos, CORRECTION_SNAPSHOT_FIELD_MAX_CHARS);
  }

  switch (target.type) {
    case "entry":
      // Bounded general context only — do not serialize the whole entry.
      break;
    case "headword":
      break;
    case "part_of_speech":
      break;
    case "nko":
      if (snapshot.headword_nko) {
        snapshot.selected_text = snapshot.headword_nko;
      }
      break;
    case "sense": {
      const sense = senseAt(entry, target.sense_index);
      const gloss = sense?.gloss_fr ?? sense?.gloss_en ?? sense?.gloss_ru;
      if (typeof gloss === "string" && gloss.trim() !== "") {
        snapshot.selected_gloss = boundCorrectionSnapshotText(
          gloss,
          CORRECTION_SNAPSHOT_FIELD_MAX_CHARS,
        );
      }
      break;
    }
    case "translation": {
      const sense = senseAt(entry, target.sense_index);
      const gloss =
        target.gloss_lang === "fr"
          ? sense?.gloss_fr
          : target.gloss_lang === "en"
            ? sense?.gloss_en
            : sense?.gloss_ru;
      if (typeof gloss === "string") {
        snapshot.selected_gloss = boundCorrectionSnapshotText(
          gloss,
          CORRECTION_SNAPSHOT_FIELD_MAX_CHARS,
        );
      }
      if (typeof sense?.gloss_fr === "string" && target.gloss_lang !== "fr") {
        snapshot.source_language_text = boundCorrectionSnapshotText(
          sense.gloss_fr,
          CORRECTION_SNAPSHOT_FIELD_MAX_CHARS,
        );
      }
      break;
    }
    case "example": {
      const sense = senseAt(entry, target.sense_index);
      const example = sense?.examples?.[target.example_index];
      if (example) {
        snapshot.selected_example = boundCorrectionSnapshotText(
          exampleText(example),
          CORRECTION_SNAPSHOT_FIELD_MAX_CHARS,
        );
        const gloss = example.trans_fr ?? example.trans_en ?? example.trans_ru;
        if (typeof gloss === "string" && gloss.trim() !== "") {
          snapshot.selected_gloss = boundCorrectionSnapshotText(
            gloss,
            CORRECTION_SNAPSHOT_FIELD_MAX_CHARS,
          );
        }
      }
      break;
    }
    case "usage_note": {
      const sense = senseAt(entry, target.sense_index);
      if (typeof sense?.usage_note === "string") {
        snapshot.selected_text = boundCorrectionSnapshotText(
          sense.usage_note,
          CORRECTION_SNAPSHOT_FIELD_MAX_CHARS,
        );
      }
      break;
    }
    case "other_field":
      break;
  }

  return snapshot;
}

export function createInitialCorrectionFormFields(): CorrectionFormFields {
  return {
    issue_type: "",
    target_key: "entry",
    mode: "problem_report",
    problem_description: "",
    proposed_value: "",
    other_field_label: "",
  };
}

export function buildTargetForFields(
  fields: CorrectionFormFields,
  options: readonly CorrectionTargetOption[],
): CorrectionTarget | undefined {
  const option = resolveCorrectionTargetOption(fields.target_key, options);
  if (!option) return undefined;
  if (option.target.type === "other_field") {
    return { type: "other_field", field_label: fields.other_field_label };
  }
  return cloneCorrectionTarget(option.target);
}

function validateUserField(
  value: string,
  maxChars: number,
): "required" | "too_long" | "invalid_chars" | undefined {
  if (value.trim() === "") return "required";
  if (countUnicodeCharacters(value) > maxChars) return "too_long";
  if (hasDisallowedControlCharacters(value)) return "invalid_chars";
  return undefined;
}

export type ValidateCorrectionFormResult =
  | {
      ok: true;
      target: CorrectionTarget;
      snapshot: CorrectionDisplaySnapshot;
      input: Omit<
        CreateCorrectionDraftInput,
        "bundle_id" | "ir_id" | "ir_kind" | "content_sha256" | "storage_scope_id"
      >;
    }
  | {
      ok: false;
      errors: CorrectionFormFieldErrors;
    };

/**
 * Form-level validation for user feedback.
 * Store validation remains authoritative before persistence.
 * Preserves exact non-empty user text (trim only for emptiness checks).
 */
export function validateCorrectionFormFields(
  fields: CorrectionFormFields,
  context: CorrectionEntryContext,
  options: readonly CorrectionTargetOption[],
): ValidateCorrectionFormResult {
  const errors: CorrectionFormFieldErrors = {};

  if (!isCorrectionIssueType(fields.issue_type)) {
    errors.issue_type = "required";
  }

  const target = buildTargetForFields(fields, options);
  if (!target) {
    errors.target = "invalid";
  } else if (target.type === "other_field") {
    const labelError = validateUserField(
      fields.other_field_label,
      CORRECTION_OTHER_FIELD_LABEL_MAX_CHARS,
    );
    if (labelError) errors.field_label = labelError;
  }

  const descriptionError = validateUserField(
    fields.problem_description,
    CORRECTION_PROBLEM_DESCRIPTION_MAX_CHARS,
  );
  if (descriptionError) errors.problem_description = descriptionError;

  if (!isCorrectionMode(fields.mode)) {
    // Mode is controlled by UI; treat as invalid proposed path.
    errors.proposed_value = "required";
  } else if (fields.mode === "proposed_correction") {
    const proposedError = validateUserField(
      fields.proposed_value,
      CORRECTION_PROPOSED_VALUE_MAX_CHARS,
    );
    if (proposedError) errors.proposed_value = proposedError;
  }

  if (Object.keys(errors).length > 0 || !target || !isCorrectionIssueType(fields.issue_type)) {
    return { ok: false, errors };
  }

  const snapshot = buildCorrectionDisplaySnapshot(context.entry, target);
  return {
    ok: true,
    target,
    snapshot,
    input: {
      issue_type: fields.issue_type,
      mode: fields.mode,
      target: cloneCorrectionTarget(target),
      display_snapshot: cloneCorrectionDisplaySnapshot(snapshot),
      problem_description: fields.problem_description,
      ...(fields.mode === "proposed_correction"
        ? { proposed_value: fields.proposed_value }
        : {}),
    },
  };
}

export function correctionFormFieldsForMode(
  fields: CorrectionFormFields,
  mode: CorrectionMode,
): CorrectionFormFields {
  if (mode === "problem_report") {
    return { ...fields, mode, proposed_value: "" };
  }
  return { ...fields, mode };
}

export const CORRECTION_FORM_ISSUE_TYPES: readonly CorrectionIssueType[] = CORRECTION_ISSUE_TYPES;

export function areCorrectionContextsEqual(
  a: Pick<
    CorrectionEntryContext,
    "bundle_id" | "ir_id" | "content_sha256" | "storage_scope_id" | "ir_kind"
  >,
  b: Pick<
    CorrectionEntryContext,
    "bundle_id" | "ir_id" | "content_sha256" | "storage_scope_id" | "ir_kind"
  >,
): boolean {
  return (
    a.bundle_id === b.bundle_id &&
    a.ir_id === b.ir_id &&
    a.ir_kind === b.ir_kind &&
    a.content_sha256 === b.content_sha256 &&
    a.storage_scope_id === b.storage_scope_id
  );
}

export function buildCorrectionFormViewModel(args: {
  state: CorrectionFormViewModel["state"];
  context: CorrectionEntryContext;
  fields: CorrectionFormFields;
  errors?: CorrectionFormFieldErrors;
  errorCode?: CorrectionFormErrorCode;
  draft_id?: string;
}): CorrectionFormViewModel {
  const options = buildCorrectionTargetOptions(args.context.entry);
  const target = buildTargetForFields(args.fields, options);
  const snapshot = target
    ? buildCorrectionDisplaySnapshot(args.context.entry, target)
    : undefined;
  const option = resolveCorrectionTargetOption(args.fields.target_key, options);
  const busy = args.state === "saving";
  const stale = args.state === "stale_context";
  const saved = args.state === "saved";

  return {
    state: args.state,
    context: args.context,
    fields: { ...args.fields },
    targetOptions: options,
    selectedTarget: target,
    displaySnapshot: snapshot,
    targetPreview: option?.previewText,
    errors: args.errors ?? {},
    errorCode: args.errorCode,
    draft_id: args.draft_id,
    descriptionCount: countUnicodeCharacters(args.fields.problem_description),
    proposedCount: countUnicodeCharacters(args.fields.proposed_value),
    fieldLabelCount: countUnicodeCharacters(args.fields.other_field_label),
    saveDisabled: busy || stale || saved,
    busy,
  };
}
