from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
API_ROOT = REPO_ROOT / "api"

if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from query_evidence.models import DedupedQueryGroup, ReplayResult  # noqa: E402
from query_evidence.score import score_candidate  # noqa: E402


def _group(
    *,
    query: str,
    direction: str = "source_to_target",
    occurrence_count: int = 1,
) -> DedupedQueryGroup:
    return DedupedQueryGroup(
        query=query,
        query_casefold=query.strip().casefold(),
        direction=direction,
        bundle_id="bundle-a",
        occurrence_count=occurrence_count,
        first_seen="2026-06-01T00:00:00.000Z",
        last_seen="2026-06-02T00:00:00.000Z",
        result_status_counts={"miss": occurrence_count},
        distinct_session_bucket_hashes=[],
        event_ids=["evt-1"],
        catalog_versions=[],
    )


def _replay(
    query: str,
    *,
    direction: str = "source_to_target",
    result_count: int = 0,
) -> ReplayResult:
    return ReplayResult(
        query=query,
        direction=direction,
        result_count=result_count,
        resolved_ir_ids=["a", "b"] if result_count > 1 else (["a"] if result_count == 1 else []),
        matched_key_type="none" if result_count == 0 else "casefold",
        matched_key=None if result_count == 0 else query,
        current_result="miss" if result_count == 0 else f"hit ({result_count})",
    )


def test_repeated_miss_scoring():
    group = _group(query="fruits", occurrence_count=3)
    replay = _replay("fruits", result_count=0)
    score, reasons = score_candidate(group, replay, "reviewed_source_alias_candidate")

    assert score == 90
    assert "replay_still_misses:+25" in reasons
    assert "repeated_miss:+20" in reasons
    assert "repeated_miss:+30" in reasons
    assert "alias_candidate:+15" in reasons


def test_hit_multi_scoring():
    group = _group(query="mère", occurrence_count=1)
    replay = _replay("mère", result_count=3)
    score, reasons = score_candidate(group, replay, "ranking_ambiguity_issue")

    assert score == 25
    assert "hit_multi:+15" in reasons
    assert "ranking_review:+10" in reasons


def test_phrase_candidate_scoring():
    group = _group(query="grand parents", occurrence_count=1)
    replay = _replay("grand parents", result_count=0)
    score, reasons = score_candidate(group, replay, "phrase_miss_candidate")

    assert score == 50
    assert "phrase_like:+10" in reasons
    assert "phrase_candidate:+15" in reasons
    assert "replay_still_misses:+25" in reasons


def test_alias_candidate_scoring():
    group = _group(query="fruits", occurrence_count=1)
    replay = _replay("fruits", result_count=0)
    score, reasons = score_candidate(group, replay, "reviewed_source_alias_candidate")

    assert score == 40
    assert "alias_candidate:+15" in reasons
    assert "replay_still_misses:+25" in reasons


def test_already_addressed_penalty_clamps_to_zero():
    group = _group(query="fruit", occurrence_count=2)
    replay = _replay("fruit", result_count=1)
    score, reasons = score_candidate(group, replay, "already_addressed")

    assert score == 0
    assert "already_addressed_penalty:-100" in reasons
    assert "monitor_only:no_action_required" in reasons


def test_priority_reasons_non_empty():
    group = _group(query="fruit", occurrence_count=1)
    replay = _replay("fruit", result_count=1)
    score, reasons = score_candidate(group, replay, "already_addressed")

    assert reasons
    assert score == 0


def test_score_deterministic():
    group = _group(query="zzzz-nohit-test", occurrence_count=2)
    replay = _replay("zzzz-nohit-test", result_count=0)
    first = score_candidate(group, replay, "true_dictionary_entry_gap")
    second = score_candidate(group, replay, "true_dictionary_entry_gap")

    assert first == second
