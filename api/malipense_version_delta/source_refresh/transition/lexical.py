"""Compact lexical summaries for F16 human-review worksheets."""

from __future__ import annotations

from typing import Any

from malipense_version_delta.canonical_json import canonical_dumps
from malipense_version_delta.review_descriptors import reviewability_descriptors


def lexical_locator(record: dict[str, Any] | None) -> dict[str, Any]:
    if not record:
        return {
            "ir_id": None,
            "url_canonical": None,
            "source_record_id": None,
            "headword_latin": None,
            "headword_nko": None,
        }
    locator = record.get("record_locator") or {}
    fields = record.get("fields_raw") or {}
    return {
        "ir_id": record.get("ir_id"),
        "url_canonical": locator.get("url_canonical"),
        "source_record_id": locator.get("source_record_id"),
        "headword_latin": fields.get("headword_latin"),
        "headword_nko": fields.get("headword_nko_provided"),
    }


def semantic_summary(record: dict[str, Any] | None, *, gloss_limit: int = 3) -> str:
    """Human-readable gloss/sense summary; empty when record is missing."""
    if not record:
        return ""
    fields = record.get("fields_raw") or {}
    senses = fields.get("senses") or []
    fr = [str(s.get("gloss_fr")) for s in senses if s.get("gloss_fr")]
    en = [str(s.get("gloss_en")) for s in senses if s.get("gloss_en")]
    ru = [str(s.get("gloss_ru")) for s in senses if s.get("gloss_ru")]
    desc = reviewability_descriptors(record)
    payload = {
        "headword_latin": fields.get("headword_latin"),
        "headword_nko": fields.get("headword_nko_provided"),
        "sense_count": desc["sense_count"],
        "example_count": desc["example_count"],
        "idiom_or_subentry_count": desc["idiom_or_subentry_count"],
        "gloss_fr": fr[:gloss_limit],
        "gloss_en": en[:gloss_limit],
        "gloss_ru": ru[:gloss_limit],
    }
    return canonical_dumps(payload)


def current_records_same_page_headword(
    *,
    url_canonical: str | None,
    headword_latin: str | None,
    current_records: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Exact (url, headword) current records only — no fuzzy matching."""
    if not url_canonical or headword_latin is None or headword_latin == "":
        return []
    out: list[dict[str, Any]] = []
    for rec in current_records:
        loc = rec.get("record_locator") or {}
        fields = rec.get("fields_raw") or {}
        if loc.get("url_canonical") == url_canonical and fields.get("headword_latin") == headword_latin:
            out.append(rec)
    out.sort(key=lambda r: str(r.get("ir_id") or ""))
    return out
