"""Supersession and same-target conflict handling."""

from __future__ import annotations

from collections import defaultdict

from .models import CorrectionRecord, Rejection
from .patching import parse_pointer


def apply_supersession_filter(
    approved_records: list[CorrectionRecord],
) -> tuple[list[CorrectionRecord], list[Rejection]]:
    by_id = {record.correction_id: record for record in approved_records}
    superseded_ids: set[str] = set()

    for record in approved_records:
        supersedes = (
            record.raw.get("provenance", {})
            .get("audit", {})
            .get("supersedes_correction_id")
        )
        if not isinstance(supersedes, str) or not supersedes:
            continue
        if supersedes in by_id and supersedes != record.correction_id:
            superseded_ids.add(supersedes)

    kept: list[CorrectionRecord] = []
    rejections: list[Rejection] = []
    for record in approved_records:
        if record.correction_id in superseded_ids:
            rejections.append(
                Rejection(
                    correction_id=record.correction_id,
                    target_ir_id=record.target_ir_id,
                    reason_code="superseded_by_newer_correction",
                    detail="excluded by supersession reference from another approved correction",
                )
            )
            continue
        kept.append(record)

    return kept, rejections


def _paths_overlap(path_a: str, path_b: str) -> bool:
    tokens_a = parse_pointer(path_a)
    tokens_b = parse_pointer(path_b)
    min_len = min(len(tokens_a), len(tokens_b))
    if tokens_a[:min_len] == tokens_b[:min_len]:
        return True
    return False


def _is_array_shift_risk_op(op: dict) -> bool:
    op_name = op.get("op")
    if op_name not in {"add", "remove"}:
        return False
    path = op.get("path")
    if not isinstance(path, str):
        return False
    tokens = parse_pointer(path)
    return any(token == "-" or token.isdigit() for token in tokens)


def apply_same_target_conflict_policy(
    records: list[CorrectionRecord],
) -> tuple[list[CorrectionRecord], list[Rejection]]:
    grouped: dict[str, list[CorrectionRecord]] = defaultdict(list)
    for record in records:
        grouped[record.target_ir_id].append(record)

    kept: list[CorrectionRecord] = []
    rejections: list[Rejection] = []

    for target_ir_id in sorted(grouped.keys()):
        group = sorted(grouped[target_ir_id], key=lambda rec: rec.correction_id)
        if len(group) == 1:
            kept.append(group[0])
            continue

        if any(_is_array_shift_risk_op(op) for rec in group for op in rec.patch):
            for record in group:
                rejections.append(
                    Rejection(
                        correction_id=record.correction_id,
                        target_ir_id=record.target_ir_id,
                        reason_code="conflict_same_target_array_shift_risk",
                        detail="same-target group contains add/remove on array-indexed path",
                    )
                )
            continue

        all_paths = [str(op.get("path", "")) for rec in group for op in rec.patch]
        has_overlap = False
        for i in range(len(all_paths)):
            for j in range(i + 1, len(all_paths)):
                if _paths_overlap(all_paths[i], all_paths[j]):
                    has_overlap = True
                    break
            if has_overlap:
                break

        if has_overlap:
            for record in group:
                rejections.append(
                    Rejection(
                        correction_id=record.correction_id,
                        target_ir_id=record.target_ir_id,
                        reason_code="conflict_same_target_overlapping_paths",
                        detail="same-target group has overlapping JSON pointer paths",
                    )
                )
            continue

        kept.extend(group)

    return kept, rejections

