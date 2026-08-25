"""CLI for CORPUS1F19 Malidaba transition-regression closure."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from ..paths import default_paths
from .closure import evaluate_transition_regression_closure


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=(
            "CORPUS1F19 close transition-induced G8 regressions with a full "
            "virtual product rebuild. No canonical apply."
        )
    )
    parser.add_argument("--repo-root", type=Path, default=None)
    parser.add_argument("--json-summary", action="store_true")
    args = parser.parse_args(argv)

    paths = default_paths(args.repo_root)
    receipt = evaluate_transition_regression_closure(paths)
    if args.json_summary:
        print(
            json.dumps(
                {
                    "decision": receipt.get("decision"),
                    "virtual_g7": receipt.get("virtual_g7"),
                    "canonical_regression": receipt.get("canonical_regression"),
                    "virtual_regression_after": receipt.get("virtual_regression_after"),
                    "differential": receipt.get("differential"),
                    "provisional_g9": receipt.get("provisional_g9"),
                    "overall": receipt.get("overall"),
                    "engineering_ready": receipt.get("engineering_ready"),
                    "rights": receipt.get("rights"),
                    "canonical_writes": receipt.get("canonical_writes"),
                },
                indent=2,
                sort_keys=True,
            )
        )
    else:
        print(f"decision={receipt.get('decision')}")
        print(f"overall={receipt.get('overall')}")
        print(f"g7={receipt.get('virtual_g7')}")
        print(f"g8={receipt.get('differential')}")
        print(f"g9={receipt.get('provisional_g9')}")

    return 0 if receipt.get("decision") == (
        "CORPUS1F19_MALIDABA_TRANSITION_REGRESSIONS_CLOSED"
    ) else 2


if __name__ == "__main__":
    sys.exit(main())
