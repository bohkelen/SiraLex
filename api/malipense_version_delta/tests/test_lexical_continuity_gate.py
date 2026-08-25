"""Tests for CORPUS1F17 Malidaba lexical continuity gate."""

from __future__ import annotations

import csv
import json
from pathlib import Path

import pytest

from malipense_version_delta.source_refresh.continuity.assertions import (
    build_edition_assertions,
    classify_field_assertion,
    forbid_legacy_relabel_as_current,
    legacy_only_assertions,
)
from malipense_version_delta.source_refresh.continuity.g9_continuity import (
    apply_human_type_b_dispositions,
    evaluate_g9_versioned_continuity,
)
from malipense_version_delta.source_refresh.continuity.logical import (
    RIGHTS_CC_BY_NC_SA,
    SOURCE_ID_MALIPENSE,
    build_continuity_object,
    logical_lexical_id,
    multi_current_continuity,
    reject_headword_only_identity,
    reject_source_record_id_only_identity,
)
from malipense_version_delta.source_refresh.continuity.type_a_v2 import (
    CONTINUITY_CONTEXT_COLUMNS,
    build_continuity_worksheet_row,
    dry_run_continuity_worksheet,
    write_continuity_worksheet,
)
from malipense_version_delta.source_refresh.continuity.type_b import (
    TYPE_B_REVIEW_DECISION,
    encode_type_b_retain_all,
    type_b_rights_inheritance,
    write_type_b_completed_worksheet,
)
from malipense_version_delta.source_refresh.model import (
    ASSERTION_BOTH,
    ASSERTION_CONFLICT,
    ASSERTION_CURRENT,
    ASSERTION_LEGACY,
    CONTINUITY_HUMAN_CONFIRMED,
    CONTINUITY_LEGACY_RETAINED,
    DESTRUCTIVE_AMBIGUOUS,
    DESTRUCTIVE_REQUIRES_REVIEW,
    DESTRUCTIVE_RETAINED,
)
from malipense_version_delta.source_refresh.transition.worksheets import (
    build_missing_worksheet_row,
    dry_run_missing_disposition_worksheet,
)


def _ir(ir_id: str, *, headword: str = "hw", senses: list | None = None) -> dict:
    return {
        "ir_id": ir_id,
        "record_locator": {
            "url_canonical": "https://example.test/a.htm",
            "source_record_id": f"sr_{ir_id}",
        },
        "fields_raw": {
            "headword_latin": headword,
            "headword_nko_provided": "ߊ",
            "senses": senses
            if senses is not None
            else [{"gloss_fr": "sens", "gloss_en": "sense"}],
        },
    }


def _missing_subject(baseline: str, headword: str = "h") -> dict:
    return {
        "baseline_ir_id": baseline,
        "baseline_source_record_id": f"sr_{baseline}",
        "baseline_url": "https://example.test/a.htm",
        "headword": headword,
        "headword_nko": "ߊ",
        "baseline_semantic_summary": "{}",
        "product_visibility_summary": "{}",
        "downstream_reference_summary": [],
        "possible_current_candidates": [],
        "f15_disposition": DESTRUCTIVE_REQUIRES_REVIEW,
        "cross_review_group_id": "",
        "cross_review_related": "false",
        "cross_review_counterpart_type": "",
        "cross_review_counterpart_subject_id": "",
        "cross_review_constraint": "",
    }


def _ambiguous_subject(baseline: str, candidates: list[str]) -> dict:
    return {
        "migration_subject_id": f"ms_{baseline}",
        "baseline_ir_id": baseline,
        "baseline_source_record_id": f"sr_{baseline}",
        "baseline_url": "https://example.test/k.htm",
        "baseline_headword": "kùn",
        "baseline_nko": "ߞߎ߲",
        "baseline_semantic_summary": "{}",
        "candidate_current_ir_ids": candidates,
        "candidate_source_record_ids": [f"sr_{c}" for c in candidates],
        "candidate_headwords": ["kùn"] * len(candidates),
        "candidate_nko": ["ߞߎ߲"] * len(candidates),
        "candidate_semantic_summaries": ["{}"] * len(candidates),
        "affected_reference_count": 1,
        "affected_references": [{"artifact_type": "test"}],
    }


