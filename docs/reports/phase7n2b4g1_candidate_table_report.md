# Phase 7N2B4G1 — Draft 7N2B Candidate Table

## Decision

```text
7N2B_CANDIDATE_TABLE_READY_FOR_OWNER_REVIEW
```

This slice is a review packet only. No aliases, supplements, owner lexical rows,
matrices, bundles, catalog, or runtime changes were made.

## 1. Baseline and tranche identity

| Field | Value |
| --- | --- |
| Featured bundle | `bundle_full_20260708_27643bb0` |
| Closed prior tranche | Phase 7N2A (`PHASE_7N2A_PROMOTION_CLOSED_STABLE`) |
| G0 decision | `NEXT_TRANCHE_DEFINED_READY_FOR_OWNER_REVIEW` |
| Tranche id | `7N2B` |
| Tranche name | Everyday lemma recovery (alias-first + miss triage) |
| Candidate status | `proposed_for_owner_review` |

Closed 7N2A contracts remain in force (`maman`, health supplements, `place` /
`location` / `yoro` boundaries).

## 2. Evidence inspected

| Path | Use |
| --- | --- |
| `docs/reports/phase7n2a4g0_next_linguistic_expansion_tranche_report.md` | Tranche scope |
| `shared/aliases/source_aliases_v1.jsonl` | No existing `moto` alias (23 rows) |
| `shared/source_index_supplements/source_index_supplements_v1.jsonl` | Existing supplement inventory (7 rows) |
| `shared/target_variants/reviewed_target_variants_v1.jsonl` | Not applicable to these units |
| `data/ir/siralex_owner_lexical_v1.jsonl` | Owner lexical pattern reference |
| `data/ir/malipense_index_v1.jsonl` | Durable IR for `motocycle` / `motocyclette` |
| `web/public/bundle_full_20260708_27643bb0/search_index.jsonl` | Featured lookup truth |
| `web/public/bundle_full_20260708_27643bb0/records.jsonl` | Target display forms / IR ids |
| `data/local_evidence/human_usage_automation/candidate_rebuild_structured_usability_evidence_corrected_20260702.md` | Usability miss signals |

## 3. Current featured index facts

Proven against `bundle_full_20260708_27643bb0`:

| Query | Featured `src_casefold` | IR id(s) | Target form(s) |
| --- | --- | --- | --- |
| `moto` | miss | — | — |
| `motocycle` | hit | `b5c9a49f6db2a991` | `pópo` |
| `motocyclette` | hit | `0a56b8047aeaf117` | `pópo` |
| `papa` | hit | `b8053579e3035e88` | `bàba`, `bàwa` |
| `père` | hit | `423369d78d42c100` | `fà` |
| `fièvre` | miss | — | — |
| `prix` | miss | — | — |
| `comment dit-on école` | miss | — | — |
| `combien ça coûte` | miss | — | — |
| `merci beaucoup` | miss | — | — |

Additional IR facts:

- Exact Mali-Pense `source_term` lemmas for standalone `fièvre` and `prix`: **0**.
- No `moto` row already present in `source_aliases_v1.jsonl`.
- `motocycle` / `motocyclette` IR target anchors both point at lexicon `e7071` (`pópo`).

## 4. Draft candidate table

### Unit 1 — `moto` source alias

| Field | Value |
| --- | --- |
| `candidate_id` | `7n2b_cand_0001_moto_source_alias` |
| `tranche_id` | `7N2B` |
| `status` | `proposed_for_owner_review` |
| `behavior_type` | `source_alias` |
| `source_query` | `moto` |
| `canonical_source_terms` | `["motocycle", "motocyclette"]` |
| `expected_behavior` | `moto` resolves to the same transport posting(s) as `motocycle` / `motocyclette` |
| `expected_ir_ids` | `["b5c9a49f6db2a991", "0a56b8047aeaf117"]` (proven from featured index; final alias posting set subject to alias-applier semantics) |
| `expected_target_forms` | `["pópo"]` |
| `evidence_available` | Usability miss; featured miss for `moto`; durable IR + featured hits for `motocycle`/`motocyclette` → `pópo` |
| `risk_rating` | `low` |
| `owner_review_required` | `true` |
| `owner_review_question` | Should common French "moto" be accepted as a source alias for the existing motocycle / motocyclette entry meaning pópo, limited to the transport lemma only? |
| `implementation_artifact_if_approved` | `shared/aliases/source_aliases_v1.jsonl` row (`status: approved`) |
| `negative_boundary_assertions` | Do not map unrelated strings containing `moto`; do not invent new lexical targets |
| `rationale` | Common spoken French form for an already-indexed transport lemma with durable targets |

