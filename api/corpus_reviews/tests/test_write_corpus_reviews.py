"""Tests for governed corpus review persistence."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from corpus_annotations.validate_corpus_annotations import validate_corpus_annotations
from corpus_reviews.export_review_worksheet import (
    build_worksheet_rows,
    worksheet_rows_to_csv,
)
from corpus_reviews.validate_corpus_reviews import validate_corpus_reviews
from corpus_reviews.write_corpus_reviews import (
    CorpusReviewWriteError,
    main,
    plan_corpus_review_write,
    sha256_file,
    write_corpus_reviews,
)

REPO_ROOT = Path(__file__).resolve().parents[3]
FIXTURES = REPO_ROOT / "shared/corpus/fixtures"


def write_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n")


def minimal_annotation(**overrides: object) -> dict:
    row: dict = {
        "schema_version": "corpus_annotations_v1",
        "annotation_id": "cann_persist_raw_001",
        "segment_id": "cseg_fixture_time_001",
        "annotation_type": "transcript_raw",
        "content": "example text",
        "created_at": "2026-08-20T19:00:00Z",
        "creation_method": "manual_transcription",
        "created_by": "annotator_example",
    }
    row.update(overrides)
    return row


def filled_worksheet(tmp_path: Path, annotations: list[dict], **review_fields: str) -> Path:
    ann_path = tmp_path / "annotations.jsonl"
    write_jsonl(ann_path, annotations)
    result = validate_corpus_annotations(ann_path)
    rows = build_worksheet_rows(result.rows)
    filled = []
    for index, row in enumerate(rows):
        item = dict(row)
        defaults = {
            "review_id": f"crev_persist_{index+1:03d}",
            "review_decision": "accepted",
            "evidence_strength": "strong",
            "reviewer_id": "Reviewer_001",
            "reviewed_at": "2026-08-20T21:30:00-04:00",
            "review_method": "manual_review",
        }
        defaults.update(review_fields)
        # unique review ids per row when multiple
        if "review_id" not in review_fields and len(rows) > 1:
            defaults["review_id"] = f"crev_persist_{index+1:03d}"
        item.update(defaults)
        filled.append(item)
    path = tmp_path / "worksheet.csv"
    path.write_text(worksheet_rows_to_csv(filled), encoding="utf-8")
    return path, ann_path


def test_default_invocation_does_not_write(tmp_path: Path):
    worksheet, annotations = filled_worksheet(tmp_path, [minimal_annotation()])
    output = tmp_path / "reviews.jsonl"
    code = main(
        [
            str(worksheet),
            "--annotations",
            str(annotations),
            "--output",
            str(output),
        ]
    )
    assert code == 0
    assert not output.exists()


def test_apply_creates_registry(tmp_path: Path):
    worksheet, annotations = filled_worksheet(tmp_path, [minimal_annotation()])
    output = tmp_path / "reviews.jsonl"
    receipt = tmp_path / "receipt.json"
    plan = write_corpus_reviews(
        worksheet,
        annotations,
        output,
        apply=True,
        receipt_path=receipt,
    )
    assert plan.applied
    assert plan.receipt["rows_before"] == 0
    assert plan.receipt["new_rows_written"] == 1
    assert plan.receipt["rows_after"] == 1
    assert output.exists()
    result = validate_corpus_reviews(output, annotations_path=annotations)
    assert result.summary["row_count"] == 1
    assert receipt.exists()


def test_repeated_apply_is_idempotent(tmp_path: Path):
    worksheet, annotations = filled_worksheet(tmp_path, [minimal_annotation()])
    output = tmp_path / "reviews.jsonl"
    first = write_corpus_reviews(worksheet, annotations, output, apply=True)
    before_sha = sha256_file(output)
    second = write_corpus_reviews(worksheet, annotations, output, apply=True)
    assert first.receipt["new_rows_written"] == 1
    assert second.receipt["new_rows_written"] == 0
    assert second.receipt["already_present_identical"] == 1
    assert second.receipt["rows_after"] == 1
    assert sha256_file(output) == before_sha
    assert sum(1 for _ in output.open()) == 1


def test_same_review_id_different_content_conflicts(tmp_path: Path):
    worksheet, annotations = filled_worksheet(tmp_path, [minimal_annotation()])
    output = tmp_path / "reviews.jsonl"
    write_corpus_reviews(worksheet, annotations, output, apply=True)

    # Change decision while keeping review_id
    text = worksheet.read_text(encoding="utf-8")
    text = text.replace("accepted", "rejected")
    worksheet.write_text(text, encoding="utf-8")
    with pytest.raises(CorpusReviewWriteError) as exc_info:
        write_corpus_reviews(worksheet, annotations, output, apply=True)
    assert "review_id conflict" in str(exc_info.value)
    # registry unchanged: still accepted
    rows = [json.loads(line) for line in output.read_text().splitlines() if line.strip()]
    assert len(rows) == 1
    assert rows[0]["decision"] == "accepted"


def test_one_invalid_candidate_prevents_all_writes(tmp_path: Path):
    annotations = [
        minimal_annotation(annotation_id="cann_a"),
        minimal_annotation(annotation_id="cann_b", content="other"),
    ]
    worksheet, ann_path = filled_worksheet(tmp_path, annotations)
    # Corrupt second decision
    lines = worksheet.read_text(encoding="utf-8").splitlines()
    # header + 2 rows; break decision on last row
    parts = lines[2].split(",")
    # fragile; rebuild with invalid decision instead
    result = validate_corpus_annotations(ann_path)
    rows = build_worksheet_rows(result.rows)
    filled = []
    for index, row in enumerate(rows):
        item = dict(row)
        item.update(
            {
                "review_id": f"crev_bad_{index+1}",
                "review_decision": "accepted" if index == 0 else "published",
                "evidence_strength": "strong",
                "reviewer_id": "Reviewer_001",
                "reviewed_at": "2026-08-20T21:30:00-04:00",
                "review_method": "manual_review",
            }
        )
        filled.append(item)
    worksheet.write_text(worksheet_rows_to_csv(filled), encoding="utf-8")
    output = tmp_path / "reviews.jsonl"
    with pytest.raises(CorpusReviewWriteError):
        write_corpus_reviews(worksheet, ann_path, output, apply=True)
    assert not output.exists()


def test_invalid_existing_registry_prevents_append(tmp_path: Path):
    worksheet, annotations = filled_worksheet(tmp_path, [minimal_annotation()])
    output = tmp_path / "reviews.jsonl"
    write_jsonl(
        output,
        [
            {
                "schema_version": "corpus_annotation_reviews_v1",
                "review_id": "crev_broken",
                "annotation_id": "cann_persist_raw_001",
                "reviewer_id": "Reviewer_001",
                "reviewed_at": "2026-08-20T21:30:00-04:00",
                "review_method": "manual_review",
                "decision": "published",
            }
        ],
    )
    with pytest.raises(CorpusReviewWriteError) as exc_info:
        write_corpus_reviews(worksheet, annotations, output, apply=True)
    assert "existing review registry is invalid" in str(exc_info.value)


def test_stale_worksheet_prevents_write(tmp_path: Path):
    worksheet, annotations = filled_worksheet(tmp_path, [minimal_annotation()])
    text = worksheet.read_text(encoding="utf-8")
    # tamper content context column while leaving fingerprint
    # Find content cell - easier: rebuild and tamper
    result = validate_corpus_annotations(annotations)
    rows = build_worksheet_rows(result.rows)
    item = dict(rows[0])
    item.update(
        {
            "content": "TAMPERED",
            "review_id": "crev_stale_001",
            "review_decision": "accepted",
            "evidence_strength": "strong",
            "reviewer_id": "Reviewer_001",
            "reviewed_at": "2026-08-20T21:30:00-04:00",
            "review_method": "manual_review",
        }
    )
    worksheet.write_text(worksheet_rows_to_csv([item]), encoding="utf-8")
    output = tmp_path / "reviews.jsonl"
    with pytest.raises(CorpusReviewWriteError) as exc_info:
        write_corpus_reviews(worksheet, annotations, output, apply=True)
    assert "dry-run failed" in str(exc_info.value) or "STALE" in str(exc_info.value)
    assert not output.exists()


def test_fingerprint_mismatch_prevents_write(tmp_path: Path):
    worksheet, annotations = filled_worksheet(tmp_path, [minimal_annotation()])
    result = validate_corpus_annotations(annotations)
    rows = build_worksheet_rows(result.rows)
    item = dict(rows[0])
    item.update(
        {
            "annotation_fingerprint_sha256": "0" * 64,
            "review_id": "crev_fp_001",
            "review_decision": "accepted",
            "evidence_strength": "strong",
            "reviewer_id": "Reviewer_001",
            "reviewed_at": "2026-08-20T21:30:00-04:00",
            "review_method": "manual_review",
        }
    )
    worksheet.write_text(worksheet_rows_to_csv([item]), encoding="utf-8")
    output = tmp_path / "reviews.jsonl"
    with pytest.raises(CorpusReviewWriteError):
        write_corpus_reviews(worksheet, annotations, output, apply=True)
    assert not output.exists()


def test_merged_table_graph_validation_runs(tmp_path: Path):
    """Existing valid row + new candidate are validated together."""
    first_ws, annotations = filled_worksheet(
        tmp_path,
        [minimal_annotation(annotation_id="cann_one", content="one")],
        review_id="crev_one",
    )
    output = tmp_path / "reviews.jsonl"
    write_corpus_reviews(first_ws, annotations, output, apply=True)

    # Second annotation + review
    write_jsonl(
        annotations,
        [
            minimal_annotation(annotation_id="cann_one", content="one"),
            minimal_annotation(annotation_id="cann_two", content="two"),
        ],
    )
    second_ws, _ = filled_worksheet(
        tmp_path / "second",
        [
            minimal_annotation(annotation_id="cann_one", content="one"),
            minimal_annotation(annotation_id="cann_two", content="two"),
        ],
    )
    # Only fill review for cann_two by filtering worksheet? Use plan with both reviewed.
    # Rebuild worksheet for both with unique ids.
    result = validate_corpus_annotations(annotations)
    rows = build_worksheet_rows(result.rows)
    filled = []
    for row in rows:
        item = dict(row)
        rid = "crev_one" if row["annotation_id"] == "cann_one" else "crev_two"
        item.update(
            {
                "review_id": rid,
                "review_decision": "accepted",
                "evidence_strength": "strong",
                "reviewer_id": "Reviewer_001",
                "reviewed_at": "2026-08-20T21:30:00-04:00",
                "review_method": "manual_review",
            }
        )
        filled.append(item)
    second_ws = tmp_path / "both.csv"
    second_ws.write_text(worksheet_rows_to_csv(filled), encoding="utf-8")
    plan = write_corpus_reviews(second_ws, annotations, output, apply=True)
    assert plan.receipt["rows_after"] == 2
    assert plan.receipt["new_rows_written"] == 1
    assert plan.receipt["already_present_identical"] == 1


def test_atomic_failure_leaves_previous_registry_intact(tmp_path: Path, monkeypatch):
    worksheet, annotations = filled_worksheet(tmp_path, [minimal_annotation()])
    output = tmp_path / "reviews.jsonl"
    write_corpus_reviews(worksheet, annotations, output, apply=True)
    original = output.read_text(encoding="utf-8")

    def boom(*_args, **_kwargs):
        raise OSError("simulated replace failure")

    monkeypatch.setattr("corpus_reviews.write_corpus_reviews.os.replace", boom)
    # Force a new row so apply attempts write
    write_jsonl(
        annotations,
        [
            minimal_annotation(annotation_id="cann_persist_raw_001"),
            minimal_annotation(annotation_id="cann_persist_raw_002", content="second"),
        ],
    )
    result = validate_corpus_annotations(annotations)
    rows = build_worksheet_rows(result.rows)
    filled = []
    for row in rows:
        item = dict(row)
        item.update(
            {
                "review_id": (
                    "crev_persist_001"
                    if row["annotation_id"].endswith("001")
                    else "crev_persist_002"
                ),
                "review_decision": "accepted",
                "evidence_strength": "strong",
                "reviewer_id": "Reviewer_001",
                "reviewed_at": "2026-08-20T21:30:00-04:00",
                "review_method": "manual_review",
            }
        )
        filled.append(item)
    worksheet.write_text(worksheet_rows_to_csv(filled), encoding="utf-8")
    with pytest.raises(OSError):
        write_corpus_reviews(worksheet, annotations, output, apply=True)
    assert output.read_text(encoding="utf-8") == original


def test_post_write_registry_validates(tmp_path: Path):
    worksheet, annotations = filled_worksheet(tmp_path, [minimal_annotation()])
    output = tmp_path / "reviews.jsonl"
    write_corpus_reviews(worksheet, annotations, output, apply=True)
    validate_corpus_reviews(output, annotations_path=annotations)


def test_deterministic_output_ordering(tmp_path: Path):
    annotations = [
        minimal_annotation(annotation_id="cann_b", content="b"),
        minimal_annotation(annotation_id="cann_a", content="a"),
    ]
    worksheet, ann_path = filled_worksheet(tmp_path, annotations)
    # ensure review ids unordered relative to annotation order
    result = validate_corpus_annotations(ann_path)
    rows = build_worksheet_rows(result.rows)
    filled = []
    for row in rows:
        item = dict(row)
        rid = "crev_z" if row["annotation_id"] == "cann_a" else "crev_m"
        item.update(
            {
                "review_id": rid,
                "review_decision": "accepted",
                "evidence_strength": "strong",
                "reviewer_id": "Reviewer_001",
                "reviewed_at": "2026-08-20T21:30:00-04:00",
                "review_method": "manual_review",
            }
        )
        filled.append(item)
    worksheet.write_text(worksheet_rows_to_csv(filled), encoding="utf-8")
    output = tmp_path / "reviews.jsonl"
    write_corpus_reviews(worksheet, ann_path, output, apply=True)
    ids = [
        json.loads(line)["review_id"]
        for line in output.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    assert ids == sorted(ids)


def test_receipt_counts_and_hashes(tmp_path: Path):
    worksheet, annotations = filled_worksheet(tmp_path, [minimal_annotation()])
    output = tmp_path / "reviews.jsonl"
    receipt = tmp_path / "receipt.json"
    plan = write_corpus_reviews(
        worksheet, annotations, output, apply=True, receipt_path=receipt
    )
    data = json.loads(receipt.read_text(encoding="utf-8"))
    assert data["rows_before"] == 0
    assert data["candidate_rows"] == 1
    assert data["new_rows_written"] == 1
    assert data["already_present_identical"] == 0
    assert data["rows_after"] == 1
    assert data["worksheet_sha256"] == sha256_file(worksheet)
    assert data["annotation_table_sha256"] == sha256_file(annotations)
    assert data["registry_sha256_after"] == sha256_file(output)
    assert data["applied"] is True
    assert plan.receipt["decision_counts"]["accepted"] == 1


def test_plan_without_apply_reports_intended_changes(tmp_path: Path):
    worksheet, annotations = filled_worksheet(tmp_path, [minimal_annotation()])
    output = tmp_path / "reviews.jsonl"
    plan = plan_corpus_review_write(worksheet, annotations, output)
    assert not plan.applied
    assert len(plan.new_rows) == 1
    assert not output.exists()


def test_corrupted_serialized_temp_never_replaces_valid_registry(tmp_path: Path, monkeypatch):
    worksheet, annotations = filled_worksheet(tmp_path, [minimal_annotation()])
    output = tmp_path / "reviews.jsonl"
    write_corpus_reviews(worksheet, annotations, output, apply=True)
    original = output.read_text(encoding="utf-8")

    def corrupt_serialize(_rows: list[dict]) -> str:
        return "{not-valid-jsonl\n"

    monkeypatch.setattr(
        "corpus_reviews.write_corpus_reviews.rows_to_jsonl_text",
        corrupt_serialize,
    )
    # Force a write attempt by adding a second review subject.
    write_jsonl(
        annotations,
        [
            minimal_annotation(annotation_id="cann_persist_raw_001"),
            minimal_annotation(annotation_id="cann_persist_raw_002", content="second"),
        ],
    )
    result = validate_corpus_annotations(annotations)
    rows = build_worksheet_rows(result.rows)
    filled = []
    for row in rows:
        item = dict(row)
        item.update(
            {
                "review_id": (
                    "crev_persist_001"
                    if row["annotation_id"].endswith("001")
                    else "crev_persist_002"
                ),
                "review_decision": "accepted",
                "evidence_strength": "strong",
                "reviewer_id": "Reviewer_001",
                "reviewed_at": "2026-08-20T21:30:00-04:00",
                "review_method": "manual_review",
            }
        )
        filled.append(item)
    worksheet.write_text(worksheet_rows_to_csv(filled), encoding="utf-8")
    with pytest.raises(CorpusReviewWriteError) as exc_info:
        write_corpus_reviews(worksheet, annotations, output, apply=True)
    assert "temporary review registry failed on-disk validation" in str(exc_info.value)
    assert output.read_text(encoding="utf-8") == original
    assert sum(1 for line in original.splitlines() if line.strip()) == 1
