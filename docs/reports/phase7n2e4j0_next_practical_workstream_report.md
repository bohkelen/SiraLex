# Phase 7N2E4J0 — Choose Next Practical Workstream

## Decision

```text
NEXT_PRACTICAL_WORKSTREAM_DEFINED
```

Planning only. No runtime, catalog, bundles, source data, matrices, tests, or
packages were changed. Son / `fièvre` / `poulet` validation is not reopened.

## 1. Current baseline

| Field | Value |
| --- | --- |
| Featured / default | `bundle_full_20260710_337619ff` |
| 7N2B closure | `PHASE_7N2B_PROMOTION_CLOSED_STABLE` |
| 7N2C closure | `7N2C_BOUNDARY_DEFERRAL_CLOSED_NO_IMPLEMENTATION` |
| 7N2D closure | `7N2D_DEFERRED_NO_ACTIONABLE_VALIDATION_DATA` |
| Lexical validation | Unavailable for Son/`prix`, `fièvre`, `poulet` — do not reopen |
| Constraint | Prefer the smallest workstream that can move forward now without lexical data |

## 2. Evidence inspected

| Path | Role |
| --- | --- |
| `docs/reports/phase7n2d4i1_deferred_non_actionable_closure_report.md` | 7N2D closed; lexical validation unavailable |
| `docs/reports/phase7n2c4h3_boundary_deferral_closure_report.md` | Phrase product boundary recorded; no linguistic implementation |
| `docs/reports/phase7n2b4g13_promotion_closure_report.md` | Stable featured baseline; residual catalog/storage risks |
| `data/local_evidence/human_usage_automation/` | Present (corrected usability JSON/JSONL/MD + usage run folders) |
| Working tree untracked | `build/` (~137M); `web/public/bundle_full_20260518_15605571/` (~24M) |

## 3. Candidate workstream evaluation table

| workstream_id | practical_value | implementation_dependency | engineering_risk | user_visible_value | recommended_status | reason |
| --- | --- | --- | --- | --- | --- | --- |
| A — Phrase UX guidance | Medium — draft “try one word” / miss-guidance plan without aliases | Product/UX copy + optional later UI; no lexical tables | Medium if phrase aliases sneak in | Medium | `defer` | Boundary already approved in 7N2C; valuable, but larger than a local evidence triage that can run immediately |
| B — Catalog schema hardening | Medium — reduce env/sort featured ambiguity | Engineering planning then schema/runtime conventions | Medium/high | Low immediate dictionary value | `defer` | Residual G13 risk, but not the smallest forward step now |
| C — Storage/import observation | Low — passive post-promotion watch | Real-use observation only | Low | Low | `monitor_only` | Keep watching; does not itself define a forward work plan |
| D — Usage evidence review | High for planning — mine existing local evidence for non-lexical issues | Report/analysis only in the next plan slice | Low | Indirect (finds actionable UX/ops issues) | **recommend_next** | Smallest workstream that can move forward now with present evidence and zero lexical dependency |
| E — Repo cleanup | Medium hygiene — decide ignore/archive/remove for untracked `build/` + old public bundle | Policy decision + possible gitignore/cleanup | Low/medium if wrong paths removed | None for end users | `defer` | Real clutter exists, but product/search next-step discovery from usage evidence has higher practical planning value first |

Exactly one `recommend_next`: **D**.

## 4. Recommended workstream

```text
RECOMMENDED_NEXT_WORKSTREAM:
7N2E — Usage evidence review for actionable non-lexical issues

WORKSTREAM_TYPE:
usage_evidence_review

SCOPE_SHAPE:
Inspect local human-usage automation evidence for actionable issues that do not
require Son / fièvre / poulet validation (e.g. phrase-miss UX signals, offline/
setup notes, direction/retry confusion, non-lexical product friction).

EXPLICITLY_OUT_OF_SCOPE:
Son / prix orthography; fièvre / poulet lexical targets; validation workflows;
phrase aliases; catalog schema migration; bundle/runtime edits

RATIONALE:
Lexical tracks are blocked on unavailable owner validation data. Local usage
evidence is already present. A small evidence-review workstream can surface the
next practical non-lexical action without reopening deferred lemmas.

BLOCKERS:
none for J1 plan drafting
```

## 5. Explicit deferrals / blocked items

| Item | Status | Why |
| --- | --- | --- |
| Son / `prix` validation | `blocked` | No actionable validation data (7N2D); do not reopen |
| `fièvre` / `poulet` lexical work | `blocked` | No actionable validation data (7N2D); do not reopen |
| Phrase UX guidance | `defer` | Candidate after evidence triage confirms priority/copy needs |
| Catalog schema hardening | `defer` | Engineering planning later; larger than evidence review |
| Storage/import observation | `monitor_only` | Passive residual risk |
| Repo cleanup (`build/`, old public bundle) | `defer` | Hygiene candidate after evidence review unless it blocks work |

## 6. Risk register

| Risk | Rating | Mitigation |
| --- | --- | --- |
| Evidence review quietly becomes lexical reopening | medium | J1 plan must exclude Son/`fièvre`/`poulet` validation and target invention |
| Phrase aliases introduced under “UX guidance” | medium | Preserve 7N2C product boundary: misses stay misses; guidance only |
| Skipping catalog residual risk indefinitely | medium | Keep catalog hardening deferred but listed for a later practical pick |
| Aggressive cleanup deleting needed artifacts | medium | Keep repo cleanup deferred until an explicit policy plan |

## 7. Decision

```text
NEXT_PRACTICAL_WORKSTREAM_DEFINED
```

```text
RECOMMENDED_NEXT_WORKSTREAM:
7N2E — Usage evidence review for actionable non-lexical issues

WORKSTREAM_TYPE:
usage_evidence_review

RATIONALE:
Smallest forward path after lexical validation became unavailable: review
existing local usage evidence for non-lexical actionable issues only.

BLOCKERS:
none for J1 drafting
```

## 8. Next slice definition

**Phase 7N2E4J1 — Draft Selected Workstream Plan**

Purpose: draft the concrete usage-evidence review plan (sources to inspect,
non-lexical issue classes, exclusion of deferred lemmas, and expected
report-only outputs) without changing runtime or source data.

## 9. Confirmation: no runtime / catalog / bundle / source / matrix / package changes

J0 created only this report. No edits to env, catalog, bundles, `web/src/`,
aliases, supplements, matrices, `data/`, `api/`, review artifacts, packages, or
release documents.
