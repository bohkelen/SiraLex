# CORPUS1F21 / F21A — Malidaba Canonical Source Refresh Apply + Commit Audit

## 1. Decision

**CORPUS1F21A_MALIDABA_CANONICAL_REFRESH_COMMIT_READY**

then

**CORPUS1F21_MALIDABA_CANONICAL_SOURCE_REFRESH_COMMITTED**

Real apply was already completed in CORPUS1F21. This document audits persistence,
post-apply test migration, ignored-IR reproducibility, and the Git commit boundary.

## 2. Base commit

`7a97fcefa05430e31cbbf2f6803af657e2dacf83` — *Design guarded Malidaba canonical refresh transaction*

## 3. Transaction identity

| Field | Value |
|-------|-------|
| Transaction id | `malidaba_src_refresh_f74bcf79ab25d11246d177af0b68dc5c` |
| Transaction manifest SHA | `43a226f1a8b4ed755b041666de72ca5d536048ff5b1e721cb26e7e229855ceda` |
| Rollback manifest SHA | `b8b20816413a794137f1cb3f1556e1f68aee13cb0bcd36189ca442d0b9f9ccac` |

## 4. Apply receipt SHA

`86ce27caf16abdbbfce1d8b883e945834fb2cb55a68be3d1b87b68ffbb58aaba`

Path (local evidence, not mutated):  
`data/malidaba_delta/current/source_refresh/f21/apply_receipt.json`

## 5. Apply execution-mode deviation

| Item | Value |
|------|-------|
| Execution mode | `F21_GITIGNORED_RUNNER_USING_COMMITTED_WRITE_PROTOCOL` |
| Committed CLI `--apply` | `REFUSED_BY_COMMITTED_CLI` |
| Why CLI refused | Intentional F20 safety: committed apply entrypoint refuses real mutation |
| Runner | Gitignored `f21/run_guarded_apply.py` |
| Write primitives | Committed `_write_atomic` / staging / rollback protocol |
| Candidate bytes | Exact F20A authorized staging hashes (8/8) |
| Lexical decisions | Unchanged — runner did not invent remaps or dispositions |

**Operational debt (still open):**  
`REAL_APPLY_ENTRYPOINT_SHOULD_BE_COMMITTED_AND_AUDITABLE`

## 6. Exact 8-path before/after hashes

Verified post-apply and again before commit (8/8 match):

| Path | After SHA-256 |
|------|----------------|
| `data/ir/malipense_lexicon_v3.jsonl` | `4d6e82e98638b5371aa80b09726cbf1f5a4a6de5fd4c3e006f7ec5591e2ae5de` |
| `data/ir/malidaba_legacy_retained_v1.jsonl` | `b74f22d36972fceb8622b61c31931f3a0d401820bc6bbb30c22eb2588da89764` |
| `shared/malidaba/malidaba_logical_lexical_continuity_v1.jsonl` | `e8df1bfc6abeef68c33ce9ca00df4526bc10b64ebf6f13b41119a8a573569bc0` |
| `shared/malidaba/malidaba_edition_to_logical_mapping_v1.jsonl` | `ee872549fcba49031f79aeb173d13f50aa50fbe0717e882f164fc31bf83b8bae` |
| `shared/aliases/source_aliases_v1.jsonl` | `0e896a79758d4bf6e697a3c9463234e9b95cf58f6f9b2361437646374499d76b` |
| `shared/source_index_supplements/source_index_supplements_v1.jsonl` | `d8e13a8b30592205410a85219cc21843b76017c27c6ac259970bc1db8d7c2c9f` |
| `shared/target_variants/reviewed_target_variants_v1.jsonl` | `69134e77cfc62102afa061548c8b425583c5a5eb07838de3d174ab32ed8ee759` |
| `data/ir/malipense_index_v1.jsonl` | `590c0ff9320f56cb88de016e2042ee9c9fd898717cea7f8cb5d53375ab38d7a4` |

## 7. Source counts

| Layer | Count |
|-------|------:|
| Current-edition assertions | 11694 |
| Legacy-retained assertions | 42 |
| Logical continuity objects | 57 |
| Deterministic / human-confirmed / legacy-only | 10 / 5 / 42 |
| Unresolved | 0 |

## 8. Provenance result

PASS — current vs legacy edition stamps separated; `current_edition_attribution` true only on current layer; two `kùn` logical ids remain distinct  
(`llx_5de95e8f1d687f38a5a7980c`, `llx_9fab8748ba668b0ca5ba2a51`).

## 9. Logical continuity result

Tracked `shared/malidaba/malidaba_logical_lexical_continuity_v1.jsonl` = F19 frozen logical bytes  
(`e8df1bfc…`). Edition→logical mapping = 72 rows (`ee872549…`).

