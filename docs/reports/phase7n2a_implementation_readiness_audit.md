# Phase 7N2A Implementation Readiness Audit

**Status:** read-only architecture and schema audit only  
**Commit basis:** `4ca8720` (ndándayoro spelling correction)  
**Norm version audited:** `norm_v3`  
**Implementation authorization:** not authorized by this document

This report identifies the exact implementation mechanics for approved Phase 7N2A candidates without modifying source data, runtime code, generated artifacts, aliases, indexes, bundles, packages, catalogs, or release documents.

---

## Audit Scope and Paths Inspected

| Path | Role |
| --- | --- |
| `data/ir/malipense_lexicon_v3.jsonl` | Authoritative lexicon IR (8,823 entries) |
| `data/ir/malipense_index_v1.jsonl` | Authoritative French→Maninka index IR (10,501 mappings) |
| `data/normalized/malipense_normalized_norm_v3.jsonl` | Authoritative normalized records |
| `data/enriched/malipense_enriched_norm_v3.jsonl` | Authoritative enriched projection (when present) |
| `shared/ir/models.py` | IR schema models and `compute_ir_id()` |
| `shared/specs/lossless-capture-and-ir.md` | IR capture contract |
| `shared/specs/provenance.md` | Provenance contract |
| `docs/SOURCES.md` | Repository source attribution minimum |
| `shared/specs/source-alias-table-v1.md` | Source-alias artifact rules |
| `shared/specs/source-index-supplement-v1.md` | Source-index supplement rules |
| `shared/aliases/source_aliases_v1.jsonl` | Existing approved source aliases |
| `shared/source_index_supplements/source_index_supplements_v1.jsonl` | Existing approved supplements |
| `api/normalizer/normalize.py`, `api/normalizer/cli.py` | Normalization module and CLI |
| `api/enrichment/enrich.py`, `api/enrichment/validate_enrichment_display_only.py` | Enrichment and display-only gate |
| `api/source_aliases/validate_alias_table.py`, `api/source_aliases/apply_aliases_to_search_index.py` | Source-alias validation and application |
| `api/source_index_supplements/validate_supplements.py`, `api/source_index_supplements/generate_supplement_records.py`, `api/source_index_supplements/merge_supplements_into_search_index.py` | Supplement validation, generation, merge |
| `api/search_index/cli.py` | Base search-index generation |
| `api/bundle_builder/build_bundle.py`, `api/bundle_builder/cli.py` | Bundle assembly, verify, package |
| `web/src/search/search_query.ts` | Runtime retrieval and ordering contract |
| `shared/specs/phase7n2a_common_kinship_aliases_v1.md` | Bounded 7N2A specification |
| `docs/PHASE_7N2A_IMPLEMENTATION_AUTHORIZATION.md` | Staged authorization packet |
| `docs/reports/phase7n2a_source_record_audit.md` | Source-record existence audit |
| `docs/reviews/phase7n2a_ndandayoro_lexical_review.md` | Owner approval — `ndándayoro` |
| `docs/reviews/phase7n2a_ndandadiya_lexical_review.md` | Owner approval — `ndándadiya` |
| `docs/BUILD_BUNDLE.md` | Bundle pipeline documentation |
| `docs/reports/search_regression_changelog.md` | Regression validation commands |
| `.github/workflows/phase7l_search_regression.yml` | CI regression workflow |
| `api/pyproject.toml` | Installed CLI entry points |
| `api/ir_parser/tests/test_golden_fixtures.py` | IR schema validation tests |

---

## 1. Canonical Lexical-Record Schema

### Source data file to edit

New Maninka lexical candidates are added as new `lexicon_entry` rows in:

```text
data/ir/malipense_lexicon_v3.jsonl
```

Target-side variant support for `móbaa` is implemented by editing the existing row `c5f78c8ac66eac6b` in the same file (see section 4).

French retrieval labels (`clinique`, `centre de santé`, and optional additive `hôpital` mappings) are **not** lexical records. They are implemented later as `index_mapping` records via source-index supplements (section 5).

### Record ID and IR ID generation

