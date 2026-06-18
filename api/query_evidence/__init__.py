"""Offline query evidence analysis for exported SiraLex query logs."""

from .classify import build_candidates, classify_gap, classify_query_group, group_replay_key
from .ingest import dedupe_query_events, load_query_log_exports, summarize_ingest
from .models import (
    QUERY_EVIDENCE_SCHEMA,
    DedupedQueryGroup,
    IngestIssue,
    IngestStrictError,
    IngestSummary,
    QueryEvidenceCandidate,
    REVIEW_STATUS_CANDIDATE,
    ReplayResult,
    UnifiedQueryEvent,
    VALID_GAP_CLASSES,
)
from .replay import (
    InvalidDirectionError,
    ReplayError,
    SearchIndexLoadError,
    build_replay_summary,
    load_search_index,
    replay_query,
    replay_query_groups,
)
from .score import score_candidate, token_count
from .validate_output import validate_candidates

__all__ = [
    "QUERY_EVIDENCE_SCHEMA",
    "DedupedQueryGroup",
    "IngestIssue",
    "IngestStrictError",
    "IngestSummary",
    "InvalidDirectionError",
    "QueryEvidenceCandidate",
    "REVIEW_STATUS_CANDIDATE",
    "ReplayError",
    "ReplayResult",
    "SearchIndexLoadError",
    "UnifiedQueryEvent",
    "VALID_GAP_CLASSES",
    "build_candidates",
    "build_replay_summary",
    "classify_gap",
    "classify_query_group",
    "dedupe_query_events",
    "group_replay_key",
    "load_query_log_exports",
    "load_search_index",
    "replay_query",
    "replay_query_groups",
    "score_candidate",
    "summarize_ingest",
    "token_count",
    "validate_candidates",
]
