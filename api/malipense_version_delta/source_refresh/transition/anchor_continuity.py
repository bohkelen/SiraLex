"""Rewrite index-mapping durable locators through lexical continuity.

Malidaba recycles source_record_id values across editions. Baseline index
mappings still point at the old anchor; resolving against current IR can
attach the wrong headword. Continuity overlay selects the successor record;
this module rewrites the locator (anchor + lexicon_url), not lexical text.
"""

from __future__ import annotations

from copy import deepcopy
from typing import Any

from .id_remap import logical_index_from_objects, logical_key


def source_record_id_of(record: dict[str, Any] | None) -> str | None:
    if not record:
        return None
    loc = record.get("record_locator") or {}
    sid = loc.get("source_record_id")
    if isinstance(sid, str) and sid:
        return sid
    return None


def lexicon_url_of(record: dict[str, Any] | None, fallback: str | None) -> str | None:
    if not record:
        return fallback
    url = str((record.get("record_locator") or {}).get("url_canonical") or "")
    marker = "/lexicon/"
    if marker in url:
        page = url.rsplit("/", 1)[-1]
        if page:
            return f"../lexicon/{page}"
    return fallback


def preferred_form_of(record: dict[str, Any] | None) -> str | None:
    if not record:
        return None
    fields = record.get("fields_raw") or {}
    head = fields.get("headword_latin")
    if isinstance(head, str) and head:
        return head
    pref = record.get("preferred_form")
    if isinstance(pref, str) and pref:
        return pref
    return None


def source_record_to_ir(
    records: list[dict[str, Any]],
) -> dict[str, str]:
    """Unique lexicon source_record_id → ir_id. Collisions are omitted."""
    mapping: dict[str, str] = {}
    collisions: set[str] = set()
    for record in records:
        if record.get("ir_kind") != "lexicon_entry":
            continue
        ir_id = record.get("ir_id")
        sid = source_record_id_of(record)
        if not ir_id or not sid:
            continue
        ir_s = str(ir_id)
        if sid in mapping and mapping[sid] != ir_s:
            collisions.add(sid)
        else:
            mapping[sid] = ir_s
    for sid in collisions:
        mapping.pop(sid, None)
    return mapping


def remap_target_entry(
    entry: dict[str, Any],
    *,
    overlay: dict[str, str],
    baseline_by_source_record: dict[str, str],
    current_by_ir: dict[str, dict[str, Any]],
) -> tuple[dict[str, Any], bool]:
    if not isinstance(entry, dict):
        return entry, False
    new_entry = dict(entry)
    anchor = new_entry.get("anchor")
    if not isinstance(anchor, str) or anchor not in baseline_by_source_record:
        return new_entry, False
    baseline_ir = baseline_by_source_record[anchor]
    if baseline_ir not in overlay:
        return new_entry, False
    current = current_by_ir.get(overlay[baseline_ir])
    new_anchor = source_record_id_of(current)
    if not new_anchor:
        return new_entry, False
    changed = new_anchor != anchor
    new_entry["anchor"] = new_anchor
    new_url = lexicon_url_of(current, new_entry.get("lexicon_url"))
    if isinstance(new_url, str) and new_url:
        new_entry["lexicon_url"] = new_url
    form = preferred_form_of(current)
    if form:
        new_entry["display_text"] = form
    return new_entry, changed


def rewrite_index_mapping_record(
    record: dict[str, Any],
    *,
    overlay: dict[str, str],
    baseline_by_source_record: dict[str, str],
    current_by_ir: dict[str, dict[str, Any]],
) -> tuple[dict[str, Any], int]:
    new_record = deepcopy(record)
    changes = 0

    def _rewrite_entries(entries: Any) -> list[Any]:
        nonlocal changes
        if not isinstance(entries, list):
            return entries
        out = []
        for entry in entries:
            if not isinstance(entry, dict):
                out.append(entry)
                continue
            rewritten, changed = remap_target_entry(
                entry,
                overlay=overlay,
                baseline_by_source_record=baseline_by_source_record,
                current_by_ir=current_by_ir,
            )
            if changed:
                changes += 1
            out.append(rewritten)
        return out

    fields = new_record.get("fields_raw")
    if isinstance(fields, dict) and "target_entries" in fields:
        fields = dict(fields)
        fields["target_entries"] = _rewrite_entries(fields.get("target_entries"))
        new_record["fields_raw"] = fields

    display = new_record.get("display")
    if isinstance(display, dict) and "target_entries" in display:
        display = dict(display)
        display["target_entries"] = _rewrite_entries(display.get("target_entries"))
        new_record["display"] = display

    return new_record, changes


def rewrite_index_ir_rows(
    rows: list[dict[str, Any]],
    *,
    overlay: dict[str, str],
    baseline_records: list[dict[str, Any]],
    current_records: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], int]:
    baseline_by_source = source_record_to_ir(baseline_records)
    current_by_ir = {
        str(r["ir_id"]): r for r in current_records if r.get("ir_id")
    }
    rewritten: list[dict[str, Any]] = []
    total = 0
    for row in rows:
        if row.get("ir_kind") == "index_mapping":
            new_row, n = rewrite_index_mapping_record(
                row,
                overlay=overlay,
                baseline_by_source_record=baseline_by_source,
                current_by_ir=current_by_ir,
            )
            total += n
            rewritten.append(new_row)
        else:
            rewritten.append(deepcopy(row))
    return rewritten, total


def logical_ids_for_anchors(
    anchors: list[str],
    *,
    baseline_by_source_record: dict[str, str],
    overlay: dict[str, str],
    objects: list[dict[str, Any]],
) -> list[str]:
    logical_index = logical_index_from_objects(objects)
    keys: list[str] = []
    for anchor in anchors:
        baseline_ir = baseline_by_source_record.get(anchor)
        if not baseline_ir:
            keys.append(f"unmapped_anchor:{anchor}")
            continue
        current_ir = overlay.get(baseline_ir, baseline_ir)
        keys.append(logical_key(current_ir, logical_index))
    return keys
