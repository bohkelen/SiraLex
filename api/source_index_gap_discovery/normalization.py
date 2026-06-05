"""Normalization helpers for source-index gap discovery."""

from __future__ import annotations

import re
import sys
from pathlib import Path

# Add shared to path for normalization imports, matching existing API tooling.
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "shared"))

from normalization.norm_v3 import compute_search_keys, normalize_nfc, normalize_whitespace

from .models import KEY_TYPE_ORDER

TOKEN_RE = re.compile(r"[A-Za-zÀ-ÖØ-öø-ÿŒœÆæÇçÉéÈèÊêËëÎîÏïÔôÙùÛûÜüŸÿ]+(?:['’][A-Za-zÀ-ÖØ-öø-ÿŒœÆæÇçÉéÈèÊêËëÎîÏïÔôÙùÛûÜüŸÿ]+)?")


def source_search_keys(term: str) -> dict[str, list[str]]:
    """Return norm_v3 source-side keys for a candidate term."""
    keys = compute_search_keys([term])
    return {
        key_type: [key for key in keys.get(key_type, []) if key]
        for key_type in KEY_TYPE_ORDER
    }


def canonical_term(term: str) -> str:
    """Normalize spacing/NFC while preserving the review-facing spelling."""
    return normalize_nfc(normalize_whitespace(term))


def primary_source_key(term: str) -> str:
    """Return the main source lookup key used for grouping and reports."""
    keys = source_search_keys(term)
    for key_type in KEY_TYPE_ORDER:
        values = keys.get(key_type, [])
        if values:
            return values[0]
    return canonical_term(term).casefold()


def tokenize_french_text(text: str) -> list[str]:
    """Extract reviewable French-looking tokens from text."""
    tokens: list[str] = []
    for match in TOKEN_RE.finditer(text):
        token = canonical_term(match.group(0).replace("’", "'")).strip("'")
        if token:
            tokens.append(token)
    return tokens