| Identifier | Method | Notes |
| --- | --- | --- |
| Mali-pense `source_record_id` | Page-scoped anchor such as `e2533` for `dándaso` | Owner-authored records need a new stable `source_record_id` and `url_canonical` chosen at implementation time; do not invent here |
| `ir_id` | `compute_ir_id(source_id, url_canonical, record_id_component, parser_version)` in `shared/ir/models.py` | Deterministic 16-hex SHA-256 prefix: `sha256(source_id\|url_canonical\|record_id_component\|parser_version)[:16]` |
| Supplement-generated `index_mapping` `ir_id` | `generated_ir_id()` in `api/source_index_supplements/generate_supplement_records.py` | Prefix `ff` + SHA-256 of supplement metadata; separate from lexicon `ir_id` |

`ir_id` and `source_record_id` are not separate generation paths for lexicon entries. One `ir_id` is derived from locator components.

### Normalization, enrichment, and validation

| Step | Command or module | Output |
| --- | --- | --- |
| Normalization | `python -m normalizer.cli` (`api/normalizer/cli.py` → `api/normalizer/normalize.py`) | `data/normalized/malipense_normalized_norm_v3.jsonl` |
| Enrichment | `siralex-enrich` (`api/enrichment/enrich.py`) | `data/enriched/malipense_enriched_norm_v3.jsonl` |
| Display-only gate | `siralex-validate-enrichment-display-only` | Fails if non-display fields drift |
| IR schema regression | `pytest api/ir_parser/tests/test_golden_fixtures.py` | Parser/IR shape checks |
| Normalization regression | `pytest api/normalizer/tests/` | `norm_v3` key-generation checks |

The normalizer is not registered as a `siralex-*` console script in `api/pyproject.toml`. After `pip install -e ./api`, run it as `python -m normalizer.cli`.

Normalization command shape:

```bash
python -m normalizer.cli \
  --input data/ir/malipense_lexicon_v3.jsonl \
  --input data/ir/malipense_index_v1.jsonl \
  --output data/normalized/malipense_normalized_norm_v3.jsonl \
  -v
```

### Required lexicon-entry fields

Structural examples use existing health-related record `71e323e2dafa590f` (`dándaso`) and location noun `de6fb406453616e3` (`díya`) **only as schema references**. They are not semantic substitutes for `ndándayoro` or `ndándadiya`.

| Field name | Data type | Required | Example from comparable record | Generation source / ownership | Validation rule, if known |
| --- | --- | --- | --- | --- | --- |
| `ir_id` | string (16 hex) | yes | `71e323e2dafa590f` | `compute_ir_id()` from locator + `parser_version` | Must be unique across lexicon IR |
| `ir_kind` | string enum | yes | `lexicon_entry` | literal | Must be `lexicon_entry` |
| `source_id` | string | yes | `src_malipense` | `shared/sources/malipense.yaml` registry | Must match known source registry id |
| `parser_version` | string | yes | `malipense_lexicon_v1` | parser or manual-addition policy | Frozen artifacts use existing parser version unless a new manual parser version is separately authorized |
| `evidence` | array of objects | yes per IR spec | snapshot `entry_block` + `text_quote` for `dándaso` | crawl snapshot for scraped entries; owner review artifact for manual entries | Must satisfy `shared/specs/lossless-capture-and-ir.md` fragment contract |
| `record_locator.kind` | string enum | yes | `source_record_id` | IR author | One of `source_record_id`, `url_canonical+entry_index`, `css_selector+text_quote`, `page+bbox+block_index` |
| `record_locator.url_canonical` | string | yes | `https://www.mali-pense.net/emk/lexicon/d.htm` | IR author | Required for global uniqueness |
| `record_locator.source_record_id` | string | yes for `source_record_id` kind | `e2533` | IR author | Page-scoped stable id |
| `record_locator.anchor_names` | array of strings | recommended | `["dándaso", "dandaso"]` | IR author / owner-approved variants | Drives `variant_forms` at normalization |
| `fields_raw.headword_latin` | string | yes | `dándaso` | owner-approved NFC Maninka form | Becomes `preferred_form` |
| `fields_raw.headword_nko_provided` | string or null | no | `ߘߊ߲ߘߊߛߏ` | source or owner if available | Added to `variant_forms` when present |
| `fields_raw.senses` | array of objects | yes for renderable entries | `[{"gloss_en": "hospital", "gloss_ru": "больни́ца"}]` | lexical review sheet + owner approval | At least one sense object expected for UI rendering |
| `fields_raw.senses[].gloss_fr` | string or null | no in source example; yes for 7N2A review intent | `place, endroit` on `díya` location noun | owner / reviewer | French glosses live inside sense objects, not as top-level IR fields |
| `fields_raw.senses[].gloss_en` | string or null | no | `hospital` on `dándaso` | owner / reviewer | Optional multilingual sense fields |
| `fields_raw.senses[].gloss_ru` | string or null | no | `больни́ца` on `dándaso` | source or reviewer | Optional |
| `fields_raw.senses[].usage_note` | string or null | no | — | owner / reviewer | Optional per `SenseRaw` model |
| `fields_raw.literal_meaning_raw` | string or null | no | `( soigner village )` on `dándaso` | owner / reviewer | Optional usage/definition note |
| `fields_raw.ps_raw` / `pos_hint` | string or null | no | — | owner / reviewer | Pending in 7N2A review sheets |
| `parse_warnings` | array | no | — | parser | May be empty for manual rows |

