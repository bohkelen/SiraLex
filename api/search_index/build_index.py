"""
Search index builder: Normalized JSONL → Inverted search index JSONL.

Reads normalized records and materializes a flat inverted index where
each line maps a (key_type, key) pair to a sorted list of ir_ids.

This module never mutates normalized records. Output is a separate JSONL
file that can be used for offline search resolution.

Output schema (one JSON object per line):
{
  "key": "dɔbɛn",
  "key_type": "diacritics_insensitive",
  "ir_ids": ["964909ef6912ff64", ...]
}

Lines are sorted by (key_type, key) for deterministic output.
"""

import json
import logging
from collections import defaultdict
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


def build_inverted_index(
    normalized_records: list[dict[str, Any]],
) -> dict[tuple[str, str], set[str]]:
    """
    Build an in-memory inverted index from normalized records.

    Args:
        normalized_records: list of normalized record dicts, each with
            "ir_id" and "search_keys" fields.

    Returns:
        dict mapping (key_type, key) → set of ir_ids
    """
    index: dict[tuple[str, str], set[str]] = defaultdict(set)

    for record in normalized_records:
        ir_id = record.get("ir_id", "")
        search_keys = record.get("search_keys", {})

        if not ir_id:
            logger.warning("Normalized record missing ir_id, skipping")
            continue

        for key_type, keys in search_keys.items():
            for key in keys:
                if key:  # skip empty keys
                    index[(key_type, key)].add(ir_id)

    return index


def serialize_index(
    index: dict[tuple[str, str], set[str]],
) -> list[dict[str, Any]]:
    """
    Serialize the inverted index into a sorted list of dicts.

    Each dict has: key, key_type, ir_ids (sorted list).
    The list is sorted by (key_type, key) for deterministic output.

    Args:
        index: inverted index mapping (key_type, key) → set of ir_ids

    Returns:
        list of dicts, sorted by (key_type, key)
    """
    entries = []
    for (key_type, key), ir_ids in sorted(index.items()):
        entries.append({
            "key": key,
            "key_type": key_type,
            "ir_ids": sorted(ir_ids),
        })
    return entries


def process_normalized_file(
    input_path: Path,
    output_path: Path,
    verbose: bool = False,
) -> dict[str, int]:
    """
    Read a normalized JSONL file, build an inverted search index, write JSONL.

    Args:
        input_path: path to the normalized JSONL file
        output_path: path to the output search index JSONL file
        verbose: whether to log progress

    Returns:
        stats dict with counts
    """
    stats = {
        "records_read": 0,
        "records_skipped": 0,
        "parse_errors": 0,
        "unique_keys_by_type": {},
        "total_index_entries": 0,
    }

    # Read all normalized records
    records: list[dict[str, Any]] = []

    if not input_path.exists():
        logger.error(f"Input file not found: {input_path}")
        return stats

    with open(input_path, "r", encoding="utf-8") as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue

            try:
                record = json.loads(line)
                records.append(record)
                stats["records_read"] += 1
            except json.JSONDecodeError as e:
                logger.warning(f"Invalid JSON at {input_path}:{line_num}: {e}")
                stats["parse_errors"] += 1

    if verbose:
        logger.info(f"Read {stats['records_read']} normalized records from {input_path}")

    # Build the inverted index
    index = build_inverted_index(records)

    # Serialize to sorted list
    entries = serialize_index(index)
    stats["total_index_entries"] = len(entries)

    # Compute per-key-type stats
    key_type_counts: dict[str, int] = defaultdict(int)
    for entry in entries:
        key_type_counts[entry["key_type"]] += 1
    stats["unique_keys_by_type"] = dict(key_type_counts)

    # Write output
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        for entry in entries:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")

    if verbose:
        logger.info(f"Wrote {len(entries)} index entries to {output_path}")

    return stats
