# Correction record schema/specification (v1)

This spec defines the correction record contract for SiraLex Phase 1.5A.

Purpose:

- represent proposed/approved corrections to existing IR records
- keep frozen historical datasets immutable
- enable a later deterministic dry-run correction application pipeline

This is a schema/specification document only. It does not define UI, moderation workflow implementation, or correction application runtime behavior.

## Goals

- Define a stable correction record schema (`correction_record_v1`).
- Make correction payloads auditable and reproducible.
- Constrain RFC 6902 patches so they are safe and deterministic.
- Ensure correction application can produce new IR versions without in-place mutation.

## Non-goals

- Building submission UI
- Building reviewer/moderation UI
- Applying corrections in runtime pipelines (Phase 1.5B)
- Changing current IR, normalization, search, or bundle generation behavior

## Schema identity

- `schema_id`: `correction_record_v1`
- `schema_version`: `1`

Correction records are line-delimited JSON objects (`.jsonl`) in future correctionset artifacts. Each line is one correction record.

## Exact schema fields

Each correction record MUST be a JSON object with the following top-level fields:

- `schema_id` (string, required; MUST be `correction_record_v1`)
- `schema_version` (integer, required; MUST be `1`)
- `correction_id` (string, required)
- `target_ir_id` (string, required)
- `patch` (array of RFC 6902 operation objects, required)
- `submitter` (object, required)
- `timestamps` (object, required)
- `status` (string enum, required)
- `provenance` (object, required)

Recommended full structure:

```json
{
  "schema_id": "correction_record_v1",
  "schema_version": 1,
  "correction_id": "corr_20260516_000001",
  "target_ir_id": "964909ef6912ff64",
  "patch": [
    {
      "op": "replace",
      "path": "/fields_raw/senses/0/gloss_fr",
      "value": "gloss corrected example"
    }
  ],
  "submitter": {
    "anonymous_token": "anon_6f5f2f85d0dc4a0d"
  },
  "timestamps": {
    "created_at": "2026-05-16T10:40:00Z",
    "updated_at": "2026-05-16T10:40:00Z",
    "submitted_at": "2026-05-16T10:40:00Z",
    "reviewed_at": null,
    "decided_at": null,
    "applied_at": null
  },
  "status": "submitted",
  "provenance": {
    "reason": "Typo in French gloss",
    "evidence_refs": [
      "https://example.invalid/reference"
    ],
    "target_snapshot": {
      "ir_version": "malipense_lexicon_v3",
      "record_sha256": "sha256:7c0db4..."
    },
    "audit": {
      "submitted_via": "manual_import",
      "reviewer_token": null,
      "decision_note": null,
      "supersedes_correction_id": null
    }
  }
}
```

## Allowed correction statuses

`status` MUST be one of:

- `draft`
- `submitted`
- `approved`
- `rejected`
- `withdrawn`
- `superseded`
- `applied`

Normative status constraints:

- `draft` records are not eligible for application.
- Only `approved` is eligible for application in Phase 1.5B dry-run.
- `applied` is not set by Phase 1.5B dry-run tooling by default; it belongs to a later committed application/release workflow unless explicitly designed and approved otherwise.
- `rejected`, `withdrawn`, and `superseded` are terminal non-applicable statuses.

## Correction identity across correctionset versions

`correction_id` is the stable identity of one logical correction and MUST remain unchanged across correctionset versions that represent lifecycle/status updates for that same correction.

Normative rule:

- Lifecycle updates (for example `submitted -> approved`) produce a new correction record version in a newer correctionset, reusing the same `correction_id`.
- `correction_id` MUST NOT be reused for unrelated corrections.

## `target_ir_id` relationship to IR records

`target_ir_id` MUST reference an existing IR record `ir_id` in the selected input IR dataset/version used during validation/apply.

Normative rules:

- Exactly one correction targets exactly one IR record.
- `target_ir_id` must be resolved by exact string match to `ir_id`.
- If no matching IR record exists, correction is invalid for that input dataset.
- A correction is evaluated against the specific IR snapshot declared in `provenance.target_snapshot.ir_version`.
- Correction application MUST produce a new IR artifact version; it MUST NOT mutate the original source JSONL in place.

## RFC 6902 patch constraints

The `patch` field MUST be a non-empty array of RFC 6902 operations.

Allowed operations:

- `add`
- `remove`
- `replace`

Disallowed operations in v1:

- `move`
- `copy`
- `test`

Path constraints:

- `path` MUST be under `/fields_raw/...` and MUST NOT equal `/fields_raw` itself in v1.
- Patches MUST NOT modify immutable identity/provenance fields, including:
  - `/ir_id`
  - `/ir_kind`
  - `/source_id`
  - `/provenance`
  - `/norm_version`
