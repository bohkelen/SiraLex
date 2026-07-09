# Phase 7N2A4E0 Health Source-Mapping Readiness Audit

Correction notice:
The original 7N2A4E0 report incorrectly identified the existing French
place-path target as ndándadiya (fefe9b063e05ed11). The verified preserved
base-path target is díya (de6fb406453616e3). This correction reinforces the
existing prohibition on routing place or location to either approved
health-institution record.

## 1) Exact current supplement-table schema

Authoritative table path:

- `shared/source_index_supplements/source_index_supplements_v1.jsonl`

Authoritative schema/validator sources:

- `shared/specs/source-index-supplement-v1.md`
- `api/source_index_supplements/validate_supplements.py`

Schema identity:

- `schema_version`: `source_index_supplement_v1`
- `supplement_table_version`: string table release id

Required row fields (validator-enforced):

- `schema_version`
- `supplement_table_version`
- `supplement_id`
- `status`
- `source_lang` (must be `fr`)
- `source_term`
- `source_display_text`
- `target_ir_ids`
- `target_forms`
- `target_notes`
- `candidate_type`
- `supplement_mode`
- `broad_mapping` (bool)
- `broad_mapping_rationale` (string; non-empty when `broad_mapping=true`)
- `supporting_evidence_ir_ids`
- `supporting_source_terms`
- `rationale`
- `source_bundle_id`
- `source_norm_version` (must be `norm_v3`)

Approved-row required fields:

- `reviewer`
- `reviewed_at`

Allowed statuses:

- `candidate`
- `approved`
- `rejected`
- `superseded`

Allowed supplement modes:

- `new_source_mapping`
- `additive_source_mapping`
- `broad_umbrella_source_mapping`

Allowed candidate types:

- `missing_source_index_mapping`
- `incomplete_source_mapping`
- `broad_umbrella_source_mapping`
- `content_correction_candidate`

## 2) Exact merge semantics for additive and new mappings

Implementation sources:

- `api/source_index_supplements/generate_supplement_records.py`
- `api/source_index_supplements/merge_supplements_into_search_index.py`

Exact behavior:

- `new_source_mapping`:
  - Created only when source key does not already exist in loaded search index.
  - Row is transformed into a new `source_index` record (`ir_kind="source_index"`).
  - `ir_id` is deterministically generated from source key + posting ids.

- `additive_source_mapping`:
  - Requires source key already exists in loaded search index.
  - Existing posting list is preserved in current order.
  - Only non-existing `target_ir_ids` from the supplement are appended.
  - Merge is deterministic and duplicate-safe at write time.

- `broad_umbrella_source_mapping`:
  - Treated as a supplement-generated source mapping row in generation.
  - Merge behavior is equivalent to the record-level merge used for supplements (create or additive merge depending on key existence), while semantic intent is broad/umbrella and gated by required rationale fields.

## 3) Distinction between `new_source_mapping` and `additive_source_mapping`

- `new_source_mapping`: define an entirely new source lookup key that does not currently exist in source index.
- `additive_source_mapping`: extend an existing source lookup key by appending additional approved targets while preserving original postings.

Fail-closed constraints:

- `new_source_mapping` row is rejected if source key already exists.
- `additive_source_mapping` row is rejected if source key is missing.

## 4) What a supplement row may reference

Direct row identity requirements:

- Must reference a `source_term` (required).
- Cannot omit source identity (`source_term` and `source_display_text` are required).

IR references:

- No dedicated field for "existing source-index mapping ir_id".
- Existing mapping evidence can be referenced in `supporting_evidence_ir_ids`.
- Target linkage is explicit through `target_ir_ids`.

Therefore:

- Existing source mapping ir_id: optional as evidence only.
- Source term: mandatory.
- Both source term and evidence ir_ids: allowed and expected for audited/approved rows.
- Neither: not allowed.

## 5) Required normalization/review/provenance-like fields

Current validator-enforced requirements:

- `source_norm_version` must be exactly `norm_v3`.
- `source_lang` must be exactly `fr`.
- `source_bundle_id` is required.
- `supporting_evidence_ir_ids` and `supporting_source_terms` are required arrays.
- `rationale` is required.
- `reviewer` and `reviewed_at` required when status is `approved`.
- `broad_mapping_rationale` is required non-empty when `broad_mapping=true`.

Note:

- `reviewed_at` is presence-checked for approved rows; format strictness (for example ISO date) is not currently enforced in validator.

## 6) Duplicate/conflict prevention rules in current implementation

Validator-level:

- Duplicate `supplement_id`: rejected.
- `target_ir_ids` and `target_forms` length mismatch: rejected.
- Unknown `target_ir_id` (not found in loaded IR): rejected.
- `source_term`/`source_display_text`/supporting terms NFC canonicalization required.
- Minimum one target required.

Merge/generation level:

- For additive mappings, duplicate target ids against existing postings are ignored (append only truly new targets).
- For new mappings, collisions on existing source key are rejected.

Not currently hard-rejected at validator level:

- Duplicate `source_term` across different supplement rows (table-level uniqueness by source term is not currently globally enforced).
- Duplicate `target_ir_ids` within a single row (not explicitly rejected as a row-internal invariant).

## 7) Deterministic table-order and output-order rules

Current state:

- Supplement table file order is preserved as authored; validator does not enforce sorted row order.
- Generated supplement records are sorted deterministically by `(src_casefold, src_surface)`.
- Merged final index records are written sorted by `(ir_kind, src_casefold, src_surface)`.
- Additive merge preserves existing posting order and appends only new targets in row-provided order after filtering existing ids.

## 8) Exact pipeline stage where supplements apply

Supplements are applied in source-index generation/merge stage, not lexical normalization:

