"""Tests for resolved_target_ir_ids search-regression assertions."""

from __future__ import annotations

import json
import sys
from dataclasses import replace
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
API_ROOT = REPO_ROOT / "api"
MATRIX_PATH = REPO_ROOT / "shared/search_regression/search_regression_matrix_v1.jsonl"
MANIFEST_PATH = REPO_ROOT / "shared/search_regression/matrix_manifest_v1.json"
MATRIX_7N2A_PATH = REPO_ROOT / "shared/search_regression/search_regression_matrix_7n2a_v1.jsonl"
MANIFEST_7N2A_PATH = REPO_ROOT / "shared/search_regression/matrix_manifest_7n2a_v1.json"
BUNDLE_PATH = REPO_ROOT / "web/public/bundle_full_20260616_phase7j_alias_round2_candidate"

if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from search_regression.replay import (  # noqa: E402
    LexiconLocatorIndex,
    TargetResolutionError,
    compare_case,
    replay_case,
    resolve_direct_postings_to_target_ir_ids,
    resolve_target_entry_to_ir_id,
    run_search_regression,
)
from search_regression.schema import (  # noqa: E402
    DEFAULT_EXPECTED_ID_SPACE,
    MatrixLoadError,
    SearchRegressionCase,
    load_matrix_jsonl,
    load_matrix_manifest,
)
from search_regression.validate_matrix import validate_case, validate_matrix  # noqa: E402
from query_evidence.replay import load_search_index  # noqa: E402


HOPITAL_DIRECT = ["61843e6630c1fbae", "ff4ee495ef997adf"]
HOPITAL_RESOLVED = [
    "71e323e2dafa590f",
    "a9c7d82decee9191",
    "fefe9b063e05ed11",
]
OWNER_HEALTH = ["a9c7d82decee9191", "fefe9b063e05ed11"]


def _case(**overrides) -> SearchRegressionCase:
    base = {
        "case_id": "tmp_resolved",
        "query": "hôpital",
        "query_unicode_form": "nfc",
        "direction": "source_to_target",
        "expected_result_status": "hit_multi",
        "expected_result_count": 3,
        "expected_ir_ids": list(HOPITAL_RESOLVED),
        "expected_matched_key_type": "casefold",
        "expected_matched_key": "hôpital",
        "expected_deep_ladder": False,
        "case_family": "source_supplement_hit",
        "source_of_expectation": "test",
        "bundle_id": "bundle_test",
        "norm_version": "norm_v3",
        "review_status": "approved",
        "expected_id_space": "resolved_target_ir_ids",
    }
    base.update(overrides)
    return SearchRegressionCase(**base)


def _write_jsonl(path: Path, rows: list[dict]) -> None:
    path.write_text(
        "\n".join(json.dumps(row, ensure_ascii=False) for row in rows) + "\n",
        encoding="utf-8",
    )


def _malipense_lexicon(
    ir_id: str,
    *,
    source_record_id: str,
    url_canonical: str = "https://www.mali-pense.net/emk/lexicon/d.htm",
) -> dict:
    return {
        "ir_id": ir_id,
        "ir_kind": "lexicon_entry",
        "source_id": "src_malipense",
        "norm_version": "norm_v3",
        "preferred_form": ir_id,
        "variant_forms": [ir_id],
        "search_keys": {},
        "display": {"headword_latin": ir_id},
        "record_locator": {
            "kind": "source_record_id",
            "url_canonical": url_canonical,
            "source_record_id": source_record_id,
            "anchor_names": [],
        },
    }


def _owner_lexicon(
    ir_id: str,
    *,
    source_record_id: str,
    url_canonical: str,
) -> dict:
    return {
        "ir_id": ir_id,
        "ir_kind": "lexicon_entry",
        "source_id": "src_siralex_lexical_review",
        "norm_version": "norm_v3",
        "preferred_form": ir_id,
        "variant_forms": [ir_id],
        "search_keys": {},
        "display": {"headword_latin": ir_id},
        "record_locator": {
            "kind": "source_record_id",
            "url_canonical": url_canonical,
            "source_record_id": source_record_id,
            "anchor_names": [ir_id],
        },
        "provenance": {
            "source": {
                "id": "src_siralex_lexical_review",
                "record_pointer": {
                    "kind": "source_record_id",
                    "url_canonical": url_canonical,
                    "source_record_id": source_record_id,
                },
            }
        },
    }


