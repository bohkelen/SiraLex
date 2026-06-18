from __future__ import annotations

import hashlib
import json
import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
API_ROOT = REPO_ROOT / "api"
FIXTURES = REPO_ROOT / "shared" / "query_evidence" / "fixtures"
GOLDEN = FIXTURES / "tests" / "golden_ingest_summary.json"

if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

SCRIPTS_ROOT = REPO_ROOT / "scripts"
if str(SCRIPTS_ROOT) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_ROOT))

from query_evidence.ingest import (  # noqa: E402
    dedupe_query_events,
    load_query_log_exports,
    summarize_ingest,
)
from query_evidence.models import IngestStrictError, QUERY_LOG_EVENT_V2  # noqa: E402
import analyze_query_evidence  # noqa: E402


def _fixture(name: str) -> Path:
    return FIXTURES / name


def test_v2_fixture_parses_valid_events():
    events, issues = load_query_log_exports([_fixture("sample_export_v2.jsonl")])

    assert not issues
    assert len(events) == 5
    assert all(event.schema_version == QUERY_LOG_EVENT_V2 for event in events)
    assert {event.query_raw for event in events} == {
        "fruit",
        "mère",
        "zzzz-nohit-test",
        "bon-jour",
    }
    deep = next(event for event in events if event.query_raw == "bon-jour")
    assert deep.matched_deep_ladder is True
    assert deep.matched_key_type == "punct_stripped"


def test_mixed_fixture_parses_and_dedupes():
    events, issues = load_query_log_exports([_fixture("sample_export_mixed_v1_v2.jsonl")])

    assert not issues
    assert len(events) == 3
    groups = dedupe_query_events(events)
    bonjour = next(group for group in groups if group.query_casefold == "bonjour")
    assert bonjour.occurrence_count == 2
    assert bonjour.result_status_counts == {"hit_single": 2}
    assert len(groups) == 2


def test_parse_errors_collected_in_non_strict_mode():
    events, issues = load_query_log_exports([_fixture("sample_export_parse_errors.jsonl")])

    assert len(events) == 1
    assert events[0].query_raw == "valid-row"
    assert len(issues) == 3
    assert {issue.code for issue in issues} == {
        "malformed_json",
        "unknown_schema_version",
        "missing_required_field",
    }


def test_strict_mode_raises_on_parse_errors():
    with pytest.raises(IngestStrictError) as exc:
        load_query_log_exports([_fixture("sample_export_parse_errors.jsonl")], strict=True)

    assert len(exc.value.issues) == 3


def test_unknown_schema_is_skipped_with_issue(tmp_path: Path):
    export = tmp_path / "unknown.jsonl"
    export.write_text(
        '{"schema_version":"query_log_event_v9","query_raw":"x","direction":"source_to_target"}\n',
        encoding="utf-8",
    )

    events, issues = load_query_log_exports([export])

    assert events == []
    assert len(issues) == 1
    assert issues[0].code == "unknown_schema_version"


def test_empty_query_is_skipped_with_issue(tmp_path: Path):
    export = tmp_path / "empty.jsonl"
    export.write_text(
        json.dumps(
            {
                "schema_version": "query_log_event_v2",
                "event_id": "evt-empty",
                "timestamp_iso": "2026-06-18T00:00:00.000Z",
                "app_version": "0.0.0",
                "bundle_id": "bundle-a",
                "norm_version": "norm_v3",
                "query_raw": "   ",
                "direction": "source_to_target",
                "result_status": "miss",
                "result_count": 0,
                "matched_key_type": "none",
                "matched_key": None,
                "matched_deep_ladder": False,
                "top_ir_ids": [],
                "session_bucket_id": "bucket-1",
                "logging_enabled": True,
                "consent_version": "phase7k_tester_consent_v1",
            }
        )
        + "\n",
        encoding="utf-8",
    )

    events, issues = load_query_log_exports([export])

    assert events == []
    assert issues[0].code == "empty_query_raw"


