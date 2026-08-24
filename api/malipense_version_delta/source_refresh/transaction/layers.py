"""Build the three distinct canonical source layers (never flattened)."""

from __future__ import annotations

import unicodedata
from copy import deepcopy
from typing import Any

from malipense_version_delta.canonical_json import canonical_dumps
from malipense_version_delta.compare import load_jsonl_records

from ..continuity.logical import RIGHTS_CC_BY_NC_SA, SOURCE_ID_MALIPENSE
from ..model import (
    ASSERTION_CONFLICT,
    CONTINUITY_DETERMINISTIC,
    CONTINUITY_HUMAN_CONFIRMED,
    CONTINUITY_LEGACY_RETAINED,
)
from ..paths import SourceRefreshPaths
from ..persist.validate import find_review_leaves, validate_review_file
from .model import (
    EDITION_BASELINE,
    EDITION_CURRENT,
    LAYER_STAMP_CURRENT,
    LAYER_STAMP_LEGACY,
)


def _stamp_current(record: dict[str, Any]) -> dict[str, Any]:
    row = deepcopy(record)
    row["edition_layer"] = {
        "schema_version": LAYER_STAMP_CURRENT,
        "edition": EDITION_CURRENT,
        "source_id": SOURCE_ID_MALIPENSE,
        "current_edition_attribution": True,
        "claimed_license": RIGHTS_CC_BY_NC_SA,
        "purpose": "internal_source_maintenance",
    }
    return row


def _stamp_legacy(record: dict[str, Any], *, review_id: str) -> dict[str, Any]:
    row = deepcopy(record)
    row["edition_layer"] = {
        "schema_version": LAYER_STAMP_LEGACY,
        "edition": EDITION_BASELINE,
        "source_id": SOURCE_ID_MALIPENSE,
        "current_edition_attribution": False,
        "human_disposition": "retain_baseline_record",
        "review_id": review_id,
        "claimed_license": RIGHTS_CC_BY_NC_SA,
        "purpose": "internal_source_maintenance",
        "note": (
            "Legacy Malidaba evidence retained through transition; "
            "not attributed as a current-edition assertion."
        ),
    }
    return row


def load_type_b_retain_ids(paths: SourceRefreshPaths) -> list[tuple[str, str]]:
    registry = paths.f18_dir / "malidaba_missing_disposition_reviews_v1.jsonl"
    result = validate_review_file(registry, kind="type_b")
    leaf_ids = set(find_review_leaves([item.row for item in result.rows]))
    out: list[tuple[str, str]] = []
    for item in result.rows:
        if item.review_id not in leaf_ids:
            continue
        if item.row.get("review_decision") != "retain_baseline_record":
            continue
        out.append((str(item.row["baseline_ir_id"]), str(item.row["review_id"])))
    out.sort(key=lambda x: x[0])
    return out


