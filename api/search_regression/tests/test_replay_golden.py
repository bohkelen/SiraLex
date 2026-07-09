from __future__ import annotations

import json
import subprocess
import sys
import unicodedata
from dataclasses import replace
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
API_ROOT = REPO_ROOT / "api"
MATRIX_PATH = REPO_ROOT / "shared/search_regression/search_regression_matrix_v1.jsonl"
MANIFEST_PATH = REPO_ROOT / "shared/search_regression/matrix_manifest_v1.json"
MATRIX_7N2A_PATH = REPO_ROOT / "shared/search_regression/search_regression_matrix_7n2a_v1.jsonl"
MANIFEST_7N2A_PATH = REPO_ROOT / "shared/search_regression/matrix_manifest_7n2a_v1.json"
GOLDEN_PATH = REPO_ROOT / "shared/search_regression/tests/golden_python_replay_v1.json"
BUNDLE_PATH = REPO_ROOT / "web/public/bundle_full_20260616_phase7j_alias_round2_candidate"
CATALOG_PATH = REPO_ROOT / "web/public/catalog.json"
CLI_PATH = REPO_ROOT / "scripts/run_search_regression.py"

if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from search_regression.replay import (  # noqa: E402
    BundleMetadataError,
    SearchIndexChecksumError,
    run_search_regression,
    set_search_keys_fn,
)
from search_regression.schema import SearchRegressionCase, load_matrix_jsonl, load_matrix_manifest  # noqa: E402
from search_regression.validate_matrix import KUN_NFD  # noqa: E402

EMPTY_LADDER_KEYS = {
    "casefold": [],
    "diacritics_insensitive": [],
    "punct_stripped": [],
    "nospace": [],
}


def _run_regression(**overrides):
    kwargs = {
        "matrix_path": MATRIX_PATH,
        "manifest_path": MANIFEST_PATH,
        "bundle_path": BUNDLE_PATH,
        "catalog_path": CATALOG_PATH,
    }
    kwargs.update(overrides)
    return run_search_regression(**kwargs)


def _case_by_id(result, case_id: str):
    for case in result.cases:
        if case.case_id == case_id:
            return case
    raise AssertionError(f"missing case {case_id!r}")


def _actual_fields(case_result) -> dict:
    return {
        "actual_result_status": case_result.actual_result_status,
        "actual_result_count": case_result.actual_result_count,
        "actual_ir_ids": case_result.actual_ir_ids,
        "actual_matched_key_type": case_result.actual_matched_key_type,
        "actual_matched_key": case_result.actual_matched_key,
        "actual_deep_ladder": case_result.actual_deep_ladder,
    }


@pytest.fixture(scope="module")
def committed_result():
    return _run_regression()


@pytest.fixture(scope="module")
def golden_payload():
    return json.loads(GOLDEN_PATH.read_text(encoding="utf-8"))


def test_committed_matrix_replays_successfully(committed_result):
    assert committed_result.matrix_case_count == 13
    assert committed_result.all_passed


def test_result_equals_golden_python_replay(committed_result, golden_payload):
    assert committed_result.to_dict() == golden_payload


def test_all_thirteen_cases_pass_with_zero_failures(committed_result):
    assert committed_result.passed_case_count == 13
    assert committed_result.failed_case_count == 0
    assert all(case.expected_match for case in committed_result.cases)
    assert all(not case.mismatches for case in committed_result.cases)


def test_grand_parents_preserves_exact_ordered_two_id_result(committed_result):
    case = _case_by_id(committed_result, "sr7l_003_grand_parents_alias")
    assert case.actual_ir_ids == ["1f6d3a5919110b21", "957bd76b41fda053"]


def test_mere_preserves_exact_ordered_three_id_result(committed_result):
    case = _case_by_id(committed_result, "sr7l_004_mere_multi")
    assert case.actual_ir_ids == [
        "0f517a71c373f51d",
        "d540716db9321a83",
        "e5164efcdf5e6ca4",
    ]


def test_kun_nfc_and_nfd_produce_same_actual_result_fields(committed_result):
    nfc = _case_by_id(committed_result, "sr7l_012_kun_accent_ambiguity")
    nfd = _case_by_id(committed_result, "sr7l_013_kun_decomposed_unicode")
    assert _actual_fields(nfc) == _actual_fields(nfd)


