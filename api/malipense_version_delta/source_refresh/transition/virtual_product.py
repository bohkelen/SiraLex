"""Assemble a local virtual search product from frozen inputs + identity overlay.

Rebuilds normalization, enrichment, index, aliases, and supplements under a
gitignored work directory. Never writes canonical IR, snapshots, tracked
tables, bundles, or web/public.
"""

from __future__ import annotations

import shutil
from pathlib import Path
from typing import Any

from malipense_version_delta.canonical_json import sha256_file, write_json, write_jsonl
from malipense_version_delta.compare import load_jsonl_records

from ..paths import SourceRefreshPaths
from .anchor_continuity import rewrite_index_ir_rows
from .id_remap import (
    generated_mapping_overlay,
    logical_index_from_objects,
    rewrite_table,
)


class VirtualProductError(RuntimeError):
    """Raised when the virtual product cannot be assembled."""


def _copy_jsonl(src: Path, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(src, dest)


def rewrite_downstream_tables(
    paths: SourceRefreshPaths,
    *,
    overlay: dict[str, str],
    work_dir: Path,
    objects: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    logical_index = logical_index_from_objects(objects or [])
    alias_rows = load_jsonl_records(paths.aliases) if paths.aliases.is_file() else []
    supp_rows = (
        load_jsonl_records(paths.supplements) if paths.supplements.is_file() else []
    )
    tvar_rows = (
        load_jsonl_records(paths.target_variants)
        if paths.target_variants.is_file()
        else []
    )
    phrase_rows = (
        load_jsonl_records(paths.phrase_review) if paths.phrase_review.is_file() else []
    )
    aliases, alias_n = rewrite_table(
        alias_rows, overlay, artifact="source_alias", logical_index=logical_index
    )
    supplements, supp_n = rewrite_table(
        supp_rows,
        overlay,
        artifact="source_index_supplement",
        logical_index=logical_index,
    )
    tvars, tvar_n = rewrite_table(
        tvar_rows,
        overlay,
        artifact="reviewed_target_variant",
        logical_index=logical_index,
    )
    phrases, phrase_n = rewrite_table(
        phrase_rows, overlay, artifact="phrase_review", logical_index=logical_index
    )
    alias_out = work_dir / "source_aliases_virtual.jsonl"
    supp_out = work_dir / "source_index_supplements_virtual.jsonl"
    tvar_out = work_dir / "reviewed_target_variants_virtual.jsonl"
    phrase_out = work_dir / "phrase_miss_review_virtual.jsonl"
    write_jsonl(alias_out, aliases)
    write_jsonl(supp_out, supplements)
    write_jsonl(tvar_out, tvars)
    write_jsonl(phrase_out, phrases)
    mapping_overlay = generated_mapping_overlay(supp_rows, supplements)
    return {
        "aliases": alias_out,
        "supplements": supp_out,
        "target_variants": tvar_out,
        "phrase_review": phrase_out,
        "generated_mapping_overlay": mapping_overlay,
        "field_updates": {
            "alias_field_updates": alias_n,
            "supplement_field_updates": supp_n,
            "target_variant_updates": tvar_n,
            "phrase_review_updates": phrase_n,
            "generated_mapping_updates": len(mapping_overlay),
        },
    }


def rewrite_virtual_index_ir(
    paths: SourceRefreshPaths,
    *,
    overlay: dict[str, str],
    work_dir: Path,
) -> tuple[Path, int]:
    index_rows = load_jsonl_records(paths.index_ir) if paths.index_ir.is_file() else []
    baseline = load_jsonl_records(paths.baseline_ir)
    current = load_jsonl_records(paths.current_ir)
    rewritten, n = rewrite_index_ir_rows(
        index_rows,
        overlay=overlay,
        baseline_records=baseline,
        current_records=current,
    )
    out = work_dir / "index_ir_virtual.jsonl"
    write_jsonl(out, rewritten)
    return out, n


def assemble_virtual_search_product(
    paths: SourceRefreshPaths,
    *,
    overlay: dict[str, str],
    work_dir: Path,
    objects: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """
    Clean rebuild from frozen current IR + remapped index IR + remapped
    downstream tables. Outputs stay under work_dir.
    """
    if work_dir.exists():
        shutil.rmtree(work_dir)
    work_dir.mkdir(parents=True, exist_ok=True)

    tables = rewrite_downstream_tables(
        paths, overlay=overlay, work_dir=work_dir, objects=objects
    )
    index_ir_virtual, anchor_changes = rewrite_virtual_index_ir(
        paths, overlay=overlay, work_dir=work_dir
    )

    ir_inputs = [paths.current_ir, index_ir_virtual]
    if paths.owner_ir.is_file():
        ir_inputs.append(paths.owner_ir)

    from normalizer.normalize import process_ir_files
    from search_index.build_index import process_normalized_file

    norm_path = work_dir / "candidate_normalized.jsonl"
    stats = process_ir_files(
        ir_inputs,
        norm_path,
        target_variant_overlay=tables["target_variants"],
    )
    if int(stats.get("errors") or 0) > 0:
        raise VirtualProductError(f"virtual_normalize_errors:{stats.get('errors')}")

    enr_path = work_dir / "candidate_enriched.jsonl"
    pipeline = norm_path
    enrichment_note = "FALLBACK_NORMALIZED"
    try:
        from enrichment.enrich import enrich_records

        enrich_records(
            normalized_path=norm_path,
            ir_paths=ir_inputs,
            output_path=enr_path,
        )
        pipeline = enr_path
        enrichment_note = "PASS"
    except Exception as exc:
        enrichment_note = f"FALLBACK_NORMALIZED:{exc}"
        if enr_path.is_file():
            enr_path.unlink()

    raw_index = work_dir / "candidate_search_index_raw.jsonl"
    process_normalized_file(pipeline, raw_index)

    aliased_index = work_dir / "candidate_search_index_with_virtual_aliases.jsonl"
    alias_note = "skipped_no_alias_table"
    try:
        from source_aliases.apply_aliases_to_search_index import apply_approved_aliases

        apply_approved_aliases(
            alias_table_path=tables["aliases"],
            records_path=pipeline,
            input_search_index_path=raw_index,
            output_search_index_path=aliased_index,
            output_report_path=work_dir / "alias_apply_report.json",
        )
        alias_note = "applied_virtual_aliases"
    except Exception as exc:
        shutil.copyfile(raw_index, aliased_index)
        alias_note = f"alias_apply_failed_fallback_raw_index:{exc}"

    final_index = work_dir / "candidate_search_index_virtual.jsonl"
    final_records = work_dir / "candidate_records_virtual.jsonl"
    supp_note = "skipped_no_supplements"
    if tables["supplements"].is_file() and paths.canonical_bundle_dir is not None:
        try:
            from source_index_supplements.generate_supplement_records import (
                generate_augmented_records,
            )
            from source_index_supplements.merge_supplements_into_search_index import (
                merge_and_write,
            )

            generate_augmented_records(
                supplement_table_path=tables["supplements"],
                records_path=pipeline,
                search_index_path=aliased_index,
                output_records_path=final_records,
                output_report_path=work_dir / "supplement_generate_report.json",
                owner_lexical_ir_path=paths.owner_ir if paths.owner_ir.is_file() else None,
            )
            merge_and_write(
                supplement_table_path=tables["supplements"],
                records_path=pipeline,
                baseline_search_index_path=aliased_index,
                baseline_bundle_dir=paths.canonical_bundle_dir,
                output_search_index_path=final_index,
                output_report_path=work_dir / "supplement_merge_report.json",
                owner_lexical_ir_path=paths.owner_ir if paths.owner_ir.is_file() else None,
            )
            supp_note = "merged_virtual_supplements"
        except Exception as exc:
            _copy_jsonl(pipeline, final_records)
            shutil.copyfile(aliased_index, final_index)
            supp_note = f"supplement_merge_failed:{exc}"
            raise VirtualProductError(supp_note) from exc
    else:
        _copy_jsonl(pipeline, final_records)
        shutil.copyfile(aliased_index, final_index)

    receipt = {
        "work_dir": str(work_dir),
        "records_path": str(final_records),
        "search_index_path": str(final_index),
        "index_ir_virtual": str(index_ir_virtual),
        "anchor_rewrites": anchor_changes,
        "enrichment": enrichment_note,
        "alias_apply_note": alias_note,
        "supplement_merge_note": supp_note,
        "generated_mapping_overlay": tables.get("generated_mapping_overlay") or {},
        "field_updates": tables["field_updates"],
        "normalize_stats": {
            k: stats.get(k)
            for k in (
                "ir_units_read",
                "lexicon_entries_normalized",
                "index_mappings_normalized",
                "target_variant_overlay_applied_row_count",
                "errors",
            )
        },
        "candidate_records_sha256": sha256_file(final_records),
        "candidate_search_index_sha256": sha256_file(final_index),
        "canonical_writes": False,
    }
    write_json(work_dir / "virtual_product_receipt.json", receipt)
    return receipt
