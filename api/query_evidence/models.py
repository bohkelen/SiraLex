"""Data models for offline query evidence ingest."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


QUERY_LOG_EVENT_V1 = "query_log_event_v1"
QUERY_LOG_EVENT_V2 = "query_log_event_v2"

QUERY_EVIDENCE_SCHEMA = "phase7k_query_evidence_v1"
REVIEW_STATUS_CANDIDATE = "candidate"

VALID_DIRECTIONS = frozenset({"source_to_target", "target_to_source"})
VALID_RESULT_STATUSES = frozenset({"miss", "hit_single", "hit_multi"})
VALID_GAP_CLASSES = frozenset(
    {
        "reviewed_source_alias_candidate",
        "reviewed_source_index_supplement_candidate",
        "phrase_miss_candidate",
        "true_dictionary_entry_gap",
        "ranking_ambiguity_issue",
        "target_side_issue",
        "typo_noise",
        "should_remain_no_hit",
        "ui_copy_issue",
        "already_addressed",
    }
)


@dataclass(frozen=True)
class ReplayResult:
    query: str
    direction: str
    result_count: int
    resolved_ir_ids: list[str]
    matched_key_type: str
    matched_key: str | None
    current_result: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class UnifiedQueryEvent:
    event_id: str
    schema_version: str
    source_path: str
    line_number: int
    timestamp_iso: str | None
    query_raw: str
    query_casefold: str
    direction: str
    bundle_id: str
    catalog_version: str | None
    norm_version: str
    result_status: str
    result_count: int
    matched_key_type: str
    matched_key: str | None
    matched_deep_ladder: bool
    top_ir_ids: list[str]
    session_bucket_hash: str | None

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        return data


@dataclass(frozen=True)
class IngestIssue:
    code: str
    message: str
    source_path: str
    line_number: int

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class IngestSummary:
    total_events: int = 0
    v1_events: int = 0
    v2_events: int = 0
    issue_count: int = 0
    duplicate_event_ids_dropped: int = 0
    distinct_queries: int = 0
    distinct_session_bucket_hashes: int = 0

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class DedupedQueryGroup:
    query: str
    query_casefold: str
    direction: str
    bundle_id: str
    occurrence_count: int
    first_seen: str | None
    last_seen: str | None
    result_status_counts: dict[str, int] = field(default_factory=dict)
    distinct_session_bucket_hashes: list[str] = field(default_factory=list)
    event_ids: list[str] = field(default_factory=list)
    catalog_versions: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class IngestStrictError(Exception):
    """Raised when ingest runs in strict mode and validation issues exist."""

    def __init__(self, issues: list[IngestIssue]) -> None:
        self.issues = issues
        super().__init__(f"ingest strict mode failed with {len(issues)} issue(s)")


@dataclass
class QueryEvidenceCandidate:
    review_id: str
    schema_version: str
    query: str
    search_direction: str
    occurrence_count: int
    first_seen: str | None
    last_seen: str | None
    current_result: str
    gap_class: str
    priority_score: int
    priority_reasons: list[str]
    resolved_ir_ids: list[str]
    evidence_sources: list[str]
    recommended_destination_artifact: str | None
    review_status: str
    reason_not_to_apply_automatically: str
    source_bundle_id: str
    source_catalog_version: str | None
    related_log_event_ids: list[str]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)
