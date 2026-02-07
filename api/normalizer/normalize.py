"""
Normalization pipeline: IR JSONL → Normalized JSONL.

Reads IR units (lexicon_entry, index_mapping) and produces normalized
records with search keys, preferred forms, and variant metadata.

This module never mutates IR. Output is a separate JSONL file that
joins back to IR via ir_id.

Output schema (one JSON object per line):
{
  "ir_id": "...",
  "ir_kind": "lexicon_entry" | "index_mapping",
  "source_id": "...",
  "norm_version": "norm_v1",
  "preferred_form": "...",
  "variant_forms": ["...", ...],
  "search_keys": {
    "casefold": ["...", ...],
    "diacritics_insensitive": ["...", ...],
    "punct_stripped": ["...", ...],
    "nospace": ["...", ...]
  }
}
"""

import json
import logging
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterator

# Add shared to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "shared"))

from normalization.norm_v1 import (
    RULESET_ID,
    compute_search_keys,
    normalize_nfc,
)

logger = logging.getLogger(__name__)


@dataclass
class NormalizedRecord:
    """A normalized record derived from a single IR unit."""
    ir_id: str
    ir_kind: str
    source_id: str
    norm_version: str
    preferred_form: str
    variant_forms: list[str]
    search_keys: dict[str, list[str]]

    def to_dict(self) -> dict[str, Any]:
        return {
            "ir_id": self.ir_id,
            "ir_kind": self.ir_kind,
            "source_id": self.source_id,
            "norm_version": self.norm_version,
            "preferred_form": self.preferred_form,
            "variant_forms": self.variant_forms,
            "search_keys": self.search_keys,
        }


def normalize_lexicon_entry(ir_unit: dict[str, Any]) -> NormalizedRecord:
    """
    Normalize a lexicon_entry IR unit.

    Preferred form: fields_raw.headword_latin (source's own choice)
    Variant forms: record_locator.anchor_names (includes preferred form)

    If anchor_names is missing or empty, variant_forms = [headword_latin].
    """
    fields_raw = ir_unit.get("fields_raw", {})
    record_locator = ir_unit.get("record_locator", {})

    headword = fields_raw.get("headword_latin", "")
    anchor_names = record_locator.get("anchor_names", [])

    # Preferred form is the source's own headword
    preferred_form = headword

    # Variant forms include preferred form (per policy decision)
    # If anchor_names exists and is non-empty, use it; otherwise fall back
    if anchor_names:
        variant_forms = list(anchor_names)
        # Ensure preferred_form is in variant_forms (NFC-safe comparison)
        preferred_nfc = normalize_nfc(preferred_form)
        if not any(normalize_nfc(v) == preferred_nfc for v in variant_forms):
            variant_forms.insert(0, preferred_form)
    else:
        variant_forms = [preferred_form] if preferred_form else []

    # Compute search keys from all variant forms
    search_keys = compute_search_keys(variant_forms)

    return NormalizedRecord(
        ir_id=ir_unit.get("ir_id", ""),
        ir_kind=ir_unit.get("ir_kind", ""),
        source_id=ir_unit.get("source_id", ""),
        norm_version=RULESET_ID,
        preferred_form=preferred_form,
        variant_forms=variant_forms,
        search_keys=search_keys,
    )


def normalize_index_mapping(ir_unit: dict[str, Any]) -> NormalizedRecord:
    """
    Normalize an index_mapping IR unit.

    Preferred form: fields_raw.source_term (the French headword)
    Variant forms: [source_term] (index mappings have no variant forms)
    """
    fields_raw = ir_unit.get("fields_raw", {})

    source_term = fields_raw.get("source_term", "")

    # For index mappings, there's only one form
    preferred_form = source_term
    variant_forms = [source_term] if source_term else []

    # Compute search keys
    search_keys = compute_search_keys(variant_forms)

    return NormalizedRecord(
        ir_id=ir_unit.get("ir_id", ""),
        ir_kind=ir_unit.get("ir_kind", ""),
        source_id=ir_unit.get("source_id", ""),
        norm_version=RULESET_ID,
        preferred_form=preferred_form,
        variant_forms=variant_forms,
        search_keys=search_keys,
    )


def normalize_ir_unit(ir_unit: dict[str, Any]) -> NormalizedRecord | None:
    """
    Normalize a single IR unit based on its ir_kind.

    Returns None if the ir_kind is not supported for normalization.
    """
    ir_kind = ir_unit.get("ir_kind", "")

    if ir_kind == "lexicon_entry":
        return normalize_lexicon_entry(ir_unit)
    elif ir_kind == "index_mapping":
        return normalize_index_mapping(ir_unit)
    else:
        logger.warning(f"Unsupported ir_kind for normalization: {ir_kind}")
        return None


def process_ir_files(
    input_paths: list[Path],
    output_path: Path,
    verbose: bool = False,
) -> dict[str, int]:
    """
    Read IR JSONL file(s), normalize all units, write normalized JSONL.

    Args:
        input_paths: Paths to IR JSONL files (lexicon + index)
        output_path: Path to output normalized JSONL file
        verbose: Whether to log progress

    Returns:
        Stats dict with counts
    """
    stats = {
        "ir_units_read": 0,
        "lexicon_entries_normalized": 0,
        "index_mappings_normalized": 0,
        "skipped": 0,
        "errors": 0,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, "w", encoding="utf-8") as out_f:
        for input_path in input_paths:
            if not input_path.exists():
                logger.warning(f"Input file not found: {input_path}")
                continue

            if verbose:
                logger.info(f"Processing: {input_path}")

            with open(input_path, "r", encoding="utf-8") as in_f:
                for line_num, line in enumerate(in_f, 1):
                    line = line.strip()
                    if not line:
                        continue

                    try:
                        ir_unit = json.loads(line)
                        stats["ir_units_read"] += 1

                        normalized = normalize_ir_unit(ir_unit)
                        if normalized is None:
                            stats["skipped"] += 1
                            continue

                        out_f.write(
                            json.dumps(normalized.to_dict(), ensure_ascii=False) + "\n"
                        )

                        if normalized.ir_kind == "lexicon_entry":
                            stats["lexicon_entries_normalized"] += 1
                        elif normalized.ir_kind == "index_mapping":
                            stats["index_mappings_normalized"] += 1

                    except json.JSONDecodeError as e:
                        logger.warning(
                            f"Invalid JSON at {input_path}:{line_num}: {e}"
                        )
                        stats["errors"] += 1
                    except Exception as e:
                        logger.warning(
                            f"Error normalizing {input_path}:{line_num}: {e}"
                        )
                        stats["errors"] += 1

    return stats
