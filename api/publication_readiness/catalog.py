"""Catalog boundary, simulation, and rollback semantics (local/gitignored only)."""

from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Any

from bundle_builder.build_bundle import sha256_file, verify_bundle

from .model import GATE_BLOCK, GATE_PASS


def load_catalog(catalog_path: Path) -> dict[str, Any]:
    return json.loads(catalog_path.read_text(encoding="utf-8"))


def validate_catalog_schema(catalog: dict[str, Any]) -> dict[str, Any]:
    errors: list[str] = []
    if catalog.get("catalog_schema_version") != "bundle_catalog_v1":
        errors.append("catalog_schema_version must be bundle_catalog_v1")
    bundles = catalog.get("bundles")
    if not isinstance(bundles, list):
        errors.append("bundles must be an array")
    else:
        for i, entry in enumerate(bundles):
            if not isinstance(entry, dict):
                errors.append(f"bundles[{i}] must be object")
                continue
            for field in ("bundle_id", "name", "size_bytes", "url_base", "content_sha256"):
                if field not in entry:
                    errors.append(f"bundles[{i}] missing {field}")
    status = GATE_PASS if not errors else GATE_BLOCK
    return {"status": status, "errors": errors, "bundle_count": len(bundles or [])}


def compute_bundle_size_bytes(bundle_dir: Path) -> int:
    total = 0
    for path in bundle_dir.rglob("*"):
        if path.is_file():
            total += path.stat().st_size
    return total


def build_proposed_catalog_entry(
    *,
    bundle_id: str,
    content_sha256: str,
    release_artifact_dir_name: str,
    release_artifact_fingerprint: str,
    bundle_dir: Path,
    version_label: str = "noncommercial-publication-candidate-product2",
) -> dict[str, Any]:
    """
    Proposed catalog entry with backward-compatible bundle_catalog_v1 fields.

    content_sha256 remains semantic (payload). url_base points at the immutable
    release-specific directory so distinct release bytes never alias.
    """
    return {
        "bundle_id": bundle_id,
        "name": "French ↔ Maninka (noncommercial)",
        "version": version_label,
        "size_bytes": compute_bundle_size_bytes(bundle_dir),
        "url_base": f"./{release_artifact_dir_name}/",
        "content_sha256": content_sha256,
        "release_artifact_fingerprint": release_artifact_fingerprint,
        "release_artifact_dir_name": release_artifact_dir_name,
        "languages": {"source_lang": "fr", "target_lang": "mnk"},
        "language_labels": {"source": "French", "target": "Maninka"},
    }


def simulate_catalog_addition(
    *,
    source_catalog_path: Path,
    web_public_dir: Path,
    simulation_dir: Path,
    candidate_bundle_dir: Path,
    proposed_entry: dict[str, Any],
    active_bundle_id: str | None = None,
) -> dict[str, Any]:
    """
    Local catalog mirror: copy current catalog + bundles, add immutable candidate.

    Does not mutate web/public.
    """
    errors: list[str] = []
    if simulation_dir.exists():
        shutil.rmtree(simulation_dir)
    simulation_dir.mkdir(parents=True)

    # Copy existing published bundle directories referenced by catalog.
    catalog = load_catalog(source_catalog_path)
    shutil.copy2(source_catalog_path, simulation_dir / "catalog.json")

    for entry in catalog.get("bundles") or []:
        if not isinstance(entry, dict):
            continue
        url_base = str(entry.get("url_base") or "").strip()
        if url_base.startswith("./"):
            rel = url_base[2:].rstrip("/")
            src = web_public_dir / rel
            if src.is_dir():
                shutil.copytree(src, simulation_dir / rel, dirs_exist_ok=True)
            else:
                errors.append(f"published bundle dir missing: {rel}")

    artifact_name = proposed_entry["url_base"].strip("./").rstrip("/")
    dest = simulation_dir / artifact_name
    shutil.copytree(candidate_bundle_dir, dest)

    release_dir = proposed_entry.get("release_artifact_dir_name")
    release_specific_path = release_dir == artifact_name if release_dir else True
    if not release_specific_path:
        errors.append(
            f"catalog url_base {artifact_name!r} != release_artifact_dir_name {release_dir!r}"
        )

    sim_catalog_path = simulation_dir / "catalog.json"
    sim_catalog = load_catalog(sim_catalog_path)
    bundles = list(sim_catalog.get("bundles") or [])
    bundles.append(proposed_entry)
    sim_catalog["bundles"] = sorted(bundles, key=lambda b: (b.get("name", ""), b.get("bundle_id", "")))
    sim_catalog_path.write_text(json.dumps(sim_catalog, indent=2) + "\n", encoding="utf-8")

    # Validate addressability
    old_addressable = True
    new_addressable = (dest / "bundle.manifest.json").is_file()
    for entry in catalog.get("bundles") or []:
        url_base = str(entry.get("url_base") or "")
        if url_base.startswith("./"):
            rel = url_base[2:].rstrip("/")
            if not (simulation_dir / rel / "bundle.manifest.json").is_file():
                old_addressable = False
                errors.append(f"old bundle not addressable: {rel}")

    verification = verify_bundle(dest)
    if not verification.get("valid"):
        errors.extend(verification.get("errors") or ["candidate verification failed"])

    resolved_active = active_bundle_id or proposed_entry["bundle_id"]
    active_found = any(
        b.get("bundle_id") == resolved_active for b in sim_catalog.get("bundles") or []
    )
    if not active_found:
        errors.append(f"active bundle_id not in catalog: {resolved_active}")

    status = GATE_PASS if errors == [] and old_addressable and new_addressable else GATE_BLOCK
    return {
        "status": status,
        "errors": errors,
        "simulation_dir": str(simulation_dir),
        "old_bundle_addressable": old_addressable,
        "new_candidate_addressable": new_addressable,
        "release_specific_path_resolved": release_specific_path,
        "active_bundle_id": resolved_active,
        "catalog_bundle_count": len(sim_catalog.get("bundles") or []),
    }


def design_rollback_semantics(
    *,
    current_published_bundle_id: str,
    candidate_bundle_id: str,
) -> dict[str, Any]:
    """
    Rollback = restore catalog active/recommended pointer to previous immutable bundle.

    Does not delete historical bundle bytes.
    """
    return {
        "rollback_target_bundle_id": current_published_bundle_id,
        "candidate_bundle_id": candidate_bundle_id,
        "semantics": "catalog_pointer_restore",
        "deletes_historical_bytes": False,
        "rewrites_previous_bundle": False,
    }


def design_publication_transaction() -> dict[str, Any]:
    """Guarded publication transaction design — not executed in PRODUCT2."""
    return {
        "status": "READY",
        "steps": [
            "freeze_candidate",
            "verify_semantic_content_sha256",
            "verify_release_artifact_fingerprint",
            "verify_authorized_distributed_file_hashes",
            "verify_destination_absent_or_byte_identical_release_path",
            "copy_immutable_release_artifact",
            "validate_copied_release_fingerprint",
            "update_catalog_atomically",
            "validate_catalog_runtime",
            "rollback_catalog_pointer_on_failure",
        ],
        "requires_release_artifact_fingerprint_match": True,
        "requires_distributed_file_hash_match": True,
        "overwrite_differing_bytes_at_existing_id": False,
        "overwrite_differing_bytes_at_existing_path": False,
    }
