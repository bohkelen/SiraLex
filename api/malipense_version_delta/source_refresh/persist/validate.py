"""Validation for F18 Type-A / Type-B review registries."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from corpus_annotations.event_timestamps import parse_event_timestamp

from malipense_version_delta.compare import load_jsonl_records

from .identity import (
    ALLOWED_REVIEW_METHODS,
    TYPE_A_ID_RE,
    TYPE_A_SCHEMA,
    TYPE_B_ID_RE,
    TYPE_B_SCHEMA,
    generate_review_id,
    review_scope_key,
)

TYPE_A_DECISIONS = frozenset(
    {"confirmed_continuity", "legacy_only", "needs_more_evidence"}
)
TYPE_B_DECISIONS = frozenset(
    {
        "retain_baseline_record",
        "current_equivalent_confirmed",
        "accept_source_removal",
        "needs_more_evidence",
    }
)


class TransitionReviewValidationError(ValueError):
    """Raised when an F18 transition review registry is invalid."""


@dataclass
class TransitionReviewRow:
    row: dict[str, Any]
    path: Path
    line_number: int

    @property
    def review_id(self) -> str:
        return str(self.row.get("review_id", ""))

    @property
    def review_subject_id(self) -> str:
        return str(self.row.get("review_subject_id", ""))

    @property
    def reviewer_id(self) -> str:
        return str(self.row.get("reviewer_id", ""))


@dataclass
class TransitionReviewValidationResult:
    rows: list[TransitionReviewRow] = field(default_factory=list)
    summary: dict[str, Any] = field(default_factory=dict)


def find_review_leaves(
    rows: list[TransitionReviewRow] | list[dict[str, Any]],
) -> list[str]:
    normalized: list[dict[str, Any]] = []
    for item in rows:
        if isinstance(item, TransitionReviewRow):
            normalized.append(item.row)
        elif isinstance(item, dict):
            normalized.append(item)
        else:
            raise TypeError("rows must be TransitionReviewRow or dict")
    superseded: set[str] = set()
    for row in normalized:
        target = row.get("supersedes_review_id")
        if isinstance(target, str) and target.strip():
            superseded.add(target.strip())
    leaves = [
        str(row.get("review_id") or "")
        for row in normalized
        if str(row.get("review_id") or "")
        and str(row.get("review_id") or "") not in superseded
    ]
    return sorted(leaves)


def _err(path: Path, line_number: int, message: str) -> TransitionReviewValidationError:
    return TransitionReviewValidationError(f"{path}:{line_number}: {message}")


def _require_str(row: dict[str, Any], key: str, path: Path, line_number: int) -> str:
    value = row.get(key)
    if not isinstance(value, str) or not value.strip():
        raise _err(path, line_number, f"missing or empty {key}")
    return value.strip()


def _validate_common_row(
    row: dict[str, Any],
    *,
    path: Path,
    line_number: int,
    schema_version: str,
    allowed_decisions: frozenset[str],
    id_re,
) -> TransitionReviewRow:
    schema = _require_str(row, "schema_version", path, line_number)
    if schema != schema_version:
        raise _err(path, line_number, f"unexpected schema_version {schema!r}")
    review_id = _require_str(row, "review_id", path, line_number)
    if not id_re.match(review_id):
        raise _err(path, line_number, f"invalid review_id {review_id!r}")
    expected_id = generate_review_id(row, schema_version=schema_version)
    if review_id != expected_id:
        raise _err(
            path,
            line_number,
            f"review_id mismatch: expected {expected_id!r}, got {review_id!r}",
        )
    _require_str(row, "review_subject_id", path, line_number)
    _require_str(row, "batch_id", path, line_number)
    _require_str(row, "frozen_acceptance_sha256", path, line_number)
    decision = _require_str(row, "review_decision", path, line_number)
    if decision not in allowed_decisions:
        raise _err(path, line_number, f"invalid review_decision {decision!r}")
    _require_str(row, "reviewer_id", path, line_number)
    reviewed_at = _require_str(row, "reviewed_at", path, line_number)
    parse_event_timestamp(reviewed_at, field_name="reviewed_at")
    method = _require_str(row, "review_method", path, line_number)
    if method not in ALLOWED_REVIEW_METHODS:
        raise _err(path, line_number, f"invalid review_method {method!r}")
    if not isinstance(row.get("issue_codes"), list):
        raise _err(path, line_number, "issue_codes must be a list")
    if not isinstance(row.get("review_notes"), str):
        raise _err(path, line_number, "review_notes must be a string")
    if "supersedes_review_id" in row:
        sup = row.get("supersedes_review_id")
        if not isinstance(sup, str) or not sup.strip():
            raise _err(path, line_number, "invalid supersedes_review_id")
        if sup.strip() == review_id:
            raise _err(path, line_number, "review cannot supersede itself")
    return TransitionReviewRow(row=row, path=path, line_number=line_number)


def validate_type_a_row(
    row: dict[str, Any], *, path: Path, line_number: int
) -> TransitionReviewRow:
    item = _validate_common_row(
        row,
        path=path,
        line_number=line_number,
        schema_version=TYPE_A_SCHEMA,
        allowed_decisions=TYPE_A_DECISIONS,
        id_re=TYPE_A_ID_RE,
    )
    _require_str(row, "baseline_ir_id", path, line_number)
    _require_str(row, "continuity_subject_fingerprint", path, line_number)
    selected = row.get("selected_current_ir_ids")
    if not isinstance(selected, list):
        raise _err(path, line_number, "selected_current_ir_ids must be a list")
    decision = row["review_decision"]
    if decision == "confirmed_continuity" and not selected:
        raise _err(path, line_number, "confirmed_continuity requires selected_current_ir_ids")
    if decision != "confirmed_continuity" and selected:
        raise _err(path, line_number, f"{decision} requires empty selected_current_ir_ids")
    return item


def validate_type_b_row(
    row: dict[str, Any], *, path: Path, line_number: int
) -> TransitionReviewRow:
    item = _validate_common_row(
        row,
        path=path,
        line_number=line_number,
        schema_version=TYPE_B_SCHEMA,
        allowed_decisions=TYPE_B_DECISIONS,
        id_re=TYPE_B_ID_RE,
    )
    _require_str(row, "baseline_ir_id", path, line_number)
    _require_str(row, "subject_fingerprint", path, line_number)
    selected = str(row.get("selected_current_ir_id") or "")
    decision = row["review_decision"]
    if decision == "current_equivalent_confirmed" and not selected:
        raise _err(
            path, line_number, "current_equivalent_confirmed requires selected_current_ir_id"
        )
    if decision != "current_equivalent_confirmed" and selected:
        raise _err(path, line_number, f"{decision} requires blank selected_current_ir_id")
    return item


def _detect_cycle(rows_by_id: dict[str, TransitionReviewRow], path: Path) -> None:
    visiting: set[str] = set()
    visited: set[str] = set()

    def visit(node_id: str, stack: list[str]) -> None:
        if node_id in visited:
            return
        if node_id in visiting:
            cycle = " -> ".join(stack[stack.index(node_id) :] + [node_id])
            raise TransitionReviewValidationError(
                f"{path}: review supersession cycle detected: {cycle}"
            )
        visiting.add(node_id)
        row = rows_by_id.get(node_id)
        if row is not None:
            target = row.row.get("supersedes_review_id")
            if isinstance(target, str) and target:
                visit(target, stack + [node_id])
        visiting.remove(node_id)
        visited.add(node_id)

    for review_id in rows_by_id:
        visit(review_id, [])


def _validate_linear_histories(
    rows_by_id: dict[str, TransitionReviewRow], *, path: Path
) -> dict[str, Any]:
    by_scope: dict[tuple[str, str, str, str], list[TransitionReviewRow]] = defaultdict(
        list
    )
    for item in rows_by_id.values():
        by_scope[review_scope_key(item.row)].append(item)
    leaf_ids = set(find_review_leaves(list(rows_by_id.values())))
    history_count = 0
    for scope, items in by_scope.items():
        history_count += 1
        ids = {item.review_id for item in items}
        children_of: dict[str, list[str]] = defaultdict(list)
        roots: list[str] = []
        for item in items:
            target = item.row.get("supersedes_review_id")
            if isinstance(target, str) and target.strip():
                children_of[target.strip()].append(item.review_id)
            else:
                roots.append(item.review_id)
        if len(roots) != 1:
            raise TransitionReviewValidationError(
                f"{path}: same-reviewer branching rejected for scope {scope!r}: "
                f"expected exactly one root, found {len(roots)}"
            )
        for parent_id, children in children_of.items():
            if parent_id not in ids:
                continue
            if len(children) > 1:
                raise TransitionReviewValidationError(
                    f"{path}: same-reviewer branching rejected: multiple reviews "
                    f"supersede {parent_id!r}: {sorted(children)}"
                )
        scope_leaves = sorted(rid for rid in ids if rid in leaf_ids)
        if len(scope_leaves) != 1:
            raise TransitionReviewValidationError(
                f"{path}: same-reviewer branching rejected for scope {scope!r}: "
                f"expected exactly one current leaf, found {len(scope_leaves)}"
            )
    return {
        "current_leaf_count": len(leaf_ids),
        "review_history_count": history_count,
        "current_leaf_review_ids": sorted(leaf_ids),
    }


def validate_review_table(
    rows: list[dict[str, Any]],
    *,
    path: Path,
    kind: str,
) -> TransitionReviewValidationResult:
    row_fn = validate_type_a_row if kind == "type_a" else validate_type_b_row
    validated: list[TransitionReviewRow] = []
    seen_ids: set[str] = set()
    rows_by_id: dict[str, TransitionReviewRow] = {}
    for index, row in enumerate(rows, start=1):
        item = row_fn(row, path=path, line_number=index)
        if item.review_id in seen_ids:
            raise _err(path, index, f"duplicate review_id {item.review_id!r}")
        seen_ids.add(item.review_id)
        rows_by_id[item.review_id] = item
        validated.append(item)

    for item in validated:
        superseded_id = item.row.get("supersedes_review_id")
        if not isinstance(superseded_id, str) or not superseded_id:
            continue
        superseded = rows_by_id.get(superseded_id)
        if superseded is None:
            raise _err(
                path, item.line_number, f"unknown supersedes_review_id {superseded_id!r}"
            )
        if superseded.review_subject_id != item.review_subject_id:
            raise _err(
                path,
                item.line_number,
                "supersedes_review_id must reference the same review_subject_id",
            )
        if superseded.reviewer_id != item.reviewer_id:
            raise _err(
                path,
                item.line_number,
                "supersedes_review_id must reference the same reviewer_id",
            )
        for key in ("frozen_acceptance_sha256",):
            if str(superseded.row.get(key) or "") != str(item.row.get(key) or ""):
                raise _err(
                    path,
                    item.line_number,
                    f"supersedes_review_id must reference the same {key}",
                )
        fp_keys = (
            ("continuity_subject_fingerprint",)
            if kind == "type_a"
            else ("subject_fingerprint",)
        )
        for key in fp_keys:
            if str(superseded.row.get(key) or "") != str(item.row.get(key) or ""):
                raise _err(
                    path,
                    item.line_number,
                    f"supersedes_review_id must reference the same {key}",
                )
        item_reviewed = parse_event_timestamp(
            str(item.row["reviewed_at"]), field_name="reviewed_at"
        )
        superseded_reviewed = parse_event_timestamp(
            str(superseded.row["reviewed_at"]), field_name="reviewed_at"
        )
        if item_reviewed < superseded_reviewed:
            raise _err(
                path,
                item.line_number,
                "revision reviewed_at must not precede superseded reviewed_at",
            )

    _detect_cycle(rows_by_id, path)
    history = _validate_linear_histories(rows_by_id, path=path)
    counts: dict[str, int] = {}
    leaf_ids = set(history["current_leaf_review_ids"])
    leaf_decisions: dict[str, int] = {}
    for item in validated:
        d = str(item.row.get("review_decision") or "")
        counts[d] = counts.get(d, 0) + 1
        if item.review_id in leaf_ids:
            leaf_decisions[d] = leaf_decisions.get(d, 0) + 1
    return TransitionReviewValidationResult(
        rows=validated,
        summary={
            "row_count": len(validated),
            "decision_counts": counts,
            "current_leaf_decision_counts": leaf_decisions,
            **history,
        },
    )


def validate_review_file(path: Path, *, kind: str) -> TransitionReviewValidationResult:
    if not path.is_file():
        return TransitionReviewValidationResult(summary={"row_count": 0})
    rows = load_jsonl_records(path)
    return validate_review_table(rows, path=path, kind=kind)
