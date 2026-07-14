# Phase 7N2B4G10 — Featured Promotion Readiness Review

## Decision

```text
7N2B_READY_FOR_FEATURED_PROMOTION_NEXT_SLICE
```

This slice is readiness review only. No catalog, featured/default pointer,
bundle, runtime, test, package, source, matrix, or artifact was changed.

**Owner promotion approval (this slice):** project owner / native-speaker
linguistic authority explicitly approved promoting the catalog-visible 7N2B
candidate to featured/default. Implementation of that promotion is deferred to
**Phase 7N2B4G11** and is **not** performed here.

## 1. Candidate identity

| Field | Value |
| --- | --- |
| `bundle_id` | `bundle_full_20260710_337619ff` |
| Catalog version | `norm-v3-candidate-catalog-visible-7n2b4g8-7l13-7n2a8-7n2b9` |
| Path | `web/public/bundle_full_20260710_337619ff/` |
| `content_sha256` | `sha256:337619ff43131acde1390d7892d687372785729dac5d85abe82b61cc92285c3c` |
| `records_sha256` | `sha256:d99242ed0c049759ec265f3583683c99a3146854b4481b6d3de86cbd33f50a90` |
| `search_index_sha256` | `sha256:55bf98fc99a592f7003aa338fc7b4790bc9cd642b676c99a725d83a5f9ca79e3` |
| Manifest / on-disk hashes (read-only verify) | Match accepted G5–G9 identity |

## 2. Current featured / default identity

Must remain unchanged in G10 (verified):

| Field | Value |
| --- | --- |
| Featured `bundle_id` | `bundle_full_20260708_27643bb0` |
| Mechanism | `web/.env.production` → `VITE_FEATURED_BUNDLE_ID=bundle_full_20260708_27643bb0` |
| Featured catalog version | `norm-v3-featured-7n2a4f8-7l13-7n2a8-runtime-smoke-pass` |
| Older rollback | `bundle_full_20260616_phase7j_alias_round2_candidate` (`norm-v3-prior-featured-fallback-phase7j`) |

Catalog still has **three** entries: 7J rollback, featured 7N2A, catalog-visible
7N2B candidate. Sort-first without env remains 7J.

## 3. Evidence chain summary (G0 → G9)

| Slice | Report | Outcome |
| --- | --- | --- |
| **G0** | `phase7n2a4g0_next_linguistic_expansion_tranche_report.md` | `NEXT_TRANCHE_DEFINED_READY_FOR_OWNER_REVIEW` — defined 7N2B everyday lemma recovery tranche after closed 7N2A promotion. |
| **G1** | `phase7n2b4g1_candidate_table_report.md` | `7N2B_CANDIDATE_TABLE_READY_FOR_OWNER_REVIEW` — review packet only. |
| **G2** | `phase7n2b4g2_owner_review_approval_record.md` | `7N2B_OWNER_REVIEW_APPROVED_PARTIAL_IMPLEMENTATION` — moto / phrases / papa≠père approved; prix→Son starter approved; fièvre deferred. |
| **G3** | `phase7n2b4g3_linguistic_tables_report.md` | `7N2B_APPROVED_TABLES_IMPLEMENTED` — moto alias + prix owner lexical Son + prix supplement only; no fièvre / phrase / papa→père rows. |
| **G4** | `phase7n2b4g4_regression_matrix_report.md` | `7N2B_ADDITIVE_MATRIX_READY` — 9 additive cases; placeholders until recomposition. |
| **G5** | `phase7n2b4g5_candidate_acceptance_gates_report.md` | `7N2B_CANDIDATE_GATES_PASS_READY_FOR_REVIEW_PACKAGING` — 7L 13/13, 7N2A 8/8, 7N2B 9/9; duplicate IR IDs 0. |
| **G6** | `phase7n2b4g6_review_packaging_report.md` | `7N2B_REVIEW_ARTIFACT_PACKAGED_NOT_PROMOTED` — review ZIP/manifest/checksums. |
| **G7** | `phase7n2b4g7_review_artifact_inspection_report.md` | `STAGE_AS_CATALOG_VISIBLE_CANDIDATE_NEXT_SLICE` — checksums, extraction, semantics, provenance, replay PASS; moto non-lex order documented. |
| **G8** | `phase7n2b4g8_catalog_visible_candidate_report.md` | `7N2B_CATALOG_VISIBLE_CANDIDATE_STAGED_NOT_FEATURED` — staged under `web/public`; featured remained 7N2A. |
| **G9** | `phase7n2b4g9_runtime_candidate_smoke_test_report.md` | `7N2B_RUNTIME_SMOKE_PASS_CANDIDATE_READY_FOR_FEATURED_PROMOTION_REVIEW` — discover/install/non-activate/select/search/switch-back; full `test:run` + build green. |

Read-only confirmation at G10: env, catalog, and staged candidate hashes still match the G8/G9 accepted identity. Featured remains 7N2A.

## 4. Readiness criteria table

