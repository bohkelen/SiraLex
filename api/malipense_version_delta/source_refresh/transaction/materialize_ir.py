"""Deterministic materialization of gitignored Malidaba IR destinations.

Ignored under data/ir/* by repository policy. Reproducible from durable
authorities (hash-frozen artifacts + tracked continuity / F19 remapped index).
"""

from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Any

from malipense_version_delta.canonical_json import sha256_file
from malipense_version_delta.compare import load_jsonl_records
from malipense_version_delta.frozen_inputs import (
    FROZEN_APPLIED_CURRENT_LEXICON_SHA256,
    FROZEN_APPLIED_INDEX_IR_SHA256,
    FROZEN_APPLIED_LEGACY_RETAINED_SHA256,
    FROZEN_BASELINE_IR_SHA256,
    FROZEN_CURRENT_IR_SHA256,
)

from ..model import CONTINUITY_LEGACY_RETAINED
from ..paths import FROZEN_F19_VIRTUAL_INDEX_IR_SHA256, SourceRefreshPaths
from .layers import build_canonical_layers, load_type_b_retain_ids
from .model import (
    APPLIED_DESTINATION_SHA256,
    DEST_CURRENT_IR,
    DEST_INDEX_IR,
    DEST_LEGACY_IR,
)


def materialize_ignored_ir_candidates(
    paths: SourceRefreshPaths,
    *,
    logical_continuity_path: Path | None = None,
) -> dict[str, Any]:
    """
    Rebuild the three gitignored IR destinations without reading applied files.

    Authorities:
    - historical baseline IR (FROZEN_BASELINE_IR_SHA256)
    - current capture IR (FROZEN_CURRENT_IR_SHA256)
    - Type-B retain dispositions and/or tracked logical continuity LEGACY_RETAINED
    - F19 remapped index IR (FROZEN_F19_VIRTUAL_INDEX_IR_SHA256)
    """
    if sha256_file(paths.baseline_ir) != FROZEN_BASELINE_IR_SHA256:
        raise ValueError("historical_baseline_ir_hash_mismatch")
    if sha256_file(paths.current_ir) != FROZEN_CURRENT_IR_SHA256:
        raise ValueError("current_capture_ir_hash_mismatch")

    layers = build_canonical_layers(paths)

    # Cross-check legacy retain population against logical continuity when present.
    logical_path = logical_continuity_path or (
        paths.repo_root / "shared/malidaba/malidaba_logical_lexical_continuity_v1.jsonl"
    )
    if not logical_path.is_file():
        logical_path = paths.f19_dir / "virtual" / "logical_lexical_continuity.jsonl"
    if logical_path.is_file():
        logical_rows = load_jsonl_records(logical_path)
        from_logical = sorted(
            {
                str(ir)
                for obj in logical_rows
                if obj.get("continuity_status") == CONTINUITY_LEGACY_RETAINED
                for ir in (obj.get("baseline_ir_ids") or [])
            }
        )
        from_type_b = sorted(bid for bid, _ in load_type_b_retain_ids(paths))
        if from_logical != from_type_b:
            raise ValueError(
                f"legacy_retain_authority_mismatch:logical={len(from_logical)}"
                f":type_b={len(from_type_b)}"
            )

    index_src = paths.f19_dir / "virtual" / "product" / "index_ir_virtual.jsonl"
    if not index_src.is_file():
        raise FileNotFoundError(f"missing_frozen_index_authority:{index_src}")
    index_bytes = index_src.read_bytes()
    if sha256_file(index_src) != FROZEN_F19_VIRTUAL_INDEX_IR_SHA256:
        raise ValueError("frozen_index_authority_hash_mismatch")

    candidates = {
        DEST_CURRENT_IR: layers["bytes"]["current"],
        DEST_LEGACY_IR: layers["bytes"]["legacy"],
        DEST_INDEX_IR: index_bytes,
    }
    hashes = {
        rel: hashlib.sha256(payload).hexdigest() for rel, payload in candidates.items()
    }
    expected = {
        DEST_CURRENT_IR: FROZEN_APPLIED_CURRENT_LEXICON_SHA256,
        DEST_LEGACY_IR: FROZEN_APPLIED_LEGACY_RETAINED_SHA256,
        DEST_INDEX_IR: FROZEN_APPLIED_INDEX_IR_SHA256,
    }
    matches = {rel: hashes[rel] == expected[rel] for rel in expected}
    return {
        "candidates": candidates,
        "hashes": hashes,
        "expected": expected,
        "matches": matches,
        "all_match": all(matches.values()),
        "authorities": {
            "historical_baseline_ir": str(paths.baseline_ir),
            "current_capture_ir": str(paths.current_ir),
            "logical_continuity": str(logical_path),
            "type_b_registry": str(
                paths.f18_dir / "malidaba_missing_disposition_reviews_v1.jsonl"
            ),
            "f19_index_virtual": str(index_src),
        },
        "applied_destination_sha256": {
            k: APPLIED_DESTINATION_SHA256[k]
            for k in (DEST_CURRENT_IR, DEST_LEGACY_IR, DEST_INDEX_IR)
        },
    }
