# Phase 7N2A4F1 Additive Regression Matrix Report

## 1. Existing 7L matrix unchanged proof

Phase 7L baseline artifacts were not modified:

- `shared/search_regression/search_regression_matrix_v1.jsonl` unchanged
- `shared/search_regression/matrix_manifest_v1.json` unchanged

This preserves the pinned 7L gate semantics and bundle linkage.

## 2. New additive 7N2A matrix and manifest paths

Created additive artifacts:

- `shared/search_regression/search_regression_matrix_7n2a_v1.jsonl`
- `shared/search_regression/matrix_manifest_7n2a_v1.json`

Naming follows the existing `shared/search_regression/` pattern, with a suffixed matrix/manifest pair to keep 7N2A additive coverage separate from frozen 7L.

## 3. Existing schema/runner inspection summary

Inspected:

- `shared/search_regression/search_regression_matrix_v1.jsonl`
- `shared/search_regression/matrix_manifest_v1.json`
- `api/search_regression/schema.py`
- `api/search_regression/validate_matrix.py`
- `api/search_regression/tests/test_validate_matrix.py`
- `scripts/run_search_regression.py`

Supported matrix fields in current schema:

- `query`, `query_unicode_form`, `direction`
- `expected_result_status`, `expected_result_count`, `expected_ir_ids`
- `expected_matched_key_type`, `expected_matched_key`, `expected_deep_ladder`
- `case_id`, `case_family`, `case_tags`, `source_of_expectation`, `notes`
- `bundle_id`, `norm_version`, `review_status`

Current schema does **not** provide dedicated fields for:

- explicit `expected_excluded_ids`
- preferred-form invariants
- no-new-ir-id invariants

Current runner limitation:

- `validate_matrix()` enforces a fixed 7L seed-query set (`SEED_QUERIES`) and will reject a pure additive 7N2A matrix lacking those 13 pinned 7L queries.

## 4. Exact additive case inventory

The additive matrix defines 8 runtime-replay rows (case 2 merged into case 1; case 10 recorded as report-level gate):

1. `7n2a_maman_generic_mere_only`
2. `7n2a_mobaa_targets_moyibaa`
3. `7n2a_hopital_health_order`
4. `7n2a_clinique_health_only`
5. `7n2a_centre_de_sante_health_only`
6. `7n2a_place_preserves_diya_excludes_health`
7. `7n2a_location_absent`
8. `7n2a_yoro_absent`

### Per-case assertion contract

#### Case: `7n2a_maman_generic_mere_only`

- Query: `maman`
- Direction/family: `source_to_target` / `source_alias_hit`
- Expected include IDs: `["e5164efcdf5e6ca4"]`
- Expected exclude IDs:
  - `0f517a71c373f51d`
  - `d540716db9321a83`
- Ordering rule: single-hit exact posting only
- Limitation note: exclude assertion is encoded by exact result count + exact `expected_ir_ids` (no explicit `expected_excluded_ids` field in schema)

#### Case: `7n2a_mobaa_targets_moyibaa`

- Query: `móbaa`
- Direction/family: `target_to_source` / `target_exact_hit`
- Expected include IDs: `["c5f78c8ac66eac6b"]`
- Expected exclude IDs: none explicit in schema
- Ordering rule: single-hit exact posting only
- Limitation note: preferred-form preservation (`móyibaa`) and no-new-ir-id cannot be represented as dedicated fields in current matrix schema; must be checked in candidate validation slice

#### Case: `7n2a_hopital_health_order`

- Query: `hôpital`
- Direction/family: `source_to_target` / `source_supplement_hit`
- Expected include IDs (ordered):
  - `71e323e2dafa590f`
  - `a9c7d82decee9191`
  - `fefe9b063e05ed11`
- Expected exclude IDs: none explicit
- Ordering rule: exact ordered `expected_ir_ids` enforces `dándaso` first

#### Case: `7n2a_clinique_health_only`

- Query: `clinique`
- Direction/family: `source_to_target` / `source_supplement_hit`
- Expected include IDs (ordered):
  - `a9c7d82decee9191`
  - `fefe9b063e05ed11`
