# ML1A — English Search Coverage + Russian Consumer Visibility Audit

## Decision

```text
ML1A_LANGUAGE_AUDIT_COMPLETE
```

## BASE_COMMIT

```text
66b2ebd2d459685bb625a3a38c6040bf0e42b3c5
```

Audit executed against the repository working tree after that commit tip lineage. Featured dictionary identity and language data under audit are unchanged by later wordmark/version commits. No runtime, bundle, schema, index, or ROADMAP implementation changes were made in this slice (report only).

## Featured dictionary under audit

| Item | Value |
|------|--------|
| Featured bundle id | `bundle_full_20260710_337619ff` (`VITE_FEATURED_BUNDLE_ID`) |
| Catalog name | French ↔ Maninka |
| Catalog languages | `source_lang: fr`, `target_lang: mnk` |
| Public path | `web/public/bundle_full_20260710_337619ff/` |
| IR lexicon | `data/ir/malipense_lexicon_v3.jsonl` |
| Pipeline | IR → normalize → enrich → build-index → bundle (`docs/BUILD_BUNDLE.md`) |

---

## A. Lexicon language coverage

Counts from featured `records.jsonl` using explicit fields only (`ir_kind`, `display.senses[].gloss_*`, `trans_*`).

| Metric | Count |
|--------|------:|
| `lexicon_entry` records | **8826** |
| `index_mapping` records | **10509** (all `display.source_lang: "fr"`) |
| Entries with ≥1 nonempty `gloss_fr` | **5689** |
| Entries with ≥1 nonempty `gloss_en` | **8713** |
| Entries with ≥1 nonempty `gloss_ru` | **8713** |
| Sense-level nonempty `gloss_fr` / `gloss_en` / `gloss_ru` | **9030 / 12127 / 12127** |
| Example nonempty `trans_fr` / `trans_en` / `trans_ru` | **1317 / 1317 / 1317** |
| Entries with EN but no FR gloss | **3067** |
| Entries with FR+EN | **5646** |
| Entries with FR+EN+RU | **5646** |
| Entries with no FR/EN/RU sense gloss | **70** |

IR lexicon line count: **8823** (`data/ir/malipense_lexicon_v3.jsonl`). Featured enriched lexicon count is 8826 (pipeline/supplements may add a few records; not investigated further here).

### Exact language field paths

**Lexicon (IR `fields_raw` → enriched/bundle `display`):**

- `display.senses[].gloss_fr` | `gloss_en` | `gloss_ru`
- `display.senses[].examples[].trans_fr` | `trans_en` | `trans_ru`
- `display.senses[].sub_entries[]` / subentry objects: `gloss_fr` | `gloss_en` | `gloss_ru` (when present)

**Index mapping (French reverse index only):**

- `display.source_lang` (always `"fr"` in featured bundle)
- `display.source_term`
- `display.target_entries[]`

**Search index lines:** `{ key, key_type, ir_ids }` with `key_type` ∈  
`src_casefold|src_diacritics_insensitive|src_punct_stripped|src_nospace|tgt_*`  
No language-tagged key families. **0 Cyrillic keys** in featured `search_index.jsonl`.

TS types: `web/src/types/records.ts` (`SenseRaw`, `ExampleRaw`).

---

## B. English data quality

**Verdict: systematically structured, search-asymmetric vs French.**

| Property | Finding |
|----------|---------|
| Structure | Explicit parallel fields `gloss_en` / `trans_en` beside FR/RU in Mali-pense–derived IR |
| Availability | High on lexicon senses (8713/8826 entries); often denser than FR glosses |
| Search role | **Display / Learning / CF1 only** — not an `index_mapping` source language |
| Derived? | No — captured from source HTML classes (e.g. IR parser `GlEn`); not synthesized by SiraLex |
| Consistency | Real bilingual content; quality varies (short lemmas, multiword definitions, some EN-without-FR senses) |

Sense-level EN glosses: **5936** single-token vs **6191** multiword; **7845** unique `gloss_en` strings. Of EN senses: **3184** lack FR, **8767** distinct from FR, **176** identical to FR text.

French **search** coverage comes from `index_mapping.source_term` (10509 FR phrases), **not** from `gloss_fr`. English has rich lexicon glosses but **zero** `index_mapping` rows with `source_lang: "en"`. Therefore English is **not** a drop-in twin of French search.

