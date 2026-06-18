#!/usr/bin/env python3
"""Offline query evidence analyzer for exported SiraLex query logs."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
API_ROOT = REPO_ROOT / "api"
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from query_evidence.ingest import (  # noqa: E402
    dedupe_query_events,
    load_query_log_exports,
    summarize_ingest,
)
from query_evidence.models import IngestStrictError  # noqa: E402

INGEST_SUMMARY_SCHEMA = "phase7k_ingest_summary_v1"


def build_ingest_report(events, issues, groups) -> dict:
    return {
        "schema_version": INGEST_SUMMARY_SCHEMA,
        "ingest": summarize_ingest(events, issues).to_dict(),
        "issues": [issue.to_dict() for issue in issues],
        "dedupe_group_count": len(groups),
        "dedupe_groups": [group.to_dict() for group in groups],
    }


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--input",
        dest="inputs",
        action="append",
        type=Path,
        required=True,
        help="Exported query-log .jsonl file (repeatable)",
    )
    parser.add_argument(
        "--output-ingest-summary",
        type=Path,
        required=True,
        help="Write ingest summary JSON to this path",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Exit nonzero when parse/validation issues exist",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_arg_parser().parse_args(argv)
    paths = [path.resolve() for path in args.inputs]

    try:
        events, issues = load_query_log_exports(paths, strict=args.strict)
    except IngestStrictError:
        return 1

    groups = dedupe_query_events(events)
    report = build_ingest_report(events, issues, groups)

    args.output_ingest_summary.parent.mkdir(parents=True, exist_ok=True)
    args.output_ingest_summary.write_text(
        json.dumps(report, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
