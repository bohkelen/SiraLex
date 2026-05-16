"""Structural and semantic validators for correction records."""

from __future__ import annotations

import re
from typing import Any

from .helpers import parse_iso8601_utc, sha256_prefixed
from .models import CorrectionRecord, Rejection
from .patching import ALLOWED_PATCH_OPS, PatchError, apply_patch, parse_pointer

ALLOWED_STATUSES = {
    "draft",
    "submitted",
    "approved",
    "rejected",
    "withdrawn",
    "superseded",
    "applied",
}

REQUIRED_TOP_LEVEL_FIELDS = {
    "schema_id",
    "schema_version",
    "correction_id",
    "target_ir_id",
    "patch",
    "submitter",
    "timestamps",
    "status",
    "provenance",
}

ALLOWED_SUBMITTED_VIA = {"manual_import", "api", "batch"}
CORRECTION_ID_RE = re.compile(r"^corr_[0-9]{8}_[0-9]{6}$")
ANON_TOKEN_RE = re.compile(r"^anon_[a-z0-9]{16,64}$")


def _reject(record: CorrectionRecord, reason_code: str, detail: str | None = None) -> Rejection:
    return Rejection(
        correction_id=record.correction_id,
        target_ir_id=record.target_ir_id,
        reason_code=reason_code,
        detail=detail,
    )


def _validate_timestamp(value: Any, field_name: str, allow_null: bool) -> str | None:
    if value is None and allow_null:
        return None
    if not isinstance(value, str):
        return f"{field_name} must be an ISO-8601 UTC string"
    try:
        parse_iso8601_utc(value)
    except ValueError as exc:
        return f"{field_name} invalid: {exc}"
    return None


def validate_structural(record: CorrectionRecord) -> list[Rejection]:
    raw = record.raw
    errors: list[Rejection] = []
    missing = sorted(REQUIRED_TOP_LEVEL_FIELDS - set(raw.keys()))
    if missing:
        errors.append(_reject(record, "invalid_structural", f"missing fields: {', '.join(missing)}"))
        return errors

    unknown = sorted(set(raw.keys()) - REQUIRED_TOP_LEVEL_FIELDS)
    if unknown:
        errors.append(_reject(record, "invalid_structural", f"unknown fields: {', '.join(unknown)}"))

    if raw.get("schema_id") != "correction_record_v1":
        errors.append(_reject(record, "invalid_structural", "schema_id must be correction_record_v1"))
    if raw.get("schema_version") != 1:
        errors.append(_reject(record, "invalid_structural", "schema_version must be 1"))

    correction_id = raw.get("correction_id")
    if not isinstance(correction_id, str) or not correction_id:
        errors.append(_reject(record, "invalid_structural", "correction_id must be non-empty string"))
    elif CORRECTION_ID_RE.fullmatch(correction_id) is None:
        errors.append(_reject(record, "invalid_structural", "correction_id must match ^corr_[0-9]{8}_[0-9]{6}$"))
    target_ir_id = raw.get("target_ir_id")
    if not isinstance(target_ir_id, str) or not target_ir_id:
        errors.append(_reject(record, "invalid_structural", "target_ir_id must be non-empty string"))

    submitter = raw.get("submitter")
    if not isinstance(submitter, dict):
        errors.append(_reject(record, "invalid_structural", "submitter must be object"))
    else:
        token = submitter.get("anonymous_token")
        if not isinstance(token, str) or not token:
            errors.append(_reject(record, "invalid_structural", "submitter.anonymous_token is required"))
        elif ANON_TOKEN_RE.fullmatch(token) is None:
            errors.append(
                _reject(
                    record,
                    "invalid_structural",
                    "submitter.anonymous_token must match ^anon_[a-z0-9]{16,64}$",
                )
            )

    status = raw.get("status")
    if status not in ALLOWED_STATUSES:
        errors.append(_reject(record, "invalid_structural", f"invalid status: {status!r}"))

    timestamps = raw.get("timestamps")
    if not isinstance(timestamps, dict):
        errors.append(_reject(record, "invalid_structural", "timestamps must be object"))
    else:
        required_ts = [
            "created_at",
            "updated_at",
            "submitted_at",
            "reviewed_at",
            "decided_at",
            "applied_at",
        ]
        missing_ts = [key for key in required_ts if key not in timestamps]
        if missing_ts:
            errors.append(_reject(record, "invalid_structural", f"missing timestamps: {', '.join(missing_ts)}"))
        else:
            for key in ("created_at", "updated_at"):
                err = _validate_timestamp(timestamps.get(key), key, allow_null=False)
                if err:
                    errors.append(_reject(record, "invalid_structural", err))
            for key in ("submitted_at", "reviewed_at", "decided_at", "applied_at"):
                err = _validate_timestamp(timestamps.get(key), key, allow_null=True)
                if err:
                    errors.append(_reject(record, "invalid_structural", err))
            status_errors = validate_status_timestamp_consistency(status, timestamps)
            errors.extend(_reject(record, "invalid_structural", err) for err in status_errors)

    patch = raw.get("patch")
    if not isinstance(patch, list) or not patch:
        errors.append(_reject(record, "invalid_structural", "patch must be non-empty array"))
    else:
        for idx, op in enumerate(patch):
            if not isinstance(op, dict):
                errors.append(_reject(record, "invalid_structural", f"patch[{idx}] must be object"))
                continue
            op_name = op.get("op")
            if op_name not in ALLOWED_PATCH_OPS:
                errors.append(_reject(record, "invalid_structural", f"patch[{idx}] invalid op {op_name!r}"))
            path = op.get("path")
            if not isinstance(path, str):
                errors.append(_reject(record, "invalid_patch_path", f"patch[{idx}] path must be string"))
                continue
            if not path.startswith("/fields_raw/"):
                errors.append(
                    _reject(record, "invalid_patch_path", f"patch[{idx}] path must be under /fields_raw/...")
                )
            try:
                parse_pointer(path)
            except PatchError as exc:
                errors.append(_reject(record, "invalid_patch_path", f"patch[{idx}] invalid JSON pointer: {exc}"))
            if op_name in {"add", "replace"} and "value" not in op:
                errors.append(_reject(record, "invalid_structural", f"patch[{idx}] requires value"))
            if op_name == "remove" and "value" in op:
                errors.append(_reject(record, "invalid_structural", f"patch[{idx}] remove cannot include value"))

    provenance = raw.get("provenance")
    if not isinstance(provenance, dict):
        errors.append(_reject(record, "invalid_structural", "provenance must be object"))
    else:
        reason = provenance.get("reason")
        if not isinstance(reason, str) or not reason:
            errors.append(_reject(record, "invalid_structural", "provenance.reason is required string"))
        evidence_refs = provenance.get("evidence_refs")
        if evidence_refs is not None:
            if not isinstance(evidence_refs, list) or any(not isinstance(item, str) for item in evidence_refs):
                errors.append(
                    _reject(record, "invalid_structural", "provenance.evidence_refs must be list[str] when present")
                )

        target_snapshot = provenance.get("target_snapshot")
        if not isinstance(target_snapshot, dict):
            errors.append(_reject(record, "invalid_structural", "provenance.target_snapshot is required"))
        else:
            ir_version = target_snapshot.get("ir_version")
            if not isinstance(ir_version, str) or not ir_version:
                errors.append(
                    _reject(record, "invalid_structural", "provenance.target_snapshot.ir_version required")
                )
            if status in {"approved", "applied"} and not target_snapshot.get("record_sha256"):
                errors.append(
                    _reject(
                        record,
                        "invalid_structural",
                        "approved/applied corrections require provenance.target_snapshot.record_sha256",
                    )
                )
        audit = provenance.get("audit")
        if not isinstance(audit, dict):
            errors.append(_reject(record, "invalid_structural", "provenance.audit is required object"))
        else:
            submitted_via = audit.get("submitted_via")
            if submitted_via not in ALLOWED_SUBMITTED_VIA:
                errors.append(
                    _reject(
                        record,
                        "invalid_structural",
                        "provenance.audit.submitted_via must be one of: manual_import | api | batch",
                    )
                )
            for field_name in ("reviewer_token", "decision_note", "supersedes_correction_id"):
                value = audit.get(field_name)
                if value is not None and not isinstance(value, str):
                    errors.append(
                        _reject(
                            record,
                            "invalid_structural",
                            f"provenance.audit.{field_name} must be string or null",
                        )
                    )

    return errors


