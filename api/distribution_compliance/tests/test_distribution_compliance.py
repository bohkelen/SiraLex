"""Tests for PRODUCT1B noncommercial distribution compliance."""

from __future__ import annotations

import json
import shutil
import subprocess
import tempfile
from pathlib import Path

import pytest
import yaml

from bundle_builder.build_bundle import build_bundle
from distribution_compliance.checks import (
    audit_portable_bundle,
    check_c1_attribution,
    check_c2_code_data_separation,
    check_c3_per_source_license,
    check_c4_sharealike,
    check_c6_registry_manifest_consistency,
    run_all_checks,
)
from distribution_compliance.classify import (
    classify_record_for_noncommercial,
    owner_distribution_audit,
)
from distribution_compliance.manifest import (
    artifact_rights_classification,
    build_attribution_bundle_text,
    enrich_manifest_with_licenses,
)
from distribution_compliance.model import CHECK_BLOCK, CHECK_PASS, SOFTWARE_LICENSE
from distribution_compliance.provenance import scan_record_provenance
from source_registry.load import (
    LICENSE_CC_BY_NC_SA,
    SOURCE_MALIPENSE,
    SOURCE_OWNER,
    build_attribution_text,
    load_source_registry,
    manifest_source_entries,
    resolve_source_entry,
    source_distribution_posture,
)

REPO_ROOT = Path(__file__).resolve().parents[3]


@pytest.fixture
def registry():
    return load_source_registry(REPO_ROOT)


def test_code_license_does_not_become_data_license(registry):
    mal = resolve_source_entry(registry, SOURCE_MALIPENSE)
    assert mal
    assert mal["claimed_license"] == LICENSE_CC_BY_NC_SA
    assert SOFTWARE_LICENSE != mal["claimed_license"]


def test_malidaba_cc_by_nc_sa_recognized(registry):
    posture = source_distribution_posture(registry[SOURCE_MALIPENSE])
    assert posture["distribution_state"] == "NONCOMMERCIAL_DISTRIBUTION_ALLOWED_SHAREALIKE"
    assert posture["sharealike_required"] is True
    assert posture["commercial_distribution"] is False


def test_registry_drives_attribution(registry):
    mal = resolve_source_entry(registry, SOURCE_MALIPENSE)
    assert mal["attribution"]
    assert "Mali-pense" in mal["attribution"] or "Malidaba" in mal["attribution"]
    assert "{retrieved_at}" not in mal["attribution"]
    assert "pending scope confirmation" not in mal["attribution"].lower()
    assert "Retrieved: 2026-01-22" in mal["attribution"]


def test_missing_attribution_blocks(registry):
    bad_registry = dict(registry)
    entry = dict(bad_registry[SOURCE_MALIPENSE])
    entry["attribution_template"] = ""
    entry["authors"] = []
    entry["name"] = ""
    entry["homepage_url"] = ""
    entry["license_evidence_url"] = ""
    bad_registry[SOURCE_MALIPENSE] = entry
    record = {"source_id": SOURCE_MALIPENSE, "ir_id": "abc", "record_locator": {"kind": "x"}}
    result = classify_record_for_noncommercial(record, registry=bad_registry)
    assert result["eligible"] is False
    assert "attribution" in (result.get("missing_metadata") or []) or result.get(
        "exclusion_reason"
    ) == "OTHER_RIGHTS_BLOCK"


def test_missing_license_blocks(registry):
    bad = dict(registry)
    entry = dict(bad[SOURCE_MALIPENSE])
    entry["claimed_license"] = ""
    bad[SOURCE_MALIPENSE] = entry
    record = {"source_id": SOURCE_MALIPENSE, "ir_id": "abc", "record_locator": {"kind": "x"}}
    result = classify_record_for_noncommercial(record, registry=bad)
    assert result["eligible"] is False


