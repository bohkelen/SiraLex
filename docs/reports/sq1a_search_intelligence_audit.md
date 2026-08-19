# SQ1A — Search Intelligence Audit

## 1. Decision

```text
SQ1A_SEARCH_INTELLIGENCE_AUDIT_COMPLETE
```

Audit only. No runtime, UI, schema, bundle, corpus, or test changes.

Featured artifact inspected:

| Field | Value |
|-------|-------|
| Logical `bundle_id` | `bundle_full_20260710_337619ff` |
| Physical path | `web/public/bundle_full_20260710_337619ff__d076558b/` |
| `content_sha256` | `sha256:d076558b2f668a06a5a30a143026433e9e0de3523e0397183cfd897b2641d90a` |
| Catalog version | `norm-v3-featured-ml1e-multilingual-en-index` |
| Capability | `lookup_languages: [fr, en, mnk]`, `search_key_families: [en, src, tgt]` |
| Normalization | `norm_v3` |
| English rule | `en_gloss_key_v1` |

LookupMode boundaries are unambiguous. Search runtime is locatable. Index artifacts are present locally. Failures below are evidenced by read-only ladder replay against the featured `search_index.jsonl` plus code/contracts. No production dictionary data was modified.

Inspection method: reused existing builders/runtime (`compute_search_keys` / exactness ladder semantics) via one-off in-process Python. No new toolchain was added to the repo.

---

## 2. Current search architecture

### Files inspected

| Area | Path |
|------|------|
| Search runtime | `web/src/search/search_query.ts` |
| LookupMode | `web/src/search/lookup_mode.ts`, `lookup_mode.test.ts`, `lookup_mode_active_bundle_sync.ts` |
| Preference / chrome | `web/src/search/search_lookup_lang_preference.ts` |
| Gloss presentation | `web/src/search/resolve_preferred_gloss.ts` |
| Record resolve | `web/src/search/resolve_records.ts` |
| Consumer search host | `web/src/main.ts` (`runSearch`, 150 ms debounce) |
| Results / miss copy | `web/src/render/render_results.ts` |
| Index import / IDB | `web/src/import/import_search_index.ts`, `web/src/idb/siralex_db.ts` |
| Normalization | `web/src/norm/norm_v1.ts`, `shared/normalization/norm_v1.py`, `norm_v2.py`, `norm_v3.py` |
| Index builder | `api/search_index/build_index.py` |
| English keys | `api/search_index/en_gloss_key_v1.py` |
| Query logs | `web/src/query_logging/query_log_types.ts`, `query_log_derive.ts`, `query_log_runtime.ts`, `query_log_inspect.ts` |
| CF2 | `web/src/search_feedback/search_feedback_types.ts`, `search_feedback_capture_model.ts`, `search_feedback_package.ts` |
| Regression | `api/search_regression/replay.py`, `api/query_evidence/replay.py`, `shared/search_regression/*` |
| Contracts / prior audits | `docs/reports/ml1b_multilingual_search_contract.md`, `ml1c1_english_index_bundle_report.md`, `ml1c2_multilingual_runtime_cf2_report.md`, `ml1d1_multilingual_search_state_query_log_report.md`, `ml1d2_consumer_english_search_picker_report.md`, `ml1e_multilingual_featured_publication_report.md`, `phase7j_source_index_quality_audit.md`, `cf2d0_missing_entry_search_failure_feedback_product_definition.md` |
| Featured artifacts | `web/public/bundle_full_20260710_337619ff__d076558b/{bundle.manifest.json,records.jsonl,search_index.jsonl}` |
| Catalog | `web/public/catalog.json` |

Not used as demand evidence: no local CF2 export packet and no query-log JSONL were present under `data/` for this audit.

### Index key families

Ladder rungs (all families): `casefold` → `diacritics_insensitive` → `punct_stripped` → `nospace`.

Featured index (147178 rows, 13 834 042 bytes):

