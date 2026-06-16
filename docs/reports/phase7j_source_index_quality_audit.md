# Phase 7J Source-Index Quality Audit

Status: review-only audit artifacts generated 2026-06-16. No implementation approved.

## Executive summary

Phase 7J Round 2 re-ran the source-index gap miner against the current featured bundle
(`bundle_full_20260609_phase7f_alias_candidate`) and produced a curated, classified candidate set of
**26** review rows. The miner surfaced **14063** seed candidates;
human-facing 7J output keeps carry-forward controls, high-salience Round 2 alias/supplement
candidates, and explicit non-action classifications.

No row is marked `approved`. Phrase alias implementation remains blocked on Phase 7I human
review. Source aliases, supplements, ranking, search runtime, bundles, and catalog were not
changed.

## Input provenance

| Input | Location | Used |
|---|---|---|
| Featured bundle | `web/public/bundle_full_20260609_phase7f_alias_candidate/` | Yes |
| `records.jsonl` | bundle dir | Yes (via miner) |
| `search_index.jsonl` | bundle dir | Yes (replay + miner) |
| `bundle.manifest.json` | bundle dir | Yes |
| Gap miner CLI | `api/source_index_gap_discovery/mine_candidates.py` | Yes |
| Applied aliases | `shared/aliases/source_aliases_v1.jsonl` | Yes (dedupe / carry-forward) |
| Applied supplements | `shared/source_index_supplements/source_index_supplements_v1.jsonl` | Yes |
| Phrase miss evidence | `shared/phrase_review/phrase_miss_review_v1.jsonl` | Yes (linked, not generation input) |
| Phase 7I review packet | `docs/PHASE_7I_PHRASE_ALIAS_REVIEW_PACKET.md` | Yes |
| Phase 7F regression report | `docs/reports/query_regression_validation_report_phase7f_round1.json` | Yes (baseline expectations) |
| Query logs | tester exports | **Not available** in repo (waived) |
| Plain Kun policy memo | `docs/PLAIN_KUN_POLICY_DECISION_MEMO.md` | Yes |

### Bundle provenance

- `source_bundle_id`: `bundle_full_20260609_phase7f_alias_candidate`
- `source_catalog_version`: `norm-v3-featured-enriched-source-aliases-2-source-index-supplements-2`
- `content_sha256`: `sha256:0e5918bd9a1fc3f0cb6c88871542129a568371b2fabaaadccee8d9d27f9d18b0`
- `baseline_phase`: `post-7i`
- `records.jsonl` sha256: `sha256:14353c66ce92b87aba108349b4f5d831961da740469d5295d54d8034ef4cf376`
- `search_index.jsonl` sha256: `sha256:37fe1ab007917bf00eb520ab6b01390e01c4602746d62b5286257025d9592164`

## Methodology

1. Inspected current bundle manifest and search index.
2. Re-ran `python3 -m source_index_gap_discovery.mine_candidates` against the featured bundle.
3. Stored full miner output as `phase7j_miner_snapshot.jsonl` (seed evidence only).
4. Built curated `phase7j_gap_candidates.jsonl` by:
   - classifying required carry-forward queries;
   - linking Phase 7H/7I phrase evidence without using it as a generation input;
   - selecting Round 2 plural alias candidates (miner tier_2 `plural_form_gap`);
   - selecting kinship incomplete-mapping and body-vocabulary supplement seeds;
   - marking already-addressed 7B/7D/7F items for regression control.
5. Replayed regression queries via norm_v3 ladder lookup against `search_index.jsonl`.
6. Validated JSONL invariants (no `approved` rows).

## Taxonomy counts

| `gap_class` | Count |
|---|---|
| `already_addressed` | 3 |
| `phrase_miss_candidate` | 2 |
| `ranking_ambiguity_issue` | 2 |
| `reviewed_source_alias_candidate` | 11 |
| `reviewed_source_index_supplement_candidate` | 2 |
| `should_remain_no_hit` | 2 |
| `target_side_issue` | 1 |
| `true_dictionary_entry_gap` | 2 |
| `typo_noise` | 1 |

| `review_status` | Count |
|---|---|
| `candidate` | 16 |
| `deferred` | 7 |
| `rejected` | 3 |
| `approved` | 0 |

### Miner snapshot distribution (seed only)

| Metric | Value |
|---|---|
| Total miner rows | 14063 |
| `review_candidate` | 2747 |
| `evidence_only` | 986 |
| `defer` | 3929 |
| `noise` | 6401 |

Top miner `candidate_type` counts:

- `likely_stopword_or_noise`: 6401
- `ambiguous_or_review_required`: 3272
- `missing_standalone_source_term`: 2825
- `existing_source_with_related_phrases`: 945
- `plural_form_gap`: 325
- `missing_broad_umbrella_term`: 249
- `modifier_or_low_value_term`: 41
- `suspected_incomplete_existing_source_mapping`: 5

## Priority queues

### P1 (score 70–100)

- none

### P2 (score 45–69)

- `phase7j_gap_0015` `fruits` (reviewed_source_alias_candidate, score 65, candidate)
- `phase7j_gap_0016` `grains` (reviewed_source_alias_candidate, score 65, candidate)
- `phase7j_gap_0017` `griots` (reviewed_source_alias_candidate, score 65, candidate)
- `phase7j_gap_0018` `jambes` (reviewed_source_alias_candidate, score 65, candidate)
- `phase7j_gap_0019` `mots` (reviewed_source_alias_candidate, score 65, candidate)
- `phase7j_gap_0020` `nuages` (reviewed_source_alias_candidate, score 65, candidate)
- `phase7j_gap_0021` `parents` (reviewed_source_alias_candidate, score 65, candidate)
- `phase7j_gap_0022` `paroles` (reviewed_source_alias_candidate, score 65, candidate)
- `phase7j_gap_0023` `enfants` (reviewed_source_alias_candidate, score 65, candidate)
- `phase7j_gap_0024` `feuilles` (reviewed_source_alias_candidate, score 65, candidate)
- `phase7j_gap_0001` `grand-parents` (reviewed_source_alias_candidate, score 55, deferred)
- `phase7j_gap_0007` `à l'insu de qqns` (phrase_miss_candidate, score 55, deferred)
- `phase7j_gap_0002` `mère` (ranking_ambiguity_issue, score 50, deferred)
- `phase7j_gap_0008` `à la mesure des` (phrase_miss_candidate, score 50, deferred)

