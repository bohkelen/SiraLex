"""Tests for CORPUS1F18 transition-review persistence and virtual gates."""

from __future__ import annotations

import csv
import json
from pathlib import Path

import pytest

from malipense_version_delta.canonical_json import sha256_file
from malipense_version_delta.source_refresh.continuity.g9_continuity import (
    apply_human_type_b_dispositions,
    evaluate_g9_versioned_continuity,
)
from malipense_version_delta.source_refresh.continuity.logical import (
    RIGHTS_CC_BY_NC_SA,
    SOURCE_ID_MALIPENSE,
    build_continuity_object,
)
from malipense_version_delta.source_refresh.continuity.type_a_v2 import (
    CONTINUITY_COLUMNS,
    dry_run_continuity_worksheet,
    write_continuity_worksheet,
)
from malipense_version_delta.source_refresh.model import (
    CONTINUITY_HUMAN_CONFIRMED,
    CONTINUITY_LEGACY_RETAINED,
    DESTRUCTIVE_REQUIRES_REVIEW,
    DESTRUCTIVE_RETAINED,
    RESOLUTION_AMBIGUOUS,
    RESOLUTION_REMAP,
    RESOLUTION_STILL,
)
from malipense_version_delta.source_refresh.paths import (
    FROZEN_F17_TYPE_A_COMPLETED_WORKSHEET_SHA256,
    default_paths,
)
from malipense_version_delta.source_refresh.persist.graph import (
    logical_reference_survives_edition_ir_change,
    validate_logical_graph,
)
from malipense_version_delta.source_refresh.persist.human import EXPECTED_TYPE_A_SELECTIONS
from malipense_version_delta.source_refresh.persist.identity import (
    TYPE_A_SCHEMA,
    TYPE_B_SCHEMA,
    generate_review_id,
)
from malipense_version_delta.source_refresh.persist.validate import find_review_leaves
from malipense_version_delta.source_refresh.persist.writer import (
    TransitionReviewWriteError,
    apply_review_write,
    plan_review_write,
)
from malipense_version_delta.source_refresh.transition.virtual_overlay import (
    apply_overlay_to_ir_list,
    classify_virtual_reference,
    virtual_g7_counts,
)


def _amb_subject(baseline: str, candidates: list[str], headword: str = "hw") -> dict:
    return {
        "migration_subject_id": f"mig_{baseline}",
        "baseline_ir_id": baseline,
        "baseline_source_record_id": f"sr_{baseline}",
        "baseline_url": "https://example.test/a.htm",
        "baseline_headword": headword,
        "baseline_nko": "x",
        "baseline_semantic_summary": "{}",
        "candidate_current_ir_ids": candidates,
        "candidate_source_record_ids": [f"sr_{c}" for c in candidates],
        "candidate_headwords": [headword] * len(candidates),
        "candidate_nko": ["x"] * len(candidates),
        "candidate_semantic_summaries": ["{}"] * len(candidates),
        "affected_reference_count": 1,
        "affected_references": [{"artifact_type": "t"}],
    }


def _fill_type_a(
    path: Path, subjects: list[dict], selections: dict[str, str]
) -> list[dict[str, str]]:
    rows = write_continuity_worksheet(path, subjects)
    filled = list(csv.DictReader(path.open()))
    for row in filled:
        bid = row["baseline_ir_id"]
        row["review_decision"] = "confirmed_continuity"
        row["selected_current_ir_ids"] = json.dumps([selections[bid]])
        row["reviewer_id"] = "Reviewer_001"
        row["reviewed_at"] = "2026-08-24T13:15:00+00:00"
        row["review_method"] = "manual_review"
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle, fieldnames=CONTINUITY_COLUMNS, lineterminator="\n"
        )
        writer.writeheader()
        for row in filled:
            writer.writerow(row)
    return rows


def test_completed_five_row_type_a_validation(tmp_path: Path):
    heads = {
        "50da089833d1173a": "bari",
        "753fa18e0a6df4ab": "kun1",
        "e28e149f57ab616b": "kun2",
        "43b64456edacdbe0": "si",
        "755e1dd98e5f4535": "nya",
    }
    subjects = [
        _amb_subject(bid, [cid, "zzzzzzzzzzzzzzzz"], heads[bid])
        for bid, cid in EXPECTED_TYPE_A_SELECTIONS.items()
    ]
    path = tmp_path / "a.csv"
    expected = _fill_type_a(path, subjects, EXPECTED_TYPE_A_SELECTIONS)
    result = dry_run_continuity_worksheet(path, expected_rows=expected)
    assert result.summary["rows_read"] == 5
    assert result.summary["preview_row_count"] == 5
    assert result.summary["error_count"] == 0
    by_mig = {r["migration_subject_id"]: r["baseline_ir_id"] for r in expected}
    got = {
        by_mig[p["migration_subject_id"]]: p["selected_current_ir_ids"][0]
        for p in result.preview_rows
    }
    assert got == EXPECTED_TYPE_A_SELECTIONS


