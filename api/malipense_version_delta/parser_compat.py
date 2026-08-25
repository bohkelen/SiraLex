"""Parser compatibility checks for current Malidaba HTML vs existing parser."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class ParserCompatResult:
    status: str  # PASS | FAIL
    baseline_entries: int
    current_entries: int
    current_with_senses: int
    current_no_senses: int
    current_no_senses_ratio: float
    baseline_with_senses: int
    baseline_no_senses: int
    nested_lxp2_pages: int
    pages_checked: int
    block_reason: str | None
    notes: list[str]


def _has_senses(record: dict[str, Any]) -> bool:
    fields = record.get("fields_raw") or {}
    senses = fields.get("senses") or []
    return bool(senses)


def _no_senses_warning(record: dict[str, Any]) -> bool:
    warnings = record.get("parse_warnings") or []
    return any(w == "no_senses_found" or str(w).startswith("no_senses") for w in warnings)


def assess_parser_compatibility(
    baseline_records: list[dict[str, Any]],
    current_records: list[dict[str, Any]],
    *,
    nested_lxp2_pages: int = 0,
    pages_checked: int = 0,
    no_senses_ratio_fail: float = 0.50,
) -> ParserCompatResult:
    """
    Detect parser breakage that would produce misleading lexical deltas.

    FAIL when a majority of current entries lack senses while baseline mostly
    has senses, and/or nested lxP2 structure is observed on lexicon pages.
    """
    base_with = sum(1 for r in baseline_records if _has_senses(r))
    base_without = len(baseline_records) - base_with
    cur_with = sum(1 for r in current_records if _has_senses(r))
    cur_without = len(current_records) - cur_with
    ratio = (cur_without / len(current_records)) if current_records else 1.0

    notes: list[str] = []
    block_reason: str | None = None
    status = "PASS"

    if nested_lxp2_pages > 0:
        notes.append(
            f"nested_lxp2_inside_lxp observed on {nested_lxp2_pages}/{pages_checked} pages"
        )

    if current_records and ratio >= no_senses_ratio_fail:
        # Only fail if baseline was largely successful (not a baseline that also lacks senses)
        base_ratio = (base_without / len(baseline_records)) if baseline_records else 1.0
        if base_ratio < 0.20:
            status = "FAIL"
            block_reason = (
                "current_parse_sense_coverage_collapse:"
                f"current_no_senses_ratio={ratio:.4f}"
                f";baseline_no_senses_ratio={base_ratio:.4f}"
            )
            notes.append(block_reason)

    if nested_lxp2_pages > 0 and cur_with == 0 and current_records:
        status = "FAIL"
        if not block_reason:
            block_reason = "html_structure_change_nested_lxp2_breaks_sibling_sense_parser"
            notes.append(block_reason)

    return ParserCompatResult(
        status=status,
        baseline_entries=len(baseline_records),
        current_entries=len(current_records),
        current_with_senses=cur_with,
        current_no_senses=cur_without,
        current_no_senses_ratio=ratio,
        baseline_with_senses=base_with,
        baseline_no_senses=base_without,
        nested_lxp2_pages=nested_lxp2_pages,
        pages_checked=pages_checked,
        block_reason=block_reason,
        notes=notes,
    )


def detect_nested_lxp2_in_html(html: str) -> bool:
    """
    Detect raw HTML pattern where <p class="lxP2"> appears before the first
    closing </p> of an opening <p class="lxP"> (invalid nesting that BS4 nests).
    """
    needle = '<p class="lxP">'
    idx = 0
    while True:
        start = html.find(needle, idx)
        if start < 0:
            return False
        region = html[start : start + 2000]
        close = region.find("</p>")
        if close < 0:
            idx = start + len(needle)
            continue
        if '<p class="lxP2">' in region[:close]:
            return True
        idx = start + len(needle)
