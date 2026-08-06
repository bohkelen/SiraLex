"""
Search index builder: Normalized JSONL → Inverted search index JSONL.

Reads normalized records and materializes a flat inverted index where
each line maps a directional (key_type, key) pair to an ordered list of
ir_ids.

Posting collection deduplicates by first occurrence in normalized record
order. Before serialization, each posting list is sorted lexicographically
by `ir_id`. That deterministic order matches the frozen Phase 7L / featured
Phase 7J search-index posting contracts and is independent of record-stream
order.

English (ML1C1): additive `en_*` keys are derived from sense `gloss_en`
via en_gloss_key_v1 + the record's normalization ruleset. French `src_*`
and Maninka `tgt_*` paths remain unchanged.

This module never mutates normalized records. Output is a separate JSONL
file that can be used for offline search resolution.

Output schema (one JSON object per line):
{
  "key": "dɔbɛn",
  "key_type": "tgt_diacritics_insensitive",
  "ir_ids": ["964909ef6912ff64", ...]
}

Lines are sorted by (key_type, key) for deterministic output.
Within each line, ir_ids are sorted lexicographically.
"""

from __future__ import annotations

import json
import logging
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any, Callable

from .en_gloss_key_v1 import (
    EXTRACTION_RULE,
    iter_en_gloss_key_v1_from_record,
)

logger = logging.getLogger(__name__)

SOURCE_DIRECTION_PREFIX = "src"
TARGET_DIRECTION_PREFIX = "tgt"
ENGLISH_DIRECTION_PREFIX = "en"

INDEX_MAPPING_KIND = "index_mapping"
LEXICON_ENTRY_KIND = "lexicon_entry"

LEGACY_LADDER_KEY_TYPES = (
    "casefold",
    "diacritics_insensitive",
    "punct_stripped",
    "nospace",
)

# Add shared to path for normalization imports (matches normalizer package).
_SHARED_ROOT = Path(__file__).resolve().parent.parent.parent / "shared"
if str(_SHARED_ROOT) not in sys.path:
    sys.path.insert(0, str(_SHARED_ROOT))


def _load_compute_search_keys(norm_version: str) -> Callable[[list[str]], dict[str, list[str]]]:
    if norm_version == "norm_v3":
        from normalization.norm_v3 import compute_search_keys

        return compute_search_keys
    if norm_version == "norm_v2":
        from normalization.norm_v2 import compute_search_keys

        return compute_search_keys
    from normalization.norm_v1 import compute_search_keys

    return compute_search_keys


def directional_key_type(ir_kind: str, key_type: str) -> str | None:
    if ir_kind == INDEX_MAPPING_KIND:
        return f"{SOURCE_DIRECTION_PREFIX}_{key_type}"
    if ir_kind == LEXICON_ENTRY_KIND:
        return f"{TARGET_DIRECTION_PREFIX}_{key_type}"
    return None


def sort_posting_ir_ids(ir_ids: list[str]) -> list[str]:
    """
    Return a deterministic posting list ordered by lexicographic ir_id.

    Deduplication is preserved: callers must pass unique ir_ids.
    """
    return sorted(ir_ids)


def _append_posting(
    index: dict[tuple[str, str], list[str]],
    key_type: str,
    key: str,
    ir_id: str,
) -> None:
    if not key:
        return
    postings = index[(key_type, key)]
    if ir_id not in postings:
        postings.append(ir_id)


def _emit_english_keys_for_record(
    record: dict[str, Any],
    index: dict[tuple[str, str], list[str]],
    provenance_rows: list[dict[str, Any]],
    compute_search_keys: Callable[[list[str]], dict[str, list[str]]],
) -> dict[str, int]:
    """
    Add additive en_* postings for one lexicon entry.

    Returns per-record counters for provenance summary.
    """
    stats = {
        "senses_with_gloss_en": 0,
        "candidates": 0,
    }
    ir_id = record.get("ir_id", "")
    if not ir_id:
        return stats

    seen_senses: set[int] = set()
    for candidate in iter_en_gloss_key_v1_from_record(record):
        seen_senses.add(candidate.sense_index)
        stats["candidates"] += 1
        ladder = compute_search_keys([candidate.key_surface])
        for ladder_type in LEGACY_LADDER_KEY_TYPES:
            for normalized_key in ladder.get(ladder_type, []):
                _append_posting(
                    index,
                    f"{ENGLISH_DIRECTION_PREFIX}_{ladder_type}",
                    normalized_key,
                    ir_id,
                )
        # Provenance records the pre-ladder surface as key_normalized identity
        # for audit (casefold of surface after whitespace/NFC is applied by
        # the ruleset). Store the casefold ladder key when present, else surface.
        casefold_keys = ladder.get("casefold") or []
        key_normalized = casefold_keys[0] if casefold_keys else candidate.key_surface
        provenance_rows.append(
            {
                "ir_id": ir_id,
                "sense_index": candidate.sense_index,
                "gloss_en_raw": candidate.gloss_en_raw,
                "extraction_rule": EXTRACTION_RULE,
                "key_normalized": key_normalized,
                "key_surface": candidate.key_surface,
                "split_kind": candidate.split_kind,
            }
        )
    stats["senses_with_gloss_en"] = len(seen_senses)
    return stats


