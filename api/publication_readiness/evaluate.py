"""PRODUCT2 evaluation orchestrator — finalize-before-seal."""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path
from typing import Any

from malipense_version_delta.canonical_json import sha256_file, write_json
from malipense_version_delta.compare import load_jsonl_records
from source_registry.load import SOURCE_MALIPENSE, load_source_registry, resolve_source_entry

from distribution_compliance.candidate import build_noncommercial_candidate
from distribution_compliance.checks import run_all_checks
from distribution_compliance.classify import owner_distribution_audit
from distribution_compliance.paths import Product1BPaths
from distribution_compliance.provenance import scan_derived_artifact_provenance, scan_record_provenance
from product_boundary.build import (
    _load_post_refresh_overlay as load_post_refresh_overlay,
    build_internal_full,
)
from product_boundary.paths import default_paths as product1a_paths

from .authorization import (
    AUTHORIZATION_V1_SUPERSEDED_STATUS,
    build_authorization_worksheet_v2,
    validate_authorization_v2_binds_bytes,
    write_authorization_worksheet,
)
from .authorization_packet import build_authorization_packet_v2, write_authorization_packet
from .catalog import (
    build_proposed_catalog_entry,
    design_publication_transaction,
    design_rollback_semantics,
    load_catalog,
    simulate_catalog_addition,
    validate_catalog_schema,
)
from .checksum_closure import audit_checksum_closure, audit_release_artifact_closure
from .coherence import validate_worksheet_release_coherence
from .freeze import freeze_release_candidate
from .gates import all_required_gates_pass, evaluate_gates
from .identity import collect_distributed_file_hashes, identity_from_frozen_bundle
from .model import (
    DECISION_BLOCKED,
    DECISION_READY,
    STATE_PUBLICATION_READY,
)
from .paths import Product2Paths, default_paths
from .product2b_receipt import write_product2b_receipt
from .rights_leakage import audit_portable_bundle, audit_rights_leakage
from .seal import SealedArtifactMutationError, is_sealed
from .search_validation import run_publication_regression


EXPECTED_BASE_COMMIT = "9107ba2d762b213e4040fb49679ba9d901bf89c1"

EXPECTED_COUNTS = {
    "records": 22199,
    "lexicon_entries": 11694,
    "headwords": 10148,
    "search_keys": 174700,
}

EXPECTED_SEMANTIC = {
    "semantic_bundle_id": "bundle_noncommercial_dfd5ba62",
    "semantic_content_sha256": (
        "sha256:dfd5ba62514caa72f9e282d16160ded01c26164c5c982fd6d164b78b6f7aeb33"
    ),
    "semantic_candidate_fingerprint": (
        "sha256:77b9773c05750e9138971f64217c1071394406bdebdd48adc357d5f4c434c053"
    ),
    "records.jsonl": (
        "sha256:e18c2583a60e8e4a12ce0dc2f21f11cfc1ab2d7f8c9eeb3f2219d2ca8417c1fd"
    ),
    "search_index.jsonl": (
        "sha256:1ab532d9885ea8fd1216936fd1564e950260f9015911b0f9a3908a1f6eb7e44a"
    ),
    "ATTRIBUTION.txt": (
        "sha256:f9d747fef3acef5ab2f6800ae190d58c274cc5238eb26c75495c3ccd608aec6e"
    ),
    "DATA_LICENSES.md": (
        "sha256:cdbec942ebd3ae8dfb5bd21f2925884a4fe94df7d4306ee72020ec54d52ee3c7"
    ),
}

PRESERVE_WORKSPACE_PREFIXES = ("_superseded_",)


def _git_head(repo_root: Path) -> str:
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=str(repo_root), text=True
        ).strip()
    except subprocess.CalledProcessError:
        return "unknown"


def _clean_product2_workspace(paths: Product2Paths) -> None:
    """Recreate active workspace; preserve superseded audit evidence dirs."""
    if paths.workspace.exists():
        for child in list(paths.workspace.iterdir()):
            if any(child.name.startswith(p) for p in PRESERVE_WORKSPACE_PREFIXES):
                continue
            if child.is_dir():
                shutil.rmtree(child)
            else:
                child.unlink()
    paths.workspace.mkdir(parents=True, exist_ok=True)


