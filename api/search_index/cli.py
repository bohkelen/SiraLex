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
    parser.add_argument(
        "--no-english-keys",
        action="store_true",
        help="Disable additive en_* emission from sense gloss_en (default: emit when present)",
    )
    parser.add_argument(
        "--english-provenance",
        type=Path,
        default=None,
        help="Optional path for English key provenance JSONL (outside consumer bundle)",
    )
    parser.add_argument(
        "--base-search-index",
        type=Path,
        default=None,
        help=(
            "Optional existing search_index.jsonl to preserve (src_*/tgt_*/legacy). "
            "When set, only additive en_* rows are derived from --input records."
        ),
    )

    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO if args.verbose else logging.WARNING,
        format="%(levelname)s: %(message)s",
    )

    print(f"Input: {args.input}")
    print(f"Output: {args.output}")
    if args.base_search_index:
        print(f"Base search index: {args.base_search_index}")
    print()

    stats = process_normalized_file(
        args.input,
        args.output,
        verbose=args.verbose,
        emit_english_keys=not args.no_english_keys,
        english_provenance_path=args.english_provenance,
        base_search_index_path=args.base_search_index,
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
    en_summary = stats.get("english_provenance")
    if en_summary:
        print()
        print("English provenance:")
        print(f"  extraction_rule:            {en_summary.get('extraction_rule')}")
        print(f"  source_senses:              {en_summary.get('source_senses')}")
        print(f"  extracted_candidates:       {en_summary.get('extracted_candidates')}")
        print(f"  unique_english_keys:        {en_summary.get('unique_english_keys')}")
        print(f"  en_index_rows:              {en_summary.get('en_index_rows')}")
        if en_summary.get("provenance_path"):
            print(f"  provenance_path:            {en_summary.get('provenance_path')}")
    print("=" * 50)


if __name__ == "__main__":
    main()
