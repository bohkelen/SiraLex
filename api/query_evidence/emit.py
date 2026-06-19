"""Emit query evidence analyzer outputs (summary, candidates, audit)."""

from __future__ import annotations

import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .models import (
    DedupedQueryGroup,
    IngestIssue,
    IngestSummary,
    QueryEvidenceCandidate,
    REVIEW_STATUS_CANDIDATE,
    UnifiedQueryEvent,
)
from .validate_output import validate_candidates

SUMMARY_SCHEMA = "phase7k_query_summary_v1"
ANALYZER_VERSION = "0.1.0"


class CandidateOutputError(Exception):
    """Raised when candidate validation fails before writing output."""


def ensure_candidates_valid(candidates: list[QueryEvidenceCandidate]) -> None:
    errors = validate_candidates(candidates)
    if errors:
        raise CandidateOutputError("; ".join(errors))


def priority_band(score: int) -> str:
    if score >= 70:
        return "P1"
    if score >= 40:
        return "P2"
    if score >= 1:
        return "P3"
    return "monitor"


def is_synthetic_fixture_run(input_paths: list[Path], repo_root: Path) -> bool:
    fixtures_root = (repo_root / "shared" / "query_evidence" / "fixtures").resolve()
    try:
        return all(path.resolve().is_relative_to(fixtures_root) for path in input_paths)
    except ValueError:
        return False


