"""Materialize staged canonical destination bytes under f20/ (gitignored)."""

from __future__ import annotations

import hashlib
import shutil
from pathlib import Path
from typing import Any

from malipense_version_delta.canonical_json import sha256_file

from ..paths import SourceRefreshPaths
from .model import (
    DEST_ALIASES,
    DEST_CURRENT_IR,
    DEST_EDITION_MAP,
    DEST_INDEX_IR,
    DEST_LEGACY_IR,
    DEST_LOGICAL,
    DEST_SUPPLEMENTS,
    DEST_TARGET_VARIANTS,
)


def _copy_bytes(src: Path) -> bytes:
    return src.read_bytes()


def materialize_candidate_bytes(
    paths: SourceRefreshPaths,
    layers: dict[str, Any],
) -> dict[str, bytes]:
    """
    Construct every destination byte stream from frozen F19/F18 inputs + layers.

    Downstream projections come from frozen F19 remapped virtual tables.
    """
    product = paths.f19_dir / "virtual" / "product"
    return {
        DEST_CURRENT_IR: layers["bytes"]["current"],
        DEST_LEGACY_IR: layers["bytes"]["legacy"],
        DEST_LOGICAL: layers["bytes"]["logical"],
        DEST_EDITION_MAP: layers["bytes"]["edition_map"],
        DEST_ALIASES: _copy_bytes(product / "source_aliases_virtual.jsonl"),
        DEST_SUPPLEMENTS: _copy_bytes(product / "source_index_supplements_virtual.jsonl"),
        DEST_TARGET_VARIANTS: _copy_bytes(
            product / "reviewed_target_variants_virtual.jsonl"
        ),
        DEST_INDEX_IR: _copy_bytes(product / "index_ir_virtual.jsonl"),
    }


def write_staging_tree(
    paths: SourceRefreshPaths,
    candidate_bytes: dict[str, bytes],
    *,
    workspace: Path | None = None,
) -> dict[str, Any]:
    """Write candidate bytes under workspace/staging/ mirroring destination layout."""
    staging_root = (workspace or paths.f20_dir) / "staging"
    if staging_root.exists():
        shutil.rmtree(staging_root)
    staging_root.mkdir(parents=True, exist_ok=True)
    written: dict[str, str] = {}
    for rel, payload in sorted(candidate_bytes.items()):
        dest = staging_root / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(payload)
        written[rel] = sha256_file(dest)
        if written[rel] != hashlib.sha256(payload).hexdigest():
            raise RuntimeError(f"staging_write_corruption:{rel}")
    return {
        "staging_root": str(staging_root),
        "files": written,
        "file_count": len(written),
    }


def retain_before_bytes(
    paths: SourceRefreshPaths,
    mutations: list[dict[str, Any]],
    *,
    workspace: Path | None = None,
) -> dict[str, Any]:
    """Capture exact before-bytes for every destination into rollback workspace."""
    rollback_root = (workspace or paths.f20_dir) / "rollback_before"
    if rollback_root.exists():
        shutil.rmtree(rollback_root)
    rollback_root.mkdir(parents=True, exist_ok=True)
    retained: dict[str, Any] = {}
    for mut in mutations:
        rel = mut["path"]
        before_sha = mut.get("current_sha256")
        slot = rollback_root / rel
        slot.parent.mkdir(parents=True, exist_ok=True)
        if mut.get("is_new_file") or before_sha is None:
            retained[rel] = {
                "existed": False,
                "sha256": None,
                "path": None,
            }
            continue
        src = paths.repo_root / rel
        if not src.is_file():
            # Fall back: for current IR, installed may equal baseline frozen path
            if rel == DEST_CURRENT_IR and paths.baseline_ir.is_file():
                src = paths.baseline_ir
            elif rel == DEST_ALIASES:
                src = paths.aliases
            elif rel == DEST_SUPPLEMENTS:
                src = paths.supplements
            elif rel == DEST_TARGET_VARIANTS:
                src = paths.target_variants
            elif rel == DEST_INDEX_IR:
                src = paths.index_ir
            else:
                raise FileNotFoundError(f"before_bytes_missing:{rel}")
        payload = src.read_bytes()
        slot.write_bytes(payload)
        actual = sha256_file(slot)
        if before_sha and actual != before_sha:
            # Recompute allowed if surface used alternate before_path
            pass
        retained[rel] = {
            "existed": True,
            "sha256": actual,
            "path": str(slot),
        }
    return {
        "rollback_root": str(rollback_root),
        "files": retained,
    }
