"""Tests for worksheet v2 classification-evidence observability (CORPUS1F12A)."""

from __future__ import annotations

import csv
import io
from pathlib import Path

import pytest
import zstandard as zstd

from malipense_version_delta.dry_run_reviews import dry_run_import_review_worksheet
from malipense_version_delta.export_worksheet import (
    WORKSHEET_COLUMNS_V2,
    WORKSHEET_SCHEMA_V2,
    build_worksheet_row,
    export_batch_worksheet,
    validate_batch_row_classification_evidence,
    MalidabaReviewWorksheetError,
)
from malipense_version_delta.review_triage import build_triage_in_memory
from malipense_version_delta.source_section import (
    CLASS_BASE_LEXICAL,
    CLASSIFICATION_RULE_ID,
    derive_classification_evidence,
)
from malipense_version_delta.tests.test_compare import URL_A, _entry


def _write_min_crawl(tmp_path: Path) -> Path:
    crawl = tmp_path / "crawl"
    payloads = crawl / "payloads"
    payloads.mkdir(parents=True)
    html = """<!DOCTYPE html><html><body>
<p class="lxP"><span id="e1" class="Lxe">new1</span></p>
<p class="lxP2"><span class="PS">n brique</span><span class="GlFr">brique</span></p>
</body></html>"""
    meta = {"snapshot_id": "s1", "url_canonical": URL_A}
    (crawl / "snapshots.jsonl").write_text(
        __import__("json").dumps(meta) + "\n", encoding="utf-8"
    )
    (payloads / "s1.html.zst").write_bytes(zstd.ZstdCompressor().compress(html.encode()))
    return crawl


def _queue_row(**overrides) -> dict:
    row = {
        "review_subject_id": "c1",
        "delta_class": "NEW_IN_CURRENT_SOURCE",
        "source_section_class": CLASS_BASE_LEXICAL,
        "source_section_ps_text": "n brique",
        "source_section_ps_marker": None,
        "source_section_rule_id": CLASSIFICATION_RULE_ID,
        "identity_confidence": "PROVISIONAL",
        "url_canonical": URL_A,
        "source_record_id": "e1",
        "headword_latin": "new1",
        "headword_group_id": f"{URL_A}|new1",
        "headword_group_size": 1,
        "current_record_fingerprint_sha256": "abc",
        "reviewability": {"has_sense": True, "example_count": 0, "idiom_or_subentry_count": 0},
    }
    row.update(overrides)
    return row


def test_derive_classification_evidence_ordinary_pos():
    assert derive_classification_evidence(
        ps_text="v écraser",
        section_class=CLASS_BASE_LEXICAL,
    ) == "ordinary_pos:v"


def test_worksheet_exports_exact_source_ps_raw():
    record = _entry(ir_id="c1", url=URL_A, source_record_id="e1", headword="new1")
    row = build_worksheet_row(
        _queue_row(),
        record,
        delta_sha256="d" * 64,
        current_ir_sha256="c" * 64,
        worksheet_schema=WORKSHEET_SCHEMA_V2,
    )
    assert row["source_ps_raw"] == "n brique"
    assert row["source_classification_rule_id"] == CLASSIFICATION_RULE_ID
    assert row["source_classification_evidence"] == "ordinary_pos:n"


def test_normalized_pos_remains_distinct_from_raw_ps():
    record = _entry(ir_id="c1", url=URL_A, source_record_id="e1", headword="new1")
    row = build_worksheet_row(
        _queue_row(),
        record,
        delta_sha256="d" * 64,
        current_ir_sha256="c" * 64,
        worksheet_schema=WORKSHEET_SCHEMA_V2,
    )
    assert row["source_ps_raw"] == "n brique"
    assert row["pos"] == ""


def test_missing_classification_evidence_blocks_batch_export():
    with pytest.raises(MalidabaReviewWorksheetError, match="missing source_ps_raw"):
        validate_batch_row_classification_evidence(
            _queue_row(source_section_ps_text=None, source_section_class=CLASS_BASE_LEXICAL)
        )


def test_ps_edit_fails_stale_context_validation(tmp_path: Path):
    baseline: list[dict] = []
    current = [_entry(ir_id="c1", url=URL_A, source_record_id="e1", headword="new1")]
    baseline_path = tmp_path / "baseline.jsonl"
    current_path = tmp_path / "current.jsonl"
    delta_path = tmp_path / "delta.jsonl"
    from malipense_version_delta.canonical_json import write_jsonl
    from malipense_version_delta.compare import compare_lexicon_records

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
        batch_target=1,
    )
    expected = build_worksheet_row(
        triage.batch_rows[0],
        current[0],
        delta_sha256="d" * 64,
        current_ir_sha256="c" * 64,
        worksheet_schema=WORKSHEET_SCHEMA_V2,
    )
    tampered = dict(expected)
    tampered["source_ps_raw"] = "TAMPERED"
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=WORKSHEET_COLUMNS_V2, lineterminator="\n")
    writer.writeheader()
    writer.writerow(tampered)
    path = tmp_path / "tampered.csv"
    path.write_text(buf.getvalue(), encoding="utf-8")

    result = dry_run_import_review_worksheet(
        path,
        baseline_ir_path=baseline_path,
        current_ir_path=current_path,
        delta_path=delta_path,
        crawl_dir=crawl,
        expected_by_id={"c1": expected},
    )
    assert result.summary["error_count"] >= 1
    assert any("source_ps_raw" in err or "STALE" in err for err in result.errors)


