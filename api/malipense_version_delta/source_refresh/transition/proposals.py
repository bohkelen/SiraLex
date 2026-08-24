"""Deterministic downstream ir_id remap proposals (evidence only)."""

from __future__ import annotations

from collections import Counter
from typing import Any

from ..model import RESOLUTION_AMBIGUOUS, RESOLUTION_REMAP

# F11 PROVISIONAL is exposed as UNIQUE_PROVISIONAL in F16 (weaker explicit label).
ALLOWED_PROPOSAL_CONFIDENCES = frozenset(
    {"STRONG", "EXACT_CONTENT_SUPPORTED", "UNIQUE_PROVISIONAL"}
)

PROPOSAL_READY = "PROPOSAL_READY"
PROPOSAL_AMBIGUOUS_NO_AUTO = "AMBIGUOUS_NO_AUTOMATIC_PROPOSAL"
PROPOSAL_BLOCKED_TARGET_MISSING = "BLOCKED_TARGET_MISSING"
PROPOSAL_BLOCKED_MANY_TO_ONE = "BLOCKED_MANY_TO_ONE"
PROPOSAL_BLOCKED_INCOMPATIBLE = "BLOCKED_HEADWORD_INCOMPATIBLE"
PROPOSAL_BLOCKED_CONFIDENCE = "BLOCKED_CONFIDENCE_NOT_ALLOWED"
PROPOSAL_BLOCKED_CANDIDATE_COUNT = "BLOCKED_CANDIDATE_COUNT"


def _normalize_confidence(raw: str | None) -> str:
    conf = str(raw or "")
    if conf == "PROVISIONAL":
        return "UNIQUE_PROVISIONAL"
    return conf


def build_remap_proposals(
    subjects: list[dict[str, Any]],
    *,
    current_index: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    """
    Emit one proposal row per migration subject.

    Only REQUIRES_REMAP subjects may become PROPOSAL_READY.
    AMBIGUOUS subjects never receive an automatic remap.
    """
    # Pre-scan remap targets for many-to-one collapse among READY candidates.
    provisional_pairs: list[tuple[str, str, dict[str, Any]]] = []
    for subject in subjects:
        if subject.get("f15_resolution_status") != RESOLUTION_REMAP:
            continue
        cands = list(subject.get("candidate_current_ir_ids") or [])
        if len(cands) != 1:
            continue
        conf = _normalize_confidence(subject.get("identity_confidence"))
        if conf not in ALLOWED_PROPOSAL_CONFIDENCES:
            continue
        target = cands[0]
        if target not in current_index:
            continue
        baseline_hw = subject.get("baseline_headword")
        target_hw = (current_index[target].get("fields_raw") or {}).get("headword_latin")
        if baseline_hw != target_hw:
            continue
        provisional_pairs.append((str(subject["baseline_ir_id"]), str(target), subject))

    target_counts = Counter(target for _, target, _ in provisional_pairs)
    blocked_targets = {t for t, n in target_counts.items() if n > 1}

    proposals: list[dict[str, Any]] = []
    for subject in subjects:
        status = subject.get("f15_resolution_status")
        cands = list(subject.get("candidate_current_ir_ids") or [])
        conf = _normalize_confidence(subject.get("identity_confidence"))
        evidence = subject.get("f11_evidence_basis") or {}

        row: dict[str, Any] = {
            "migration_subject_id": subject["migration_subject_id"],
            "baseline_ir_id": subject["baseline_ir_id"],
            "candidate_current_ir_id": None,
            "identity_confidence": conf,
            "evidence_basis": evidence,
            "affected_reference_count": subject.get("affected_reference_count"),
            "affected_references": subject.get("affected_references"),
            "proposal_status": None,
            "block_reason": None,
            "f15_resolution_status": status,
        }

        if status == RESOLUTION_AMBIGUOUS:
            row["proposal_status"] = PROPOSAL_AMBIGUOUS_NO_AUTO
            row["block_reason"] = "ambiguous_requires_human_remap_review"
            proposals.append(row)
            continue

        if status != RESOLUTION_REMAP:
            row["proposal_status"] = PROPOSAL_BLOCKED_CONFIDENCE
            row["block_reason"] = f"unexpected_status:{status}"
            proposals.append(row)
            continue

        if len(cands) != 1:
            row["proposal_status"] = PROPOSAL_BLOCKED_CANDIDATE_COUNT
            row["block_reason"] = f"expected_exactly_one_candidate_got_{len(cands)}"
            proposals.append(row)
            continue

        target = str(cands[0])
        row["candidate_current_ir_id"] = target

        if conf not in ALLOWED_PROPOSAL_CONFIDENCES:
            row["proposal_status"] = PROPOSAL_BLOCKED_CONFIDENCE
            row["block_reason"] = f"confidence_not_allowed:{conf}"
            proposals.append(row)
            continue

        if target not in current_index:
            row["proposal_status"] = PROPOSAL_BLOCKED_TARGET_MISSING
            row["block_reason"] = "candidate_current_ir_id_absent_from_frozen_current_ir"
            proposals.append(row)
            continue

        baseline_hw = subject.get("baseline_headword")
        target_hw = (current_index[target].get("fields_raw") or {}).get("headword_latin")
        if baseline_hw != target_hw:
            row["proposal_status"] = PROPOSAL_BLOCKED_INCOMPATIBLE
            row["block_reason"] = "baseline_and_candidate_headword_differ"
            proposals.append(row)
            continue

        if target in blocked_targets:
            row["proposal_status"] = PROPOSAL_BLOCKED_MANY_TO_ONE
            row["block_reason"] = (
                "multiple_baseline_ir_ids_would_collapse_onto_same_current_ir_id"
            )
            proposals.append(row)
            continue

        row["proposal_status"] = PROPOSAL_READY
        row["block_reason"] = None
        proposals.append(row)

    proposals.sort(key=lambda r: (str(r.get("baseline_ir_id") or ""), str(r.get("migration_subject_id") or "")))
    return proposals


def ready_overlay_map(proposals: list[dict[str, Any]]) -> dict[str, str]:
    """Return baseline→current map for PROPOSAL_READY rows only."""
    out: dict[str, str] = {}
    for row in proposals:
        if row.get("proposal_status") != PROPOSAL_READY:
            continue
        baseline = row.get("baseline_ir_id")
        current = row.get("candidate_current_ir_id")
        if baseline and current:
            out[str(baseline)] = str(current)
    return out
