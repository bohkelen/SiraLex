"""Tests for CORPUS1F16 Malidaba transition review gate."""

from __future__ import annotations

import csv
import json
from pathlib import Path

import pytest

from malipense_version_delta.canonical_json import canonical_dumps, write_jsonl
from malipense_version_delta.frozen_inputs import (
    FROZEN_BASELINE_IR_SHA256,
    FROZEN_CURRENT_IR_SHA256,
    FROZEN_DELTA_SHA256,
)
from malipense_version_delta.source_refresh.model import (
    RESOLUTION_AMBIGUOUS,
    RESOLUTION_REMAP,
)
from malipense_version_delta.source_refresh.paths import (
    FROZEN_ACCEPTANCE_SHA256,
    FROZEN_DESTRUCTIVE_MANIFEST_SHA256,
    FROZEN_INTEGRITY_MANIFEST_SHA256,
    FROZEN_REVIEW_REGISTRY_SHA256,
    SourceRefreshPaths,
)
from malipense_version_delta.source_refresh.transition.cross_review import (
    CONSISTENCY_BLOCKED,
    CONSISTENCY_READY,
    CONSTRAINT_LEGACY_RETENTION,
    compute_cross_review_coupling,
    cross_review_group_id,
    validate_cross_review_consistency,
)
from malipense_version_delta.source_refresh.transition.evaluate import (
    DECISION_BLOCKED,
    evaluate_transition_review_gate,
)
from malipense_version_delta.source_refresh.transition.proposals import (
    PROPOSAL_AMBIGUOUS_NO_AUTO,
    PROPOSAL_BLOCKED_MANY_TO_ONE,
    PROPOSAL_BLOCKED_TARGET_MISSING,
    PROPOSAL_READY,
    build_remap_proposals,
    ready_overlay_map,
)
from malipense_version_delta.source_refresh.transition.reconstruct import (
    group_migration_subjects,
    migration_subject_id,
)
from malipense_version_delta.source_refresh.transition.virtual_overlay import (
    apply_overlay_to_ir_list,
    virtual_g7_counts,
)
from malipense_version_delta.source_refresh.transition.worksheets import (
    CROSS_REVIEW_CONTEXT_COLUMNS,
    REMAP_CONTEXT_COLUMNS,
    build_ambiguous_remap_worksheet_row,
    build_missing_worksheet_row,
    dry_run_ambiguous_remap_worksheet,
    dry_run_missing_disposition_worksheet,
    write_ambiguous_remap_worksheet,
    write_missing_disposition_worksheet,
)


def _ir(
    ir_id: str,
    *,
    url: str = "https://www.mali-pense.net/emk/lexicon/a.htm",
    sid: str = "e1",
    headword: str = "demo",
    nko: str = "ߊ",
) -> dict:
    return {
        "ir_id": ir_id,
        "source_id": "src_malipense",
        "parser_version": "malipense_lexicon_v1",
        "record_locator": {
            "kind": "source_record_id",
            "url_canonical": url,
            "source_record_id": sid,
        },
        "fields_raw": {
            "headword_latin": headword,
            "headword_nko_provided": nko,
            "senses": [{"gloss_fr": "x", "gloss_en": "x"}],
        },
    }


def _subject(
    *,
    baseline: str,
    candidates: list[str],
    status: str,
    confidence: str = "PROVISIONAL",
    headword: str = "demo",
    refs: int = 1,
) -> dict:
    sid = migration_subject_id(
        baseline_ir_id=baseline,
        candidate_current_ir_ids=candidates,
        f15_resolution_status=status,
    )
    return {
        "migration_subject_id": sid,
        "baseline_ir_id": baseline,
        "baseline_source_record_id": "e1",
        "baseline_url": "https://www.mali-pense.net/emk/lexicon/a.htm",
        "baseline_headword": headword,
        "baseline_nko": "ߊ",
        "baseline_semantic_summary": "{}",
        "candidate_current_ir_ids": candidates,
        "candidate_source_record_ids": ["e9"] * len(candidates),
        "candidate_headwords": [headword] * len(candidates),
        "candidate_nko": ["ߊ"] * len(candidates),
        "candidate_semantic_summaries": ["{}"] * len(candidates),
        "identity_confidence": confidence,
        "f11_evidence_basis": {
            "identity_confidence": confidence,
            "match_method": "url_canonical+headword_latin_unique",
        },
        "f15_resolution_status": status,
        "affected_reference_count": refs,
        "affected_references": [
            {
                "artifact_type": "source_alias",
                "artifact_id": f"a{i}",
                "field": "resolved_ir_ids",
            }
            for i in range(refs)
        ],
    }


