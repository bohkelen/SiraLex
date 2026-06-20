from __future__ import annotations

import json
import sys
import unicodedata
from dataclasses import replace
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
API_ROOT = REPO_ROOT / "api"
MATRIX_PATH = REPO_ROOT / "shared/search_regression/search_regression_matrix_v1.jsonl"
MANIFEST_PATH = REPO_ROOT / "shared/search_regression/matrix_manifest_v1.json"

if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from search_regression.schema import (  # noqa: E402
    SearchRegressionCase,
    load_matrix_jsonl,
    load_matrix_manifest,
)
from search_regression.validate_matrix import (  # noqa: E402
    KUN_NFC,
    KUN_NFD,
    validate_case,
    validate_matrix,
)

BUNDLE_ID = "bundle_full_20260616_phase7j_alias_round2_candidate"
NORM_VERSION = "norm_v3"


@pytest.fixture(scope="module")
def manifest():
    return load_matrix_manifest(MANIFEST_PATH)


@pytest.fixture(scope="module")
def cases(manifest):
    loaded = load_matrix_jsonl(MATRIX_PATH)
    assert len(loaded) == manifest.case_count
    return loaded


def _case_by_id(cases: list[SearchRegressionCase], case_id: str) -> SearchRegressionCase:
    for case in cases:
        if case.case_id == case_id:
            return case
    raise AssertionError(f"missing case_id {case_id!r}")


def _case_by_query(cases: list[SearchRegressionCase], query: str) -> SearchRegressionCase:
    for case in cases:
        if case.query == query:
            return case
    raise AssertionError(f"missing query {query!r}")


def test_committed_matrix_and_manifest_pass_validation(cases, manifest):
    errors = validate_matrix(cases, manifest)
    assert errors == []


def test_matrix_has_exactly_thirteen_rows(cases):
    assert len(cases) == 13


def test_all_required_seed_queries_present(cases):
    queries = {case.query for case in cases}
    expected = {
        "fruit",
        "fruits",
        "grand-parents",
        "mère",
        "bras",
        "manger",
        "mou",
        "tête",
        "poil",
        "zzzz-nohit-test",
        "Kun",
        KUN_NFC,
        KUN_NFD,
    }
    assert expected.issubset(queries)


def test_all_rows_are_approved(cases):
    assert all(case.review_status == "approved" for case in cases)


def test_all_rows_use_valid_primary_case_family(cases, manifest):
    for case in cases:
        assert not validate_case(case, manifest)


def test_grand_parents_primary_family_and_tags(cases):
    case = _case_by_id(cases, "sr7l_003_grand_parents_alias")
    assert case.case_family == "source_alias_hit"
    assert case.case_tags == ["multi_hit", "historical_phase7j"]


def test_count_equals_ir_list_length_for_every_row(cases, manifest):
    for case in cases:
        assert case.expected_result_count == len(case.expected_ir_ids)
        assert not validate_case(case, manifest)


def test_zzzz_nohit_miss_contract(cases):
    case = _case_by_query(cases, "zzzz-nohit-test")
    assert case.expected_result_status == "miss"
    assert case.expected_result_count == 0
    assert case.expected_ir_ids == []
    assert case.expected_matched_key_type == "none"
    assert case.expected_matched_key is None
    assert case.expected_deep_ladder is False


def test_kun_accent_exact_two_id_order(cases):
    case = _case_by_query(cases, KUN_NFC)
    assert case.expected_result_status == "hit_multi"
    assert case.expected_ir_ids == ["753fa18e0a6df4ab", "e28e149f57ab616b"]


def test_kun_decomposed_exact_two_id_order(cases):
    case = _case_by_query(cases, KUN_NFD)
    assert case.expected_result_status == "hit_multi"
    assert case.expected_ir_ids == ["753fa18e0a6df4ab", "e28e149f57ab616b"]


def test_kun_accent_literal_is_nfc(cases):
    case = _case_by_query(cases, KUN_NFC)
    assert case.query_unicode_form == "nfc"
    assert unicodedata.normalize("NFC", case.query) == case.query


def test_kun_decomposed_literal_is_nfd(cases):
    case = _case_by_query(cases, KUN_NFD)
    assert case.query_unicode_form == "nfd"
    assert unicodedata.normalize("NFD", case.query) == case.query


def test_loader_preserves_kun_decomposed_code_points_exactly(tmp_path):
    raw_line = (
        '{"case_id":"tmp","query":"ku\\u0300n","query_unicode_form":"nfd",'
        '"direction":"target_to_source","expected_result_status":"hit_multi",'
        '"expected_result_count":2,"expected_ir_ids":["a","b"],'
        '"expected_matched_key_type":"casefold","expected_matched_key":"k\\u00f9n",'
        '"expected_deep_ladder":false,"case_family":"unicode_canonicalization",'
        f'"source_of_expectation":"test","bundle_id":"{BUNDLE_ID}",'
        f'"norm_version":"{NORM_VERSION}","review_status":"approved"}}'
    )
    path = tmp_path / "one.jsonl"
    path.write_text(raw_line + "\n", encoding="utf-8")

    loaded = load_matrix_jsonl(path)
    assert len(loaded) == 1
    assert loaded[0].query == KUN_NFD
    assert list(loaded[0].query) == ["k", "u", "\u0300", "n"]


