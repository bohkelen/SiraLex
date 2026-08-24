# CORPUS1F20 — Malidaba Canonical Refresh Transaction Design + Full Dry-Run

## 1. Decision

**CORPUS1F20_MALIDABA_CANONICAL_REFRESH_TRANSACTION_READY**

Overall staged candidate: **SOURCE_REFRESH_ENGINEERING_READY**

Real canonical apply was **not** executed. F20 code/tests/report remain **uncommitted** for review.

## 2. F19 commit / base

| Item | Value |
|------|-------|
| CORPUS1F19 commit | `1d6240cdac66d3cfd9f1e53a57514673ca31ce5d` |
| Transaction base at F20 rehearsal | `1d6240cdac66d3cfd9f1e53a57514673ca31ce5d` (HEAD while F20 code was uncommitted) |
| F19 decision | `CORPUS1F19_MALIDABA_TRANSITION_REGRESSIONS_CLOSED` |

Transaction identity is **commit-anchored**: `base_git_commit` defaults to
current `HEAD`. The F20 rehearsal id
`malidaba_src_refresh_ba535193c4550a5a83f6a35a5bf6e126` is therefore
**REHEARSAL_ONLY** and must be superseded by a reanchor after this
implementation is committed (CORPUS1F20A).

## 3. Frozen transaction inputs

**PASS** — all required artifacts verified by SHA-256 before staging.

Frozen roles include: baseline canonical Malidaba IR, current corrected IR, trusted F11 delta, F13 review registry, F15 acceptance, F18 Type-A / Type-B registries, F19 closure receipt, logical continuity graph, identity overlay, remapped aliases / supplements / target variants / index IR, F19 regression replay records + search index, canonical published bundle baseline.

Any hash mismatch raises `FrozenTransactionInputError` and blocks before write.

## 4. Actual canonical mutation surface

**8** destination paths (discovered from repository reality + staged bytes):

| Path | Role | Kind |
|------|------|------|
| `data/ir/malipense_lexicon_v3.jsonl` | SOURCE_CURRENT_EDITION | GOVERNED |
| `data/ir/malidaba_legacy_retained_v1.jsonl` | SOURCE_LEGACY_ASSERTIONS | GOVERNED (new) |
| `shared/malidaba/malidaba_logical_lexical_continuity_v1.jsonl` | LOGICAL_CONTINUITY | GOVERNED (new) |
| `shared/malidaba/malidaba_edition_to_logical_mapping_v1.jsonl` | EDITION_TO_LOGICAL_MAPPING | GOVERNED (new) |
| `shared/aliases/source_aliases_v1.jsonl` | DOWNSTREAM_PROJECTION | DERIVED |
| `shared/source_index_supplements/source_index_supplements_v1.jsonl` | DOWNSTREAM_PROJECTION | DERIVED |
| `shared/target_variants/reviewed_target_variants_v1.jsonl` | DOWNSTREAM_PROJECTION | DERIVED |
| `data/ir/malipense_index_v1.jsonl` | DOWNSTREAM_PROJECTION | DERIVED |

Normalized/enriched/search index/bundles are **BUILD_DERIVED** and are **not** destination writes in this transaction.

## 5. Canonical target source model

Three distinct layers (never flattened into one fake current edition):

1. **Current-edition source assertions** — corrected current Malidaba IR with current provenance stamps.
2. **Legacy-retained source assertions** — exactly 42 `retain_baseline_record` baseline assertions with baseline provenance only.
3. **Stable logical lexical continuity** — governed continuity objects joining editions via `logical_lexical_id`.

## 6. Current-edition layer

- Count: **11694** assertions
- Stamp schema: `malidaba_edition_layer_v1` / `current_edition`
- `current_edition_attribution: true`
- Rights: CC BY-NC-SA 4.0; purpose `internal_source_maintenance`

## 7. Legacy-retained layer

- Count: **42**
- Stamp schema: `malidaba_legacy_retained_assertion_v1` / `baseline_edition`
- `current_edition_attribution: false`
- Retains baseline `ir_id`, source locator, rights, and human Type-B disposition