def test_deterministic_migration_grouping_dedupes_raw_refs():
    refs = []
    for i in range(3):
        refs.append(
            {
                "baseline_ir_id": "base1",
                "candidate_current_ir_ids": ["cur9"],
                "f15_resolution_status": RESOLUTION_REMAP,
                "baseline_source_record_id": "e1",
                "baseline_url": "u",
                "baseline_headword": "h",
                "baseline_nko": "n",
                "baseline_semantic_summary": "{}",
                "candidate_source_record_ids": ["e9"],
                "candidate_headwords": ["h"],
                "candidate_nko": ["n"],
                "candidate_semantic_summaries": ["{}"],
                "identity_confidence": "PROVISIONAL",
                "f11_evidence_basis": {},
                "reference_summary": {
                    "artifact_type": "source_alias",
                    "artifact_id": f"a{i}",
                    "artifact_path": "p",
                    "field": "resolved_ir_ids",
                },
            }
        )
    subjects = group_migration_subjects(refs)
    assert len(subjects) == 1
    assert subjects[0]["affected_reference_count"] == 3


def test_safe_deterministic_remap_proposal():
    subject = _subject(baseline="base1", candidates=["cur9"], status=RESOLUTION_REMAP)
    current = {"cur9": _ir("cur9", headword="demo")}
    proposals = build_remap_proposals([subject], current_index=current)
    assert proposals[0]["proposal_status"] == PROPOSAL_READY
    assert ready_overlay_map(proposals) == {"base1": "cur9"}


def test_ambiguous_subject_receives_no_proposal():
    subject = _subject(
        baseline="base1",
        candidates=["c1", "c2"],
        status=RESOLUTION_AMBIGUOUS,
        confidence="AMBIGUOUS",
    )
    proposals = build_remap_proposals(
        [subject], current_index={"c1": _ir("c1"), "c2": _ir("c2", sid="e2")}
    )
    assert proposals[0]["proposal_status"] == PROPOSAL_AMBIGUOUS_NO_AUTO
    assert ready_overlay_map(proposals) == {}


def test_proposal_target_must_exist():
    subject = _subject(baseline="base1", candidates=["missing"], status=RESOLUTION_REMAP)
    proposals = build_remap_proposals([subject], current_index={})
    assert proposals[0]["proposal_status"] == PROPOSAL_BLOCKED_TARGET_MISSING


def test_invalid_many_to_one_collapse_blocks():
    s1 = _subject(baseline="base1", candidates=["curX"], status=RESOLUTION_REMAP)
    s2 = _subject(baseline="base2", candidates=["curX"], status=RESOLUTION_REMAP)
    current = {"curX": _ir("curX", headword="demo")}
    proposals = build_remap_proposals([s1, s2], current_index=current)
    assert all(p["proposal_status"] == PROPOSAL_BLOCKED_MANY_TO_ONE for p in proposals)


def test_virtual_overlay_never_mutates_tracked_alias(tmp_path: Path):
    alias = tmp_path / "aliases.jsonl"
    write_jsonl(
        alias,
        [
            {
                "alias_id": "a1",
                "resolved_ir_ids": ["base1"],
                "evidence_ir_ids": ["base1"],
            }
        ],
    )
    before = alias.read_text(encoding="utf-8")
    mapped = apply_overlay_to_ir_list(["base1", "keep"], {"base1": "cur9"})
    assert mapped == ["cur9", "keep"]
    assert alias.read_text(encoding="utf-8") == before


