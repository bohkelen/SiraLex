"""Write PRODUCT2B exact-byte identity receipt (gitignored)."""

from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Any

from malipense_version_delta.canonical_json import sha256_file, write_json

from .authorization import AUTHORIZATION_V1_SUPERSEDED_STATUS
from .paths import Product2Paths


def _git_head(repo_root: Path) -> str:
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=str(repo_root), text=True
        ).strip()
    except subprocess.CalledProcessError:
        return "unknown"


def write_product2b_receipt(
    *,
    paths: Product2Paths,
    publication_receipt: dict[str, Any],
    hardening_commit: str | None = None,
) -> dict[str, Any]:
    commit = hardening_commit or _git_head(paths.repo_root)
    receipt = {
        "schema_version": "siralex_product2b_exact_byte_identity_receipt_v1",
        "decision": (
            "PRODUCT2B_PREAUTH_EXACT_BYTE_IDENTITY_READY"
            if publication_receipt.get("decision") == "PRODUCT2_PUBLICATION_READINESS_READY"
            else "PRODUCT2B_PREAUTH_EXACT_BYTE_IDENTITY_BLOCKED"
        ),
        "hardening_commit": commit,
        "base_commit_at_evaluation": publication_receipt.get("base_commit"),
        "semantic_identity": {
            "semantic_bundle_id": publication_receipt.get("semantic_bundle_id"),
            "semantic_content_sha256": publication_receipt.get("semantic_content_sha256"),
            "semantic_candidate_fingerprint": publication_receipt.get("semantic_candidate_fingerprint"),
        },
        "release_identity": {
            "release_artifact_fingerprint": publication_receipt.get("release_artifact_fingerprint"),
            "release_artifact_dir_name": publication_receipt.get("release_artifact_dir_name"),
            "distributed_file_hashes": publication_receipt.get("candidate_file_hashes"),
        },
        "physical_release_path": publication_receipt.get("release_artifact_dir_name"),
        "catalog_candidate": publication_receipt.get("proposed_catalog_entry"),
        "authorization": {
            "v1_worksheet_status": publication_receipt.get(
                "authorization_worksheet_v1_status", AUTHORIZATION_V1_SUPERSEDED_STATUS
            ),
            "v2_worksheet_path": publication_receipt.get("authorization_worksheet_v2"),
            "publication_authorized": False,
        },
        "p_gates": publication_receipt.get("p_gates"),
        "candidate_counts": publication_receipt.get("candidate_counts"),
        "search_regression": publication_receipt.get("search_regression"),
        "checksum_closure": publication_receipt.get("checksum_closure"),
        "release_artifact_closure": publication_receipt.get("release_artifact_closure"),
        "catalog_simulation": publication_receipt.get("catalog_simulation"),
        "rollback_target_bundle_id": publication_receipt.get("current_published_bundle_id"),
        "tests": {
            "internal_full": publication_receipt.get("search_regression"),
            "publication_candidate": publication_receipt.get("search_regression"),
        },
    }
    paths.product2b_receipt_path.parent.mkdir(parents=True, exist_ok=True)
    write_json(paths.product2b_receipt_path, receipt)
    receipt["receipt_sha256"] = sha256_file(paths.product2b_receipt_path)
    write_json(paths.product2b_receipt_path, receipt)
    return receipt
