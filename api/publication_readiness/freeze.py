"""Freeze release-candidate bundle bytes with full file hashes."""

from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Any

from bundle_builder.build_bundle import ArtifactDirectoryConflictError, build_bundle, verify_bundle
from malipense_version_delta.canonical_json import write_json
from source_registry.load import load_source_registry

from distribution_compliance.manifest import write_bundle_license_sidecars

from .identity import (
    RELEASE_DISTRIBUTED_FILES,
    collect_distributed_file_hashes,
    compute_release_artifact_fingerprint,
    deterministic_semantic_bundle_id,
    identity_from_frozen_bundle,
    list_present_distributed_files,
    release_artifact_dir_name,
)
from .manifest import enrich_manifest_for_publication_readiness


def _commit_release_artifact_directory(
    *,
    source_dir: Path,
    final_dir: Path,
    release_artifact_fingerprint: str,
    bundle_id: str,
    semantic_content_sha256: str,
) -> Path:
    """Move staged bundle into release-specific immutable directory."""
    if final_dir.exists():
        existing = identity_from_frozen_bundle(final_dir)
        if existing["release_artifact_fingerprint"] == release_artifact_fingerprint:
            shutil.rmtree(source_dir)
            return final_dir
        raise ArtifactDirectoryConflictError(
            "Refusing to overwrite existing immutable release artifact directory "
            f"{final_dir}: existing release_artifact_fingerprint="
            f"{existing['release_artifact_fingerprint']!r}, "
            f"new release_artifact_fingerprint={release_artifact_fingerprint!r}"
        )
    final_dir.parent.mkdir(parents=True, exist_ok=True)
    source_dir.rename(final_dir)
    return final_dir


def freeze_release_candidate(
    *,
    repo_root: Path,
    records_path: Path,
    search_index_path: Path,
    output_parent: Path,
    source_ids: list[str],
    publication_state: str,
    product1b_checks: dict[str, Any] | None = None,
    search_key_count: int | None = None,
) -> dict[str, Any]:
    """
    Materialize immutable release-candidate bundle directory.

    Uses semantic bundle_id from payload hash and release-specific physical
    directory from release_artifact_fingerprint.
    """
    if output_parent.exists():
        shutil.rmtree(output_parent)
    output_parent.mkdir(parents=True, exist_ok=True)

    staging = output_parent / "_staging_sidecars"
    staging.mkdir()
    sidecars = write_bundle_license_sidecars(
        staging,
        registry=load_source_registry(repo_root),
        source_ids=source_ids,
        data_licenses_doc=repo_root / "DATA_LICENSES.md",
    )

    build_parent = output_parent / "_build_staging"
    build_parent.mkdir()
    build_result = build_bundle(
        normalized_path=records_path,
        search_index_path=search_index_path,
        output_dir=build_parent,
        bundle_type="noncommercial",
        sources_included=source_ids,
        license_enrichment=True,
        repo_root=repo_root,
        publication_authorized=False,
        versioned_output=False,
        source_lang="fr",
        target_lang="mnk",
        source_label="French",
        target_label="Maninka",
        lexical_language="mnk",
        lookup_languages=["fr", "en", "mnk"],
    )
    bundle_dir = Path(build_result["bundle_dir"])

    for name in sidecars:
        src = staging / name
        if src.is_file():
            shutil.copy2(src, bundle_dir / name)

    manifest_path = bundle_dir / "bundle.manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if search_key_count is not None:
        build_meta = manifest.setdefault("build", {})
        if isinstance(build_meta, dict):
            build_meta["search_key_count"] = search_key_count
    enriched = enrich_manifest_for_publication_readiness(
        manifest,
        repo_root=repo_root,
        source_ids=source_ids,
        publication_state=publication_state,
        publication_authorized=False,
        product1b_checks=product1b_checks,
    )
    write_json(manifest_path, enriched)

    identity = identity_from_frozen_bundle(bundle_dir)
    final_dir = _commit_release_artifact_directory(
        source_dir=bundle_dir,
        final_dir=output_parent / identity["release_artifact_dir_name"],
        release_artifact_fingerprint=identity["release_artifact_fingerprint"],
        bundle_id=identity["semantic_bundle_id"],
        semantic_content_sha256=identity["semantic_content_sha256"],
    )

    verification = verify_bundle(final_dir)

    for leftover in ("_build_staging", "_staging_sidecars"):
        path = output_parent / leftover
        if path.exists():
            shutil.rmtree(path)

    return {
        "semantic_bundle_id": identity["semantic_bundle_id"],
        "semantic_content_sha256": identity["semantic_content_sha256"],
        "semantic_candidate_fingerprint": identity["semantic_candidate_fingerprint"],
        "release_artifact_fingerprint": identity["release_artifact_fingerprint"],
        "release_artifact_dir_name": identity["release_artifact_dir_name"],
        # Backward-compatible receipt fields
        "bundle_id": identity["semantic_bundle_id"],
        "content_sha256": identity["semantic_content_sha256"],
        "candidate_fingerprint": identity["semantic_candidate_fingerprint"],
        "artifact_dir_name": identity["release_artifact_dir_name"],
        "bundle_dir": str(final_dir),
        "file_hashes": identity["distributed_file_hashes"],
        "verification": verification,
        "manifest": enriched,
        "distributed_files": list_present_distributed_files(final_dir),
        "distributed_files_contract": list(RELEASE_DISTRIBUTED_FILES),
    }
