"""Unit tests for corpus_sources_v1 structural validation."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from corpus_sources.validate_corpus_sources import (
    CorpusSourceValidationError,
    main,
    validate_corpus_sources,
)

REPO_ROOT = Path(__file__).resolve().parents[3]
FIXTURES = REPO_ROOT / "shared/corpus/fixtures"


def write_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")


def minimal_valid(**overrides: object) -> dict:
    row: dict = {
        "schema_version": "corpus_sources_v1",
        "source_id": "csrc_test_minimal_001",
        "source_type": "other",
        "registered_at": "2026-08-20",
        "rights_basis": "unknown",
        "rights_review_status": "unknown",
    }
    row.update(overrides)
    return row


@pytest.mark.parametrize(
    "fixture_name",
    [
        "valid_owned_recording.jsonl",
        "valid_public_video_rights_unknown.jsonl",
        "valid_book_or_pdf.jsonl",
        "valid_claimed_malinke_assessed_maninka.jsonl",
        "valid_multilingual_or_language_unknown.jsonl",
    ],
)
def test_valid_fixtures_pass(fixture_name: str):
    result = validate_corpus_sources(FIXTURES / fixture_name)
    assert result.summary["row_count"] == 1
    assert result.schema_versions == ["corpus_sources_v1"]


@pytest.mark.parametrize(
    ("fixture_name", "needle"),
    [
        ("invalid_missing_source_id.jsonl", "missing required fields"),
        ("invalid_source_type.jsonl", "unsupported source_type"),
        ("invalid_rights_state.jsonl", "invalid rights_review_status"),
        ("invalid_schema_version.jsonl", "schema_version must be"),
        ("invalid_field_type.jsonl", "page_count_if_known must be an integer"),
    ],
)
def test_invalid_fixtures_fail(fixture_name: str, needle: str):
    with pytest.raises(CorpusSourceValidationError) as exc_info:
        validate_corpus_sources(FIXTURES / fixture_name)
    assert needle in str(exc_info.value)


def test_empty_file_is_valid(tmp_path: Path):
    path = tmp_path / "empty.jsonl"
    path.write_text("", encoding="utf-8")
    result = validate_corpus_sources(path)
    assert result.summary["row_count"] == 0


def test_malformed_source_id_rejected(tmp_path: Path):
    path = tmp_path / "bad_id.jsonl"
    write_jsonl(path, [minimal_valid(source_id="src_dictionary_style")])
    with pytest.raises(CorpusSourceValidationError) as exc_info:
        validate_corpus_sources(path)
    assert "source_id must match" in str(exc_info.value)


def test_duplicate_source_id_rejected(tmp_path: Path):
    path = tmp_path / "dupes.jsonl"
    write_jsonl(
        path,
        [
            minimal_valid(source_id="csrc_test_dup_001"),
            minimal_valid(source_id="csrc_test_dup_001", source_type="radio"),
        ],
    )
    with pytest.raises(CorpusSourceValidationError) as exc_info:
        validate_corpus_sources(path)
    assert "duplicate source_id" in str(exc_info.value)


def test_claimed_language_requires_provenance(tmp_path: Path):
    path = tmp_path / "claim.jsonl"
    write_jsonl(path, [minimal_valid(claimed_language="Malinké")])
    with pytest.raises(CorpusSourceValidationError) as exc_info:
        validate_corpus_sources(path)
    assert "claimed_language_by is required" in str(exc_info.value)


def test_assessed_language_requires_method_and_assessor(tmp_path: Path):
    path = tmp_path / "assess.jsonl"
    write_jsonl(
        path,
        [
            minimal_valid(
                assessed_language="Guinean Maninka",
                assessment_method="manual_review",
            )
        ],
    )
    with pytest.raises(CorpusSourceValidationError) as exc_info:
        validate_corpus_sources(path)
    assert "assessed_by is required" in str(exc_info.value)


def test_claimed_vs_assessed_disagreement_is_valid(tmp_path: Path):
    path = tmp_path / "disagree.jsonl"
    write_jsonl(
        path,
        [
            minimal_valid(
                source_id="csrc_test_disagree_001",
                claimed_language="Malinké",
                claimed_language_by="source_title",
                assessed_language="Guinean Maninka",
                assessment_method="manual_review",
                assessment_confidence="medium",
                assessed_by="reviewer_x",
            )
        ],
    )
    result = validate_corpus_sources(path)
    assert result.summary["row_count"] == 1


def test_unknown_extra_field_rejected(tmp_path: Path):
    path = tmp_path / "extra.jsonl"
    write_jsonl(path, [minimal_valid(unexpected_field="nope")])
    with pytest.raises(CorpusSourceValidationError) as exc_info:
        validate_corpus_sources(path)
    assert "unknown fields: unexpected_field" in str(exc_info.value)


def test_forbidden_usable_field_rejected(tmp_path: Path):
    path = tmp_path / "usable.jsonl"
    write_jsonl(path, [minimal_valid(usable=True)])
    with pytest.raises(CorpusSourceValidationError) as exc_info:
        validate_corpus_sources(path)
    assert "forbidden fields: usable" in str(exc_info.value)


def test_forbidden_capture_fields_rejected(tmp_path: Path):
    path = tmp_path / "capture.jsonl"
    write_jsonl(path, [minimal_valid(content_hash="abc", storage_ref="/tmp/x")])
    with pytest.raises(CorpusSourceValidationError) as exc_info:
        validate_corpus_sources(path)
    message = str(exc_info.value)
    assert "forbidden fields" in message
    assert "content_hash" in message


def test_usage_permissions_sparse_coexistence(tmp_path: Path):
    path = tmp_path / "usage.jsonl"
    write_jsonl(
        path,
        [
            minimal_valid(
                source_id="csrc_test_usage_001",
                rights_review_status="publication_blocked",
                usage_permissions={
                    "internal_analysis": "allowed",
                    "dictionary_example_publication": "blocked",
                    "model_training": "unknown",
                },
            )
        ],
    )
    result = validate_corpus_sources(path)
    assert result.summary["row_count"] == 1


def test_invalid_usage_permission_key_rejected(tmp_path: Path):
    path = tmp_path / "bad_usage.jsonl"
    write_jsonl(
        path,
        [minimal_valid(usage_permissions={"download_everything": "allowed"})],
    )
    with pytest.raises(CorpusSourceValidationError) as exc_info:
        validate_corpus_sources(path)
    assert "unsupported usage_permissions key" in str(exc_info.value)


def test_invalid_timestamp_rejected(tmp_path: Path):
    path = tmp_path / "bad_ts.jsonl"
    write_jsonl(path, [minimal_valid(registered_at="20 Aug 2026")])
    with pytest.raises(CorpusSourceValidationError) as exc_info:
        validate_corpus_sources(path)
    assert "registered_at must be an ISO-8601" in str(exc_info.value)


@pytest.mark.parametrize(
    "value",
    [
        "2026-08-20",
        "2026-08-20T12:00",
        "2026-08-20T12:00:00",
        "2026-08-20T12:00:00Z",
        "2026-08-20T12:00:00+00:00",
        "2026-08-20T08:00:00-04:00",
    ],
)
def test_valid_timestamps_pass(tmp_path: Path, value: str):
    path = tmp_path / "ok_ts.jsonl"
    write_jsonl(path, [minimal_valid(registered_at=value)])
    result = validate_corpus_sources(path)
    assert result.summary["row_count"] == 1


@pytest.mark.parametrize(
    "value",
    [
        "2026-99-99",
        "2026-02-31",
        "2026-08-20T25:99",
        "2026-08-20T12:75",
        "2026-08-20T24:00:00",
    ],
)
def test_impossible_calendar_timestamps_fail(tmp_path: Path, value: str):
    path = tmp_path / "impossible_ts.jsonl"
    write_jsonl(path, [minimal_valid(registered_at=value)])
    with pytest.raises(CorpusSourceValidationError) as exc_info:
        validate_corpus_sources(path)
    message = str(exc_info.value)
    assert "registered_at" in message
    assert (
        "not a valid calendar date/time" in message
        or "must be an ISO-8601" in message
    )


def test_orphan_claimed_language_by_rejected(tmp_path: Path):
    path = tmp_path / "orphan_claim.jsonl"
    write_jsonl(path, [minimal_valid(claimed_language_by="source_title")])
    with pytest.raises(CorpusSourceValidationError) as exc_info:
        validate_corpus_sources(path)
    assert "claimed_language_by requires non-empty claimed_language" in str(exc_info.value)


def test_orphan_assessment_fields_rejected(tmp_path: Path):
    path = tmp_path / "orphan_assess.jsonl"
    write_jsonl(
        path,
        [
            minimal_valid(
                assessment_method="manual_review",
                assessment_confidence="low",
                assessed_by="reviewer_x",
            )
        ],
    )
    with pytest.raises(CorpusSourceValidationError) as exc_info:
        validate_corpus_sources(path)
    assert "assessment provenance fields require non-empty assessed_language" in str(
        exc_info.value
    )


def test_publication_blocked_contradicts_allowed_publication_use(tmp_path: Path):
    path = tmp_path / "rights_contradiction.jsonl"
    write_jsonl(
        path,
        [
            minimal_valid(
                source_id="csrc_test_rights_contra_001",
                rights_review_status="publication_blocked",
                usage_permissions={
                    "internal_analysis": "allowed",
                    "dictionary_example_publication": "allowed",
                },
            )
        ],
    )
    with pytest.raises(CorpusSourceValidationError) as exc_info:
        validate_corpus_sources(path)
    assert "publication_blocked contradicts" in str(exc_info.value)
    assert "dictionary_example_publication" in str(exc_info.value)


def test_owned_source_without_locator_is_valid(tmp_path: Path):
    path = tmp_path / "owned_no_locator.jsonl"
    write_jsonl(
        path,
        [
            minimal_valid(
                source_id="csrc_test_owned_noloc_001",
                source_type="owned_recording",
                rights_basis="owned",
                rights_review_status="reviewed",
            )
        ],
    )
    result = validate_corpus_sources(path)
    assert result.summary["row_count"] == 1


def test_cli_passes_and_writes_report(tmp_path: Path):
    sources = tmp_path / "sources.jsonl"
    report = tmp_path / "report.json"
    write_jsonl(sources, [minimal_valid()])
    assert main([str(sources), "--output-report", str(report)]) == 0
    payload = json.loads(report.read_text(encoding="utf-8"))
    assert payload["ok"] is True
    assert payload["summary"]["row_count"] == 1


def test_cli_fails_on_invalid(tmp_path: Path):
    sources = tmp_path / "bad.jsonl"
    write_jsonl(sources, [minimal_valid(source_type="not_a_type")])
    assert main([str(sources)]) == 1
