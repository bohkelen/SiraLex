"""Identity-bearing field remap + logical-multiplicity guards for virtual overlay.

Uses repository fields discovered in tracked aliases, supplements, target
variants, phrase-review, regression matrices, and index IR. Does not invent
fields.
"""

from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass
from hashlib import sha256
from typing import Any, Iterable

REWRITTEN = "REWRITTEN"
NOT_IDENTITY_BOUND = "NOT_IDENTITY_BOUND"
UNSUPPORTED = "UNSUPPORTED"
BUG_FOUND = "BUG_FOUND"

# Intended identity layer per artifact class (F19 documentation; not a rewrite).
IDENTITY_LAYERS = {
    "aliases": "edition_runtime_ir_id (resolved/evidence lists projected through continuity)",
    "supplements": "edition_runtime_ir_id (target/evidence lists projected through continuity)",
    "target_variants": "edition_runtime_ir_id (canonical_ir_id projected through continuity)",
    "regression_expectations": (
        "edition_runtime_ir_id for current replay; future contracts should "
        "prefer logical_lexical_id when testing lexical continuity"
    ),
    "search_postings": "runtime posting ir_id (index_mapping / lexicon / generated); not overlay-rewritten",
    "bundle_records": "runtime record ir_id primary key; not overlay-rewritten",
    "index_mapping_anchors": (
        "durable source_record_id locator, rewritten via baseline→current continuity"
    ),
    "generated_supplement_mappings": (
        "derived runtime ir_id of generated index_mapping; projected when "
        "supplement target_ir_ids change under continuity"
    ),
}


@dataclass(frozen=True)
class FieldSpec:
    artifact: str
    path: tuple[str, ...]
    kind: str  # list | scalar
    audit: str
    notes: str = ""


# Actual repository fields (see reference_integrity.collect_downstream_references).
IDENTITY_FIELD_SPECS: tuple[FieldSpec, ...] = (
    FieldSpec("source_alias", ("resolved_ir_ids",), "list", REWRITTEN),
    FieldSpec("source_alias", ("evidence_ir_ids",), "list", REWRITTEN),
    FieldSpec("source_index_supplement", ("target_ir_ids",), "list", REWRITTEN),
    FieldSpec(
        "source_index_supplement",
        ("supporting_evidence_ir_ids",),
        "list",
        REWRITTEN,
    ),
    FieldSpec(
        "source_index_supplement",
        ("target_notes", "*", "target_ir_id"),
        "scalar",
        REWRITTEN,
    ),
    FieldSpec("reviewed_target_variant", ("canonical_ir_id",), "scalar", REWRITTEN),
    FieldSpec(
        "phrase_review",
        ("related_single_terms", "*", "resolved_ir_ids"),
        "list",
        REWRITTEN,
        "virtual copy only; phrase review is not a runtime apply table",
    ),
    FieldSpec(
        "phrase_review",
        ("related_phrase_terms", "*", "resolved_ir_ids"),
        "list",
        REWRITTEN,
        "virtual copy only",
    ),
    FieldSpec(
        "phrase_review",
        ("candidate_resolved_ir_ids",),
        "list",
        REWRITTEN,
        "virtual copy only",
    ),
    FieldSpec(
        "search_regression",
        ("expected_ir_ids",),
        "list",
        REWRITTEN,
        "runtime projection during replay; tracked matrices are not mutated",
    ),
    FieldSpec(
        "search_index",
        ("ir_ids",),
        "list",
        NOT_IDENTITY_BOUND,
        "posting ids are current/index/generated runtime ids; overlay remap would collide",
    ),
    FieldSpec(
        "bundle_record",
        ("ir_id",),
        "scalar",
        NOT_IDENTITY_BOUND,
        "primary key of the runtime record is not a baseline reference",
    ),
    FieldSpec(
        "index_mapping",
        ("fields_raw", "target_entries", "*", "anchor"),
        "scalar",
        REWRITTEN,
        "locator rewritten through continuity, not as a raw ir_id overlay",
    ),
    FieldSpec(
        "generated_supplement_mapping",
        ("derived_generated_ir_id",),
        "scalar",
        REWRITTEN,
        "derived from supplement_id+source_term+target_ir_ids; replay overlay only",
    ),
)


class LogicalMultiplicityError(ValueError):
    """Raised when overlay remap would collapse distinct logical targets."""


def apply_overlay_to_ir_list(ir_ids: list[str], overlay: dict[str, str]) -> list[str]:
    """Map baseline ir_ids through overlay; preserve order and unknowns."""
    return [overlay.get(i, i) for i in ir_ids]


def generated_supplement_mapping_ir_id(
    *,
    supplement_id: str,
    source_term: str,
    target_ir_ids: list[str],
) -> str:
    """
    Mirror source_index_supplements.generate_supplement_records.generated_ir_id.

    Used to project derived mapping identities after target_ir_ids remap.
    """
    payload = "|".join(
        [
            "source_index_supplement_v1",
            supplement_id,
            source_term,
            ",".join(target_ir_ids),
        ]
    )
    return "ff" + sha256(payload.encode("utf-8")).hexdigest()[:14]


