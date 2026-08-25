"""C1–C8 noncommercial distribution compliance checks."""

from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Any

from source_registry.load import (
    LICENSE_CC_BY_NC_SA,
    SOURCE_MALIPENSE,
    find_unresolved_template_tokens,
    load_source_registry,
    manifest_source_entries,
    resolve_source_entry,
)

from .model import CHECK_BLOCK, CHECK_PASS, SOFTWARE_LICENSE
from .template_validation import scan_compliance_metadata_texts


def _result(check_id: str, status: str, *, detail: str = "", **extra: Any) -> dict[str, Any]:
    row = {"check_id": check_id, "status": status, "detail": detail}
    row.update(extra)
    return row


def _collect_compliance_metadata_texts(
    *,
    repo_root: Path,
    bundle_dir: Path,
) -> dict[str, str]:
    texts: dict[str, str] = {}
    attribution = bundle_dir / "ATTRIBUTION.txt"
    if attribution.is_file():
        texts["ATTRIBUTION.txt"] = attribution.read_text(encoding="utf-8")
    data_licenses = bundle_dir / "DATA_LICENSES.md"
    if data_licenses.is_file():
        texts["DATA_LICENSES.md"] = data_licenses.read_text(encoding="utf-8")
    manifest_path = bundle_dir / "bundle.manifest.json"
    if manifest_path.is_file():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        for entry in (manifest.get("sources") or {}).get("included") or []:
            if isinstance(entry, dict):
                sid = str(entry.get("source_id") or "unknown")
                texts[f"manifest.sources.{sid}.attribution"] = str(entry.get("attribution") or "")
        notice = manifest.get("sharealike_notice") or {}
        if isinstance(notice, dict):
            texts["manifest.sharealike_notice.notice"] = str(notice.get("notice") or "")
    return texts


def check_c1_attribution(
    *,
    repo_root: Path,
    bundle_dir: Path,
    source_ids: list[str],
) -> dict[str, Any]:
    registry = load_source_registry(repo_root)
    readme = repo_root / "README.md"
    readme_ok = readme.is_file() and "source-specific" in readme.read_text(encoding="utf-8").lower()

    bundle_attribution = bundle_dir / "ATTRIBUTION.txt"
    bundle_ok = bundle_attribution.is_file() and bundle_attribution.stat().st_size > 0

    registry_driven = True
    missing: list[str] = []
    for source_id in source_ids:
        resolved = resolve_source_entry(registry, source_id)
        if not resolved or not resolved.get("attribution"):
            registry_driven = False
            missing.append(source_id)

    manifest_path = bundle_dir / "bundle.manifest.json"
    manifest_ok = False
    if manifest_path.is_file():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        included = (manifest.get("sources") or {}).get("included") or []
        manifest_ok = bool(included) and all(
            isinstance(entry, dict) and entry.get("attribution") for entry in included
        )

    template_scan = scan_compliance_metadata_texts(
        _collect_compliance_metadata_texts(repo_root=repo_root, bundle_dir=bundle_dir)
    )
    placeholders_ok = template_scan["status"] == "PASS"

    status = CHECK_PASS if (
        bundle_ok and registry_driven and manifest_ok and placeholders_ok
    ) else CHECK_BLOCK
    return _result(
        "C1",
        status,
        detail="user-facing README reference + portable bundle attribution + registry-driven manifest",
        readme_reference_ok=readme_ok,
        bundle_attribution_ok=bundle_ok,
        manifest_attribution_ok=manifest_ok,
        registry_driven=registry_driven,
        missing_attribution_sources=missing,
        unresolved_template_tokens=template_scan.get("findings", []),
        unresolved_placeholder_count=template_scan.get("unresolved_placeholder_count", 0),
    )


def check_c2_code_data_separation(*, repo_root: Path, bundle_dir: Path) -> dict[str, Any]:
    readme = repo_root / "README.md"
    data_doc = repo_root / "DATA_LICENSES.md"
    readme_text = readme.read_text(encoding="utf-8") if readme.is_file() else ""
    doc_ok = data_doc.is_file()
    readme_ok = (
        "MIT" in readme_text
        and "Apache" in readme_text
        and ("source-specific" in readme_text.lower() or "DATA_LICENSES" in readme_text)
    )

    manifest_ok = False
    manifest_path = bundle_dir / "bundle.manifest.json"
    if manifest_path.is_file():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        manifest_ok = (
            manifest.get("software_license", {}).get("spdx_expression") == SOFTWARE_LICENSE
            and manifest.get("data_license_policy") == "source_specific"
        )

    status = CHECK_PASS if (readme_ok and doc_ok and manifest_ok) else CHECK_BLOCK
    return _result(
        "C2",
        status,
        readme_ok=readme_ok,
        data_licenses_doc_ok=doc_ok,
        manifest_separation_ok=manifest_ok,
    )


