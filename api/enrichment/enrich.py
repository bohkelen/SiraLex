"""
Record enrichment pipeline: Normalized JSONL + IR JSONL → Enriched JSONL.

Reads normalized records and IR units, joins them by ir_id, and produces
enriched records with:

- `display`: shallow, read-only projection of IR `fields_raw`
- `record_locator` (lexicon_entry only): durable IR locator metadata so
  `index_mapping.display.target_entries[].anchor` can resolve back to a
  lexicon `ir_id` without display-text matching

This module never mutates source artifacts. Output is a new JSONL file
that combines search metadata with display (and locator) fields for
offline use.

The `display` field MUST NOT contain inferred, ranked, or normalized
content. All values are copied from IR `fields_raw` unchanged.

`record_locator` is copied from the IR unit (not from `fields_raw`) and
includes only the durable locator keys required for join resolution.

Output schema (one JSON object per line):
{
  "ir_id": "...",
  "ir_kind": "lexicon_entry" | "index_mapping",
  "source_id": "...",
  "norm_version": "norm_v1",
  "preferred_form": "...",
  "variant_forms": ["...", ...],
  "search_keys": { ... },
  "display": { ... },              # IR fields_raw, copied verbatim
  "record_locator": { ... }        # lexicon_entry only; from IR record_locator
}
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

LEXICON_ENTRY_KIND = "lexicon_entry"
# Join-critical keys: missing/invalid values fail closed.
RECORD_LOCATOR_REQUIRED_KEYS = (
    "kind",
    "url_canonical",
    "source_record_id",
)


class EnrichmentLocatorError(ValueError):
    """Raised when a lexicon_entry IR unit lacks a usable record_locator."""


class EnrichmentDuplicateLocatorError(EnrichmentLocatorError):
    """Raised when two lexicon entries expose the same locator tuple."""


LocatorTuple = tuple[str, str, str]


def lexicon_locator_tuple(record: dict[str, Any]) -> LocatorTuple | None:
    """
    Return the durable locator tuple for a lexicon_entry enriched row.

    Tuple: (source_id, record_locator.url_canonical, record_locator.source_record_id)

    Returns None for non-lexicon rows or rows without a projectable locator
    (callers that require uniqueness should only pass lexicon rows that already
    carry a validated record_locator).
    """
    if record.get("ir_kind") != LEXICON_ENTRY_KIND:
        return None
    locator = record.get("record_locator")
    if not isinstance(locator, dict):
        return None
    source_id = record.get("source_id")
    url_canonical = locator.get("url_canonical")
    source_record_id = locator.get("source_record_id")
    if (
        not isinstance(source_id, str)
        or not source_id
        or not isinstance(url_canonical, str)
        or not url_canonical
        or not isinstance(source_record_id, str)
        or not source_record_id
    ):
        return None
    return (source_id, url_canonical, source_record_id)


def find_duplicate_lexicon_locator_tuples(
    records: list[dict[str, Any]],
) -> list[tuple[LocatorTuple, list[str]]]:
    """
    Find locator tuples shared by two or more distinct lexicon ir_ids.

    Index-mapping rows are ignored (they must not carry record_locator).
    Lexicon rows without a complete locator tuple are ignored here; schema
    validation covers missing keys separately.
    """
    by_tuple: dict[LocatorTuple, list[str]] = {}
    for record in records:
        if record.get("ir_kind") != LEXICON_ENTRY_KIND:
            continue
        tuple_key = lexicon_locator_tuple(record)
        if tuple_key is None:
            continue
        ir_id = str(record.get("ir_id", ""))
        by_tuple.setdefault(tuple_key, []).append(ir_id)

    duplicates: list[tuple[LocatorTuple, list[str]]] = []
    for tuple_key, ir_ids in sorted(by_tuple.items(), key=lambda item: item[0]):
        unique_ids = sorted(set(ir_ids))
        if len(unique_ids) > 1:
            duplicates.append((tuple_key, unique_ids))
    return duplicates


def validate_unique_lexicon_locator_tuples(
    records: list[dict[str, Any]],
) -> list[str]:
    """
    Fail-closed uniqueness check for enriched lexicon locator tuples.

    Two different lexicon ir_ids MUST NOT expose the same
    (source_id, url_canonical, source_record_id) unless an explicit allowlist
    is introduced later. No allowlist exists in this slice.
    """
    issues: list[str] = []
    for (source_id, url_canonical, source_record_id), ir_ids in (
        find_duplicate_lexicon_locator_tuples(records)
    ):
        issues.append(
            "duplicate lexicon locator tuple "
            f"(source_id={source_id!r}, url_canonical={url_canonical!r}, "
            f"source_record_id={source_record_id!r}) shared by ir_ids={ir_ids}"
        )
    return issues


def assert_unique_lexicon_locator_tuples(records: list[dict[str, Any]]) -> None:
    """Raise EnrichmentDuplicateLocatorError if any duplicate locator tuples exist."""
    issues = validate_unique_lexicon_locator_tuples(records)
    if issues:
        raise EnrichmentDuplicateLocatorError(issues[0])


def _project_record_locator(record_locator: Any, *, ir_id: str) -> dict[str, Any]:
    """
    Project durable locator fields from an IR record_locator.

    Fail-closed on missing locator object or missing/invalid join-critical
    keys (`kind`, `url_canonical`, `source_record_id`).

    `anchor_names` is always emitted: copied when present and valid; defaulted
    to `[]` when absent on IR (some Mali-Pense rows omit the key). Invalid
    non-list values fail closed.
    """
    if not isinstance(record_locator, dict):
        raise EnrichmentLocatorError(
            f"ir_id={ir_id}: IR record_locator must be an object"
        )

    projected: dict[str, Any] = {}
    for key in RECORD_LOCATOR_REQUIRED_KEYS:
        if key not in record_locator:
            raise EnrichmentLocatorError(
                f"ir_id={ir_id}: IR record_locator missing required key {key!r}"
            )
        value = record_locator[key]
        if not isinstance(value, str) or not value:
            raise EnrichmentLocatorError(
                f"ir_id={ir_id}: IR record_locator.{key} must be a non-empty string"
            )
        projected[key] = value

    if "anchor_names" not in record_locator:
        projected["anchor_names"] = []
    else:
        value = record_locator["anchor_names"]
        if not isinstance(value, list) or not all(
            isinstance(item, str) for item in value
        ):
            raise EnrichmentLocatorError(
                f"ir_id={ir_id}: IR record_locator.anchor_names must be a list of strings"
            )
        projected["anchor_names"] = list(value)
    return projected


def build_ir_lookup(ir_paths: list[Path]) -> dict[str, dict[str, Any]]:
    """
    Build an ir_id → enrichment-source lookup from one or more IR JSONL files.

    Each lookup value is:
      {
        "fields_raw": <dict>,
        "record_locator": <dict|None>,
        "ir_kind": <str|None>,
      }

    Args:
        ir_paths: Paths to IR JSONL files (lexicon + index)

    Returns:
        dict mapping ir_id → enrichment source dict
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
                        logger.warning(
                            f"IR unit missing fields_raw at {ir_path}:{line_num}"
                        )
                        continue

                    if ir_id in lookup:
                        logger.warning(
                            f"Duplicate ir_id {ir_id} at {ir_path}:{line_num}, "
                            f"keeping first occurrence"
                        )
                        continue

                    locator = ir_unit.get("record_locator")
                    lookup[ir_id] = {
                        "fields_raw": fields_raw,
                        "record_locator": locator if isinstance(locator, dict) else None,
                        "ir_kind": ir_unit.get("ir_kind"),
                    }

                except json.JSONDecodeError as e:
                    logger.warning(f"Invalid JSON at {ir_path}:{line_num}: {e}")

    return lookup


