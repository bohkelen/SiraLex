# Phase 7N2C4H0 — Define Next Post-7N2B Follow-Up

## Decision

```text
NEXT_POST_7N2B_FOLLOWUP_DEFINED_READY_FOR_OWNER_REVIEW
```

Planning only. No source data, aliases, supplements, owner lexical rows,
matrices, catalog, runtime, tests, bundles, or packages were changed.

## 1. Current stable baseline

| Field | Value |
| --- | --- |
| Featured / default | `bundle_full_20260710_337619ff` |
| Mechanism | `web/.env.production` → `VITE_FEATURED_BUNDLE_ID=bundle_full_20260710_337619ff` |
| Closure decision | `PHASE_7N2B_PROMOTION_CLOSED_STABLE` (G13) |
| Post-promotion monitoring | `7N2B_POST_PROMOTION_STABLE` (G12) |
| Shipped 7N2B deltas | `moto` → `pópo`; `prix` → starter `Son` |
| Fallbacks | 7N2A `bundle_full_20260708_27643bb0`; 7J `bundle_full_20260616_phase7j_alias_round2_candidate` |

## 2. Evidence inspected

| Path | Role |
| --- | --- |
| `docs/reports/phase7n2b4g13_promotion_closure_report.md` | Closure + follow-up menu |
| `docs/reports/phase7n2b4g12_post_promotion_runtime_monitoring_report.md` | Residual risks after featured promotion |
| `docs/reports/phase7n2b4g10_featured_promotion_readiness_report.md` | Promotion readiness / Son starter note |
| `docs/reports/phase7n2b4g2_owner_review_approval_record.md` | Son starter approved; `fièvre` deferred pending targets; phrase/papa boundaries |
| `docs/reports/phase7n2b4g1_candidate_table_report.md` | Original 7N2B candidate units |
| `docs/reports/phase7n2a4g0_next_linguistic_expansion_tranche_report.md` | Deferred `poulet` / `bonjour` / phrase policy |
| `data/local_evidence/human_usage_automation/` | Present; usability JSONL still shows `prix`, `fièvre`, `poulet`, `bonjour`, phrase rows as historical demand signals |
| `shared/aliases/source_aliases_v1.jsonl` | Present (24 rows; includes 7N2B moto alias) |
| `shared/source_index_supplements/source_index_supplements_v1.jsonl` | Present (8 rows; includes prix supplement) |
| `shared/target_variants/reviewed_target_variants_v1.jsonl` | Present (1 row) |
| `data/ir/siralex_owner_lexical_v1.jsonl` | Present (3 owner lexical rows, including Son) |
| `web/public/catalog.json` | Featured 7N2B + 7N2A/7J fallbacks unchanged |

No evidence gap blocked choosing a next planning track. Local automation evidence remains available under `data/local_evidence/human_usage_automation/`.

## 3. Candidate follow-up evaluation table

| candidate_id | candidate_area | track_type | user_visible_value | evidence_available | owner_review_required | implementation_complexity | risk_rating | recommended_status | reason |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A | Son orthography/tone review for `prix` | `linguistic_owner_review` | High — already featured; wrong orthography would ship as default | Strong (G2 notes; owner IR `Son`; featured smoke) | Yes | Low (confirm/correct existing row) | medium | **recommend_next** | Explicit provisional starter already live; safest first post-7N2B linguistic action |
| B | `fièvre` owner lexical review | `linguistic_owner_review` | High everyday health miss | Strong miss evidence; **no** approved targets yet | Yes | Medium | medium | defer | Companion draft candidate for H1; blocked for implementation until owner supplies targets (no fever-tree inference) |
| C | `bonjour` / greeting packet | `linguistic_owner_review` | High greeting miss | Historical miss; 7N2A audit deferred greetings | Yes | Medium/high | medium/high | defer | Pragmatic greeting behavior ≠ simple lemma alias; needs separate packet |
| D | `poulet` everyday lemma review | `linguistic_owner_review` | Medium everyday food miss | Usability miss; no exact durable lemma | Yes | Medium | medium | defer | Companion draft candidate for H1; no multiword food-phrase inference |
| E | Phrase UX / “try one word” | `product_search_ux` | Medium — reduces confusion on phrase misses | Phrase-boundary already enforced as miss | Product/UX review | Medium | medium | defer | Keep as product track; no `source_phrase_aliases` / free translation in next linguistic packet |
| F | Catalog featured/status schema | `catalog_schema_hardening` | Low immediate dictionary value | Residual env/sort risk documented | Engineering review | High | medium/high | defer | Touches runtime/catalog conventions; not the next linguistic follow-up |
| G | Storage/import observation | `post_promotion_observation` | Low immediate lemma value | Residual G12 risk only | No | Low | low | monitor_only | Passive; does not improve dictionary content by itself |