def check_c3_per_source_license(
    *, repo_root: Path, bundle_dir: Path
) -> dict[str, Any]:
    registry = load_source_registry(repo_root)
    manifest = json.loads((bundle_dir / "bundle.manifest.json").read_text(encoding="utf-8"))
    included = (manifest.get("sources") or {}).get("included") or []
    mal_entry = next(
        (e for e in included if isinstance(e, dict) and e.get("source_id") == SOURCE_MALIPENSE),
        None,
    )
    expected = resolve_source_entry(registry, SOURCE_MALIPENSE) or {}
    fields_ok = bool(
        mal_entry
        and mal_entry.get("claimed_license") == LICENSE_CC_BY_NC_SA
        and mal_entry.get("source_url")
        and mal_entry.get("attribution")
        and mal_entry.get("distribution_posture")
    )
    status = CHECK_PASS if fields_ok else CHECK_BLOCK
    return _result(
        "C3",
        status,
        malidaba_manifest_entry=mal_entry,
        expected_license=expected.get("claimed_license"),
    )


def check_c4_sharealike(*, bundle_dir: Path) -> dict[str, Any]:
    manifest = json.loads((bundle_dir / "bundle.manifest.json").read_text(encoding="utf-8"))
    notice = manifest.get("sharealike_notice") or {}
    classes = manifest.get("artifact_rights_classification") or {}
    malidaba_payload = classes.get("records.jsonl") == "MALIDABA_ADAPTED_DATA"
    notice_ok = notice.get("license") == LICENSE_CC_BY_NC_SA and malidaba_payload
    status = CHECK_PASS if notice_ok else CHECK_BLOCK
    return _result("C4", status, sharealike_notice=notice, artifact_classes=classes)


def check_c5_provenance(*, provenance_scan: dict[str, Any], derived_scan: dict[str, Any]) -> dict[str, Any]:
    missing = provenance_scan.get("records_missing_source_provenance", 0)
    unresolvable = provenance_scan.get("unresolvable_source_ids") or []
    derived_blocked = derived_scan.get("derived_lexical_artifacts_with_unknown_substantive_provenance", 0)
    ok = missing == 0 and not unresolvable and derived_blocked == 0
    status = CHECK_PASS if ok else CHECK_BLOCK
    return _result(
        "C5",
        status,
        records_missing_provenance=missing,
        unresolvable_source_ids=unresolvable,
        derived_blocked=derived_blocked,
    )


def check_c6_registry_manifest_consistency(
    *, repo_root: Path, bundle_dir: Path, source_ids: list[str]
) -> dict[str, Any]:
    registry = load_source_registry(repo_root)
    expected = {e["source_id"]: e for e in manifest_source_entries(registry, source_ids)}
    manifest = json.loads((bundle_dir / "bundle.manifest.json").read_text(encoding="utf-8"))
    included = (manifest.get("sources") or {}).get("included") or []
    mismatches: list[dict[str, str]] = []
    for entry in included:
        if not isinstance(entry, dict):
            continue
        sid = str(entry.get("source_id") or "")
        exp = expected.get(sid)
        if not exp:
            mismatches.append({"source_id": sid, "issue": "unexpected_source"})
            continue
        for field in ("claimed_license", "source_url"):
            if str(entry.get(field) or "") != str(exp.get(field) or ""):
                mismatches.append(
                    {"source_id": sid, "field": field, "manifest": entry.get(field), "registry": exp.get(field)}
                )
    status = CHECK_PASS if not mismatches else CHECK_BLOCK
    return _result("C6", status, mismatches=mismatches)


def check_c7_noncommercial_posture(*, repo_root: Path, bundle_dir: Path) -> dict[str, Any]:
    readme = (repo_root / "README.md").read_text(encoding="utf-8")
    manifest = json.loads((bundle_dir / "bundle.manifest.json").read_text(encoding="utf-8"))
    readme_ok = "non-commercial" in readme.lower() or "noncommercial" in readme.lower()
    dist = manifest.get("distribution") or {}
    nc_visible = dist.get("noncommercial_distribution") is True
    mal_not_commercial = True
    for entry in (manifest.get("sources") or {}).get("included") or []:
        if isinstance(entry, dict) and entry.get("source_id") == SOURCE_MALIPENSE:
            if entry.get("commercial_distribution") is True:
                mal_not_commercial = False
    status = CHECK_PASS if (readme_ok and nc_visible and mal_not_commercial) else CHECK_BLOCK
    return _result(
        "C7",
        status,
        readme_noncommercial_ok=readme_ok,
        manifest_nc_visible=nc_visible,
        malidaba_not_commercially_licensed=mal_not_commercial,
    )


