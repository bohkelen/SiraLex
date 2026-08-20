"""Unit tests for corpus_annotation_reviews_v1 validation and worksheets."""

from __future__ import annotations

import csv
import io
import json
from pathlib import Path

import pytest

from corpus_annotations.event_timestamps import parse_event_timestamp
from corpus_annotations.validate_corpus_annotations import (
    CorpusAnnotationValidationError,
    validate_corpus_annotations,
)
from corpus_reviews.annotation_fingerprint import annotation_fingerprint_sha256
from corpus_reviews.dry_run_import_reviews import (
    dry_run_import_review_worksheet,
    generate_review_id,
    main as dry_run_main,
)
from corpus_reviews.export_review_worksheet import (
    WORKSHEET_COLUMNS,
    WORKSHEET_SCHEMA,
    build_worksheet_rows,
    export_review_worksheet,
    worksheet_rows_to_csv,
)
from corpus_reviews.validate_corpus_reviews import (
    CorpusReviewValidationError,
    main,
    validate_corpus_reviews,
)

REPO_ROOT = Path(__file__).resolve().parents[3]
FIXTURES = REPO_ROOT / "shared/corpus/fixtures"


def write_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")


def minimal_annotation(**overrides: object) -> dict:
    row: dict = {
        "schema_version": "corpus_annotations_v1",
        "annotation_id": "cann_test_raw_001",
        "segment_id": "cseg_fixture_time_001",
        "annotation_type": "transcript_raw",
        "content": "example text",
        "created_at": "2026-08-20T19:00:00Z",
        "creation_method": "manual_transcription",
        "created_by": "reviewer_example",
    }
    row.update(overrides)
    return row


def minimal_review(**overrides: object) -> dict:
    row: dict = {
        "schema_version": "corpus_annotation_reviews_v1",
        "review_id": "crev_test_001",
        "annotation_id": "cann_test_raw_001",
        "reviewer_id": "reviewer_a",
        "reviewed_at": "2026-08-20T20:00:00Z",
        "review_method": "manual_review",
        "decision": "accepted",
    }
    row.update(overrides)
    return row


@pytest.mark.parametrize(
    "fixture_name",
    [
        "valid_accepted_manual_transcript_review.jsonl",
        "valid_rejected_transcript_review.jsonl",
        "valid_needs_more_evidence_translation_review.jsonl",
        "valid_disagreeing_reviews.jsonl",
        "valid_review_supersession.jsonl",
        "valid_strong_evidence_refs_review.jsonl",
    ],
)
def test_valid_review_fixtures_pass(fixture_name: str):
    result = validate_corpus_reviews(FIXTURES / fixture_name)
    assert result.summary["row_count"] >= 1


@pytest.mark.parametrize(
    ("fixture_name", "needle"),
    [
        ("invalid_missing_review_id.jsonl", "missing required fields"),
        ("invalid_review_annotation_id.jsonl", "annotation_id must match"),
        ("invalid_review_decision.jsonl", "unsupported decision"),
        ("invalid_missing_reviewer_metadata.jsonl", "missing required fields"),
        ("invalid_review_self_supersession.jsonl", "self-supersession is not allowed"),
        (
            "invalid_review_supersession_cycle.jsonl",
            "review supersession cycle detected",
        ),
        (
            "invalid_review_supersede_other_reviewer.jsonl",
            "must reference the same reviewer_id",
        ),
        (
            "invalid_review_supersession_cross_annotation.jsonl",
            "must reference the same annotation_id",
        ),
        (
            "invalid_review_timestamp_before_superseded.jsonl",
            "reviewed_at must be >= superseded",
        ),
        ("invalid_review_promotion_field.jsonl", "forbidden fields: dictionary_candidate"),
    ],
)
def test_invalid_review_fixtures_fail(fixture_name: str, needle: str):
    with pytest.raises(CorpusReviewValidationError) as exc_info:
        validate_corpus_reviews(FIXTURES / fixture_name)
    assert needle in str(exc_info.value)


