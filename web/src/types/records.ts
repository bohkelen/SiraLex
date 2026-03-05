/**
 * TypeScript types for enriched bundle records.
 *
 * These mirror the Python dataclasses in shared/ir/models.py and the
 * enrichment output schema in api/enrichment/enrich.py.
 *
 * Fields are sparse: optional fields are only present when non-null/non-empty
 * in the source (Python to_dict() omits falsy values).
 */

export type ExampleRaw = {
  text_latin: string;
  text_nko_provided?: string;
  trans_fr?: string;
  trans_en?: string;
  trans_ru?: string;
  source_attribution?: string;
};

export type SubEntry = {
  text: string;
  nko?: string;
  gloss_fr?: string;
  gloss_en?: string;
  gloss_ru?: string;
};

export type SenseRaw = {
  sense_num?: number;
  gloss_fr?: string;
  gloss_en?: string;
  gloss_ru?: string;
  examples?: ExampleRaw[];
  usage_note?: string;
  synonyms_raw?: string[];
  sub_entries?: SubEntry[];
};

export type LexiconDisplayFields = {
  headword_latin: string;
  headword_nko_provided?: string;
  ps_raw?: string;
  pos_hint?: string;
  senses?: SenseRaw[];
  variants_raw?: string[];
  synonyms_raw?: string[];
  etymology_raw?: string;
  literal_meaning_raw?: string;
  corpus_count?: number;
};

export type TargetEntry = {
  lexicon_url: string;
  anchor: string;
  display_text: string;
};

export type IndexMappingDisplayFields = {
  source_term: string;
  source_lang: string;
  target_entries?: TargetEntry[];
};

export type EnrichedRecord = {
  ir_id: string;
  ir_kind: "lexicon_entry" | "index_mapping";
  source_id: string;
  norm_version: string;
  preferred_form: string;
  variant_forms: string[];
  search_keys: Record<string, string[]>;
  display?: LexiconDisplayFields | IndexMappingDisplayFields;
};

export function isLexiconDisplay(
  record: EnrichedRecord,
): record is EnrichedRecord & { display: LexiconDisplayFields } {
  return record.ir_kind === "lexicon_entry" && record.display != null;
}

export function isIndexMappingDisplay(
  record: EnrichedRecord,
): record is EnrichedRecord & { display: IndexMappingDisplayFields } {
  return record.ir_kind === "index_mapping" && record.display != null;
}
