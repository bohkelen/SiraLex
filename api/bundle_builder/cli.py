"""
CLI for the bundle builder.

Assembles an offline bundle from normalized records and search index artifacts.
"""

import argparse
import json
import logging
from pathlib import Path

from .build_bundle import build_bundle, verify_bundle

logger = logging.getLogger(__name__)


def cmd_build(args: argparse.Namespace) -> None:
    """Build a new bundle."""
    print(f"Normalized input: {args.normalized}")
    print(f"Search index input: {args.search_index}")
    print(f"Output directory: {args.output_dir}")
    print(f"Bundle type: {args.bundle_type}")
    print()

    result = build_bundle(
        normalized_path=args.normalized,
        search_index_path=args.search_index,
        output_dir=args.output_dir,
        bundle_type=args.bundle_type,
    )

    print("=" * 50)
    print("Bundle Build Results")
    print("=" * 50)
    print(f"Bundle ID:       {result['bundle_id']}")
    print(f"Bundle dir:      {result['bundle_dir']}")
    print(f"Content SHA-256: {result['content_sha256']}")
    print(f"Payload files:   {result['files_count']}")
    print("=" * 50)


def cmd_verify(args: argparse.Namespace) -> None:
    """Verify an existing bundle."""
    print(f"Verifying bundle: {args.bundle_dir}")
    print()

    result = verify_bundle(args.bundle_dir)

    if result["valid"]:
        print(f"Bundle {result['bundle_id']} is VALID")
    else:
        print(f"Bundle {result['bundle_id']} is INVALID")
        for error in result["errors"]:
            print(f"  ERROR: {error}")


def main():
    parser = argparse.ArgumentParser(
        description="Build or verify offline data bundles"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Verbose output",
    )

    subparsers = parser.add_subparsers(dest="command", required=True)

    # Build subcommand
    build_parser = subparsers.add_parser(
        "build",
        help="Build a new bundle from normalized records and search index",
    )
    build_parser.add_argument(
        "--normalized",
        type=Path,
        required=True,
        help="Path to normalized JSONL file",
    )
    build_parser.add_argument(
        "--search-index",
        type=Path,
        required=True,
        help="Path to search index JSONL file",
    )
    build_parser.add_argument(
        "--output-dir",
        type=Path,
        required=True,
        help="Parent directory for the bundle output",
    )
    build_parser.add_argument(
        "--bundle-type",
        choices=["full", "seed"],
        default="full",
        help="Bundle type (default: full)",
    )

    # Verify subcommand
    verify_parser = subparsers.add_parser(
        "verify",
        help="Verify integrity of an existing bundle",
    )
    verify_parser.add_argument(
        "bundle_dir",
        type=Path,
        help="Path to bundle directory to verify",
    )

    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO if args.verbose else logging.WARNING,
        format="%(levelname)s: %(message)s",
    )

    if args.command == "build":
        cmd_build(args)
    elif args.command == "verify":
        cmd_verify(args)


if __name__ == "__main__":
    main()