def test_registry_manifest_license_mismatch_blocks(registry, tmp_path):
    manifest = {
        "sources": {
            "included": [
                {
                    "source_id": SOURCE_MALIPENSE,
                    "claimed_license": "MIT",
                    "source_url": "https://example.com",
                    "attribution": "x",
                    "distribution_posture": "X",
                }
            ]
        }
    }
    bundle = tmp_path / "bundle"
    bundle.mkdir()
    (bundle / "bundle.manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
    result = check_c6_registry_manifest_consistency(
        repo_root=REPO_ROOT, bundle_dir=bundle, source_ids=[SOURCE_MALIPENSE]
    )
    assert result["status"] == CHECK_BLOCK


def test_sharealike_notice_required_for_malidaba_adapted_data(registry):
    manifest = enrich_manifest_with_licenses(
        {"manifest_schema_version": "bundle_manifest_v1"},
        registry=registry,
        source_ids=[SOURCE_MALIPENSE],
    )
    assert manifest["sharealike_notice"]["license"] == LICENSE_CC_BY_NC_SA
    assert manifest["artifact_rights_classification"]["records.jsonl"] == "MALIDABA_ADAPTED_DATA"


def test_pure_software_metadata_not_falsely_classified_as_cc_by_nc_sa():
    classes = artifact_rights_classification(source_ids=[], has_malidaba_data=False)
    assert classes["bundle.manifest.json"] == "COLLECTION_METADATA"
    assert classes["records.jsonl"] != "MALIDABA_ADAPTED_DATA"


def test_collection_preserves_separate_source_licenses(registry):
    entries = manifest_source_entries(registry, [SOURCE_MALIPENSE, SOURCE_OWNER])
    licenses = {e["source_id"]: e["claimed_license"] for e in entries}
    assert licenses[SOURCE_MALIPENSE] == LICENSE_CC_BY_NC_SA
    assert licenses[SOURCE_OWNER] == "project-internal-review"


def test_owner_internal_review_does_not_automatically_permit_distribution(registry):
    posture = source_distribution_posture(registry[SOURCE_OWNER])
    assert posture["noncommercial_distribution"] is False
    assert posture["distribution_state"] == "DISTRIBUTION_PERMISSION_NOT_RECORDED"


def test_owner_permission_not_recorded_rows_fail_closed(registry):
    record = {
        "source_id": SOURCE_OWNER,
        "ir_id": "owner1",
        "ir_kind": "lexicon_entry",
        "record_locator": {"kind": "internal"},
    }
    result = classify_record_for_noncommercial(record, registry=registry)
    assert result["eligible"] is False
    assert result["exclusion_reason"] == "DISTRIBUTION_PERMISSION_NOT_RECORDED"


def test_full_record_provenance_scan_on_sample(tmp_path, registry):
    records = tmp_path / "records.jsonl"
    rows = [
        {"ir_id": "a", "source_id": SOURCE_MALIPENSE, "record_locator": {"kind": "anchor"}},
        {"ir_id": "b", "source_id": "src_unknown", "record_locator": {}},
    ]
    records.write_text("\n".join(json.dumps(r) for r in rows) + "\n", encoding="utf-8")
    scan = scan_record_provenance(records, repo_root=REPO_ROOT)
    assert scan["records_scanned"] == 2
    assert scan["records_missing_source_provenance"] == 1
    assert "src_unknown" in scan["unresolvable_source_ids"]


def test_unresolved_source_provenance_blocks(tmp_path):
    records = tmp_path / "records.jsonl"
    records.write_text(
        json.dumps({"ir_id": "x", "source_id": "src_missing"}) + "\n",
        encoding="utf-8",
    )
    scan = scan_record_provenance(records, repo_root=REPO_ROOT)
    assert scan["records_missing_source_provenance"] == 1


def test_aliases_provenance_recognized():
    from distribution_compliance.provenance import scan_derived_artifact_provenance

    scan = scan_derived_artifact_provenance(
        repo_root=REPO_ROOT,
        candidate_record_ids={"nonexistent"},
    )
    assert "aliases" in scan


def test_portable_bundle_carries_licenses_without_repo_readme(registry, tmp_path):
    bundle = tmp_path / "bundle"
    bundle.mkdir()
    (bundle / "bundle.manifest.json").write_text(
        json.dumps(
            enrich_manifest_with_licenses(
                {"manifest_schema_version": "bundle_manifest_v1", "bundle_id": "test"},
                registry=registry,
                source_ids=[SOURCE_MALIPENSE],
            )
        ),
        encoding="utf-8",
    )
    (bundle / "ATTRIBUTION.txt").write_text(
        build_attribution_bundle_text(registry, [SOURCE_MALIPENSE]), encoding="utf-8"
    )
    (bundle / "DATA_LICENSES.md").write_text("# data licenses\n", encoding="utf-8")
    (bundle / "records.jsonl").write_text("{}\n", encoding="utf-8")
    (bundle / "search_index.jsonl").write_text("{}\n", encoding="utf-8")
    portable = tmp_path / "portable"
    result = audit_portable_bundle(bundle_dir=bundle, portable_dir=portable)
    assert result["status"] == CHECK_PASS
    assert not (portable / "README.md").exists()


def test_commercial_safe_does_not_block_noncommercial_profile(registry):
    mal = classify_record_for_noncommercial(
        {"source_id": SOURCE_MALIPENSE, "ir_id": "x", "record_locator": {"k": 1}},
        registry=registry,
    )
    assert mal["eligible"] is True


def test_compliance_manifest_deterministic_keys():
    from distribution_compliance.evaluate import evaluate_product1b

    if not (REPO_ROOT / "data" / "product1a" / "internal_full" / "records.jsonl").is_file():
        pytest.skip("INTERNAL_FULL workspace missing")
    receipt = evaluate_product1b(REPO_ROOT, skip_internal_rebuild=True)
    assert "candidate_hashes" in receipt
    assert receipt["publication_authorized"] is False


def test_no_canonical_lexical_mutation():
    result = subprocess.run(
        ["git", "diff", "--name-only", "HEAD", "--", "data/ir", "shared/malidaba"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.stdout.strip() == ""


def test_no_web_public_mutation():
    result = subprocess.run(
        ["git", "diff", "--name-only", "HEAD", "--", "web/public"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.stdout.strip() == ""


def test_web_scripts_untouched():
    result = subprocess.run(
        ["git", "status", "--short", "web/scripts"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.stdout.strip() in ("?? web/scripts/", "")


def test_build_bundle_license_enrichment(registry, tmp_path):
    norm = tmp_path / "records.jsonl"
    idx = tmp_path / "search_index.jsonl"
    norm.write_text(
        json.dumps(
            {
                "ir_id": "abc",
                "ir_kind": "lexicon_entry",
                "source_id": SOURCE_MALIPENSE,
                "norm_version": "norm_v1",
                "preferred_form": "test",
                "variant_forms": ["test"],
                "search_keys": {"casefold": ["test"]},
            }
        )
        + "\n",
        encoding="utf-8",
    )
    idx.write_text(
        json.dumps({"key_type": "casefold", "key": "test", "ir_ids": ["abc"]}) + "\n",
        encoding="utf-8",
    )
    out = tmp_path / "out"
    out.mkdir()
    result = build_bundle(
        norm,
        idx,
        out,
        sources_included=[SOURCE_MALIPENSE],
        license_enrichment=True,
        repo_root=REPO_ROOT,
        versioned_output=False,
    )
    manifest = result["manifest"]
    assert manifest["manifest_schema_version"] == "bundle_manifest_v2"
    assert manifest["software_license"]["spdx_expression"] == SOFTWARE_LICENSE


def test_internal_full_regression_baseline():
    receipt_path = REPO_ROOT / "data" / "product1a" / "internal_full" / "internal_full_receipt.json"
    if not receipt_path.is_file():
        pytest.skip("missing internal full receipt")
    receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
    assert receipt["regression_pass"] == 30
    assert receipt["regression_fail"] == 0


def test_unresolved_attribution_placeholder_blocks_c1(registry, tmp_path):
    from distribution_compliance.checks import check_c1_attribution

    bundle = tmp_path / "bundle"
    bundle.mkdir()
    bad_attr = "Source: Example\nRetrieved: {retrieved_at}\n"
    (bundle / "ATTRIBUTION.txt").write_text(bad_attr, encoding="utf-8")
    (bundle / "DATA_LICENSES.md").write_text("# licenses\n", encoding="utf-8")
    manifest = {
        "sources": {
            "included": [
                {
                    "source_id": SOURCE_MALIPENSE,
                    "attribution": bad_attr,
                    "claimed_license": LICENSE_CC_BY_NC_SA,
                }
            ]
        }
    }
    (bundle / "bundle.manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
    result = check_c1_attribution(
        repo_root=REPO_ROOT, bundle_dir=bundle, source_ids=[SOURCE_MALIPENSE]
    )
    assert result["status"] == CHECK_BLOCK
    assert result["unresolved_placeholder_count"] > 0


def test_rendered_deterministic_attribution_passes(registry, tmp_path):
    from distribution_compliance.checks import check_c1_attribution
    from distribution_compliance.manifest import build_attribution_bundle_text

    bundle = tmp_path / "bundle"
    bundle.mkdir()
    attr = build_attribution_bundle_text(registry, [SOURCE_MALIPENSE])
    (bundle / "ATTRIBUTION.txt").write_text(attr, encoding="utf-8")
    (bundle / "DATA_LICENSES.md").write_text("# licenses\n", encoding="utf-8")
    mal = resolve_source_entry(registry, SOURCE_MALIPENSE)
    manifest = {
        "sources": {"included": [{"source_id": SOURCE_MALIPENSE, **mal, "distribution_posture": "X"}]}
    }
    (bundle / "bundle.manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
    result = check_c1_attribution(
        repo_root=REPO_ROOT, bundle_dir=bundle, source_ids=[SOURCE_MALIPENSE]
    )
    assert result["status"] == CHECK_PASS
    assert result["unresolved_placeholder_count"] == 0


def test_unavailable_retrieved_at_line_omitted(registry):
    from source_registry.load import build_attribution_text, render_attribution_template

    entry = dict(registry[SOURCE_MALIPENSE])
    entry.pop("license_verified_at", None)
    entry.pop("source_retrieval_recorded_at", None)
    rendered = render_attribution_template(entry)
    assert "{retrieved_at}" not in rendered
    assert "Retrieved:" not in rendered
    assert "CC BY-NC-SA 4.0" in build_attribution_text(entry)
