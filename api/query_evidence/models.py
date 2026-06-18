"""Data models for offline query evidence ingest."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


QUERY_LOG_EVENT_V1 = "query_log_event_v1"
QUERY_LOG_EVENT_V2 = "query_log_event_v2"

VALID_DIRECTIONS = frozenset({"source_to_target", "target_to_source"})
VALID_RESULT_STATUSES = frozenset({"miss", "hit_single", "hit_multi"})


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