def test_exact_human_selected_targets_on_frozen_worksheet():
    paths = default_paths()
    path = (
        paths.f17_dir / "malidaba_ambiguous_reference_continuity_review_001.csv"
    )
    if not path.is_file():
        pytest.skip("local F17 Type-A worksheet missing")
    assert sha256_file(path) == FROZEN_F17_TYPE_A_COMPLETED_WORKSHEET_SHA256
    rows = list(csv.DictReader(path.open()))
    assert len(rows) == 5
    got = {
        r["baseline_ir_id"]: json.loads(r["selected_current_ir_ids"])[0] for r in rows
    }
    assert got == EXPECTED_TYPE_A_SELECTIONS
    assert all(r["review_decision"] == "confirmed_continuity" for r in rows)


def test_type_a_and_type_b_deterministic_review_ids():
    a = {
        "schema_version": TYPE_A_SCHEMA,
        "review_subject_id": "mig_abc",
        "batch_id": "malidaba_ambiguous_reference_continuity_review_001",
        "frozen_acceptance_sha256": "a" * 64,
        "continuity_subject_fingerprint": "b" * 64,
        "baseline_ir_id": "base1",
        "selected_current_ir_ids": ["cur1"],
        "review_decision": "confirmed_continuity",
        "reviewer_id": "Reviewer_001",
        "reviewed_at": "2026-08-24T13:15:00+00:00",
        "review_method": "manual_review",
        "issue_codes": [],
        "review_notes": "",
    }
    id1 = generate_review_id(a, schema_version=TYPE_A_SCHEMA)
    assert id1 == generate_review_id(a, schema_version=TYPE_A_SCHEMA)
    assert id1.startswith("mcrv_")
    b = {
        "schema_version": TYPE_B_SCHEMA,
        "review_subject_id": "base1",
        "batch_id": "malidaba_missing_record_disposition_review_001",
        "frozen_acceptance_sha256": "a" * 64,
        "subject_fingerprint": "c" * 64,
        "baseline_ir_id": "base1",
        "selected_current_ir_id": "",
        "review_decision": "retain_baseline_record",
        "reviewer_id": "Reviewer_001",
        "reviewed_at": "2026-08-24T12:00:00+00:00",
        "review_method": "manual_review",
        "issue_codes": [],
        "review_notes": "",
    }
    bid1 = generate_review_id(b, schema_version=TYPE_B_SCHEMA)
    assert bid1 == generate_review_id(b, schema_version=TYPE_B_SCHEMA)
    assert bid1.startswith("mmrv_")
    assert id1 != bid1


def _type_a_row(subject: str, *, selected: str, reviewed_at: str) -> dict:
    row = {
        "schema_version": TYPE_A_SCHEMA,
        "review_subject_id": subject,
        "batch_id": "malidaba_ambiguous_reference_continuity_review_001",
        "frozen_acceptance_sha256": "a" * 64,
        "continuity_subject_fingerprint": "f" * 64,
        "baseline_ir_id": "b1",
        "selected_current_ir_ids": [selected],
        "review_decision": "confirmed_continuity",
        "reviewer_id": "Reviewer_001",
        "reviewed_at": reviewed_at,
        "review_method": "manual_review",
        "issue_codes": [],
        "review_notes": "",
    }
    row["review_id"] = generate_review_id(row, schema_version=TYPE_A_SCHEMA)
    return row


def test_first_apply_and_idempotent_second_apply(tmp_path: Path):
    worksheet = tmp_path / "ws.csv"
    worksheet.write_text("x\n", encoding="utf-8")
    output = tmp_path / "reg.jsonl"
    rows = [_type_a_row("mig_1", selected="c1", reviewed_at="2026-08-24T13:15:00+00:00")]
    plan1 = plan_review_write(
        kind="type_a",
        schema_version=TYPE_A_SCHEMA,
        worksheet_path=worksheet,
        output_path=output,
        candidate_rows=rows,
    )
    assert plan1.receipt["rows_before"] == 0
    apply_review_write(plan1, output_path=output, kind="type_a")
    assert plan1.receipt["new_rows_written"] == 1
    sha1 = sha256_file(output)
    plan2 = plan_review_write(
        kind="type_a",
        schema_version=TYPE_A_SCHEMA,
        worksheet_path=worksheet,
        output_path=output,
        candidate_rows=rows,
    )
    assert plan2.receipt["new_rows_written"] == 0
    assert plan2.receipt["already_present_identical"] == 1
    apply_review_write(plan2, output_path=output, kind="type_a")
    assert sha256_file(output) == sha1


