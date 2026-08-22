"""Tests for Malidaba delta review triage, batch selection, and dry-run."""

from __future__ import annotations

import csv
import io
import json
from pathlib import Path

import pytest
import zstandard as zstd

from malipense_version_delta.batch_selection import (
    BATCH_SELECTION_ALGORITHM_ID,
    select_batch_records,
)
from malipense_version_delta.canonical_json import sha256_file, write_jsonl
from malipense_version_delta.compare import compare_lexicon_records
from malipense_version_delta.dry_run_reviews import dry_run_import_review_worksheet
from malipense_version_delta.export_worksheet import (
    WORKSHEET_COLUMNS,
    build_worksheet_row,
    export_batch_worksheet,
)
from malipense_version_delta.frozen_inputs import (
    FROZEN_BASELINE_IR_SHA256,
    FrozenInputMismatchError,
    verify_frozen_inputs,
)
from malipense_version_delta.record_fingerprint import current_record_fingerprint_sha256
from malipense_version_delta.review_descriptors import headword_group_id
from malipense_version_delta.review_triage import (
    QUEUE_AMBIGUOUS,
    QUEUE_MISSING,
    QUEUE_NEW_EXISTING_HW,
    QUEUE_NEW_HEADWORD,
    build_triage_in_memory,
    generate_review_queues,
)
from malipense_version_delta.tests.test_compare import URL_A, URL_B, _entry  # noqa: PLC2701


def _write_min_crawl(tmp_path: Path) -> Path:
    crawl = tmp_path / "crawl"
    payloads = crawl / "payloads"
    payloads.mkdir(parents=True)
    html = """<!DOCTYPE html><html><body>
<p class="lxP"><span id="e0" class="Lxe">a</span></p>
<p class="lxP2"><span class="PS">n</span><span class="GlFr">a</span></p>
<p class="lxP"><span id="e1" class="Lxe">new1</span></p>
<p class="lxP2"><span class="PS">n</span><span class="GlFr">new1</span></p>
<p class="lxP"><span id="e2" class="Lxe">dup</span></p>
<p class="lxP2"><span class="PS">n</span><span class="GlFr">dup</span></p>
</body></html>"""
    meta = {"snapshot_id": "s1", "url_canonical": URL_A}
    (crawl / "snapshots.jsonl").write_text(json.dumps(meta) + "\n", encoding="utf-8")
    (payloads / "s1.html.zst").write_bytes(zstd.ZstdCompressor().compress(html.encode()))
    return crawl


def _write_ir(path: Path, records: list[dict]) -> None:
    write_jsonl(path, records)


def _write_delta_from_compare(
    baseline: list[dict],
    current: list[dict],
    path: Path,
) -> None:
    delta, _ = compare_lexicon_records(baseline, current, parser_compat_status="PASS")
    write_jsonl(path, delta)


def test_frozen_input_hash_mismatch_blocks(tmp_path: Path):
    baseline = tmp_path / "baseline.jsonl"
    current = tmp_path / "current.jsonl"
    delta = tmp_path / "delta.jsonl"
    crawl = _write_min_crawl(tmp_path)
    _write_ir(baseline, [_entry(ir_id="1", url=URL_A, source_record_id="e0", headword="a")])
    _write_ir(current, [_entry(ir_id="1", url=URL_A, source_record_id="e0", headword="a")])
    _write_delta_from_compare(
        [_entry(ir_id="1", url=URL_A, source_record_id="e0", headword="a")],
        [_entry(ir_id="1", url=URL_A, source_record_id="e0", headword="a")],
        delta,
    )
    with pytest.raises(FrozenInputMismatchError):
        verify_frozen_inputs(
            baseline_ir_path=baseline,
            current_ir_path=current,
            delta_path=delta,
            crawl_dir=crawl,
            expected_baseline_sha=FROZEN_BASELINE_IR_SHA256,
        )


def test_new_headword_vs_new_record_existing_headword(tmp_path: Path):
    baseline = [
        _entry(ir_id="b1", url=URL_A, source_record_id="e0", headword="known"),
    ]
    current = baseline + [
        _entry(ir_id="c1", url=URL_A, source_record_id="e1", headword="brand_new"),
        _entry(ir_id="c2", url=URL_A, source_record_id="e2", headword="known"),
    ]
    baseline_path = tmp_path / "baseline.jsonl"
    current_path = tmp_path / "current.jsonl"
    delta_path = tmp_path / "delta.jsonl"
    _write_ir(baseline_path, baseline)
    _write_ir(current_path, current)
    _write_delta_from_compare(baseline, current, delta_path)
    crawl = _write_min_crawl(tmp_path)

    triage = build_triage_in_memory(
        baseline_ir_path=baseline_path,
        current_ir_path=current_path,
        delta_path=delta_path,
        crawl_dir=crawl,
        verify_hashes=False,
        batch_target=100,
    )
    new_hw = {r["headword_latin"] for r in triage.queues[QUEUE_NEW_HEADWORD]}
    new_existing = {r["headword_latin"] for r in triage.queues[QUEUE_NEW_EXISTING_HW]}
    assert "brand_new" in new_hw
    assert "known" in new_existing
    assert "known" not in new_hw