def _replay_with_search_key_spy(case: SearchRegressionCase) -> list[str]:
    observed: list[str] = []

    def capture_search_keys(queries: list[str]) -> dict[str, list[str]]:
        observed.extend(queries)
        return dict(EMPTY_LADDER_KEYS)

    from search_regression.replay import load_search_index, replay_case  # noqa: E402

    set_search_keys_fn(capture_search_keys)
    try:
        index = load_search_index(BUNDLE_PATH / "search_index.jsonl")
        replay_case(index, case)
    finally:
        set_search_keys_fn(None)

    return observed


def test_nfd_kun_literal_reaches_normalization_unchanged():
    cases = load_matrix_jsonl(MATRIX_PATH)
    nfd_case = next(case for case in cases if case.case_id == "sr7l_013_kun_decomposed_unicode")
    assert nfd_case.query == KUN_NFD
    assert unicodedata.normalize("NFD", nfd_case.query) == nfd_case.query

    observed = _replay_with_search_key_spy(nfd_case)

    assert observed == [KUN_NFD]
    assert observed[0] == nfd_case.query


def test_query_with_leading_and_trailing_whitespace_reaches_hook_unchanged():
    fruit = next(
        case
        for case in load_matrix_jsonl(MATRIX_PATH)
        if case.case_id == "sr7l_001_fruit_exact"
    )
    query = "  fruit  "
    case = replace(fruit, query=query)

    observed = _replay_with_search_key_spy(case)

    assert observed == [query]


def test_whitespace_only_query_reaches_hook_unchanged():
    fruit = next(
        case
        for case in load_matrix_jsonl(MATRIX_PATH)
        if case.case_id == "sr7l_001_fruit_exact"
    )
    query = "   "
    case = replace(fruit, query=query)

    observed = _replay_with_search_key_spy(case)

    assert observed == [query]


def test_poil_returns_mapping_ir_not_lexicon_ir(committed_result):
    case = _case_by_id(committed_result, "sr7l_009_poil_supplement")
    assert case.actual_ir_ids == ["ff499fdee22b2b86"]
    assert "43b64456edacdbe0" not in case.actual_ir_ids


def test_zzzz_nohit_probe_reports_clean_miss_fields(committed_result):
    case = _case_by_id(committed_result, "sr7l_010_zzzz_nohit_probe")
    assert case.actual_result_status == "miss"
    assert case.actual_result_count == 0
    assert case.actual_ir_ids == []
    assert case.actual_matched_key_type == "none"
    assert case.actual_matched_key is None
    assert case.actual_deep_ladder is False


def test_search_index_checksum_mismatch_fails_before_replay_success(tmp_path):
    manifest = load_matrix_manifest(MANIFEST_PATH)
    bad_manifest = replace(
        manifest,
        search_index_sha256="sha256:" + ("0" * 64),
    )
    manifest_path = tmp_path / "manifest.json"
    manifest_path.write_text(
        json.dumps(
            {
                "schema_version": manifest.schema_version,
                "matrix_schema_version": manifest.matrix_schema_version,
                "bundle_id": manifest.bundle_id,
                "catalog_version": manifest.catalog_version,
                "norm_version": manifest.norm_version,
                "search_index_sha256": bad_manifest.search_index_sha256,
                "bundle_content_sha256": manifest.bundle_content_sha256,
                "case_count": manifest.case_count,
            }
        ),
        encoding="utf-8",
    )

    with pytest.raises(SearchIndexChecksumError, match="checksum mismatch"):
        _run_regression(manifest_path=manifest_path)


def test_bundle_basename_mismatch_fails(tmp_path):
    wrong_bundle = tmp_path / "wrong_bundle_name"
    wrong_bundle.mkdir()
    (wrong_bundle / "bundle.manifest.json").write_text(
        (BUNDLE_PATH / "bundle.manifest.json").read_text(encoding="utf-8"),
        encoding="utf-8",
    )
    (wrong_bundle / "search_index.jsonl").write_text(
        (BUNDLE_PATH / "search_index.jsonl").read_text(encoding="utf-8"),
        encoding="utf-8",
    )

    with pytest.raises(BundleMetadataError, match="basename must match"):
        _run_regression(bundle_path=wrong_bundle)


