# Phase 7N2B4G8 — Stage 7N2B as Catalog-Visible Candidate

## Decision

```text
7N2B_CATALOG_VISIBLE_CANDIDATE_STAGED_NOT_FEATURED
```

Promotion status:

```text
catalog_visible_candidate_not_featured
```

## 1. Source review artifact

| Field | Value |
| --- | --- |
| Review ZIP | `artifacts/review/phase7n2b/bundle_full_20260710_337619ff.review.zip` |
| Review manifest | `artifacts/review/phase7n2b/bundle_full_20260710_337619ff.review_manifest.json` |
| Review checksums | `artifacts/review/phase7n2b/bundle_full_20260710_337619ff.review_checksums.txt` |
| Review ZIP SHA-256 | `sha256:1dd2e9abe8803b825b0bf02f881456280ca9c761e2d0d35aaca47d23b8a0ccbd` |
| G7 decision | `STAGE_AS_CATALOG_VISIBLE_CANDIDATE_NEXT_SLICE` |
| Review `promotion_status` (unchanged) | `review_artifact_only_not_promoted` |

Accepted identity staged without regeneration.

## 2. Staged bundle path

```text
web/public/bundle_full_20260710_337619ff/
```

Extracted from the approved review ZIP. Exact payload:

```text
bundle.manifest.json
checksums.sha256
records.jsonl
search_index.jsonl
```

## 3. Catalog metadata change

Updated `web/public/catalog.json`:

| Entry | Role | Change |
| --- | --- | --- |
| `bundle_full_20260616_phase7j_alias_round2_candidate` | 7J rollback | Unchanged |
| `bundle_full_20260708_27643bb0` | Featured 7N2A | Unchanged |
| `bundle_full_20260710_337619ff` | 7N2B candidate | **Added** |

New candidate fields:

| Field | Value |
| --- | --- |
| `version` | `norm-v3-candidate-catalog-visible-7n2b4g8-7l13-7n2a8-7n2b9` |
| `size_bytes` | `26169580` (`records.jsonl` + `search_index.jsonl`, existing convention) |
| `url_base` | `./bundle_full_20260710_337619ff/` |
| `content_sha256` | `sha256:337619ff43131acde1390d7892d687372785729dac5d85abe82b61cc92285c3c` |

`web/.env.production` was **not** modified.

## 4. Proof featured / default remains 7N2A

| Check | Result |
| --- | --- |
| `VITE_FEATURED_BUNDLE_ID` | `bundle_full_20260708_27643bb0` |
| Featured catalog entry version | `norm-v3-featured-7n2a4f8-7l13-7n2a8-runtime-smoke-pass` |
| Featured content hash | unchanged `sha256:27643bb0…` |
| Env file content | byte-unchanged from preflight |

## 5. Proof 7N2B is catalog-visible candidate

| Check | Result |
| --- | --- |
| Present in `catalog.json` | PASS |
| `url_base` resolves under `web/public/` | PASS |
| Distinct from featured entry | PASS |
| Not selected by `VITE_FEATURED_BUNDLE_ID` | PASS |
| Explicit catalog selection possible | PASS (entry present with installable `url_base`) |

## 6. Staged file inventory and hashes

| File | SHA-256 |
| --- | --- |
| records.jsonl | `sha256:d99242ed0c049759ec265f3583683c99a3146854b4481b6d3de86cbd33f50a90` |
| search_index.jsonl | `sha256:55bf98fc99a592f7003aa338fc7b4790bc9cd642b676c99a725d83a5f9ca79e3` |
| content (`bundle.manifest.json`) | `sha256:337619ff43131acde1390d7892d687372785729dac5d85abe82b61cc92285c3c` |
| `verify_bundle` | VALID |

## 7. Semantic smoke results

Against `web/public/bundle_full_20260710_337619ff/`:

| Query | Result |
| --- | --- |
| `moto` | `["b5c9a49f6db2a991", "0a56b8047aeaf117"]` → `pópo` |
| `prix` | direct `["ffbf014bd96ffabf"]`; resolved `["3b8c3b7a0c5e897d"]` → `Son` |
| `maman` | `["e5164efcdf5e6ca4"]` |
| `fièvre` / phrase examples | miss |
| `papa` / `père` | distinct (`bàba`/`bàwa` vs `fà`) |
| `hôpital` / `clinique` / `centre de santé` | 7N2A health contracts hold |
| `place` | excludes health owner IDs |
| `location` / `yoro` | miss |

## 8. Replay verification

Temporary manifests/matrices under `/tmp/phase7n2b4g8_catalog_candidate/replay/`
(tracked matrices untouched). Replay against staged `web/public` candidate:

| Gate | Result |
| --- | --- |
| Frozen 7L | **13 / 13 passed** |
| Additive 7N2A | **8 / 8 passed** |
| Additive 7N2B | **9 / 9 passed** |

## 9. Runtime / catalog selectability check

Scripted check mirroring `getFeaturedCatalogEntry` + production env:

- Featured resolves to `bundle_full_20260708_27643bb0`.
- Candidate `bundle_full_20260710_337619ff` is present and selectable by explicit catalog entry.
- Without env, sort-first remains 7J (`bundle_full_20260616_phase7j_alias_round2_candidate`), confirming 7N2B is not default via catalog sort either.

Full app install/load smoke is deferred to G9.

## 10. Non-lexicographic `moto` posting-order note

G7 found four non-lex multi-posting keys, all `moto` alias key types, preserving
declared alias `resolved_ir_ids`:

```text
["b5c9a49f6db2a991", "0a56b8047aeaf117"]
```

Non-blocking: G7/G8 replay and the additive 7N2B matrix expect this declared order.

## 11. Confirmation: no promotion / env / source / matrix / package / review-artifact changes

Staged `web/public/bundle_full_20260710_337619ff/` + catalog append + this report.
Also updated two existing catalog length fixtures so CI remains accurate after the
third catalog entry:

- `web/src/phase7n2a4f6_runtime_candidate_smoke.test.ts` (`toHaveLength(3)`)
- `web/src/phase7n2a4f8_featured_promotion.test.ts` (`toHaveLength(3)`)

Did not modify `.env.production`, featured/rollback bundles, review artifacts,
aliases, supplements, owner lexical IR, regression matrices, API, or packages.

## 12. Decision

```text
7N2B_CATALOG_VISIBLE_CANDIDATE_STAGED_NOT_FEATURED
```

## 13. Next slice definition

**Phase 7N2B4G9 — Runtime Candidate Smoke Test**

Purpose: verify the catalog-visible 7N2B candidate can be discovered, selected,
loaded, and searched by the app without making it the featured/default runtime
bundle.
