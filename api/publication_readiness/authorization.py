"""Publication authorization worksheets — semantic vs exact-byte release identity."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from malipense_version_delta.canonical_json import write_json

AUTHORIZATION_V1_SUPERSEDED_STATUS = "SUPERSEDED_PRE_EXACT_BYTE_AUTHORIZATION_CONTRACT"


def build_authorization_worksheet(
    *,
    bundle_id: str,
    content_sha256: str,
    candidate_fingerprint: str,
    file_hashes: dict[str, str],
    counts: dict[str, Any],
    rights_summary: dict[str, Any],
    product1b_checks: dict[str, Any],
    publication_readiness_decision: str,
    p_gates: dict[str, str],
) -> dict[str, Any]:
    """Legacy v1 worksheet (semantic-only fingerprint). Superseded by v2."""
    return {
        "schema_version": "siralex_publication_authorization_worksheet_v1",
        "bundle_id": bundle_id,
        "content_sha256": content_sha256,
        "candidate_fingerprint": candidate_fingerprint,
        "protected_fields": {
            "bundle_id": bundle_id,
            "records_sha256": file_hashes.get("records.jsonl"),
            "search_sha256": file_hashes.get("search_index.jsonl"),
            "manifest_sha256": file_hashes.get("bundle.manifest.json"),
            "checksums_sha256": file_hashes.get("checksums.sha256"),
            "candidate_counts": counts,
            "source_rights_summary": rights_summary,
            "product1b_checks": product1b_checks,
            "publication_readiness_decision": publication_readiness_decision,
            "p_gates": p_gates,
        },
        "publication_decision": None,
        "reviewer_id": None,
        "reviewed_at": None,
        "review_method": None,
        "notes": None,
        "allowed_decisions": [
            "authorize_noncommercial_publication",
            "reject_publication",
            "needs_more_evidence",
        ],
        "publication_authorized": False,
    }


def build_authorization_worksheet_v2(
    *,
    semantic_bundle_id: str,
    semantic_content_sha256: str,
    semantic_candidate_fingerprint: str,
    release_artifact_fingerprint: str,
    release_artifact_dir_name: str,
    distributed_file_hashes: dict[str, str],
    counts: dict[str, Any],
    rights_summary: dict[str, Any],
    product1b_checks: dict[str, Any],
    publication_readiness_decision: str,
    internal_full_regression: dict[str, Any],
    publication_candidate_regression: dict[str, Any],
    p_gates: dict[str, str],
) -> dict[str, Any]:
    """
    Blank exact-byte authorization artifact for future human approval.

    Publication authorization MUST bind release_artifact_fingerprint and every
    distributed_file_hashes entry. Semantic fingerprint alone is insufficient.
    """
    return {
        "schema_version": "siralex_publication_authorization_v2",
        "protected_fields": {
            "semantic_bundle_id": semantic_bundle_id,
            "semantic_content_sha256": semantic_content_sha256,
            "semantic_candidate_fingerprint": semantic_candidate_fingerprint,
            "release_artifact_fingerprint": release_artifact_fingerprint,
            "release_artifact_dir_name": release_artifact_dir_name,
            "distributed_file_hashes": dict(sorted(distributed_file_hashes.items())),
            "candidate_counts": counts,
            "source_rights_summary": rights_summary,
            "product1b_checks": product1b_checks,
            "publication_readiness_decision": publication_readiness_decision,
            "internal_full_regression": internal_full_regression,
            "publication_candidate_regression": publication_candidate_regression,
            "p_gates": p_gates,
        },
        "publication_decision": None,
        "reviewer_id": None,
        "reviewed_at": None,
        "review_method": None,
        "notes": None,
        "allowed_decisions": [
            "authorize_noncommercial_publication",
            "reject_publication",
            "needs_more_evidence",
        ],
        "publication_authorized": False,
    }


def write_authorization_worksheet(path: Path, worksheet: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    write_json(path, worksheet)


def validate_authorization_binds_bytes(
    worksheet: dict[str, Any],
    *,
    bundle_id: str,
    candidate_fingerprint: str,
) -> dict[str, Any]:
    """Legacy v1 validation (semantic-only)."""
    protected = worksheet.get("protected_fields") or {}
    matches = (
        protected.get("bundle_id") == bundle_id
        and worksheet.get("candidate_fingerprint") == candidate_fingerprint
        and protected.get("bundle_id") == worksheet.get("bundle_id")
    )
    return {
        "binds_exact_bytes": matches,
        "authorized_without_review": worksheet.get("publication_decision") is None,
        "can_publish": False,
    }


def validate_authorization_v2_binds_bytes(
    worksheet: dict[str, Any],
    *,
    semantic_bundle_id: str,
    semantic_content_sha256: str,
    semantic_candidate_fingerprint: str,
    release_artifact_fingerprint: str,
    distributed_file_hashes: dict[str, str],
) -> dict[str, Any]:
    """Exact-byte publication authorization validation."""
    protected = worksheet.get("protected_fields") or {}
    protected_hashes = protected.get("distributed_file_hashes") or {}
    sorted_actual = dict(sorted(distributed_file_hashes.items()))
    release_match = (
        protected.get("semantic_bundle_id") == semantic_bundle_id
        and protected.get("semantic_content_sha256") == semantic_content_sha256
        and protected.get("semantic_candidate_fingerprint") == semantic_candidate_fingerprint
        and protected.get("release_artifact_fingerprint") == release_artifact_fingerprint
        and protected_hashes == sorted_actual
    )
    semantic_match = (
        protected.get("semantic_candidate_fingerprint") == semantic_candidate_fingerprint
        and protected.get("semantic_content_sha256") == semantic_content_sha256
    )
    decision = worksheet.get("publication_decision")
    can_publish = (
        release_match
        and decision == "authorize_noncommercial_publication"
        and worksheet.get("publication_authorized") is True
    )
    return {
        "binds_semantic_identity": semantic_match,
        "binds_release_artifact_identity": release_match,
        "binds_exact_bytes": release_match,
        "authorized_without_review": decision is None,
        "can_publish": can_publish,
    }
