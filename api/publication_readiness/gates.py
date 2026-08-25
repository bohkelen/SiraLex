"""P1–P10 publication readiness gates."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from .authorization import validate_authorization_binds_bytes
from .catalog import (
    design_publication_transaction,
    design_rollback_semantics,
    validate_catalog_schema,
)
from .checksum_closure import audit_checksum_closure
from .model import GATE_AWAITING_HUMAN_AUTHORIZATION, GATE_BLOCK, GATE_PASS
from .rights_leakage import audit_portable_bundle, audit_rights_leakage


def evaluate_gates(
    *,
    semantic_reproducible: bool,
    release_artifact_reproducible: bool,
    bundle_verification: dict[str, Any],
    checksum_audit: dict[str, Any],
    release_artifact_closure: dict[str, Any],
    product1b_all_pass: bool,
    provenance_complete: bool,
    offline_install_ok: bool,
    search_regression: dict[str, Any],
    credits_implemented: bool,
    credits_offline_ok: bool,
    catalog_schema_ok: dict[str, Any],
    catalog_simulation: dict[str, Any],
    rollback_design: dict[str, Any],
    publication_transaction: dict[str, Any],
    authorization_validation: dict[str, Any],
) -> dict[str, str]:
    gates: dict[str, str] = {}

    gates["P1_CANDIDATE_REPRODUCIBLE"] = (
        GATE_PASS
        if semantic_reproducible and release_artifact_reproducible
        else GATE_BLOCK
    )
    gates["P2_BUNDLE_INTEGRITY"] = (
        GATE_PASS
        if bundle_verification.get("valid")
        and checksum_audit.get("status") == GATE_PASS
        and release_artifact_closure.get("status") == GATE_PASS
        else GATE_BLOCK
    )
    gates["P3_RIGHTS_COMPLIANCE"] = GATE_PASS if product1b_all_pass else GATE_BLOCK
    gates["P4_PROVENANCE_COMPLETE"] = GATE_PASS if provenance_complete else GATE_BLOCK
    gates["P5_OFFLINE_INSTALL"] = GATE_PASS if offline_install_ok else GATE_BLOCK
    gates["P6_SEARCH_VALIDATION"] = (
        GATE_PASS if search_regression.get("unexpected_defects", 1) == 0 else GATE_BLOCK
    )
    gates["P7_USER_CREDITS"] = (
        GATE_PASS if credits_implemented and credits_offline_ok else GATE_BLOCK
    )
    gates["P8_CATALOG_COMPATIBILITY"] = (
        GATE_PASS
        if catalog_schema_ok.get("status") == GATE_PASS
        and catalog_simulation.get("status") == GATE_PASS
        and catalog_simulation.get("release_specific_path_resolved") is not False
        else GATE_BLOCK
    )
    gates["P9_ROLLBACK_DESIGN"] = (
        GATE_PASS
        if rollback_design.get("rollback_target_bundle_id")
        and publication_transaction.get("status") == "READY"
        else GATE_BLOCK
    )
    gates["P10_PUBLICATION_AUTHORIZATION_NOT_YET_GRANTED"] = (
        GATE_AWAITING_HUMAN_AUTHORIZATION
        if authorization_validation.get("authorized_without_review")
        and authorization_validation.get("binds_release_artifact_identity")
        and not authorization_validation.get("can_publish")
        else GATE_BLOCK
    )

    return gates


def all_required_gates_pass(gates: dict[str, str]) -> bool:
    required = [k for k in sorted(gates) if k.startswith("P") and k != "P10_PUBLICATION_AUTHORIZATION_NOT_YET_GRANTED"]
    return all(gates.get(k) == GATE_PASS for k in required)