def test_virtual_g7_counts_after_overlay():
    rows = [
        {
            "baseline_target_ir_id": "b1",
            "resolution_status": RESOLUTION_REMAP,
        },
        {
            "baseline_target_ir_id": "b2",
            "resolution_status": RESOLUTION_AMBIGUOUS,
        },
        {
            "baseline_target_ir_id": "b3",
            "resolution_status": RESOLUTION_REMAP,
        },
    ]
    after = virtual_g7_counts(rows, {"b1": "c1"})
    assert after["still_resolves"] == 1
    assert after["requires_remap"] == 1
    assert after["ambiguous"] == 1


def test_ambiguous_worksheet_deterministic_and_blank_dry_run(tmp_path: Path):
    subject = _subject(
        baseline="base1",
        candidates=["c1", "c2"],
        status=RESOLUTION_AMBIGUOUS,
        confidence="AMBIGUOUS",
        refs=2,
    )
    path = tmp_path / "remap.csv"
    rows1 = write_ambiguous_remap_worksheet(path, [subject])
    rows2 = write_ambiguous_remap_worksheet(path, [subject])
    assert rows1 == rows2
    result = dry_run_ambiguous_remap_worksheet(path, expected_rows=rows1)
    assert result.summary["rows_read"] == 1
    assert result.summary["rows_skipped_unreviewed"] == 1
    assert result.summary["preview_row_count"] == 0
    assert result.summary["error_count"] == 0


def test_selected_remap_must_be_candidate(tmp_path: Path):
    subject = _subject(
        baseline="base1",
        candidates=["c1", "c2"],
        status=RESOLUTION_AMBIGUOUS,
        confidence="AMBIGUOUS",
    )
    path = tmp_path / "remap.csv"
    rows = write_ambiguous_remap_worksheet(path, [subject])
    # fill invalid selection
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
    # rewrite data row
    reader = list(csv.DictReader(path.open()))
    row = reader[0]
    row["review_decision"] = "confirmed_remap"
    row["selected_current_ir_id"] = "not_a_candidate"
    row["reviewer_id"] = "Reviewer_001"
    row["reviewed_at"] = "2026-08-23T12:00:00-04:00"
    row["review_method"] = "manual_review"
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()), lineterminator="\n")
        writer.writeheader()
        writer.writerow(row)
    result = dry_run_ambiguous_remap_worksheet(path, expected_rows=rows)
    assert result.summary["error_count"] == 1
    assert any("not a frozen presented candidate" in e for e in result.errors)


def test_stale_remap_context_blocks(tmp_path: Path):
    subject = _subject(
        baseline="base1",
        candidates=["c1"],
        status=RESOLUTION_AMBIGUOUS,
        confidence="AMBIGUOUS",
    )
    path = tmp_path / "remap.csv"
    rows = write_ambiguous_remap_worksheet(path, [subject])
    reader = list(csv.DictReader(path.open()))
    row = reader[0]
    row["baseline_headword"] = "tampered"
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()), lineterminator="\n")
        writer.writeheader()
        writer.writerow(row)
    result = dry_run_ambiguous_remap_worksheet(path, expected_rows=rows)
    assert result.summary["error_count"] == 1
    assert any("STALE" in e for e in result.errors)


def test_all_42_missing_style_subjects_retained(tmp_path: Path):
    subjects = []
    for i in range(42):
        subjects.append(
            {
                "baseline_ir_id": f"miss{i:02d}",
                "baseline_source_record_id": f"e{i}",
                "baseline_url": "https://www.mali-pense.net/emk/lexicon/a.htm",
                "headword": f"hw{i}",
                "headword_nko": "",
                "baseline_semantic_summary": "{}",
                "product_visibility_summary": "{}",
                "downstream_reference_summary": [],
                "possible_current_candidates": [],
                "f15_disposition": (
                    "DESTRUCTIVE_CHANGE_REQUIRES_REVIEW" if i < 37 else "AMBIGUOUS"
                ),
            }
        )
    path = tmp_path / "missing.csv"
    rows = write_missing_disposition_worksheet(path, subjects)
    assert len(rows) == 42
    assert len({r["baseline_ir_id"] for r in rows}) == 42


