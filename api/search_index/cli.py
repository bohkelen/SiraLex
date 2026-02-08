"""
CLI for the search index builder.

Reads normalized JSONL and produces an inverted search index JSONL.
"""

import argparse
import logging
from pathlib import Path

from .build_index import process_normalized_file

logger = logging.getLogger(__name__)


def main():
    parser = argparse.ArgumentParser(
        description="Build a search index from normalized JSONL records"
    )
    parser.add_argument(
        "--input",
        type=Path,
        required=True,
        help="Input normalized JSONL file",
    )
    parser.add_argument(
        "--output",
        type=Path,
        required=True,
        help="Output search index JSONL file path",
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

    print(f"Input: {args.input}")
    print(f"Output: {args.output}")
    print()

    stats = process_normalized_file(
        args.input,
        args.output,
        verbose=args.verbose,
    )

    print()
    print("=" * 50)
    print("Search Index Build Results")
    print("=" * 50)
    print(f"Normalized records read:      {stats['records_read']}")
    print(f"Parse errors:                 {stats['parse_errors']}")
    print(f"Total index entries:          {stats['total_index_entries']}")
    print()
    print("Unique keys per type:")
    for key_type, count in sorted(stats.get("unique_keys_by_type", {}).items()):
        print(f"  {key_type:30s} {count}")
    print("=" * 50)


if __name__ == "__main__":
    main()