def test_poil_asserts_mapping_ir_not_supplement_lexicon_ir(cases):
    case = _case_by_query(cases, "poil")
    assert case.expected_ir_ids == ["ff499fdee22b2b86"]
    assert "43b64456edacdbe0" not in case.expected_ir_ids


def test_invalid_enum_rejected(manifest):
    case = SearchRegressionCase(
        case_id="bad_enum",
        query="fruit",
        query_unicode_form="nfc",
        direction="source_to_target",
        expected_result_status="hit_single",
        expected_result_count=1,
        expected_ir_ids=["7cdb6070ce427a6d"],
        expected_matched_key_type="casefold",
        expected_matched_key="fruit",
        expected_deep_ladder=False,
        case_family="not_a_family",
        source_of_expectation="test",
        bundle_id=BUNDLE_ID,
        norm_version=NORM_VERSION,
        review_status="approved",
    )
    errors = validate_case(case, manifest)
    assert any("invalid case_family" in error.message for error in errors)


def test_duplicate_case_id_rejected(manifest):
    base = load_matrix_jsonl(MATRIX_PATH)[0]
    duplicate = replace(base, case_id=base.case_id, query="other")
    errors = validate_matrix([base, duplicate], manifest)
    assert any("duplicate case_id" in error.message for error in errors)


def test_bad_count_ir_mismatch_rejected(manifest):
    case = SearchRegressionCase(
        case_id="bad_count",
        query="fruit",
        query_unicode_form="nfc",
        direction="source_to_target",
        expected_result_status="hit_single",
        expected_result_count=2,
        expected_ir_ids=["7cdb6070ce427a6d"],
        expected_matched_key_type="casefold",
        expected_matched_key="fruit",
        expected_deep_ladder=False,
        case_family="source_exact_hit",
        source_of_expectation="test",
        bundle_id=BUNDLE_ID,
        norm_version=NORM_VERSION,
        review_status="approved",
    )
    errors = validate_case(case, manifest)
    assert any("expected_result_count must equal len(expected_ir_ids)" in error.message for error in errors)


def test_nfd_row_rewritten_to_nfc_rejected(manifest):
    case = SearchRegressionCase(
        case_id="bad_nfd",
        query=KUN_NFC,
        query_unicode_form="nfd",
        direction="target_to_source",
        expected_result_status="hit_multi",
        expected_result_count=2,
        expected_ir_ids=["753fa18e0a6df4ab", "e28e149f57ab616b"],
        expected_matched_key_type="casefold",
        expected_matched_key="k\u00f9n",
        expected_deep_ladder=False,
        case_family="unicode_canonicalization",
        source_of_expectation="test",
        bundle_id=BUNDLE_ID,
        norm_version=NORM_VERSION,
        review_status="approved",
    )
    errors = validate_case(case, manifest)
    assert any("query_unicode_form=nfd requires query to be exact NFD" in error.message for error in errors)


def test_unknown_case_family_rejected(manifest):
    case = SearchRegressionCase(
        case_id="bad_family",
        query="fruit",
        query_unicode_form="nfc",
        direction="source_to_target",
        expected_result_status="hit_single",
        expected_result_count=1,
        expected_ir_ids=["7cdb6070ce427a6d"],
        expected_matched_key_type="casefold",
        expected_matched_key="fruit",
        expected_deep_ladder=False,
        case_family="source_multi_hit + source_alias_hit",
        source_of_expectation="test",
        bundle_id=BUNDLE_ID,
        norm_version=NORM_VERSION,
        review_status="approved",
    )
    errors = validate_case(case, manifest)
    assert any("invalid case_family" in error.message for error in errors)


def test_manifest_bundle_norm_mismatch_rejected(cases):
    bad_manifest = replace(
        load_matrix_manifest(MANIFEST_PATH),
        bundle_id="bundle_other",
        norm_version="norm_v2",
    )
    errors = validate_matrix(cases, bad_manifest)
    assert any("bundle_id must match manifest" in error.message for error in errors)
    assert any("norm_version must match manifest" in error.message for error in errors)


def test_review_status_other_than_approved_rejected(manifest):
    case = replace(load_matrix_jsonl(MATRIX_PATH)[0], review_status="candidate")
    errors = validate_case(case, manifest)
    assert any("review_status must be 'approved'" in error.message for error in errors)


def test_invalid_direction_rejected(manifest):
    case = replace(load_matrix_jsonl(MATRIX_PATH)[0], direction="sideways")
    errors = validate_case(case, manifest)
    assert any("invalid direction" in error.message for error in errors)


def test_miss_with_nonempty_ir_ids_rejected(manifest):
    case = SearchRegressionCase(
        case_id="bad_miss",
        query="nope",
        query_unicode_form="not_applicable",
        direction="source_to_target",
        expected_result_status="miss",
        expected_result_count=0,
        expected_ir_ids=["deadbeef"],
        expected_matched_key_type="none",
        expected_matched_key=None,
        expected_deep_ladder=False,
        case_family="intentional_no_hit",
        source_of_expectation="test",
        bundle_id=BUNDLE_ID,
        norm_version=NORM_VERSION,
        review_status="approved",
    )
    errors = validate_case(case, manifest)
    assert any("miss requires empty expected_ir_ids" in error.message for error in errors)
