# Phase 7N2B4G13 — Close Phase 7N2B Promotion Record

## Closure decision

```text
PHASE_7N2B_PROMOTION_CLOSED_STABLE
```

Closure/reporting only. No runtime pointer, catalog, bundle payload, source,
matrix, test, package, or review-artifact changes in this slice.

## 1. Final featured identity

| Field | Value |
| --- | --- |
| Featured `bundle_id` | `bundle_full_20260710_337619ff` |
| Mechanism | `web/.env.production` → `VITE_FEATURED_BUNDLE_ID=bundle_full_20260710_337619ff` |
| Catalog version | `norm-v3-featured-7n2b4g11-7l13-7n2a8-7n2b9-runtime-smoke-pass` |
| Path | `web/public/bundle_full_20260710_337619ff/` |
| `content_sha256` | `sha256:337619ff43131acde1390d7892d687372785729dac5d85abe82b61cc92285c3c` |
| `records_sha256` | `sha256:d99242ed0c049759ec265f3583683c99a3146854b4481b6d3de86cbd33f50a90` |
| `search_index_sha256` | `sha256:55bf98fc99a592f7003aa338fc7b4790bc9cd642b676c99a725d83a5f9ca79e3` |
| Promotion commit | `043e732` — Promote 7N2B to featured runtime bundle |
| Post-promotion monitoring | `ef2d317` — `7N2B_POST_PROMOTION_STABLE` |

## 2. Final fallback inventory

| Role | `bundle_id` | Catalog version |
| --- | --- | --- |
| Featured | `bundle_full_20260710_337619ff` | `norm-v3-featured-7n2b4g11-7l13-7n2a8-7n2b9-runtime-smoke-pass` |
| Prior featured / fallback | `bundle_full_20260708_27643bb0` | `norm-v3-prior-featured-fallback-7n2a4f8` |
| Older rollback | `bundle_full_20260616_phase7j_alias_round2_candidate` | `norm-v3-prior-featured-fallback-phase7j` |

All three remain catalog-visible under `web/public/`. Featured selection is
env-based; sort-first without env still returns 7J.

## 3. Evidence chain summary (G0–G12)

| Slice | Report | Decision / outcome |
| --- | --- | --- |
| **G0** | `phase7n2a4g0_next_linguistic_expansion_tranche_report.md` | `NEXT_TRANCHE_DEFINED_READY_FOR_OWNER_REVIEW` — defined 7N2B everyday lemma recovery tranche |
| **G1** | `phase7n2b4g1_candidate_table_report.md` | `7N2B_CANDIDATE_TABLE_READY_FOR_OWNER_REVIEW` — drafted candidate table |
| **G2** | `phase7n2b4g2_owner_review_approval_record.md` | `7N2B_OWNER_REVIEW_APPROVED_PARTIAL_IMPLEMENTATION` — moto / phrases / papa≠père / prix→Son approved; fièvre deferred |
| **G3** | `phase7n2b4g3_linguistic_tables_report.md` | `7N2B_APPROVED_TABLES_IMPLEMENTED` — moto alias + Son owner lexical + prix supplement |
| **G4** | `phase7n2b4g4_regression_matrix_report.md` | `7N2B_ADDITIVE_MATRIX_READY` — 9 additive cases |
| **G5** | `phase7n2b4g5_candidate_acceptance_gates_report.md` | `7N2B_CANDIDATE_GATES_PASS_READY_FOR_REVIEW_PACKAGING` — 7L 13/13, 7N2A 8/8, 7N2B 9/9 |
| **G6** | `phase7n2b4g6_review_packaging_report.md` | `7N2B_REVIEW_ARTIFACT_PACKAGED_NOT_PROMOTED` |
| **G7** | `phase7n2b4g7_review_artifact_inspection_report.md` | `STAGE_AS_CATALOG_VISIBLE_CANDIDATE_NEXT_SLICE` |
| **G8** | `phase7n2b4g8_catalog_visible_candidate_report.md` | `7N2B_CATALOG_VISIBLE_CANDIDATE_STAGED_NOT_FEATURED` |
| **G9** | `phase7n2b4g9_runtime_candidate_smoke_test_report.md` | `7N2B_RUNTIME_SMOKE_PASS_CANDIDATE_READY_FOR_FEATURED_PROMOTION_REVIEW` |
| **G10** | `phase7n2b4g10_featured_promotion_readiness_report.md` | `7N2B_READY_FOR_FEATURED_PROMOTION_NEXT_SLICE` — owner approved promotion |
| **G11** | `phase7n2b4g11_featured_promotion_report.md` | `7N2B_FEATURED_PROMOTION_COMPLETE` — env + catalog provenance |
| **G12** | `phase7n2b4g12_post_promotion_runtime_monitoring_report.md` | `7N2B_POST_PROMOTION_STABLE` |
| **G13** | this report | `PHASE_7N2B_PROMOTION_CLOSED_STABLE` |

