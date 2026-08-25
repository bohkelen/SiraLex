"""Provisional G9 under VERSIONED LEXICAL CONTINUITY (F17)."""

from __future__ import annotations

from collections import Counter
from typing import Any

from ..model import (
    DESTRUCTIVE_AMBIGUOUS,
    DESTRUCTIVE_EQUIVALENT,
    DESTRUCTIVE_NOT_VISIBLE,
    DESTRUCTIVE_REQUIRES_REVIEW,
    DESTRUCTIVE_RETAINED,
    GateResult,
)

# Non-destructive dispositions under versioned continuity.
G9_CONTINUITY_PASS_DISPOSITIONS = frozenset(
    {
        DESTRUCTIVE_EQUIVALENT,
        DESTRUCTIVE_NOT_VISIBLE,
        DESTRUCTIVE_RETAINED,
    }
)

G9_CONTINUITY_BLOCK_DISPOSITIONS = frozenset(
    {
        DESTRUCTIVE_REQUIRES_REVIEW,
        DESTRUCTIVE_AMBIGUOUS,
        "ACCEPT_SOURCE_REMOVAL",
        "NEEDS_MORE_EVIDENCE",
    }
)


def apply_human_type_b_dispositions(
    f15_dispositions: list[dict[str, Any]],
    *,
    retain_baseline_ir_ids: set[str],
    accept_removal_ir_ids: set[str] | None = None,
    needs_more_evidence_ir_ids: set[str] | None = None,
) -> list[dict[str, Any]]:
    """
    Overlay human Type-B decisions onto F15 dispositions without rewriting F15.

    retain_baseline_record → RETAIN_BASELINE_RECORD (non-destructive).
    """
    accept_removal_ir_ids = accept_removal_ir_ids or set()
    needs_more_evidence_ir_ids = needs_more_evidence_ir_ids or set()
    out: list[dict[str, Any]] = []
    for row in f15_dispositions:
        bid = str(row.get("baseline_ir_id") or "")
        updated = dict(row)
        if bid in retain_baseline_ir_ids:
            updated["disposition"] = DESTRUCTIVE_RETAINED
            updated["reason"] = "human_retain_baseline_record"
            updated["human_decision"] = "retain_baseline_record"
            updated["f15_disposition"] = row.get("disposition")
        elif bid in accept_removal_ir_ids:
            updated["disposition"] = "ACCEPT_SOURCE_REMOVAL"
            updated["reason"] = "human_accept_source_removal"
            updated["human_decision"] = "accept_source_removal"
            updated["f15_disposition"] = row.get("disposition")
        elif bid in needs_more_evidence_ir_ids:
            updated["disposition"] = "NEEDS_MORE_EVIDENCE"
            updated["reason"] = "human_needs_more_evidence"
            updated["human_decision"] = "needs_more_evidence"
            updated["f15_disposition"] = row.get("disposition")
        out.append(updated)
    return out


def evaluate_g9_versioned_continuity(
    dispositions: list[dict[str, Any]],
) -> tuple[GateResult, dict[str, int]]:
    """
    G9 under VERSIONED CONTINUITY MODEL:

    PASS when every absent baseline record is:
      CURRENT_EQUIVALENT_RESOLVED | NOT_PRODUCT_VISIBLE | RETAIN_BASELINE_RECORD

    BLOCK on unreviewed destructive / ambiguous / needs_more_evidence /
    ungoverened accept_source_removal.
    """
    counts: Counter[str] = Counter()
    for row in dispositions:
        counts[str(row.get("disposition") or "")] += 1

    count_dict = {
        "missing_evidence_total": len(dispositions),
        "current_equivalent_resolved": counts.get(DESTRUCTIVE_EQUIVALENT, 0),
        "not_product_visible": counts.get(DESTRUCTIVE_NOT_VISIBLE, 0),
        "retain_baseline_record": counts.get(DESTRUCTIVE_RETAINED, 0),
        "destructive_requires_review": counts.get(DESTRUCTIVE_REQUIRES_REVIEW, 0),
        "ambiguous": counts.get(DESTRUCTIVE_AMBIGUOUS, 0),
        "accept_source_removal": counts.get("ACCEPT_SOURCE_REMOVAL", 0),
        "needs_more_evidence": counts.get("NEEDS_MORE_EVIDENCE", 0),
        "destructive_unresolved": (
            counts.get(DESTRUCTIVE_REQUIRES_REVIEW, 0)
            + counts.get(DESTRUCTIVE_AMBIGUOUS, 0)
            + counts.get("NEEDS_MORE_EVIDENCE", 0)
            + counts.get("ACCEPT_SOURCE_REMOVAL", 0)
        ),
    }

    evidence = {
        "counts": count_dict,
        "model": "VERSIONED_LEXICAL_CONTINUITY",
        "rule": (
            "G9 PASS only if every missing baseline record is "
            "CURRENT_EQUIVALENT_RESOLVED, NOT_PRODUCT_VISIBLE, or "
            "RETAIN_BASELINE_RECORD. Human retain_baseline_record is "
            "non-destructive under versioned continuity."
        ),
    }

    blocking = (
        count_dict["destructive_requires_review"]
        or count_dict["ambiguous"]
        or count_dict["needs_more_evidence"]
        or count_dict["accept_source_removal"]
    )
    if blocking:
        return (
            GateResult(
                "G9_NO_UNREVIEWED_DESTRUCTIVE_CHANGE",
                "BLOCK",
                evidence,
                (
                    "unreviewed_destructive_or_unresolved_missing:"
                    f"requires_review={count_dict['destructive_requires_review']}"
                    f";ambiguous={count_dict['ambiguous']}"
                    f";needs_more_evidence={count_dict['needs_more_evidence']}"
                    f";accept_source_removal={count_dict['accept_source_removal']}"
                ),
            ),
            count_dict,
        )

    return (
        GateResult("G9_NO_UNREVIEWED_DESTRUCTIVE_CHANGE", "PASS", evidence, None),
        count_dict,
    )
