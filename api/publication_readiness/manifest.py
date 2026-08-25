"""Publication-readiness manifest enrichment (bundle_manifest_v2 extension)."""

from __future__ import annotations

from typing import Any

from distribution_compliance.manifest import enrich_manifest_with_licenses
from source_registry.load import load_source_registry

from .model import (
    PRODUCT_PROFILE_NONCOMMERCIAL,
    STATE_NONCOMMERCIAL_COMPLIANT,
    STATE_PUBLICATION_CANDIDATE,
    STATE_PUBLICATION_READY,
)


def enrich_manifest_for_publication_readiness(
    manifest: dict[str, Any],
    *,
    repo_root,
    source_ids: list[str],
    publication_state: str,
    publication_authorized: bool = False,
    product1b_checks: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Extend bundle_manifest_v2 with explicit publication-readiness metadata.

    PRODUCT2 sets publication_state to PUBLICATION_READY or PUBLICATION_CANDIDATE
    and never sets publication_authorized=True.
    """
    registry = load_source_registry(repo_root)
    enriched = enrich_manifest_with_licenses(
        manifest,
        registry=registry,
        source_ids=source_ids,
        publication_authorized=publication_authorized,
    )
    build = enriched.get("build") or {}
    if not isinstance(build, dict):
        build = {}
    record_counts = build.get("record_counts") or {}
    enriched["publication"] = {
        "publication_state": publication_state,
        "publication_authorized": publication_authorized,
        "product_profile": PRODUCT_PROFILE_NONCOMMERCIAL,
        "prior_state": STATE_NONCOMMERCIAL_COMPLIANT,
        "record_counts": record_counts,
        "search_key_count": _search_key_count_from_build(build),
    }
    if product1b_checks:
        enriched["publication"]["product1b_checks"] = {
            k: v.get("status") if isinstance(v, dict) else v
            for k, v in product1b_checks.items()
            if str(k).startswith("C")
        }
    return enriched


def _search_key_count_from_build(build: dict[str, Any]) -> int | None:
    """Optional search key count when present in build metadata."""
    for key in ("search_keys", "search_key_count"):
        val = build.get(key)
        if isinstance(val, int):
            return val
    return None


def resolve_publication_state(*, all_gates_pass: bool, credits_implemented: bool) -> str:
    if all_gates_pass and credits_implemented:
        return STATE_PUBLICATION_READY
    return STATE_PUBLICATION_CANDIDATE
