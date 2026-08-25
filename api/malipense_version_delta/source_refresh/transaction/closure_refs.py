"""Full identity-bearing reference closure on staged candidate."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from malipense_version_delta.compare import load_jsonl_records

from ..paths import SourceRefreshPaths
from ..transition.id_remap import apply_overlay_to_ir_list
from .model import (
    DEST_ALIASES,
    DEST_CURRENT_IR,
    DEST_LEGACY_IR,
    DEST_LOGICAL,
    DEST_SUPPLEMENTS,
    DEST_TARGET_VARIANTS,
)


def _collect_refs_from_tables(staging_root: Path) -> list[dict[str, Any]]:
    refs: list[dict[str, Any]] = []

    def add(artifact: str, artifact_id: str, field: str, ir_id: str) -> None:
        if ir_id:
            refs.append(
                {
                    "artifact_type": artifact,
                    "artifact_id": artifact_id,
                    "field": field,
                    "ir_id": ir_id,
                }
            )

    aliases = staging_root / DEST_ALIASES
    if aliases.is_file():
        for row in load_jsonl_records(aliases):
            aid = str(row.get("alias_id") or "")
            for ir in row.get("resolved_ir_ids") or []:
                add("source_alias", aid, "resolved_ir_ids", str(ir))
            for ir in row.get("evidence_ir_ids") or []:
                add("source_alias", aid, "evidence_ir_ids", str(ir))
    supplements = staging_root / DEST_SUPPLEMENTS
    if supplements.is_file():
        for row in load_jsonl_records(supplements):
            sid = str(row.get("supplement_id") or "")
            for ir in row.get("target_ir_ids") or []:
                add("source_index_supplement", sid, "target_ir_ids", str(ir))
            for ir in row.get("supporting_evidence_ir_ids") or []:
                add(
                    "source_index_supplement",
                    sid,
                    "supporting_evidence_ir_ids",
                    str(ir),
                )
            for note in row.get("target_notes") or []:
                if isinstance(note, dict) and note.get("target_ir_id"):
                    add(
                        "source_index_supplement",
                        sid,
                        "target_notes.target_ir_id",
                        str(note["target_ir_id"]),
                    )
    tvars = staging_root / DEST_TARGET_VARIANTS
    if tvars.is_file():
        for row in load_jsonl_records(tvars):
            add(
                "reviewed_target_variant",
                str(row.get("variant_id") or ""),
                "canonical_ir_id",
                str(row.get("canonical_ir_id") or ""),
            )
    return refs


def evaluate_reference_closure(
    paths: SourceRefreshPaths,
    *,
    staging_root: Path,
    overlay: dict[str, str],
) -> dict[str, Any]:
    """
    Audit the complete staged identity-bearing surface.

    Staged tables already carry projected current-edition ir_ids. A reference
    resolves if the (optionally overlay-mapped) ir_id exists in current,
    legacy-retained, owner, or index IR.
    """
    current_ids = {
        str(r.get("ir_id"))
        for r in load_jsonl_records(staging_root / DEST_CURRENT_IR)
        if r.get("ir_id")
    }
    legacy_ids = {
        str(r.get("ir_id"))
        for r in load_jsonl_records(staging_root / DEST_LEGACY_IR)
        if r.get("ir_id")
    }
    owner_ids = (
        {
            str(r.get("ir_id"))
            for r in load_jsonl_records(paths.owner_ir)
            if r.get("ir_id")
        }
        if paths.owner_ir.is_file()
        else set()
    )
    # Index IR in staging is rewritten; also allow tracked owner-independent index ids
    staged_index = staging_root / "data/ir/malipense_index_v1.jsonl"
    index_ids = (
        {
            str(r.get("ir_id"))
            for r in load_jsonl_records(staged_index)
            if r.get("ir_id")
        }
        if staged_index.is_file()
        else set()
    )

    logical_rows = load_jsonl_records(staging_root / DEST_LOGICAL)
    logical_by_edition: dict[str, str] = {}
    for obj in logical_rows:
        lid = str(obj.get("logical_lexical_id") or "")
        for ir in obj.get("baseline_ir_ids") or []:
            logical_by_edition[str(ir)] = lid
        for ir in obj.get("current_ir_ids") or []:
            logical_by_edition[str(ir)] = lid

    refs = _collect_refs_from_tables(staging_root)
    resolved = 0
    ambiguous = 0
    broken = 0
    through_logical = 0
    runtime_ok = 0
    not_bound = 0
    details_broken: list[dict[str, Any]] = []

    for ref in refs:
        ir_id = ref["ir_id"]
        projected = apply_overlay_to_ir_list([ir_id], overlay)[0]
        if ir_id in logical_by_edition or projected in logical_by_edition:
            through_logical += 1

        if (
            projected in current_ids
            or projected in legacy_ids
            or projected in owner_ids
            or projected in index_ids
            or ir_id in owner_ids
            or ir_id in index_ids
        ):
            resolved += 1
            runtime_ok += 1
            continue

        # Generated supplement mapping ids (ff…) and other runtime-only ids are
        # not lexicon assertions; treat as not-identity-bound if never in layers.
        if projected.startswith("ff") or ir_id.startswith("ff"):
            not_bound += 1
            resolved += 1
            continue

        # Unknown non-Malidaba ids that were never in baseline are not broken
        # continuity failures for this transaction surface.
        if ir_id not in overlay and projected not in current_ids:
            # Still count as broken if the staged table claims a missing Malidaba id
            broken += 1
            if len(details_broken) < 40:
                details_broken.append({**ref, "projected": projected})
            continue

        ambiguous += 1

    return {
        "total": len(refs),
        "resolved": resolved,
        "through_logical_continuity": through_logical,
        "runtime_projections_resolved": runtime_ok,
        "not_identity_bound": not_bound,
        "ambiguous": ambiguous,
        "broken": broken,
        "broken_samples": details_broken,
        "ok": ambiguous == 0 and broken == 0,
    }
