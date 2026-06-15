import json
import importlib.util
import sys
from pathlib import Path

import pytest

VALIDATOR_PATH = Path(__file__).resolve().parents[1] / "validate_phrase_review.py"
SPEC = importlib.util.spec_from_file_location("validate_phrase_review", VALIDATOR_PATH)
assert SPEC is not None
validate_phrase_review_module = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
sys.modules[SPEC.name] = validate_phrase_review_module
SPEC.loader.exec_module(validate_phrase_review_module)

EXPECTED_SOURCE_BUNDLE_ID = validate_phrase_review_module.EXPECTED_SOURCE_BUNDLE_ID
EXPECTED_SOURCE_CATALOG_VERSION = validate_phrase_review_module.EXPECTED_SOURCE_CATALOG_VERSION
PhraseReviewValidationError = validate_phrase_review_module.PhraseReviewValidationError
main = validate_phrase_review_module.main
validate_phrase_review = validate_phrase_review_module.validate_phrase_review


def valid_row(**overrides):
    row = {
        "schema_version": "phrase_miss_review_v1",
        "review_id": "phase7h_phrase_0001",
        "query": "ferme la bouche",
        "query_locale": "fr",
        "search_direction": "source_to_target",
        "current_result": "partial related terms only",
        "related_single_terms": [
            {
                "term": "fermer",
                "result_status": "hit",
                "resolved_ir_ids": ["1c800f44835ba2fb"],
                "note": "single related term",
            }
        ],
        "related_phrase_terms": [],
        "candidate_target_entry": None,
        "candidate_resolved_ir_ids": [],
        "category": "true_phrase_entry_missing",
        "risk": "high",
        "recommendation": "defer_for_human_review",
        "rationale": "review-only evidence",
        "review_status": "candidate",
        "reviewer": None,
        "reviewed_at": None,
        "source_bundle_id": EXPECTED_SOURCE_BUNDLE_ID,
        "source_catalog_version": EXPECTED_SOURCE_CATALOG_VERSION,
        "notes": "",
    }
    row.update(overrides)
    return row


def write_jsonl(path: Path, rows) -> Path:
    path.write_text(
        "\n".join(json.dumps(row, ensure_ascii=False) for row in rows) + "\n",
        encoding="utf-8",
    )
    return path


def assert_invalid(path: Path, message: str) -> None:
    with pytest.raises(PhraseReviewValidationError, match=message):
        validate_phrase_review(path)


def test_valid_file_passes(tmp_path: Path):
    path = write_jsonl(tmp_path / "valid.jsonl", [valid_row()])

    summary = validate_phrase_review(path)

    assert summary.row_count == 1
    assert summary.candidate_rows == 1


def test_blank_line_fails(tmp_path: Path):
    path = tmp_path / "blank.jsonl"
    path.write_text(json.dumps(valid_row(), ensure_ascii=False) + "\n\n", encoding="utf-8")

    assert_invalid(path, "blank line")


def test_invalid_json_fails(tmp_path: Path):
    path = tmp_path / "invalid.jsonl"
    path.write_text("{not-json}\n", encoding="utf-8")

    assert_invalid(path, "invalid JSON")


def test_non_object_json_line_fails(tmp_path: Path):
    path = tmp_path / "array.jsonl"
    path.write_text("[]\n", encoding="utf-8")

    assert_invalid(path, "line must be a JSON object")


def test_missing_required_field_fails(tmp_path: Path):
    row = valid_row()
    del row["rationale"]
    path = write_jsonl(tmp_path / "missing.jsonl", [row])

    assert_invalid(path, "missing required fields")


def test_invalid_enum_fails(tmp_path: Path):
    path = write_jsonl(tmp_path / "bad-enum.jsonl", [valid_row(risk="urgent")])

    assert_invalid(path, "risk must be one of")


def test_duplicate_review_id_fails(tmp_path: Path):
    rows = [
        valid_row(review_id="same", query="one"),
        valid_row(review_id="same", query="two"),
    ]
    path = write_jsonl(tmp_path / "dupe-review-id.jsonl", rows)

    assert_invalid(path, "duplicate review_id")


