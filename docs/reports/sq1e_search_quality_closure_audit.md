# SQ1E — Search Quality Closure Audit

## 1. Decision

```text
SQ1E_SEARCH_QUALITY_CLOSURE_AUDIT_COMPLETE
```

Audit only. No runtime, UI, schema, dictionary, corpus, or index changes.

The four shipped slices compose as one LookupMode-gated pipeline. Exact search still wins; variants retry only after a miss; prefix suggestions run only after exact **and** variant miss; FR source-term promotion reorders already-returned FR→MNK records only. No multilingual leakage, Russian return, N’Ko synthesis, schema bump, or corpus mutation was found.

## 2. Base commit

```text
6cbb3ebded1914d40fe1883def337d48b970f0e5
```

`git log -1`: `6cbb3eb Promote exact French source term hits`.

Shipped slices on this branch:

| Slice | Commit |
|-------|--------|
| SQ1B | `03c3099` Add prefix search suggestions |
| SQ1C1 | `b61f6ad` Add hyphen space query expansion |
| SQ1C2 | `ffb472c` Add French ligature query expansion |
| SQ1D | `a477e71` Audit search result ranking |
| SQ1D1 | `6cbb3eb` Promote exact French source term hits |

Working tree at audit: `?? web/scripts/` only (unrelated screenshot helper).

## 3. Search order verification

Consumer path (`searchQueryForLookupMode` then `runSearch`):

1. Exact ladder on the **original** query (all four LookupMode pairs).
2. If `ir_ids.length > 0`, return immediately (`separator_variant_query` null). **No variants. Host does not call prefix lookup.**
3. Else `safeQueryVariants`: FR ligature (≤1) then FR/EN hyphen↔space (≤2). First variant hit wins.
4. If still empty, host `lookupPrefixSuggestionsForLookupMode` (min normalized length 3, cap 8). Suggestions never merge into `ir_ids[]`.
5. FR→MNK hits only: after `resolveRecords`, `partitionFrExactSourceTermHits` (stable partition).

Legacy `searchQuery()` still walks the ladder only (no variants). That is intentional; consumer search uses LookupMode.

**Verdict: PASS.**

## 4. LookupMode boundary matrix

Family selection is `indexFamilyForLookupInput(LookupMode.from)`: FR → `src_*`, EN → `en_*`, MNK → `tgt_*`. Russian is not a lookup language. UI locale is not consulted.

| Mode | Exact family | Ligature | Hyphen/space | Prefix family | Ranking |
|------|--------------|----------|--------------|---------------|---------|
| FR→MNK | `src_*` | yes | yes | `src_*` | source_term promote |
| EN→MNK | `en_*` | **no** | yes | `en_*` | stored order |
| MNK→FR | `tgt_*` | **no** | **no** | `tgt_*` | stored order |
| MNK→EN | `tgt_*` | **no** | **no** | `tgt_*` | stored order |

Leakage tests: FR `hou` does not suggest `house`; EN `enf` does not suggest `enfant`; MNK `bol` suggests `bolo`/`bolokala` only (`search_suggestions.test.ts`). FR `house` / EN `maison` miss (`search_query.test.ts`).

**Verdict: PASS** for all four pairs.

## 5. Variant behavior matrix