### Normalized projection fields (generated, not hand-authored)

| Field name | Data type | Required | Example from `dándaso` | Generation source | Validation rule |
| --- | --- | --- | --- | --- | --- |
| `norm_version` | string | yes | `norm_v3` | `shared/normalization/norm_v3.py` `RULESET_ID` | Must match active bundle ruleset |
| `preferred_form` | string | yes | `dándaso` | `fields_raw.headword_latin` | NFC preserved |
| `variant_forms` | array of strings | yes | `["dándaso", "dandaso", "ߘߊ߲ߘߊߛߏ"]` | `record_locator.anchor_names` + optional N'Ko | Must include preferred form |
| `search_keys.casefold` | array | yes | `["dándaso", "dandaso", ...]` | `compute_search_keys()` | Drives `tgt_casefold` index keys |
| `search_keys.diacritics_insensitive` | array | yes | `["dandaso", ...]` | `compute_search_keys()` | Drives `tgt_diacritics_insensitive` |
| `search_keys.punct_stripped` | array | yes | `["dandaso", ...]` | `compute_search_keys()` | Drives `tgt_punct_stripped` |
| `search_keys.nospace` | array | yes | `["dandaso", ...]` | `compute_search_keys()` | Drives `tgt_nospace` |

### French glosses, language fields, and usage notes

| Concern | Representation |
| --- | --- |
| French glosses on Maninka lexical entries | `fields_raw.senses[].gloss_fr` inside lexicon IR; copied verbatim into enriched `display.senses[]` |
| English / Russian glosses | `gloss_en`, `gloss_ru` in the same sense objects |
| Source language | `fields_raw.source_lang: "fr"` on `index_mapping` rows only |
| Target language | Implicit Maninka target content via `headword_latin` / `headword_nko_provided`; bundle manifest declares `target-lang mnk` |
| Usage notes / definitions | `fields_raw.literal_meaning_raw`; optional `senses[].usage_note`; optional `senses[].examples[]` |
| French retrieval labels | `index_mapping.fields_raw.source_term` + `target_entries[]`; not lexicon-headword fields |

---

## 2. Provenance and Approval Compatibility

### Provenance statement under review

```text
project owner / native-speaker linguistic authority
owner linguistic approval recorded in Phase 7N2A review sheets
```

### Repository contracts inspected

| Contract | Requirement |
| --- | --- |
| `docs/SOURCES.md` | `source_name`, `source_url`, `retrieved_at`, `license_notes`, `source_record_id` |
| `shared/specs/provenance.md` | Full `provenance.source` object with `record_pointer`, plus `derivation.kind` |
| IR `evidence[]` | Snapshot-linked fragment evidence for scraped records |
| Alias / supplement rows | `reviewer`, `reviewed_at`, `rationale`, `evidence_ir_ids` / `supporting_evidence_ir_ids` |
| Lexical review sheets | Owner approval recorded; several technical fields still `[pending source-record normalization and provenance review]` |

