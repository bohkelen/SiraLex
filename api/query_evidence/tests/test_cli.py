from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
API_ROOT = REPO_ROOT / "api"
FIXTURES = REPO_ROOT / "shared" / "query_evidence" / "fixtures"
GOLDEN_SUMMARY = FIXTURES / "tests" / "golden_full_summary.json"
GOLDEN_CANDIDATES = FIXTURES / "tests" / "golden_full_candidates.jsonl"
GOLDEN_AUDIT = FIXTURES / "tests" / "golden_full_audit.md"
BUNDLE = REPO_ROOT / "web/public/bundle_full_20260616_phase7j_alias_round2_candidate"
CATALOG = REPO_ROOT / "web/public/catalog.json"
CLI = REPO_ROOT / "scripts" / "analyze_query_evidence.py"
PRODUCTION_SUMMARY = REPO_ROOT / "shared/query_evidence/phase7k_query_summary.json"
PRODUCTION_CANDIDATES = REPO_ROOT / "shared/query_evidence/phase7k_query_candidates.jsonl"
PRODUCTION_AUDIT = REPO_ROOT / "docs/reports/phase7k_query_evidence_audit.md"
FIXED_GENERATED_AT = "2026-06-18T20:00:00.000Z"

if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

SCRIPTS_ROOT = REPO_ROOT / "scripts"
if str(SCRIPTS_ROOT) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_ROOT))

from query_evidence.emit import CandidateOutputError, write_candidates_jsonl  # noqa: E402
from query_evidence.models import QUERY_EVIDENCE_SCHEMA, QueryEvidenceCandidate, REVIEW_STATUS_CANDIDATE  # noqa: E402
import analyze_query_evidence  # noqa: E402


def _fixture(name: str) -> Path:
    return FIXTURES / name


def _run_cli(args: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(CLI), *args],
        cwd=REPO_ROOT,
        check=False,
        capture_output=True,
        text=True,
    )


def test_ingest_only_mode_still_writes_phase7k_ingest_summary_v1(tmp_path: Path):
    output = tmp_path / "ingest_summary.json"
    result = _run_cli(
        [
            "--input",
            str(_fixture("sample_export_v2.jsonl")),
            "--output-ingest-summary",
            str(output),
        ]
    )

    assert result.returncode == 0
    payload = json.loads(output.read_text(encoding="utf-8"))
    assert payload["schema_version"] == "phase7k_ingest_summary_v1"


def test_full_pipeline_writes_summary_candidates_audit_to_temp_paths(tmp_path: Path):
    summary = tmp_path / "summary.json"
    candidates = tmp_path / "candidates.jsonl"
    audit = tmp_path / "audit.md"
    result = _run_cli(
        [
            "--input",
            str(_fixture("sample_export_v2.jsonl")),
            "--input",
            str(_fixture("sample_export_mixed_v1_v2.jsonl")),
            "--bundle",
            str(BUNDLE),
            "--catalog",
            str(CATALOG),
            "--output-summary",
            str(summary),
            "--output-candidates",
            str(candidates),
            "--output-report",
            str(audit),
        ]
    )

    assert result.returncode == 0, result.stderr
    assert summary.exists()
    assert candidates.exists()
    assert audit.exists()


def test_full_pipeline_output_matches_golden_full_summary(tmp_path: Path):
    summary = tmp_path / "summary.json"
    candidates = tmp_path / "candidates.jsonl"
    audit = tmp_path / "audit.md"
    exit_code = analyze_query_evidence.run_full_pipeline(
        input_paths=[
            _fixture("sample_export_v2.jsonl"),
            _fixture("sample_export_mixed_v1_v2.jsonl"),
        ],
        bundle_path=BUNDLE,
        catalog_path=CATALOG,
        output_summary=summary,
        output_candidates=candidates,
        output_report=audit,
        generated_at_iso=FIXED_GENERATED_AT,
        repo_root=REPO_ROOT,
    )

    assert exit_code == 0
    generated = json.loads(summary.read_text(encoding="utf-8"))
    golden = json.loads(GOLDEN_SUMMARY.read_text(encoding="utf-8"))
    assert generated == golden


def test_full_pipeline_candidates_match_golden_full_candidates_jsonl(tmp_path: Path):
    summary = tmp_path / "summary.json"
    candidates = tmp_path / "candidates.jsonl"
    audit = tmp_path / "audit.md"
    analyze_query_evidence.run_full_pipeline(
        input_paths=[
            _fixture("sample_export_v2.jsonl"),
            _fixture("sample_export_mixed_v1_v2.jsonl"),
        ],
        bundle_path=BUNDLE,
        catalog_path=CATALOG,
        output_summary=summary,
        output_candidates=candidates,
        output_report=audit,
        generated_at_iso=FIXED_GENERATED_AT,
        repo_root=REPO_ROOT,
    )

    generated_lines = candidates.read_text(encoding="utf-8").splitlines()
    golden_lines = GOLDEN_CANDIDATES.read_text(encoding="utf-8").splitlines()
    assert generated_lines == golden_lines


def test_full_pipeline_audit_contains_stable_required_sections(tmp_path: Path):
    summary = tmp_path / "summary.json"
    candidates = tmp_path / "candidates.jsonl"
    audit = tmp_path / "audit.md"
    analyze_query_evidence.run_full_pipeline(
        input_paths=[
            _fixture("sample_export_v2.jsonl"),
            _fixture("sample_export_mixed_v1_v2.jsonl"),
        ],
        bundle_path=BUNDLE,
        catalog_path=CATALOG,
        output_summary=summary,
        output_candidates=candidates,
        output_report=audit,
        generated_at_iso=FIXED_GENERATED_AT,
        repo_root=REPO_ROOT,
    )

    generated = audit.read_text(encoding="utf-8")
    golden = GOLDEN_AUDIT.read_text(encoding="utf-8")
    assert generated == golden


