# Source-index supplement v1

This specification defines reviewed French source-index supplements for SiraLex
bundle generation.

Source-index supplements are reviewed discoverability overlays. They point a
French source term or broad French concept to existing attested target lexicon
entries without claiming that the original source data already contained that
mapping.

## Goals

- Add reviewed French source-index coverage for missing or incomplete source
  mappings.
- Keep supplements separate from source convenience aliases.
- Generate normal `index_mapping` records so existing result rendering can use
  the usual source-index display path.
- Preserve provenance and reviewer rationale outside generated bundle records.
- Fail closed when a supplement is stale, ambiguous, or conflicts with existing
  source mappings.

## Non-goals

- Source convenience aliases.
- Runtime fuzzy search or query expansion.
- Generic French morphology.
- Target-side aliasing.
- Ranking, ordering, or result-card summary changes.
- Upstream source-data corrections.

## Artifact format

Supplement tables are newline-delimited JSON (`.jsonl`). Each non-empty line is
one supplement row.

Reviewed source-index supplement data lives in:

`shared/source_index_supplements/source_index_supplements_v1.jsonl`

It MUST NOT be represented in `shared/aliases/source_aliases_v1.jsonl`.

## Schema identity

- `schema_version`: `source_index_supplement_v1`
- `supplement_table_version`: release identifier for the reviewed supplement
  table, for example `phase7b-round1`

## Status lifecycle

Allowed `status` values:

- `candidate`
- `approved`
- `rejected`
- `superseded`

Only `approved` rows are eligible to generate `index_mapping` records.

## Supplement modes

Allowed `supplement_mode` values:

- `new_source_mapping`: the source term is absent from the existing source index.
- `additive_source_mapping`: the source term exists and the approved supplement
  adds reviewed target entries without overwriting existing mappings.
- `broad_umbrella_source_mapping`: the source term is a broad concept that
  intentionally points to labeled subtype target entries.

`additive_source_mapping` is the only mode that may supplement an existing
source term by default. Existing mappings MUST NOT be silently overwritten.

## Row fields

Each row MUST be a JSON object with these required fields:

- `schema_version` (string; MUST be `source_index_supplement_v1`)
- `supplement_table_version` (string)
- `supplement_id` (string; stable row identifier)
- `status` (string enum)
- `source_lang` (string; v1 MUST be `fr`)
- `source_term` (string)
- `source_display_text` (string)
- `target_ir_ids` (array of strings; existing `lexicon_entry` records)
- `target_forms` (array of strings; attested forms for the target records)
- `target_notes` (array of objects)
- `candidate_type` (string enum)
- `supplement_mode` (string enum)
- `broad_mapping` (boolean)
- `supporting_evidence_ir_ids` (array of strings)
- `supporting_source_terms` (array of strings)
- `rationale` (string)
- `source_bundle_id` (string)
- `source_norm_version` (string)

Approved rows additionally require:

- `reviewer` (string)
- `reviewed_at` (string; ISO date or timestamp)

Broad rows additionally require:

- `broad_mapping_rationale` (string)
- per-target labels or notes in `target_notes`

## Candidate types

Allowed v1 candidate types:

- `missing_source_index_mapping`
- `incomplete_source_mapping`
- `broad_umbrella_source_mapping`
- `content_correction_candidate`

## Broad mapping audit fields

Rows with `broad_mapping: true` MUST include `broad_mapping_rationale` and
target notes. Labels do not need to appear in UI for v1, but they must be
present in the supplement artifact and generation report for audit.

Example labels:

- `oncle maternel`
- `oncle paternel`
- `tante paternelle`

## Generated records

Approved supplements generate normal `index_mapping` records before search-index
generation. Generated records use:

- deterministic `ir_id`
- `ir_kind: "index_mapping"`
- `source_id` inherited from the existing bundle source
- `norm_version` matching `source_norm_version`
- source search keys computed with the active normalization version
- `display.source_term`, `display.source_lang`, and `display.target_entries`
  compatible with existing enriched `index_mapping` records

Generated records MUST NOT mutate original records.

## Collision handling

Validation MUST reject conflicts by default:

- `new_source_mapping` requires the source term to be absent from the existing
  source index.
- `additive_source_mapping` requires the source term to exist and appends a new
  supplement-derived `index_mapping` record during records generation.
- `broad_umbrella_source_mapping` requires `broad_mapping: true`, rationale, and
  target notes.

No existing `index_mapping` record is overwritten.

## Versioning

Source-index supplement v1 is compatible with a refreshed enriched `norm_v3`
bundle because it adds reviewed overlay data rather than changing normalization
semantics.

No `norm_v4` is required for v1.
