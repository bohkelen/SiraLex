"""Deterministic annotation subject fingerprints for review worksheets."""

from __future__ import annotations

import hashlib
import json
from typing import Any


def canonical_annotation_json(row: dict[str, Any]) -> str:
    """Canonical UTF-8 JSON for an immutable annotation record."""
    return json.dumps(row, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def annotation_fingerprint_sha256(row: dict[str, Any]) -> str:
    """SHA-256 hex digest of the canonical annotation JSON."""
    payload = canonical_annotation_json(row).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()
