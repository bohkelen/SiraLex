"""
Normalization ruleset norm_v3.

norm_v3 preserves the full norm_v2 contract (variant expansion + phrase extraction)
and adds exactly one semantic change:

  Before applying the norm_v1 per-string key transforms, each search-key input
  form is whitespace-normalized, then NFC-canonicalized.

Historical norm_v1 and norm_v2 modules are not modified by this ruleset; norm_v3
composes them.
"""

from __future__ import annotations

from .norm_v1 import compute_search_keys as _compute_search_keys_v1
from .norm_v1 import normalize_nfc, normalize_whitespace
from .norm_v2 import (
    MAX_SOURCE_PHRASES,
    MAX_SOURCE_SEGMENTS,
    MIN_SOURCE_PHRASE_LENGTH,
    SOURCE_STOPWORDS,
    extract_source_phrases,
)

RULESET_ID = "norm_v3"


def compute_search_keys(forms: list[str]) -> dict[str, list[str]]:
    """
    Derive search keys like norm_v1, after NFC-canonicalizing each input form.

    Pipeline per form: normalize_whitespace → normalize_nfc → norm_v1 key ladder.
    """
    prepped = [normalize_nfc(normalize_whitespace(f)) for f in forms]
    return _compute_search_keys_v1(prepped)


__all__ = [
    "RULESET_ID",
    "compute_search_keys",
    "extract_source_phrases",
    "MAX_SOURCE_PHRASES",
    "MAX_SOURCE_SEGMENTS",
    "MIN_SOURCE_PHRASE_LENGTH",
    "SOURCE_STOPWORDS",
    "normalize_nfc",
    "normalize_whitespace",
]
