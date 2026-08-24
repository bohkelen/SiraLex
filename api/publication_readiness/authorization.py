"""Publication authorization worksheet — blank template binding exact bytes."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from malipense_version_delta.canonical_json import write_json


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
    """
    Blank authorization artifact for future human approval.

    PRODUCT2 does not fill publication_decision or persist authorization.
    """
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


def write_authorization_worksheet(path: Path, worksheet: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    write_json(path, worksheet)


def validate_authorization_binds_bytes(
    worksheet: dict[str, Any],
    *,
    bundle_id: str,
    candidate_fingerprint: str,
) -> dict[str, Any]:
    """Future authorization is invalid if candidate bytes change."""
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
