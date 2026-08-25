"""Rights-exclusion leakage audit for commercial-safe candidate."""

from __future__ import annotations

from typing import Any

from malipense_version_delta.compare import load_jsonl_records

from .model import LAYER_LEGACY, SOURCE_MALIPENSE
from .paths import Product1APaths


def audit_commercial_leaks(
    paths: Product1APaths,
    *,
    commercial_records_path,
    commercial_search_path,
    malidaba_ir_ids: set[str],
    legacy_ir_ids: set[str],
) -> dict[str, Any]:
    direct = legacy = derived = unknown = mixed = 0
    samples: dict[str, list[str]] = {
        "direct": [],
        "legacy": [],
        "derived": [],
        "unknown": [],
        "mixed": [],
    }

    for row in load_jsonl_records(commercial_records_path):
        ir_id = str(row.get("ir_id") or "")
        source_id = row.get("source_id")
        layer = row.get("edition_layer") if isinstance(row.get("edition_layer"), dict) else {}
        if source_id == SOURCE_MALIPENSE or layer.get("source_id") == SOURCE_MALIPENSE:
            if layer.get("schema_version") == LAYER_LEGACY or ir_id in legacy_ir_ids:
                legacy += 1
                samples["legacy"].append(ir_id)
            else:
                direct += 1
                samples["direct"].append(ir_id)
        elif ir_id in malidaba_ir_ids or ir_id in legacy_ir_ids:
            derived += 1
            samples["derived"].append(ir_id)
        elif not source_id:
            unknown += 1
            samples["unknown"].append(ir_id)

    # Search postings must not reference Malidaba ids.
    for row in load_jsonl_records(commercial_search_path):
        for ir_id in row.get("ir_ids") or []:
            sid = str(ir_id)
            if sid in malidaba_ir_ids:
                derived += 1
                samples["derived"].append(f"search:{sid}")
            if sid in legacy_ir_ids:
                legacy += 1
                samples["legacy"].append(f"search:{sid}")

    return {
        "direct_malidaba_leaks": direct,
        "legacy_malidaba_leaks": legacy,
        "derived_malidaba_leaks": derived,
        "unknown_rights_leaks": unknown,
        "mixed_rights_leaks": mixed,
        "samples": {k: v[:10] for k, v in samples.items()},
        "ok": direct == 0
        and legacy == 0
        and derived == 0
        and unknown == 0
        and mixed == 0,
    }
