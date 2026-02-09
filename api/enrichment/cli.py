"""
CLI for the record enrichment step.

Reads normalized JSONL + IR JSONL files and produces enriched JSONL
with display fields for offline bundle use.
"""

import argparse
import logging
from pathlib import Path

from .enrich import enrich_records

logger = logging.getLogger(__name__)


def main():
    parser = argparse.ArgumentParser(
        description="Enrich normalized records with IR display fields for offline bundles"
    )
    parser.add_argument(
        "--normalized",
        type=Path,
        required=True,
        help="Input normalized JSONL file",
    )
    parser.add_argument(
        "--ir",
        type=Path,
        action="append",
        required=True,
        help="Input IR JSONL file(s). Can be specified multiple times.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        required=True,
        help="Output enriched JSONL file path",
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

    print(f"Normalized input: {args.normalized}")
    print(f"IR input files: {len(args.ir)}")
    for p in args.ir:
        print(f"  {p}")
    print(f"Output: {args.output}")
    print()

    stats = enrich_records(
        args.normalized,
        args.ir,
        args.output,
        verbose=args.verbose,
    )

    print()
    print("=" * 50)
    print("Record Enrichment Results")
    print("=" * 50)
    print(f"IR records loaded:            {stats['ir_records_loaded']}")
    print(f"Normalized records read:      {stats['normalized_records_read']}")
    print(f"Enriched with display:        {stats['enriched_with_display']}")
    print(f"Missing display (no IR):      {stats['missing_display']}")
    print(f"Parse errors:                 {stats['parse_errors']}")
    print(f"Output: {args.output}")
    print("=" * 50)


if __name__ == "__main__":
    main()
