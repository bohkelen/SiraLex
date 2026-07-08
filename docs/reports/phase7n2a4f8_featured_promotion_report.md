# Phase 7N2A4F8 — Promote 7N2A to Featured Runtime Bundle

## Promotion status

```text
featured_runtime_bundle_7n2a
```

## Blocker resolution

F8 preflight found root `.gitignore` ignored `.env.*` and blocked tracking
`web/.env.production`. A narrow exception was added for `web/.env.production` only,
because it contains a non-secret public bundle selector:
`VITE_FEATURED_BUNDLE_ID=bundle_full_20260708_27643bb0`.

No catalog-only / sort-order fallback was used. No new runtime config system was added.

## 1. Candidate promoted

| Field | Value |
| --- | --- |
| `bundle_id` | `bundle_full_20260708_27643bb0` |
| Path | `web/public/bundle_full_20260708_27643bb0/` |
| Catalog version (post-F8) | `norm-v3-featured-7n2a4f8-7l13-7n2a8-runtime-smoke-pass` |
| `content_sha256` | `sha256:27643bb092ff31117a133378db7562080c8b1d0d87fe111f5b83973e15a08484` |
| `records_sha256` | `sha256:2c67c3f5446bfbfb078ed60f8d6e073fd0b105b816e714b6e14369c197e75f9e` |
| `search_index_sha256` | `sha256:b2ea152d8f83a0873111058f893e84435e3e0bda2d1f40afbaee0826f040bdd6` |

## 2. Promotion mechanism implemented

Explicit production featured ID via Vite env (F7 option A), not catalog sort order.

## 3. Exact env / config path used

| Path | Role |
| --- | --- |
| `.gitignore` | Added `!web/.env.production` after `.env` / `.env.*` |
| `web/.env.production` | `VITE_FEATURED_BUNDLE_ID=bundle_full_20260708_27643bb0` |

`npm --prefix web run build` (Vite production mode) loads this file and inlines the
bundle id into the client bundle (`web/dist/assets/index-*.js` contains
`bundle_full_20260708_27643bb0`).

## 4. Catalog metadata change

`web/public/catalog.json` provenance-only edits; both entries retained:

| Entry | Change |
| --- | --- |
| 7N2A | `version` → `norm-v3-featured-7n2a4f8-7l13-7n2a8-runtime-smoke-pass` |
| 7J | `version` → `norm-v3-prior-featured-fallback-phase7j` |

Unchanged for both: `bundle_id`, `url_base`, `content_sha256`, `size_bytes`, languages.
No bundle payload files modified. Promotion does **not** depend on entry order;
after `(name, bundle_id)` sort, 7J remains `bundles[0]` and 7N2A remains second —
featured resolution uses `VITE_FEATURED_BUNDLE_ID`.

## 5. Proof featured / default now resolves to 7N2A

| Proof | Result |
| --- | --- |
| `web/.env.production` sets `VITE_FEATURED_BUNDLE_ID` to 7N2A | PASS |
| `getFeaturedCatalogEntry(bundles, productionId)` → 7N2A | PASS (F8 test) |
| Sort-only `getFeaturedCatalogEntry(bundles, undefined)` still → 7J | PASS (proves VITE is the mechanism) |
| Featured install (`activateOnCommit: true`) activates 7N2A | PASS |
| Production build embeds 7N2A id | PASS |

## 6. Proof 7J remains rollback-available

| Proof | Result |
| --- | --- |
| Catalog still lists `bundle_full_20260616_phase7j_alias_round2_candidate` | PASS |
| 7J directory retained under `web/public/` | PASS |
| Explicit catalog install of 7J with `activateOnCommit: false` succeeds | PASS |
| Active remains 7N2A after fallback install | PASS |
| 7J `content_sha256` unchanged | PASS |

## 7. Runtime smoke results

`npm --prefix web run test:run -- src/phase7n2a4f8_featured_promotion.test.ts`

| Check | Result |
| --- | --- |
| Production env + catalog featured resolution | PASS |
| Featured install + smoke queries | PASS |
| Frozen 7L runtime matrix on promoted 7N2A | **13 / 13** PASS |

Smoke queries on promoted featured active scope:

| Query | Result |
| --- | --- |
| `maman` | `["e5164efcdf5e6ca4"]` |
| `móbaa` | `["c5f78c8ac66eac6b"]` |
| `hôpital` | `["61843e6630c1fbae", "ff4ee495ef997adf"]` |
| `clinique` | `["ff42659295a657dc"]` |
| `centre de santé` | `["ffb73938da1a4576"]` |
| `place` | `["96b72ff71179d689"]` |
| `location` | miss |
| `yoro` | miss |

`npm --prefix web run build` succeeded; featured id present in production assets.

F6 historical smoke (`phase7n2a4f6_runtime_candidate_smoke.test.ts`) is **not compatible**
with post-promotion catalog provenance (it asserts 7J as featured / candidate version
strings from F5). Per F8 plan, F8 test replaces that proof; F6 was not weakened or
edited (not in allowed files).

## 8. Replay verification results

Temporary manifests/matrices under `/tmp/phase7n2a4f8_featured_promotion/`
(tracked matrices untouched). Target: `web/public/bundle_full_20260708_27643bb0`.

| Gate | Result |
| --- | --- |
| Frozen 7L | **13 / 13 passed** |
| Additive 7N2A | **8 / 8 passed** |

## 9. Bundle hash immutability proof

Staged payload files under `web/public/bundle_full_20260708_27643bb0/` were not
modified. Verified hashes still match accepted identity (records, search_index,
manifest `content_sha256`). 7J payload directory also untouched.

## 10. Rollback plan

Do **not** execute rollback in this slice. Exact steps:

1. Set `VITE_FEATURED_BUNDLE_ID=bundle_full_20260616_phase7j_alias_round2_candidate`
   in `web/.env.production`, **or** remove the override so sort-order fallback
   selects 7J (equal names → 7J `bundle_id` sorts first).
2. Restore catalog provenance labels if desired
   (`norm-v3-featured-enriched-source-aliases-3-source-index-supplements-2` for 7J;
   candidate label for 7N2A).
3. Keep `web/public/bundle_full_20260708_27643bb0/` unless corrupt.
4. Rebuild web (`npm --prefix web run build`) and re-run featured 7L smoke /
   `runMatrixRegression` against restored featured.

## 11. Confirmation: no source / matrix / package / bundle-payload changes

Changed only:

- `.gitignore`
- `web/.env.production`
- `web/public/catalog.json` (version strings only)
- `web/src/phase7n2a4f8_featured_promotion.test.ts`
- `docs/reports/phase7n2a4f8_featured_promotion_report.md`

No changes to `api/`, `data/`, `shared/`, `artifacts/review/`, packages, or either
bundle’s `records.jsonl` / `search_index.jsonl` / `bundle.manifest.json` /
`checksums.sha256`.

## 12. Next slice definition

**Phase 7N2A4F9 — Post-Promotion Runtime Monitoring Evidence**

Purpose: collect post-promotion runtime evidence and confirm the promoted featured
bundle remains stable, with rollback still available.
