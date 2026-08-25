"""Deterministic Malidaba delta review identity helpers."""

from __future__ import annotations

import hashlib
import json
import re
from typing import Any

REVIEW_ID_RE = re.compile(r"^mdrv_[a-z0-9_]{1,180}$")
SCHEMA_VERSION = "malidaba_delta_reviews_v1"
ALLOWED_REVIEW_METHODS = frozenset({"manual_review"})


def _sanitize_id_fragment(value: str) -> str:
    lowered = value.strip().lower()
    cleaned = re.sub(r"[^a-z0-9]+", "_", lowered).strip("_")
    return cleaned or "x"


def review_scope_key(row: dict[str, Any]) -> tuple[str, str, str, str, str]:
    """Frozen subject scope for same-reviewer history / current-leaf rules."""
    return (
        str(row.get("review_subject_id") or ""),
        str(row.get("reviewer_id") or ""),
        str(row.get("delta_sha256") or ""),
        str(row.get("current_ir_sha256") or ""),
        str(row.get("current_record_fingerprint_sha256") or ""),
    )


def generate_malidaba_review_id(preview: dict[str, Any]) -> str:
    """Deterministic review_id from immutable review-creation fields.

    Initial reviews (no supersedes_review_id) keep the same identity payload as
    CORPUS1F13 first apply. Explicit revisions include supersedes_review_id.
    """
    digest_payload: dict[str, Any] = {
        "batch_id": preview.get("batch_id"),
        "current_ir_sha256": preview.get("current_ir_sha256"),
        "current_record_fingerprint_sha256": preview.get(
            "current_record_fingerprint_sha256"
        ),
        "delta_sha256": preview.get("delta_sha256"),
        "issue_codes": preview.get("issue_codes") or [],
        "review_decision": preview.get("review_decision"),
        "review_method": preview.get("review_method"),
        "review_notes": preview.get("review_notes") or "",
        "review_subject_id": preview.get("review_subject_id"),
        "reviewed_at": preview.get("reviewed_at"),
        "reviewer_id": preview.get("reviewer_id"),
        "schema_version": SCHEMA_VERSION,
    }
    supersedes = preview.get("supersedes_review_id")
    if isinstance(supersedes, str) and supersedes.strip():
        digest_payload["supersedes_review_id"] = supersedes.strip()

    canonical = json.dumps(
        digest_payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False
    )
    digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()[:12]
    subject = _sanitize_id_fragment(str(preview.get("review_subject_id", "")))
    subject = subject[:48]
    candidate = f"mdrv_{subject}_{digest}"
    if REVIEW_ID_RE.match(candidate):
        return candidate
    return f"mdrv_{_sanitize_id_fragment(subject)}_{digest}"