| Query | Mode | Expected stage | Actual stage | Count | Ranking | Pass | Evidence |
|-------|------|----------------|--------------|------:|---------|------|----------|
| `sœur` with `src_casefold sœur` indexed | FR→MNK | exact hit, no œ retry | exact; `separator_variant_query` null; `ir_ids` = ligature row not ASCII row | 1 | n/a | PASS | `search_query.test.ts` “keeps an original exact hit” |
| `sœur` with only `soeur` indexed | FR→MNK | ligature variant hit | `soeur` / `fr-soeur`; no `ru-should-never` | 1 | n/a | PASS | same file + SQ1C2 |
| `cœur` / `ŒUF` | FR→MNK | ligature variant | `coeur` / `oeuf` | 1 | n/a | PASS | same |
| `sœur` | EN→MNK | miss (no ligature) | empty `ir_ids` | 0 | — | PASS | “does not run ligature expansion for EN or MNK” |
| `sœur` | MNK→FR / MNK→EN | miss | empty; variant null | 0 | — | PASS | same |
| `grand pere` with `grand pere` indexed | FR→MNK | exact hit | no variant meta | 1 | n/a | PASS | original-spaced exact before hyphen retry |
| `grand pere` with only `grand-pere` | FR→MNK | hyphen variant | `grand-pere`; host skips suggestions | 1 | n/a | PASS | unit + E2E `bon-travail` |
| `pick-up` / `right-hand` | EN→MNK | hyphen variant | `pick up` / `right hand` | 1 | stored EN order | PASS | `search_query.test.ts` |
| `duba duba` | MNK→FR / MNK→EN | miss, no hyphen | empty | 0 | — | PASS | “does not expand MNK source queries” |
| `sœur extra` with `sœur-extra` only | FR→MNK | ligature miss → hyphen hit | `sœur-extra` (not `soeur-extra`; combinations not generated) | 1 | n/a | PASS | “falls through to hyphen/space when the ligature variant misses” |
| `grand pere` + `grandeur` also indexed | FR→MNK | variant hit suppresses prefix | `ir_ids` non-empty so host must not suggest | 1 | — | PASS | `search_suggestions.test.ts` SQ1C1 |
| `sœur` + `soierie` indexed | FR→MNK | ligature hit suppresses prefix | same | 1 | — | PASS | SQ1C2 suggestion test |
| `enf-xyz` miss | FR→MNK | variant miss → prefix on original `enf` | empty search; suggestions `enfant`, `enfance`, `enfant beni` | 3 sugg. | shorter then lexical | PASS | variant-miss prefix test |
| `bon-travail` (debug bundle) | FR→MNK | hyphen variant UI | results + “Showing results for "bon travail"”; no suggestion list | 1 | n/a | PASS | `ux2_search_results.spec.ts` SQ1C1 |

## 6. Suggestion behavior matrix

| Query | Mode | Expected stage | Actual | Count | Ranking | Pass | Evidence |
|-------|------|----------------|--------|------:|---------|------|----------|
| `house` | EN→MNK | exact; suggestions unused by host | `en-house`; prefix API may list `house` first but does not reorder `ir_ids` | 1 | stored | PASS | `search_suggestions.test.ts` |
| `hou` | EN→MNK | miss + prefix | `hour`, `house`, `household work` | 3 | shorter then lexical | PASS | same (`hour` before `house` is SQ1B rule, not a regression) |
| `com` | EN→MNK | miss + prefix | `comb`, `come`, `come back` | 3 | same | PASS | same |
| `enf` | FR→MNK | miss + prefix | `enfant`, `enfance`, `enfant beni` | 3 | same | PASS | same |
| `bol` | MNK→FR and MNK→EN | miss + prefix | `bolo`, `bolokala` | 2 | same both modes | PASS | same |
| `h` / `ho` / `al` | EN / FR | miss, **no** prefix | empty suggestions | 0 | — | PASS | unit + E2E `a`/`al` |
| `alp` | FR→MNK debug | miss + prefix | `alpha_fr`; meta “No exact match.”; click rewrites query and exact-searches | ≥1 | — | PASS | E2E SQ1B |
| `alpha_fr` | FR→MNK | exact, no suggestions | results; suggestions count 0 | 1 | — | PASS | E2E |
| `hou` | FR→MNK | no EN leak | empty | 0 | — | PASS | unit |
| `enf` | EN→MNK | no FR leak | empty | 0 | — | PASS | unit |

Prefix never becomes the result list. Selecting a suggestion re-runs exact search on that key.

**Verdict: PASS.**

## 7. Ranking behavior matrix

