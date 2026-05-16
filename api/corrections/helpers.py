"""Utility helpers for deterministic correction processing."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Any


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def sha256_hex_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_prefixed(value: Any) -> str:
    return f"sha256:{sha256_hex_bytes(canonical_json(value).encode('utf-8'))}"


def sha256_prefixed_text(text: str) -> str:
    return f"sha256:{sha256_hex_bytes(text.encode('utf-8'))}"


def sha256_prefixed_bytes(data: bytes) -> str:
    return f"sha256:{sha256_hex_bytes(data)}"


def parse_iso8601_utc(value: str) -> datetime:
    if not value.endswith("Z"):
        raise ValueError("timestamp must use UTC Z suffix")
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("timestamp must include timezone")
    return parsed.astimezone(timezone.utc)


def now_utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")

