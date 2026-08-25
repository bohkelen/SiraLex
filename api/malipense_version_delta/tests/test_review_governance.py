"""Tests for Malidaba review supersession / leaf governance hardening."""

from __future__ import annotations

import copy
import json
from pathlib import Path

import pytest

from malipense_version_delta.review_identity import (
    generate_malidaba_review_id,
    review_scope_key,
)
from malipense_version_delta.validate_reviews import (
    MalidabaReviewValidationError,
    find_malidaba_review_leaves,
    validate_malidaba_review_table,
    validate_malidaba_reviews,
)
from malipense_version_delta.write_reviews import (
    MalidabaReviewWriteError,
    write_malidaba_reviews,
)
from malipense_version_delta.tests.test_write_reviews import (
    REVIEWED_AT,
    REVIEWER,
    _fill_completed,
    _setup_batch,
)


def _base_row(**overrides) -> dict:
    row = {
        "schema_version": "malidaba_delta_reviews_v1",
        "review_subject_id": "subj_a",
        "batch_id": "malidaba_new_headword_review_batch_001",
        "delta_sha256": "d" * 64,
        "current_ir_sha256": "c" * 64,
        "current_record_fingerprint_sha256": "f" * 64,
        "review_decision": "confirmed_source_delta",
        "reviewer_id": REVIEWER,
        "reviewed_at": REVIEWED_AT,
        "review_method": "manual_review",
        "issue_codes": [],
        "review_notes": "",
    }
    row.update(overrides)
    row["review_id"] = generate_malidaba_review_id(row)
    return row


def test_initial_reviews_valid_without_supersedes_field():
    rows = [_base_row(review_subject_id="s1"), _base_row(review_subject_id="s2")]
    result = validate_malidaba_review_table(rows, path=Path("mem://initial"))
    assert result.summary["row_count"] == 2
    assert result.summary["current_leaf_count"] == 2
    assert result.summary["review_history_count"] == 2
    assert "supersedes_review_id" not in rows[0]


def test_existing_review_ids_unchanged_for_initial_payload():
    row = {
        "schema_version": "malidaba_delta_reviews_v1",
        "review_subject_id": "39abf2d0dae4be22",
        "batch_id": "malidaba_new_headword_review_batch_001",
        "delta_sha256": "6dd2092078ba99c512b1e7b376e68599dd7e3faa1e7f1b8cccd1fe20335abeba",
        "current_ir_sha256": "fb8e97b0a8e1b82b5fc7874d7af010063112799cc116dd458ae0c48e56778221",
        "current_record_fingerprint_sha256": "a" * 64,
        "review_decision": "confirmed_source_delta",
        "reviewer_id": "Reviewer_001",
        "reviewed_at": "2026-08-22T12:45:00-04:00",
        "review_method": "manual_review",
        "issue_codes": [],
        "review_notes": "",
    }
    first = generate_malidaba_review_id(row)
    second = generate_malidaba_review_id(dict(row))
    assert first == second
    # Explicit empty supersedes must not be present; only non-empty changes ID.
    with_empty = dict(row)
    with_empty["supersedes_review_id"] = "mdrv_other_aaaaaaaaaaaa"
    assert generate_malidaba_review_id(with_empty) != first


def test_same_reviewer_new_timestamp_without_supersession_blocks(tmp_path: Path):
    paths = _setup_batch(tmp_path, n=1)
    completed = tmp_path / "completed.csv"
    _fill_completed(paths["blank"], completed)
    registry = tmp_path / "reviews.jsonl"
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
    completed2 = tmp_path / "completed2.csv"
    _fill_completed(
        paths["blank"],
        completed2,
        reviewed_at="2026-08-22T12:46:00-04:00",
    )
    with pytest.raises(MalidabaReviewWriteError, match="silent duplicate"):
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


def test_same_reviewer_changed_decision_without_supersession_blocks(tmp_path: Path):
    paths = _setup_batch(tmp_path, n=1)
    completed = tmp_path / "completed.csv"
    _fill_completed(paths["blank"], completed)
    registry = tmp_path / "reviews.jsonl"
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
    completed2 = tmp_path / "completed2.csv"
    _fill_completed(
        paths["blank"],
        completed2,
        review_decision="needs_more_evidence",
        reviewed_at="2026-08-22T12:46:00-04:00",
    )
    with pytest.raises(MalidabaReviewWriteError, match="silent duplicate"):
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


