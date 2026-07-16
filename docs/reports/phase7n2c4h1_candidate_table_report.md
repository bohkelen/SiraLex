# Phase 7N2C4H1 — Draft Next Follow-Up Candidate Table

## Decision

```text
7N2C_CANDIDATE_TABLE_READY_FOR_OWNER_REVIEW
```

This slice is a review packet only. No source data, aliases, supplements,
owner lexical rows, matrices, catalog, runtime, tests, bundles, or packages
were changed.

```text
RECOMMENDED_7N2C_H1_TABLE:
7N2C — Post-7N2B owner lexical confirmation packet (Son-led)

SIZE:
4 candidate units

RATIONALE:
Draft a Son-led owner/product review packet that confirms the already-featured
provisional prix → Son starter, then bounds deferred everyday misses (fièvre,
poulet) and phrase guidance without greetings, phrase aliases, or catalog work.

BLOCKERS:
none for owner-review drafting;
implementation of fièvre / poulet remains blocked until owner supplies approved
standalone targets;
any Son orthography change is blocked until owner confirmation in H2;
phrase guidance remains product/UX only (no linguistic table row in 7N2C)
```

## 1. Baseline and tranche identity

| Field | Value |
| --- | --- |
| Featured / default bundle | `bundle_full_20260710_337619ff` |
| Closed promotion decision | `PHASE_7N2B_PROMOTION_CLOSED_STABLE` |
| Current shipped 7N2B deltas | `moto` → `pópo`; `prix` → starter `Son` |
| H0 selected follow-up | `7N2C — Post-7N2B owner lexical confirmation packet (Son-led)` |
| H0 decision | `NEXT_POST_7N2B_FOLLOWUP_DEFINED_READY_FOR_OWNER_REVIEW` |
| Track type | `linguistic_owner_review` |
| Tranche id | `7N2C` |
| Candidate status | `proposed_for_owner_review` |
| Candidate table size | 4 units |

`bonjour` is explicitly out of this packet.

## 2. Evidence inspected

| Path | Role |
| --- | --- |
| `docs/reports/phase7n2c4h0_next_post_7n2b_followup_report.md` | Selected 7N2C scope and planned units |
| `docs/reports/phase7n2b4g13_promotion_closure_report.md` | Closure + residual Son / follow-up menu |
| `docs/reports/phase7n2b4g12_post_promotion_runtime_monitoring_report.md` | Featured smoke: prix → Son; fièvre miss |
| `docs/reports/phase7n2b4g2_owner_review_approval_record.md` | Son starter approval; fièvre deferred; phrase boundary |
| `docs/reports/phase7n2b4g3_linguistic_tables_report.md` | Implemented Son IR + prix supplement; no fièvre row |
| `data/ir/siralex_owner_lexical_v1.jsonl` | Owner lexical `Son` (`3b8c3b7a0c5e897d`); provisional orthography note |
| `shared/source_index_supplements/source_index_supplements_v1.jsonl` | `src_supp_phase7n2b_0001` (`prix` → `Son`) |
| `web/public/bundle_full_20260710_337619ff/search_index.jsonl` | Featured source lookup truth |
| `web/public/bundle_full_20260710_337619ff/records.jsonl` | Featured records / display targets |
| `data/local_evidence/human_usage_automation/` | Present; historical usability miss / phrase signals |

Local automation evidence is available under
`data/local_evidence/human_usage_automation/` (corrected usability JSON / JSONL /
MD plus usage run folders). No evidence gap blocked drafting this table.

## 3. Current featured behavior facts

Proven against featured `bundle_full_20260710_337619ff` plus owner IR /
supplement rows:

| Fact | Status |
| --- | --- |
| `prix` currently resolves to owner lexical target `Son` | Confirmed |
| Son owner lexical `ir_id` | `3b8c3b7a0c5e897d` |
| `prix` direct generated source mapping | `ffbf014bd96ffabf` |
| Son is explicitly provisional / starter orthography | Confirmed (owner IR usage note + G2/G3/G13) |
| `fièvre` remains miss | Confirmed (`src_casefold` / diacritics-insensitive miss) |
| `poulet` remains miss or lacks an approved standalone owner target | Confirmed (featured standalone miss; compounds/examples must not be used) |
| Phrase examples remain misses | Confirmed for `comment dit-on école`, `combien ça coûte`, `merci beaucoup` |
| `bonjour` is deferred and not part of 7N2C H1 | Confirmed (H0 + this table) |