def validate_status_timestamp_consistency(status: str, timestamps: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    submitted_at = timestamps.get("submitted_at")
    reviewed_at = timestamps.get("reviewed_at")
    decided_at = timestamps.get("decided_at")
    applied_at = timestamps.get("applied_at")

    if status != "draft" and submitted_at is None:
        errors.append(f"{status} requires submitted_at")

    decision_statuses = {"approved", "rejected", "withdrawn", "superseded", "applied"}
    if status in decision_statuses:
        if reviewed_at is None:
            errors.append(f"{status} requires reviewed_at")
        if decided_at is None:
            errors.append(f"{status} requires decided_at")

    if status == "applied":
        if applied_at is None:
            errors.append("applied requires applied_at")
    elif applied_at is not None:
        errors.append(f"{status} must not set applied_at")

    return errors


def validate_semantic(
    record: CorrectionRecord,
    target_record: dict[str, Any] | None,
    correctionset_target_version: str,
) -> list[Rejection]:
    rejections: list[Rejection] = []
    if target_record is None:
        return [_reject(record, "target_ir_id_not_found", "target_ir_id missing from input IR")]

    target_snapshot = (
        record.raw.get("provenance", {}).get("target_snapshot", {})
        if isinstance(record.raw.get("provenance", {}), dict)
        else {}
    )
    record_ir_version = target_snapshot.get("ir_version")
    if record_ir_version != correctionset_target_version:
        rejections.append(
            _reject(
                record,
                "target_snapshot_version_mismatch",
                "record target snapshot version does not match correctionset target version",
            )
        )

    if record.status == "approved":
        expected_hash = target_snapshot.get("record_sha256")
        actual_hash = sha256_prefixed(target_record)
        if expected_hash != actual_hash:
            rejections.append(
                _reject(
                    record,
                    "target_snapshot_hash_mismatch",
                    "record_sha256 does not match target IR record hash",
                )
            )

    return rejections


def preflight_patch(record: CorrectionRecord, target_record: dict[str, Any]) -> list[Rejection]:
    try:
        patched = apply_patch(target_record, record.patch)
    except PatchError as exc:
        return [_reject(record, "patch_apply_failed", str(exc))]

    shape_error = validate_ir_shape(target_record, patched)
    if shape_error:
        return [_reject(record, "post_patch_ir_invalid", shape_error)]
    return []


def validate_ir_shape(original: dict[str, Any], patched: dict[str, Any]) -> str | None:
    required_fields = ["ir_id", "ir_kind", "source_id", "fields_raw"]
    for key in required_fields:
        if key not in patched:
            return f"patched record missing required field: {key}"

    if not isinstance(patched.get("fields_raw"), dict):
        return "patched fields_raw must remain an object"

    for immutable in ("ir_id", "ir_kind", "source_id"):
        if patched.get(immutable) != original.get(immutable):
            return f"patched record changed immutable field: {immutable}"
    return None