def _product1b_paths_for_product2(paths: Product2Paths) -> Product1BPaths:
    return Product1BPaths(
        repo_root=paths.repo_root,
        workspace=paths.candidate_workspace,
        internal_records=paths.internal_records,
        internal_search=paths.internal_search,
        candidate_dir=paths.candidate_workspace,
        portable_dir=paths.portable_dir,
        compliance_manifest=paths.workspace / "product1b_compliance.json",
        receipt_path=paths.workspace / "product1b_receipt.json",
        data_licenses_doc=paths.data_licenses_doc,
        readme=paths.repo_root / "README.md",
        sources_dir=paths.repo_root / "shared" / "sources",
    )


def _load_post_refresh_overlay(repo_root: Path) -> dict[str, str]:
    return load_post_refresh_overlay(product1a_paths(repo_root))


def _assert_no_post_seal_distributed_mutation(
    bundle_dir: Path, sealed_hashes: dict[str, str]
) -> int:
    """Return count of post-seal mutations (must be 0)."""
    if not is_sealed(bundle_dir):
        raise RuntimeError(f"bundle directory is not sealed: {bundle_dir}")
    current = collect_distributed_file_hashes(bundle_dir)
    mutations = 0
    for name, sealed_hash in sealed_hashes.items():
        if current.get(name) != sealed_hash:
            mutations += 1
    if mutations:
        raise SealedArtifactMutationError(
            f"Detected {mutations} post-seal distributed file mutation(s) under {bundle_dir}"
        )
    return 0