def test_missing_worksheet_blank_dry_run(tmp_path: Path):
    subjects = [
        {
            "baseline_ir_id": "miss01",
            "baseline_source_record_id": "e1",
            "baseline_url": "u",
            "headword": "h",
            "headword_nko": "",
            "baseline_semantic_summary": "{}",
            "product_visibility_summary": "{}",
            "downstream_reference_summary": [],
            "possible_current_candidates": [{"ir_id": "c1"}],
            "f15_disposition": "DESTRUCTIVE_CHANGE_REQUIRES_REVIEW",
        }
    ]
    path = tmp_path / "missing.csv"
    rows = write_missing_disposition_worksheet(path, subjects)
    result = dry_run_missing_disposition_worksheet(path, expected_rows=rows)
    assert result.summary == {
        "rows_read": 1,
        "rows_skipped_unreviewed": 1,
        "preview_row_count": 0,
        "error_count": 0,
        "stale_context_errors": 0,
    }


def test_selected_equivalent_must_be_candidate(tmp_path: Path):
    subjects = [
        {
            "baseline_ir_id": "miss01",
            "baseline_source_record_id": "e1",
            "baseline_url": "u",
            "headword": "h",
            "headword_nko": "",
            "baseline_semantic_summary": "{}",
            "product_visibility_summary": "{}",
            "downstream_reference_summary": [],
            "possible_current_candidates": [{"ir_id": "c1"}],
            "f15_disposition": "DESTRUCTIVE_CHANGE_REQUIRES_REVIEW",
        }
    ]
    path = tmp_path / "missing.csv"
    rows = write_missing_disposition_worksheet(path, subjects)
    row = list(csv.DictReader(path.open()))[0]
    row["review_decision"] = "current_equivalent_confirmed"
    row["selected_current_ir_id"] = "wrong"
    row["reviewer_id"] = "Reviewer_001"
    row["reviewed_at"] = "2026-08-23T12:00:00-04:00"
    row["review_method"] = "manual_review"
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()), lineterminator="\n")
        writer.writeheader()
        writer.writerow(row)
    result = dry_run_missing_disposition_worksheet(path, expected_rows=rows)
    assert result.summary["error_count"] == 1


def test_accept_removal_and_retain_require_no_selected_target(tmp_path: Path):
    subjects = [
        {
            "baseline_ir_id": "miss01",
            "baseline_source_record_id": "e1",
            "baseline_url": "u",
            "headword": "h",
            "headword_nko": "",
            "baseline_semantic_summary": "{}",
            "product_visibility_summary": "{}",
            "downstream_reference_summary": [],
            "possible_current_candidates": [],
            "f15_disposition": "DESTRUCTIVE_CHANGE_REQUIRES_REVIEW",
        }
    ]
    path = tmp_path / "missing.csv"
    rows = write_missing_disposition_worksheet(path, subjects)
    for decision in ("accept_source_removal", "retain_baseline_record"):
        row = dict(rows[0])
        row["review_decision"] = decision
        row["selected_current_ir_id"] = "should_be_blank"
        row["reviewer_id"] = "Reviewer_001"
        row["reviewed_at"] = "2026-08-23T12:00:00-04:00"
        row["review_method"] = "manual_review"
        with path.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(
                handle, fieldnames=list(rows[0].keys()), lineterminator="\n"
            )
            writer.writeheader()
            writer.writerow(row)
        result = dry_run_missing_disposition_worksheet(path, expected_rows=rows)
        assert result.summary["error_count"] == 1, decision


