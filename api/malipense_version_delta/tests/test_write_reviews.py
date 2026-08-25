"""Tests for Malidaba delta review persistence (CORPUS1F13)."""

from __future__ import annotations

import csv
import io
import json
from pathlib import Path

import pytest
import zstandard as zstd

from malipense_version_delta.canonical_json import sha256_file, write_jsonl
from malipense_version_delta.compare import compare_lexicon_records
from malipense_version_delta.dry_run_reviews import dry_run_import_review_worksheet
from malipense_version_delta.export_worksheet import (
    WORKSHEET_COLUMNS_V2,
    WORKSHEET_SCHEMA_V2,
    export_batch_worksheet,
)
from malipense_version_delta.review_identity import generate_malidaba_review_id
from malipense_version_delta.review_triage import build_triage_in_memory
from malipense_version_delta.tests.test_compare import URL_A, _entry
from malipense_version_delta.validate_reviews import (
    MalidabaReviewValidationError,
    validate_malidaba_reviews,
)
from malipense_version_delta.write_reviews import (
    MalidabaReviewWriteError,
    rows_to_jsonl_text,
    write_malidaba_reviews,
)


REVIEWED_AT = "2026-08-22T12:45:00-04:00"
REVIEWER = "Reviewer_001"


def _write_min_crawl(tmp_path: Path) -> Path:
    crawl = tmp_path / "crawl"
    payloads = crawl / "payloads"
    payloads.mkdir(parents=True)
    html = """<!DOCTYPE html><html><body>
<p class="lxP"><span id="e1" class="Lxe">new1</span></p>
<p class="lxP2"><span class="PS">n brique</span><span class="GlFr">brique</span></p>
<p class="lxP"><span id="e2" class="Lxe">new2</span></p>
<p class="lxP2"><span class="PS">v</span><span class="GlFr">courir</span></p>
</body></html>"""
    meta = {"snapshot_id": "s1", "url_canonical": URL_A}
    (crawl / "snapshots.jsonl").write_text(json.dumps(meta) + "\n", encoding="utf-8")
    (payloads / "s1.html.zst").write_bytes(zstd.ZstdCompressor().compress(html.encode()))
    return crawl


def _setup_batch(tmp_path: Path, n: int = 2) -> dict[str, Path]:
    baseline: list[dict] = []
    current = [
        _entry(ir_id=f"c{i}", url=URL_A, source_record_id=f"e{i}", headword=f"new{i}")
        for i in range(1, n + 1)
    ]
    baseline_path = tmp_path / "baseline.jsonl"
    current_path = tmp_path / "current.jsonl"
    delta_path = tmp_path / "delta.jsonl"
    write_jsonl(baseline_path, baseline)
    write_jsonl(current_path, current)
    delta, _ = compare_lexicon_records(baseline, current, parser_compat_status="PASS")
    write_jsonl(delta_path, delta)
    crawl = _write_min_crawl(tmp_path)
    triage = build_triage_in_memory(
        baseline_ir_path=baseline_path,
        current_ir_path=current_path,
        delta_path=delta_path,
        crawl_dir=crawl,
        verify_hashes=False,
        batch_target=n,
    )
    blank = tmp_path / "blank.csv"
    export_batch_worksheet(
        batch_rows=triage.batch_rows,
        current_ir_path=current_path,
        output_path=blank,
        delta_sha256=sha256_file(delta_path),
        current_ir_sha256=sha256_file(current_path),
    )
    return {
        "baseline": baseline_path,
        "current": current_path,
        "delta": delta_path,
        "crawl": crawl,
        "blank": blank,
    }


