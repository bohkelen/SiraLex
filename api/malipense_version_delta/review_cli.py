"""CLI for Malidaba delta review triage, worksheet export, and dry-run."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .dry_run_reviews import dry_run_import_review_worksheet
from .export_worksheet import export_batch_worksheet
from .review_triage import generate_review_queues


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

    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