### Disposition by record class

| Record class | Verdict | Missing fields or evidence required |
| --- | --- | --- |
| `ndándayoro` canonical lexicon addition | **acceptable with required fields added** | Exact NFC/tone encoding; `record_locator` + `evidence` or explicit manual-derivation record; `derivation.kind` (likely `manual_override` per `shared/specs/provenance.md`); `source.retrieved_at`; `license_notes`; stable `source_record_id`; completed `reviewed_at` in review sheet |
| `ndándadiya` canonical lexicon addition | **acceptable with required fields added** | Same as `ndándayoro` |
| `maman` source alias row | **acceptable with required fields added** | `reviewer`, `reviewed_at`, `rationale`, `evidence_ir_ids`, `resolved_ir_ids` recomputed from base index; valid `candidate_type` (see section 3) |
| `móbaa` target variant | **acceptable with required fields added** | Exact NFC form of `móbaa`; documented reviewer approval; IR edit rationale traceable to review sheet |
| `clinique` / `centre de santé` supplements | **acceptable with required fields added** | Approved target `ir_id`s must exist first; supplement row reviewer metadata; `target_forms`, `target_notes`, `supporting_evidence_ir_ids` |

The plain-text provenance phrase alone is **insufficient** for direct insertion into IR or bundle records. It is sufficient as reviewer identity text in alias/supplement rows and as rationale cross-reference to:

- `docs/reviews/phase7n2a_ndandayoro_lexical_review.md`
- `docs/reviews/phase7n2a_ndandadiya_lexical_review.md`

It must be transformed into repository-specific structures before source insertion.

---

## 3. Source Alias Mechanism for `maman`

### Exact alias row schema

Defined in `shared/specs/source-alias-table-v1.md` and enforced by `api/source_aliases/validate_alias_table.py`.

Required fields per row:

```text
schema_version
alias_table_version
alias_id
status
direction
alias_source_term
canonical_source_terms
resolved_ir_ids
candidate_type
evidence_ir_ids
rationale
source_bundle_id
source_norm_version
reviewer            # required when status = approved
reviewed_at         # required when status = approved
```

Approved semantics:

```text
alias_source_term maman
→ same deterministic src_* posting list as canonical_source_terms
→ generates only src_* keys in search_index.jsonl
→ does not mutate records.jsonl
```

### Multi-target behavior

Alias rows may target multiple records through `canonical_source_terms` and the resulting ordered `resolved_ir_ids`.

Precedent: `grand-parents` copies postings from both `grand-mère` and `grand-père` exactly.

For `maman`, the audited bounded path is **single canonical term**:

```text
canonical_source_terms: ["mère"]
resolved_ir_ids: [posting of index_mapping e5164efcdf5e6ca4]
```

That posting currently resolves to generic-mother targets `bá`, `dénba`, `ná`, and index pointer `` `ná `` (`e8826`), not to vocative or respectful-address rows.

### Priority and ranking

| Question | Audit result |
| --- | --- |
| Can alias priority be represented in data alone? | **Yes.** Runtime preserves stored `ir_ids[]` order (`web/src/search/search_query.ts`); no client-side re-ranking |
| Can result ranking be controlled by data alone? | **Only through posting order** in `resolved_ir_ids` and index target-entry order |
| Is runtime code required for basic `maman → mère` routing? | **No** for alias application |
| Is runtime code required for ranking redesign? | **Yes**, if behavior must differ from stored posting order; 7N2A explicitly forbids global redesign |

### Excluding vocative / respectful mother paths

Competing rows that must remain outside the `maman` alias path:

| Index `ir_id` | French source term | Target | Role |
| --- | --- | --- | --- |
| `0f517a71c373f51d` | `oh, mère!` | `wóyì` | vocative / interjection |
| `d540716db9321a83` | homonyme respectful-address formula | `tɔ́ɔma` | respectful address |

These are separate source-index rows. A `maman` alias that copies only the `mère` posting (`e5164efcdf5e6ca4`) does **not** include them.

### Can `maman` safely target generic mother posting `e5164efcdf5e6ca4` only?

**Yes**, as a source-alias copy of the existing `mère` posting.

Caveat: that posting is multi-target (four mother-related targets). 7N2A intent requires the generic mother sense to rank above vocative/respectful senses; vocative/respectful are already excluded by row choice. Ordering among `bá`, `dénba`, `ná`, and `` `ná `` remains whatever the existing `mère` index mapping already stores.

