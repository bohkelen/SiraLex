# SQ1C — Search Normalization Audit

## 1. Decision

```text
SQ1C_SEARCH_NORMALIZATION_AUDIT_COMPLETE
```

Audit/definition only. No runtime, UI, schema, bundle, corpus, or test changes.

Featured artifact inspected (same as SQ1A/SQ1B):

| Field | Value |
|-------|-------|
| Logical `bundle_id` | `bundle_full_20260710_337619ff` |
| Physical path | `web/public/bundle_full_20260710_337619ff__d076558b/` |
| `content_sha256` | `sha256:d076558b2f668a06a5a30a143026433e9e0de3523e0397183cfd897b2641d90a` |
| Catalog version | `norm-v3-featured-ml1e-multilingual-en-index` |
| Normalization | `norm_v3` |
| English rule | `en_gloss_key_v1` |
| IndexedDB | `SIRALEX_DB_VERSION = 6` |

Inspection method: read builder/runtime code; replay the featured `search_index.jsonl` in-process with Python `norm_v3.compute_search_keys` (same ladder stop-early semantics as exact search); compare JS `web/src/norm/norm_v1.ts` on the same sample strings. No production dictionary data was modified. No inspection helper was added to the repo.

---

## 2. Files inspected

| Path | Purpose |
|------|---------|
| `web/src/norm/norm_v1.ts` | Consumer/runtime search-key ladder (JS mirror of Python `norm_v1`) |
| `web/src/norm/norm_v1.test.ts` | Cross-language fixture parity |
| `shared/normalization/norm_v1.py` | Canonical primitives: whitespace, casefold, diacritics strip, punct strip, nospace; unused `punctuation_to_space` |
| `shared/normalization/norm_v2.py` | FR `extract_source_phrases` (comma/semicolon/slash split) |
| `shared/normalization/norm_v3.py` | Builder key entry: whitespace → NFC → `norm_v1` ladder |
| `shared/specs/normalization-versioning.md` | Normative apostrophe / punctuation dual-key guidance |
| `shared/normalization/fixtures/norm_v1_search_keys.json` | Golden JS↔Python keys |
| `api/normalizer/normalize.py` | FR keys from `index_mapping.source_term` + phrases; MNK keys from lexicon variants |
| `api/search_index/build_index.py` | Materializes `src_*` / `tgt_*` from record `search_keys`; additive `en_*` via `en_gloss_key_v1` |
| `api/search_index/en_gloss_key_v1.py` | EN surfaces: unitary gloss + comma alternatives; no slash/whitespace split |
| `api/search_regression/replay.py` | Python query keys via `norm_v3` |
| `web/src/search/search_query.ts` | Exact search: `trim` → `normalizeNfc` → `computeSearchKeys` → IDB point-gets |
| `web/src/search/search_suggestions.ts` | SQ1B prefix: **same** query key function and ladder order |
| `web/src/search/lookup_mode.ts` | Family selection `src_*` / `en_*` / `tgt_*` |
| `web/src/idb/siralex_db.ts` | IDB v6; search store keyPath `[bundle_id, key_type, key]` |
| `web/public/catalog.json` | Featured bundle pointer |
| `web/public/bundle_full_20260710_337619ff__d076558b/{bundle.manifest.json,search_index.jsonl,records.jsonl}` | Featured keys and sample records |
| `docs/reports/sq1a_search_intelligence_audit.md` | Prior failure taxonomy (hyphen/space = SQ1C) |
| `docs/reports/sq1b_prefix_and_suggestions_report.md` | Prefix bounds; hyphen/space explicitly not implemented |

---

## 3. Current normalization pipeline

### Builder-side

Featured records stamp `norm_version: norm_v3`.

Per input form, `norm_v3.compute_search_keys`:

1. `normalize_whitespace` (Unicode `\s+` → one ASCII space, trim)
2. `normalize_nfc`
3. `norm_v1` ladder on that string:

