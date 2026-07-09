# Phase 7N2A4F11 — Retire or Retarget Historical F6 Smoke Test

## Decision

```text
STALE_F6_TEST_RETARGETED_DEFAULT_TEST_RUN_GREEN
```

## 1. Why F6 became stale after promotion

Phase 7N2A4F6 originally proved that `bundle_full_20260708_27643bb0` was
catalog-visible as a **candidate** while Phase 7J remained featured/default.

After Phase 7N2A4F8, featured selection moved to:

```text
web/.env.production
VITE_FEATURED_BUNDLE_ID=bundle_full_20260708_27643bb0
```

Catalog provenance versions also changed (7N2A featured label; 7J prior/fallback).
The historical F6 test still asserted F5-era assumptions (7J featured, 7N2A
candidate-only version), so default `npm --prefix web run test:run` failed.

Archived F6 evidence remains in
`docs/reports/phase7n2a4f6_runtime_candidate_smoke_test_report.md` and was not
edited.

## 2. Exact test assertions removed or retargeted

File kept: `web/src/phase7n2a4f6_runtime_candidate_smoke.test.ts` (retargeted in place).

| Stale assertion (removed) | Retargeted assertion |
| --- | --- |
| Featured = `bundle_full_20260616_phase7j_alias_round2_candidate` via sort-only `bundles[0]` | Featured = 7N2A via `VITE_FEATURED_BUNDLE_ID` from `web/.env.production` |
| Featured version = `norm-v3-featured-enriched-source-aliases-3-source-index-supplements-2` | Featured version = `norm-v3-featured-7n2a4f8-7l13-7n2a8-runtime-smoke-pass` |
| 7N2A version = `norm-v3-candidate-catalog-visible-7n2a4f5-7l13-7n2a8` | 7N2A is featured entry with post-F8 version; 7J is prior/fallback |
| Install featured 7J then install 7N2A with `activateOnCommit: false` | Install featured 7N2A with `activateOnCommit: true`; install 7J as fallback with `activateOnCommit: false` |
| 7L matrix against 7J directory + tracked manifest expecting old featured catalog version | 7L matrix against promoted 7N2A with temporary manifest (tracked matrices untouched) |
| Describe title: “runtime candidate smoke” implying pre-promotion | Describe title notes retargeted post-promotion semantics |

Preserved smoke contracts: `maman`, `móbaa`, `hôpital`, `clinique`, `centre de santé`,
`place`, `location`, `yoro` IDs and health display targets; IndexedDB import path check.

## 3. Proof archived F6 evidence remains

`docs/reports/phase7n2a4f6_runtime_candidate_smoke_test_report.md` is unchanged and
still records the pre-promotion candidate smoke decision
`RUNTIME_SMOKE_PASS_CANDIDATE_READY_FOR_FEATURED_PROMOTION_REVIEW`.

## 4. Proof default full test suite is green

```bash
npm --prefix web run test:run
```

→ **23 test files / 247 tests passed** (includes retargeted F6 + F8 + Phase 7L regression).

## 5. Proof F8 promotion test still passes

```bash
npm --prefix web run test:run -- src/phase7n2a4f8_featured_promotion.test.ts
```

→ **3 / 3 passed** (also re-run together with retargeted F6: 7/7).

`npm --prefix web run build` → PASS.

## 6. Confirmation: no catalog / env / bundle / runtime / source / matrix / package changes

Changed only:

- `web/src/phase7n2a4f6_runtime_candidate_smoke.test.ts`
- `docs/reports/phase7n2a4f11_retire_or_retarget_f6_smoke_report.md`

No edits to `web/.env.production`, `web/public/catalog.json`, either bundle
directory, `api/`, `data/`, `shared/`, `artifacts/review/`, packages, or app runtime
source beyond the test file.

## 7. Next slice definition

**Phase 7N2A4G0 — Define Next Linguistic Expansion Tranche**

Purpose: choose the next small owner-reviewed lexical/source-index tranche after
7N2A, using the same evidence-first promotion pipeline.
