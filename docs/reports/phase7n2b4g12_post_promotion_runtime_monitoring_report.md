# Phase 7N2B4G12 — Post-Promotion Runtime Monitoring Evidence

## Decision

```text
7N2B_POST_PROMOTION_STABLE
```

Evidence/monitoring only. No catalog, env, bundle payload, source, matrix,
package, runtime code, or test changes in this slice.

## 1. Promoted featured identity

| Field | Value |
| --- | --- |
| Featured `bundle_id` | `bundle_full_20260710_337619ff` |
| Mechanism | `web/.env.production` → `VITE_FEATURED_BUNDLE_ID=bundle_full_20260710_337619ff` |
| Catalog version | `norm-v3-featured-7n2b4g11-7l13-7n2a8-7n2b9-runtime-smoke-pass` |
| `content_sha256` | `sha256:337619ff43131acde1390d7892d687372785729dac5d85abe82b61cc92285c3c` |
| `records_sha256` | `sha256:d99242ed0c049759ec265f3583683c99a3146854b4481b6d3de86cbd33f50a90` |
| `search_index_sha256` | `sha256:55bf98fc99a592f7003aa338fc7b4790bc9cd642b676c99a725d83a5f9ca79e3` |
| Path | `web/public/bundle_full_20260710_337619ff/` |
| G11 promotion commit | `043e732` — Promote 7N2B to featured runtime bundle |

On-disk records / search_index / manifest hashes still match the accepted G11
identity. `git diff 043e732..HEAD` shows **no** changes to env, catalog, bundle
payloads, aliases, supplements, matrices, `data/`, `api/`, or review artifacts
before this report.

## 2. Env / build featured proof

| Check | Result |
| --- | --- |
| `web/.env.production` points to `bundle_full_20260710_337619ff` | PASS |
| `getFeaturedCatalogEntry` with production env → 7N2B | PASS (G11 + G9 retarget suites) |
| Sort-only without env still → 7J | PASS (env-based promotion still holds) |
| Production build embeds `bundle_full_20260710_337619ff` | PASS (`web/dist/assets/index-DQO7SgYA.js`) |

## 3. Catalog and rollback inventory

Catalog still contains **exactly three** entries:

| Role | `bundle_id` | `version` |
| --- | --- | --- |
| Older rollback | `bundle_full_20260616_phase7j_alias_round2_candidate` | `norm-v3-prior-featured-fallback-phase7j` |
| Prior featured / fallback | `bundle_full_20260708_27643bb0` | `norm-v3-prior-featured-fallback-7n2a4f8` |
| Featured | `bundle_full_20260710_337619ff` | `norm-v3-featured-7n2b4g11-7l13-7n2a8-7n2b9-runtime-smoke-pass` |

IDs, `url_base`, `content_sha256`, and `size_bytes` unchanged since G11.
All three directories remain under `web/public/`.

## 4. Featured 7N2B runtime smoke results

Reconfirmed via `phase7n2b4g11_featured_promotion.test.ts` and
`phase7n2b4g9_runtime_candidate_smoke.test.ts` (G11-retargeted current-state):

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

Closed 7N2A guardrails inside featured 7N2B:

| Guardrail | Result |
| --- | --- |
| `hôpital` / `clinique` / `centre de santé` health mappings | PASS |
| `place` excludes health owner IDs / health display forms | PASS |
| `location` miss | PASS |
| `yoro` miss | PASS |

Featured install activates 7N2B; frozen 7L runtime matrix in G11 suite: **13 / 13**.

## 5. 7N2A fallback proof

| Proof | Result |
| --- | --- |
| 7N2A remains catalog-visible | PASS |
| Install 7N2A with `activateOnCommit: false` leaves active = 7N2B | PASS |
| Explicit `setActiveBundleId` to 7N2A works | PASS |
| On 7N2A: `maman` hit | PASS |
| On 7N2A: `moto` miss | PASS |
| On 7N2A: `prix` miss | PASS |
| Switch back to 7N2B works | PASS |
| 7N2A health / place / location / yoro contracts still hold on that scope | PASS (G11 + F8/F6 retarget coverage) |

## 6. 7J rollback visibility proof

| Proof | Result |
| --- | --- |
| 7J discoverable in catalog | PASS |
| 7J version / hash unchanged | PASS |
| Sort-first without env still resolves to 7J | PASS |
| Explicit 7J install with `activateOnCommit: false` leaves featured active | PASS (F8 retarget) |

## 7. Replay gate results

Temporary manifests/matrices under `/tmp/phase7n2b4g12_post_promotion/replay/`
(tracked matrices untouched). Replay against featured
`web/public/bundle_full_20260710_337619ff/`:

| Gate | Result |
| --- | --- |
| Frozen 7L | **13 / 13 passed** |
| Additive 7N2A | **8 / 8 passed** |
| Additive 7N2B | **9 / 9 passed** |

Resolved catalog version:
`norm-v3-featured-7n2b4g11-7l13-7n2a8-7n2b9-runtime-smoke-pass`.

## 8. Full test / build results

```bash
git diff --check
# → clean

npm --prefix web run test:run -- src/phase7n2b4g11_featured_promotion.test.ts
# → 3 / 3 passed

npm --prefix web run test:run -- src/phase7n2b4g9_runtime_candidate_smoke.test.ts
# → 2 / 2 passed

npm --prefix web run test:run
# → 25 files / 252 tests passed

npm --prefix web run build
# → tsc + vite + PWA generateSW succeeded; featured id embedded
```

## 9. Residual risks

| # | Risk |
| --- | --- |
| 1 | Catalog schema still lacks explicit featured / status / promotion_stage fields. |
| 2 | Featured selection remains env-dependent (`VITE_FEATURED_BUNDLE_ID`). |
| 3 | Sort-first without env still returns 7J, not 7N2A or 7N2B. |
| 4 | `Son` remains an owner-approved starter form; orthography/tones may need later review. |
| 5 | Runtime smoke is not full field / device / human QA. |
| 6 | Bundle size / import / storage behavior should be watched after real use. |

## 10. Rollback instructions

To rollback to 7N2A:

1. Set `web/.env.production` back to:
   `VITE_FEATURED_BUNDLE_ID=bundle_full_20260708_27643bb0`
2. Keep 7N2B catalog-visible unless bundle corruption or catalog parsing is the issue.
3. Keep 7J as older rollback.
4. Re-run featured smoke, 7L replay, full `test:run`, and build.

## 11. Confirmation: no env / catalog / bundle / source / matrix / package / review-artifact changes

G12 created only this report. No edits to:

- `web/.env.production`
- `web/public/catalog.json`
- any `web/public/bundle_*`
- `web/src/`
- aliases / supplements / target variants / search regression matrices
- `data/` / `api/` / `artifacts/review/` / packages / release documents

## 12. Decision

```text
7N2B_POST_PROMOTION_STABLE
```

Post-promotion env/build resolution, catalog inventory, featured smoke, fallback
paths, and replay gates remain green with no payload drift since G11.

## 13. Next slice definition

**Phase 7N2B4G13 — Close Phase 7N2B Promotion Record**

Purpose: close the 7N2B promotion record, summarize the final evidence chain, and
define the next linguistic/product follow-up without changing runtime or source
data.