| Rung | Pipeline | Keeps |
|------|----------|-------|
| `casefold` | whitespace → Unicode casefold (Python `str.casefold`) | accents, hyphens, apostrophes, spaces |
| `diacritics_insensitive` | … → NFD, drop Mn/Mc/Me, NFC | base letters including `ç`→`c` via cedilla mark; **not** `œ`→`oe`; **not** `ɔ`→`o` |
| `punct_stripped` | whitespace → **delete** Unicode `P*` → casefold → strip marks | letters/digits/spaces/symbols; hyphen and `'`/`’` gone; **spaces remain** |
| `nospace` | whitespace → casefold → strip marks → delete ASCII `0x20` only | **hyphens and apostrophes remain** |

`punctuation_to_space` is implemented in Python `norm_v1` and described in the spec. It is **not** a stored rung. JS `norm_v1.ts` does not implement it.

**FR (`src_*`):** `normalize_index_mapping` takes `fields_raw.source_term`, runs `extract_source_phrases` (keep original; split `, ; /` and enumerations; optional trailing-paren strip), then `compute_search_keys` on those phrases. Index builder copies record `search_keys` into `src_{rung}`.

**EN (`en_*`):** `en_gloss_key_v1` emits trimmed `gloss_en` surfaces (comma alternatives + trailing paren strip). Builder runs the record’s `norm_v3` `compute_search_keys` on each surface. No slash split, no whitespace tokenization.

**MNK (`tgt_*`):** `normalize_lexicon_entry` keys preferred Latin headword, source anchors, optional source N’Ko, reviewed variants. Same four rungs. N’Ko is NFC’d as a variant form, not synthesized from Latin.

### Runtime query normalization

`searchQueryForLookupMode` / `runExactnessLadder`:

1. `query.trim()` (edges only; interior whitespace is **not** collapsed here)
2. `normalizeNfc(trimmed)`
3. `computeSearchKeys([…])` from **JS `norm_v1`**, which then `normalizeWhitespace` inside every rung

So interior tabs/newlines/repeated spaces **are** collapsed, just one step later than Python `norm_v3` (which whitespace-normalizes before NFC). On featured probes, v3 vs runtime-like v1+NFC agreed for ordinary Latin queries.

JS casefold is `NFKC + toLowerCase + ß→ss`, not Python `str.casefold`. Shared fixtures still match. **`œ` does not NFKC-decompose to `oe`** (Python and JS); ligature mismatch is not a JS/Python drift.

Runtime does **not** run `extract_source_phrases` or `en_gloss_key_v1` on the user string. The query is one form, four keys, point-gets.

### Exact search behavior

Walk `casefold` → `diacritics_insensitive` → `punct_stripped` → `nospace`. Stop at the first non-empty posting. No rung merge, no client re-rank. LookupMode selects exactly one family.

Consequence that drives hyphen/space failure: hyphen deletion and space deletion live on **different rungs**, so they never meet.

Example (FR indexed `grand-père`):

| Query | Query `punct_stripped` | Query `nospace` | Indexed `punct_stripped` | Indexed `nospace` | Result |
|-------|------------------------|-----------------|--------------------------|-------------------|--------|
| `grand-père` | `grandpere` | `grand-pere` | `grandpere` | `grand-pere` | Hit `casefold` |
| `grand pere` | `grand pere` | `grandpere` | `grandpere` | `grand-pere` | **Miss** (keys never equal on the same rung) |
| `grandpere` | `grandpere` | `grandpere` | `grandpere` | `grand-pere` | Hit `punct_stripped` |

EN `right hand` is indexed; `right-hand` is not. Concat `righthand` hits `nospace` of the spaced key. Hyphenated typing misses.

### Prefix suggestion behavior (SQ1B)

Same `computeSearchKeys([normalizeNfc(trimmed)])`, same family, same rung order, first rung with any prefix candidates wins. Min length 3 on the normalized key (`Array.from`).