def evaluate_product2(
    repo_root: Path | None = None,
    *,
    skip_internal_rebuild: bool = False,
    credits_implemented: bool = True,
    credits_offline_ok: bool = True,
    offline_install_ok: bool = True,
) -> dict[str, Any]:
    paths = default_paths(repo_root)
    p1a = product1a_paths(repo_root)
    base_commit = _git_head(paths.repo_root)

    _clean_product2_workspace(paths)

    if not skip_internal_rebuild or not paths.internal_records.is_file():
        build_internal_full(p1a)

    p1b_paths = _product1b_paths_for_product2(paths)
    candidate_receipt = build_noncommercial_candidate(p1b_paths)

    counts_match = (
        candidate_receipt["records_included"] == EXPECTED_COUNTS["records"]
        and candidate_receipt["lexicon_entries_included"] == EXPECTED_COUNTS["lexicon_entries"]
        and candidate_receipt["headwords_included"] == EXPECTED_COUNTS["headwords"]
        and candidate_receipt["search_keys_included"] == EXPECTED_COUNTS["search_keys"]
    )

    bundle_dir_pre = Path(candidate_receipt["bundle_dir"])
    registry = load_source_registry(paths.repo_root)
    all_internal = load_jsonl_records(paths.internal_records)
    owner_audit = owner_distribution_audit(
        paths.repo_root,
        owner_ir_path=p1a.owner_ir,
        internal_records=all_internal,
    )
    eligible_ids = {
        ir_id for ir_id, item in candidate_receipt["classifications"].items() if item.get("eligible")
    }
    provenance_scan = scan_record_provenance(
        p1b_paths.candidate_records, repo_root=paths.repo_root
    )
    derived_scan = scan_derived_artifact_provenance(
        repo_root=paths.repo_root,
        candidate_record_ids=eligible_ids,
    )
    checks_pre = run_all_checks(
        repo_root=paths.repo_root,
        bundle_dir=bundle_dir_pre,
        source_ids=candidate_receipt["included_source_ids"],
        provenance_scan=provenance_scan,
        derived_scan=derived_scan,
        owner_audit=owner_audit,
        candidate_receipt=candidate_receipt,
        portable_dir=paths.portable_dir,
    )

    # FINAL distributed publication_state is known before seal for PRODUCT2C
    # pre-authorization candidate. Gate outcomes live in external receipts only.
    publication_state = STATE_PUBLICATION_READY
    frozen = freeze_release_candidate(
        repo_root=paths.repo_root,
        records_path=p1b_paths.candidate_records,
        search_index_path=p1b_paths.candidate_search,
        output_parent=paths.frozen_bundle_parent,
        source_ids=candidate_receipt["included_source_ids"],
        publication_state=publication_state,
        product1b_checks={k: v for k, v in checks_pre.items() if str(k).startswith("C")},
        search_key_count=candidate_receipt["search_keys_included"],
    )
    bundle_dir = Path(frozen["bundle_dir"])
    sealed_hashes = dict(frozen["sealed_hashes_snapshot"])
    fingerprint_at_seal = frozen["release_artifact_fingerprint"]
    manifest_sha_at_seal = sealed_hashes.get("bundle.manifest.json")

    checksum_audit = audit_checksum_closure(bundle_dir)
    release_closure = audit_release_artifact_closure(bundle_dir)
    recomputed_identity = identity_from_frozen_bundle(bundle_dir)
    release_artifact_reproducible = (
        recomputed_identity["release_artifact_fingerprint"] == fingerprint_at_seal
        and recomputed_identity["semantic_content_sha256"]
        == frozen["semantic_content_sha256"]
    )
    leakage = audit_rights_leakage(
        repo_root=paths.repo_root,
        records_path=bundle_dir / "records.jsonl",
        search_index_path=bundle_dir / "search_index.jsonl",
        owner_ir_path=p1a.owner_ir,
    )
    portable = audit_portable_bundle(bundle_dir, paths.portable_dir / "frozen")

    catalog = load_catalog(paths.catalog_source)
    catalog_schema = validate_catalog_schema(catalog)
    current_published = _current_featured_bundle_id(paths)
    proposed_entry = build_proposed_catalog_entry(
        bundle_id=frozen["semantic_bundle_id"],
        content_sha256=frozen["semantic_content_sha256"],
        release_artifact_dir_name=frozen["release_artifact_dir_name"],
        release_artifact_fingerprint=frozen["release_artifact_fingerprint"],
        bundle_dir=bundle_dir,
    )
    write_json(paths.proposed_catalog_entry, proposed_entry)

    catalog_sim = simulate_catalog_addition(
        source_catalog_path=paths.catalog_source,
        web_public_dir=paths.web_public,
        simulation_dir=paths.catalog_simulation_dir,
        candidate_bundle_dir=bundle_dir,
        proposed_entry=proposed_entry,
        active_bundle_id=proposed_entry["bundle_id"],
    )
    rollback = design_rollback_semantics(
        current_published_bundle_id=current_published,
        candidate_bundle_id=frozen["bundle_id"],
    )
    pub_tx = design_publication_transaction()

    regression = run_publication_regression(
        repo_root=paths.repo_root,
        internal_records=paths.internal_records,
        internal_search=paths.internal_search,
        candidate_records=bundle_dir / "records.jsonl",
        candidate_search=bundle_dir / "search_index.jsonl",
        regression_dir=paths.repo_root / "shared" / "search_regression",
        overlay=_load_post_refresh_overlay(paths.repo_root),
    )

    provenance_complete = (
        provenance_scan.get("records_missing_source_provenance", 1) == 0
        and provenance_scan.get("unresolvable_source_ids", []) == []
        and derived_scan.get("derived_lexical_artifacts_with_unknown_substantive_provenance", 1)
        == 0
    )

    # Build worksheet in memory with provisional gates, evaluate gates, then
    # write worksheet ONCE after seal — never mutate distributed bytes.
    rights_summary = _rights_summary(registry, candidate_receipt)
    counts = {
        "records": candidate_receipt["records_included"],
        "lexicon_entries": candidate_receipt["lexicon_entries_included"],
        "headwords": candidate_receipt["headwords_included"],
        "search_keys": candidate_receipt["search_keys_included"],
    }
    product1b_status = {
        k: v.get("status") for k, v in checks_pre.items() if str(k).startswith("C")
    }
    internal_full_regression = {
        "pass": regression.get("internal_pass"),
        "fail": regression.get("internal_fail"),
    }
    publication_candidate_regression = {
        "pass": regression.get("pass"),
        "expected_owner_rights_exclusion": regression.get("expected_owner_rights_exclusion"),
        "unexpected_defects": regression.get("unexpected_defects"),
    }

    # Provisional worksheet for gate evaluation (not yet written to disk).
    provisional_worksheet = build_authorization_worksheet_v2(
        semantic_bundle_id=frozen["semantic_bundle_id"],
        semantic_content_sha256=frozen["semantic_content_sha256"],
        semantic_candidate_fingerprint=frozen["semantic_candidate_fingerprint"],
        release_artifact_fingerprint=frozen["release_artifact_fingerprint"],
        release_artifact_dir_name=frozen["release_artifact_dir_name"],
        distributed_file_hashes=frozen["file_hashes"],
        counts=counts,
        rights_summary=rights_summary,
        product1b_checks=product1b_status,
        publication_readiness_decision=DECISION_READY,
        internal_full_regression=internal_full_regression,
        publication_candidate_regression=publication_candidate_regression,
        p_gates={},
    )
    auth_validation = validate_authorization_v2_binds_bytes(
        provisional_worksheet,
        semantic_bundle_id=frozen["semantic_bundle_id"],
        semantic_content_sha256=frozen["semantic_content_sha256"],
        semantic_candidate_fingerprint=frozen["semantic_candidate_fingerprint"],
        release_artifact_fingerprint=frozen["release_artifact_fingerprint"],
        distributed_file_hashes=frozen["file_hashes"],
    )

    gates = evaluate_gates(
        semantic_reproducible=counts_match and checks_pre.get("all_pass", False),
        release_artifact_reproducible=release_artifact_reproducible,
        bundle_verification=frozen["verification"],
        checksum_audit=checksum_audit,
        release_artifact_closure=release_closure,
        product1b_all_pass=checks_pre.get("all_pass", False),
        provenance_complete=provenance_complete,
        offline_install_ok=offline_install_ok,
        search_regression=regression,
        credits_implemented=credits_implemented,
        credits_offline_ok=credits_offline_ok,
        catalog_schema_ok=catalog_schema,
        catalog_simulation=catalog_sim,
        rollback_design=rollback,
        publication_transaction=pub_tx,
        authorization_validation=auth_validation,
    )

    decision = DECISION_READY if all_required_gates_pass(gates) else DECISION_BLOCKED
    publication_readiness_decision = decision

    # Prove no post-seal mutation before writing worksheet.
    post_seal_mutations = _assert_no_post_seal_distributed_mutation(bundle_dir, sealed_hashes)
    post_eval_identity = identity_from_frozen_bundle(bundle_dir)
    if post_eval_identity["release_artifact_fingerprint"] != fingerprint_at_seal:
        raise SealedArtifactMutationError(
            "release fingerprint changed after seal during evaluation"
        )
    if post_eval_identity["distributed_file_hashes"].get("bundle.manifest.json") != manifest_sha_at_seal:
        raise SealedArtifactMutationError(
            "manifest SHA changed after seal during evaluation"
        )

    # Recompute hashes from sealed directory for worksheet (projection of disk).
    final_hashes = collect_distributed_file_hashes(bundle_dir)
    auth_worksheet = build_authorization_worksheet_v2(
        semantic_bundle_id=frozen["semantic_bundle_id"],
        semantic_content_sha256=frozen["semantic_content_sha256"],
        semantic_candidate_fingerprint=frozen["semantic_candidate_fingerprint"],
        release_artifact_fingerprint=fingerprint_at_seal,
        release_artifact_dir_name=frozen["release_artifact_dir_name"],
        distributed_file_hashes=final_hashes,
        counts=counts,
        rights_summary=rights_summary,
        product1b_checks=product1b_status,
        publication_readiness_decision=publication_readiness_decision,
        internal_full_regression=internal_full_regression,
        publication_candidate_regression=publication_candidate_regression,
        p_gates=gates,
    )
    write_authorization_worksheet(paths.authorization_worksheet_v2, auth_worksheet)

    v1_status = (
        AUTHORIZATION_V1_SUPERSEDED_STATUS
        if paths.authorization_worksheet.is_file()
        else "ABSENT"
    )

    coherence = validate_worksheet_release_coherence(
        sealed_bundle_dir=bundle_dir,
        worksheet=auth_worksheet,
        expected_counts=EXPECTED_COUNTS,
    )

    receipt = {
        "schema_version": "siralex_publication_readiness_v1",
        "decision": decision,
        "base_commit": base_commit,
        "expected_base_commit": EXPECTED_BASE_COMMIT,
        "publication_state": publication_state,
        "publication_authorized": False,
        "candidate_bundle_id": frozen["semantic_bundle_id"],
        "semantic_bundle_id": frozen["semantic_bundle_id"],
        "semantic_content_sha256": frozen["semantic_content_sha256"],
        "semantic_candidate_fingerprint": frozen["semantic_candidate_fingerprint"],
        "release_artifact_fingerprint": fingerprint_at_seal,
        "release_artifact_dir_name": frozen["release_artifact_dir_name"],
        "candidate_fingerprint": frozen["semantic_candidate_fingerprint"],
        "content_sha256": frozen["semantic_content_sha256"],
        "artifact_dir_name": frozen["release_artifact_dir_name"],
        "candidate_profile": "NONCOMMERCIAL_DISTRIBUTION",
        "candidate_counts": counts,
        "expected_counts": EXPECTED_COUNTS,
        "counts_match_expected": counts_match,
        "candidate_file_hashes": final_hashes,
        "owner_exclusions": candidate_receipt["exclusions_by_reason"],
        "owner_leakage_audit": leakage,
        "product1b_checks": {k: v for k, v in checks_pre.items() if str(k).startswith("C")},
        "product1b_all_pass": checks_pre.get("all_pass"),
        "checksum_closure": checksum_audit,
        "release_artifact_closure": release_closure,
        "portable_bundle": portable,
        "offline_install": {"status": "PASS" if offline_install_ok else "BLOCK"},
        "credits_ui": {
            "implemented": credits_implemented,
            "offline_ok": credits_offline_ok,
            "source": "bundle_manifest_v2.sources + software_license",
        },
        "search_regression": regression,
        "current_published_bundle_id": current_published,
        "catalog_schema_version": catalog.get("catalog_schema_version"),
        "proposed_catalog_entry": proposed_entry,
        "catalog_simulation": catalog_sim,
        "rollback": rollback,
        "publication_transaction": pub_tx,
        "authorization_worksheet_v2": str(paths.authorization_worksheet_v2),
        "authorization_worksheet_v1_status": v1_status,
        "worksheet_release_coherence": coherence,
        "post_seal_distributed_mutations": post_seal_mutations,
        "manifest_sha_at_seal": manifest_sha_at_seal,
        "manifest_sha_after_evaluation": final_hashes.get("bundle.manifest.json"),
        "p_gates": gates,
        "recommended_next_gate": (
            "PRODUCT2C_EXPLICIT_NONCOMMERCIAL_PUBLICATION_AUTHORIZATION"
            if decision == DECISION_READY and coherence.get("status") == "PASS"
            else "PRODUCT2C_R1_FREEZE_ORDER_REMEDIATION"
        ),
    }
    write_json(paths.receipt_path, receipt)
    receipt["receipt_sha256"] = sha256_file(paths.receipt_path)
    write_json(paths.receipt_path, receipt)

    if decision == DECISION_READY:
        write_product2b_receipt(paths=paths, publication_receipt=receipt)

    packet = build_authorization_packet_v2(
        coherence=coherence,
        worksheet=auth_worksheet,
        publication_receipt=receipt,
        head_commit=base_commit,
    )
    write_authorization_packet(
        json_path=paths.authorization_packet_v2,
        txt_path=paths.authorization_packet_v2_txt,
        packet=packet,
    )
    receipt["authorization_packet_decision"] = packet["decision"]
    receipt["exact_authorization_statement"] = packet.get("exact_authorization_statement")
    write_json(paths.receipt_path, receipt)

    return receipt


def _current_featured_bundle_id(paths: Product2Paths) -> str:
    env_prod = paths.repo_root / "web" / ".env.production"
    if env_prod.is_file():
        for line in env_prod.read_text(encoding="utf-8").splitlines():
            if line.strip().startswith("VITE_FEATURED_BUNDLE_ID="):
                return line.split("=", 1)[1].strip()
    catalog = load_catalog(paths.catalog_source)
    bundles = catalog.get("bundles") or []
    if bundles:
        return str(bundles[-1].get("bundle_id") or "")
    return "unknown"


def _rights_summary(registry: dict, candidate_receipt: dict) -> dict[str, Any]:
    mal = resolve_source_entry(registry, SOURCE_MALIPENSE) or {}
    return {
        "included_sources": candidate_receipt["included_source_ids"],
        "malidaba_license": mal.get("claimed_license"),
        "malidaba_posture": mal.get("distribution_posture"),
        "owner_rows_included": 0,
        "owner_rows_excluded": candidate_receipt["exclusions_by_reason"].get(
            "DISTRIBUTION_PERMISSION_NOT_RECORDED", 0
        ),
    }