## 8. Logical lexical layer

| Continuity class | Count |
|------------------|-------|
| Deterministic baseline→current | 10 |
| Human-confirmed baseline→current | 5 |
| Legacy-only retained | 42 |
| **Total logical objects** | **57** |
| Unresolved | **0** |

Homographs: two `kùn` Type-A logical ids remain distinct  
(`llx_5de95e8f1d687f38a5a7980c`, `llx_9fab8748ba668b0ca5ba2a51`).

## 9. Downstream projection policy

Prefer **logical authority → deterministic runtime projection**:

- Aliases / supplements / target variants: runtime current-edition `ir_id` projected from continuity
- Index mappings: source locator (`source_record_id`) rewritten via continuity successor (locator ≠ lexical identity)
- Search regression expectations: remain edition-runtime for now; future contracts should prefer `logical_lexical_id`
- Phrase review: evidence-only in F20 (not a mutation destination)

## 10. Governed vs generated artifacts

- **GOVERNED (4):** current IR, legacy retained IR, logical continuity, edition→logical mapping
- **DETERMINISTIC_DERIVED (4):** aliases, supplements, target variants, index IR projections  
  (bytes taken from frozen F19 remapped virtual product; not new independent governance)

## 11. Staged canonical tree

Gitignored workspace: `data/malidaba_delta/current/source_refresh/f20/`

- `staging/` — mirrored destination layout with precomputed candidate bytes
- `rollback_before/` — exact before-bytes for every destination
- `rollback_drills/` — simulated apply/rollback A–D
- `staged_build/` — product assembly from staged inputs only
- Manifests: `transaction_manifest.json`, `rollback_manifest.json`, `transaction_dry_run.json`

## 12. Exact source counts

| Semantic count | Value |
|----------------|-------|
| Current-edition Malidaba assertions | 11694 |
| Legacy-retained baseline assertions | 42 |
| Logical continuity objects | 57 |
| Deterministic continuity | 10 |
| Human-confirmed continuity | 5 |
| Legacy-only continuity | 42 |
| Unresolved continuity | 0 |
| Conflicting field-level assertions | 19 |

Do **not** interpret “11694 + 42” as a single current Malidaba edition.

## 13. Provenance validation

PASS:

- Every current assertion stamped current-edition
- Every legacy-retained assertion stamped baseline-only
- No legacy-only assertion claims current attribution
- Logical objects point at real edition `ir_id`s; no contradictory multi-map
- Homographs remain distinct
- Conflicts preserve `current_wins_overwrite: false`

## 14. Rights validation

Unchanged:

- internal = **allowed**
- noncommercial = **requires_rights_review**
- commercial = **blocked**

Transaction purpose: **INTERNAL SOURCE MAINTENANCE** (not publication authorization).

## 15. Publication boundary

Discovered publication surfaces (out of scope): `web/public/`, `web/public/catalog.json`, published bundles under `web/public/bundle_*`.

**Publication paths in transaction: 0**

## 16. Transaction manifest

| Field | Value |
|-------|-------|
| Schema | `malidaba_source_refresh_transaction_v1` |
| Transaction id | `malidaba_src_refresh_ba535193c4550a5a83f6a35a5bf6e126` |
| Manifest SHA-256 | `1ba8305f8562b9a2efe383fb3a44af87d31f8d51a32d66286a85a95c8cfbd63d` |
| Rollback manifest SHA-256 | `ccfd8cbfbc8ff214c15b5af745e768b33c51367d11cf334e77f8a4f5c3ddab67` |

Transaction id is deterministic from base commit + frozen input hashes + mutation paths (no random UUID).

## 17. Preconditions

Fail-closed for future `--apply`. Dry-run mode allows F20 dirty tracked code; apply mode recorded as blocked while working tree is dirty (`dirty_tracked_working_tree`).

Also require: HEAD = expected base, frozen hashes, destination-before hashes, F18 registries, G1–G10 PASS, 30/0 canonical + staged regression, rights unchanged, no publication / `web/scripts` in plan.

## 18. Precomputed candidate bytes

