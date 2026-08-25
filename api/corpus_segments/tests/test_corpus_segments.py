"""Unit tests for corpus_segments_v1 validation."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from corpus_segments.validate_corpus_segments import (
    CorpusSegmentValidationError,
    main,
    validate_corpus_segments,
)

REPO_ROOT = Path(__file__).resolve().parents[3]
FIXTURES = REPO_ROOT / "shared/corpus/fixtures"


def write_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")


def minimal_time(**overrides: object) -> dict:
    row: dict = {
        "schema_version": "corpus_segments_v1",
        "segment_id": "cseg_test_time_001",
        "artifact_id": "cart_fixture_audio_001",
        "span_type": "time",
        "start_ms": 0,
        "end_ms": 1000,
    }
    row.update(overrides)
    return row


@pytest.mark.parametrize(
    "fixture_name",
    [
        "valid_time_segment.jsonl",
        "valid_page_segment.jsonl",
        "valid_text_segment.jsonl",
        "valid_multilingual_segment.jsonl",
        "valid_unknown_speaker_segment.jsonl",
        "valid_whole_artifact_segment.jsonl",
    ],
)
def test_valid_segment_fixtures_pass(fixture_name: str):
    result = validate_corpus_segments(FIXTURES / fixture_name)
    assert result.summary["row_count"] == 1


@pytest.mark.parametrize(
    ("fixture_name", "needle"),
    [
        ("invalid_time_bounds.jsonl", "end_ms must be > start_ms"),
        ("invalid_mixed_span_fields.jsonl", "incompatible span fields"),
        ("invalid_page_bounds.jsonl", "start_page must be >= 1"),
        ("invalid_segment_transcript_field.jsonl", "forbidden fields: raw_transcript"),
    ],
)
def test_invalid_segment_fixtures_fail(fixture_name: str, needle: str):
    with pytest.raises(CorpusSegmentValidationError) as exc_info:
        validate_corpus_segments(FIXTURES / fixture_name)
    assert needle in str(exc_info.value)


def test_missing_required_fields(tmp_path: Path):
    path = tmp_path / "missing.jsonl"
    row = minimal_time()
    del row["span_type"]
    write_jsonl(path, [row])
    with pytest.raises(CorpusSegmentValidationError) as exc_info:
        validate_corpus_segments(path)
    assert "missing required fields" in str(exc_info.value)


def test_invalid_schema_version(tmp_path: Path):
    path = tmp_path / "schema.jsonl"
    write_jsonl(path, [minimal_time(schema_version="corpus_segments_v0")])
    with pytest.raises(CorpusSegmentValidationError) as exc_info:
        validate_corpus_segments(path)
    assert "schema_version must be" in str(exc_info.value)


def test_invalid_segment_id(tmp_path: Path):
    path = tmp_path / "id.jsonl"
    write_jsonl(path, [minimal_time(segment_id="seg_1")])
    with pytest.raises(CorpusSegmentValidationError) as exc_info:
        validate_corpus_segments(path)
    assert "segment_id must match" in str(exc_info.value)


def test_invalid_artifact_id_syntax(tmp_path: Path):
    path = tmp_path / "art.jsonl"
    write_jsonl(path, [minimal_time(artifact_id="cart")])
    with pytest.raises(CorpusSegmentValidationError) as exc_info:
        validate_corpus_segments(path)
    assert "artifact_id must match" in str(exc_info.value)


def test_unsupported_span_type(tmp_path: Path):
    path = tmp_path / "span.jsonl"
    write_jsonl(path, [minimal_time(span_type="bbox")])
    with pytest.raises(CorpusSegmentValidationError) as exc_info:
        validate_corpus_segments(path)
    assert "unsupported span_type" in str(exc_info.value)


def test_negative_time_rejected(tmp_path: Path):
    path = tmp_path / "neg.jsonl"
    write_jsonl(path, [minimal_time(start_ms=-1, end_ms=10)])
    with pytest.raises(CorpusSegmentValidationError) as exc_info:
        validate_corpus_segments(path)
    assert "start_ms must be >= 0" in str(exc_info.value)


def test_invalid_text_bounds(tmp_path: Path):
    path = tmp_path / "text.jsonl"
    write_jsonl(
        path,
        [
            {
                "schema_version": "corpus_segments_v1",
                "segment_id": "cseg_test_text_bad",
                "artifact_id": "cart_fixture_pdf_001",
                "span_type": "text",
                "start_char": 50,
                "end_char": 50,
            }
        ],
    )
    with pytest.raises(CorpusSegmentValidationError) as exc_info:
        validate_corpus_segments(path)
    assert "end_char must be > start_char" in str(exc_info.value)


def test_duplicate_segment_ids(tmp_path: Path):
    path = tmp_path / "dup.jsonl"
    write_jsonl(
        path,
        [
            minimal_time(segment_id="cseg_test_dup_001"),
            minimal_time(segment_id="cseg_test_dup_001", end_ms=2000),
        ],
    )
    with pytest.raises(CorpusSegmentValidationError) as exc_info:
        validate_corpus_segments(path)
    assert "duplicate segment_id" in str(exc_info.value)


def test_languages_require_provenance(tmp_path: Path):
    path = tmp_path / "lang.jsonl"
    write_jsonl(path, [minimal_time(languages_present=["Maninka"])])
    with pytest.raises(CorpusSegmentValidationError) as exc_info:
        validate_corpus_segments(path)
    assert "language_assessment_method is required" in str(exc_info.value)


def test_orphan_language_provenance_rejected(tmp_path: Path):
    path = tmp_path / "orphan_lang.jsonl"
    write_jsonl(
        path,
        [
            minimal_time(
                language_assessment_method="manual_review",
                language_assessed_by="reviewer_x",
            )
        ],
    )
    with pytest.raises(CorpusSegmentValidationError) as exc_info:
        validate_corpus_segments(path)
    assert "language assessment provenance requires non-empty languages_present" in str(
        exc_info.value
    )


def test_forbidden_source_id_on_segment(tmp_path: Path):
    path = tmp_path / "source.jsonl"
    write_jsonl(path, [minimal_time(source_id="csrc_fixture_owned_recording_001")])
    with pytest.raises(CorpusSegmentValidationError) as exc_info:
        validate_corpus_segments(path)
    assert "forbidden fields: source_id" in str(exc_info.value)


def test_artifact_cross_reference_passes():
    result = validate_corpus_segments(
        FIXTURES / "valid_time_segment.jsonl",
        artifacts_path=FIXTURES / "valid_audio_artifact.jsonl",
    )
    assert result.summary["artifact_cross_reference"] == 1


def test_artifact_cross_reference_unknown_fails(tmp_path: Path):
    segments = tmp_path / "segments.jsonl"
    write_jsonl(segments, [minimal_time(artifact_id="cart_missing_001")])
    with pytest.raises(CorpusSegmentValidationError) as exc_info:
        validate_corpus_segments(
            segments,
            artifacts_path=FIXTURES / "valid_audio_artifact.jsonl",
        )
    assert "unknown artifact_id" in str(exc_info.value)


def test_structure_only_allows_unknown_artifact_id(tmp_path: Path):
    path = tmp_path / "solo.jsonl"
    write_jsonl(path, [minimal_time(artifact_id="cart_not_in_table_001")])
    result = validate_corpus_segments(path)
    assert result.summary["row_count"] == 1


def test_cli_with_artifacts():
    assert (
        main(
            [
                str(FIXTURES / "valid_time_segment.jsonl"),
                "--artifacts",
                str(FIXTURES / "valid_audio_artifact.jsonl"),
            ]
        )
        == 0
    )


def test_cli_fails_on_invalid():
    assert main([str(FIXTURES / "invalid_time_bounds.jsonl")]) == 1


def test_malformed_artifacts_cannot_satisfy_cross_reference(tmp_path: Path):
    artifacts = tmp_path / "bad_artifacts.jsonl"
    segments = tmp_path / "segments.jsonl"
    write_jsonl(
        artifacts,
        [
            {
                "schema_version": "corpus_source_artifacts_v1",
                "artifact_id": "cart_fixture_audio_001",
                "source_id": "csrc_fixture_owned_recording_001",
                "captured_at": "2026-02-31",
                "capture_method": "manual_copy",
                "content_sha256": "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
                "byte_length": 10,
                "media_type": "audio/wav",
            }
        ],
    )
    write_jsonl(segments, [minimal_time()])
    with pytest.raises(CorpusSegmentValidationError) as exc_info:
        validate_corpus_segments(segments, artifacts_path=artifacts)
    assert "artifacts table validation failed" in str(exc_info.value)


def test_sources_without_artifacts_rejected(tmp_path: Path):
    segments = tmp_path / "segments.jsonl"
    write_jsonl(segments, [minimal_time()])
    with pytest.raises(CorpusSegmentValidationError) as exc_info:
        validate_corpus_segments(
            segments,
            sources_path=FIXTURES / "valid_owned_recording.jsonl",
        )
    assert "--sources requires --artifacts" in str(exc_info.value)


def test_full_chain_validation_passes():
    result = validate_corpus_segments(
        FIXTURES / "valid_time_segment.jsonl",
        artifacts_path=FIXTURES / "valid_audio_artifact.jsonl",
        sources_path=FIXTURES / "valid_owned_recording.jsonl",
    )
    assert result.summary["artifact_cross_reference"] == 1
    assert result.summary["source_cross_reference"] == 1
