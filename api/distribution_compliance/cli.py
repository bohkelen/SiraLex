"""CLI for PRODUCT1B noncommercial distribution compliance."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Validate SiraLex noncommercial distribution compliance (PRODUCT1B)."
    )
    parser.add_argument(
        "--repo-root",
        type=Path,
        default=None,
        help="Repository root (defaults to auto-detect).",
    )
    parser.add_argument(
        "--skip-internal-rebuild",
        action="store_true",
        help="Reuse existing PRODUCT1A INTERNAL_FULL workspace.",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Print full compliance manifest JSON to stdout.",
    )
    args = parser.parse_args(argv)

    from .evaluate import evaluate_product1b

    receipt = evaluate_product1b(args.repo_root, skip_internal_rebuild=args.skip_internal_rebuild)
    if args.json:
        print(json.dumps(receipt, indent=2, ensure_ascii=False))
    else:
        print(receipt["decision"])
        print(f"records={receipt['noncommercial_candidate']['records']}")
        print(f"checks_blocked={receipt.get('checks', {})}")
    return 0 if receipt["decision"].endswith("_READY") else 1


if __name__ == "__main__":
    raise SystemExit(main())
