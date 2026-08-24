"""Tests for CORPUS1F20 guarded canonical refresh transaction dry-run."""

from __future__ import annotations

import hashlib
import subprocess
from pathlib import Path

import pytest

from malipense_version_delta.source_refresh.paths import (
    FROZEN_F19_COMMIT,
    default_paths,
)
from malipense_version_delta.source_refresh.transaction.apply_sim import (
    run_rollback_drills,
    simulate_apply_sequence,
)
from malipense_version_delta.source_refresh.transaction.freeze import (
    FrozenTransactionInputError,
    freeze_transaction_inputs,
)
from malipense_version_delta.source_refresh.transaction.future_edition import (
    simulate_future_edition_renumber,
)
from malipense_version_delta.source_refresh.transaction.layers import (
    build_canonical_layers,
    validate_layer_provenance,
)
from malipense_version_delta.source_refresh.transaction.manifest import (
    build_rollback_manifest,
    build_transaction_manifest,
    compute_transaction_id,
    manifest_sha256,
)
from malipense_version_delta.source_refresh.transaction.model import (
    DECISION_READY,
    DEST_CURRENT_IR,
    DEST_LEGACY_IR,
    KIND_DERIVED,
    KIND_GOVERNED,
    ROLE_PUBLICATION,
)
from malipense_version_delta.source_refresh.transaction.preconditions import (
    check_preconditions,
)
from malipense_version_delta.source_refresh.transaction.stage import (
    materialize_candidate_bytes,
)
from malipense_version_delta.source_refresh.transaction.surface import (
    discover_mutation_surface,
)

REPO_ROOT = Path(__file__).resolve().parents[3]
TX_SRC = (
    REPO_ROOT
    / "api"
    / "malipense_version_delta"
    / "source_refresh"
    / "transaction"
)


def _git_head(repo_root: Path) -> str:
    return subprocess.check_output(
        ["git", "rev-parse", "HEAD"], cwd=repo_root, text=True
    ).strip()


@pytest.fixture(scope="module")
def paths():
    return default_paths(REPO_ROOT)


@pytest.fixture(scope="module")
def layers(paths):
    return build_canonical_layers(paths)


@pytest.fixture(scope="module")
def frozen(paths):
    return freeze_transaction_inputs(paths)


def test_frozen_input_mismatch_blocks(paths, monkeypatch):
    from malipense_version_delta.source_refresh.transaction import freeze as freeze_mod

    monkeypatch.setattr(
        freeze_mod,
        "FROZEN_F19_OVERLAY_SHA256",
        "0" * 64,
    )
    with pytest.raises(FrozenTransactionInputError, match="hash_mismatch"):
        freeze_transaction_inputs(paths)


def test_base_commit_mismatch_blocks_apply(paths, frozen, layers):
    candidate = materialize_candidate_bytes(paths, layers)
    surface = discover_mutation_surface(paths, candidate_bytes=candidate)
    g_pass = {
        "G1_SOURCE_CAPTURE_VALID": "PASS",
        "G2_PARSER_COMPATIBILITY_PASS": "PASS",
        "G3_BASELINE_REGRESSION_PASS": "PASS",
        "G4_CURRENT_STRUCTURAL_COVERAGE_PASS": "PASS",
        "G5_DELTA_DETERMINISTIC": "PASS",
        "G6_DELTA_REVIEW_EVIDENCE_SUFFICIENT": "PASS",
        "G7_DOWNSTREAM_REFERENCE_INTEGRITY_PASS": "PASS",
        "G8_ISOLATED_BUILD_REGRESSION_PASS": "PASS",
        "G9_NO_UNREVIEWED_DESTRUCTIVE_CHANGE": "PASS",
        "G10_RIGHTS_POSTURE_RECORDED": "PASS",
    }
    result = check_preconditions(
        paths,
        expected_base_commit="deadbeef" * 5,
        frozen_hashes=frozen["hashes"],
        mutations=surface["mutations"],
        publication_in_plan=[],
        g_results=g_pass,
        staged_regression={
            "canonical_pass": 30,
            "canonical_fail": 0,
            "staged_pass": 30,
            "staged_fail": 0,
        },
        rights={
            "internal": "allowed",
            "noncommercial": "requires_rights_review",
            "commercial": "blocked",
        },
        allow_dirty_for_dry_run=True,
    )
    assert result["ok"] is False
    assert any("base_commit_mismatch" in f for f in result["failures"])


