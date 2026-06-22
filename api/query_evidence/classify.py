"""Heuristic classification of deduped query groups with replay results."""

from __future__ import annotations

from collections import Counter

from .models import (
    QUERY_EVIDENCE_SCHEMA,
    REVIEW_STATUS_CANDIDATE,
    DedupedQueryGroup,
    QueryEvidenceCandidate,
    ReplayResult,
)
from .score import score_candidate, token_count

EVIDENCE_SOURCES = ("query_log_export", "search_index_replay")

PHRASE_ALIAS_DESTINATION = "shared/phrase_review/source_phrase_aliases_v1.jsonl"
SOURCE_ALIAS_DESTINATION = "shared/aliases/source_aliases_v1.jsonl"
POLICY_MEMO_DESTINATION = "policy_memo"


def group_replay_key(group: DedupedQueryGroup) -> str:
    return f"{group.query_casefold}\0{group.direction}\0{group.bundle_id}"


def looks_plural_ish(query: str) -> bool:
    token = query.strip()
    return len(token) > 3 and token.endswith("s")


def _group_has_miss(group: DedupedQueryGroup) -> bool:
    return group.result_status_counts.get("miss", 0) > 0


def _group_has_hit_multi(group: DedupedQueryGroup) -> bool:
    return group.result_status_counts.get("hit_multi", 0) > 0


def _source_catalog_version(group: DedupedQueryGroup) -> str | None:
    if not group.catalog_versions:
        return None
    counts = Counter(group.catalog_versions)
    max_count = max(counts.values())
    tied = sorted(version for version, count in counts.items() if count == max_count)
    return tied[0]


def classify_gap(
    group: DedupedQueryGroup,
    replay: ReplayResult,
) -> tuple[str, str | None, str]:
    if replay.result_count > 0 and _group_has_miss(group):
        return (
            "already_addressed",
            None,
            "Export/log had at least one miss but current featured replay now hits.",
        )

    if replay.result_count > 1 or _group_has_hit_multi(group):
        return (
            "ranking_ambiguity_issue",
            POLICY_MEMO_DESTINATION,
            "Multiple matches require human ranking review before any automatic change.",
        )

    if group.direction == "target_to_source" and replay.result_count > 0:
        return (
            "target_side_issue",
            POLICY_MEMO_DESTINATION,
            "Target-side hit requires policy review; do not auto-apply changes.",
        )

    if replay.result_count == 0:
        if token_count(group.query) >= 2:
            return (
                "phrase_miss_candidate",
                PHRASE_ALIAS_DESTINATION,
                "Multi-token replay miss may need phrase alias review; heuristic pre-label only.",
            )
        if looks_plural_ish(group.query):
            return (
                "reviewed_source_alias_candidate",
                SOURCE_ALIAS_DESTINATION,
                "Plural-ish single-token replay miss may need source alias review; heuristic pre-label only.",
            )
        return (
            "true_dictionary_entry_gap",
            None,
            "Replay miss with no safer alias/phrase heuristic; may indicate a true dictionary entry gap.",
        )

    if replay.result_count == 1:
        return (
            "already_addressed",
            None,
            "Single-hit query matches current replay; monitor only, no automatic action.",
        )

    return (
        "already_addressed",
        None,
        "No action required; monitor only.",
    )


def classify_query_group(
    group: DedupedQueryGroup,
    replay: ReplayResult,
    review_id: str,
) -> QueryEvidenceCandidate:
    gap_class, recommended_destination, reason = classify_gap(group, replay)
    priority_score, priority_reasons = score_candidate(group, replay, gap_class)
    return QueryEvidenceCandidate(
        review_id=review_id,
        schema_version=QUERY_EVIDENCE_SCHEMA,
        query=group.query,
        search_direction=group.direction,
        occurrence_count=group.occurrence_count,
        first_seen=group.first_seen,
        last_seen=group.last_seen,
        current_result=replay.current_result,
        gap_class=gap_class,
        priority_score=priority_score,
        priority_reasons=priority_reasons,
        resolved_ir_ids=list(replay.resolved_ir_ids),
        evidence_sources=list(EVIDENCE_SOURCES),
        recommended_destination_artifact=recommended_destination,
        review_status=REVIEW_STATUS_CANDIDATE,
        reason_not_to_apply_automatically=reason,
        source_bundle_id=group.bundle_id,
        source_catalog_version=_source_catalog_version(group),
        related_log_event_ids=list(group.event_ids),
    )


def build_candidates(
    groups: list[DedupedQueryGroup],
    replay_results: dict[str, ReplayResult],
) -> list[QueryEvidenceCandidate]:
    sorted_groups = sorted(
        groups,
        key=lambda group: (group.query_casefold, group.direction, group.bundle_id),
    )
    candidates: list[QueryEvidenceCandidate] = []
    for index, group in enumerate(sorted_groups, start=1):
        replay = replay_results[group_replay_key(group)]
        review_id = f"phase7k_evidence_{index:04d}"
        candidates.append(classify_query_group(group, replay, review_id))
    return candidates
