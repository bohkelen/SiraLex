"""Validation for query evidence candidate output rows."""

from __future__ import annotations

from .models import REVIEW_STATUS_CANDIDATE, VALID_GAP_CLASSES, QueryEvidenceCandidate


def validate_candidates(candidates: list[QueryEvidenceCandidate]) -> list[str]:
    errors: list[str] = []
    seen_review_ids: set[str] = set()

    for index, candidate in enumerate(candidates):
        label = candidate.review_id or f"row_{index + 1}"

        if not candidate.review_id:
            errors.append(f"{label}: empty review_id")

        if candidate.review_id in seen_review_ids:
            errors.append(f"{label}: duplicate review_id {candidate.review_id!r}")
        seen_review_ids.add(candidate.review_id)

        if candidate.review_status != REVIEW_STATUS_CANDIDATE:
            errors.append(
                f"{label}: review_status must be {REVIEW_STATUS_CANDIDATE!r}, "
                f"got {candidate.review_status!r}"
            )

        if candidate.gap_class not in VALID_GAP_CLASSES:
            errors.append(f"{label}: invalid gap_class {candidate.gap_class!r}")

        if not candidate.reason_not_to_apply_automatically.strip():
            errors.append(f"{label}: empty reason_not_to_apply_automatically")

        if candidate.priority_score < 0 or candidate.priority_score > 100:
            errors.append(
                f"{label}: priority_score must be between 0 and 100, "
                f"got {candidate.priority_score}"
            )

        if candidate.priority_score > 0 and not candidate.priority_reasons:
            errors.append(f"{label}: priority_score > 0 requires priority_reasons")

        if not candidate.priority_reasons:
            errors.append(f"{label}: priority_reasons must be non-empty")

    return errors