### P3 (score 20–44)

- `phase7j_gap_0025` `frère` (reviewed_source_index_supplement_candidate, score 42, candidate)
- `phase7j_gap_0026` `soeur` (reviewed_source_index_supplement_candidate, score 42, candidate)
- `phase7j_gap_0009` `Kun` (target_side_issue, score 40, deferred)
- `phase7j_gap_0003` `mere` (ranking_ambiguity_issue, score 35, deferred)
- `phase7j_gap_0010` `ferme la bouche` (true_dictionary_entry_gap, score 25, rejected)
- `phase7j_gap_0012` `grande bouche` (true_dictionary_entry_gap, score 20, candidate)

### P4 (score 0–19)

- `phase7j_gap_0013` `à parts` (should_remain_no_hit, score 15, rejected)
- `phase7j_gap_0011` `Grand chose` (should_remain_no_hit, score 10, deferred)
- `phase7j_gap_0014` `à part ças` (typo_noise, score 5, rejected)
- `phase7j_gap_0004` `oncle` (already_addressed, score 0, candidate)
- `phase7j_gap_0005` `poil` (already_addressed, score 0, candidate)
- `phase7j_gap_0006` `poils` (already_addressed, score 0, candidate)

## Known carry-forward classifications

| Query | `gap_class` | `review_status` | Notes |
|---|---|---|---|
| `grand-parents` | `reviewed_source_alias_candidate` | `deferred` | Multi-target 7A deferred alias |
| `mère` / `mere` | `ranking_ambiguity_issue` | `deferred` | Hits; ordering/interpretability |
| `oncle` | `already_addressed` | `candidate` | Phase 7D supplement shipped |
| `poil` / `poils` | `already_addressed` | `candidate` | Phase 7B supplements shipped |
| `à l'insu de qqns` | `phrase_miss_candidate` | `deferred` | Phase 7I blocked track |
| `à la mesure des` | `phrase_miss_candidate` | `deferred` | Phase 7I blocked track |
| `Kun` | `target_side_issue` | `deferred` | Plain Kun policy memo |
| `ferme la bouche` | `true_dictionary_entry_gap` | `rejected` | No phrase-to-single-word routing |
| `Grand chose` | `should_remain_no_hit` | `deferred` | No decomposition |
| `grande bouche` | `true_dictionary_entry_gap` | `candidate` | Phrase-level evidence needed |
| `à parts` | `should_remain_no_hit` | `rejected` | Keep no-hit |
| `à part ças` | `typo_noise` | `rejected` | No fuzzy correction |

## Explicit non-action list

Do not implement from this audit without separate human review:

- Runtime fuzzy search or typo correction (`à part ças`, agreement-error phrases)
- Runtime decomposition (`Grand chose`, `ferme la bouche` → component terms)
- Phrase-to-single-word routing
- Silent reuse of `source_alias_table_v1` for phrase queries
- Target-side Kun broadening as a source alias/supplement
- Re-opening `poil` / `poils` / `oncle` without new regression failure evidence
- Any row with `gap_class` `already_addressed`, `should_remain_no_hit`, or `typo_noise`

## Candidate artifact summary

| Artifact | Path | Rows |
|---|---|---|
| Gap candidates | `shared/source_index_gap_discovery/phase7j_gap_candidates.jsonl` | 26 |
| Miner snapshot | `shared/source_index_gap_discovery/phase7j_miner_snapshot.jsonl` | 14063 |
| Gap candidates CSV | `shared/source_index_gap_discovery/phase7j_gap_candidates.csv` | 26 |
| Regression replay | `docs/reports/phase7j_regression_replay.json` | 25 queries |

## Recommended next phases

1. **Alias Round 2 review packet** — human review for P2 plural alias candidates and deferred `grand-parents`.
2. **Supplement review packet** — kinship incomplete-mapping (`frère`, `soeur`) and curated body-vocabulary standalone gaps.
3. **Phase 7I human review** — unchanged; approve or reject the two deferred phrase candidates before any `source_phrase_aliases_v1.jsonl` work.
4. **Ranking / interpretability follow-up** — `mère` multi-target ordering (separate from source-index metadata).
5. **Plain Kun policy decision** — target-side only, using `docs/PLAIN_KUN_POLICY_DECISION_MEMO.md`.

## Validation results

- Miner executed successfully against current featured bundle.
- Inline JSONL validation: passed — validated 26 Phase 7J gap candidate rows.
- Regression replay: 17 hits / 25 probes recorded in `phase7j_regression_replay.json`.
- No `approved` rows in candidate artifact.
- No modifications to aliases, supplements, phrase aliases, bundles, catalog, runtime, or roadmap.

## Risks and boundaries

- Miner seed set is large (14063 rows) and includes noise; curated JSONL is intentional, not exhaustive.
- Query logs were unavailable; frequency-based prioritization is weakened.
- Gloss-derived standalone gaps may over-propose supplements; each requires human review.
- Phrase and target-side issues are classified here but must not be implemented through source-side artifacts.

---

*Generated by Phase 7J read-only audit. Classification is the deliverable.*
