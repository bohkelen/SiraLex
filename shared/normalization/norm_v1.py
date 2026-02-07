"""
Normalization ruleset norm_v1.

Implements shared/specs/normalization-versioning.md.

This module contains ONLY pure functions. No I/O, no side effects.
Every function is deterministic: same input → same output.

Design decisions:
- Search keys are computed from all variant forms, deduplicated per key type.
  Provenance (which variant produced which key) is recoverable by re-running
  norm_v1 functions on individual variant_forms entries.
- N'Ko fields get NFC normalization only (no search keys in v1).
- Preferred form = source's own headword_latin (no inference).
- French index terms are normalized with the same Latin-script rules.

Key types produced (all Latin-script):
- casefold: Unicode casefold (case-insensitive, diacritics preserved)
- diacritics_insensitive: casefold + strip combining marks
- punct_stripped: casefold + diacritics stripped + punctuation removed
- nospace: casefold + diacritics stripped + spaces removed
"""

import re
import unicodedata

RULESET_ID = "norm_v1"


# ---------------------------------------------------------------------------
# Primitive transforms (building blocks)
# ---------------------------------------------------------------------------

def normalize_whitespace(s: str) -> str:
    """
    Replace any Unicode whitespace sequence with a single ASCII space, trim.

    Spec: normalization-versioning.md § Whitespace normalization.
    """
    # \s matches any Unicode whitespace
    result = re.sub(r"\s+", " ", s)
    return result.strip()


def strip_diacritics(s: str) -> str:
    """
    Remove combining marks (diacritics) from a string.

    Algorithm (normative, from spec):
    1. NFD decompose
    2. Remove code points with General Category Mn, Mc, Me
    3. NFC recompose

    Note: base characters like ɔ (U+0254) and ɛ (U+025B) are NOT marks
    and are preserved. Only combining marks (tone, accent, length) are stripped.
    """
    nfd = unicodedata.normalize("NFD", s)
    stripped = "".join(
        c for c in nfd
        if unicodedata.category(c) not in ("Mn", "Mc", "Me")
    )
    return unicodedata.normalize("NFC", stripped)


def strip_punctuation(s: str) -> str:
    """
    Remove all punctuation characters, then whitespace-normalize.

    Spec: normalization-versioning.md § Punctuation normalization (punctuation_stripped).
    Removes any character with Unicode General Category starting with 'P'.
    """
    result = "".join(
        c for c in s
        if not unicodedata.category(c).startswith("P")
    )
    return normalize_whitespace(result)


def punctuation_to_space(s: str) -> str:
    """
    Replace punctuation with spaces, then whitespace-normalize.

    Spec: normalization-versioning.md § Punctuation normalization (punctuation_to_space).
    """
    result = "".join(
        " " if unicodedata.category(c).startswith("P") else c
        for c in s
    )
    return normalize_whitespace(result)


def casefold_latin(s: str) -> str:
    """
    Apply Unicode casefold for case-insensitive matching.

    Spec: normalization-versioning.md § Case normalization boundaries.
    Latin: casefold. N'Ko: no-op. Other: no-op unless specified.

    Since we apply this to Latin-script strings, we use full casefold.
    """
    return s.casefold()


def remove_spaces(s: str) -> str:
    """Remove all spaces (for 'phone typing' / no-space keys)."""
    return s.replace(" ", "")


def normalize_nfc(s: str) -> str:
    """Apply NFC normalization. Baseline for all operations."""
    return unicodedata.normalize("NFC", s)


# ---------------------------------------------------------------------------
# Composed search key functions
# ---------------------------------------------------------------------------

def key_casefold(s: str) -> str:
    """
    Case-insensitive key, diacritics preserved.

    Pipeline: whitespace normalize → casefold
    """
    return casefold_latin(normalize_whitespace(s))


def key_diacritics_insensitive(s: str) -> str:
    """
    Case + diacritics insensitive key (broadest Latin match).

    Pipeline: whitespace normalize → casefold → strip diacritics
    """
    return strip_diacritics(casefold_latin(normalize_whitespace(s)))


def key_punct_stripped(s: str) -> str:
    """
    Punctuation-insensitive key (also case + diacritics insensitive).

    Pipeline: whitespace normalize → strip punctuation → casefold → strip diacritics
    """
    return strip_diacritics(casefold_latin(strip_punctuation(normalize_whitespace(s))))


def key_nospace(s: str) -> str:
    """
    No-space key for 'phone typing' search (also case + diacritics insensitive).

    Pipeline: whitespace normalize → casefold → strip diacritics → remove spaces
    """
    return remove_spaces(strip_diacritics(casefold_latin(normalize_whitespace(s))))


# ---------------------------------------------------------------------------
# Top-level key computation
# ---------------------------------------------------------------------------

# Registry of all key functions produced by norm_v1.
# Order matters for deterministic output.
KEY_FUNCTIONS = {
    "casefold": key_casefold,
    "diacritics_insensitive": key_diacritics_insensitive,
    "punct_stripped": key_punct_stripped,
    "nospace": key_nospace,
}


def compute_search_keys(forms: list[str]) -> dict[str, list[str]]:
    """
    Compute all search keys from a list of variant forms.

    For each key type, applies the key function to every form,
    deduplicates values (preserving first-seen order), and returns
    the result.

    Args:
        forms: list of variant forms (e.g., from variant_forms)

    Returns:
        dict mapping key name → deduplicated list of key values
    """
    result: dict[str, list[str]] = {}

    for key_name, key_fn in KEY_FUNCTIONS.items():
        seen: set[str] = set()
        values: list[str] = []
        for form in forms:
            val = key_fn(form)
            if val and val not in seen:
                seen.add(val)
                values.append(val)
        result[key_name] = values

    return result