### Unit 2 — Phrase lemma boundary

| Field | Value |
| --- | --- |
| `candidate_id` | `7n2b_cand_0002_phrase_lemma_boundary` |
| `tranche_id` | `7N2B` |
| `status` | `proposed_for_owner_review` |
| `behavior_type` | `negative_boundary` |
| `source_query` | examples: `comment dit-on école`, `combien ça coûte`, `merci beaucoup` |
| `canonical_source_terms` | `[]` |
| `expected_behavior` | Remain miss in source search; no phrase alias / sentence translation in 7N2B |
| `expected_ir_ids` | `[]` |
| `expected_target_forms` | `[]` |
| `evidence_available` | Usability `phrase_mismatch` rows; featured index misses for the example phrases; 7N2A audit deferred phrase translation |
| `risk_rating` | `low` |
| `owner_review_required` | `true` |
| `owner_review_question` | Confirm that 7N2B should not introduce phrase-level aliases or sentence translation behavior; phrase handling remains a separate product/search-policy track. |
| `implementation_artifact_if_approved` | Additive regression negative cases only (no phrase-alias table) |
| `negative_boundary_assertions` | No `source_phrase_aliases`; no free-translation behavior |
| `rationale` | Protects lemma-only product contract while everyday lemma work proceeds |

### Unit 3 — `papa` ↛ `père`

| Field | Value |
| --- | --- |
| `candidate_id` | `7n2b_cand_0003_papa_not_pere_boundary` |
| `tranche_id` | `7N2B` |
| `status` | `proposed_for_owner_review` |
| `behavior_type` | `negative_boundary` |
| `source_query` | `papa` (must not alias to `père`) |
| `canonical_source_terms` | keep distinct: `papa`, `père` |
| `expected_behavior` | `papa` and `père` remain distinct source entries; no `papa` → `père` alias |
| `expected_ir_ids` | `papa`: `["b8053579e3035e88"]`; `père`: `["423369d78d42c100"]` |
| `expected_target_forms` | `papa` → `bàba`, `bàwa`; `père` → `fà` |
| `evidence_available` | Featured index + records prove distinct IR ids and target forms |
| `risk_rating` | `low` (as a negative boundary); collapsing them would be **high** risk |
| `owner_review_required` | `true` |
| `owner_review_question` | Confirm that informal papa should not be collapsed into père, because their current target postings are distinct. |
| `implementation_artifact_if_approved` | Additive regression negative assertion only (no alias row) |
| `negative_boundary_assertions` | Forbid `papa` → `père` source alias; preserve both postings |
| `rationale` | Applies the 7N2A `maman` narrowing lesson: informal kinship forms must not silently import unrelated senses |

### Unit 4 — `fièvre` owner lexical addition

| Field | Value |
| --- | --- |
| `candidate_id` | `7n2b_cand_0004_fievre_owner_lexical` |
| `tranche_id` | `7N2B` |
| `status` | `proposed_for_owner_review` |
| `behavior_type` | `owner_lexical_addition` |
| `source_query` | `fièvre` |
| `canonical_source_terms` | `["fièvre"]` (standalone health lemma) |
| `expected_behavior` | No implementation until owner supplies approved Maninka target form(s), gloss, and target IDs / owner lexical row |
| `expected_ir_ids` | `TBD_by_owner` |
| `expected_target_forms` | `TBD_by_owner` |
| `evidence_available` | Usability miss; featured miss; **no** exact IR `source_term` lemma (compounds like `arbre à fièvre` must not be used as the standalone mapping) |
| `risk_rating` | `medium` |
| `owner_review_required` | `true` |
| `owner_review_question` | What is the correct Maninka translation or translations for the standalone French health lemma fièvre? |
| `implementation_artifact_if_approved` | `data/ir/siralex_owner_lexical_v1.jsonl` (+ optional later `source_index_supplements` if mapping needs additive index posting) |
| `negative_boundary_assertions` | Do not infer from `arbre à fièvre` / `arbre.à.fièvre` compounds |
| `rationale` | High-visibility caregiver health miss without durable exact lemma evidence |