def test_all_42_retain_baseline_decisions_validate(tmp_path: Path):
    subjects = [_missing_subject(f"b{i:02d}") for i in range(42)]
    rows = encode_type_b_retain_all(subjects)
    assert len(rows) == 42
    assert all(r["review_decision"] == TYPE_B_REVIEW_DECISION for r in rows)
    path = tmp_path / "missing.csv"
    write_type_b_completed_worksheet(path, rows)
    expected = [build_missing_worksheet_row(s) for s in subjects]
    expected.sort(key=lambda r: (r["baseline_url"], r["headword"], r["baseline_ir_id"]))
    result = dry_run_missing_disposition_worksheet(path, expected_rows=expected)
    assert result.summary["rows_read"] == 42
    assert result.summary["rows_skipped_unreviewed"] == 0
    assert result.summary["preview_row_count"] == 42
    assert result.summary["error_count"] == 0


def test_retained_baseline_no_longer_counts_as_destructive_removal():
    f15 = [
        {
            "baseline_ir_id": "x1",
            "disposition": DESTRUCTIVE_REQUIRES_REVIEW,
            "reason": "product_visible",
        },
        {
            "baseline_ir_id": "x2",
            "disposition": DESTRUCTIVE_AMBIGUOUS,
            "reason": "ambiguous",
        },
    ]
    overlay = apply_human_type_b_dispositions(
        f15, retain_baseline_ir_ids={"x1", "x2"}
    )
    gate, counts = evaluate_g9_versioned_continuity(overlay)
    assert gate.status == "PASS"
    assert counts["retain_baseline_record"] == 2
    assert counts["destructive_unresolved"] == 0
    assert counts["destructive_requires_review"] == 0


def test_retained_baseline_preserves_exact_provenance():
    obj = build_continuity_object(
        baseline_ir_ids=["b1"],
        current_ir_ids=[],
        continuity_status=CONTINUITY_LEGACY_RETAINED,
        provenance={
            "kind": "human_type_b_retain_baseline_record",
            "baseline_edition_ir_id": "b1",
            "current_edition_attribution": False,
        },
    )
    assert obj["baseline_ir_ids"] == ["b1"]
    assert obj["current_ir_ids"] == []
    assert obj["provenance"]["current_edition_attribution"] is False
    assert obj["source_id"] == SOURCE_ID_MALIPENSE


def test_legacy_assertion_cannot_be_relabeled_current():
    row = {
        "assertion_class": ASSERTION_LEGACY,
        "legacy_relabeled_as_current": True,
    }
    with pytest.raises(ValueError, match="legacy_assertion_cannot_be_relabeled"):
        forbid_legacy_relabel_as_current(row)


def test_exact_old_new_assertion_both_editions():
    assert classify_field_assertion(baseline_value="a", current_value="a") == ASSERTION_BOTH
    rows = build_edition_assertions(
        baseline_record=_ir("b1", headword="same"),
        current_record=_ir("c1", headword="same"),
        baseline_ir_id="b1",
        current_ir_id="c1",
    )
    hw = next(r for r in rows if r["field"] == "headword_latin")
    assert hw["assertion_class"] == ASSERTION_BOTH
    assert hw["baseline_edition"]["ir_id"] == "b1"
    assert hw["current_edition"]["ir_id"] == "c1"
    assert hw["current_wins_overwrite"] is False


def test_baseline_only_assertion_legacy_supported():
    assert classify_field_assertion(baseline_value="old", current_value=None) == ASSERTION_LEGACY
    rows = legacy_only_assertions(
        baseline_record=_ir("b1"), baseline_ir_id="b1"
    )
    assert rows
    assert all(r["assertion_class"] == ASSERTION_LEGACY for r in rows)
    assert all(r["legacy_relabeled_as_current"] is False for r in rows)


def test_current_only_assertion():
    assert classify_field_assertion(baseline_value=None, current_value="new") == ASSERTION_CURRENT


def test_conflicting_assertion_remains_conflict():
    assert (
        classify_field_assertion(baseline_value="old", current_value="new")
        == ASSERTION_CONFLICT
    )
    rows = build_edition_assertions(
        baseline_record=_ir("b1", headword="old"),
        current_record=_ir("c1", headword="new"),
        baseline_ir_id="b1",
        current_ir_id="c1",
    )
    hw = next(r for r in rows if r["field"] == "headword_latin")
    assert hw["assertion_class"] == ASSERTION_CONFLICT
    assert hw["baseline_edition"]["value"] == "old"
    assert hw["current_edition"]["value"] == "new"
    assert hw["current_wins_overwrite"] is False


