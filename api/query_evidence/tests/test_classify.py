from __future__ import annotations

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
API_ROOT = REPO_ROOT / "api"
FIXTURES = REPO_ROOT / "shared" / "query_evidence" / "fixtures"
GOLDEN = FIXTURES / "tests" / "golden_candidates_preview.jsonl"
FEATURED_SEARCH_INDEX = (
    REPO_ROOT
    / "web/public/bundle_full_20260616_phase7j_alias_round2_candidate/search_index.jsonl"
)

if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from query_evidence.classify import build_candidates, classify_query_group  # noqa: E402
from query_evidence.ingest import dedupe_query_events, load_query_log_exports  # noqa: E402
from query_evidence.models import (  # noqa: E402
    REVIEW_STATUS_CANDIDATE,
    DedupedQueryGroup,
    ReplayResult,
)
from query_evidence.replay import load_search_index, replay_query_groups  # noqa: E402
from query_evidence.validate_output import validate_candidates  # noqa: E402


def _group(
    *,
    query: str,
    direction: str = "source_to_target",
    occurrence_count: int = 1,
    result_status_counts: dict[str, int] | None = None,
    event_ids: list[str] | None = None,
) -> DedupedQueryGroup:
    return DedupedQueryGroup(
        query=query,
        query_casefold=query.strip().casefold(),
        direction=direction,
        bundle_id="bundle_full_20260616_phase7j_alias_round2_candidate",
        occurrence_count=occurrence_count,
        first_seen="2026-06-01T00:00:00.000Z",
        last_seen="2026-06-02T00:00:00.000Z",
        result_status_counts=result_status_counts or {"hit_single": occurrence_count},
        distinct_session_bucket_hashes=["5bfe1fbf"],
        event_ids=event_ids or ["evt-1"],
        catalog_versions=["norm-v3-featured-enriched-source-aliases-3-source-index-supplements-2"],
    )


def _replay(
    query: str,
    *,
    direction: str = "source_to_target",
    result_count: int = 1,
    resolved_ir_ids: list[str] | None = None,
) -> ReplayResult:
    ids = resolved_ir_ids if resolved_ir_ids is not None else (["ir-1"] if result_count else [])
    return ReplayResult(
        query=query,
        direction=direction,
        result_count=result_count,
        resolved_ir_ids=ids,
        matched_key_type="casefold" if result_count else "none",
        matched_key=query.strip().casefold() if result_count else None,
        current_result="miss" if result_count == 0 else f"hit ({result_count})",
    )


def test_already_addressed_for_logged_miss_and_current_replay_hit():
    group = _group(
        query="fruit",
        result_status_counts={"miss": 1, "hit_single": 1},
        occurrence_count=2,
    )
    replay = _replay("fruit", result_count=1, resolved_ir_ids=["7cdb6070ce427a6d"])
    candidate = classify_query_group(group, replay, "phase7k_evidence_0001")

    assert candidate.gap_class == "already_addressed"
    assert candidate.recommended_destination_artifact is None
    assert "miss" in candidate.reason_not_to_apply_automatically.lower()


def test_ranking_ambiguity_issue_for_replay_multi_hit():
    group = _group(
        query="mère",
        result_status_counts={"hit_multi": 2},
        occurrence_count=2,
    )
    replay = _replay(
        "mère",
        result_count=3,
        resolved_ir_ids=["0f517a71c373f51d", "d540716db9321a83", "e5164efcdf5e6ca4"],
    )
    candidate = classify_query_group(group, replay, "phase7k_evidence_0001")

    assert candidate.gap_class == "ranking_ambiguity_issue"
    assert candidate.recommended_destination_artifact == "policy_memo"


def test_target_side_issue_for_target_to_source_hit():
    group = _group(
        query="Kun",
        direction="target_to_source",
        result_status_counts={"hit_single": 1},
    )
    replay = _replay(
        "Kun",
        direction="target_to_source",
        result_count=1,
        resolved_ir_ids=["b07ae7bd61ff3c85"],
    )
    candidate = classify_query_group(group, replay, "phase7k_evidence_0001")

    assert candidate.gap_class == "target_side_issue"
    assert candidate.recommended_destination_artifact == "policy_memo"


