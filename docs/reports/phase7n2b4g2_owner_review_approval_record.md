# Phase 7N2B4G2 — Owner Review and Approval Record

## Decision

```text
7N2B_OWNER_REVIEW_APPROVED_PARTIAL_IMPLEMENTATION
```

This slice is an approval record only. No aliases, supplements, owner lexical
rows, matrices, bundles, catalog, or runtime changes were made.

## 1. Review packet source

| Field | Value |
| --- | --- |
| Review packet | `docs/reports/phase7n2b4g1_candidate_table_report.md` |
| G1 decision | `7N2B_CANDIDATE_TABLE_READY_FOR_OWNER_REVIEW` |
| Featured bundle (baseline) | `bundle_full_20260708_27643bb0` |
| Tranche id | `7N2B` |
| Reviewer | `project owner / native-speaker linguistic authority` |
| Owner decision date | `2026-07-09` |

Owner notes recorded for this slice:

1. `moto` accepted.
2. Phrase lemma boundary confirmed.
3. `papa` ↛ `père` approved.
4. `fièvre` deferred.
5. `prix` target starter supplied as Maninka **Son** (owner-latinized from sound; accents may be incomplete; owner asked to use as starter).

## 2. Owner-review decision table

### Unit 1 — `7n2b_cand_0001_moto_source_alias`

| Field | Value |
| --- | --- |
| `candidate_id` | `7n2b_cand_0001_moto_source_alias` |
| `tranche_id` | `7N2B` |
| `g1_source` | `docs/reports/phase7n2b4g1_candidate_table_report.md` § Unit 1 |
| `owner_decision` | `approved_for_implementation` |
| `owner_decision_date` | `2026-07-09` |
| `reviewer` | `project owner / native-speaker linguistic authority` |
| `approved_behavior` | `moto` → source alias for existing `motocycle` / `motocyclette` transport lemma only |
| `approved_source_query` | `moto` |
| `approved_canonical_source_terms` | `["motocycle", "motocyclette"]` |
| `approved_expected_ir_ids` | `["b5c9a49f6db2a991", "0a56b8047aeaf117"]` |
| `approved_expected_target_forms` | `["pópo"]` |
| `implementation_artifact` | `shared/aliases/source_aliases_v1.jsonl` |
| `required_negative_assertions` | Do not map unrelated strings containing `moto`; do not invent new lexical targets; transport lemma only |
| `deferred_reason` | — |
| `blocked_dependencies` | none |
| `notes` | Owner accepted common French `moto` as alias for existing `pópo` transport posting |

### Unit 2 — `7n2b_cand_0002_phrase_lemma_boundary`

| Field | Value |
| --- | --- |
| `candidate_id` | `7n2b_cand_0002_phrase_lemma_boundary` |
| `tranche_id` | `7N2B` |
| `g1_source` | `docs/reports/phase7n2b4g1_candidate_table_report.md` § Unit 2 |
| `owner_decision` | `approved_for_implementation` |
| `owner_decision_date` | `2026-07-09` |
| `reviewer` | `project owner / native-speaker linguistic authority` |
| `approved_behavior` | Phrase queries remain miss in source search; no phrase-level aliases or sentence translation in 7N2B |
| `approved_source_query` | examples: `comment dit-on école`, `combien ça coûte`, `merci beaucoup` |
| `approved_canonical_source_terms` | `[]` |
| `approved_expected_ir_ids` | `[]` |
| `approved_expected_target_forms` | `[]` |
| `implementation_artifact` | Additive 7N2B regression negative cases only |
| `required_negative_assertions` | No `source_phrase_aliases`; no free-translation / sentence-translation behavior in 7N2B |
| `deferred_reason` | — |
| `blocked_dependencies` | none |
| `notes` | Owner confirmed phrase handling remains a separate product/search-policy track |

### Unit 3 — `7n2b_cand_0003_papa_not_pere_boundary`