### Can the approved `maman` behavior be implemented with data/index artifacts only?

**Answer: `partially`**

| Sub-behavior | Data/index only? | Why |
| --- | --- | --- |
| `maman` miss → hit via `mère` posting | **Yes** | `shared/aliases/source_aliases_v1.jsonl` + `siralex-apply-source-aliases` |
| Exclude vocative / respectful rows | **Yes** | Choose `canonical_source_terms: ["mère"]` only |
| Preserve `mère` existing behavior | **Yes** | No overwrite of base index row |
| Introduce new `candidate_type` for common-form French | **Blocked** | Validator allows only `french_plural_singular_alias`, `french_gender_alias`, `hyphenation_or_compound_alias` |
| Reorder mother targets differently from `mère` without runtime change | **No** | Alias stale-row protection requires exact equality with recomputed `mère` posting |
| Rank generic mother ahead of vocative/respectful for `maman` | **Yes** | Achieved by excluding those rows; no runtime needed |
| Change global `mère` ranking beyond stored order | **No** | Would require runtime or a separately authorized non-alias mechanism; forbidden by 7N2A |

**Design blocker:** implementers must extend `source_alias_table_v1` and `ALLOWED_CANDIDATE_TYPES` before a `maman` row can pass `siralex-validate-source-aliases`, unless an existing allowed type is explicitly reclassified in a reviewed spec update.

---

## 4. Target Alias Mechanism for `móbaa`

### Does target alias support already exist as a separate artifact?

**No separate target-alias table exists.**

`shared/specs/source-alias-table-v1.md` non-goals explicitly exclude target-side aliasing. `shared/specs/source-index-supplement-v1.md` also excludes target-side aliasing.

### Exact mechanism for `móbaa`

| Item | Value |
| --- | --- |
| File | `data/ir/malipense_lexicon_v3.jsonl` |
| Canonical record | `c5f78c8ac66eac6b` |
| Canonical form | `móyibaa` |
| Implementation class name in 7N2A docs | `target_alias` |
| Actual mechanism | Add owner-approved `móbaa` to `record_locator.anchor_names` on the existing lexicon IR row; mirror in `fields_raw.anchor_names` if present for v3 artifact consistency |
| Reference object | Canonical **record ID** `c5f78c8ac66eac6b`, not a new record |
| Index effect | Re-normalization adds `móbaa` to `variant_forms` and `search_keys`; index builder emits `tgt_*` keys pointing to the same `ir_id` |
| Duplicate concept risk | None if only `anchor_names` are extended on the existing row |

### Unicode normalization and tone marks

Normalization uses `shared/normalization/norm_v3.py`:

- NFC canonicalization of variant inputs before key generation
- `preferred_form` = `fields_raw.headword_latin`
- `variant_forms` derived from `record_locator.anchor_names`
- Tone marks preserved in `preferred_form`; diacritics-insensitive keys strip tones separately

Exact owner-approved NFC for `móbaa` remains pending in the lexical review workflow.

### Required validation and regression tests

| Step | Command / artifact |
| --- | --- |
| Normalization check | `pytest api/normalizer/tests/test_norm_v3.py` |
| Bundle/index rebuild | pipeline in section 6 |
| Focused 7N2A regressions | add cases `phase7n2a_mobaa_variant_to_moyibaa`, `phase7n2a_moyibaa_existing_guard` to `shared/search_regression/search_regression_matrix_v1.jsonl` under separate human-reviewed matrix update |
| CI baseline | `.github/workflows/phase7l_search_regression.yml` |