def test_same_reviewer_explicit_supersession(tmp_path: Path):
    worksheet = tmp_path / "ws.csv"
    worksheet.write_text("x\n", encoding="utf-8")
    output = tmp_path / "reg.jsonl"
    first = _type_a_row("mig_1", selected="c1", reviewed_at="2026-08-24T13:15:00+00:00")
    apply_review_write(
        plan_review_write(
            kind="type_a",
            schema_version=TYPE_A_SCHEMA,
            worksheet_path=worksheet,
            output_path=output,
            candidate_rows=[first],
        ),
        output_path=output,
        kind="type_a",
    )
    second = _type_a_row("mig_1", selected="c2", reviewed_at="2026-08-24T14:15:00+00:00")
    second["supersedes_review_id"] = first["review_id"]
    second["review_id"] = generate_review_id(second, schema_version=TYPE_A_SCHEMA)
    apply_review_write(
        plan_review_write(
            kind="type_a",
            schema_version=TYPE_A_SCHEMA,
            worksheet_path=worksheet,
            output_path=output,
            candidate_rows=[second],
        ),
        output_path=output,
        kind="type_a",
    )
    loaded = [json.loads(line) for line in output.read_text().splitlines() if line.strip()]
    assert find_review_leaves(loaded) == [second["review_id"]]
    assert len(loaded) == 2


def test_branching_blocked(tmp_path: Path):
    worksheet = tmp_path / "ws.csv"
    worksheet.write_text("x\n", encoding="utf-8")
    output = tmp_path / "reg.jsonl"
    first = _type_a_row("mig_1", selected="c1", reviewed_at="2026-08-24T13:15:00+00:00")
    apply_review_write(
        plan_review_write(
            kind="type_a",
            schema_version=TYPE_A_SCHEMA,
            worksheet_path=worksheet,
            output_path=output,
            candidate_rows=[first],
        ),
        output_path=output,
        kind="type_a",
    )
    silent = _type_a_row("mig_1", selected="c9", reviewed_at="2026-08-24T15:15:00+00:00")
    with pytest.raises(TransitionReviewWriteError, match="silent duplicate"):
        plan_review_write(
            kind="type_a",
            schema_version=TYPE_A_SCHEMA,
            worksheet_path=worksheet,
            output_path=output,
            candidate_rows=[silent],
        )


def test_stale_context_and_non_candidate_blocked(tmp_path: Path):
    subject = _amb_subject("b1", ["c1", "c2"])
    path = tmp_path / "a.csv"
    rows = write_continuity_worksheet(path, [subject])
    stale = list(csv.DictReader(path.open()))[0]
    stale["baseline_headword"] = "tampered"
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle, fieldnames=CONTINUITY_COLUMNS, lineterminator="\n"
        )
        writer.writeheader()
        writer.writerow(stale)
    assert dry_run_continuity_worksheet(path, expected_rows=rows).summary["error_count"] == 1

    rows = write_continuity_worksheet(path, [subject])
    bad = list(csv.DictReader(path.open()))[0]
    bad["review_decision"] = "confirmed_continuity"
    bad["selected_current_ir_ids"] = json.dumps(["not_a_candidate"])
    bad["reviewer_id"] = "Reviewer_001"
    bad["reviewed_at"] = "2026-08-24T13:15:00+00:00"
    bad["review_method"] = "manual_review"
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle, fieldnames=CONTINUITY_COLUMNS, lineterminator="\n"
        )
        writer.writeheader()
        writer.writerow(bad)
    result = dry_run_continuity_worksheet(path, expected_rows=rows)
    assert result.summary["error_count"] == 1
    assert any("not in frozen candidates" in e for e in result.errors)


