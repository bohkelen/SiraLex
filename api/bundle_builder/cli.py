"""
CLI for the bundle builder.

Assembles an offline bundle from normalized records and search index artifacts.
"""

import argparse
import json
import logging
import sys
from pathlib import Path

from .build_bundle import build_bundle, verify_bundle
from .package_bundle import PackageBundleError, build_package

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
        source_lang=args.source_lang,
        target_lang=args.target_lang,
        source_label=args.source_label,
        target_label=args.target_label,
        target_scripts=args.target_script,
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


def cmd_package(args: argparse.Namespace) -> None:
    """Wrap a verified bundle directory in a `.siralex.zip` transport package."""
    print(f"Bundle directory: {args.bundle_dir}")
    print(f"Output package:  {args.output}")
    print()

    try:
        result = build_package(args.bundle_dir, args.output)
    except PackageBundleError as exc:
        print(f"ERROR: {exc}")
        sys.exit(1)

    print("=" * 50)
    print("Bundle Package Results")
    print("=" * 50)
    print(f"Bundle ID:              {result['bundle_id']}")
    print(f"Output path:            {result['output_path']}")
    print(f"Package byte length:    {result['package_byte_length']}")
    print(f"Package SHA-256:        {result['package_sha256']}")
    print(f"Package format version: {result['package_format_version']}")
    print("Entries:")
    for entry in result["entries"]:
        print(f"  - {entry}")
    print("=" * 50)


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
    build_parser.add_argument(
        "--source-lang",
        help="Optional source language code for manifest metadata",
    )
    build_parser.add_argument(
        "--target-lang",
        help="Optional target language code for manifest metadata",
    )
    build_parser.add_argument(
        "--source-label",
        help="Optional human-readable source language label",
    )
    build_parser.add_argument(
        "--target-label",
        help="Optional human-readable target language label",
    )
    build_parser.add_argument(
        "--target-script",
        action="append",
        default=[],
        help="Optional supported target script label (repeatable)",
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

    package_parser = subparsers.add_parser(
        "package",
        help="Wrap a verified bundle directory in a .siralex.zip transport package",
    )
    package_parser.add_argument(
        "--bundle-dir",
        type=Path,
        required=True,
        help="Path to verified bundle directory",
    )
    package_parser.add_argument(
        "--output",
        type=Path,
        required=True,
        help="Output path for the .siralex.zip package",
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
    elif args.command == "package":
        cmd_package(args)


if __name__ == "__main__":
    main()
