# SQ1D — Search Ranking Audit

## 1. Decision

```text
SQ1D_SEARCH_RANKING_AUDIT_COMPLETE
```

Audit only. No runtime, UI, schema, bundle, corpus, index, or test changes.

LookupMode boundaries are unambiguous. Search runtime, posting construction, and featured index record order were inspectable. SQ1A ranking examples (`mère`, `very`, tone-less `bon`, `mai`) reproduced on the featured ML1E artifact without dictionary mutation.

Inspection method: read builder/runtime/renderer; replay featured `search_index.jsonl` + `records.jsonl` in-process with Python `norm_v1.compute_search_keys` after NFC (same ladder stop-early as `searchQueryForLookupMode`). Helper lived at `/tmp/sq1d_ranking_inspect.py` and was **not** added to the repo.

---

## 2. Base commit

```text
ffb472cb159c8437383491a8657680ff7d6c1f7f
```

`git log -1`: `ffb472c Add French ligature query expansion`.

Featured artifact (unchanged since SQ1A/SQ1B/SQ1C):

| Field | Value |
|-------|-------|
| Logical `bundle_id` | `bundle_full_20260710_337619ff` |
| Physical path | `web/public/bundle_full_20260710_337619ff__d076558b/` |
| `content_sha256` | `sha256:d076558b2f668a06a5a30a143026433e9e0de3523e0397183cfd897b2641d90a` |
| Catalog version | `norm-v3-featured-ml1e-multilingual-en-index` |
| IndexedDB | `SIRALEX_DB_VERSION = 6` |
| Index rows | 147178 (`en` 34913, `src` 43729, `tgt` 68536, `ru` 0) |

---

## 3. Files inspected

| Area | Path |
|------|------|
| Exact search | `web/src/search/search_query.ts`, `search_query.test.ts` |
| SQ1C1/C2 variants | `web/src/search/search_query_variants.ts`, `search_query_variants.test.ts` |
| SQ1B suggestions | `web/src/search/search_suggestions.ts`, `search_suggestions.test.ts` |
| LookupMode | `web/src/search/lookup_mode.ts` |
| Record resolve | `web/src/search/resolve_records.ts` |
| Gloss presentation | `web/src/search/resolve_preferred_gloss.ts` |
| Host | `web/src/main.ts` (`runSearch`) |
| Results / suggestions UI | `web/src/render/render_results.ts`, `render_search_suggestions.ts` |
| IDB / import | `web/src/idb/siralex_db.ts`, `web/src/import/import_search_index.ts` |
| Index builder | `api/search_index/build_index.py` (`sort_posting_ir_ids`) |
| Regression order contracts | `api/search_regression/replay.py`, `shared/search_regression/search_regression_matrix_7n2a_v1.jsonl`, `search_regression_matrix_7n2b_v1.jsonl` |
| Prior SQ1 reports | `docs/reports/sq1a_search_intelligence_audit.md`, `sq1b_prefix_and_suggestions_report.md`, `sq1c_search_normalization_audit.md`, `sq1c1_hyphen_space_query_expansion_report.md`, `sq1c2_french_ligature_query_expansion_report.md` |
| Phase 7J ranking note | `docs/reports/phase7j_source_index_quality_audit.md` |
| Featured artifacts | `web/public/bundle_full_20260710_337619ff__d076558b/{search_index.jsonl,records.jsonl,bundle.manifest.json}` |

---

## 4. Current ranking pipeline

There is **no result scorer**. Order is the stored posting list.

```text
raw query + LookupMode
  → trim + NFC
  → computeSearchKeys (casefold → diacritics_insensitive → punct_stripped → nospace)
  → IDB get [scope, {family}_{rung}, key]
  → STOP at first non-empty ir_ids[]
  → if miss: safeQueryVariants (FR œ→oe, then FR/EN hyphen↔space); each variant re-walks the ladder; first hit wins
  → if still miss: prefix suggestions (separate list; never merged into ir_ids[])
  → resolveRecords(ir_ids) preserves order (drops missing records)
  → renderResultsList preserves order
```

