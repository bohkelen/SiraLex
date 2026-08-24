"""CLI for PRODUCT2 publication readiness evaluation."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from .evaluate import evaluate_product2
from .model import DECISION_READY


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Evaluate PRODUCT2 publication readiness and catalog boundary"
    )
    parser.add_argument(
        "--repo-root",
        type=Path,
        default=None,
        help="Repository root (default: auto-detect)",
    )
    parser.add_argument(
        "--skip-internal-rebuild",
        action="store_true",
        help="Reuse existing INTERNAL_FULL workspace",
    )
    args = parser.parse_args(argv)

    receipt = evaluate_product2(
        args.repo_root,
        skip_internal_rebuild=args.skip_internal_rebuild,
    )
    print(receipt["decision"])
    print(f"candidate_bundle_id={receipt['candidate_bundle_id']}")
    print(f"receipt_sha256={receipt.get('receipt_sha256')}")
    return 0 if receipt["decision"] == DECISION_READY else 1


if __name__ == "__main__":
    sys.exit(main())