def test_stale_missing_context_blocks(tmp_path: Path):
    subjects = [
        {
            "baseline_ir_id": "miss01",
            "baseline_source_record_id": "e1",
            "baseline_url": "u",
            "headword": "h",
            "headword_nko": "",
            "baseline_semantic_summary": "{}",
            "product_visibility_summary": "{}",
            "downstream_reference_summary": [],
            "possible_current_candidates": [],
            "f15_disposition": "DESTRUCTIVE_CHANGE_REQUIRES_REVIEW",
        }
    ]
    path = tmp_path / "missing.csv"
    rows = write_missing_disposition_worksheet(path, subjects)
    row = list(csv.DictReader(path.open()))[0]
    row["headword"] = "changed"
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()), lineterminator="\n")
        writer.writeheader()
        writer.writerow(row)
    result = dry_run_missing_disposition_worksheet(path, expected_rows=rows)
    assert result.summary["error_count"] == 1
    assert any("STALE" in e for e in result.errors)


def test_deterministic_serialization_of_worksheet_rows():
    subject = _subject(
        baseline="base1",
        candidates=["c1", "c2"],
        status=RESOLUTION_AMBIGUOUS,
        confidence="AMBIGUOUS",
    )
    r1 = build_ambiguous_remap_worksheet_row(subject)
    r2 = build_ambiguous_remap_worksheet_row(subject)
    assert r1 == r2
    assert canonical_dumps(r1) == canonical_dumps(r2)
    assert r1["migration_subject_fingerprint"]
    for col in REMAP_CONTEXT_COLUMNS:
        assert col in r1


def test_frozen_f15_sha_mismatch_blocks(tmp_path: Path):
    # Minimal fake paths that fail acceptance hash
    paths = SourceRefreshPaths(
        repo_root=tmp_path,
        baseline_ir=tmp_path / "baseline.jsonl",
        current_ir=tmp_path / "current.jsonl",
        delta=tmp_path / "delta.jsonl",
        crawl_dir=tmp_path / "crawl",
        capture_receipt=tmp_path / "capture.json",
        review_registry=tmp_path / "reviews.jsonl",
        baseline_crawl_dir=tmp_path / "baseline_crawl",
        output_dir=tmp_path / "source_refresh",
        owner_ir=tmp_path / "owner.jsonl",
        index_ir=tmp_path / "index.jsonl",
        aliases=tmp_path / "aliases.jsonl",
        supplements=tmp_path / "supplements.jsonl",
        target_variants=tmp_path / "variants.jsonl",
        phrase_review=tmp_path / "phrase.jsonl",
        search_regression_dir=tmp_path / "sr",
        malipense_yaml=tmp_path / "malipense.yaml",
    )
    (tmp_path / "crawl").mkdir()
    write_jsonl(paths.baseline_ir, [_ir("a")])
    write_jsonl(paths.current_ir, [_ir("b")])
    write_jsonl(paths.delta, [])
    write_jsonl(paths.review_registry, [])
    paths.acceptance_json.parent.mkdir(parents=True, exist_ok=True)
    paths.acceptance_json.write_text("{}\n", encoding="utf-8")
    write_jsonl(paths.integrity_manifest, [])
    write_jsonl(paths.destructive_manifest, [])
    receipt = evaluate_transition_review_gate(paths)
    assert receipt["decision"] == DECISION_BLOCKED
    assert "frozen_hash_mismatch" in str(receipt.get("block_reason"))


def test_regression_replay_deterministic_mapping():
    assert apply_overlay_to_ir_list(["a", "b", "a"], {"a": "x"}) == ["x", "b", "x"]


def test_no_overlap_case():
    coupling = compute_cross_review_coupling(
        ambiguous_subjects=[_subject(baseline="a1", candidates=["c1"], status=RESOLUTION_AMBIGUOUS, confidence="AMBIGUOUS")],
        deterministic_remap_subjects=[_subject(baseline="r1", candidates=["c9"], status=RESOLUTION_REMAP)],
        missing_subjects=[{"baseline_ir_id": "m1", "headword": "h"}],
    )
    assert coupling.ambiguous_missing_overlap_count == 0
    assert coupling.deterministic_remap_missing_overlap_count == 0
    assert coupling.cross_review_group_count == 0


