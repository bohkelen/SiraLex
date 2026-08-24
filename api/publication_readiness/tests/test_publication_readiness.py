"""Tests for PRODUCT2 publication readiness and catalog boundary."""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest

from bundle_builder.build_bundle import build_bundle, sha256_file, verify_bundle
from distribution_compliance.manifest import enrich_manifest_with_licenses
from publication_readiness.authorization import (
    AUTHORIZATION_V1_SUPERSEDED_STATUS,
    build_authorization_worksheet_v2,
    validate_authorization_binds_bytes,
    validate_authorization_v2_binds_bytes,
)
from publication_readiness.catalog import (
    design_publication_transaction,
    design_rollback_semantics,
    validate_catalog_schema,
)
from publication_readiness.checksum_closure import audit_checksum_closure
from publication_readiness.identity import (
    compute_release_artifact_fingerprint,
    compute_semantic_candidate_fingerprint,
    deterministic_release_bundle_id,
    identity_from_frozen_bundle,
    identity_from_manifest_files,
    release_artifact_dir_name,
    release_candidate_fingerprint,
    semantic_artifact_dir_name,
)
from publication_readiness.model import (
    DECISION_READY,
    GATE_AWAITING_HUMAN_AUTHORIZATION,
    GATE_PASS,
    PRODUCT2_ALLOWED_TARGET_STATES,
    STATE_PUBLICATION_AUTHORIZED,
    STATE_PUBLISHED,
    STATE_PUBLICATION_READY,
)
from publication_readiness.rights_leakage import audit_rights_leakage
from source_registry.load import LICENSE_CC_BY_NC_SA, SOURCE_MALIPENSE, SOURCE_OWNER, load_source_registry

REPO_ROOT = Path(__file__).resolve().parents[3]