def _mapping(ir_id: str, source_term: str, targets: list[dict]) -> dict:
    return {
        "ir_id": ir_id,
        "ir_kind": "index_mapping",
        "source_id": "src_malipense",
        "norm_version": "norm_v3",
        "preferred_form": source_term,
        "variant_forms": [source_term],
        "search_keys": {},
        "display": {
            "source_term": source_term,
            "source_lang": "fr",
            "target_entries": targets,
        },
    }


def _health_fixture_records() -> dict[str, dict]:
    rows = [
        _malipense_lexicon("71e323e2dafa590f", source_record_id="e2533"),
        _owner_lexicon(
            "a9c7d82decee9191",
            source_record_id="7n2a_ndandayoro_v1",
            url_canonical="siralex://lexical-review/7n2a/ndandayoro",
        ),
        _owner_lexicon(
            "fefe9b063e05ed11",
            source_record_id="7n2a_ndandadiya_v1",
            url_canonical="siralex://lexical-review/7n2a/ndandadiya",
        ),
        _mapping(
            "61843e6630c1fbae",
            "hôpital",
            [
                {
                    "lexicon_url": "../lexicon/d.htm",
                    "anchor": "e2533",
                    "display_text": "SHOULD_NOT_BE_USED_FOR_MATCHING",
                }
            ],
        ),
        _mapping(
            "ff4ee495ef997adf",
            "hôpital",
            [
                {
                    "lexicon_url": "siralex://lexical-review/7n2a/ndandayoro",
                    "anchor": "7n2a_ndandayoro_v1",
                    "display_text": "ndándayoro",
                },
                {
                    "lexicon_url": "siralex://lexical-review/7n2a/ndandadiya",
                    "anchor": "7n2a_ndandadiya_v1",
                    "display_text": "ndándadiya",
                },
            ],
        ),
        _mapping(
            "ff42659295a657dc",
            "clinique",
            [
                {
                    "lexicon_url": "siralex://lexical-review/7n2a/ndandayoro",
                    "anchor": "7n2a_ndandayoro_v1",
                    "display_text": "ndándayoro",
                },
                {
                    "lexicon_url": "siralex://lexical-review/7n2a/ndandadiya",
                    "anchor": "7n2a_ndandadiya_v1",
                    "display_text": "ndándadiya",
                },
            ],
        ),
        _mapping(
            "ffb73938da1a4576",
            "centre de santé",
            [
                {
                    "lexicon_url": "siralex://lexical-review/7n2a/ndandayoro",
                    "anchor": "7n2a_ndandayoro_v1",
                    "display_text": "ndándayoro",
                },
                {
                    "lexicon_url": "siralex://lexical-review/7n2a/ndandadiya",
                    "anchor": "7n2a_ndandadiya_v1",
                    "display_text": "ndándadiya",
                },
            ],
        ),
    ]
    return {row["ir_id"]: row for row in rows}


def test_missing_expected_id_space_defaults_to_direct_ir_ids(tmp_path: Path):
    row = {
        "case_id": "default_space",
        "query": "fruit",
        "query_unicode_form": "nfc",
        "direction": "source_to_target",
        "expected_result_status": "hit_single",
        "expected_result_count": 1,
        "expected_ir_ids": ["7cdb6070ce427a6d"],
        "expected_matched_key_type": "casefold",
        "expected_matched_key": "fruit",
        "expected_deep_ladder": False,
        "case_family": "source_exact_hit",
        "source_of_expectation": "test",
        "bundle_id": "bundle_x",
        "norm_version": "norm_v3",
        "review_status": "approved",
    }
    path = tmp_path / "one.jsonl"
    path.write_text(json.dumps(row) + "\n", encoding="utf-8")
    loaded = load_matrix_jsonl(path)
    assert loaded[0].expected_id_space == DEFAULT_EXPECTED_ID_SPACE
    assert loaded[0].expected_id_space == "direct_ir_ids"


def test_unknown_expected_id_space_fails_closed(tmp_path: Path):
    row = {
        "case_id": "bad_space",
        "query": "fruit",
        "query_unicode_form": "nfc",
        "direction": "source_to_target",
        "expected_result_status": "hit_single",
        "expected_result_count": 1,
        "expected_ir_ids": ["7cdb6070ce427a6d"],
        "expected_matched_key_type": "casefold",
        "expected_matched_key": "fruit",
        "expected_deep_ladder": False,
        "case_family": "source_exact_hit",
        "source_of_expectation": "test",
        "bundle_id": "bundle_x",
        "norm_version": "norm_v3",
        "review_status": "approved",
        "expected_id_space": "not_a_real_space",
    }
    path = tmp_path / "bad.jsonl"
    path.write_text(json.dumps(row) + "\n", encoding="utf-8")
    with pytest.raises(MatrixLoadError, match="expected_id_space"):
        load_matrix_jsonl(path)


