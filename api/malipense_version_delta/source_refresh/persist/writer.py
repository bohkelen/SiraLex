"""Governed atomic persistence for F18 transition review registries."""

from __future__ import annotations

import json
import os
import tempfile
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from malipense_version_delta.canonical_json import canonical_dumps, sha256_file

from .identity import review_scope_key
from .validate import (
    TransitionReviewValidationError,
    find_review_leaves,
    validate_review_file,
    validate_review_table,
    validate_type_a_row,
    validate_type_b_row,
)


class TransitionReviewWriteError(ValueError):
    """Raised when governed F18 review persistence cannot proceed."""


@dataclass
class TransitionReviewWritePlan:
    existing_rows: list[dict[str, Any]] = field(default_factory=list)
    candidate_rows: list[dict[str, Any]] = field(default_factory=list)
    new_rows: list[dict[str, Any]] = field(default_factory=list)
    already_present_identical: list[dict[str, Any]] = field(default_factory=list)
    merged_rows: list[dict[str, Any]] = field(default_factory=list)
    receipt: dict[str, Any] = field(default_factory=dict)
    applied: bool = False


def rows_to_jsonl_text(rows: list[dict[str, Any]]) -> str:
    lines = [canonical_dumps(row) for row in rows]
    return ("\n".join(lines) + "\n") if lines else ""