def resolve_catalog_version(catalog_path: Path | None, bundle_id: str) -> str | None:
    if catalog_path is None or not catalog_path.exists():
        return None
    try:
        payload = json.loads(catalog_path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        return None
    if not isinstance(payload, dict):
        return None
    bundles = payload.get("bundles")
    if not isinstance(bundles, list):
        return None
    for bundle in bundles:
        if not isinstance(bundle, dict):
            continue
        if bundle.get("bundle_id") != bundle_id:
            continue
        version = bundle.get("version")
        if isinstance(version, str) and version.strip():
            return version.strip()
        return None
    return None


def resolve_bundle_metadata(bundle_path: Path) -> dict[str, Any]:
    manifest_path = bundle_path / "bundle.manifest.json"
    if not manifest_path.exists():
        return {
            "norm_version": "norm_v3",
            "search_index_directional": True,
        }
    payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    rule_versions = payload.get("rule_versions") or {}
    norm_version = rule_versions.get("normalization")
    return {
        "norm_version": norm_version if isinstance(norm_version, str) else "norm_v3",
        "search_index_directional": bool(payload.get("search_index_directional", True)),
    }


def display_input_path(path: Path | str, repo_root: Path | None = None) -> str:
    resolved = Path(path).resolve()
    if repo_root is not None:
        try:
            return str(resolved.relative_to(repo_root.resolve()))
        except ValueError:
            return resolved.name
    if resolved.is_absolute():
        return resolved.name
    return str(path)


def _input_stats(
    input_paths: list[Path],
    issues: list[IngestIssue],
    repo_root: Path | None = None,
) -> list[dict[str, Any]]:
    stats: list[dict[str, Any]] = []
    for path in input_paths:
        resolved = path.resolve()
        row_count = 0
        with resolved.open("r", encoding="utf-8") as handle:
            for line in handle:
                if line.strip():
                    row_count += 1
        parse_errors = sum(
            1 for issue in issues if Path(issue.source_path).resolve() == resolved
        )
        stats.append(
            {
                "path": display_input_path(resolved, repo_root),
                "row_count": row_count,
                "parse_errors": parse_errors,
            }
        )
    return stats


def _logged_outcomes(events: list[UnifiedQueryEvent]) -> dict[str, int]:
    counts = Counter(event.result_status for event in events)
    return {
        "miss": counts.get("miss", 0),
        "hit_single": counts.get("hit_single", 0),
        "hit_multi": counts.get("hit_multi", 0),
        "deep_ladder_hits": sum(1 for event in events if event.matched_deep_ladder),
    }


def _candidate_stats(candidates: list[QueryEvidenceCandidate]) -> dict[str, Any]:
    by_gap_class = dict(sorted(Counter(candidate.gap_class for candidate in candidates).items()))
    bands = Counter(priority_band(candidate.priority_score) for candidate in candidates)
    return {
        "total": len(candidates),
        "by_gap_class": by_gap_class,
        "by_priority_band": {
            "P1": bands.get("P1", 0),
            "P2": bands.get("P2", 0),
            "P3": bands.get("P3", 0),
            "monitor": bands.get("monitor", 0),
        },
    }


def build_summary_report(
    *,
    input_paths: list[Path],
    events: list[UnifiedQueryEvent],
    issues: list[IngestIssue],
    ingest_summary: IngestSummary,
    bundle_path: Path,
    catalog_version: str | None,
    candidates: list[QueryEvidenceCandidate],
    synthetic_fixture_run: bool,
    generated_at_iso: str | None = None,
    repo_root: Path | None = None,
) -> dict[str, Any]:
    bundle_path = bundle_path.resolve()
    bundle_id = bundle_path.name
    bundle_metadata = resolve_bundle_metadata(bundle_path)
    timestamp = generated_at_iso or datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace(
        "+00:00", "Z"
    )

    if repo_root is not None:
        try:
            bundle_path_value = str(bundle_path.relative_to(repo_root.resolve()))
        except ValueError:
            bundle_path_value = str(bundle_path)
    else:
        bundle_path_value = str(bundle_path)

    return {
        "schema_version": SUMMARY_SCHEMA,
        "generated_at_iso": timestamp,
        "analyzer_version": ANALYZER_VERSION,
        "inputs": _input_stats(input_paths, issues, repo_root=repo_root),
        "replay": {
            "bundle_id": bundle_id,
            "bundle_path": bundle_path_value,
            "catalog_version": catalog_version,
            "norm_version": bundle_metadata["norm_version"],
            "search_index_directional": bundle_metadata["search_index_directional"],
        },
        "ingest": {
            "total_events": ingest_summary.total_events,
            "v1_events": ingest_summary.v1_events,
            "v2_events": ingest_summary.v2_events,
            "parse_errors": ingest_summary.issue_count,
            "duplicate_event_ids_dropped": ingest_summary.duplicate_event_ids_dropped,
            "distinct_queries": ingest_summary.distinct_queries,
            "distinct_tester_buckets_hashed": ingest_summary.distinct_session_bucket_hashes,
        },
        "outcomes": _logged_outcomes(events),
        "candidates": _candidate_stats(candidates),
        "privacy": {
            "raw_exports_committed": False,
            "session_bucket_handling": "sha256_prefix_8",
            "synthetic_fixture_run": synthetic_fixture_run,
        },
    }


def write_summary_json(path: Path, report: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def write_candidates_jsonl(path: Path, candidates: list[QueryEvidenceCandidate]) -> None:
    errors = validate_candidates(candidates)
    if errors:
        raise CandidateOutputError("; ".join(errors))

    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for candidate in candidates:
            handle.write(json.dumps(candidate.to_dict(), ensure_ascii=False) + "\n")


def _sorted_candidates(candidates: list[QueryEvidenceCandidate]) -> list[QueryEvidenceCandidate]:
    return sorted(
        candidates,
        key=lambda candidate: (
            -candidate.priority_score,
            candidate.query.casefold(),
            candidate.search_direction,
            candidate.review_id,
        ),
    )


def write_audit_markdown(
    path: Path,
    *,
    summary: dict[str, Any],
    candidates: list[QueryEvidenceCandidate],
    issues: list[IngestIssue],
    groups: list[DedupedQueryGroup],
    repo_root: Path | None = None,
) -> None:
    synthetic = summary["privacy"].get("synthetic_fixture_run", False)
    sorted_candidates = _sorted_candidates(candidates)
    bands: dict[str, list[QueryEvidenceCandidate]] = {
        "P1": [],
        "P2": [],
        "P3": [],
        "monitor": [],
    }
    for candidate in sorted_candidates:
        bands[priority_band(candidate.priority_score)].append(candidate)

    lines = [
        "# Phase 7K Query Evidence Audit",
        "",
        "## Run metadata",
        "",
        f"- Analyzer version: {summary['analyzer_version']}",
        f"- Generated at: {summary['generated_at_iso']}",
        f"- Schema version: {summary['schema_version']}",
        f"- Synthetic fixture run: {'yes' if synthetic else 'no'}",
        f"- Replay bundle: {summary['replay']['bundle_id']}",
        f"- Catalog version: {summary['replay'].get('catalog_version') or 'unknown'}",
        f"- Deduped query groups: {len(groups)}",
        f"- Candidate rows: {summary['candidates']['total']}",
        "",
        "## Ingest health",
        "",
        f"- Total events ingested: {summary['ingest']['total_events']}",
        f"- v1 events: {summary['ingest']['v1_events']}",
        f"- v2 events: {summary['ingest']['v2_events']}",
        f"- Parse/validation issues: {summary['ingest']['parse_errors']}",
        f"- Duplicate event IDs dropped: {summary['ingest']['duplicate_event_ids_dropped']}",
        f"- Distinct queries: {summary['ingest']['distinct_queries']}",
        f"- Distinct session bucket hashes: {summary['ingest']['distinct_tester_buckets_hashed']}",
        "",
        "## Aggregate outcomes",
        "",
        f"- Logged misses: {summary['outcomes']['miss']}",
        f"- Logged hit_single: {summary['outcomes']['hit_single']}",
        f"- Logged hit_multi: {summary['outcomes']['hit_multi']}",
        f"- Logged deep ladder hits: {summary['outcomes']['deep_ladder_hits']}",
        "",
        "## Candidate priority queues",
        "",
    ]

    for band_name in ("P1", "P2", "P3", "monitor"):
        band_candidates = bands[band_name]
        lines.append(f"### {band_name} ({len(band_candidates)} rows)")
        lines.append("")
        if not band_candidates:
            lines.append("_None._")
        else:
            for candidate in band_candidates:
                lines.append(
                    f"- `{candidate.review_id}` score={candidate.priority_score} "
                    f"query={candidate.query!r} direction={candidate.search_direction} "
                    f"gap_class={candidate.gap_class}"
                )
        lines.append("")

    lines.extend(
        [
            "## Gap class breakdown",
            "",
        ]
    )
    for gap_class, count in summary["candidates"]["by_gap_class"].items():
        lines.append(f"- {gap_class}: {count}")
    lines.append("")

    lines.extend(["## Candidate preview", ""])
    for candidate in sorted_candidates:
        lines.append(
            f"- `{candidate.review_id}` | score={candidate.priority_score} | "
            f"{candidate.query!r} | {candidate.search_direction} | "
            f"{candidate.gap_class} | {candidate.current_result}"
        )
    lines.append("")

    lines.extend(["## Parse/validation issues", ""])
    if not issues:
        lines.append("_None._")
    else:
        for issue in issues:
            issue_path = display_input_path(issue.source_path, repo_root)
            lines.append(
                f"- `{issue.code}` line {issue.line_number} in `{issue_path}`: {issue.message}"
            )
    lines.append("")

    lines.extend(
        [
            "## Privacy note",
            "",
            "- Raw `session_bucket_id` values are never emitted in summary JSON.",
            "- Summary JSON omits query text; candidate JSONL and this audit may include query text for review.",
            "- Raw tester exports must never be committed to the repository.",
            "",
            "## Non-goals",
            "",
            f"- All candidate rows remain `{REVIEW_STATUS_CANDIDATE}`; no auto-approval is performed.",
            "- This audit is a review packet only; it does not apply aliases, supplements, or phrase changes.",
            "- Production-named evidence artifacts require explicit maintainer approval after real export review.",
            "",
        ]
    )

    if synthetic:
        ingest_index = lines.index("## Ingest health")
        lines.insert(ingest_index + 2, "- This run used synthetic fixture inputs under `shared/query_evidence/fixtures/`.")

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines), encoding="utf-8")