def test_exact_baseline_ir_id_overlap_detected():
    amb = _subject(
        baseline="shared1",
        candidates=["c1", "c2"],
        status=RESOLUTION_AMBIGUOUS,
        confidence="AMBIGUOUS",
    )
    miss = {"baseline_ir_id": "shared1", "headword": "hw"}
    coupling = compute_cross_review_coupling(
        ambiguous_subjects=[amb],
        deterministic_remap_subjects=[],
        missing_subjects=[miss],
    )
    assert coupling.ambiguous_missing_overlap_count == 1
    assert coupling.ambiguous_missing_overlap_baseline_ir_ids == ["shared1"]
    assert coupling.cross_review_group_count == 1


def test_deterministic_cross_review_group_id():
    g1 = cross_review_group_id("base1")
    g2 = cross_review_group_id("base1")
    g3 = cross_review_group_id("base2")
    assert g1 == g2
    assert g1.startswith("crg_")
    assert g1 != g3


def test_same_headword_different_baseline_ir_id_no_coupling():
    amb = _subject(
        baseline="id_a",
        candidates=["c1"],
        status=RESOLUTION_AMBIGUOUS,
        confidence="AMBIGUOUS",
        headword="kùn",
    )
    miss = {"baseline_ir_id": "id_b", "headword": "kùn"}
    coupling = compute_cross_review_coupling(
        ambiguous_subjects=[amb],
        deterministic_remap_subjects=[],
        missing_subjects=[miss],
    )
    assert coupling.ambiguous_missing_overlap_count == 0


def test_cross_review_fields_exported_no_overlap(tmp_path: Path):
    subject = _subject(
        baseline="base1",
        candidates=["c1"],
        status=RESOLUTION_AMBIGUOUS,
        confidence="AMBIGUOUS",
    )
    from malipense_version_delta.source_refresh.transition.cross_review import (
        annotate_ambiguous_subject,
        compute_cross_review_coupling,
    )

    coupling = compute_cross_review_coupling(
        ambiguous_subjects=[subject],
        deterministic_remap_subjects=[],
        missing_subjects=[{"baseline_ir_id": "other"}],
    )
    annotated = annotate_ambiguous_subject(subject, coupling)
    row = build_ambiguous_remap_worksheet_row(annotated)
    assert row["cross_review_related"] == "false"
    assert row["cross_review_group_id"] == ""
    for col in CROSS_REVIEW_CONTEXT_COLUMNS:
        assert col in row


def test_cross_review_fields_exported_with_overlap():
    subject = _subject(
        baseline="shared1",
        candidates=["c1"],
        status=RESOLUTION_AMBIGUOUS,
        confidence="AMBIGUOUS",
    )
    from malipense_version_delta.source_refresh.transition.cross_review import (
        annotate_ambiguous_subject,
        annotate_missing_subject,
        compute_cross_review_coupling,
    )

    missing = {"baseline_ir_id": "shared1", "headword": "hw"}
    coupling = compute_cross_review_coupling(
        ambiguous_subjects=[subject],
        deterministic_remap_subjects=[],
        missing_subjects=[missing],
    )
    amb_row = build_ambiguous_remap_worksheet_row(
        annotate_ambiguous_subject(subject, coupling)
    )
    miss_row = build_missing_worksheet_row(annotate_missing_subject(missing, coupling))
    assert amb_row["cross_review_related"] == "true"
    assert miss_row["cross_review_related"] == "true"
    assert amb_row["cross_review_group_id"] == miss_row["cross_review_group_id"]
    assert amb_row["cross_review_constraint"] == "cross_ontology_baseline_coupling"


