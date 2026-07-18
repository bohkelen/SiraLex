# Phase 7N2H4M4 — Close Featured-Bundle Usage Harness Workstream

## Decision

```text
FEATURED_USAGE_HARNESS_WORKSTREAM_CLOSED
```

Closure only. No scripts, docs (other than this report), harness, runtime,
catalog, bundles, source data, matrices, tests, or packages were edited.
Son/`prix`, `fièvre`, and `poulet` were not reopened.

## 1. Evidence chain

| Slice | Artifact | Decision |
| --- | --- | --- |
| M1 | `docs/reports/phase7n2h4m1_full_bundle_usage_harness_plan.md` | `FULL_BUNDLE_USAGE_HARNESS_PLAN_READY` |
| M2 | `docs/reports/phase7n2h4m2_featured_usage_harness_mode_report.md` | `FEATURED_USAGE_HARNESS_MODE_IMPLEMENTED` |
| M3 | `docs/reports/phase7n2h4m3_featured_usage_harness_mode_verification_report.md` | `FEATURED_USAGE_HARNESS_MODE_VERIFIED` |
| M4 | this report | `FEATURED_USAGE_HARNESS_WORKSTREAM_CLOSED` |

## 2. Final script state

| Script | State |
| --- | --- |
| `test:e2e:usage` | Remains debug default (`npm run build && playwright test …`; harness falls back to `public/debug-bundles/test_directional_bundle`) |
| `test:e2e:usage:featured` | Exists (opt-in) |
| Featured bundle dir | `SIRALEX_USAGE_BUNDLE_DIR=public/bundle_full_20260710_337619ff` |
| Featured install timeout | `SIRALEX_USAGE_INSTALL_TIMEOUT_MS=900000` |
| Docs | `docs/LOCAL_USAGE_AUTOMATION.md` documents opt-in featured mode |

## 3. Closure checklist

| Record | Status |
| --- | --- |
| Debug usage script remains default | **Yes** |
| Featured usage script exists | **Yes** |
| Featured targets `public/bundle_full_20260710_337619ff` | **Yes** |
| Install timeout is `900000` | **Yes** |
| Debug run passed (M2 + M3) | **Yes** |
| Featured run passed (M2 + M3) | **Yes** |
| Usage output remains structured usability only | **Yes** (`can_influence_demand: false`) |
| No lexical validation or demand evidence created | **Yes** |
| No harness rewrite | **Yes** (M2 used existing env support) |
| No runtime / catalog / bundle / source / matrix / package behavior changed | **Yes** |

## 4. Residual notes

| Note | Severity |
| --- | --- |
| Featured runs are slow (~7–8 minutes locally) vs debug (~23s); keep featured opt-in | expected |
| Local evidence under `data/local_evidence/human_usage_automation/` from harness runs is usability smoke only — not lexical authority | boundary |
| Deferred lexical owner topics (Son orthography / targets, `fièvre`, `poulet`) remain closed pending owner validation data | out of scope for 7N2H |

## 5. Decision

```text
FEATURED_USAGE_HARNESS_WORKSTREAM_CLOSED
```

## 6. Next slice

**Phase 7N2I4N0 — Choose Next Practical Workstream**

## 7. Confirmation: no runtime / catalog / bundle / source / matrix / package changes

M4 created only this closure report. No scripts, harness, runtime, catalog,
bundles, source data, matrices, tests, or packages were modified.
