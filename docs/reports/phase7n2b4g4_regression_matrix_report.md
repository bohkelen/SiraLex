# Phase 7N2B4G4 — Add 7N2B Regression Matrix

## Decision

```text
7N2B_ADDITIVE_MATRIX_READY
```

This slice adds an additive 7N2B regression matrix only. No runtime, catalog,
bundle, alias, supplement, owner-lexical, or frozen 7L / 7N2A matrix changes.

## 1. G3 implemented inputs

From `docs/reports/phase7n2b4g3_linguistic_tables_report.md`:

| Artifact | ID / value |
| --- | --- |
| `moto` alias | `src_alias_phase7n2b_0001` |
| `prix` owner lexical | `3b8c3b7a0c5e897d` (`Son`) |
| `prix` supplement | `src_supp_phase7n2b_0001` |
| G3 generated mapping (implementation detail) | `ffbf014bd96ffabf` |
| Deferred | `fièvre` |

Featured baseline remains `bundle_full_20260708_27643bb0`.

## 2. Matrix files created

| Path | Role |
| --- | --- |
| `shared/search_regression/search_regression_matrix_7n2b_v1.jsonl` | 9 additive cases |
| `shared/search_regression/matrix_manifest_7n2b_v1.json` | Manifest (`phase7n2a_additive` family) |
| `docs/reports/phase7n2b4g4_regression_matrix_report.md` | This report |

Frozen 7L and 7N2A matrices were not modified.

## 3. Full row inventory

| case_id | query | expected | id_space | expected_ir_ids |
| --- | --- | --- | --- | --- |
| `7n2b_moto_transport_alias` | `moto` | `hit_multi` | `direct_ir_ids` | `b5c9a49f6db2a991`, `0a56b8047aeaf117` |
| `7n2b_maman_still_generic_mere_only` | `maman` | `hit_single` | `direct_ir_ids` | `e5164efcdf5e6ca4` |
| `7n2b_prix_owner_son` | `prix` | `hit_single` | `resolved_target_ir_ids` | `3b8c3b7a0c5e897d` |
| `7n2b_fievre_deferred_miss` | `fièvre` | `miss` | `direct_ir_ids` | `[]` |
| `7n2b_phrase_comment_dit_on_ecole_miss` | `comment dit-on école` | `miss` | `direct_ir_ids` | `[]` |
| `7n2b_phrase_combien_ca_coute_miss` | `combien ça coûte` | `miss` | `direct_ir_ids` | `[]` |
| `7n2b_phrase_merci_beaucoup_miss` | `merci beaucoup` | `miss` | `direct_ir_ids` | `[]` |
| `7n2b_papa_distinct` | `papa` | `hit_single` | `direct_ir_ids` | `b8053579e3035e88` |
| `7n2b_pere_distinct` | `père` | `hit_single` | `direct_ir_ids` | `423369d78d42c100` |

`excluded_ir_ids` is **not** in the current case schema. Distinctness / exclusion
semantics are encoded by exact expected postings (and notes). No schema change
in G4.

## 4. Manifest summary

| Field | Value |
| --- | --- |
| `matrix_family` | `phase7n2a_additive` (reused; no new family) |
| `case_count` | `9` |
| `norm_version` | `norm_v3` |
| `bundle_id` | `bundle_full_phase7n2b_recomposed_candidate_tbd` |
| `catalog_version` | `phase7n2b-candidate-not-yet-published` |
| `search_index_sha256` | `sha256:PENDING_7N2B_CANDIDATE_RECOMPOSITION` |
| `bundle_content_sha256` | `sha256:PENDING_7N2B_CANDIDATE_RECOMPOSITION` |

There is no separate `matrix_id` / `matrix_path` field in the existing manifest
schema; identity is the tracked file path
`shared/search_regression/matrix_manifest_7n2b_v1.json` plus
`search_regression_matrix_7n2b_v1.jsonl`.

## 5. Placeholder hash / bundle fields

Tracked manifest hashes and `bundle_id` are explicit placeholders:

```text
PENDING_7N2B_CANDIDATE_RECOMPOSITION
```

Same convention as the 7N2A additive manifest before candidate recomposition.
Real checksums and the published candidate bundle id are filled in
**Phase 7N2B4G5**.

## 6. Validation results

| Check | Result |
| --- | --- |
| Matrix load + `validate_matrix` | PASS (0 errors; 9 rows; family `phase7n2a_additive`) |
| `pytest api/search_regression/tests/` | PASS (86) |
| `git diff --check` | PASS |

Command used (repo convention):

```bash
PYTHONPATH=api:shared python3 -c \
  "from search_regression.schema import load_matrix_jsonl, load_matrix_manifest; \
   from search_regression.validate_matrix import validate_matrix; ..."
```

## 7. Temporary replay result

Workspace: `/tmp/phase7n2b4g4_regression_matrix/` (not committed).

Reused G3 temporary artifacts (`search_index_final.jsonl`, augmented records +
generated supplement records) under a temp bundle directory named to match the
placeholder `bundle_id`. A **temporary** replay-only manifest filled real
`search_index_sha256` for checksum verification; tracked placeholders were not
changed.

```text
7N2B additive: 9 / 9 passed
```

Notable: `7n2b_prix_owner_son` matched via `resolved_target_ir_ids`
(`3b8c3b7a0c5e897d` / `Son`) while the direct posting remained generated mapping
`ffbf014bd96ffabf`.

Official gated replay against a recomposed candidate remains **G5**.

## 8. Confirmation: no runtime / catalog / bundle / source / alias / supplement / owner lexical / package changes

G4 created only the additive matrix, its placeholder manifest, and this report.
No edits to `web/`, `data/`, aliases, supplements, target variants, 7L/7N2A
matrices, catalog, bundles, artifacts, or packages.

## 9. Decision

```text
7N2B_ADDITIVE_MATRIX_READY
```

## 10. Next slice definition

**Phase 7N2B4G5 — Recompose 7N2B Candidate and Run Gates**

Purpose: recompose a 7N2B candidate from promoted 7N2A featured baseline plus
approved 7N2B tables, then run frozen 7L and additive 7N2B gates.
