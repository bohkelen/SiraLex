# Phase 7N2A4F5 — Stage 7N2A as Catalog-Visible Candidate

## Promotion status

```text
catalog_visible_candidate_not_featured
```

## 1. Source review artifact

| Field | Value |
| --- | --- |
| Review ZIP | `artifacts/review/phase7n2a/bundle_full_20260708_27643bb0.review.zip` |
| Review manifest | `artifacts/review/phase7n2a/bundle_full_20260708_27643bb0.review_manifest.json` |
| Review checksums | `artifacts/review/phase7n2a/bundle_full_20260708_27643bb0.review_checksums.txt` |
| Review ZIP SHA-256 | `sha256:ea94111b77130e5930834e6d0a5252c4fe569915a89347e72d7913468a58a078` |
| Review artifact commit | `9d627d74451de429980aede2eebe45339585f02f` |
| Acceptance report | `docs/reports/phase7n2a4f2r2_candidate_acceptance_gates_report.md` |
| Acceptance report commit | `a7ec5a7f6e6baedb933aa25e1debe88ee6caf239` |
| Inspection decision (F4) | `PROMOTE_TO_CATALOG_VISIBLE_CANDIDATE_IN_NEXT_SLICE` (`e7fea62991f288a54411753a3da608dba778481b`) |
| Created from phase | `7N2A4F5` |

Accepted identity:

| Field | Value |
| --- | --- |
| `bundle_id` | `bundle_full_20260708_27643bb0` |
| `content_sha256` | `sha256:27643bb092ff31117a133378db7562080c8b1d0d87fe111f5b83973e15a08484` |
| `records_sha256` | `sha256:2c67c3f5446bfbfb078ed60f8d6e073fd0b105b816e714b6e14369c197e75f9e` |
| `search_index_sha256` | `sha256:b2ea152d8f83a0873111058f893e84435e3e0bda2d1f40afbaee0826f040bdd6` |
| Acceptance gates | Frozen 7L **13/13**, Additive 7N2A **8/8** |

Review ZIP / manifest / checksums were **not** modified.

## 2. Staged bundle path

```text
web/public/bundle_full_20260708_27643bb0/
```

Extracted from the approved review ZIP. Directory contains only the accepted payload:

```text
bundle.manifest.json
checksums.sha256
records.jsonl
search_index.jsonl
```

## 3. Catalog convention discovered

Inspected:

- `web/public/catalog.json`
- `web/public/bundle_full_*/` (including prior `*candidate*` dirs)
- `web/src/bundle_catalog.ts` (`bundle_catalog_v1`)
- `web/src/main.ts` (`getFeaturedCatalogEntry`)

Convention:

| Concern | Existing behavior |
| --- | --- |
| Catalog-visible bundles | Listed under `catalog.json` → `bundles[]` with `url_base` pointing at `./bundle_<id>/` under `web/public/` |
| Bundle directory naming | `web/public/<bundle_id>/` with the four payload files above |
| Featured / default / runtime pointer | No explicit `status` / `featured` field in schema. Featured install uses `FEATURED_CATALOG_URL` (`/catalog.json`) and `getFeaturedCatalogEntry()`: optional `VITE_FEATURED_BUNDLE_ID`, else **`loadedCatalogBundles[0]`**. Catalog parse sorts by `(name, bundle_id)`, so with equal display names the lexicographically earlier `bundle_id` remains first. |
| Candidate status / version metadata | Schema allows optional `version` string only among free-form provenance fields. No `status`, `promotion_stage`, `source_review_artifact`, or gate fields in `bundle_catalog_v1`. |
| Historical dirs on disk | Older `web/public/bundle_full_*` trees may exist without catalog entries; catalog membership is what makes a bundle catalog-visible. |

Schema limitation: desired fields (`status: candidate`, `promotion_stage`, review/acceptance commits, gate counts) are **not** part of `bundle_catalog_v1`. Nearest compatible representation: encode candidate intent in `version`, keep featured entry unchanged as catalog index 0 after sort, and record full provenance in this report.

## 4. Catalog metadata change

`web/public/catalog.json`:

1. **Preserved** featured entry unchanged:

   - `bundle_id`: `bundle_full_20260616_phase7j_alias_round2_candidate`
   - `version`: `norm-v3-featured-enriched-source-aliases-3-source-index-supplements-2`
   - `content_sha256`: `sha256:e54b8fdf39558ecb639c0763ea9454f085aded7b48f867affe1f96a44709c2ef`
   - `size_bytes`: `24532394`
   - `url_base`: `./bundle_full_20260616_phase7j_alias_round2_candidate/`

2. **Added** catalog-visible candidate (second entry; remains second after `(name, bundle_id)` sort):

   - `bundle_id`: `bundle_full_20260708_27643bb0`
   - `name`: `French ↔ Maninka` (same display name as featured; required for sort stability)
   - `version`: `norm-v3-candidate-catalog-visible-7n2a4f5-7l13-7n2a8`
   - `size_bytes`: `26166937` (`records.jsonl` + `search_index.jsonl`, matching featured convention)
   - `url_base`: `./bundle_full_20260708_27643bb0/`
   - `content_sha256`: `sha256:27643bb092ff31117a133378db7562080c8b1d0d87fe111f5b83973e15a08484`
   - languages / language_labels: same `fr` / `mnk` as featured

No existing catalog entries removed. Featured entry fields not mutated.

## 5. Proof featured / default / runtime pointer unchanged

| Check | Result |
| --- | --- |
| Featured catalog entry `bundle_id` | Still `bundle_full_20260616_phase7j_alias_round2_candidate` |
| Featured `version` | Unchanged |
| Featured `content_sha256` | Unchanged |
| After catalog `(name, bundle_id)` sort, `bundles[0]` | Featured 7J entry |
| After sort, `bundles[1]` | 7N2A candidate |
| Candidate `version` contains `featured` | No |
| `VITE_FEATURED_BUNDLE_ID` / runtime code | Not modified |
| Featured bundle directory | Not overwritten |

## 6. Staged file inventory and hashes

| File | SHA-256 |
| --- | --- |
| `bundle.manifest.json` | `3913ba7d69bb7c941c03ded6237b830683b98ca0064a8fd831cd86ba8ab9149e` |
| `checksums.sha256` | `6a78549727a7de737c917795433eab4a009a246c577ac31d90be3aaf35e594b3` |
| `records.jsonl` | `2c67c3f5446bfbfb078ed60f8d6e073fd0b105b816e714b6e14369c197e75f9e` |
| `search_index.jsonl` | `b2ea152d8f83a0873111058f893e84435e3e0bda2d1f40afbaee0826f040bdd6` |

| Identity check | Result |
| --- | --- |
| `bundle.manifest.json` `bundle_id` | `bundle_full_20260708_27643bb0` PASS |
| `records.jsonl` vs accepted `records_sha256` | PASS |
| `search_index.jsonl` vs accepted `search_index_sha256` | PASS |
| Manifest `content_sha256` vs accepted | PASS |

## 7. Replay verification result

Temporary candidate-specific manifests/matrices under
`/tmp/phase7n2a4f5_catalog_candidate/` (tracked matrices not mutated).
Replay target: staged `web/public/bundle_full_20260708_27643bb0`.

| Gate | Result |
| --- | --- |
| Frozen 7L | **13 / 13 passed** |
| Additive 7N2A | **8 / 8 passed** |

## 8. Confirmation: no package / runtime / source / matrix changes

- No package artifact generated.
- No API / web runtime source changes.
- No `data/`, alias, supplement, or tracked regression matrix edits.
- Review artifact ZIP / manifest / checksums unchanged.
- No production publish / featured overwrite / historical bundle deletion.

Allowed tracked deliverables only:

- `web/public/bundle_full_20260708_27643bb0/*` (four payload files)
- `web/public/catalog.json`
- `docs/reports/phase7n2a4f5_catalog_visible_candidate_report.md`

## 9. Promotion status

```text
catalog_visible_candidate_not_featured
```

7N2A is catalog-visible and installable as a non-featured catalog entry. The featured/default/runtime pointer remains Phase 7J.

## 10. Next slice

**Phase 7N2A4F6 — Runtime Candidate Smoke Test**

Purpose: verify the catalog-visible 7N2A candidate can be selected and loaded by the app without making it the default featured bundle.