Arc:

```text
G0: defined 7N2B tranche
G1: drafted candidate table
G2: owner review / partial approval
G3: implemented approved linguistic tables
G4: added additive regression matrix
G5: recomposed candidate and ran gates
G6: packaged review artifact
G7: inspected artifact and approved staging
G8: staged catalog-visible candidate, not featured
G9: runtime candidate smoke passed
G10: readiness review approved promotion
G11: promoted 7N2B to featured runtime bundle
G12: post-promotion monitoring stable
G13: close promotion record
```

## 4. Final promoted behavior

User-visible deltas shipped with featured 7N2B:

| Query | Behavior |
| --- | --- |
| `moto` | `["b5c9a49f6db2a991", "0a56b8047aeaf117"]` → `pópo` |
| `prix` | direct `["ffbf014bd96ffabf"]`; resolved `["3b8c3b7a0c5e897d"]` → `Son` |

## 5. Preserved boundaries and guardrails

| Query / contract | Behavior |
| --- | --- |
| `maman` | `["e5164efcdf5e6ca4"]` |
| `fièvre` | miss (deferred) |
| `comment dit-on école` | miss |
| `combien ça coûte` | miss |
| `merci beaucoup` | miss |
| `papa` | `["b8053579e3035e88"]` → `bàba` / `bàwa` |
| `père` | `["423369d78d42c100"]` → `fà` |
| `hôpital` / `clinique` / `centre de santé` | health mappings pass |
| `place` | excludes health owner IDs |
| `location` | miss |
| `yoro` | miss |

## 6. Final replay / test / build evidence

From G12 post-promotion monitoring (no re-run required in G13):

| Evidence | Result |
| --- | --- |
| Frozen 7L | **13 / 13** |
| Additive 7N2A | **8 / 8** |
| Additive 7N2B | **9 / 9** |
| Full `test:run` | **25 files / 252 tests passed** |
| `npm --prefix web run build` | **succeeded** |

Final accepted identity hashes remain as in §1.

## 7. Residual risks

| # | Risk |
| --- | --- |
| 1 | Catalog schema still lacks explicit featured / status / promotion_stage fields. |
| 2 | Featured selection remains env-dependent. |
| 3 | Sort-first without env still returns 7J. |
| 4 | `Son` remains an owner-approved starter form and may need orthography/tone review. |
| 5 | Runtime smoke is not full field / device / human QA. |
| 6 | Bundle size / import / storage behavior should be watched after real use. |

## 8. Rollback instructions

To rollback to 7N2A:

1. Set `web/.env.production` back to:
   `VITE_FEATURED_BUNDLE_ID=bundle_full_20260708_27643bb0`
2. Keep 7N2B catalog-visible unless bundle corruption or catalog parsing is the issue.
3. Keep 7J as older rollback.
4. Re-run featured smoke, 7L replay, full `test:run`, and build.

## 9. Next follow-up recommendation

Do **not** implement a new linguistic tranche in G13. Next work should start as a
planning slice that chooses one small follow-up from owner review + real misses.

**Recommended next slice:**

**Phase 7N2C4H0 — Define Next Post-7N2B Follow-Up**

Purpose: choose the next small linguistic/product tranche after stable 7N2B
promotion, using real misses, owner review, and explicit risk boundaries.

Candidate follow-up areas (menu only; not selected here):

1. `Son` orthography/tone review for `prix`.
2. Deferred `fièvre` owner lexical review.
3. `bonjour` / greeting packet.
4. `poulet` everyday lemma review.
5. Phrase UX / “try one word” guidance rather than phrase aliases.
6. Catalog schema improvement: explicit featured / status / promotion_stage field.
7. Post-promotion storage/import observation after real use.

## 10. Confirmation: no env / catalog / runtime / bundle / source / matrix / package / review-artifact changes

G13 created only this report. No edits to:

- `web/.env.production`
- `web/public/catalog.json`
- any `web/public/bundle_*`
- `web/src/`
- aliases / supplements / target variants / search regression matrices
- `data/` / `api/` / `artifacts/review/` / packages / release documents

## 11. Closure decision

```text
PHASE_7N2B_PROMOTION_CLOSED_STABLE
```

7N2B is the featured/default runtime bundle with 7N2A and 7J rollback paths
preserved, acceptance/replay/smoke evidence complete, and post-promotion
monitoring green.

## 12. Next slice definition

**Phase 7N2C4H0 — Define Next Post-7N2B Follow-Up**

Purpose: choose the next small linguistic/product tranche after stable 7N2B
promotion, using real misses, owner review, and explicit risk boundaries.
