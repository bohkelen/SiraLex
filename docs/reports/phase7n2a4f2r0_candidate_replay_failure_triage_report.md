# Phase 7N2A4F2-R0 — Candidate Replay Failure Triage

## Acceptance status

The 4F2 recomposition produced a candidate artifact under /tmp, but candidate
acceptance is blocked because the frozen 7L replay and additive 7N2A replay did
not both pass.

This triage supersedes only the acceptance conclusion of
`docs/reports/phase7n2a4f2_candidate_recomposition_report.md`. Generated-candidate
identity, hashes, and stage facts from that report remain valid as generation
evidence, not as acceptance evidence.

## 1. Candidate identity under triage

| Field | Value |
| --- | --- |
| Workspace | `/tmp/phase7n2a4f2_rerun/` |
| bundle_id | `bundle_full_20260708_ee2a6ab0` |
| content_sha256 | `sha256:ee2a6ab08404763be31b1faf6383d4d503a02d4ed240b32d3da7acef63477109` |
| Bundle path | `/tmp/phase7n2a4f2_rerun/bundle_full_20260708_ee2a6ab0` |
| Featured baseline for comparison | `web/public/bundle_full_20260616_phase7j_alias_round2_candidate` |

No candidate rebuild was performed in this slice.

## 2. Replay failure summary

| Gate | Passed | Failed | Failed cases |
| --- | ---: | ---: | --- |
| Frozen 7L | 10 | 3 | `sr7l_004_mere_multi`, `sr7l_012_kun_accent_ambiguity`, `sr7l_013_kun_decomposed_unicode` |
| Additive 7N2A | 5 | 3 | `7n2a_hopital_health_order`, `7n2a_clinique_health_only`, `7n2a_centre_de_sante_health_only` |

All six failures are order/identity assertion mismatches. No miss/hit-status
collapse was observed for these queries.

## 3. 7L ordering failure analysis

### Shared method

For each failed case, compared:

1. Expected order from tracked `shared/search_regression/search_regression_matrix_v1.jsonl`
2. Featured Phase 7J bundle search-index order
3. 4F2 candidate bundle search-index order
4. Intermediate recomposition stages:
   - `search_index_base_7n2a.jsonl`
   - `search_index_alias_7n2a.jsonl`
   - `search_index_final_7n2a.jsonl`
5. Record-stream order in IR / normalized / enriched / featured / candidate records
6. Rebuild of a search index from featured `records.jsonl` using the **current**
   `api/search_index/build_index.py` builder

### Case `sr7l_004_mere_multi`

| Source | `mère` posting order |
| --- | --- |
| Expected (7L matrix) | `["0f517a71c373f51d", "d540716db9321a83", "e5164efcdf5e6ca4"]` |
| Featured Phase 7J | `["0f517a71c373f51d", "d540716db9321a83", "e5164efcdf5e6ca4"]` |
| Candidate / base / alias / final | `["d540716db9321a83", "e5164efcdf5e6ca4", "0f517a71c373f51d"]` |
| Current builder rebuild from featured records | `["d540716db9321a83", "e5164efcdf5e6ca4", "0f517a71c373f51d"]` |

Set membership is identical; only order differs.

Ordering origin:

- IR / normalized / enriched / featured / candidate **record stream order** for
  these three mapping IDs is the same:
  `d540716db9321a83` → `e5164efcdf5e6ca4` → `0f517a71c373f51d`.
- Current search-index builder posts by first-seen record contribution to key
  `mère`. Because `d540716db9321a83` appears earlier and contributes `mère` via
  `search_keys.casefold`, it becomes first in the rebuilt/candidate posting.
- Featured pinned `search_index.jsonl` does **not** match that first-seen order.
- Alias and supplement layers do not change `mère` order (base == alias == final).
- Target-variant overlay is not involved (source-side mapping key).

Classification for this case:

```text
Primary: E — search-index builder ordering semantics
Secondary: A — canonical recomposition uses the current builder, so it inherits
           the divergence from the featured pinned index artifact
Not: B, C, D, F, G
```

Fix ownership:

```text
search-index builder deterministic compatibility
(or explicit governance decision if first-seen order is intentionally preferred
over the frozen 7L/featured posting order)
```

### Case `sr7l_012_kun_accent_ambiguity`

| Source | `Kùn` / `tgt_casefold:kùn` posting order |
| --- | --- |
| Expected (7L matrix) | `["753fa18e0a6df4ab", "e28e149f57ab616b"]` |
| Featured Phase 7J | `["753fa18e0a6df4ab", "e28e149f57ab616b"]` |
| Candidate / base / alias / final | `["e28e149f57ab616b", "753fa18e0a6df4ab"]` |
| Current builder rebuild from featured records | `["e28e149f57ab616b", "753fa18e0a6df4ab"]` |

Set membership is identical; only order differs.

Ordering origin:

- IR / normalized / enriched / featured / candidate lexicon record stream order
  is `e28e149f57ab616b` then `753fa18e0a6df4ab`.
- Current builder first-seen posting therefore yields
  `["e28e149f57ab616b", "753fa18e0a6df4ab"]`.
- Featured pinned index stores the reverse order.
- Alias/supplement/overlay layers do not alter this target key.

Classification:

```text
Primary: E — search-index builder ordering semantics
Secondary: A — recomposition inherits current builder order
Not: B, C, D, F, G
```

Fix ownership:

```text
search-index builder deterministic compatibility
(or explicit governance decision vs frozen 7L order)
```

### Case `sr7l_013_kun_decomposed_unicode`