| Family | Meaning | Authority | Unique `casefold` keys | Notes |
|--------|---------|-----------|----------------------:|-------|
| `src_*` | French reverse index | `index_mapping.source_term` + reviewed aliases/supplements + `norm_v2` phrase extraction | 10984 | Frozen legacy-French namespace. Not `gloss_fr`. |
| `en_*` | English gloss keys | sense `display.senses[].gloss_en` via `en_gloss_key_v1` | 8737 | Additive; 34913 `en_*` rows. |
| `tgt_*` | Maninka forms | lexicon `preferred_form` / `variant_forms` | 23779 | Shared by MNK→FR and MNK→EN. Includes 6781 N’Ko-script `tgt_casefold` keys from source variants — not synthesized Latin→N’Ko. |

No `ru_*` family. No `fr_*` rename. Undirected legacy indexes still exist for old bundles; English lookup fail-closes unless directional + capability metadata advertise `en`.

Runtime lookup is a point `IDBObjectStore.get([storageScopeId, key_type, key])`. There is no prefix cursor in production search. Comment in `search_query.ts`:

> No prefix search, no suggestions, no fuzzy matching, no merging across levels, no client-side re-ranking.

Posting lists are lexicographic `ir_id` order. Runtime preserves that order.

### Lookup directions

`LookupMode` is the sole consumer search source of truth. Valid pairs:

| Mode | Index family | Result record kind (featured) | Preferred gloss |
|------|--------------|-------------------------------|-----------------|
| FR → MNK | `src_*` | `index_mapping` | FR (query partner) |
| EN → MNK | `en_*` | `lexicon_entry` | EN |
| MNK → FR | `tgt_*` | `lexicon_entry` | `gloss_fr` then `gloss_en` |
| MNK → EN | `tgt_*` | `lexicon_entry` | `gloss_en` then `gloss_fr` |

UI locale (`siralex.ui_locale`) is independent of lookup. Partner language persists as `siralex.search_lookup_lang`. Russian is never a lookup language and never a gloss fallback (`resolve_preferred_gloss.ts`).

### Ranking model

1. Walk the exactness ladder; **stop at the first non-empty posting**.
2. Return stored `ir_ids[]` unchanged.
3. Renderer (`render_results.ts`) does not re-sort, promote exactness, or mark a best hit.

Consequences evidenced below: tone-less Maninka can hide broader diacritics matches; French `mère` lists vocative/formula mappings before the generic mother mapping; English common glosses such as `very` return 25 lexicon rows in hash/`ir_id` order.

### Multilingual boundaries

- Cross-family leakage is rejected by tests and by replay (`house` in FR→MNK misses; `maison` in EN→MNK misses).
- English requires `lookup_languages` ∩ `search_key_families` both include `en`, plus a directional index.
- Unsupported EN clamps to FR→MNK (`resolveSupportedLookupMode`); it never silently remaps to MNK→FR.
- FR and EN are **not retrieval-parity twins**: French keys are curated reverse-index phrases; English keys are gloss-derived. Result cards differ (`index_mapping` vs `lexicon_entry`). English `casefold` multi-hit rate is 3563/8737 (40.8%); French is 110/10984 (1.0%).

---

## 3. Failure taxonomy

Replay uses the same ladder as runtime (`norm_v3` `compute_search_keys` + family prefix + first non-empty rung). Prefix “would-hit” counts are `src|en|tgt_casefold` keys with `startswith(normalized_query)` — not executed by production search.