def test_no_current_wins_overwrite():
    rows = build_edition_assertions(
        baseline_record=_ir("b1", senses=[{"gloss_fr": "A"}]),
        current_record=_ir("c1", senses=[{"gloss_fr": "B"}, {"gloss_fr": "C"}]),
        baseline_ir_id="b1",
        current_ir_id="c1",
    )
    assert all(r["current_wins_overwrite"] is False for r in rows)


def test_one_baseline_multiple_current_assertions_supported():
    obj = multi_current_continuity(
        baseline_ir_id="b1",
        current_ir_ids=["c1", "c2"],
        continuity_status=CONTINUITY_HUMAN_CONFIRMED,
    )
    assert obj["baseline_ir_ids"] == ["b1"]
    assert obj["current_ir_ids"] == ["c1", "c2"]
    assert obj["logical_lexical_id"].startswith("llx_")


def test_headword_alone_cannot_create_logical_identity():
    with pytest.raises(ValueError, match="headword_alone"):
        reject_headword_only_identity("kùn")


def test_source_record_id_alone_cannot_create_stable_logical_identity():
    with pytest.raises(ValueError, match="source_record_id_alone"):
        reject_source_record_id_only_identity("e278")


def test_deterministic_logical_id():
    a = logical_lexical_id(
        baseline_ir_ids=["b1"],
        current_ir_ids=["c1"],
        continuity_status=CONTINUITY_LEGACY_RETAINED,
    )
    b = logical_lexical_id(
        baseline_ir_ids=["b1"],
        current_ir_ids=["c1"],
        continuity_status=CONTINUITY_LEGACY_RETAINED,
    )
    c = logical_lexical_id(
        baseline_ir_ids=["b2"],
        current_ir_ids=["c1"],
        continuity_status=CONTINUITY_LEGACY_RETAINED,
    )
    assert a == b
    assert a != c
    assert a.startswith("llx_")


def test_type_a_v2_multi_candidate_selection(tmp_path: Path):
    subject = _ambiguous_subject("b1", ["c1", "c2", "c3"])
    path = tmp_path / "cont.csv"
    rows = write_continuity_worksheet(path, [subject])
    row = list(csv.DictReader(path.open()))[0]
    row["review_decision"] = "confirmed_continuity"
    row["selected_current_ir_ids"] = json.dumps(["c1", "c3"])
    row["reviewer_id"] = "Reviewer_001"
    row["reviewed_at"] = "2026-08-24T12:00:00+00:00"
    row["review_method"] = "manual_review"
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()), lineterminator="\n")
        writer.writeheader()
        writer.writerow(row)
    result = dry_run_continuity_worksheet(path, expected_rows=rows)
    assert result.summary["error_count"] == 0
    assert result.summary["preview_row_count"] == 1
    assert result.preview_rows[0]["selected_current_ir_ids"] == ["c1", "c3"]


def test_type_a_v2_non_candidate_selected_id_blocks(tmp_path: Path):
    subject = _ambiguous_subject("b1", ["c1", "c2"])
    path = tmp_path / "cont.csv"
    rows = write_continuity_worksheet(path, [subject])
    row = list(csv.DictReader(path.open()))[0]
    row["review_decision"] = "confirmed_continuity"
    row["selected_current_ir_ids"] = json.dumps(["c9"])
    row["reviewer_id"] = "Reviewer_001"
    row["reviewed_at"] = "2026-08-24T12:00:00+00:00"
    row["review_method"] = "manual_review"
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()), lineterminator="\n")
        writer.writeheader()
        writer.writerow(row)
    result = dry_run_continuity_worksheet(path, expected_rows=rows)
    assert result.summary["error_count"] == 1
    assert any("not in frozen candidates" in e for e in result.errors)


