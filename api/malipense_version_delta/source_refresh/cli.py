"""CLI for Malidaba SOURCE_REFRESH_ACCEPTANCE dry-run."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .evaluate import evaluate_source_refresh_acceptance
from .paths import default_paths


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Dry-run Malidaba SOURCE_REFRESH_ACCEPTANCE evaluation. "
            "Never writes canonical IR/snapshots/bundles."
        )
    )
    parser.add_argument(
        "--repo-root",
        type=Path,
        default=None,
        help="Repository root (default: auto-detect from package location)",
    )
    parser.add_argument(
        "--skip-isolated-build",
        action="store_true",
        help="Skip G8 heavy normalize/enrich/index/bundle (tests / triage)",
    )
    parser.add_argument(
        "--json-summary",
        action="store_true",
        help="Print compact JSON summary to stdout",
    )
    args = parser.parse_args(argv)

    paths = default_paths(args.repo_root)
    acceptance = evaluate_source_refresh_acceptance(
        paths, skip_isolated_build=args.skip_isolated_build
    )

    summary = {
        "overall_decision": acceptance.overall_decision,
        "engineering_ready": acceptance.engineering_ready,
        "publication_authorized": acceptance.publication_authorized,
        "blocking_reasons": acceptance.blocking_reasons,
        "gates": {k: v.status for k, v in acceptance.gates.items()},
        "acceptance_path": str(paths.acceptance_json),
    }
    if args.json_summary:
        print(json.dumps(summary, indent=2, sort_keys=True))
    else:
        print(f"overall_decision={acceptance.overall_decision}")
        for gid, gate in sorted(acceptance.gates.items()):
            print(f"  {gid}: {gate.status}" + (f" ({gate.block_reason})" if gate.block_reason else ""))
        print(f"acceptance_artifact={paths.acceptance_json}")

    return 0 if acceptance.engineering_ready else 2


if __name__ == "__main__":
    sys.exit(main())
