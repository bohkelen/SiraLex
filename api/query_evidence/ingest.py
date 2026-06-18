"""Ingest exported query log JSONL files into normalized unified events."""

from __future__ import annotations

import hashlib
import json
from collections import Counter
from pathlib import Path
from typing import Any

from .models import (
    QUERY_LOG_EVENT_V1,
    QUERY_LOG_EVENT_V2,
    DedupedQueryGroup,
    IngestIssue,
    IngestStrictError,
    IngestSummary,
    UnifiedQueryEvent,
    VALID_DIRECTIONS,
    VALID_RESULT_STATUSES,
)

DEEP_LADDER_LEVELS = frozenset({"punct_stripped", "nospace"})


def hash_session_bucket(session_bucket_id: str | None) -> str | None:
    if session_bucket_id is None:
        return None
    trimmed = session_bucket_id.strip()
    if trimmed == "":
        return None
    return hashlib.sha256(trimmed.encode("utf-8")).hexdigest()[:8]


def query_casefold(query_raw: str) -> str:
    return query_raw.strip().casefold()


def derive_result_status(result_count: int) -> str:
    if result_count == 0:
        return "miss"
    if result_count == 1:
        return "hit_single"
    return "hit_multi"


def derive_matched_deep_ladder(matched_key_type: str) -> bool:
    return matched_key_type in DEEP_LADDER_LEVELS


def _issue(
    code: str,
    message: str,
    source_path: str,
    line_number: int,
) -> IngestIssue:
    return IngestIssue(
        code=code,
        message=message,
        source_path=source_path,
        line_number=line_number,
    )


def _string_or_none(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        trimmed = value.strip()
        return trimmed if trimmed else None
    return str(value)


def _validate_direction(direction: Any, source_path: str, line_number: int) -> str | None:
    if not isinstance(direction, str) or direction not in VALID_DIRECTIONS:
        return None
    return direction


def _validate_result_count(value: Any) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int) and value >= 0:
        return value
    if isinstance(value, float) and value.is_integer() and value >= 0:
        return int(value)
    return None


def _source_label(source_path: str) -> str:
    return Path(source_path).name


def _synthetic_v1_event_id(source_path: str, line_number: int, payload: dict[str, Any]) -> str:
    label = _source_label(source_path)
    log_id = payload.get("log_id")
    if isinstance(log_id, int):
        return f"v1:{label}:{line_number}:{log_id}"
    return f"v1:{label}:{line_number}:{hash(json.dumps(payload, sort_keys=True)) & 0xFFFFFFFF:08x}"


def _parse_v1_row(
    payload: dict[str, Any],
    source_path: str,
    line_number: int,
    issues: list[IngestIssue],
) -> UnifiedQueryEvent | None:
    required = ("query_raw", "direction", "ladder_level_hit", "ir_ids_count", "bundle_id", "norm_version")
    missing = [name for name in required if name not in payload]
    if missing:
        issues.append(
            _issue(
                "missing_required_field",
                f"missing required v1 fields: {', '.join(missing)}",
                source_path,
                line_number,
            )
        )
        return None

    query_raw = payload["query_raw"]
    if not isinstance(query_raw, str) or query_raw.strip() == "":
        issues.append(_issue("empty_query_raw", "query_raw is empty", source_path, line_number))
        return None

    direction = _validate_direction(payload["direction"], source_path, line_number)
    if direction is None:
        issues.append(_issue("invalid_direction", "direction must be source_to_target or target_to_source", source_path, line_number))
        return None

    result_count = _validate_result_count(payload["ir_ids_count"])
    if result_count is None:
        issues.append(_issue("invalid_result_count", "ir_ids_count must be an integer >= 0", source_path, line_number))
        return None

    bundle_id = payload["bundle_id"]
    norm_version = payload["norm_version"]
    if not isinstance(bundle_id, str) or bundle_id.strip() == "":
        issues.append(_issue("missing_required_field", "bundle_id must be a non-empty string", source_path, line_number))
        return None
    if not isinstance(norm_version, str) or norm_version.strip() == "":
        issues.append(_issue("missing_required_field", "norm_version must be a non-empty string", source_path, line_number))
        return None

    matched_key_type = str(payload["ladder_level_hit"])
    return UnifiedQueryEvent(
        event_id=_synthetic_v1_event_id(source_path, line_number, payload),
        schema_version=QUERY_LOG_EVENT_V1,
        source_path=source_path,
        line_number=line_number,
        timestamp_iso=_string_or_none(payload.get("timestamp_iso")),
        query_raw=query_raw,
        query_casefold=query_casefold(query_raw),
        direction=direction,
        bundle_id=bundle_id.strip(),
        catalog_version=_string_or_none(payload.get("catalog_version")),
        norm_version=norm_version.strip(),
        result_status=derive_result_status(result_count),
        result_count=result_count,
        matched_key_type=matched_key_type,
        matched_key=None,
        matched_deep_ladder=derive_matched_deep_ladder(matched_key_type),
        top_ir_ids=[],
        session_bucket_hash=None,
    )


