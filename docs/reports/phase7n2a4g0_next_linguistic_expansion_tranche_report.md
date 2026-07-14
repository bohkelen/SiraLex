# Phase 7N2A4G0 — Define Next Linguistic Expansion Tranche

## Decision

```text
NEXT_TRANCHE_DEFINED_READY_FOR_OWNER_REVIEW
```

```text
RECOMMENDED_NEXT_TRANCHE:
7N2B — Everyday lemma recovery (alias-first + miss triage)

SIZE:
5 behavior units

RATIONALE:
Human-usage automation on the pre-promotion featured package surfaced a small
set of high-visibility French lemma misses and phrase mismatches. After 7N2A
promotion, the same pipeline can absorb one low-risk common-form alias with
durable IR targets (`moto` → `motocycle` / `motocyclette`), plus explicit
negative boundaries that protect lemma-only product behavior and prevent unsafe
kinship aliasing. Remaining everyday misses (`fièvre`, `prix`, `poulet`,
`bonjour`) lack exact durable source lemmas and are included only as
owner-review candidates, not as auto-implementable mappings.

BLOCKERS:
none for drafting the owner-review candidate table (G1).
Owner-approved target IDs are required before implementing any
owner_lexical_addition / supplement rows for fever/price/chicken/greeting.
```

## 1. Current promoted baseline

| Field | Value |
| --- | --- |
| Featured bundle | `bundle_full_20260708_27643bb0` |
| Featured mechanism | `web/.env.production` → `VITE_FEATURED_BUNDLE_ID=bundle_full_20260708_27643bb0` |
| Promotion status | `PHASE_7N2A_PROMOTION_CLOSED_STABLE` |
| Default test suite | Green after F11 |
| Rollback | `bundle_full_20260616_phase7j_alias_round2_candidate` still catalog-visible |

Closed 7N2A contracts remain in force (`maman`, health supplements, `place` /
`location` / `yoro` boundaries).

## 2. Evidence sources inspected

| Source | Role |
| --- | --- |
| `data/local_evidence/human_usage_automation/candidate_rebuild_structured_usability_evidence_corrected_20260702.{md,jsonl,json}` | Structured usability misses / interventions (not demand) |
| `shared/aliases/source_aliases_v1.jsonl` | Existing approved aliases (incl. `maman` → `mère`) |
| `shared/source_index_supplements/source_index_supplements_v1.jsonl` | Existing supplements (health + kinship) |
| `shared/target_variants/reviewed_target_variants_v1.jsonl` | Existing target variants (`móbaa`) |
| `data/ir/siralex_owner_lexical_v1.jsonl` | Owner lexical additions (health institutions) |
| `data/ir/malipense_index_v1.jsonl` | Durable IR source terms / targets |
| `web/public/bundle_full_20260708_27643bb0/search_index.jsonl` | Current featured lookup truth |
| `docs/reports/phase7n2a_source_record_audit.md` | Explicitly deferred items (`moto`, `bonjour`, phrases, tone folding) |
| `docs/reports/phase7n2a4f10_promotion_closure_report.md` | Closed promotion baseline |

Usability evidence note: the corrected automation run used the **7J** package
before 7N2A promotion. Lemma-miss observations remain informative for next-tranche
selection; `maman` is already fixed in the promoted featured bundle.

## 3. Candidate pool

### Observed usability signals (lemma / intervention relevant)

| Query | Observed (7J automation) | Intervention hint | Featured 7N2A status |
| --- | --- | --- | --- |
| `maman` | miss → `missing_entry` / `source_aliases` | alias | **Already fixed** (`maman` → generic `mère`) |
| `prix` | miss → `pending_human_review` | human review | Still miss |
| `fièvre` | miss → `pending_human_review` | human review | Still miss |
| `poulet` | miss → `pending_human_review` | human review | Still miss |
| `moto` | miss (offline reopen row) | offline UX tagged; also lexical miss | Still miss |
| `bonjour` | miss on offline reopen | offline UX / deferred in 7N2A audit | Still miss |
| Phrase rows (`comment dit-on école`, `combien ça coûte`, …) | `phrase_mismatch` | phrase_handling / copy | Correct lemma-product miss |
| `papa` / `père` | both hit | informal family | Both hit; **different targets** |

### Durable IR / index facts (featured 7N2A)

| Term | Fact |
| --- | --- |
| `motocycle` / `motocyclette` | Indexed; both resolve to `pópo` |
| `moto` | Not indexed |
| `fièvre` / `prix` / `poulet` / `bonjour` / `dispensaire` | No exact `source_term` lemma in Mali-Pense index (only compounds/phrases for some) |
| `papa` | → `bàba`, `bàwa` |
| `père` | → `fà` (must not be collapsed into `papa`) |
| `docteur` / `médecin` / `pharmacie` / health institutions | Already present |

## 4. Recommended tranche

### Tranche name

**7N2B — Everyday lemma recovery (alias-first + miss triage)**

### Behavior units (5)

