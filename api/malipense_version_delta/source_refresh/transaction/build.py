"""Reproduce F19 product behavior from staged canonical inputs only."""

from __future__ import annotations

import shutil
from pathlib import Path
from typing import Any

from malipense_version_delta.canonical_json import sha256_file, write_json

from ..paths import SourceRefreshPaths
from ..transition.differential import classify_suites, replay_regression_suite
from .model import (
    DEST_ALIASES,
    DEST_CURRENT_IR,
    DEST_INDEX_IR,
    DEST_SUPPLEMENTS,
    DEST_TARGET_VARIANTS,
)


def run_staged_product_build(
    paths: SourceRefreshPaths,
    *,
    staging_root: Path,
    overlay: dict[str, str],
    generated_mapping_overlay: dict[str, str] | None = None,
    workspace: Path | None = None,
) -> dict[str, Any]:
    """
    Build search product from staged destinations using the real pipeline pieces.

    Inputs are ONLY under staging_root (+ tracked owner IR, which is unchanged).
    """
    work = (workspace or paths.f20_dir) / "staged_build"
    if work.exists():
        shutil.rmtree(work)
    work.mkdir(parents=True, exist_ok=True)

    current_ir = staging_root / DEST_CURRENT_IR
    index_ir = staging_root / DEST_INDEX_IR
    aliases = staging_root / DEST_ALIASES
    supplements = staging_root / DEST_SUPPLEMENTS
    target_variants = staging_root / DEST_TARGET_VARIANTS
    for required in (current_ir, index_ir, aliases, supplements, target_variants):
        if not required.is_file():
            raise FileNotFoundError(f"staged_input_missing:{required}")

    from normalizer.normalize import process_ir_files
    from search_index.build_index import process_normalized_file
    from source_aliases.apply_aliases_to_search_index import apply_approved_aliases
    from source_index_supplements.generate_supplement_records import (
        generate_augmented_records,
    )
    from source_index_supplements.merge_supplements_into_search_index import (
        merge_and_write,
    )

    ir_inputs = [current_ir, index_ir]
    if paths.owner_ir.is_file():
        ir_inputs.append(paths.owner_ir)

    norm = work / "normalized.jsonl"
    stats = process_ir_files(
        ir_inputs, norm, target_variant_overlay=target_variants
    )
    if int(stats.get("errors") or 0) > 0:
        raise RuntimeError(f"staged_normalize_errors:{stats.get('errors')}")

    enr = work / "enriched.jsonl"
    pipeline = norm
    enrichment = "FALLBACK_NORMALIZED"
    try:
        from enrichment.enrich import enrich_records

        enrich_records(normalized_path=norm, ir_paths=ir_inputs, output_path=enr)
        pipeline = enr
        enrichment = "PASS"
    except Exception as exc:
        enrichment = f"FALLBACK_NORMALIZED:{exc}"

    raw_index = work / "search_index_raw.jsonl"
    process_normalized_file(pipeline, raw_index)
    aliased = work / "search_index_aliased.jsonl"
    apply_approved_aliases(
        alias_table_path=aliases,
        records_path=pipeline,
        input_search_index_path=raw_index,
        output_search_index_path=aliased,
        output_report_path=work / "alias_report.json",
    )

    if paths.canonical_bundle_dir is None:
        raise RuntimeError("canonical_bundle_dir_required_for_supplement_merge")
    final_index = work / "search_index.jsonl"
    final_records = work / "records.jsonl"
    generate_augmented_records(
        supplement_table_path=supplements,
        records_path=pipeline,
        search_index_path=aliased,
        output_records_path=final_records,
        output_report_path=work / "supplement_generate.json",
        owner_lexical_ir_path=paths.owner_ir if paths.owner_ir.is_file() else None,
    )
    merge_and_write(
        supplement_table_path=supplements,
        records_path=pipeline,
        baseline_search_index_path=aliased,
        baseline_bundle_dir=paths.canonical_bundle_dir,
        output_search_index_path=final_index,
        output_report_path=work / "supplement_merge.json",
        owner_lexical_ir_path=paths.owner_ir if paths.owner_ir.is_file() else None,
    )

    refresh_overlay = dict(overlay)
    if generated_mapping_overlay:
        refresh_overlay.update(generated_mapping_overlay)

    canon_index = paths.canonical_bundle_dir / "search_index.jsonl"
    canon_records = paths.canonical_bundle_dir / "records.jsonl"
    canonical_results = replay_regression_suite(
        search_index_path=canon_index,
        records_path=canon_records,
        regression_dir=paths.search_regression_dir,
        overlay={},
    )
    staged_results = replay_regression_suite(
        search_index_path=final_index,
        records_path=final_records,
        regression_dir=paths.search_regression_dir,
        overlay=refresh_overlay,
    )
    differential = classify_suites(canonical_results, staged_results, refresh_overlay)
    differential["status"] = "RAN"

    receipt = {
        "work_dir": str(work),
        "enrichment": enrichment,
        "normalize_errors": int(stats.get("errors") or 0),
        "records_sha256": sha256_file(final_records),
        "search_index_sha256": sha256_file(final_index),
        "canonical_pass": differential.get("canonical_pass"),
        "canonical_fail": differential.get("canonical_fail"),
        "staged_pass": differential.get("refresh_pass"),
        "staged_fail": differential.get("refresh_fail"),
        "differential": {
            "transition_introduced_failures": differential.get(
                "transition_introduced_failures"
            ),
            "transition_worsened_failures": differential.get(
                "transition_worsened_failures"
            ),
            "g8_pass": differential.get("g8_pass"),
        },
        "matches_f19_behavior": (
            differential.get("canonical_pass") == 30
            and differential.get("refresh_pass") == 30
            and differential.get("g8_pass") is True
        ),
    }
    write_json(work / "staged_build_receipt.json", receipt)
    return receipt
