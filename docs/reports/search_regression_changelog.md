# Phase 7L Search Regression Changelog and Governance

## Purpose and scope

Phase 7L is curated **engineering quality control** for SiraLex search lookup behavior. It protects an approved matrix of lookup contracts against the pinned featured bundle search index.

The matrix is **not** telemetry. It does not measure user demand, frequency, or query-log volume. Phase 7K query evidence may inform maintainer review, but mined log rows must never be copied directly into the matrix.

**CI enforcement:** `.github/workflows/phase7l_search_regression.yml` runs two required candidate jobs on every pull request, every push to `main`, and manual `workflow_dispatch`:

- **Phase 7L Python regression** — strict fixture validation, bundle metadata gate, raw `search_index.jsonl` SHA-256 verification, 13-case Python golden replay
- **Phase 7L Runtime regression** — actual `searchQuery()` through IndexedDB, runtime fixture identity gate before database mutation, runtime golden replay, case-for-case parity against the Python golden

## Non-negotiable rules

- The matrix is curated engineering QC, not telemetry.
- **No automatic golden rewrite.**
- **No automatic matrix update** from query logs, tester exports, or Phase 7K candidates.
- **No production artifact promotion** from Phase 7K candidates.
- **Every expected-result change requires a human review note.**
- A bundle or catalog change requires **both** Python and runtime regression runs against the **same verified bundle identity**.
- Python and runtime goldens must remain aligned on all parity fields (`case_id`, `query`, `query_unicode_form`, `direction`, `actual_result_status`, `actual_result_count`, `actual_ir_ids`, `actual_matched_key_type`, `actual_matched_key`, `actual_deep_ladder`, `expected_match`, `mismatches`).
- An unintentional regression must be fixed in search or bundle data; **do not accept it by changing a golden.**

## Required local validation commands

From repository root:

```bash
python3 -m pytest \
  api/search_regression/tests/test_validate_matrix.py \
  api/search_regression/tests/test_replay_golden.py \
  -q
```

```bash
cd web
npm ci
npx vitest run -c vitest.search_regression.config.ts
npx vitest run src/search/search_query.test.ts
```

Optional maintainer smoke (stdout only; does not rewrite goldens):

```bash
python3 scripts/run_search_regression.py \
  --matrix shared/search_regression/search_regression_matrix_v1.jsonl \
  --manifest shared/search_regression/matrix_manifest_v1.json \
  --bundle web/public/bundle_full_20260616_phase7j_alias_round2_candidate \
  --catalog web/public/catalog.json
```

## Adding a matrix case

1. Propose a new row in `shared/search_regression/search_regression_matrix_v1.jsonl` with `review_status: approved`, exact `query` literal, and `source_of_expectation`.
2. Update `shared/search_regression/matrix_manifest_v1.json` (`case_count` and hashes if the pinned bundle changed).
3. Run both local validation command blocks above.
4. Confirm Python and runtime agree on the new case and both pass fixture identity gates.
5. Update **both** goldens in the same reviewed commit:
   - `shared/search_regression/tests/golden_python_replay_v1.json`
   - `shared/search_regression/tests/golden_runtime_replay_v1.json`
6. Add a changelog entry below with rationale and review note.

Never add a row directly from raw query logs or Phase 7K candidate output.

## Changing an expectation

Forbidden without a human review note citing one of:

- intended behavior change
- data correction
- ranking change
- alias/supplement addition
- regression fix

Procedure:

1. Edit the matrix row with maintainer approval.
2. Re-run both Python and runtime validation against the same verified pinned bundle.
3. Update both goldens together in one commit.
4. Record the review category and rationale in the changelog entry.

If the diff is unintentional, fix search or bundle data before accepting any golden change.

## Rotating the pinned bundle

Use a **single reviewed change set** covering, when applicable:

- new pinned bundle directory under `web/public/`
- `web/public/catalog.json` pointer
- `shared/search_regression/matrix_manifest_v1.json` (`bundle_id`, `search_index_sha256`, `bundle_content_sha256`, `catalog_version`, `norm_version`)
- matrix contract rows that legitimately change
- `shared/search_regression/tests/golden_python_replay_v1.json`
- `shared/search_regression/tests/golden_runtime_replay_v1.json`
- human review note in this changelog

Steps:

1. Build and verify the new bundle (`siralex-build-bundle verify`).
2. Replay the full matrix locally on both runners.
3. Classify each diff (intended vs bug).
4. Commit matrix, manifest, bundle, catalog, and both goldens together with changelog entry.

## Changing the catalog pointer

1. Edit `web/public/catalog.json` only with reviewed intent.
2. Confirm `matrix_manifest_v1.json` `catalog_version` matches the catalog entry for the pinned `bundle_id`.
3. Run both Python and runtime validation.
4. Update goldens only if lookup contracts changed; catalog-only pointer fixes may require manifest-only updates.

## Updating Python or runtime goldens

1. Goldens are **human-reviewed fixtures**, not CI overwrite targets.
2. Never regenerate or commit goldens from CI automatically.
3. Review the full diff; confirm parity fields remain aligned between Python and runtime goldens.
4. Commit goldens only together with the matrix/manifest/bundle change that explains them.
5. Add a changelog entry with date, reviewer, commit intent, and review category.

## Intentional ranking, alias, supplement, or data changes

1. Land the underlying data change through the normal alias/supplement/bundle pipeline.
2. Repin the featured bundle and update manifest checksums.
3. Document the rationale in a changelog entry (for example: alias round, supplement mapping IR vs lexicon IR, posting-order doctrine).
4. Update matrix `source_of_expectation` / `notes` when helpful.
5. Require dual-runner pass before merge.

Alias or supplement table edits alone do not change Phase 7L contracts until the pinned bundle is rebuilt, repinned, and the matrix/manifest/goldens are updated in the same reviewed change set.

## Changelog entries

### 2026-07-08 — Align frozen 7L catalog_version with post-F8 7J provenance label

- **Reviewer:** project maintainer / agent (CI unblock after 7N2A featured promotion)
- **Commit / PR:** pending (feat/phase-2.0.5-offline-pwa)
- **Change category:** catalog_pointer | golden_update
- **Pinned bundle:** `bundle_full_20260616_phase7j_alias_round2_candidate` + `sha256:4326bc4c9c7d51229b4afa44048751ff122a451dce3d52c2d20d56ac8281418e` (unchanged)
- **Matrix cases affected:** none (lookup contracts unchanged; 13/13 identical)
- **Review note:** Phase 7N2A4F8 promoted 7N2A to featured via `VITE_FEATURED_BUNDLE_ID` and relabeled the retained 7J catalog entry to `norm-v3-prior-featured-fallback-phase7j`. Frozen Phase 7L still pins the 7J bundle directory and search-index identity. Replay resolves `catalog_version` from live `catalog.json`, so Python/runtime goldens and `matrix_manifest_v1.json` must carry the new provenance label. No search-result, checksum, or case expectation changes.
- **Validation:** Python pytest pass; runtime vitest search_regression pass; parity confirmed (cases unchanged).

Add new entries below (newest first). Use this template only; do not treat the template as history.

```markdown
### YYYY-MM-DD — <short title>

- **Reviewer:**
- **Commit / PR:**
- **Change category:** add_case | change_expectation | bundle_rotation | catalog_pointer | golden_update | alias_supplement_data | ranking_policy | regression_fix
- **Pinned bundle:** `bundle_id` + `search_index_sha256`
- **Matrix cases affected:**
- **Review note:** Why this change is approved and what contract it preserves or intentionally changes.
- **Validation:** Python pytest pass; runtime vitest pass; parity confirmed.
```
