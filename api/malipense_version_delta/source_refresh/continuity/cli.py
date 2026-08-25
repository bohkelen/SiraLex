"""CLI for CORPUS1F17 Malidaba lexical continuity gate."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from ..paths import default_paths
from .evaluate import evaluate_lexical_continuity_gate


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=(
            "CORPUS1F17 Malidaba versioned lexical continuity gate "
            "(Type-B retain encoding + Type-A v2 worksheet + virtual prototype; "
            "no apply / no canonical mutation)."
        )
    )
    parser.add_argument("--repo-root", type=Path, default=None)
    parser.add_argument("--json-summary", action="store_true")
    args = parser.parse_args(argv)

    paths = default_paths(args.repo_root)
    receipt = evaluate_lexical_continuity_gate(paths)
    if args.json_summary:
        print(
            json.dumps(
                {
                    "decision": receipt.get("decision"),
                    "type_b": receipt.get("type_b"),
                    "type_a_v2": receipt.get("type_a_v2"),
                    "provisional_g9": receipt.get("provisional_g9"),
                    "virtual_g7": receipt.get("virtual_g7"),
                    "virtual_g8": receipt.get("virtual_g8"),
                    "stable_logical_lexical_reference_prototype": receipt.get(
                        "stable_logical_lexical_reference_prototype"
                    ),
                    "receipt": str(paths.f17_dir / "lexical_continuity_gate.json"),
                },
                indent=2,
                sort_keys=True,
            )
        )
    else:
        print(f"decision={receipt.get('decision')}")
        print(f"provisional_g9={receipt.get('provisional_g9')}")
        print(f"virtual_g7={receipt.get('virtual_g7')}")
        print(f"receipt={paths.f17_dir / 'lexical_continuity_gate.json'}")

    return 0 if str(receipt.get("decision", "")).endswith("_READY") else 2


if __name__ == "__main__":
    sys.exit(main())
