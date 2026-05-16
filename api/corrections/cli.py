"""CLI entrypoint for correction dry-run application."""

from __future__ import annotations

import argparse
import logging
from pathlib import Path

from .dry_run_apply import run_corrections_dry_run


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Apply approved correction records to an IR snapshot in dry-run mode"
    )
    parser.add_argument("--ir-input", type=Path, required=True, help="Input IR JSONL (immutable)")
    parser.add_argument(
        "--ir-version",
        type=str,
        required=True,
        help="IR version context; must equal correctionset manifest target_ir_version",
    )
    parser.add_argument(
        "--correctionset-manifest",
        type=Path,
        required=True,
        help="Correctionset manifest JSON path",
    )
    parser.add_argument(
        "--corrections-jsonl",
        type=Path,
        required=True,
        help="Correction records JSONL path",
    )
    parser.add_argument("--output-ir", type=Path, required=True, help="Corrected IR output JSONL path")
    parser.add_argument(
        "--output-report",
        type=Path,
        required=True,
        help="Machine-readable dry-run report JSON path",
    )
    parser.add_argument(
        "--output-manifest",
        type=Path,
        required=False,
        default=None,
        help="Optional corrected IR manifest JSON output path",
    )
    parser.add_argument(
        "--generated-at",
        type=str,
        required=False,
        default=None,
        help="Deterministic generated_at timestamp (ISO-8601 UTC Z)",
    )
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")

    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO if args.verbose else logging.WARNING,
        format="%(levelname)s: %(message)s",
    )

    result = run_corrections_dry_run(
        ir_input_path=args.ir_input,
        correctionset_manifest_path=args.correctionset_manifest,
        corrections_jsonl_path=args.corrections_jsonl,
        input_ir_version=args.ir_version,
        output_ir_path=args.output_ir,
        output_report_path=args.output_report,
        output_manifest_path=args.output_manifest,
        generated_at=args.generated_at,
    )

    print("Correction dry-run completed.")
    print(f"Corrected IR sha256: {result.corrected_ir_sha256}")
    print(f"Report sha256:       {result.report_sha256}")
    print("Summary:")
    for key, value in sorted(result.summary.items()):
        print(f"  {key}: {value}")


if __name__ == "__main__":
    main()

