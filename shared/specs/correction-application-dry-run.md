# Correction application dry-run pipeline plan/spec (Phase 1.5B)

This document defines the implementation plan and normative contracts for Phase 1.5B.

Scope is planning/specification only. No runtime code is introduced by this document.

## Objectives

- Apply approved corrections to an immutable IR snapshot in dry-run mode.
- Produce deterministic, auditable outputs.
- Never mutate frozen historical datasets in place.

## Non-goals (Phase 1.5B)

- No UI/moderation workflow implementation
- No automatic lifecycle persistence to `applied`
- No changes to normalization, search, or bundle generation behavior

---

## 1) Correctionset input format

### Decision

Use a correctionset wrapper plus JSONL payload:

- `correctionset.manifest.json` (metadata, version context, integrity)
- `corrections.jsonl` (one `correction_record_v1` per line)

### Why not raw JSONL alone

Raw JSONL alone is insufficient for explicit dataset/version anchoring and deterministic correctionset identity. The wrapper provides version context and integrity without changing per-record schema.

### Proposed correctionset manifest fields

- `correctionset_id` (stable identifier)
- `correctionset_version` (monotonic integer or semver-like string)
- `schema_id` (`correctionset_manifest_v1`)
- `created_at` (ISO-8601 UTC)
- `target_ir_version` (must match pipeline input IR context)
- `files[]` with `{ path, sha256, byte_length }`
- `content_sha256` (canonical hash over `files[]`)

Implementation note (explicit deferral):

- Phase 1.5B implementation SHOULD validate manifest schema/required fields and `corrections.jsonl` file integrity (`byte_length` + `sha256`) immediately.
- Full `content_sha256` canonicalization verification may remain deferred only by deliberate design, and must be documented when deferred.

### Deterministic ordering rules

After lifecycle resolution (see validation/application sections), pipeline computes a single deterministic apply order:

1. `target_ir_id` ascending (bytewise string order)
2. `timestamps.submitted_at` ascending (nulls last)
3. `correction_id` ascending
4. original file line number ascending (final tiebreaker)

The same inputs must always produce the same apply order.

### Correctionset completeness and lifecycle scope (normative)

Phase 1.5B dry-run resolves lifecycle state only from correction records contained in the supplied correctionset inputs.

Normative expectations:

- A correctionset intended for dry-run application MUST be assembled as a self-contained eligibility snapshot.
- It MUST include the latest known lifecycle record for every `correction_id` intended to be considered.
- The dry-run pipeline MUST NOT consult external correctionset history outside supplied inputs.

---

## 2) Pipeline input contracts

Required inputs:

- Immutable IR snapshot JSONL (input file, read-only)
- Correctionset (`correctionset.manifest.json` + `corrections.jsonl`)
- Explicit IR version context (CLI arg or config), expected to match:
  - IR artifact version in execution context
  - correctionset `target_ir_version`
  - each correction record `provenance.target_snapshot.ir_version`

Contract rules:

- Input IR file is never modified.
- If pipeline input IR version context does not equal `correctionset.manifest.target_ir_version`, the run fails fatally before per-record processing.
- Per-record `provenance.target_snapshot.ir_version` must be evaluated against correctionset target version during semantic validation.

---

## 3) Validation stages

Validation executes as a strict pipeline:

1. **Correction record structural validation**
   - validate `correction_record_v1` required fields/types/enums
2. **Latest lifecycle resolution per `correction_id`**
   - load all correction records first
   - choose exactly one latest lifecycle record per `correction_id`
   - primary key: `timestamps.updated_at` descending (latest wins)
   - deterministic tie-breakers (single supplied correctionset mode): source file line number descending, then canonical JSON string order
   - `correctionset_version` is manifest-level/shared in single-correctionset mode and is therefore non-operative for per-row tie-breaking (reserved for future multi-correctionset ingestion mode)
   - non-latest lifecycle records are excluded from eligibility with reason `non_latest_lifecycle_version`
3. **Approved-status filtering (after lifecycle resolution)**
   - only latest records with `status = approved` progress
   - latest records with non-approved statuses are skipped with reason `not_approved_status`
4. **Semantic validation against target IR snapshot**
   - `target_ir_id` exists
   - per-record `provenance.target_snapshot.ir_version` must match correctionset target version
5. **`record_sha256` match enforcement**
   - for approved records, `provenance.target_snapshot.record_sha256` required
   - compute pre-patch target record hash and compare
6. **Supersession exclusion (before conflict grouping)**
   - if approved correction `B` declares `provenance.audit.supersedes_correction_id = A`, then `A` is excluded/rejected with `superseded_by_newer_correction`
   - supersession is evaluated only among lifecycle-resolved, approved candidates
7. **Patch preflight**
   - ops allowed in v1 (`add|remove|replace`)
   - path under `/fields_raw/...` only
   - patch can be applied cleanly to target JSON
   - post-patch IR shape validates

Any failed stage yields deterministic rejection reason(s) and no mutation.

---

## 4) Conflict policy

Conflicts are evaluated after approved filtering and before final apply.

### A) Multiple approved corrections on same `target_ir_id`

- Group by `target_ir_id`.
- If only one eligible record in group: apply candidate.
- If multiple eligible records, evaluate cross-correction conflicts below.

### B) Overlapping JSON Pointer paths

Two eligible corrections for same target conflict if any operation path is:

- exact same path, or
- ancestor/descendant path (e.g. `/fields_raw/senses/0` vs `/fields_raw/senses/0/gloss_fr`)

Conflict outcome policy (v1):

- reject all conflicting corrections for that target record in this run (`conflicted`)
- do not attempt partial merge or heuristic ordering fixes

