"""Freeze PRODUCT1A input artifact hashes (deterministic inventory)."""

from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Any

from malipense_version_delta.canonical_json import write_json

from .paths import Product1APaths


def _sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def freeze_product_inputs(paths: Product1APaths) -> dict[str, Any]:
    required = [
        ("malipense_source_registry", paths.malipense_yaml),
        ("owner_source_registry", paths.owner_yaml),
        ("current_malidaba_ir", paths.current_ir),
        ("legacy_malidaba_ir", paths.legacy_ir),
        ("malipense_index_ir", paths.index_ir),
        ("owner_lexical_ir", paths.owner_ir),
        ("logical_continuity", paths.logical_continuity),
        ("edition_to_logical_mapping", paths.edition_map),
        ("source_aliases", paths.aliases),
        ("source_index_supplements", paths.supplements),
        ("reviewed_target_variants", paths.target_variants),
    ]
    inputs: list[dict[str, Any]] = []
    hashes: dict[str, str] = {}
    missing: list[str] = []
    for role, path in required:
        if not path.is_file():
            missing.append(f"{role}:{path}")
            continue
        digest = _sha256_file(path)
        hashes[role] = digest
        inputs.append(
            {
                "role": role,
                "path": str(path.relative_to(paths.repo_root)),
                "sha256": digest,
                "bytes": path.stat().st_size,
            }
        )
    if missing:
        raise FileNotFoundError("product1a_frozen_inputs_missing:" + ",".join(missing))

    # Optional build-derived surfaces for metrics (not required to exist).
    optional_roles = []
    for role, path in optional_roles:
        if path.is_file():
            digest = _sha256_file(path)
            hashes[role] = digest
            inputs.append(
                {
                    "role": role,
                    "path": str(path.relative_to(paths.repo_root)),
                    "sha256": digest,
                    "bytes": path.stat().st_size,
                    "optional": True,
                }
            )

    payload = {
        "schema_version": "product1a_frozen_inputs_v1",
        "input_count": len(inputs),
        "inputs": inputs,
        "hashes": hashes,
    }
    paths.workspace.mkdir(parents=True, exist_ok=True)
    write_json(paths.freeze_path, payload)
    return payload