def test_phrase_miss_candidate_for_multi_token_miss():
    group = _group(
        query="grand parents",
        result_status_counts={"miss": 1},
    )
    replay = _replay("grand parents", result_count=0, resolved_ir_ids=[])
    candidate = classify_query_group(group, replay, "phase7k_evidence_0001")

    assert candidate.gap_class == "phrase_miss_candidate"
    assert candidate.recommended_destination_artifact == (
        "shared/phrase_review/source_phrase_aliases_v1.jsonl"
    )


def test_reviewed_source_alias_candidate_for_plural_ish_single_token_miss():
    group = _group(
        query="fruits",
        result_status_counts={"miss": 1},
    )
    replay = _replay("fruits", result_count=0, resolved_ir_ids=[])
    candidate = classify_query_group(group, replay, "phase7k_evidence_0001")

    assert candidate.gap_class == "reviewed_source_alias_candidate"
    assert candidate.recommended_destination_artifact == "shared/aliases/source_aliases_v1.jsonl"


def test_true_dictionary_entry_gap_fallback_for_single_token_miss():
    group = _group(
        query="zzzz-nohit-test",
        result_status_counts={"miss": 1},
    )
    replay = _replay("zzzz-nohit-test", result_count=0, resolved_ir_ids=[])
    candidate = classify_query_group(group, replay, "phase7k_evidence_0001")

    assert candidate.gap_class == "true_dictionary_entry_gap"
    assert candidate.recommended_destination_artifact is None


def test_single_hit_monitor_fallback_as_already_addressed():
    group = _group(
        query="fruit",
        result_status_counts={"hit_single": 2},
        occurrence_count=2,
    )
    replay = _replay("fruit", result_count=1, resolved_ir_ids=["7cdb6070ce427a6d"])
    candidate = classify_query_group(group, replay, "phase7k_evidence_0001")

    assert candidate.gap_class == "already_addressed"
    assert candidate.recommended_destination_artifact is None
    assert "monitor" in candidate.reason_not_to_apply_automatically.lower()


def test_review_status_is_always_candidate():
    cases = [
        (_group(query="fruit", result_status_counts={"miss": 1, "hit_single": 1}), _replay("fruit")),
        (_group(query="mère", result_status_counts={"hit_multi": 1}), _replay("mère", result_count=3, resolved_ir_ids=["a", "b", "c"])),
        (_group(query="Kun", direction="target_to_source"), _replay("Kun", direction="target_to_source")),
    ]
    for group, replay in cases:
        candidate = classify_query_group(group, replay, "phase7k_evidence_0001")
        assert candidate.review_status == REVIEW_STATUS_CANDIDATE


def test_reason_not_to_apply_automatically_is_non_empty():
    group = _group(query="fruit", result_status_counts={"hit_single": 1})
    replay = _replay("fruit")
    candidate = classify_query_group(group, replay, "phase7k_evidence_0001")

    assert candidate.reason_not_to_apply_automatically.strip()


def test_review_ids_deterministic():
    events, _ = load_query_log_exports(
        [
            FIXTURES / "sample_export_v2.jsonl",
            FIXTURES / "sample_export_mixed_v1_v2.jsonl",
        ]
    )
    groups = dedupe_query_events(events)
    search_index = load_search_index(FEATURED_SEARCH_INDEX)
    replays = replay_query_groups(search_index, groups)
    candidates = build_candidates(groups, replays)

    assert [candidate.review_id for candidate in candidates] == [
        "phase7k_evidence_0001",
        "phase7k_evidence_0002",
        "phase7k_evidence_0003",
        "phase7k_evidence_0004",
        "phase7k_evidence_0005",
        "phase7k_evidence_0006",
    ]


def test_golden_candidates_preview_matches_generated_preview():
    events, _ = load_query_log_exports(
        [
            FIXTURES / "sample_export_v2.jsonl",
            FIXTURES / "sample_export_mixed_v1_v2.jsonl",
        ]
    )
    groups = dedupe_query_events(events)
    search_index = load_search_index(FEATURED_SEARCH_INDEX)
    replays = replay_query_groups(search_index, groups)
    candidates = build_candidates(groups, replays)

    assert not validate_candidates(candidates)

    generated_lines = [json.dumps(candidate.to_dict(), ensure_ascii=False) for candidate in candidates]
    golden_lines = [
        line
        for line in GOLDEN.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]

    assert generated_lines == golden_lines