| Failure type | Example query | Lookup mode | Current behavior | Likely cause | Evidence | Priority | Candidate improvement |
|--------------|---------------|-------------|------------------|--------------|----------|----------|------------------------|
| Prefix / incomplete word miss | `hou` | EN→MNK | Miss | Exact-key lookup only | `en_casefold` prefix `hou` has 10 keys including `house`; ladder miss | **P0** | SQ1B |
| Prefix / incomplete word miss | `com` | EN→MNK | Miss | Exact-key lookup only | 81 `en_casefold` completions (`come`, `come back`, …) | **P0** | SQ1B |
| Prefix / incomplete word miss | `enf` | FR→MNK | Miss | Exact-key lookup only | 22 `src_casefold` completions (`enfant`, `enfance`, …) | **P0** | SQ1B |
| Prefix / incomplete word miss | `mange` | FR→MNK | Miss (`manger` hits) | Exact lemma required; no FR verb stemming | Featured replay | **P0** | SQ1B (suggestion) / SQ1F later |
| Exact key shadows intended prefix | `mai` | FR→MNK | Hit **May** (`dàbata`, `mɛ́`), not `maison` | First exact key wins; no completions UI | `mai` → `85df58cc3220ec32`; `maison` is a different key | **P0** | SQ1B |
| Exact key shadows intended prefix | `bo` | MNK→FR/EN | Hit 1 short form; 419 `tgt_casefold` keys begin with `bo` | Exact + huge prefix fan-out | Featured replay | **P0** | SQ1B with min-length + cap |
| Hyphen vs space miss | `grand pere` | FR→MNK | Miss (`grand-père` and `grandpere` hit) | `punct_stripped` **removes** hyphen (no space); `nospace` **keeps** hyphen. `punctuation_to_space` exists in `norm_v1` but is **not** on the ladder | 80/80 sampled `src` hyphen keys: original hits, space variant misses; concat hits `punct_stripped` | **P1** | SQ1C |
| Hyphen vs space miss | `right-hand`, `pick-up` | EN→MNK | Miss (`right hand` / `pick up` hit; `righthand` / `pickup` hit via `nospace`) | Same hyphen/space mismatch on English phrases | Featured replay | **P1** | SQ1C |
| Apostrophe stripping works when indexed | `quelquun` vs `quelqu'un` | FR→MNK | Both hit (`punct_stripped`) | Apostrophe is Unicode punctuation | 60/60 sampled apostrophe keys: stripped query hits `punct_stripped` | — | Already handled; not a gap |
| True gap, not punctuation | `l'eau` / `leau` / `l’eau` | FR→MNK | Miss | No indexed water-with-article form; `eau` hits | Featured replay | **P2** | Content/alias (not SQ1C) |
| Ligature œ vs oe | `sœur` | FR→MNK | Miss (`soeur` hits) | `œ` is a letter, not a combining mark; diacritics strip does not expand ligatures. No `œ` in featured `source_term` | Replay + records scan | **P2** | SQ1F (reviewed variant), not a generic accent fix |
| Case | `Maison`, `MAISON` | FR→MNK | Hit `casefold` | Ladder rung 1 | Replay | — | Working |
| Accent (combining / French acute) | `mere` vs `mère` | FR→MNK | Hit `diacritics_insensitive` | Strip Mn/Mc/Me | Replay; regression `sr7l_004` | — | Working for this class |
| Whitespace trim | ` house`, `house ` | EN→MNK | Hit | `query.trim()` + whitespace normalize | Replay | — | Working |
| EN plural / inflection miss | `houses`, `children`, `eating`, `ate` | EN→MNK | Miss (`house`, `child`, `eat` hit) | `en_gloss_key_v1` forbids stemming | Replay + extraction contract | **P1** | SQ1F (reviewed) / not a stemmer |
| FR plural sometimes already aliased | `enfants` / `enfant` | FR→MNK | Both hit same mapping | Reviewed source alias/supplement overlay, not morphology engine | Same `ir_id` `99e6cda40390d1fb` | — | Do not replace with a stemmer |
| Token / phrase: EN whitespace not split | `come` vs `come back` | EN→MNK | Both hit **different** posting sets (5 vs 9) | Unitary phrase keys; no bag-of-words (intentional ML1B) | Replay + `en_gloss_key_v1` | — | Keep; SQ1E would regress this |
| Token / phrase: slash not a delimiter (EN) | `sth / smb.` | EN→MNK | Miss as typed; key exists only as exact gloss surface | Forbidden slash split | Extraction tests + 10 `en_casefold` slash keys remain whole | **P3** | SQ1E only with reviewed policy |
| Token / phrase: FR does split `,;/ ` | FR source enumerations | FR→MNK | Segments indexed in addition to original | `norm_v2.extract_source_phrases` | 168 remaining `src` comma keys (originals kept); slash source_terms split into phrases | — | FR/EN policy already asymmetric |
| Parenthetical EN | `(not) yet` vs `not yet` | EN→MNK | Both hit (8 vs 1) | Trailing-paren strip only; leading paren kept as its own key | Replay + ML1B table | **P3** | Leave unless evidence of confusion |
| Ranking: lex `ir_id` order | `mère` | FR→MNK | 3 hits; generic `mère` is **last** | Posting sort is lexicographic `ir_id`, not term exactness | Cards: `oh, mère!` → long homonym formula → `mère` (`e5164efcdf5e6ca4`). Phase 7J classified this `ranking_ambiguity_issue` | **P1** | SQ1G |
| Ranking: English common gloss | `very` | EN→MNK | 25 lexicon entries, hash order | Gloss-derived key + no relevance rank | First rows include intensifiers **and** a sense whose English key collapsed to `very` while French is a long distance description | **P1** | SQ1G |
| Ranking: ladder stop-early | `bon` vs `bón` vs `bôn` | MNK→FR/EN | `bon` → 1 entry (house). `bón` → 2. `bôn` → 4 via `diacritics_insensitive` | First non-empty rung wins; **no merge**. Tone-less query can be *narrower* than a wrong-tone query | `tgt_casefold bon` = `[21106072…]`; `tgt_diacritics_insensitive bon` has 4 ids | **P1** | SQ1G (high regression risk) |
| Retrieval-model asymmetry | `maison` vs `house` | FR vs EN → MNK | FR returns `index_mapping`; EN returns `lexicon_entry` `bón` | Different authorities by design | Same headword family, different `ir_id` spaces and card UX | **P2** | Presentation/ranking later; not prefix |
| Ambiguity volume EN ≫ FR | `hand` | EN→MNK | 7 lexicon hits including verb `dɛ́n` (“suspendre”) | Comma-split gloss alternatives + no ranking | Replay | **P1** | SQ1G |
| Maninka open-vowel spelling | `dobɛn` vs `dɔ́bɛ̀n` / `doben` | MNK→* | `dobɛn` miss; `dɔ́bɛ̀n` casefold hit; `doben` diacritics hit | `ɔ`/`o` and `ɛ`/`e` are base letters, not marks | Replay; `norm_v1` documents this | **P2** | SQ1F only with corpus variants |
| N’Ko consumer typing | Latin `jí` | MNK→* | Hit Latin headword; `display.headword_nko` is empty | N’Ko is in `variant_forms` / `tgt_*` (6781 keys) but not synthesized from Latin | Records: 0 `headword_nko` on display; N’Ko keys exist | — | N’Ko synthesis remains deferred |
| True dictionary / index gap | `bonjour`, `poulet`, `fièvre` | FR→MNK | Miss | No `src_*` key; not an accent failure (`fievre` also misses) | Replay; prior usage workstream treated these as content, not search-engine bugs | **P2** | Reviewed alias/supplement; not SQ1B |
| True dictionary / index gap | `hello`, `hi`, `fever` | EN→MNK | Miss (`chicken`, `price` hit) | No matching `gloss_en` key | Replay | **P2** | Content / SQ1F, not fuzzy |
| Conversational wrapper | `comment dit-on école`, `how do you say house` | FR/EN → MNK | Miss | Exact phrase keys; miss copy tells multi-word users to try one word | `getNoResultMessage` branches on whitespace | **P2** | UX copy exists; do not NLP-parse |
| No suggestion UX | any miss with nearby keys | all | Empty list + spelling/phrase copy + CF2 capture | Runtime forbids suggestions | `search_query.ts`; `getNoResultMessage` | **P0** | SQ1B |
| Short-query explosion if prefix naively enabled | `a`, `b`, `t` | FR/EN/MNK | Today: some 1–2 char **exact** hits (351 such `casefold` keys) | Prefix fan-out: `src a` 837 keys, `tgt b` 3729, `en t` 491 | Prefix counts on featured index | **P0 constraint** | SQ1B must min-length ≥ 3 and cap |
| Long encyclopedic FR keys | (not typed) | FR→MNK | Keys up to 339 chars indexed | Original `source_term` always preserved by phrase extractor | Longest `src_casefold` is a multi-sentence apology/gesture note | **P2** | Prefix suggestions must prefer short keys |
| CF2 cannot classify miss type | any CF2 draft | all | Stores experience, not diagnosis | Product rule: reports `no_result` / `results_not_useful`, never why | `search_feedback_capture_model.ts`; no `matched_key_type` / normalized keys on drafts | **P2** | SQ1H over **query logs**, not a CF2 schema change |
| Query-log opt-in gap | production users | all | V3 fields are diagnostically rich but consent-gated | Tester logging, 2000-row / 90-day cap | `query_log_types.ts` | **P2** | SQ1H after SQ1B |

