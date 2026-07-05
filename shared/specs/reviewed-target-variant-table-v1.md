# Reviewed Target Variant Table v1

Normative contract for `shared/target_variants/reviewed_target_variants_v1.jsonl`.

## Purpose

Attach owner-reviewed **target-side Latin spelling variants** to existing frozen
`lexicon_entry` records without mutating Mali-Pense IR. Overlay rows are applied
only during **composed normalization** when the normalizer is invoked with an
explicit `--target-variant-overlay <path>` flag.

## Required fields (every row)

| Field | Rule |
| ----- | ---- |
| `schema_version` | MUST be `reviewed_target_variant_table_v1` |
| `target_variant_table_version` | Non-empty table batch identifier |
| `variant_id` | Globally unique stable row id |
| `status` | `approved` \| `pending` \| `rejected` |
| `canonical_ir_id` | Exactly 16 lowercase hexadecimal characters |
| `form` | Non-empty NFC Latin target spelling |
| `target_script` | MUST be `latin` in v1 |
| `review_document` | Repository-relative path under `docs/` |
| `reviewer` | Non-empty string |
| `reviewed_at` | ISO-8601 date or datetime (e.g. `2026-07-05`, `2026-07-05T14:04:34Z`, `2026-07-05T14:04:34+00:00`) |
| `rationale` | Non-empty audit string |
| `source_norm_version` | MUST equal active ruleset (`norm_v3`) |

## Optional fields (documented only; not required in v1)

- `review_reference`
- `supersedes_variant_id`
- `notes`

## Table rules

1. `variant_id` is globally unique.
2. Approved rows are sorted by `(canonical_ir_id, variant_id)`.
3. An approved `form` may appear only once under NFC comparison across all approved rows.
4. `pending` and `rejected` rows are schema-validated but not applied.
5. An approved row must target exactly one `lexicon_entry` in supplied IR inputs with `source_id = src_malipense` (overlay v1 is frozen-Mali-Pense scoped).
6. Approved rows fail when `canonical_ir_id` resolves to zero records, multiple records, or a non-lexicon unit.
7. Approved rows fail on collision with canonical `headword_latin`, `anchor_names`, another record's attested Latin form, or another applied reviewed variant.
8. The overlay must not modify `preferred_form`, `record_locator`, `evidence`, `source_id`, `parser_version`, `provenance`, or `derivation`.

## Normalization modes

**Raw normalization:** IR inputs only; no overlay flag.

**Composed normalization:** IR inputs + explicit `--target-variant-overlay <path>`.

There is no automatic overlay discovery.
