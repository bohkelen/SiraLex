from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
API_ROOT = REPO_ROOT / "api"

if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from query_evidence.models import (  # noqa: E402
    QUERY_EVIDENCE_SCHEMA,
    REVIEW_STATUS_CANDIDATE,
    QueryEvidenceCandidate,
)
from query_evidence.validate_output import validate_candidates  # noqa: E402


def _candidate(**overrides) -> QueryEvidenceCandidate:
    base = {
        "review_id": "phase7k_evidence_0001",
        "schema_version": QUERY_EVIDENCE_SCHEMA,
        "query": "fruit",
        "search_direction": "source_to_target",
        "occurrence_count": 1,
        "first_seen": "2026-06-01T00:00:00.000Z",
        "last_seen": "2026-06-02T00:00:00.000Z",
        "current_result": "hit (1)",
        "gap_class": "already_addressed",
        "priority_score": 0,
        "priority_reasons": ["monitor_only:no_action_required"],
        "resolved_ir_ids": ["7cdb6070ce427a6d"],
        "evidence_sources": ["query_log_export", "search_index_replay"],
        "recommended_destination_artifact": None,
        "review_status": REVIEW_STATUS_CANDIDATE,
        "reason_not_to_apply_automatically": "Monitor only.",
        "source_bundle_id": "bundle-a",
        "source_catalog_version": None,
        "related_log_event_ids": ["evt-1"],
    }
    base.update(overrides)
    return QueryEvidenceCandidate(**base)


def test_valid_candidates_return_no_errors():
    assert not validate_candidates([_candidate()])


def test_approved_rejected_deferred_rows_rejected():
    for status in ("approved", "rejected", "deferred"):
        errors = validate_candidates([_candidate(review_status=status)])
        assert any("review_status must be" in error for error in errors)


def test_invalid_gap_class_rejected():
    errors = validate_candidates([_candidate(gap_class="not_a_real_class")])
    assert any("invalid gap_class" in error for error in errors)


def test_duplicate_review_id_rejected():
    errors = validate_candidates(
        [
            _candidate(review_id="phase7k_evidence_0001"),
            _candidate(review_id="phase7k_evidence_0001", query="salut"),
        ]
    )
    assert any("duplicate review_id" in error for error in errors)


def test_empty_reason_rejected():
    errors = validate_candidates([_candidate(reason_not_to_apply_automatically="   ")])
    assert any("empty reason_not_to_apply_automatically" in error for error in errors)


def test_invalid_priority_score_rejected():
    low = validate_candidates([_candidate(priority_score=-1)])
    high = validate_candidates([_candidate(priority_score=101)])
    empty_reasons = validate_candidates(
        [_candidate(priority_score=10, priority_reasons=[])]
    )

    assert any("priority_score must be between 0 and 100" in error for error in low)
    assert any("priority_score must be between 0 and 100" in error for error in high)
    assert any("priority_reasons must be non-empty" in error for error in empty_reasons)
