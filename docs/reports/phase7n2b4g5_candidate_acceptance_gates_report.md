# Phase 7N2B4G5 — Recompose 7N2B Candidate and Run Gates

## Decision

```text
7N2B_CANDIDATE_GATES_PASS_READY_FOR_REVIEW_PACKAGING
```

This slice recomposed a 7N2B candidate under `/tmp` only and recorded gate
evidence. No catalog, web-public, runtime, source-table, or matrix edits.

## 1. Baseline bundle identity

| Field | Value |
| --- | --- |
| Featured mechanism | `web/.env.production` → `VITE_FEATURED_BUNDLE_ID=bundle_full_20260708_27643bb0` |
| Baseline path | `web/public/bundle_full_20260708_27643bb0/` |
| Baseline `bundle_id` | `bundle_full_20260708_27643bb0` |
| Baseline `content_sha256` | `sha256:27643bb092ff31117a133378db7562080c8b1d0d87fe111f5b83973e15a08484` |
| Baseline `norm_version` | `norm_v3` |

Preflight confirmed the baseline payload was not modified during this slice.

## 2. Recomposition inputs

| Input | Role |
| --- | --- |
| Featured `records.jsonl` / `search_index.jsonl` | Promoted 7N2A baseline |
| `data/ir/siralex_owner_lexical_v1.jsonl` | Owner lexical (add missing `Son` only) |
| `shared/aliases/source_aliases_v1.jsonl` | Includes `src_alias_phase7n2b_0001` (`moto`) |
| `shared/source_index_supplements/source_index_supplements_v1.jsonl` | Includes `src_supp_phase7n2b_0001` (`prix`) |
| Additive matrices | 7L (13), 7N2A (8), 7N2B (9) |

Approach: incremental from featured baseline (not a full Mali-Pense rebuild):

1. Normalize + enrich owner lexical IR.
2. Assemble featured records + missing owner row `3b8c3b7a0c5e897d` only (duplicate-`ir_id` guard).
3. Validate/apply source aliases onto featured search index.
4. Validate/generate/merge source-index supplements (`--defer-index-conflicts`).
5. `bundle_builder` assemble under `/tmp/phase7n2b4g5_candidate/`.

## 3. Candidate bundle identity and hashes

| Field | Value |
| --- | --- |
| `candidate_bundle_id` | `bundle_full_20260710_337619ff` |
| `candidate_bundle_path` | `/tmp/phase7n2b4g5_candidate/bundle_full_20260710_337619ff/` |
| `bundle_content_sha256` | `sha256:337619ff43131acde1390d7892d687372785729dac5d85abe82b61cc92285c3c` |
| `records_sha256` | `sha256:d99242ed0c049759ec265f3583683c99a3146854b4481b6d3de86cbd33f50a90` |
| `search_index_sha256` | `sha256:55bf98fc99a592f7003aa338fc7b4790bc9cd642b676c99a725d83a5f9ca79e3` |

Payload files present: `bundle.manifest.json`, `records.jsonl`, `search_index.jsonl`,
`checksums.sha256`. Not copied to `web/public`. No review ZIP.

## 4. Candidate counts

| Metric | Value |
| --- | --- |
| `records_count` | `19335` |
| `search_index_row_count` | `112265` |
| `new_owner_lexical_rows_added` | `1` (`3b8c3b7a0c5e897d` / `Son`) |
| `duplicate_ir_id_count` | `0` |
| Featured baseline records | `19333` |
| Assembled before new supplement mapping | `19334` |

## 5. Table application summary

| Step | Result |
| --- | --- |
| Alias validate/apply | `approved_alias_count: 23`; **newly applied on featured baseline: 1** (`moto`) |
| Supplement validate | `approved_supplement_count: 8` |
| Supplement generate | **applied: 1** (`prix`); already present: 7 (prior 7N2A/7B/7D rows) |
| Supplement merge | `added_key_count: 4`; `unexpected_change_count: 0` |

## 6. Semantic proof-query results

Against `/tmp/phase7n2b4g5_candidate/bundle_full_20260710_337619ff/`:

| Query | Result |
| --- | --- |
| `moto` | `["b5c9a49f6db2a991", "0a56b8047aeaf117"]` → `pópo` |
| `maman` | `["e5164efcdf5e6ca4"]` |
| `prix` | direct `["ffbf014bd96ffabf"]`; resolved `["3b8c3b7a0c5e897d"]`; display `Son` |
| `fièvre` | miss |
| `comment dit-on école` | miss |
| `combien ça coûte` | miss |
| `merci beaucoup` | miss |
| `papa` | `["b8053579e3035e88"]` → `bàba` / `bàwa` |
| `père` | `["423369d78d42c100"]` → `fà` |

## 7. Closed 7N2A guardrail results

| Query | Result |
| --- | --- |
| `hôpital` | resolved `["71e323e2dafa590f", "a9c7d82decee9191", "fefe9b063e05ed11"]` |
| `clinique` | resolved `["a9c7d82decee9191", "fefe9b063e05ed11"]` |
| `centre de santé` | resolved `["a9c7d82decee9191", "fefe9b063e05ed11"]` |
| `place` | `["96b72ff71179d689"]`; excludes owner health IDs |
| `location` | miss |
| `yoro` | miss |

## 8. Replay gate results

Temporary candidate-specific matrix/manifest copies under
`/tmp/phase7n2b4g5_candidate/replay/` (tracked files untouched). Real candidate
hashes filled only in those temp manifests.

| Gate | Result |
| --- | --- |
| Frozen 7L | **13 / 13 passed** |
| Additive 7N2A | **8 / 8 passed** |
| Additive 7N2B | **9 / 9 passed** |

## 9. Validator/test results

| Check | Result |
| --- | --- |
| Alias validate/apply | PASS |
| Supplement validate/generate/merge | PASS |
| Owner lexical normalize/enrich | PASS (3 IR → 1 new assembled) |
| Candidate semantic proofs | PASS |
| Candidate replay gates | PASS (13+8+9) |
| `pytest` aliases + supplements + enrichment + search_regression | **199 passed** |
| `git diff --check` | PASS |

## 10. Placeholder tracked-manifest status

Tracked `shared/search_regression/matrix_manifest_7n2b_v1.json` still contains:

```text
sha256:PENDING_7N2B_CANDIDATE_RECOMPOSITION
```

for both `search_index_sha256` and `bundle_content_sha256`. Not mutated in G5.
Finalization remains a later packaging/promotion decision.

## 11. Confirmation: no runtime / catalog / web-public / source / matrix / package changes

G5 created only this report in the repo. Candidate artifacts remain under
`/tmp/phase7n2b4g5_candidate/`. No edits to `web/`, catalog, featured/rollback
bundles, aliases, supplements, owner lexical IR, regression matrices, artifacts,
or packages.

## 12. Decision

```text
7N2B_CANDIDATE_GATES_PASS_READY_FOR_REVIEW_PACKAGING
```

## 13. Next slice definition

**Phase 7N2B4G6 — Package 7N2B Candidate Artifact for Review**

Purpose: package the accepted 7N2B candidate from `/tmp` as a review artifact
without changing catalog, production bundle, or user-visible runtime pointers.
