# Phase 7N2A4F1-R — Additive Matrix Runner Support

## Scope

This slice adds narrow validator/runner support so additive Phase 7N2A regression matrices can be validated and replayed beside the frozen Phase 7L regression gate.

Phase 7L remains the frozen pinned regression gate.

Phase 7N2A additive regression runs beside 7L and does not replace it.

No candidate bundle, package, catalog entry, or user-visible runtime artifact was built or modified in this slice.

## Exact Files Changed

- `api/search_regression/schema.py`
- `api/search_regression/validate_matrix.py`
- `api/search_regression/tests/test_validate_matrix.py`
- `api/search_regression/tests/test_replay_golden.py`
- `scripts/run_search_regression.py`
- `shared/search_regression/matrix_manifest_7n2a_v1.json`
- `docs/reports/phase7n2a4f1r_additive_matrix_runner_support_report.md`

## Matrix-Family Policy Implemented

- Added optional manifest field `matrix_family` in `MatrixManifest` with supported values:
  - `phase7l_pinned`
  - `phase7n2a_additive`
- Default behavior for legacy manifests (including frozen `shared/search_regression/matrix_manifest_v1.json` with no new field):
  - `matrix_family` defaults to `phase7l_pinned`
- Seed-query enforcement is now family-aware:
  - `phase7l_pinned`: requires existing pinned Phase 7L seed-query set (unchanged semantics)
  - `phase7n2a_additive`: does not require Phase 7L seed queries; still enforces all existing row/manifest consistency checks
- Unknown matrix family fails closed at manifest load with `MatrixLoadError`.

## Proof: 7L Seed Enforcement Remains Intact

- Existing committed 7L validation/replay tests still pass.
- Added explicit validator test:
  - `test_missing_required_7l_seed_query_fails_with_pinned_family`
  - Asserts a 7L matrix missing `fruit` fails with `missing required seed queries`.
- Added explicit legacy default test:
  - `test_legacy_7l_manifest_defaults_to_phase7l_pinned_family`
  - Confirms unmodified 7L manifest remains pinned by default.

## Proof: 7N2A Additive Matrix Validates Without 7L Seed Queries

- Added explicit test:
  - `test_additive_7n2a_matrix_validates_without_7l_seed_queries`
  - Loads `shared/search_regression/search_regression_matrix_7n2a_v1.jsonl` with `shared/search_regression/matrix_manifest_7n2a_v1.json` and asserts zero validation errors.
- Added explicit test:
  - `test_additive_7n2a_manifest_case_count_matches_matrix_rows`
  - Asserts additive manifest `case_count` equals loaded additive row count.
- Added explicit fail-closed tests:
  - `test_manifest_loader_rejects_unknown_matrix_family`
  - `test_additive_family_duplicate_case_id_fails_closed`
  - `test_additive_family_case_count_mismatch_fails_closed`

## Replay Command Shape for Future 4F2 Candidate

The CLI now documents generic bundle-under-test wording and accepts additive matrix/manifest argument shape without catalog-promotion assumptions. Verified with:

- `test_cli_accepts_additive_matrix_manifest_and_arbitrary_bundle_path`
  - Confirms argument parsing accepts additive matrix + additive manifest + arbitrary bundle path (execution fails later only because the temporary bundle directory does not exist, not because of CLI assumptions).

Example replay command for future candidate:

```bash
python3 scripts/run_search_regression.py \
  --matrix shared/search_regression/search_regression_matrix_7n2a_v1.jsonl \
  --manifest shared/search_regression/matrix_manifest_7n2a_v1.json \
  --bundle /tmp/phase7n2a4f2/<candidate_bundle_dir> \
  --output /tmp/phase7n2a4f2/7n2a_replay_report.json
```

## Remaining Assertion Limitations

No broad matrix-schema expansion was added in this slice. Candidate-validation assertions remain report-level for future recomposition validation (for example, preferred-form/ID invariants and explicit place-boundary exclusions), consistent with 7N2A4F1 scope boundaries.

## Validation Commands and Results

- `git diff --check` -> pass
- `pytest api/search_regression/tests/ -q` -> `72 passed`
- `pytest api/source_aliases/tests/ -q` -> `27 passed`
- `pytest api/target_variants/tests/ -q` -> `30 passed`
- `pytest api/source_index_supplements/tests/ -q` -> `33 passed`

## Artifact Integrity Confirmation

- No normalization/enrichment/source-index/bundle/package/catalog generation was run.
- No candidate, package, catalog, or user-visible runtime artifact changed in this slice.
