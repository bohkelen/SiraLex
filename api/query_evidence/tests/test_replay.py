from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
API_ROOT = REPO_ROOT / "api"
FIXTURES = REPO_ROOT / "shared" / "query_evidence" / "fixtures"
GOLDEN = FIXTURES / "tests" / "golden_replay_summary.json"
FEATURED_SEARCH_INDEX = (
    REPO_ROOT
    / "web/public/bundle_full_20260616_phase7j_alias_round2_candidate/search_index.jsonl"
)

if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from query_evidence.replay import (  # noqa: E402
    InvalidDirectionError,
    SearchIndexLoadError,
    build_replay_summary,
    load_search_index,
    replay_query,
)

GOLDEN_QUERIES = [
    ("fruit", "source_to_target"),
    ("mère", "source_to_target"),
    ("fruits", "source_to_target"),
    ("grand-parents", "source_to_target"),
    ("zzzz-nohit-test", "source_to_target"),
    ("Kun", "target_to_source"),
]


@pytest.fixture(scope="module")
def featured_search_index() -> dict[tuple[str, str], list[str]]:
    return load_search_index(FEATURED_SEARCH_INDEX)


def test_load_search_index_loads_featured_search_index():
    index = load_search_index(FEATURED_SEARCH_INDEX)

    assert index[("src_casefold", "fruit")] == ["7cdb6070ce427a6d"]
    assert index[("src_casefold", "fruits")] == ["7cdb6070ce427a6d"]
    assert index[("tgt_casefold", "kun")] == ["b07ae7bd61ff3c85"]


def test_source_to_target_fruit_hits_expected_ir_id(featured_search_index):
    result = replay_query(featured_search_index, "fruit", "source_to_target")

    assert result.result_count == 1
    assert result.resolved_ir_ids == ["7cdb6070ce427a6d"]
    assert result.current_result == "hit (1)"


def test_source_to_target_fruits_hits_phase7j_alias_ir_id(featured_search_index):
    result = replay_query(featured_search_index, "fruits", "source_to_target")

    assert result.resolved_ir_ids == ["7cdb6070ce427a6d"]


def test_source_to_target_grand_parents_preserves_order(featured_search_index):
    result = replay_query(featured_search_index, "grand-parents", "source_to_target")

    assert result.resolved_ir_ids == ["1f6d3a5919110b21", "957bd76b41fda053"]


def test_source_to_target_zzzz_nohit_test_misses(featured_search_index):
    result = replay_query(featured_search_index, "zzzz-nohit-test", "source_to_target")

    assert result.result_count == 0
    assert result.resolved_ir_ids == []
    assert result.current_result == "miss"


def test_source_to_target_mere_returns_hit_multi_with_three_results(featured_search_index):
    result = replay_query(featured_search_index, "mère", "source_to_target")

    assert result.result_count == 3
    assert result.resolved_ir_ids == [
        "0f517a71c373f51d",
        "d540716db9321a83",
        "e5164efcdf5e6ca4",
    ]
    assert result.current_result == "hit (3)"


def test_target_to_source_kun_returns_expected_ir_id(featured_search_index):
    result = replay_query(featured_search_index, "Kun", "target_to_source")

    assert result.resolved_ir_ids == ["b07ae7bd61ff3c85"]
    assert result.current_result == "hit (1)"


def test_matched_key_type_and_matched_key_populated_on_hit(featured_search_index):
    result = replay_query(featured_search_index, "fruit", "source_to_target")

    assert result.matched_key_type == "casefold"
    assert result.matched_key == "fruit"


def test_matched_key_type_none_and_matched_key_null_on_miss(featured_search_index):
    result = replay_query(featured_search_index, "zzzz-nohit-test", "source_to_target")

    assert result.matched_key_type == "none"
    assert result.matched_key is None


def test_invalid_direction_raises(featured_search_index):
    with pytest.raises(InvalidDirectionError, match="source_to_target or target_to_source"):
        replay_query(featured_search_index, "fruit", "invalid")


def test_malformed_search_index_row_raises(tmp_path: Path):
    index_path = tmp_path / "search_index.jsonl"
    index_path.write_text("{not json}\n", encoding="utf-8")

    with pytest.raises(SearchIndexLoadError, match="invalid JSON"):
        load_search_index(index_path)


def test_golden_replay_summary_matches_fixture_replay_output():
    report = build_replay_summary(FEATURED_SEARCH_INDEX, GOLDEN_QUERIES)
    golden = json.loads(GOLDEN.read_text(encoding="utf-8"))

    assert report == golden