def check_c8_owner_separation(*, owner_audit: dict[str, Any], candidate_receipt: dict[str, Any]) -> dict[str, Any]:
    permission = owner_audit.get("noncommercial_distribution_permission_recorded")
    excluded = owner_audit.get("owner_rows_excluded", 0)
    included_owner = candidate_receipt.get("records_included", 0)
    owner_in_candidate = any(
        sid == "src_siralex_lexical_review"
        for sid in candidate_receipt.get("included_source_ids") or []
    )
    ok = (
        permission is False
        and excluded == owner_audit.get("total_owner_product_rows", 0)
        and not owner_in_candidate
    )
    status = CHECK_PASS if ok else CHECK_BLOCK
    return _result(
        "C8",
        status,
        owner_rows_distributable=owner_audit.get("owner_rows_distributable"),
        owner_rows_excluded=excluded,
        exclusion_reason=owner_audit.get("exclusion_reason"),
        owner_source_in_candidate=owner_in_candidate,
    )


def audit_portable_bundle(
    *,
    bundle_dir: Path,
    portable_dir: Path,
) -> dict[str, Any]:
    if portable_dir.exists():
        shutil.rmtree(portable_dir)
    shutil.copytree(bundle_dir, portable_dir)

    checks = {
        "has_manifest": (portable_dir / "bundle.manifest.json").is_file(),
        "has_attribution": (portable_dir / "ATTRIBUTION.txt").is_file(),
        "has_data_licenses": (portable_dir / "DATA_LICENSES.md").is_file(),
        "has_records": (portable_dir / "records.jsonl").is_file(),
        "has_search_index": (portable_dir / "search_index.jsonl").is_file(),
    }
    manifest = json.loads((portable_dir / "bundle.manifest.json").read_text(encoding="utf-8"))
    included = (manifest.get("sources") or {}).get("included") or []
    checks["manifest_lists_sources"] = len(included) > 0
    checks["manifest_lists_licenses"] = all(
        isinstance(e, dict) and e.get("claimed_license") for e in included
    )
    checks["sharealike_visible"] = bool(manifest.get("sharealike_notice"))
    checks["software_vs_data_separated"] = bool(
        manifest.get("software_license") and manifest.get("data_license_policy")
    )
    metadata_texts = {
        "ATTRIBUTION.txt": (portable_dir / "ATTRIBUTION.txt").read_text(encoding="utf-8")
        if (portable_dir / "ATTRIBUTION.txt").is_file()
        else "",
        "DATA_LICENSES.md": (portable_dir / "DATA_LICENSES.md").read_text(encoding="utf-8")
        if (portable_dir / "DATA_LICENSES.md").is_file()
        else "",
    }
    for entry in included:
        if isinstance(entry, dict):
            sid = str(entry.get("source_id") or "unknown")
            metadata_texts[f"manifest.sources.{sid}.attribution"] = str(
                entry.get("attribution") or ""
            )
    template_scan = scan_compliance_metadata_texts(metadata_texts)
    checks["unresolved_metadata_placeholders"] = template_scan["unresolved_placeholder_count"] == 0
    pass_n = sum(1 for v in checks.values() if v)
    return {
        "portable_dir": str(portable_dir),
        "checks": checks,
        "status": CHECK_PASS if pass_n == len(checks) else CHECK_BLOCK,
        "pass_count": pass_n,
        "total_checks": len(checks),
    }


def run_all_checks(
    *,
    repo_root: Path,
    bundle_dir: Path,
    source_ids: list[str],
    provenance_scan: dict[str, Any],
    derived_scan: dict[str, Any],
    owner_audit: dict[str, Any],
    candidate_receipt: dict[str, Any],
    portable_dir: Path,
) -> dict[str, Any]:
    results = {
        "C1": check_c1_attribution(repo_root=repo_root, bundle_dir=bundle_dir, source_ids=source_ids),
        "C2": check_c2_code_data_separation(repo_root=repo_root, bundle_dir=bundle_dir),
        "C3": check_c3_per_source_license(repo_root=repo_root, bundle_dir=bundle_dir),
        "C4": check_c4_sharealike(bundle_dir=bundle_dir),
        "C5": check_c5_provenance(provenance_scan=provenance_scan, derived_scan=derived_scan),
        "C6": check_c6_registry_manifest_consistency(
            repo_root=repo_root, bundle_dir=bundle_dir, source_ids=source_ids
        ),
        "C7": check_c7_noncommercial_posture(repo_root=repo_root, bundle_dir=bundle_dir),
        "C8": check_c8_owner_separation(
            owner_audit=owner_audit, candidate_receipt=candidate_receipt
        ),
        "portable_bundle": audit_portable_bundle(bundle_dir=bundle_dir, portable_dir=portable_dir),
    }
    blocked = [
        k
        for k, v in results.items()
        if k != "portable_bundle" and v.get("status") == CHECK_BLOCK
    ]
    if results["portable_bundle"].get("status") == CHECK_BLOCK:
        blocked.append("portable_bundle")
    results["all_pass"] = not blocked
    results["blocked_checks"] = blocked
    return results
