# Phase 7N2I4N0 — Choose Next Practical Workstream

## Decision

```text
NEXT_PRACTICAL_WORKSTREAM_DEFINED
```

Planning only. No runtime, catalog, bundles, source data, matrices, tests,
packages, or review artifacts were changed. Son/`prix`, `fièvre`, and `poulet`
were not reopened. Usage evidence is not treated as lexical validation or
demand evidence. No validation workflows were created.

## 1. Current baseline

| Field | Value |
| --- | --- |
| Featured / default | `bundle_full_20260710_337619ff` |
| 7N2B closure | `PHASE_7N2B_PROMOTION_CLOSED_STABLE` |
| 7N2D lexical intake | `7N2D_DEFERRED_NO_ACTIONABLE_VALIDATION_DATA` |
| 7N2E phrase guidance | `MINIMAL_PHRASE_GUIDANCE_WORKSTREAM_CLOSED` |
| 7N2F repo cleanup | `REPO_CLEANUP_WORKSTREAM_CLOSED` |
| 7N2G harness settle | `HARNESS_SETTLE_FIX_WORKSTREAM_CLOSED` |
| 7N2H featured usage harness | `FEATURED_USAGE_HARNESS_WORKSTREAM_CLOSED` |
| Constraint | Prefer the smallest workstream that can move forward now |
| New capability | Opt-in `test:e2e:usage:featured` against featured 7N2B; local evidence dirs exist under `data/local_evidence/human_usage_automation/usage_*` |

## 2. Evidence inspected

| Path | Role |
| --- | --- |
| `docs/reports/phase7n2h4m4_featured_usage_harness_closure_report.md` | Featured harness mode closed; residual: inspect usability output, not lexical claims |
| `docs/reports/phase7n2g4l6_harness_settle_fix_closure_report.md` | Settle closed; English copy / lexical still deferred/blocked |
| `docs/reports/phase7n2f4k4_repo_cleanup_closure_report.md` | Tracked-bundle cleanup still deferred |
| `docs/reports/phase7n2e4j5_phrase_guidance_closure_report.md` | Phrase guidance closed; English/mixed copy still deferred |
| `docs/reports/phase7n2d4i1_deferred_non_actionable_closure_report.md` | Lexical validation still unavailable |
| `docs/reports/phase7n2b4g13_promotion_closure_report.md` | Catalog schema + storage/import residuals |

## 3. Candidate workstream evaluation table

| workstream_id | value | dependency | risk | recommended_status | reason |
| --- | --- | --- | --- | --- | --- |
| 1 — Catalog schema hardening | Medium — explicit featured/status metadata reduces env/sort ambiguity | Engineering planning then schema/runtime conventions | Medium/high | `defer` | Important G13 residual, but larger than reviewing newly available featured harness output |
| 2 — Storage/import observation | Low/medium — featured runs already show ~7–8 min full import | Local featured harness timings + storage notes | Low | `monitor_only` | Useful residual watch; does not by itself define the smallest product-forward review slice |
| 3 — English/mixed-language copy | Low/medium — clarify dictionary ≠ sentence translation | Product copy only | Medium if scoped as language expansion | `defer` | Deferred after phrase guidance; weaker than reviewing featured-bundle evidence first |
| 4 — Tracked bundle cleanup | Medium hygiene — assess older tracked `web/public/bundle_full_*` retention | Retention policy + careful deletion discipline | Medium/high if deleted wrongly | `defer` | Higher risk than a report-only evidence review |
| 5 — Featured usage evidence review | Medium for planning quality — inspect new featured-bundle harness output for non-lexical issues | Existing local `usage_*` evidence from featured runs; structured-usability boundary | Low if review stays non-lexical / non-demand | **recommend_next** | Smallest forward path after 7N2H: use the new featured evidence without changing product code |
| 6 — Lexical validation | High if data existed — Son/`prix`, `fièvre`, `poulet` | External owner validation data | High if invented | `blocked` | Still no actionable validation data; do not reopen |

Exactly one `recommend_next`: **5**.

## 4. Recommended workstream

```text
RECOMMENDED_NEXT_WORKSTREAM:
7N2I — Featured usage evidence review (non-lexical)

WORKSTREAM_TYPE:
structured_usability_evidence_review

SCOPE_SHAPE:
Review recent featured-bundle harness output under
data/local_evidence/human_usage_automation/ for product/usability issues
(copy, empty-state, offline, direction, settle/UX friction) — without treating
rows as demand evidence or lexical authority, and without reopening Son/prix,
fièvre, or poulet.

EXPLICITLY_OUT_OF_SCOPE:
Lexical validation; catalog schema migration; tracked-bundle deletion;
changing product runtime from this review alone; inventing demand claims

RATIONALE:
7N2H closed the opt-in featured harness mode and produced featured 7N2B
evidence. The smallest practical next step is a bounded review of that output
for non-lexical issues, mirroring the earlier usage-evidence → product path
without reopening blocked lexical work.

BLOCKERS:
none for N1 plan drafting
```

## 5. Explicit deferrals / blocked items

| Item | Status | Why |
| --- | --- | --- |
| Catalog schema hardening | `defer` | Larger engineering track |
| Storage/import observation | `monitor_only` | Passive residual; timings already noted in 7N2H |
| English/mixed-language copy | `defer` | Deferred after phrase guidance; may re-enter if evidence review selects it |
| Tracked bundle cleanup | `defer` | Higher-risk retention/deletion track |
| Son/`prix`, `fièvre`, `poulet` | `blocked` | No external validation data |

## 6. Risk register

| Risk | Rating | Mitigation |
| --- | --- | --- |
| Treating featured harness rows as demand or lexical validation | medium | Keep `can_influence_demand: false` / structured-usability boundary explicit in N1+ |
| Review expands into sentence-translation or language-pack work | medium | Bound review to non-lexical product/usability issues only |
| Catalog schema left unaddressed | medium | Remain deferred but listed |
| Accidental reopen of Son/`fièvre`/`poulet` via miss rows | medium | Keep lexical track blocked |

## 7. Decision

```text
NEXT_PRACTICAL_WORKSTREAM_DEFINED
```

```text
RECOMMENDED_NEXT_WORKSTREAM:
7N2I — Featured usage evidence review (non-lexical)

WORKSTREAM_TYPE:
structured_usability_evidence_review

RATIONALE:
Smallest forward path after featured-harness closure: review new featured-bundle
usage evidence for non-lexical product/usability issues only.

BLOCKERS:
none for N1 drafting
```

## 8. Next slice

**Phase 7N2I4N1 — Draft Selected Workstream Plan**

Purpose: draft the smallest review plan for featured-bundle usage evidence
(non-lexical), including inputs, selection criteria, and explicit out-of-scope
boundaries.

## 9. Confirmation: no runtime / catalog / bundle / source / matrix / package changes

N0 created only this report. No runtime, catalog, bundles, source data,
matrices, tests, packages, or review artifacts were edited.
