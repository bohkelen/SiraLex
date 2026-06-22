"""Offline replay of query lookups against a bundle search_index.jsonl."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

from .models import DedupedQueryGroup, ReplayResult, VALID_DIRECTIONS

SHARED_ROOT = Path(__file__).resolve().parents[2] / "shared"
REPO_ROOT = SHARED_ROOT.parent
if str(SHARED_ROOT) not in sys.path:
    sys.path.insert(0, str(SHARED_ROOT))

from normalization.norm_v3 import compute_search_keys  # noqa: E402

KEY_TYPE_ORDER = ("casefold", "diacritics_insensitive", "punct_stripped", "nospace")


class ReplayError(Exception):
    """Base error for query evidence replay."""


class SearchIndexLoadError(ReplayError):
    """Raised when search_index.jsonl cannot be loaded."""


class InvalidDirectionError(ReplayError):
    """Raised when replay direction is not supported."""


def format_current_result(result_count: int) -> str:
    if result_count == 0:
        return "miss"
    return f"hit ({result_count})"


def _direction_prefix(direction: str) -> str:
    if direction == "source_to_target":
        return "src"
    if direction == "target_to_source":
        return "tgt"
    raise InvalidDirectionError(
        f"direction must be source_to_target or target_to_source, got {direction!r}"
    )


def _storage_key_type(direction: str, key_type: str) -> str:
    return f"{_direction_prefix(direction)}_{key_type}"


def load_search_index(search_index_path: Path) -> dict[tuple[str, str], list[str]]:
    index: dict[tuple[str, str], list[str]] = {}
    source_path = str(search_index_path)
    with search_index_path.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            text = line.strip()
            if not text:
                continue
            try:
                entry = json.loads(text)
            except json.JSONDecodeError as exc:
                raise SearchIndexLoadError(
                    f"{source_path}:{line_number}: invalid JSON: {exc}"
                ) from exc
            if not isinstance(entry, dict):
                raise SearchIndexLoadError(f"{source_path}:{line_number}: expected JSON object")
            key_type = entry.get("key_type")
            key = entry.get("key")
            ir_ids = entry.get("ir_ids")
            if not isinstance(key_type, str) or not key_type:
                raise SearchIndexLoadError(f"{source_path}:{line_number}: missing key_type")
            if not isinstance(key, str) or not key:
                raise SearchIndexLoadError(f"{source_path}:{line_number}: missing key")
            if not isinstance(ir_ids, list) or not all(isinstance(item, str) for item in ir_ids):
                raise SearchIndexLoadError(f"{source_path}:{line_number}: invalid ir_ids")
            compound_key = (key_type, key)
            if compound_key in index:
                raise SearchIndexLoadError(
                    f"{source_path}:{line_number}: duplicate index key {compound_key!r}"
                )
            index[compound_key] = list(ir_ids)
    return index


def _search_keys_for_query(query: str) -> dict[str, list[str]]:
    trimmed = query.strip()
    if trimmed == "":
        return {key_type: [] for key_type in KEY_TYPE_ORDER}
    return compute_search_keys([trimmed])


def replay_query(
    search_index: dict[tuple[str, str], list[str]],
    query: str,
    direction: str,
) -> ReplayResult:
    if direction not in VALID_DIRECTIONS:
        raise InvalidDirectionError(
            f"direction must be source_to_target or target_to_source, got {direction!r}"
        )

    keys = _search_keys_for_query(query)
    for key_type in KEY_TYPE_ORDER:
        for normalized_key in keys.get(key_type, []):
            if not normalized_key:
                continue
            storage_key_type = _storage_key_type(direction, key_type)
            ir_ids = search_index.get((storage_key_type, normalized_key))
            if ir_ids:
                result_count = len(ir_ids)
                return ReplayResult(
                    query=query,
                    direction=direction,
                    result_count=result_count,
                    resolved_ir_ids=list(ir_ids),
                    matched_key_type=key_type,
                    matched_key=normalized_key,
                    current_result=format_current_result(result_count),
                )

    return ReplayResult(
        query=query,
        direction=direction,
        result_count=0,
        resolved_ir_ids=[],
        matched_key_type="none",
        matched_key=None,
        current_result=format_current_result(0),
    )


def replay_query_groups(
    search_index: dict[tuple[str, str], list[str]],
    groups: list[DedupedQueryGroup],
) -> dict[str, ReplayResult]:
    results: dict[str, ReplayResult] = {}
    for group in groups:
        key = f"{group.query_casefold}\0{group.direction}\0{group.bundle_id}"
        results[key] = replay_query(search_index, group.query, group.direction)
    return results


def build_replay_summary(
    search_index_path: Path,
    queries: list[tuple[str, str]],
) -> dict[str, Any]:
    search_index = load_search_index(search_index_path)
    replays = [
        replay_query(search_index, query, direction).to_dict()
        for query, direction in queries
    ]
    return {
        "schema_version": "phase7k_replay_summary_v1",
        "search_index_path": str(search_index_path.resolve().relative_to(REPO_ROOT)),
        "replays": replays,
    }