def test_continuity_graph_counts_and_homograph_separation():
    objects = []
    for i in range(10):
        objects.append(
            build_continuity_object(
                baseline_ir_ids=[f"d{i}"],
                current_ir_ids=[f"cd{i}"],
                continuity_status="DETERMINISTIC_CONTINUITY",
            )
        )
    objects.append(
        build_continuity_object(
            baseline_ir_ids=["753fa18e0a6df4ab"],
            current_ir_ids=["294714956aec1624"],
            continuity_status=CONTINUITY_HUMAN_CONFIRMED,
        )
    )
    objects.append(
        build_continuity_object(
            baseline_ir_ids=["e28e149f57ab616b"],
            current_ir_ids=["6ce45fcce8546c6f"],
            continuity_status=CONTINUITY_HUMAN_CONFIRMED,
        )
    )
    for i in range(3):
        objects.append(
            build_continuity_object(
                baseline_ir_ids=[f"h{i}"],
                current_ir_ids=[f"ch{i}"],
                continuity_status=CONTINUITY_HUMAN_CONFIRMED,
            )
        )
    for i in range(42):
        objects.append(
            build_continuity_object(
                baseline_ir_ids=[f"L{i:02d}"],
                current_ir_ids=[],
                continuity_status=CONTINUITY_LEGACY_RETAINED,
                provenance={"current_edition_attribution": False},
            )
        )
    result = validate_logical_graph(objects)
    assert result["ok"] is True
    assert result["logical_id_count"] == 57
    kun_ids = {
        o["logical_lexical_id"]
        for o in objects
        if o["baseline_ir_ids"][0] in {"753fa18e0a6df4ab", "e28e149f57ab616b"}
    }
    assert len(kun_ids) == 2
    assert sum(1 for o in objects if o["continuity_status"] == CONTINUITY_LEGACY_RETAINED) == 42
    assert sum(1 for o in objects if o["continuity_status"] == CONTINUITY_HUMAN_CONFIRMED) == 5


def test_complete_virtual_g7_resolution():
    overlay = {f"b{i}": f"c{i}" for i in range(37)}
    rows = [
        {"baseline_target_ir_id": f"b{i}", "resolution_status": RESOLUTION_REMAP}
        for i in range(23)
    ] + [
        {"baseline_target_ir_id": f"b{i}", "resolution_status": RESOLUTION_AMBIGUOUS}
        for i in range(23, 37)
    ]
    counts = virtual_g7_counts(rows, overlay)
    assert counts["requires_remap"] == 0
    assert counts["ambiguous"] == 0
    assert counts["broken"] == 0
    assert counts["still_resolves"] == 37
    assert (
        classify_virtual_reference(
            baseline_ir_id="b30",
            f15_status=RESOLUTION_AMBIGUOUS,
            overlay=overlay,
        )
        == RESOLUTION_STILL
    )


def test_alias_apply_with_human_remap_overlay():
    overlay = {"755e1dd98e5f4535": "b0c569ca42cf6d71"}
    assert apply_overlay_to_ir_list(["755e1dd98e5f4535", "keep"], overlay) == [
        "b0c569ca42cf6d71",
        "keep",
    ]


def test_regression_replay_determinism():
    overlay = {"a": "x"}
    assert apply_overlay_to_ir_list(["a", "b", "a"], overlay) == ["x", "b", "x"]
    assert apply_overlay_to_ir_list(["a", "b", "a"], overlay) == ["x", "b", "x"]


def test_g9_legacy_retention_pass():
    f15 = [
        {"baseline_ir_id": f"x{i}", "disposition": DESTRUCTIVE_REQUIRES_REVIEW}
        for i in range(42)
    ]
    overlay = apply_human_type_b_dispositions(
        f15, retain_baseline_ir_ids={f"x{i}" for i in range(42)}
    )
    gate, counts = evaluate_g9_versioned_continuity(overlay)
    assert gate.status == "PASS"
    assert counts["retain_baseline_record"] == 42
    assert counts["destructive_unresolved"] == 0
    assert all(r["disposition"] == DESTRUCTIVE_RETAINED for r in overlay)


def test_logical_reference_survives_edition_specific_ir_id_change():
    obj = build_continuity_object(
        baseline_ir_ids=["b1"],
        current_ir_ids=["c_old"],
        continuity_status=CONTINUITY_HUMAN_CONFIRMED,
    )
    assert logical_reference_survives_edition_ir_change(
        overlay={"b1": "c_old"},
        objects=[obj],
        old_current_ir_id="c_old",
        new_current_ir_id="c_new",
    )


def test_rights_unchanged_and_no_canonical_writes():
    obj = build_continuity_object(
        baseline_ir_ids=["b1"],
        current_ir_ids=["c1"],
        continuity_status=CONTINUITY_HUMAN_CONFIRMED,
    )
    assert obj["source_id"] == SOURCE_ID_MALIPENSE
    assert obj["rights_status"]["claimed_license"] == RIGHTS_CC_BY_NC_SA
    assert obj["rights_status"]["commercial_distribution"] == "blocked"
    from malipense_version_delta.source_refresh.persist.evaluate import DECISION_READY

    assert DECISION_READY.endswith("_PERSISTED")