def test_strict_mode_exits_nonzero_on_parse_error_fixture(tmp_path: Path):
    result = _run_cli(
        [
            "--input",
            str(_fixture("sample_export_parse_errors.jsonl")),
            "--output-ingest-summary",
            str(tmp_path / "ingest.json"),
            "--strict",
        ]
    )

    assert result.returncode == 1


def test_candidate_validation_failure_exits_nonzero(tmp_path: Path):
    candidate = QueryEvidenceCandidate(
        review_id="phase7k_evidence_0001",
        schema_version=QUERY_EVIDENCE_SCHEMA,
        query="fruit",
        search_direction="source_to_target",
        occurrence_count=1,
        first_seen="2026-06-01T00:00:00.000Z",
        last_seen="2026-06-02T00:00:00.000Z",
        current_result="hit (1)",
        gap_class="already_addressed",
        priority_score=0,
        priority_reasons=["monitor_only:no_action_required"],
        resolved_ir_ids=["7cdb6070ce427a6d"],
        evidence_sources=["query_log_export", "search_index_replay"],
        recommended_destination_artifact=None,
        review_status="approved",
        reason_not_to_apply_automatically="bad row",
        source_bundle_id="bundle-a",
        source_catalog_version=None,
        related_log_event_ids=["evt-1"],
    )

    with pytest.raises(CandidateOutputError):
        write_candidates_jsonl(tmp_path / "bad.jsonl", [candidate])


def test_candidate_validation_failure_does_not_write_full_pipeline_outputs(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
):
    summary = tmp_path / "summary.json"
    candidates_path = tmp_path / "candidates.jsonl"
    audit = tmp_path / "audit.md"

    def _bad_candidates(groups, replay_results):
        return [
            QueryEvidenceCandidate(
                review_id="phase7k_evidence_0001",
                schema_version=QUERY_EVIDENCE_SCHEMA,
                query="fruit",
                search_direction="source_to_target",
                occurrence_count=1,
                first_seen="2026-06-01T00:00:00.000Z",
                last_seen="2026-06-02T00:00:00.000Z",
                current_result="hit (1)",
                gap_class="already_addressed",
                priority_score=0,
                priority_reasons=["monitor_only:no_action_required"],
                resolved_ir_ids=["7cdb6070ce427a6d"],
                evidence_sources=["query_log_export", "search_index_replay"],
                recommended_destination_artifact=None,
                review_status="approved",
                reason_not_to_apply_automatically="bad row",
                source_bundle_id="bundle-a",
                source_catalog_version=None,
                related_log_event_ids=["evt-1"],
            )
        ]

    monkeypatch.setattr(analyze_query_evidence, "build_candidates", _bad_candidates)

    exit_code = analyze_query_evidence.run_full_pipeline(
        input_paths=[
            _fixture("sample_export_v2.jsonl"),
            _fixture("sample_export_mixed_v1_v2.jsonl"),
        ],
        bundle_path=BUNDLE,
        catalog_path=CATALOG,
        output_summary=summary,
        output_candidates=candidates_path,
        output_report=audit,
        generated_at_iso=FIXED_GENERATED_AT,
        repo_root=REPO_ROOT,
    )

    assert exit_code == 1
    assert not summary.exists()
    assert not candidates_path.exists()
    assert not audit.exists()


def test_production_named_output_paths_are_not_created_by_tests(tmp_path: Path):
    summary = tmp_path / "summary.json"
    candidates = tmp_path / "candidates.jsonl"
    audit = tmp_path / "audit.md"
    result = _run_cli(
        [
            "--input",
            str(_fixture("sample_export_v2.jsonl")),
            "--input",
            str(_fixture("sample_export_mixed_v1_v2.jsonl")),
            "--bundle",
            str(BUNDLE),
            "--catalog",
            str(CATALOG),
            "--output-summary",
            str(summary),
            "--output-candidates",
            str(candidates),
            "--output-report",
            str(audit),
        ]
    )

    assert result.returncode == 0
    assert not PRODUCTION_SUMMARY.exists()
    assert not PRODUCTION_CANDIDATES.exists()
    assert not PRODUCTION_AUDIT.exists()


def test_full_pipeline_summary_uses_basename_for_outside_repo_input(tmp_path: Path):
    export = tmp_path / "siralex-query-logs-20260618T191837Z.jsonl"
    export.write_text(
        _fixture("sample_export_v2.jsonl").read_text(encoding="utf-8"),
        encoding="utf-8",
    )
    summary = tmp_path / "summary.json"
    candidates = tmp_path / "candidates.jsonl"
    audit = tmp_path / "audit.md"
    exit_code = analyze_query_evidence.run_full_pipeline(
        input_paths=[export],
        bundle_path=BUNDLE,
        catalog_path=CATALOG,
        output_summary=summary,
        output_candidates=candidates,
        output_report=audit,
        generated_at_iso=FIXED_GENERATED_AT,
        repo_root=REPO_ROOT,
    )

    assert exit_code == 0
    payload = json.loads(summary.read_text(encoding="utf-8"))
    assert payload["inputs"][0]["path"] == "siralex-query-logs-20260618T191837Z.jsonl"
    assert "/tmp/" not in summary.read_text(encoding="utf-8")
