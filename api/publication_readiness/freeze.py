"""Freeze release-candidate bundle bytes with full file hashes."""

from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Any

from bundle_builder.build_bundle import build_bundle, sha256_file, verify_bundle
from malipense_version_delta.canonical_json import write_json
from source_registry.load import load_source_registry

from distribution_compliance.manifest import write_bundle_license_sidecars

from .identity import (
    deterministic_release_bundle_id,
    identity_from_manifest_files,
    release_candidate_storage_dir,
)
from .manifest import enrich_manifest_for_publication_readiness


DISTRIBUTED_FILES = (
    "records.jsonl",
    "search_index.jsonl",
    "bundle.manifest.json",
    "checksums.sha256",
    "ATTRIBUTION.txt",
    "DATA_LICENSES.md",
)


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

    Uses content-addressed bundle_id and versioned artifact directory naming.
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

    # First build to obtain content hash and deterministic bundle_id.
    preliminary = build_bundle(
        normalized_path=records_path,
        search_index_path=search_index_path,
        output_dir=output_parent / "_preliminary",
        bundle_type="noncommercial",
        sources_included=source_ids,
        license_enrichment=False,
        versioned_output=False,
    )
    content_sha256 = preliminary["content_sha256"]
    bundle_id = deterministic_release_bundle_id(content_sha256)
    artifact_dir = release_candidate_storage_dir(bundle_id, content_sha256)

    build_result = build_bundle(
        normalized_path=records_path,
        search_index_path=search_index_path,
        output_dir=output_parent,
        bundle_type="noncommercial",
        sources_included=source_ids,
        bundle_id=bundle_id,
        license_enrichment=True,
        repo_root=repo_root,
        publication_authorized=False,
        versioned_output=True,
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

    file_hashes = collect_distributed_file_hashes(bundle_dir)
    identity = identity_from_manifest_files(manifest.get("files") or [])
    verification = verify_bundle(bundle_dir)

    return {
        "bundle_id": bundle_id,
        "artifact_dir_name": artifact_dir,
        "bundle_dir": str(bundle_dir),
        "content_sha256": build_result["content_sha256"],
        "candidate_fingerprint": identity["candidate_fingerprint"],
        "file_hashes": file_hashes,
        "verification": verification,
        "manifest": enriched,
        "distributed_files": list_present_distributed_files(bundle_dir),
    }


def list_present_distributed_files(bundle_dir: Path) -> list[str]:
    return [name for name in DISTRIBUTED_FILES if (bundle_dir / name).is_file()]


def collect_distributed_file_hashes(bundle_dir: Path) -> dict[str, str]:
    hashes: dict[str, str] = {}
    for name in sorted(list_present_distributed_files(bundle_dir)):
        hashes[name] = sha256_file(bundle_dir / name)
    return hashes
