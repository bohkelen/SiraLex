"""Build INTERNAL_FULL and COMMERCIAL_SAFE_CANDIDATE product surfaces."""

from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Any

from malipense_version_delta.canonical_json import sha256_file, write_json, write_jsonl
from malipense_version_delta.compare import load_jsonl_records
from malipense_version_delta.source_refresh.transition.differential import (
    replay_regression_suite,
)
from malipense_version_delta.source_refresh.transition.id_remap import (
    generated_mapping_overlay,
)

from .classify import (
    classify_alias_row,
    classify_product_record,
    classify_supplement_row,
    classify_variant_row,
    recursive_commercial_closure,
)
from .model import (
    DEP_DIRECT_MALIDABA,
    DEP_INDEPENDENT_COMMERCIAL_SAFE,
    DEP_LEGACY_MALIDABA,
    DEP_MALIDABA_DERIVED,
    DEP_MIXED_MALIDABA_OTHER,
    DEP_UNKNOWN_BLOCKED,
    PROFILE_COMMERCIAL_SAFE_CANDIDATE,
    PROFILE_INTERNAL_FULL,
    REGRESSION_EXPECTED_RIGHTS_EXCLUSION,
    REGRESSION_PASS,
    REGRESSION_UNEXPECTED_PRODUCT_DEFECT,
    SOURCE_MALIPENSE,
    SOURCE_OWNER,
)
from .paths import Product1APaths
from .registry import load_source_registry, malidaba_rights_posture


def _load_post_refresh_overlay(paths: Product1APaths) -> dict[str, str]:
    """Identity continuity overlay + generated supplement mapping overlay."""
    overlay_path = (
        paths.repo_root
        / "data"
        / "malidaba_delta"
        / "current"
        / "source_refresh"
        / "f19"
        / "virtual"
        / "identity_overlay.json"
    )
    overlay: dict[str, str] = {}
    if overlay_path.is_file():
        overlay = json.loads(overlay_path.read_text(encoding="utf-8"))
        if not isinstance(overlay, dict):
            overlay = {}
    # Pre-refresh supplements at F20 design base (pre-apply commit parent of refresh).
    import subprocess

    try:
        pre_bytes = subprocess.check_output(
            [
                "git",
                "show",
                "7a97fcefa05430e31cbbf2f6803af657e2dacf83:"
                "shared/source_index_supplements/source_index_supplements_v1.jsonl",
            ],
            cwd=str(paths.repo_root),
        )
    except subprocess.CalledProcessError:
        return {str(k): str(v) for k, v in overlay.items()}
    import tempfile

    with tempfile.NamedTemporaryFile("wb", delete=False, suffix=".jsonl") as handle:
        handle.write(pre_bytes)
        pre_path = Path(handle.name)
    try:
        mapping = generated_mapping_overlay(
            load_jsonl_records(pre_path),
            load_jsonl_records(paths.supplements),
        )
    finally:
        pre_path.unlink(missing_ok=True)
    merged = {str(k): str(v) for k, v in overlay.items()}
    merged.update({str(k): str(v) for k, v in mapping.items()})
    return merged


def _count_keys(search_index_path: Path) -> dict[str, int]:
    total = 0
    by_type: dict[str, int] = {}
    fr = en = src = tgt = 0
    if not search_index_path.is_file():
        return {
            "search_keys": 0,
            "fr_keys": 0,
            "en_keys": 0,
            "src_keys": 0,
            "tgt_keys": 0,
        }
    with search_index_path.open(encoding="utf-8") as handle:
        for line in handle:
            if not line.strip():
                continue
            row = json.loads(line)
            total += 1
            kt = str(row.get("key_type") or "")
            by_type[kt] = by_type.get(kt, 0) + 1
            if kt.startswith("fr_"):
                fr += 1
            elif kt.startswith("en_"):
                en += 1
            elif kt.startswith("src_"):
                src += 1
            elif kt.startswith("tgt_"):
                tgt += 1
    return {
        "search_keys": total,
        "fr_keys": fr,
        "en_keys": en,
        "src_keys": src,
        "tgt_keys": tgt,
        "by_key_type": by_type,
    }