`grand pere` produces **no** `src_casefold` / `src_diacritics_insensitive` / `src_punct_stripped` prefixes, and `src_nospace` prefix `grandpere` does not match stored `grand-pere`. SQ1B does **not** repair hyphen↔space misses. Prefix `grand` can list `grand-père` among other `grand*` keys; that is incomplete-typing, not normalization.

---

## 4. Failure table

Replay = Python `norm_v3` keys + first non-empty featured posting (consumer JS keys matched these samples, including `sœur` staying `sœur`).

| Variation type | Example query | LookupMode | Current behavior | Expected safe behavior | Cause | Risk | Requires index rebuild? | Recommended action |
|----------------|---------------|------------|------------------|------------------------|-------|------|-------------------------|--------------------|
| French accents (é/è/ê/ë, NFD vs NFC) | `mere` / `mère` / `MÈRE` / `mère` (combining) | FR→MNK | Hit (`casefold` or `diacritics_insensitive`) | Same | Marks stripped on rung 2; NFC unifies combining | Low | NO | None (working) |
| ç / c | `façade` / `facade` | FR→MNK | Both hit same mapping | Same | Cedilla is a combining mark after NFD | Low | NO | None (working) |
| Missing headword, not accent | `garçon` / `garcon` | FR→MNK | Miss both | Content gap | No `src_*` key | n/a | NO | SQ1F / alias; not normalization |
| Ligature œ / oe | `sœur` miss; `soeur` hit. Same for `cœur`/`coeur`, `œuf`/`oeuf` | FR→MNK | Ligature miss; ASCII hit | Map œ↔oe as French orthography, not fuzzy | `œ` is a letter; diacritics strip does not expand it. **Zero** `œ` keys in featured `src_casefold` | Low if FR query expansion only | NO if query also tries `oe` | Safe-now candidate; **not** the next slice (smaller than hyphen/space) |
| Elision article | `l'eau` / `leau` miss; `eau` hits | FR→MNK | Miss | Do not invent `l'` stripping | No indexed article form | High if auto-elision | NO | Content; reject as SQ1C |
| Straight vs curly apostrophe | `quelqu'un` hit; `quelqu’un` hit `punct_stripped` `quelquun` | FR→MNK | Hit | Same | Both `P*` | Low | NO | None (working) |
| Modifier letter apostrophe U+02BC | `quelquʼun` | FR→MNK | Miss | Treat as apostrophe on FR/EN query | Category **Lm**, not `P`; not stripped | Medium if applied to MNK | NO | Defer or FR/EN-only replace → `'` |
| Backtick U+0060 | `quelqu`un` | FR→MNK | Miss | Optional FR/EN map to `'` | Category **Sk**, not `P`. Featured has 12 backtick keys (EN `rak`ah`; MNK `n`` `k`` …) | High on MNK | NO | Do not fold backticks on `tgt_*` |
| Leading/trailing `'` / `’` | `'maison'`, `'house` | FR/EN→MNK | Hit via `punct_stripped` | Same | Edge punctuation deleted | Low | NO | None (working) |
| Maninka apostrophe-like keys | `n'`, `b'`, `din`` | MNK→* | Indexed; `n` vs `n'` already differ by first-rung win | Do not add extra apostrophe folding on MNK | Clitics / truncated forms; strip already exists on later rungs | High | NO | Leave; SQ1G if ranking of `n` vs `n'` matters |
| Hyphen vs space (pure compound) | `grand pere` miss; `grand-père` / `grandpere` hit | FR→MNK | Miss | Hit same posting as hyphenated key | Hyphen deleted on `punct_stripped`; space deleted on `nospace` | Low on FR/EN miss-only expansion | NO | **SQ1C1** |
| Hyphen vs space (EN) | `right-hand` / `pick-up` miss; spaced + concat hit | EN→MNK | Miss | Hit spaced key | Same ladder split. 119 pure `en_casefold` hyphen keys; 109 space-queries miss without expansion | Low if miss-only and original first | NO | **SQ1C1** |
| Mixed space+hyphen | `acacia faux-gommier` typed as `acacia faux gommier` | FR→MNK | Miss even with naive all-hyphen↔all-space | Unclear; often same compound | Naive rewrite produces `acacia-faux-gommier`, not `acacia faux-gommier` | Medium (positional guess = fuzzy-ish) | NO for naive; YES if indexing all hyphenations | Defer mixed compounds |
| Concat vs hyphen | `grandpere`, `righthand`, `pickup` | FR/EN | Hit | Same | `punct_stripped` (FR hyphen) or `nospace` (EN space) | Low | NO | None (working) |
| Distinct hyphen vs space entries | `know-how` vs `know how`; FR `fausse-couche` vs `fausse couche` | EN/FR | Each exact form hits its own posting | Keep distinct; do not rewrite hits | Two indexed keys, different `ir_id`s (2 EN pairs, 1 FR pair) | Medium if expansion runs **before** exact | NO | Expand **only after exact miss** |
| MNK hyphen | `-ba`, `duba-duba`, N’Ko `ߓߟߊ߬-…` | MNK→* | Exact hyphen keys exist | Do not space-fold | 40 leading-hyphen suffix keys; 57 internal hyphens; morphological / ideophone / N’Ko | **High** | NO | Exclude MNK from SQ1C1 |
| Slash-separated EN gloss | `sth / smb.` miss; key stored whole | EN→MNK | Miss | Leave whole (ML1B) | `en_gloss_key_v1` forbids slash split (10 `en_casefold` slash keys) | Very high if split | NO | Reject (SQ1E) |
| Slash-separated FR source | segments often already indexed | FR→MNK | Split at **build** time | Keep builder policy | `extract_source_phrases`; 10 remaining original slash `src_casefold` keys | Low | NO | None |
| Comma-separated FR | `abandonner sa femme` / `divorcer de sa femme` both hit | FR→MNK | Segments indexed plus 168 original comma keys | Keep | Builder split | Low | NO | None |
| Comma EN | N/A as stored commas | EN→MNK | Alternatives already separate keys | Keep | Split at extraction, not at query | Low | NO | None |
| Leading/trailing whitespace | ` house `, `maison\t` | EN/FR | Hit | Same | trim + whitespace collapse | Low | NO | None (working) |
| Repeated spaces / tab / newline interior | `come  back`, `come\tback` | EN→MNK | Hit `come back` | Same | `\s+` → space | Low | NO | None (working) |
| Case | `HOUSE`, `MAISON` | EN/FR | Hit `casefold` | Same | Rung 1 | Low | NO | None (working) |
| Maninka open vowels | `dobɛn` miss; `doben` hits diacritics of `dɔ́bɛ̀n` | MNK→* | `ɔ`/`ɛ` ≠ `o`/`e` | Do not map | Base letters, not marks | High | NO | SQ1F reviewed variants |
| Builder vs runtime NFC order | combining + spaces | all | Aligned on featured probes | Keep | v3: whitespace then NFC; runtime: trim+NFC then whitespace in keys | Low | NO | Document only; no slice |
| SQ1B vs exact keys | any | all | Same `computeSearchKeys` | Keep | Shared module | Low | NO | None |

Featured hyphen inventory (`*_casefold` containing ASCII `-`): **249** `src`, **194** `en`, **97** `tgt`. Naive hyphen↔space **plus concat** query expansion recovers **175/249** FR and **120/194** EN space-from-hyphen queries; remaining misses are **all mixed** space+hyphen keys (74 FR, 74 EN). Concat-from-hyphen already hits **249/249** FR and **194/194** EN without expansion.

---

## 5. Safe candidates

### A. Safe now (runtime query only; existing keys; no IDB/schema/rebuild)

1. **Hyphen ↔ space expansion after exact miss, FR→MNK and EN→MNK only**  
   Variants: original (already tried); replace ASCII hyphen-minus with space; replace ASCII spaces with hyphen-minus. Do **not** concat (already covered). Do **not** apply to MNK. Do **not** rewrite on hit.  
   Orthographic for French/English compounds (`grand-père` / `right-hand`). Language-specific. Does not invent stems. Collision pairs stay distinct because exact wins.

2. **French ligature query expansion `œ/Œ` → `oe/Oe` (and optionally `æ` → `ae`) on FR (optionally EN) miss**  
   Pure orthography for this corpus: indexed forms are `soeur` / `coeur` / `oeuf` / `oeuvre`; no `œ` keys exist. Not a diacritic. Do not apply to MNK.

3. **FR/EN-only map U+02BC `ʼ` → `'` on the query**  
   Then existing `punct_stripped` matches. Unsafe on MNK if generalized to backticks.