Index family from `LookupMode.from` only: FR → `src_*`, EN → `en_*`, MNK → `tgt_*`. MNK→FR and MNK→EN share `tgt_*` postings; partner language affects gloss text only (`resolvePreferredGloss`).

Builder contract (`api/search_index/build_index.py`): posting lists are lexicographic `ir_id` after a full rebuild. `serialize_index(sort_postings=False)` exists to merge onto a frozen featured base without re-sorting.

Featured index check: **147174 / 147178** posting lists equal `sorted(ir_ids)`. The **only** exceptions are the four `moto` rungs (`src_casefold` / `diacritics_insensitive` / `punct_stripped` / `nospace`): `["b5c9a49f6db2a991", "0a56b8047aeaf117"]` (not lex order). That order is frozen in 7N2B (`7n2b_moto_transport_alias`). Source terms are `motocycle` then `motocyclette`, both mapping to `pópo`.

Import writes `ir_ids` as stored. Renderer comment: “Order is preserved exactly as provided.”

`SearchResult` carries `matched_key_type`, `matched_key`, and `separator_variant_query`. Those fields are used for meta copy / logging, **not** for sorting.

### Answers to core questions

| # | Question | Evidence |
|---|----------|----------|
| 1 | How are exact results ordered? | Stored `ir_ids[]`. Almost always lexicographic `ir_id`. Runtime does not sort. |
| 2 | Multiple entries under one key? | One posting list; same rule. Not insertion/record-stream order except frozen merge (`moto`). |
| 3 | Ladder rungs vs ranking? | Rung chooses **which** posting list. It does not rank rows inside a list. |
| 4 | Stop at first rung with results? | Yes (`runExactnessLadder`). Prefix suggestions also stop at the first rung with any prefix keys. |
| 5 | Better matches hidden by early-rung hits? | Yes for some MNK tone-less queries (`bon`, `bo`). Not the cause of `mère` / `very` (those are same-rung lists). |
| 6 | Source-language keys prioritized? | Family selection yes. Within a list, no source-term / headword / gloss priority. |
| 7 | MNK form vs gloss ranking? | Different families (`tgt_*` vs `en_*` / `src_*`). Same posting sort. Gloss match is not ranked above form match or vice versa. |
| 8 | FR / EN symmetric? | **No.** Same order mechanism; different authorities (`index_mapping` vs `lexicon_entry`), multi-hit rates, and what “exact surface” even means. |
| 9 | MNK→FR vs MNK→EN? | Shared `ir_ids` and order. Gloss fallback FR↔EN only. |
| 10 | SQ1B vs result ranking? | Separate. Suggestions do not reorder `ir_ids[]`. Exact hits skip the suggestion UI. Selecting a suggestion re-runs exact search on that key. |
| 11 | SQ1C1/C2 vs result order? | Variant hit returns the **variant key’s** stored `ir_ids[]` unchanged. `separator_variant_query` is UI meta only. |
| 12 | Safest ranking fix without dictionary data? | Stable partition of the **already returned** posting list using display fields already on records. FR `source_term` equality is evidenced. Naive EN gloss equality is **unsafe** (`hand`). Do not merge ladder rungs. Do not rebuild the index. |

---

## 5. Evidence table

Replay = first non-empty ladder posting on featured `search_index.jsonl`, then `records.jsonl` display fields. Not invented.

