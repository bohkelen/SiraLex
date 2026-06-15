#!/usr/bin/env python3
"""Summarize exported SiraLex query-log JSONL files.

The script is intentionally stdlib-only so tester exports can be analyzed
outside the app without setting up the web toolchain.
"""

from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable


CLASSIFICATION_OPTIONS = [
    "phrase_mismatch",
    "missing_entry",
    "index_gap",
    "language_mismatch",
    "spelling_error",
]


@dataclass(frozen=True)
class QueryLogRow:
    query_raw: str
    direction: str
    ladder_level_hit: str
    ir_ids_count: int
    bundle_id: str
    bundle_version: str | None
    norm_version: str
    app_version: str | None
    timestamp_iso: str | None
    source_path: str
    line_number: int

    @property
    def hit(self) -> bool:
        return self.ir_ids_count > 0

    @property
    def query_key(self) -> tuple[str, str]:
        return (self.query_raw.strip().casefold(), self.direction)


def _string_or_none(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        return value
    return str(value)


def parse_jsonl(paths: Iterable[Path]) -> tuple[list[QueryLogRow], list[dict[str, Any]]]:
    rows: list[QueryLogRow] = []
    errors: list[dict[str, Any]] = []

    for path in paths:
        with path.open("r", encoding="utf-8") as handle:
            for line_number, line in enumerate(handle, start=1):
                text = line.strip()
                if not text:
                    continue
                try:
                    payload = json.loads(text)
                    rows.append(
                        QueryLogRow(
                            query_raw=str(payload["query_raw"]),
                            direction=str(payload["direction"]),
                            ladder_level_hit=str(payload["ladder_level_hit"]),
                            ir_ids_count=int(payload["ir_ids_count"]),
                            bundle_id=str(payload["bundle_id"]),
                            bundle_version=_string_or_none(payload.get("bundle_version")),
                            norm_version=str(payload["norm_version"]),
                            app_version=_string_or_none(payload.get("app_version")),
                            timestamp_iso=_string_or_none(payload.get("timestamp_iso")),
                            source_path=str(path),
                            line_number=line_number,
                        )
                    )
                except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
                    errors.append(
                        {
                            "path": str(path),
                            "line_number": line_number,
                            "error": str(exc),
                        }
                    )

    return rows, errors


def _rate(numerator: int, denominator: int) -> float:
    if denominator == 0:
        return 0.0
    return round(numerator / denominator, 4)


def _top_counter(counter: Counter[str], limit: int) -> list[dict[str, Any]]:
    return [{"value": value, "count": count} for value, count in counter.most_common(limit)]


def _manual_candidate_reasons(row: QueryLogRow, repeated_count: int) -> list[str]:
    reasons = ["miss"]
    if repeated_count > 1:
        reasons.append("repeated_miss")
    if len(row.query_raw.split()) > 1:
        reasons.append("phrase_like")
    return reasons


def summarize(rows: list[QueryLogRow], errors: list[dict[str, Any]], top: int = 20) -> dict[str, Any]:
    total = len(rows)
    hits = sum(1 for row in rows if row.hit)
    misses = total - hits

    ladder_distribution = Counter(row.ladder_level_hit for row in rows)
    direction_split = Counter(row.direction for row in rows)
    bundle_ids = Counter(row.bundle_id for row in rows)
    bundle_versions = Counter(row.bundle_version or "(missing)" for row in rows)
    norm_versions = Counter(row.norm_version for row in rows)
    app_versions = Counter(row.app_version or "(missing)" for row in rows)
    unique_query_keys = {row.query_key for row in rows}

    miss_counts: Counter[tuple[str, str]] = Counter(row.query_key for row in rows if not row.hit)
    miss_examples: dict[tuple[str, str], QueryLogRow] = {}
    for row in rows:
        if not row.hit and row.query_key not in miss_examples:
            miss_examples[row.query_key] = row

    repeated_misses = [
        {
            "query": miss_examples[key].query_raw,
            "direction": key[1],
            "count": count,
        }
        for key, count in miss_counts.most_common()
        if count > 1
    ][:top]

    manual_candidates = []
    for key, count in miss_counts.most_common(top):
        row = miss_examples[key]
        manual_candidates.append(
            {
                "query": row.query_raw,
                "direction": row.direction,
                "miss_count": count,
                "candidate_reasons": _manual_candidate_reasons(row, count),
                "classification_options": CLASSIFICATION_OPTIONS,
                "bundle_id": row.bundle_id,
                "bundle_version": row.bundle_version,
                "norm_version": row.norm_version,
                "first_seen": {
                    "path": row.source_path,
                    "line_number": row.line_number,
                    "timestamp_iso": row.timestamp_iso,
                },
            }
        )

    return {
        "total_queries": total,
        "hits": hits,
        "misses": misses,
        "hit_rate": _rate(hits, total),
        "miss_rate": _rate(misses, total),
        "unique_queries": len(unique_query_keys),
        "ladder_level_distribution": _top_counter(ladder_distribution, top),
        "direction_split": _top_counter(direction_split, top),
        "repeated_misses": repeated_misses,
        "bundle_ids": _top_counter(bundle_ids, top),
        "bundle_versions": _top_counter(bundle_versions, top),
        "norm_versions": _top_counter(norm_versions, top),
        "app_versions": _top_counter(app_versions, top),
        "manual_classification_candidates": manual_candidates,
        "classification_options": CLASSIFICATION_OPTIONS,
        "parse_errors": errors,
    }


def _markdown_section(title: str, items: list[dict[str, Any]]) -> list[str]:
    lines = [f"## {title}"]
    if not items:
        return lines + ["- none"]
    for item in items:
        value = item.get("value", item.get("query", ""))
        details = []
        for key, val in item.items():
            if key in {"value", "query"}:
                continue
            details.append(f"{key}={val}")
        suffix = f" ({', '.join(details)})" if details else ""
        lines.append(f"- `{value}`{suffix}")
    return lines


def render_markdown(summary: dict[str, Any]) -> str:
    lines = [
        "# SiraLex Query-Log Summary",
        "",
        f"- Total queries: {summary['total_queries']}",
        f"- Hits: {summary['hits']} ({summary['hit_rate']:.2%})",
        f"- Misses: {summary['misses']} ({summary['miss_rate']:.2%})",
        f"- Unique query/direction pairs: {summary['unique_queries']}",
        "",
    ]
    lines += _markdown_section("Ladder-Level Distribution", summary["ladder_level_distribution"])
    lines += [""] + _markdown_section("Direction Split", summary["direction_split"])
    lines += [""] + _markdown_section("Repeated Misses", summary["repeated_misses"])
    lines += [""] + _markdown_section("Bundle Versions", summary["bundle_versions"])
    lines += [""] + _markdown_section("Norm Versions", summary["norm_versions"])
    lines += ["", "## Manual Classification Queue"]
    if not summary["manual_classification_candidates"]:
        lines.append("- none")
    else:
        for item in summary["manual_classification_candidates"]:
            lines.append(
                "- "
                f"`{item['query']}` "
                f"direction={item['direction']} "
                f"miss_count={item['miss_count']} "
                f"reasons={','.join(item['candidate_reasons'])}"
            )
    if summary["parse_errors"]:
        lines += ["", "## Parse Errors"]
        for error in summary["parse_errors"]:
            lines.append(f"- `{error['path']}` line {error['line_number']}: {error['error']}")
    return "\n".join(lines) + "\n"


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("jsonl", nargs="+", type=Path, help="Exported query-log .jsonl file(s)")
    parser.add_argument("--top", type=int, default=20, help="Maximum rows in ranked sections")
    parser.add_argument("--format", choices=["json", "markdown"], default="json")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_arg_parser().parse_args(argv)
    rows, errors = parse_jsonl(args.jsonl)
    summary = summarize(rows, errors, top=max(1, args.top))
    if args.format == "markdown":
        print(render_markdown(summary), end="")
    else:
        print(json.dumps(summary, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