### B. Safe only with index rebuild

1. Store a **`punctuation_to_space` rung** (hyphen→space, apostrophe→space) as a fifth key type — new rows, not an IDB version bump by itself, but a **bundle rebuild** (~147k rows grow by another family of keys). Apostrophe→space would also index `quelqu un`, which is a policy change.
2. **Materialize both hyphenated and spaced keys** for every compound at build time — same retrieval without runtime variants; larger index; still must not fold MNK suffixes.
3. **Mixed** space+hyphen restoration (index all hyphenation patterns) — combinatorial; not a small query rewrite.

Adding a fifth rung does **not** require IndexedDB schema change (key_type is already a string in the compound key). It **does** require regenerating `search_index.jsonl`.

### C. Unsafe / defer

| Item | Why |
|------|-----|
| Fuzzy / edit distance | Out of scope; Maninka short-form damage |
| Stemming / plurals / morphology | Invents language; SQ1F aliases only |
| `ɔ`/`o`, `ɛ`/`e` | Distinct letters |
| Auto `l'` / elision stripping | Not the same indexed meaning; content |
| EN slash or bag-of-words split | ML1B rejected; `hand` vs `right hand` |
| MNK hyphen↔space | Suffix `-ba`, reduplication, N’Ko hyphens |
| Global backtick folding | MNK `n`` / `k`` keys |
| `punctuation_to_space` on **queries that already hit** or as first rung | Would merge punctuated vs spaced forms and shift ladder winners |
| User-feedback auto-ranking | SQ1G / SQ1H; not normalization |
| Dictionary mutation | Authority |