def test_duplicate_query_fails(tmp_path: Path):
    rows = [
        valid_row(review_id="one", query="same"),
        valid_row(review_id="two", query="same"),
    ]
    path = write_jsonl(tmp_path / "dupe-query.jsonl", rows)

    assert_invalid(path, "duplicate query")


def test_approved_without_reviewer_fails(tmp_path: Path):
    row = valid_row(
        review_status="approved",
        reviewer=None,
        reviewed_at="2026-06-15",
        candidate_resolved_ir_ids=["abc"],
    )
    path = write_jsonl(tmp_path / "approved-no-reviewer.jsonl", [row])

    assert_invalid(path, "approved row requires non-empty reviewer")


def test_approved_without_reviewed_at_fails(tmp_path: Path):
    row = valid_row(
        review_status="approved",
        reviewer="reviewer",
        reviewed_at=None,
        candidate_resolved_ir_ids=["abc"],
    )
    path = write_jsonl(tmp_path / "approved-no-date.jsonl", [row])

    assert_invalid(path, "approved row requires non-empty reviewed_at")


def test_approved_without_candidate_resolved_ir_ids_fails(tmp_path: Path):
    row = valid_row(
        review_status="approved",
        reviewer="reviewer",
        reviewed_at="2026-06-15",
        candidate_resolved_ir_ids=[],
    )
    path = write_jsonl(tmp_path / "approved-no-candidates.jsonl", [row])

    assert_invalid(path, "approved row requires non-empty candidate_resolved_ir_ids")


def test_malformed_related_term_fails(tmp_path: Path):
    related = [{"term": "fermer", "result_status": "hit", "resolved_ir_ids": []}]
    row = valid_row(related_single_terms=related)
    path = write_jsonl(tmp_path / "bad-related.jsonl", [row])

    assert_invalid(path, "related_single_terms\\[0\\] missing required fields")


def test_related_term_resolved_ir_ids_not_list_fails(tmp_path: Path):
    related = [
        {
            "term": "fermer",
            "result_status": "hit",
            "resolved_ir_ids": "not-a-list",
            "note": "",
        }
    ]
    row = valid_row(related_single_terms=related)
    path = write_jsonl(tmp_path / "bad-related-ids.jsonl", [row])

    assert_invalid(path, "related_single_terms\\[0\\].resolved_ir_ids must be a list")


def test_mixed_source_bundle_id_fails(tmp_path: Path):
    path = write_jsonl(tmp_path / "bad-bundle.jsonl", [valid_row(source_bundle_id="other")])

    assert_invalid(path, "source_bundle_id must be")


def test_mixed_source_catalog_version_fails(tmp_path: Path):
    path = write_jsonl(tmp_path / "bad-catalog.jsonl", [valid_row(source_catalog_version="other")])

    assert_invalid(path, "source_catalog_version must be")


def test_current_fixture_counts_are_reported(tmp_path: Path, capsys: pytest.CaptureFixture[str]):
    rows = [
        valid_row(review_id="one", query="q1", review_status="candidate"),
        valid_row(review_id="two", query="q2", review_status="candidate"),
        valid_row(review_id="three", query="q3", review_status="candidate"),
        valid_row(review_id="four", query="q4", review_status="candidate"),
        valid_row(review_id="five", query="q5", review_status="deferred"),
        valid_row(review_id="six", query="q6", review_status="rejected"),
        valid_row(review_id="seven", query="q7", review_status="rejected"),
        valid_row(review_id="eight", query="q8", review_status="rejected"),
        valid_row(review_id="nine", query="q9", review_status="rejected"),
    ]
    path = write_jsonl(tmp_path / "counts.jsonl", rows)

    code = main([str(path)])

    assert code == 0
    out = capsys.readouterr().out
    assert "validated 9 phrase review rows" in out
    assert "approved rows: 0" in out
    assert "candidate rows: 4" in out
    assert "deferred rows: 1" in out
    assert "rejected rows: 4" in out
