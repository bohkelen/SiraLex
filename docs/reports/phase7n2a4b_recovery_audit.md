# Phase 7N2A4B Recovery Audit

**Status:** read-only audit (Phase 7N2A4B-R Part A, B, D, E)  
**Audited commit:** `ce055dc5243ba6e7ea47a359b896959f03283267`  
**Date:** 2026-07-05

This audit explains why the prior 7N2A4B attempt is not accepted as complete and records the repository decisions required before a corrective implementation slice.

---

## Part A — Failed commit and working-tree authority

### What `ce055dc` actually committed

| Path | Action |
| --- | --- |
| `api/normalizer/tests/test_lexical_review.py` | modified (+72 lines) |
| `docs/reports/phase7n2a4b_manual_lexical_records_report.md` | added (+217 lines) |

**Not committed:** `data/ir/siralex_owner_lexical_v1.jsonl`, `data/normalized/malipense_normalized_norm_v3.jsonl`, `data/enriched/malipense_enriched_norm_v3.jsonl`, or any other `data/` artifact.

### Ignore rule for owner lexical IR

```text
.gitignore:43:data/    data/ir/siralex_owner_lexical_v1.jsonl
```

Rule text at line 42–43:

```text
# Snapshot data (raw captures - do not commit to git)
data/
```

The entire `data/` tree is ignored. No `!data/ir/...` exception exists. `git ls-files data/` returns no tracked files on the current branch.

### Does the report claim committed source content exists when it does not?

**Yes — partially, with contradictory disclosure.**

| Report claim | Fact |
| --- | --- |
| `**Status:** implementation complete` (line 3) | Overstates completion: authoritative source rows are not in Git and full combined-input normalization failed. |
| Identity table marks normalized/enriched verification as `yes` (lines 15–16) | True only on a machine that already holds ignored local artifacts produced by a partial/manual pipeline. |
| `data/ir/siralex_owner_lexical_v1.jsonl` listed as `created` in Files changed (line 197) | Created locally only; not reproducible from `ce055dc`. |
| Closing paragraph states records were added with traceable provenance (line 217) | Provenance blocks are absent from IR rows; `provenance.source` / `derivation` exist only as narrative in the report. |
| Repository note acknowledges `data/` gitignore (line 203) | Accurate, but does not reconcile with `implementation complete` or verified-projection claims. |

**Conclusion:** `ce055dc` documents a successful local insertion but does not make that insertion reproducible from version control.

### Test coverage: retain vs discard

| Test / pattern | Verdict |
| --- | --- |
| Pre-existing generic tests (`manual_lexical_ir()`, evidence validation, reviewed-target-variant guards) | **Retain** — schema-contract coverage independent of disk artifacts. |
| `test_owner_lexical_ir_file_records_validate_and_have_distinct_ir_ids` | **Rewrite** — depends on ignored `data/ir/siralex_owner_lexical_v1.jsonl`; fails on fresh clone. |
| `test_owner_lexical_ir_ids_match_deterministic_repository_method` | **Retain logic, change fixture source** — deterministic `ir_id` check is valuable; should use committed inline fixture or tracked IR file, not ignored path. |
| `test_owner_lexical_records_normalize_to_approved_canonical_forms` | **Retain logic, change fixture source** — normalization behavior check is valid; should not require local-only data. |

### Claims dependent on ignored local data

The following `ce055dc` artifacts depend on ignored local state:

- Three new tests via `OWNER_LEXICAL_IR_PATH` → `data/ir/siralex_owner_lexical_v1.jsonl`
- Report rows for normalized/enriched verification
- Report negative-guard row 1 referencing on-disk owner lexical file
- Report pipeline section describing merge into `malipense_normalized_norm_v3.jsonl` (+2 rows → 19,326 total)
- Report enrichment/gate pass counts tied to locally regenerated enriched file

None of these can be reproduced from Git contents of `ce055dc` alone.

### Repository-approved strategy for versioning authoritative owner-reviewed lexical data

Observed repository posture:

| Artifact class | Current Git treatment | Documented authority |
| --- | --- | --- |
| Mali-Pense frozen IR (`malipense_lexicon_v3.jsonl`, `malipense_index_v1.jsonl`) | Ignored under `data/`; immutability via `v1.0-dataset-freeze` tag / local discipline (`docs/DATASET.md`) | Authoritative locally, not tracked on branch |
| Generated normalized/enriched | Ignored under `data/` | Derived; regenerate from IR |
| Owner-reviewed lexical IR (`siralex_owner_lexical_v1.jsonl`) | Ignored under `data/` | **Designated authoritative source** in `docs/PHASE_7N2A3_SCHEMA_AND_ARTIFACT_DECISION.md` line 127 |
| Governed non-snapshot evidence | Explicit path outside default ignore when reviewed (`docs/LOCAL_USAGE_AUTOMATION.md`) | Local unless moved to governed path |