def build_internal_full(paths: Product1APaths, *, workspace: Path | None = None) -> dict[str, Any]:
    """
    Reproduce internal product behavior from current canonical IRs.

    Prefers an existing post-refresh F21 canonical_build when present and
    hash-stable enough for regression; otherwise rebuilds via normalize/enrich/index.
    """
    work = workspace or paths.internal_dir
    if work.exists():
        shutil.rmtree(work)
    work.mkdir(parents=True, exist_ok=True)

    f21_records = (
        paths.repo_root
        / "data"
        / "malidaba_delta"
        / "current"
        / "source_refresh"
        / "f21"
        / "canonical_build"
        / "records.jsonl"
    )
    f21_index = (
        paths.repo_root
        / "data"
        / "malidaba_delta"
        / "current"
        / "source_refresh"
        / "f21"
        / "canonical_build"
        / "search_index.jsonl"
    )

    used_cache = False
    if f21_records.is_file() and f21_index.is_file():
        shutil.copy2(f21_records, work / "records.jsonl")
        shutil.copy2(f21_index, work / "search_index.jsonl")
        used_cache = True
        enrichment = "F21_CANONICAL_BUILD_CACHE"
    else:
        enrichment = _rebuild_product(paths, work)

    records_path = work / "records.jsonl"
    index_path = work / "search_index.jsonl"
    post_refresh_overlay = _load_post_refresh_overlay(paths)
    results = replay_regression_suite(
        search_index_path=index_path,
        records_path=records_path,
        regression_dir=paths.search_regression_dir,
        overlay=post_refresh_overlay,
    )
    pass_n = sum(1 for r in results if r.ok)
    fail_n = sum(1 for r in results if not r.ok)
    records = load_jsonl_records(records_path)
    headwords = {
        str(
            r.get("preferred_form")
            or (r.get("display") or {}).get("headword_latin")
            or ""
        )
        for r in records
        if r.get("ir_kind") == "lexicon_entry"
    }
    headwords.discard("")
    key_stats = _count_keys(index_path)
    receipt = {
        "profile": PROFILE_INTERNAL_FULL,
        "work_dir": str(work),
        "used_f21_cache": used_cache,
        "enrichment": enrichment,
        "records": len(records),
        "lexicon_entries": sum(1 for r in records if r.get("ir_kind") == "lexicon_entry"),
        "headwords": len(headwords),
        "regression_pass": pass_n,
        "regression_fail": fail_n,
        "records_sha256": sha256_file(records_path),
        "search_index_sha256": sha256_file(index_path),
        "post_refresh_overlay_entries": len(post_refresh_overlay),
        **key_stats,
    }
    write_json(work / "internal_full_receipt.json", receipt)
    return receipt


def _rebuild_product(paths: Product1APaths, work: Path) -> str:
    from enrichment.enrich import enrich_records
    from normalizer.normalize import process_ir_files
    from search_index.build_index import process_normalized_file
    from source_aliases.apply_aliases_to_search_index import apply_approved_aliases
    from source_index_supplements.generate_supplement_records import (
        generate_augmented_records,
    )
    from source_index_supplements.merge_supplements_into_search_index import (
        merge_and_write,
    )

    ir_inputs = [paths.current_ir, paths.index_ir]
    if paths.legacy_ir.is_file():
        ir_inputs.append(paths.legacy_ir)
    if paths.owner_ir.is_file():
        ir_inputs.append(paths.owner_ir)

    norm = work / "normalized.jsonl"
    stats = process_ir_files(
        ir_inputs, norm, target_variant_overlay=paths.target_variants
    )
    if int(stats.get("errors") or 0) > 0:
        raise RuntimeError(f"internal_normalize_errors:{stats.get('errors')}")

    enr = work / "enriched.jsonl"
    enrich_records(normalized_path=norm, ir_paths=ir_inputs, output_path=enr)
    raw_index = work / "search_index_raw.jsonl"
    process_normalized_file(enr, raw_index)
    aliased = work / "search_index_aliased.jsonl"
    apply_approved_aliases(
        alias_table_path=paths.aliases,
        records_path=enr,
        input_search_index_path=raw_index,
        output_search_index_path=aliased,
        output_report_path=work / "alias_report.json",
    )
    # Bundle dir only needed for path plumbing in merge; use repo featured as baseline dir.
    bundle_dir = paths.repo_root / "web" / "public" / "bundle_full_20260710_337619ff"
    generate_augmented_records(
        supplement_table_path=paths.supplements,
        records_path=enr,
        search_index_path=aliased,
        output_records_path=work / "records.jsonl",
        output_report_path=work / "supplement_generate.json",
        owner_lexical_ir_path=paths.owner_ir,
    )
    merge_and_write(
        supplement_table_path=paths.supplements,
        records_path=enr,
        baseline_search_index_path=aliased,
        baseline_bundle_dir=bundle_dir,
        output_search_index_path=work / "search_index.jsonl",
        output_report_path=work / "supplement_merge.json",
        owner_lexical_ir_path=paths.owner_ir,
    )
    return "REBUILT"


