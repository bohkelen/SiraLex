from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
API_ROOT = REPO_ROOT / "api"
FIXTURES = REPO_ROOT / "shared" / "query_evidence" / "fixtures"
BUNDLE = REPO_ROOT / "web/public/bundle_full_20260616_phase7j_alias_round2_candidate"
CATALOG = REPO_ROOT / "web/public/catalog.json"
FIXED_GENERATED_AT = "2026-06-18T20:00:00.000Z"

if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from query_evidence.classify import build_candidates  # noqa: E402
from query_evidence.emit import (  # noqa: E402
    CandidateOutputError,
    build_summary_report,
    display_input_path,
    resolve_catalog_version,
    write_audit_markdown,
    write_candidates_jsonl,
    write_summary_json,
)
from query_evidence.ingest import dedupe_query_events, load_query_log_exports, summarize_ingest  # noqa: E402
from query_evidence.models import QUERY_EVIDENCE_SCHEMA, QueryEvidenceCandidate, REVIEW_STATUS_CANDIDATE  # noqa: E402
from query_evidence.replay import load_search_index, replay_query_groups  # noqa: E402


def _pipeline_data():
    input_paths = [
        FIXTURES / "sample_export_v2.jsonl",
        FIXTURES / "sample_export_mixed_v1_v2.jsonl",
    ]
    events, issues = load_query_log_exports(input_paths)
    groups = dedupe_query_events(events)
    search_index = load_search_index(BUNDLE / "search_index.jsonl")
    candidates = build_candidates(groups, replay_query_groups(search_index, groups))
    summary = build_summary_report(
        input_paths=input_paths,
        events=events,
        issues=issues,
        ingest_summary=summarize_ingest(events, issues),
        bundle_path=BUNDLE,
        catalog_version="norm-v3-featured-enriched-source-aliases-3-source-index-supplements-2",
        candidates=candidates,
        synthetic_fixture_run=True,
        generated_at_iso=FIXED_GENERATED_AT,
        repo_root=REPO_ROOT,
    )
    return input_paths, events, issues, groups, candidates, summary


def test_summary_json_contains_required_sections():
    _, _, _, _, _, summary = _pipeline_data()

    for key in (
        "schema_version",
        "generated_at_iso",
        "analyzer_version",
        "inputs",
        "replay",
        "ingest",
        "outcomes",
        "candidates",
        "privacy",
    ):
        assert key in summary


def test_summary_json_contains_no_query_strings():
    _, events, _, _, _, summary = _pipeline_data()

    dumped = json.dumps(summary, ensure_ascii=False)
    for event in events:
        assert event.query_raw not in dumped


def test_summary_json_contains_no_raw_session_bucket_id():
    _, _, _, _, _, summary = _pipeline_data()

    dumped = json.dumps(summary)
    assert "session_bucket_id" not in dumped
    assert "5f00937b-3de3-46c6-aa31-33e66137135c" not in dumped


def test_candidate_jsonl_writes_valid_json_lines(tmp_path: Path):
    _, _, _, _, candidates, _ = _pipeline_data()
    output = tmp_path / "candidates.jsonl"

    write_candidates_jsonl(output, candidates)

    lines = [json.loads(line) for line in output.read_text(encoding="utf-8").splitlines() if line.strip()]
    assert len(lines) == len(candidates)
    assert all(row["review_status"] == REVIEW_STATUS_CANDIDATE for row in lines)


def test_candidate_jsonl_validates_candidate_rows_before_writing(tmp_path: Path):
    _, _, _, _, candidates, _ = _pipeline_data()
    bad = QueryEvidenceCandidate(**{**candidates[0].to_dict(), "review_status": "approved"})
    output = tmp_path / "candidates.jsonl"

    with pytest.raises(CandidateOutputError):
        write_candidates_jsonl(output, [bad])

    assert not output.exists()


def test_audit_markdown_contains_required_sections(tmp_path: Path):
    _, _, issues, groups, candidates, summary = _pipeline_data()
    output = tmp_path / "audit.md"

    write_audit_markdown(
        output,
        summary=summary,
        candidates=candidates,
        issues=issues,
        groups=groups,
    )
    text = output.read_text(encoding="utf-8")

    for heading in (
        "# Phase 7K Query Evidence Audit",
        "## Run metadata",
        "## Ingest health",
        "## Aggregate outcomes",
        "## Candidate priority queues",
        "## Gap class breakdown",
        "## Candidate preview",
        "## Parse/validation issues",
        "## Privacy note",
        "## Non-goals",
    ):
        assert heading in text