def test_same_reviewer_changed_notes_without_supersession_blocks(tmp_path: Path):
    paths = _setup_batch(tmp_path, n=1)
    completed = tmp_path / "completed.csv"
    _fill_completed(paths["blank"], completed)
    registry = tmp_path / "reviews.jsonl"
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
    completed2 = tmp_path / "completed2.csv"
    _fill_completed(
        paths["blank"],
        completed2,
        review_notes="extra note",
        reviewed_at="2026-08-22T12:46:00-04:00",
    )
    with pytest.raises(MalidabaReviewWriteError, match="silent duplicate"):
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


def test_explicit_same_reviewer_supersession_succeeds():
    root = _base_row()
    child = _base_row(
        reviewed_at="2026-08-22T13:00:00-04:00",
        review_decision="needs_more_evidence",
        review_notes="revised",
        supersedes_review_id=root["review_id"],
    )
    result = validate_malidaba_review_table([root, child], path=Path("mem://supersede"))
    assert result.summary["row_count"] == 2
    assert result.summary["current_leaf_count"] == 1
    assert result.summary["current_leaf_review_ids"] == [child["review_id"]]
    assert result.summary["current_leaf_decision_counts"] == {"needs_more_evidence": 1}


def test_supersession_target_must_exist():
    child = _base_row(
        supersedes_review_id="mdrv_missing_aaaaaaaaaaaa",
        reviewed_at="2026-08-22T13:00:00-04:00",
    )
    with pytest.raises(MalidabaReviewValidationError, match="unknown supersedes"):
        validate_malidaba_review_table([child], path=Path("mem://missing"))


def test_cannot_supersede_other_reviewer():
    root = _base_row(reviewer_id="Reviewer_001")
    child = _base_row(
        reviewer_id="Reviewer_002",
        reviewed_at="2026-08-22T13:00:00-04:00",
        supersedes_review_id=root["review_id"],
    )
    with pytest.raises(MalidabaReviewValidationError, match="same reviewer_id"):
        validate_malidaba_review_table([root, child], path=Path("mem://other_rev"))


def test_cannot_supersede_different_subject():
    root = _base_row(review_subject_id="s1")
    child = _base_row(
        review_subject_id="s2",
        reviewed_at="2026-08-22T13:00:00-04:00",
        supersedes_review_id=root["review_id"],
    )
    with pytest.raises(MalidabaReviewValidationError, match="same review_subject_id"):
        validate_malidaba_review_table([root, child], path=Path("mem://diff_subj"))


def test_cannot_supersede_different_fingerprint():
    root = _base_row()
    child = _base_row(
        current_record_fingerprint_sha256="b" * 64,
        reviewed_at="2026-08-22T13:00:00-04:00",
        supersedes_review_id=root["review_id"],
    )
    with pytest.raises(
        MalidabaReviewValidationError, match="same current_record_fingerprint"
    ):
        validate_malidaba_review_table([root, child], path=Path("mem://diff_fp"))


def test_cannot_supersede_different_delta():
    root = _base_row()
    child = _base_row(
        delta_sha256="e" * 64,
        reviewed_at="2026-08-22T13:00:00-04:00",
        supersedes_review_id=root["review_id"],
    )
    with pytest.raises(MalidabaReviewValidationError, match="same delta_sha256"):
        validate_malidaba_review_table([root, child], path=Path("mem://diff_delta"))


def test_reviewed_at_chronology_enforced():
    root = _base_row(reviewed_at="2026-08-22T13:00:00-04:00")
    child = _base_row(
        reviewed_at="2026-08-22T12:00:00-04:00",
        supersedes_review_id=root["review_id"],
    )
    with pytest.raises(MalidabaReviewValidationError, match="reviewed_at must be >="):
        validate_malidaba_review_table([root, child], path=Path("mem://chrono"))


def test_self_supersession_blocks():
    row = _base_row()
    row["supersedes_review_id"] = row["review_id"]
    with pytest.raises(MalidabaReviewValidationError, match="self-supersession"):
        validate_malidaba_review_table([row], path=Path("mem://self"))