Additional lookup notes (boundaries, not candidates):

- `arbre à fièvre` remains a compound hit (`940d3e857b8594dc` → `dònkari`) and must not seed standalone `fièvre`.
- Multiword / example strings containing `poulet` exist in Mali-Pense records and must not seed standalone `poulet`.
- Homograph caution: Latin source query `son` can hit unrelated Mali-Pense material; French `prix` is routed through the generated mapping / owner target path above.

## 4. Draft candidate table

### Unit 1 — Son orthography/tone confirmation for `prix`

| Field | Value |
| --- | --- |
| `candidate_id` | `7n2c_cand_0001_son_orthography_confirmation` |
| `tranche_id` | `7N2C` |
| `status` | `proposed_for_owner_review` |
| `behavior_type` | `owner_lexical_confirmation` |
| `source_query` | `prix` |
| `current_behavior` | `prix` → `Son` (direct `ffbf014bd96ffabf`; resolved owner target `3b8c3b7a0c5e897d`) |
| `proposed_review_action` | Confirm whether featured starter `Son` remains as-is, needs orthography/tone correction, should keep an explicit provisional annotation, or should defer any change |
| `expected_behavior_if_approved` | Modeled outcomes only in H1: **A.** `confirm_as_is` — keep featured `prix` → `Son`; **B.** `correct_orthography` — replace headword/display with owner-corrected form in a later implementation slice; **C.** `keep_provisional_note` — retain `Son` with explicit provisional orthography annotation; **D.** `defer_change` — no orthography edit; revisit later. H1 does not change featured behavior. |
| `expected_ir_ids` | Current: `["3b8c3b7a0c5e897d"]` (owner target); direct mapping `ffbf014bd96ffabf`. Correction outcome may keep the same `ir_id` with updated form, subject to H2. |
| `expected_target_forms` | Current: `["Son"]`. Correction outcome TBD by owner in H2. |
| `evidence_available` | G2 starter approval; G3 IR + supplement; G12/G13 featured smoke; owner IR provisional note; H0 selection |
| `risk_rating` | `medium` |
| `owner_review_required` | `true` |
| `owner_review_question` | Confirm whether the featured Maninka starter form for French `prix` should remain `Son` exactly, be corrected with tone/diacritics, or be annotated as provisional. |
| `implementation_artifact_if_approved` | Later only, if H2 chooses correction/annotation: `data/ir/siralex_owner_lexical_v1.jsonl` (and supplement display notes if required). **Do not edit in H1.** |
| `negative_boundary_assertions` | No H1 edit to owner lexical / supplements / featured bundle; do not invent tones without owner confirmation; do not retarget `prix` away from the approved commerce sense |
| `blocked_dependencies` | Owner H2 decision among A/B/C/D before any IR or featured-behavior change |
| `rationale` | Already-featured provisional starter is the highest-risk residual linguistic item after 7N2B promotion; confirmation before further lexical expansion is the safest Son-led next step |

### Unit 2 — `fièvre` owner lexical candidate

| Field | Value |
| --- | --- |
| `candidate_id` | `7n2c_cand_0002_fievre_owner_lexical` |
| `tranche_id` | `7N2C` |
| `status` | `proposed_for_owner_review` |
| `behavior_type` | `owner_lexical_addition_candidate` |
| `source_query` | `fièvre` |
| `current_behavior` | `fièvre` → miss |
| `proposed_review_action` | Request owner-approved standalone Maninka translation(s) / gloss / meaning boundary for French `fièvre`; no implementation until targets are supplied |
| `expected_behavior_if_approved` | After a later implementation slice only: standalone `fièvre` resolves to owner-approved Maninka target(s). H1 expects continued miss. |
| `expected_ir_ids` | none in H1 (no owner-approved standalone target IDs in evidence) |
| `expected_target_forms` | `TBD_by_owner` |
| `evidence_available` | Featured miss; G2 deferred pending targets; usability health miss; fever-tree compound exists and is explicitly excluded |
| `risk_rating` | `medium` |
| `owner_review_required` | `true` |
| `owner_review_question` | What is the correct Maninka translation or translations for standalone French `fièvre`? |
| `implementation_artifact_if_approved` | `data/ir/siralex_owner_lexical_v1.jsonl`; `shared/source_index_supplements/source_index_supplements_v1.jsonl` only if source searchability requires a supplement |
| `negative_boundary_assertions` | Do not infer from `arbre à fièvre` / `arbre.à.fièvre` / fever-tree compounds |
| `blocked_dependencies` | Owner-supplied standalone target form(s), gloss, and meaning boundary before any lexical row |
| `rationale` | High-visibility everyday health miss already deferred in 7N2B; still needs owner targets, not compound inference |