def _coerce_enrichment_source(
    source: dict[str, Any] | None,
) -> dict[str, Any] | None:
    """
    Accept either the new enrichment-source shape or a legacy fields_raw dict.

    Legacy callers/tests may pass ir_id → fields_raw directly. Those paths do
    not project record_locator (no locator metadata available).
    """
    if source is None:
        return None
    if "fields_raw" in source and isinstance(source.get("fields_raw"), dict):
        return {
            "fields_raw": source["fields_raw"],
            "record_locator": source.get("record_locator"),
            "ir_kind": source.get("ir_kind"),
            "legacy_fields_raw_only": False,
        }
    # Legacy: entire value is fields_raw
    return {
        "fields_raw": source,
        "record_locator": None,
        "ir_kind": None,
        "legacy_fields_raw_only": True,
    }


def enrich_record(
    normalized: dict[str, Any],
    ir_lookup: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    """
    Enrich a single normalized record with display (and lexicon locator) fields.

    Args:
        normalized: A normalized record dict
        ir_lookup: ir_id → enrichment source (or legacy fields_raw) lookup

    Returns:
        Enriched record dict. If IR record not found, returns the
        normalized record unchanged (without display / record_locator).

    Raises:
        EnrichmentLocatorError: lexicon_entry IR is present via the full
        enrichment-source path but record_locator cannot be projected safely.
    """
    ir_id = normalized.get("ir_id", "")
    source = _coerce_enrichment_source(ir_lookup.get(ir_id))

    # Start with a copy of the normalized record (preserves provenance/derivation)
    enriched = dict(normalized)

    if source is None:
        if ir_id:
            logger.warning(
                f"No IR record found for ir_id={ir_id}, omitting display field"
            )
        return enriched

    enriched["display"] = source["fields_raw"]

    ir_kind = normalized.get("ir_kind") or source.get("ir_kind")
    if ir_kind == LEXICON_ENTRY_KIND and not source["legacy_fields_raw_only"]:
        enriched["record_locator"] = _project_record_locator(
            source.get("record_locator"),
            ir_id=str(ir_id),
        )

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
        "enriched_with_record_locator": 0,
        "duplicate_locator_tuples": 0,
        "missing_display": 0,
        "parse_errors": 0,
    }

    if verbose:
        logger.info(f"Loading IR records from {len(ir_paths)} file(s)...")

    ir_lookup = build_ir_lookup(ir_paths)
    stats["ir_records_loaded"] = len(ir_lookup)

    if verbose:
        logger.info(f"Loaded {len(ir_lookup)} IR records into lookup")

    if not normalized_path.exists():
        logger.error(f"Normalized JSONL not found: {normalized_path}")
        return stats

    output_path.parent.mkdir(parents=True, exist_ok=True)

    enriched_rows: list[dict[str, Any]] = []
    seen_locator_tuples: dict[LocatorTuple, str] = {}

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

                if "record_locator" in enriched:
                    stats["enriched_with_record_locator"] += 1
                    tuple_key = lexicon_locator_tuple(enriched)
                    if tuple_key is not None:
                        ir_id = str(enriched.get("ir_id", ""))
                        prior = seen_locator_tuples.get(tuple_key)
                        if prior is not None and prior != ir_id:
                            stats["duplicate_locator_tuples"] = 1
                            raise EnrichmentDuplicateLocatorError(
                                "duplicate lexicon locator tuple "
                                f"(source_id={tuple_key[0]!r}, "
                                f"url_canonical={tuple_key[1]!r}, "
                                f"source_record_id={tuple_key[2]!r}) "
                                f"shared by ir_ids={[prior, ir_id]}"
                            )
                        seen_locator_tuples[tuple_key] = ir_id

                enriched_rows.append(enriched)
                out_f.write(json.dumps(enriched, ensure_ascii=False) + "\n")

            except EnrichmentLocatorError as e:
                logger.error(
                    f"Locator projection failed at {normalized_path}:{line_num}: {e}"
                )
                stats["parse_errors"] += 1
                raise
            except json.JSONDecodeError as e:
                logger.warning(f"Invalid JSON at {normalized_path}:{line_num}: {e}")
                stats["parse_errors"] += 1
            except Exception as e:
                logger.warning(f"Error enriching {normalized_path}:{line_num}: {e}")
                stats["parse_errors"] += 1

    # Final uniqueness pass over the full enriched set (fail-closed).
    dup_issues = validate_unique_lexicon_locator_tuples(enriched_rows)
    stats["duplicate_locator_tuples"] = len(dup_issues)
    if dup_issues:
        raise EnrichmentDuplicateLocatorError(dup_issues[0])

    return stats