| Query | Mode | Family / rung | `n` | Top as stored | Notes |
|-------|------|---------------|----:|---------------|-------|
| `mère` | FR→MNK | `src_casefold` `mère` | 3 | `oh, mère!` → long homonym formula → `mère` (`e5164efcdf5e6ca4`) | Same ids as Phase 7J / SQ1A. Generic `source_term == "mère"` is **last**. Lower rungs have the **same** 3 ids (no hidden extra). |
| `mere` | FR→MNK | `src_diacritics_insensitive` `mere` | 3 | Same 3 cards, same order | Accent miss uses rung 2; ranking identical. |
| `mai` | FR→MNK | `src_casefold` `mai` | 1 | May (`dàbata`, `mɛ́`) | Exact short key. `maison` is a different key (`4f4808e24076f18b`). Suggestions **not** shown (host only on miss). |
| `bon` | FR→MNK | `src_casefold` `bon` | 1 | `bon` → `àa` / `bɛ̀dɛ` / … | Useful FR adjective mapping; not the MNK tone issue. |
| `very` | EN→MNK | `en_casefold` `very` | 25 | `tɔ́n` (“very”) first because `0f7a…` is lex-smallest | 21/25 first-sense gloss_en is exactly `very`; 2 have first sense `whole` with later `very`; 1 `very (dark)`; 1 `very, too much`. Order is hash/`ir_id`, not “best intensifier”. |
| `hand` | EN→MNK | `en_casefold` `hand` | 7 | `kɔ̀ɲɔ` (“hand, arm”) … `dɛ́n` (“hand” / FR suspendre) 2nd … `bólonɔ` signature … `dòn` enter | Exact first-sense gloss `hand` is **not** the body-part prototype. |
| `house` | EN→MNK | `en_casefold` `house` | 1 | lexicon `bón` | Single hit. FR `maison` is `index_mapping` `4f4808e24076f18b` — different IR space (SQ1A asymmetry). |
| `bon` | MNK→FR/EN | `tgt_casefold` `bon` | 1 | `bón` house (`211060723bc2edc5`) | `tgt_diacritics_insensitive bon` has **4** ids. Stop-early hides `0d6770dfda53937a`, `8e3be24999ce1213` (`bòn` big), `b9cef23cf27cf191` (`bɔ̀n` spill). |
| `bón` | MNK→* | `tgt_casefold` `bón` | 2 | two tone-marked forms | Broader than tone-less `bon`. |
| `bôn` | MNK→* | `tgt_diacritics_insensitive` `bon` | 4 | full collapsed-tone set | Wrong-tone query can see **more** than tone-less exact. |
| `bo` | MNK→* | `tgt_casefold` `bo` | 1 | `bò` “en effet” | Rung 2 has 3 ids (2 extra hidden). Prefix fan-out exists but suggestions require length ≥ 3. |
| `hou` | EN→MNK | suggestions only | — | ranked `hour`, `house`, `house key`, … | Shorter-key-first puts `hour` before `house`. Exact search of `hou` is a miss. |
| `com` | EN→MNK | suggestions | — | `comb`, `come`, `comma`, `commit`, … | Length then lexical. Cap 8 after inspect 64. |
| `enf` | FR→MNK | suggestions | — | `enfer`, `enfin`, `enfant`, … | `enfant` is 3rd (length 6). |
| `mai` prefix (if it were a miss) | FR→MNK | would rank `mai`, `main`, `mais`, … `maison` 7th | Exact hit suppresses this list. |
| `sœur` | FR→MNK | original miss; variant `soeur` `src_casefold` | 1 | `soeur` mapping | Same posting as typing `soeur`. Meta: showing results for variant surface. |
| `grand pere` | FR→MNK | variant `grand-pere` → `diacritics_insensitive` | 1 | `grand-père` | Same as SQ1C1; order = that key’s `ir_ids`. |
| `right-hand` | EN→MNK | variant `right hand` `en_casefold` | 2 | `kíninbolo` “right hand”; `bóloba` “rich and generous person” | Second hit is a gloss-key collision, lex-ordered. |
| `pick-up` | EN→MNK | variant `pick up` | 10 | `tɛ̀` first (`2464b2d5…`) | Same stored EN posting order as the spaced key. |

Featured `src_casefold` multi-hit keys: **110**. On **55**, a `source_term` equal to the key (case-sensitive) is **not** first. English `en_casefold` multi-hit keys: **3563 / 8737** (40.8%). `tgt_casefold` multi-hit: **2532 / 23779**. Headword string equal to the tone-less key and not first: only **7** MNK keys (homographs with/without tone marks) — not the main MNK ranking pain.