### Unit 3 — `poulet` owner lexical candidate

| Field | Value |
| --- | --- |
| `candidate_id` | `7n2c_cand_0003_poulet_owner_lexical` |
| `tranche_id` | `7N2C` |
| `status` | `proposed_for_owner_review` |
| `behavior_type` | `owner_lexical_addition_candidate` |
| `source_query` | `poulet` |
| `current_behavior` | `poulet` → miss (no approved standalone owner target) |
| `proposed_review_action` | Request owner-approved standalone Maninka translation(s) / gloss / meaning boundary for French `poulet`; no implementation until targets are supplied |
| `expected_behavior_if_approved` | After a later implementation slice only: standalone `poulet` resolves to owner-approved Maninka target(s). H1 expects continued miss. |
| `expected_ir_ids` | none in H1 (no owner-approved standalone target IDs in evidence) |
| `expected_target_forms` | `TBD_by_owner` |
| `evidence_available` | Featured standalone miss; usability food miss; multiword/example strings containing `poulet` exist and are explicitly excluded |
| `risk_rating` | `medium` |
| `owner_review_required` | `true` |
| `owner_review_question` | What is the correct Maninka translation or translations for standalone French `poulet`? |
| `implementation_artifact_if_approved` | `data/ir/siralex_owner_lexical_v1.jsonl`; `shared/source_index_supplements/source_index_supplements_v1.jsonl` only if source searchability requires a supplement |
| `negative_boundary_assertions` | Do not infer from multiword food phrases, dish names, or compounds unless owner explicitly approves them for standalone `poulet` |
| `blocked_dependencies` | Owner-supplied standalone target form(s), gloss, and meaning boundary before any lexical row |
| `rationale` | Bounded everyday food miss retained from post-7N2B planning; companion to fièvre without expanding into a broad food packet |

### Unit 4 — Phrase lemma boundary / product guidance

| Field | Value |
| --- | --- |
| `candidate_id` | `7n2c_cand_0004_phrase_guidance_boundary` |
| `tranche_id` | `7N2C` |
| `status` | `proposed_for_owner_review` |
| `behavior_type` | `negative_product_boundary` |
| `source_query` | examples: `comment dit-on école`, `combien ça coûte`, `merci beaucoup` |
| `current_behavior` | miss |
| `proposed_review_action` | Confirm phrase misses remain dictionary-index misses; any improvement is product guidance (for example “try one word”), not source phrase aliases or sentence translation |
| `expected_behavior_if_approved` | Phrase examples continue to miss in the dictionary index; optional future UI/product guidance only |
| `expected_ir_ids` | `[]` |
| `expected_target_forms` | `[]` |
| `evidence_available` | Featured phrase misses; G2 phrase boundary approval; usability `phrase_mismatch` rows; H0 product/search UX deferral |
| `risk_rating` | `medium` |
| `owner_review_required` | `true` (owner/product review) |
| `owner_review_question` | Should phrase misses continue to remain misses in the dictionary index, with any improvement handled as product guidance such as “try one word,” rather than source phrase aliases or sentence translation? |
| `implementation_artifact_if_approved` | product/search UX ticket or future UI guidance report only; no linguistic table row |
| `negative_boundary_assertions` | No `source_phrase_aliases`; no free sentence translation; no phrase-to-lemma auto-mapping in 7N2C |
| `blocked_dependencies` | Product/UX design decision if guidance copy/UI is desired later; linguistic implementation remains forbidden in this packet |
| `rationale` | Preserves the lemma-only dictionary contract while still capturing the phrase expectation mismatch as an explicit review unit |

## 5. Owner-review / product-review questions