def _fill_completed(blank: Path, completed: Path, **overrides) -> None:
    rows = list(csv.DictReader(blank.open(encoding="utf-8")))
    for row in rows:
        row["review_decision"] = overrides.get("review_decision", "confirmed_source_delta")
        row["reviewer_id"] = overrides.get("reviewer_id", REVIEWER)
        row["reviewed_at"] = overrides.get("reviewed_at", REVIEWED_AT)
        row["review_method"] = overrides.get("review_method", "manual_review")
        if "issue_codes" in overrides:
            row["issue_codes"] = overrides["issue_codes"]
        if "review_notes" in overrides:
            row["review_notes"] = overrides["review_notes"]
    with completed.open("w", encoding="utf-8", newline="\n") as handle:
        writer = csv.DictWriter(handle, fieldnames=WORKSHEET_COLUMNS_V2, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def test_blank_worksheet_skips_all(tmp_path: Path):
    paths = _setup_batch(tmp_path)
    result = dry_run_import_review_worksheet(
        paths["blank"],
        baseline_ir_path=paths["baseline"],
        current_ir_path=paths["current"],
        delta_path=paths["delta"],
        crawl_dir=paths["crawl"],
        verify_hashes=False,
    )
    assert result.summary["rows_read"] == 2
    assert result.summary["rows_skipped_unreviewed"] == 2
    assert result.summary["preview_row_count"] == 0
    assert result.summary["error_count"] == 0


def test_completed_worksheet_dry_run(tmp_path: Path):
    paths = _setup_batch(tmp_path)
    completed = tmp_path / "completed.csv"
    _fill_completed(paths["blank"], completed)
    result = dry_run_import_review_worksheet(
        completed,
        baseline_ir_path=paths["baseline"],
        current_ir_path=paths["current"],
        delta_path=paths["delta"],
        crawl_dir=paths["crawl"],
        verify_hashes=False,
    )
    assert result.summary["rows_read"] == 2
    assert result.summary["rows_skipped_unreviewed"] == 0
    assert result.summary["preview_row_count"] == 2
    assert result.summary["error_count"] == 0
    assert result.summary["decision_counts"] == {"confirmed_source_delta": 2}
    assert all(p["review_id"].startswith("mdrv_") for p in result.preview_rows)


def test_deterministic_review_ids():
    preview = {
        "batch_id": "malidaba_new_headword_review_batch_001",
        "current_ir_sha256": "c" * 64,
        "current_record_fingerprint_sha256": "f" * 64,
        "delta_sha256": "d" * 64,
        "issue_codes": [],
        "review_decision": "confirmed_source_delta",
        "review_method": "manual_review",
        "review_notes": "",
        "review_subject_id": "abc123",
        "reviewed_at": REVIEWED_AT,
        "reviewer_id": REVIEWER,
    }
    assert generate_malidaba_review_id(preview) == generate_malidaba_review_id(dict(preview))


def test_context_tampering_blocks(tmp_path: Path):
    paths = _setup_batch(tmp_path)
    completed = tmp_path / "completed.csv"
    _fill_completed(paths["blank"], completed)
    text = completed.read_text(encoding="utf-8")
    tampered = text.replace("BASE_LEXICAL", "TOPONYM", 1)
    path = tmp_path / "tampered.csv"
    path.write_text(tampered, encoding="utf-8")
    result = dry_run_import_review_worksheet(
        path,
        baseline_ir_path=paths["baseline"],
        current_ir_path=paths["current"],
        delta_path=paths["delta"],
        crawl_dir=paths["crawl"],
        verify_hashes=False,
    )
    assert result.summary["error_count"] >= 1


def test_fingerprint_mismatch_blocks(tmp_path: Path):
    paths = _setup_batch(tmp_path)
    completed = tmp_path / "completed.csv"
    _fill_completed(paths["blank"], completed)
    rows = list(csv.DictReader(completed.open(encoding="utf-8")))
    rows[0]["current_record_fingerprint_sha256"] = "0" * 64
    with completed.open("w", encoding="utf-8", newline="\n") as handle:
        writer = csv.DictWriter(handle, fieldnames=WORKSHEET_COLUMNS_V2, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
    result = dry_run_import_review_worksheet(
        completed,
        baseline_ir_path=paths["baseline"],
        current_ir_path=paths["current"],
        delta_path=paths["delta"],
        crawl_dir=paths["crawl"],
        verify_hashes=False,
    )
    assert result.summary["error_count"] >= 1
    assert any("STALE" in e for e in result.errors)


def test_invalid_decision_blocks(tmp_path: Path):
    paths = _setup_batch(tmp_path)
    completed = tmp_path / "completed.csv"
    _fill_completed(paths["blank"], completed, review_decision="approved_for_dictionary")
    result = dry_run_import_review_worksheet(
        completed,
        baseline_ir_path=paths["baseline"],
        current_ir_path=paths["current"],
        delta_path=paths["delta"],
        crawl_dir=paths["crawl"],
        verify_hashes=False,
    )
    assert result.summary["error_count"] >= 1


def test_missing_reviewer_blocks(tmp_path: Path):
    paths = _setup_batch(tmp_path)
    completed = tmp_path / "completed.csv"
    _fill_completed(paths["blank"], completed, reviewer_id="")
    # Empty reviewer_id after fill: rewrite with decision but blank reviewer
    rows = list(csv.DictReader(paths["blank"].open(encoding="utf-8")))
    for row in rows:
        row["review_decision"] = "confirmed_source_delta"
        row["reviewer_id"] = ""
        row["reviewed_at"] = REVIEWED_AT
        row["review_method"] = "manual_review"
    with completed.open("w", encoding="utf-8", newline="\n") as handle:
        writer = csv.DictWriter(handle, fieldnames=WORKSHEET_COLUMNS_V2, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
    result = dry_run_import_review_worksheet(
        completed,
        baseline_ir_path=paths["baseline"],
        current_ir_path=paths["current"],
        delta_path=paths["delta"],
        crawl_dir=paths["crawl"],
        verify_hashes=False,
    )
    assert result.summary["error_count"] >= 1
    assert any("reviewer_id" in e for e in result.errors)


def test_timezone_naive_reviewed_at_blocks(tmp_path: Path):
    paths = _setup_batch(tmp_path)
    completed = tmp_path / "completed.csv"
    _fill_completed(paths["blank"], completed, reviewed_at="2026-08-22T12:45:00")
    result = dry_run_import_review_worksheet(
        completed,
        baseline_ir_path=paths["baseline"],
        current_ir_path=paths["current"],
        delta_path=paths["delta"],
        crawl_dir=paths["crawl"],
        verify_hashes=False,
    )
    assert result.summary["error_count"] >= 1
    assert any("timezone" in e for e in result.errors)


def test_first_apply_and_idempotence(tmp_path: Path):
    paths = _setup_batch(tmp_path)
    completed = tmp_path / "completed.csv"
    _fill_completed(paths["blank"], completed)
    registry = tmp_path / "malidaba_delta_reviews_v1.jsonl"

    plan1 = write_malidaba_reviews(
        completed,
        baseline_ir_path=paths["baseline"],
        current_ir_path=paths["current"],
        delta_path=paths["delta"],
        crawl_dir=paths["crawl"],
        output_path=registry,
        apply=True,
        verify_hashes=False,
    )
    assert plan1.receipt["rows_before"] == 0
    assert plan1.receipt["candidate_rows"] == 2
    assert plan1.receipt["new_rows_written"] == 2
    assert plan1.receipt["rows_after"] == 2
    sha1 = sha256_file(registry)

    plan2 = write_malidaba_reviews(
        completed,
        baseline_ir_path=paths["baseline"],
        current_ir_path=paths["current"],
        delta_path=paths["delta"],
        crawl_dir=paths["crawl"],
        output_path=registry,
        apply=True,
        verify_hashes=False,
    )
    assert plan2.receipt["new_rows_written"] == 0
    assert plan2.receipt["already_present_identical"] == 2
    assert plan2.receipt["rows_after"] == 2
    assert sha256_file(registry) == sha1


def test_conflicting_same_review_id_blocks(tmp_path: Path, monkeypatch):
    paths = _setup_batch(tmp_path)
    completed = tmp_path / "completed.csv"
    _fill_completed(paths["blank"], completed)
    registry = tmp_path / "malidaba_delta_reviews_v1.jsonl"
    write_malidaba_reviews(
        completed,
        baseline_ir_path=paths["baseline"],
        current_ir_path=paths["current"],
        delta_path=paths["delta"],
        crawl_dir=paths["crawl"],
        output_path=registry,
        apply=True,
        verify_hashes=False,
    )
    existing = [
        json.loads(line)
        for line in registry.read_text(encoding="utf-8").splitlines()
        if line
    ]
    fixed_ids = {row["review_subject_id"]: row["review_id"] for row in existing}

    # Change notes → would normally create new review_id; force same IDs to simulate conflict.
    completed2 = tmp_path / "completed2.csv"
    _fill_completed(paths["blank"], completed2, review_notes="human note")

    from malipense_version_delta import dry_run_reviews as dry_mod
    from malipense_version_delta import validate_reviews as val_mod

    def fixed_id(preview):
        return fixed_ids[str(preview["review_subject_id"])]

    monkeypatch.setattr(dry_mod, "generate_malidaba_review_id", fixed_id)
    monkeypatch.setattr(val_mod, "generate_malidaba_review_id", fixed_id)

    with pytest.raises(MalidabaReviewWriteError, match="review_id conflict"):
        write_malidaba_reviews(
            completed2,
            baseline_ir_path=paths["baseline"],
            current_ir_path=paths["current"],
            delta_path=paths["delta"],
            crawl_dir=paths["crawl"],
            output_path=registry,
            apply=True,
            verify_hashes=False,
        )


def test_exact_temp_file_validation_and_corrupted_temp_blocks(tmp_path: Path, monkeypatch):
    paths = _setup_batch(tmp_path)
    completed = tmp_path / "completed.csv"
    _fill_completed(paths["blank"], completed)
    registry = tmp_path / "malidaba_delta_reviews_v1.jsonl"

    from malipense_version_delta import write_reviews as wr

    original_read = Path.read_text

    def corrupt_temp_read(self, *args, **kwargs):
        text = original_read(self, *args, **kwargs)
        if self.name.endswith(".tmp"):
            return text + "CORRUPT\n"
        return text

    monkeypatch.setattr(Path, "read_text", corrupt_temp_read)
    with pytest.raises(MalidabaReviewWriteError, match="bytes mismatch"):
        write_malidaba_reviews(
            completed,
            baseline_ir_path=paths["baseline"],
            current_ir_path=paths["current"],
            delta_path=paths["delta"],
            crawl_dir=paths["crawl"],
            output_path=registry,
            apply=True,
            verify_hashes=False,
        )
    assert not registry.exists()


def test_registry_deterministic_ordering(tmp_path: Path):
    paths = _setup_batch(tmp_path)
    completed = tmp_path / "completed.csv"
    _fill_completed(paths["blank"], completed)
    registry = tmp_path / "malidaba_delta_reviews_v1.jsonl"
    write_malidaba_reviews(
        completed,
        baseline_ir_path=paths["baseline"],
        current_ir_path=paths["current"],
        delta_path=paths["delta"],
        crawl_dir=paths["crawl"],
        output_path=registry,
        apply=True,
        verify_hashes=False,
    )
    ids = [
        json.loads(line)["review_id"]
        for line in registry.read_text(encoding="utf-8").splitlines()
        if line
    ]
    assert ids == sorted(ids)
    validate_malidaba_reviews(registry)


def test_no_product_promotion_fields(tmp_path: Path):
    paths = _setup_batch(tmp_path)
    completed = tmp_path / "completed.csv"
    _fill_completed(paths["blank"], completed)
    registry = tmp_path / "malidaba_delta_reviews_v1.jsonl"
    write_malidaba_reviews(
        completed,
        baseline_ir_path=paths["baseline"],
        current_ir_path=paths["current"],
        delta_path=paths["delta"],
        crawl_dir=paths["crawl"],
        output_path=registry,
        apply=True,
        verify_hashes=False,
    )
    blob = registry.read_text(encoding="utf-8")
    assert "approved_for_dictionary" not in blob
    assert "publication" not in blob
    assert "bundle" not in blob