def test_cycle_blocks():
    a = _base_row(review_notes="a")
    b = _base_row(
        reviewed_at="2026-08-22T13:00:00-04:00",
        review_notes="b",
        supersedes_review_id=a["review_id"],
    )
    # Create cycle by pointing a at b (invalid identity, so inject after generation)
    a_cycled = copy.deepcopy(a)
    a_cycled["supersedes_review_id"] = b["review_id"]
    # Keep a's review_id as originally generated without supersedes to simulate
    # corrupt on-disk cycle; table cycle detector still walks edges.
    with pytest.raises(MalidabaReviewValidationError, match="cycle"):
        # Bypass per-row identity by calling cycle helper path via table with
        # manually inconsistent IDs: use validate path after patching.
        from malipense_version_delta import validate_reviews as vr

        rows_by_id = {
            a_cycled["review_id"]: vr.MalidabaReviewRow(
                row=a_cycled, path=Path("mem"), line_number=1
            ),
            b["review_id"]: vr.MalidabaReviewRow(row=b, path=Path("mem"), line_number=2),
        }
        vr._detect_review_supersession_cycle(rows_by_id, Path("mem://cycle"))


def test_same_reviewer_branching_blocks():
    root = _base_row()
    child1 = _base_row(
        reviewed_at="2026-08-22T13:00:00-04:00",
        review_notes="c1",
        supersedes_review_id=root["review_id"],
    )
    child2 = _base_row(
        reviewed_at="2026-08-22T13:01:00-04:00",
        review_notes="c2",
        supersedes_review_id=root["review_id"],
    )
    with pytest.raises(MalidabaReviewValidationError, match="branching"):
        validate_malidaba_review_table(
            [root, child1, child2], path=Path("mem://branch")
        )


def test_exactly_one_leaf_per_reviewer_scope():
    root = _base_row()
    child = _base_row(
        reviewed_at="2026-08-22T13:00:00-04:00",
        supersedes_review_id=root["review_id"],
        review_notes="leaf",
    )
    leaves = find_malidaba_review_leaves([root, child])
    assert leaves == [child["review_id"]]


def test_independent_second_reviewer_allowed():
    r1 = _base_row(reviewer_id="Reviewer_001")
    r2 = _base_row(reviewer_id="Reviewer_002")
    result = validate_malidaba_review_table([r1, r2], path=Path("mem://two_rev"))
    assert result.summary["current_leaf_count"] == 2
    assert result.summary["review_history_count"] == 2
    assert review_scope_key(r1) != review_scope_key(r2)


def test_unknown_registry_field_blocks():
    row = _base_row()
    row["extra_field"] = "nope"
    with pytest.raises(MalidabaReviewValidationError, match="unknown fields"):
        validate_malidaba_review_table([row], path=Path("mem://unknown"))


def test_promotion_field_blocks():
    for field in (
        "approved_for_dictionary",
        "publication_status",
        "bundle_id",
        "promotion_status",
        "headword_candidate",
        "search_mapping",
    ):
        row = _base_row()
        row[field] = "x"
        with pytest.raises(MalidabaReviewValidationError, match="unknown fields"):
            validate_malidaba_review_table([row], path=Path(f"mem://{field}"))


def test_two_independent_roots_same_reviewer_blocks():
    a = _base_row(review_notes="root1")
    b = _base_row(
        reviewed_at="2026-08-22T12:46:00-04:00",
        review_notes="root2",
    )
    with pytest.raises(MalidabaReviewValidationError, match="exactly one root"):
        validate_malidaba_review_table([a, b], path=Path("mem://two_roots"))


def test_real_registry_still_valid_if_present():
    path = Path(
        "/home/potentplot/projects/perso_projects/SiraLex/"
        "data/malidaba_delta/current/review/malidaba_delta_reviews_v1.jsonl"
    )
    if not path.is_file():
        pytest.skip("local F13 registry not present")
    result = validate_malidaba_reviews(path)
    assert result.summary["row_count"] == 100
    assert result.summary["current_leaf_count"] == 100
    assert result.summary["review_history_count"] == 100
    assert result.summary["current_leaf_decision_counts"] == {
        "confirmed_source_delta": 100
    }
