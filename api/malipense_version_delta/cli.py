"""CLI for Malidaba / src_malipense version-delta comparison."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .compare import run_version_delta


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Deterministic non-mutating Malidaba version-delta comparison "
            "(evidence only; does not promote into canonical IR/bundles)."
        )
    )
    parser.add_argument(
        "--baseline-ir",
        type=Path,
        required=True,
        help="Path to baseline lexicon IR JSONL (read-only)",
    )
    parser.add_argument(
        "--current-crawl-dir",
        type=Path,
        required=True,
        help="Path to current-source crawl dir (payloads/ + snapshots.jsonl)",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        required=True,
        help="Gitignored output directory for comparison artifacts",
    )
    parser.add_argument(
        "--sample-n",
        type=int,
        default=15,
        help="Bounded sample size for summary examples (default: 15)",
    )
    args = parser.parse_args(argv)

    summary = run_version_delta(
        baseline_ir_path=args.baseline_ir,
        current_crawl_dir=args.current_crawl_dir,
        output_dir=args.output_dir,
        sample_n=args.sample_n,
    )
    print(json.dumps(
        {
            "decision": summary["decision"],
            "parser_compatibility": summary["parser_compatibility"]["status"],
            "identity_confidence_overall": summary["identity_confidence_overall"],
            "baseline_record_count": summary["baseline_record_count"],
            "current_record_count": summary["current_record_count"],
            "classification_counts": summary["classification_counts"],
            "hashes": summary["hashes"],
            "output_paths": summary["output_paths"],
        },
        ensure_ascii=False,
        indent=2,
        sort_keys=True,
    ))
    return 0 if summary["decision"].endswith("_RESTORED") else 2


if __name__ == "__main__":
    sys.exit(main())