def test_audit_markdown_states_candidate_only_and_no_auto_approval(tmp_path: Path):
    _, _, issues, groups, candidates, summary = _pipeline_data()
    output = tmp_path / "audit.md"
    write_audit_markdown(output, summary=summary, candidates=candidates, issues=issues, groups=groups)
    text = output.read_text(encoding="utf-8")

    assert REVIEW_STATUS_CANDIDATE in text
    assert "no auto-approval" in text.lower()


def test_audit_markdown_contains_privacy_note(tmp_path: Path):
    _, _, issues, groups, candidates, summary = _pipeline_data()
    output = tmp_path / "audit.md"
    write_audit_markdown(output, summary=summary, candidates=candidates, issues=issues, groups=groups)
    text = output.read_text(encoding="utf-8")

    assert "session_bucket_id" in text
    assert "must never be committed" in text


def test_write_summary_json_round_trip(tmp_path: Path):
    _, _, _, _, _, summary = _pipeline_data()
    output = tmp_path / "summary.json"
    write_summary_json(output, summary)
    loaded = json.loads(output.read_text(encoding="utf-8"))
    assert loaded == summary


def test_resolve_catalog_version_returns_none_for_malformed_catalog_json(tmp_path: Path):
    catalog = tmp_path / "catalog.json"
    catalog.write_text("{not json", encoding="utf-8")

    assert resolve_catalog_version(catalog, "bundle-a") is None


def test_resolve_catalog_version_returns_none_for_unexpected_catalog_shape(tmp_path: Path):
    catalog = tmp_path / "catalog.json"
    catalog.write_text(json.dumps({"bundles": "not-a-list"}), encoding="utf-8")

    assert resolve_catalog_version(catalog, "bundle-a") is None

    catalog.write_text(json.dumps({"bundles": [{"bundle_id": "bundle-a"}]}), encoding="utf-8")
    assert resolve_catalog_version(catalog, "bundle-a") is None

    catalog.write_text(json.dumps({"bundles": [{"bundle_id": "other", "version": "v1"}]}), encoding="utf-8")
    assert resolve_catalog_version(catalog, "bundle-a") is None


def test_display_input_path_outside_repo_emits_basename_only(tmp_path: Path):
    export = tmp_path / "private-export.jsonl"
    export.write_text("{}\n", encoding="utf-8")

    assert display_input_path(export, REPO_ROOT) == "private-export.jsonl"


def test_display_input_path_inside_repo_fixture_remains_repo_relative():
    fixture = FIXTURES / "sample_export_v2.jsonl"

    assert display_input_path(fixture, REPO_ROOT) == (
        "shared/query_evidence/fixtures/sample_export_v2.jsonl"
    )


def test_summary_json_contains_no_absolute_tmp_path_for_outside_repo_input(tmp_path: Path):
    export = tmp_path / "siralex-query-logs-real.jsonl"
    export.write_text(
        FIXTURES.joinpath("sample_export_v2.jsonl").read_text(encoding="utf-8"),
        encoding="utf-8",
    )
    events, issues = load_query_log_exports([export])
    groups = dedupe_query_events(events)
    search_index = load_search_index(BUNDLE / "search_index.jsonl")
    candidates = build_candidates(groups, replay_query_groups(search_index, groups))
    summary = build_summary_report(
        input_paths=[export],
        events=events,
        issues=issues,
        ingest_summary=summarize_ingest(events, issues),
        bundle_path=BUNDLE,
        catalog_version="norm-v3-featured-enriched-source-aliases-3-source-index-supplements-2",
        candidates=candidates,
        synthetic_fixture_run=False,
        generated_at_iso=FIXED_GENERATED_AT,
        repo_root=REPO_ROOT,
    )

    dumped = json.dumps(summary)
    assert summary["inputs"][0]["path"] == "siralex-query-logs-real.jsonl"
    assert "/tmp/" not in dumped
    assert str(tmp_path) not in dumped


def test_golden_fixture_summary_input_paths_remain_repo_relative():
    _, _, _, _, _, summary = _pipeline_data()

    assert summary["inputs"] == [
        {
            "path": "shared/query_evidence/fixtures/sample_export_v2.jsonl",
            "row_count": 5,
            "parse_errors": 0,
        },
        {
            "path": "shared/query_evidence/fixtures/sample_export_mixed_v1_v2.jsonl",
            "row_count": 3,
            "parse_errors": 0,
        },
    ]
