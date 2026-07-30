# Phase 7N2D4I0 — Define Next Actionable Follow-Up

## Decision

```text
NEXT_ACTIONABLE_FOLLOWUP_DEFINED
```

Planning only. No runtime, catalog, source data, matrices, bundles, tests,
packages, or review artifacts were changed.

## 1. Current baseline

| Field | Value |
| --- | --- |
| Featured / default | `bundle_full_20260710_337619ff` |
| Closure (7N2B) | `PHASE_7N2B_PROMOTION_CLOSED_STABLE` |
| Post-promotion monitoring | `7N2B_POST_PROMOTION_STABLE` |
| 7N2C closure | `7N2C_BOUNDARY_DEFERRAL_CLOSED_NO_IMPLEMENTATION` |
| 7N2C H2 outcome | `7N2C_OWNER_REVIEW_BLOCKED_NO_APPROVED_UNITS` |
| Shipped 7N2B deltas (unchanged) | `moto` → `pópo`; `prix` → provisional starter `Son` |
| 7N2C linguistic implementation | none |
| Fallbacks | 7N2A `bundle_full_20260708_27643bb0`; 7J `bundle_full_20260616_phase7j_alias_round2_candidate` |

Preserved featured misses / boundaries after 7N2C: `fièvre` miss; `poulet` miss;
phrase examples miss; no phrase aliases; Son orthography still provisional and
deferred.

## 2. Evidence inspected

| Path | Role |
| --- | --- |
| `docs/reports/phase7n2c4h3_boundary_deferral_closure_report.md` | 7N2C closed no-implementation; I0 menu |
| `docs/reports/phase7n2c4h2_owner_review_approval_record.md` | Son/`fièvre`/`poulet` deferred; phrase product boundary approved |
| `docs/reports/phase7n2c4h1_candidate_table_report.md` | Four-unit Son-led packet that produced no implementable scope |
| `docs/reports/phase7n2b4g13_promotion_closure_report.md` | Stable featured baseline + residual follow-up areas |
| `docs/reports/phase7n2b4g12_post_promotion_runtime_monitoring_report.md` | Residual catalog/env/Son/storage risks |
| `data/local_evidence/human_usage_automation/` | Present; historical miss signals for `fièvre`, `poulet`, `bonjour`, phrases |

Local automation evidence is available. No evidence gap blocked choosing a next
planning track.

## 3. Candidate track evaluation table

| track_id | track_type | user_visible_value | evidence_available | implementation_readiness | owner_dependency | engineering_risk | recommended_status | reason |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A | `owner_target_intake` | High — unblocks everyday health/food misses (`fièvre`, `poulet`) | Strong featured misses + usability demand; fever-tree/food-compound negatives already documented | Ready for **intake/owner-review packet only** (not lexical implementation) | High — needs standalone Maninka targets + gloss/boundary | Low for intake drafting; medium if later implementation infers compounds | **recommend_next** | Direct unblocker after 7N2C failed to implement for lack of owner targets |
| B | `linguistic_owner_review` | High — featured `prix` → provisional `Son` | Strong (featured live; H2 `defer_change`) | Not ready — no corrected form supplied | High — needs corrected orthography/tone decision | Medium if wrong form ships | `blocked_until_owner_input` | Explicitly deferred in H2; remain later follow-up until form is supplied |
| C | `product_search_ux` | Medium — clearer phrase-miss guidance | Phrase misses + H2 `approved_product_boundary` | Ready for product-guidance planning only | Product/UX review | Medium if aliases sneak in | `defer` | Boundary already recorded; UX copy/UI is valuable but not the highest unblock after 7N2C |
| D | `linguistic_owner_review` | High greeting miss | Historical usability miss; prior audits deferred greetings | Needs dedicated greeting packet design | High — pragmatic greeting ≠ simple lemma | Medium/high | `defer` | Still needs a separate greeting packet; not the next post-7N2C unblock |
| E | `catalog_schema_hardening` | Low immediate dictionary value | G12/G13 residual env/sort/featured-metadata risks | Ready for **engineering planning only** (no migration yet) | Engineering review | Medium/high once schema migrates | `defer` | Important residual ops risk, but not the next dictionary-value unblock |
| F | `post_promotion_observation` | Low immediate lemma value | G12 residual storage/import watch item | Passive observation only | None | Low | `monitor_only` | Does not improve content by itself; keep watching after real use |

