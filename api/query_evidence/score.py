"""Priority scoring for query evidence candidates."""

from __future__ import annotations

from .models import DedupedQueryGroup, ReplayResult


def token_count(query: str) -> int:
    return len(query.strip().split())


def score_candidate(
    group: DedupedQueryGroup,
    replay: ReplayResult,
    gap_class: str,
) -> tuple[int, list[str]]:
    score = 0
    reasons: list[str] = []

    if replay.result_count == 0:
        score += 25
        reasons.append("replay_still_misses:+25")
        if group.occurrence_count >= 2:
            score += 20
            reasons.append("repeated_miss:+20")
        if group.occurrence_count >= 3:
            score += 30
            reasons.append("repeated_miss:+30")

    if replay.result_count > 1:
        score += 15
        reasons.append("hit_multi:+15")

    if token_count(group.query) >= 2:
        score += 10
        reasons.append("phrase_like:+10")

    if group.direction == "target_to_source":
        score += 10
        reasons.append("target_side:+10")

    if gap_class == "already_addressed":
        score -= 100
        reasons.append("already_addressed_penalty:-100")

    if gap_class == "ranking_ambiguity_issue":
        score += 10
        reasons.append("ranking_review:+10")

    if gap_class == "reviewed_source_alias_candidate":
        score += 15
        reasons.append("alias_candidate:+15")

    if gap_class == "phrase_miss_candidate":
        score += 15
        reasons.append("phrase_candidate:+15")

    score = max(0, min(100, score))

    if not reasons:
        reasons.append("monitor_only:no_action_required")
    elif score == 0 and "monitor_only:no_action_required" not in reasons:
        reasons.append("monitor_only:no_action_required")

    return score, reasons