**Gap:** 7N2A3 assigns `data/ir/siralex_owner_lexical_v1.jsonl` as the authoritative artifact for project-authored lexical additions, but `.gitignore` blanket rule `data/` prevents Git from holding that authority. Unlike bulk Mali-Pense snapshots, these two rows are small, owner-governed, and intended to be reproducible project source — not regenerated pipeline output.

---

## Part B — Version-control treatment decision

**Chosen approach: Option 1 — track `data/ir/siralex_owner_lexical_v1.jsonl` with the narrowest `.gitignore` adjustment.**

### Rationale

| Option | Assessment |
| --- | --- |
| **1. Narrow gitignore exception for `data/ir/siralex_owner_lexical_v1.jsonl`** | **Selected.** Matches 7N2A3 path exactly; separates project-authored lexical source from ignored snapshots and generated projections. |
| 2. Move to another tracked location | Rejected — would contradict approved 7N2A3 artifact path and require spec/doc realignment without benefit. |
| 3. Use existing tracked source mechanism | Rejected — no tracked store exists for manual `lexicon_entry` IR rows; `shared/sources/` holds registry metadata only. |

### Proposed `.gitignore` adjustment (design only — not applied in 7N2A4B-R)

Replace blanket `data/` with scoped ignores that preserve generated outputs ignored while allowing the single authoritative owner IR file:

```gitignore
# Snapshot / pipeline data (do not commit)
data/*
!data/ir/
data/ir/*
!data/ir/siralex_owner_lexical_v1.jsonl
```

**Still ignored:** `data/normalized/`, `data/enriched/`, `data/local_evidence/`, raw captures, bundles, and all other `data/ir/*` Mali-Pense files.

**Rejected:** Broad `data/` un-ignore.

---

## Part D — Manual provenance completion design

### Current local rows (both records share the same field posture)

Audited against `docs/PHASE_7N2A3_SCHEMA_AND_ARTIFACT_DECISION.md` minimum manual-record profile.

| Field | `7n2a_ndandayoro_v1` | `7n2a_ndandadiya_v1` | Pipeline preservation today |
| --- | --- | --- | --- |
| `source_id` | present (`src_siralex_lexical_review`) | present | preserved as `source_id` on normalized output |
| `source_record_id` | present (`7n2a_ndandayoro_v1`) | present (`7n2a_ndandadiya_v1`) | in IR only; not copied to normalized record |
| `url_canonical` | present (`siralex://lexical-review/7n2a/ndandayoro`) | present (`siralex://lexical-review/7n2a/ndandadiya`) | in IR only |
| `parser_version` | present (`siralex_owner_lexical_v1`) | present | in IR only |
| `record_locator` | present | present | in IR only |
| `evidence[].review_reference` | present | present | in IR only |
| `provenance.source.id` | **absent** | **absent** | **not preserved** — `NormalizedRecord` has no provenance fields |
| `provenance.source.name` | **absent** | **absent** | **not preserved** |
| `provenance.source.url` | **absent** | **absent** | **not preserved**; registry default exists in `shared/sources/siralex_lexical_review.yaml` (`homepage_url`) but is not wired |
| `provenance.source.retrieved_at` | **absent** | **absent** | **not preserved**; requires maintainer implementation-time timestamp at insertion |
| `provenance.source.license_notes` | **absent** | **absent** | **not preserved**; requires maintainer-approved statement (registry `license_inference_note` is guidance, not inserted text) |
| `provenance.source.record_pointer` | **absent** | **absent** | **not preserved** |
| `derivation.kind` | **absent** | **absent** | **not preserved** |
| `derivation.rule_versions.normalization` | **absent** | **absent** | **not preserved** |

### Human / maintainer inputs still required at corrective implementation

Do not invent in recovery slice:

| Input | Status |
| --- | --- |
| `provenance.source.retrieved_at` | **Missing — maintainer must set ISO timestamp at insertion** |
| `provenance.source.license_notes` | **Missing — maintainer must approve exact wording** (may paraphrase registry posture; not auto-filled in current pipeline) |
| `provenance.source.url` | May be `https://github.com/thethiccckening/SiraLex` from source registry or explicit `null` per 7N2A3; **not yet chosen in IR rows** |

### Pipeline gap beyond IR authoring

Even after IR rows gain `provenance` and `derivation`, **`api/normalizer/normalize.py` `NormalizedRecord.to_dict()` does not emit those fields.** Corrective work must include a normalizer projection path for manual lexical-review records per 7N2A3, or an approved alternative projection stage — not only IR JSON edits.