def test_resolved_target_ir_ids_rejected_for_target_to_source():
    case = _case(direction="target_to_source", query="dándaso")
    errors = validate_case(case)
    assert any(
        "resolved_target_ir_ids is valid only when direction == source_to_target"
        in error.message
        for error in errors
    )


def test_7l_matrix_defaults_direct_and_validates():
    cases = load_matrix_jsonl(MATRIX_PATH)
    manifest = load_matrix_manifest(MANIFEST_PATH)
    assert all(case.expected_id_space == "direct_ir_ids" for case in cases)
    assert validate_matrix(cases, manifest) == []


def test_7n2a_health_rows_declare_resolved_target_id_space():
    cases = {case.case_id: case for case in load_matrix_jsonl(MATRIX_7N2A_PATH)}
    for case_id in (
        "7n2a_hopital_health_order",
        "7n2a_clinique_health_only",
        "7n2a_centre_de_sante_health_only",
    ):
        assert cases[case_id].expected_id_space == "resolved_target_ir_ids"
    assert cases["7n2a_hopital_health_order"].expected_ir_ids == HOPITAL_RESOLVED
    assert cases["7n2a_clinique_health_only"].expected_ir_ids == OWNER_HEALTH
    assert cases["7n2a_centre_de_sante_health_only"].expected_ir_ids == OWNER_HEALTH
    assert validate_matrix(
        list(cases.values()),
        load_matrix_manifest(MANIFEST_7N2A_PATH),
    ) == []


def test_hopital_resolved_target_replay_passes_with_mapping_direct_ids():
    records = _health_fixture_records()
    index = {
        ("src_casefold", "hôpital"): list(HOPITAL_DIRECT),
    }
    case = _case()
    result = replay_case(
        index,
        case,
        records_by_id=records,
        locator_index=LexiconLocatorIndex.from_records(records),
    )
    assert result.expected_match is True
    assert result.expected_id_space == "resolved_target_ir_ids"
    assert result.actual_ir_ids == HOPITAL_DIRECT
    assert result.actual_resolved_target_ir_ids == HOPITAL_RESOLVED
    assert result.actual_result_count == 3


def test_clinique_and_centre_resolve_to_owner_health_ids():
    records = _health_fixture_records()
    locator_index = LexiconLocatorIndex.from_records(records)
    clinique = _case(
        case_id="clinique",
        query="clinique",
        expected_result_count=2,
        expected_ir_ids=list(OWNER_HEALTH),
        expected_matched_key="clinique",
    )
    centre = _case(
        case_id="centre",
        query="centre de santé",
        expected_result_count=2,
        expected_ir_ids=list(OWNER_HEALTH),
        expected_matched_key="centre de santé",
    )
    clinique_result = replay_case(
        {("src_casefold", "clinique"): ["ff42659295a657dc"]},
        clinique,
        records_by_id=records,
        locator_index=locator_index,
    )
    centre_result = replay_case(
        {("src_casefold", "centre de santé"): ["ffb73938da1a4576"]},
        centre,
        records_by_id=records,
        locator_index=locator_index,
    )
    assert clinique_result.expected_match is True
    assert clinique_result.actual_ir_ids == ["ff42659295a657dc"]
    assert clinique_result.actual_resolved_target_ir_ids == OWNER_HEALTH
    assert centre_result.expected_match is True
    assert centre_result.actual_ir_ids == ["ffb73938da1a4576"]
    assert centre_result.actual_resolved_target_ir_ids == OWNER_HEALTH


def test_resolver_fails_closed_when_direct_posting_missing():
    records = _health_fixture_records()
    with pytest.raises(TargetResolutionError, match="missing from bundle records"):
        resolve_direct_postings_to_target_ir_ids(
            ["deadbeefdeadbeef"],
            records,
        )


