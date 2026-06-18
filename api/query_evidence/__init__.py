"""Offline query evidence analysis for exported SiraLex query logs."""

from .ingest import dedupe_query_events, load_query_log_exports, summarize_ingest
from .models import (
    DedupedQueryGroup,
    IngestIssue,
    IngestStrictError,
    IngestSummary,
    ReplayResult,
    UnifiedQueryEvent,
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

__all__ = [
    "DedupedQueryGroup",
    "IngestIssue",
    "IngestStrictError",
    "IngestSummary",
    "InvalidDirectionError",
    "ReplayError",
    "ReplayResult",
    "SearchIndexLoadError",
    "UnifiedQueryEvent",
    "build_replay_summary",
    "dedupe_query_events",
    "load_query_log_exports",
    "load_search_index",
    "replay_query",
    "replay_query_groups",
    "summarize_ingest",
]