1. **Son / `prix`:** Confirm whether the featured Maninka starter form for French `prix` should remain `Son` exactly, be corrected with tone/diacritics, or be annotated as provisional. (Outcomes: `confirm_as_is` / `correct_orthography` / `keep_provisional_note` / `defer_change`.)
2. **`fièvre`:** What is the correct Maninka translation or translations for standalone French `fièvre`? (Do not infer from fever-tree compounds.)
3. **`poulet`:** What is the correct Maninka translation or translations for standalone French `poulet`? (Do not infer from multiword food phrases unless explicitly approved.)
4. **Phrase guidance:** Should phrase misses continue to remain misses in the dictionary index, with any improvement handled as product guidance such as “try one word,” rather than source phrase aliases or sentence translation?

## 6. Explicit exclusions and deferrals

| Area | Status | Why |
| --- | --- | --- |
| `bonjour` / greetings | deferred to separate greeting packet | Pragmatic greeting behavior ≠ simple lemma alias; H0 kept it out of 7N2C |
| Catalog featured/status schema | deferred to dedicated catalog hardening track | Runtime/catalog migration risk; no immediate lemma value |
| Storage/import observation | monitor only | Passive post-promotion ops watch |
| Broad commerce/health/food expansion | deferred | Keep packet small and Son-led |
| Phrase aliases | forbidden in this packet | No `source_phrase_aliases`, free sentence translation, or phrase-to-lemma auto-mapping in 7N2C |

## 7. Implementation forecast if later approved

| Candidate | If later approved after H2 | Artifact(s) |
| --- | --- | --- |
| `7n2c_cand_0001_son_orthography_confirmation` | Only if H2 chooses correction or annotation change | `data/ir/siralex_owner_lexical_v1.jsonl` (+ supplement note only if required) |
| `7n2c_cand_0002_fievre_owner_lexical` | Only after owner supplies standalone targets | owner lexical IR (+ supplement if source searchability requires it) |
| `7n2c_cand_0003_poulet_owner_lexical` | Only after owner supplies standalone targets | owner lexical IR (+ supplement if source searchability requires it) |
| `7n2c_cand_0004_phrase_guidance_boundary` | Product/UX only | product/search UX ticket or future UI guidance report; **no** linguistic table row |

No artifact writes in H1.

## 8. Risk register

| Risk | Rating | Mitigation |
| --- | --- | --- |
| Changing featured `Son` without owner confirmation | medium | H1 drafts review outcomes only; no IR/bundle edit until H2 |
| Shipping `fièvre` by fever-tree inference | medium | Explicit negative boundary; no target IDs until owner approval |
| Shipping `poulet` from dish/compound strings | medium | Explicit negative boundary; standalone targets required |
| Phrase aliases sneaking into the linguistic packet | medium | Unit 4 is negative/product-only; phrase aliases forbidden |
| Greeting packet treated as part of 7N2C | medium/high | `bonjour` explicitly deferred |
| Catalog schema work diverting from dictionary confirmation | medium/high | Deferred to dedicated hardening track |

## 9. Decision

```text
7N2C_CANDIDATE_TABLE_READY_FOR_OWNER_REVIEW
```

```text
RECOMMENDED_7N2C_H1_TABLE:
7N2C — Post-7N2B owner lexical confirmation packet (Son-led)

SIZE:
4 candidate units

RATIONALE:
Confirm the already-featured provisional Son form for prix, then draft only
bounded deferred everyday lemmas and a phrase product-guidance boundary —
excluding greetings, phrase aliases, and catalog schema work.

BLOCKERS:
none for owner-review drafting;
fièvre / poulet implementation blocked until owner targets;
Son form change blocked until H2 confirmation;
phrase improvement limited to future product/UX guidance
```

## 10. Next slice definition

**Phase 7N2C4H2 — Owner Review and Approval Record**

Purpose: record owner approval, correction, rejection, or deferral for each
7N2C candidate unit before any source/runtime implementation.

## 11. Confirmation: no runtime / catalog / bundle / source / matrix / package changes

H1 created only this report. No edits to:

- `web/.env.production`
- `web/public/catalog.json`
- any `web/public/bundle_*` (including `bundle_full_20260710_337619ff`)
- `web/src/`
- `shared/aliases/`
- `shared/source_index_supplements/`
- `shared/target_variants/`
- `shared/search_regression/`
- `data/` (including `data/ir/siralex_owner_lexical_v1.jsonl`)
- `api/`
- `artifacts/review/`
- packages / release documents
