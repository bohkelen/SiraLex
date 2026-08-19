# SQ1D1 — FR Exact Source-Term Result Promotion

## Decision

```text
SQ1D1_FR_SOURCE_TERM_PROMOTION_IMPLEMENTED
```

## Base commit

```text
ffb472cb159c8437383491a8657680ff7d6c1f7f
```

`git log -1` at slice start: `ffb472c Add French ligature query expansion`.

## Current ranking behavior

Unchanged except the FR→MNK post-resolve partition below.

- Exact ladder still returns stored `ir_ids[]` and stops at the first non-empty rung.
- SQ1C variant retries still return the variant key’s stored list.
- SQ1B suggestions remain a miss-only side list.
- EN→MNK, MNK→FR, and MNK→EN lists are not reordered.

## New FR-only stable partition rule

After `resolveRecords`, consumer search applies `partitionFrExactSourceTermHits`:

1. Walk the already-returned records once (O(n)).
2. Records whose `display.source_term` matches the ladder hit go first.
3. All other records follow.
4. Relative order inside each group is preserved (stable partition, not `sort`).

Example: `[nonmatch, match, match, nonmatch]` → `[match, match, nonmatch, nonmatch]`.

Featured `mère` fixture (deterministic unit records, same ids/source_terms as SQ1D):

`oh, mère!` → formula → `mère` becomes `mère` → `oh, mère!` → formula.

When no `source_term` matches (e.g. `moto` → `motocycle` / `motocyclette`), stored order is unchanged.

## Match normalization rule

A record is promoted only if:

- `ir_kind === "index_mapping"` and `display.source_term` is a string
- `computeSearchKeys([NFC(trim(source_term))])[matched_key_type][0] === matched_key`

`matched_key` / `matched_key_type` come from `SearchResult` (the rung that actually hit). Raw typed text is not used when those are present, so variant hits compare against `grand-pere` / `soeur`, not the original surface.

Not used: English gloss, Maninka form, examples, subentries, `preferred_form`, or rendered card text. Missing `display.source_term` is not approximated.

## Language boundary

Applied only when `LookupMode.from === "fr"` and `LookupMode.to === "mnk"`. Gate is LookupMode, not UI locale.

## Search-stage boundary

Applied only to exact-key and SQ1C variant exact-hit record lists in `runSearch`.

Not applied to prefix suggestions. No extra IDB reads. No rung merge. Variant retry order unchanged.

## Variant-hit behavior

`separator_variant_query` meta copy is unchanged. Promotion uses the variant walk’s `matched_key` + `matched_key_type`.

## Suggestion impact

None. `rankPrefixSuggestionKeys` contract unchanged (re-asserted in unit tests).

## Query-log / CF2 impact

| Surface | Change |
|---------|--------|
| Query-log schema | **None** |
| CF2 schema | **None** |
| IndexedDB | Still **v6** |
| `matched_ir_ids` on a hit | Same field; order follows the partitioned record list (not a schema change) |

## Performance cost

O(n) over already-resolved records. One `computeSearchKeys` per mapping row in the hit list (typically n ≤ 6 for FR; featured max posting is 26). No scans, no extra IDB, no ranking table.

## No-go confirmations

| Item | Result |
|------|--------|
| EN / MNK result ranking | Not applied |
| Prefix suggestions as results | No |
| Ladder rung merge | No |
| Fuzzy / AI / popularity / CF2 / logs | No |
| Dictionary / corpus / index rebuild | No |
| Russian return | No |
| N’Ko synthesis | No |

## Files changed

| Path | Change |
|------|--------|
| `web/src/search/search_result_ranking.ts` | New partition helper |
| `web/src/search/search_result_ranking.test.ts` | Unit tests (mère fixture, FR-only, variants, moto, no approximation) |
| `web/src/search/search_query.ts` | Comment: promotion is post-resolve |
| `web/src/search/search_query.test.ts` | Stored posting order + no rung merge for `mère` |
| `web/src/main.ts` | Apply partition after `resolveRecords` |
| `docs/reports/sq1d1_fr_source_term_promotion_report.md` | This report |

E2E: UX2 search / ML1D2 picker debug bundles have single-id FR keys (`alpha_fr`, …). No consumer fixture exposes `mère` multi-hit order. Ranking is covered by unit tests; E2E only proves existing FR search still works.

## Tests / build

| Command | Result |
|---------|--------|
| `npm --prefix web run test:run` | **1050 passed** (107 files), including 12 new ranking tests |
| `npm --prefix web run test:e2e:ux2-search` | **4 passed** (debug bundle; no multi-hit `mère` fixture) |
| `npm --prefix web run test:e2e:ml1d2-picker` | **18 passed** (picker/ML1D3/RL1/ML1E/DU1; no ranking-order assertion) |
| `npm --prefix web run build` | **PASS** (`tsc` + vite) |
| `git diff --check` | **PASS** |

`mère` regression is a deterministic unit fixture (same ids/source_terms as featured SQ1D). Debug E2E bundles only have single-id FR keys.

## git diff --check

PASS

## Working tree

Runtime + tests + this report. Pre-existing untracked `web/scripts/` and `docs/reports/sq1d_search_ranking_audit.md` are unrelated to this slice’s runtime. No dictionary/corpus/index artifacts. Commit not created.