- `path` must be valid JSON Pointer (RFC 6901) syntax.

Operation constraints:

- `add` and `replace` MUST include `value`.
- `remove` MUST NOT include `value`.
- The full patch sequence must be deterministic when applied in order.

## Validation rules

Validation should run in two levels: schema validation then semantic validation.

Validation context is split explicitly:

- Standalone record validation (this phase) validates the record in isolation.
- Full lifecycle transition validation requires prior correctionset/version history and belongs to correction workflow logic (later phase), not isolated record validation.

### A) Structural/schema validation

- Required top-level fields must exist.
- No top-level unknown fields unless explicitly allowed by schema extension policy.
- `correction_id` format: `^corr_[0-9]{8}_[0-9]{6}$` (or future versioned equivalent).
- `submitter.anonymous_token` format: `^anon_[a-z0-9]{16,64}$`.
- Timestamp fields must be ISO-8601 UTC (`...Z`) or `null` where allowed.
- `patch` must be non-empty array.
- `status` must be in enum set.
- Status-specific timestamp consistency must hold for the current record state (for example decision/applied timestamps required only when status requires them).

### B) Semantic/business validation

- `target_ir_id` exists in input IR dataset.
- `provenance.target_snapshot.ir_version` matches the input IR version context.
- Every patch op is allowed in v1 and path-constrained.
- Patch applies cleanly to target record (no missing path/index errors).
- Post-patch record remains valid IR record shape (existing IR schema validation).
- Standalone validation does not assert historical transition legality across prior versions. That check is deferred to workflow/lifecycle validation in later correction pipeline logic.

## Provenance and audit metadata

The `provenance` object captures correction rationale and auditability:

- `reason` (required): plain-text reason for correction.
- `evidence_refs` (optional array of strings): external references, issue IDs, or source pointers.
- `target_snapshot` (required):
  - `ir_version` (required)
  - `record_sha256` (required when `status` is `approved` or `applied`; recommended otherwise)
- `audit` (required object):
  - `submitted_via` (required enum): `manual_import` | `api` | `batch`
  - `reviewer_token` (nullable string)
  - `decision_note` (nullable string)
  - `supersedes_correction_id` (nullable string)

Audit principles:

- Every status change updates `timestamps.updated_at`.
- Decision statuses set `timestamps.reviewed_at` and `timestamps.decided_at`.
- `applied` sets `timestamps.applied_at`.
- Audit metadata is append-preserving: new decisions do not rewrite historical artifacts; they create new correctionset versions.

## Files to create under `shared/specs/`

Phase 1.5A deliverables:

- `shared/specs/correction-record-schema-v1.md` (this spec; normative contract)

Planned for implementation in Phase 1.5B:

- `shared/specs/correction-application-dry-run.md` (pipeline behavior, inputs/outputs, conflict policy)

## Tests needed for schema validation

When implementation begins, add tests for:

1. **Valid minimal correction record**
   - required fields present
   - single `replace` under `/fields_raw/...`
2. **Status enum rejection**
   - unknown `status` fails
3. **Patch operation rejection**
   - `copy`/`move`/`test` fail in v1
4. **Path boundary enforcement**
   - patch outside `/fields_raw` fails
   - attempts to patch immutable fields fail
5. **Target existence validation**
   - missing `target_ir_id` in input IR fails
6. **Patch application safety**
   - invalid pointer/index path fails cleanly
7. **Timestamp/state transition rules**
   - standalone status/timestamp consistency enforced for current status
   - full transition legality tested in lifecycle/workflow tests (separate from isolated record validation)
8. **`record_sha256` applicability enforcement**
   - `approved`/`applied` without `provenance.target_snapshot.record_sha256` fails
   - non-applicable statuses may omit it
9. **Deterministic replay**
   - same correctionset + same IR snapshot produces byte-identical corrected IR output

## How this supports later dry-run correction application

This schema enables a deterministic correction pipeline by:

- pinning each correction to a concrete target (`target_ir_id`)
- constraining edits to RFC 6902 operations on mutable payload scope (`/fields_raw`)
- defining explicit applicability (`status = approved`)
- carrying snapshot/version metadata so input mismatch is detectable early
- requiring audit metadata for traceable, reviewable correction history

Phase 1.5B can therefore:

1. load immutable IR snapshot
2. filter approved corrections
3. validate + apply patches in deterministic order
4. emit a new versioned IR artifact
5. emit an application report (eligible/applied-in-dry-run/rejected/conflicted)

without mutating frozen historical datasets.

Note: Phase 1.5B dry-run execution should not automatically persist lifecycle transition to `applied`; that state change belongs to a separate committed application/release workflow unless explicitly specified later.