## 10. 19 preserved conflicts

`current_wins_overwrite: false` retained on conflicting dual-edition assertions (count 19).

## 11. Regression 30/0

Rebuilt from **durable authorities** (materialized ignored IR + tracked remaps), not by trusting applied IR as input:

- canonical_pass=30, canonical_fail=0  
- staged/refresh_pass=30, staged_fail=0  
- matches_f19_behavior=True  

## 12. Reference closure

total=120 · resolved=120 · ambiguous=0 · broken=0 · ok=True

## 13. G1–G10

All PASS (F21 receipt + post-apply re-validation of G7/G8/G9 and product rebuild):

| Gate | Status |
|------|--------|
| G1 SOURCE_CAPTURE | PASS |
| G2 PARSER_COMPATIBILITY | PASS |
| G3 BASELINE_REGRESSION | PASS |
| G4 STRUCTURAL_COVERAGE | PASS |
| G5 DELTA_DETERMINISTIC | PASS |
| G6 REVIEW_EVIDENCE | PASS |
| G7 REFERENCE_INTEGRITY | PASS (ambiguous=0, broken=0, requires_remap=0) |
| G8 ISOLATED_BUILD_REGRESSION | PASS (30/0) |
| G9 NO_UNREVIEWED_DESTRUCTIVE | PASS (retain=42, unresolved=0) |
| G10 RIGHTS | PASS |

## 14. Rights

| Channel | Posture |
|---------|---------|
| internal | allowed |
| noncommercial | requires_rights_review |
| commercial | blocked |

Claimed license: CC BY-NC-SA 4.0. Purpose: internal_source_maintenance.

## 15. Publication unchanged

`web/public` catalog + published bundle hashes unchanged before/after apply.  
No writes into `web/public`. `web/scripts/` untouched by this commit.

## 16. Review registry hashes

| Registry | SHA-256 |
|----------|---------|
| F13 delta reviews | `6ada0ee6381379ae1f260c9317e6c6ca4233d76b1dcbc0e198ade21dc8e46104` |
| F18 Type-A | `90fabd1e2da5b085e77bb621096f291355d2fcaea7a96884160dc572935573f9` |
| F18 Type-B | `684e18f9b5ae1067e7de7a4e5363aa86d9d05d53f23aeec991f3c686fcf8cfc1` |

## 17. Post-apply test non-pass diagnosis

Original post-apply `malipense_version_delta` run: **197 passed · 1 failed · 16 errors**.

| # | Test | Old assumption | Actual applied state | Classification | Remediation |
|---|------|----------------|----------------------|----------------|-------------|
| 1 | `test_g7_g9_rights_canonical_invariants_on_local_data` | `paths.baseline_ir` → `data/ir/malipense_lexicon_v3.jsonl` hash `97529fc9…` | Lexicon path is current edition `4d6e82e9…` | `TEST_READS_MUTABLE_CANONICAL_AS_HISTORICAL_FIXTURE` | Point `baseline_ir` at frozen historical artifact; assert applied lexicon separately |
| 2–17 | All 16 `test_canonical_refresh_transaction.py::*` errors | Freeze/setup requires historical baseline hash at mutable lexicon path | Same collision | `STALE_PRE_REFRESH_FIXTURE` / `TEST_READS_MUTABLE_CANONICAL_AS_HISTORICAL_FIXTURE` | Bind freezes to `malidaba_baseline_ir.jsonl` (`97529fc9…`); keep freeze hash assertions strict |

Additional suite failures discovered when expanding beyond the original 17 (also stale contracts, not product defects):

| Test | Classification | Remediation |
|------|----------------|-------------|
| `test_tracked_health_rows_validate_with_durable_assembly_only` | `TEST_READS_MUTABLE_CANONICAL_AS_HISTORICAL_FIXTURE` (remapped Malidaba supplements vs historical published index; cross-edition `ir_id` collisions) | Scope validate/generate/merge to owner health rows only |
| `test_cumulative_phase7b_phase7d_replay_matches_current_bundle_states` | `STALE_PRE_REFRESH_FIXTURE` | Load pre-refresh supplements via `git show 7a97fce:…` (`172a0e59…`) |
| `test_tracked_overlay_contains_approved_mobaa_row` | `STALE_CANONICAL_HASH_EXPECTATION` | Expect remapped current id `b5023f3908fe9ec5` |

**Real post-apply defects: 0**

## 18. Historical fixture migration

| Concern | Action |
|---------|--------|
| Historical January baseline | `data/malidaba_delta/current/artifacts/malidaba_baseline_ir.jsonl` = `97529fc9…` |
| `default_paths().baseline_ir` | Now that historical artifact (not mutable lexicon) |
| Current lexicon checks | `FROZEN_APPLIED_CURRENT_LEXICON_SHA256` / applied destination map |
| Freeze safety | Still fails if historical bytes change — no `{old,new}` dual accept |