All 8 destination byte streams are fully materialized and hash-verified **before** any simulated write. No read→mutate→discover-invalid sequencing.

## 19. Apply protocol (designed, not executed)

CLI: `siralex-malipense-canonical-refresh-transaction`

- Default = validate / dry-run
- Explicit `--apply` required for real writes (**REFUSED in F20**)
- Requires expected transaction id + expected base commit
- Phases: prepare → validate → apply → post-validate → rollback-on-failure

## 20. Rollback protocol

Before first mutation, retain exact before-bytes. Each write: temp sibling → fsync → validate → replace → directory fsync. On any failure: restore all destinations from before-bytes; verify SHA-256; only then report rollback success. New files: delete only if exact transaction-created hash matches.

## 21. Rollback drill results

All drills inside staging only (no real canonical paths):

| Drill | Result |
|-------|--------|
| success_path | PASS |
| fail_after_first_write | PASS |
| fail_mid_transaction | PASS |
| fail_post_validation | PASS |

## 22. Transaction diff summary

See local `f20/transaction_diff_report.json` for per-path before/after SHA and row counts. Semantic reasons:

- Current IR: install corrected current-edition assertions
- Legacy IR: persist 42 retained baseline assertions as a separate layer
- Logical + edition map: install stable identity authority
- Downstream tables: project through continuity (F19 proven remaps)

## 23. Conflicting assertion preservation

**19** conflicting field-level assertions preserved as competing provenance-bearing assertions. Silent current-wins overwrite is forbidden (`current_wins_overwrite: false`). Conflict presence is not a transaction blocker under the continuity model.

## 24. Full reference closure

Staged identity-bearing surface (aliases + supplements + target variants):

| Metric | Value |
|--------|-------|
| total | 120 |
| resolved | 120 |
| through logical continuity | 30 |
| ambiguous | 0 |
| broken | 0 |

## 25. Future-edition identity simulation

PASS — renumbering a mapped current `ir_id` / locator while preserving `logical_lexical_id` regenerates downstream projection without treating `source_record_id` as lexical identity.

## 26. Staged build results

PASS — assembled from staged canonical inputs via normalizer → enrichment → variants → aliases → supplements → index → regression replay.

## 27. Regression results

| Suite | pass | fail |
|-------|------|------|
| Canonical published baseline | 30 | 0 |
| Staged candidate | 30 | 0 |

Differential G8: no transition-introduced or worsened failures.

## 28. G1–G10 results

| Gate | Status |
|------|--------|
| G1 | PASS |
| G2 | PASS |
| G3 | PASS |
| G4 | PASS |
| G5 | PASS |
| G6 | PASS |
| G7 | PASS |
| G8 | PASS |
| G9 | PASS |
| G10 | PASS |

## 29. Tests

`api/malipense_version_delta/tests/test_canonical_refresh_transaction.py` covers frozen mismatch, base commit, dirty tree, destination-before mismatch, publication / web/scripts blocks, provenance separation, logical stability, locator≠identity, precomputed bytes, deterministic id/manifest, rollback drills (first/mid/post/new-file), future renumber, surface exclusions, and dry-run receipt invariants.

## 30. Non-mutation

**PASS** — canonical Malidaba source artifacts, tracked downstream tables, F13/F18 registries, owner IR, `web/public`, and publication paths unchanged during F20 dry-run.

## 31. git diff --check

**PASS**

## 32. Working tree

Tracked F20 additions under `api/malipense_version_delta/source_refresh/transaction/`, path constants, tests, this report, and `api/pyproject.toml` entrypoint — **left uncommitted**.

Do not commit: `data/malidaba_delta/**`, `web/scripts/`.

## 33. Recommendation for real canonical apply

**EXPLICIT GUARDED CANONICAL SOURCE-REFRESH APPLY** is appropriate only after:

1. ChatGPT / human review of this F20 design
2. Clean tracked working tree on the approved base
3. Re-running dry-run with apply-mode preconditions PASS
4. Explicit `--apply` with matching transaction id + base commit

F20 proves the rehearsal; it does **not** authorize publication or automatic apply.