### Representative real records (featured bundle)

| `gloss_en` | Maninka headword | `gloss_fr` | `ir_id` |
|------------|------------------|------------|--------|
| house | `bón` | maison | `211060723bc2edc5` |
| father | `fà` | père | `3d8d66d114d655d8` |
| eat | `dámun` | manger | `5d9857041c591352` |
| come | `nà` | venir, arriver | `fc5fbda840722c96` |
| intransitive aorist | `-da` | aoriste intransitif | `964909ef6912ff64` |

French control: `maison` exists as `index_mapping` → target `bón` and as lexicon `gloss_fr` on the same headword family — English `house` exists only as lexicon gloss, not as an indexed source term.

---

## C. Current search index

### Pipeline

```text
IR (malipense_lexicon_v3 / malipense_index_v1)
  → api/normalizer/normalize.py   (headwords / FR source_term → undirected search_keys; not glosses)
  → api/enrichment/enrich.py      (attach display = fields_raw)
  → api/search_index/build_index.py
        index_mapping → src_*
        lexicon_entry → tgt_*
  → api/bundle_builder/build_bundle.py
  → web runtime web/src/search/search_query.ts → searchQuery() / toDirectionalKeyType()
```

Relevant: `directional_key_type()` in `api/search_index/build_index.py`; runtime `toDirectionalKeyType()` in `web/src/search/search_query.ts`.

**English text does not produce search keys.** Featured index has **112265** key rows; probes of real EN gloss lemmas against `src_casefold` / `tgt_casefold` all miss.

### English query examples (real data → current result)

| Query | Expected Maninka (from `gloss_en`) | Current result | Key family hit |
|-------|------------------------------------|----------------|----------------|
| `house` | `bón` (`211060723bc2edc5`) | no hit | none |
| `father` | `fà` | no hit | none |
| `eat` | `dámun` | no hit | none |
| `come` | `nà` | no hit | none |
| `head` | `dátii` (EN-only gloss row in sample) | no hit | none |
| `water` | `sɔ́` (gloss_fr “arroser” — verb sense) | no hit | none |

French controls (same index): `tête`, `eau`, `mère`, `abandonner`, `maison` → **`src_casefold` hit**.  
Maninka controls: `kùn`, `kun`, `ji`, `den` → **`tgt_casefold` hit**.

---

## D. Current direction model

| Direction | Index family | Product meaning today | UI labels (catalog) |
|-----------|--------------|----------------------|---------------------|
| `source_to_target` | `src_*` | French phrase → Maninka | French → Maninka |
| `target_to_source` | `tgt_*` | Maninka headword → entry (glosses shown) | Maninka → French |

Binary direction only. Catalog/runtime meta: `source_lang`/`target_lang` = `fr`/`mnk`.

**Maninka → English “search”:** Maninka lookup already works via `tgt_*`. Entry/Review/Saved can show `gloss_en`. The gap is **labeling / which gloss is primary**, not absence of Maninka keys.  
**English → Maninka:** requires new indexed English material; does not exist today.

Adding English as another **source** language can preserve existing `src_*`/`tgt_*` French↔Maninka semantics if English keys are **additive** (not a reuse of `src_*` for mixed FR+EN).

### Architecture options

| Option | Idea | Bundle authority | Multi-bundle / Learning `(bundle_id, ir_id)` | Search UI | CF1/CF2 | Offline size | Backward compat | Future langs |
|--------|------|------------------|---------------------------------------------|-----------|---------|--------------|-----------------|--------------|
| **A** | One bundle; additive namespaces e.g. keep `src_*`=FR, `tgt_*`=MNK, add `en_*` from structured `gloss_en` | Single featured authority | **Unchanged** identity | Need source-language (FR vs EN) or extended direction chrome | Provenance fields unchanged; optional target lang already has `en` | Index grows by EN keys only | **Best** if `src_*`/`tgt_*` untouched | Natural (`es_*`, …) |
| **B** | Separate FR↔MNK and EN↔MNK bundles | Split authority; two installs | **Risk:** same Maninka `ir_id` under different `bundle_id` fragments Learning; dual active dictionary UX | Two dictionaries or forced switch | CF drafts bound to bundle | Near-duplicate Maninka payload | Breaks “one dictionary” story | Costly duplication |
| **C** | Repo-supported minimal: regenerate **one** featured bundle with EN keys + catalog still one pair, UI locale picks FR vs EN source ladder | Same as A | Same as A | Same as A | Same as A | Same as A | Same as A | Same as A |

