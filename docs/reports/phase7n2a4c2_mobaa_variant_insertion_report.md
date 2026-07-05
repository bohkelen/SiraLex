# Phase 7N2A4C2 móbaa Variant Insertion Report

## Scope

This slice inserts one approved reviewed target-side overlay row for `móbaa` and validates composed normalization behavior without modifying frozen Mali-Pense IR.

## Inserted overlay row

```json
{
  "schema_version": "reviewed_target_variant_table_v1",
  "target_variant_table_version": "phase7n2a-round1",
  "variant_id": "rtv_phase7n2a_0001",
  "status": "approved",
  "canonical_ir_id": "c5f78c8ac66eac6b",
  "form": "móbaa",
  "target_script": "latin",
  "review_document": "docs/PHASE_7K1_STRUCTURED_USABILITY_TRIAGE.md",
  "reviewer": "project owner / native-speaker linguistic authority",
  "reviewed_at": "2026-07-05",
  "rationale": "Owner-approved target-side variant of móyibaa; same lexical concept; no separate record.",
  "source_norm_version": "norm_v3"
}
```

NFC verification:

```text
normalize_nfc("móbaa") == "móbaa"  -> True
```

## Raw vs composed commands

Raw normalization (IR inputs only):

```bash
PYTHONPATH=api:shared python3 -m normalizer.cli \
  --input data/ir/malipense_lexicon_v3.jsonl \
  --input data/ir/malipense_index_v1.jsonl \
  --input data/ir/siralex_owner_lexical_v1.jsonl \
  --output /tmp/siralex_norm_7n2a4c2_raw.jsonl \
  -v
```

Composed normalization (same IR inputs + explicit overlay):

```bash
PYTHONPATH=api:shared python3 -m normalizer.cli \
  --input data/ir/malipense_lexicon_v3.jsonl \
  --input data/ir/malipense_index_v1.jsonl \
  --input data/ir/siralex_owner_lexical_v1.jsonl \
  --target-variant-overlay shared/target_variants/reviewed_target_variants_v1.jsonl \
  --output /tmp/siralex_norm_7n2a4c2_composed.jsonl \
  -v
```

Raw enrichment:

```bash
PYTHONPATH=api:shared python3 -m enrichment.cli \
  --normalized /tmp/siralex_norm_7n2a4c2_raw.jsonl \
  --ir data/ir/malipense_lexicon_v3.jsonl \
  --ir data/ir/malipense_index_v1.jsonl \
  --ir data/ir/siralex_owner_lexical_v1.jsonl \
  --output /tmp/siralex_enriched_7n2a4c2_raw.jsonl \
  -v
```

Composed enrichment:

```bash
PYTHONPATH=api:shared python3 -m enrichment.cli \
  --normalized /tmp/siralex_norm_7n2a4c2_composed.jsonl \
  --ir data/ir/malipense_lexicon_v3.jsonl \
  --ir data/ir/malipense_index_v1.jsonl \
  --ir data/ir/siralex_owner_lexical_v1.jsonl \
  --output /tmp/siralex_enriched_7n2a4c2_composed.jsonl \
  -v
```

Display-only gates:

```bash
PYTHONPATH=api:shared python3 -m enrichment.validate_enrichment_display_only \
  --baseline /tmp/siralex_norm_7n2a4c2_raw.jsonl \
  --enriched /tmp/siralex_enriched_7n2a4c2_raw.jsonl -v

PYTHONPATH=api:shared python3 -m enrichment.validate_enrichment_display_only \
  --baseline /tmp/siralex_norm_7n2a4c2_composed.jsonl \
  --enriched /tmp/siralex_enriched_7n2a4c2_composed.jsonl -v
```

## Verification table

| Field | Verified value |
| --- | --- |
| Overlay path | `shared/target_variants/reviewed_target_variants_v1.jsonl` |
| Overlay SHA-256 | `8cf0e0acd42e1a8eeb7ff12a60ef2c849215b0ad2a861717a2f6c9b78ac3bb16` |
| Overlay rows / applied rows | `1 / 1` |
| Variant ID | `rtv_phase7n2a_0001` |
| Form and NFC validation | `móbaa`; NFC check passed |
| Canonical ir_id | `c5f78c8ac66eac6b` |
| Canonical preferred form unchanged | yes (`móyibaa` raw == composed) |
| Raw versus composed normalized delta | only `c5f78c8ac66eac6b` changed |
| Raw versus composed enriched display delta | none (`display` unchanged for all 19,326 ids) |
| Full-pipeline result | raw and composed normalization/enrichment all passed |
| Negative-scope checks | all pass (see below) |

## Raw vs composed comparison

- Raw record count: `19,326`
- Composed record count: `19,326`
- Same normalized `ir_id` set: yes
- Same enriched `ir_id` set: yes
- All normalized records except `c5f78c8ac66eac6b`: unchanged
- All enriched `display` fields: unchanged

For `c5f78c8ac66eac6b`:

- `preferred_form` remains `móyibaa`
- `source_id` remains `src_malipense`
- raw `variant_forms` prefix is preserved in same order
- composed `variant_forms` = raw `variant_forms` + final tail `móbaa`
- composed `search_keys` adds keys from `móbaa` (`móbaa`, `mobaa`)
- `móyibaa` remains searchable
- no provenance or derivation introduced/altered

Additional invariants:

- exactly one normalized record contains `móbaa` in `variant_forms`
- that record is `c5f78c8ac66eac6b`
- no record has `preferred_form == móbaa`
- no new `ir_id` introduced

## Negative-scope checks

- no `maman` source alias row exists
- no new health source-index mapping for `hôpital`, `clinique`, `centre de santé`
- existing `ndándayoro` and `ndándadiya` owner lexical records unchanged
- no standalone `yoro` record/variant/alias/mapping found
- existing `place → diya` behavior unchanged (no alias/supplement/regression edits)
- no frozen Mali-Pense IR file modified
- no source alias / source-index supplement / search regression matrix / index / bundle / package / runtime / catalog / release artifact changes

## Explicit statements

móbaa is a reviewed target-side variant of canonical móyibaa under the existing
Mali-Pense ir_id c5f78c8ac66eac6b.

No second lexical record was created. No frozen Mali-Pense IR was changed.

The variant is present only in composed normalized output. No generated search
index, bundle, package, or user-visible runtime behavior has changed in this slice.
