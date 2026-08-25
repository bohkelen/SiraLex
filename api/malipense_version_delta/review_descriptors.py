"""Reviewability descriptors and queue row builders for Malidaba delta triage."""

from __future__ import annotations

from typing import Any


def reviewability_descriptors(record: dict[str, Any]) -> dict[str, int | bool]:
    """Deterministic triage metadata from parsed current IR (no quality score)."""
    fields = record.get("fields_raw") or {}
    senses = fields.get("senses") or []
    sense_count = len(senses)
    has_sense = sense_count > 0
    has_fr = any(s.get("gloss_fr") for s in senses)
    has_en = any(s.get("gloss_en") for s in senses)
    has_ru = any(s.get("gloss_ru") for s in senses)
    example_count = sum(len(s.get("examples") or []) for s in senses)
    idiom_count = sum(len(s.get("sub_entries") or []) for s in senses)
    variants = fields.get("variants_raw") or []
    warnings = record.get("parse_warnings") or []

    return {
        "has_sense": has_sense,
        "sense_count": sense_count,
        "has_fr_gloss": has_fr,
        "has_en_gloss": has_en,
        "has_ru_gloss": has_ru,
        "has_nko_headword": bool(fields.get("headword_nko_provided")),
        "variant_count": len(variants),
        "example_count": example_count,
        "idiom_or_subentry_count": idiom_count,
        "parse_warning_count": len(warnings),
    }


def gloss_summary(record: dict[str, Any]) -> dict[str, Any]:
    """Compact gloss lists for worksheet context."""
    fields = record.get("fields_raw") or {}
    senses = fields.get("senses") or []
    fr = [s.get("gloss_fr") for s in senses if s.get("gloss_fr")]
    en = [s.get("gloss_en") for s in senses if s.get("gloss_en")]
    ru = [s.get("gloss_ru") for s in senses if s.get("gloss_ru")]
    return {
        "gloss_fr_list": fr[:5],
        "gloss_en_list": en[:5],
        "gloss_ru_list": ru[:5],
        "sense_count": len(senses),
    }


def headword_group_id(headword: str | None, url: str) -> str:
    """Presentation-only grouping key (not identity)."""
    return f"{url}|{headword or ''}"


def build_queue_row(
    *,
    delta_row: dict[str, Any],
    current_record: dict[str, Any] | None,
    baseline_record: dict[str, Any] | None,
    source_section: dict[str, Any] | None,
    review_subject_id: str,
    headword_group_size: int,
    current_fingerprint: str | None,
) -> dict[str, Any]:
    """Build one deterministic queue manifest row."""
    current = delta_row.get("current") or {}
    baseline = delta_row.get("baseline") or {}
    descriptors = reviewability_descriptors(current_record) if current_record else {}

    row: dict[str, Any] = {
        "schema_version": "malidaba_review_queue_v1",
        "review_subject_id": review_subject_id,
        "delta_class": delta_row.get("classification"),
        "identity_confidence": delta_row.get("identity_confidence"),
        "match_method": delta_row.get("match_method"),
        "change_classes": delta_row.get("change_classes") or [],
        "baseline_ir_id": baseline.get("ir_id"),
        "current_ir_id": current.get("ir_id"),
        "url_canonical": current.get("url_canonical") or baseline.get("url_canonical"),
        "source_record_id": current.get("source_record_id")
        or baseline.get("source_record_id"),
        "headword_latin": current.get("headword_latin") or baseline.get("headword_latin"),
        "headword_group_id": headword_group_id(
            current.get("headword_latin") or baseline.get("headword_latin"),
            str(current.get("url_canonical") or baseline.get("url_canonical") or ""),
        ),
        "headword_group_size": headword_group_size,
        "current_record_fingerprint_sha256": current_fingerprint,
        "baseline_semantic_sha256": delta_row.get("baseline_semantic_sha256"),
        "current_semantic_sha256": delta_row.get("current_semantic_sha256"),
        "reviewability": descriptors,
    }

    if source_section:
        row.update(
            {
                "source_section_class": source_section.get("source_section_class"),
                "source_section_ps_marker": source_section.get("source_section_ps_marker"),
                "source_section_ps_text": source_section.get("source_section_ps_text"),
                "source_section_rule_id": source_section.get("classification_rule_id"),
            }
        )

    return row