def test_matrix_expectation_mismatch_reports_field_level_details():
    cases = load_matrix_jsonl(MATRIX_PATH)
    fruit = next(case for case in cases if case.case_id == "sr7l_001_fruit_exact")
    mutated = replace(
        fruit,
        expected_ir_ids=["0000000000000000"],
        expected_result_count=1,
    )

    from search_regression.replay import load_search_index, replay_case  # noqa: E402

    index = load_search_index(BUNDLE_PATH / "search_index.jsonl")
    failed = replay_case(index, mutated)
    assert failed.expected_match is False
    assert any(
        "direct source posting IDs" in item or "actual_ir_ids" in item
        for item in failed.mismatches
    )
    assert failed.expected_id_space == "direct_ir_ids"


def test_cli_stdout_mode_writes_valid_json_and_exit_code_zero():
    proc = subprocess.run(
        [
            sys.executable,
            str(CLI_PATH),
            "--matrix",
            str(MATRIX_PATH),
            "--manifest",
            str(MANIFEST_PATH),
            "--bundle",
            str(BUNDLE_PATH),
            "--catalog",
            str(CATALOG_PATH),
        ],
        cwd=REPO_ROOT,
        check=False,
        capture_output=True,
        text=True,
    )
    assert proc.returncode == 0, proc.stderr
    payload = json.loads(proc.stdout)
    assert payload["matrix_case_count"] == 13
    assert payload["failed_case_count"] == 0


def test_cli_output_file_mode_writes_valid_json_and_exit_code_zero(tmp_path):
    output_path = tmp_path / "run.json"
    proc = subprocess.run(
        [
            sys.executable,
            str(CLI_PATH),
            "--matrix",
            str(MATRIX_PATH),
            "--manifest",
            str(MANIFEST_PATH),
            "--bundle",
            str(BUNDLE_PATH),
            "--catalog",
            str(CATALOG_PATH),
            "--output",
            str(output_path),
        ],
        cwd=REPO_ROOT,
        check=False,
        capture_output=True,
        text=True,
    )
    assert proc.returncode == 0, proc.stderr
    payload = json.loads(output_path.read_text(encoding="utf-8"))
    assert payload["passed_case_count"] == 13
    assert payload["failed_case_count"] == 0


def test_cli_exits_nonzero_on_checksum_mismatch(tmp_path):
    manifest = load_matrix_manifest(MANIFEST_PATH)
    manifest_path = tmp_path / "manifest.json"
    manifest_path.write_text(
        json.dumps(
            {
                "schema_version": manifest.schema_version,
                "matrix_schema_version": manifest.matrix_schema_version,
                "bundle_id": manifest.bundle_id,
                "catalog_version": manifest.catalog_version,
                "norm_version": manifest.norm_version,
                "search_index_sha256": "sha256:" + ("f" * 64),
                "bundle_content_sha256": manifest.bundle_content_sha256,
                "case_count": manifest.case_count,
            }
        ),
        encoding="utf-8",
    )
    proc = subprocess.run(
        [
            sys.executable,
            str(CLI_PATH),
            "--matrix",
            str(MATRIX_PATH),
            "--manifest",
            str(manifest_path),
            "--bundle",
            str(BUNDLE_PATH),
        ],
        cwd=REPO_ROOT,
        check=False,
        capture_output=True,
        text=True,
    )
    assert proc.returncode == 1
    assert "checksum mismatch" in proc.stderr


def test_cli_accepts_additive_matrix_manifest_and_arbitrary_bundle_path(tmp_path):
    arbitrary_bundle = tmp_path / "future_candidate_bundle_dir"
    proc = subprocess.run(
        [
            sys.executable,
            str(CLI_PATH),
            "--matrix",
            str(MATRIX_7N2A_PATH),
            "--manifest",
            str(MANIFEST_7N2A_PATH),
            "--bundle",
            str(arbitrary_bundle),
            "--output",
            str(tmp_path / "unused.json"),
        ],
        cwd=REPO_ROOT,
        check=False,
        capture_output=True,
        text=True,
    )
    assert proc.returncode == 1
    assert "usage:" not in proc.stderr
    assert "bundle path is not a directory" in proc.stderr