### C) Array index shift safety (conservative v1 rule)

For multiple eligible corrections targeting the same `target_ir_id`, if any correction contains `add` or `remove` on an array-indexed path that could shift element positions, the entire same-target candidate group is treated as conflicted in v1.

Examples of shift-risk operations include paths like:

- `/fields_raw/senses/0`
- `/fields_raw/examples/2/translations/1`

Normative rule:

- Single corrections that use `add`/`remove` remain allowed.
- Multi-correction same-target groups with potential array index shift risk are rejected as `conflicted` (reason `conflict_same_target_array_shift_risk`) rather than merged.
- v1 prioritizes deterministic safety over permissive same-record merging.

### D) Superseded corrections

- If status is `superseded`, never eligible.
- If approved correction `B` declares `provenance.audit.supersedes_correction_id = A`:
  - supersession is processed after latest lifecycle resolution and approved filtering
  - `A` is excluded/rejected with reason `superseded_by_newer_correction` before conflict grouping
  - `B` remains candidate unless rejected by later validation or conflict rules

### E) Deterministic apply/reject behavior

- Same input files + same IR snapshot => identical classification and output bytes.
- No nondeterministic dependency on hash maps or runtime iteration order.

---

## 5) Application behavior

Normative behavior:

- Apply-on-copy only:
  - read each IR record
  - if no eligible correction, write record unchanged
  - if eligible correction, apply patch to in-memory copy and write patched record
- Never mutate source IR file in place.
- Preserve deterministic output record ordering:
  - keep original IR JSONL record order unchanged

### Corrected IR output naming/versioning concept

Recommended output naming:

- `data/ir/{base_ir_version}__corrdryrun_{correctionset_id}_v{correctionset_version}.jsonl`

Recommended companion metadata:

- `corrected_ir_manifest.json` with:
  - `base_ir_version`
  - `correctionset_id`
  - `correctionset_version`
  - `dry_run: true`
  - `generated_at`
  - `input/output sha256`

Determinism rule for metadata timestamps:

- `generated_at` (and any run timestamp fields in reports/manifests) must support deterministic injection via CLI/config.
- Byte-identical replay guarantees assume deterministic metadata inputs are fixed (including injected timestamps).

---

## 6) Output artifacts

Phase 1.5B dry-run should emit:

1. **Corrected IR JSONL**
   - full IR output with approved, valid, non-conflicted corrections applied on copy
2. **Machine-readable application report** (`correction_application_report.json`)
   - per-correction disposition and reason codes
   - run metadata and integrity hashes
3. **Summary counts**
   - `eligible`
   - `applied_in_dry_run`
   - `rejected`
   - `conflicted`
   - optional supporting counts: `skipped_non_approved`, `invalid_structural`, `invalid_semantic`

---

## 7) Failure handling

Required reason codes (minimum set):

- `target_ir_id_not_found`
- `target_snapshot_version_mismatch`
- `target_snapshot_hash_mismatch`
- `invalid_patch_path`
- `patch_apply_failed`
- `post_patch_ir_invalid`
- `not_approved_status`
- `conflict_same_target_overlapping_paths`
- `conflict_same_target_array_shift_risk`
- `superseded_by_newer_correction`
- `non_latest_lifecycle_version`

Failure behavior rules:

- Failure of one correction must not abort unrelated corrections by default.
- Global manifest/input corruption may abort run early with explicit fatal error.
- Every rejected/conflicted correction must include a machine-readable reason code.
- Global IR version context mismatch (`input IR version != correctionset target version`) is a fatal run error.

---

## 8) Tests

Minimum Phase 1.5B test matrix:

1. **Valid single correction**
   - one approved correction applies cleanly
2. **Multiple independent corrections**
   - different target records all apply
3. **Same-record conflict**
   - overlapping paths become `conflicted` and are not applied
4. **Hash mismatch**
   - approved correction with mismatched `record_sha256` rejected
5. **Non-approved skipped**
   - submitted/rejected/etc. are skipped with reason code
6. **Deterministic replay**
   - identical inputs produce byte-identical corrected IR + report outputs

Recommended extras:

- supersession handling
- invalid pointer/index patch failures
- post-patch schema invalidation

---

## 9) Exact files/modules likely to be created or changed

Planned backend modules:

- `api/corrections/models.py`
  - correction/correctionset typed models
- `api/corrections/loaders.py`
  - load + parse manifest and JSONL records
- `api/corrections/validators.py`
  - structural + semantic validation stages
- `api/corrections/conflicts.py`
  - same-target grouping and path-overlap conflict detection
- `api/corrections/dry_run_apply.py`
  - apply-on-copy engine + deterministic ordering
- `api/corrections/reporting.py`
  - machine-readable report generation

CLI entrypoints:

- `api/cli/corrections_dry_run.py` (or equivalent command wiring)
- command name proposal: `siralex-corrections-dry-run`

Tests:

- `tests/corrections/test_models.py`
- `tests/corrections/test_validators.py`
- `tests/corrections/test_conflicts.py`
- `tests/corrections/test_dry_run_apply.py`
- `tests/corrections/test_determinism.py`

Spec/docs updates:

- `shared/specs/correction-record-schema-v1.md` (cross-reference only, if needed)
- `docs/ROADMAP.md` (phase status and linkage)

---

## Dry-run lifecycle boundary

Phase 1.5B dry-run does not persist lifecycle transitions to `applied` by default.
Any status transition persistence belongs to a separate committed correction release workflow and must be explicitly specified in a later phase.

## Hashing determinism note

`content_sha256` canonicalization details for correctionset/report artifacts must be explicitly defined during implementation so hashing is deterministic across environments.
This planning pass intentionally defers full canonicalization algorithm details.