- Expected exclude IDs (implicit by exact list): no `71e323e2dafa590f`
- Ordering rule: exact ordered two-hit list

#### Case: `7n2a_centre_de_sante_health_only`

- Query: `centre de santé`
- Direction/family: `source_to_target` / `source_supplement_hit`
- Expected include IDs (ordered):
  - `a9c7d82decee9191`
  - `fefe9b063e05ed11`
- Expected exclude IDs (implicit by exact list): no `71e323e2dafa590f`
- Ordering rule: exact ordered two-hit list

#### Case: `7n2a_place_preserves_diya_excludes_health`

- Query: `place`
- Direction/family: `source_to_target` / `historical_regression`
- Expected include IDs: `["96b72ff71179d689"]` (source mapping row)
- Expected exclude IDs (implicit):
  - not health owner targets as direct source postings
- Ordering rule: single-hit mapping row identity
- Limitation note: current source-family matrix asserts mapping-level ID, not resolved target-entry expansion; preservation of resolved target `de6fb406453616e3` and exclusion of health lexicon IDs remains a downstream candidate validation assertion

#### Case: `7n2a_location_absent`

- Query: `location`
- Direction/family: `source_to_target` / `intentional_no_hit`
- Expected include IDs: none
- Expected exclude IDs: all IDs (miss contract)
- Ordering rule: miss (`expected_result_status=miss`, count `0`, `expected_ir_ids=[]`)

#### Case: `7n2a_yoro_absent`

- Query: `yoro`
- Direction/family: `source_to_target` / `intentional_no_hit`
- Expected include IDs: none
- Expected exclude IDs: all IDs (miss contract)
- Ordering rule: miss (`expected_result_status=miss`, count `0`, `expected_ir_ids=[]`)

## 5. Handling required case 2 and case 10 under current schema

### Case 2 (`maman` excludes vocative/respectful) handling

Current schema has no negative-only case shape. Case 2 is merged into case 1 via exact list contract:

- `expected_result_count = 1`
- `expected_ir_ids = ["e5164efcdf5e6ca4"]`

This encodes the exclusion without weakening the assertion.

### Case 10 (7L unchanged) handling

Current runner executes matrix rows, not repository-byte-integrity checks for parallel matrix files. Therefore case 10 is recorded as a report-level acceptance gate:

```text
The existing Phase 7L matrix and manifest remain byte-unchanged and must still
run green against any future 7N2A candidate.
```

## 6. Why additive (not replacing 7L)

- 7L is explicitly pinned to featured-bundle regression governance.
- 7N2A cases are future-candidate integration contracts, not baseline replacement.
- Keeping a separate matrix prevents accidental drift of frozen 7L semantics while enabling focused 7N2A acceptance checks.

## 7. Candidate linkage behavior in additive manifest

`matrix_manifest_7n2a_v1.json` is candidate-relative and intentionally not pinned to current Phase 7J featured identity:

- `bundle_id`: `bundle_full_phase7n2a_recomposed_candidate_tbd`
- `catalog_version`: `phase7n2a-candidate-not-yet-published`
- hashes marked pending recomposed candidate production in 4F2

This avoids claiming present-day pass against the 7J featured bundle.

## 8. Schema/runner limitations found

1. No dedicated `expected_excluded_ids` field.
2. No dedicated preferred-form/no-new-ir-id assertion fields.
3. `validate_matrix()` hard-codes 7L `SEED_QUERIES`, so additive 7N2A matrix cannot be run through existing validator/replay flow without enhancement.

## 9. No artifact-generation confirmation

No candidate bundle, package, catalog entry, source/index build artifact, or user-visible runtime artifact was generated or changed in this slice.

## 10. Next slice definition

Because current matrix validator/runner hard-codes 7L seed requirements, the next required slice is:

**Phase 7N2A4F1-R — Additive Matrix Runner Support**

Required boundary for 4F1-R:

- add narrow support for non-7L additive matrices (matrix-family-aware seed policy) without changing frozen 7L gate semantics.
- keep 7L matrix/manifest and current replay behavior unchanged.

