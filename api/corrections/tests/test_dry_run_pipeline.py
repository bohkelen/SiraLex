import json
from pathlib import Path

import pytest

from corrections.dry_run_apply import run_corrections_dry_run
from corrections.helpers import sha256_prefixed, sha256_prefixed_bytes


def _write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")


def _write_jsonl(path: Path, records: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        for record in records:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")


def _read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _read_jsonl(path: Path) -> list[dict]:
    rows: list[dict] = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


def _make_ir_record(ir_id: str, gloss: str) -> dict:
    return {
        "ir_id": ir_id,
        "ir_kind": "lexicon_entry",
        "source_id": "src_test",
        "fields_raw": {
            "senses": [{"gloss_fr": gloss}],
        },
    }


def _make_correction_record(
    correction_id: str,
    target_ir_id: str,
    *,
    status: str = "approved",
    patch: list[dict] | None = None,
    updated_at: str = "2026-05-16T15:00:00Z",
    submitted_at: str | None = "2026-05-16T14:00:00Z",
    decided_at: str | None = "2026-05-16T15:00:00Z",
    reviewed_at: str | None = "2026-05-16T15:00:00Z",
    supersedes: str | None = None,
    ir_version: str = "ir_v1",
    record_sha256: str | None = None,
) -> dict:
    return {
        "schema_id": "correction_record_v1",
        "schema_version": 1,
        "correction_id": correction_id,
        "target_ir_id": target_ir_id,
        "patch": patch
        or [
            {
                "op": "replace",
                "path": "/fields_raw/senses/0/gloss_fr",
                "value": f"corrected:{correction_id}",
            }
        ],
        "submitter": {"anonymous_token": "anon_0123456789abcdef"},
        "timestamps": {
            "created_at": "2026-05-16T13:00:00Z",
            "updated_at": updated_at,
            "submitted_at": submitted_at,
            "reviewed_at": reviewed_at,
            "decided_at": decided_at,
            "applied_at": None,
        },
        "status": status,
        "provenance": {
            "reason": "test",
            "target_snapshot": {
                "ir_version": ir_version,
                "record_sha256": record_sha256,
            },
            "audit": {
                "submitted_via": "manual_import",
                "reviewer_token": None,
                "decision_note": None,
                "supersedes_correction_id": supersedes,
            },
        },
    }


def _make_manifest(corrections_path: Path, *, schema_id: str = "correctionset_manifest_v1") -> dict:
    data = corrections_path.read_bytes()
    return {
        "correctionset_id": "corrset_test",
        "correctionset_version": "1",
        "schema_id": schema_id,
        "created_at": "2026-05-16T15:00:00Z",
        "target_ir_version": "ir_v1",
        "files": [
            {"path": "corrections.jsonl", "sha256": sha256_prefixed_bytes(data), "byte_length": len(data)},
        ],
        "content_sha256": "sha256:test",
    }


def test_valid_single_correction_applies(tmp_path: Path):
    ir_records = [_make_ir_record("ir_1", "old")]
    ir_path = tmp_path / "ir.jsonl"
    _write_jsonl(ir_path, ir_records)

    correction = _make_correction_record(
        "corr_20260516_000001",
        "ir_1",
        record_sha256=sha256_prefixed(ir_records[0]),
    )
    corrections_path = tmp_path / "corrections.jsonl"
    _write_jsonl(corrections_path, [correction])
    manifest_path = tmp_path / "correctionset.manifest.json"
    _write_json(manifest_path, _make_manifest(corrections_path))

    out_ir = tmp_path / "out.jsonl"
    out_report = tmp_path / "report.json"
    result = run_corrections_dry_run(
        ir_input_path=ir_path,
        correctionset_manifest_path=manifest_path,
        corrections_jsonl_path=corrections_path,
        input_ir_version="ir_v1",
        output_ir_path=out_ir,
        output_report_path=out_report,
        output_manifest_path=None,
        generated_at="2026-05-16T15:01:00Z",
    )

    rows = _read_jsonl(out_ir)
    assert rows[0]["fields_raw"]["senses"][0]["gloss_fr"] == "corrected:corr_20260516_000001"
    assert result.summary["eligible"] == 1
    assert result.summary["applied_in_dry_run"] == 1


def test_multiple_independent_corrections_apply(tmp_path: Path):
    ir_records = [_make_ir_record("ir_1", "old1"), _make_ir_record("ir_2", "old2")]
    ir_path = tmp_path / "ir.jsonl"
    _write_jsonl(ir_path, ir_records)

    corrections = [
        _make_correction_record("corr_20260516_000001", "ir_1", record_sha256=sha256_prefixed(ir_records[0])),
        _make_correction_record("corr_20260516_000002", "ir_2", record_sha256=sha256_prefixed(ir_records[1])),
    ]
    corrections_path = tmp_path / "corrections.jsonl"
    _write_jsonl(corrections_path, corrections)
    manifest_path = tmp_path / "correctionset.manifest.json"
    _write_json(manifest_path, _make_manifest(corrections_path))

    out_ir = tmp_path / "out.jsonl"
    out_report = tmp_path / "report.json"
    result = run_corrections_dry_run(
        ir_input_path=ir_path,
        correctionset_manifest_path=manifest_path,
        corrections_jsonl_path=corrections_path,
        input_ir_version="ir_v1",
        output_ir_path=out_ir,
        output_report_path=out_report,
        output_manifest_path=None,
        generated_at="2026-05-16T15:01:00Z",
    )

    rows = _read_jsonl(out_ir)
    assert rows[0]["fields_raw"]["senses"][0]["gloss_fr"] == "corrected:corr_20260516_000001"
    assert rows[1]["fields_raw"]["senses"][0]["gloss_fr"] == "corrected:corr_20260516_000002"
    assert result.summary["applied_in_dry_run"] == 2


def test_same_record_conflict_detected(tmp_path: Path):
    ir_records = [_make_ir_record("ir_1", "old")]
    ir_path = tmp_path / "ir.jsonl"
    _write_jsonl(ir_path, ir_records)
    record_hash = sha256_prefixed(ir_records[0])

    a = _make_correction_record(
        "corr_20260516_000001",
        "ir_1",
        record_sha256=record_hash,
        patch=[{"op": "replace", "path": "/fields_raw/senses/0/gloss_fr", "value": "A"}],
    )
    b = _make_correction_record(
        "corr_20260516_000002",
        "ir_1",
        record_sha256=record_hash,
        patch=[{"op": "replace", "path": "/fields_raw/senses/0", "value": {"gloss_fr": "B"}}],
    )
    corrections_path = tmp_path / "corrections.jsonl"
    _write_jsonl(corrections_path, [a, b])
    manifest_path = tmp_path / "correctionset.manifest.json"
    _write_json(manifest_path, _make_manifest(corrections_path))

    out_ir = tmp_path / "out.jsonl"
    out_report = tmp_path / "report.json"
    result = run_corrections_dry_run(
        ir_input_path=ir_path,
        correctionset_manifest_path=manifest_path,
        corrections_jsonl_path=corrections_path,
        input_ir_version="ir_v1",
        output_ir_path=out_ir,
        output_report_path=out_report,
        output_manifest_path=None,
        generated_at="2026-05-16T15:01:00Z",
    )
    assert result.summary["conflicted"] == 2
    assert result.summary["applied_in_dry_run"] == 0


def test_same_record_array_shift_risk_conflict_detected(tmp_path: Path):
    ir_records = [_make_ir_record("ir_1", "old")]
    ir_records[0]["fields_raw"]["senses"] = [
        {"gloss_fr": "a"},
        {"gloss_fr": "b"},
    ]
    ir_path = tmp_path / "ir.jsonl"
    _write_jsonl(ir_path, ir_records)
    record_hash = sha256_prefixed(ir_records[0])

    a = _make_correction_record(
        "corr_20260516_000003",
        "ir_1",
        record_sha256=record_hash,
        patch=[{"op": "remove", "path": "/fields_raw/senses/0"}],
    )
    b = _make_correction_record(
        "corr_20260516_000004",
        "ir_1",
        record_sha256=record_hash,
        patch=[{"op": "replace", "path": "/fields_raw/senses/1/gloss_fr", "value": "changed"}],
    )

    corrections_path = tmp_path / "corrections.jsonl"
    _write_jsonl(corrections_path, [a, b])
    manifest_path = tmp_path / "correctionset.manifest.json"
    _write_json(manifest_path, _make_manifest(corrections_path))

    out_ir = tmp_path / "out.jsonl"
    out_report = tmp_path / "report.json"
    result = run_corrections_dry_run(
        ir_input_path=ir_path,
        correctionset_manifest_path=manifest_path,
        corrections_jsonl_path=corrections_path,
        input_ir_version="ir_v1",
        output_ir_path=out_ir,
        output_report_path=out_report,
        output_manifest_path=None,
        generated_at="2026-05-16T15:01:00Z",
    )
    assert result.summary["conflicted"] == 2
    report = _read_json(out_report)
    assert any(item["reason_code"] == "conflict_same_target_array_shift_risk" for item in report["corrections"])


def test_hash_mismatch_rejected(tmp_path: Path):
    ir_records = [_make_ir_record("ir_1", "old")]
    ir_path = tmp_path / "ir.jsonl"
    _write_jsonl(ir_path, ir_records)

    correction = _make_correction_record(
        "corr_20260516_000001",
        "ir_1",
        record_sha256="sha256:not-the-real-hash",
    )
    corrections_path = tmp_path / "corrections.jsonl"
    _write_jsonl(corrections_path, [correction])
    manifest_path = tmp_path / "correctionset.manifest.json"
    _write_json(manifest_path, _make_manifest(corrections_path))

    out_ir = tmp_path / "out.jsonl"
    out_report = tmp_path / "report.json"
    result = run_corrections_dry_run(
        ir_input_path=ir_path,
        correctionset_manifest_path=manifest_path,
        corrections_jsonl_path=corrections_path,
        input_ir_version="ir_v1",
        output_ir_path=out_ir,
        output_report_path=out_report,
        output_manifest_path=None,
        generated_at="2026-05-16T15:01:00Z",
    )
    assert result.summary["applied_in_dry_run"] == 0
    report = _read_json(out_report)
    assert any(item["reason_code"] == "target_snapshot_hash_mismatch" for item in report["corrections"])


def test_lifecycle_resolution_prevents_old_approved_apply(tmp_path: Path):
    ir_records = [_make_ir_record("ir_1", "old")]
    ir_path = tmp_path / "ir.jsonl"
    _write_jsonl(ir_path, ir_records)
    record_hash = sha256_prefixed(ir_records[0])

    older_approved = _make_correction_record(
        "corr_20260516_000001",
        "ir_1",
        status="approved",
        updated_at="2026-05-16T14:00:00Z",
        record_sha256=record_hash,
    )
    newer_rejected = _make_correction_record(
        "corr_20260516_000001",
        "ir_1",
        status="rejected",
        updated_at="2026-05-16T15:00:00Z",
        record_sha256=record_hash,
    )
    corrections_path = tmp_path / "corrections.jsonl"
    _write_jsonl(corrections_path, [older_approved, newer_rejected])
    manifest_path = tmp_path / "correctionset.manifest.json"
    _write_json(manifest_path, _make_manifest(corrections_path))

    out_ir = tmp_path / "out.jsonl"
    out_report = tmp_path / "report.json"
    result = run_corrections_dry_run(
        ir_input_path=ir_path,
        correctionset_manifest_path=manifest_path,
        corrections_jsonl_path=corrections_path,
        input_ir_version="ir_v1",
        output_ir_path=out_ir,
        output_report_path=out_report,
        output_manifest_path=None,
        generated_at="2026-05-16T15:01:00Z",
    )
    rows = _read_jsonl(out_ir)
    assert rows[0]["fields_raw"]["senses"][0]["gloss_fr"] == "old"
    assert result.summary["applied_in_dry_run"] == 0
    report = _read_json(out_report)
    assert any(item["reason_code"] == "non_latest_lifecycle_version" for item in report["corrections"])
    assert any(item["reason_code"] == "not_approved_status" for item in report["corrections"])


def test_deterministic_replay_byte_identical_with_fixed_metadata(tmp_path: Path):
    ir_records = [_make_ir_record("ir_1", "old")]
    ir_path = tmp_path / "ir.jsonl"
    _write_jsonl(ir_path, ir_records)
    correction = _make_correction_record(
        "corr_20260516_000001",
        "ir_1",
        record_sha256=sha256_prefixed(ir_records[0]),
    )
    corrections_path = tmp_path / "corrections.jsonl"
    _write_jsonl(corrections_path, [correction])
    manifest_path = tmp_path / "correctionset.manifest.json"
    _write_json(manifest_path, _make_manifest(corrections_path))

    out_ir_a = tmp_path / "out_a.jsonl"
    out_report_a = tmp_path / "report_a.json"
    out_ir_b = tmp_path / "out_b.jsonl"
    out_report_b = tmp_path / "report_b.json"

    kwargs = dict(
        ir_input_path=ir_path,
        correctionset_manifest_path=manifest_path,
        corrections_jsonl_path=corrections_path,
        input_ir_version="ir_v1",
        output_manifest_path=None,
        generated_at="2026-05-16T15:01:00Z",
    )
    run_corrections_dry_run(output_ir_path=out_ir_a, output_report_path=out_report_a, **kwargs)
    run_corrections_dry_run(output_ir_path=out_ir_b, output_report_path=out_report_b, **kwargs)

    assert out_ir_a.read_bytes() == out_ir_b.read_bytes()
    assert out_report_a.read_bytes() == out_report_b.read_bytes()


def test_global_ir_version_mismatch_is_fatal(tmp_path: Path):
    ir_records = [_make_ir_record("ir_1", "old")]
    ir_path = tmp_path / "ir.jsonl"
    _write_jsonl(ir_path, ir_records)
    correction = _make_correction_record(
        "corr_20260516_000001",
        "ir_1",
        record_sha256=sha256_prefixed(ir_records[0]),
    )
    corrections_path = tmp_path / "corrections.jsonl"
    _write_jsonl(corrections_path, [correction])
    manifest = _make_manifest(corrections_path)
    manifest["target_ir_version"] = "ir_v2"
    manifest_path = tmp_path / "correctionset.manifest.json"
    _write_json(manifest_path, manifest)

    with pytest.raises(ValueError, match="fatal version mismatch"):
        run_corrections_dry_run(
            ir_input_path=ir_path,
            correctionset_manifest_path=manifest_path,
            corrections_jsonl_path=corrections_path,
            input_ir_version="ir_v1",
            output_ir_path=tmp_path / "out.jsonl",
            output_report_path=tmp_path / "report.json",
            output_manifest_path=None,
            generated_at="2026-05-16T15:01:00Z",
        )


def test_latest_non_approved_is_skipped_with_reason(tmp_path: Path):
    ir_records = [_make_ir_record("ir_1", "old")]
    ir_path = tmp_path / "ir.jsonl"
    _write_jsonl(ir_path, ir_records)
    record_hash = sha256_prefixed(ir_records[0])

    approved_old = _make_correction_record(
        "corr_20260516_000001",
        "ir_1",
        status="approved",
        updated_at="2026-05-16T14:00:00Z",
        record_sha256=record_hash,
    )
    withdrawn_new = _make_correction_record(
        "corr_20260516_000001",
        "ir_1",
        status="withdrawn",
        updated_at="2026-05-16T15:00:00Z",
        record_sha256=record_hash,
    )

    corrections_path = tmp_path / "corrections.jsonl"
    _write_jsonl(corrections_path, [approved_old, withdrawn_new])
    manifest_path = tmp_path / "correctionset.manifest.json"
    _write_json(manifest_path, _make_manifest(corrections_path))

    out_ir = tmp_path / "out.jsonl"
    out_report = tmp_path / "report.json"
    result = run_corrections_dry_run(
        ir_input_path=ir_path,
        correctionset_manifest_path=manifest_path,
        corrections_jsonl_path=corrections_path,
        input_ir_version="ir_v1",
        output_ir_path=out_ir,
        output_report_path=out_report,
        output_manifest_path=None,
        generated_at="2026-05-16T15:01:00Z",
    )
    assert result.summary["applied_in_dry_run"] == 0
    report = _read_json(out_report)
    assert any(item["reason_code"] == "not_approved_status" for item in report["corrections"])


def test_supersession_excludes_older_approved(tmp_path: Path):
    ir_records = [_make_ir_record("ir_1", "old")]
    ir_path = tmp_path / "ir.jsonl"
    _write_jsonl(ir_path, ir_records)
    record_hash = sha256_prefixed(ir_records[0])

    corr_a = _make_correction_record(
        "corr_20260516_000001",
        "ir_1",
        status="approved",
        updated_at="2026-05-16T14:00:00Z",
        record_sha256=record_hash,
    )
    corr_b = _make_correction_record(
        "corr_20260516_000002",
        "ir_1",
        status="approved",
        updated_at="2026-05-16T15:00:00Z",
        supersedes="corr_20260516_000001",
        patch=[{"op": "replace", "path": "/fields_raw/senses/0/gloss_fr", "value": "from-b"}],
        record_sha256=record_hash,
    )

    corrections_path = tmp_path / "corrections.jsonl"
    _write_jsonl(corrections_path, [corr_a, corr_b])
    manifest_path = tmp_path / "correctionset.manifest.json"
    _write_json(manifest_path, _make_manifest(corrections_path))

    out_ir = tmp_path / "out.jsonl"
    out_report = tmp_path / "report.json"
    result = run_corrections_dry_run(
        ir_input_path=ir_path,
        correctionset_manifest_path=manifest_path,
        corrections_jsonl_path=corrections_path,
        input_ir_version="ir_v1",
        output_ir_path=out_ir,
        output_report_path=out_report,
        output_manifest_path=None,
        generated_at="2026-05-16T15:01:00Z",
    )
    rows = _read_jsonl(out_ir)
    assert rows[0]["fields_raw"]["senses"][0]["gloss_fr"] == "from-b"
    assert result.summary["applied_in_dry_run"] == 1
    report = _read_json(out_report)
    assert any(item["reason_code"] == "superseded_by_newer_correction" for item in report["corrections"])


def test_invalid_correctionset_manifest_schema_id_rejected(tmp_path: Path):
    ir_records = [_make_ir_record("ir_1", "old")]
    ir_path = tmp_path / "ir.jsonl"
    _write_jsonl(ir_path, ir_records)
    correction = _make_correction_record(
        "corr_20260516_000001",
        "ir_1",
        record_sha256=sha256_prefixed(ir_records[0]),
    )
    corrections_path = tmp_path / "corrections.jsonl"
    _write_jsonl(corrections_path, [correction])
    manifest_path = tmp_path / "correctionset.manifest.json"
    _write_json(manifest_path, _make_manifest(corrections_path, schema_id="wrong_schema"))

    with pytest.raises(ValueError, match="schema_id must be correctionset_manifest_v1"):
        run_corrections_dry_run(
            ir_input_path=ir_path,
            correctionset_manifest_path=manifest_path,
            corrections_jsonl_path=corrections_path,
            input_ir_version="ir_v1",
            output_ir_path=tmp_path / "out.jsonl",
            output_report_path=tmp_path / "report.json",
            output_manifest_path=None,
            generated_at="2026-05-16T15:01:00Z",
        )


def test_corrections_jsonl_byte_length_mismatch_rejected(tmp_path: Path):
    ir_records = [_make_ir_record("ir_1", "old")]
    ir_path = tmp_path / "ir.jsonl"
    _write_jsonl(ir_path, ir_records)
    correction = _make_correction_record(
        "corr_20260516_000001",
        "ir_1",
        record_sha256=sha256_prefixed(ir_records[0]),
    )
    corrections_path = tmp_path / "corrections.jsonl"
    _write_jsonl(corrections_path, [correction])
    manifest = _make_manifest(corrections_path)
    manifest["files"][0]["byte_length"] = manifest["files"][0]["byte_length"] + 1
    manifest_path = tmp_path / "correctionset.manifest.json"
    _write_json(manifest_path, manifest)

    with pytest.raises(ValueError, match="integrity mismatch"):
        run_corrections_dry_run(
            ir_input_path=ir_path,
            correctionset_manifest_path=manifest_path,
            corrections_jsonl_path=corrections_path,
            input_ir_version="ir_v1",
            output_ir_path=tmp_path / "out.jsonl",
            output_report_path=tmp_path / "report.json",
            output_manifest_path=None,
            generated_at="2026-05-16T15:01:00Z",
        )


def test_corrections_jsonl_sha256_mismatch_rejected(tmp_path: Path):
    ir_records = [_make_ir_record("ir_1", "old")]
    ir_path = tmp_path / "ir.jsonl"
    _write_jsonl(ir_path, ir_records)
    correction = _make_correction_record(
        "corr_20260516_000001",
        "ir_1",
        record_sha256=sha256_prefixed(ir_records[0]),
    )
    corrections_path = tmp_path / "corrections.jsonl"
    _write_jsonl(corrections_path, [correction])
    manifest = _make_manifest(corrections_path)
    manifest["files"][0]["sha256"] = "sha256:deadbeef"
    manifest_path = tmp_path / "correctionset.manifest.json"
    _write_json(manifest_path, manifest)

    with pytest.raises(ValueError, match="integrity mismatch"):
        run_corrections_dry_run(
            ir_input_path=ir_path,
            correctionset_manifest_path=manifest_path,
            corrections_jsonl_path=corrections_path,
            input_ir_version="ir_v1",
            output_ir_path=tmp_path / "out.jsonl",
            output_report_path=tmp_path / "report.json",
            output_manifest_path=None,
            generated_at="2026-05-16T15:01:00Z",
        )


def test_invalid_patch_pointer_escape_tilde2_rejected(tmp_path: Path):
    ir_records = [_make_ir_record("ir_1", "old")]
    ir_path = tmp_path / "ir.jsonl"
    _write_jsonl(ir_path, ir_records)
    correction = _make_correction_record(
        "corr_20260516_000001",
        "ir_1",
        patch=[{"op": "replace", "path": "/fields_raw/senses/~2/gloss_fr", "value": "x"}],
        record_sha256=sha256_prefixed(ir_records[0]),
    )
    corrections_path = tmp_path / "corrections.jsonl"
    _write_jsonl(corrections_path, [correction])
    manifest_path = tmp_path / "correctionset.manifest.json"
    _write_json(manifest_path, _make_manifest(corrections_path))

    run_corrections_dry_run(
        ir_input_path=ir_path,
        correctionset_manifest_path=manifest_path,
        corrections_jsonl_path=corrections_path,
        input_ir_version="ir_v1",
        output_ir_path=tmp_path / "out.jsonl",
        output_report_path=tmp_path / "report.json",
        output_manifest_path=None,
        generated_at="2026-05-16T15:01:00Z",
    )
    report = _read_json(tmp_path / "report.json")
    assert any(item["reason_code"] == "invalid_patch_path" for item in report["corrections"])


def test_invalid_patch_pointer_escape_trailing_tilde_rejected(tmp_path: Path):
    ir_records = [_make_ir_record("ir_1", "old")]
    ir_path = tmp_path / "ir.jsonl"
    _write_jsonl(ir_path, ir_records)
    correction = _make_correction_record(
        "corr_20260516_000001",
        "ir_1",
        patch=[{"op": "replace", "path": "/fields_raw/senses/~", "value": "x"}],
        record_sha256=sha256_prefixed(ir_records[0]),
    )
    corrections_path = tmp_path / "corrections.jsonl"
    _write_jsonl(corrections_path, [correction])
    manifest_path = tmp_path / "correctionset.manifest.json"
    _write_json(manifest_path, _make_manifest(corrections_path))

    run_corrections_dry_run(
        ir_input_path=ir_path,
        correctionset_manifest_path=manifest_path,
        corrections_jsonl_path=corrections_path,
        input_ir_version="ir_v1",
        output_ir_path=tmp_path / "out.jsonl",
        output_report_path=tmp_path / "report.json",
        output_manifest_path=None,
        generated_at="2026-05-16T15:01:00Z",
    )
    report = _read_json(tmp_path / "report.json")
    assert any(item["reason_code"] == "invalid_patch_path" for item in report["corrections"])