---

## 6. Recommended next slice

```text
SQ1C1 — Hyphen/space query expansion
```

**Why this, not “runtime query normalization alignment”:** builder `norm_v3` and consumer JS `norm_v1`+NFC already agree on case, whitespace, accents, and apostrophe stripping for the featured probes. There is no systematic NFC/casefold alignment bug to ship as the slice.

**Why this, not “diacritic/ligature query expansion”:** combining French/English accents and `ç` already hit. Ligature `œ`→`oe` is real and **safe-now**, but featured impact is a handful of headwords (`soeur`, `coeur`, `oeuf`, …). Hyphen↔space is systematic: **145/147** pure FR hyphen keys miss when typed with spaces; **109/119** pure EN hyphen keys miss when typed with spaces; SQ1B does not fix them.

**Why this, not “no implementation; defer to ranking”:** these queries return **zero** hits. Ranking never runs.

**SQ1C1 proposed bounds (definition only):**

- After exact miss only; keep current ladder and posting order on the first hit (original or variant).
- LookupMode `from === "fr"` or `"en"` only; never `tgt_*`.
- ASCII hyphen-minus U+002D ↔ ASCII space only (featured index has no U+2010/U+2011/en-dash keys in `casefold`).
- Do not expand mixed patterns beyond global replace (accept residual mixed misses).
- Same variant set may be reused for SQ1B prefix **only if** exact variants still miss (optional follow-on; not required to define SQ1C1).
- No new CF2 / query-log schema; log the query the user typed; `query_normalized_keys` remain the keys of the **successful** variant if one hits (implementation detail for SQ1C1 tests).
- No index rebuild, no IDB v7, no `punctuation_to_space` rung.

