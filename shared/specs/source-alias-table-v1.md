# Source alias table v1

This specification defines reviewed source-side search aliases for SiraLex
bundle generation.

Source aliases are search metadata. They do not change dictionary source truth,
normalized records, target-side search, or runtime query behavior.

## Goals

- Add reviewed source-side convenience aliases during search-index generation.
- Keep alias provenance auditable outside `records.jsonl`.
- Preserve immutable source and normalized IR records.
- Fail closed when an alias is stale, ambiguous, or conflicts with existing
  source keys.

## Non-goals

- Runtime query expansion.
- Generic French morphology.
- Target-side aliasing.
- Correction records for missing or wrong dictionary content.
- Sentence translation, phrase decomposition, ranking, or result-card changes.

## Artifact format

Alias tables are newline-delimited JSON (`.jsonl`). Each non-empty line is one
alias row.

Reviewed source alias data lives in a tracked product/search configuration
artifact:

`shared/aliases/source_aliases_v1.jsonl`

It MUST NOT live under ignored raw-data locations such as `data/`, because
source aliases are small reviewed search configuration artifacts rather than
raw, generated, or bulky capture data.

## Schema identity

- `schema_version`: `source_alias_table_v1`
- `alias_table_version`: release identifier for a reviewed alias table, for
  example `phase7a-round1`

## Row fields

Each row MUST be a JSON object with these required fields:

- `schema_version` (string; MUST be `source_alias_table_v1`)
- `alias_table_version` (string)
- `alias_id` (string; stable row identifier)
- `status` (string enum)
- `direction` (string; v1 MUST be `source_to_target`)
- `alias_source_term` (string; user-facing French alias)
- `canonical_source_terms` (array of strings; source terms that already resolve
  in the base source index)
- `resolved_ir_ids` (array of strings; deterministic posting set expected from
  `canonical_source_terms`)
- `candidate_type` (string enum)
- `evidence_ir_ids` (array of strings; records supporting the alias decision)
- `rationale` (string)
- `source_bundle_id` (string)
- `source_norm_version` (string)

Approved rows additionally require:

- `reviewer` (string)
- `reviewed_at` (string; ISO date or timestamp)

## Status lifecycle

Allowed `status` values:

- `candidate`
- `approved`
- `rejected`
- `deferred`

Only `approved` rows are eligible to affect generated search-index output.
`candidate`, `rejected`, and `deferred` rows are review artifacts only and MUST
NOT generate index rows.

## Candidate types

Allowed v1 candidate types:

- `french_plural_singular_alias`
- `french_gender_alias`
- `hyphenation_or_compound_alias`
- `french_common_form_alias`

`french_common_form_alias` means a reviewed informal or common French form that
copies an existing canonical French source posting exactly. It does not create a
new index mapping, lexical record, or posting-order change.

The source alias table MUST NOT represent:

- missing source-index mappings such as standalone `poil`
- content corrections such as `tante` / expected `Ntene`
- phrase or sentence expectations such as `ferme la bouche`
- ranking/order changes such as `mere`

## Alias semantics

An alias row means:

> When a user searches `alias_source_term`, the generated source-side search
> index routes to the same records as the approved `canonical_source_terms`.

Aliases are source-side only:

- They generate only `src_*` search-index key families.
- They do not generate `tgt_*` keys.
- They do not mutate `records.jsonl`.
- They do not create new dictionary entries.
- They do not change normalization semantics.
- They do not change runtime query behavior.

## Resolution and stale-row protection

For each approved alias, the build MUST recompute the deterministic ordered
posting list for `canonical_source_terms` from the base source index.

The recomputed posting list MUST exactly equal `resolved_ir_ids`, including
order. Canonical resolution preserves `canonical_source_terms` order, preserves
each base posting list order, and deduplicates by first seen `ir_id`. If the
recomputed posting list differs, the alias row is stale or invalid and MUST be
rejected before any output index is written.

## Collision handling

Alias application MUST be conservative:

- If an alias-derived source key is absent, it may be added with the approved
  deterministic ordered posting list.
- If an alias-derived source key already exists with an identical ordered
  posting list, it is a no-op and MUST be reported.
- If an alias-derived source key already exists with the same set in a different
  order, or with a different set, it is a hard conflict. The build MUST fail
  closed.

The build MUST NOT merge, overwrite, or silently broaden existing source keys.
The build MUST preserve original `ir_ids` order for every existing base-index
row when writing an augmented search index.

## Index generation

The alias layer is applied after base search-index generation and before bundle
assembly:

```text
IR
→ normalize norm_v3
→ enrich
→ build base search_index.jsonl
→ validate source_aliases_v1.jsonl
→ apply approved source aliases
→ emit alias application report
→ build bundle
→ verify bundle
```

For v1, `records.jsonl` remains unchanged. Only `search_index.jsonl` is
augmented.

Alias-derived keys MUST use the same search-key generation path as normalized
source terms.

## Required report metadata

Alias application MUST emit an external report. Manifest metadata is optional
unless the manifest schema explicitly supports it.

The report summary MUST include:

```json
{
  "alias_tables": [
    {
      "schema_version": "source_alias_table_v1",
      "alias_table_version": "phase7a-round1",
      "approved_alias_count": 3,
      "candidate_alias_count": 1,
      "applied_alias_count": 3,
      "skipped_alias_count": 0
    }
  ]
}
```

The report MUST include per-alias outcome rows with:

- `alias_id`
- `status`
- `alias_source_term`
- `canonical_source_terms`
- `resolved_ir_ids`
- `generated_key_types`
- `outcome`
- `reason`

Allowed outcomes:

- `applied`
- `skipped`
- `rejected`

## Versioning

Source alias v1 is compatible with a refreshed enriched `norm_v3` bundle because
it adds reviewed build-time index metadata rather than changing normalization
semantics.

A future `norm_v4` is required only if alias behavior becomes generic
normalization, runtime expansion, or broader language-specific transformation.
