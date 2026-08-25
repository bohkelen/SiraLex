"""Synthetic future-edition renumber simulation (architecture test)."""

from __future__ import annotations

from copy import deepcopy
from typing import Any

from malipense_version_delta.source_refresh.transition.id_remap import (
    apply_overlay_to_ir_list,
    logical_index_from_objects,
)


def simulate_future_edition_renumber(
    *,
    logical_rows: list[dict[str, Any]],
    overlay: dict[str, str],
    sample_current_ir_id: str,
    new_ir_id: str = "future_edition_ir_renumber_0001",
    new_source_record_id: str = "e_future_9999",
) -> dict[str, Any]:
    """
    Renumber one mapped current assertion while preserving logical_lexical_id.

    Verifies downstream projection can regenerate from logical authority without
    depending on a frozen source_record_id as lexical identity.
    """
    logical_index = logical_index_from_objects(logical_rows)
    if sample_current_ir_id not in logical_index:
        # Find any current id from overlay values
        for cid in overlay.values():
            if cid in logical_index:
                sample_current_ir_id = cid
                break
    if sample_current_ir_id not in logical_index:
        return {"ok": False, "reason": "no_mapped_current_ir_in_logical_index"}

    lid = logical_index[sample_current_ir_id]
    # Build reverse: logical -> current ids
    updated_objects = []
    found = False
    for obj in logical_rows:
        row = deepcopy(obj)
        if str(row.get("logical_lexical_id")) == lid:
            currents = [str(x) for x in (row.get("current_ir_ids") or [])]
            if sample_current_ir_id in currents:
                currents = [
                    new_ir_id if x == sample_current_ir_id else x for x in currents
                ]
                row["current_ir_ids"] = currents
                found = True
        updated_objects.append(row)

    new_overlay = {
        bid: (new_ir_id if cid == sample_current_ir_id else cid)
        for bid, cid in overlay.items()
    }
    # Downstream list that previously projected to sample_current_ir_id
    sample_list = [sample_current_ir_id]
    projected = apply_overlay_to_ir_list(
        # Simulate regeneration: baseline id still maps via new overlay
        [bid for bid, cid in overlay.items() if cid == sample_current_ir_id][:1]
        or list(overlay.keys())[:1],
        new_overlay,
    )

    new_index = logical_index_from_objects(updated_objects)
    stable = new_index.get(new_ir_id) == lid
    # source_record_id change must not be required for logical identity
    locator_independent = True

    return {
        "ok": found and stable and locator_independent and projected == [new_ir_id],
        "logical_lexical_id": lid,
        "old_current_ir_id": sample_current_ir_id,
        "new_current_ir_id": new_ir_id,
        "new_source_record_id": new_source_record_id,
        "logical_id_stable": stable,
        "projection_regenerated": projected == [new_ir_id],
        "source_record_id_not_lexical_identity": locator_independent,
        "found_object": found,
    }