def _parse_v2_row(
    payload: dict[str, Any],
    source_path: str,
    line_number: int,
    issues: list[IngestIssue],
) -> UnifiedQueryEvent | None:
    required = (
        "event_id",
        "timestamp_iso",
        "query_raw",
        "direction",
        "bundle_id",
        "norm_version",
        "result_status",
        "result_count",
        "matched_key_type",
        "matched_key",
        "matched_deep_ladder",
        "top_ir_ids",
        "session_bucket_id",
    )
    missing = [name for name in required if name not in payload]
    if missing:
        issues.append(
            _issue(
                "missing_required_field",
                f"missing required v2 fields: {', '.join(missing)}",
                source_path,
                line_number,
            )
        )
        return None

    query_raw = payload["query_raw"]
    if not isinstance(query_raw, str) or query_raw.strip() == "":
        issues.append(_issue("empty_query_raw", "query_raw is empty", source_path, line_number))
        return None

    direction = _validate_direction(payload["direction"], source_path, line_number)
    if direction is None:
        issues.append(_issue("invalid_direction", "direction must be source_to_target or target_to_source", source_path, line_number))
        return None

    result_count = _validate_result_count(payload["result_count"])
    if result_count is None:
        issues.append(_issue("invalid_result_count", "result_count must be an integer >= 0", source_path, line_number))
        return None

    result_status = payload["result_status"]
    if not isinstance(result_status, str) or result_status not in VALID_RESULT_STATUSES:
        issues.append(_issue("invalid_result_status", "result_status must be miss, hit_single, or hit_multi", source_path, line_number))
        return None

    event_id = payload["event_id"]
    bundle_id = payload["bundle_id"]
    norm_version = payload["norm_version"]
    if not isinstance(event_id, str) or event_id.strip() == "":
        issues.append(_issue("missing_required_field", "event_id must be a non-empty string", source_path, line_number))
        return None
    if not isinstance(bundle_id, str) or bundle_id.strip() == "":
        issues.append(_issue("missing_required_field", "bundle_id must be a non-empty string", source_path, line_number))
        return None
    if not isinstance(norm_version, str) or norm_version.strip() == "":
        issues.append(_issue("missing_required_field", "norm_version must be a non-empty string", source_path, line_number))
        return None

    top_ir_ids = payload["top_ir_ids"]
    if not isinstance(top_ir_ids, list) or not all(isinstance(item, str) for item in top_ir_ids):
        issues.append(_issue("missing_required_field", "top_ir_ids must be a string array", source_path, line_number))
        return None

    matched_deep_ladder = payload["matched_deep_ladder"]
    if not isinstance(matched_deep_ladder, bool):
        issues.append(_issue("missing_required_field", "matched_deep_ladder must be a boolean", source_path, line_number))
        return None

    matched_key = payload["matched_key"]
    if matched_key is not None and not isinstance(matched_key, str):
        issues.append(_issue("missing_required_field", "matched_key must be a string or null", source_path, line_number))
        return None

    session_bucket_id = payload["session_bucket_id"]
    if not isinstance(session_bucket_id, str) or session_bucket_id.strip() == "":
        issues.append(_issue("missing_required_field", "session_bucket_id must be a non-empty string", source_path, line_number))
        return None

    return UnifiedQueryEvent(
        event_id=event_id.strip(),
        schema_version=QUERY_LOG_EVENT_V2,
        source_path=source_path,
        line_number=line_number,
        timestamp_iso=_string_or_none(payload.get("timestamp_iso")),
        query_raw=query_raw,
        query_casefold=query_casefold(query_raw),
        direction=direction,
        bundle_id=bundle_id.strip(),
        catalog_version=_string_or_none(payload.get("catalog_version")),
        norm_version=norm_version.strip(),
        result_status=result_status,
        result_count=result_count,
        matched_key_type=str(payload["matched_key_type"]),
        matched_key=matched_key,
        matched_deep_ladder=matched_deep_ladder,
        top_ir_ids=list(top_ir_ids),
        session_bucket_hash=hash_session_bucket(session_bucket_id),
    )