**Recommended: OPTION A (additive `en_*` in the same featured bundle; do not rename existing `src_*`/`tgt_*`).**  
Option C is the same architectural choice packaged as a rebuild/publish path, not a different model. Option B is rejected for Learning identity split and offline duplication unless a future product requires separate packaged dictionaries.

**Why not put English into `src_*`:** would mix FR phrase index with EN gloss tokens under one ladder, changing French hit sets/ordering and invalidating frozen search contracts (Phase 7L / featured ladders).

**Caveat:** EN→MNK quality will differ from FR→MNK until/unless a reviewed English reverse-index (analogous to `index_mapping`) exists. ML1 must not invent EN↔MNK mappings or AI-fill gaps; index only authoritative `gloss_en` / related structured fields with an explicit keying policy (exact string vs tokenized — product decision in ML1B).

---

## E. Russian display path

| Surface | File / path | How Russian appears |
|---------|-------------|---------------------|
| Search result subtitle | `web/src/render/render_results.ts` → `summarizeLexicon()` | Fallback: `gloss_fr ?? gloss_en ?? gloss_ru` — RU only if FR+EN absent |
| Entry Detail | `web/src/render/render_entry.ts` | **Explicit:** renders `gloss_ru`, `trans_ru`, subentry `gloss_ru` when present |
| Saved Vocabulary | `build_display_cache.ts` / saved session | **FR then EN only** — RU omitted |
| Review | `web/src/render/review_display.ts` | **FR + EN only** — RU omitted from glosses/example translations |
| CF1 capture | `correction_form_model.ts` + `render_correction_form.ts` | Explicit `gloss_lang: "ru"` option + i18n `translationRu` when live `gloss_ru` exists |
| CF1 management | `render_correction_management.ts` | Labels for `ru` targets |

**Not** a generic “all translations” loop on Entry — discrete `if (sense.gloss_ru)` branches.  
Russian remains in IR/enriched records for provenance; consumer visibility is renderer policy.

---

## F. Russian removal options

| # | Option | Fits product scope? | Frozen data? | CF1? | Deterministic rebuild? |
|---|--------|---------------------|--------------|------|------------------------|
| 1 | **Presentation-only exclusion** | Yes | Preserved | Hide new RU targets; keep schema/`gloss_lang:"ru"` for existing drafts | N/A |
| 2 | Strip RU from enriched projection only | Yes | IR frozen OK | Same | Rebuild enrich+bundle |
| 3 | Strip from normalized/bundle records | Heavier | Still keep IR | Same | Rebuild |
| 4 | Strip from source/IR | **No** — mutates frozen provenance | Violates preference | Breaks preservation tests | Forbidden for default path |

**Recommended: (1) presentation-only exclusion** on ordinary consumer surfaces (Entry, Search fallback, CF1 target picker), matching ROADMAP product language scope and Saved/Review precedent. Retain RU in IR/enriched packages. Do not mutate Phase 1 IR in place.

---

## G. Bundle size

Featured package approximate sizes:

| File | Bytes |
|------|------:|
| `records.jsonl` | 15 959 637 |
| `search_index.jsonl` | 10 209 943 |
| `bundle.manifest.json` | 1 217 |

UTF-8 string payload inside `display` for gloss/trans fields (approx.):

| Language | String bytes | Share of `records.jsonl` |
|----------|-------------:|-------------------------:|
| FR | 261 535 | ~1.6% |
| EN | 271 876 | ~1.7% |
| RU | 629 810 | ~3.9% |

EN+RU together ~**5.7%** of records file; RU is the larger display payload. **Not material enough to drive architecture** — presentation exclusion already avoids shipping a second policy; stripping RU from a future projection would save ~4% of records, not of the full offline install (~26MB catalog `size_bytes`).

Adding `en_*` index keys later would grow `search_index.jsonl` (order: thousands of EN strings × normalization rungs) — estimate in ML1C, not blocking.

---

## H. Existing test impact (do not modify in ML1A)

