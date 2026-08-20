"""Unit tests for corpus_annotations_v1 validation."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from corpus_annotations.validate_corpus_annotations import (
    CorpusAnnotationValidationError,
    find_supersession_leaves,
    main,
    validate_corpus_annotations,
)

REPO_ROOT = Path(__file__).resolve().parents[3]
FIXTURES = REPO_ROOT / "shared/corpus/fixtures"


def write_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")


def minimal_raw(**overrides: object) -> dict:
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


@pytest.mark.parametrize(
    "fixture_name",
    [
        "valid_manual_raw_transcript.jsonl",
        "valid_asr_raw_transcript.jsonl",
        "valid_normalized_transcript.jsonl",
        "valid_translation_fr.jsonl",
        "valid_translation_en.jsonl",
        "valid_uncertainty_span.jsonl",
        "valid_annotation_unknown_language.jsonl",
        "valid_nkoo_nonauthoritative.jsonl",
        "valid_direct_manual_transcript.jsonl",
    ],
)
def test_valid_annotation_fixtures_pass(fixture_name: str):
    result = validate_corpus_annotations(FIXTURES / fixture_name)
    assert result.summary["row_count"] >= 1


@pytest.mark.parametrize(
    ("fixture_name", "needle"),
    [
        ("invalid_missing_annotation_id.jsonl", "missing required fields"),
        ("invalid_annotation_segment_id.jsonl", "segment_id must match"),
        ("invalid_annotation_type.jsonl", "unsupported annotation_type"),
        ("invalid_empty_content.jsonl", "content must be a non-empty string"),
        (
            "invalid_asr_without_machine_provenance.jsonl",
            "requires tool_name or model_name",
        ),
        (
            "invalid_normalized_without_derivation.jsonl",
            "transcript_normalized requires non-empty derived_from_annotation_ids",
        ),
        ("invalid_forbidden_review_field.jsonl", "forbidden fields: review_status"),
        (
            "invalid_uncertainty_bounds.jsonl",
            "end_char exceeds Unicode content length",
        ),
    ],
)
def test_invalid_annotation_fixtures_fail(fixture_name: str, needle: str):
    with pytest.raises(CorpusAnnotationValidationError) as exc_info:
        validate_corpus_annotations(FIXTURES / fixture_name)
    assert needle in str(exc_info.value)


def test_unknown_derivation_reference_fails(tmp_path: Path):
    path = tmp_path / "unknown_parent.jsonl"
    write_jsonl(
        path,
        [
            minimal_raw(
                annotation_id="cann_test_norm_001",
                annotation_type="transcript_normalized",
                creation_method="normalization",
                derived_from_annotation_ids=["cann_missing_001"],
            )
        ],
    )
    with pytest.raises(CorpusAnnotationValidationError) as exc_info:
        validate_corpus_annotations(path)
    assert "unknown derived_from_annotation_id" in str(exc_info.value)


def test_self_derivation_fails(tmp_path: Path):
    path = tmp_path / "self.jsonl"
    write_jsonl(
        path,
        [
            minimal_raw(
                annotation_id="cann_self_001",
                annotation_type="transcript_normalized",
                creation_method="normalization",
                derived_from_annotation_ids=["cann_self_001"],
            )
        ],
    )
    with pytest.raises(CorpusAnnotationValidationError) as exc_info:
        validate_corpus_annotations(path)
    assert "must not self-reference" in str(exc_info.value)


def test_derivation_cycle_fails(tmp_path: Path):
    path = tmp_path / "cycle.jsonl"
    write_jsonl(
        path,
        [
            minimal_raw(
                annotation_id="cann_a",
                derived_from_annotation_ids=["cann_b"],
            ),
            minimal_raw(
                annotation_id="cann_b",
                derived_from_annotation_ids=["cann_a"],
            ),
        ],
    )
    with pytest.raises(CorpusAnnotationValidationError) as exc_info:
        validate_corpus_annotations(path)
    assert "derivation cycle detected" in str(exc_info.value)


def test_invalid_supersession_unknown(tmp_path: Path):
    path = tmp_path / "super_missing.jsonl"
    write_jsonl(path, [minimal_raw(supersedes_annotation_id="cann_missing_001")])
    with pytest.raises(CorpusAnnotationValidationError) as exc_info:
        validate_corpus_annotations(path)
    assert "unknown supersedes_annotation_id" in str(exc_info.value)


def test_cross_segment_supersession_fails(tmp_path: Path):
    path = tmp_path / "cross_seg.jsonl"
    write_jsonl(
        path,
        [
            minimal_raw(
                annotation_id="cann_old",
                segment_id="cseg_fixture_time_001",
            ),
            minimal_raw(
                annotation_id="cann_new",
                segment_id="cseg_fixture_page_001",
                supersedes_annotation_id="cann_old",
            ),
        ],
    )
    with pytest.raises(CorpusAnnotationValidationError) as exc_info:
        validate_corpus_annotations(path)
    assert "supersedes_annotation_id must reference the same segment" in str(
        exc_info.value
    )


@pytest.mark.parametrize(
    ("fixture_name", "needle"),
    [
        ("invalid_supersession_cycle_2node.jsonl", "supersession cycle detected"),
        ("invalid_supersession_cycle_3node.jsonl", "supersession cycle detected"),
        (
            "invalid_supersession_created_before_parent.jsonl",
            "created_at must be >= superseded",
        ),
        (
            "invalid_supersession_cross_type.jsonl",
            "must preserve annotation_type",
        ),
        (
            "invalid_derivation_created_before_parent.jsonl",
            "derived annotation created_at must be >= parent",
        ),
        (
            "invalid_combined_derivation_supersession_cycle_2node.jsonl",
            "combined derivation/supersession cycle detected",
        ),
        (
            "invalid_combined_derivation_supersession_cycle_longer.jsonl",
            "combined derivation/supersession cycle detected",
        ),
    ],
)
def test_invalid_supersession_hardening_fixtures(fixture_name: str, needle: str):
    with pytest.raises(CorpusAnnotationValidationError) as exc_info:
        validate_corpus_annotations(FIXTURES / fixture_name)
    assert needle in str(exc_info.value)


def test_find_supersession_leaves_returns_all_competing_leaves(tmp_path: Path):
    path = tmp_path / "leaves.jsonl"
    write_jsonl(
        path,
        [
            minimal_raw(annotation_id="cann_base", created_at="2026-08-20T19:00:00Z"),
            minimal_raw(
                annotation_id="cann_rev_a",
                created_at="2026-08-20T19:10:00Z",
                supersedes_annotation_id="cann_base",
            ),
            minimal_raw(
                annotation_id="cann_rev_b",
                created_at="2026-08-20T19:11:00Z",
                supersedes_annotation_id="cann_base",
            ),
        ],
    )
    result = validate_corpus_annotations(path)
    leaves = find_supersession_leaves(result.rows)
    assert leaves == ["cann_rev_a", "cann_rev_b"]


def test_valid_parallel_derivation_and_supersession_same_direction(tmp_path: Path):
    """Edges pointing consistently backward in history remain acyclic."""
    path = tmp_path / "parallel.jsonl"
    write_jsonl(
        path,
        [
            minimal_raw(annotation_id="cann_root", created_at="2026-08-20T19:00:00Z"),
            minimal_raw(
                annotation_id="cann_mid",
                created_at="2026-08-20T19:10:00Z",
                supersedes_annotation_id="cann_root",
            ),
            minimal_raw(
                annotation_id="cann_child",
                annotation_type="transcript_normalized",
                creation_method="normalization",
                created_at="2026-08-20T19:20:00Z",
                derived_from_annotation_ids=["cann_mid"],
            ),
        ],
    )
    result = validate_corpus_annotations(path)
    assert result.summary["row_count"] == 3


def test_valid_supersession_same_type_passes():
    result = validate_corpus_annotations(FIXTURES / "valid_supersession_same_type.jsonl")
    assert result.summary["row_count"] == 2


def test_competing_same_type_supersessions_allowed(tmp_path: Path):
    path = tmp_path / "compete.jsonl"
    write_jsonl(
        path,
        [
            minimal_raw(annotation_id="cann_base", created_at="2026-08-20T19:00:00Z"),
            minimal_raw(
                annotation_id="cann_rev_a",
                created_at="2026-08-20T19:10:00Z",
                supersedes_annotation_id="cann_base",
            ),
            minimal_raw(
                annotation_id="cann_rev_b",
                created_at="2026-08-20T19:11:00Z",
                supersedes_annotation_id="cann_base",
            ),
        ],
    )
    result = validate_corpus_annotations(path)
    assert result.summary["row_count"] == 3


def test_incorrect_surface_form_fails(tmp_path: Path):
    path = tmp_path / "surface.jsonl"
    write_jsonl(
        path,
        [
            minimal_raw(
                content="abcdef",
                uncertain_spans=[
                    {
                        "start_char": 0,
                        "end_char": 3,
                        "surface_form": "zzz",
                    }
                ],
            )
        ],
    )
    with pytest.raises(CorpusAnnotationValidationError) as exc_info:
        validate_corpus_annotations(path)
    assert "surface_form must equal content" in str(exc_info.value)


def test_normalized_must_derive_from_transcript(tmp_path: Path):
    path = tmp_path / "bad_parent_type.jsonl"
    write_jsonl(
        path,
        [
            minimal_raw(
                annotation_id="cann_note",
                annotation_type="orthography_note",
                creation_method="manual_annotation",
                content="note",
            ),
            minimal_raw(
                annotation_id="cann_norm",
                annotation_type="transcript_normalized",
                creation_method="normalization",
                derived_from_annotation_ids=["cann_note"],
            ),
        ],
    )
    with pytest.raises(CorpusAnnotationValidationError) as exc_info:
        validate_corpus_annotations(path)
    assert "must derive from transcript_raw or transcript_normalized" in str(
        exc_info.value
    )


def test_segment_cross_reference_passes():
    result = validate_corpus_annotations(
        FIXTURES / "valid_manual_raw_transcript.jsonl",
        segments_path=FIXTURES / "valid_time_segment.jsonl",
    )
    assert result.summary["segment_cross_reference"] == 1


def test_malformed_segments_cannot_satisfy_cross_reference(tmp_path: Path):
    segments = tmp_path / "bad_segments.jsonl"
    annotations = tmp_path / "annotations.jsonl"
    write_jsonl(
        segments,
        [
            {
                "schema_version": "corpus_segments_v1",
                "segment_id": "cseg_fixture_time_001",
                "artifact_id": "cart_fixture_audio_001",
                "span_type": "time",
                "start_ms": 5,
                "end_ms": 1,
            }
        ],
    )
    write_jsonl(annotations, [minimal_raw()])
    with pytest.raises(CorpusAnnotationValidationError) as exc_info:
        validate_corpus_annotations(annotations, segments_path=segments)
    assert "segments table validation failed" in str(exc_info.value)


def test_full_chain_validation_passes():
    result = validate_corpus_annotations(
        FIXTURES / "valid_manual_raw_transcript.jsonl",
        segments_path=FIXTURES / "valid_time_segment.jsonl",
        artifacts_path=FIXTURES / "valid_audio_artifact.jsonl",
        sources_path=FIXTURES / "valid_owned_recording.jsonl",
    )
    assert result.summary["segment_cross_reference"] == 1
    assert result.summary["artifact_cross_reference"] == 1
    assert result.summary["source_cross_reference"] == 1


def test_cli_passes():
    assert main([str(FIXTURES / "valid_manual_raw_transcript.jsonl")]) == 0


def test_cli_fails():
    assert main([str(FIXTURES / "invalid_empty_content.jsonl")]) == 1