def _parse_row(
    payload: dict[str, Any],
    source_path: str,
    line_number: int,
    issues: list[IngestIssue],
) -> UnifiedQueryEvent | None:
    schema_version = payload.get("schema_version")
    if schema_version == QUERY_LOG_EVENT_V1:
        return _parse_v1_row(payload, source_path, line_number, issues)
    if schema_version == QUERY_LOG_EVENT_V2:
        return _parse_v2_row(payload, source_path, line_number, issues)
    issues.append(
        _issue(
            "unknown_schema_version",
            f"unsupported schema_version: {schema_version!r}",
            source_path,
            line_number,
        )
    )
    return None


def load_query_log_exports(
    paths: list[Path],
    strict: bool = False,
) -> tuple[list[UnifiedQueryEvent], list[IngestIssue]]:
    events: list[UnifiedQueryEvent] = []
    issues: list[IngestIssue] = []
    seen_event_ids: set[str] = set()

    for path in paths:
        source_path = str(path)
        with path.open("r", encoding="utf-8") as handle:
            for line_number, line in enumerate(handle, start=1):
                text = line.strip()
                if not text:
                    continue
                try:
                    payload = json.loads(text)
                except json.JSONDecodeError as exc:
                    issues.append(
                        _issue(
                            "malformed_json",
                            str(exc),
                            source_path,
                            line_number,
                        )
                    )
                    continue

                if not isinstance(payload, dict):
                    issues.append(
                        _issue(
                            "malformed_json",
                            "JSON row must be an object",
                            source_path,
                            line_number,
                        )
                    )
                    continue

                event = _parse_row(payload, source_path, line_number, issues)
                if event is None:
                    continue

                if event.event_id in seen_event_ids:
                    issues.append(
                        _issue(
                            "duplicate_event_id",
                            f"duplicate event_id dropped: {event.event_id}",
                            source_path,
                            line_number,
                        )
                    )
                    continue

                seen_event_ids.add(event.event_id)
                events.append(event)

    if strict and issues:
        raise IngestStrictError(issues)

    return events, issues


def dedupe_query_events(events: list[UnifiedQueryEvent]) -> list[DedupedQueryGroup]:
    grouped: dict[tuple[str, str, str], list[UnifiedQueryEvent]] = {}
    for event in events:
        key = (event.query_casefold, event.direction, event.bundle_id)
        grouped.setdefault(key, []).append(event)

    groups: list[DedupedQueryGroup] = []
    for key in sorted(grouped):
        bucket = grouped[key]
        bucket.sort(key=lambda item: (item.timestamp_iso or "", item.line_number, item.event_id))
        status_counts = Counter(event.result_status for event in bucket)
        session_hashes = sorted(
            {
                event.session_bucket_hash
                for event in bucket
                if event.session_bucket_hash is not None
            }
        )
        catalog_versions = sorted(
            {
                event.catalog_version
                for event in bucket
                if event.catalog_version is not None
            }
        )
        timestamps = [event.timestamp_iso for event in bucket if event.timestamp_iso]
        groups.append(
            DedupedQueryGroup(
                query=bucket[0].query_raw,
                query_casefold=bucket[0].query_casefold,
                direction=bucket[0].direction,
                bundle_id=bucket[0].bundle_id,
                occurrence_count=len(bucket),
                first_seen=min(timestamps) if timestamps else None,
                last_seen=max(timestamps) if timestamps else None,
                result_status_counts=dict(sorted(status_counts.items())),
                distinct_session_bucket_hashes=session_hashes,
                event_ids=[event.event_id for event in bucket],
                catalog_versions=catalog_versions,
            )
        )

    return groups


def summarize_ingest(events: list[UnifiedQueryEvent], issues: list[IngestIssue]) -> IngestSummary:
    duplicate_dropped = sum(
        1
        for issue in issues
        if issue.code == "duplicate_event_id"
    )
    dedupe_keys = {(event.query_casefold, event.direction, event.bundle_id) for event in events}
    session_hashes = {
        event.session_bucket_hash
        for event in events
        if event.session_bucket_hash is not None
    }
    return IngestSummary(
        total_events=len(events),
        v1_events=sum(1 for event in events if event.schema_version == QUERY_LOG_EVENT_V1),
        v2_events=sum(1 for event in events if event.schema_version == QUERY_LOG_EVENT_V2),
        issue_count=len(issues),
        duplicate_event_ids_dropped=duplicate_dropped,
        distinct_queries=len(dedupe_keys),
        distinct_session_bucket_hashes=len(session_hashes),
    )
