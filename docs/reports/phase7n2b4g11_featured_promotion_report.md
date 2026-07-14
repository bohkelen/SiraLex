# Phase 7N2B4G11 — Promote 7N2B to Featured Runtime Bundle

## Decision

```text
7N2B_FEATURED_PROMOTION_COMPLETE
```

## 1. Owner approval source

| Source | Detail |
| --- | --- |
| G10 readiness | `docs/reports/phase7n2b4g10_featured_promotion_readiness_report.md` → `7N2B_READY_FOR_FEATURED_PROMOTION_NEXT_SLICE` |
| Owner decision | Explicit owner approval after G10 to promote `bundle_full_20260710_337619ff` to featured/default |

## 2. Promotion mechanism

Explicit production featured ID via Vite env (same F8/G10 option A), **not** catalog sort order.

`getFeaturedCatalogEntry` + `import.meta.env.VITE_FEATURED_BUNDLE_ID` (mirrors `web/src/main.ts`).

## 3. Env change

`web/.env.production`:

```text
# before
VITE_FEATURED_BUNDLE_ID=bundle_full_20260708_27643bb0

# after
VITE_FEATURED_BUNDLE_ID=bundle_full_20260710_337619ff
```

Comment updated to Phase 7N2B4G11. Production build embeds `bundle_full_20260710_337619ff` in `web/dist/assets/index-*.js`.

## 4. Catalog provenance update

`web/public/catalog.json` — provenance-only `version` edits; all three entries retained:

| Entry | `version` after G11 |
| --- | --- |
| 7N2B `bundle_full_20260710_337619ff` | `norm-v3-featured-7n2b4g11-7l13-7n2a8-7n2b9-runtime-smoke-pass` |
| 7N2A `bundle_full_20260708_27643bb0` | `norm-v3-prior-featured-fallback-7n2a4f8` |
| 7J `bundle_full_20260616_phase7j_alias_round2_candidate` | `norm-v3-prior-featured-fallback-phase7j` (unchanged) |

Unchanged for all: `bundle_id`, `url_base`, `content_sha256`, `size_bytes`, languages.
No schema fields added. No bundle payload files modified.

## 5. Featured / default proof

| Proof | Result |
| --- | --- |
| Production env selects 7N2B | PASS |
| `getFeaturedCatalogEntry(bundles, productionId)` → 7N2B | PASS |
| Sort-only `getFeaturedCatalogEntry(bundles, undefined)` still → 7J | PASS (env-based promotion) |
| Featured install (`activateOnCommit: true`) activates 7N2B | PASS |
| Production build embeds 7N2B id | PASS |

## 6. Rollback / fallback proof

| Proof | Result |
| --- | --- |
| Catalog still lists 7N2A prior/fallback | PASS |
| Catalog still lists 7J older rollback | PASS |
| Install 7N2A with `activateOnCommit: false` leaves active = 7N2B | PASS |
| Explicit `setActiveBundleId` to 7N2A works; `moto`/`prix` miss on 7N2A | PASS |
| Install 7J with `activateOnCommit: false` leaves active = 7N2B | PASS (F8 retarget) |
| Bundle directories retained under `web/public/` | PASS (untouched) |

## 7. Featured 7N2B search smoke results

Against featured-active 7N2B:

| Query | Expected | Result |
| --- | --- | --- |
| `moto` | `["b5c9a49f6db2a991", "0a56b8047aeaf117"]` → `pópo` | PASS |
| `prix` direct | `["ffbf014bd96ffabf"]` | PASS |
| `prix` resolved | `3b8c3b7a0c5e897d` → `Son` | PASS |
| `maman` | `["e5164efcdf5e6ca4"]` | PASS |
| `fièvre` | miss | PASS |
| `comment dit-on école` | miss | PASS |
| `combien ça coûte` | miss | PASS |
| `merci beaucoup` | miss | PASS |
| `papa` | `["b8053579e3035e88"]` → `bàba` / `bàwa` | PASS |
| `père` | `["423369d78d42c100"]` → `fà` | PASS |

## 8. 7N2A guardrail results inside featured 7N2B

| Query | Result |
| --- | --- |
| `hôpital` / `clinique` / `centre de santé` | PASS (health mappings + displays) |
| `place` excludes health forms | PASS |
| `location` miss | PASS |
| `yoro` miss | PASS |

## 9. Replay gate results

Temporary manifests/matrices under `/tmp/phase7n2b4g11_featured_promotion/replay/`
(tracked matrices untouched). Replay against
`web/public/bundle_full_20260710_337619ff/`:

| Gate | Result |
| --- | --- |
| Frozen 7L | **13 / 13 passed** |
| Additive 7N2A | **8 / 8 passed** |
| Additive 7N2B | **9 / 9 passed** |

Resolved catalog version:
`norm-v3-featured-7n2b4g11-7l13-7n2a8-7n2b9-runtime-smoke-pass`.

## 10. Test / build results

```bash
git diff --check
# → clean

npm --prefix web run test:run -- src/phase7n2b4g11_featured_promotion.test.ts
# → 3 passed

npm --prefix web run test:run
# → 25 files / 252 tests passed

npm --prefix web run build
# → tsc + vite build + PWA generateSW succeeded; featured id embedded
```

## 11. Retargeted stale-test changes

Current-state fixture maintenance only (semantics preserved; no skips/weakening):

| File | Change summary |
| --- | --- |
| `web/src/phase7n2b4g11_featured_promotion.test.ts` | **New** G11 promotion proof (env, catalog, install, smoke, 7N2A fallback, 7L 13/13). |
| `web/src/phase7n2a4f8_featured_promotion.test.ts` | Retarget: featured = 7N2B; prior 7N2A + 7J installable without activate; 7L against 7N2B. Historical F8 archive remains in its report. |
| `web/src/phase7n2b4g9_runtime_candidate_smoke.test.ts` | Retarget: featured = 7N2B; install prior 7N2A without activate leaves 7N2B; preserve 7N2B smoke. Historical G9 archive remains in its report. |
| `web/src/phase7n2a4f6_runtime_candidate_smoke.test.ts` | Extra narrow retarget required for full-suite green (same current-featured fixture pattern as F11→F6). Featured = 7N2B; prior 7N2A version/hash assertions; 7J rollback; smoke includes moto/prix; 7L against 7N2B. |

## 12. Confirmation: no bundle / source / matrix / package / review-artifact changes

Did **not** modify:

- any `web/public/bundle_*` payloads
- aliases / supplements / target variants
- search regression matrices/manifests (tracked)
- `data/` / `api/` / `artifacts/review/` / packages / release documents

## 13. Decision

```text
7N2B_FEATURED_PROMOTION_COMPLETE
```

## 14. Next slice definition

**Phase 7N2B4G12 — Post-Promotion Runtime Monitoring Evidence**

Purpose: record post-promotion runtime stability evidence for 7N2B as the
featured/default bundle and confirm rollback paths remain intact.