def test_dedupe_combines_same_query_direction_bundle(tmp_path: Path):
    export = tmp_path / "dup.jsonl"
    rows = [
        {
            "schema_version": "query_log_event_v2",
            "event_id": "evt-a",
            "timestamp_iso": "2026-06-01T00:00:00.000Z",
            "app_version": "0.0.0",
            "bundle_id": "bundle-a",
            "norm_version": "norm_v3",
            "query_raw": "fruit",
            "direction": "source_to_target",
            "result_status": "hit_single",
            "result_count": 1,
            "matched_key_type": "casefold",
            "matched_key": "fruit",
            "matched_deep_ladder": False,
            "top_ir_ids": ["ir-1"],
            "session_bucket_id": "bucket-1",
            "logging_enabled": True,
            "consent_version": "phase7k_tester_consent_v1",
        },
        {
            "schema_version": "query_log_event_v2",
            "event_id": "evt-b",
            "timestamp_iso": "2026-06-02T00:00:00.000Z",
            "app_version": "0.0.0",
            "bundle_id": "bundle-a",
            "norm_version": "norm_v3",
            "query_raw": "fruit",
            "direction": "source_to_target",
            "result_status": "hit_single",
            "result_count": 1,
            "matched_key_type": "casefold",
            "matched_key": "fruit",
            "matched_deep_ladder": False,
            "top_ir_ids": ["ir-1"],
            "session_bucket_id": "bucket-2",
            "logging_enabled": True,
            "consent_version": "phase7k_tester_consent_v1",
        },
    ]
    export.write_text("\n".join(json.dumps(row) for row in rows) + "\n", encoding="utf-8")

    events, _ = load_query_log_exports([export])
    groups = dedupe_query_events(events)

    assert len(groups) == 1
    assert groups[0].occurrence_count == 2


def test_dedupe_does_not_combine_same_query_across_direction(tmp_path: Path):
    export = tmp_path / "directions.jsonl"
    rows = []
    for idx, direction in enumerate(["source_to_target", "target_to_source"], start=1):
        rows.append(
            {
                "schema_version": "query_log_event_v2",
                "event_id": f"evt-{idx}",
                "timestamp_iso": f"2026-06-0{idx}T00:00:00.000Z",
                "app_version": "0.0.0",
                "bundle_id": "bundle-a",
                "norm_version": "norm_v3",
                "query_raw": "Kun",
                "direction": direction,
                "result_status": "hit_single",
                "result_count": 1,
                "matched_key_type": "casefold",
                "matched_key": "kun",
                "matched_deep_ladder": False,
                "top_ir_ids": ["ir-1"],
                "session_bucket_id": "bucket-1",
                "logging_enabled": True,
                "consent_version": "phase7k_tester_consent_v1",
            }
        )
    export.write_text("\n".join(json.dumps(row) for row in rows) + "\n", encoding="utf-8")

    groups = dedupe_query_events(load_query_log_exports([export])[0])

    assert len(groups) == 2


def test_session_bucket_id_is_hashed_and_not_exposed_raw():
    events, _ = load_query_log_exports([_fixture("sample_export_v2.jsonl")])

    assert all(event.session_bucket_hash == "5bfe1fbf" for event in events)
    dumped = json.dumps([event.to_dict() for event in events])
    assert "session_bucket_id" not in dumped
    assert "5f00937b-3de3-46c6-aa31-33e66137135c" not in dumped


def test_v1_row_has_null_matched_key_and_derived_deep_ladder(tmp_path: Path):
    export = tmp_path / "v1.jsonl"
    export.write_text(
        json.dumps(
            {
                "schema_version": "query_log_event_v1",
                "query_raw": "test",
                "query_normalized_keys": {
                    "casefold": ["test"],
                    "diacritics_insensitive": ["test"],
                    "punct_stripped": ["test"],
                    "nospace": ["test"],
                },
                "direction": "source_to_target",
                "ladder_level_hit": "nospace",
                "ir_ids_count": 1,
                "bundle_id": "bundle-a",
                "norm_version": "norm_v3",
                "timestamp_iso": "2026-06-01T00:00:00.000Z",
                "logging_enabled": True,
            }
        )
        + "\n",
        encoding="utf-8",
    )

    event = load_query_log_exports([export])[0][0]

    assert event.matched_key is None
    assert event.matched_deep_ladder is True
    assert event.matched_key_type == "nospace"