| # | Criterion | Status | Notes |
| --- | --- | --- | --- |
| 1 | Owner review approved implementable scope | **PASS** | G2: moto alias, phrase boundaries, papa/père boundary, prix→Son starter; fièvre deferred |
| 2 | G3 implemented only approved table rows | **PASS** | moto alias + Son owner lexical + prix supplement; no fièvre / phrase aliases / papa→père |
| 3 | G4 additive matrix valid (9 rows, additive family) | **PASS** | Tracked placeholders remain acceptable; G5+ temp manifests bind real hashes |
| 4 | G5 gates: 7L 13/13, 7N2A 8/8, 7N2B 9/9, dup IR 0 | **PASS** | Reconfirmed in G7/G8/G9 replay |
| 5 | G6/G7 review artifact: checksums, extraction, semantics, provenance, replay | **PASS** | G7 decided stage-as-catalog-visible |
| 6 | G8 catalog-visible staging; featured stayed 7N2A; hashes match | **PASS** | Catalog still 3 entries; env unchanged |
| 7 | G9 runtime smoke + full test:run + build | **PASS** | Discovery, install, non-activation, explicit select, search, switch-back |

No unresolved acceptance blockers. Remaining items are residual operational risks (below), not readiness failures.

**Owner G10 decision:** approve featured promotion in the next slice (G11).

## 5. Semantic readiness summary

Promoted-candidate behavior under review (proven in G5–G9 against
`bundle_full_20260710_337619ff`):

| Query | Expected behavior |
| --- | --- |
| `moto` | `["b5c9a49f6db2a991", "0a56b8047aeaf117"]` → `pópo` |
| `prix` | direct `["ffbf014bd96ffabf"]`; resolved `["3b8c3b7a0c5e897d"]` → `Son` |
| `maman` | `["e5164efcdf5e6ca4"]` |
| `fièvre` | miss (deferred) |
| `comment dit-on école` | miss |
| `combien ça coûte` | miss |
| `merci beaucoup` | miss |
| `papa` | `["b8053579e3035e88"]` → `bàba` / `bàwa` |
| `père` | `["423369d78d42c100"]` → `fà` |

Closed 7N2A guardrails still pass inside 7N2B:

| Guardrail | Status |
| --- | --- |
| `hôpital` / `clinique` / `centre de santé` health mappings | PASS |
| `place` excludes health owner IDs / health display forms | PASS |
| `location` miss | PASS |
| `yoro` miss | PASS |

## 6. Risk review

| # | Risk | Assessment |
| --- | --- | --- |
| 1 | Catalog schema lacks explicit featured / status / promotion_stage fields | True. Provenance lives in `version` strings + reports. G11 must not invent schema fields unless a dedicated schema slice lands first. |
| 2 | Featured selection depends on `VITE_FEATURED_BUNDLE_ID` | True and preferred. Same mechanism used for 7N2A (F8). |
| 3 | Sort-first without env still returns 7J, not 7N2A or 7N2B | True. Do **not** promote by catalog sort order alone. |
| 4 | Four non-lexicographic `moto` alias posting keys preserve declared alias order | Documented contract exception (G7/G8/G9). Matrix expects declared order; non-blocking. |
| 5 | `Son` is owner-approved starter; orthography/tones may need later review | Accepted residual linguistic risk; owner approved starter use. |
| 6 | Runtime smoke ≠ full device / human QA | Accepted residual risk. G9 covered install/search paths; device/human-usage automation not re-run as featured. |
| 7 | Bundle slightly larger than 7N2A | records ~15.96 MiB vs ~15.96 MiB; search_index ~10.21 MiB vs ~10.21 MiB (small delta). Watch IndexedDB import/storage after promotion. |

## 7. Promotion mechanism recommendation

Preferred mechanism for **G11** (do **not** implement in G10):

```text
Update web/.env.production:

VITE_FEATURED_BUNDLE_ID=bundle_full_20260710_337619ff
```

Catalog provenance update in the future promotion slice should:

1. Mark 7N2B `version` as featured.
2. Mark 7N2A as prior/fallback.
3. Keep 7J as older rollback/fallback unless there is a clear reason to remove it.
4. Preserve all bundle IDs, URLs, and hashes.
5. Not rely on sort order.

Do not promote by renaming `bundle_id`s or unequal display names alone.

## 8. Rollback plan (for future G11)

If 7N2B promotion fails after G11:

1. Restore `web/.env.production` to:
   `VITE_FEATURED_BUNDLE_ID=bundle_full_20260708_27643bb0`
2. Keep 7N2B catalog-visible unless the issue is catalog parsing or bundle corruption.
3. Keep the 7J entry as older rollback.
4. Re-run featured 7L replay / runtime matrix, 7N2A smoke, and build against restored featured.
5. If the failure is specific to Son / prix / moto behavior, keep runtime on 7N2A while repairing 7N2B tables or matrix evidence.

Do not delete staged bundle directories unless the payload itself is corrupt.

## 9. Decision

```text
7N2B_READY_FOR_FEATURED_PROMOTION_NEXT_SLICE
```

Owner review, approved-table implementation, additive matrix, candidate gates,
review packaging/inspection, catalog-visible staging, and runtime smoke are
complete. Owner explicitly approved featured promotion for the next slice.
Remaining risks are mechanism/ops risks that G11 must address explicitly
(prefer `VITE_FEATURED_BUNDLE_ID`, avoid sort-only promotion).

## 10. Next slice definition

**Phase 7N2B4G11 — Promote 7N2B to Featured Runtime Bundle**

Purpose: make 7N2B the featured/default runtime bundle using
`VITE_FEATURED_BUNDLE_ID`, with 7N2A and 7J rollback paths preserved.

## 11. Confirmation: no env / catalog / runtime / bundle / source / matrix / package changes

G10 created only this report. No edits to:

- `web/.env.production`
- `web/public/catalog.json`
- any `web/public/bundle_*`
- `web/src/`
- aliases / supplements / target variants / search regression matrices
- `data/` / `api/` / `artifacts/review/` / packages / release documents