---

## 5. French Source-Index Mechanism for Health Terms

### Existing health path

| French term | Index `ir_id` | Target lexicon `ir_id` | Target form |
| --- | --- | --- | --- |
| `hôpital` | `61843e6630c1fbae` | `71e323e2dafa590f` | `dándaso` |

This path must remain valid and unchanged.

### Existing place path

| French term | Index `ir_id` | Includes target `díya` |
| --- | --- | --- |
| `place` | `96b72ff71179d689` | yes — `de6fb406453616e3` among several place senses |

Standalone `yoro` must not be added under `place`, `location`, or any other 7N2A retrieval path.

### Can `hôpital`, `clinique`, and `centre de santé` map to multiple canonical Maninka records?

**Yes**, via source-index supplements.

| Mode | Use for 7N2A |
| --- | --- |
| `new_source_mapping` | `clinique`, `centre de santé` after target lexicon records exist |
| `additive_source_mapping` | optional future `hôpital` expansion to include `ndándayoro` / `ndándadiya` without removing `dándaso` |
| `broad_umbrella_source_mapping` | not required for 7N2A health terms |

Precedent: `tante` uses `additive_source_mapping` to append `tɛ́nɛn` while preserving existing `nàlaka`.

### Multi-word French input support

**Yes.**

Evidence:

- Base index already contains multi-word French `source_term` values such as `bagage à main`, `banc de sable`, `banane plantain`
- `norm_v3` preserves the full `source_term` and uses `extract_source_phrases()` for additive source phrases
- Supplement rows carry explicit multi-word `source_term` such as `centre de santé`

`centre de santé` is therefore supported as an explicit source-index mapping, not as phrase translation.

### Exact mechanism for `clinique` and `centre de santé`

| Item | `clinique` | `centre de santé` |
| --- | --- | --- |
| Artifact file | `shared/source_index_supplements/source_index_supplements_v1.jsonl` | same |
| Schema | `source_index_supplement_v1` | same |
| `supplement_mode` | `new_source_mapping` | `new_source_mapping` |
| `source_lang` | `fr` | `fr` |
| `source_term` | `clinique` | `centre de santé` |
| `target_ir_ids` | reviewed health-institution lexicon `ir_id`s after canonical record addition | same |
| Generated record kind | `index_mapping` via `siralex-generate-source-index-supplements` | same |
| Search effect | `siralex-merge-source-index-supplements` adds `src_*` keys | same |
| Preconditions | Approved `ndándayoro` / `ndándadiya` lexicon rows must exist and normalize deterministically | same |

### Can `hôpital → dándaso` remain while adding compounds additively?

**Yes.**

Use `additive_source_mapping` with `target_ir_ids` referencing the new health-institution lexicon records. Validator rules require the source term to already exist and forbid silent overwrite of `61843e6630c1fbae`.

### False-positive guards for `place` / `location`

| Guard mechanism | How enforced |
| --- | --- |
| No `place` / `location` supplement rows for 7N2A compounds | authoring discipline + `siralex-validate-source-index-supplements` |
| No `yoro` standalone lexical or index mapping | documentation boundary + review-sheet constraints |
| Regression cases | `phase7n2a_ndandayoro_no_place_false_positive`, `phase7n2a_ndandadiya_no_place_false_positive`, `phase7n2a_place_location_false_positive` |
| Runtime behavior | unchanged exact-match ladder; no fuzzy expansion |

---

## 6. Candidate Build and Test Path

Do not execute in this audit. Required order after separate maintainer authorization:

| Step | Exact command / action | Purpose |
| --- | --- | --- |
| 1. Source-data validation | `pytest api/ir_parser/tests/test_golden_fixtures.py -q` | IR shape regression |
| 2. Normalization | `python -m normalizer.cli --input data/ir/malipense_lexicon_v3.jsonl --input data/ir/malipense_index_v1.jsonl --output data/normalized/malipense_normalized_norm_v3.jsonl -v` | Rebuild normalized projection |
| 3. Supplement record generation | `siralex-generate-source-index-supplements` with approved rows, baseline `records.jsonl` or normalized/enriched input per rollout recipe | Create `index_mapping` records for `clinique`, `centre de santé`, optional additive `hôpital` |
| 4. Enrichment | `siralex-enrich --normalized data/normalized/malipense_normalized_norm_v3.jsonl --ir data/ir/malipense_lexicon_v3.jsonl --ir data/ir/malipense_index_v1.jsonl --output data/enriched/malipense_enriched_norm_v3.jsonl -v` | Add `display` projection |
| 5. Enrichment gate | `siralex-validate-enrichment-display-only --baseline data/normalized/malipense_normalized_norm_v3.jsonl --enriched data/enriched/malipense_enriched_norm_v3.jsonl -v` | Ensure display-only drift |
| 6. Base index generation | `siralex-build-index --input data/enriched/malipense_enriched_norm_v3.jsonl --output build/search_index.jsonl` | Base directional index |
| 7. Source-alias validation | `siralex-validate-source-aliases` against alias table + records + base index | Fail-closed alias checks |
| 8. Source-alias application | `siralex-apply-source-aliases` | Add `maman` `src_*` keys |
| 9. Supplement validation | `siralex-validate-source-index-supplements` | Fail-closed supplement checks |
| 10. Supplement merge | `siralex-merge-source-index-supplements` | Add health-term `src_*` keys |
| 11. Focused regression | add and run 7N2A matrix cases via `scripts/run_search_regression.py` + `pytest api/search_regression/tests/ -q` | Candidate behavior guards |
| 12. Full relevant suite | `pytest api/source_aliases/tests/ api/source_index_supplements/tests/ api/search_regression/tests/ -q`; `cd web && npx vitest run -c vitest.search_regression.config.ts && npx vitest run src/search/search_query.test.ts` | Phase 7L contract |
| 13. Bundle generation | `siralex-build-bundle build --normalized data/enriched/malipense_enriched_norm_v3.jsonl --search-index build/search_index.jsonl --output-dir build/bundles --bundle-type full --source-lang fr --target-lang mnk --source-label French --target-label Maninka --target-script latin --target-script nko` | Assemble candidate bundle |
| 14. Bundle verify | `siralex-build-bundle verify build/bundles/<bundle-id>` | Integrity gate |
| 15. Package generation | `siralex-build-bundle package --bundle-dir build/bundles/<bundle-id> --output build/packages/<bundle-id>.siralex.zip` | Transport artifact |
| 16. Candidate identity recording | Record `bundle_id`, `bundle.manifest.json` `content_sha256`, `checksums.sha256`, package SHA-256, `rule_versions.normalization`, alias/supplement application reports | Reproducibility audit trail |

---

## Required Implementation Map