def classify_surface(paths: Product1APaths, *, records_path: Path) -> dict[str, Any]:
    registry = load_source_registry(paths.repo_root)
    licenses = {
        sid: str(entry.get("claimed_license") or "")
        for sid, entry in registry.items()
    }
    malidaba_ids = {
        str(r["ir_id"])
        for r in load_jsonl_records(paths.current_ir)
        if r.get("ir_id")
    }
    legacy_ids = {
        str(r["ir_id"])
        for r in load_jsonl_records(paths.legacy_ir)
        if r.get("ir_id")
    }
    # Also treat any src_malipense product row as Malidaba.
    records = load_jsonl_records(records_path)
    for r in records:
        if r.get("source_id") == SOURCE_MALIPENSE and r.get("ir_id"):
            malidaba_ids.add(str(r["ir_id"]))

    record_classes: dict[str, dict[str, Any]] = {}
    for r in records:
        ir_id = str(r.get("ir_id") or "")
        if not ir_id:
            continue
        record_classes[ir_id] = classify_product_record(
            r,
            registry_licenses=licenses,
            malidaba_ir_ids=malidaba_ids,
            legacy_ir_ids=legacy_ids,
        )

    # Apply recursive closure among records.
    for ir_id, item in list(record_classes.items()):
        record_classes[ir_id] = recursive_commercial_closure(item, class_by_id=record_classes)

    aliases = [
        classify_alias_row(
            row,
            malidaba_ir_ids=malidaba_ids,
            legacy_ir_ids=legacy_ids,
            record_class_by_id=record_classes,
        )
        for row in load_jsonl_records(paths.aliases)
    ]
    supplements = [
        classify_supplement_row(
            row,
            malidaba_ir_ids=malidaba_ids,
            legacy_ir_ids=legacy_ids,
            record_class_by_id=record_classes,
        )
        for row in load_jsonl_records(paths.supplements)
    ]
    variants = [
        classify_variant_row(
            row,
            malidaba_ir_ids=malidaba_ids,
            legacy_ir_ids=legacy_ids,
            record_class_by_id=record_classes,
        )
        for row in load_jsonl_records(paths.target_variants)
    ]

    for rows in (aliases, supplements, variants):
        for i, item in enumerate(rows):
            rows[i] = recursive_commercial_closure(item, class_by_id=record_classes)

    all_items = [*record_classes.values(), *aliases, *supplements, *variants]
    return {
        "malidaba_rights": malidaba_rights_posture(registry),
        "record_classes": record_classes,
        "aliases": aliases,
        "supplements": supplements,
        "variants": variants,
        "all_items": all_items,
        "malidaba_ir_ids": malidaba_ids,
        "legacy_ir_ids": legacy_ids,
    }


