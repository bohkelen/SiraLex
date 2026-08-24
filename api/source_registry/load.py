"""Registry-driven source metadata for attribution and distribution compliance."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import yaml

SOURCE_MALIPENSE = "src_malipense"
SOURCE_OWNER = "src_siralex_lexical_review"
LICENSE_CC_BY_NC_SA = "CC BY-NC-SA 4.0"
LICENSE_PROJECT_INTERNAL = "project-internal-review"

_TEMPLATE_TOKEN = re.compile(r"\{([a-zA-Z_][a-zA-Z0-9_]*)\}")
UNRESOLVED_TEMPLATE_PATTERN = re.compile(r"\{[a-zA-Z_][a-zA-Z0-9_]*\}|\$\{[^}]+\}")


def find_unresolved_template_tokens(text: str) -> list[str]:
    if not text:
        return []
    return sorted(set(UNRESOLVED_TEMPLATE_PATTERN.findall(text)))


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


def resolve_source_entry(
    registry: dict[str, dict[str, Any]], source_id: str
) -> dict[str, Any] | None:
    entry = registry.get(source_id)
    if not entry:
        return None
    authors = entry.get("authors") or []
    author_names: list[str] = []
    if isinstance(authors, list):
        for author in authors:
            if isinstance(author, dict):
                name = author.get("name")
                if isinstance(name, str) and name.strip():
                    author_names.append(name.strip())
    return {
        "source_id": source_id,
        "source_title": str(entry.get("name") or ""),
        "source_url": str(entry.get("homepage_url") or entry.get("license_evidence_url") or ""),
        "claimed_license": str(entry.get("claimed_license") or ""),
        "license_url": str(entry.get("license_evidence_url") or ""),
        "license_inference_note": str(entry.get("license_inference_note") or ""),
        "redistribution_policy": str(entry.get("redistribution_policy") or ""),
        "attribution_template": str(entry.get("attribution_template") or ""),
        "authors": author_names,
        "attribution": build_attribution_text(entry),
    }


def _template_substitutions(entry: dict[str, Any]) -> dict[str, str]:
    retrieved = entry.get("license_verified_at") or entry.get("source_retrieval_recorded_at")
    return {
        "retrieved_at": str(retrieved).strip() if retrieved else "",
        "license_evidence_url": str(entry.get("license_evidence_url") or "").strip(),
        "homepage_url": str(entry.get("homepage_url") or "").strip(),
        "claimed_license": str(entry.get("claimed_license") or "").strip(),
        "name": str(entry.get("name") or "").strip(),
    }


def render_attribution_template(entry: dict[str, Any]) -> str:
    """
    Render attribution_template using durable registry fields only.

    Lines containing tokens with no durable value are omitted (not fabricated).
    """
    template = entry.get("attribution_template")
    if not isinstance(template, str) or not template.strip():
        return ""
    subs = _template_substitutions(entry)
    rendered_lines: list[str] = []
    for raw_line in template.strip().splitlines():
        line = raw_line.rstrip()
        tokens = _TEMPLATE_TOKEN.findall(line)
        if not tokens:
            rendered_lines.append(line)
            continue
        skip_line = False
        for token in tokens:
            value = subs.get(token, "")
            if not value:
                skip_line = True
                break
            line = line.replace("{" + token + "}", value)
        if skip_line:
            continue
        if find_unresolved_template_tokens(line):
            continue
        rendered_lines.append(line)
    return "\n".join(rendered_lines).strip()


def build_attribution_text(entry: dict[str, Any]) -> str:
    """Build attribution from durable registry fields only."""
    rendered = render_attribution_template(entry)
    if rendered:
        return rendered
    parts: list[str] = []
    name = entry.get("name")
    if isinstance(name, str) and name.strip():
        parts.append(name.strip())
    authors = entry.get("authors")
    if isinstance(authors, list):
        for author in authors:
            if isinstance(author, dict):
                an = author.get("name")
                role = author.get("role")
                if isinstance(an, str) and an.strip():
                    if isinstance(role, str) and role.strip():
                        parts.append(f"{an.strip()} ({role.strip()})")
                    else:
                        parts.append(an.strip())
    url = entry.get("homepage_url") or entry.get("license_evidence_url")
    if isinstance(url, str) and url.strip():
        parts.append(url.strip())
    license_text = entry.get("claimed_license")
    if isinstance(license_text, str) and license_text.strip():
        parts.append(f"License: {license_text.strip()}")
    if not parts:
        return ""
    return ". ".join(parts)


def source_distribution_posture(entry: dict[str, Any]) -> dict[str, Any]:
    """
    Derive noncommercial distribution posture from registry semantics.

    Fail closed: project-internal-review is NOT external distribution permission.
    """
    source_id = str(entry.get("source_id") or "")
    claimed = str(entry.get("claimed_license") or "")
    note = str(entry.get("license_inference_note") or "").lower()

    if source_id == SOURCE_MALIPENSE and LICENSE_CC_BY_NC_SA in claimed:
        return {
            "distribution_state": "NONCOMMERCIAL_DISTRIBUTION_ALLOWED_SHAREALIKE",
            "noncommercial_distribution": True,
            "sharealike_required": True,
            "attribution_required": True,
            "commercial_distribution": False,
            "requires_rights_review": True,
        }

    if claimed == LICENSE_PROJECT_INTERNAL or "internal review" in note:
        return {
            "distribution_state": "DISTRIBUTION_PERMISSION_NOT_RECORDED",
            "noncommercial_distribution": False,
            "sharealike_required": False,
            "attribution_required": True,
            "commercial_distribution": False,
            "requires_rights_review": True,
            "reason": "project-internal-review governs review state, not external distribution",
        }

    if claimed:
        return {
            "distribution_state": "REQUIRES_RIGHTS_REVIEW",
            "noncommercial_distribution": False,
            "sharealike_required": False,
            "attribution_required": True,
            "commercial_distribution": False,
            "requires_rights_review": True,
        }

    return {
        "distribution_state": "UNKNOWN",
        "noncommercial_distribution": False,
        "sharealike_required": False,
        "attribution_required": False,
        "commercial_distribution": False,
        "requires_rights_review": True,
    }


def manifest_source_entries(
    registry: dict[str, dict[str, Any]], source_ids: list[str]
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for source_id in sorted(source_ids):
        entry = registry.get(source_id)
        if not entry:
            rows.append(
                {
                    "source_id": source_id,
                    "distribution_state": "UNKNOWN",
                    "claimed_license": "",
                    "source_title": "",
                    "source_url": "",
                    "attribution": "",
                    "sharealike_required": False,
                    "noncommercial_distribution": False,
                }
            )
            continue
        resolved = resolve_source_entry(registry, source_id) or {}
        posture = source_distribution_posture(entry)
        rows.append(
            {
                "source_id": source_id,
                "source_title": resolved.get("source_title", ""),
                "source_url": resolved.get("source_url", ""),
                "claimed_license": resolved.get("claimed_license", ""),
                "license_url": resolved.get("license_url", ""),
                "attribution": resolved.get("attribution", ""),
                "authors": resolved.get("authors", []),
                "distribution_posture": posture["distribution_state"],
                "noncommercial_distribution": posture["noncommercial_distribution"],
                "sharealike_required": posture["sharealike_required"],
                "commercial_distribution": posture["commercial_distribution"],
            }
        )
    return rows
