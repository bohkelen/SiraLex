"""CLI for CORPUS1F20 canonical Malidaba source-refresh transaction dry-run."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from ..paths import default_paths
from .evaluate import evaluate_canonical_refresh_transaction
from .model import DECISION_READY


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Guarded canonical Malidaba source-refresh transaction dry-run. "
            "Default is validate only. Real --apply requires an explicit later "
            "authorization slice."
        )
    )
    parser.add_argument("--repo-root", type=Path, default=None)
    parser.add_argument("--json-summary", action="store_true")
    parser.add_argument(
        "--workspace",
        type=Path,
        default=None,
        help="Local gitignored workspace (default: source_refresh/f20).",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Real canonical apply (refused unless a later slice authorizes it).",
    )
    parser.add_argument("--expected-transaction-id", default=None)
    parser.add_argument("--expected-base-commit", default=None)
    args = parser.parse_args(argv)

    if args.apply:
        print(
            "REFUSED: dry-run / reanchor only. Real canonical apply is not "
            "authorized in this slice.",
            file=sys.stderr,
        )
        return 3

    paths = default_paths(args.repo_root)
    receipt = evaluate_canonical_refresh_transaction(
        paths,
        workspace=args.workspace,
        expected_base_commit=args.expected_base_commit,
    )
    if args.json_summary:
        print(
            json.dumps(
                {
                    "decision": receipt.get("decision"),
                    "base_commit": receipt.get("base_commit"),
                    "frozen_inputs": receipt.get("frozen_inputs"),
                    "canonical_mutation_paths": receipt.get(
                        "canonical_mutation_paths"
                    ),
                    "counts": receipt.get("counts"),
                    "transaction_id": receipt.get("transaction_id"),
                    "preconditions_apply_mode": {
                        "ok": (receipt.get("preconditions_apply_mode") or {}).get(
                            "ok"
                        ),
                        "failures": (receipt.get("preconditions_apply_mode") or {}).get(
                            "failures"
                        ),
                    },
                    "staged_build": {
                        "canonical_pass": (receipt.get("staged_build") or {}).get(
                            "canonical_pass"
                        ),
                        "staged_pass": (receipt.get("staged_build") or {}).get(
                            "staged_pass"
                        ),
                        "matches_f19_behavior": (receipt.get("staged_build") or {}).get(
                            "matches_f19_behavior"
                        ),
                    },
                    "reference_closure": receipt.get("reference_closure"),
                    "rollback_drills": receipt.get("rollback_drills"),
                    "overall": receipt.get("overall"),
                    "blocking_reasons": receipt.get("blocking_reasons"),
                    "real_canonical_writes": receipt.get("real_canonical_writes"),
                },
                indent=2,
                sort_keys=True,
            )
        )
    else:
        print(f"decision={receipt.get('decision')}")
        print(f"base_commit={receipt.get('base_commit')}")
        print(f"transaction_id={receipt.get('transaction_id')}")
        print(f"overall={receipt.get('overall')}")
        print(f"blocking={receipt.get('blocking_reasons')}")

    return 0 if receipt.get("decision") == DECISION_READY else 2


if __name__ == "__main__":
    sys.exit(main())
