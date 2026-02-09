"""
Record enrichment pipeline: Normalized JSONL + IR JSONL → Enriched JSONL.

Reads normalized records and IR units, joins them by ir_id, and produces
enriched records with a `display` field containing IR fields_raw.

This module never mutates source artifacts. Output is a new JSONL file
that combines search metadata with display fields for offline use.

The `display` field contains a shallow, read-only projection of IR
fields_raw sufficient for user-facing rendering. It MUST NOT contain
inferred, ranked, or normalized content. All values are copied from IR
fields_raw unchanged.

Output schema (one JSON object per line):
{
  "ir_id": "...",
  "ir_kind": "lexicon_entry" | "index_mapping",
  "source_id": "...",
  "norm_version": "norm_v1",
  "preferred_form": "...",
  "variant_forms": ["...", ...],
  "search_keys": { ... },
  "display": { ... }   # IR fields_raw, copied verbatim
}
"""

import json
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


def build_ir_lookup(ir_paths: list[Path]) -> dict[str, dict[str, Any]]:
    """
    Build an ir_id → fields_raw lookup from one or more IR JSONL files.

    Args:
        ir_paths: Paths to IR JSONL files (lexicon + index)

    Returns:
        dict mapping ir_id → fields_raw dict
    """
    lookup: dict[str, dict[str, Any]] = {}

    for ir_path in ir_paths:
        if not ir_path.exists():
            logger.warning(f"IR file not found: {ir_path}")
            continue

        with open(ir_path, "r", encoding="utf-8") as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue

                try:
                    ir_unit = json.loads(line)
                    ir_id = ir_unit.get("ir_id", "")
                    fields_raw = ir_unit.get("fields_raw")

                    if not ir_id:
                        logger.warning(f"IR unit missing ir_id at {ir_path}:{line_num}")
                        continue

                    if fields_raw is None:
                        logger.warning(f"IR unit missing fields_raw at {ir_path}:{line_num}")
                        continue

                    if ir_id in lookup:
                        logger.warning(
                            f"Duplicate ir_id {ir_id} at {ir_path}:{line_num}, "
                            f"keeping first occurrence"
                        )
                        continue

                    lookup[ir_id] = fields_raw

                except json.JSONDecodeError as e:
                    logger.warning(f"Invalid JSON at {ir_path}:{line_num}: {e}")

    return lookup


def enrich_record(
    normalized: dict[str, Any],
    ir_lookup: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    """
    Enrich a single normalized record with display fields from IR.

    Args:
        normalized: A normalized record dict
        ir_lookup: ir_id → fields_raw lookup

    Returns:
        Enriched record dict. If IR record not found, returns the
        normalized record unchanged (without display field).
    """
    ir_id = normalized.get("ir_id", "")
    fields_raw = ir_lookup.get(ir_id)

    # Start with a copy of the normalized record
    enriched = dict(normalized)

    if fields_raw is not None:
        # Copy fields_raw verbatim as the display field
        enriched["display"] = fields_raw
    else:
        if ir_id:
            logger.warning(f"No IR record found for ir_id={ir_id}, omitting display field")

    return enriched


def enrich_records(
    normalized_path: Path,
    ir_paths: list[Path],
    output_path: Path,
    verbose: bool = False,
) -> dict[str, int]:
    """
    Read normalized JSONL + IR JSONL files, produce enriched JSONL.

    Args:
        normalized_path: Path to normalized JSONL file
        ir_paths: Paths to IR JSONL files (lexicon + index)
        output_path: Path to output enriched JSONL file
        verbose: Whether to log progress

    Returns:
        Stats dict with counts
    """
    stats = {
        "ir_records_loaded": 0,
        "normalized_records_read": 0,
        "enriched_with_display": 0,
        "missing_display": 0,
        "parse_errors": 0,
    }

    # Step 1: Build IR lookup
    if verbose:
        logger.info(f"Loading IR records from {len(ir_paths)} file(s)...")

    ir_lookup = build_ir_lookup(ir_paths)
    stats["ir_records_loaded"] = len(ir_lookup)

    if verbose:
        logger.info(f"Loaded {len(ir_lookup)} IR records into lookup")

    # Step 2: Read normalized records, enrich, write output
    if not normalized_path.exists():
        logger.error(f"Normalized JSONL not found: {normalized_path}")
        return stats

    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(normalized_path, "r", encoding="utf-8") as in_f, \
         open(output_path, "w", encoding="utf-8") as out_f:

        for line_num, line in enumerate(in_f, 1):
            line = line.strip()
            if not line:
                continue

            try:
                normalized = json.loads(line)
                stats["normalized_records_read"] += 1

                enriched = enrich_record(normalized, ir_lookup)

                if "display" in enriched:
                    stats["enriched_with_display"] += 1
                else:
                    stats["missing_display"] += 1

                out_f.write(
                    json.dumps(enriched, ensure_ascii=False) + "\n"
                )

            except json.JSONDecodeError as e:
                logger.warning(f"Invalid JSON at {normalized_path}:{line_num}: {e}")
                stats["parse_errors"] += 1
            except Exception as e:
                logger.warning(f"Error enriching {normalized_path}:{line_num}: {e}")
                stats["parse_errors"] += 1

    return stats
