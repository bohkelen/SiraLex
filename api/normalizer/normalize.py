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
  "norm_version": "<current ruleset>",
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

from normalization.norm_v3 import (
    RULESET_ID,
    compute_search_keys,
    extract_source_phrases,
    normalize_nfc,
)

from ir.lexical_review import (
    LexicalReviewValidationError,
    LexiconVariantRegistry,
    SIRALEX_LEXICAL_REVIEW_SOURCE_ID,
    parse_reviewed_target_variants,
    validate_lexicon_entry_evidence,
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


def normalize_lexicon_entry(
    ir_unit: dict[str, Any],
    variant_registry: LexiconVariantRegistry | None = None,
) -> NormalizedRecord:
    """
    Normalize a lexicon_entry IR unit.

    Preferred form: fields_raw.headword_latin (source's own choice)
    Variant forms: record_locator.anchor_names (includes preferred form)

    If anchor_names is missing or empty, variant_forms = [headword_latin].
    Reviewed target variants are merged after source-attested anchors only.
    """
    if ir_unit.get("source_id") == SIRALEX_LEXICAL_REVIEW_SOURCE_ID:
        validate_lexicon_entry_evidence(ir_unit)

    fields_raw = ir_unit.get("fields_raw", {})
    record_locator = ir_unit.get("record_locator", {})

    headword = fields_raw.get("headword_latin", "")
    headword_nko = fields_raw.get("headword_nko_provided", "")
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

    # Add source-provided N'Ko headword as an additional searchable variant.
    if headword_nko:
        nko_nfc = normalize_nfc(headword_nko)
        if not any(normalize_nfc(v) == nko_nfc for v in variant_forms):
            variant_forms.append(headword_nko)

    reviewed_variants = parse_reviewed_target_variants(ir_unit)
    if reviewed_variants:
        if variant_registry is None:
            raise LexicalReviewValidationError(
                "reviewed_target_variants require a LexiconVariantRegistry"
            )
        for reviewed_variant in reviewed_variants:
            variant_registry.validate_reviewed_variant(ir_unit, reviewed_variant)
            reviewed_nfc = normalize_nfc(reviewed_variant.form)
            if not any(normalize_nfc(v) == reviewed_nfc for v in variant_forms):
                variant_forms.append(reviewed_variant.form)

    # Compute search keys from all variant forms
    search_keys = compute_search_keys(variant_forms)

    ir_id = ir_unit.get("ir_id", "")
    if variant_registry is not None and reviewed_variants:
        for reviewed_variant in reviewed_variants:
            variant_registry.register_reviewed_form(ir_id, reviewed_variant.form)

    return NormalizedRecord(
        ir_id=ir_id,
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
    Variant forms: additive source phrases derived from fields_raw.source_term
    while always preserving the full original source_term.
    """
    fields_raw = ir_unit.get("fields_raw", {})

    source_term = fields_raw.get("source_term", "")

    # For index mappings, preserve the original and add deterministic phrases.
    preferred_form = source_term
    variant_forms = extract_source_phrases(source_term)

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


def normalize_ir_unit(
    ir_unit: dict[str, Any],
    variant_registry: LexiconVariantRegistry | None = None,
) -> NormalizedRecord | None:
    """
    Normalize a single IR unit based on its ir_kind.

    Returns None if the ir_kind is not supported for normalization.
    """
    ir_kind = ir_unit.get("ir_kind", "")

    if ir_kind == "lexicon_entry":
        return normalize_lexicon_entry(ir_unit, variant_registry=variant_registry)
    elif ir_kind == "index_mapping":
        return normalize_index_mapping(ir_unit)
    else:
        logger.warning(f"Unsupported ir_kind for normalization: {ir_kind}")
        return None


def _load_ir_units(input_paths: list[Path]) -> list[tuple[Path, int, dict[str, Any]]]:
    units: list[tuple[Path, int, dict[str, Any]]] = []
    for input_path in input_paths:
        if not input_path.exists():
            logger.warning(f"Input file not found: {input_path}")
            continue
        with open(input_path, "r", encoding="utf-8") as in_f:
            for line_num, line in enumerate(in_f, 1):
                line = line.strip()
                if not line:
                    continue
                units.append((input_path, line_num, json.loads(line)))
    return units


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

    if verbose:
        for input_path in input_paths:
            logger.info(f"Processing: {input_path}")

    try:
        loaded_units = _load_ir_units(input_paths)
    except json.JSONDecodeError as exc:
        logger.warning(f"Invalid JSON while loading IR units: {exc}")
        stats["errors"] += 1
        return stats

    variant_registry = LexiconVariantRegistry()
    for _input_path, _line_num, ir_unit in loaded_units:
        if ir_unit.get("ir_kind") != "lexicon_entry":
            continue
        try:
            variant_registry.register_source_attested(ir_unit)
        except LexicalReviewValidationError as exc:
            logger.warning(f"Error registering source-attested forms: {exc}")
            stats["errors"] += 1
            return stats

    with open(output_path, "w", encoding="utf-8") as out_f:
        for input_path, line_num, ir_unit in loaded_units:
            try:
                stats["ir_units_read"] += 1

                normalized = normalize_ir_unit(ir_unit, variant_registry=variant_registry)
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

            except LexicalReviewValidationError as exc:
                logger.warning(
                    f"Error normalizing {input_path}:{line_num}: {exc}"
                )
                stats["errors"] += 1
            except Exception as exc:
                logger.warning(
                    f"Error normalizing {input_path}:{line_num}: {exc}"
                )
                stats["errors"] += 1

    return stats
