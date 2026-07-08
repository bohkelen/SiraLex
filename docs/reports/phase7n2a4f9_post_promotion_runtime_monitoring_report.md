# Phase 7N2A4F9 — Post-Promotion Runtime Monitoring Evidence

## Decision

```text
POST_PROMOTION_STABLE
```

No catalog, env, bundle payload, source, matrix, package, or runtime code changes
in this slice. Evidence only.

## 1. Featured bundle identity

| Field | Value |
| --- | --- |
| Featured `bundle_id` | `bundle_full_20260708_27643bb0` |
| Mechanism | `web/.env.production` → `VITE_FEATURED_BUNDLE_ID=bundle_full_20260708_27643bb0` |
| Catalog version | `norm-v3-featured-7n2a4f8-7l13-7n2a8-runtime-smoke-pass` |
| `content_sha256` | `sha256:27643bb092ff31117a133378db7562080c8b1d0d87fe111f5b83973e15a08484` |
| Path | `web/public/bundle_full_20260708_27643bb0/` |

## 2. Featured resolution proof

| Check | Result |
| --- | --- |
| `web/.env.production` still points to 7N2A | PASS |
| `getFeaturedCatalogEntry` with production ID → 7N2A | PASS (F8 test) |
| Sort-only catalog order still yields 7J first | PASS (proves VITE remains the mechanism) |
| Production build embeds `bundle_full_20260708_27643bb0` | PASS (`web/dist/assets/index-FxRGNBoi.js`) |

## 3. Catalog and rollback availability proof

| Check | Result |
| --- | --- |
| Catalog entry count | 2 |
| 7N2A present | PASS |
| 7J present (`bundle_full_20260616_phase7j_alias_round2_candidate`) | PASS |
| 7J version label | `norm-v3-prior-featured-fallback-phase7j` |
| 7J `content_sha256` | `sha256:e54b8fdf39558ecb639c0763ea9454f085aded7b48f867affe1f96a44709c2ef` |
| 7J directory on disk | PASS |
| F8 test: explicit 7J install with `activateOnCommit: false` while active stays 7N2A | PASS |

## 4. Bundle hash immutability proof

Read-only verify of `web/public/bundle_full_20260708_27643bb0/`:

| Artifact | Expected | Result |
| --- | --- | --- |
| `records.jsonl` | `sha256:2c67c3f5446bfbfb078ed60f8d6e073fd0b105b816e714b6e14369c197e75f9e` | PASS |
| `search_index.jsonl` | `sha256:b2ea152d8f83a0873111058f893e84435e3e0bda2d1f40afbaee0826f040bdd6` | PASS |
| Manifest `content_sha256` | `sha256:27643bb092ff31117a133378db7562080c8b1d0d87fe111f5b83973e15a08484` | PASS |

No payload files edited in F9.

## 5. Runtime smoke results

`npm --prefix web run test:run -- src/phase7n2a4f8_featured_promotion.test.ts`

| Suite | Result |
| --- | --- |
| F8 featured promotion tests | **3 / 3 passed** |

Featured install activates 7N2A. Smoke queries on promoted active scope:

| Query | Expected | Result |
| --- | --- | --- |
| `maman` | `["e5164efcdf5e6ca4"]` | PASS |
| `móbaa` | `["c5f78c8ac66eac6b"]` | PASS |
| `hôpital` | `["61843e6630c1fbae", "ff4ee495ef997adf"]` | PASS |
| `clinique` | `["ff42659295a657dc"]` | PASS |
| `centre de santé` | `["ffb73938da1a4576"]` | PASS |
| `place` | `["96b72ff71179d689"]` | PASS |
| `location` | miss | PASS |
| `yoro` | miss | PASS |

Displayed health targets (NFC-normalized):

| Query | Targets |
| --- | --- |
| `hôpital` | `dándaso`, `ndándayoro`, `ndándadiya` |
| `clinique` | `ndándayoro`, `ndándadiya` |
| `centre de santé` | `ndándayoro`, `ndándadiya` |

## 6. 7L runtime matrix result

Within F8 suite: promoted featured 7N2A via temporary matrix manifest → **13 / 13 passed**, 0 failed.

## 7. 7L + 7N2A replay results

Workspace: `/tmp/phase7n2a4f9_post_promotion/` (tracked matrices untouched).
Target: `web/public/bundle_full_20260708_27643bb0`.

| Gate | Result |
| --- | --- |
| Frozen 7L | **13 / 13 passed** |
| Additive 7N2A | **8 / 8 passed** |

## 8. Build result

`npm --prefix web run build` → success.

Production asset embeds featured id `bundle_full_20260708_27643bb0`.

## 9. Observed warnings / residual risks

### Full `npm --prefix web run test:run`

Default full suite **fails** because historical
`src/phase7n2a4f6_runtime_candidate_smoke.test.ts` still asserts F5-era catalog
provenance (7J as featured / candidate version strings). That is expected after F8
promotion and was documented in the F8 report. F9 did **not** edit F6 (out of
allowed scope; not a product regression).

Focused measurement excluding F6:

```bash
npm --prefix web run test:run -- --exclude '**/phase7n2a4f6_runtime_candidate_smoke.test.ts'
```

→ **22 files / 243 tests passed**, including F8 and Phase 7L `search_regression.test.ts`.

Standalone F6 re-run: **3 failed / 1 passed** (provenance assertions only).

### Other residual risks

- Catalog schema still lacks explicit `featured` field; production depends on
  `VITE_FEATURED_BUNDLE_ID`.
- Runtime smoke ≠ full device/human QA.
- Promoted bundle is larger than prior featured; watch storage on first update.
- Historical F6 smoke should be retired or retargeted in a later cleanup slice so
  default `test:run` is green without excludes.

No post-promotion product bug requiring rollback or repair was found.

## 10. Rollback instructions

Do not execute in F9. Exact steps remain:

1. Set `VITE_FEATURED_BUNDLE_ID=bundle_full_20260616_phase7j_alias_round2_candidate`
   in `web/.env.production`, or remove the override so sort-order selects 7J.
2. Optionally restore catalog provenance labels.
3. Keep `web/public/bundle_full_20260708_27643bb0/` unless corrupt.
4. Rebuild (`npm --prefix web run build`) and re-run featured 7L smoke.

## 11. Decision

```text
POST_PROMOTION_STABLE
```

Featured 7N2A remains correctly selected, searchable, hash-stable, and
replay-green. 7J remains catalog- and disk-available for rollback.

## 12. Next slice definition

**Phase 7N2A4F10 — Close Phase 7N2A Promotion Record**

Purpose: record final promotion closure, summarize the complete evidence chain,
and define the next product/linguistic expansion tranche.
