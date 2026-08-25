"""Semantic comparison projection for Malidaba lexicon IR records."""

from __future__ import annotations

from typing import Any


# Operational / provenance fields intentionally excluded from semantic projection.
OPERATIONAL_TOP_LEVEL_IGNORED = frozenset(
    {
        "evidence",
        "parse_warnings",
    }
)

CHANGE_HEADWORD = "HEADWORD_CHANGED"
CHANGE_VARIANT = "VARIANT_CHANGED"
CHANGE_GLOSS = "GLOSS_CHANGED"
CHANGE_SENSE = "SENSE_CHANGED"
CHANGE_EXAMPLE = "EXAMPLE_CHANGED"
CHANGE_IDIOM = "IDIOM_CHANGED"
CHANGE_NKO = "NKO_CHANGED"
CHANGE_CROSS_REF = "CROSS_REFERENCE_CHANGED"
CHANGE_OTHER = "OTHER_LEXICAL_CHANGE"

CHANGE_CLASS_ORDER = (
    CHANGE_HEADWORD,
    CHANGE_VARIANT,
    CHANGE_GLOSS,
    CHANGE_SENSE,
    CHANGE_EXAMPLE,
    CHANGE_IDIOM,
    CHANGE_NKO,
    CHANGE_CROSS_REF,
    CHANGE_OTHER,
)


def _sorted_unique(values: list[str] | None) -> list[str]:
    if not values:
        return []
    return sorted({str(v) for v in values})


def _project_example(example: dict[str, Any]) -> dict[str, Any]:
    return {
        "text_latin": example.get("text_latin"),
        "text_nko_provided": example.get("text_nko_provided"),
        "trans_en": example.get("trans_en"),
        "trans_fr": example.get("trans_fr"),
        "trans_ru": example.get("trans_ru"),
        "source_attribution": example.get("source_attribution"),
    }


def _project_sense(sense: dict[str, Any]) -> dict[str, Any]:
    examples = [_project_example(e) for e in (sense.get("examples") or [])]
    sub_entries = sense.get("sub_entries") or []
    return {
        "sense_num": sense.get("sense_num"),
        "gloss_fr": sense.get("gloss_fr"),
        "gloss_en": sense.get("gloss_en"),
        "gloss_ru": sense.get("gloss_ru"),
        "usage_note": sense.get("usage_note"),
        "synonyms_raw": _sorted_unique(sense.get("synonyms_raw")),
        "examples": examples,
        "sub_entries": sub_entries,
    }


def semantic_projection(record: dict[str, Any]) -> dict[str, Any]:
    """
    Deterministic lexical projection used for equality / change classification.

    Ignores evidence, parse_warnings, snapshot ids, and other operational provenance.
    """
    fields = record.get("fields_raw") or {}
    locator = record.get("record_locator") or {}
    senses = [_project_sense(s) for s in (fields.get("senses") or [])]
    return {
        "headword_latin": fields.get("headword_latin"),
        "headword_nko_provided": fields.get("headword_nko_provided"),
        "ps_raw": fields.get("ps_raw"),
        "pos_hint": fields.get("pos_hint"),
        "variants_raw": _sorted_unique(fields.get("variants_raw")),
        "synonyms_raw": _sorted_unique(fields.get("synonyms_raw")),
        "etymology_raw": fields.get("etymology_raw"),
        "literal_meaning_raw": fields.get("literal_meaning_raw"),
        # corpus_count is source-visible but volatile relative to MRC updates;
        # keep it out of semantic equality to avoid capture noise.
        "anchor_names": _sorted_unique(
            locator.get("anchor_names") or fields.get("anchor_names")
        ),
        "senses": senses,
    }


def classify_semantic_changes(
    baseline_proj: dict[str, Any],
    current_proj: dict[str, Any],
) -> list[str]:
    """Return sorted change class labels for two semantic projections."""
    classes: set[str] = set()

    if baseline_proj.get("headword_latin") != current_proj.get("headword_latin"):
        classes.add(CHANGE_HEADWORD)

    if baseline_proj.get("headword_nko_provided") != current_proj.get(
        "headword_nko_provided"
    ):
        classes.add(CHANGE_NKO)

    if baseline_proj.get("variants_raw") != current_proj.get("variants_raw"):
        classes.add(CHANGE_VARIANT)

    base_senses = baseline_proj.get("senses") or []
    cur_senses = current_proj.get("senses") or []

    def gloss_tuple(senses: list[dict[str, Any]]) -> list[tuple]:
        return [
            (s.get("sense_num"), s.get("gloss_fr"), s.get("gloss_en"), s.get("gloss_ru"))
            for s in senses
        ]

    def example_tuple(senses: list[dict[str, Any]]) -> list:
        return [s.get("examples") or [] for s in senses]

    def idiom_tuple(senses: list[dict[str, Any]]) -> list:
        return [s.get("sub_entries") or [] for s in senses]

    if gloss_tuple(base_senses) != gloss_tuple(cur_senses):
        classes.add(CHANGE_GLOSS)

    if len(base_senses) != len(cur_senses) or any(
        (b.get("sense_num"), b.get("usage_note"), b.get("synonyms_raw"))
        != (c.get("sense_num"), c.get("usage_note"), c.get("synonyms_raw"))
        for b, c in zip(base_senses, cur_senses)
    ):
        classes.add(CHANGE_SENSE)

    if example_tuple(base_senses) != example_tuple(cur_senses):
        classes.add(CHANGE_EXAMPLE)

    if idiom_tuple(base_senses) != idiom_tuple(cur_senses):
        classes.add(CHANGE_IDIOM)

    base_xrefs = (
        baseline_proj.get("synonyms_raw"),
        baseline_proj.get("literal_meaning_raw"),
        baseline_proj.get("etymology_raw"),
        baseline_proj.get("anchor_names"),
    )
    cur_xrefs = (
        current_proj.get("synonyms_raw"),
        current_proj.get("literal_meaning_raw"),
        current_proj.get("etymology_raw"),
        current_proj.get("anchor_names"),
    )
    if base_xrefs != cur_xrefs:
        classes.add(CHANGE_CROSS_REF)

    if baseline_proj.get("ps_raw") != current_proj.get("ps_raw") or baseline_proj.get(
        "pos_hint"
    ) != current_proj.get("pos_hint"):
        classes.add(CHANGE_OTHER)

    # If projections differ but no finer class matched, mark other.
    if baseline_proj != current_proj and not classes:
        classes.add(CHANGE_OTHER)

    return [c for c in CHANGE_CLASS_ORDER if c in classes]