def test_unknown_annotation_reference_fails_with_annotations_table():
    with pytest.raises(CorpusReviewValidationError) as exc_info:
        validate_corpus_reviews(
            FIXTURES / "invalid_unknown_annotation_reference.jsonl",
            annotations_path=FIXTURES / "valid_manual_raw_transcript.jsonl",
        )
    assert "unknown annotation_id" in str(exc_info.value)


def test_review_annotation_cross_reference_passes():
    result = validate_corpus_reviews(
        FIXTURES / "valid_accepted_manual_transcript_review.jsonl",
        annotations_path=FIXTURES / "valid_manual_raw_transcript.jsonl",
    )
    assert result.summary["annotation_cross_reference"] == 1


def test_review_cannot_predate_annotation(tmp_path: Path):
    annotations = tmp_path / "annotations.jsonl"
    reviews = tmp_path / "reviews.jsonl"
    write_jsonl(annotations, [minimal_annotation(created_at="2026-08-20T19:00:00Z")])
    write_jsonl(
        reviews,
        [minimal_review(reviewed_at="2026-08-20T18:00:00Z")],
    )
    with pytest.raises(CorpusReviewValidationError) as exc_info:
        validate_corpus_reviews(reviews, annotations_path=annotations)
    assert "reviewed_at must be >= annotation created_at" in str(exc_info.value)


def test_review_after_annotation_with_offset_equivalence(tmp_path: Path):
    annotations = tmp_path / "annotations.jsonl"
    reviews = tmp_path / "reviews.jsonl"
    write_jsonl(
        annotations,
        [minimal_annotation(created_at="2026-08-20T19:00:00Z")],
    )
    write_jsonl(
        reviews,
        [minimal_review(reviewed_at="2026-08-20T15:00:00-04:00")],
    )
    result = validate_corpus_reviews(reviews, annotations_path=annotations)
    assert result.summary["row_count"] == 1


def test_review_date_only_rejected(tmp_path: Path):
    path = tmp_path / "reviews.jsonl"
    write_jsonl(path, [minimal_review(reviewed_at="2026-08-20")])
    with pytest.raises(CorpusReviewValidationError) as exc_info:
        validate_corpus_reviews(path)
    assert "explicit timezone" in str(exc_info.value)


def test_review_naive_datetime_rejected(tmp_path: Path):
    path = tmp_path / "reviews.jsonl"
    write_jsonl(path, [minimal_review(reviewed_at="2026-08-20T20:00:00")])
    with pytest.raises(CorpusReviewValidationError) as exc_info:
        validate_corpus_reviews(path)
    assert "explicit timezone" in str(exc_info.value)


def test_fingerprint_is_deterministic():
    row = minimal_annotation()
    assert annotation_fingerprint_sha256(row) == annotation_fingerprint_sha256(dict(row))


def test_worksheet_exports_schema_and_competing_leaves():
    result = validate_corpus_annotations(FIXTURES / "valid_competing_transcript_leaves.jsonl")
    rows = build_worksheet_rows(result.rows)
    assert all(row["worksheet_schema"] == WORKSHEET_SCHEMA for row in rows)
    leaf_ids = {row["annotation_id"] for row in rows if row["is_current_leaf"] == "true"}
    assert "cann_review_leaf_b" in leaf_ids
    assert "cann_review_leaf_c" in leaf_ids
    assert "cann_review_base" not in leaf_ids


def test_worksheet_include_superseded():
    result = validate_corpus_annotations(FIXTURES / "valid_competing_transcript_leaves.jsonl")
    rows = build_worksheet_rows(result.rows, include_superseded=True)
    ids = {row["annotation_id"] for row in rows}
    assert "cann_review_base" in ids


def test_export_cli_path(tmp_path: Path):
    csv_text, summary = export_review_worksheet(
        FIXTURES / "valid_competing_transcript_leaves.jsonl"
    )
    assert summary["worksheet_row_count"] >= 3
    reader = csv.DictReader(io.StringIO(csv_text))
    assert list(reader.fieldnames) == WORKSHEET_COLUMNS


