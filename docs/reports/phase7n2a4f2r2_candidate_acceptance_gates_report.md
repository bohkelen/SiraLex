# Phase 7N2A4F2-R2 — Candidate Acceptance Gates Report

## Acceptance decision

**ACCEPTED.**

```text
The 7N2A recomposed candidate passed both acceptance gates:
frozen 7L replay and additive 7N2A replay.
```

| Gate | Passed | Failed |
| --- | ---: | ---: |
| Frozen 7L | **13** | **0** |
| Additive 7N2A | **8** | **0** |

No package, catalog, production bundle, or runtime pointer was changed.
Candidate remains under `/tmp` only.

## 1. Candidate identity and hashes

| Field | Value |
| --- | --- |
| Workspace | `/tmp/phase7n2a4f2r2_acceptance/` |
| bundle_id | `bundle_full_20260708_27643bb0` |
| Bundle path | `/tmp/phase7n2a4f2r2_acceptance/bundle_full_20260708_27643bb0` |
| content_sha256 | `sha256:27643bb092ff31117a133378db7562080c8b1d0d87fe111f5b83973e15a08484` |
| records SHA-256 | `sha256:2c67c3f5446bfbfb078ed60f8d6e073fd0b105b816e714b6e14369c197e75f9e` |
| search_index SHA-256 | `sha256:b2ea152d8f83a0873111058f893e84435e3e0bda2d1f40afbaee0826f040bdd6` |
| norm_version | `norm_v3` |

## 2. Pipeline stages and commands

Authoritative inputs (unchanged tracked paths):

```text
data/ir/malipense_lexicon_v3.jsonl
data/ir/malipense_index_v1.jsonl
data/ir/siralex_owner_lexical_v1.jsonl
shared/target_variants/reviewed_target_variants_v1.jsonl
shared/aliases/source_aliases_v1.jsonl
shared/source_index_supplements/source_index_supplements_v1.jsonl
shared/search_regression/search_regression_matrix_v1.jsonl
shared/search_regression/matrix_manifest_v1.json
shared/search_regression/search_regression_matrix_7n2a_v1.jsonl
shared/search_regression/matrix_manifest_7n2a_v1.json
```

Stages executed under `/tmp/phase7n2a4f2r2_acceptance/` (same sequence as 4F2):

1. Preflight: overlay validate; alias validate against featured; matrix validate (7L + 7N2A).
2. Normalize (+ target-variant overlay).
3. Enrich (includes 7N2A4F1-S0 `record_locator` projection; duplicate locator tuples = 0).
4. Base search index (lexicographic posting order from 7N2A4F2-R1).
5. Alias validate/apply against pipeline enriched + base index.
6. Supplement validate/generate against pipeline enriched + alias index.
7. Supplement merge into final search index.
8. Bundle assembly (`bundle_builder.cli build`).
9. Temporary candidate manifests/matrices under `/tmp`.
10. Frozen 7L replay.
11. Additive 7N2A replay.

**Preflight note:** Featured-bundle supplement validation against
`web/public/bundle_full_20260616_phase7j_alias_round2_candidate/records.jsonl`
fails closed because that featured artifact lacks owner lexical IDs
`a9c7d82decee9191` / `fefe9b063e05ed11`. Pipeline stages 5–6 correctly used
this run’s enriched records (which include owner IR). Tracked matrices and
alias preflight against featured both passed.

## 3. Row/key counts

| Artifact | Count |
| --- | ---: |
| normalized rows | 19326 |
| enriched rows | 19326 |
| enriched with `record_locator` | 8825 |
| records with supplements | 19333 |
| base search-index rows | 112149 |
| alias search-index rows | 112237 |
| final search-index rows | 112257 |
| applied aliases | 22 |
| applied supplements | 7 |

## 4. Alias proof: maman / mère

| Query | Posting |
| --- | --- |
| `maman` | `["e5164efcdf5e6ca4"]` |
| `mère` | `["0f517a71c373f51d", "d540716db9321a83", "e5164efcdf5e6ca4"]` |

`mère` order matches frozen 7L (lexicographic posting repair).

## 5. Target variant proof: móbaa

| Query | Posting |
| --- | --- |
| `móbaa` | `["c5f78c8ac66eac6b"]` |
| `móyibaa` | `["c5f78c8ac66eac6b"]` |

## 6. Health supplement proof

