"""Load source-registry rights postures from committed YAML entries."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

from .model import (
    LICENSE_CC_BY_NC_SA,
    LICENSE_PROJECT_INTERNAL,
    SOURCE_MALIPENSE,
    SOURCE_OWNER,
)


def load_source_registry(repo_root: Path) -> dict[str, dict[str, Any]]:
    sources_dir = repo_root / "shared" / "sources"
    out: dict[str, dict[str, Any]] = {}
    for path in sorted(sources_dir.glob("*.yaml")):
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            continue
        source_id = data.get("source_id")
        if isinstance(source_id, str) and source_id.strip():
            out[source_id] = data
    return out


def commercial_compatible_license(claimed_license: str | None) -> bool:
    """
    Fail-closed: only explicitly commercial-compatible licenses pass.

    CC BY-NC-SA is never commercial-compatible.
    project-internal-review does not record commercial permission.
    """
    if not claimed_license:
        return False
    text = claimed_license.strip()
    if text == LICENSE_CC_BY_NC_SA:
        return False
    if "NC" in text.upper() and "CC BY" in text.upper():
        return False
    if text == LICENSE_PROJECT_INTERNAL:
        return False
    # No other commercial license is registered in the repository today.
    return False


def malidaba_rights_posture(registry: dict[str, dict[str, Any]]) -> dict[str, str]:
    entry = registry.get(SOURCE_MALIPENSE) or {}
    license_text = str(entry.get("claimed_license") or "")
    if LICENSE_CC_BY_NC_SA not in license_text:
        raise ValueError("malipense_registry_missing_cc_by_nc_sa")
    return {
        "claimed_license": LICENSE_CC_BY_NC_SA,
        "internal": "allowed",
        "noncommercial": "requires_rights_review",
        "commercial": "blocked",
    }


def owner_registry_entry(registry: dict[str, dict[str, Any]]) -> dict[str, Any]:
    entry = registry.get(SOURCE_OWNER)
    if not entry:
        raise ValueError("owner_registry_missing")
    return entry