| Field | Value |
| --- | --- |
| `candidate_id` | `7n2b_cand_0003_papa_not_pere_boundary` |
| `tranche_id` | `7N2B` |
| `g1_source` | `docs/reports/phase7n2b4g1_candidate_table_report.md` § Unit 3 |
| `owner_decision` | `approved_for_implementation` |
| `owner_decision_date` | `2026-07-09` |
| `reviewer` | `project owner / native-speaker linguistic authority` |
| `approved_behavior` | `papa` and `père` remain distinct source entries; no `papa` → `père` alias |
| `approved_source_query` | `papa` (must not alias to `père`) |
| `approved_canonical_source_terms` | keep distinct: `papa`, `père` |
| `approved_expected_ir_ids` | `papa`: `["b8053579e3035e88"]`; `père`: `["423369d78d42c100"]` |
| `approved_expected_target_forms` | `papa` → `["bàba", "bàwa"]`; `père` → `["fà"]` |
| `implementation_artifact` | Additive 7N2B regression negative cases only |
| `required_negative_assertions` | Forbid `papa` → `père` source alias; preserve both postings and target distinctions |
| `deferred_reason` | — |
| `blocked_dependencies` | none |
| `notes` | Owner approved preserving informal `papa` vs formal `père` distinction |

### Unit 4 — `7n2b_cand_0004_fievre_owner_lexical`

| Field | Value |
| --- | --- |
| `candidate_id` | `7n2b_cand_0004_fievre_owner_lexical` |
| `tranche_id` | `7N2B` |
| `g1_source` | `docs/reports/phase7n2b4g1_candidate_table_report.md` § Unit 4 |
| `owner_decision` | `deferred_pending_owner_targets` |
| `owner_decision_date` | `2026-07-09` |
| `reviewer` | `project owner / native-speaker linguistic authority` |
| `approved_behavior` | — (not approved for implementation) |
| `approved_source_query` | `fièvre` |
| `approved_canonical_source_terms` | `["fièvre"]` (standalone health lemma; retained for later review) |
| `approved_expected_ir_ids` | `TBD_by_owner` |
| `approved_expected_target_forms` | `TBD_by_owner` |
| `implementation_artifact` | none in 7N2B G3 |
| `required_negative_assertions` | Do not infer from `arbre à fièvre` / `arbre.à.fièvre`; featured miss for standalone `fièvre` remains until a later approved lexical addition |
| `deferred_reason` | Owner deferred; no approved Maninka target form(s), gloss, or target IDs supplied for standalone `fièvre` |
| `blocked_dependencies` | Owner-supplied target form(s) + gloss + meaning boundary + enough information to create owner lexical row(s) |
| `notes` | Remains a deferred everyday health miss; not in G3 implementation scope |

### Unit 5 — `7n2b_cand_0005_prix_owner_lexical`

| Field | Value |
| --- | --- |
| `candidate_id` | `7n2b_cand_0005_prix_owner_lexical` |
| `tranche_id` | `7N2B` |
| `g1_source` | `docs/reports/phase7n2b4g1_candidate_table_report.md` § Unit 5 |
| `owner_decision` | `approved_for_implementation` |
| `owner_decision_date` | `2026-07-09` |
| `reviewer` | `project owner / native-speaker linguistic authority` |
| `approved_behavior` | Add standalone French commerce lemma `prix` (price/cost) with owner-supplied Maninka starter target **Son** |
| `approved_source_query` | `prix` |
| `approved_canonical_source_terms` | `["prix"]` |
| `approved_expected_ir_ids` | `TBD_at_implementation` (new owner lexical IR id(s) to be minted in G3; not inferred from multiword price phrases) |
| `approved_expected_target_forms` | `["Son"]` (owner-latinized starter; accents/tones may be incomplete) |
| `implementation_artifact` | `data/ir/siralex_owner_lexical_v1.jsonl` (+ optional later `source_index_supplements` if additive index posting is required by the existing owner-lexical pipeline) |
| `required_negative_assertions` | Do not alias from multiword price phrases; do not invent additional commerce mappings beyond the approved starter |
| `deferred_reason` | — |
| `blocked_dependencies` | G3 must record orthography uncertainty: owner stated accents may be missing because the form is written from sound in Latin; use `Son` as the approved starter headword unless a later owner orthography correction supersedes it |
| `notes` | Owner: “price is Son in malinke”; explicit request to use as starter despite possible missing accents. Gloss locked as French price/cost for standalone `prix`. Capitalization preserved as owner-written starter pending G3 lexical-row conventions. |