- Normalizer (`api/normalizer/*`) builds normalized lexical records.
- Enrichment (`api/enrichment/*`) decorates normalized lexical records.
- Source-index supplement tooling (`api/source_index_supplements/*`) generates and merges search-index `source_index` rows.

Therefore supplements affect:

- Search-index generation outputs.

They do not directly alter:

- Normalized lexical records.
- Enriched lexical records.
- Underlying lexicon-entry normalization contracts.

## 9) Required local read-only source audit results

### A. Existing `hôpital` mapping

From `data/ir/malipense_index_v1.jsonl`:

- Source key (`src_casefold`, `src_surface`) = (`hôpital`, `hôpital`) exists.
- Existing mapping row `ir_id` = `61843e6630c1fbae`.
- Existing target posting = `71e323e2dafa590f`.

From `data/ir/malipense_lexicon_v3.jsonl`:

- `71e323e2dafa590f` resolves to headword `dándaso`.

### B. Current posting does not include approved owner health terms

Current `hôpital` posting (`71e323e2dafa590f`) does not include:

- `a9c7d82decee9191` (`ndándayoro`)
- `fefe9b063e05ed11` (`ndándadiya`)

### C. `clinique` and `centre de santé` currently absent from source index

No current `source_index` key found in `data/ir/malipense_index_v1.jsonl` for:

- `clinique`
- `centre de santé`

### D. Owner records existence and validity

From `data/ir/siralex_owner_lexical_v1.jsonl` and lexical-review validators:

- `a9c7d82decee9191` (`ndándayoro`) exists and validates.
- `fefe9b063e05ed11` (`ndándadiya`) exists and validates.

### E. Current supplement table has no health additions for these keys

From `shared/source_index_supplements/source_index_supplements_v1.jsonl`:

- No row currently adds or modifies source keys for `hôpital`, `clinique`, or `centre de santé`.

### F. Audit of `yoro`/`place`/`location` mentions

Observed behavior:

- `place` already exists in provisioned base IR as index mapping `96b72ff71179d689`.
- The existing base `place` posting includes `díya` via `de6fb406453616e3` (alongside other non-health place senses).
- `fefe9b063e05ed11` (`ndándadiya`) is not in the existing `place` posting.
- `a9c7d82decee9191` (`ndándayoro`) is not in the existing `place` posting.
- No supplement rows currently mention `yoro`, `place`, or `location`.
- No source index key currently found for `yoro` or `location`.

Boundary implication:

- Existing `place -> díya` behavior remains unchanged.
- No 7N2A mapping may route `place` or `location` to `ndándayoro` or `ndándadiya`.
- Standalone `yoro` remains prohibited from lexical records, target variants, source aliases, source-index supplements, and all 7N2A retrieval paths.

## 10) Proposed future rows (design only; not inserted in 7N2A4E0)

These are contract-ready proposals for next implementation slice. No insertion is performed in this audit phase.

| Source term | Intended mode | Target IDs to include | Expected post-merge behavior |
|---|---|---|---|
| `hôpital` | `additive_source_mapping` | existing `71e323e2dafa590f` plus add `a9c7d82decee9191`, `fefe9b063e05ed11` | preserve existing posting order, append new approved owner targets |
| `clinique` | `new_source_mapping` | `a9c7d82decee9191`, `fefe9b063e05ed11` | create new source key mapping |
| `centre de santé` | `new_source_mapping` | `a9c7d82decee9191`, `fefe9b063e05ed11` | create new source key mapping |

Required row-level fields for each future approved row (as currently enforced):

- schema and table identity fields
- approved status with reviewer and reviewed_at
- source identity fields (`source_lang`, `source_term`, `source_display_text`)
- target arrays (`target_ir_ids`, `target_forms`, `target_notes`)
- classification fields (`candidate_type`, `supplement_mode`, `broad_mapping`, `broad_mapping_rationale`)
- evidence fields (`supporting_evidence_ir_ids`, `supporting_source_terms`)
- rationale + source bundle + `source_norm_version=norm_v3`

Deterministic posting expectation:

- For `hôpital` additive row: existing `71e323e2dafa590f` remains first; new ids append in deterministic supplement row order after duplicate filtering.

## 11) Future slice boundary definition (7N2A4E1)

Proposed next slice:

- `7N2A4E1 — Approved health source-index supplement insertion and validation`

In-scope for 7N2A4E1:

- Add exactly three approved rows in `shared/source_index_supplements/source_index_supplements_v1.jsonl` for:
  - `hôpital` (additive)
  - `clinique` (new)
  - `centre de santé` (new)
- Add/adjust tests in `api/source_index_supplements/tests/test_source_index_supplements.py` for:
  - additive preservation + append behavior
  - new-key creation behavior
  - deterministic merged posting order
  - fail-closed invariants for unknown targets/conflicts
- Add implementation report:
  - `docs/reports/phase7n2a4e1_health_source_mapping_insertion_report.md`

Out-of-scope for 7N2A4E1:

- Any changes to normalization/enrichment lexical record semantics.
- Any changes to existing `place -> díya` behavior.
- No 7N2A mapping may route `place` or `location` to `ndándayoro` or `ndándadiya`.
- Any introduction of `yoro` or `location` source keys without explicit approval.

## 12) Readiness conclusion

Repository contracts and tooling are ready for controlled insertion of the three health mappings in a follow-up slice.

Key readiness points:

- Schema and validator are explicit and fail-closed on core identity/target existence/mode constraints.
- Merge behavior is deterministic and preserves additive ordering guarantees.
- Required owner target records are present, validated, and usable as supplement targets.
- Current source-index state supports the intended split (`hôpital` additive; `clinique` and `centre de santé` new).

No data mutations are performed in 7N2A4E0 beyond this audit report.