---

## 4. Search improvement candidates

Ranked by user impact, implementation risk, data-authority risk, offline cost, and testability. Names are candidates only; this audit does not schedule all of them.

| Rank | Slice | User impact | Impl. risk | Authority risk | Offline cost | Testability | Verdict |
|------|-------|-------------|------------|----------------|--------------|-------------|---------|
| 1 | **SQ1B — Prefix + Suggestions** | Highest: incomplete typing is the dominant evidenced miss class across FR/EN/MNK | Medium if scoped (range cursor + cap). High if prefix replaces exact results | Low if suggestions are completions and exact search stays authoritative | Low: existing compound IDB key `[bundle_id, key_type, key]` already supports `IDBKeyRange` prefix bounds; no new index rows | High | **Do next** |
| 2 | **SQ1C — Accent / punctuation normalization** | Medium: hyphen↔space is a real, systematic miss; most accents/apostrophes already work | Medium: touching the ladder or adding a rung can shift many keys | Medium: `punctuation_to_space` would merge distinct punctuated forms | Low–medium if rebuild; higher if a 5th rung is added to 147k rows | High | After SQ1B; do not rebuild corpus in SQ1B |
| 3 | **SQ1G — Ranking refinement** | High on hits (`mère`, `very`, `hand`, tone-less `bon`) | High: posting-order contracts are frozen in Phase 7L / featured index | High: promoting “generic” senses requires linguistic policy | Low at runtime if client-side; high if rebuild posting order | Medium (need golden orders) | After suggestions exist; exact-first is a SQ1B ranking rule, not full SQ1G |
| 4 | **SQ1F — Orthographic variant handling** | Medium: `sœur`/`soeur`, EN plurals, `ɔ`/`o` | Low if **reviewed aliases** (existing French path). High if automatic | High if unsupervised | Low per alias | High for alias tables | Continue alias/supplement governance; no auto-morphology |
| 5 | **SQ1E — Gloss tokenization improvements** | Mixed: would catch some partial glosses; would **destroy** phrase distinctions ML1B measured | High | **Very high** (bag-of-words rejected: `hand` vs `right hand`) | Higher index size | High, but contract conflict | Not until prefix+ranking proven insufficient |
| 6 | **SQ1H — Search feedback dashboard / local analytics** | Low direct lookup impact; helps prioritize later | Low | Low if read-only | None | High | Useful later; cannot substitute for SQ1B. No CF2 schema change |
| 7 | **SQ1D — Typo-tolerant fuzzy search** | Attractive for `bonjour`-class typos; dangerous for short Maninka | High (mobile CPU, ranking noise) | **Highest** among listed slices | High if extra structures | Medium | Defer indefinitely until prefix+normalization+aliases are exhausted |

