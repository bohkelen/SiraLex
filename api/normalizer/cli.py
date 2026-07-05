"""
CLI for the normalizer.

Reads IR JSONL files and produces normalized JSONL.
"""

import argparse
import logging
import sys
from pathlib import Path

# Add shared to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "shared"))

from normalization.norm_v3 import RULESET_ID
from .normalize import process_ir_files

logger = logging.getLogger(__name__)


def main():
    parser = argparse.ArgumentParser(
        description="Normalize IR units into search-ready records"
    )
    parser.add_argument(
        "--input",
        type=Path,
        action="append",
        required=True,
        help="Input IR JSONL file(s). Can be specified multiple times.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        required=True,
        help="Output normalized JSONL file path",
    )
    parser.add_argument(
        "--target-variant-overlay",
        type=Path,
        default=None,
        help=(
            "Optional reviewed target-variant overlay JSONL. "
            "When omitted, raw-source normalization runs with no overlay."
        ),
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Verbose output",
    )

    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO if args.verbose else logging.WARNING,
        format="%(levelname)s: %(message)s",
    )

    print(f"Normalization ruleset: {RULESET_ID}")
    print(f"Input files: {len(args.input)}")
    for p in args.input:
        print(f"  {p}")
    if args.target_variant_overlay is not None:
        print(f"Target-variant overlay: {args.target_variant_overlay}")
    else:
        print("Target-variant overlay: (none — raw normalization)")
    print()

    stats = process_ir_files(
        args.input,
        args.output,
        verbose=args.verbose,
        target_variant_overlay=args.target_variant_overlay,
    )

    print()
    print("=" * 50)
    print(f"Normalization Results — {RULESET_ID}")
    print("=" * 50)
    print(f"IR units read:                {stats['ir_units_read']}")
    print(f"Lexicon entries normalized:   {stats['lexicon_entries_normalized']}")
    print(f"Index mappings normalized:    {stats['index_mappings_normalized']}")
    print(f"Skipped:                      {stats['skipped']}")
    print(f"Errors:                       {stats['errors']}")
    if stats.get("target_variant_overlay_path"):
        print(f"Overlay path:                 {stats['target_variant_overlay_path']}")
        print(f"Overlay SHA-256:              {stats['target_variant_overlay_sha256']}")
        print(f"Overlay rows:                 {stats['target_variant_overlay_row_count']}")
        print(
            "Overlay applied rows:         "
            f"{stats['target_variant_overlay_applied_row_count']}"
        )
    print(f"Output: {args.output}")
    print("=" * 50)

    if stats["errors"] > 0:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
