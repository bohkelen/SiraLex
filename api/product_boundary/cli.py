"""CLI for PRODUCT1A rights-aware product boundary evaluation."""

from __future__ import annotations

import argparse
import json
import sys

from .evaluate import evaluate_product_boundary, verify_canonical_unchanged
from .paths import default_paths


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="PRODUCT1A — rights-aware product boundary audit (no publication)"
    )
    parser.add_argument(
        "--repo-root",
        default=None,
        help="Repository root (default: autodetect)",
    )
    parser.add_argument(
        "--expected-base-commit",
        default="88ea05adb74459b16c17576b9e376771cc5e351f",
    )
    args = parser.parse_args(argv)

    from pathlib import Path

    paths = default_paths(Path(args.repo_root) if args.repo_root else None)
    canonical = verify_canonical_unchanged(paths)
    if any(v != "OK" for v in canonical.values()):
        print(json.dumps({"decision": "BLOCKED", "canonical": canonical}, indent=2))
        return 2

    receipt = evaluate_product_boundary(
        paths, expected_base_commit=args.expected_base_commit
    )
    print(json.dumps(receipt, indent=2, ensure_ascii=False))
    return 0 if receipt.get("decision", "").endswith("_READY") else 1


if __name__ == "__main__":
    sys.exit(main())