def build_inverted_index(
    normalized_records: list[dict[str, Any]],
    *,
    emit_english_keys: bool = True,
    provenance_rows: list[dict[str, Any]] | None = None,
) -> dict[tuple[str, str], list[str]]:
    """
    Build an in-memory inverted index from normalized records.

    Args:
        normalized_records: list of normalized/enriched record dicts, each with
            "ir_id" and "search_keys" fields. Enriched lexicon rows may also
            carry `display.senses[].gloss_en` for additive English keys.
        emit_english_keys: when True, emit en_* from gloss_en (ML1C1).
        provenance_rows: optional list that receives English extraction rows.

    Returns:
        dict mapping (directional key_type, key) → ordered list of ir_ids.
        Posting lists are lexicographically sorted by ir_id.
    """
    index: dict[tuple[str, str], list[str]] = defaultdict(list)
    provenance = provenance_rows if provenance_rows is not None else []
    compute_by_version: dict[str, Callable[[list[str]], dict[str, list[str]]]] = {}

    for record in normalized_records:
        ir_id = record.get("ir_id", "")
        ir_kind = record.get("ir_kind", "")
        search_keys = record.get("search_keys", {})

        if not ir_id:
            logger.warning("Normalized record missing ir_id, skipping")
            continue

        if not isinstance(search_keys, dict):
            logger.warning("Normalized record %s has invalid search_keys, skipping", ir_id)
            continue

        for key_type, keys in search_keys.items():
            directional_type = directional_key_type(ir_kind, key_type)
            if directional_type is None:
                logger.warning(
                    "Normalized record %s has unsupported ir_kind=%r, skipping",
                    ir_id,
                    ir_kind,
                )
                break
            for key in keys:
                if key:  # skip empty keys
                    _append_posting(index, directional_type, key, ir_id)

        if emit_english_keys and ir_kind == LEXICON_ENTRY_KIND:
            norm_version = record.get("norm_version")
            if not isinstance(norm_version, str) or not norm_version:
                norm_version = "norm_v1"
            if norm_version not in compute_by_version:
                compute_by_version[norm_version] = _load_compute_search_keys(norm_version)
            _emit_english_keys_for_record(
                record,
                index,
                provenance,
                compute_by_version[norm_version],
            )

    # Deterministic posting order: lexicographic ir_id within each key.
    for key in list(index.keys()):
        index[key] = sort_posting_ir_ids(index[key])

    return index


def serialize_index(
    index: dict[tuple[str, str], list[str]],
    *,
    sort_postings: bool = True,
) -> list[dict[str, Any]]:
    """
    Serialize the inverted index into a sorted list of dicts.

    Each dict has: key, key_type, ir_ids.
    Entries are sorted by (key_type, key) for deterministic output.
    When sort_postings is True, ir_ids are lexicographically sorted (default
    full-rebuild contract). When False, ir_ids order is preserved as stored
    (required when merging onto a frozen featured base index).
    """
    entries = []
    for (key_type, key), ir_ids in sorted(index.items()):
        ordered = sort_posting_ir_ids(list(ir_ids)) if sort_postings else list(ir_ids)
        entries.append({
            "key": key,
            "key_type": key_type,
            "ir_ids": ordered,
        })
    return entries