Russian: **0** `ru_*` rows. Consumer gloss resolver never reads `gloss_ru`. No first-sense Russian-only lexicon rows in this bundle.

N’Ko: **6781** `tgt_casefold` keys in N’Ko script (indexed variants, not Latin→N’Ko synthesis). **8823 / 8826** lexicon rows have `headword_nko_provided`. Search does not generate N’Ko from Latin.

---

## 6. Failure taxonomy

| Ranking issue | Example query | LookupMode | Current top results | Better expected order | Cause | Evidence | User impact | Risk of fixing | Candidate improvement |
|---------------|---------------|------------|---------------------|-----------------------|-------|----------|-------------|---------------|------------------------|
| Lex `ir_id` order buries exact FR surface | `mère` | FR→MNK | Vocative / formula, then generic `mère` | Generic `mère` first; others after | Posting = `sorted(ir_id)`; `source_term` unused | Featured 3-id list; 7J `ranking_ambiguity_issue` | High: wrong first card for a core kinship term | Low if **stable partition** on FR `source_term` equality; must not lex-resort (`moto` contract) | SQ1D1 FR-only surface promote |
| Same for other FR multi-keys | `merci`, `main gauche`, `créateur` | FR→MNK | Phrase/capitalized mappings before exact `source_term` | Exact `source_term` (NFC casefold = query) first | Same | 55/110 `src_casefold` multi-keys | Medium | Same as `mère`; casefold compare needed so `Blanc`/`blanc` stay a tie | SQ1D1 |
| Common EN gloss, no sense priority | `very` | EN→MNK | 25 lexicon rows, `tɔ́n` first by id | Unclear without sense-type / frequency | Gloss-derived `en_*`; 21 rows literally gloss `very` | Featured 25-id `en_casefold very` | High noise | **High** if guessing “best intensifier” | Defer (needs metadata) |
| Exact EN gloss can be the *wrong* prototype | `hand` | EN→MNK | Body-part-ish first by luck of ids; exact `hand` is `dɛ́n` (hang) | Prefer attested body-part `bólo` / `kɔ̀ɲɔ` — **not** exact-gloss-first | Comma-split gloss keys; no primary-sense flag | `dɛ́n` first-sense `hand`; `bólo` is `hand, arm, …` | High if we apply FR-style equality to EN | **High** — exact gloss would promote `dɛ́n` | Do **not** copy FR rule to EN |
| Gloss-key collision | `right hand` / variant `right-hand` | EN→MNK | `kíninbolo`; then `bóloba` “rich person” | Primary “right hand” first; collision later | Same EN key from different glosses | 2-id list | Medium | Medium (needs sense/field type) | Runtime score only with care; else defer |
| Ladder stop-early hides tone family | `bon` | MNK→FR, MNK→EN | 1 house entry | Possibly show collapsed-tone homographs **labeled**, or keep narrow exact | First rung wins; no merge | casefold n=1 vs diacritics n=4 | High for tone-less MNK typing | **High** (false friends `bòn`/`bɔ̀n`) | Defer merge; not SQ1D1 |
| Short exact key shadows longer intent | `mai` | FR→MNK | May only; no suggestions | Keep May; optionally still show prefix completions | Exact-first + suggestions miss-only | `mai` hit; `maison` other key; SQ1B min length 3 would list `maison` **if** miss | Medium | Medium (changing miss-only rule is product, not ranking) | Not ranking; optional later UX |
| Suggestion shorter-first vs likely word | `hou` | EN→MNK | `hour` then `house` | `house` often more likely; no frequency in index | SQ1B: exact, then shorter, then lexical | Replay ranked `hour` before `house` | Low–medium | Medium if we guess popularity | Keep suggestion ranking separate; do not use CF2 |
| Variant meta vs typed query | `sœur`, `grand pere` | FR→MNK | Results for `soeur` / `grand-père` | Same entries; copy already explains variant | First variant hit; stored order of **that** key | Code + featured replay | Low (copy exists) | Low | None for order |
| FR vs EN card/model mismatch | `maison` vs `house` | FR vs EN → MNK | mapping vs lexicon `bón` | Presentation later, not a sort bug | Different IR kinds by design | SQ1A + replay | Medium UX | High if unified without policy | Out of ranking slice |

