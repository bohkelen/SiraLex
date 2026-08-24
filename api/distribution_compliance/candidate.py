"""Build NONCOMMERCIAL_DISTRIBUTION_CANDIDATE from INTERNAL_FULL."""

from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Any

from malipense_version_delta.canonical_json import sha256_file, write_json, write_jsonl
from malipense_version_delta.compare import load_jsonl_records
from source_registry.load import SOURCE_MALIPENSE, load_source_registry

from .classify import classify_record_for_noncommercial, summarize_exclusions
from .manifest import enrich_manifest_with_licenses, write_bundle_license_sidecars
from .model import PROFILE_NONCOMMERCIAL_CANDIDATE
from .paths import Product1BPaths


def build_noncommercial_candidate(
    paths: Product1BPaths,
    *,
    internal_records_path: Path | None = None,
    internal_search_path: Path | None = None,
) -> dict[str, Any]:
    records_path = internal_records_path or paths.internal_records
    search_path = internal_search_path or paths.internal_search
    if not records_path.is_file() or not search_path.is_file():
        raise FileNotFoundError(
            "INTERNAL_FULL records/search_index required; run PRODUCT1A first."
        )

    registry = load_source_registry(paths.repo_root)
    work = paths.candidate_dir
    if work.exists():
        shutil.rmtree(work)
    work.mkdir(parents=True, exist_ok=True)

    all_records = load_jsonl_records(records_path)
    classifications: dict[str, dict[str, Any]] = {}
    kept_records: list[dict[str, Any]] = []
    excluded_records = 0
    for row in all_records:
        ir_id = str(row.get("ir_id") or "")
        item = classify_record_for_noncommercial(row, registry=registry)
        if ir_id:
            classifications[ir_id] = item
        if item.get("eligible"):
            kept_records.append(row)
        else:
            excluded_records += 1

    eligible_ids = {str(r["ir_id"]) for r in kept_records if r.get("ir_id")}
    write_jsonl(work / "records.jsonl", kept_records)

    filtered_index: list[dict[str, Any]] = []
    for row in load_jsonl_records(search_path):
        ir_ids = [str(x) for x in (row.get("ir_ids") or [])]
        kept_ids = [i for i in ir_ids if i in eligible_ids]
        if kept_ids:
            filtered_index.append(
                {"key_type": row.get("key_type"), "key": row.get("key"), "ir_ids": kept_ids}
            )
    write_jsonl(work / "search_index.jsonl", filtered_index)

    source_ids = sorted({str(r.get("source_id") or "") for r in kept_records if r.get("source_id")})
    bundle_dir = paths.candidate_bundle
    bundle_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(work / "records.jsonl", bundle_dir / "records.jsonl")
    shutil.copy2(work / "search_index.jsonl", bundle_dir / "search_index.jsonl")

    sidecars = write_bundle_license_sidecars(
        bundle_dir,
        registry=registry,
        source_ids=source_ids,
        data_licenses_doc=paths.data_licenses_doc,
    )

    from bundle_builder.build_bundle import build_bundle

    build_result = build_bundle(
        normalized_path=work / "records.jsonl",
        search_index_path=work / "search_index.jsonl",
        output_dir=work,
        bundle_type="noncommercial_candidate",
        sources_included=source_ids,
        license_enrichment=True,
        repo_root=paths.repo_root,
        publication_authorized=False,
        versioned_output=False,
    )
    built_bundle = Path(build_result["bundle_dir"])
    # Copy sidecars into built bundle if build_bundle used temp dir.
    for name in sidecars:
        src = bundle_dir / name
        if src.is_file():
            shutil.copy2(src, built_bundle / name)

    manifest_path = built_bundle / "bundle.manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    enriched = enrich_manifest_with_licenses(
        manifest,
        registry=registry,
        source_ids=source_ids,
        publication_authorized=False,
    )
    write_json(manifest_path, enriched)

    headwords = {
        str(
            r.get("preferred_form")
            or (r.get("display") or {}).get("headword_latin")
            or ""
        )
        for r in kept_records
        if r.get("ir_kind") == "lexicon_entry"
    }
    headwords.discard("")

    exclusions = summarize_exclusions(classifications)
    receipt = {
        "profile": PROFILE_NONCOMMERCIAL_CANDIDATE,
        "records_included": len(kept_records),
        "records_excluded": excluded_records,
        "records_total_internal": len(all_records),
        "lexicon_entries_included": sum(
            1 for r in kept_records if r.get("ir_kind") == "lexicon_entry"
        ),
        "headwords_included": len(headwords),
        "search_keys_included": len(filtered_index),
        "exclusions_by_reason": exclusions,
        "included_source_ids": source_ids,
        "bundle_dir": str(built_bundle),
        "records_sha256": sha256_file(work / "records.jsonl"),
        "search_index_sha256": sha256_file(work / "search_index.jsonl"),
        "manifest_sha256": sha256_file(manifest_path),
        "classifications": classifications,
    }
    write_json(work / "candidate_receipt.json", receipt)
    return receipt