SQ1B is not “search everything that starts with the query as the result list.” The audit supports **typeahead completions + optional prefix retrieve with exact-first**, bounded by LookupMode family.

---

## 5. Recommended next slice

```text
SQ1B — Prefix + Suggestions
```

Why this, not SQ1C: the exactness ladder already handles case, French/English combining accents, and apostrophe-insensitive match when the form is indexed. The largest evidenced user failure is **incomplete input with nearby keys present** (`hou`→`house`, `com`→`come`/`come back`, `enf`→`enfant`, `mai` exact-shadowing `maison`). Hyphen/space (SQ1C) is real but narrower.

Why this, not SQ1G: ranking failures matter after a hit. Zero-result incomplete queries never reach ranking. SQ1B should still include one ranking invariant: **if the query is itself an exact key, that posting stays first; completions are secondary.**

### SQ1B scope recommended by this audit

In:

- Prefix completions from the **active LookupMode family only** (`src_*` / `en_*` / `tgt_*`)
- Minimum query length **3** after trim (1–2 character prefix fan-out is 459–3729 keys)
- Hard cap on completions (audit suggests on the order of 8–20, finalize in SQ1B plan)
- Prefer shorter completion keys over 100+ character encyclopedic `src` strings
- Keep current exact ladder for the committed result list unless SQ1B explicitly adds a separate, labeled prefix-retrieve path
- Debounce already 150 ms — reuse; do not search on every un-debounced keystroke without a cap
- No IDB version bump; no CF2/query-log schema change; no corpus change