SQ1A examples **reproduced**. No alternative evidence required.

---

## 7. Safe-now candidates

Possible **without** index rebuild, fuzzy, CF2, or logs:

- **Keep suggestions ranked separately** (already: exact key, then shorter, then code-point). Do not mix suggestion keys into `ir_ids[]`.
- **Preserve source-family isolation** (already).
- **Stable FR surface promote** within the current hit list only: after `resolveRecords`, move `index_mapping` rows whose `source_term` NFC+casefold equals the query (or `matched_key`) ahead of others; **keep relative order** inside each partition. Does not touch `moto` (neither source_term is `moto`). Fixes `mère` / `merci` class. **FR→MNK only.**
- **Leave EN and MNK posting order unchanged** in the next slice.
- **Leave ladder stop-early unchanged.**
- Variant hits: keep using the variant key’s stored list; no extra reorder.

Not “safe now”: full lex re-sort of postings at runtime (would invert frozen `moto`); EN first-sense gloss equality (see `hand`); merging rungs.

---

## 8. Runtime-only candidates

Score **already returned** records only (no new index fields):

- Prefer displayed `source_term` / `headword_latin` / first-sense gloss whose normalized form equals the query (FR evidence good; **EN evidence mixed/negative**).
- Prefer shorter `source_term` among FR mappings (helps `mère` vs long formula; may hurt if a short vocative exists).
- Prefer `ir_kind === "index_mapping"` vs lexicon — **invalid** here: a given LookupMode already returns one kind.
- Prefer primary sense vs later senses when `senses[0]` vs later contains the EN key (`very` rows 10–11) — small, undocumented policy.
- Use `display.corpus_count` if present — popularity; treat as deferred unless product owns it.

MNK→FR and MNK→EN must share any MNK-side reorder (same `ir_ids`).

---

## 9. Index-rebuild / deferred candidates

- Primary vs secondary gloss / mapping flags on keys.
- Precomputed frequency / curated headword priority.
- Re-sort featured `ir_ids[]` in JSONL (breaks 7L/7N2 posting contracts unless matrices are rewritten).
- Separate keys for vocative vs lemma.
- Sense-type (intensifier vs content word) for EN `very` / `hand`.
- Ladder merge or extra rung for tone-less MNK (rebuild + large golden churn).

Index rebuild is **not** required to fix FR `mère`-class order.

---

## 10. Unsafe / deferred candidates

Must remain out of SQ1D1:

- Fuzzy / edit-distance ranking
- AI / semantic / cloud ranking
- CF2- or query-log-driven automatic ranking
- User-behavior personalization
- Morphology / stemming / plural ranking without corpus evidence
- Bag-of-words / token ranking that would collapse `hand` vs `right hand`
- Russian return
- N’Ko synthesis
- Automatic dictionary correction
- Popularity ranking from unpublished analytics

---

## 11. Recommended next slice

```text
SQ1D1 — Deterministic result ranking within exact key hits
```

Scope (small enough to implement safely):

1. **Only** reorder the `ir_ids` already returned by the current exact/variant ladder (no extra retrieval, no rung merge, no suggestion merge).
2. **Only** FR→MNK `index_mapping` rows.
3. **Stable partition:** `source_term` NFC+casefold equals trimmed query or `matched_key` → front; other hits follow; **relative order preserved** in each group (not a new `sort(ir_id)`).
4. Apply after `resolveRecords` so missing records stay omitted without inventing order.
5. EN→MNK, MNK→FR, MNK→EN: **identity order** (tests must pin that).
6. Variant hits: same partition on the variant key’s list; `separator_variant_query` unchanged.
7. Prefix suggestions: **unchanged** (including `hour` before `house`).
8. No IDB bump, no CF2/query-log schema, no corpus/index rewrite.