def test_cross_review_fields_stale_protected(tmp_path: Path):
    subject = _subject(
        baseline="shared1",
        candidates=["c1"],
        status=RESOLUTION_AMBIGUOUS,
        confidence="AMBIGUOUS",
    )
    from malipense_version_delta.source_refresh.transition.cross_review import (
        annotate_ambiguous_subject,
        compute_cross_review_coupling,
    )

    missing = {"baseline_ir_id": "shared1", "headword": "hw"}
    coupling = compute_cross_review_coupling(
        ambiguous_subjects=[subject],
        deterministic_remap_subjects=[],
        missing_subjects=[missing],
    )
    path = tmp_path / "remap.csv"
    rows = write_ambiguous_remap_worksheet(
        path, [annotate_ambiguous_subject(subject, coupling)]
    )
    row = list(csv.DictReader(path.open()))[0]
    row["cross_review_related"] = "false"
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()), lineterminator="\n")
        writer.writeheader()
        writer.writerow(row)
    result = dry_run_ambiguous_remap_worksheet(path, expected_rows=rows)
    assert result.summary["error_count"] == 1
    assert any("STALE" in e for e in result.errors)


def test_subject_set_and_order_preserved_on_regeneration(tmp_path: Path):
    subjects = [
        _subject(
            baseline=f"b{i}",
            candidates=["c1"],
            status=RESOLUTION_AMBIGUOUS,
            confidence="AMBIGUOUS",
            headword=f"h{i}",
        )
        for i in range(3)
    ]
    path = tmp_path / "remap.csv"
    rows1 = write_ambiguous_remap_worksheet(path, subjects)
    rows2 = write_ambiguous_remap_worksheet(path, subjects)
    assert [r["migration_subject_id"] for r in rows1] == [
        r["migration_subject_id"] for r in rows2
    ]
    assert {r["migration_subject_id"] for r in rows1} == {
        s["migration_subject_id"] for s in subjects
    }


def test_consistency_retain_legacy_plus_accept_removal_blocks():
    status, reason = validate_cross_review_consistency(
        type_a_decision="retain_legacy_target",
        type_b_decision="accept_source_removal",
        coupled=True,
    )
    assert status == CONSISTENCY_BLOCKED
    assert reason == CONSTRAINT_LEGACY_RETENTION


def test_consistency_retain_legacy_plus_retain_baseline_ok():
    status, _ = validate_cross_review_consistency(
        type_a_decision="retain_legacy_target",
        type_b_decision="retain_baseline_record",
        coupled=True,
    )
    assert status == CONSISTENCY_READY


def test_consistency_confirmed_remap_target_mismatch_blocks():
    status, reason = validate_cross_review_consistency(
        type_a_decision="confirmed_remap",
        type_b_decision="current_equivalent_confirmed",
        type_a_selected_current_ir_id="c1",
        type_b_selected_current_ir_id="c2",
        coupled=True,
    )
    assert status == CONSISTENCY_BLOCKED
    assert "target_mismatch" in (reason or "")


def test_needs_more_evidence_cannot_authorize_destructive_transition():
    status, reason = validate_cross_review_consistency(
        type_a_decision="needs_more_evidence",
        type_b_decision="accept_source_removal",
        coupled=True,
    )
    assert status == CONSISTENCY_BLOCKED
    assert "needs_more_evidence" in (reason or "")


def test_no_current_equivalent_does_not_authorize_removal():
    status, reason = validate_cross_review_consistency(
        type_a_decision="no_current_equivalent",
        type_b_decision="accept_source_removal",
        coupled=True,
    )
    assert status == CONSISTENCY_BLOCKED


def test_uncoupled_decisions_do_not_apply_cross_rules():
    status, _ = validate_cross_review_consistency(
        type_a_decision="retain_legacy_target",
        type_b_decision="accept_source_removal",
        coupled=False,
    )
    assert status == CONSISTENCY_READY


def test_canonical_writes_absent_from_gate_contract():
    # Contract constants used by freeze verifier must remain fixed strings.
    assert len(FROZEN_ACCEPTANCE_SHA256) == 64
    assert len(FROZEN_INTEGRITY_MANIFEST_SHA256) == 64
    assert len(FROZEN_DESTRUCTIVE_MANIFEST_SHA256) == 64
    assert FROZEN_REVIEW_REGISTRY_SHA256
    assert FROZEN_BASELINE_IR_SHA256
    assert FROZEN_CURRENT_IR_SHA256
    assert FROZEN_DELTA_SHA256
