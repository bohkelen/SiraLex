#!/usr/bin/env python3
"""Run the Phase 7L curated search regression matrix against a pinned bundle."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
API_ROOT = REPO_ROOT / "api"
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from search_regression.replay import (  # noqa: E402
    BundleMetadataError,
    MatrixValidationFailure,
    RegressionRunError,
    SearchIndexChecksumError,
    dumps_regression_result,
    run_search_regression,
)


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--matrix", type=Path, required=True, help="Matrix JSONL path")
    parser.add_argument("--manifest", type=Path, required=True, help="Matrix manifest JSON path")
    parser.add_argument("--bundle", type=Path, required=True, help="Pinned bundle directory")
    parser.add_argument(
        "--catalog",
        type=Path,
        default=None,
        help="Optional catalog.json path for catalog_version resolution",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Optional output JSON path; stdout when omitted",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_arg_parser()
    args = parser.parse_args(argv)

    try:
        result = run_search_regression(
            matrix_path=args.matrix,
            manifest_path=args.manifest,
            bundle_path=args.bundle,
            catalog_path=args.catalog,
        )
    except (
        MatrixValidationFailure,
        BundleMetadataError,
        SearchIndexChecksumError,
        RegressionRunError,
    ) as exc:
        print(str(exc), file=sys.stderr)
        return 1

    payload = dumps_regression_result(result)
    if args.output is None:
        sys.stdout.write(payload)
    else:
        args.output.write_text(payload, encoding="utf-8")

    return 0 if result.all_passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