Out of SQ1B:

- Fuzzy / edit-distance
- Morphology / stemming
- Whitespace bag-of-words
- Cross-mode suggestions (EN completions while in FR→MNK)
- Changing posting `ir_id` sort
- N’Ko synthesis
- Automatic dictionary aliases

---

## 6. Non-goals

Do **not** implement yet:

- AI / semantic / embedding search
- Cloud search
- Automatic dictionary correction or silent gloss rewriting
- N’Ko synthesis (Latin→N’Ko); indexed N’Ko variants may remain searchable as-is
- Russian lookup or Russian gloss fallback
- Morphology engine without corpus-attested, reviewed variant rows
- New CF2 schema (V2 already carries LookupMode; CF2 must not become a miss classifier)
- Backend analytics
- Bag-of-words tokenization of English or French phrases (`SQ1E` unconstrained)
- Unbounded prefix-as-results for 1–2 character queries
- Renaming `src_*` → `fr_*`
- Merging ladder rungs in SQ1B (tone-less `bon` vs `bón` is SQ1G)
- Treating CF2 rows as missing-entry truth

---

## 7. Risk analysis

### Dictionary authority

Prefix completions that are **existing index keys** do not invent language. Risk rises if SQ1B returns prefix hits as if they were exact lemmas (`mai` → only May is correct as exact; `maison` must appear as a completion, not a silent rewrite). Fuzzy (SQ1D) and unsupervised morphology would invent mappings.

### Multilingual leakage

Completions must use `indexFamilyForLookupInput(mode.from)` only. English capability gating must remain fail-closed. Do not suggest `src_*` keys for EN→MNK or vice versa.

### Ranking regression

If prefix matches are spliced into the main result list without exact-first, `mai` and `bo` become unusable. Frozen Phase 7L posting orders must remain the exact-hit contract.

### Performance

Exact search is already O(number of ladder rungs) point reads (~1–4 `get`s). Prefix is a bounded cursor over one family+rung. Featured sizes (index 13.8 MB JSONL, records 16.0 MB, catalog payload 29.8 MB) already ship offline (ML1E). A capped prefix cursor is mobile-viable; scanning all 147k rows in JS is not.

### UX confusion

- Suggestions that look like “the dictionary says this is the word” vs “keys that start like your typing”
- FR mapping cards vs EN lexicon cards remain asymmetric; SQ1B should not pretend parity
- Phrase-miss copy (“try one word at a time”) can contradict prefix completions of multiword keys (`come back`) — SQ1B should keep miss copy for true empty exact+empty suggestion sets only

---

## 8. Test plan for next slice (SQ1B)

Minimum tests; do not rewrite the Phase 7L exact matrix except to add additive cases.

### Unit (fake IndexedDB or in-memory key lists)

1. Prefix helper returns keys only from the requested family.
2. Query `hou` + EN→MNK includes completion `house`; FR→MNK does not.
3. Query `enf` + FR→MNK includes `enfant`; EN→MNK does not.
4. Query `com` + EN→MNK includes `come` and `come back`.
5. Exact query `house` still returns the current single `ir_id` posting; completions optional/secondary.
6. Queries with length &lt; 3 after trim yield **no** prefix scan.
7. Result cap is enforced (`tgt` prefix `bo` has 419 keys).
8. Blank / whitespace-only unchanged (empty exact, no suggestions).
9. Capability: EN prefix fail-closes on non-English bundles.
10. No cross-rung merge in SQ1B (existing `bon` exact behavior unchanged).

### Replay / regression

11. Existing search-regression exact cases still pass (do not change expected `ir_ids` for complete queries).
12. Additive featured replay (local `bundle_full_20260710_337619ff__d076558b`) for `hou` / `maison` prefix vs exact `mai`.

### UI (if SQ1B ships a visible suggestion list)

13. Suggestions labeled as completions, not as committed results, until the user selects one.
14. LookupMode swap clears or rebuilds suggestions for the new family.
15. UI locale change does not change suggestion language.