def _build_minimal_bundle(tmp_path: Path) -> Path:
    norm = tmp_path / "records.jsonl"
    idx = tmp_path / "search_index.jsonl"
    norm.write_text(
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
    idx.write_text(
        json.dumps({"key_type": "casefold", "key": "a", "ir_ids": ["x"]}) + "\n",
        encoding="utf-8",
    )
    out = tmp_path / "out"
    out.mkdir()
    build_result = build_bundle(
        norm,
        idx,
        out,
        sources_included=[SOURCE_MALIPENSE],
        license_enrichment=True,
        repo_root=REPO_ROOT,
        versioned_output=False,
    )
    built = Path(build_result["bundle_dir"])
    (built / "ATTRIBUTION.txt").write_text("attr\n", encoding="utf-8")
    (built / "DATA_LICENSES.md").write_text("# licenses\n", encoding="utf-8")
    return built


def _clone_bundle(src: Path, dest: Path) -> Path:
    shutil.copytree(src, dest)
    return dest


def _refresh_manifest_payload_hashes(bundle_dir: Path) -> None:
    manifest_path = bundle_dir / "bundle.manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    files = []
    for name in ("records.jsonl", "search_index.jsonl"):
        path = bundle_dir / name
        files.append(
            {
                "path": name,
                "byte_length": path.stat().st_size,
                "sha256": sha256_file(path),
            }
        )
    manifest["files"] = files
    manifest_path.write_text(json.dumps(manifest, sort_keys=True) + "\n", encoding="utf-8")


@pytest.fixture
def registry():
    return load_source_registry(REPO_ROOT)


def test_publication_state_model_excludes_authorized_and_published():
    assert STATE_PUBLICATION_AUTHORIZED not in PRODUCT2_ALLOWED_TARGET_STATES
    assert STATE_PUBLISHED not in PRODUCT2_ALLOWED_TARGET_STATES
    assert STATE_PUBLICATION_READY in PRODUCT2_ALLOWED_TARGET_STATES


def test_deterministic_bundle_identity_stable(registry, tmp_path):
    norm = tmp_path / "records.jsonl"
    idx = tmp_path / "search_index.jsonl"
    row = {
        "ir_id": "abc",
        "ir_kind": "lexicon_entry",
        "source_id": SOURCE_MALIPENSE,
        "norm_version": "norm_v1",
        "preferred_form": "test",
        "record_locator": {"kind": "anchor"},
    }
    norm.write_text(json.dumps(row) + "\n", encoding="utf-8")
    idx.write_text(
        json.dumps({"key_type": "casefold", "key": "test", "ir_ids": ["abc"]}) + "\n",
        encoding="utf-8",
    )
    out = tmp_path / "out"
    out.mkdir()
    r1 = build_bundle(norm, idx, out / "a", versioned_output=False)
    r2 = build_bundle(norm, idx, out / "b", versioned_output=False)
    assert r1["content_sha256"] == r2["content_sha256"]
    bid = deterministic_release_bundle_id(r1["content_sha256"])
    assert bid == deterministic_release_bundle_id(r2["content_sha256"])


def test_changed_bytes_change_bundle_identity(registry, tmp_path):
    norm1 = tmp_path / "r1.jsonl"
    norm2 = tmp_path / "r2.jsonl"
    idx = tmp_path / "search_index.jsonl"
    base = {
        "ir_id": "abc",
        "ir_kind": "lexicon_entry",
        "source_id": SOURCE_MALIPENSE,
        "norm_version": "norm_v1",
        "preferred_form": "test",
        "record_locator": {"kind": "anchor"},
    }
    norm1.write_text(json.dumps(base) + "\n", encoding="utf-8")
    changed = dict(base)
    changed["preferred_form"] = "other"
    norm2.write_text(json.dumps(changed) + "\n", encoding="utf-8")
    idx.write_text(
        json.dumps({"key_type": "casefold", "key": "test", "ir_ids": ["abc"]}) + "\n",
        encoding="utf-8",
    )
    out = tmp_path / "out"
    out.mkdir()
    h1 = build_bundle(norm1, idx, out / "a", versioned_output=False)["content_sha256"]
    h2 = build_bundle(norm2, idx, out / "b", versioned_output=False)["content_sha256"]
    assert h1 != h2
    assert deterministic_release_bundle_id(h1) != deterministic_release_bundle_id(h2)


def test_checksum_closure_passes_minimal_bundle(registry, tmp_path):
    bundle = tmp_path / "bundle"
    bundle.mkdir()
    norm = tmp_path / "records.jsonl"
    idx = tmp_path / "search_index.jsonl"
    norm.write_text(
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
    idx.write_text(
        json.dumps({"key_type": "casefold", "key": "a", "ir_ids": ["x"]}) + "\n",
        encoding="utf-8",
    )
    build_result = build_bundle(
        norm,
        idx,
        bundle,
        sources_included=[SOURCE_MALIPENSE],
        license_enrichment=True,
        repo_root=REPO_ROOT,
        versioned_output=False,
    )
    built = Path(build_result["bundle_dir"])
    (built / "ATTRIBUTION.txt").write_text("attr\n", encoding="utf-8")
    (built / "DATA_LICENSES.md").write_text("# licenses\n", encoding="utf-8")
    result = audit_checksum_closure(built)
    assert result["status"] == GATE_PASS


def test_checksum_mismatch_blocks(tmp_path):
    bundle = tmp_path / "bundle"
    bundle.mkdir()
    (bundle / "records.jsonl").write_text("{}\n", encoding="utf-8")
    (bundle / "search_index.jsonl").write_text("{}\n", encoding="utf-8")
    (bundle / "checksums.sha256").write_text("00" * 32 + "  records.jsonl\n", encoding="utf-8")
    (bundle / "bundle.manifest.json").write_text(
        json.dumps(
            {
                "files": [
                    {
                        "path": "records.jsonl",
                        "byte_length": 3,
                        "sha256": sha256_file(bundle / "records.jsonl"),
                    },
                    {
                        "path": "search_index.jsonl",
                        "byte_length": 3,
                        "sha256": sha256_file(bundle / "search_index.jsonl"),
                    },
                ]
            }
        ),
        encoding="utf-8",
    )
    (bundle / "ATTRIBUTION.txt").write_text("x\n", encoding="utf-8")
    (bundle / "DATA_LICENSES.md").write_text("x\n", encoding="utf-8")
    result = audit_checksum_closure(bundle)
    assert result["status"] != GATE_PASS


def test_internal_full_regression_30_0_with_canonical_overlay():
    from product_boundary.build import _load_post_refresh_overlay
    from product_boundary.paths import default_paths
    from malipense_version_delta.source_refresh.transition.differential import (
        replay_regression_suite,
    )

    if not (REPO_ROOT / "data" / "product1a" / "internal_full" / "records.jsonl").is_file():
        pytest.skip("INTERNAL_FULL missing")
    paths = default_paths(REPO_ROOT)
    overlay = _load_post_refresh_overlay(paths)
    results = replay_regression_suite(
        search_index_path=paths.internal_search,
        records_path=paths.internal_records,
        regression_dir=paths.search_regression_dir,
        overlay=overlay,
    )
    assert sum(1 for r in results if r.ok) == 30
    assert sum(1 for r in results if not r.ok) == 0


def test_publication_regression_overlay_not_identity_only():
    """PRODUCT2 must use full post-refresh overlay, not identity_overlay.json alone."""
    from product_boundary.build import _load_post_refresh_overlay
    from product_boundary.paths import default_paths

    paths = default_paths(REPO_ROOT)
    full = _load_post_refresh_overlay(paths)
    identity_only = {}
    overlay_path = (
        REPO_ROOT
        / "data/malidaba_delta/current/source_refresh/f19/virtual/identity_overlay.json"
    )
    if overlay_path.is_file():
        import json

        identity_only = json.loads(overlay_path.read_text(encoding="utf-8"))
    assert len(full) >= len(identity_only)
    assert full.get("ff499fdee22b2b86") == "ff7fca1eb761ae43"


def test_owner_rows_absent_from_candidate_records():
    from publication_readiness.evaluate import evaluate_product2

    if not (REPO_ROOT / "data" / "product1a" / "internal_full" / "records.jsonl").is_file():
        pytest.skip("INTERNAL_FULL missing")
    receipt = evaluate_product2(REPO_ROOT, skip_internal_rebuild=True)
    leakage = receipt["owner_leakage_audit"]
    assert leakage["owner_lexical_rows"] == 0
    assert leakage["owner_index_postings"] == 0


def test_authorization_binds_exact_candidate_fingerprint():
    fp = release_candidate_fingerprint(
        bundle_id="bundle_noncommercial_abcd1234",
        content_sha256="sha256:abcd",
    )
    worksheet = build_authorization_worksheet_v2(
        semantic_bundle_id="bundle_noncommercial_abcd1234",
        semantic_content_sha256="sha256:abcd",
        semantic_candidate_fingerprint=fp,
        release_artifact_fingerprint="sha256:release",
        release_artifact_dir_name="bundle_noncommercial_abcd1234__00000000",
        distributed_file_hashes={"records.jsonl": "sha256:1"},
        counts={},
        rights_summary={},
        product1b_checks={},
        publication_readiness_decision=DECISION_READY,
        internal_full_regression={"pass": 30, "fail": 0},
        publication_candidate_regression={
            "pass": 26,
            "expected_owner_rights_exclusion": 4,
            "unexpected_defects": 0,
        },
        p_gates={},
    )
    ok = validate_authorization_v2_binds_bytes(
        worksheet,
        semantic_bundle_id="bundle_noncommercial_abcd1234",
        semantic_content_sha256="sha256:abcd",
        semantic_candidate_fingerprint=fp,
        release_artifact_fingerprint="sha256:release",
        distributed_file_hashes={"records.jsonl": "sha256:1"},
    )
    assert ok["binds_exact_bytes"] is True
    assert ok["binds_release_artifact_identity"] is True
    assert ok["can_publish"] is False
    assert ok["authorized_without_review"] is True


def test_unreviewed_authorization_cannot_publish():
    worksheet = build_authorization_worksheet_v2(
        semantic_bundle_id="b1",
        semantic_content_sha256="sha256:1",
        semantic_candidate_fingerprint="sha256:fp",
        release_artifact_fingerprint="sha256:release",
        release_artifact_dir_name="b1__00000000",
        distributed_file_hashes={},
        counts={},
        rights_summary={},
        product1b_checks={},
        publication_readiness_decision=DECISION_READY,
        internal_full_regression={"pass": 30, "fail": 0},
        publication_candidate_regression={"pass": 26, "expected_owner_rights_exclusion": 4, "unexpected_defects": 0},
        p_gates={},
    )
    validation = validate_authorization_v2_binds_bytes(
        worksheet,
        semantic_bundle_id="b1",
        semantic_content_sha256="sha256:1",
        semantic_candidate_fingerprint="sha256:fp",
        release_artifact_fingerprint="sha256:release",
        distributed_file_hashes={},
    )
    assert validation["can_publish"] is False


def test_p10_awaiting_human_authorization():
    from publication_readiness.gates import evaluate_gates

    gates = evaluate_gates(
        semantic_reproducible=True,
        release_artifact_reproducible=True,
        bundle_verification={"valid": True},
        checksum_audit={"status": GATE_PASS},
        release_artifact_closure={"status": GATE_PASS},
        product1b_all_pass=True,
        provenance_complete=True,
        offline_install_ok=True,
        search_regression={"unexpected_defects": 0},
        credits_implemented=True,
        credits_offline_ok=True,
        catalog_schema_ok={"status": GATE_PASS},
        catalog_simulation={"status": GATE_PASS, "release_specific_path_resolved": True},
        rollback_design={"rollback_target_bundle_id": "old"},
        publication_transaction={"status": "READY"},
        authorization_validation={
            "authorized_without_review": True,
            "binds_release_artifact_identity": True,
            "can_publish": False,
        },
    )
    assert gates["P10_PUBLICATION_AUTHORIZATION_NOT_YET_GRANTED"] == GATE_AWAITING_HUMAN_AUTHORIZATION


def test_catalog_schema_parses():
    catalog = json.loads((REPO_ROOT / "web/public/catalog.json").read_text(encoding="utf-8"))
    result = validate_catalog_schema(catalog)
    assert result["status"] == GATE_PASS


def test_rollback_design_preserves_historical_bytes():
    rb = design_rollback_semantics(
        current_published_bundle_id="bundle_old",
        candidate_bundle_id="bundle_new",
    )
    assert rb["deletes_historical_bytes"] is False
    assert rb["rollback_target_bundle_id"] == "bundle_old"


def test_publication_transaction_ready():
    tx = design_publication_transaction()
    assert tx["status"] == "READY"
    assert tx["overwrite_differing_bytes_at_existing_id"] is False
    assert tx["overwrite_differing_bytes_at_existing_path"] is False
    assert tx["requires_release_artifact_fingerprint_match"] is True


def test_manifest_only_change_preserves_semantic_changes_release(tmp_path):
    built = _build_minimal_bundle(tmp_path)
    dir_a = _clone_bundle(built, tmp_path / "candidate_a")
    dir_b = _clone_bundle(built, tmp_path / "candidate_b")

    manifest_a = json.loads((dir_a / "bundle.manifest.json").read_text(encoding="utf-8"))
    manifest_a.setdefault("publication", {})["build_commit"] = "aaa"
    (dir_a / "bundle.manifest.json").write_text(
        json.dumps(manifest_a, sort_keys=True) + "\n", encoding="utf-8"
    )
    manifest_b = json.loads((dir_b / "bundle.manifest.json").read_text(encoding="utf-8"))
    manifest_b.setdefault("publication", {})["build_commit"] = "bbb"
    (dir_b / "bundle.manifest.json").write_text(
        json.dumps(manifest_b, sort_keys=True) + "\n", encoding="utf-8"
    )

    id_a = identity_from_frozen_bundle(dir_a)
    id_b = identity_from_frozen_bundle(dir_b)
    assert id_a["semantic_content_sha256"] == id_b["semantic_content_sha256"]
    assert id_a["semantic_candidate_fingerprint"] == id_b["semantic_candidate_fingerprint"]
    assert id_a["release_artifact_fingerprint"] != id_b["release_artifact_fingerprint"]
    assert id_a["release_artifact_dir_name"] != id_b["release_artifact_dir_name"]

    worksheet = build_authorization_worksheet_v2(
        semantic_bundle_id=id_a["semantic_bundle_id"],
        semantic_content_sha256=id_a["semantic_content_sha256"],
        semantic_candidate_fingerprint=id_a["semantic_candidate_fingerprint"],
        release_artifact_fingerprint=id_a["release_artifact_fingerprint"],
        release_artifact_dir_name=id_a["release_artifact_dir_name"],
        distributed_file_hashes=id_a["distributed_file_hashes"],
        counts={},
        rights_summary={},
        product1b_checks={},
        publication_readiness_decision=DECISION_READY,
        internal_full_regression={"pass": 30, "fail": 0},
        publication_candidate_regression={"pass": 26, "expected_owner_rights_exclusion": 4, "unexpected_defects": 0},
        p_gates={},
    )
    auth_b = validate_authorization_v2_binds_bytes(
        worksheet,
        semantic_bundle_id=id_b["semantic_bundle_id"],
        semantic_content_sha256=id_b["semantic_content_sha256"],
        semantic_candidate_fingerprint=id_b["semantic_candidate_fingerprint"],
        release_artifact_fingerprint=id_b["release_artifact_fingerprint"],
        distributed_file_hashes=id_b["distributed_file_hashes"],
    )
    assert auth_b["binds_release_artifact_identity"] is False
    assert auth_b["binds_exact_bytes"] is False


def test_attribution_only_change_changes_release_identity(tmp_path):
    built = _build_minimal_bundle(tmp_path)
    dir_a = _clone_bundle(built, tmp_path / "a")
    dir_b = _clone_bundle(built, tmp_path / "b")
    (dir_b / "ATTRIBUTION.txt").write_text("different attribution\n", encoding="utf-8")

    id_a = identity_from_frozen_bundle(dir_a)
    id_b = identity_from_frozen_bundle(dir_b)
    assert id_a["semantic_content_sha256"] == id_b["semantic_content_sha256"]
    assert id_a["release_artifact_fingerprint"] != id_b["release_artifact_fingerprint"]


def test_data_licenses_only_change_changes_release_identity(tmp_path):
    built = _build_minimal_bundle(tmp_path)
    dir_a = _clone_bundle(built, tmp_path / "a")
    dir_b = _clone_bundle(built, tmp_path / "b")
    (dir_b / "DATA_LICENSES.md").write_text("# different\n", encoding="utf-8")

    id_a = identity_from_frozen_bundle(dir_a)
    id_b = identity_from_frozen_bundle(dir_b)
    assert id_a["semantic_content_sha256"] == id_b["semantic_content_sha256"]
    assert id_a["release_artifact_fingerprint"] != id_b["release_artifact_fingerprint"]


def test_records_change_changes_semantic_and_release_identity(tmp_path):
    built = _build_minimal_bundle(tmp_path)
    dir_b = _clone_bundle(built, tmp_path / "b")
    (dir_b / "records.jsonl").write_text(
        json.dumps(
            {
                "ir_id": "y",
                "ir_kind": "lexicon_entry",
                "source_id": SOURCE_MALIPENSE,
                "norm_version": "norm_v1",
                "record_locator": {"k": 2},
            }
        )
        + "\n",
        encoding="utf-8",
    )
    _refresh_manifest_payload_hashes(dir_b)

    id_a = identity_from_frozen_bundle(built)
    id_b = identity_from_frozen_bundle(dir_b)
    assert id_a["semantic_content_sha256"] != id_b["semantic_content_sha256"]
    assert id_a["release_artifact_fingerprint"] != id_b["release_artifact_fingerprint"]


def test_search_change_changes_semantic_and_release_identity(tmp_path):
    built = _build_minimal_bundle(tmp_path)
    dir_b = _clone_bundle(built, tmp_path / "b")
    (dir_b / "search_index.jsonl").write_text(
        json.dumps({"key_type": "casefold", "key": "b", "ir_ids": ["x"]}) + "\n",
        encoding="utf-8",
    )
    _refresh_manifest_payload_hashes(dir_b)

    id_a = identity_from_frozen_bundle(built)
    id_b = identity_from_frozen_bundle(dir_b)
    assert id_a["semantic_content_sha256"] != id_b["semantic_content_sha256"]
    assert id_a["release_artifact_fingerprint"] != id_b["release_artifact_fingerprint"]


def test_release_artifact_dir_uses_release_prefix_not_semantic(tmp_path):
    built = _build_minimal_bundle(tmp_path)
    identity = identity_from_frozen_bundle(built)
    semantic_dir = semantic_artifact_dir_name(
        identity["semantic_bundle_id"], identity["semantic_content_sha256"]
    )
    release_dir = release_artifact_dir_name(
        identity["semantic_bundle_id"], identity["release_artifact_fingerprint"]
    )
    assert release_dir.startswith(f"{identity['semantic_bundle_id']}__")
    assert release_dir == identity["release_artifact_dir_name"]
    # Release prefix derives from release fingerprint, not semantic content prefix.
    assert release_dir.split("__", 1)[1] == identity["release_artifact_fingerprint"].split(":", 1)[1][:8]


def test_v1_semantic_fingerprint_insufficient_for_manifest_change(tmp_path):
    built = _build_minimal_bundle(tmp_path)
    dir_b = _clone_bundle(built, tmp_path / "b")
    manifest = json.loads((dir_b / "bundle.manifest.json").read_text(encoding="utf-8"))
    manifest.setdefault("publication", {})["note"] = "changed"
    (dir_b / "bundle.manifest.json").write_text(json.dumps(manifest) + "\n", encoding="utf-8")

    id_a = identity_from_frozen_bundle(built)
    id_b = identity_from_frozen_bundle(dir_b)
    assert id_a["semantic_candidate_fingerprint"] == id_b["semantic_candidate_fingerprint"]
    legacy = validate_authorization_binds_bytes(
        {
            "bundle_id": id_a["semantic_bundle_id"],
            "candidate_fingerprint": id_a["semantic_candidate_fingerprint"],
            "protected_fields": {"bundle_id": id_a["semantic_bundle_id"]},
            "publication_decision": None,
        },
        bundle_id=id_b["semantic_bundle_id"],
        candidate_fingerprint=id_b["semantic_candidate_fingerprint"],
    )
    assert legacy["binds_exact_bytes"] is True
    exact = validate_authorization_v2_binds_bytes(
        build_authorization_worksheet_v2(
            semantic_bundle_id=id_a["semantic_bundle_id"],
            semantic_content_sha256=id_a["semantic_content_sha256"],
            semantic_candidate_fingerprint=id_a["semantic_candidate_fingerprint"],
            release_artifact_fingerprint=id_a["release_artifact_fingerprint"],
            release_artifact_dir_name=id_a["release_artifact_dir_name"],
            distributed_file_hashes=id_a["distributed_file_hashes"],
            counts={},
            rights_summary={},
            product1b_checks={},
            publication_readiness_decision=DECISION_READY,
            internal_full_regression={"pass": 30, "fail": 0},
            publication_candidate_regression={"pass": 26, "expected_owner_rights_exclusion": 4, "unexpected_defects": 0},
            p_gates={},
        ),
        semantic_bundle_id=id_b["semantic_bundle_id"],
        semantic_content_sha256=id_b["semantic_content_sha256"],
        semantic_candidate_fingerprint=id_b["semantic_candidate_fingerprint"],
        release_artifact_fingerprint=id_b["release_artifact_fingerprint"],
        distributed_file_hashes=id_b["distributed_file_hashes"],
    )
    assert exact["binds_exact_bytes"] is False


def test_backward_catalog_schema_still_passes():
    catalog = json.loads((REPO_ROOT / "web/public/catalog.json").read_text(encoding="utf-8"))
    result = validate_catalog_schema(catalog)
    assert result["status"] == GATE_PASS
    bundles = catalog.get("bundles") or []
    assert any(b.get("bundle_id") == "bundle_full_20260710_337619ff" for b in bundles)


def test_no_canonical_lexical_mutation():
    result = subprocess.run(
        ["git", "diff", "--name-only", "HEAD", "--", "data/ir", "shared/malidaba"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.stdout.strip() == ""


def test_no_web_public_mutation():
    result = subprocess.run(
        ["git", "diff", "--name-only", "HEAD", "--", "web/public"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.stdout.strip() == ""


def test_web_scripts_untouched():
    result = subprocess.run(
        ["git", "status", "--short", "web/scripts"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.stdout.strip() in ("?? web/scripts/", "")


def test_malidaba_license_in_enriched_manifest(registry):
    manifest = enrich_manifest_with_licenses(
        {"manifest_schema_version": "bundle_manifest_v1"},
        registry=registry,
        source_ids=[SOURCE_MALIPENSE],
    )
    included = manifest["sources"]["included"]
    assert included[0]["claimed_license"] == LICENSE_CC_BY_NC_SA
    assert SOURCE_OWNER not in [e["source_id"] for e in included]


def test_identity_from_manifest_files():
    files = [
        {"path": "records.jsonl", "byte_length": 1, "sha256": "sha256:" + "a" * 64},
        {"path": "search_index.jsonl", "byte_length": 1, "sha256": "sha256:" + "b" * 64},
    ]
    identity = identity_from_manifest_files(files)
    assert identity["bundle_id"].startswith("bundle_noncommercial_")
    assert identity["candidate_fingerprint"].startswith("sha256:")
    assert identity["semantic_candidate_fingerprint"] == identity["candidate_fingerprint"]