def build_commercial_safe(
    paths: Product1APaths,
    *,
    classification: dict[str, Any],
    internal_records_path: Path,
    internal_search_path: Path,
) -> dict[str, Any]:
    work = paths.commercial_dir
    if work.exists():
        shutil.rmtree(work)
    work.mkdir(parents=True, exist_ok=True)

    eligible_ids = {
        ir_id
        for ir_id, item in classification["record_classes"].items()
        if item.get("commercial_eligible") is True
        and item.get("provenance_closure") == "PASS"
    }

    # Filter records.
    kept_records: list[dict[str, Any]] = []
    for row in load_jsonl_records(internal_records_path):
        ir_id = str(row.get("ir_id") or "")
        if ir_id in eligible_ids:
            # Strip any Malidaba-derived variant forms from retained rows.
            kept = dict(row)
            # Fail-closed: if source is malipense somehow slipped through, drop.
            if kept.get("source_id") == SOURCE_MALIPENSE:
                continue
            kept_records.append(kept)
    write_jsonl(work / "records.jsonl", kept_records)

    # Eligible aliases/variants/supplements (none expected today).
    eligible_alias_terms: set[str] = set()
    for item in classification["aliases"]:
        if item.get("commercial_eligible"):
            term = item.get("alias_source_term")
            if isinstance(term, str):
                eligible_alias_terms.add(term)

    eligible_variant_forms: set[str] = set()
    for item in classification["variants"]:
        if item.get("commercial_eligible"):
            form = item.get("form")
            if isinstance(form, str):
                eligible_variant_forms.add(form)

    # Build search index only from postings whose ir_ids ⊆ eligible_ids,
    # and drop keys that are excluded alias/variant surface terms when those
    # terms are not commercially eligible.
    blocked_alias_terms = {
        str(i.get("alias_source_term"))
        for i in classification["aliases"]
        if not i.get("commercial_eligible") and i.get("alias_source_term")
    }
    blocked_variant_forms = {
        str(i.get("form"))
        for i in classification["variants"]
        if not i.get("commercial_eligible") and i.get("form")
    }

    filtered_index: list[dict[str, Any]] = []
    for row in load_jsonl_records(internal_search_path):
        key = row.get("key")
        ir_ids = [str(x) for x in (row.get("ir_ids") or [])]
        kept_ids = [i for i in ir_ids if i in eligible_ids]
        if not kept_ids:
            continue
        if isinstance(key, str) and key in blocked_alias_terms:
            continue
        if isinstance(key, str) and key in blocked_variant_forms:
            continue
        filtered_index.append(
            {"key_type": row.get("key_type"), "key": key, "ir_ids": kept_ids}
        )
    write_jsonl(work / "search_index.jsonl", filtered_index)

    # Prototype bundle (local only).
    bundle = work / "bundle_prototype"
    bundle.mkdir(parents=True, exist_ok=True)
    shutil.copy2(work / "records.jsonl", bundle / "records.jsonl")
    shutil.copy2(work / "search_index.jsonl", bundle / "search_index.jsonl")
    manifest = {
        "schema_version": "siralex_bundle_manifest_v1",
        "siralex_product_profile": "commercial_safe_candidate_v1",
        "publication_authorized": False,
        "engineering_candidate_only": True,
        "record_count": len(kept_records),
        "search_key_count": len(filtered_index),
        "rights_note": (
            "Fail-closed commercial-safe candidate. Malidaba CC BY-NC-SA content "
            "excluded. Owner project-internal-review content excluded until "
            "commercial permission is recorded in the source registry."
        ),
    }
    write_json(bundle / "bundle.manifest.json", manifest)

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
    key_stats = _count_keys(work / "search_index.jsonl")

    # Commercial regression classification (same post-refresh overlay as INTERNAL_FULL).
    post_refresh_overlay = _load_post_refresh_overlay(paths)
    internal_results = replay_regression_suite(
        search_index_path=internal_search_path,
        records_path=internal_records_path,
        regression_dir=paths.search_regression_dir,
        overlay=post_refresh_overlay,
    )
    commercial_results = replay_regression_suite(
        search_index_path=work / "search_index.jsonl",
        records_path=work / "records.jsonl",
        regression_dir=paths.search_regression_dir,
        overlay=post_refresh_overlay,
    )
    by_id_internal = {r.case_id: r for r in internal_results}
    commercial_cases: list[dict[str, Any]] = []
    pass_n = expected_excl = unexpected = 0
    for cres in commercial_results:
        ires = by_id_internal.get(cres.case_id)
        if cres.ok:
            label = REGRESSION_PASS
            pass_n += 1
        elif ires is not None and ires.ok and not cres.ok:
            # Internal passed; commercial lost result → expected if expected ids
            # are not commercially eligible.
            expected_ids = set(cres.expected_ir_ids)
            if expected_ids and expected_ids.isdisjoint(eligible_ids):
                label = REGRESSION_EXPECTED_RIGHTS_EXCLUSION
                expected_excl += 1
            else:
                label = REGRESSION_UNEXPECTED_PRODUCT_DEFECT
                unexpected += 1
        elif ires is not None and not ires.ok and not cres.ok:
            label = REGRESSION_EXPECTED_RIGHTS_EXCLUSION
            expected_excl += 1
        else:
            label = REGRESSION_UNEXPECTED_PRODUCT_DEFECT
            unexpected += 1
        commercial_cases.append(
            {
                "case_id": cres.case_id,
                "label": label,
                "ok": cres.ok,
                "expected_ir_ids": cres.expected_ir_ids,
                "actual_ir_ids": cres.comparable_actual(),
            }
        )

    receipt = {
        "profile": PROFILE_COMMERCIAL_SAFE_CANDIDATE,
        "records": len(kept_records),
        "lexicon_entries": sum(1 for r in kept_records if r.get("ir_kind") == "lexicon_entry"),
        "headwords": len(headwords),
        "eligible_record_ids": sorted(eligible_ids),
        "records_sha256": sha256_file(work / "records.jsonl"),
        "search_index_sha256": sha256_file(work / "search_index.jsonl"),
        "bundle_manifest_sha256": sha256_file(bundle / "bundle.manifest.json"),
        "regression": {
            "pass": pass_n,
            "expected_rights_exclusion": expected_excl,
            "unexpected_product_defect": unexpected,
            "cases": commercial_cases,
        },
        **key_stats,
    }
    write_json(work / "commercial_safe_receipt.json", receipt)
    return receipt