| # | Term / unit | Behavior type | Source-side query | Expected result behavior | Evidence available today | Risk |
| --- | ---: | --- | --- | --- | --- | --- |
| 1 | `moto` | `source_alias` | `moto` | Resolve like `motocycle` / `motocyclette` → `pópo` posting(s); narrow to transport lemma only | Usability miss; durable IR `motocycle`/`motocyclette` → `pópo`; both indexed in featured bundle | **low** |
| 2 | Phrase lemma boundary | `negative_boundary` | e.g. `comment dit-on école`, `combien ça coûte`, `merci beaucoup` | Remain miss with existing “try one word” guidance; no phrase-alias table in this tranche | Usability `phrase_mismatch` rows; 7N2A audit deferred phrase translation | **low** |
| 3 | Kinship anti-collapse | `negative_boundary` | `papa` must not alias to `père` | Keep distinct postings (`bàba`/`bàwa` vs `fà`); no `papa`→`père` alias | Featured index shows distinct targets; 7N2A `maman` narrowing lesson | **low** |
| 4 | `fièvre` | `owner_lexical_addition` (+ later `source_index_supplement` if needed) | `fièvre` | Owner-approved fever concept posting(s); exact targets TBD by owner | Usability miss; **no** exact IR lemma (only `arbre à fièvre` compounds) | **medium** |
| 5 | `prix` | `owner_lexical_addition` (+ later supplement if needed) | `prix` | Owner-approved price/cost concept posting(s); exact targets TBD | Usability miss; IR has only multiword price phrases (`quel est son prix?`, …) | **medium** |

### Why these belong now

- Fits the proven 7N2A pipeline (alias / owner lexical / negative boundary / matrix / recompose).
- Keeps size within 3–7 user-visible behaviors.
- Starts with one **low-risk** alias that has durable targets already in the featured index.
- Converts usability misses into an owner-review packet without inventing fuzzy matches.
- Encodes hard negatives so phrase UX and kinship semantics are not “fixed” incorrectly.

## 5. Excluded / deferred candidates

| Candidate | Why deferred / rejected for 7N2B implementation |
| --- | --- |
| `maman` | Already shipped in promoted 7N2A; do not reopen |
| `poulet` | Usability miss, but no exact durable lemma; only multiword IR mentions — defer until owner chooses chicken lexical targets |
| `bonjour` | Explicitly deferred in 7N2A source-record audit; greeting coverage needs separate owner packet |
| `dispensaire` / `ambulance` | Plausible health follow-ons, but no usability row and no exact IR lemma — defer |
| `mamie` / `papy` | No strong usability miss; kinship aliasing risk similar to `maman`/`papa` — defer |
| `moto` as target_variant | Wrong artifact type; French common form → existing French lemma is `source_alias` |
| Global tone-insensitive / vowel folding / similar-spelling UI | Explicitly deferred product/search-policy work |
| Phrase aliases (`source_phrase_aliases`) | Blocked / separate Phase 7I-style track; not this tranche |
| Broad ranking/interpretability of `Kùn` / `tante` multi-hits | Interpretability, not missing lemma; needs separate ranking/UX review |

## 6. Risk register

| Risk | Rating | Mitigation |
| --- | --- | --- |
| `moto` alias over-broad if mapped to unrelated `…moto…` strings | low | Restrict canonical terms to `motocycle` / `motocyclette` only |
| Owner lexical rows for `fièvre`/`prix` without durable targets | medium | G1 drafts candidates; G2 requires owner-approved IR/target IDs before G3 |
| Treating phrase misses as content gaps | medium | Explicit negative_boundary unit; no phrase table in 7N2B |
| Collapsing `papa` into `père` | high if done | Explicit anti-alias negative_boundary |
| Reusing pre-promotion usability package as demand evidence | low | Rows remain non-demand; used only as miss/triage signals |

## 7. Proposed next pipeline

```text
Phase 7N2B4G1 — Draft 7N2B Candidate Table
  Draft alias / owner-lexical / negative-boundary rows for owner review.
  No table commits that change product behavior yet if review gate requires approval first;
  G1 may produce a review packet only.

Phase 7N2B4G2 — Owner Review and Approval Record
  Approve / defer / reject each unit; lock target IR IDs for any lexical additions.

Phase 7N2B4G3 — Implement Approved Linguistic Tables
  Write only approved aliases / owner lexical / supplements; validate fail-closed.

Phase 7N2B4G4 — Add Additive Regression Matrix
  Frozen 7L untouched; additive 7N2B matrix for approved behaviors + negatives.

Phase 7N2B4G5 — Recompose Candidate and Run Gates
  Same evidence-first path as 7N2A: recompose → 7L + additive gates → review package
  → catalog-visible candidate → runtime smoke → featured promotion readiness.
```

Naming uses **7N2B** as the linguistic tranche id while keeping the G1–G5 evidence-first
sequence from this G0 outline.

## 8. Confirmation: no runtime / data / catalog / bundle / source / matrix / package changes

G0 created only this report. No edits to:

- `web/`, `api/`
- `data/`, `shared/aliases/`, `shared/source_index_supplements/`, `shared/target_variants/`
- `shared/search_regression/`
- catalog / bundle / artifacts / packages