| Candidate | Approved intent | Exact source artifact | Exact generated artifact(s) affected | Runtime code change required? | Required precondition | Required regression |
| --------- | --------------- | --------------------- | ------------------------------------ | ----------------------------- | --------------------- | ------------------- |
| `ndándayoro` | Separate canonical health-institution lexical candidate | New row in `data/ir/malipense_lexicon_v3.jsonl` | `data/normalized/malipense_normalized_norm_v3.jsonl`, `data/enriched/malipense_enriched_norm_v3.jsonl`, `records.jsonl`, `search_index.jsonl` (`tgt_*`) | No | Owner approval recorded; pending NFC/tone/POS/provenance fields completed; separate maintainer authorization | `phase7n2a_ndandayoro_no_place_false_positive`; optional `phase7n2a_ndandayoro_hopital` if additive `hôpital` mapping authorized |
| `ndándadiya` | Separate canonical health-institution lexical candidate | New row in `data/ir/malipense_lexicon_v3.jsonl` | Same as `ndándayoro` | No | Same as `ndándayoro` | `phase7n2a_ndandadiya_no_place_false_positive`; `phase7n2a_ndandadiya_clinique` after index supplement |
| `maman` | French common form → generic mother posting | New approved row in `shared/aliases/source_aliases_v1.jsonl` | `search_index.jsonl` (`src_*`) only | No for routing; **spec extension required** for `candidate_type` | Alias spec extension or approved type reclassification; `resolved_ir_ids` recomputed from `mère` posting `e5164efcdf5e6ca4` | `phase7n2a_maman_generic_mother_primary`, `phase7n2a_mere_generic_mother_rank_guard` |
| `móbaa` | Target variant of `móyibaa` | Edit `record_locator.anchor_names` on `c5f78c8ac66eac6b` in `data/ir/malipense_lexicon_v3.jsonl` | `data/normalized/...`, `data/enriched/...`, `records.jsonl`, `search_index.jsonl` (`tgt_*`) | No | Exact NFC / tone confirmation for `móbaa` | `phase7n2a_mobaa_variant_to_moyibaa`, `phase7n2a_moyibaa_existing_guard` |
| `clinique` | French health-institution retrieval label | New approved row in `shared/source_index_supplements/source_index_supplements_v1.jsonl` | Generated `index_mapping` in records + `search_index.jsonl` (`src_*`) | No | Canonical `ndándayoro` / `ndándadiya` lexicon records exist and validate | `phase7n2a_clinique_reviewed_health_term` |
| `centre de santé` | French health-institution retrieval label (multi-word) | New approved row in `shared/source_index_supplements/source_index_supplements_v1.jsonl` | Generated `index_mapping` in records + `search_index.jsonl` (`src_*`) | No | Same lexicon precondition as `clinique` | `phase7n2a_centre_de_sante_reviewed_health_term` |
| `hôpital` guard | Preserve `hôpital → dándaso` | **No change** to index `61843e6630c1fbae` | None unless separately authorized additive supplement | No | Any additive mapping must use `additive_source_mapping` only | `phase7n2a_hopital_existing_dandaso_guard` |
| `place → diya` guard | Preserve existing broad place retrieval | **No change** to index `96b72ff71179d689` | None | No | No 7N2A supplement or alias under `place` / `location` | `phase7n2a_place_location_false_positive` |
| `yoro` unresolved guard | Do not index standalone `yoro` | **No artifact** | None | No | Documentation boundary only | Implicit via place/location false-positive regressions; no standalone `yoro` matrix case authorized |

---

## Risk Register

| Risk | Failure mode | Control |
| --- | --- | --- |
| Record schema error | New source record cannot normalize/enrich deterministically | Reuse validated schema pattern and run schema checks |
| Provenance insufficiency | Approved meaning lacks repository-required source metadata | Resolve before source insertion |
| Alias overreach | `maman` exposes vocative/respectful mother senses | Target generic mother posting only and add rank guard |
| Target alias duplication | `móbaa` creates duplicate lexical concept | Alias must point to `c5f78c8ac66eac6b` |
| Health-index overreach | New terms become generic place/location results | Explicit false-positive regressions |
| Existing-path regression | `hôpital → dándaso` or `place → diya` breaks | Dedicated guard cases |
| Pipeline drift | Generated bundle differs from intended data change | Record exact commands, hashes, and candidate identity |
| Alias schema mismatch | `maman` row fails validation | Extend `source_alias_table_v1` before implementation |
| Multi-target mother ambiguity | `maman` returns multiple mother lexicon targets | Accept existing `mère` posting order or authorize a non-alias bounded redesign |

---

## Explicit Exclusions Confirmed

Not inspected for implementation authorization beyond the approved 7N2A list:

```text
Kun / kùn / kún
sɛn / sen
global tone-insensitive behavior
global vowel folding
phrase translation
moto
bonjour
n fa / n'fa
runtime similar-spelling UI
catalog publication
release-state change
```

---

## Implementation Boundary

This audit identifies mechanics only.

It does **not** authorize edits to `data/ir/`, alias tables, supplement tables, search runtime, bundles, packages, catalogs, or release-status documents.

Phase 7N2A implementation mechanics are now identified without mutating authoritative data. A separate narrow implementation authorization is required before any lexical record, alias, source-index mapping, generated artifact, or search behavior is changed.