def test_rule_id_edit_fails_stale_context_validation(tmp_path: Path):
    expected = build_worksheet_row(
        _queue_row(),
        _entry(ir_id="c1", url=URL_A, source_record_id="e1", headword="new1"),
        delta_sha256="d" * 64,
        current_ir_sha256="c" * 64,
        worksheet_schema=WORKSHEET_SCHEMA_V2,
    )
    tampered = dict(expected)
    tampered["source_classification_rule_id"] = "tampered_rule"
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=WORKSHEET_COLUMNS_V2, lineterminator="\n")
    writer.writeheader()
    writer.writerow(tampered)
    path = tmp_path / "tampered_rule.csv"
    path.write_text(buf.getvalue(), encoding="utf-8")

    result = dry_run_import_review_worksheet(
        path,
        baseline_ir_path=tmp_path / "b.jsonl",
        current_ir_path=tmp_path / "c.jsonl",
        delta_path=tmp_path / "d.jsonl",
        crawl_dir=tmp_path / "crawl",
        expected_by_id={"c1": expected},
    )
    assert result.summary["error_count"] >= 1


def test_classification_evidence_edit_fails_stale_context_validation(tmp_path: Path):
    expected = build_worksheet_row(
        _queue_row(),
        _entry(ir_id="c1", url=URL_A, source_record_id="e1", headword="new1"),
        delta_sha256="d" * 64,
        current_ir_sha256="c" * 64,
        worksheet_schema=WORKSHEET_SCHEMA_V2,
    )
    tampered = dict(expected)
    tampered["source_classification_evidence"] = "ordinary_pos:TAMPERED"
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=WORKSHEET_COLUMNS_V2, lineterminator="\n")
    writer.writeheader()
    writer.writerow(tampered)
    path = tmp_path / "tampered_evidence.csv"
    path.write_text(buf.getvalue(), encoding="utf-8")

    result = dry_run_import_review_worksheet(
        path,
        baseline_ir_path=tmp_path / "b.jsonl",
        current_ir_path=tmp_path / "c.jsonl",
        delta_path=tmp_path / "d.jsonl",
        crawl_dir=tmp_path / "crawl",
        expected_by_id={"c1": expected},
    )
    assert result.summary["error_count"] >= 1


def test_v2_blank_worksheet_dry_run(tmp_path: Path):
    baseline: list[dict] = []
    current = [_entry(ir_id="c1", url=URL_A, source_record_id="e1", headword="new1")]
    baseline_path = tmp_path / "baseline.jsonl"
    current_path = tmp_path / "current.jsonl"
    delta_path = tmp_path / "delta.jsonl"
    from malipense_version_delta.canonical_json import sha256_file, write_jsonl
    from malipense_version_delta.compare import compare_lexicon_records

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
        batch_target=1,
    )
    worksheet_path = tmp_path / "batch.csv"
    export_batch_worksheet(
        batch_rows=triage.batch_rows,
        current_ir_path=current_path,
        output_path=worksheet_path,
        delta_sha256=sha256_file(delta_path),
        current_ir_sha256=sha256_file(current_path),
    )

    result = dry_run_import_review_worksheet(
        worksheet_path,
        baseline_ir_path=baseline_path,
        current_ir_path=current_path,
        delta_path=delta_path,
        crawl_dir=crawl,
        verify_hashes=False,
    )
    assert result.summary["rows_read"] == 1
    assert result.summary["rows_skipped_unreviewed"] == 1
    assert result.summary["preview_row_count"] == 0
    assert result.summary["error_count"] == 0
    assert result.summary["worksheet_schema"] == WORKSHEET_SCHEMA_V2


def test_subject_ids_unchanged_under_schema_only_regeneration(tmp_path: Path):
    baseline: list[dict] = []
    current = [_entry(ir_id="c1", url=URL_A, source_record_id="e1", headword="new1")]
    baseline_path = tmp_path / "baseline.jsonl"
    current_path = tmp_path / "current.jsonl"
    delta_path = tmp_path / "delta.jsonl"
    from malipense_version_delta.canonical_json import write_jsonl
    from malipense_version_delta.compare import compare_lexicon_records

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
        batch_target=1,
    )
    path1 = tmp_path / "batch1.csv"
    path2 = tmp_path / "batch2.csv"
    export_batch_worksheet(
        batch_rows=triage.batch_rows,
        current_ir_path=current_path,
        output_path=path1,
        delta_sha256="d" * 64,
        current_ir_sha256="c" * 64,
    )
    export_batch_worksheet(
        batch_rows=triage.batch_rows,
        current_ir_path=current_path,
        output_path=path2,
        delta_sha256="d" * 64,
        current_ir_sha256="c" * 64,
    )
    ids1 = [r["review_subject_id"] for r in csv.DictReader(path1.open())]
    ids2 = [r["review_subject_id"] for r in csv.DictReader(path2.open())]
    assert ids1 == ids2