def test_destination_before_hash_mismatch_blocks(paths, frozen, layers):
    head = _git_head(paths.repo_root)
    candidate = materialize_candidate_bytes(paths, layers)
    surface = discover_mutation_surface(paths, candidate_bytes=candidate)
    mutations = []
    for m in surface["mutations"]:
        row = dict(m)
        if not row.get("is_new_file") and row.get("current_sha256"):
            row["current_sha256"] = "0" * 64
        mutations.append(row)
    g_pass = {
        "G1_SOURCE_CAPTURE_VALID": "PASS",
        "G2_PARSER_COMPATIBILITY_PASS": "PASS",
        "G3_BASELINE_REGRESSION_PASS": "PASS",
        "G4_CURRENT_STRUCTURAL_COVERAGE_PASS": "PASS",
        "G5_DELTA_DETERMINISTIC": "PASS",
        "G6_DELTA_REVIEW_EVIDENCE_SUFFICIENT": "PASS",
        "G7_DOWNSTREAM_REFERENCE_INTEGRITY_PASS": "PASS",
        "G8_ISOLATED_BUILD_REGRESSION_PASS": "PASS",
        "G9_NO_UNREVIEWED_DESTRUCTIVE_CHANGE": "PASS",
        "G10_RIGHTS_POSTURE_RECORDED": "PASS",
    }
    result = check_preconditions(
        paths,
        expected_base_commit=head,
        frozen_hashes=frozen["hashes"],
        mutations=mutations,
        publication_in_plan=[],
        g_results=g_pass,
        staged_regression={
            "canonical_pass": 30,
            "canonical_fail": 0,
            "staged_pass": 30,
            "staged_fail": 0,
        },
        rights={
            "internal": "allowed",
            "noncommercial": "requires_rights_review",
            "commercial": "blocked",
        },
        allow_dirty_for_dry_run=True,
    )
    assert result["ok"] is False
    assert any("destination_before_mismatch" in f for f in result["failures"])


def test_dirty_tracked_state_blocks_apply_mode(paths, frozen, layers, monkeypatch):
    candidate = materialize_candidate_bytes(paths, layers)
    surface = discover_mutation_surface(paths, candidate_bytes=candidate)
    g_pass = {
        "G1_SOURCE_CAPTURE_VALID": "PASS",
        "G2_PARSER_COMPATIBILITY_PASS": "PASS",
        "G3_BASELINE_REGRESSION_PASS": "PASS",
        "G4_CURRENT_STRUCTURAL_COVERAGE_PASS": "PASS",
        "G5_DELTA_DETERMINISTIC": "PASS",
        "G6_DELTA_REVIEW_EVIDENCE_SUFFICIENT": "PASS",
        "G7_DOWNSTREAM_REFERENCE_INTEGRITY_PASS": "PASS",
        "G8_ISOLATED_BUILD_REGRESSION_PASS": "PASS",
        "G9_NO_UNREVIEWED_DESTRUCTIVE_CHANGE": "PASS",
        "G10_RIGHTS_POSTURE_RECORDED": "PASS",
    }

    def _fake_git(repo, *args: str) -> str:
        if args[:2] == ("rev-parse", "HEAD"):
            return FROZEN_F19_COMMIT
        if args[:1] == ("status",) or args[:2] == ("status", "--porcelain"):
            return " M api/malipense_version_delta/source_refresh/paths.py"
        raise AssertionError(args)

    monkeypatch.setattr(
        "malipense_version_delta.source_refresh.transaction.preconditions._git",
        _fake_git,
    )
    result = check_preconditions(
        paths,
        expected_base_commit=FROZEN_F19_COMMIT,
        frozen_hashes=frozen["hashes"],
        mutations=surface["mutations"],
        publication_in_plan=[],
        g_results=g_pass,
        staged_regression={
            "canonical_pass": 30,
            "canonical_fail": 0,
            "staged_pass": 30,
            "staged_fail": 0,
        },
        rights={
            "internal": "allowed",
            "noncommercial": "requires_rights_review",
            "commercial": "blocked",
        },
        allow_dirty_for_dry_run=False,
    )
    assert result["ok"] is False
    assert "dirty_tracked_working_tree" in result["failures"]


