# Phase 7N2A4F10 — Close Phase 7N2A Promotion Record

## Closure decision

```text
PHASE_7N2A_PROMOTION_CLOSED_STABLE
```

Promotion status at closure:

```text
PROMOTION_CLOSED_STABLE_WITH_KNOWN_TEST_CLEANUP_FOLLOWUP
```

This slice is documentation/closure only. No catalog, env, runtime, test, bundle,
source, matrix, or package changes.

## 1. Final featured identity

| Field | Value |
| --- | --- |
| Featured `bundle_id` | `bundle_full_20260708_27643bb0` |
| Featured mechanism | `web/.env.production` → `VITE_FEATURED_BUNDLE_ID=bundle_full_20260708_27643bb0` |
| Catalog version | `norm-v3-featured-7n2a4f8-7l13-7n2a8-runtime-smoke-pass` |
| Path | `web/public/bundle_full_20260708_27643bb0/` |
| `content_sha256` | `sha256:27643bb092ff31117a133378db7562080c8b1d0d87fe111f5b83973e15a08484` |
| `records_sha256` | `sha256:2c67c3f5446bfbfb078ed60f8d6e073fd0b105b816e714b6e14369c197e75f9e` |
| `search_index_sha256` | `sha256:b2ea152d8f83a0873111058f893e84435e3e0bda2d1f40afbaee0826f040bdd6` |

Rollback / prior featured:

| Field | Value |
| --- | --- |
| Rollback `bundle_id` | `bundle_full_20260616_phase7j_alias_round2_candidate` |
| Catalog version | `norm-v3-prior-featured-fallback-phase7j` |
| Path | `web/public/bundle_full_20260616_phase7j_alias_round2_candidate/` |
| `content_sha256` | `sha256:e54b8fdf39558ecb639c0763ea9454f085aded7b48f867affe1f96a44709c2ef` |

## 2. Complete evidence chain

| Slice | Outcome |
| --- | --- |
| **7N2A4D-R** | `maman` alias recomposition repair — narrowed alias to generic `mère` posting only. |
| **7N2A4E1-R** | Durable health supplement evidence repair — owner health IR + supplements reproducible. |
| **7N2A4F1** | Additive 7N2A regression matrix established beside frozen 7L. |
| **7N2A4F1-R** | Additive matrix runner support for 7N2A family. |
| **7N2A4F1-S0** | Lexicon locator projection onto enriched `lexicon_entry` records. |
| **7N2A4F1-S** | Resolved-target assertion support (`expected_id_space`) for health mappings. |
| **7N2A4F2-R1** | Lexicographic posting-order preservation restoring frozen 7L order. |
| **7N2A4F2-R2** | Candidate acceptance: 7L **13/13**, 7N2A **8/8**; identity `bundle_full_20260708_27643bb0`. |
| **7N2A4F3** | Review packaging under `artifacts/review/phase7n2a/` (review-only). |
| **7N2A4F4** | Artifact inspection PASS → promote to catalog-visible candidate next. |
| **7N2A4F5** | Catalog-visible staging; featured remained 7J. |
| **7N2A4F6** | Runtime candidate smoke PASS (pre-promotion; historical test now stale). |
| **7N2A4F7** | Featured promotion readiness: `READY_FOR_FEATURED_PROMOTION_NEXT_SLICE`. |
| **7N2A4F8** | Featured promotion via `VITE_FEATURED_BUNDLE_ID` + catalog provenance. |
| **7N2A4F9** | Post-promotion monitoring: `POST_PROMOTION_STABLE`. |

## 3. Final semantic contracts

Promoted featured search behavior:

| Query | Contract |
| --- | --- |
| `maman` | `["e5164efcdf5e6ca4"]` |
| `mère` | `["0f517a71c373f51d", "d540716db9321a83", "e5164efcdf5e6ca4"]` |
| `móbaa` | `["c5f78c8ac66eac6b"]` |
| `hôpital` direct | `["61843e6630c1fbae", "ff4ee495ef997adf"]` |
| `hôpital` resolved | `["71e323e2dafa590f", "a9c7d82decee9191", "fefe9b063e05ed11"]` |
| `clinique` resolved | `["a9c7d82decee9191", "fefe9b063e05ed11"]` |
| `centre de santé` resolved | `["a9c7d82decee9191", "fefe9b063e05ed11"]` |
| `place` | `["96b72ff71179d689"]` (excludes health owner IDs) |
| `location` | miss |
| `yoro` | miss |

## 4. Final runtime / replay / build status

| Check | Result |
| --- | --- |
| 7N2A is featured/default | Yes (`VITE_FEATURED_BUNDLE_ID`) |
| 7J catalog-visible + on disk | Yes |
| Catalog contains both entries | Yes |
| Promotion uses VITE, not sort order | Yes (sort-only still prefers 7J) |
| Bundle payloads unmodified during promotion | Yes |
| F8 runtime smoke | **3 / 3** |
| Focused suite excluding stale F6 | **243 tests passed** |
| Build | PASS (featured id embedded) |
| Frozen 7L replay | **13 / 13** |
| Additive 7N2A replay | **8 / 8** |

Authoritative post-promotion evidence: F8 + F9 reports.

## 5. Rollback availability

7J remains in `web/public/catalog.json` and
`web/public/bundle_full_20260616_phase7j_alias_round2_candidate/`.

Rollback steps (do not execute in F10):

1. Point `VITE_FEATURED_BUNDLE_ID` at 7J (or remove override so sort selects 7J).
2. Optionally restore catalog provenance labels.
3. Keep 7N2A staged unless corrupt.
4. Rebuild and re-run featured 7L smoke.

## 6. Known stale F6 test issue

The historical F6 runtime candidate smoke test
(`web/src/phase7n2a4f6_runtime_candidate_smoke.test.ts`) is stale after F8
promotion. It asserts F5-era provenance where 7J is featured and 7N2A is
candidate. Default full `npm --prefix web run test:run` fails only because of
this stale test.

**Not fixed in F10.** Immediate cleanup follow-up is F11.

## 7. Residual risk register

| # | Risk |
| --- | --- |
| 1 | Catalog schema still lacks explicit featured/status fields. |
| 2 | Featured selection depends on `VITE_FEATURED_BUNDLE_ID`. |
| 3 | Historical F6 smoke needs cleanup (blocks green default `test:run`). |
| 4 | Runtime smoke is not full device/human QA. |
| 5 | Larger bundle may require storage/import monitoring on real devices. |

## 8. Closure decision

```text
PHASE_7N2A_PROMOTION_CLOSED_STABLE
```

Phase 7N2A featured promotion is closed as stable, with rollback available and
one known test-cleanup follow-up.

## 9. Next slice definition

**Phase 7N2A4F11 — Retire or Retarget Historical F6 Smoke Test**

Purpose: update the stale F6 runtime candidate smoke test so the default full
test suite is green after 7N2A promotion, without weakening archived F6 evidence.

## 10. Confirmation: no catalog / runtime / bundle / source / matrix / package changes

F10 created only this report. No edits to:

- `web/public/catalog.json`
- `web/.env.production`
- web tests / app code
- either bundle’s payload files
- `api/`, `data/`, `shared/`, `artifacts/review/`
- packages / production publish