def write_english_provenance_jsonl(
    provenance_rows: list[dict[str, Any]],
    output_path: Path,
) -> None:
    """Write English key provenance rows (not part of the consumer bundle)."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    # Stable order: ir_id → sense_index → key_normalized → split_kind
    ordered = sorted(
        provenance_rows,
        key=lambda row: (
            str(row.get("ir_id", "")),
            int(row.get("sense_index", 0)),
            str(row.get("key_normalized", "")),
            str(row.get("split_kind", "")),
        ),
    )
    with open(output_path, "w", encoding="utf-8") as f:
        for row in ordered:
            f.write(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n")


def summarize_english_provenance(provenance_rows: list[dict[str, Any]]) -> dict[str, Any]:
    """Build aggregate counters for English extraction reporting."""
    unique_keys = {str(row.get("key_normalized", "")) for row in provenance_rows}
    unique_keys.discard("")
    senses = {
        (str(row.get("ir_id", "")), int(row.get("sense_index", -1)))
        for row in provenance_rows
    }
    split_counts: dict[str, int] = defaultdict(int)
    for row in provenance_rows:
        split_counts[str(row.get("split_kind", ""))] += 1
    return {
        "extraction_rule": EXTRACTION_RULE,
        "source_senses": len(senses),
        "extracted_candidates": len(provenance_rows),
        "unique_english_keys": len(unique_keys),
        "split_kind_counts": dict(sorted(split_counts.items())),
    }


def load_index_jsonl(path: Path) -> dict[tuple[str, str], list[str]]:
    """Load a search_index.jsonl into (key_type, key) → ir_ids map."""
    index: dict[tuple[str, str], list[str]] = {}
    with open(path, "r", encoding="utf-8") as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
            except json.JSONDecodeError as exc:
                raise ValueError(f"Invalid JSON in search index at {path}:{line_num}: {exc}") from exc
            key = entry.get("key")
            key_type = entry.get("key_type")
            ir_ids = entry.get("ir_ids")
            if not isinstance(key, str) or not isinstance(key_type, str):
                raise ValueError(f"Invalid key/key_type at {path}:{line_num}")
            if not isinstance(ir_ids, list) or not all(isinstance(x, str) for x in ir_ids):
                raise ValueError(f"Invalid ir_ids at {path}:{line_num}")
            index[(key_type, key)] = list(ir_ids)
    return index


def build_english_inverted_index(
    normalized_records: list[dict[str, Any]],
    *,
    provenance_rows: list[dict[str, Any]] | None = None,
) -> dict[tuple[str, str], list[str]]:
    """
    Build only additive en_* postings from enriched lexicon gloss_en fields.

    Does not emit src_* or tgt_*.
    """
    index: dict[tuple[str, str], list[str]] = defaultdict(list)
    provenance = provenance_rows if provenance_rows is not None else []
    compute_by_version: dict[str, Callable[[list[str]], dict[str, list[str]]]] = {}

    for record in normalized_records:
        if record.get("ir_kind") != LEXICON_ENTRY_KIND:
            continue
        if not record.get("ir_id"):
            continue
        norm_version = record.get("norm_version")
        if not isinstance(norm_version, str) or not norm_version:
            norm_version = "norm_v1"
        if norm_version not in compute_by_version:
            compute_by_version[norm_version] = _load_compute_search_keys(norm_version)
        _emit_english_keys_for_record(
            record,
            index,
            provenance,
            compute_by_version[norm_version],
        )

    for key in list(index.keys()):
        index[key] = sort_posting_ir_ids(index[key])
    return index


def merge_indexes(
    base_index: dict[tuple[str, str], list[str]],
    additive_index: dict[tuple[str, str], list[str]],
) -> dict[tuple[str, str], list[str]]:
    """
    Merge additive keys into a base index without mutating base postings.

    Base posting lists are preserved in exact order. Additive lists are sorted.
    Additive keys must not collide with existing base keys (ML1C1: en_* only).
    """
    merged = {k: list(v) for k, v in base_index.items()}
    collisions = sorted(set(merged) & set(additive_index))
    if collisions:
        sample = ", ".join(f"{kt}:{key}" for kt, key in collisions[:5])
        raise ValueError(
            f"Additive index collides with base keys ({len(collisions)}): {sample}"
        )
    for key, ir_ids in additive_index.items():
        merged[key] = sort_posting_ir_ids(list(ir_ids))
    return merged


def process_normalized_file(
    input_path: Path,
    output_path: Path,
    verbose: bool = False,
    *,
    emit_english_keys: bool = True,
    english_provenance_path: Path | None = None,
    base_search_index_path: Path | None = None,
) -> dict[str, Any]:
    """
    Read a normalized JSONL file, build an inverted search index, write JSONL.

    Args:
        input_path: path to the normalized JSONL file
        output_path: path to the output search index JSONL file
        verbose: whether to log progress
        emit_english_keys: emit additive en_* from gloss_en when present
        english_provenance_path: optional path for English provenance JSONL
        base_search_index_path: when set, preserve this index's rows byte-for-byte
            in meaning (src_*/tgt_*/legacy) and only add en_* from records.
            Required for extending a frozen featured index that includes
            alias/supplement overlays not present in records alone.

    Returns:
        stats dict with counts
    """
    stats: dict[str, Any] = {
        "records_read": 0,
        "records_skipped": 0,
        "parse_errors": 0,
        "unique_keys_by_type": {},
        "total_index_entries": 0,
        "english_provenance": None,
        "base_index_path": str(base_search_index_path) if base_search_index_path else None,
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

    provenance_rows: list[dict[str, Any]] = []

    if base_search_index_path is not None:
        if not base_search_index_path.exists():
            raise FileNotFoundError(f"Base search index not found: {base_search_index_path}")
        base_index = load_index_jsonl(base_search_index_path)
        if emit_english_keys:
            english_index = build_english_inverted_index(
                records,
                provenance_rows=provenance_rows,
            )
            index = merge_indexes(base_index, english_index)
        else:
            index = base_index
        # Preserve frozen base posting order exactly.
        entries = serialize_index(index, sort_postings=False)
    else:
        # Full rebuild path (tests / greenfield builds).
        index = build_inverted_index(
            records,
            emit_english_keys=emit_english_keys,
            provenance_rows=provenance_rows,
        )
        entries = serialize_index(index, sort_postings=True)

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

    if emit_english_keys:
        summary = summarize_english_provenance(provenance_rows)
        en_rows = sum(
            count
            for key_type, count in key_type_counts.items()
            if key_type.startswith(f"{ENGLISH_DIRECTION_PREFIX}_")
        )
        summary["en_index_rows"] = en_rows
        stats["english_provenance"] = summary
        if english_provenance_path is not None:
            write_english_provenance_jsonl(provenance_rows, english_provenance_path)
            summary["provenance_path"] = str(english_provenance_path)

    return stats
