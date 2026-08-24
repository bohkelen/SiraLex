"""CLI for CORPUS1F16 Malidaba transition review gate."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from ..paths import default_paths
from .evaluate import evaluate_transition_review_gate


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=(
            "CORPUS1F16 Malidaba identity-migration + destructive-change "
            "review gate (proposals + blank worksheets only; no apply)."
        )
    )
    parser.add_argument("--repo-root", type=Path, default=None)
    parser.add_argument("--json-summary", action="store_true")
    args = parser.parse_args(argv)

    paths = default_paths(args.repo_root)
    receipt = evaluate_transition_review_gate(paths)
    if args.json_summary:
        print(
            json.dumps(
                {
                    "decision": receipt.get("decision"),
                    "frozen_inputs": receipt.get("frozen_inputs"),
                    "unique_migration_subjects": receipt.get(
                        "unique_migration_subjects"
                    ),
                    "proposal_ready_count": receipt.get("proposal_ready_count"),
                    "virtual_g7_after": receipt.get("virtual_g7_after"),
                    "regression_after": receipt.get(
                        "regression_after_safe_virtual_remaps"
                    ),
                    "g9": receipt.get("g9"),
                    "receipt": str(paths.f16_dir / "transition_review_gate.json"),
                },
                indent=2,
                sort_keys=True,
            )
        )
    else:
        print(f"decision={receipt.get('decision')}")
        print(f"proposal_ready_count={receipt.get('proposal_ready_count')}")
        print(f"virtual_g7_after={receipt.get('virtual_g7_after')}")
        print(f"g9={receipt.get('g9')}")
        print(f"receipt={paths.f16_dir / 'transition_review_gate.json'}")

    return 0 if str(receipt.get("decision", "")).endswith("_READY") else 2


if __name__ == "__main__":
    sys.exit(main())
