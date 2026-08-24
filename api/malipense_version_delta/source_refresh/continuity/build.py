"""Local/gitignored virtual continuity build (non-canonical)."""

from __future__ import annotations

from typing import Any

from malipense_version_delta.canonical_json import write_json, write_jsonl
from malipense_version_delta.compare import load_jsonl_records

from ..model import CONTINUITY_DETERMINISTIC, CONTINUITY_LEGACY_RETAINED
from ..paths import SourceRefreshPaths
from ..transition.proposals import PROPOSAL_READY
from ..transition.virtual_overlay import run_virtual_overlay
from .assertions import (
    assertion_summary,
    build_edition_assertions,
    legacy_only_assertions,
)
from .logical import (
    deterministic_continuity_from_proposal,
    legacy_retained_continuity,
    unresolved_type_a_placeholder,
)
from .type_b import TYPE_B_REVIEW_DECISION


def build_virtual_continuity(
    paths: SourceRefreshPaths,
    *,
    proposals: list[dict[str, Any]],
    ambiguous_subjects: list[dict[str, Any]],
    missing_subjects: list[dict[str, Any]],
    baseline_index: dict[str, dict[str, Any]],
    current_index: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    """
    Build local continuity objects:

    - 10 deterministic continuity mappings (PROPOSAL_READY)
    - 42 legacy-retained objects (human Type-B)
    - 5 unresolved Type-A placeholders (no fabricated resolution)
    """
    out_dir = paths.f17_dir / "virtual"
    out_dir.mkdir(parents=True, exist_ok=True)

    ready = [p for p in proposals if p.get("proposal_status") == PROPOSAL_READY]
    continuity_objects: list[dict[str, Any]] = []
    assertion_totals = {
        "BOTH_EDITIONS_ASSERTION": 0,
        "CURRENT_ASSERTION": 0,
        "LEGACY_SUPPORTED_ASSERTION": 0,
        "CONFLICTING_ASSERTIONS": 0,
        "NEEDS_REVIEW": 0,
    }

    for proposal in ready:
        bid = str(proposal["baseline_ir_id"])
        cid = str(proposal["candidate_current_ir_id"])
        b_rec = baseline_index.get(bid)
        c_rec = current_index.get(cid)
        assertions = build_edition_assertions(
            baseline_record=b_rec,
            current_record=c_rec,
            baseline_ir_id=bid,
            current_ir_id=cid,
        )
        for key, n in assertion_summary(assertions).items():
            assertion_totals[key] = assertion_totals.get(key, 0) + n
        continuity_objects.append(
            deterministic_continuity_from_proposal(
                proposal,
                baseline_record=b_rec,
                current_record=c_rec,
                assertion_rows=assertions,
            )
        )

    for subject in missing_subjects:
        bid = str(subject["baseline_ir_id"])
        b_rec = baseline_index.get(bid)
        assertions = legacy_only_assertions(
            baseline_record=b_rec, baseline_ir_id=bid
        )
        for key, n in assertion_summary(assertions).items():
            assertion_totals[key] = assertion_totals.get(key, 0) + n
        continuity_objects.append(
            legacy_retained_continuity(
                baseline_ir_id=bid,
                assertion_rows=assertions,
                human_decision=TYPE_B_REVIEW_DECISION,
            )
        )

    unresolved: list[dict[str, Any]] = []
    for subject in ambiguous_subjects:
        obj = unresolved_type_a_placeholder(
            baseline_ir_id=str(subject["baseline_ir_id"]),
            migration_subject_id=str(subject["migration_subject_id"]),
            candidate_current_ir_ids=list(subject.get("candidate_current_ir_ids") or []),
        )
        unresolved.append(obj)
        continuity_objects.append(obj)

    continuity_objects.sort(
        key=lambda o: (
            str(o.get("continuity_status") or ""),
            str((o.get("baseline_ir_ids") or [""])[0]),
            str(o.get("logical_lexical_id") or ""),
        )
    )

    continuity_path = out_dir / "logical_lexical_continuity.jsonl"
    write_jsonl(continuity_path, continuity_objects)

    # Overlay map for virtual G7/G8: deterministic remaps only (not Type-A).
    overlay = {
        str(p["baseline_ir_id"]): str(p["candidate_current_ir_id"])
        for p in ready
        if p.get("candidate_current_ir_id")
    }
    ambiguous_ids = {str(s["baseline_ir_id"]) for s in ambiguous_subjects}
    missing_ids = {str(s["baseline_ir_id"]) for s in missing_subjects}

    virtual = run_virtual_overlay(
        paths,
        overlay=overlay,
        proposals=proposals,
        ambiguous_baseline_ids=ambiguous_ids,
        missing_baseline_ids=missing_ids,
        virtual_dir=out_dir,
    )

    # Logical reference map prototype (virtual only; no canonical migration).
    logical_map = []
    for obj in continuity_objects:
        if obj.get("continuity_status") in {
            CONTINUITY_DETERMINISTIC,
            CONTINUITY_LEGACY_RETAINED,
        }:
            for bid in obj.get("baseline_ir_ids") or []:
                logical_map.append(
                    {
                        "edition_ir_id": bid,
                        "edition": "baseline",
                        "logical_lexical_id": obj["logical_lexical_id"],
                        "continuity_status": obj["continuity_status"],
                    }
                )
            for cid in obj.get("current_ir_ids") or []:
                logical_map.append(
                    {
                        "edition_ir_id": cid,
                        "edition": "current",
                        "logical_lexical_id": obj["logical_lexical_id"],
                        "continuity_status": obj["continuity_status"],
                    }
                )
    logical_map_path = out_dir / "edition_ir_to_logical_lexical_id.jsonl"
    write_jsonl(logical_map_path, logical_map)

    summary = {
        "deterministic_continuity_subjects": len(ready),
        "legacy_retained_subjects": len(missing_subjects),
        "unresolved_type_a_subjects": len(unresolved),
        "continuity_object_count": len(continuity_objects),
        "assertion_class_totals": assertion_totals,
        "logical_map_entries": len(logical_map),
        "continuity_path": str(continuity_path),
        "logical_map_path": str(logical_map_path),
        "virtual_dir": str(out_dir),
        "g7_before": virtual["g7_before"],
        "g7_after": virtual["g7_after"],
        "regression_before": virtual["regression_before"],
        "regression_after": virtual["regression_after"],
        "tracked_artifact_mutation": virtual["tracked_artifact_mutation"],
        "overlay_size": virtual["overlay_size"],
        "virtual_rewrites": virtual["virtual_rewrites"],
    }
    write_json(out_dir / "continuity_build_summary.json", summary)
    return summary


def load_f15_destructive_dispositions(paths: SourceRefreshPaths) -> list[dict[str, Any]]:
    return load_jsonl_records(paths.destructive_manifest)
