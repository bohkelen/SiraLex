"""Stable logical lexical continuity prototype (local / non-canonical)."""

from __future__ import annotations

import hashlib
from typing import Any

from malipense_version_delta.canonical_json import canonical_dumps

from ..model import (
    CONTINUITY_DETERMINISTIC,
    CONTINUITY_LEGACY_RETAINED,
    CONTINUITY_UNRESOLVED,
)
from ..paths import FROZEN_ACCEPTANCE_SHA256

LOGICAL_SCHEMA = "malidaba_logical_lexical_continuity_v1"
SOURCE_ID_MALIPENSE = "src_malipense"
RIGHTS_CC_BY_NC_SA = "CC BY-NC-SA 4.0"


def logical_lexical_id(
    *,
    baseline_ir_ids: list[str],
    current_ir_ids: list[str],
    continuity_status: str,
) -> str:
    """
    Deterministic logical identity above edition-specific records.

    Must NOT be derived from headword alone or source_record_id alone.
    """
    payload = {
        "schema": LOGICAL_SCHEMA,
        "source_id": SOURCE_ID_MALIPENSE,
        "frozen_acceptance_sha256": FROZEN_ACCEPTANCE_SHA256,
        "baseline_ir_ids": sorted(baseline_ir_ids),
        "current_ir_ids": sorted(current_ir_ids),
        "continuity_status": continuity_status,
    }
    digest = hashlib.sha256(canonical_dumps(payload).encode("utf-8")).hexdigest()[:24]
    return f"llx_{digest}"


def reject_headword_only_identity(headword: str) -> str:
    """Documented non-identity: headword alone is insufficient."""
    raise ValueError(
        f"headword_alone_cannot_create_logical_identity:{headword!r}"
    )


def reject_source_record_id_only_identity(source_record_id: str) -> str:
    """Documented non-identity: source_record_id alone is insufficient."""
    raise ValueError(
        f"source_record_id_alone_cannot_create_logical_identity:"
        f"{source_record_id!r}"
    )


def build_continuity_object(
    *,
    baseline_ir_ids: list[str],
    current_ir_ids: list[str],
    continuity_status: str,
    edition_assertions: list[dict[str, Any]] | None = None,
    provenance: dict[str, Any] | None = None,
) -> dict[str, Any]:
    lid = logical_lexical_id(
        baseline_ir_ids=baseline_ir_ids,
        current_ir_ids=current_ir_ids,
        continuity_status=continuity_status,
    )
    return {
        "schema_version": LOGICAL_SCHEMA,
        "logical_lexical_id": lid,
        "source_id": SOURCE_ID_MALIPENSE,
        "baseline_ir_ids": sorted(baseline_ir_ids),
        "current_ir_ids": sorted(current_ir_ids),
        "continuity_status": continuity_status,
        "edition_assertions": edition_assertions or [],
        "provenance": provenance or {},
        "rights_status": {
            "claimed_license": RIGHTS_CC_BY_NC_SA,
            "inherited_from": SOURCE_ID_MALIPENSE,
            "commercial_distribution": "blocked",
        },
    }


def deterministic_continuity_from_proposal(
    proposal: dict[str, Any],
    *,
    baseline_record: dict[str, Any] | None,
    current_record: dict[str, Any] | None,
    assertion_rows: list[dict[str, Any]],
) -> dict[str, Any]:
    baseline_id = str(proposal["baseline_ir_id"])
    current_id = str(proposal["candidate_current_ir_id"])
    return build_continuity_object(
        baseline_ir_ids=[baseline_id],
        current_ir_ids=[current_id],
        continuity_status=CONTINUITY_DETERMINISTIC,
        edition_assertions=assertion_rows,
        provenance={
            "kind": "f16_deterministic_remap_proposal",
            "migration_subject_id": proposal.get("migration_subject_id"),
            "identity_confidence": proposal.get("identity_confidence"),
            "proposal_status": proposal.get("proposal_status"),
            "baseline_edition_ir_id": baseline_id,
            "current_edition_ir_id": current_id,
            "baseline_present": baseline_record is not None,
            "current_present": current_record is not None,
        },
    )


def legacy_retained_continuity(
    *,
    baseline_ir_id: str,
    assertion_rows: list[dict[str, Any]],
    human_decision: str,
) -> dict[str, Any]:
    return build_continuity_object(
        baseline_ir_ids=[baseline_ir_id],
        current_ir_ids=[],
        continuity_status=CONTINUITY_LEGACY_RETAINED,
        edition_assertions=assertion_rows,
        provenance={
            "kind": "human_type_b_retain_baseline_record",
            "human_decision": human_decision,
            "baseline_edition_ir_id": baseline_ir_id,
            "current_edition_attribution": False,
            "note": (
                "Legacy Malidaba evidence retained through transition; "
                "not attributed as a current-edition assertion."
            ),
        },
    )


def unresolved_type_a_placeholder(
    *,
    baseline_ir_id: str,
    migration_subject_id: str,
    candidate_current_ir_ids: list[str],
) -> dict[str, Any]:
    return build_continuity_object(
        baseline_ir_ids=[baseline_ir_id],
        current_ir_ids=[],
        continuity_status=CONTINUITY_UNRESOLVED,
        edition_assertions=[],
        provenance={
            "kind": "type_a_continuity_pending_human_v2",
            "migration_subject_id": migration_subject_id,
            "candidate_current_ir_ids": list(candidate_current_ir_ids),
        },
    )


def multi_current_continuity(
    *,
    baseline_ir_id: str,
    current_ir_ids: list[str],
    continuity_status: str,
    assertion_rows: list[dict[str, Any]] | None = None,
    provenance: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """One baseline → one or more current assertions (no record merge)."""
    if len(current_ir_ids) < 1:
        raise ValueError("multi_current_continuity_requires_at_least_one_current_id")
    return build_continuity_object(
        baseline_ir_ids=[baseline_ir_id],
        current_ir_ids=list(current_ir_ids),
        continuity_status=continuity_status,
        edition_assertions=assertion_rows or [],
        provenance=provenance or {"kind": "one_to_many_continuity"},
    )