def test_legacy_only_requires_empty_target_list(tmp_path: Path):
    subject = _ambiguous_subject("b1", ["c1"])
    path = tmp_path / "cont.csv"
    rows = write_continuity_worksheet(path, [subject])
    row = list(csv.DictReader(path.open()))[0]
    row["review_decision"] = "legacy_only"
    row["selected_current_ir_ids"] = json.dumps(["c1"])
    row["reviewer_id"] = "Reviewer_001"
    row["reviewed_at"] = "2026-08-24T12:00:00+00:00"
    row["review_method"] = "manual_review"
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()), lineterminator="\n")
        writer.writeheader()
        writer.writerow(row)
    result = dry_run_continuity_worksheet(path, expected_rows=rows)
    assert result.summary["error_count"] == 1
    assert any("requires empty" in e for e in result.errors)


def test_needs_more_evidence_requires_empty_target_list(tmp_path: Path):
    subject = _ambiguous_subject("b1", ["c1"])
    path = tmp_path / "cont.csv"
    rows = write_continuity_worksheet(path, [subject])
    row = list(csv.DictReader(path.open()))[0]
    row["review_decision"] = "needs_more_evidence"
    row["selected_current_ir_ids"] = "c1"
    row["reviewer_id"] = "Reviewer_001"
    row["reviewed_at"] = "2026-08-24T12:00:00+00:00"
    row["review_method"] = "manual_review"
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()), lineterminator="\n")
        writer.writeheader()
        writer.writerow(row)
    result = dry_run_continuity_worksheet(path, expected_rows=rows)
    assert result.summary["error_count"] == 1


def test_worksheet_stale_protection(tmp_path: Path):
    subject = _ambiguous_subject("b1", ["c1"])
    path = tmp_path / "cont.csv"
    rows = write_continuity_worksheet(path, [subject])
    row = list(csv.DictReader(path.open()))[0]
    row["baseline_headword"] = "tampered"
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()), lineterminator="\n")
        writer.writeheader()
        writer.writerow(row)
    result = dry_run_continuity_worksheet(path, expected_rows=rows)
    assert result.summary["error_count"] == 1
    assert any("STALE" in e for e in result.errors)
    for col in CONTINUITY_CONTEXT_COLUMNS:
        assert col in rows[0]


def test_42_legacy_continuity_objects_deterministic():
    ids = []
    for i in range(42):
        obj = build_continuity_object(
            baseline_ir_ids=[f"b{i:02d}"],
            current_ir_ids=[],
            continuity_status=CONTINUITY_LEGACY_RETAINED,
        )
        ids.append(obj["logical_lexical_id"])
    assert len(ids) == 42
    assert len(set(ids)) == 42
    # Recompute same
    again = [
        build_continuity_object(
            baseline_ir_ids=[f"b{i:02d}"],
            current_ir_ids=[],
            continuity_status=CONTINUITY_LEGACY_RETAINED,
        )["logical_lexical_id"]
        for i in range(42)
    ]
    assert ids == again


def test_rights_inherited_from_src_malipense():
    rights = type_b_rights_inheritance()
    assert rights["source_id"] == SOURCE_ID_MALIPENSE
    assert rights["claimed_license"] == RIGHTS_CC_BY_NC_SA
    obj = build_continuity_object(
        baseline_ir_ids=["b1"],
        current_ir_ids=[],
        continuity_status=CONTINUITY_LEGACY_RETAINED,
    )
    assert obj["rights_status"]["claimed_license"] == RIGHTS_CC_BY_NC_SA
    assert obj["rights_status"]["inherited_from"] == SOURCE_ID_MALIPENSE
    assert obj["rights_status"]["commercial_distribution"] == "blocked"


def test_no_canonical_writes_or_product_promotion_in_contract():
    from malipense_version_delta.source_refresh.continuity.evaluate import (
        DECISION_READY,
    )

    assert "CONTINUITY" in DECISION_READY
    assert DESTRUCTIVE_RETAINED == "RETAIN_BASELINE_RECORD"


def test_type_a_v2_blank_dry_run(tmp_path: Path):
    subjects = [_ambiguous_subject(f"b{i}", [f"c{i}a", f"c{i}b"]) for i in range(5)]
    path = tmp_path / "cont.csv"
    rows = write_continuity_worksheet(path, subjects)
    result = dry_run_continuity_worksheet(path, expected_rows=rows)
    assert result.summary == {
        "rows_read": 5,
        "rows_skipped_unreviewed": 5,
        "preview_row_count": 0,
        "error_count": 0,
        "stale_context_errors": 0,
    }