| Query / fixture | Mode | Expected | Actual | Pass | Evidence |
|-----------------|------|----------|--------|------|----------|
| `mère` vocative, formula, generic | FR→MNK | generic `source_term === mère` first; relative order of others kept | `e5164…`, `0f51…`, `d540…` | PASS | `search_result_ranking.test.ts` |
| nonmatch, match, match, nonmatch | FR→MNK | match, match, nonmatch, nonmatch | that order | PASS | same |
| `motocycle` / `motocyclette` for key `moto` | FR→MNK | **no** promote; frozen order | `b5c9…`, `0a56…` | PASS | same |
| variant `grand-pere` / `soeur` matched keys | FR→MNK | promote using **matched_key**, not raw typed text | hit row first | PASS | same |
| same records | EN→MNK, MNK→FR, MNK→EN | identity order | unchanged | PASS | same |
| EN `very` / gloss rows | EN→MNK | no gloss-based promote | order preserved | PASS | same |
| MNK `bon` forms | MNK→FR | no form-based promote | order preserved | PASS | same |
| `mère` ladder in `searchQueryForLookupMode` | FR→MNK | stored posting order; no lower-rung merge | 3 ids, no `lower-rung-only` | PASS | `search_query.test.ts` SQ1D1 |
| Consumer apply site | FR→MNK only | `runSearch` after resolve | `partitionFrExactSourceTermHits(resolved, effectiveMode, { matchedKey, matchedKeyType })` | PASS | `main.ts` |

EN/MNK ranking **unchanged** relative to pre-SQ1D1 stored `ir_ids[]` (plus resolve drop-missing). Ladder stop-early (`bon` tone-less) is still present by design.

**Verdict: PASS** (FR promotion in-scope; EN/MNK not modified).

## 8. Schema / data no-change confirmation

| Item | Status |
|------|--------|
| Query-log schema | Still V3 (`QUERY_LOG_EVENT_V3`). `git diff 03c3099..HEAD` does not touch `query_log_types.ts`. |
| CF2 schema | Still V2 (`search_failure_feedback_draft_v2`). `search_feedback_types.ts` not in SQ1B…HEAD. |
| IndexedDB | `SIRALEX_DB_VERSION = 6` |
| Dictionary / corpus / `search_index.jsonl` / `records.jsonl` / `catalog.json` | **Not** in `03c3099..HEAD` |
| N’Ko synthesis | No Latin→N’Ko generator on search path; N’Ko appears only if already indexed (`tgt_*`) or as `headword_nko_provided` on lexicon display |
| Russian | `indexFamilyForLookupInput` never `ru`; `ru_*` fixture rows excluded; `resolvePreferredGloss` never reads `gloss_ru`; RL1 E2E |

**Query-log schema changed: NO. CF2 schema changed: NO. IndexedDB: 6. Dictionary/corpus: NO.**

## 9. UX / copy check

| State | EN | FR | Coherent? |
|-------|----|----|-----------|
| Exact hit | `{count} results` | count copy | Yes. No ranking banner (SQ1D1). |
| Variant hit | Showing results for "{surface}" | Résultats pour « {surface} » | Yes. Surface is the expansion (`bon travail`), not a rung name. |
| Miss + suggestions | No exact match. + Suggestions | Aucun résultat exact. + Suggestions | Yes. Distinct from true empty miss. |
| Miss, no suggestions | spelling / one-word phrase copy | same | Yes. Unchanged `getNoResultMessage`. |
| Suggestion control | Search {key} | Chercher « {key} » | Yes. Click fills input and exact-searches. |

No extra ranking explanation. CF2 still offers no-result vs results-not-useful on the same gates (miss vs hit). Variant hits use the hit/results-not-useful path (E2E `bon-travail`).

**Verdict: PASS.**

## 10. Remaining known limitations

Classify only; not defects of SQ1 composition:

| Limitation | Class |
|------------|--------|
| Fuzzy / typo search absent | Deferred (unsafe for short MNK) |
| Plural / morphology absent | Deferred; FR aliases remain reviewed content |
| EN result ranking unchanged | Deferred; exact-gloss-first is unsafe (`hand`) |
| MNK result ranking unchanged | Deferred; tone-less `bon` stop-early is high-risk to merge |
| MNK `ɔ`/`o`, `ɛ`/`e` variants | Content / reviewed alias (SQ1F-class), not engine |
| No semantic / AI search | Out of product |
| No CF2 / query-log ranking | Out of SQ1; schemas stay frozen |
| No dictionary mutation | Correct for these slices |
| Short exact keys (`mai`) suppress suggestions | Exact-first policy; prefix is miss-only |
| Suggestion shorter-first can rank `hour` before `house` | SQ1B contract; no frequency data |
| True gaps (`bonjour`, `hello`) | Content, not retrieval bugs |
| Ligature+hyphen combinations not generated | SQ1C2 cap; hyphen may still fire on the ligature **surface** (`sœur extra` → `sœur-extra`) |