Exactly one `recommend_next`: **A**.

## 4. Recommended next follow-up

```text
RECOMMENDED_NEXT_FOLLOWUP:
7N2C — Post-7N2B owner lexical confirmation packet (Son-led)

TRACK_TYPE:
linguistic_owner_review

SIZE:
4 planned behavior units

RATIONALE:
7N2B shipped with an owner-approved but orthographically provisional featured
target (Son) and still-deferred everyday misses (fièvre, poulet). The safest next
work is a small owner-review packet that confirms/corrects Son first and drafts
only bounded deferred lemmas — not greetings, phrase aliases, or catalog schema.

BLOCKERS:
none for planning/H1 drafting;
implementation of fièvre/poulet remains blocked until owner supplies targets
```

## 5. Proposed scope (H1 draft only — not implemented)

Keep the next tranche ≤ 3–5 behavior units:

| # | Unit | Intent |
| --- | --- | --- |
| 1 | Son orthography/tone review | Confirm, correct, or annotate the featured `prix` → `Son` starter already shipped |
| 2 | `fièvre` | Owner lexical candidate; targets TBD; **do not** infer from `arbre à fièvre` |
| 3 | `poulet` | Owner lexical candidate; targets TBD; **do not** infer from multiword food phrases |
| 4 | Phrase lemma boundary (negative/product only) | Preserve phrase misses; no phrase aliases; may note “try one word” as product guidance only |

`bonjour` stays out of this packet (separate greeting track). Catalog schema and
storage observation stay out of linguistic implementation.

## 6. Explicit deferrals

| Area | Status | Why |
| --- | --- | --- |
| `bonjour` / greetings | defer | Pragmatic/high-risk; needs own owner packet |
| Phrase aliases / sentence translation | defer | Separate product/search-policy track |
| Catalog `featured` / `status` / `promotion_stage` schema | defer | Runtime/catalog migration risk; no lemma value |
| Storage/import observation | monitor_only | Passive ops watch after real use |
| Broad new commerce/health expansions beyond scoped units | defer | Keep tranche small after promotion |

## 7. Risk register

| Risk | Rating | Mitigation |
| --- | --- | --- |
| Changing featured `Son` orthography without owner confirmation | medium | H1 drafts review questions only; no IR edit until owner decision |
| Shipping `fièvre`/`poulet` by compound inference | medium | Explicit negative boundaries in H1 table |
| Greeting packet treated as simple alias | medium/high | Keep `bonjour` deferred |
| Phrase aliases sneaking into linguistic track | medium | Unit 4 remains negative/product-only |
| Catalog schema work diverting from dictionary value | medium/high | Defer until a dedicated hardening slice |

## 8. Decision

```text
NEXT_POST_7N2B_FOLLOWUP_DEFINED_READY_FOR_OWNER_REVIEW
```

```text
RECOMMENDED_NEXT_FOLLOWUP:
7N2C — Post-7N2B owner lexical confirmation packet (Son-led)

TRACK_TYPE:
linguistic_owner_review

SIZE:
4 planned behavior units

RATIONALE:
Confirm the already-featured provisional Son form, then draft only bounded
deferred everyday lemmas for owner targets — avoiding greetings, phrase aliases,
and catalog schema work.

BLOCKERS:
none for H1 drafting
```

## 9. Next slice definition

**Phase 7N2C4H1 — Draft Next Follow-Up Candidate Table**

Purpose: draft the owner-review/product-review candidate table for the selected
post-7N2B follow-up without changing runtime or source data.

## 10. Confirmation: no runtime / catalog / bundle / source / matrix / package changes

H0 created only this report. No edits to env, catalog, bundles, `web/src/`,
aliases, supplements, target variants, search regression matrices, `data/`,
`api/`, review artifacts, packages, or release documents.
