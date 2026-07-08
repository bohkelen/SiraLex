# Phase 7N2A4F6 — Runtime Candidate Smoke Test

## Decision

```text
RUNTIME_SMOKE_PASS_CANDIDATE_READY_FOR_FEATURED_PROMOTION_REVIEW
```

## 1. Runtime / catalog loading convention discovered

Inspected: `web/public/catalog.json`, `web/src/bundle_catalog.ts`, `web/src/main.ts`,
`web/src/install/bundle_install.ts`, `web/src/search/search_query.ts`,
`web/src/search_regression/*`, `web/e2e/human_usage/*`, `web/package.json`,
`docs/reports/phase7n2a4f5_catalog_visible_candidate_report.md`.

| Concern | Convention |
| --- | --- |
| Catalog entries | `bundle_catalog_v1` in `/catalog.json`; parse sorts by `(name, bundle_id)`. |
| Featured / default | `FEATURED_CATALOG_URL` → `/catalog.json`. `getFeaturedCatalogEntry()` uses optional `VITE_FEATURED_BUNDLE_ID`, else **`loadedCatalogBundles[0]`** (post-sort). No schema `status`/`featured` field. |
| Alternate / candidate | Listed in the same catalog; Manage dictionaries → catalog list → install button. `installCatalogEntry` → `installRemoteCatalogBundle` fetches `url_base` + `bundle.manifest.json` / `records.jsonl` / `search_index.jsonl`. |
| Activate-on-install | `getCatalogEntryRuntimeState().activateOnCommit = !installed \|\| isActive`. A newly installed non-active entry activates on first install when no matching install exists; with an already-active featured bundle, candidate can be installed with `activateOnCommit: false` and selected later via `setActiveBundleId` / bundle select. |
| Offline / IndexedDB path | Install stages into storage scope `bundle_id::content_sha256`; search uses `searchQuery(db, storageScopeId, direction, query, directional)`. |
| Search index path | Remote stream → `importSearchIndexJsonl`; regression harness uses the same import + `searchQuery`. |

## 2. Featured / default bundle proof

| Check | Result |
| --- | --- |
| Catalog `bundles[0]` after parse sort | `bundle_full_20260616_phase7j_alias_round2_candidate` |
| Featured version | `norm-v3-featured-enriched-source-aliases-3-source-index-supplements-2` |
| Featured content_sha256 | `sha256:e54b8fdf39558ecb639c0763ea9454f085aded7b48f867affe1f96a44709c2ef` |
| Catalog / featured bundle files mutated in F6 | No |

## 3. Candidate discovery proof

| Check | Result |
| --- | --- |
| Catalog contains `bundle_full_20260708_27643bb0` | Yes |
| Candidate version | `norm-v3-candidate-catalog-visible-7n2a4f5-7l13-7n2a8` |
| Candidate content_sha256 | `sha256:27643bb092ff31117a133378db7562080c8b1d0d87fe111f5b83973e15a08484` |
| Candidate `url_base` | `./bundle_full_20260708_27643bb0/` |
| Staged records / search_index hashes | Match accepted F5 identity |

## 4. Candidate load proof

Runtime path exercised in
`web/src/phase7n2a4f6_runtime_candidate_smoke.test.ts`:

1. Install featured 7J via `installRemoteCatalogBundle(..., activateOnCommit: true)`.
2. Install candidate via `installRemoteCatalogBundle(..., activateOnCommit: false)` with file-backed fetch of staged `web/public` assets.
3. Confirm active bundle remains 7J after candidate install.
4. Explicitly `setActiveBundleId` to candidate (user selection), then search.

Also verified direct IndexedDB import of candidate `records.jsonl` + `search_index.jsonl`
through the same import helpers used by runtime install.

## 5. Candidate search smoke results

| Query | Expected | Actual |
| --- | --- | --- |
| `maman` | `["e5164efcdf5e6ca4"]` | PASS |
| `móbaa` (target→source) | `["c5f78c8ac66eac6b"]` | PASS |
| `hôpital` (direct) | `["61843e6630c1fbae", "ff4ee495ef997adf"]` | PASS |
| `clinique` (direct) | `["ff42659295a657dc"]` | PASS |
| `centre de santé` (direct) | `["ffb73938da1a4576"]` | PASS |
| `place` | `["96b72ff71179d689"]` | PASS |
| `location` | miss | PASS |
| `yoro` | miss | PASS |

User-facing index-mapping target display texts (NFC-normalized for comparison):

| Query | Targets |
| --- | --- |
| `hôpital` | `dándaso`, `ndándayoro`, `ndándadiya` |
| `clinique` | `ndándayoro`, `ndándadiya` |
| `centre de santé` | `ndándayoro`, `ndándadiya` |

## 6. Featured / default non-regression proof

Existing Phase 7L runtime matrix against featured bundle directory + catalog:

| Gate | Result |
| --- | --- |
| Frozen 7L via `runMatrixRegression` on featured 7J | **13 / 13 passed**, 0 failed |
| Catalog version resolved for featured | featured version string unchanged |

App does not auto-switch default/featured catalog pointer to 7N2A: after candidate
install with `activateOnCommit: false`, active remains 7J; catalog featured entry
remains 7J.

## 7. Commands run and results

```bash
npm --prefix web run test:run -- src/phase7n2a4f6_runtime_candidate_smoke.test.ts
# → 4 passed (catalog discovery; remote install + smoke search; featured 13/13; import path)

npm --prefix web run build
# → tsc + vite build succeeded

git diff --check
git diff --name-status
git status --short
```

`test:e2e:usage` was not required for this slice: it installs featured/debug bundles for
human-usage evidence and does not exercise alternate catalog candidate selection.
Replay against tracked matrices was not re-run; featured non-regression used the
existing runtime matrix harness (read-only on tracked matrices).

## 8. Confirmation: no catalog / bundle / source / matrix / package changes

- `web/public/catalog.json` unchanged.
- `web/public/bundle_full_20260708_27643bb0/` unchanged.
- Featured bundle directory unchanged.
- No `api/`, `data/`, `shared/`, `artifacts/review/`, or package changes.
- No production publish.

Tracked deliverables:

- `web/src/phase7n2a4f6_runtime_candidate_smoke.test.ts`
- `docs/reports/phase7n2a4f6_runtime_candidate_smoke_test_report.md`

## 9. Decision

```text
RUNTIME_SMOKE_PASS_CANDIDATE_READY_FOR_FEATURED_PROMOTION_REVIEW
```

## 10. Next slice

**Phase 7N2A4F7 — Featured Promotion Readiness Review**

Purpose: decide whether the catalog-visible 7N2A candidate should become the
featured/default runtime bundle.