Why this, not “suggestions only”: result-list harm on `mère` is reproduced and local to FR display strings already on the record. Suggestion ranking is already deterministic; changing it needs frequency data we do not have.

Why this, not “collect more evidence”: FR `source_term` not-first is 55/110 multi-keys, not an anecdote. EN needs more metadata; that is a **later** slice, not a blocker for FR-only partition.

Why not ladder merge: `bon` extra hits include `bòn` / `bɔ̀n` with unrelated glosses. High authority risk.

---

## 12. Non-goals

Explicitly rejected for SQ1D1 and this audit’s follow-up unless a later slice reopens them:

- Fuzzy search, morphology, plural handling, semantic/AI/cloud ranking
- Automatic dictionary correction
- CF2-driven ranking, query-log-driven ranking
- Russian on consumer search
- N’Ko synthesis
- Index rebuild (not necessary for the recommended slice)
- Changing IndexedDB from v6
- Replacing SQ1B shorter-first suggestion order
- Merging exact hits with prefix keys into one result list

---

## 13. Risk analysis

| Risk | Assessment |
|------|------------|
| Dictionary authority | Low for FR `source_term` equality (attested mapping string). High if EN gloss equality or MNK tone merge is added. |
| Multilingual leakage | Low if partition is FR `index_mapping` only and family selection stays LookupMode.from. |
| Result instability | Low if partition is stable (no localeCompare, no random). `moto` order preserved. Regression matrices that pin **FR multi-hit order** must be updated or asserted as set+first-card. |
| User confusion | Low–medium: `mère` improves; users may still see vocatives below. Variant copy already distinguishes typed vs expanded query. |
| Performance | Negligible: sort/partition of typical `n` ≤ 26 after records are loaded. |
| Test fragility | Medium: Phase 7L/7N2 `expected_ir_ids` is **order-sensitive**. SQ1D1 must either skip those matrices (Python replay ≠ JS partition) or add JS tests with fixtures, not rewrite featured JSONL. |
| Offline / PWA | None: local records only. |

---

## 14. Test plan

Minimum for SQ1D1 (JS unit + existing LookupMode fixtures; no featured index rewrite):

| Case | Expect |
|------|--------|
| FR→MNK `mère` (fixture or featured-backed if already used in tests) | Generic `source_term === "mère"` before vocative/formula; other ids retained |
| FR→MNK exact single-hit (`maison`) | Order unchanged (length 1) |
| FR→MNK variant `grand pere` / `sœur` | Same partition rule on returned ids; `separator_variant_query` still set; no Russian ids |
| EN→MNK `very` / `hand` | **Same order as stored postings** (no EN promote) |
| MNK→FR `bon` | Still 1 id `211060723bc2edc5` (no rung merge) |
| MNK→EN `bon` | Same `ir_ids` as MNK→FR |
| Prefix `hou` / `enf` | Suggestion ranking unchanged; exact `house` postings unchanged |
| `moto` if touched | `["b5c9a49f6db2a991", "0a56b8047aeaf117"]` preserved (neither source_term equals `moto`) |
| No `ru_*` | Capability tests already in `search_query.test.ts` |
| No N’Ko synthesis | Latin query does not invent N’Ko keys |
| Determinism | Same query twice → same `ir_ids` |

Do not add fuzzy/morphology tests.

---

## 15. Working tree

At audit end:

- Added: `docs/reports/sq1d_search_ranking_audit.md` (this file)
- Runtime/tests/index: **unchanged**
- Pre-existing untracked: `web/scripts/` (screenshot helper from prior work; **not** part of SQ1D)
- `/tmp/sq1d_ranking_inspect.py`: local inspect only, not in git

```text
Commit: NOT CREATED
```