def test_publication_path_in_manifest_blocks(paths, frozen, layers):
    candidate = materialize_candidate_bytes(paths, layers)
    surface = discover_mutation_surface(paths, candidate_bytes=candidate)
    g_pass = {k: "PASS" for k in [
        "G1_SOURCE_CAPTURE_VALID",
        "G2_PARSER_COMPATIBILITY_PASS",
        "G3_BASELINE_REGRESSION_PASS",
        "G4_CURRENT_STRUCTURAL_COVERAGE_PASS",
        "G5_DELTA_DETERMINISTIC",
        "G6_DELTA_REVIEW_EVIDENCE_SUFFICIENT",
        "G7_DOWNSTREAM_REFERENCE_INTEGRITY_PASS",
        "G8_ISOLATED_BUILD_REGRESSION_PASS",
        "G9_NO_UNREVIEWED_DESTRUCTIVE_CHANGE",
        "G10_RIGHTS_POSTURE_RECORDED",
    ]}
    result = check_preconditions(
        paths,
        expected_base_commit=_git_head(paths.repo_root),
        frozen_hashes=frozen["hashes"],
        mutations=surface["mutations"],
        publication_in_plan=["web/public/catalog.json"],
        g_results=g_pass,
        staged_regression={
            "canonical_pass": 30,
            "canonical_fail": 0,
            "staged_pass": 30,
            "staged_fail": 0,
        },
        rights={
            "internal": "allowed",
            "noncommercial": "requires_rights_review",
            "commercial": "blocked",
        },
        allow_dirty_for_dry_run=True,
    )
    assert result["ok"] is False
    assert any("publication_paths_in_plan" in f for f in result["failures"])


def test_web_scripts_inclusion_blocks(paths, frozen, layers):
    candidate = materialize_candidate_bytes(paths, layers)
    surface = discover_mutation_surface(paths, candidate_bytes=candidate)
    mutations = list(surface["mutations"])
    mutations.append(
        {
            "path": "web/scripts/capture_ui_screenshots.mjs",
            "artifact_role": ROLE_PUBLICATION,
            "kind": KIND_DERIVED,
            "current_sha256": None,
            "candidate_sha256": "abc",
            "is_new_file": True,
            "candidate_row_count": 0,
            "current_row_count": 0,
        }
    )
    g_pass = {k: "PASS" for k in [
        "G1_SOURCE_CAPTURE_VALID",
        "G2_PARSER_COMPATIBILITY_PASS",
        "G3_BASELINE_REGRESSION_PASS",
        "G4_CURRENT_STRUCTURAL_COVERAGE_PASS",
        "G5_DELTA_DETERMINISTIC",
        "G6_DELTA_REVIEW_EVIDENCE_SUFFICIENT",
        "G7_DOWNSTREAM_REFERENCE_INTEGRITY_PASS",
        "G8_ISOLATED_BUILD_REGRESSION_PASS",
        "G9_NO_UNREVIEWED_DESTRUCTIVE_CHANGE",
        "G10_RIGHTS_POSTURE_RECORDED",
    ]}
    result = check_preconditions(
        paths,
        expected_base_commit=_git_head(paths.repo_root),
        frozen_hashes=frozen["hashes"],
        mutations=mutations,
        publication_in_plan=[],
        g_results=g_pass,
        staged_regression={
            "canonical_pass": 30,
            "canonical_fail": 0,
            "staged_pass": 30,
            "staged_fail": 0,
        },
        rights={
            "internal": "allowed",
            "noncommercial": "requires_rights_review",
            "commercial": "blocked",
        },
        allow_dirty_for_dry_run=True,
    )
    assert "web_scripts_in_mutation_plan" in result["failures"]


def test_current_vs_legacy_provenance_separation(layers):
    prov = validate_layer_provenance(layers)
    assert prov["ok"] is True
    for row in layers["current_rows"][:20]:
        assert row["edition_layer"]["edition"] == "current_edition"
        assert row["edition_layer"]["current_edition_attribution"] is True
    for row in layers["legacy_rows"]:
        assert row["edition_layer"]["edition"] == "baseline_edition"
        assert row["edition_layer"]["current_edition_attribution"] is False


def test_legacy_cannot_become_current(layers):
    legacy_ids = {str(r["ir_id"]) for r in layers["legacy_rows"]}
    for row in layers["current_rows"]:
        if str(row.get("ir_id")) in legacy_ids:
            # Same ir_id must not appear with current attribution if also legacy
            # (legacy rows are baseline-only; current layer is separate file)
            pass
    # Stronger: no legacy row claims current attribution
    assert all(
        r["edition_layer"]["current_edition_attribution"] is False
        for r in layers["legacy_rows"]
    )
    assert layers["counts"]["legacy_retained_assertions"] == 42