def test_ambiguous_stays_quarantined(tmp_path: Path):
    baseline = [
        _entry(ir_id="b1", url=URL_A, source_record_id="e0", headword="ba", gloss_fr="mère"),
        _entry(ir_id="b2", url=URL_A, source_record_id="e1", headword="ba", gloss_fr="fleuve"),
    ]
    current = [
        _entry(ir_id="c1", url=URL_A, source_record_id="e10", headword="ba", gloss_fr="mère"),
        _entry(ir_id="c2", url=URL_A, source_record_id="e11", headword="ba", gloss_fr="changed"),
    ]
    baseline_path = tmp_path / "baseline.jsonl"
    current_path = tmp_path / "current.jsonl"
    delta_path = tmp_path / "delta.jsonl"
    _write_ir(baseline_path, baseline)
    _write_ir(current_path, current)
    _write_delta_from_compare(baseline, current, delta_path)
    crawl = _write_min_crawl(tmp_path)

    triage = build_triage_in_memory(
        baseline_ir_path=baseline_path,
        current_ir_path=current_path,
        delta_path=delta_path,
        crawl_dir=crawl,
        verify_hashes=False,
    )
    assert len(triage.queues[QUEUE_AMBIGUOUS]) >= 1
    for row in triage.queues[QUEUE_AMBIGUOUS]:
        assert row["delta_class"] == "IDENTITY_AMBIGUOUS"


def test_missing_never_labeled_deletion(tmp_path: Path):
    baseline = [
        _entry(ir_id="b1", url=URL_A, source_record_id="e0", headword="gone"),
    ]
    current: list[dict] = []
    baseline_path = tmp_path / "baseline.jsonl"
    current_path = tmp_path / "current.jsonl"
    delta_path = tmp_path / "delta.jsonl"
    _write_ir(baseline_path, baseline)
    _write_ir(current_path, current)
    _write_delta_from_compare(baseline, current, delta_path)
    crawl = _write_min_crawl(tmp_path)

    triage = build_triage_in_memory(
        baseline_ir_path=baseline_path,
        current_ir_path=current_path,
        delta_path=delta_path,
        crawl_dir=crawl,
        verify_hashes=False,
    )
    assert len(triage.queues[QUEUE_MISSING]) == 1
    row = triage.queues[QUEUE_MISSING][0]
    assert row["delta_class"] == "MISSING_FROM_CURRENT_SOURCE"
    assert "deleted" not in json.dumps(row).lower()


def test_duplicate_headword_subjects_preserved(tmp_path: Path):
    baseline: list[dict] = []
    current = [
        _entry(ir_id="c1", url=URL_A, source_record_id="e1", headword="dup"),
        _entry(ir_id="c2", url=URL_A, source_record_id="e2", headword="dup"),
    ]
    baseline_path = tmp_path / "baseline.jsonl"
    current_path = tmp_path / "current.jsonl"
    delta_path = tmp_path / "delta.jsonl"
    _write_ir(baseline_path, baseline)
    _write_ir(current_path, current)
    _write_delta_from_compare(baseline, current, delta_path)
    crawl = _write_min_crawl(tmp_path)

    triage = build_triage_in_memory(
        baseline_ir_path=baseline_path,
        current_ir_path=current_path,
        delta_path=delta_path,
        crawl_dir=crawl,
        verify_hashes=False,
    )
    subjects = [r["review_subject_id"] for r in triage.queues[QUEUE_NEW_HEADWORD]]
    assert subjects == ["c1", "c2"]
    assert triage.queues[QUEUE_NEW_HEADWORD][0]["headword_group_size"] == 2


def test_headword_group_id_deterministic():
    gid1 = headword_group_id("ba", URL_A)
    gid2 = headword_group_id("ba", URL_A)
    assert gid1 == gid2
    assert gid1 != headword_group_id("ba", URL_B)


def test_round_robin_batch_selection_prefers_page_diversity():
    rows = []
    for page in ("a.htm", "b.htm", "c.htm"):
        url = f"https://www.mali-pense.net/emk/lexicon/{page}"
        for idx in range(5):
            rows.append(
                {
                    "review_subject_id": f"{page}-{idx}",
                    "url_canonical": url,
                    "headword_latin": f"hw-{page}-{idx}",
                    "source_record_id": f"e{idx}",
                }
            )
    selected, meta = select_batch_records(rows, target_size=6)
    assert len(selected) == 6
    assert meta["algorithm_id"] == BATCH_SELECTION_ALGORITHM_ID
    pages = {r["url_canonical"].rsplit("/", 1)[-1] for r in selected}
    assert len(pages) >= 3


def test_batch_target_behavior():
    rows = [
        {
            "review_subject_id": f"id-{i}",
            "url_canonical": URL_A,
            "headword_latin": f"h{i}",
            "source_record_id": f"e{i}",
        }
        for i in range(3)
    ]
    selected, meta = select_batch_records(rows, target_size=100)
    assert len(selected) == 3
    assert meta["selected_count"] == 3


