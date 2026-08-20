"""Unit tests for corpus_source_artifacts_v1 validation."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from corpus_artifacts.validate_corpus_artifacts import (
    CorpusArtifactValidationError,
    main,
    validate_corpus_artifacts,
)

REPO_ROOT = Path(__file__).resolve().parents[3]
FIXTURES = REPO_ROOT / "shared/corpus/fixtures"

FICTIONAL_SHA = "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"


def write_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")


def minimal_valid(**overrides: object) -> dict:
    row: dict = {
        "schema_version": "corpus_source_artifacts_v1",
        "artifact_id": "cart_test_minimal_001",
        "source_id": "csrc_fixture_owned_recording_001",
        "captured_at": "2026-08-20T12:00:00Z",
        "capture_method": "manual_copy",
        "content_sha256": FICTIONAL_SHA,
        "byte_length": 2048,
        "media_type": "audio/wav",
    }
    row.update(overrides)
    return row


@pytest.mark.parametrize(
    "fixture_name",
    [
        "valid_audio_artifact.jsonl",
        "valid_video_artifact.jsonl",
        "valid_pdf_artifact.jsonl",
        "valid_artifact_no_storage_ref.jsonl",
    ],
)
def test_valid_artifact_fixtures_pass(fixture_name: str):
    result = validate_corpus_artifacts(FIXTURES / fixture_name)
    assert result.summary["row_count"] == 1


@pytest.mark.parametrize(
    ("fixture_name", "needle"),
    [
        ("invalid_artifact_hash.jsonl", "content_sha256 must be exactly 64"),
        ("invalid_artifact_source_id_syntax.jsonl", "source_id must match"),
        ("invalid_artifact_timestamp.jsonl", "captured_at"),
    ],
)
def test_invalid_artifact_fixtures_fail(fixture_name: str, needle: str):
    with pytest.raises(CorpusArtifactValidationError) as exc_info:
        validate_corpus_artifacts(FIXTURES / fixture_name)
    assert needle in str(exc_info.value)


def test_missing_required_field(tmp_path: Path):
    path = tmp_path / "missing.jsonl"
    row = minimal_valid()
    del row["media_type"]
    write_jsonl(path, [row])
    with pytest.raises(CorpusArtifactValidationError) as exc_info:
        validate_corpus_artifacts(path)
    assert "missing required fields" in str(exc_info.value)


def test_invalid_schema_version(tmp_path: Path):
    path = tmp_path / "schema.jsonl"
    write_jsonl(path, [minimal_valid(schema_version="corpus_source_artifacts_v0")])
    with pytest.raises(CorpusArtifactValidationError) as exc_info:
        validate_corpus_artifacts(path)
    assert "schema_version must be" in str(exc_info.value)


def test_invalid_artifact_id(tmp_path: Path):
    path = tmp_path / "id.jsonl"
    write_jsonl(path, [minimal_valid(artifact_id="artifact_1")])
    with pytest.raises(CorpusArtifactValidationError) as exc_info:
        validate_corpus_artifacts(path)
    assert "artifact_id must match" in str(exc_info.value)


def test_zero_byte_length_rejected(tmp_path: Path):
    path = tmp_path / "zero.jsonl"
    write_jsonl(path, [minimal_valid(byte_length=0)])
    with pytest.raises(CorpusArtifactValidationError) as exc_info:
        validate_corpus_artifacts(path)
    assert "byte_length must be > 0" in str(exc_info.value)


def test_negative_byte_length_rejected(tmp_path: Path):
    path = tmp_path / "neg.jsonl"
    write_jsonl(path, [minimal_valid(byte_length=-1)])
    with pytest.raises(CorpusArtifactValidationError) as exc_info:
        validate_corpus_artifacts(path)
    assert "byte_length must be > 0" in str(exc_info.value)


def test_duplicate_artifact_ids(tmp_path: Path):
    path = tmp_path / "dup.jsonl"
    write_jsonl(
        path,
        [
            minimal_valid(artifact_id="cart_test_dup_001"),
            minimal_valid(artifact_id="cart_test_dup_001", byte_length=99),
        ],
    )
    with pytest.raises(CorpusArtifactValidationError) as exc_info:
        validate_corpus_artifacts(path)
    assert "duplicate artifact_id" in str(exc_info.value)


def test_unknown_field_rejected(tmp_path: Path):
    path = tmp_path / "extra.jsonl"
    write_jsonl(path, [minimal_valid(extra="no")])
    with pytest.raises(CorpusArtifactValidationError) as exc_info:
        validate_corpus_artifacts(path)
    assert "unknown fields: extra" in str(exc_info.value)


def test_forbidden_transcript_field(tmp_path: Path):
    path = tmp_path / "tx.jsonl"
    write_jsonl(path, [minimal_valid(transcript="no")])
    with pytest.raises(CorpusArtifactValidationError) as exc_info:
        validate_corpus_artifacts(path)
    assert "forbidden fields: transcript" in str(exc_info.value)


def test_source_cross_reference_passes(tmp_path: Path):
    sources = tmp_path / "sources.jsonl"
    artifacts = tmp_path / "artifacts.jsonl"
    write_jsonl(
        sources,
        [
            {
                "schema_version": "corpus_sources_v1",
                "source_id": "csrc_xref_001",
                "source_type": "owned_recording",
                "registered_at": "2026-08-20",
                "rights_basis": "owned",
                "rights_review_status": "reviewed",
            }
        ],
    )
    write_jsonl(artifacts, [minimal_valid(source_id="csrc_xref_001")])
    result = validate_corpus_artifacts(artifacts, sources_path=sources)
    assert result.summary["source_cross_reference"] == 1


def test_source_cross_reference_unknown_fails(tmp_path: Path):
    sources = tmp_path / "sources.jsonl"
    artifacts = tmp_path / "artifacts.jsonl"
    write_jsonl(
        sources,
        [
            {
                "schema_version": "corpus_sources_v1",
                "source_id": "csrc_xref_other",
                "source_type": "owned_recording",
                "registered_at": "2026-08-20",
                "rights_basis": "owned",
                "rights_review_status": "reviewed",
            }
        ],
    )
    write_jsonl(artifacts, [minimal_valid(source_id="csrc_xref_missing")])
    with pytest.raises(CorpusArtifactValidationError) as exc_info:
        validate_corpus_artifacts(artifacts, sources_path=sources)
    assert "unknown source_id" in str(exc_info.value)


def test_structure_only_allows_unknown_source_id(tmp_path: Path):
    path = tmp_path / "solo.jsonl"
    write_jsonl(path, [minimal_valid(source_id="csrc_not_in_any_table")])
    result = validate_corpus_artifacts(path)
    assert result.summary["row_count"] == 1


def test_cli_with_sources(tmp_path: Path):
    sources = FIXTURES / "valid_owned_recording.jsonl"
    artifacts = FIXTURES / "valid_audio_artifact.jsonl"
    assert main([str(artifacts), "--sources", str(sources)]) == 0


def test_cli_fails_on_invalid(tmp_path: Path):
    assert main([str(FIXTURES / "invalid_artifact_hash.jsonl")]) == 1


def test_malformed_sources_cannot_satisfy_cross_reference(tmp_path: Path):
    sources = tmp_path / "bad_sources.jsonl"
    artifacts = tmp_path / "artifacts.jsonl"
    write_jsonl(
        sources,
        [
            {
                "schema_version": "corpus_sources_v1",
                "source_id": "csrc_xref_001",
                "source_type": "owned_recording",
                "registered_at": "2026-99-99",
                "rights_basis": "owned",
                "rights_review_status": "reviewed",
            }
        ],
    )
    write_jsonl(artifacts, [minimal_valid(source_id="csrc_xref_001")])
    with pytest.raises(CorpusArtifactValidationError) as exc_info:
        validate_corpus_artifacts(artifacts, sources_path=sources)
    assert "sources table validation failed" in str(exc_info.value)


def test_generated_derivative_without_parent_fails(tmp_path: Path):
    path = tmp_path / "deriv.jsonl"
    write_jsonl(
        path,
        [minimal_valid(capture_method="generated_derivative", artifact_id="cart_deriv_001")],
    )
    with pytest.raises(CorpusArtifactValidationError) as exc_info:
        validate_corpus_artifacts(path)
    assert "generated_derivative requires non-empty derived_from_artifact_ids" in str(
        exc_info.value
    )


def test_generated_derivative_with_valid_parent_passes(tmp_path: Path):
    path = tmp_path / "deriv_ok.jsonl"
    parent = minimal_valid(artifact_id="cart_parent_001")
    child = minimal_valid(
        artifact_id="cart_child_001",
        capture_method="generated_derivative",
        content_sha256="eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        byte_length=512,
        derived_from_artifact_ids=["cart_parent_001"],
    )
    write_jsonl(path, [parent, child])
    result = validate_corpus_artifacts(path)
    assert result.summary["row_count"] == 2


def test_unknown_derivative_parent_fails(tmp_path: Path):
    path = tmp_path / "deriv_missing.jsonl"
    write_jsonl(
        path,
        [
            minimal_valid(
                artifact_id="cart_child_002",
                capture_method="generated_derivative",
                derived_from_artifact_ids=["cart_missing_parent_001"],
            )
        ],
    )
    with pytest.raises(CorpusArtifactValidationError) as exc_info:
        validate_corpus_artifacts(path)
    assert "unknown derived_from_artifact_id" in str(exc_info.value)


def test_self_derived_artifact_fails(tmp_path: Path):
    path = tmp_path / "self.jsonl"
    write_jsonl(
        path,
        [
            minimal_valid(
                artifact_id="cart_self_001",
                capture_method="generated_derivative",
                derived_from_artifact_ids=["cart_self_001"],
            )
        ],
    )
    with pytest.raises(CorpusArtifactValidationError) as exc_info:
        validate_corpus_artifacts(path)
    assert "must not self-reference" in str(exc_info.value)


def test_duplicate_derivative_parent_ids_fail(tmp_path: Path):
    path = tmp_path / "dup_parents.jsonl"
    write_jsonl(
        path,
        [
            minimal_valid(artifact_id="cart_parent_dup_001"),
            minimal_valid(
                artifact_id="cart_child_dup_001",
                capture_method="generated_derivative",
                content_sha256="ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
                derived_from_artifact_ids=["cart_parent_dup_001", "cart_parent_dup_001"],
            ),
        ],
    )
    with pytest.raises(CorpusArtifactValidationError) as exc_info:
        validate_corpus_artifacts(path)
    assert "must not contain duplicates" in str(exc_info.value)


def test_cross_source_derivative_fails(tmp_path: Path):
    path = tmp_path / "cross_source.jsonl"
    write_jsonl(
        path,
        [
            minimal_valid(
                artifact_id="cart_parent_src_a",
                source_id="csrc_source_a",
            ),
            minimal_valid(
                artifact_id="cart_child_src_b",
                source_id="csrc_source_b",
                capture_method="generated_derivative",
                content_sha256="1111111111111111111111111111111111111111111111111111111111111111",
                derived_from_artifact_ids=["cart_parent_src_a"],
            ),
        ],
    )
    with pytest.raises(CorpusArtifactValidationError) as exc_info:
        validate_corpus_artifacts(path)
    assert "source_id must match parent" in str(exc_info.value)


def test_ordinary_capture_does_not_require_parent(tmp_path: Path):
    path = tmp_path / "ordinary.jsonl"
    write_jsonl(path, [minimal_valid(capture_method="direct_recording")])
    result = validate_corpus_artifacts(path)
    assert result.summary["row_count"] == 1


def test_capture_tool_version_without_tool_fails(tmp_path: Path):
    path = tmp_path / "tool.jsonl"
    write_jsonl(path, [minimal_valid(capture_tool_version="1.0.0")])
    with pytest.raises(CorpusArtifactValidationError) as exc_info:
        validate_corpus_artifacts(path)
    assert "capture_tool_version requires non-empty capture_tool" in str(exc_info.value)


def test_updated_at_before_captured_at_fails(tmp_path: Path):
    path = tmp_path / "chrono.jsonl"
    write_jsonl(
        path,
        [
            minimal_valid(
                captured_at="2026-08-20T18:00:00Z",
                updated_at="2026-08-19T18:00:00Z",
            )
        ],
    )
    with pytest.raises(CorpusArtifactValidationError) as exc_info:
        validate_corpus_artifacts(path)
    assert "updated_at must not precede captured_at" in str(exc_info.value)