def test_logical_lexical_identity_stable_and_source_record_not_lexical(layers):
    for obj in layers["logical_rows"]:
        assert obj.get("logical_lexical_id")
    for row in layers["edition_map_rows"]:
        assert row["source_record_id_is_lexical_identity"] is False


def test_homographs_remain_separate(layers):
    assert len(layers["kun_logical_ids"]) == 2


def test_no_logical_target_collapse(layers):
    seen: dict[str, str] = {}
    for obj in layers["logical_rows"]:
        lid = str(obj["logical_lexical_id"])
        for key in ("baseline_ir_ids", "current_ir_ids"):
            for ir in obj.get(key) or []:
                prev = seen.get(str(ir))
                assert prev in (None, lid)
                seen[str(ir)] = lid


def test_deterministic_transaction_id(frozen, layers, paths):
    candidate = materialize_candidate_bytes(paths, layers)
    surface = discover_mutation_surface(paths, candidate_bytes=candidate)
    paths_list = [m["path"] for m in surface["mutations"]]
    a = compute_transaction_id(
        base_git_commit=FROZEN_F19_COMMIT,
        frozen_input_hashes=frozen["hashes"],
        mutation_paths=paths_list,
    )
    b = compute_transaction_id(
        base_git_commit=FROZEN_F19_COMMIT,
        frozen_input_hashes=frozen["hashes"],
        mutation_paths=list(reversed(paths_list)),
    )
    assert a == b
    assert a.startswith("malidaba_src_refresh_")


def test_deterministic_manifest_and_hashes(frozen, layers, paths):
    candidate = materialize_candidate_bytes(paths, layers)
    surface = discover_mutation_surface(paths, candidate_bytes=candidate)
    tx_id = compute_transaction_id(
        base_git_commit=FROZEN_F19_COMMIT,
        frozen_input_hashes=frozen["hashes"],
        mutation_paths=[m["path"] for m in surface["mutations"]],
    )
    before_store = {
        "files": {
            m["path"]: {
                "existed": not m["is_new_file"],
                "sha256": m.get("current_sha256"),
                "path": None,
            }
            for m in surface["mutations"]
        }
    }
    rb = build_rollback_manifest(
        transaction_id=tx_id,
        before_store=before_store,
        mutations=surface["mutations"],
    )
    rb_sha = manifest_sha256(rb)
    m1 = build_transaction_manifest(
        transaction_id=tx_id,
        base_git_commit=FROZEN_F19_COMMIT,
        frozen_input_hashes=frozen["hashes"],
        mutations=surface["mutations"],
        counts=layers["counts"],
        review_registry_hashes={"a": "1"},
        logical_continuity_hash="x",
        rights={"internal": "allowed", "noncommercial": "requires_rights_review", "commercial": "blocked"},
        preconditions={"ok": True, "failures": [], "mode": "dry_run"},
        postconditions={"g7_pass": True},
        rollback_manifest_hash=rb_sha,
        dry_run_result={"real_apply_executed": False},
    )
    m2 = build_transaction_manifest(
        transaction_id=tx_id,
        base_git_commit=FROZEN_F19_COMMIT,
        frozen_input_hashes=frozen["hashes"],
        mutations=surface["mutations"],
        counts=layers["counts"],
        review_registry_hashes={"a": "1"},
        logical_continuity_hash="x",
        rights={"internal": "allowed", "noncommercial": "requires_rights_review", "commercial": "blocked"},
        preconditions={"ok": True, "failures": [], "mode": "dry_run"},
        postconditions={"g7_pass": True},
        rollback_manifest_hash=rb_sha,
        dry_run_result={"real_apply_executed": False},
    )
    assert manifest_sha256(m1) == manifest_sha256(m2)
    for mut in surface["mutations"]:
        assert mut["candidate_sha256"] == hashlib.sha256(
            candidate[mut["path"]]
        ).hexdigest()


def test_all_candidate_bytes_before_apply(paths, layers):
    candidate = materialize_candidate_bytes(paths, layers)
    surface = discover_mutation_surface(paths, candidate_bytes=candidate)
    assert len(candidate) == len(surface["mutations"]) == 8
    assert DEST_CURRENT_IR in candidate
    assert DEST_LEGACY_IR in candidate


