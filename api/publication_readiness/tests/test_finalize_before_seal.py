"""PRODUCT2C-R1: finalize-before-seal and exact-byte coherence tests."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from bundle_builder.build_bundle import sha256_file
from publication_readiness.authorization import build_authorization_worksheet_v2
from publication_readiness.authorization_packet import build_authorization_packet_v2
from publication_readiness.coherence import validate_worksheet_release_coherence
from publication_readiness.freeze import freeze_release_candidate
from publication_readiness.identity import (
    collect_distributed_file_hashes,
    identity_from_frozen_bundle,
    release_artifact_fingerprint_prefix,
)
from publication_readiness.model import (
    DECISION_READY,
    GATE_AWAITING_HUMAN_AUTHORIZATION,
    GATE_PASS,
    STATE_PUBLICATION_READY,
)
from publication_readiness.seal import (
    SealedArtifactMutationError,
    assert_distributed_write_allowed,
    is_sealed,
)
from source_registry.load import SOURCE_MALIPENSE

REPO_ROOT = Path(__file__).resolve().parents[3]


def _write_minimal_payloads(tmp_path: Path) -> tuple[Path, Path]:
    records = tmp_path / "records.jsonl"
    search = tmp_path / "search_index.jsonl"
    records.write_text(
        json.dumps(
            {
                "ir_id": "x",
                "ir_kind": "lexicon_entry",
                "source_id": SOURCE_MALIPENSE,
                "norm_version": "norm_v1",
                "record_locator": {"k": 1},
            }
        )
        + "\n",
        encoding="utf-8",
    )
    search.write_text(
        json.dumps({"key_type": "casefold", "key": "a", "ir_ids": ["x"]}) + "\n",
        encoding="utf-8",
    )
    return records, search


def _all_pass_gates() -> dict[str, str]:
    return {
        "P1_CANDIDATE_REPRODUCIBLE": GATE_PASS,
        "P2_BUNDLE_INTEGRITY": GATE_PASS,
        "P3_RIGHTS_COMPLIANCE": GATE_PASS,
        "P4_PROVENANCE_COMPLETE": GATE_PASS,
        "P5_OFFLINE_INSTALL": GATE_PASS,
        "P6_SEARCH_VALIDATION": GATE_PASS,
        "P7_USER_CREDITS": GATE_PASS,
        "P8_CATALOG_COMPATIBILITY": GATE_PASS,
        "P9_ROLLBACK_DESIGN": GATE_PASS,
        "P10_PUBLICATION_AUTHORIZATION_NOT_YET_GRANTED": GATE_AWAITING_HUMAN_AUTHORIZATION,
    }


def test_freeze_finalizes_publication_ready_before_seal(tmp_path):
    records, search = _write_minimal_payloads(tmp_path)
    frozen = freeze_release_candidate(
        repo_root=REPO_ROOT,
        records_path=records,
        search_index_path=search,
        output_parent=tmp_path / "frozen",
        source_ids=[SOURCE_MALIPENSE],
        publication_state=STATE_PUBLICATION_READY,
    )
    bundle_dir = Path(frozen["bundle_dir"])
    assert frozen["sealed"] is True
    assert is_sealed(bundle_dir)
    manifest = json.loads((bundle_dir / "bundle.manifest.json").read_text(encoding="utf-8"))
    assert manifest["publication"]["publication_state"] == STATE_PUBLICATION_READY
    assert manifest["publication"]["publication_authorized"] is False
    prefix = release_artifact_fingerprint_prefix(frozen["release_artifact_fingerprint"])
    assert bundle_dir.name.endswith(f"__{prefix}")
    assert frozen["release_artifact_dir_name"] == bundle_dir.name


def test_no_post_seal_manifest_mutation_reproduces_previous_bug(tmp_path):
    """Previous defect: worksheet written, then manifest mutated → mismatch."""
    records, search = _write_minimal_payloads(tmp_path)
    frozen = freeze_release_candidate(
        repo_root=REPO_ROOT,
        records_path=records,
        search_index_path=search,
        output_parent=tmp_path / "frozen",
        source_ids=[SOURCE_MALIPENSE],
        publication_state=STATE_PUBLICATION_READY,
    )
    bundle_dir = Path(frozen["bundle_dir"])
    manifest_before = sha256_file(bundle_dir / "bundle.manifest.json")
    fp_before = frozen["release_artifact_fingerprint"]

    worksheet = build_authorization_worksheet_v2(
        semantic_bundle_id=frozen["semantic_bundle_id"],
        semantic_content_sha256=frozen["semantic_content_sha256"],
        semantic_candidate_fingerprint=frozen["semantic_candidate_fingerprint"],
        release_artifact_fingerprint=fp_before,
        release_artifact_dir_name=frozen["release_artifact_dir_name"],
        distributed_file_hashes=frozen["file_hashes"],
        counts={
            "records": 22199,
            "lexicon_entries": 11694,
            "headwords": 10148,
            "search_keys": 174700,
        },
        rights_summary={"owner_rows_included": 0},
        product1b_checks={f"C{i}": GATE_PASS for i in range(1, 9)},
        publication_readiness_decision=DECISION_READY,
        internal_full_regression={"pass": 30, "fail": 0},
        publication_candidate_regression={
            "pass": 26,
            "expected_owner_rights_exclusion": 4,
            "unexpected_defects": 0,
        },
        p_gates=_all_pass_gates(),
    )

    # Simulate evaluation completing without mutating sealed bytes.
    manifest_after = sha256_file(bundle_dir / "bundle.manifest.json")
    fp_after = identity_from_frozen_bundle(bundle_dir)["release_artifact_fingerprint"]
    assert manifest_before == manifest_after
    assert fp_before == fp_after
    assert release_artifact_fingerprint_prefix(fp_after) == bundle_dir.name.split("__", 1)[1]

    coherence = validate_worksheet_release_coherence(
        sealed_bundle_dir=bundle_dir, worksheet=worksheet
    )
    assert coherence["status"] == "PASS"
    assert coherence["distributed_hashes_matched"] == "6/6"


def test_post_seal_write_rejected(tmp_path):
    records, search = _write_minimal_payloads(tmp_path)
    frozen = freeze_release_candidate(
        repo_root=REPO_ROOT,
        records_path=records,
        search_index_path=search,
        output_parent=tmp_path / "frozen",
        source_ids=[SOURCE_MALIPENSE],
        publication_state=STATE_PUBLICATION_READY,
    )
    bundle_dir = Path(frozen["bundle_dir"])
    with pytest.raises(SealedArtifactMutationError):
        assert_distributed_write_allowed(bundle_dir, "bundle.manifest.json")


def test_same_sealed_bytes_same_release_fingerprint(tmp_path):
    records, search = _write_minimal_payloads(tmp_path)
    a = freeze_release_candidate(
        repo_root=REPO_ROOT,
        records_path=records,
        search_index_path=search,
        output_parent=tmp_path / "a",
        source_ids=[SOURCE_MALIPENSE],
        publication_state=STATE_PUBLICATION_READY,
    )
    b = freeze_release_candidate(
        repo_root=REPO_ROOT,
        records_path=records,
        search_index_path=search,
        output_parent=tmp_path / "b",
        source_ids=[SOURCE_MALIPENSE],
        publication_state=STATE_PUBLICATION_READY,
    )
    assert a["release_artifact_fingerprint"] == b["release_artifact_fingerprint"]
    assert a["file_hashes"] == b["file_hashes"]


def test_coherence_fails_when_worksheet_hashes_stale(tmp_path):
    records, search = _write_minimal_payloads(tmp_path)
    frozen = freeze_release_candidate(
        repo_root=REPO_ROOT,
        records_path=records,
        search_index_path=search,
        output_parent=tmp_path / "frozen",
        source_ids=[SOURCE_MALIPENSE],
        publication_state=STATE_PUBLICATION_READY,
    )
    bundle_dir = Path(frozen["bundle_dir"])
    stale_hashes = dict(frozen["file_hashes"])
    stale_hashes["bundle.manifest.json"] = "sha256:" + "0" * 64
    worksheet = build_authorization_worksheet_v2(
        semantic_bundle_id=frozen["semantic_bundle_id"],
        semantic_content_sha256=frozen["semantic_content_sha256"],
        semantic_candidate_fingerprint=frozen["semantic_candidate_fingerprint"],
        release_artifact_fingerprint=frozen["release_artifact_fingerprint"],
        release_artifact_dir_name=frozen["release_artifact_dir_name"],
        distributed_file_hashes=stale_hashes,
        counts={
            "records": 22199,
            "lexicon_entries": 11694,
            "headwords": 10148,
            "search_keys": 174700,
        },
        rights_summary={"owner_rows_included": 0},
        product1b_checks={f"C{i}": GATE_PASS for i in range(1, 9)},
        publication_readiness_decision=DECISION_READY,
        internal_full_regression={"pass": 30, "fail": 0},
        publication_candidate_regression={
            "pass": 26,
            "expected_owner_rights_exclusion": 4,
            "unexpected_defects": 0,
        },
        p_gates=_all_pass_gates(),
    )
    coherence = validate_worksheet_release_coherence(
        sealed_bundle_dir=bundle_dir, worksheet=worksheet
    )
    assert coherence["status"] == "FAIL"
    packet = build_authorization_packet_v2(
        coherence=coherence,
        worksheet=worksheet,
        publication_receipt={"current_published_bundle_id": "bundle_full_20260710_337619ff"},
        head_commit="test",
    )
    assert packet["decision"] == "PRODUCT2C_PUBLICATION_AUTHORIZATION_PACKET_BLOCKED"
    assert packet["exact_authorization_statement"] is None


def test_packet_ready_only_when_coherent(tmp_path):
    records, search = _write_minimal_payloads(tmp_path)
    frozen = freeze_release_candidate(
        repo_root=REPO_ROOT,
        records_path=records,
        search_index_path=search,
        output_parent=tmp_path / "frozen",
        source_ids=[SOURCE_MALIPENSE],
        publication_state=STATE_PUBLICATION_READY,
    )
    bundle_dir = Path(frozen["bundle_dir"])
    worksheet = build_authorization_worksheet_v2(
        semantic_bundle_id=frozen["semantic_bundle_id"],
        semantic_content_sha256=frozen["semantic_content_sha256"],
        semantic_candidate_fingerprint=frozen["semantic_candidate_fingerprint"],
        release_artifact_fingerprint=frozen["release_artifact_fingerprint"],
        release_artifact_dir_name=frozen["release_artifact_dir_name"],
        distributed_file_hashes=collect_distributed_file_hashes(bundle_dir),
        counts={
            "records": 22199,
            "lexicon_entries": 11694,
            "headwords": 10148,
            "search_keys": 174700,
        },
        rights_summary={"owner_rows_included": 0},
        product1b_checks={f"C{i}": GATE_PASS for i in range(1, 9)},
        publication_readiness_decision=DECISION_READY,
        internal_full_regression={"pass": 30, "fail": 0},
        publication_candidate_regression={
            "pass": 26,
            "expected_owner_rights_exclusion": 4,
            "unexpected_defects": 0,
        },
        p_gates=_all_pass_gates(),
    )
    coherence = validate_worksheet_release_coherence(
        sealed_bundle_dir=bundle_dir, worksheet=worksheet
    )
    assert coherence["status"] == "PASS"
    packet = build_authorization_packet_v2(
        coherence=coherence,
        worksheet=worksheet,
        publication_receipt={"current_published_bundle_id": "bundle_full_20260710_337619ff"},
        head_commit="test",
    )
    assert packet["decision"] == "PRODUCT2C_PUBLICATION_AUTHORIZATION_PACKET_READY"
    assert frozen["release_artifact_fingerprint"] in (
        packet["exact_authorization_statement"] or ""
    )