| Area | Examples |
|------|----------|
| FR/Maninka labels & pair | `bundle_labels.test.ts`, dictionary management tests, catalog `French ↔ Maninka` |
| Directional search | `search_query.test.ts` (`source_to_target` / `src_casefold`) |
| EN gloss rendering | `render_review.test.ts`, Learning display_cache fallback-to-EN tests |
| **RU rendering asserted** | `render_entry_ux2.test.ts` expects `"рука"`; CF1 `correction_form_model.test.ts` / `correction_draft_types.test.ts` with `gloss_lang: "ru"` |
| CF1 translation targets | form model builds fr/en/ru options from live glosses |
| Saved/Review lexical authority | live entry extraction; FR/EN gloss preference; no RU |
| IR golden | `api/ir_parser/tests/test_golden_fixtures.py` `has_gloss_en` / `has_gloss_ru` |
| Enrichment | `api/enrichment/tests/test_enrichment.py` retains `gloss_ru` |

RL1 must update Entry/CF1 **presentation** tests that require visible RU; must **not** delete IR golden expectations that RU exists in data.

---

## I. Scope assessment

### English search: **ENGLISH_SEARCH_MEDIUM**

**Why not SMALL:** English is not indexed; binary direction/`src_*` semantics are French-only; UI needs a source-language story; bundle rebuild + search regression (7L) affected.  
**Why not LARGE:** Authoritative `gloss_en` already exists at scale; no need to invent translations; Learning identity can stay `(bundle_id, ir_id)`; CF1/CF2 schemas need not change for a first EN ladder; Option A avoids dual-bundle duplication.

### Russian hide: **RUSSIAN_HIDE_SMALL**

Presentation filters in a few renderers + CF1 target visibility; Saved/Review already omit RU; no IR mutation; schema retention for provenance.

---

## J. Proposed implementation slices

Keep slices separate (safer than merging):

| Slice | Scope |
|-------|--------|
| **ML1B** — Multilingual language/index contract | Define additive `en_*` (or equivalent) key policy; document that `src_*` remains French-only; direction/UI contract for FR vs EN source; no AI/fill; acceptance for gloss keying (exact vs tokens) |
| **ML1C** — English index/bundle support | Pipeline: emit EN keys from structured `gloss_en` (and agreed subfields); rebuild featured bundle; catalog still one FR/EN↔MNK product dictionary; preserve `ir_id` |
| **ML1D** — English consumer search UI | Source-language selection or equivalent chrome; labels EN↔Maninka; do not break FR path |
| **RL1** — Russian consumer display removal | Presentation-only: Entry, Search fallback, CF1 picker; retain data + draft `gloss_lang:"ru"`; update UX2 Entry tests that assert visible RU |
| **ML1E** — Regression/publication | 7L/search smoke, EN probe matrix, FR regression, Learning/CF1/CF2 smoke, catalog publish |

Do **not** merge RL1 into ML1C: unrelated risk surfaces. Do **not** merge ML1B+ML1C until contract is written.

---

## High-risk files likely to change in later slices (not changed now)

| Later slice | Likely files |
|-------------|--------------|
| ML1B/C | `api/search_index/build_index.py`, normalizer/enrich touchpoints, bundle rebuild scripts, `web/src/search/search_query.ts`, catalog/manifest language meta |
| ML1D | `main.ts` search chrome, `bundle_labels.ts`, `render_search_chrome.ts`, i18n |
| RL1 | `render_entry.ts`, `render_results.ts`, `correction_form_model.ts`, related i18n/tests |
| Learning | Prefer **no** identity change; display preference only if needed |

---

## Summary verdicts (return block)

- English structurally usable as **display/gloss data**: **YES**; as **French-equivalent search source**: **PARTIAL** (needs new index path).  
- English currently indexed: **NO**.  
- Recommended multilingual architecture: **OPTION A** (additive `en_*`, same bundle).  
- Learning impact of Option A: **NONE** on `(bundle_id, ir_id)` if same featured bundle id continuity is preserved at publish.  
- CF1 impact (English search): **NONE** on schema; CF1 already has `en` targets.  
- CF2 impact: **NONE** (query language is free text; no RU/EN schema dependency).  
- Bundle schema impact for EN keys: **SMALL** (additive key_types; optional catalog language meta expansion).  
- Russian policy: **presentation exclusion**; source/provenance **retained**.

## Audit files changed

| Status | Path |
|--------|------|
| A | `docs/reports/ml1a_english_russian_language_audit.md` |

## Commit

```text
NOT CREATED
```