def test_dry_run_import_accepted_row_with_evidence_refs(tmp_path: Path):
    annotations = FIXTURES / "valid_manual_raw_transcript.jsonl"
    annotation_result = validate_corpus_annotations(annotations)
    worksheet_rows = build_worksheet_rows(annotation_result.rows)
    filled = dict(worksheet_rows[0])
    filled.update(
        {
            "review_id": "crev_dry_run_001",
            "review_decision": "accepted",
            "evidence_strength": "moderate",
            "evidence_refs": "annotation:cann_fixture_manual_raw_001;segment:cseg_fixture_time_001",
            "issue_codes": "needs_second_reviewer",
            "review_notes": "dry-run accepted",
            "reviewer_id": "reviewer_dry",
            "reviewed_at": "2026-08-20T22:00:00Z",
            "review_method": "manual_review",
        }
    )
    worksheet = tmp_path / "filled.csv"
    worksheet.write_text(worksheet_rows_to_csv([filled]), encoding="utf-8")

    result = dry_run_import_review_worksheet(worksheet, annotations)
    assert result.summary["error_count"] == 0
    assert result.preview_rows[0]["evidence_refs"] == [
        "annotation:cann_fixture_manual_raw_001",
        "segment:cseg_fixture_time_001",
    ]


def test_dry_run_detects_stale_fingerprint(tmp_path: Path):
    annotations = FIXTURES / "valid_manual_raw_transcript.jsonl"
    annotation_result = validate_corpus_annotations(annotations)
    filled = dict(build_worksheet_rows(annotation_result.rows)[0])
    filled.update(
        {
            "annotation_fingerprint_sha256": "0" * 64,
            "review_decision": "accepted",
            "reviewer_id": "reviewer_dry",
            "reviewed_at": "2026-08-20T22:00:00Z",
            "review_method": "manual_review",
        }
    )
    worksheet = tmp_path / "stale.csv"
    worksheet.write_text(worksheet_rows_to_csv([filled]), encoding="utf-8")
    result = dry_run_import_review_worksheet(worksheet, annotations)
    assert any("FAIL STALE REVIEW SUBJECT" in err for err in result.errors)


def test_dry_run_detects_modified_content_with_unchanged_fingerprint(tmp_path: Path):
    annotations = FIXTURES / "valid_manual_raw_transcript.jsonl"
    annotation_result = validate_corpus_annotations(annotations)
    filled = dict(build_worksheet_rows(annotation_result.rows)[0])
    filled["content"] = "tampered visible transcript"
    filled.update(
        {
            "review_decision": "accepted",
            "reviewer_id": "reviewer_dry",
            "reviewed_at": "2026-08-20T22:00:00Z",
            "review_method": "manual_review",
        }
    )
    worksheet = tmp_path / "tampered.csv"
    worksheet.write_text(worksheet_rows_to_csv([filled]), encoding="utf-8")
    result = dry_run_import_review_worksheet(worksheet, annotations)
    assert any("FAIL STALE OR MODIFIED WORKSHEET CONTEXT" in err for err in result.errors)
    assert any("content" in err for err in result.errors)


def test_dry_run_detects_stale_leaf_metadata(tmp_path: Path):
    annotations = FIXTURES / "valid_competing_transcript_leaves.jsonl"
    annotation_result = validate_corpus_annotations(annotations)
    filled = dict(build_worksheet_rows(annotation_result.rows)[0])
    filled["is_current_leaf"] = "false"
    filled["competing_leaf_count"] = "99"
    filled.update(
        {
            "review_decision": "accepted",
            "reviewer_id": "reviewer_dry",
            "reviewed_at": "2026-08-20T22:00:00Z",
            "review_method": "manual_review",
        }
    )
    worksheet = tmp_path / "stale_leaf.csv"
    worksheet.write_text(worksheet_rows_to_csv([filled]), encoding="utf-8")
    result = dry_run_import_review_worksheet(worksheet, annotations)
    assert any("FAIL STALE OR MODIFIED WORKSHEET CONTEXT" in err for err in result.errors)