def test_v1_synthetic_event_id_without_log_id_is_deterministic(tmp_path: Path):
    export = tmp_path / "no_log_id.jsonl"
    payload = {
        "schema_version": "query_log_event_v1",
        "query_raw": "stable-id-test",
        "query_normalized_keys": {
            "casefold": ["stable-id-test"],
            "diacritics_insensitive": ["stable-id-test"],
            "punct_stripped": ["stable-id-test"],
            "nospace": ["stableidtest"],
        },
        "direction": "source_to_target",
        "ladder_level_hit": "casefold",
        "ir_ids_count": 0,
        "bundle_id": "bundle-a",
        "norm_version": "norm_v3",
        "timestamp_iso": "2026-06-01T00:00:00.000Z",
        "logging_enabled": True,
    }
    export.write_text(json.dumps(payload) + "\n", encoding="utf-8")

    first_id = load_query_log_exports([export])[0][0].event_id
    second_id = load_query_log_exports([export])[0][0].event_id

    assert first_id == second_id
    assert first_id.startswith("v1:no_log_id.jsonl:1:")

    payload_json = json.dumps(payload, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    expected_suffix = hashlib.sha256(payload_json.encode("utf-8")).hexdigest()[:12]
    suffix = first_id.rsplit(":", 1)[-1]
    assert len(suffix) == 12
    assert suffix == expected_suffix
    assert first_id == f"v1:no_log_id.jsonl:1:{expected_suffix}"


def test_cli_writes_ingest_summary_json(tmp_path: Path):
    output = tmp_path / "ingest_summary.json"
    result = subprocess.run(
        [
            sys.executable,
            str(REPO_ROOT / "scripts" / "analyze_query_evidence.py"),
            "--input",
            str(_fixture("sample_export_v2.jsonl")),
            "--output-ingest-summary",
            str(output),
        ],
        cwd=REPO_ROOT,
        check=False,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0
    payload = json.loads(output.read_text(encoding="utf-8"))
    assert payload["schema_version"] == "phase7k_ingest_summary_v1"
    assert payload["ingest"]["total_events"] == 5


def test_cli_strict_mode_exits_nonzero_on_parse_error_fixture():
    result = subprocess.run(
        [
            sys.executable,
            str(REPO_ROOT / "scripts" / "analyze_query_evidence.py"),
            "--input",
            str(_fixture("sample_export_parse_errors.jsonl")),
            "--output-ingest-summary",
            "/tmp/phase7k_parse_summary_strict.json",
            "--strict",
        ],
        cwd=REPO_ROOT,
        check=False,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 1


def test_golden_ingest_summary_matches_fixture_output():
    events, issues = load_query_log_exports(
        [
            _fixture("sample_export_v2.jsonl"),
            _fixture("sample_export_mixed_v1_v2.jsonl"),
        ]
    )
    groups = dedupe_query_events(events)
    report = analyze_query_evidence.build_ingest_report(events, issues, groups)
    golden = json.loads(GOLDEN.read_text(encoding="utf-8"))

    assert report == golden
    dumped = json.dumps(report)
    assert "session_bucket_id" not in dumped
    assert "5f00937b-3de3-46c6-aa31-33e66137135c" not in dumped


def test_summarize_ingest_counts_distinct_queries():
    events, issues = load_query_log_exports(
        [
            _fixture("sample_export_v2.jsonl"),
            _fixture("sample_export_mixed_v1_v2.jsonl"),
        ]
    )
    summary = summarize_ingest(events, issues)

    assert summary.total_events == 8
    assert summary.v1_events == 1
    assert summary.v2_events == 7
    assert summary.distinct_queries == 6
    assert summary.distinct_session_bucket_hashes == 1
