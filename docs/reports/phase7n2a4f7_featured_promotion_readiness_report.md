# Phase 7N2A4F7 — Featured Promotion Readiness Review

## Decision

```text
READY_FOR_FEATURED_PROMOTION_NEXT_SLICE
```

This slice is readiness review only. No catalog, featured/default pointer,
bundle, runtime, package, source, matrix, or artifact was changed.

## 1. Candidate identity

| Field | Value |
| --- | --- |
| `bundle_id` | `bundle_full_20260708_27643bb0` |
| Catalog version | `norm-v3-candidate-catalog-visible-7n2a4f5-7l13-7n2a8` |
| Path | `web/public/bundle_full_20260708_27643bb0/` |
| `content_sha256` | `sha256:27643bb092ff31117a133378db7562080c8b1d0d87fe111f5b83973e15a08484` |
| `records_sha256` | `sha256:2c67c3f5446bfbfb078ed60f8d6e073fd0b105b816e714b6e14369c197e75f9e` |
| `search_index_sha256` | `sha256:b2ea152d8f83a0873111058f893e84435e3e0bda2d1f40afbaee0826f040bdd6` |
| Manifest `bundle_id` / `content_sha256` | Match accepted identity (read-only verify) |

Current featured/default (unchanged):

| Field | Value |
| --- | --- |
| `bundle_id` | `bundle_full_20260616_phase7j_alias_round2_candidate` |
| Catalog version | `norm-v3-featured-enriched-source-aliases-3-source-index-supplements-2` |
| Catalog position after `(name, bundle_id)` sort | `bundles[0]` |

## 2. Evidence chain summary (F2-R2 → F6)

| Slice | Report | Outcome |
| --- | --- | --- |
| **7N2A4F2-R2** | `phase7n2a4f2r2_candidate_acceptance_gates_report.md` | Candidate accepted under `/tmp`. Frozen 7L **13/13**, additive 7N2A **8/8**. Identity hashes match the candidate under review. |
| **7N2A4F3** | `phase7n2a4f3_review_packaging_report.md` | Review ZIP + manifest + checksums under `artifacts/review/phase7n2a/`. Payload-only packaging; `promotion_status: review_artifact_only_not_promoted`. |
| **7N2A4F4** | `phase7n2a4f4_review_artifact_inspection_report.md` | Checksums, clean extraction, schema, semantic spot checks, replay all PASS. Decision: `PROMOTE_TO_CATALOG_VISIBLE_CANDIDATE_IN_NEXT_SLICE` (no promotion performed). |
| **7N2A4F5** | `phase7n2a4f5_catalog_visible_candidate_report.md` | Staged to `web/public/bundle_full_20260708_27643bb0/`; catalog entry added; featured remained 7J. Status: `catalog_visible_candidate_not_featured`. Replay 7L 13/13 + 7N2A 8/8 against staged path. |
| **7N2A4F6** | `phase7n2a4f6_runtime_candidate_smoke_test_report.md` | Runtime discovery, remote install, explicit selection, search smoke, featured 7L non-regression. Decision: `RUNTIME_SMOKE_PASS_CANDIDATE_READY_FOR_FEATURED_PROMOTION_REVIEW`. |

Read-only confirmation at F7 time: `web/public/catalog.json` still lists both entries with 7J as featured; staged candidate hashes still match accepted identity.

## 3. Readiness criteria table

| # | Criterion | Status | Notes |
| --- | --- | --- | --- |
| 1 | Acceptance gates: 7L 13/13, 7N2A 8/8 | **PASS** | F2-R2; reconfirmed at F4/F5 |
| 2 | Review artifact: checksums, extraction, schema, semantics, replay | **PASS** | F3 packaging + F4 inspection |
| 3 | Catalog-visible; featured remained 7J after F5 | **PASS** | F5 report; catalog still shows 7J first |
| 4 | Runtime smoke: discover, install, select, search, featured 7L | **PASS** | F6; 4/4 vitest smoke + featured 13/13 |
| 5a | `maman` alias narrowing | **PASS** | Smoke + matrices: `maman` → `["e5164efcdf5e6ca4"]` |
| 5b | Source-mapping resolved-target assertions | **PASS** | 7N2A matrix / F1-S runner support |
| 5c | Lexicon locator projection | **PASS** | F1-S0; F4 schema coverage |
| 5d | 7L posting order | **PASS** | F2-R1 lex sort; 7L restored |
| 5e | Health supplement semantics | **PASS** | Direct + resolved health smoke in F4/F6 |
| 5f | `place` / `location` / `yoro` boundary | **PASS** | `place` hit; `location`/`yoro` miss |

No unresolved blockers identified for featured-promotion **review**. Remaining items are operational risks (below), not acceptance failures.

## 4. Remaining risk review