def _decision_counts(rows: list[dict[str, Any]]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for row in rows:
        decision = str(row.get("review_decision", ""))
        counts[decision] = counts.get(decision, 0) + 1
    return counts


def _load_existing(output_path: Path, *, kind: str) -> list[dict[str, Any]]:
    if not output_path.exists():
        return []
    try:
        result = validate_review_file(output_path, kind=kind)
    except TransitionReviewValidationError as exc:
        raise TransitionReviewWriteError(
            f"existing review registry is invalid ({output_path}): {exc}"
        ) from exc
    return [dict(item.row) for item in result.rows]


def plan_review_write(
    *,
    kind: str,
    schema_version: str,
    worksheet_path: Path,
    output_path: Path,
    candidate_rows: list[dict[str, Any]],
) -> TransitionReviewWritePlan:
    if not candidate_rows:
        raise TransitionReviewWriteError("zero candidate review rows")
    row_fn = validate_type_a_row if kind == "type_a" else validate_type_b_row
    try:
        for index, row in enumerate(candidate_rows, start=1):
            row_fn(row, path=worksheet_path, line_number=index)
    except TransitionReviewValidationError as exc:
        raise TransitionReviewWriteError(
            f"candidate review table validation failed: {exc}"
        ) from exc

    existing_rows = _load_existing(output_path, kind=kind)
    existing_by_id = {str(row["review_id"]): row for row in existing_rows}
    existing_leaf_ids = set(find_review_leaves(existing_rows))
    leaf_by_scope: dict[tuple[str, str, str, str], str] = {}
    for row in existing_rows:
        if str(row["review_id"]) in existing_leaf_ids:
            leaf_by_scope[review_scope_key(row)] = str(row["review_id"])

    new_rows: list[dict[str, Any]] = []
    already_present: list[dict[str, Any]] = []
    for candidate in candidate_rows:
        review_id = str(candidate["review_id"])
        existing = existing_by_id.get(review_id)
        if existing is None:
            scope = review_scope_key(candidate)
            current_leaf = leaf_by_scope.get(scope)
            supersedes = candidate.get("supersedes_review_id")
            has_supersedes = isinstance(supersedes, str) and bool(str(supersedes).strip())
            if current_leaf is not None and not has_supersedes:
                raise TransitionReviewWriteError(
                    "same-reviewer silent duplicate rejected for "
                    f"review_subject_id={candidate.get('review_subject_id')!r}: "
                    f"current leaf {current_leaf!r} exists; new candidate "
                    f"{review_id!r} must explicitly set supersedes_review_id"
                )
            if current_leaf is not None and has_supersedes:
                if str(supersedes).strip() != current_leaf:
                    raise TransitionReviewWriteError(
                        "same-reviewer revision must supersede the current leaf "
                        f"{current_leaf!r} (got {supersedes!r})"
                    )
            new_rows.append(candidate)
            continue
        if canonical_dumps(existing) == canonical_dumps(candidate):
            already_present.append(candidate)
            continue
        raise TransitionReviewWriteError(
            f"review_id conflict for {review_id!r}: existing registry row differs "
            "from candidate (immutable reviews cannot be overwritten)"
        )

    merged_by_id = {str(row["review_id"]): row for row in existing_rows}
    for row in new_rows:
        merged_by_id[str(row["review_id"])] = row
    merged_rows = [merged_by_id[key] for key in sorted(merged_by_id)]

    try:
        merged_validation = validate_review_table(
            merged_rows, path=output_path, kind=kind
        )
    except TransitionReviewValidationError as exc:
        raise TransitionReviewWriteError(
            f"merged review table validation failed: {exc}"
        ) from exc

    persisted_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    receipt = {
        "schema_version": f"{schema_version}_persistence_receipt",
        "kind": kind,
        "registry_path": str(output_path),
        "worksheet_path": str(worksheet_path),
        "persisted_at": persisted_at,
        "applied": False,
        "rows_before": len(existing_rows),
        "candidate_rows": len(candidate_rows),
        "new_rows_written": len(new_rows),
        "already_present_identical": len(already_present),
        "rows_after": len(merged_rows),
        "current_leaf_count": merged_validation.summary.get("current_leaf_count"),
        "decision_counts": _decision_counts(candidate_rows),
        "current_leaf_decision_counts": merged_validation.summary.get(
            "current_leaf_decision_counts"
        ),
        "worksheet_sha256": sha256_file(worksheet_path),
        "registry_sha256_before": (
            sha256_file(output_path) if output_path.exists() else None
        ),
        "registry_sha256_after": None,
        "new_review_ids": sorted(str(row["review_id"]) for row in new_rows),
        "already_present_review_ids": sorted(
            str(row["review_id"]) for row in already_present
        ),
        "review_schema_version": schema_version,
    }
    return TransitionReviewWritePlan(
        existing_rows=existing_rows,
        candidate_rows=list(candidate_rows),
        new_rows=new_rows,
        already_present_identical=already_present,
        merged_rows=merged_rows,
        receipt=receipt,
        applied=False,
    )


def _atomic_write_jsonl(
    path: Path,
    rows: list[dict[str, Any]],
    *,
    kind: str,
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = rows_to_jsonl_text(rows)
    fd, temp_name = tempfile.mkstemp(
        prefix=f".{path.name}.",
        suffix=".tmp",
        dir=str(path.parent),
    )
    temp_path = Path(temp_name)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(text)
            handle.flush()
            os.fsync(handle.fileno())
        on_disk = temp_path.read_text(encoding="utf-8")
        if on_disk != text:
            raise TransitionReviewWriteError(
                f"temporary review registry bytes mismatch before replace ({temp_path})"
            )
        try:
            validate_review_file(temp_path, kind=kind)
        except TransitionReviewValidationError as exc:
            raise TransitionReviewWriteError(
                f"temporary review registry failed on-disk validation "
                f"before replace ({temp_path}): {exc}"
            ) from exc
        os.replace(temp_path, path)
        try:
            dir_fd = os.open(str(path.parent), os.O_RDONLY)
            try:
                os.fsync(dir_fd)
            finally:
                os.close(dir_fd)
        except OSError:
            pass
    except Exception:
        if temp_path.exists():
            temp_path.unlink(missing_ok=True)
        raise


def apply_review_write(
    plan: TransitionReviewWritePlan,
    *,
    output_path: Path,
    kind: str,
    receipt_path: Path | None = None,
) -> TransitionReviewWritePlan:
    _atomic_write_jsonl(output_path, plan.merged_rows, kind=kind)
    try:
        post = validate_review_file(output_path, kind=kind)
    except TransitionReviewValidationError as exc:
        raise TransitionReviewWriteError(
            f"post-write review registry validation failed ({output_path}): {exc}"
        ) from exc
    if post.summary.get("row_count") != len(plan.merged_rows):
        raise TransitionReviewWriteError(
            "post-write row_count mismatch: "
            f"expected {len(plan.merged_rows)}, got {post.summary.get('row_count')}"
        )
    plan.applied = True
    plan.receipt["applied"] = True
    plan.receipt["registry_sha256_after"] = sha256_file(output_path)
    plan.receipt["new_rows_written"] = len(plan.new_rows)
    plan.receipt["rows_after"] = len(plan.merged_rows)
    if receipt_path is not None:
        receipt_path.parent.mkdir(parents=True, exist_ok=True)
        receipt_path.write_text(
            json.dumps(plan.receipt, indent=2, sort_keys=True, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
    return plan
