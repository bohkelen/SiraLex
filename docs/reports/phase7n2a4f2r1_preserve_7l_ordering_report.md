# Phase 7N2A4F2-R1 — Preserve 7L Ordering in Canonical Recomposition

## Status

**Complete.** Canonical search-index builder posting order is deterministic
lexicographic `ir_id` sort, matching featured Phase 7J / frozen 7L contracts.

No candidate, package, catalog, or user-visible runtime artifact changed.

## 1. Root cause from F2-R0

Current builder posted by first-seen record-stream order. Featured Phase 7J
`search_index.jsonl` (and frozen 7L expectations) use a different order.
Alias/supplement/overlay layers were not the cause.

## 2. Ordering rule discovered

Investigation over all **12,321** featured multi-posting keys:

| Check | Result |
| --- | --- |
| Featured multi-posting lists == lexicographic `ir_id` sort | **12,321 / 12,321** |
| Featured == previous first-seen rebuild | 4,531 / 12,321 |
| Diffs explained by sorting the same ID set lexicographically | 7,786 / 7,790 |
| Remaining 4 diffs | alias-only `grand-parents` keys absent from records rebuild |

**Rule A confirmed:** featured posting order is deterministic lexicographic
`ir_id` ordering within each search-index posting list.

## 3. Exact implementation change

`api/search_index/build_index.py`:

- After collecting unique postings, sort each posting list with
  `sorted(ir_ids)` (lexicographic `ir_id`).
- `serialize_index` also applies the same sort (defense in depth).
- Dedup remains first-seen uniqueness; duplicates still impossible in output.
- Source/target key families unchanged.

Authorized downstream test alignment:

A downstream source-index-supplement test expected first-seen posting order for
`tante`. After the builder ordering rule was confirmed as lexicographic `ir_id`
ordering across featured multi-posting keys, that assertion was updated to match
the canonical builder contract. No supplement implementation or supplement data
changed.

File: `api/source_index_supplements/tests/test_source_index_supplements.py`
(`test_generated_records_produce_expected_source_search_rows` only).

Merge-path assertions that encode append-into-existing-postings behavior were
left unchanged (merge does not rebuild via the search-index builder).

## 4. Before/after order

| Key | Before (first-seen rebuild) | After (lex sort) / featured / 7L |
| --- | --- | --- |
| `src_casefold:mère` | `d540…`, `e516…`, `0f51…` | `0f51…`, `d540…`, `e516…` |
| `tgt_casefold:kùn` | `e28e…`, `753f…` | `753f…`, `e28e…` |
| NFD `kùn` (same key) | same as above | same as above |

`/tmp/phase7n2a4f2r1_ordering/` rebuild from featured `records.jsonl`:
all **12,317** multi-posting keys shared with featured match exactly.

## 5. Proof 7L default direct replay remains green

```bash
pytest api/search_regression/tests/ -q
# includes featured 7L 13/13 and golden replay
```

## 6. Proof 7N2A resolved-target assertion tests remain green

Same search-regression suite includes
`test_resolved_target_assertions.py` (7N2A4F1-S).

## 7. Proof health ordering remains semantically correct

`hôpital` mapping IDs `["61843e6630c1fbae", "ff4ee495ef997adf"]` are
lex-stable with the dándaso mapping first. Resolved-target order for health
queries remains `target_entries` expansion order (unchanged by posting sort).

## 8. Test commands and results

```bash
git diff --check
pytest api/search_index/tests/ -q
pytest api/search_regression/tests/ -q
pytest api/enrichment/tests/ -q
pytest api/source_aliases/tests/ -q
pytest api/source_index_supplements/tests/ -q
```

## 9. Confirmation: no candidate / package / catalog / runtime change

No candidate recomposition, package generation, catalog publication, or
frontend/runtime change. Builder ordering + tests + report only.

## 10. Next slice

```text
Phase 7N2A4F2-R2 — Re-run 7N2A Candidate Acceptance Gates
```

Recompose a candidate under `/tmp` with the repaired builder and re-run frozen
7L + additive 7N2A acceptance gates.

## Explicit statement

```text
Phase 7N2A4F2-R1 preserves frozen 7L posting-order compatibility during
canonical recomposition. No candidate, package, catalog, or user-visible runtime
artifact changed.
```
