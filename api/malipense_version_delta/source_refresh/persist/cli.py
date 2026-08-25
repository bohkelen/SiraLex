"""CLI for CORPUS1F18 transition-review persistence + virtual gate rerun."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from ..paths import default_paths
from .evaluate import evaluate_transition_review_persist


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=(
            "CORPUS1F18 persist human Type-A/Type-B transition reviews and "
            "re-run virtual G7/G8/G9. No canonical apply."
        )
    )
    parser.add_argument("--repo-root", type=Path, default=None)
    parser.add_argument("--json-summary", action="store_true")
    args = parser.parse_args(argv)

    paths = default_paths(args.repo_root)
    receipt = evaluate_transition_review_persist(paths)
    if args.json_summary:
        print(
            json.dumps(
                {
                    "decision": receipt.get("decision"),
                    "type_a": receipt.get("type_a"),
                    "type_b": receipt.get("type_b"),
                    "logical_continuity": receipt.get("logical_continuity"),
                    "virtual_g7": receipt.get("virtual_g7"),
                    "virtual_g8": receipt.get("virtual_g8"),
                    "provisional_g9": receipt.get("provisional_g9"),
                    "overall": receipt.get("overall"),
                    "engineering_ready": receipt.get("engineering_ready"),
                },
                indent=2,
                sort_keys=True,
            )
        )
    else:
        print(f"decision={receipt.get('decision')}")
        print(f"overall={receipt.get('overall')}")
        print(f"g7={receipt.get('virtual_g7')}")
        print(f"g8={receipt.get('virtual_g8')}")
        print(f"g9={receipt.get('provisional_g9')}")

    return 0 if str(receipt.get("decision", "")).endswith("_PERSISTED") else 2


if __name__ == "__main__":
    sys.exit(main())