def build_edition_to_logical_rows(objects: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for obj in objects:
        lid = str(obj.get("logical_lexical_id") or "")
        status = str(obj.get("continuity_status") or "")
        for ir_id in obj.get("baseline_ir_ids") or []:
            rows.append(
                {
                    "schema_version": "malidaba_edition_to_logical_mapping_v1",
                    "edition": EDITION_BASELINE,
                    "edition_ir_id": str(ir_id),
                    "logical_lexical_id": lid,
                    "continuity_status": status,
                    "source_record_id_is_lexical_identity": False,
                }
            )
        for ir_id in obj.get("current_ir_ids") or []:
            rows.append(
                {
                    "schema_version": "malidaba_edition_to_logical_mapping_v1",
                    "edition": EDITION_CURRENT,
                    "edition_ir_id": str(ir_id),
                    "logical_lexical_id": lid,
                    "continuity_status": status,
                    "source_record_id_is_lexical_identity": False,
                }
            )
    rows.sort(key=lambda r: (r["edition"], r["edition_ir_id"], r["logical_lexical_id"]))
    return rows


def build_canonical_layers(paths: SourceRefreshPaths) -> dict[str, Any]:
    """Materialize current, legacy, and logical layers from frozen inputs."""
    current_raw = load_jsonl_records(paths.current_ir)
    baseline_index = {
        str(r["ir_id"]): r for r in load_jsonl_records(paths.baseline_ir) if r.get("ir_id")
    }
    current_rows = [_stamp_current(r) for r in current_raw]
    current_rows.sort(key=lambda r: str(r.get("ir_id") or ""))

    retain = load_type_b_retain_ids(paths)
    legacy_rows: list[dict[str, Any]] = []
    missing: list[str] = []
    for baseline_ir_id, review_id in retain:
        record = baseline_index.get(baseline_ir_id)
        if record is None:
            missing.append(baseline_ir_id)
            continue
        legacy_rows.append(_stamp_legacy(record, review_id=review_id))
    if missing:
        raise ValueError(f"legacy_baseline_records_missing:{missing[:5]}")
    legacy_rows.sort(key=lambda r: str(r.get("ir_id") or ""))

    logical_path = paths.f19_dir / "virtual" / "logical_lexical_continuity.jsonl"
    logical_rows = load_jsonl_records(logical_path)
    logical_rows.sort(
        key=lambda o: (
            str(o.get("continuity_status") or ""),
            str((o.get("baseline_ir_ids") or [""])[0]),
            str(o.get("logical_lexical_id") or ""),
        )
    )
    edition_map = build_edition_to_logical_rows(logical_rows)

    counts = {
        "current_edition_assertions": len(current_rows),
        "legacy_retained_assertions": len(legacy_rows),
        "logical_continuity_objects": len(logical_rows),
        "deterministic_continuity": sum(
            1 for o in logical_rows if o.get("continuity_status") == CONTINUITY_DETERMINISTIC
        ),
        "human_confirmed_continuity": sum(
            1
            for o in logical_rows
            if o.get("continuity_status") == CONTINUITY_HUMAN_CONFIRMED
        ),
        "legacy_only_continuity": sum(
            1 for o in logical_rows if o.get("continuity_status") == CONTINUITY_LEGACY_RETAINED
        ),
        "unresolved_continuity": sum(
            1 for o in logical_rows if o.get("continuity_status") == "UNRESOLVED_HUMAN_CONTINUITY"
        ),
        "conflicting_assertions": sum(
            1
            for o in logical_rows
            for a in (o.get("edition_assertions") or [])
            if a.get("assertion_class") == ASSERTION_CONFLICT
        ),
    }

    # Homograph check: two kùn Type-A subjects remain distinct logical ids.
    def _latin_base(value: object) -> str:
        text = str(value or "")
        decomposed = unicodedata.normalize("NFD", text)
        return "".join(ch for ch in decomposed if unicodedata.category(ch) != "Mn")

    kun_logical = sorted(
        {
            str(o.get("logical_lexical_id"))
            for o in logical_rows
            if o.get("continuity_status") == CONTINUITY_HUMAN_CONFIRMED
            and any(
                _latin_base(a.get("baseline_edition", {}).get("value")) == "kun"
                or _latin_base(a.get("current_edition", {}).get("value")) == "kun"
                for a in (o.get("edition_assertions") or [])
                if a.get("field") == "headword_latin"
            )
        }
    )

    return {
        "current_rows": current_rows,
        "legacy_rows": legacy_rows,
        "logical_rows": logical_rows,
        "edition_map_rows": edition_map,
        "counts": counts,
        "kun_logical_ids": kun_logical,
        "bytes": {
            "current": ("\n".join(canonical_dumps(r) for r in current_rows) + "\n").encode(
                "utf-8"
            ),
            "legacy": ("\n".join(canonical_dumps(r) for r in legacy_rows) + "\n").encode(
                "utf-8"
            ),
            "logical": ("\n".join(canonical_dumps(r) for r in logical_rows) + "\n").encode(
                "utf-8"
            ),
            "edition_map": (
                "\n".join(canonical_dumps(r) for r in edition_map) + "\n"
            ).encode("utf-8"),
        },
    }


def validate_layer_provenance(layers: dict[str, Any]) -> dict[str, Any]:
    errors: list[str] = []
    for row in layers["current_rows"]:
        layer = row.get("edition_layer") or {}
        if layer.get("edition") != EDITION_CURRENT:
            errors.append(f"current_missing_edition_stamp:{row.get('ir_id')}")
        if layer.get("current_edition_attribution") is not True:
            errors.append(f"current_attribution_false:{row.get('ir_id')}")
    for row in layers["legacy_rows"]:
        layer = row.get("edition_layer") or {}
        if layer.get("edition") != EDITION_BASELINE:
            errors.append(f"legacy_missing_baseline_stamp:{row.get('ir_id')}")
        if layer.get("current_edition_attribution") is not False:
            errors.append(f"legacy_claimed_current:{row.get('ir_id')}")
        if layer.get("human_disposition") != "retain_baseline_record":
            errors.append(f"legacy_missing_disposition:{row.get('ir_id')}")
    for obj in layers["logical_rows"]:
        if not obj.get("logical_lexical_id"):
            errors.append("logical_missing_id")
        rights = obj.get("rights_status") or {}
        if rights.get("claimed_license") != RIGHTS_CC_BY_NC_SA:
            errors.append(f"logical_rights:{obj.get('logical_lexical_id')}")
        for ir_id in obj.get("baseline_ir_ids") or []:
            if not ir_id:
                errors.append("empty_baseline_ir")
        # current_wins_overwrite must remain false on conflicts
        for assertion in obj.get("edition_assertions") or []:
            if assertion.get("assertion_class") == ASSERTION_CONFLICT:
                if assertion.get("current_wins_overwrite") is not False:
                    errors.append(
                        f"conflict_current_wins:{obj.get('logical_lexical_id')}"
                    )

    # Each edition ir belongs to at most one logical object (no contradictory multi-map)
    seen: dict[str, str] = {}
    for obj in layers["logical_rows"]:
        lid = str(obj.get("logical_lexical_id"))
        for key in ("baseline_ir_ids", "current_ir_ids"):
            for ir_id in obj.get(key) or []:
                ir_s = str(ir_id)
                prev = seen.get(ir_s)
                if prev and prev != lid:
                    errors.append(f"contradictory_logical_map:{ir_s}:{prev}:{lid}")
                seen[ir_s] = lid

    if len(layers["kun_logical_ids"]) != 2:
        errors.append(
            f"kun_homographs_expected_2:got={len(layers['kun_logical_ids'])}"
        )

    return {
        "ok": not errors,
        "errors": errors[:50],
        "error_count": len(errors),
        "kun_logical_ids": layers["kun_logical_ids"],
    }