def test_dry_run_rejects_missing_and_wrong_worksheet_schema(tmp_path: Path):
    annotations = FIXTURES / "valid_manual_raw_transcript.jsonl"
    annotation_result = validate_corpus_annotations(annotations)
    base = dict(build_worksheet_rows(annotation_result.rows)[0])

    missing = dict(base)
    missing["worksheet_schema"] = ""
    path_missing = tmp_path / "missing_schema.csv"
    path_missing.write_text(worksheet_rows_to_csv([missing]), encoding="utf-8")
    result_missing = dry_run_import_review_worksheet(path_missing, annotations)
    assert any("missing worksheet_schema" in err for err in result_missing.errors)

    wrong = dict(base)
    wrong["worksheet_schema"] = "corpus_annotation_review_worksheet_v0"
    path_wrong = tmp_path / "wrong_schema.csv"
    path_wrong.write_text(worksheet_rows_to_csv([wrong]), encoding="utf-8")
    result_wrong = dry_run_import_review_worksheet(path_wrong, annotations)
    assert any("unsupported worksheet_schema" in err for err in result_wrong.errors)


def test_dry_run_skips_unreviewed_rows(tmp_path: Path):
    annotations = FIXTURES / "valid_competing_transcript_leaves.jsonl"
    annotation_result = validate_corpus_annotations(annotations)
    worksheet = tmp_path / "blank.csv"
    worksheet.write_text(
        worksheet_rows_to_csv(build_worksheet_rows(annotation_result.rows)),
        encoding="utf-8",
    )
    result = dry_run_import_review_worksheet(worksheet, annotations)
    assert result.summary["rows_skipped_unreviewed"] == result.summary["rows_read"]
    assert result.summary["error_count"] == 0
    assert result.summary["preview_row_count"] == 0


def test_generated_review_ids_differ_for_materially_different_reviews():
    base = {
        "annotation_id": "cann_fixture_manual_raw_001",
        "reviewer_id": "reviewer_a",
        "reviewed_at": "2026-08-20T22:00:00Z",
        "review_method": "manual_review",
        "decision": "accepted",
    }
    other = dict(base)
    other["decision"] = "rejected"
    assert generate_review_id(base) != generate_review_id(other)


def test_dry_run_table_validation_catches_duplicate_review_ids(tmp_path: Path):
    annotations = FIXTURES / "valid_competing_transcript_leaves.jsonl"
    annotation_result = validate_corpus_annotations(annotations)
    rows = build_worksheet_rows(annotation_result.rows)[:2]
    filled = []
    for row in rows:
        item = dict(row)
        item.update(
            {
                "review_id": "crev_duplicate_shared_001",
                "review_decision": "accepted",
                "reviewer_id": "reviewer_dry",
                "reviewed_at": "2026-08-20T22:00:00Z",
                "review_method": "manual_review",
            }
        )
        filled.append(item)
    worksheet = tmp_path / "dup.csv"
    worksheet.write_text(worksheet_rows_to_csv(filled), encoding="utf-8")
    result = dry_run_import_review_worksheet(worksheet, annotations)
    assert any("duplicate review_id" in err for err in result.errors)
    assert result.preview_rows == []


def test_preview_jsonl_not_written_when_errors(tmp_path: Path):
    annotations = FIXTURES / "valid_manual_raw_transcript.jsonl"
    annotation_result = validate_corpus_annotations(annotations)
    filled = dict(build_worksheet_rows(annotation_result.rows)[0])
    filled["content"] = "tampered"
    filled.update(
        {
            "review_decision": "accepted",
            "reviewer_id": "reviewer_dry",
            "reviewed_at": "2026-08-20T22:00:00Z",
            "review_method": "manual_review",
        }
    )
    worksheet = tmp_path / "bad.csv"
    worksheet.write_text(worksheet_rows_to_csv([filled]), encoding="utf-8")
    preview = tmp_path / "preview.jsonl"
    code = dry_run_main(
        [str(worksheet), "--annotations", str(annotations), "--preview-jsonl", str(preview)]
    )
    assert code == 1
    assert not preview.exists()


def test_equivalent_instants_compare_equal():
    left = parse_event_timestamp("2026-08-20T19:00:00Z")
    right = parse_event_timestamp("2026-08-20T15:00:00-04:00")
    assert left == right


def test_cli_validate_ok():
    assert main([str(FIXTURES / "valid_accepted_manual_transcript_review.jsonl")]) == 0