The prior report placed provenance values in narrative only (`retrieved_at: 2026-07-05T01:19:00Z`, license note text). Those values are **not** present in machine-readable IR or normalized/enriched JSON on disk.

---

## Part E — Commit hygiene recommendation for `ce055dc`

**Recommendation: supersede with corrective commit(s).**

| Option | Why not |
| --- | --- |
| keep as-is | Leaves false-complete report, failing file-dependent tests, and no authoritative source in Git. |
| revert | Removes useful generic schema tests; still requires re-implementation. |
| **supersede** | **Preferred** — retain valid test patterns after fixture refactor; replace report claims; add tracked IR + normalization fix in follow-on slices. |

Minimum supersession sequence (future slices, not 7N2A4B-R):

1. Narrow `.gitignore` exception and commit `data/ir/siralex_owner_lexical_v1.jsonl` with complete provenance blocks.
2. Implement normalization-registry repair (see collision analysis report).
3. Regenerate normalized/enriched via full combined-input pipeline (local outputs remain ignored).
4. Replace or amend `phase7n2a4b_manual_lexical_records_report.md` so status reflects reproducible evidence.
5. Refactor tests to use committed fixtures or tracked IR, not ignored-path loaders.

---

## Concern matrix

| Concern | Observed fact | Risk | Required correction | Owner/maintainer decision |
| --- | --- | --- | --- | --- |
| ignored authoritative source data | `siralex_owner_lexical_v1.jsonl` exists locally but is excluded by `data/` gitignore; not in `ce055dc` | Fresh clone cannot reproduce the two approved records; tests/report overclaim | Narrow gitignore exception; commit owner IR file with full 7N2A3 fields | **Track `data/ir/siralex_owner_lexical_v1.jsonl` (Option 1)** |
| false completion claim in `ce055dc` | Report status `implementation complete`; verified projections marked `yes` despite partial pipeline | Downstream slices may proceed on non-reproducible state | Supersede report; downgrade status until Git + full pipeline pass | Maintainer accepts supersession |
| combined normalization failure | 3-file `normalizer.cli` aborts at first `LexiconVariantRegistry` collision | Cannot produce authoritative normalized projection from full IR input set | Apply narrow registry repair (see collision analysis); rerun full normalization | Maintainer authorizes normalizer fix slice |
| frozen N'Ko collision | `ߘߊ` shared by distinct entries `964909ef6912ff64` (`-da`) and `d426e49d1e2ab3d9` (`dá`); 1,408 duplicate N'Ko keys corpus-wide | `ff269c1` pre-scan treats legitimate distinct records as fatal duplicates | Scope global duplicate enforcement to Latin/reviewed-target classes; exclude source-attested N'Ko from cross-record registry | Maintainer authorizes proposed narrow code fix |
| manual provenance gaps | IR rows lack `provenance` and `derivation`; normalizer does not project them | 7N2A3 contract unmet; audit trail non-machine-readable | Add blocks to IR; extend normalizer projection; set `retrieved_at` and `license_notes` at insertion | Maintainer supplies timestamp and license wording |
| generated projection authority | Normalized/enriched updated via owner-only normalize + manual merge | Derived files may diverge from reproducible full-pipeline output | After registry fix, regenerate from full inputs; treat local norm/enriched as non-authoritative until then | Do not use current 19,326-row local merge as acceptance evidence |
| test coverage scope | New tests read ignored disk file | CI / fresh clone false green or false red depending on local file presence | Keep generic schema tests; move record-specific assertions to committed fixtures or tracked IR | Test refactor in superseding commit |

---

## Validation results (read-only commands)

```bash
git diff --check
# (no output — clean)

git status --short
# ?? build/
# ?? web/public/bundle_full_20260518_15605571/

git show --stat ce055dc
# 2 files changed, 289 insertions(+)
# api/normalizer/tests/test_lexical_review.py
# docs/reports/phase7n2a4b_manual_lexical_records_report.md

git show --name-status ce055dc
# M api/normalizer/tests/test_lexical_review.py
# A docs/reports/phase7n2a4b_manual_lexical_records_report.md

git check-ignore -v data/ir/siralex_owner_lexical_v1.jsonl
# .gitignore:43:data/    data/ir/siralex_owner_lexical_v1.jsonl
```

---

## Confirmation

No source data, normalizer code, aliases, indexes, bundles, packages, runtime, catalog, or release state was modified during this audit slice.

Phase 7N2A4B remains pending reproducible source control, full-pipeline normalization, and complete manual provenance. No downstream alias, health-index, bundle, or release work is authorized.