def test_fingerprint_is_deterministic():
    record = _entry(ir_id="1", url=URL_A, source_record_id="e0", headword="a")
    assert current_record_fingerprint_sha256(record) == current_record_fingerprint_sha256(
        dict(record)
    )


def test_blank_review_row_skips_cleanly(tmp_path: Path):
    baseline: list[dict] = []
    current = [_entry(ir_id="c1", url=URL_A, source_record_id="e1", headword="new1")]
    baseline_path = tmp_path / "baseline.jsonl"
    current_path = tmp_path / "current.jsonl"
    delta_path = tmp_path / "delta.jsonl"
    _write_ir(baseline_path, baseline)
    _write_ir(current_path, current)
    _write_delta_from_compare(baseline, current, delta_path)
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


def test_fingerprint_mismatch_blocks(tmp_path: Path):
    baseline: list[dict] = []
    current = [_entry(ir_id="c1", url=URL_A, source_record_id="e1", headword="new1")]
    baseline_path = tmp_path / "baseline.jsonl"
    current_path = tmp_path / "current.jsonl"
    delta_path = tmp_path / "delta.jsonl"
    _write_ir(baseline_path, baseline)
    _write_ir(current_path, current)
    _write_delta_from_compare(baseline, current, delta_path)
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

    text = worksheet_path.read_text(encoding="utf-8")
    tampered = text.replace("new1", "TAMPERED")
    tampered_path = tmp_path / "tampered.csv"
    tampered_path.write_text(tampered, encoding="utf-8")

    result = dry_run_import_review_worksheet(
        tampered_path,
        baseline_ir_path=baseline_path,
        current_ir_path=current_path,
        delta_path=delta_path,
        crawl_dir=crawl,
        verify_hashes=False,
    )
    assert result.summary["error_count"] >= 1
    assert any("STALE" in err for err in result.errors)


def test_protected_context_edit_blocks_without_fingerprint_change(tmp_path: Path):
    baseline: list[dict] = []
    current = [_entry(ir_id="c1", url=URL_A, source_record_id="e1", headword="new1")]
    baseline_path = tmp_path / "baseline.jsonl"
    current_path = tmp_path / "current.jsonl"
    delta_path = tmp_path / "delta.jsonl"
    _write_ir(baseline_path, baseline)
    _write_ir(current_path, current)
    _write_delta_from_compare(baseline, current, delta_path)
    crawl = _write_min_crawl(tmp_path)

    triage = build_triage_in_memory(
        baseline_ir_path=baseline_path,
        current_ir_path=current_path,
        delta_path=delta_path,
        crawl_dir=crawl,
        verify_hashes=False,
        batch_target=1,
    )
    row = triage.batch_rows[0]
    current_by_id = {"c1": current[0]}
    expected = build_worksheet_row(
        row,
        current_by_id["c1"],
        delta_sha256=sha256_file(delta_path),
        current_ir_sha256=sha256_file(current_path),
    )
    good = dict(expected)
    good["source_section_class"] = "TAMPERED"
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=WORKSHEET_COLUMNS, lineterminator="\n")
    writer.writeheader()
    writer.writerow(good)
    tampered_path = tmp_path / "tampered_context.csv"
    tampered_path.write_text(buf.getvalue(), encoding="utf-8")

    result = dry_run_import_review_worksheet(
        tampered_path,
        baseline_ir_path=baseline_path,
        current_ir_path=current_path,
        delta_path=delta_path,
        crawl_dir=crawl,
        expected_by_id={"c1": expected},
        verify_hashes=False,
    )
    assert result.summary["error_count"] >= 1


def test_deterministic_queue_serialization(tmp_path: Path):
    baseline: list[dict] = []
    current = [
        _entry(ir_id="c1", url=URL_A, source_record_id="e1", headword="z"),
        _entry(ir_id="c2", url=URL_A, source_record_id="e2", headword="a"),
    ]
    baseline_path = tmp_path / "baseline.jsonl"
    current_path = tmp_path / "current.jsonl"
    delta_path = tmp_path / "delta.jsonl"
    _write_ir(baseline_path, baseline)
    _write_ir(current_path, current)
    _write_delta_from_compare(baseline, current, delta_path)
    crawl = _write_min_crawl(tmp_path)

    out1 = tmp_path / "out1"
    out2 = tmp_path / "out2"
    generate_review_queues(
        baseline_ir_path=baseline_path,
        current_ir_path=current_path,
        delta_path=delta_path,
        crawl_dir=crawl,
        output_dir=out1,
        verify_hashes=False,
    )
    generate_review_queues(
        baseline_ir_path=baseline_path,
        current_ir_path=current_path,
        delta_path=delta_path,
        crawl_dir=crawl,
        output_dir=out2,
        verify_hashes=False,
    )
    q1 = (out1 / "review" / "new_headword_evidence.jsonl").read_bytes()
    q2 = (out2 / "review" / "new_headword_evidence.jsonl").read_bytes()
    assert q1 == q2
