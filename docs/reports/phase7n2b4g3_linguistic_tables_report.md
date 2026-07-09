# Phase 7N2B4G3 — Implement Approved 7N2B Linguistic Tables

## Decision

```text
7N2B_APPROVED_TABLES_IMPLEMENTED
```

This slice implements only owner-approved 7N2B linguistic table rows. No
runtime, catalog, featured-bundle, regression-matrix, or package changes.

## 1. Approved G2 scope

From `docs/reports/phase7n2b4g2_owner_review_approval_record.md`:

| Candidate | G2 decision | G3 action |
| --- | --- | --- |
| `7n2b_cand_0001_moto_source_alias` | `approved_for_implementation` | Implemented alias row |
| `7n2b_cand_0002_phrase_lemma_boundary` | `approved_for_implementation` | Absence of phrase-alias behavior (no table write) |
| `7n2b_cand_0003_papa_not_pere_boundary` | `approved_for_implementation` | Absence of `papa`→`père` alias (no table write) |
| `7n2b_cand_0005_prix_owner_lexical` | `approved_for_implementation` | Owner lexical `Son` + source supplement `prix` |
| `7n2b_cand_0004_fievre_owner_lexical` | `deferred_pending_owner_targets` | **Not implemented** |

## 2. Files changed

| Path | Change |
| --- | --- |
| `shared/aliases/source_aliases_v1.jsonl` | Added `src_alias_phase7n2b_0001` (`moto`) |
| `data/ir/siralex_owner_lexical_v1.jsonl` | Added owner lexical `Son` (`3b8c3b7a0c5e897d`) |
| `shared/source_index_supplements/source_index_supplements_v1.jsonl` | Added `src_supp_phase7n2b_0001` (`prix` → `Son`) |
| `api/source_index_supplements/tests/test_source_index_supplements.py` | Updated durable assembly expectations for 3 owner IR rows / prix owner target id |
| `docs/reports/phase7n2b4g3_linguistic_tables_report.md` | This report |

## 3. `moto` alias row summary

| Field | Value |
| --- | --- |
| `alias_id` | `src_alias_phase7n2b_0001` |
| `alias_source_term` | `moto` |
| `canonical_source_terms` | `["motocycle", "motocyclette"]` |
| `resolved_ir_ids` / `evidence_ir_ids` | `["b5c9a49f6db2a991", "0a56b8047aeaf117"]` |
| `candidate_type` | `french_common_form_alias` |
| `status` | `approved` |
| Expected target form | `pópo` |
| Schema | Existing `source_alias_table_v1` / `alias_table_version: phase7a-round1` (same as `maman`) |

No new lexical target was created for `moto`. Existing aliases, including
`maman` (`src_alias_phase7n2a_0001` → `e5164efcdf5e6ca4`), were left unchanged.

## 4. `prix` owner lexical row summary

| Field | Value |
| --- | --- |
| `ir_id` | `3b8c3b7a0c5e897d` |
| Minting | `compute_ir_id(src_siralex_lexical_review, siralex://lexical-review/7n2b/son, 7n2b_son_v1, siralex_owner_lexical_v1)` |
| `headword_latin` / `text_quote` | `Son` |
| Gloss | `prix / coût` |
| Meaning boundary | Standalone French commerce lemma `prix` (price/cost) only |
| Orthography note | Owner-latinized starter; accents/tones may be incomplete and may be superseded by later owner orthography review |
| Evidence document | `docs/reports/phase7n2b4g2_owner_review_approval_record.md` |

Homograph note: Mali-Pense already has `són` / `son` (`61b1e3b49354a49e`, gloss
rust). Owner `Son` coexists as a separate owner lexical record; Latin attested
homographs are allowed by the registry. Source search for French `prix` is
routed only through the new supplement mapping, not through the rust entry.

## 5. Whether `prix` required a source supplement

**Yes.** Owner lexical rows alone add a Maninka lexicon target; they do not
create a French `src_casefold` posting for `prix`. Following the 7N2A
`clinique` / `centre de santé` pattern, a
`new_source_mapping` supplement is required for source searchability.

| Field | Value |
| --- | --- |
| `supplement_id` | `src_supp_phase7n2b_0001` |
| `source_term` | `prix` |
| `supplement_mode` | `new_source_mapping` |
| `target_ir_ids` / `supporting_evidence_ir_ids` | `["3b8c3b7a0c5e897d"]` |
| `target_forms` | `["Son"]` |
| Generated mapping id (proof run) | `ffbf014bd96ffabf` |

No multiword price-phrase IR rows were used as evidence.

## 6. Deferred `fièvre` confirmation

`fièvre` remains deferred. No owner lexical row, alias, or supplement was added
for fever. Temporary proof query: `fièvre` → miss.

## 7. Negative boundaries preserved

- No phrase-alias table or phrase alias rows.
- No `papa` → `père` alias; existing `papa` / `père` postings untouched.
- No `fièvre` implementation.
- Closed 7N2A contracts (`maman`, health supplements, place/location/yoro)
  unchanged in source tables beyond additive 7N2B rows.

G4 will add additive regression rows for phrase misses and `papa`/`père`
distinctness.

## 8. Temporary proof-query results

Workspace: `/tmp/phase7n2b4g3_linguistic_tables/` (not committed).

Pipeline used featured `bundle_full_20260708_27643bb0` as baseline, applied the
updated alias table, assembled featured records + new owner `Son` enrichment,
then validated/generated/merged supplements.

| Query | Result |
| --- | --- |
| `moto` | `["b5c9a49f6db2a991", "0a56b8047aeaf117"]` → `pópo` |
| `maman` | `["e5164efcdf5e6ca4"]` (unchanged) |
| `papa` | `["b8053579e3035e88"]` → `bàba` / `bàwa` |
| `père` | `["423369d78d42c100"]` → `fà` |
| `comment dit-on école` | miss |
| `combien ça coûte` | miss |
| `merci beaucoup` | miss |
| `fièvre` | miss |
| `prix` | `["ffbf014bd96ffabf"]` → `Son` |

## 9. Validator/test results

| Check | Result |
| --- | --- |
| `pytest api/source_aliases/tests/` | PASS (30) |
| `pytest api/source_index_supplements/tests/` | PASS (33) |
| `pytest api/enrichment/tests/` | PASS (combined required suite 113 passed) |
| Alias validate on featured + new table | PASS (`approved_alias_count: 23`; newly applied on featured baseline: `moto`) |
| Supplement validate/generate/merge (temp) | PASS (`approved_supplement_count: 8`; newly applied: `prix`) |
| `git diff --check` | PASS |

## 10. Decision

```text
7N2B_APPROVED_TABLES_IMPLEMENTED
```

## 11. Next slice definition

**Phase 7N2B4G4 — Add 7N2B Regression Matrix**

Purpose: add additive regression rows for approved 7N2B behaviors and deferred
negative boundaries without changing the frozen 7L matrix.

## 12. Confirmation: no runtime / catalog / bundle / matrix / package changes

G3 did not modify `web/`, catalog, featured or rollback bundles, regression
matrices, artifacts, or packages. Temporary proof outputs remain under `/tmp`
only.
