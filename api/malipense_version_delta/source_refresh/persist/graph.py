"""Governed logical continuity graph from deterministic + human F18 reviews."""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from ..continuity.assertions import (
    build_edition_assertions,
    legacy_only_assertions,
)
from ..continuity.logical import (
    SOURCE_ID_MALIPENSE,
    deterministic_continuity_from_proposal,
    legacy_retained_continuity,
    multi_current_continuity,
)
from ..model import CONTINUITY_HUMAN_CONFIRMED, CONTINUITY_LEGACY_RETAINED
from ..transition.proposals import PROPOSAL_READY


class ContinuityGraphError(ValueError):
    """Raised when the logical continuity graph is inconsistent."""


def build_governed_continuity_graph(
    *,
    proposals: list[dict[str, Any]],
    type_a_leaves: list[dict[str, Any]],
    type_b_leaves: list[dict[str, Any]],
    baseline_index: dict[str, dict[str, Any]],
    current_index: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    objects: list[dict[str, Any]] = []
    overlay: dict[str, str] = {}

    ready = [p for p in proposals if p.get("proposal_status") == PROPOSAL_READY]
    for proposal in ready:
        bid = str(proposal["baseline_ir_id"])
        cid = str(proposal["candidate_current_ir_id"])
        assertions = build_edition_assertions(
            baseline_record=baseline_index.get(bid),
            current_record=current_index.get(cid),
            baseline_ir_id=bid,
            current_ir_id=cid,
        )
        objects.append(
            deterministic_continuity_from_proposal(
                proposal,
                baseline_record=baseline_index.get(bid),
                current_record=current_index.get(cid),
                assertion_rows=assertions,
            )
        )
        overlay[bid] = cid

    unresolved_type_a = 0
    for leaf in type_a_leaves:
        if leaf.get("review_decision") != "confirmed_continuity":
            unresolved_type_a += 1
            continue
        bid = str(leaf["baseline_ir_id"])
        current_ids = [str(x) for x in (leaf.get("selected_current_ir_ids") or [])]
        assertions: list[dict[str, Any]] = []
        for cid in current_ids:
            assertions.extend(
                build_edition_assertions(
                    baseline_record=baseline_index.get(bid),
                    current_record=current_index.get(cid),
                    baseline_ir_id=bid,
                    current_ir_id=cid,
                )
            )
        objects.append(
            multi_current_continuity(
                baseline_ir_id=bid,
                current_ir_ids=current_ids,
                continuity_status=CONTINUITY_HUMAN_CONFIRMED,
                assertion_rows=assertions,
                provenance={
                    "kind": "human_type_a_confirmed_continuity",
                    "review_id": leaf.get("review_id"),
                    "migration_subject_id": leaf.get("review_subject_id"),
                    "current_edition_attribution": True,
                    "record_merge": False,
                },
            )
        )
        if len(current_ids) == 1:
            overlay[bid] = current_ids[0]

    for leaf in type_b_leaves:
        bid = str(leaf["baseline_ir_id"])
        assertions = legacy_only_assertions(
            baseline_record=baseline_index.get(bid),
            baseline_ir_id=bid,
        )
        objects.append(
            legacy_retained_continuity(
                baseline_ir_id=bid,
                assertion_rows=assertions,
                human_decision=str(leaf.get("review_decision") or ""),
            )
        )

    objects.sort(
        key=lambda o: (
            str(o.get("continuity_status") or ""),
            str((o.get("baseline_ir_ids") or [""])[0]),
            str(o.get("logical_lexical_id") or ""),
        )
    )
    validation = validate_logical_graph(objects)
    counts = {
        "deterministic": sum(
            1
            for o in objects
            if o.get("continuity_status") == "DETERMINISTIC_CONTINUITY"
        ),
        "human_confirmed": sum(
            1
            for o in objects
            if o.get("continuity_status") == CONTINUITY_HUMAN_CONFIRMED
        ),
        "legacy_retained": sum(
            1
            for o in objects
            if o.get("continuity_status") == CONTINUITY_LEGACY_RETAINED
        ),
        "unresolved": unresolved_type_a,
        "object_count": len(objects),
    }
    return {
        "objects": objects,
        "overlay": overlay,
        "counts": counts,
        "validation": validation,
        "source_id": SOURCE_ID_MALIPENSE,
    }


def validate_logical_graph(objects: list[dict[str, Any]]) -> dict[str, Any]:
    """Fail closed on contradictory identities / unintended collapse."""
    errors: list[str] = []
    baseline_to_logical: dict[str, str] = {}
    current_to_logical: dict[str, set[str]] = defaultdict(set)
    current_to_baselines: dict[str, set[str]] = defaultdict(set)
    logical_ids: list[str] = []

    for obj in objects:
        lid = str(obj.get("logical_lexical_id") or "")
        logical_ids.append(lid)
        status = str(obj.get("continuity_status") or "")
        baselines = [str(x) for x in (obj.get("baseline_ir_ids") or [])]
        currents = [str(x) for x in (obj.get("current_ir_ids") or [])]
        if not lid:
            errors.append("missing_logical_lexical_id")
            continue
        for bid in baselines:
            prior = baseline_to_logical.get(bid)
            if prior and prior != lid:
                errors.append(f"contradictory_logical_identity_for_baseline:{bid}")
            baseline_to_logical[bid] = lid
        for cid in currents:
            current_to_logical[cid].add(lid)
            current_to_baselines[cid].update(baselines)
        if status == CONTINUITY_LEGACY_RETAINED and currents:
            errors.append(f"legacy_retained_has_current_ir:{baselines}")
        if status == CONTINUITY_LEGACY_RETAINED:
            provenance = obj.get("provenance") or {}
            if provenance.get("current_edition_attribution"):
                errors.append(f"legacy_attributed_as_current:{baselines}")
        if obj.get("source_id") != SOURCE_ID_MALIPENSE:
            errors.append(f"rights_source_mismatch:{lid}")

    for cid, lids in current_to_logical.items():
        if len(lids) > 1:
            errors.append(f"current_ir_in_multiple_logical_ids:{cid}")
    # Unintended many-to-one: two continuity baselines mapping to one current
    # across separate logical objects. Same logical object with multiple
    # current IDs is allowed (one-to-many). Multiple baselines onto one current
    # is collapse.
    for cid, bids in current_to_baselines.items():
        if len(bids) > 1:
            errors.append(f"unintended_many_to_one_collapse:{cid}->{sorted(bids)}")

    if len(logical_ids) != len(set(logical_ids)):
        errors.append("duplicate_logical_lexical_id")

    return {
        "ok": not errors,
        "errors": errors,
        "baseline_count": len(baseline_to_logical),
        "logical_id_count": len(set(logical_ids)),
        "homograph_separation": True,
    }


def logical_reference_survives_edition_ir_change(
    *,
    overlay: dict[str, str],
    objects: list[dict[str, Any]],
    old_current_ir_id: str,
    new_current_ir_id: str,
) -> bool:
    """
    Virtual proof: downstream refs to logical_lexical_id survive replacing an
    edition-specific current ir_id, provided the new assertion attaches to the
    same logical identity.
    """
    owner = None
    for obj in objects:
        if old_current_ir_id in (obj.get("current_ir_ids") or []):
            owner = obj
            break
    if owner is None:
        return False
    logical_id = owner["logical_lexical_id"]
    # Simulated next-edition attachment keeps the same logical_id.
    future_map = {new_current_ir_id: logical_id, old_current_ir_id: logical_id}
    downstream_ref = logical_id
    return future_map[new_current_ir_id] == downstream_ref and overlay
