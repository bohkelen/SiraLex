# Phase 7N2H4M0 — Choose Next Practical Workstream

## Decision

```text
NEXT_PRACTICAL_WORKSTREAM_DEFINED
```

Planning only. No runtime, catalog, bundles, source data, matrices, tests,
packages, or review artifacts were changed. Son / `prix`, `fièvre`, and `poulet`
were not reopened. No validation workflows were created. Closed phrase-guidance,
repo-cleanup, and harness-settle scopes were not expanded.

## 1. Current baseline

| Field | Value |
| --- | --- |
| Featured / default | `bundle_full_20260710_337619ff` |
| 7N2B closure | `PHASE_7N2B_PROMOTION_CLOSED_STABLE` |
| 7N2D lexical intake | `7N2D_DEFERRED_NO_ACTIONABLE_VALIDATION_DATA` |
| 7N2E phrase guidance | `MINIMAL_PHRASE_GUIDANCE_WORKSTREAM_CLOSED` |
| 7N2F repo cleanup | `REPO_CLEANUP_WORKSTREAM_CLOSED` |
| 7N2G harness settle | `HARNESS_SETTLE_FIX_WORKSTREAM_CLOSED` |
| Constraint | Prefer the smallest workstream that can actually move forward now |
| Usage harness default | Debug bundle (`test_directional_bundle`) — often all-miss; featured 7N2B already on disk |

## 2. Evidence inspected

| Path | Role |
| --- | --- |
| `docs/reports/phase7n2g4l6_harness_settle_fix_closure_report.md` | Harness settle closed; debug-bundle all-miss residual noted |
| `docs/reports/phase7n2f4k4_repo_cleanup_closure_report.md` | Tracked-bundle cleanup still deferred |
| `docs/reports/phase7n2e4j5_phrase_guidance_closure_report.md` | Phrase guidance closed; English copy still deferred |
| `docs/reports/phase7n2d4i1_deferred_non_actionable_closure_report.md` | Lexical validation still unavailable |
| `docs/reports/phase7n2b4g13_promotion_closure_report.md` | Residual catalog/env/storage risks |

## 3. Candidate workstream evaluation table

| workstream_id | value | dependency | risk | recommended_status | reason |
| --- | --- | --- | --- | --- | --- |
| A — Catalog schema hardening | Medium — explicit featured/status metadata reduces env/sort ambiguity | Engineering planning then schema/runtime conventions | Medium/high | `defer` | Important G13 residual, but larger than a small harness evidence-path upgrade |
| B — Storage/import observation | Low — passive post-promotion watch | Real-use observation | Low | `monitor_only` | Keep watching; does not define a forward plan slice by itself |
| C — English/mixed-language copy | Low/medium — clarify dictionary ≠ sentence translation | Product copy only | Medium if scoped as language expansion | `defer` | Round-2 already deferred this after shipped phrase guidance; weaker than improving evidence coverage |
| D — Full-bundle usage harness | Medium for planning quality — run usage harness against featured 7N2B (hits + real misses) | Existing `SIRALEX_USAGE_BUNDLE_DIR` / package env already documented; featured bundle present | Low/medium (longer install/runtime) | **recommend_next** | Smallest forward path after harness settle closure; directly addresses L5/L6 residual that default debug runs are all-miss |
| E — Tracked bundle cleanup | Medium hygiene — assess older tracked `web/public/bundle_full_*` retention | Retention policy + careful deletion discipline | Medium/high if deleted wrongly | `defer` | Higher risk than a harness evidence-mode plan |
| F — Lexical validation | High if data existed — Son/`prix`, `fièvre`, `poulet` | External owner validation data | High if invented | `blocked` | Still no actionable validation data; do not reopen |

Exactly one `recommend_next`: **D**.

## 4. Recommended workstream

```text
RECOMMENDED_NEXT_WORKSTREAM:
7N2H — Full-bundle usage harness against featured 7N2B

WORKSTREAM_TYPE:
usage_harness_evidence_mode

SCOPE_SHAPE:
Plan (then later run/document) usage automation against featured
bundle_full_20260710_337619ff via existing SIRALEX_USAGE_BUNDLE_DIR (or package)
so evidence includes real hits/misses — without changing product search behavior
or making the slow full-bundle path the only default.

EXPLICITLY_OUT_OF_SCOPE:
Son / prix / fièvre / poulet validation; phrase-guidance expansion; catalog
schema migration; tracked-bundle deletion; replacing debug-bundle fast path
without an explicit opt-in

RATIONALE:
Harness settle is closed, but default usage e2e still uses the small debug
bundle and cannot exercise hit settle / featured miss behavior. The smallest
practical next step is a bounded full-bundle evidence-mode plan using the
already-present featured 7N2B directory.

BLOCKERS:
none for M1 plan drafting;
full-bundle runs may need higher install/query timeouts
```

## 5. Explicit deferrals / blocked items

| Item | Status | Why |
| --- | --- | --- |
| Catalog schema hardening | `defer` | Larger engineering track |
| Storage/import observation | `monitor_only` | Passive residual risk |
| English/mixed-language copy | `defer` | Deferred in round 2 after phrase guidance shipped |
| Tracked bundle cleanup | `defer` | Higher-risk retention/deletion track |
| Son/`prix`, `fièvre`, `poulet` | `blocked` | No external validation data |

## 6. Risk register

| Risk | Rating | Mitigation |
| --- | --- | --- |
| Full-bundle runs become the only default and slow local iteration | medium | Keep debug bundle as fast default; full-bundle as opt-in documented mode |
| Treating full-bundle scripted rows as demand | medium | Preserve `can_influence_demand: false` / structured usability boundary |
| Using full-bundle mode to reopen lexical work | medium | Keep Son/`fièvre`/`poulet` blocked |
| Catalog schema left unaddressed | medium | Remain deferred but listed |

## 7. Decision

```text
NEXT_PRACTICAL_WORKSTREAM_DEFINED
```

```text
RECOMMENDED_NEXT_WORKSTREAM:
7N2H — Full-bundle usage harness against featured 7N2B

WORKSTREAM_TYPE:
usage_harness_evidence_mode

RATIONALE:
Smallest forward path after harness settle closure: plan an opt-in full-bundle
usage evidence mode against featured 7N2B so hits and real misses are observable.

BLOCKERS:
none for M1 drafting
```

## 8. Next slice definition

**Phase 7N2H4M1 — Draft Selected Workstream Plan**

Purpose: draft the concrete full-bundle usage-harness plan (env flags, timeout
expectations, keep debug default, expected evidence differences vs debug runs)
without changing product runtime or catalog behavior.

## 9. Confirmation: no runtime / catalog / bundle / source / matrix / package changes

M0 created only this report. No edits to env, catalog, bundles, `web/src/`,
aliases, supplements, matrices, `data/`, `api/`, review artifacts, packages, or
release documents.
