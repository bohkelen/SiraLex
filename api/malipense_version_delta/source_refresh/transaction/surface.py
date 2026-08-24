"""Discover the actual canonical mutation surface for Malidaba source refresh."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from malipense_version_delta.canonical_json import sha256_file
from malipense_version_delta.compare import load_jsonl_records

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
    KIND_DERIVED,
    KIND_GOVERNED,
    PUBLICATION_PREFIXES,
    ROLE_BUILD_DERIVED,
    ROLE_DOWNSTREAM,
    ROLE_EDITION_MAP,
    ROLE_LOGICAL,
    ROLE_PUBLICATION,
    ROLE_SOURCE_CURRENT,
    ROLE_SOURCE_LEGACY,
)


def _count_jsonl(path: Path) -> int | None:
    if not path.is_file():
        return None
    n = 0
    with path.open(encoding="utf-8") as handle:
        for line in handle:
            if line.strip():
                n += 1
    return n


def _sha_or_none(path: Path) -> str | None:
    return sha256_file(path) if path.is_file() else None


def publication_paths(paths: SourceRefreshPaths) -> list[str]:
    root = paths.repo_root
    found: list[str] = []
    public = root / "web" / "public"
    if public.is_dir():
        found.append("web/public/")
    envp = root / "web" / ".env.production"
    if envp.is_file():
        found.append("web/.env.production")
    catalog = public / "catalog.json"
    if catalog.is_file():
        found.append("web/public/catalog.json")
    return found


def discover_mutation_surface(
    paths: SourceRefreshPaths,
    *,
    candidate_bytes: dict[str, bytes],
) -> dict[str, Any]:
    """
    Build the mutation plan from repository reality + staged candidate bytes.

    candidate_bytes maps repo-relative destination path -> exact after bytes.
    """
    root = paths.repo_root
    specs: list[dict[str, Any]] = [
        {
            "path": DEST_CURRENT_IR,
            "artifact_role": ROLE_SOURCE_CURRENT,
            "kind": KIND_GOVERNED,
            "identity_layer": "edition_specific_ir_id + current-edition provenance",
            "why_change_is_required": (
                "Replace baseline-era Malidaba IR with frozen current-edition "
                "source assertions (corrected Malidaba capture)."
            ),
            "rollback_source": "transaction_local_before_bytes",
            "before_path": paths.baseline_ir,  # current installed lexicon equals baseline frozen
        },
        {
            "path": DEST_LEGACY_IR,
            "artifact_role": ROLE_SOURCE_LEGACY,
            "kind": KIND_GOVERNED,
            "identity_layer": "edition_specific_ir_id + baseline-edition provenance",
            "why_change_is_required": (
                "Persist 42 human retain_baseline_record assertions as a distinct "
                "legacy layer (must not flatten into current edition)."
            ),
            "rollback_source": "absent_before_create",
            "before_path": None,
        },
        {
            "path": DEST_LOGICAL,
            "artifact_role": ROLE_LOGICAL,
            "kind": KIND_GOVERNED,
            "identity_layer": "logical_lexical_id",
            "why_change_is_required": (
                "Install governed logical continuity objects (10+5+42) as the "
                "stable lexical identity layer."
            ),
            "rollback_source": "absent_before_create",
            "before_path": None,
        },
        {
            "path": DEST_EDITION_MAP,
            "artifact_role": ROLE_EDITION_MAP,
            "kind": KIND_GOVERNED,
            "identity_layer": "edition_ir_id → logical_lexical_id",
            "why_change_is_required": (
                "Single authority mapping from edition assertion ids to logical "
                "ids for deterministic downstream projection."
            ),
            "rollback_source": "absent_before_create",
            "before_path": None,
        },
        {
            "path": DEST_ALIASES,
            "artifact_role": ROLE_DOWNSTREAM,
            "kind": KIND_DERIVED,
            "identity_layer": "runtime current-edition ir_id (projection)",
            "why_change_is_required": (
                "Project alias resolved/evidence ids through logical continuity."
            ),
            "rollback_source": "transaction_local_before_bytes",
            "before_path": paths.aliases,
        },
        {
            "path": DEST_SUPPLEMENTS,
            "artifact_role": ROLE_DOWNSTREAM,
            "kind": KIND_DERIVED,
            "identity_layer": "runtime current-edition ir_id (projection)",
            "why_change_is_required": (
                "Project supplement target/evidence ids through logical continuity."
            ),
            "rollback_source": "transaction_local_before_bytes",
            "before_path": paths.supplements,
        },
        {
            "path": DEST_TARGET_VARIANTS,
            "artifact_role": ROLE_DOWNSTREAM,
            "kind": KIND_DERIVED,
            "identity_layer": "runtime current-edition ir_id (projection)",
            "why_change_is_required": (
                "Project reviewed target-variant canonical_ir_id through continuity."
            ),
            "rollback_source": "transaction_local_before_bytes",
            "before_path": paths.target_variants,
        },
        {
            "path": DEST_INDEX_IR,
            "artifact_role": ROLE_DOWNSTREAM,
            "kind": KIND_DERIVED,
            "identity_layer": "source locator (source_record_id), not lexical identity",
            "why_change_is_required": (
                "Rewrite index-mapping target anchors to current-edition locators "
                "for recycled source_record_id values."
            ),
            "rollback_source": "transaction_local_before_bytes",
            "before_path": paths.index_ir,
        },
    ]

    # Installed lexicon before = whatever is currently at DEST_CURRENT_IR if present,
    # else baseline frozen IR (source-refresh replaces the installed lexicon).
    installed = root / DEST_CURRENT_IR
    if installed.is_file():
        specs[0]["before_path"] = installed

    mutations: list[dict[str, Any]] = []
    for spec in specs:
        rel = spec["path"]
        after_bytes = candidate_bytes.get(rel)
        if after_bytes is None:
            raise ValueError(f"missing_candidate_bytes:{rel}")
        before_path: Path | None = spec.get("before_path")
        before_sha = _sha_or_none(before_path) if before_path else None
        after_sha = __import__("hashlib").sha256(after_bytes).hexdigest()
        before_count = _count_jsonl(before_path) if before_path else 0
        # Count after from bytes
        after_count = sum(1 for line in after_bytes.decode("utf-8").splitlines() if line.strip())
        mutations.append(
            {
                "path": rel,
                "artifact_role": spec["artifact_role"],
                "kind": spec["kind"],
                "identity_layer": spec["identity_layer"],
                "why_change_is_required": spec["why_change_is_required"],
                "rollback_source": spec["rollback_source"],
                "current_sha256": before_sha,
                "candidate_sha256": after_sha,
                "current_row_count": before_count,
                "candidate_row_count": after_count,
                "is_new_file": before_sha is None,
                "is_deletion": False,
            }
        )

    pubs = publication_paths(paths)
    publication_in_plan = [
        m["path"]
        for m in mutations
        if any(m["path"].startswith(prefix.rstrip("/")) or m["path"].startswith(prefix) for prefix in PUBLICATION_PREFIXES)
        or m["artifact_role"] == ROLE_PUBLICATION
    ]
    return {
        "mutations": mutations,
        "mutation_count": len(mutations),
        "publication_paths_discovered": pubs,
        "publication_paths_in_transaction": publication_in_plan,
        "build_derived_note": (
            f"{ROLE_BUILD_DERIVED}: normalized/enriched/search_index/bundles are "
            "rebuilt from governed+projected inputs and are not destination "
            "writes in this transaction."
        ),
    }
