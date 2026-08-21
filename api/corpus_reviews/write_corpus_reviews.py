"""Governed persistence of corpus_annotation_reviews_v1 from completed worksheets."""

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

from corpus_reviews.dry_run_import_reviews import (
    CorpusReviewDryRunError,
    dry_run_import_review_worksheet,
)
from corpus_reviews.validate_corpus_reviews import (
    CorpusReviewValidationError,
    validate_corpus_review_table,
    validate_corpus_reviews,
)


class CorpusReviewWriteError(ValueError):
    """Raised when governed review persistence cannot proceed."""


@dataclass
class CorpusReviewWritePlan:
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


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def rows_to_jsonl_text(rows: list[dict[str, Any]]) -> str:
    lines = [canonical_review_json(row) for row in rows]
    return ("\n".join(lines) + "\n") if lines else ""


def _decision_counts(rows: list[dict[str, Any]]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for row in rows:
        decision = str(row.get("decision", ""))
        counts[decision] = counts.get(decision, 0) + 1
    return counts


def _load_existing_registry(
    output_path: Path,
    *,
    annotations_path: Path,
    segments_path: Path | None,
    artifacts_path: Path | None,
    sources_path: Path | None,
) -> list[dict[str, Any]]:
    if not output_path.exists():
        return []
    try:
        result = validate_corpus_reviews(
            output_path,
            annotations_path=annotations_path,
            segments_path=segments_path,
            artifacts_path=artifacts_path,
            sources_path=sources_path,
        )
    except CorpusReviewValidationError as exc:
        raise CorpusReviewWriteError(
            f"existing review registry is invalid ({output_path}): {exc}"
        ) from exc
    return [dict(item.row) for item in result.rows]


def plan_corpus_review_write(
    worksheet_path: Path,
    annotations_path: Path,
    output_path: Path,
    *,
    segments_path: Path | None = None,
    artifacts_path: Path | None = None,
    sources_path: Path | None = None,
    include_superseded: bool = False,
    annotation_type: str | None = None,
) -> CorpusReviewWritePlan:
    try:
        dry_run = dry_run_import_review_worksheet(
            worksheet_path,
            annotations_path,
            segments_path=segments_path,
            artifacts_path=artifacts_path,
            sources_path=sources_path,
            include_superseded=include_superseded,
            annotation_type=annotation_type,
        )
    except CorpusReviewDryRunError as exc:
        raise CorpusReviewWriteError(str(exc)) from exc

    if dry_run.errors:
        raise CorpusReviewWriteError(
            "worksheet dry-run failed; refusing persistence:\n"
            + "\n".join(dry_run.errors)
        )
    if not dry_run.preview_rows:
        raise CorpusReviewWriteError(
            "worksheet dry-run produced zero candidate review rows"
        )

    existing_rows = _load_existing_registry(
        output_path,
        annotations_path=annotations_path,
        segments_path=segments_path,
        artifacts_path=artifacts_path,
        sources_path=sources_path,
    )
    existing_by_id = {str(row["review_id"]): row for row in existing_rows}

    new_rows: list[dict[str, Any]] = []
    already_present: list[dict[str, Any]] = []
    for candidate in dry_run.preview_rows:
        review_id = str(candidate["review_id"])
        existing = existing_by_id.get(review_id)
        if existing is None:
            new_rows.append(candidate)
            continue
        if canonical_review_json(existing) == canonical_review_json(candidate):
            already_present.append(candidate)
            continue
        raise CorpusReviewWriteError(
            f"review_id conflict for {review_id!r}: existing registry row differs "
            "from candidate (immutable reviews cannot be overwritten)"
        )

    merged_by_id = {str(row["review_id"]): row for row in existing_rows}
    for row in new_rows:
        merged_by_id[str(row["review_id"])] = row
    merged_rows = [merged_by_id[key] for key in sorted(merged_by_id)]

    # Full merged-table validation against annotation chain.
    try:
        from corpus_annotations.validate_corpus_annotations import (
            CorpusAnnotationValidationError,
            validate_corpus_annotations,
        )

        annotation_result = validate_corpus_annotations(
            annotations_path,
            segments_path=segments_path,
            artifacts_path=artifacts_path,
            sources_path=sources_path,
        )
    except CorpusAnnotationValidationError as exc:
        raise CorpusReviewWriteError(
            f"annotations table validation failed ({annotations_path}): {exc}"
        ) from exc

    annotations_by_id = {item.annotation_id: item for item in annotation_result.rows}
    try:
        validate_corpus_review_table(
            merged_rows,
            path=output_path,
            annotations_by_id=annotations_by_id,
            annotation_cross_reference=True,
            segment_cross_reference=segments_path is not None,
            artifact_cross_reference=artifacts_path is not None,
            source_cross_reference=sources_path is not None,
        )
    except CorpusReviewValidationError as exc:
        raise CorpusReviewWriteError(
            f"merged review table validation failed: {exc}"
        ) from exc

    persisted_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    receipt = {
        "schema_version": "corpus_annotation_review_persistence_receipt_v1",
        "registry_path": str(output_path),
        "worksheet_path": str(worksheet_path),
        "annotations_path": str(annotations_path),
        "persisted_at": persisted_at,
        "applied": False,
        "rows_before": len(existing_rows),
        "candidate_rows": len(dry_run.preview_rows),
        "new_rows_written": len(new_rows),
        "already_present_identical": len(already_present),
        "rows_after": len(merged_rows),
        "decision_counts": _decision_counts(merged_rows),
        "reviewer_ids": sorted(
            {str(row.get("reviewer_id", "")) for row in merged_rows if row.get("reviewer_id")}
        ),
        "worksheet_sha256": sha256_file(worksheet_path),
        "annotation_table_sha256": sha256_file(annotations_path),
        "registry_sha256_before": (
            sha256_file(output_path) if output_path.exists() else None
        ),
        "registry_sha256_after": None,
        "new_review_ids": sorted(str(row["review_id"]) for row in new_rows),
        "already_present_review_ids": sorted(
            str(row["review_id"]) for row in already_present
        ),
    }

    return CorpusReviewWritePlan(
        existing_rows=existing_rows,
        candidate_rows=list(dry_run.preview_rows),
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
    annotations_path: Path,
    segments_path: Path | None = None,
    artifacts_path: Path | None = None,
    sources_path: Path | None = None,
) -> None:
    """Serialize to a temp sibling, validate that file from disk, then atomically replace."""
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
        try:
            validate_corpus_reviews(
                temp_path,
                annotations_path=annotations_path,
                segments_path=segments_path,
                artifacts_path=artifacts_path,
                sources_path=sources_path,
            )
        except CorpusReviewValidationError as exc:
            raise CorpusReviewWriteError(
                f"temporary review registry failed on-disk validation "
                f"before replace ({temp_path}): {exc}"
            ) from exc
        os.replace(temp_path, path)
        # Best-effort durability for the directory entry; ignore platform limits.
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


def apply_corpus_review_write(
    plan: CorpusReviewWritePlan,
    *,
    output_path: Path,
    annotations_path: Path,
    segments_path: Path | None = None,
    artifacts_path: Path | None = None,
    sources_path: Path | None = None,
    receipt_path: Path | None = None,
) -> CorpusReviewWritePlan:
    _atomic_write_jsonl(
        output_path,
        plan.merged_rows,
        annotations_path=annotations_path,
        segments_path=segments_path,
        artifacts_path=artifacts_path,
        sources_path=sources_path,
    )

    try:
        post = validate_corpus_reviews(
            output_path,
            annotations_path=annotations_path,
            segments_path=segments_path,
            artifacts_path=artifacts_path,
            sources_path=sources_path,
        )
    except CorpusReviewValidationError as exc:
        raise CorpusReviewWriteError(
            f"post-write review registry validation failed ({output_path}): {exc}"
        ) from exc

    if post.summary.get("row_count") != len(plan.merged_rows):
        raise CorpusReviewWriteError(
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


def write_corpus_reviews(
    worksheet_path: Path,
    annotations_path: Path,
    output_path: Path,
    *,
    apply: bool = False,
    segments_path: Path | None = None,
    artifacts_path: Path | None = None,
    sources_path: Path | None = None,
    include_superseded: bool = False,
    annotation_type: str | None = None,
    receipt_path: Path | None = None,
) -> CorpusReviewWritePlan:
    plan = plan_corpus_review_write(
        worksheet_path,
        annotations_path,
        output_path,
        segments_path=segments_path,
        artifacts_path=artifacts_path,
        sources_path=sources_path,
        include_superseded=include_superseded,
        annotation_type=annotation_type,
    )
    if not apply:
        return plan
    return apply_corpus_review_write(
        plan,
        output_path=output_path,
        annotations_path=annotations_path,
        segments_path=segments_path,
        artifacts_path=artifacts_path,
        sources_path=sources_path,
        receipt_path=receipt_path,
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Governed persistence of corpus_annotation_reviews_v1 from a completed "
            "review worksheet. Default is validate/report only; pass --apply to write."
        )
    )
    parser.add_argument("worksheet_csv", type=Path)
    parser.add_argument("--annotations", type=Path, required=True)
    parser.add_argument(
        "--output",
        type=Path,
        required=True,
        help="Destination corpus_annotation_reviews_v1.jsonl (local pilot path)",
    )
    parser.add_argument("--segments", type=Path, default=None)
    parser.add_argument("--artifacts", type=Path, default=None)
    parser.add_argument("--sources", type=Path, default=None)
    parser.add_argument("--include-superseded", action="store_true")
    parser.add_argument("--annotation-type", default=None)
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Persist merged registry after full validation (default: no write)",
    )
    parser.add_argument(
        "--receipt",
        type=Path,
        default=None,
        help="Optional persistence receipt JSON path (written only with --apply)",
    )
    args = parser.parse_args(argv)

    try:
        plan = write_corpus_reviews(
            args.worksheet_csv,
            args.annotations,
            args.output,
            apply=args.apply,
            segments_path=args.segments,
            artifacts_path=args.artifacts,
            sources_path=args.sources,
            include_superseded=args.include_superseded,
            annotation_type=args.annotation_type,
            receipt_path=args.receipt,
        )
    except CorpusReviewWriteError as exc:
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