| # | Risk | Assessment |
| --- | --- | --- |
| 1 | Catalog schema lacks `status` / `promotion_stage` / `featured` | True. Provenance lives in `version` strings + reports. Promotion must not invent schema fields in F8 unless a dedicated schema slice lands first. |
| 2 | Default selection uses sorted catalog order unless `VITE_FEATURED_BUNDLE_ID` is set | True. Both entries share display name `French ↔ Maninka`; sort key falls through to `bundle_id`, so 7J (`…20260616…`) stays ahead of 7N2A (`…20260708…`). |
| 3 | Promoting by catalog ordering alone is fragile | **Critical for F8.** Lexicographic `bundle_id` order cannot promote 7N2A without renaming IDs or unequal display names. Do not rely on sort-only promotion. |
| 4 | Runtime smoke ≠ full human QA | Accepted residual risk. F6 covered install/search paths; device/human-usage automation not re-run as featured. |
| 5 | Bundle larger / content changed vs featured | Candidate ~26.2 MiB vs featured ~24.5 MiB; more records/index rows. Watch update/import storage headroom and IndexedDB scope swap after promotion. |

## 5. Promotion mechanism analysis

Inspected: `web/src/main.ts` (`FEATURED_CATALOG_URL`, `FEATURED_BUNDLE_ID` / `VITE_FEATURED_BUNDLE_ID`, `getFeaturedCatalogEntry`), `web/src/bundle_catalog.ts` (sort), `docs/BUNDLE_DISTRIBUTION.md`, historical `web/public/catalog.json` commits (`Publish Phase 7J…`, etc.), absence of `web/.env*`, absence of deploy workflows setting `VITE_*`.

| Option | Feasibility | Notes |
| --- | --- | --- |
| **A. `VITE_FEATURED_BUNDLE_ID`** | Runtime **supported**; deploy **not currently configured** | Explicit featured ID; independent of sort. No tracked `.env.production` / CI env today. |
| **B. Catalog ordering / metadata** | Ordering alone **insufficient** | Equal names → `bundle_id` sort keeps 7J first. Version-string edits alone do not change `getFeaturedCatalogEntry` without VITE or sort change. Historical publishes often replaced the **single** catalog entry. |
| **C. Explicit catalog schema `featured`** | Not available | Would require schema + parser + UI work; out of scope for a thin F8 unless chosen as a prerequisite. |
| **D. Other repo convention** | Catalog pointer edit | Past featured publishes edited `catalog.json` (often one entry). Multi-entry catalog (F5) is newer; rollback benefits from keeping both entries. |

### Recommended mechanism for F8 (do not implement in F7)

**Preferred path:** **A + catalog provenance metadata (B, non-ordering).**

1. Set build-time `VITE_FEATURED_BUNDLE_ID=bundle_full_20260708_27643bb0` via a tracked production env mechanism the Vite build already reads (`import.meta.env.VITE_FEATURED_BUNDLE_ID`), so featured install resolves by explicit ID.
2. Update `web/public/catalog.json` **version** (and only as needed for human provenance) so 7N2A is labeled featured and 7J is labeled prior/fallback — **without** deleting the 7J entry.
3. Do **not** promote by renaming `bundle_id`s or relying on `(name, bundle_id)` sort alone.
4. Keep staged directories for both bundles on disk for rollback.

If introducing any env file is rejected in F8, the fallback is catalog-only: make featured install resolve to 7N2A without VITE by ensuring `getFeaturedCatalogEntry()`’s no-env path returns 7N2A (e.g. temporary unequal display `name` so sort places 7N2A first, or single-entry catalog). That fallback is **more brittle** than VITE and should be documented as such if chosen.

## 6. Rollback plan (for future F8)

1. Restore featured/default to `bundle_full_20260616_phase7j_alias_round2_candidate` (clear/revert `VITE_FEATURED_BUNDLE_ID` and/or restore catalog featured provenance so 7J is again the featured install target).
2. Keep the 7N2A catalog-visible candidate entry unless the failure is catalog parse/schema breakage.
3. Do not delete `web/public/bundle_full_20260708_27643bb0/` unless the bundle itself is corrupt.
4. Re-run featured 7L runtime smoke / matrix against restored featured after rollback (`runMatrixRegression` or F6-equivalent featured path).

## 7. Decision

```text
READY_FOR_FEATURED_PROMOTION_NEXT_SLICE
```

Acceptance, review, catalog-visible staging, and runtime smoke evidence are complete.
Remaining risks are mechanism/ops risks that F8 must address explicitly (prefer `VITE_FEATURED_BUNDLE_ID`, avoid sort-only promotion).

## 8. Next slice definition

**Phase 7N2A4F8 — Promote 7N2A to Featured Runtime Bundle**

Purpose: make 7N2A the featured/default runtime bundle using the safest mechanism
identified in F7 (`VITE_FEATURED_BUNDLE_ID` + catalog provenance; not sort-only),
with rollback evidence.

## 9. Confirmation: no catalog / bundle / runtime / package / source / matrix / artifact change

F7 created only this report. No edits to:

- `web/public/catalog.json`
- staged or featured bundle directories
- `VITE_*` / runtime config / app code
- `api/`, `data/`, `shared/`, `artifacts/review/`
- packages / production publish
