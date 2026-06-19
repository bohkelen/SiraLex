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

from query_evidence.classify import build_candidates  # noqa: E402
from query_evidence.emit import (  # noqa: E402
    ANALYZER_VERSION,
    CandidateOutputError,
    build_summary_report,
    ensure_candidates_valid,
    is_synthetic_fixture_run,
    resolve_catalog_version,
    write_audit_markdown,
    write_candidates_jsonl,
    write_summary_json,
)
from query_evidence.ingest import (  # noqa: E402
    dedupe_query_events,
    load_query_log_exports,
    summarize_ingest,
)
from query_evidence.models import IngestStrictError  # noqa: E402
from query_evidence.replay import load_search_index, replay_query_groups  # noqa: E402

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
        default=None,
        help="Write ingest summary JSON to this path",
    )
    parser.add_argument(
        "--bundle",
        type=Path,
        default=None,
        help="Bundle directory containing search_index.jsonl",
    )
    parser.add_argument(
        "--catalog",
        type=Path,
        default=None,
        help="Optional catalog.json for catalog_version lookup",
    )
    parser.add_argument(
        "--output-summary",
        type=Path,
        default=None,
        help="Write phase7k_query_summary_v1 JSON to this path",
    )
    parser.add_argument(
        "--output-candidates",
        type=Path,
        default=None,
        help="Write candidate JSONL to this path",
    )
    parser.add_argument(
        "--output-report",
        type=Path,
        default=None,
        help="Write audit markdown report to this path",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Exit nonzero when parse/validation issues exist",
    )
    return parser


def _full_pipeline_requested(args: argparse.Namespace) -> bool:
    return any(
        value is not None
        for value in (
            args.bundle,
            args.output_summary,
            args.output_candidates,
            args.output_report,
        )
    )


def _validate_full_pipeline_args(args: argparse.Namespace) -> None:
    required = {
        "--bundle": args.bundle,
        "--output-summary": args.output_summary,
        "--output-candidates": args.output_candidates,
        "--output-report": args.output_report,
    }
    missing = [flag for flag, value in required.items() if value is None]
    if missing:
        raise SystemExit(
            "full pipeline requires all of "
            + ", ".join(missing)
        )


def run_full_pipeline(
    *,
    input_paths: list[Path],
    bundle_path: Path,
    catalog_path: Path | None,
    output_summary: Path,
    output_candidates: Path,
    output_report: Path,
    strict: bool = False,
    generated_at_iso: str | None = None,
    repo_root: Path | None = None,
    events=None,
    issues=None,
) -> int:
    repo_root = repo_root or REPO_ROOT
    if events is None or issues is None:
        try:
            events, issues = load_query_log_exports(input_paths, strict=strict)
        except IngestStrictError:
            return 1

    groups = dedupe_query_events(events)
    search_index_path = bundle_path / "search_index.jsonl"
    search_index = load_search_index(search_index_path)
    replay_results = replay_query_groups(search_index, groups)
    candidates = build_candidates(groups, replay_results)

    ingest_summary = summarize_ingest(events, issues)
    catalog_version = resolve_catalog_version(catalog_path, bundle_path.name)
    synthetic_fixture_run = is_synthetic_fixture_run(input_paths, repo_root)
    summary = build_summary_report(
        input_paths=input_paths,
        events=events,
        issues=issues,
        ingest_summary=ingest_summary,
        bundle_path=bundle_path,
        catalog_version=catalog_version,
        candidates=candidates,
        synthetic_fixture_run=synthetic_fixture_run,
        generated_at_iso=generated_at_iso,
        repo_root=repo_root,
    )

    try:
        ensure_candidates_valid(candidates)
        write_summary_json(output_summary, summary)
        write_candidates_jsonl(output_candidates, candidates)
        write_audit_markdown(
            output_report,
            summary=summary,
            candidates=candidates,
            issues=issues,
            groups=groups,
            repo_root=repo_root,
        )
    except CandidateOutputError:
        return 1

    return 0


def main(argv: list[str] | None = None) -> int:
    args = build_arg_parser().parse_args(argv)
    paths = [path.resolve() for path in args.inputs]
    full_pipeline = _full_pipeline_requested(args)

    if full_pipeline:
        _validate_full_pipeline_args(args)
    elif args.output_ingest_summary is None:
        raise SystemExit(
            "Provide --output-ingest-summary for ingest-only mode, or all full pipeline output flags."
        )

    try:
        events, issues = load_query_log_exports(paths, strict=args.strict)
    except IngestStrictError:
        return 1

    groups = dedupe_query_events(events)

    if args.output_ingest_summary is not None:
        report = build_ingest_report(events, issues, groups)
        args.output_ingest_summary.parent.mkdir(parents=True, exist_ok=True)
        args.output_ingest_summary.write_text(
            json.dumps(report, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )

    if full_pipeline:
        return run_full_pipeline(
            input_paths=paths,
            bundle_path=args.bundle.resolve(),
            catalog_path=args.catalog.resolve() if args.catalog else None,
            output_summary=args.output_summary.resolve(),
            output_candidates=args.output_candidates.resolve(),
            output_report=args.output_report.resolve(),
            strict=args.strict,
            repo_root=REPO_ROOT,
            events=events,
            issues=issues,
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
