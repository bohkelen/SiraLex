"""
Normalization ruleset norm_v2.

norm_v2 keeps the same per-string key transforms as norm_v1, but expands the
set of forms that feed those transforms:

- index_mapping source terms gain additive phrase variants extracted from
  gloss-like strings
- lexicon_entry target variants may include source-provided N'Ko headwords

This module contains only pure functions.
"""

from __future__ import annotations

import re
import unicodedata

from .norm_v1 import compute_search_keys, key_punct_stripped, normalize_nfc, normalize_whitespace

RULESET_ID = "norm_v2"

# Versioned source-phrase extraction policy. This is intentionally small and
# explicit so the behavior stays reviewable and deterministic.
MIN_SOURCE_PHRASE_LENGTH = 3
MAX_SOURCE_SEGMENTS = 12
MAX_SOURCE_PHRASES = 12
SOURCE_STOPWORDS = frozenset({
    "a",
    "au",
    "aux",
    "c",
    "ce",
    "ces",
    "cet",
    "cette",
    "d",
    "dans",
    "de",
    "des",
    "du",
    "elle",
    "elles",
    "en",
    "et",
    "il",
    "ils",
    "je",
    "la",
    "le",
    "les",
    "leur",
    "leurs",
    "lui",
    "ma",
    "mais",
    "mes",
    "mon",
    "ne",
    "nos",
    "notre",
    "on",
    "ou",
    "par",
    "pas",
    "pour",
    "qu",
    "que",
    "qui",
    "sa",
    "se",
    "ses",
    "son",
    "sur",
    "ta",
    "te",
    "tes",
    "toi",
    "ton",
    "tu",
    "un",
    "une",
    "vos",
    "votre",
    "vous",
    "y",
})

_ENUMERATION_RE = re.compile(r"(?:^|[\s,;/])(?P<marker>(?:[A-Za-z]\)|\d+\.))\s+")
_LEADING_ENUMERATION_RE = re.compile(r"^(?:[A-Za-z]\)|\d+\.)\s*")
_TRAILING_PAREN_RE = re.compile(r"^(?P<body>.*?)(?:\s*\([^()]*\))$")


def _strip_edge_punctuation(text: str) -> str:
    text = normalize_whitespace(text)
    if not text:
        return ""

    start = 0
    end = len(text)
    while start < end:
        ch = text[start]
        if ch.isspace() or unicodedata.category(ch).startswith("P"):
            start += 1
            continue
        break

    while end > start:
        ch = text[end - 1]
        if ch.isspace() or unicodedata.category(ch).startswith("P"):
            end -= 1
            continue
        break

    return normalize_whitespace(text[start:end])


def _split_enumerations(text: str) -> list[str]:
    text = normalize_whitespace(text)
    if not text:
        return []

    matches = list(_ENUMERATION_RE.finditer(text))
    if not matches:
        return [text]

    starts = [match.start("marker") for match in matches]
    if starts[0] != 0:
        return [text]

    out: list[str] = []
    for idx, start in enumerate(starts):
        end = starts[idx + 1] if idx + 1 < len(starts) else len(text)
        segment = normalize_whitespace(text[start:end])
        segment = _LEADING_ENUMERATION_RE.sub("", segment)
        if segment:
            out.append(segment)
    return out or [text]


def _split_top_level_segments(text: str) -> list[str]:
    """
    Split on commas/semicolons/slashes only at top level.

    This keeps multiword phrases intact and avoids exploding parenthetical
    commentary into unrelated fragments.
    """
    text = normalize_whitespace(text)
    if not text:
        return []

    out: list[str] = []
    depth = 0
    current: list[str] = []

    for ch in text:
        if ch == "(":
            depth += 1
            current.append(ch)
            continue
        if ch == ")":
            depth = max(0, depth - 1)
            current.append(ch)
            continue
        if depth == 0 and ch in ",;/":
            segment = normalize_whitespace("".join(current))
            if segment:
                out.append(segment)
                if len(out) >= MAX_SOURCE_SEGMENTS:
                    return out
            current = []
            continue
        current.append(ch)

    segment = normalize_whitespace("".join(current))
    if segment and len(out) < MAX_SOURCE_SEGMENTS:
        out.append(segment)
    return out


def _segment_tokens(text: str) -> list[str]:
    punct_stripped = key_punct_stripped(text)
    if not punct_stripped:
        return []
    return [token for token in punct_stripped.split(" ") if token]


def _is_noise_phrase(text: str) -> bool:
    if len(text) < MIN_SOURCE_PHRASE_LENGTH:
        return True

    tokens = _segment_tokens(text)
    if not tokens:
        return True

    return all(token in SOURCE_STOPWORDS for token in tokens)


def _emit_exact_phrase(text: str, out: list[str], seen: set[str]) -> None:
    if len(out) >= MAX_SOURCE_PHRASES:
        return
    candidate = normalize_whitespace(_LEADING_ENUMERATION_RE.sub("", text))
    if not candidate or _is_noise_phrase(candidate):
        return

    dedupe_key = normalize_nfc(normalize_whitespace(candidate))
    if dedupe_key in seen:
        return

    seen.add(dedupe_key)
    out.append(candidate)


def _emit_clean_phrase(text: str, out: list[str], seen: set[str]) -> None:
    if len(out) >= MAX_SOURCE_PHRASES:
        return
    candidate = _strip_edge_punctuation(_LEADING_ENUMERATION_RE.sub("", text))
    if not candidate or _is_noise_phrase(candidate):
        return

    dedupe_key = normalize_nfc(normalize_whitespace(candidate))
    if dedupe_key in seen:
        return

    seen.add(dedupe_key)
    out.append(candidate)


def extract_source_phrases(source_term: str) -> list[str]:
    """
    Deterministically derive additive search phrases from an index source term.

    Pipeline:
    1. Preserve original
    2. Split enumerations (a), b), 1., ...)
    3. Split segments on commas, semicolons, slashes
    4. For each segment, keep the full segment and, when present, a variant
       without trailing parenthetical context
    5. Strip leading/trailing punctuation
    6. Filter short/noise phrases
    7. Deduplicate, preserving order
    """
    if not source_term:
        return []

    phrases: list[str] = []
    seen: set[str] = set()

    # Preserve the original source term exactly as provided.
    original = source_term if source_term.strip() else ""
    if original:
        seen.add(normalize_nfc(normalize_whitespace(original)))
        phrases.append(original)

    normalized = normalize_whitespace(source_term)
    for enum_segment in _split_enumerations(normalized):
        if len(phrases) >= MAX_SOURCE_PHRASES:
            break

        for raw_segment in _split_top_level_segments(enum_segment):
            segment = normalize_whitespace(raw_segment)
            if not segment:
                continue

            _emit_exact_phrase(segment, phrases, seen)

            trailing_match = _TRAILING_PAREN_RE.match(segment)
            if trailing_match:
                body = normalize_whitespace(trailing_match.group("body"))
                _emit_exact_phrase(body, phrases, seen)
                _emit_clean_phrase(body, phrases, seen)
            else:
                _emit_clean_phrase(segment, phrases, seen)

            if len(phrases) >= MAX_SOURCE_PHRASES:
                break

    return phrases