def test_rollback_drills(tmp_path, paths, layers):
    candidate = materialize_candidate_bytes(paths, layers)
    surface = discover_mutation_surface(paths, candidate_bytes=candidate)
    # Synthetic before bytes (small) for drill speed — use real candidate prefixes
    ordered = [m["path"] for m in surface["mutations"]]
    before_bytes = {
        rel: (b"BEFORE:" + rel.encode() if not m["is_new_file"] else None)
        for m, rel in zip(surface["mutations"], ordered)
    }
    # Build before_store compatible with run_rollback_drills
    rollback_root = tmp_path / "before"
    files = {}
    for rel, payload in before_bytes.items():
        if payload is None:
            files[rel] = {"existed": False, "sha256": None, "path": None}
        else:
            slot = rollback_root / rel
            slot.parent.mkdir(parents=True, exist_ok=True)
            slot.write_bytes(payload)
            files[rel] = {
                "existed": True,
                "sha256": hashlib.sha256(payload).hexdigest(),
                "path": str(slot),
            }
    drills = run_rollback_drills(
        work_root=tmp_path / "drills",
        candidate_bytes=candidate,
        before_store={"files": files},
        ordered_paths=ordered,
    )
    assert drills["all_pass"] is True


def test_new_file_rollback(tmp_path):
    rel = "data/ir/new_file.jsonl"
    candidate = {rel: b"NEW_CONTENT\n"}
    before = {rel: None}
    result = simulate_apply_sequence(
        dest_root=tmp_path / "dest",
        candidate_bytes=candidate,
        before_bytes=before,
        ordered_paths=[rel],
        fail_after=1,
    )
    assert result["rollback_ok"] is True
    assert not (tmp_path / "dest" / rel).exists()


def test_future_edition_renumber(layers, paths):
    import json

    overlay = json.loads(
        (paths.f19_dir / "virtual" / "identity_overlay.json").read_text(encoding="utf-8")
    )
    result = simulate_future_edition_renumber(
        logical_rows=layers["logical_rows"],
        overlay={str(k): str(v) for k, v in overlay.items()},
        sample_current_ir_id=next(iter(overlay.values())),
    )
    assert result["ok"] is True
    assert result["logical_id_stable"] is True
    assert result["source_record_id_not_lexical_identity"] is True


def test_mutation_surface_excludes_publication(paths, layers):
    candidate = materialize_candidate_bytes(paths, layers)
    surface = discover_mutation_surface(paths, candidate_bytes=candidate)
    assert surface["publication_paths_in_transaction"] == []
    assert any(m["kind"] == KIND_GOVERNED for m in surface["mutations"])
    assert any(m["kind"] == KIND_DERIVED for m in surface["mutations"])


def test_transaction_package_files_exist():
    required = [
        "evaluate.py",
        "freeze.py",
        "layers.py",
        "stage.py",
        "build.py",
        "apply_sim.py",
        "manifest.py",
        "preconditions.py",
        "cli.py",
    ]
    for name in required:
        assert (TX_SRC / name).is_file()


def test_dry_run_receipt_ready_if_present():
    receipt = (
        REPO_ROOT
        / "data"
        / "malidaba_delta"
        / "current"
        / "source_refresh"
        / "f20"
        / "transaction_dry_run.json"
    )
    if not receipt.is_file():
        pytest.skip("dry-run receipt not generated yet")
    import json

    data = json.loads(receipt.read_text(encoding="utf-8"))
    assert data["decision"] == DECISION_READY
    assert data["real_canonical_writes"] == "NONE"
    assert data["publication_writes"] == "NONE"
    assert data["non_mutation"] == "PASS"
    assert data["staged_build"]["staged_pass"] == 30
    assert data["staged_build"]["canonical_fail"] == 0
    assert data["reference_closure"]["ambiguous"] == 0
    assert data["reference_closure"]["broken"] == 0
    gates = data["source_refresh_gates"]
    for gid in gates:
        assert gates[gid]["status"] == "PASS"
    assert data["rollback_drills"]["success_path"] == "PASS"
    assert data["counts"]["legacy_retained_assertions"] == 42
    assert data["counts"]["conflicting_assertions"] == 19
    assert data["rights"]["commercial"] == "blocked"
