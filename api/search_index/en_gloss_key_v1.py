"""
en_gloss_key_v1 — deterministic English gloss key extraction (ML1B / ML1C1).

Authority: sense-level `display.senses[].gloss_en` only.

Allowed:
  - exact unitary gloss (including multiword phrases)
  - comma-separated alternatives
  - trailing parenthetical strip

Forbidden:
  - examples[].trans_en
  - subentry gloss_en
  - whitespace tokenization
  - semicolon / slash / "or" splits
  - parenthetical interior extraction
  - stemming, fuzzy, AI, inferred synonymy
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Iterator, Literal

EXTRACTION_RULE = "en_gloss_key_v1"

SplitKind = Literal["unitary", "comma_alternative"]

_TRAILING_PAREN = re.compile(r"\s*\([^)]*\)\s*$")


@dataclass(frozen=True)
class EnglishGlossKeyCandidate:
    """One extracted English search candidate before ladder normalization."""

    key_surface: str
    gloss_en_raw: str
    sense_index: int
    split_kind: SplitKind
    extraction_rule: str = EXTRACTION_RULE


def strip_trailing_parenthetical(gloss: str) -> str:
    """
    Remove a single trailing `(…)` group when a nonempty remainder remains.

    Leading / mid-gloss parentheses (e.g. `(not) yet`) are preserved.
    """
    stripped = _TRAILING_PAREN.sub("", gloss).strip()
    return stripped if stripped else gloss


def extract_en_gloss_key_v1_from_gloss(
    gloss_en: str,
    *,
    sense_index: int,
) -> list[EnglishGlossKeyCandidate]:
    """
    Extract English key surfaces from one sense gloss_en string.

    Returns candidates in emission order (deterministic). Surfaces are trimmed
    but not casefolded — ladder normalization is applied by the index builder.
    """
    if not isinstance(gloss_en, str):
        return []
    raw = gloss_en.strip()
    if not raw:
        return []

    base = strip_trailing_parenthetical(raw)
    candidates: list[EnglishGlossKeyCandidate] = []
    seen: set[str] = set()

    def emit(surface: str, split_kind: SplitKind) -> None:
        text = surface.strip()
        if not text or text in seen:
            return
        seen.add(text)
        candidates.append(
            EnglishGlossKeyCandidate(
                key_surface=text,
                gloss_en_raw=raw,
                sense_index=sense_index,
                split_kind=split_kind,
            )
        )

    if "," in base:
        for part in base.split(","):
            emit(part, "comma_alternative")
    else:
        emit(base, "unitary")

    return candidates


def iter_en_gloss_key_v1_from_record(
    record: dict[str, Any],
) -> Iterator[EnglishGlossKeyCandidate]:
    """
    Yield English key candidates from an enriched lexicon record.

    Reads only `display.senses[].gloss_en`. Ignores examples and sub_entries.
    """
    if record.get("ir_kind") != "lexicon_entry":
        return

    display = record.get("display")
    if not isinstance(display, dict):
        return

    senses = display.get("senses")
    if not isinstance(senses, list):
        return

    for sense_index, sense in enumerate(senses):
        if not isinstance(sense, dict):
            continue
        gloss = sense.get("gloss_en")
        if not isinstance(gloss, str):
            continue
        yield from extract_en_gloss_key_v1_from_gloss(gloss, sense_index=sense_index)


def extract_en_gloss_key_v1_surfaces(gloss_en: str) -> list[str]:
    """Convenience: return only key surface strings for a single gloss."""
    return [
        c.key_surface
        for c in extract_en_gloss_key_v1_from_gloss(gloss_en, sense_index=0)
    ]
