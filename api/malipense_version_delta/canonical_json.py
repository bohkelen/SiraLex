"""Deterministic JSON / JSONL serialization helpers."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any, Iterable


def canonical_dumps(obj: Any) -> str:
    """Serialize with sorted keys and stable separators (no trailing newline)."""
    return json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def write_jsonl(path: Path, rows: Iterable[dict[str, Any]]) -> str:
    """
    Write JSONL rows in given order; return SHA-256 of file bytes.

    Callers must supply rows already sorted for determinism.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    hasher = hashlib.sha256()
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        for row in rows:
            line = canonical_dumps(row) + "\n"
            handle.write(line)
            hasher.update(line.encode("utf-8"))
    return hasher.hexdigest()


def write_json(path: Path, obj: Any) -> str:
    """Write canonical JSON document with trailing newline; return SHA-256."""
    path.parent.mkdir(parents=True, exist_ok=True)
    text = canonical_dumps(obj) + "\n"
    path.write_text(text, encoding="utf-8")
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def sha256_file(path: Path) -> str:
    """SHA-256 of file bytes."""
    hasher = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            hasher.update(chunk)
    return hasher.hexdigest()