## 11. Recommended next product direction

**Close the SQ1 search-engine series.** The remaining pain is dictionary coverage and (later) EN/MNK ranking **metadata**, not another retrieval rung.

Do **not** start fuzzy, stemming, bag-of-words, CF2-driven ranking, or ladder merge next.

If a follow-up is needed, prefer reviewed source aliases / true-gap content (the `bonjour` / `poulet` class) over more query expansion. EN ranking should wait until primary-vs-secondary gloss flags exist.

## 12. Files changed

This audit: `docs/reports/sq1e_search_quality_closure_audit.md` only.

Runtime/tests/index: unchanged.

## 13. Tests / build

| Command | Result |
|---------|--------|
| `npm --prefix web run test:run` | **1050 passed** (107 files) |
| `npm --prefix web run test:e2e:ux2-search` | **4 passed** (exact hit, SQ1B miss+suggestions, SQ1C1 variant without suggestions) |
| `npm --prefix web run test:e2e:ml1d2-picker` | **17 passed, 1 failed** (see below) |
| `npm --prefix web run build` | **PASS** (`tsc` + vite) |

ML1D2 picker file match also runs ML1D3, RL1, ML1E, DU1. SQ1-relevant specs all passed: picker leakage, LookupMode presentation, Russian surfaces, ML1E four-direction search.

The failure is **not** an SQ1 retrieval/ranking defect:

```text
du1_dictionary_update_experience.spec.ts
Search notice → confirm → update → overlays retained → old payload gone
Test timeout 2400000ms
expect([data-testid=dictionary-update-dialog][data-phase=success]).toBeVisible()
```

That wait is post-commit featured-payload cleanup (comment at line 114). The sibling DU1 test (“failed update leaves OLD dictionary usable”) **passed** (8.4m). SQ1D1 does not change update UI. No test rewrite (not an SQ1 search defect).

First picker invocation hit `http://127.0.0.1:4175 is already used` (leftover preview). After freeing the port, the suite ran.

## 14. git diff --check

PASS (report only; no runtime diff).

## 15. Working tree

```text
?? docs/reports/sq1e_search_quality_closure_audit.md
?? web/scripts/
```

Commit not created.

---

## Audit matrix (core questions)

| # | Question | Answer | Evidence |
|---|----------|--------|----------|
| 1 | Exact search first in all modes? | Yes | `searchQueryForLookupMode` returns original if `ir_ids.length > 0` before `safeQueryVariants` |
| 2 | Exact hits suppress variant retries? | Yes | `sœur` exact vs `soeur` indexed separately; hyphen original-spaced hit |
| 3 | Variant hits suppress prefix suggestions? | Yes | host `if (result.ir_ids.length === 0)`; unit SQ1C1/C2; E2E `bon-travail` |
| 4 | Variant misses fall through to prefix? | Yes | `enf-xyz` miss then `enf` suggestions; host still uses original query for prefix |
| 5 | Ligature FR→MNK only? | Yes | `frenchLigatureExpansionAllowed`; EN/MNK `sœur` miss |
| 6 | Hyphen/space FR and EN only? | Yes | `hyphenSpaceExpansionAllowed`; MNK `duba duba` miss |
| 7 | FR ranking FR→MNK only? | Yes | `isFrToMnk`; other modes `records.slice()` |
| 8 | EN and MNK order unchanged? | Yes | ranking tests identity; query module still stored `ir_ids[]` |
| 9 | Russian absent? | Yes | no `ru_*` family; fixture exclusion; RL1 |
| 10 | N’Ko synthesis absent? | Yes | no generator; JSON of results must not match N’Ko range in expansion tests |
| 11 | Query-log / CF2 schemas unchanged? | Yes | files not in SQ1B…HEAD |
| 12 | IndexedDB v6? | Yes | `SIRALEX_DB_VERSION` |
| 13 | No dictionary/corpus/index artifacts? | Yes | not in SQ1B…HEAD |
| 14 | Copy coherent? | Yes | §9 |