---

## 7. Non-goals

Explicitly reject for SQ1C / SQ1C1:

- Fuzzy search, edit distance, typo tolerance
- Stemming, plural handling, morphology
- Semantic / AI / token-bag search
- User-feedback-driven auto-ranking
- Dictionary or corpus mutation; reviewed aliases (SQ1F)
- New CF2 schema; query-log schema change
- Featured index / bundle rebuild
- N’Ko synthesis; Russian surfaces
- Merging ladder rungs (tone-less `bon` remains SQ1G)
- EN slash splitting; FR elision `l'eau`→`eau`
- Maninka hyphen or open-vowel folding

---

## 8. Test plan for recommended slice

Minimum tests (to implement in SQ1C1, not in this audit):

1. **FR miss → hit:** `grand pere` / `grand père` retrieve the same `ir_ids` as exact `grand-père`; `matched_key` may be the hyphenated diacritics/casefold key.
2. **FR already-hit unchanged:** `grand-père` still hits `casefold` first (no expansion path).
3. **FR concat unchanged:** `grandpere` still hits `punct_stripped` without needing expansion.
4. **EN miss → hit:** `right-hand` and `pick-up` retrieve the same postings as `right hand` / `pick up`.
5. **EN spaced exact unchanged:** `right hand` still `casefold`.
6. **Collision / exact-first:** `know-how` and `know how` keep different postings; expansion must not swap them when the typed form is indexed.
7. **MNK isolation:** hyphen expansion must not run for MNK→FR/EN; `-ba` vs `ba` behavior unchanged; no FR/EN family leakage.
8. **SQ1B regression:** `hou` / `enf` / `bol` still suggest; `grand pere` after SQ1C1 should be an **exact hit** (suggestions not required).
9. **Normalization non-regression:** `mere`/`mère`, `quelqu'un`/`quelqu’un`, case/whitespace probes still pass.
10. **Capability:** English still fail-closed without `en` family; no `ru_*`.

No featured-index golden dump required if tests use a tiny synthetic IDB like SQ1B.

---

## 9. Risk analysis

### Multilingual leakage

Expansion must use the same LookupMode family as exact search. FR must not probe `en_*`. EN must not probe `src_*`. MNK must not gain hyphen variants that collide with French compounds.

### False merges

Miss-only + original-first preserves the three attested dual-indexed pairs. Residual risk: a **misspelled** spaced query that happens to equal some other hyphenated key. That is ordinary exact-key lookup on a generated variant, not fuzzy. Mixed-compound guessing is deferred to avoid that class of error.

### Maninka damage

Applying hyphen↔space on `tgt_*` would pull suffix keys (`-ba`) and hyphenated phrases toward spaced/truncated Latin. **Out of SQ1C1.** Existing `punct_stripped` already strips MNK apostrophes on later rungs; do not add more MNK punctuation policy here.

### Prefix suggestion regressions

If SQ1C1 exact expansion hits, SQ1B does not run (miss-only). That is correct. If expansion is wired incorrectly **before** exact, suggestion tests that depend on miss could fail. Keep expansion after the current exact walk.

Ligature expansion, if added later, must not shorten the SQ1B gate (still ≥ 3 normalized chars on the **typed** primary key unless explicitly redesigned).

### Performance cost

Exact path today: 1–4 IDB `get`s. SQ1C1 on miss: at most two extra variant strings × up to four rungs ≈ **+8 `get`s**, only when the original ladder missed. No cursor scan, no extra index rows, no IDB version bump, no bundle rebuild. Offline: same installed `search_index` store.

Rebuild alternative (5th rung) would add on the order of another ~35k–40k rows per family if applied to all keys — unnecessary for the recommended slice.

---

## 10. Working tree

Expected for this audit:

```text
A docs/reports/sq1c_search_normalization_audit.md
```

No runtime, UI, schema, bundle, or test file changes.
