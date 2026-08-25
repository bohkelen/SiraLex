"""Validation for local Malidaba delta review registry rows."""

from __future__ import annotations

import json
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from corpus_annotations.event_timestamps import parse_event_timestamp

from .export_worksheet import ALLOWED_DECISIONS, ALLOWED_ISSUE_CODES, BATCH_ID
from .review_identity import (
    ALLOWED_REVIEW_METHODS,
    REVIEW_ID_RE,
    SCHEMA_VERSION,
    generate_malidaba_review_id,
    review_scope_key,
)

REQUIRED_FIELDS = (
    "schema_version",
    "review_id",
    "review_subject_id",
    "batch_id",
    "delta_sha256",
    "current_ir_sha256",
    "current_record_fingerprint_sha256",
    "review_decision",
    "reviewer_id",
    "reviewed_at",
    "review_method",
    "issue_codes",
    "review_notes",
)

OPTIONAL_FIELDS = frozenset({"supersedes_review_id"})
ALLOWED_FIELDS = frozenset(REQUIRED_FIELDS) | OPTIONAL_FIELDS


class MalidabaReviewValidationError(ValueError):
    """Raised when a Malidaba delta review row/table is invalid."""


@dataclass
class MalidabaReviewRow:
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
class MalidabaReviewValidationResult:
    rows: list[MalidabaReviewRow] = field(default_factory=list)
    summary: dict[str, Any] = field(default_factory=dict)


def _err(path: Path, line_number: int, message: str) -> MalidabaReviewValidationError:
    return MalidabaReviewValidationError(f"{path}:{line_number}: {message}")


def _require_non_empty_string(
    row: dict[str, Any], key: str, path: Path, line_number: int
) -> str:
    value = row.get(key)
    if not isinstance(value, str) or not value.strip():
        raise _err(path, line_number, f"missing or empty {key}")
    return value.strip()


def find_malidaba_review_leaves(
    rows: list[MalidabaReviewRow] | list[dict[str, Any]],
) -> list[str]:
    """Return review_ids not superseded by any other review (deterministic order).

    Current review ≠ latest reviewed_at. Chronology does not select a winner.
    """
    normalized: list[dict[str, Any]] = []
    for item in rows:
        if isinstance(item, MalidabaReviewRow):
            normalized.append(item.row)
        elif isinstance(item, dict):
            normalized.append(item)
        else:
            raise TypeError("rows must be MalidabaReviewRow or dict objects")

    superseded_targets: set[str] = set()
    for row in normalized:
        target = row.get("supersedes_review_id")
        if isinstance(target, str) and target.strip():
            superseded_targets.add(target.strip())

    leaves = [
        str(row.get("review_id") or "")
        for row in normalized
        if str(row.get("review_id") or "")
        and str(row.get("review_id") or "") not in superseded_targets
    ]
    return sorted(leaves)