def generated_mapping_overlay(
    original_rows: list[dict[str, Any]],
    rewritten_rows: list[dict[str, Any]],
) -> dict[str, str]:
    """Map pre-refresh generated supplement ir_ids to post-remap generated ids."""
    overlay: dict[str, str] = {}
    by_id = {
        str(row.get("supplement_id") or ""): row for row in rewritten_rows
    }
    for original in original_rows:
        sid = str(original.get("supplement_id") or "")
        rewritten = by_id.get(sid)
        if not rewritten:
            continue
        old_targets = [str(x) for x in (original.get("target_ir_ids") or [])]
        new_targets = [str(x) for x in (rewritten.get("target_ir_ids") or [])]
        if old_targets == new_targets:
            continue
        old_id = generated_supplement_mapping_ir_id(
            supplement_id=sid,
            source_term=str(original.get("source_term") or ""),
            target_ir_ids=old_targets,
        )
        new_id = generated_supplement_mapping_ir_id(
            supplement_id=sid,
            source_term=str(rewritten.get("source_term") or original.get("source_term") or ""),
            target_ir_ids=new_targets,
        )
        if old_id != new_id:
            overlay[old_id] = new_id
    return overlay


def logical_index_from_objects(objects: Iterable[dict[str, Any]]) -> dict[str, str]:
    """Map edition ir_id → logical_lexical_id for baseline and current ids."""
    index: dict[str, str] = {}
    for obj in objects:
        lid = str(obj.get("logical_lexical_id") or "")
        if not lid:
            continue
        for key in ("baseline_ir_ids", "current_ir_ids"):
            for ir_id in obj.get(key) or []:
                index[str(ir_id)] = lid
    return index


def logical_key(
    ir_id: str,
    logical_index: dict[str, str],
    overlay: dict[str, str] | None = None,
) -> str:
    """Stable identity: governed logical id, else overlay-projected runtime id."""
    overlay = overlay or {}
    if ir_id in logical_index:
        return logical_index[ir_id]
    mapped = overlay.get(ir_id, ir_id)
    if mapped in logical_index:
        return logical_index[mapped]
    return f"external:{mapped}"


def distinct_logical_keys(
    ir_ids: list[str],
    logical_index: dict[str, str],
    overlay: dict[str, str] | None = None,
) -> list[str]:
    seen: list[str] = []
    present: set[str] = set()
    for ir_id in ir_ids:
        key = logical_key(ir_id, logical_index, overlay)
        if key not in present:
            present.add(key)
            seen.append(key)
    return seen


def assert_logical_multiplicity_preserved(
    before_ids: list[str],
    after_ids: list[str],
    logical_index: dict[str, str],
    *,
    context: str,
    overlay: dict[str, str] | None = None,
) -> None:
    """
    count(distinct logical targets before) must equal after unless a governed
    continuity object already unifies those edition ids (same logical_lexical_id).
    """
    overlay = overlay or {}
    before = set(distinct_logical_keys(before_ids, logical_index, overlay))
    after = set(distinct_logical_keys(after_ids, logical_index, overlay))
    if before != after:
        raise LogicalMultiplicityError(
            f"{context}: logical_target_multiplicity_changed "
            f"before={sorted(before)} after={sorted(after)}"
        )


def audit_catalog() -> list[dict[str, Any]]:
    return [
        {
            "artifact": spec.artifact,
            "path": ".".join(spec.path),
            "kind": spec.kind,
            "audit": spec.audit,
            "notes": spec.notes,
        }
        for spec in IDENTITY_FIELD_SPECS
    ]


def _remap_at_path(
    obj: Any,
    path: tuple[str, ...],
    overlay: dict[str, str],
    changed: list[int],
) -> None:
    if not path:
        return
    head, *rest = path
    rest_t = tuple(rest)
    if head == "*":
        if isinstance(obj, list):
            for item in obj:
                _remap_at_path(item, rest_t, overlay, changed)
        return
    if not isinstance(obj, dict) or head not in obj:
        return
    if not rest_t:
        val = obj[head]
        if isinstance(val, list):
            original = [str(v) for v in val]
            mapped = apply_overlay_to_ir_list(original, overlay)
            if mapped != original:
                changed[0] += 1
            obj[head] = mapped
        elif isinstance(val, str) and val:
            new = overlay.get(val, val)
            if new != val:
                changed[0] += 1
            obj[head] = new
        return
    _remap_at_path(obj[head], rest_t, overlay, changed)


def rewrite_row_identity_fields(
    row: dict[str, Any],
    overlay: dict[str, str],
    *,
    artifact: str,
    logical_index: dict[str, str] | None = None,
) -> tuple[dict[str, Any], int]:
    """Rewrite identity-bearing fields for one row; return (row, change_count)."""
    new_row = deepcopy(row)
    changed = [0]
    specs = [s for s in IDENTITY_FIELD_SPECS if s.artifact == artifact and s.audit == REWRITTEN]
    # Capture list fields for multiplicity check (top-level lists only).
    before_lists: list[tuple[str, list[str]]] = []
    for spec in specs:
        if spec.kind == "list" and "*" not in spec.path and len(spec.path) == 1:
            key = spec.path[0]
            vals = row.get(key)
            if isinstance(vals, list):
                before_lists.append((key, [str(v) for v in vals]))
        _remap_at_path(new_row, spec.path, overlay, changed)
    if logical_index is not None:
        for key, before in before_lists:
            after_vals = new_row.get(key)
            if isinstance(after_vals, list):
                assert_logical_multiplicity_preserved(
                    before,
                    [str(v) for v in after_vals],
                    logical_index,
                    context=f"{artifact}.{key}",
                    overlay=overlay,
                )
    return new_row, changed[0]


def rewrite_table(
    rows: list[dict[str, Any]],
    overlay: dict[str, str],
    *,
    artifact: str,
    logical_index: dict[str, str] | None = None,
) -> tuple[list[dict[str, Any]], int]:
    rewritten: list[dict[str, Any]] = []
    total = 0
    for row in rows:
        new_row, n = rewrite_row_identity_fields(
            row, overlay, artifact=artifact, logical_index=logical_index
        )
        total += n
        rewritten.append(new_row)
    return rewritten, total
