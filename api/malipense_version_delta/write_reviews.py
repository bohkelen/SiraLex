"""Governed persistence of Malidaba delta reviews from completed worksheets."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import tempfile
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .dry_run_reviews import MalidabaReviewDryRunError, dry_run_import_review_worksheet
from .review_identity import SCHEMA_VERSION, review_scope_key
from .validate_reviews import (
    MalidabaReviewValidationError,
    find_malidaba_review_leaves,
    validate_malidaba_review_table,
    validate_malidaba_reviews,
)


class MalidabaReviewWriteError(ValueError):
    """Raised when governed Malidaba review persistence cannot proceed."""


@dataclass
class MalidabaReviewWritePlan:
    existing_rows: list[dict[str, Any]] = field(default_factory=list)
    candidate_rows: list[dict[str, Any]] = field(default_factory=list)
    new_rows: list[dict[str, Any]] = field(default_factory=list)
    already_present_identical: list[dict[str, Any]] = field(default_factory=list)
    merged_rows: list[dict[str, Any]] = field(default_factory=list)
    receipt: dict[str, Any] = field(default_factory=dict)
    applied: bool = False


def canonical_review_json(row: dict[str, Any]) -> str:
    return json.dumps(row, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def rows_to_jsonl_text(rows: list[dict[str, Any]]) -> str:
    lines = [canonical_review_json(row) for row in rows]
    return ("\n".join(lines) + "\n") if lines else ""


def _decision_counts(rows: list[dict[str, Any]]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for row in rows:
        decision = str(row.get("review_decision", ""))
        counts[decision] = counts.get(decision, 0) + 1
    return counts


def _load_existing_registry(output_path: Path) -> list[dict[str, Any]]:
    if not output_path.exists():
        return []
    try:
        result = validate_malidaba_reviews(output_path)
    except MalidabaReviewValidationError as exc:
        raise MalidabaReviewWriteError(
            f"existing review registry is invalid ({output_path}): {exc}"
        ) from exc
    return [dict(item.row) for item in result.rows]


def plan_malidaba_review_write(
    worksheet_path: Path,
    *,
    baseline_ir_path: Path,
    current_ir_path: Path,
    delta_path: Path,
    crawl_dir: Path,
    output_path: Path,
    verify_hashes: bool = True,
) -> MalidabaReviewWritePlan:
    try:
        dry_run = dry_run_import_review_worksheet(
            worksheet_path,
            baseline_ir_path=baseline_ir_path,
            current_ir_path=current_ir_path,
            delta_path=delta_path,
            crawl_dir=crawl_dir,
            verify_hashes=verify_hashes,
        )
    except MalidabaReviewDryRunError as exc:
        raise MalidabaReviewWriteError(str(exc)) from exc

    if dry_run.errors:
        raise MalidabaReviewWriteError(
            "worksheet dry-run failed; refusing persistence:\n"
            + "\n".join(dry_run.errors)
        )
    if not dry_run.preview_rows:
        raise MalidabaReviewWriteError(
            "worksheet dry-run produced zero candidate review rows"
        )

    # Validate candidates as a table before merge.
    try:
        validate_malidaba_review_table(
            list(dry_run.preview_rows),
            path=worksheet_path,
        )
    except MalidabaReviewValidationError as exc:
        raise MalidabaReviewWriteError(
            f"candidate review table validation failed: {exc}"
        ) from exc

    existing_rows = _load_existing_registry(output_path)
    existing_by_id = {str(row["review_id"]): row for row in existing_rows}
    existing_leaf_ids = set(find_malidaba_review_leaves(existing_rows))
    leaf_by_scope: dict[tuple[str, str, str, str, str], str] = {}
    for row in existing_rows:
        if str(row["review_id"]) in existing_leaf_ids:
            leaf_by_scope[review_scope_key(row)] = str(row["review_id"])

    new_rows: list[dict[str, Any]] = []
    already_present: list[dict[str, Any]] = []
    for candidate in dry_run.preview_rows:
        review_id = str(candidate["review_id"])
        existing = existing_by_id.get(review_id)
        if existing is None:
            scope = review_scope_key(candidate)
            current_leaf = leaf_by_scope.get(scope)
            supersedes = candidate.get("supersedes_review_id")
            has_supersedes = isinstance(supersedes, str) and bool(supersedes.strip())
            if current_leaf is not None and not has_supersedes:
                raise MalidabaReviewWriteError(
                    "same-reviewer silent duplicate rejected for "
                    f"review_subject_id={candidate.get('review_subject_id')!r}: "
                    f"current leaf {current_leaf!r} exists; new candidate "
                    f"{review_id!r} must explicitly set supersedes_review_id"
                )
            if current_leaf is not None and has_supersedes:
                if str(supersedes).strip() != current_leaf:
                    raise MalidabaReviewWriteError(
                        "same-reviewer revision must supersede the current leaf "
                        f"{current_leaf!r} for this frozen subject "
                        f"(got {supersedes!r})"
                    )
            new_rows.append(candidate)
            continue
        if canonical_review_json(existing) == canonical_review_json(candidate):
            already_present.append(candidate)
            continue
        raise MalidabaReviewWriteError(
            f"review_id conflict for {review_id!r}: existing registry row differs "
            "from candidate (immutable reviews cannot be overwritten)"
        )

    merged_by_id = {str(row["review_id"]): row for row in existing_rows}
    for row in new_rows:
        merged_by_id[str(row["review_id"])] = row
    merged_rows = [merged_by_id[key] for key in sorted(merged_by_id)]

    try:
        merged_validation = validate_malidaba_review_table(merged_rows, path=output_path)
    except MalidabaReviewValidationError as exc:
        raise MalidabaReviewWriteError(
            f"merged review table validation failed: {exc}"
        ) from exc

    persisted_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    receipt = {
        "schema_version": "malidaba_delta_review_persistence_receipt_v1",
        "registry_path": str(output_path),
        "worksheet_path": str(worksheet_path),
        "batch_id": dry_run.preview_rows[0].get("batch_id"),
        "persisted_at": persisted_at,
        "applied": False,
        "rows_before": len(existing_rows),
        "candidate_rows": len(dry_run.preview_rows),
        "new_rows_written": len(new_rows),
        "already_present_identical": len(already_present),
        "rows_after": len(merged_rows),
        "current_leaf_count": merged_validation.summary.get("current_leaf_count"),
        "review_history_count": merged_validation.summary.get("review_history_count"),
        "decision_counts": _decision_counts(list(dry_run.preview_rows)),
        "registry_decision_counts": _decision_counts(merged_rows),
        "current_leaf_decision_counts": merged_validation.summary.get(
            "current_leaf_decision_counts"
        ),
        "reviewer_ids": sorted(
            {
                str(row.get("reviewer_id", ""))
                for row in dry_run.preview_rows
                if row.get("reviewer_id")
            }
        ),
        "worksheet_sha256": sha256_file(worksheet_path),
        "delta_sha256": dry_run.preview_rows[0].get("delta_sha256"),
        "current_ir_sha256": dry_run.preview_rows[0].get("current_ir_sha256"),
        "registry_sha256_before": (
            sha256_file(output_path) if output_path.exists() else None
        ),
        "registry_sha256_after": None,
        "new_review_ids": sorted(str(row["review_id"]) for row in new_rows),
        "already_present_review_ids": sorted(
            str(row["review_id"]) for row in already_present
        ),
        "review_schema_version": SCHEMA_VERSION,
    }

    return MalidabaReviewWritePlan(
        existing_rows=existing_rows,
        candidate_rows=list(dry_run.preview_rows),
        new_rows=new_rows,
        already_present_identical=already_present,
        merged_rows=merged_rows,
        receipt=receipt,
        applied=False,
    )


def _atomic_write_jsonl(path: Path, rows: list[dict[str, Any]]) -> None:
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

        # Exact bytes on disk must match intended serialization.
        on_disk = temp_path.read_text(encoding="utf-8")
        if on_disk != text:
            raise MalidabaReviewWriteError(
                f"temporary review registry bytes mismatch before replace ({temp_path})"
            )
        try:
            validate_malidaba_reviews(temp_path)
        except MalidabaReviewValidationError as exc:
            raise MalidabaReviewWriteError(
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


def apply_malidaba_review_write(
    plan: MalidabaReviewWritePlan,
    *,
    output_path: Path,
    receipt_path: Path | None = None,
) -> MalidabaReviewWritePlan:
    _atomic_write_jsonl(output_path, plan.merged_rows)

    try:
        post = validate_malidaba_reviews(output_path)
    except MalidabaReviewValidationError as exc:
        raise MalidabaReviewWriteError(
            f"post-write review registry validation failed ({output_path}): {exc}"
        ) from exc

    if post.summary.get("row_count") != len(plan.merged_rows):
        raise MalidabaReviewWriteError(
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


def write_malidaba_reviews(
    worksheet_path: Path,
    *,
    baseline_ir_path: Path,
    current_ir_path: Path,
    delta_path: Path,
    crawl_dir: Path,
    output_path: Path,
    apply: bool = False,
    verify_hashes: bool = True,
    receipt_path: Path | None = None,
) -> MalidabaReviewWritePlan:
    plan = plan_malidaba_review_write(
        worksheet_path,
        baseline_ir_path=baseline_ir_path,
        current_ir_path=current_ir_path,
        delta_path=delta_path,
        crawl_dir=crawl_dir,
        output_path=output_path,
        verify_hashes=verify_hashes,
    )
    if not apply:
        return plan
    return apply_malidaba_review_write(
        plan,
        output_path=output_path,
        receipt_path=receipt_path,
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Governed persistence of Malidaba delta reviews. "
            "Default is validate/report only; pass --apply to write."
        )
    )
    parser.add_argument("--worksheet", type=Path, required=True)
    parser.add_argument("--baseline-ir", type=Path, required=True)
    parser.add_argument("--current-ir", type=Path, required=True)
    parser.add_argument("--delta", type=Path, required=True)
    parser.add_argument("--crawl-dir", type=Path, required=True)
    parser.add_argument(
        "--output",
        type=Path,
        required=True,
        help="Destination malidaba_delta_reviews_v1.jsonl (local/gitignored)",
    )
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--skip-hash-verify", action="store_true")
    parser.add_argument("--receipt", type=Path, default=None)
    args = parser.parse_args(argv)

    try:
        plan = write_malidaba_reviews(
            args.worksheet,
            baseline_ir_path=args.baseline_ir,
            current_ir_path=args.current_ir,
            delta_path=args.delta,
            crawl_dir=args.crawl_dir,
            output_path=args.output,
            apply=args.apply,
            verify_hashes=not args.skip_hash_verify,
            receipt_path=args.receipt,
        )
    except MalidabaReviewWriteError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    payload = {
        "ok": True,
        "applied": plan.applied,
        "receipt": plan.receipt,
        "new_review_ids": [row["review_id"] for row in plan.new_rows],
    }
    print(json.dumps(payload, indent=2, sort_keys=True, ensure_ascii=False))
    if not args.apply:
        print(
            "NOTE: validation-only mode; pass --apply to persist reviews.",
            file=sys.stderr,
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
