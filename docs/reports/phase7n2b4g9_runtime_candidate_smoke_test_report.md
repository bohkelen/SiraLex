# Phase 7N2B4G9 — Runtime Candidate Smoke Test

## Decision

```text
7N2B_RUNTIME_SMOKE_PASS_CANDIDATE_READY_FOR_FEATURED_PROMOTION_REVIEW
```

## 1. Runtime / catalog convention used

Reused the established F6/F8 path (no parallel runtime):

| Concern | Convention |
| --- | --- |
| Catalog | `bundle_catalog_v1` in `web/public/catalog.json`; parse/sort via `parseAndValidateBundleCatalogJson` |
| Featured / default | `getFeaturedCatalogEntry` + production `VITE_FEATURED_BUNDLE_ID` (mirrors `web/src/main.ts`) |
| Install | `installRemoteCatalogBundle` with file-backed `fetchImpl` of staged `web/public` assets |
| Non-activation | `activateOnCommit: false` leaves the active featured bundle unchanged |
| Explicit select | `setActiveBundleId` required before searching the candidate scope |
| Search | `searchQuery` + `resolveRecords` on the active storage scope |

Proof harness: `web/src/phase7n2b4g9_runtime_candidate_smoke.test.ts`.

## 2. Featured / default proof: 7N2A remains featured

| Check | Result |
| --- | --- |
| `web/.env.production` | Unchanged: `VITE_FEATURED_BUNDLE_ID=bundle_full_20260708_27643bb0` |
| `getFeaturedCatalogEntry` with production env | Returns `bundle_full_20260708_27643bb0` |
| Featured version | `norm-v3-featured-7n2a4f8-7l13-7n2a8-runtime-smoke-pass` |
| Featured content_sha256 | `sha256:27643bb092ff31117a133378db7562080c8b1d0d87fe111f5b83973e15a08484` |
| 7N2B returned as featured/default | **No** |
| Sort-first without env | Remains 7J rollback (`bundle_full_20260616_phase7j_alias_round2_candidate`) |

## 3. 7N2B discovery proof

Catalog length **3**:

1. 7J rollback — `bundle_full_20260616_phase7j_alias_round2_candidate`
2. Featured 7N2A — `bundle_full_20260708_27643bb0`
3. Candidate 7N2B — `bundle_full_20260710_337619ff`

| Field | Value |
| --- | --- |
| Candidate version | `norm-v3-candidate-catalog-visible-7n2b4g8-7l13-7n2a8-7n2b9` |
| content_sha256 | `sha256:337619ff43131acde1390d7892d687372785729dac5d85abe82b61cc92285c3c` |
| records_sha256 | `sha256:d99242ed0c049759ec265f3583683c99a3146854b4481b6d3de86cbd33f50a90` |
| search_index_sha256 | `sha256:55bf98fc99a592f7003aa338fc7b4790bc9cd642b676c99a725d83a5f9ca79e3` |
| url_base | `./bundle_full_20260710_337619ff/` |

Staged `web/public/bundle_full_20260710_337619ff/` file hashes match catalog identity.

## 4. 7N2B install / select / load proof

1. Install featured 7N2A with `activateOnCommit: true` → active = 7N2A.
2. Install 7N2B with `activateOnCommit: false` → active remains 7N2A; candidate is installed.
3. Explicit `setActiveBundleId(CANDIDATE)` → active = 7N2B; search uses candidate scope.
4. Switch back via `setActiveBundleId(FEATURED)` → 7N2A remains installable/active; `moto` still miss on featured.

## 5. 7N2B search smoke results

Against explicitly selected 7N2B:

| Query | Expected | Result |
| --- | --- | --- |
| `moto` | `["b5c9a49f6db2a991", "0a56b8047aeaf117"]` → `pópo` / `pópo` | PASS |
| `prix` direct | `["ffbf014bd96ffabf"]` | PASS |
| `prix` resolved | `3b8c3b7a0c5e897d` → `Son` (anchor `7n2b_son_v1`) | PASS |
| `maman` | `["e5164efcdf5e6ca4"]` | PASS |
| `fièvre` | miss | PASS |
| `comment dit-on école` | miss | PASS |
| `combien ça coûte` | miss | PASS |
| `merci beaucoup` | miss | PASS |
| `papa` | `["b8053579e3035e88"]` → `bàba` / `bàwa` | PASS |
| `père` | `["423369d78d42c100"]` → `fà` | PASS |

Featured 7N2A alone: `maman` hit; `moto` / `prix` miss (7N2B deltas only).

## 6. 7N2A guardrail results inside selected 7N2B

| Query | Expected | Result |
| --- | --- | --- |
| `hôpital` | `["61843e6630c1fbae", "ff4ee495ef997adf"]` → `dándaso`, `ndándayoro`, `ndándadiya` | PASS |
| `clinique` | `["ff42659295a657dc"]` → `ndándayoro`, `ndándadiya` | PASS |
| `centre de santé` | `["ffb73938da1a4576"]` → `ndándayoro`, `ndándadiya` | PASS |
| `place` | `["96b72ff71179d689"]`; displays exclude health forms | PASS |
| `location` | miss | PASS |
| `yoro` | miss | PASS |

## 7. Non-promotion proof

| Proof | Result |
| --- | --- |
| Production env featured = 7N2A | PASS |
| 7N2B not featured/default | PASS |
| Install 7N2B with `activateOnCommit: false` leaves active = 7N2A | PASS |
| Explicit `setActiveBundleId` required to search 7N2B | PASS |
| `web/.env.production` byte-identical before/after | PASS |

## 8. Replay verification results

Temporary manifests/matrices under `/tmp/phase7n2b4g9_runtime_candidate_smoke/replay/`
(tracked matrices untouched; temp copies only rewrote `bundle_id` to the staged
candidate for validation). Replay against staged
`web/public/bundle_full_20260710_337619ff/`:

| Gate | Result |
| --- | --- |
| Frozen 7L | **13 / 13 passed** |
| Additive 7N2A | **8 / 8 passed** |
| Additive 7N2B | **9 / 9 passed** |

Resolved catalog version in reports:
`norm-v3-candidate-catalog-visible-7n2b4g8-7l13-7n2a8-7n2b9`.

## 9. Commands run and results

```bash
git diff --check
# → clean

npm --prefix web run test:run -- src/phase7n2b4g9_runtime_candidate_smoke.test.ts
# → 2 passed (catalog/env proof; install/select/search smoke)

npm --prefix web run test:run
# → 24 files / 249 tests passed

npm --prefix web run build
# → tsc + vite build + PWA generateSW succeeded

git diff --name-status
git status --short
```

## 10. Confirmation: no env / catalog / bundle / source / matrix / package changes

Committed only:

- `web/src/phase7n2b4g9_runtime_candidate_smoke.test.ts`
- `docs/reports/phase7n2b4g9_runtime_candidate_smoke_test_report.md`

Did **not** modify: `web/.env.production`, `web/public/catalog.json`, any
`web/public/bundle_*`, aliases, supplements, owner lexical IR, regression
matrices/manifests, `data/`, `api/`, review artifacts, or packages.

## 11. Decision

```text
7N2B_RUNTIME_SMOKE_PASS_CANDIDATE_READY_FOR_FEATURED_PROMOTION_REVIEW
```

## 12. Next slice definition

**Phase 7N2B4G10 — Featured Promotion Readiness Review**

Purpose: decide whether the catalog-visible 7N2B candidate should become the
featured/default runtime bundle.