### Explicitly not in SQ1B tests

- Fuzzy distance
- `grand pere` hyphen/space (SQ1C)
- `sœur` ligature (SQ1F)
- `mère` posting reorder (SQ1G)
- CF2 schema fields

---

## 9. Exact A/M/D

```text
A  docs/reports/sq1a_search_intelligence_audit.md
M  (none)
D  (none)
```

No audit helper script was added. Featured index replay was ephemeral Python against local artifacts.

---

## 10. Working tree

This slice adds only the report above. Pre-existing dirty files from other slices (if any) are out of SQ1A scope and were not modified.

---

## Appendix A — Architecture invariants (post ML1 + DU1 + LOGO1)

These are preserved and are not search defects:

- LookupMode is source of truth; four pairs only
- UI locale ≠ lookup language
- Russian removed from consumer fallback
- N’Ko synthesis deferred (source N’Ko variants remain in `tgt_*`)
- CF2 captures unmet need, not diagnostic truth
- Query logs V3 carry `input_lang` / `output_lang`
- Offline-first: search is local IDB after install
- Dictionary authority: index keys are derived from curated FR mappings or attested EN glosses / MNK forms — not inferred synonyms

## Appendix B — Performance snapshot (featured ML1E artifact)

| Metric | Value |
|--------|------:|
| Index rows | 147178 |
| `search_index.jsonl` | 13 834 042 bytes |
| `records.jsonl` | 15 959 637 bytes |
| Catalog `size_bytes` | 29 793 679 |
| Lexicon entries / index mappings | 8826 / 10509 |
| Exact search I/O | 1–4 IDB `get`s after 150 ms debounce |
| Full index parse (audit process, not runtime) | ~1.0 s |
| IDB schema | v6; `search_index` keyPath `[bundle_id, key_type, key]` + `bundle_id` index only |

Mobile/offline: already accepted at this payload (ML1E). SQ1B should not load the JSONL into the JS heap; use IDB range cursors.

## Appendix C — CF2 vs query-log usefulness (no schema change)

| Need | CF2 V2 | Query log V3 |
|------|--------|--------------|
| Raw query + LookupMode pair | Yes | Yes |
| Hit vs miss / result count | Yes | Yes (`result_status`) |
| Which ladder rung / normalized key | **No** | Yes |
| Latency | No | Yes |
| Prefix-would-have-hit | **No** | **No** |
| User-stated meaning | Optional `requested_meaning` | No |
| Always-on consumer telemetry | No (user-initiated) | No (consent + enable) |
| Classify miss taxonomy automatically | **No** (by design) | Partial (miss + keys), not prefix class |

Enough to **prioritize** later work **if** testers export V3 logs (recurring queries + mode + miss). **Not** enough today in-repo (no exports present). **Not** a reason to block SQ1B: featured index replay already evidences the prefix miss class.

---

## Return block

```text
Decision:
SQ1A_SEARCH_INTELLIGENCE_AUDIT_COMPLETE

Recommended next slice:
SQ1B — Prefix + Suggestions

Top 5 failure types:
1. Exact-only retrieval: incomplete queries miss while indexed completions exist
2. Exact short keys shadow longer intended words (mai vs maison; bo fan-out)
3. Hyphen vs space not unified (grand pere / right-hand / pick-up)
4. Ranking: lex ir_id order + ladder stop-early (mère, very, tone-less bon)
5. EN inflection / reviewed-variant gaps (houses, children, sœur) plus true content gaps (bonjour, poulet)

Highest-risk proposed change:
SQ1D typo-tolerant fuzzy search (and, inside SQ1B, unbounded prefix-as-results for 1–2 character queries)

No-go items:
AI/cloud search; automatic dictionary correction; N’Ko synthesis; Russian return;
morphology engine without corpus evidence; new CF2 schema; backend analytics;
bag-of-words gloss tokenization; ladder-rung merging in SQ1B

Files added:
docs/reports/sq1a_search_intelligence_audit.md

Files modified:
(none)

Tests/build:
not required (audit report only; no helper script)

git diff --check:
(see validation command)

Commit:
NOT CREATED
```