## 3. Approved implementation scope

Approved for G3 implementation:

| Candidate | Behavior | Artifact |
| --- | --- |
| `7n2b_cand_0001_moto_source_alias` | `moto` → `motocycle` / `motocyclette` (`pópo`) | `shared/aliases/source_aliases_v1.jsonl` |
| `7n2b_cand_0002_phrase_lemma_boundary` | Keep phrase examples as misses; no phrase aliases | Additive 7N2B regression negatives (G4) |
| `7n2b_cand_0003_papa_not_pere_boundary` | Keep `papa` / `père` distinct | Additive 7N2B regression negatives (G4) |
| `7n2b_cand_0005_prix_owner_lexical` | Standalone `prix` → starter Maninka `Son` | `data/ir/siralex_owner_lexical_v1.jsonl` (+ optional supplement if pipeline requires) |

Safe-tranche shape after owner notes:

```text
1 implementable alias (moto)
2 implementable negative boundaries (phrase; papa ↛ père)
1 implementable owner lexical addition (prix → Son starter)
1 deferred lexical addition (fièvre)
```

## 4. Deferred candidates and reasons

| Candidate | Decision | Reason |
| --- | --- |
| `7n2b_cand_0004_fievre_owner_lexical` | `deferred_pending_owner_targets` | Owner deferred; no approved target form(s) / gloss / IDs for standalone `fièvre` |

Still deferred from G0 (unchanged; not in this approval table):

- `poulet`
- `bonjour`
- `dispensaire` / `ambulance`
- `mamie` / `papy`
- phrase-alias track / tone-folding / similar-spelling UI
- `maman` (already shipped in 7N2A)

## 5. Negative boundaries approved

- No phrase-level aliases or sentence translation in 7N2B.
- No `papa` → `père` alias; preserve `papa` → `bàba` / `bàwa` and `père` → `fà`.
- Do not infer `fièvre` from fever-tree compounds while deferred.
- Do not infer `prix` from multiword price phrases; implement only the approved standalone lemma with starter `Son`.
- Closed 7N2A contracts remain untouched.

## 6. G3 implementation forecast

**Phase 7N2B4G3 — Implement Approved 7N2B Linguistic Tables**

Implement:

- `moto` source alias row in `shared/aliases/source_aliases_v1.jsonl`
- no phrase alias behavior
- no `papa` → `père` alias behavior
- `prix` owner lexical row using starter target form `Son`, with provenance noting provisional orthography / possible missing accents

Do not implement:

- `fièvre` owner lexical row

## 7. G4 regression forecast

Additive 7N2B regression rows should cover:

| Case | Expected |
| --- | --- |
| `moto` | hit → `pópo` (via approved alias) |
| Phrase examples (`comment dit-on école`, `combien ça coûte`, `merci beaucoup`) | miss |
| `papa` and `père` | distinct postings / targets (`bàba`/`bàwa` vs `fà`); no collapse |
| `fièvre` | miss remains (deferred) |
| `prix` | hit → starter `Son` after G3 owner-lexical implementation |

## 8. Decision

```text
7N2B_OWNER_REVIEW_APPROVED_PARTIAL_IMPLEMENTATION
```

Rationale: three low-risk units plus one owner-supplied lexical starter (`prix` → `Son`) are approved; `fièvre` remains deferred pending targets.

## 9. Next slice definition

**Phase 7N2B4G3 — Implement Approved 7N2B Linguistic Tables**

Purpose: implement only owner-approved 7N2B behavior units in the appropriate
linguistic tables while preserving deferred owner-lexical additions.

## 10. Confirmation: no runtime / data / catalog / bundle / source / matrix / package changes

G2 created only this report. No edits to `web/`, `api/`, `data/`, linguistic
tables, matrices, catalog, bundles, artifacts, or packages.
