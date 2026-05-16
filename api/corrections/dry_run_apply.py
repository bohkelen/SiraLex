"""Dry-run correction application engine."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .conflicts import apply_same_target_conflict_policy, apply_supersession_filter
from .helpers import (
    canonical_json,
    now_utc_iso,
    parse_iso8601_utc,
    sha256_prefixed_bytes,
    sha256_prefixed_text,
)
from .lifecycle import resolve_latest_lifecycle_records
from .loaders import load_correctionset, load_ir_jsonl
from .models import ApplyResult, CorrectionRecord, Rejection
from .patching import PatchError, apply_patch
from .validators import preflight_patch, validate_semantic, validate_structural


def _rejection_to_report_entry(rejection: Rejection) -> dict[str, Any]:
    return {
        "correction_id": rejection.correction_id,
        "target_ir_id": rejection.target_ir_id,
        "disposition": "rejected" if not rejection.reason_code.startswith("conflict_") else "conflicted",
        "reason_code": rejection.reason_code,
        "detail": rejection.detail,
    }


def _safe_timestamp_sort(value: Any) -> tuple[int, str]:
    if not isinstance(value, str):
        return (1, "")
    try:
        parsed = parse_iso8601_utc(value)
    except ValueError:
        return (1, "")
    return (0, parsed.isoformat())


def _apply_sort_key(record: CorrectionRecord) -> tuple[str, tuple[int, str], str, int]:
    submitted_at = record.raw.get("timestamps", {}).get("submitted_at")
    return (
        record.target_ir_id,
        _safe_timestamp_sort(submitted_at),
        record.correction_id,
        record.source_line_number,
    )


def _write_jsonl(path: Path, records: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        for record in records:
            f.write(canonical_json(record) + "\n")


def _write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(canonical_json(payload))
        f.write("\n")


def _index_ir_records(records: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    indexed: dict[str, dict[str, Any]] = {}
    for record in records:
        ir_id = record.get("ir_id")
        if isinstance(ir_id, str):
            indexed[ir_id] = record
    return indexed


def run_corrections_dry_run(
    *,
    ir_input_path: Path,
    correctionset_manifest_path: Path,
    corrections_jsonl_path: Path,
    input_ir_version: str,
    output_ir_path: Path,
    output_report_path: Path,
    output_manifest_path: Path | None,
    generated_at: str | None = None,
) -> ApplyResult:
    correctionset = load_correctionset(correctionset_manifest_path, corrections_jsonl_path)
    if input_ir_version != correctionset.manifest.target_ir_version:
        raise ValueError(
            "fatal version mismatch: input IR version context must equal correctionset.manifest.target_ir_version"
        )

    run_timestamp = generated_at or now_utc_iso()
    # Validate deterministic timestamp input early.
    parse_iso8601_utc(run_timestamp)

    ir_records = load_ir_jsonl(ir_input_path)
    ir_by_id = _index_ir_records(ir_records)

    report_entries: list[dict[str, Any]] = []
    structural_valid: list[CorrectionRecord] = []

    for record in correctionset.records:
        structural_errors = validate_structural(record)
        if structural_errors:
            report_entries.extend(_rejection_to_report_entry(err) for err in structural_errors)
            continue
        structural_valid.append(record)

    latest_records, lifecycle_rejections = resolve_latest_lifecycle_records(structural_valid)
    report_entries.extend(_rejection_to_report_entry(err) for err in lifecycle_rejections)

    approved_records: list[CorrectionRecord] = []
    for record in latest_records:
        if record.status != "approved":
            report_entries.append(
                _rejection_to_report_entry(
                    Rejection(
                        correction_id=record.correction_id,
                        target_ir_id=record.target_ir_id,
                        reason_code="not_approved_status",
                        detail=f"latest status is {record.status!r}",
                    )
                )
            )
            continue
        approved_records.append(record)

    eligible_count = len(approved_records)

    semantic_valid: list[CorrectionRecord] = []
    for record in approved_records:
        semantic_errors = validate_semantic(
            record=record,
            target_record=ir_by_id.get(record.target_ir_id),
            correctionset_target_version=correctionset.manifest.target_ir_version,
        )
        if semantic_errors:
            report_entries.extend(_rejection_to_report_entry(err) for err in semantic_errors)
            continue
        semantic_valid.append(record)

    supersession_kept, supersession_rejections = apply_supersession_filter(semantic_valid)
    report_entries.extend(_rejection_to_report_entry(err) for err in supersession_rejections)

    preflight_valid: list[CorrectionRecord] = []
    for record in supersession_kept:
        target = ir_by_id[record.target_ir_id]
        preflight_errors = preflight_patch(record, target)
        if preflight_errors:
            report_entries.extend(_rejection_to_report_entry(err) for err in preflight_errors)
            continue
        preflight_valid.append(record)

    conflict_free, conflict_rejections = apply_same_target_conflict_policy(preflight_valid)
    report_entries.extend(_rejection_to_report_entry(err) for err in conflict_rejections)

    candidates_by_target: dict[str, list[CorrectionRecord]] = {}
    for record in sorted(conflict_free, key=_apply_sort_key):
        candidates_by_target.setdefault(record.target_ir_id, []).append(record)

    applied_correction_ids: list[str] = []
    output_records: list[dict[str, Any]] = []

    for original in ir_records:
        ir_id = original.get("ir_id")
        if not isinstance(ir_id, str) or ir_id not in candidates_by_target:
            output_records.append(original)
            continue

        current = original
        for correction in candidates_by_target[ir_id]:
            try:
                current = apply_patch(current, correction.patch)
                applied_correction_ids.append(correction.correction_id)
                report_entries.append(
                    {
                        "correction_id": correction.correction_id,
                        "target_ir_id": correction.target_ir_id,
                        "disposition": "applied_in_dry_run",
                        "reason_code": None,
                        "detail": None,
                    }
                )
            except PatchError as exc:
                report_entries.append(
                    _rejection_to_report_entry(
                        Rejection(
                            correction_id=correction.correction_id,
                            target_ir_id=correction.target_ir_id,
                            reason_code="patch_apply_failed",
                            detail=str(exc),
                        )
                    )
                )
        output_records.append(current)

    _write_jsonl(output_ir_path, output_records)
    corrected_ir_sha256 = sha256_prefixed_bytes(output_ir_path.read_bytes())

    conflicted_count = sum(1 for entry in report_entries if entry["disposition"] == "conflicted")
    applied_count = sum(1 for entry in report_entries if entry["disposition"] == "applied_in_dry_run")
    rejected_non_conflict = sum(
        1 for entry in report_entries if entry["disposition"] == "rejected"
    )

    summary = {
        "eligible": eligible_count,
        "applied_in_dry_run": applied_count,
        "rejected": rejected_non_conflict,
        "conflicted": conflicted_count,
        "skipped_non_approved": sum(1 for e in report_entries if e["reason_code"] == "not_approved_status"),
        "invalid_structural": sum(1 for e in report_entries if e["reason_code"] == "invalid_structural"),
        "invalid_semantic": sum(
            1
            for e in report_entries
            if e["reason_code"]
            in {"target_ir_id_not_found", "target_snapshot_version_mismatch", "target_snapshot_hash_mismatch"}
        ),
    }

    report_payload = {
        "schema_id": "correction_application_report_v1",
        "dry_run": True,
        "generated_at": run_timestamp,
        "correctionset_id": correctionset.manifest.correctionset_id,
        "correctionset_version": correctionset.manifest.correctionset_version,
        "base_ir_version": input_ir_version,
        "summary": summary,
        "corrections": sorted(
            report_entries,
            key=lambda e: (
                str(e.get("target_ir_id", "")),
                str(e.get("correction_id", "")),
                str(e.get("disposition", "")),
                str(e.get("reason_code", "")),
            ),
        ),
    }
    _write_json(output_report_path, report_payload)
    report_sha256 = sha256_prefixed_bytes(output_report_path.read_bytes())

    if output_manifest_path is not None:
        output_manifest = {
            "schema_id": "corrected_ir_manifest_v1",
            "dry_run": True,
            "generated_at": run_timestamp,
            "base_ir_version": input_ir_version,
            "correctionset_id": correctionset.manifest.correctionset_id,
            "correctionset_version": correctionset.manifest.correctionset_version,
            "input_ir_path": str(ir_input_path),
            "output_ir_path": str(output_ir_path),
            "output_report_path": str(output_report_path),
            "input_ir_sha256": sha256_prefixed_text(ir_input_path.read_text(encoding="utf-8")),
            "output_ir_sha256": corrected_ir_sha256,
            "output_report_sha256": report_sha256,
        }
        _write_json(output_manifest_path, output_manifest)

    return ApplyResult(
        corrected_ir_sha256=corrected_ir_sha256,
        report_sha256=report_sha256,
        summary=summary,
    )

