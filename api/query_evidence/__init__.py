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
from .emit import (
    ANALYZER_VERSION,
    CandidateOutputError,
    SUMMARY_SCHEMA,
    build_summary_report,
    is_synthetic_fixture_run,
    resolve_catalog_version,
    resolve_bundle_metadata,
    write_audit_markdown,
    write_candidates_jsonl,
    write_summary_json,
)

__all__ = [
    "ANALYZER_VERSION",
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
    "SUMMARY_SCHEMA",
    "CandidateOutputError",
    "UnifiedQueryEvent",
    "VALID_GAP_CLASSES",
    "build_candidates",
    "build_replay_summary",
    "build_summary_report",
    "classify_gap",
    "classify_query_group",
    "dedupe_query_events",
    "group_replay_key",
    "is_synthetic_fixture_run",
    "load_query_log_exports",
    "load_search_index",
    "replay_query",
    "replay_query_groups",
    "resolve_catalog_version",
    "resolve_bundle_metadata",
    "score_candidate",
    "summarize_ingest",
    "token_count",
    "validate_candidates",
    "write_audit_markdown",
    "write_candidates_jsonl",
    "write_summary_json",
]