def test_resolver_fails_closed_when_target_entry_unresolvable():
    records = _health_fixture_records()
    mapping = _mapping(
        "map-missing",
        "x",
        [{"lexicon_url": "../lexicon/d.htm", "anchor": "e_missing", "display_text": "x"}],
    )
    records = {**records, mapping["ir_id"]: mapping}
    with pytest.raises(TargetResolutionError, match="resolved to zero lexicon records"):
        resolve_direct_postings_to_target_ir_ids([mapping["ir_id"]], records)


def test_resolver_fails_closed_when_target_entry_ambiguous():
    records = _health_fixture_records()
    dup = _malipense_lexicon(
        "duplicate-lexicon",
        source_record_id="e2533",
    )
    records = {**records, dup["ir_id"]: dup}
    with pytest.raises(TargetResolutionError, match="resolved ambiguously"):
        resolve_direct_postings_to_target_ir_ids(["61843e6630c1fbae"], records)


def test_display_text_only_matching_is_not_used():
    """Homograph-safe: wrong display_text must not resolve without durable locator."""
    records = {
        "lex-a": _malipense_lexicon("lex-a", source_record_id="e9999"),
        "map-a": _mapping(
            "map-a",
            "x",
            [
                {
                    "lexicon_url": "../lexicon/d.htm",
                    "anchor": "e2533",
                    "display_text": "dándaso",
                }
            ],
        ),
        # Lexicon with matching display headword but different durable id.
        "lex-display": {
            "ir_id": "lex-display",
            "ir_kind": "lexicon_entry",
            "source_id": "src_malipense",
            "norm_version": "norm_v3",
            "preferred_form": "dándaso",
            "variant_forms": ["dándaso"],
            "search_keys": {},
            "display": {"headword_latin": "dándaso"},
            "record_locator": {
                "kind": "source_record_id",
                "url_canonical": "https://www.mali-pense.net/emk/lexicon/d.htm",
                "source_record_id": "e_other",
                "anchor_names": ["dándaso"],
            },
        },
    }
    with pytest.raises(TargetResolutionError, match="resolved to zero lexicon records"):
        resolve_direct_postings_to_target_ir_ids(["map-a"], records)


def test_resolved_mismatch_message_distinguishes_id_spaces():
    from search_regression.replay import CaseReplayResult

    case = _case(expected_ir_ids=["aaaaaaaaaaaaaaaa"])
    replay = CaseReplayResult(
        case_id=case.case_id,
        query=case.query,
        query_unicode_form=case.query_unicode_form,
        direction=case.direction,
        actual_result_status="hit_multi",
        actual_result_count=3,
        actual_ir_ids=list(HOPITAL_DIRECT),
        actual_matched_key_type="casefold",
        actual_matched_key="hôpital",
        actual_deep_ladder=False,
        expected_match=True,
        expected_id_space="resolved_target_ir_ids",
        actual_resolved_target_ir_ids=list(HOPITAL_RESOLVED),
        mismatches=[],
    )
    compared = compare_case(case, replay)
    assert compared.expected_match is False
    assert any("resolved target lexicon IDs" in item for item in compared.mismatches)
    assert not any(
        item.startswith("direct source posting IDs") for item in compared.mismatches
    )


def test_direct_mismatch_message_uses_direct_label():
    from search_regression.replay import CaseReplayResult

    case = replace(
        load_matrix_jsonl(MATRIX_PATH)[0],
        expected_ir_ids=["0000000000000000"],
    )
    replay = CaseReplayResult(
        case_id=case.case_id,
        query=case.query,
        query_unicode_form=case.query_unicode_form,
        direction=case.direction,
        actual_result_status="hit_single",
        actual_result_count=1,
        actual_ir_ids=["7cdb6070ce427a6d"],
        actual_matched_key_type="casefold",
        actual_matched_key="fruit",
        actual_deep_ladder=False,
        expected_match=True,
        expected_id_space="direct_ir_ids",
        mismatches=[],
    )
    compared = compare_case(case, replay)
    assert any("direct source posting IDs" in item for item in compared.mismatches)


def test_featured_7l_replay_remains_green():
    result = run_search_regression(
        matrix_path=MATRIX_PATH,
        manifest_path=MANIFEST_PATH,
        bundle_path=BUNDLE_PATH,
        catalog_path=REPO_ROOT / "web/public/catalog.json",
    )
    assert result.all_passed
    assert result.passed_case_count == 13
    assert all(case.expected_id_space == "direct_ir_ids" for case in result.cases)
    assert all(case.actual_resolved_target_ir_ids is None for case in result.cases)