def validate_malidaba_review_row(
    row: dict[str, Any],
    *,
    path: Path,
    line_number: int,
) -> MalidabaReviewRow:
    unknown = sorted(set(row) - ALLOWED_FIELDS)
    if unknown:
        raise _err(path, line_number, f"unknown fields: {', '.join(unknown)}")

    for key in REQUIRED_FIELDS:
        if key not in row:
            raise _err(path, line_number, f"missing required field {key}")

    schema = _require_non_empty_string(row, "schema_version", path, line_number)
    if schema != SCHEMA_VERSION:
        raise _err(path, line_number, f"unsupported schema_version {schema!r}")

    review_id = _require_non_empty_string(row, "review_id", path, line_number)
    if not REVIEW_ID_RE.match(review_id):
        raise _err(path, line_number, f"invalid review_id {review_id!r}")

    _require_non_empty_string(row, "review_subject_id", path, line_number)
    batch_id = _require_non_empty_string(row, "batch_id", path, line_number)
    if batch_id != BATCH_ID:
        if not batch_id.startswith("malidaba_new_headword_review_batch_"):
            raise _err(path, line_number, f"unsupported batch_id {batch_id!r}")

    for hash_key in (
        "delta_sha256",
        "current_ir_sha256",
        "current_record_fingerprint_sha256",
    ):
        value = _require_non_empty_string(row, hash_key, path, line_number)
        if len(value) != 64 or any(c not in "0123456789abcdef" for c in value.lower()):
            raise _err(path, line_number, f"invalid {hash_key}")

    decision = _require_non_empty_string(row, "review_decision", path, line_number)
    if decision not in ALLOWED_DECISIONS:
        raise _err(path, line_number, f"invalid review_decision {decision!r}")

    _require_non_empty_string(row, "reviewer_id", path, line_number)
    reviewed_at = _require_non_empty_string(row, "reviewed_at", path, line_number)
    try:
        parse_event_timestamp(reviewed_at, field_name="reviewed_at")
    except ValueError as exc:
        raise _err(path, line_number, str(exc)) from exc

    method = _require_non_empty_string(row, "review_method", path, line_number)
    if method not in ALLOWED_REVIEW_METHODS:
        raise _err(path, line_number, f"invalid review_method {method!r}")

    issue_codes = row.get("issue_codes")
    if not isinstance(issue_codes, list):
        raise _err(path, line_number, "issue_codes must be a list")
    for code in issue_codes:
        if not isinstance(code, str) or code not in ALLOWED_ISSUE_CODES:
            raise _err(path, line_number, f"invalid issue_codes entry {code!r}")

    notes = row.get("review_notes")
    if notes is None:
        raise _err(path, line_number, "missing review_notes")
    if not isinstance(notes, str):
        raise _err(path, line_number, "review_notes must be a string")

    if "supersedes_review_id" in row:
        supersedes = _require_non_empty_string(
            row, "supersedes_review_id", path, line_number
        )
        if not REVIEW_ID_RE.match(supersedes):
            raise _err(path, line_number, f"invalid supersedes_review_id {supersedes!r}")
        if supersedes == review_id:
            raise _err(path, line_number, "self-supersession is not allowed")

    expected_id = generate_malidaba_review_id(row)
    if review_id != expected_id:
        raise _err(
            path,
            line_number,
            f"review_id {review_id!r} does not match deterministic identity "
            f"(expected {expected_id!r})",
        )

    return MalidabaReviewRow(row=dict(row), path=path, line_number=line_number)


def _detect_review_supersession_cycle(
    rows_by_id: dict[str, MalidabaReviewRow],
    path: Path,
) -> None:
    visiting: set[str] = set()
    visited: set[str] = set()

    def visit(node_id: str, stack: list[str]) -> None:
        if node_id in visited:
            return
        if node_id in visiting:
            cycle = " -> ".join(stack[stack.index(node_id) :] + [node_id])
            raise MalidabaReviewValidationError(
                f"{path}: review supersession cycle detected: {cycle}"
            )
        visiting.add(node_id)
        row = rows_by_id.get(node_id)
        if row is not None:
            superseded_id = row.row.get("supersedes_review_id")
            if isinstance(superseded_id, str) and superseded_id:
                visit(superseded_id, stack + [node_id])
        visiting.remove(node_id)
        visited.add(node_id)

    for review_id in rows_by_id:
        visit(review_id, [])


