"""CLI for Malidaba delta review triage, worksheet export, and dry-run."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .dry_run_reviews import dry_run_import_review_worksheet
from .export_worksheet import (
    export_batch_worksheet,
    read_worksheet_subject_ids,
)
from .review_triage import build_triage_in_memory, generate_review_queues


def _cmd_regenerate_worksheet(args: argparse.Namespace) -> int:
    """Regenerate Batch 001 worksheet preserving existing subject IDs when valid."""
    from .dry_run_reviews import _batch_rows_for_subjects

    old_subject_ids: list[str] | None = None
    if args.preserve_from and args.preserve_from.is_file():
        old_subject_ids = read_worksheet_subject_ids(args.preserve_from)

    triage = build_triage_in_memory(
        baseline_ir_path=args.baseline_ir,
        current_ir_path=args.current_ir,
        delta_path=args.delta,
        crawl_dir=args.crawl_dir,
        batch_target=args.batch_target,
        verify_hashes=not args.skip_hash_verify,
    )

    fresh_ids = [str(r.get("review_subject_id") or "") for r in triage.batch_rows]
    if old_subject_ids:
        batch_rows = _batch_rows_for_subjects(triage, old_subject_ids)
        if len(batch_rows) != len(old_subject_ids):
            missing = set(old_subject_ids) - {
                str(r.get("review_subject_id")) for r in batch_rows
            }
            print(
                json.dumps(
                    {
                        "decision": "CORPUS1F12A_HUMAN_WORKSHEET_OBSERVABILITY_BLOCKED",
                        "reason": "preserved subject IDs not all reconstructible",
                        "missing_subject_ids": sorted(missing),
                    },
                    indent=2,
                )
            )
            return 2
        preserved_ids = [str(r.get("review_subject_id") or "") for r in batch_rows]
        same_set = set(preserved_ids) == set(fresh_ids)
        same_order = preserved_ids == fresh_ids
    else:
        batch_rows = triage.batch_rows
        same_set = True
        same_order = True

    worksheet_path = args.output
    worksheet_meta = export_batch_worksheet(
        batch_rows=batch_rows,
        current_ir_path=args.current_ir,
        output_path=worksheet_path,
        delta_sha256=triage.summary["frozen_inputs"]["delta_sha256"],
        current_ir_sha256=triage.summary["frozen_inputs"]["current_ir_sha256"],
    )

    print(
        json.dumps(
            {
                "decision": "CORPUS1F12A_HUMAN_WORKSHEET_OBSERVABILITY_READY",
                "worksheet_schema": worksheet_meta["worksheet_schema"],
                "row_count": worksheet_meta["row_count"],
                "same_subject_set_as_fresh_selection": same_set,
                "same_order_as_fresh_selection": same_order,
                "output_path": str(worksheet_path),
            },
            ensure_ascii=False,
            indent=2,
            sort_keys=True,
        )
    )
    return 0


def _cmd_triage(args: argparse.Namespace) -> int:
    result = generate_review_queues(
        baseline_ir_path=args.baseline_ir,
        current_ir_path=args.current_ir,
        delta_path=args.delta,
        crawl_dir=args.crawl_dir,
        output_dir=args.output_dir,
        batch_target=args.batch_target,
        verify_hashes=not args.skip_hash_verify,
    )

    worksheet_path = args.output_dir / "review" / "malidaba_new_headword_review_batch_001.csv"
    worksheet_meta = export_batch_worksheet(
        batch_rows=result.batch_rows,
        current_ir_path=args.current_ir,
        output_path=worksheet_path,
        delta_sha256=result.summary["frozen_inputs"]["delta_sha256"],
        current_ir_sha256=result.summary["frozen_inputs"]["current_ir_sha256"],
    )
    result.summary["output_paths"]["malidaba_new_headword_review_batch_001.csv"] = str(
        worksheet_path
    )
    result.summary["batch_001"]["worksheet_row_count"] = worksheet_meta["row_count"]

    print(
        json.dumps(
            {
                "decision": result.decision,
                "queue_counts": result.summary["queue_counts"],
                "queue_a_source_section_breakdown": result.summary[
                    "queue_a_source_section_breakdown"
                ],
                "batch_001": result.summary["batch_001"],
                "output_paths": result.summary["output_paths"],
            },
            ensure_ascii=False,
            indent=2,
            sort_keys=True,
        )
    )
    return 0 if result.decision.endswith("_READY") else 2


def _cmd_dry_run(args: argparse.Namespace) -> int:
    result = dry_run_import_review_worksheet(
        args.worksheet,
        baseline_ir_path=args.baseline_ir,
        current_ir_path=args.current_ir,
        delta_path=args.delta,
        crawl_dir=args.crawl_dir,
    )
    print(json.dumps({"summary": result.summary, "errors": result.errors}, indent=2))
    return 0 if result.summary.get("error_count", 0) == 0 else 1


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Malidaba delta review triage (non-authoritative; local/gitignored outputs)."
        )
    )
    sub = parser.add_subparsers(dest="command", required=True)

    triage = sub.add_parser("triage", help="Generate review queues and batch 001 worksheet")
    triage.add_argument("--baseline-ir", type=Path, required=True)
    triage.add_argument("--current-ir", type=Path, required=True)
    triage.add_argument("--delta", type=Path, required=True)
    triage.add_argument("--crawl-dir", type=Path, required=True)
    triage.add_argument(
        "--output-dir",
        type=Path,
        required=True,
        help="Gitignored output root (writes review/ subdirectory)",
    )
    triage.add_argument("--batch-target", type=int, default=100)
    triage.add_argument("--skip-hash-verify", action="store_true")
    triage.set_defaults(func=_cmd_triage)

    dry = sub.add_parser("dry-run", help="Dry-run review worksheet import")
    dry.add_argument("--worksheet", type=Path, required=True)
    dry.add_argument("--baseline-ir", type=Path, required=True)
    dry.add_argument("--current-ir", type=Path, required=True)
    dry.add_argument("--delta", type=Path, required=True)
    dry.add_argument("--crawl-dir", type=Path, required=True)
    dry.set_defaults(func=_cmd_dry_run)

    regen = sub.add_parser(
        "regenerate-worksheet",
        help="Regenerate Batch 001 worksheet (schema-only; preserve subject IDs)",
    )
    regen.add_argument("--baseline-ir", type=Path, required=True)
    regen.add_argument("--current-ir", type=Path, required=True)
    regen.add_argument("--delta", type=Path, required=True)
    regen.add_argument("--crawl-dir", type=Path, required=True)
    regen.add_argument(
        "--output",
        type=Path,
        required=True,
        help="Output worksheet CSV path",
    )
    regen.add_argument(
        "--preserve-from",
        type=Path,
        default=None,
        help="Existing worksheet whose review_subject_id set/order to preserve",
    )
    regen.add_argument("--batch-target", type=int, default=100)
    regen.add_argument("--skip-hash-verify", action="store_true")
    regen.set_defaults(func=_cmd_regenerate_worksheet)

    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