| Query | Direct `actual_ir_ids` | `actual_resolved_target_ir_ids` |
| --- | --- | --- |
| `hôpital` | `["61843e6630c1fbae", "ff4ee495ef997adf"]` | `["71e323e2dafa590f", "a9c7d82decee9191", "fefe9b063e05ed11"]` |
| `clinique` | `["ff42659295a657dc"]` | `["a9c7d82decee9191", "fefe9b063e05ed11"]` |
| `centre de santé` | `["ffb73938da1a4576"]` | `["a9c7d82decee9191", "fefe9b063e05ed11"]` |

`hôpital` mapping `61843e6630c1fbae` → `e2533` / dándaso; supplement mapping
`ff4ee495ef997adf` → owner health targets in stored order.

## 7. Boundary proof: place / location / yoro

| Query | Result |
| --- | --- |
| `place` | `["96b72ff71179d689"]` (diya only; no health lexicon IDs) |
| `location` | miss |
| `yoro` | miss |

## 8. 7L replay result (formerly failing cases highlighted)

```text
13 / 13 passed
0 failed
```

| Case | Result | `actual_ir_ids` |
| --- | --- | --- |
| **sr7l_004_mere_multi** | **PASS** | `["0f517a71c373f51d", "d540716db9321a83", "e5164efcdf5e6ca4"]` |
| **sr7l_012_kun_accent_ambiguity** | **PASS** | `["753fa18e0a6df4ab", "e28e149f57ab616b"]` |
| **sr7l_013_kun_decomposed_unicode** | **PASS** | `["753fa18e0a6df4ab", "e28e149f57ab616b"]` |

All other 7L cases also passed.

Replay output: `/tmp/phase7n2a4f2r2_acceptance/7l_replay_report.json`

## 9. 7N2A replay result (resolved-target cases highlighted)

```text
8 / 8 passed
0 failed
```

| Case | Result | Notes |
| --- | --- | --- |
| 7n2a_maman_generic_mere_only | PASS | `["e5164efcdf5e6ca4"]` |
| 7n2a_mobaa_targets_moyibaa | PASS | `["c5f78c8ac66eac6b"]` |
| **7n2a_hopital_health_order** | **PASS** | resolved health order as above |
| **7n2a_clinique_health_only** | **PASS** | resolved owner health pair |
| **7n2a_centre_de_sante_health_only** | **PASS** | resolved owner health pair |
| 7n2a_place_preserves_diya_excludes_health | PASS | |
| 7n2a_location_absent | PASS | |
| 7n2a_yoro_absent | PASS | |

Replay output: `/tmp/phase7n2a4f2r2_acceptance/7n2a_replay_report.json`

## 10. Temporary manifest/matrix-copy details

Created under `/tmp/phase7n2a4f2r2_acceptance/` only:

| Path | Purpose |
| --- | --- |
| `matrix_manifest_7l_candidate.json` | 7L manifest with candidate identity |
| `matrix_manifest_7n2a_candidate.json` | 7N2A additive manifest with candidate identity |
| `search_regression_matrix_7l_candidate.jsonl` | 7L matrix copy |
| `search_regression_matrix_7n2a_candidate.jsonl` | 7N2A matrix copy |

Rewritten fields only:

```text
manifest: bundle_id, search_index_sha256, bundle_content_sha256, norm_version
matrix rows: bundle_id
```

**Confirmation:** tracked matrices/manifests under
`shared/search_regression/` were not modified (`git status` clean for that tree).

## 11. Confirmation: no package / catalog / runtime / production bundle change

- No package generation.
- No catalog publication.
- No copy into `web/public`.
- No tracked API/data/alias/supplement/matrix edits in this slice.
- Only tracked deliverable: this report.

## 12. Acceptance decision (restated)

Both gates passed. The `/tmp` candidate
`bundle_full_20260708_27643bb0` is **accepted for review packaging**.

It is **not** promoted to production runtime.

## 13. Next slice

```text
Phase 7N2A4F3 — Package 7N2A Candidate Artifact for Review
```

Purpose: package the accepted `/tmp` candidate into a reviewable artifact
without changing catalog or production runtime pointers.

## Explicit statement

```text
Phase 7N2A4F2-R2 re-runs the 7N2A candidate acceptance gates after the resolved
target assertion and posting-order repairs. No package, catalog, or user-visible
runtime artifact changed.
```
