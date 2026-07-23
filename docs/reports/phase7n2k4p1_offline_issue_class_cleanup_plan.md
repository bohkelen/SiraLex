# Phase 7N2K4P1 — Draft Offline Issue-Class Cleanup Plan

## Decision

```text
OFFLINE_ISSUE_CLASS_CLEANUP_PLAN_READY
```

Planning only. No code was implemented. No product runtime, catalog, bundles,
source data, matrices, packages, or search behavior were changed. Son/`prix`,
`fièvre`, and `poulet` were not reopened. Later implementation stays limited to
harness evidence labeling.

## 1. Problem

Successful offline/reopen searches are still labeled as setup failures:

| Field | Observed on successful offline hits |
| --- | --- |
| `issue_class` | `setup_ux` |
| `candidate_intervention_category` | `offline_install_reliability` |
| Actual status | `hit_single` or `hit_multi` with normal result meta |

Reviewers can misread working offline reopen as install/setup failure
(`7n2j_o2_offline_issue_class_noise`).

## 2. Where labels are derived

| Location | Role |
| --- | --- |
| `web/e2e/human_usage/personas.ts` | Every `layer: "offline_check"` task sets `expectedIssueClass: "setup_ux"` and `candidateInterventionCategory: "offline_install_reliability"` |
| `web/e2e/human_usage/usage_harness.spec.ts` | Sets `offlineReopenChecked` when `task.layer === "offline_check"`; calls `createUsageEvidenceRow` |
| `web/e2e/human_usage/evidence_writer.ts` → `createUsageEvidenceRow` | Calls `deriveIssueClass(status, task.expectedIssueClass)` |
| `evidence_writer.ts` → `deriveIssueClass` | Special-cases only `pending_human_review` hits/misses and `blocked`/`error` → `setup_ux`; **otherwise returns `expected` unchanged** |
| Intervention mapping | `candidate_intervention_category` becomes `"none"` only when `issue_class === "no_issue_observed"`; else persona category is kept |

Root cause: offline personas always expect `setup_ux`, and `deriveIssueClass` does
not clear that expectation when the observed result is a normal hit.

## 3. Planned minimal fix (P2 — not implemented here)

Prefer a **single rule in `deriveIssueClass`** (or an equivalent call-site pass of
status + expected). Do **not** rewrite all offline persona task definitions unless
required.

### Trigger → `no_issue_observed`

All of:

1. `expectedIssueClass === "setup_ux"` (offline_check tasks today), and
2. observed status is `hit_single` **or** `hit_multi`, and
3. search completed normally (harness already recorded a hit status + result meta).

Effect:

- `issue_class` → `no_issue_observed`
- `candidate_intervention_category` → `none` (existing mapping)

Optional safety (if needed in P2): also require `task.layer === "offline_check"`
or `offlineReopenChecked === true`. Not required if `setup_ux` expected remains
offline-only (current personas).

### Non-triggers — keep `setup_ux` (or existing failure path)

| Case | Keep as |
| --- | --- |
| `status === "error"` | `setup_ux` (already forced) |
| `status === "blocked"` | `setup_ux` (already forced) |
| Install failure / search unavailable after reopen | `blocked`/`error` path → `setup_ux` |
| Real offline reopen failure | same |
| Offline row that is a **miss** (e.g. content miss after reopen) | **Not** remapped by this plan — remains persona `setup_ux` unless a later slice expands scope |
| Non-offline rows | unchanged |

### Explicitly out of scope for P2

- Product runtime / UI copy
- Catalog, bundles, source data, matrices, packages, search/index behavior
- Lexical work (Son/`prix`, `fièvre`, `poulet`)
- Expanding the diagnostic cohort or rewriting offline task prompts
- Remapping offline **miss** rows (content gaps ≠ setup, but separate residual)

## 4. Proposed `deriveIssueClass` shape (plan only)

```ts
function deriveIssueClass(status: ObservedResultStatus, expected: IssueClass): IssueClass {
  if (status === "hit_single" && expected === "pending_human_review") return "no_issue_observed";
  if (status === "hit_multi" && expected === "pending_human_review") return "interpretability";
  if (status === "miss" && expected === "pending_human_review") return "pending_human_review";
  if (status === "blocked" || status === "error") return "setup_ux";
  // NEW: successful offline/reopen searches are not setup failures
  if ((status === "hit_single" || status === "hit_multi") && expected === "setup_ux") {
    return "no_issue_observed";
  }
  return expected;
}
```

## 5. Test / validation impact (P2)

| Check | Expectation |
| --- | --- |
| Unit coverage | Add focused tests for `deriveIssueClass` / `createUsageEvidenceRow` if exported or tested via row factory — successful hit + expected `setup_ux` → `no_issue_observed` + intervention `none`; `blocked`/`error` still `setup_ux`; miss + `setup_ux` unchanged |
| Usage harness | Debug or featured run still passes; offline hit rows no longer show `setup_ux` |
| Product tests | Unchanged |

## 6. Risks

| Risk | Rating | Mitigation |
| --- | --- | --- |
| Clearing a true setup failure that somehow recorded as hit | low | Hits imply search worked; keep `blocked`/`error` forced to `setup_ux` |
| Offline content misses still labeled `setup_ux` | low/medium | Document as residual; do not expand P2 without explicit slice |
| Persona table drift if someone adds non-offline `setup_ux` expects | low | Prefer also gating on `offline_check` / `offlineReopenChecked` if needed |

## 7. Decision

```text
OFFLINE_ISSUE_CLASS_CLEANUP_PLAN_READY
```

## 8. Next slice

**Phase 7N2K4P2 — Implement Offline Issue-Class Cleanup**

Purpose: implement the `deriveIssueClass` remapping above (plus focused tests),
without changing product runtime or persona cohort content beyond labeling.

## 9. Confirmation: no runtime / catalog / bundle / source / matrix / package changes

P1 created only this plan report. No harness code, runtime, catalog, bundles,
source data, matrices, or packages were modified.
