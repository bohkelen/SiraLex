# Phase 7N2A4F1-S — Source Mapping Resolution Assertions for Search Regression

## Status

**Complete.** Search regression can assert resolved target lexicon IDs for
source mapping cases without changing the default direct source-index posting
behavior used by the frozen 7L gate.

Depends on **7N2A4F1-S0** lexicon `record_locator` projection. This slice does
**not** rebuild a candidate, package, catalog, or runtime artifact.

## 1. Root issue

For source-to-target health queries, search-index postings are mapping IDs:

| Query | Direct postings |
| --- | --- |
| `hôpital` | `["61843e6630c1fbae", "ff4ee495ef997adf"]` |
| `clinique` | `["ff42659295a657dc"]` |
| `centre de santé` | `["ffb73938da1a4576"]` |

The additive 7N2A contract expects resolved target lexicon IDs:

| Query | Expected resolved targets |
| --- | --- |
| `hôpital` | `["71e323e2dafa590f", "a9c7d82decee9191", "fefe9b063e05ed11"]` |
| `clinique` / `centre de santé` | `["a9c7d82decee9191", "fefe9b063e05ed11"]` |

Candidate behavior was already correct; the replay assertion model was not.

## 2. `expected_id_space` schema behavior

Optional matrix field:

```json
"expected_id_space": "direct_ir_ids" | "resolved_target_ir_ids"
```

| Rule | Behavior |
| --- | --- |
| Missing field | Defaults to `direct_ir_ids` |
| `direct_ir_ids` | Existing behavior: compare search-index posting IDs to `expected_ir_ids` |
| `resolved_target_ir_ids` | Valid only when `direction == source_to_target`; compare resolved target lexicon IDs to `expected_ir_ids` |
| Unknown value | Fail closed at matrix load |
| `resolved_target_ir_ids` + `target_to_source` | Fail closed at matrix validation |
| `expected_result_count` | Must equal `len(expected_ir_ids)` in the selected ID space |

Frozen 7L matrix/manifest were **not** modified; they rely on the default.

## 3. Resolver strategy

For `resolved_target_ir_ids` cases, replay:

1. Runs normal search and keeps direct posting IDs as `actual_ir_ids`.
2. Loads bundle `records.jsonl`.
3. For each direct posting ID, loads the `index_mapping` record.
4. Expands `display.target_entries` in stored order.
5. Resolves each entry via durable locator metadata only:

```text
target_entries[].anchor
target_entries[].lexicon_url
lexicon.record_locator.source_record_id
lexicon.record_locator.url_canonical
```

Owner rows may also resolve through:

```text
provenance.source.record_pointer.url_canonical
provenance.source.record_pointer.source_record_id
```

URL compatibility accepts exact matches and relative Mali-Pense path suffixes
(e.g. `../lexicon/d.htm` vs canonical `.../emk/lexicon/d.htm`).

**Display-text matching is never used.**

## 4. Fail-closed cases

| Condition | Error |
| --- | --- |
| Unknown `expected_id_space` | Matrix load error |
| `resolved_target_ir_ids` with `target_to_source` | Matrix validation error |
| Direct posting ID missing from records | `TargetResolutionError` |
| Direct posting is not `index_mapping` | `TargetResolutionError` |
| Target entry missing `anchor` / `lexicon_url` | `TargetResolutionError` |
| Zero lexicon matches | `TargetResolutionError` |
| Ambiguous (multiple lexicon `ir_id`s) | `TargetResolutionError` |

## 5. 7N2A matrix rows updated

In `shared/search_regression/search_regression_matrix_7n2a_v1.jsonl` only:

```text
7n2a_hopital_health_order
7n2a_clinique_health_only
7n2a_centre_de_sante_health_only
```

Each now includes `"expected_id_space": "resolved_target_ir_ids"` while keeping
existing resolved-target `expected_ir_ids`.

Unchanged:

```text
shared/search_regression/search_regression_matrix_v1.jsonl
shared/search_regression/matrix_manifest_v1.json
shared/search_regression/matrix_manifest_7n2a_v1.json
```

## 6. Proof default 7L direct behavior remains unchanged

- 7L matrix rows still omit `expected_id_space` → loader defaults to `direct_ir_ids`.
- Featured 7L replay against
  `web/public/bundle_full_20260616_phase7j_alias_round2_candidate` remains green
  (13/13).
- Records are loaded only when a matrix contains at least one
  `resolved_target_ir_ids` case; 7L runs do not require locator metadata.
- Golden Python replay fixture updated intentionally to include
  `expected_id_space: "direct_ir_ids"` on every case output (backward-compatible
  assertion semantics; additive output field only).

## 7. Test commands and results

```bash
git diff --check
pytest api/search_regression/tests/ -q          # 86 passed
pytest api/enrichment/tests/ -q                 # 50 passed
pytest api/source_aliases/tests/ -q             # 30 passed
pytest api/source_index_supplements/tests/ -q   # 33 passed
PYTHONPATH=api:shared python3 -c "...validate 7N2A matrix..."
# 7N2A matrix rows= 8 errors= 0
```

## 8. Confirmation: no candidate / package / catalog / runtime change

No candidate recomposition, bundle generation, package generation, catalog
publication, enrichment rerun, alias/supplement change, or frontend/runtime
change in this slice. Assertion tooling and additive matrix rows only.

## 9. Next slice

```text
Phase 7N2A4F2-R1 — Preserve 7L Ordering in Canonical Recomposition
```

Fix search-index builder / recomposition posting order so rebuilt candidates
preserve frozen 7L ordered expectations for `mère` / `Kùn` / NFD `kùn`.

## Explicit statement

```text
Search regression can now assert resolved target lexicon IDs for source mapping
cases without changing the default direct source-index posting behavior used by
the frozen 7L gate.
```
