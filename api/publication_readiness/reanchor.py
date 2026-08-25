"""PRODUCT2A commit-reanchor comparison and receipt."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from malipense_version_delta.canonical_json import sha256_file, write_json


def _hex(sha: str | None) -> str:
    if not sha:
        return ""
    return sha.split(":", 1)[-1] if sha.startswith("sha256:") else sha


def compare_candidates(
    old_receipt: dict[str, Any],
    new_receipt: dict[str, Any],
) -> dict[str, Any]:
    old_hashes = old_receipt.get("candidate_file_hashes") or {}
    new_hashes = new_receipt.get("candidate_file_hashes") or {}

    def same(key: str) -> bool:
        return _hex(old_hashes.get(key)) == _hex(new_hashes.get(key))

    semantic_keys = ("records.jsonl", "search_index.jsonl", "ATTRIBUTION.txt", "DATA_LICENSES.md")
    semantic_same = {k: same(k) for k in semantic_keys}

    old_manifest = _hex(old_hashes.get("bundle.manifest.json"))
    new_manifest = _hex(new_hashes.get("bundle.manifest.json"))
    manifest_changed = old_manifest != new_manifest

    old_id = old_receipt.get("candidate_bundle_id")
    new_id = new_receipt.get("candidate_bundle_id")
    identity_changed = (
        old_id != new_id
        or old_receipt.get("content_sha256") != new_receipt.get("content_sha256")
    )

    if identity_changed and all(semantic_same.values()):
        old_status = "SUPERSEDED_UNAUTHORIZED_CANDIDATE"
    elif not identity_changed:
        old_status = "IDENTICAL_TO_FINAL_CANDIDATE"
    else:
        old_status = "SUPERSEDED_UNAUTHORIZED_CANDIDATE"

    return {
        "old_candidate_status": old_status,
        "old_bundle_id": old_id,
        "old_content_sha256": old_receipt.get("content_sha256"),
        "old_candidate_fingerprint": old_receipt.get("candidate_fingerprint"),
        "new_bundle_id": new_id,
        "new_content_sha256": new_receipt.get("content_sha256"),
        "new_candidate_fingerprint": new_receipt.get("candidate_fingerprint"),
        "semantic_payload_comparison": semantic_same,
        "manifest_changed": manifest_changed,
        "manifest_changed_due_commit_provenance": manifest_changed and all(semantic_same.values()),
        "identity_changed": identity_changed,
        "old_file_hashes": old_hashes,
        "new_file_hashes": new_hashes,
    }


def write_reanchor_receipt(
    *,
    product2_commit: str,
    old_receipt: dict[str, Any],
    new_receipt: dict[str, Any],
    output_path: Path,
) -> dict[str, Any]:
    comparison = compare_candidates(old_receipt, new_receipt)
    receipt = {
        "schema_version": "siralex_product2_candidate_reanchor_v1",
        "product2_commit_sha": product2_commit,
        "original_product2_base": old_receipt.get("base_commit"),
        "comparison": comparison,
        "old_candidate": {
            "bundle_id": old_receipt.get("candidate_bundle_id"),
            "content_sha256": old_receipt.get("content_sha256"),
            "candidate_fingerprint": old_receipt.get("candidate_fingerprint"),
            "file_hashes": old_receipt.get("candidate_file_hashes"),
            "counts": old_receipt.get("candidate_counts"),
        },
        "final_candidate": {
            "bundle_id": new_receipt.get("candidate_bundle_id"),
            "content_sha256": new_receipt.get("content_sha256"),
            "candidate_fingerprint": new_receipt.get("candidate_fingerprint"),
            "file_hashes": new_receipt.get("candidate_file_hashes"),
            "counts": new_receipt.get("candidate_counts"),
        },
        "regression": new_receipt.get("search_regression"),
        "rights_closure": {
            "owner_leakage": new_receipt.get("owner_leakage_audit"),
            "product1b_checks": new_receipt.get("product1b_checks"),
        },
        "offline_tests": {
            "portable_bundle": new_receipt.get("portable_bundle"),
            "offline_install": new_receipt.get("offline_install"),
            "credits_ui": new_receipt.get("credits_ui"),
        },
        "catalog_simulation": new_receipt.get("catalog_simulation"),
        "p_gates": new_receipt.get("p_gates"),
        "publication_authorized": False,
        "prior_authorization_worksheet_status": (
            "SUPERSEDED_UNAUTHORIZED_CANDIDATE"
            if comparison["identity_changed"]
            else "SUPERSEDED_UNCHANGED_IDENTITY"
        ),
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    write_json(output_path, receipt)
    receipt["receipt_sha256"] = sha256_file(output_path)
    write_json(output_path, receipt)
    return receipt
