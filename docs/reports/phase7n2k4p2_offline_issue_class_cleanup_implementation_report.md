# Phase 7N2K4P2 — Implement Offline Issue-Class Cleanup

## Decision

```text
OFFLINE_ISSUE_CLASS_CLEANUP_IMPLEMENTED
```

Harness evidence-labeling only. No product runtime, catalog, bundles, source
data, matrices, packages, or search behavior changes. Persona tasks not
rewritten. Son/`prix`, `fièvre`, and `poulet` not reopened.

## 1. Implemented labeling behavior

In `web/e2e/human_usage/evidence_writer.ts` → `deriveIssueClass`:

| Condition | Result |
| --- | --- |
| `expected === "setup_ux"` + `hit_single` | `no_issue_observed` |
| `expected === "setup_ux"` + `hit_multi` | `no_issue_observed` |
| `blocked` / `error` | `setup_ux` (unchanged) |
| `miss` + `setup_ux` | `setup_ux` (unchanged) |
| Other expected classes | unchanged |

Existing mapping still sets `candidate_intervention_category` to `none` when
`issue_class === "no_issue_observed"`.

## 2. Files changed

| File | Change |
| --- | --- |
| `web/e2e/human_usage/evidence_writer.ts` | Added successful offline-hit remapping |
| `web/src/human_usage_evidence_writer.test.ts` | Focused unit coverage (vitest includes `src/`; e2e excluded from default config) |
| `docs/reports/phase7n2k4p2_offline_issue_class_cleanup_implementation_report.md` | This report |

## 3. Validation

| Check | Result |
| --- | --- |
| `git diff --check` | clean |
| `npm --prefix web run test:run -- src/human_usage_evidence_writer.test.ts` | **5 passed** |
| `npm --prefix web run test:e2e:usage` | **1 passed** (~23s) |
| `npm --prefix web run test:e2e:usage:featured` | **1 passed** (~7.3m) |
| Featured offline hits | 9/9 → `no_issue_observed` / `none` |
| Featured offline miss (`bonjour`) | remains `setup_ux` / `offline_install_reliability` (as planned) |

## 4. Decision

```text
OFFLINE_ISSUE_CLASS_CLEANUP_IMPLEMENTED
```

## 5. Next slice

**Phase 7N2K4P3 — Verify Offline Issue-Class Cleanup**

## 6. Confirmation: no runtime / catalog / bundle / source / matrix / package changes

P2 touched harness evidence labeling + focused unit test + this report only.
