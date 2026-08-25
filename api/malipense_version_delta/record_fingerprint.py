"""Deterministic current-record fingerprint for review stale protection."""

from __future__ import annotations

import hashlib
from typing import Any

from .canonical_json import canonical_dumps
from .semantic import semantic_projection


def current_record_fingerprint_sha256(record: dict[str, Any]) -> str:
    """
    Canonical fingerprint for one current Malidaba source record.

    Covers review-relevant identity + lexical projection fields only.
    """
    locator = record.get("record_locator") or {}
    fields = record.get("fields_raw") or {}
    payload = {
        "ir_id": record.get("ir_id"),
        "source_id": record.get("source_id"),
        "url_canonical": locator.get("url_canonical"),
        "source_record_id": locator.get("source_record_id"),
        "headword_latin": fields.get("headword_latin"),
        "semantic_projection": semantic_projection(record),
    }
    text = canonical_dumps(payload)
    return hashlib.sha256(text.encode("utf-8")).hexdigest()
