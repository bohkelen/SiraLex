"""Synthetic tests for Malidaba SOURCE_REFRESH_ACCEPTANCE dry-run gates."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pytest

from malipense_version_delta.canonical_json import canonical_dumps, sha256_file, write_jsonl
from malipense_version_delta.source_refresh.destructive_change import (
    classify_missing_baseline_record,
    evaluate_g9_destructive_change,
)
from malipense_version_delta.source_refresh.evaluate import (
    evaluate_source_refresh_acceptance,
)
from malipense_version_delta.source_refresh.model import (
    OVERALL_BLOCKED_DESTRUCTIVE,
    OVERALL_BLOCKED_EVIDENCE,
    OVERALL_BLOCKED_REFERENCE,
    OVERALL_ENGINEERING_READY,
    RIGHTS_ALLOWED,
    RIGHTS_BLOCKED,
    derive_overall_decision,
    GateResult,
)
from malipense_version_delta.source_refresh.paths import (
    FROZEN_BASELINE_IR_SHA256,
    FROZEN_CURRENT_IR_SHA256,
    FROZEN_DELTA_SHA256,
    FROZEN_REVIEW_REGISTRY_SHA256,
    SourceRefreshPaths,
)
from malipense_version_delta.source_refresh.reference_integrity import (
    classify_malidaba_ir_reference,
    evaluate_g7_reference_integrity,
)
from malipense_version_delta.source_refresh.model import (
    RESOLUTION_AMBIGUOUS,
    RESOLUTION_BROKEN,
    RESOLUTION_NOT_BOUND,
    RESOLUTION_REMAP,
    RESOLUTION_STILL,
)


def _ir(
    ir_id: str,
    *,
    url: str = "https://www.mali-pense.net/emk/lexicon/a.htm",
    sid: str = "e1",
    headword: str = "demo",
    source_id: str = "src_malipense",
    senses: list | None = None,
) -> dict:
    return {
        "ir_id": ir_id,
        "source_id": source_id,
        "parser_version": "malipense_lexicon_v1",
        "record_locator": {
            "kind": "source_record_id",
            "url_canonical": url,
            "source_record_id": sid,
        },
        "fields_raw": {
            "headword_latin": headword,
            "senses": senses if senses is not None else [{"gloss_fr": "x"}],
        },
    }


def _delta_row(
    *,
    classification: str,
    confidence: str,
    baseline: dict | None,
    current: dict | None,
) -> dict:
    return {
        "schema_version": "malipense_version_delta_v1",
        "classification": classification,
        "change_classes": [],
        "match_method": "test",
        "identity_confidence": confidence,
        "identity_rule_id": "malipense_identity_v2_partial",
        "baseline": baseline,
        "current": current,
        "baseline_semantic_sha256": None,
        "current_semantic_sha256": None,
    }


def _review_row(
    subject: str,
    *,
    decision: str = "confirmed_source_delta",
    reviewer: str = "Reviewer_001",
    fingerprint: str = "fp1",
) -> dict:
    from malipense_version_delta.review_identity import (
        SCHEMA_VERSION,
        generate_malidaba_review_id,
    )

    preview = {
        "schema_version": SCHEMA_VERSION,
        "review_subject_id": subject,
        "batch_id": "malidaba_new_headword_review_batch_001",
        "delta_sha256": FROZEN_DELTA_SHA256,
        "current_ir_sha256": FROZEN_CURRENT_IR_SHA256,
        "current_record_fingerprint_sha256": fingerprint,
        "review_decision": decision,
        "reviewer_id": reviewer,
        "reviewed_at": "2026-08-22T12:45:00-04:00",
        "review_method": "manual_review",
        "issue_codes": [],
        "review_notes": "ok",
    }
    preview["review_id"] = generate_malidaba_review_id(preview)
    return preview


def _write_yaml(path: Path) -> None:
    path.write_text(
        'source_id: src_malipense\nclaimed_license: "CC BY-NC-SA 4.0"\n',
        encoding="utf-8",
    )


def _make_paths(tmp: Path) -> SourceRefreshPaths:
    crawl = tmp / "crawl"
    payloads = crawl / "payloads"
    payloads.mkdir(parents=True)
    # Minimal snapshots for G1 page count — tests that need G1 PASS build 27 pages
    snaps = []
    for i, letter in enumerate("abcdefghijklmnopqrstuvwxyz") :
        url = f"https://www.mali-pense.net/emk/lexicon/{letter}.htm"
        sid = f"snap_{letter}"
        snaps.append({"snapshot_id": sid, "url_canonical": url})
        (payloads / f"{sid}.html.zst").write_bytes(b"not-real")
    # 27th page ɛ
    snaps.append(
        {
            "snapshot_id": "snap_eps",
            "url_canonical": "https://www.mali-pense.net/emk/lexicon/\u025b.htm",
        }
    )
    (payloads / "snap_eps.html.zst").write_bytes(b"not-real")
    (crawl / "snapshots.jsonl").write_text(
        "".join(json.dumps(s) + "\n" for s in snaps), encoding="utf-8"
    )

    receipt = {
        "official_origin": "https://www.mali-pense.net/emk/lexicon/",
        "crawl_dir": str(crawl),
        "offline_zip_note": "NOT used as current source",
    }
    (tmp / "capture_receipt.json").write_text(json.dumps(receipt), encoding="utf-8")

    return SourceRefreshPaths(
        repo_root=tmp,
        baseline_ir=tmp / "baseline.jsonl",
        current_ir=tmp / "current.jsonl",
        delta=tmp / "delta.jsonl",
        crawl_dir=crawl,
        capture_receipt=tmp / "capture_receipt.json",
        review_registry=tmp / "reviews.jsonl",
        baseline_crawl_dir=tmp / "baseline_crawl",
        output_dir=tmp / "source_refresh",
        owner_ir=tmp / "owner.jsonl",
        index_ir=tmp / "index.jsonl",
        aliases=tmp / "aliases.jsonl",
        supplements=tmp / "supplements.jsonl",
        target_variants=tmp / "variants.jsonl",
        phrase_review=tmp / "phrase.jsonl",
        search_regression_dir=tmp / "search_regression",
        malipense_yaml=tmp / "malipense.yaml",
        canonical_enriched=tmp / "enriched.jsonl",
        canonical_bundle_dir=None,
    )


def test_frozen_hash_mismatch_blocks(tmp_path: Path):
    paths = _make_paths(tmp_path)
    write_jsonl(paths.baseline_ir, [_ir("aaaa")])
    write_jsonl(paths.current_ir, [_ir("bbbb")])
    write_jsonl(paths.delta, [])
    write_jsonl(paths.review_registry, [])
    _write_yaml(paths.malipense_yaml)
    write_jsonl(paths.owner_ir, [])
    write_jsonl(paths.index_ir, [])
    write_jsonl(paths.aliases, [])
    acceptance = evaluate_source_refresh_acceptance(
        paths, skip_isolated_build=True
    )
    assert acceptance.overall_decision == OVERALL_BLOCKED_EVIDENCE
    assert any("frozen_hash_mismatch" in r for r in acceptance.blocking_reasons)


def test_classify_stable_downstream_reference_resolves():
    status, cand, conf, reason = classify_malidaba_ir_reference(
        "base1",
        baseline_ids={"base1"},
        current_ids={"base1"},
        owner_ids=set(),
        index_ids=set(),
        delta_by_baseline={
            "base1": _delta_row(
                classification="UNCHANGED",
                confidence="STRONG",
                baseline={"ir_id": "base1"},
                current={"ir_id": "base1"},
            )
        },
    )
    assert status == RESOLUTION_STILL
    assert cand == "base1"
    assert conf == "STRONG"
    assert reason is None


def test_renumbered_deterministic_reference_requires_remap():
    status, cand, conf, reason = classify_malidaba_ir_reference(
        "base1",
        baseline_ids={"base1"},
        current_ids={"cur9"},
        owner_ids=set(),
        index_ids=set(),
        delta_by_baseline={
            "base1": _delta_row(
                classification="UNCHANGED",
                confidence="PROVISIONAL",
                baseline={"ir_id": "base1"},
                current={"ir_id": "cur9"},
            )
        },
    )
    assert status == RESOLUTION_REMAP
    assert cand == "cur9"
    assert "remap" in (reason or "")


def test_ambiguous_downstream_reference_blocks():
    status, _, _, reason = classify_malidaba_ir_reference(
        "base1",
        baseline_ids={"base1"},
        current_ids=set(),
        owner_ids=set(),
        index_ids=set(),
        delta_by_baseline={
            "base1": _delta_row(
                classification="IDENTITY_AMBIGUOUS",
                confidence="AMBIGUOUS",
                baseline={"ir_id": "base1"},
                current=None,
            )
        },
    )
    assert status == RESOLUTION_AMBIGUOUS
    assert reason


def test_broken_downstream_reference_blocks():
    status, _, _, reason = classify_malidaba_ir_reference(
        "base1",
        baseline_ids={"base1"},
        current_ids=set(),
        owner_ids=set(),
        index_ids=set(),
        delta_by_baseline={
            "base1": _delta_row(
                classification="MISSING_FROM_CURRENT_SOURCE",
                confidence="UNMATCHED_BASELINE",
                baseline={"ir_id": "base1"},
                current=None,
            )
        },
    )
    assert status == RESOLUTION_BROKEN


def test_owner_reference_not_identity_bound():
    status, _, _, _ = classify_malidaba_ir_reference(
        "owner1",
        baseline_ids=set(),
        current_ids=set(),
        owner_ids={"owner1"},
        index_ids=set(),
        delta_by_baseline={},
    )
    assert status == RESOLUTION_NOT_BOUND


def test_g7_blocks_on_requires_remap(tmp_path: Path):
    paths = _make_paths(tmp_path)
    write_jsonl(paths.baseline_ir, [_ir("base1")])
    write_jsonl(paths.current_ir, [_ir("cur9", sid="e99")])
    write_jsonl(paths.owner_ir, [])
    write_jsonl(paths.index_ir, [])
    write_jsonl(
        paths.aliases,
        [
            {
                "schema_version": "source_alias_table_v1",
                "alias_id": "a1",
                "resolved_ir_ids": ["base1"],
                "evidence_ir_ids": [],
            }
        ],
    )
    write_jsonl(paths.supplements, [])
    write_jsonl(paths.target_variants, [])
    write_jsonl(paths.phrase_review, [])
    paths.search_regression_dir.mkdir(parents=True)
    delta = [
        _delta_row(
            classification="UNCHANGED",
            confidence="PROVISIONAL",
            baseline={"ir_id": "base1", "headword_latin": "demo"},
            current={"ir_id": "cur9", "headword_latin": "demo"},
        )
    ]
    gate, _, counts = evaluate_g7_reference_integrity(paths, delta_rows=delta)
    assert gate.status == "BLOCK"
    assert counts["requires_remap"] == 1
    assert paths.integrity_manifest.is_file()


def test_missing_not_product_visible_passes_destructive():
    row = _delta_row(
        classification="MISSING_FROM_CURRENT_SOURCE",
        confidence="UNMATCHED_BASELINE",
        baseline={"ir_id": "gone1", "headword_latin": "x"},
        current=None,
    )
    disp, _ = classify_missing_baseline_record(
        row, product_visible=set(), current_ids=set()
    )
    assert disp == "NOT_PRODUCT_VISIBLE"


def test_missing_product_visible_blocks_destructive():
    row = _delta_row(
        classification="MISSING_FROM_CURRENT_SOURCE",
        confidence="UNMATCHED_BASELINE",
        baseline={"ir_id": "gone1", "headword_latin": "x"},
        current=None,
    )
    disp, _ = classify_missing_baseline_record(
        row, product_visible={"gone1"}, current_ids=set()
    )
    assert disp == "DESTRUCTIVE_CHANGE_REQUIRES_REVIEW"


def test_ambiguous_missing_blocks_destructive():
    row = _delta_row(
        classification="IDENTITY_AMBIGUOUS",
        confidence="AMBIGUOUS",
        baseline={"ir_id": "a1", "headword_latin": "x"},
        current=None,
    )
    # Force through classifier used for missing list — AMBIGUOUS confidence
    disp, _ = classify_missing_baseline_record(
        row, product_visible=set(), current_ids=set()
    )
    assert disp == "AMBIGUOUS"


def test_g9_blocks_when_product_visible_missing(tmp_path: Path):
    paths = _make_paths(tmp_path)
    write_jsonl(paths.current_ir, [_ir("keep")])
    write_jsonl(paths.canonical_enriched, [_ir("gone1")])
    write_jsonl(paths.aliases, [])
    write_jsonl(paths.supplements, [])
    write_jsonl(paths.target_variants, [])
    write_jsonl(paths.phrase_review, [])
    paths.search_regression_dir.mkdir(parents=True)
    delta = [
        _delta_row(
            classification="MISSING_FROM_CURRENT_SOURCE",
            confidence="UNMATCHED_BASELINE",
            baseline={"ir_id": "gone1", "headword_latin": "x"},
            current=None,
        )
    ]
    gate, _, counts = evaluate_g9_destructive_change(paths, delta_rows=delta)
    assert gate.status == "BLOCK"
    assert counts["destructive_requires_review"] == 1


def test_generic_identity_ambiguity_does_not_itself_block_g9(tmp_path: Path):
    """4234-style AMBIGUOUS matched rows are not missing/destructive inputs."""
    paths = _make_paths(tmp_path)
    write_jsonl(paths.current_ir, [_ir("c1")])
    write_jsonl(paths.canonical_enriched, [])
    write_jsonl(paths.aliases, [])
    write_jsonl(paths.supplements, [])
    write_jsonl(paths.target_variants, [])
    write_jsonl(paths.phrase_review, [])
    paths.search_regression_dir.mkdir(parents=True)
    delta = [
        _delta_row(
            classification="IDENTITY_AMBIGUOUS",
            confidence="AMBIGUOUS",
            baseline={"ir_id": "b1"},
            current=None,
        )
        for _ in range(10)
    ]
    # Only UNMATCHED_BASELINE / MISSING classification enter G9 missing set.
    # Pure ambiguous rows with AMBIGUOUS confidence also match the filter via
    # identity_confidence == UNMATCHED_BASELINE? No — they won't.
    # Ensure G9 only sees empty missing list when no UNMATCHED_BASELINE.
    missing_only = [
        r for r in delta if r["identity_confidence"] == "UNMATCHED_BASELINE"
    ]
    assert missing_only == []
    gate, _, counts = evaluate_g9_destructive_change(paths, delta_rows=delta)
    # Current filter includes identity_confidence == UNMATCHED_BASELINE OR CLASS_MISSING
    # AMBIGUOUS rows have classification IDENTITY_AMBIGUOUS — not included.
    assert counts["missing_evidence_total"] == 0
    assert gate.status == "PASS"


def test_rights_gate(tmp_path: Path):
    from malipense_version_delta.source_refresh.evidence_gates import evaluate_g10_rights

    paths = _make_paths(tmp_path)
    _write_yaml(paths.malipense_yaml)
    gate = evaluate_g10_rights(paths)
    assert gate.status == "PASS"
    assert gate.evidence["commercial_distribution"] == RIGHTS_BLOCKED
    assert gate.evidence["internal_source_maintenance"] == RIGHTS_ALLOWED
    assert gate.evidence["commercial_distribution"] != RIGHTS_ALLOWED


def test_derive_overall_prefers_reference_before_destructive():
    gates = {
        "G1_SOURCE_CAPTURE_VALID": GateResult("G1_SOURCE_CAPTURE_VALID", "PASS"),
        "G2_PARSER_COMPATIBILITY_PASS": GateResult("G2_PARSER_COMPATIBILITY_PASS", "PASS"),
        "G3_BASELINE_REGRESSION_PASS": GateResult("G3_BASELINE_REGRESSION_PASS", "PASS"),
        "G4_CURRENT_STRUCTURAL_COVERAGE_PASS": GateResult(
            "G4_CURRENT_STRUCTURAL_COVERAGE_PASS", "PASS"
        ),
        "G5_DELTA_DETERMINISTIC": GateResult("G5_DELTA_DETERMINISTIC", "PASS"),
        "G6_DELTA_REVIEW_EVIDENCE_SUFFICIENT": GateResult(
            "G6_DELTA_REVIEW_EVIDENCE_SUFFICIENT", "PASS"
        ),
        "G7_DOWNSTREAM_REFERENCE_INTEGRITY_PASS": GateResult(
            "G7_DOWNSTREAM_REFERENCE_INTEGRITY_PASS",
            "BLOCK",
            block_reason="refs",
        ),
        "G8_ISOLATED_BUILD_REGRESSION_PASS": GateResult(
            "G8_ISOLATED_BUILD_REGRESSION_PASS", "PASS"
        ),
        "G9_NO_UNREVIEWED_DESTRUCTIVE_CHANGE": GateResult(
            "G9_NO_UNREVIEWED_DESTRUCTIVE_CHANGE",
            "BLOCK",
            block_reason="destructive",
        ),
        "G10_RIGHTS_POSTURE_RECORDED": GateResult("G10_RIGHTS_POSTURE_RECORDED", "PASS"),
    }
    overall, reasons = derive_overall_decision(gates)
    assert overall == OVERALL_BLOCKED_REFERENCE
    assert any("refs" in r for r in reasons)


def test_deterministic_acceptance_serialization(tmp_path: Path):
    """Acceptance.to_dict is stable under canonical_dumps (no generated_at)."""
    from malipense_version_delta.source_refresh.model import (
        RightsPosture,
        SourceRefreshAcceptance,
    )

    acc = SourceRefreshAcceptance(
        schema_version="malidaba_source_refresh_acceptance_v1",
        base_commit="abc",
        frozen_inputs={"a": 1},
        gates={
            "G1_SOURCE_CAPTURE_VALID": GateResult("G1_SOURCE_CAPTURE_VALID", "PASS")
        },
        review_leaf_counts={},
        reference_integrity_counts={},
        isolated_build={},
        destructive_change_counts={},
        rights_posture=RightsPosture(
            claimed_license="CC BY-NC-SA 4.0",
            internal_source_maintenance="allowed",
            noncommercial_distribution="requires_rights_review",
            commercial_distribution="blocked",
        ),
        overall_decision=OVERALL_ENGINEERING_READY,
        blocking_reasons=[],
        engineering_ready=True,
        publication_authorized=False,
        product_candidates_authorized=False,
    )
    d1 = canonical_dumps(acc.to_dict())
    d2 = canonical_dumps(acc.to_dict())
    assert d1 == d2
    assert "generated_at" not in d1


def test_isolated_build_failure_blocks(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    from malipense_version_delta.source_refresh import isolated_build as ib

    paths = _make_paths(tmp_path)
    write_jsonl(paths.current_ir, [_ir("c1")])
    write_jsonl(paths.index_ir, [])
    write_jsonl(paths.owner_ir, [])
    write_jsonl(paths.aliases, [])

    def boom(*_a, **_k):
        raise RuntimeError("normalize_failed")

    monkeypatch.setattr(ib, "_run_normalize", boom)
    gate = ib.evaluate_g8_isolated_build(paths, skip_heavy_build=False)
    assert gate.status == "BLOCK"
    assert "isolated_build_failure" in (gate.block_reason or "")


def test_no_canonical_writes_from_acceptance_artifact_path(tmp_path: Path):
    paths = _make_paths(tmp_path)
    # Intentionally wrong hashes → early block, still only writes under output_dir
    write_jsonl(paths.baseline_ir, [_ir("a")])
    write_jsonl(paths.current_ir, [_ir("b")])
    write_jsonl(paths.delta, [])
    write_jsonl(paths.review_registry, [])
    _write_yaml(paths.malipense_yaml)
    write_jsonl(paths.owner_ir, [])
    write_jsonl(paths.index_ir, [])
    write_jsonl(paths.aliases, [])
    before = list(tmp_path.rglob("*"))
    evaluate_source_refresh_acceptance(paths, skip_isolated_build=True)
    # Canonical-like paths must remain absent
    assert not (tmp_path / "web" / "public").exists()
    assert paths.acceptance_json.is_file()
    assert paths.acceptance_json.parent == paths.output_dir
