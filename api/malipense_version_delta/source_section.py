"""Deterministic Malidaba source-record classification from captured HTML PS metadata."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

import zstandard as zstd
from bs4 import BeautifulSoup

# Explicit Malidaba onomastic PS tokens observed in May 2026 captured HTML (lxP2 span.PS).
# Do NOT infer from headword shape or capitalization.
_N_PROP_ONOMASTIC_RE = re.compile(
    r"^n\.?\s*prop\s+(TOP|NOM\s+(CL|M|F))\b",
    re.IGNORECASE,
)
_N_PROP_NAMESPACE_RE = re.compile(r"^n\.?\s*prop\b", re.IGNORECASE)

# First-token POS/morphology labels observed in May 2026 lexicon crawl HTML.
# Positive evidence is required for BASE_LEXICAL; this is not a broad linguistic taxonomy.
_OBSERVED_ORDINARY_PS_TOKENS = frozenset(
    {
        "n",
        "v",
        "adj",
        "adv",
        "intj",
        "conj",
        "mrph",
        "pm",
        "pp",
        "ptcp",
        "vq",
        "prt",
        "num",
        "dtm",
        "ap",
        "onomat",
        "prn",
        "pers",
        "cop",
        "prep",
        "adj/ap",
        "pers/pm",
        "pers/cop",
    }
)

CLASS_BASE_LEXICAL = "BASE_LEXICAL"
CLASS_PERSON_NAME = "PERSON_NAME"
CLASS_SURNAME = "SURNAME"
CLASS_TOPONYM = "TOPONYM"
CLASS_OTHER_ADDON = "OTHER_ADDON"
CLASS_UNKNOWN = "UNKNOWN_SOURCE_SECTION"

CLASSIFICATION_RULE_ID = "malipense_source_section_ps_v2"


def _first_ps_token(normalized_ps: str) -> str:
    return normalized_ps.split()[0].lower().rstrip(".")


def classify_ps_text(ps_text: str | None) -> tuple[str, str | None]:
    """
    Classify one entry from source-visible PS text (first lxP2 span.PS).

    This is a **source-record classification** derived from PS metadata. It does
    not assert physical HTML section boundaries on Malidaba letter pages.

    Returns (source_section_class, ps_marker) where ps_marker is the matched
    onomastic token when applicable.

    Positive BASE_LEXICAL requires positive ordinary-POS evidence. Missing or
    empty PS is UNKNOWN, not base lexical.
    """
    if ps_text is None or not str(ps_text).strip():
        return CLASS_UNKNOWN, None

    normalized = " ".join(str(ps_text).split())

    match = _N_PROP_ONOMASTIC_RE.match(normalized)
    if match:
        token = match.group(1).upper().replace("  ", " ")
        if token == "TOP":
            return CLASS_TOPONYM, token
        if token in {"NOM M", "NOM F"}:
            return CLASS_PERSON_NAME, token
        if token == "NOM CL":
            return CLASS_OTHER_ADDON, token
        return CLASS_UNKNOWN, token

    if _N_PROP_NAMESPACE_RE.match(normalized):
        return CLASS_UNKNOWN, None

    if _first_ps_token(normalized) in _OBSERVED_ORDINARY_PS_TOKENS:
        return CLASS_BASE_LEXICAL, None

    return CLASS_UNKNOWN, None


def _entry_ps_from_header(header) -> str | None:
    """Read PS from nested or sibling lxP2 owned by one lxP header."""
    lxp2 = header.find("p", class_="lxP2")
    if lxp2 is None:
        sibling = header.find_next_sibling()
        while sibling is not None:
            if getattr(sibling, "name", None) == "p":
                classes = sibling.get("class") or []
                if "lxP" in classes and "lxP2" not in classes:
                    break
                if "lxP2" in classes:
                    lxp2 = sibling
                    break
            sibling = sibling.find_next_sibling()
    if lxp2 is None:
        return None
    ps = lxp2.find("span", class_="PS")
    if ps is None:
        return None
    text = ps.get_text(strip=True)
    return text if text else None


def build_entry_ps_index(crawl_dir: Path) -> dict[tuple[str, str], str]:
    """
    Build (url_canonical, source_record_id) -> first lxP2 PS text from crawl HTML.

    Deterministic; read-only over captured snapshots. Entries with missing or
    empty PS are omitted from the index (classifier treats them as unknown).
    """
    payloads_dir = crawl_dir / "payloads"
    snapshots_jsonl = crawl_dir / "snapshots.jsonl"
    if not payloads_dir.exists() or not snapshots_jsonl.exists():
        raise FileNotFoundError(f"Invalid crawl directory: {crawl_dir}")

    metadata: dict[str, dict[str, Any]] = {}
    with snapshots_jsonl.open("r", encoding="utf-8") as handle:
        for line in handle:
            record = json.loads(line)
            sid = record.get("snapshot_id")
            if sid:
                metadata[sid] = record

    dctx = zstd.ZstdDecompressor()
    index: dict[tuple[str, str], str] = {}

    for payload_path in sorted(payloads_dir.glob("*.html.zst")):
        snapshot_id = payload_path.name.replace(".html.zst", "")
        if snapshot_id not in metadata:
            continue
        url = metadata[snapshot_id].get("url_canonical", "")
        if "/emk/lexicon/" not in url:
            continue

        html = dctx.decompress(payload_path.read_bytes()).decode("utf-8", errors="replace")
        soup = BeautifulSoup(html, "html.parser")
        for header in soup.find_all("p", class_="lxP"):
            entry_span = header.find("span", class_="Lxe")
            if not entry_span or not entry_span.get("id"):
                continue
            entry_id = entry_span.get("id")
            ps_text = _entry_ps_from_header(header)
            if ps_text:
                index[(url, entry_id)] = ps_text

    return index


def classify_current_record(
    record: dict[str, Any],
    ps_index: dict[tuple[str, str], str],
) -> dict[str, Any]:
    """Attach source-record classification for one current IR record."""
    locator = record.get("record_locator") or {}
    url = str(locator.get("url_canonical") or "")
    sid = locator.get("source_record_id")
    ps_text = ps_index.get((url, sid)) if sid else None
    section_class, marker = classify_ps_text(ps_text)
    return {
        "source_section_class": section_class,
        "source_section_ps_marker": marker,
        "source_section_ps_text": ps_text,
        "classification_rule_id": CLASSIFICATION_RULE_ID,
    }