## 19. Git persistence classification of all 8 paths

| Path | Tracked | Ignored | Role | Durable authority | Reproduction | Expected hash |
|------|---------|---------|------|-------------------|--------------|---------------|
| `data/ir/malipense_lexicon_v3.jsonl` | NO | YES (`data/ir/*`) | GOVERNED materialization (current edition) | Frozen current capture IR `fb8e97b0…` + edition-layer stamp rules | `materialize_ignored_ir_candidates` / `build_canonical_layers` | `4d6e82e9…` |
| `data/ir/malidaba_legacy_retained_v1.jsonl` | NO | YES | GOVERNED materialization (legacy) | Historical baseline IR `97529fc9…` + F18 Type-B retain set (cross-checked vs tracked LEGACY_RETAINED) + stamp rules | same | `b74f22d3…` |
| `shared/malidaba/malidaba_logical_lexical_continuity_v1.jsonl` | YES (this commit) | NO | GOVERNED continuity | F19 logical bytes | commit | `e8df1bfc…` |
| `shared/malidaba/malidaba_edition_to_logical_mapping_v1.jsonl` | YES (this commit) | NO | GOVERNED mapping | Derived from logical objects | commit | `ee872549…` |
| `shared/aliases/source_aliases_v1.jsonl` | YES | NO | DETERMINISTIC_DERIVED | F19 remapped virtual aliases | commit | `0e896a79…` |
| `shared/source_index_supplements/…` | YES | NO | DETERMINISTIC_DERIVED | F19 remapped virtual supplements | commit | `d8e13a8b…` |
| `shared/target_variants/…` | YES | NO | DETERMINISTIC_DERIVED | F19 remapped virtual variants | commit | `69134e77…` |
| `data/ir/malipense_index_v1.jsonl` | NO | YES | DETERMINISTIC_DERIVED | F19 `index_ir_virtual.jsonl` `590c0ff9…` | copy/materialize from frozen F19 virtual index | `590c0ff9…` |

**Policy:** Do **not** `git add -f data/ir/**`. Established architecture treats IR under `data/ir/*` as local materialization.

## 20. Reproduction proof for ignored IR

Module: `api/malipense_version_delta/source_refresh/transaction/materialize_ir.py`

Rebuilds all three ignored IR destinations **without reading applied files**. Cross-checks Type-B retain population against tracked logical `LEGACY_RETAINED`.

## 21. Fresh-state reproducibility hashes

| Artifact | Result | Hash |
|----------|--------|------|
| lexicon | PASS | `4d6e82e98638b5371aa80b09726cbf1f5a4a6de5fd4c3e006f7ec5591e2ae5de` |
| legacy | PASS | `b74f22d36972fceb8622b61c31931f3a0d401820bc6bbb30c22eb2588da89764` |
| index | PASS | `590c0ff9320f56cb88de016e2042ee9c9fd898717cea7f8cb5d53375ab38d7a4` |

**3 / 3 exact.**

## 22. Real-apply entrypoint operational debt

YES — `REAL_APPLY_ENTRYPOINT_SHOULD_BE_COMMITTED_AND_AUDITABLE`

Not redesigned in F21A; apply remains auditable via receipt + committed write protocol used by the local runner.

## 23. Tests

Broader post-refresh suites (after fixture migration):

| Suite set | Result |
|-----------|--------|
| `malipense_version_delta/tests` + `source_aliases` + `source_index_supplements` + `target_variants` + `search_regression` | **394 passed**, 0 failed, 0 errors |

(Plus earlier isolated `malipense_version_delta` 215 passed after historical-path migration.)

## 24. git diff --check

PASS

## 25. Final commit contents

Tracked only:

- remapped `shared/aliases/source_aliases_v1.jsonl`
- remapped `shared/source_index_supplements/source_index_supplements_v1.jsonl`
- remapped `shared/target_variants/reviewed_target_variants_v1.jsonl`
- new `shared/malidaba/*` (logical continuity + edition mapping)
- historical/current fixture separation in paths, frozen hashes, tests
- `transaction/materialize_ir.py` reproducibility helper
- this audit report

**Not committed:** `data/ir/**`, `data/malidaba_delta/**`, `web/scripts/**`, publication surfaces.

### Unique governance only in ignored files?

**NO.** Retain population is durable in tracked `shared/malidaba` logical continuity. Legacy IR is regenerable. Type-B registry remains the hash-frozen local F18 operational authority for `review_id` stamps (same Malidaba delta workspace model as F11–F20); it is not unique state that exists only inside ignored IR bytes.