Same key family and same actual posting as `sr7l_012` (`tgt_casefold:kùn`).
Same expected order, same candidate/featured divergence, same root cause.

Classification and fix ownership: identical to `sr7l_012`.

### 7L cross-case conclusion

Temporary matrix/manifest rewrite is **not** the cause: temporary matrices only
rewrote `bundle_id`; expected `expected_ir_ids` order was preserved, and featured
replay still matches those expectations.

The three 7L failures are **not** caused by 7N2A overlays, aliases, or health
supplements. They are already present in the Stage 3 base search index and are
reproduced by rebuilding an index from the featured records with the current
builder. The featured Phase 7J `search_index.jsonl` therefore encodes a posting
order that the current builder does not regenerate.

## 4. 7N2A resolved-target replay mismatch analysis

### Shared method

For each failed additive case, compared:

- matrix `expected_ir_ids` (intended resolved target lexicon IDs)
- actual source-index posting IDs returned by current replay
- resolved target lexicon IDs obtained by expanding each posting mapping’s
  `display.target_entries[].anchor` through Mali-Pense and owner lexical IR

### Case `7n2a_hopital_health_order`

| Field | Value |
| --- | --- |
| Query | `hôpital` |
| Actual source posting IDs | `["61843e6630c1fbae", "ff4ee495ef997adf"]` |
| Resolved target IDs | `["71e323e2dafa590f", "a9c7d82decee9191", "fefe9b063e05ed11"]` |
| Intended 7N2A contract | `["71e323e2dafa590f", "a9c7d82decee9191", "fefe9b063e05ed11"]` |
| Resolved match | **yes** |

Posting composition:

- `61843e6630c1fbae` — Mali-Pense `index_mapping` → `dándaso` (`71e323e2dafa590f`)
- `ff4ee495ef997adf` — owner-reviewed supplement mapping →
  `ndándayoro` then `ndándadiya`

Replay fails because it compares mapping IDs to lexicon IDs and also expects
count `3` while the source index stores `2` mapping postings that resolve to
three targets.

### Case `7n2a_clinique_health_only`

| Field | Value |
| --- | --- |
| Query | `clinique` |
| Actual source posting IDs | `["ff42659295a657dc"]` |
| Resolved target IDs | `["a9c7d82decee9191", "fefe9b063e05ed11"]` |
| Intended 7N2A contract | `["a9c7d82decee9191", "fefe9b063e05ed11"]` |
| Resolved match | **yes** |

### Case `7n2a_centre_de_sante_health_only`

| Field | Value |
| --- | --- |
| Query | `centre de santé` |
| Actual source posting IDs | `["ffb73938da1a4576"]` |
| Resolved target IDs | `["a9c7d82decee9191", "fefe9b063e05ed11"]` |
| Intended 7N2A contract | `["a9c7d82decee9191", "fefe9b063e05ed11"]` |
| Resolved match | **yes** |

### 7N2A cross-case conclusion

Candidate health behavior is correct under the approved 7N2A resolved-target
contracts. The additive matrix encodes those contracts as lexicon IDs, while the
current search-regression replay asserts direct source-index posting IDs.

## 5. Determination of candidate behavior vs runner/matrix behavior

| Failure class | Candidate behavior | Runner/matrix behavior | Verdict |
| --- | --- | --- | --- |
| 7L `mère` / `Kùn` / NFD `kùn` | Same ID set as featured; different posting order from featured pinned index | Frozen 7L matrix correctly encodes featured order | Candidate recomposition via current search-index builder is **not 7L-order-compatible** |
| 7N2A health queries | Resolved targets match intended contracts | Matrix expects lexicon IDs; replay compares mapping IDs | Candidate health behavior is **correct**; assertion model is **insufficient** |

## 6. Recommended repair sequence

1. **Phase 7N2A4F1-S — Source Mapping Resolution Assertions for Search Regression**
   - Purpose: add narrow regression support for source-to-target cases that need
     to compare resolved target lexicon IDs instead of direct source mapping IDs.
   - Unblocks additive 7N2A health assertions without weakening the frozen 7L gate.

2. **Phase 7N2A4F2-R1 — Preserve 7L Ordering in Canonical Recomposition**
   - Purpose: repair recomposition so the candidate remains green against frozen
     7L ordering contracts before candidate acceptance.
   - Focus: search-index builder deterministic compatibility with featured/7L
     posting order (or an explicit governance decision if first-seen order is
     intentionally preferred, which would then require authorized 7L matrix
     revision — not recommended as a silent shortcut).

3. Re-run candidate acceptance gates only after both repairs land.

## 7. Explicit forbidden shortcuts

- Do not rewrite frozen 7L expected orders solely to match current builder output
  without an explicit governance decision.
- Do not treat mapping IDs as interchangeable with lexicon IDs in additive cases.
- Do not patch `/tmp` indexes by hand to force featured order.
- Do not promote the 4F2 candidate, update catalog, or package while either gate
  remains red.
- Do not weaken 7L seed/order contracts to greenwash recomposition.

## 8. Next slice definition

### Immediate next slice

```text
Phase 7N2A4F1-S — Source Mapping Resolution Assertions for Search Regression
```

Purpose:

```text
Add narrow regression support for source-to-target cases that need to compare
resolved target lexicon IDs instead of direct source mapping IDs.
```

### Subsequent slice after 7L ordering ownership is confirmed

```text
Phase 7N2A4F2-R1 — Preserve 7L Ordering in Canonical Recomposition
```

Purpose:

```text
Repair recomposition so the candidate remains green against frozen 7L ordering
contracts before candidate acceptance.
```

Neither repair is implemented in this triage slice.
