"""Deterministic review identity for F18 Type-A / Type-B registries."""

from __future__ import annotations

import hashlib
import re
from typing import Any

from malipense_version_delta.canonical_json import canonical_dumps

TYPE_A_SCHEMA = "malidaba_continuity_reviews_v1"
TYPE_B_SCHEMA = "malidaba_missing_disposition_reviews_v1"

TYPE_A_ID_RE = re.compile(r"^mcrv_[a-z0-9_]{1,180}$")
TYPE_B_ID_RE = re.compile(r"^mmrv_[a-z0-9_]{1,180}$")

ALLOWED_REVIEW_METHODS = frozenset({"manual_review"})


def _sanitize_id_fragment(value: str) -> str:
    lowered = value.strip().lower()
    cleaned = re.sub(r"[^a-z0-9]+", "_", lowered).strip("_")
    return cleaned or "x"


def review_scope_key(row: dict[str, Any]) -> tuple[str, str, str, str]:
    """Frozen subject scope for same-reviewer history / current-leaf rules."""
    fingerprint = str(
        row.get("continuity_subject_fingerprint")
        or row.get("subject_fingerprint")
        or ""
    )
    return (
        str(row.get("review_subject_id") or ""),
        str(row.get("reviewer_id") or ""),
        str(row.get("frozen_acceptance_sha256") or ""),
        fingerprint,
    )


def generate_review_id(preview: dict[str, Any], *, schema_version: str) -> str:
    digest_payload: dict[str, Any] = {
        "batch_id": preview.get("batch_id"),
        "frozen_acceptance_sha256": preview.get("frozen_acceptance_sha256"),
        "issue_codes": preview.get("issue_codes") or [],
        "review_decision": preview.get("review_decision"),
        "review_method": preview.get("review_method"),
        "review_notes": preview.get("review_notes") or "",
        "review_subject_id": preview.get("review_subject_id"),
        "reviewed_at": preview.get("reviewed_at"),
        "reviewer_id": preview.get("reviewer_id"),
        "schema_version": schema_version,
        "selected_current_ir_ids": preview.get("selected_current_ir_ids") or [],
        "selected_current_ir_id": preview.get("selected_current_ir_id") or "",
        "continuity_subject_fingerprint": preview.get(
            "continuity_subject_fingerprint"
        ),
        "subject_fingerprint": preview.get("subject_fingerprint"),
        "baseline_ir_id": preview.get("baseline_ir_id"),
    }
    supersedes = preview.get("supersedes_review_id")
    if isinstance(supersedes, str) and supersedes.strip():
        digest_payload["supersedes_review_id"] = supersedes.strip()

    digest = hashlib.sha256(canonical_dumps(digest_payload).encode("utf-8")).hexdigest()[
        :12
    ]
    subject = _sanitize_id_fragment(str(preview.get("review_subject_id", "")))[:48]
    if schema_version == TYPE_A_SCHEMA:
        candidate = f"mcrv_{subject}_{digest}"
        return candidate if TYPE_A_ID_RE.match(candidate) else f"mcrv_x_{digest}"
    candidate = f"mmrv_{subject}_{digest}"
    return candidate if TYPE_B_ID_RE.match(candidate) else f"mmrv_x_{digest}"
