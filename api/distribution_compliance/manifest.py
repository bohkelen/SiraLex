"""License-aware bundle manifest enrichment."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from source_registry.load import (
    SOURCE_MALIPENSE,
    manifest_source_entries,
    resolve_source_entry,
)

from .model import (
    SOFTWARE_LICENSE,
    ArtifactRightsClass,
    DATA_LICENSE_POLICY,
)


def artifact_rights_classification(
    *,
    source_ids: list[str],
    has_malidaba_data: bool,
) -> dict[str, ArtifactRightsClass]:
    classes: dict[str, ArtifactRightsClass] = {
        "bundle.manifest.json": "COLLECTION_METADATA",
        "checksums.sha256": "COLLECTION_METADATA",
        "DATA_LICENSES.md": "COLLECTION_METADATA",
        "ATTRIBUTION.txt": "COLLECTION_METADATA",
    }
    if has_malidaba_data and SOURCE_MALIPENSE in source_ids:
        classes["records.jsonl"] = "MALIDABA_ADAPTED_DATA"
        classes["search_index.jsonl"] = "MALIDABA_ADAPTED_DATA"
    elif len(source_ids) > 1:
        classes["records.jsonl"] = "MIXED_DATA_COLLECTION"
        classes["search_index.jsonl"] = "MIXED_DATA_COLLECTION"
    else:
        classes["records.jsonl"] = "OTHER_SOURCE_DATA"
        classes["search_index.jsonl"] = "OTHER_SOURCE_DATA"
    return classes


def build_attribution_bundle_text(
    registry: dict[str, dict[str, Any]], source_ids: list[str]
) -> str:
    lines: list[str] = [
        "SiraLex bundle source attribution",
        "==================================",
        "",
    ]
    for source_id in sorted(source_ids):
        resolved = resolve_source_entry(registry, source_id)
        if not resolved:
            lines.append(f"Source: {source_id}")
            lines.append("Attribution: UNKNOWN")
            lines.append("")
            continue
        lines.append(f"Source ID: {source_id}")
        if resolved.get("source_title"):
            lines.append(f"Title: {resolved['source_title']}")
        if resolved.get("source_url"):
            lines.append(f"URL: {resolved['source_url']}")
        if resolved.get("claimed_license"):
            lines.append(f"License: {resolved['claimed_license']}")
        if resolved.get("license_url"):
            lines.append(f"License evidence: {resolved['license_url']}")
        if resolved.get("attribution"):
            lines.append("")
            lines.append(resolved["attribution"])
        lines.append("")
    lines.append(
        "Software in this repository is dual-licensed under MIT OR Apache-2.0. "
        "Lexical/data content retains source-specific licensing as declared above."
    )
    return "\n".join(lines).rstrip() + "\n"


def enrich_manifest_with_licenses(
    manifest: dict[str, Any],
    *,
    registry: dict[str, dict[str, Any]],
    source_ids: list[str],
    publication_authorized: bool = False,
) -> dict[str, Any]:
    enriched = dict(manifest)
    included_entries = manifest_source_entries(registry, source_ids)
    excluded_ids = [
        sid
        for sid, entry in registry.items()
        if sid not in source_ids
    ]
    excluded_entries = manifest_source_entries(registry, excluded_ids)

    has_malidaba = SOURCE_MALIPENSE in source_ids
    enriched["manifest_schema_version"] = "bundle_manifest_v2"
    enriched["software_license"] = {
        "spdx_expression": SOFTWARE_LICENSE,
        "applies_to": "application_software",
    }
    enriched["data_license_policy"] = DATA_LICENSE_POLICY
    enriched["distribution"] = {
        "noncommercial_distribution": True,
        "publication_authorized": publication_authorized,
        "project_posture": "noncommercial_language_infrastructure",
    }
    enriched["sources"] = {
        "included": included_entries,
        "excluded": excluded_entries,
    }
    enriched["artifact_rights_classification"] = artifact_rights_classification(
        source_ids=source_ids,
        has_malidaba_data=has_malidaba,
    )
    if has_malidaba:
        enriched["sharealike_notice"] = {
            "applies_to_artifact_classes": ["MALIDABA_ADAPTED_DATA"],
            "license": "CC BY-NC-SA 4.0",
            "source_id": SOURCE_MALIPENSE,
            "notice": (
                "Adapted Mali-pense / Malidaba lexical data in this bundle is "
                "distributed under CC BY-NC-SA 4.0. Derivative adaptations of "
                "that lexical content must preserve ShareAlike obligations."
            ),
        }
    return enriched


def write_bundle_license_sidecars(
    bundle_dir: Path,
    *,
    registry: dict[str, dict[str, Any]],
    source_ids: list[str],
    data_licenses_doc: Path,
) -> list[str]:
    written: list[str] = []
    attribution_path = bundle_dir / "ATTRIBUTION.txt"
    attribution_path.write_text(
        build_attribution_bundle_text(registry, source_ids),
        encoding="utf-8",
    )
    written.append("ATTRIBUTION.txt")

    if data_licenses_doc.is_file():
        target = bundle_dir / "DATA_LICENSES.md"
        target.write_text(data_licenses_doc.read_text(encoding="utf-8"), encoding="utf-8")
        written.append("DATA_LICENSES.md")
    return written