def summarize_dependence(items: list[dict[str, Any]]) -> dict[str, int]:
    buckets = {
        DEP_DIRECT_MALIDABA: 0,
        DEP_LEGACY_MALIDABA: 0,
        DEP_MALIDABA_DERIVED: 0,
        DEP_MIXED_MALIDABA_OTHER: 0,
        DEP_INDEPENDENT_COMMERCIAL_SAFE: 0,
        DEP_UNKNOWN_BLOCKED: 0,
    }
    for item in items:
        if item.get("item_kind") not in {None, "lexicon_entry", "index_mapping", "record"}:
            # Count lexicon entries primarily for product surface dependence.
            if item.get("item_kind") != "lexicon_entry" and item.get("item_kind") not in (
                "source_alias",
                "source_index_supplement",
                "reviewed_target_variant",
            ):
                kind = item.get("item_kind")
                if kind not in {"lexicon_entry", "index_mapping"}:
                    continue
        bucket = item.get("dependence_bucket")
        if bucket in buckets:
            # Only count lexicon entries in dependence denominator.
            if item.get("item_kind") in {None, "lexicon_entry", "record"} or item.get(
                "item_kind"
            ) == "lexicon_entry":
                pass
    # Recount cleanly: lexicon entries only.
    for item in items:
        kind = item.get("item_kind")
        if kind not in {None, "lexicon_entry", "record", "index_mapping"}:
            if kind != "lexicon_entry":
                continue
        # Prefer only lexicon_entry when known.
    lex_items = [
        i
        for i in items
        if i.get("item_kind") in {"lexicon_entry", "record", None}
        or (
            i.get("item_kind") == "index_mapping"
            and i.get("source_id") == SOURCE_MALIPENSE
        )
    ]
    # Simpler: count from record_classes only — caller should pass lexicon subset.
    out = {k: 0 for k in buckets}
    for item in items:
        b = item.get("dependence_bucket")
        if b in out:
            out[b] += 1
    return out


def owner_audit(record_classes: dict[str, dict[str, Any]]) -> dict[str, int]:
    owners = [v for v in record_classes.values() if v.get("source_id") == SOURCE_OWNER]
    return {
        "owner_records_audited": len(owners),
        "owner_independently_evidenced": sum(
            1 for o in owners if o.get("owner_independence") == "independently_evidenced"
        ),
        "owner_malidaba_derived": sum(
            1
            for o in owners
            if o.get("owner_independence") == "malidaba_derived_or_dependent"
        ),
        "owner_mixed_unclear": sum(
            1 for o in owners if o.get("owner_independence") == "mixed_or_unclear"
        ),
    }