Track labels for the rows above:

| track_id | Name |
| --- | --- |
| A | Owner-target collection for `fièvre` / `poulet` |
| B | Son orthography follow-up (still deferred) |
| C | Phrase UX guidance (no phrase aliases) |
| D | `bonjour` / greeting packet |
| E | Catalog schema hardening for explicit featured/status metadata |
| F | Post-promotion storage/import observation |

Exactly one `recommend_next`: **A**.

## 4. Recommended next track

```text
RECOMMENDED_NEXT_TRACK:
7N2D — Owner-target intake packet for fièvre / poulet

TRACK_TYPE:
owner_target_intake

SIZE:
2 intake units (fièvre; poulet) + preserved negative boundaries

RATIONALE:
7N2C closed with no implementation because standalone Maninka targets were not
supplied. The highest-value actionable next work is a small owner-review/intake
packet that collects approved standalone targets and gloss/boundaries for
fièvre and poulet — without implementing lexical rows, inferring compounds, or
opening greetings / phrase aliases / catalog migration.

BLOCKERS:
none for I1 track-plan drafting;
lexical implementation remains blocked until intake yields owner-approved
standalone targets
```

Scope shape for the next plan slice (I1 draft only — not implementation):

| # | Unit | Intent |
| --- | --- | --- |
| 1 | `fièvre` intake | Collect standalone Maninka target(s) + gloss + meaning boundary; **do not** infer from `arbre à fièvre` |
| 2 | `poulet` intake | Collect standalone Maninka target(s) + gloss + meaning boundary; **do not** infer from food phrases/compounds |
| — | Negative boundaries | No lexical IR/supplement writes in the intake track; no fever-tree or dish-name inference |

## 5. Explicit deferrals

| Track | Status | Why |
| --- | --- | --- |
| Son orthography follow-up | `blocked_until_owner_input` | H2 `defer_change`; no corrected form yet |
| Phrase UX guidance | `defer` | Product boundary already approved; UX guidance can follow later without aliases |
| `bonjour` / greeting packet | `defer` | Needs separate pragmatic greeting design |
| Catalog featured/status schema | `defer` | Engineering planning later; no schema migration in next track |
| Storage/import observation | `monitor_only` | Passive post-promotion watch |

## 6. Risk register

| Risk | Rating | Mitigation |
| --- | --- | --- |
| Treating intake as immediate lexical implementation | medium | I1 plans intake/review only; no IR/supplement writes until a later approved implementation slice |
| Inferring `fièvre` from fever-tree compounds | medium | Explicit negative boundary carried from 7N2B/7N2C |
| Inferring `poulet` from dish/compound strings | medium | Explicit negative boundary; standalone targets only |
| Expanding into `bonjour` or phrase aliases inside 7N2D | medium/high | Keep those deferred; phrase aliases forbidden |
| Diverting into catalog schema migration | medium/high | Defer schema work to a dedicated engineering track |
| Reopening Son orthography without a supplied form | medium | Keep Son `blocked_until_owner_input` |

## 7. Decision

```text
NEXT_ACTIONABLE_FOLLOWUP_DEFINED
```

```text
RECOMMENDED_NEXT_TRACK:
7N2D — Owner-target intake packet for fièvre / poulet

TRACK_TYPE:
owner_target_intake

SIZE:
2 intake units (fièvre; poulet) + preserved negative boundaries

RATIONALE:
Collect the missing standalone owner targets that blocked 7N2C implementation,
as an intake/owner-review track only — not lexical implementation, greetings,
phrase aliases, or catalog migration.

BLOCKERS:
none for I1 drafting
```

## 8. Next slice definition

**Phase 7N2D4I1 — Draft Next Actionable Track Plan**

Purpose: draft the concrete owner-target intake plan for standalone `fièvre`
and `poulet` (questions, required fields, negative boundaries, and
non-implementation constraints) without changing runtime or source data.

## 9. Confirmation: no runtime / catalog / bundle / source / matrix / package changes

I0 created only this report. No edits to env, catalog, bundles, `web/src/`,
aliases, supplements, target variants, search regression matrices, `data/`,
`api/`, review artifacts, packages, or release documents.