def _validate_same_reviewer_linear_histories(
    rows_by_id: dict[str, MalidabaReviewRow],
    *,
    path: Path,
) -> dict[str, Any]:
    """Require one linear history (one root, one leaf) per reviewer/scope."""
    by_scope: dict[tuple[str, str, str, str, str], list[MalidabaReviewRow]] = defaultdict(
        list
    )
    for item in rows_by_id.values():
        by_scope[review_scope_key(item.row)].append(item)

    leaf_ids = set(find_malidaba_review_leaves(list(rows_by_id.values())))
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
            raise MalidabaReviewValidationError(
                f"{path}: same-reviewer branching rejected for scope "
                f"{scope!r}: expected exactly one root review, found {len(roots)}"
            )

        for parent_id, children in children_of.items():
            if parent_id not in ids:
                # Target may be validated elsewhere as unknown; skip here.
                continue
            if len(children) > 1:
                raise MalidabaReviewValidationError(
                    f"{path}: same-reviewer branching rejected: multiple reviews "
                    f"supersede {parent_id!r}: {sorted(children)}"
                )

        scope_leaves = sorted(rid for rid in ids if rid in leaf_ids)
        if len(scope_leaves) != 1:
            raise MalidabaReviewValidationError(
                f"{path}: same-reviewer branching rejected for scope "
                f"{scope!r}: expected exactly one current leaf, found "
                f"{len(scope_leaves)} ({scope_leaves})"
            )

    return {
        "current_leaf_count": len(leaf_ids),
        "review_history_count": history_count,
        "current_leaf_review_ids": sorted(leaf_ids),
    }


def validate_malidaba_review_table(
    rows: list[dict[str, Any]],
    *,
    path: Path,
) -> MalidabaReviewValidationResult:
    validated: list[MalidabaReviewRow] = []
    seen_ids: set[str] = set()
    rows_by_id: dict[str, MalidabaReviewRow] = {}

    for index, row in enumerate(rows, start=1):
        item = validate_malidaba_review_row(row, path=path, line_number=index)
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
                path,
                item.line_number,
                f"unknown supersedes_review_id {superseded_id!r}",
            )
        if superseded.review_subject_id != item.review_subject_id:
            raise _err(
                path,
                item.line_number,
                "supersedes_review_id must reference the same review_subject_id "
                f"(target {superseded_id!r} has subject "
                f"{superseded.review_subject_id!r})",
            )
        if superseded.reviewer_id != item.reviewer_id:
            raise _err(
                path,
                item.line_number,
                "supersedes_review_id must reference the same reviewer_id "
                f"(target {superseded_id!r} has reviewer {superseded.reviewer_id!r})",
            )
        for key in (
            "delta_sha256",
            "current_ir_sha256",
            "current_record_fingerprint_sha256",
        ):
            if str(superseded.row.get(key) or "") != str(item.row.get(key) or ""):
                raise _err(
                    path,
                    item.line_number,
                    f"supersedes_review_id must reference the same {key} "
                    f"(target {superseded_id!r})",
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
                "superseding review reviewed_at must be >= superseded "
                f"reviewed_at ({superseded_id!r})",
            )

    _detect_review_supersession_cycle(rows_by_id, path)
    leaf_summary = _validate_same_reviewer_linear_histories(rows_by_id, path=path)

    decision_counts: dict[str, int] = {}
    leaf_decision_counts: dict[str, int] = {}
    leaf_ids = set(leaf_summary["current_leaf_review_ids"])
    for item in validated:
        decision = str(item.row.get("review_decision", ""))
        decision_counts[decision] = decision_counts.get(decision, 0) + 1
        if item.review_id in leaf_ids:
            leaf_decision_counts[decision] = leaf_decision_counts.get(decision, 0) + 1

    return MalidabaReviewValidationResult(
        rows=validated,
        summary={
            "row_count": len(validated),
            "decision_counts": decision_counts,
            "current_leaf_decision_counts": leaf_decision_counts,
            "schema_version": SCHEMA_VERSION,
            **leaf_summary,
        },
    )


def validate_malidaba_reviews(path: Path) -> MalidabaReviewValidationResult:
    if not path.is_file():
        raise MalidabaReviewValidationError(f"missing review registry: {path}")
    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            text = line.strip()
            if not text:
                continue
            try:
                rows.append(json.loads(text))
            except json.JSONDecodeError as exc:
                raise _err(path, line_number, f"invalid JSON: {exc}") from exc
    return validate_malidaba_review_table(rows, path=path)
