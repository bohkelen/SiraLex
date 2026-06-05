"""Report writers for source-index gap discovery."""

from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Any

from .models import CandidateRow, DiscoveryReport

JSONL_FILENAME = "source_index_gap_candidates.jsonl"
CSV_FILENAME = "source_index_gap_candidates.csv"
SUMMARY_FILENAME = "source_index_gap_summary.md"


def write_jsonl(path: Path, rows: list[CandidateRow]) -> None:
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row.to_dict(), ensure_ascii=False, sort_keys=True) + "\n")


def _csv_value(value: Any) -> str:
    if isinstance(value, (list, dict)):
        return json.dumps(value, ensure_ascii=False, sort_keys=True)
    return str(value)


def write_csv(path: Path, rows: list[CandidateRow]) -> None:
    fieldnames = [
        "candidate_french_term",
        "normalized_source_key",
        "current_lookup_behavior",
        "evidence_glosses",
        "target_forms",
        "target_ir_ids",
        "related_existing_source_mappings",
        "candidate_type",
        "confidence",
        "score",
        "score_reasons",
        "actionability",
        "review_tier",
        "canonical_candidate_term",
        "observed_variants",
        "plural_linked_to",
        "evidence_rollup",
        "group_candidate_types",
        "group_review_tier",
        "group_actionability",
        "proposed_representation",
        "review_needed",
        "implementation_decision",
    ]
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow({key: _csv_value(value) for key, value in row.to_dict().items()})


def write_summary(path: Path, report: DiscoveryReport) -> None:
    def top_rows(
        *,
        tier: str | None = None,
        candidate_type: str | None = None,
        actionability: str | None = None,
        limit: int = 20,
    ) -> list[CandidateRow]:
        rows = report.rows
        if tier is not None:
            rows = [row for row in rows if row.review_tier == tier]
        if candidate_type is not None:
            rows = [row for row in rows if row.candidate_type == candidate_type]
        if actionability is not None:
            rows = [row for row in rows if row.actionability == actionability]
        return rows[:limit]

    def append_rows(lines: list[str], rows: list[CandidateRow]) -> None:
        if not rows:
            lines.append("- none")
            return
        for row in rows:
            variants = ""
            if len(row.observed_variants) > 1:
                variants = f"; variants: {', '.join(row.observed_variants)}"
            lines.append(
                "- "
                f"`{row.candidate_french_term}` "
                f"({row.candidate_type}, {row.review_tier}, {row.confidence}, "
                f"score {row.score}, {row.actionability}{variants})"
            )

    lines = [
        "# Source-Index Gap Discovery Summary",
        "",
        f"- Bundle: `{report.bundle_id}`",
        f"- Content SHA-256: `{report.manifest_content_sha256}`",
        f"- Total candidates: `{report.total_candidates}`",
        "",
        "## Candidates by Type",
        "",
    ]
    for key, count in sorted(report.candidates_by_type.items()):
        lines.append(f"- `{key}`: {count}")
    lines.extend(["", "## Candidates by Actionability", ""])
    for key, count in sorted(report.candidates_by_actionability.items()):
        lines.append(f"- `{key}`: {count}")
    lines.extend(["", "## Candidates by Review Tier", ""])
    for key, count in sorted(report.candidates_by_review_tier.items()):
        lines.append(f"- `{key}`: {count}")

    sections = [
        (
            "Top Tier 1 Candidates",
            top_rows(tier="tier_1_strong_candidate", limit=25),
        ),
        (
            "Top Missing Standalone Candidates",
            top_rows(candidate_type="missing_standalone_source_term", limit=20),
        ),
        (
            "Top Missing Umbrella Candidates",
            top_rows(candidate_type="missing_broad_umbrella_term", limit=20),
        ),
        (
            "Top Plural/Form Recall Candidates",
            top_rows(candidate_type="plural_form_gap", limit=30),
        ),
        (
            "Top Suspected Incomplete Existing Mappings",
            top_rows(candidate_type="suspected_incomplete_existing_source_mapping", limit=20),
        ),
        (
            "Existing Source Terms With Related Phrases",
            top_rows(candidate_type="existing_source_with_related_phrases", limit=20),
        ),
        (
            "Evidence-Only Modifier List",
            top_rows(candidate_type="modifier_or_low_value_term", actionability="evidence_only", limit=30),
        ),
    ]
    for title, rows in sections:
        lines.extend(["", f"## {title}", ""])
        append_rows(lines, rows)

    noise_count = report.candidates_by_actionability.get("noise", 0)
    lines.extend(["", "## Noise Count", "", f"- `{noise_count}`"])
    lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")


def write_report(output_dir: Path, report: DiscoveryReport) -> dict[str, Path]:
    """Write all report artifacts to an explicit caller-provided directory."""
    output_dir.mkdir(parents=True, exist_ok=True)
    paths = {
        "jsonl": output_dir / JSONL_FILENAME,
        "csv": output_dir / CSV_FILENAME,
        "summary": output_dir / SUMMARY_FILENAME,
    }
    write_jsonl(paths["jsonl"], report.rows)
    write_csv(paths["csv"], report.rows)
    write_summary(paths["summary"], report)
    return paths
