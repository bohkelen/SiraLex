"""Cross-ontology coupling audit and future consistency validation (F16)."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from typing import Any

from malipense_version_delta.canonical_json import canonical_dumps

from ..paths import FROZEN_ACCEPTANCE_SHA256

COUNTERPART_MISSING_DISPOSITION = "missing_record_disposition"
COUNTERPART_AMBIGUOUS_REMAP = "ambiguous_reference_remap"
COUNTERPART_DETERMINISTIC_REMAP = "deterministic_remap_proposal"

CONSTRAINT_BASELINE_COUPLING = "cross_ontology_baseline_coupling"
CONSTRAINT_REMAP_AND_DISPOSITION = "downstream_remap_and_source_disposition"
CONSTRAINT_LEGACY_RETENTION = "legacy_target_requires_record_retention"

CONSISTENCY_READY = "READY"
CONSISTENCY_BLOCKED = "BLOCKED"


@dataclass(frozen=True)
class CrossReviewCoupling:
    type_a_ambiguous_count: int
    type_b_missing_count: int
    ambiguous_missing_overlap_count: int
    ambiguous_missing_overlap_baseline_ir_ids: list[str]
    deterministic_remap_missing_overlap_count: int
    deterministic_remap_missing_overlap_baseline_ir_ids: list[str]
    cross_review_group_count: int
    groups_by_baseline_ir_id: dict[str, str] = field(default_factory=dict)
    ambiguous_to_missing: dict[str, str] = field(default_factory=dict)
    remap_to_missing: dict[str, str] = field(default_factory=dict)
    missing_to_ambiguous: dict[str, str] = field(default_factory=dict)
    missing_to_remap: dict[str, str] = field(default_factory=dict)


def cross_review_group_id(baseline_ir_id: str) -> str:
    """Deterministic group id from baseline ir_id + frozen F15 acceptance identity."""
    payload = {
        "baseline_ir_id": baseline_ir_id,
        "frozen_acceptance_sha256": FROZEN_ACCEPTANCE_SHA256,
    }
    digest = hashlib.sha256(canonical_dumps(payload).encode("utf-8")).hexdigest()[:16]
    return f"crg_{digest}"


def compute_cross_review_coupling(
    *,
    ambiguous_subjects: list[dict[str, Any]],
    deterministic_remap_subjects: list[dict[str, Any]],
    missing_subjects: list[dict[str, Any]],
) -> CrossReviewCoupling:
    """Exact baseline_ir_id overlap audit across Type-A and Type-B ontologies."""
    amb_by_id = {str(s["baseline_ir_id"]): s for s in ambiguous_subjects}
    remap_by_id = {str(s["baseline_ir_id"]): s for s in deterministic_remap_subjects}
    miss_by_id = {str(s["baseline_ir_id"]): s for s in missing_subjects}

    amb_ids = set(amb_by_id)
    remap_ids = set(remap_by_id)
    miss_ids = set(miss_by_id)

    amb_miss = sorted(amb_ids & miss_ids)
    remap_miss = sorted(remap_ids & miss_ids)
    all_overlap = sorted(set(amb_miss) | set(remap_miss))

    groups = {bid: cross_review_group_id(bid) for bid in all_overlap}

    amb_to_miss = {
        bid: str(miss_by_id[bid]["baseline_ir_id"]) for bid in amb_miss
    }
    remap_to_miss = {
        bid: str(miss_by_id[bid]["baseline_ir_id"]) for bid in remap_miss
    }
    miss_to_amb = {
        bid: str(amb_by_id[bid]["migration_subject_id"]) for bid in amb_miss
    }
    miss_to_remap = {
        bid: str(remap_by_id[bid]["migration_subject_id"]) for bid in remap_miss
    }

    return CrossReviewCoupling(
        type_a_ambiguous_count=len(ambiguous_subjects),
        type_b_missing_count=len(missing_subjects),
        ambiguous_missing_overlap_count=len(amb_miss),
        ambiguous_missing_overlap_baseline_ir_ids=amb_miss,
        deterministic_remap_missing_overlap_count=len(remap_miss),
        deterministic_remap_missing_overlap_baseline_ir_ids=remap_miss,
        cross_review_group_count=len(groups),
        groups_by_baseline_ir_id=groups,
        ambiguous_to_missing=amb_to_miss,
        remap_to_missing=remap_to_miss,
        missing_to_ambiguous=miss_to_amb,
        missing_to_remap=miss_to_remap,
    )


def _cross_review_fields_for_ambiguous(
    subject: dict[str, Any],
    coupling: CrossReviewCoupling,
) -> dict[str, str]:
    bid = str(subject.get("baseline_ir_id") or "")
    if bid not in coupling.ambiguous_to_missing:
        return {
            "cross_review_group_id": "",
            "cross_review_related": "false",
            "cross_review_counterpart_type": "",
            "cross_review_counterpart_subject_id": "",
            "cross_review_constraint": "",
        }
    return {
        "cross_review_group_id": coupling.groups_by_baseline_ir_id[bid],
        "cross_review_related": "true",
        "cross_review_counterpart_type": COUNTERPART_MISSING_DISPOSITION,
        "cross_review_counterpart_subject_id": coupling.ambiguous_to_missing[bid],
        "cross_review_constraint": CONSTRAINT_BASELINE_COUPLING,
    }


def _cross_review_fields_for_missing(
    subject: dict[str, Any],
    coupling: CrossReviewCoupling,
) -> dict[str, str]:
    bid = str(subject.get("baseline_ir_id") or "")
    if bid in coupling.missing_to_ambiguous:
        return {
            "cross_review_group_id": coupling.groups_by_baseline_ir_id[bid],
            "cross_review_related": "true",
            "cross_review_counterpart_type": COUNTERPART_AMBIGUOUS_REMAP,
            "cross_review_counterpart_subject_id": coupling.missing_to_ambiguous[bid],
            "cross_review_constraint": CONSTRAINT_BASELINE_COUPLING,
        }
    if bid in coupling.missing_to_remap:
        return {
            "cross_review_group_id": coupling.groups_by_baseline_ir_id[bid],
            "cross_review_related": "true",
            "cross_review_counterpart_type": COUNTERPART_DETERMINISTIC_REMAP,
            "cross_review_counterpart_subject_id": coupling.missing_to_remap[bid],
            "cross_review_constraint": CONSTRAINT_REMAP_AND_DISPOSITION,
        }
    return {
        "cross_review_group_id": "",
        "cross_review_related": "false",
        "cross_review_counterpart_type": "",
        "cross_review_counterpart_subject_id": "",
        "cross_review_constraint": "",
    }


def annotate_ambiguous_subject(
    subject: dict[str, Any],
    coupling: CrossReviewCoupling,
) -> dict[str, Any]:
    out = dict(subject)
    out.update(_cross_review_fields_for_ambiguous(subject, coupling))
    return out


def annotate_missing_subject(
    subject: dict[str, Any],
    coupling: CrossReviewCoupling,
) -> dict[str, Any]:
    out = dict(subject)
    out.update(_cross_review_fields_for_missing(subject, coupling))
    return out


def validate_cross_review_consistency(
    *,
    type_a_decision: str | None,
    type_b_decision: str | None,
    type_a_selected_current_ir_id: str | None = None,
    type_b_selected_current_ir_id: str | None = None,
    coupled: bool = True,
) -> tuple[str, str | None]:
    """
    Pure validation of a Type-A / Type-B decision pair for overlapping baseline ir_id.

    Returns (CONSISTENCY_READY|CONSISTENCY_BLOCKED, block_reason).
    Rules apply only when coupled=True.
    """
    if not coupled:
        return CONSISTENCY_READY, None

    a = (type_a_decision or "").strip()
    b = (type_b_decision or "").strip()
    a_sel = (type_a_selected_current_ir_id or "").strip()
    b_sel = (type_b_selected_current_ir_id or "").strip()

    if not a or not b:
        return CONSISTENCY_READY, None

    # Rule A: retain_legacy_target forbids accept_source_removal
    if a == "retain_legacy_target" and b == "accept_source_removal":
        return (
            CONSISTENCY_BLOCKED,
            CONSTRAINT_LEGACY_RETENTION,
        )

    # Rule B: accept_source_removal forbids active legacy reference retention
    if b == "accept_source_removal" and a == "retain_legacy_target":
        return (
            CONSISTENCY_BLOCKED,
            CONSTRAINT_LEGACY_RETENTION,
        )

    # Rule C: confirmed_remap + current_equivalent_confirmed must agree on target
    if (
        a == "confirmed_remap"
        and b == "current_equivalent_confirmed"
        and a_sel
        and b_sel
        and a_sel != b_sel
    ):
        return (
            CONSISTENCY_BLOCKED,
            "confirmed_remap_current_equivalent_target_mismatch",
        )

    # Rule D: needs_more_evidence on either side does not authorize destructive apply
    if b == "accept_source_removal" and a == "needs_more_evidence":
        return (
            CONSISTENCY_BLOCKED,
            "needs_more_evidence_cannot_authorize_source_removal",
        )
    if a == "needs_more_evidence" and b == "accept_source_removal":
        return (
            CONSISTENCY_BLOCKED,
            "needs_more_evidence_cannot_authorize_source_removal",
        )

    # Rule E: no_current_equivalent does not authorize removal (explicit pairing check)
    if a == "no_current_equivalent" and b == "accept_source_removal":
        return (
            CONSISTENCY_BLOCKED,
            "no_current_equivalent_does_not_authorize_source_removal",
        )

    # Compatible explicit pairs
    if a == "retain_legacy_target" and b in {
        "retain_baseline_record",
        "needs_more_evidence",
    }:
        return CONSISTENCY_READY, None

    return CONSISTENCY_READY, None