### Unit 5 — `prix` owner lexical addition

| Field | Value |
| --- | --- |
| `candidate_id` | `7n2b_cand_0005_prix_owner_lexical` |
| `tranche_id` | `7N2B` |
| `status` | `proposed_for_owner_review` |
| `behavior_type` | `owner_lexical_addition` |
| `source_query` | `prix` |
| `canonical_source_terms` | `["prix"]` (standalone commerce lemma: price/cost) |
| `expected_behavior` | No implementation until owner supplies approved Maninka target form(s), gloss, and target IDs / owner lexical row |
| `expected_ir_ids` | `TBD_by_owner` |
| `expected_target_forms` | `TBD_by_owner` |
| `evidence_available` | Usability miss; featured miss; IR has only multiword price phrases (`quel est son prix?`, `vil prix`, …), not a standalone lemma |
| `risk_rating` | `medium` |
| `owner_review_required` | `true` |
| `owner_review_question` | What is the correct Maninka translation or translations for the standalone French commerce lemma prix, meaning price/cost? |
| `implementation_artifact_if_approved` | `data/ir/siralex_owner_lexical_v1.jsonl` (+ optional later supplement if needed) |
| `negative_boundary_assertions` | Do not alias from multiword price phrases; do not invent fuzzy commerce mappings |
| `rationale` | High-visibility market miss without durable exact lemma evidence |

## 5. Owner-review questions (summary)

1. Approve `moto` → `motocycle` / `motocyclette` (`pópo`) transport-only alias?
2. Confirm no phrase aliases / sentence translation in 7N2B?
3. Confirm `papa` must not collapse into `père`?
4. Provide approved Maninka target(s) for standalone `fièvre`?
5. Provide approved Maninka target(s) for standalone `prix` (price/cost)?

## 6. Implementation artifact forecast if approved

| Candidate | If approved, implement in |
| --- | --- |
| `moto` | `shared/aliases/source_aliases_v1.jsonl` |
| Phrase boundary | Additive 7N2B regression negatives only |
| `papa` ↛ `père` | Additive 7N2B regression negatives only |
| `fièvre` | Owner lexical IR (+ optional supplement) after IDs locked |
| `prix` | Owner lexical IR (+ optional supplement) after IDs locked |

No artifact writes in G1.

## 7. Negative boundaries

- No phrase-level aliases in 7N2B.
- No `papa` → `père` alias.
- No inference of `fièvre` from fever-tree compounds.
- No inference of `prix` from multiword price phrases.
- Closed 7N2A contracts remain untouched.

## 8. Deferred candidates retained from G0

Still deferred (not in this candidate table):

- `poulet`
- `bonjour`
- `dispensaire` / `ambulance`
- `mamie` / `papy`
- phrase-alias track / tone-folding / similar-spelling UI
- `maman` (already shipped in 7N2A)

## 9. Decision

```text
7N2B_CANDIDATE_TABLE_READY_FOR_OWNER_REVIEW
```

## 10. Next slice definition

**Phase 7N2B4G2 — Owner Review and Approval Record**

Purpose: record owner approval, rejection, or deferral for each 7N2B candidate
behavior unit and lock implementation IDs for approved units.

## 11. Confirmation: no runtime / data / catalog / bundle / source / matrix / package changes

G1 created only this report. No edits to `web/`, `api/`, `data/`, linguistic
tables, matrices, catalog, bundles, artifacts, or packages.
