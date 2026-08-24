"""Tests for CORPUS1F19 differential G8 and virtual identity propagation."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from malipense_version_delta.canonical_json import sha256_file, write_jsonl
from malipense_version_delta.source_refresh.paths import (
    FROZEN_F18_COMMIT,
    FROZEN_F18_TYPE_A_REGISTRY_SHA256,
    FROZEN_F18_TYPE_B_REGISTRY_SHA256,
    default_paths,
)
from malipense_version_delta.source_refresh.transition.anchor_continuity import (
    rewrite_index_ir_rows,
)
from malipense_version_delta.source_refresh.transition.closure import (
    DECISION_BLOCKED,
    DECISION_CLOSED,
    F18_VIRTUAL_BEFORE,
)
from malipense_version_delta.source_refresh.transition.differential import (
    FAIL_BOTH_DIFFERENT_REASON,
    FAIL_BOTH_SAME_REASON,
    FAIL_CANONICAL_PASS_REFRESH,
    PASS_BOTH,
    PASS_CANONICAL_FAIL_REFRESH,
    RegressionCaseResult,
    classify_case,
    classify_suites,
)
from malipense_version_delta.source_refresh.transition.id_remap import (
    IDENTITY_FIELD_SPECS,
    NOT_IDENTITY_BOUND,
    REWRITTEN,
    LogicalMultiplicityError,
    apply_overlay_to_ir_list,
    assert_logical_multiplicity_preserved,
    audit_catalog,
    generated_mapping_overlay,
    generated_supplement_mapping_ir_id,
    logical_index_from_objects,
    rewrite_table,
)
from malipense_version_delta.source_refresh.transition.virtual_product import (
    rewrite_downstream_tables,
)

REPO_ROOT = Path(__file__).resolve().parents[3]
TRANSITION_SRC = (
    REPO_ROOT
    / "api"
    / "malipense_version_delta"
    / "source_refresh"
    / "transition"
)


def _result(
    case_id: str,
    *,
    ok: bool,
    expected: list[str],
    actual: list[str],
    status: str,
    count: int | None = None,
    resolved: list[str] | None = None,
    mismatches: list[str] | None = None,
) -> RegressionCaseResult:
    return RegressionCaseResult(
        case_id=case_id,
        ok=ok,
        expected_ir_ids=expected,
        actual_ir_ids=actual if resolved is None else [],
        actual_resolved_target_ir_ids=resolved,
        actual_status=status,
        actual_count=count if count is not None else len(resolved or actual),
        mismatches=mismatches or ([] if ok else ["mismatch"]),
    )


def test_differential_pass_both_does_not_block():
    overlay = {"a": "b"}
    c = _result("x", ok=True, expected=["a"], actual=["a"], status="hit_single")
    r = _result("x", ok=True, expected=["b"], actual=["b"], status="hit_single")
    row = classify_case(c, r, overlay)
    assert row["class"] == PASS_BOTH
    assert row["blocks_transition"] is False


def test_canonical_fail_refresh_same_fail_does_not_block():
    overlay: dict[str, str] = {}
    c = _result(
        "preexisting",
        ok=False,
        expected=["o1"],
        actual=[],
        status="miss",
        count=0,
        mismatches=["miss"],
    )
    r = _result(
        "preexisting",
        ok=False,
        expected=["o1"],
        actual=[],
        status="miss",
        count=0,
        mismatches=["miss"],
    )
    row = classify_case(c, r, overlay)
    assert row["class"] == FAIL_BOTH_SAME_REASON
    assert row["blocks_transition"] is False
    summary = classify_suites([c], [r], overlay)
    assert summary["g8_pass"] is True
    assert summary["unchanged_preexisting_failures"] == 1
    assert summary["transition_introduced_failures"] == 0


def test_canonical_pass_refresh_fail_blocks():
    overlay = {"old": "new"}
    c = _result("mobaa", ok=True, expected=["old"], actual=["old"], status="hit_single")
    r = _result(
        "mobaa",
        ok=False,
        expected=["new"],
        actual=[],
        status="miss",
        count=0,
        mismatches=["missing posting"],
    )
    row = classify_case(c, r, overlay)
    assert row["class"] == PASS_CANONICAL_FAIL_REFRESH
    assert row["blocks_transition"] is True
    summary = classify_suites([c], [r], overlay)
    assert summary["g8_pass"] is False
    assert summary["transition_introduced_failures"] == 1


def test_worsened_failure_blocks():
    overlay: dict[str, str] = {}
    c = _result(
        "hopital",
        ok=False,
        expected=["t1", "t2", "t3"],
        actual=["t1", "t2"],
        status="hit_multi",
        resolved=["t1", "t2"],
        count=2,
        mismatches=["count"],
    )
    r = _result(
        "hopital",
        ok=False,
        expected=["t1", "t2", "t3"],
        actual=["t1"],
        status="hit_single",
        resolved=["t1"],
        count=1,
        mismatches=["count"],
    )
    row = classify_case(c, r, overlay)
    assert row["class"] == FAIL_BOTH_DIFFERENT_REASON
    assert row["worsened"] is True
    assert row["blocks_transition"] is True
    summary = classify_suites([c], [r], overlay)
    assert summary["g8_pass"] is False
    assert summary["transition_worsened_failures"] == 1


def test_scalar_and_list_id_fields_remapped():
    overlay = {"base1": "cur1", "base2": "cur2"}
    objects = [
        {
            "logical_lexical_id": "llx_1",
            "baseline_ir_ids": ["base1"],
            "current_ir_ids": ["cur1"],
        },
        {
            "logical_lexical_id": "llx_2",
            "baseline_ir_ids": ["base2"],
            "current_ir_ids": ["cur2"],
        },
    ]
    logical = logical_index_from_objects(objects)
    aliases, n = rewrite_table(
        [
            {
                "alias_id": "a1",
                "resolved_ir_ids": ["base1", "keep"],
                "evidence_ir_ids": ["base2"],
            }
        ],
        overlay,
        artifact="source_alias",
        logical_index=logical,
    )
    assert n >= 1
    assert aliases[0]["resolved_ir_ids"] == ["cur1", "keep"]
    assert aliases[0]["evidence_ir_ids"] == ["cur2"]

    supps, _ = rewrite_table(
        [
            {
                "supplement_id": "s1",
                "target_ir_ids": ["base1", "base2"],
                "supporting_evidence_ir_ids": ["base1"],
                "target_notes": [{"target_ir_id": "base1", "note": "x"}],
            }
        ],
        overlay,
        artifact="source_index_supplement",
        logical_index=logical,
    )
    assert supps[0]["target_ir_ids"] == ["cur1", "cur2"]
    assert supps[0]["target_notes"][0]["target_ir_id"] == "cur1"

    tvars, _ = rewrite_table(
        [{"variant_id": "v1", "canonical_ir_id": "base1"}],
        overlay,
        artifact="reviewed_target_variant",
        logical_index=logical,
    )
    assert tvars[0]["canonical_ir_id"] == "cur1"


def test_logical_target_multiplicity_preserved():
    overlay = {"b1": "c1", "b2": "c2"}
    logical = {
        "b1": "L1",
        "c1": "L1",
        "b2": "L2",
        "c2": "L2",
    }
    after = apply_overlay_to_ir_list(["b1", "b2"], overlay)
    assert_logical_multiplicity_preserved(
        ["b1", "b2"], after, logical, context="t", overlay=overlay
    )
    assert after == ["c1", "c2"]


def test_ungoverned_many_to_one_is_rejected():
    overlay = {"b1": "c_shared", "b2": "c_shared"}
    logical = {"b1": "L1", "b2": "L2", "c_shared": "L1"}
    after = apply_overlay_to_ir_list(["b1", "b2"], overlay)
    with pytest.raises(LogicalMultiplicityError):
        assert_logical_multiplicity_preserved(
            ["b1", "b2"], after, logical, context="collapse", overlay=overlay
        )


def test_edition_duplicate_assertions_do_not_create_new_logical_target():
    overlay = {"b1": "c1"}
    logical = {"b1": "L1", "c1": "L1"}
    before = ["b1", "c1"]
    after = apply_overlay_to_ir_list(before, overlay)
    assert after == ["c1", "c1"]
    assert_logical_multiplicity_preserved(
        before, after, logical, context="dup", overlay=overlay
    )


def test_id_bearing_field_audit_covers_lists_and_scalars():
    catalog = {row["path"]: row["audit"] for row in audit_catalog()}
    assert catalog["resolved_ir_ids"] == REWRITTEN
    assert catalog["target_ir_ids"] == REWRITTEN
    assert catalog["canonical_ir_id"] == REWRITTEN
    assert catalog["expected_ir_ids"] == REWRITTEN
    assert catalog["derived_generated_ir_id"] == REWRITTEN
    assert catalog["target_notes.*.target_ir_id"] == REWRITTEN
    assert catalog["ir_ids"] == NOT_IDENTITY_BOUND
    assert catalog["ir_id"] == NOT_IDENTITY_BOUND
    kinds = {s.kind for s in IDENTITY_FIELD_SPECS if s.audit == REWRITTEN}
    assert "list" in kinds and "scalar" in kinds


def test_hopital_multi_target_anchor_and_list_propagation():
    baseline = [
        {
            "ir_id": "71e323e2dafa590f",
            "ir_kind": "lexicon_entry",
            "record_locator": {
                "source_record_id": "e2533",
                "url_canonical": "https://www.mali-pense.net/emk/lexicon/d.htm",
            },
            "fields_raw": {"headword_latin": "dándaso"},
        }
    ]
    current = [
        {
            "ir_id": "87d3d2ddd3c0d555",
            "ir_kind": "lexicon_entry",
            "record_locator": {
                "source_record_id": "e2894",
                "url_canonical": "https://www.mali-pense.net/emk/lexicon/d.htm",
            },
            "fields_raw": {"headword_latin": "dándaso"},
        }
    ]
    overlay = {"71e323e2dafa590f": "87d3d2ddd3c0d555"}
    index_rows = [
        {
            "ir_id": "61843e6630c1fbae",
            "ir_kind": "index_mapping",
            "fields_raw": {
                "source_term": "hôpital",
                "target_entries": [
                    {
                        "lexicon_url": "../lexicon/d.htm",
                        "anchor": "e2533",
                        "display_text": "dándaso",
                    }
                ],
            },
        }
    ]
    rewritten, n = rewrite_index_ir_rows(
        index_rows,
        overlay=overlay,
        baseline_records=baseline,
        current_records=current,
    )
    assert n == 1
    entry = rewritten[0]["fields_raw"]["target_entries"][0]
    assert entry["anchor"] == "e2894"
    expected = apply_overlay_to_ir_list(
        ["71e323e2dafa590f", "a9c7d82decee9191", "fefe9b063e05ed11"],
        overlay,
    )
    assert expected == [
        "87d3d2ddd3c0d555",
        "a9c7d82decee9191",
        "fefe9b063e05ed11",
    ]
    logical = {
        "71e323e2dafa590f": "L_dandaso",
        "87d3d2ddd3c0d555": "L_dandaso",
    }
    assert_logical_multiplicity_preserved(
        ["71e323e2dafa590f", "a9c7d82decee9191", "fefe9b063e05ed11"],
        expected,
        logical,
        context="hopital",
        overlay=overlay,
    )


def test_generated_supplement_mapping_ids_follow_remapped_targets():
    original = [
        {
            "supplement_id": "src_supp_x",
            "source_term": "termx",
            "target_ir_ids": ["base_si"],
        }
    ]
    rewritten = [
        {
            "supplement_id": "src_supp_x",
            "source_term": "termx",
            "target_ir_ids": ["cur_si"],
        }
    ]
    mapping = generated_mapping_overlay(original, rewritten)
    old_id = generated_supplement_mapping_ir_id(
        supplement_id="src_supp_x", source_term="termx", target_ir_ids=["base_si"]
    )
    new_id = generated_supplement_mapping_ir_id(
        supplement_id="src_supp_x", source_term="termx", target_ir_ids=["cur_si"]
    )
    assert mapping == {old_id: new_id}
    assert apply_overlay_to_ir_list([old_id], mapping) == [new_id]


def test_mobaa_identity_propagation_via_target_variant_remap():
    overlay = {"c5f78c8ac66eac6b": "b5023f3908fe9ec5"}
    rows, n = rewrite_table(
        [
            {
                "variant_id": "rtv_x",
                "canonical_ir_id": "c5f78c8ac66eac6b",
                "form": "móbaa",
            }
        ],
        overlay,
        artifact="reviewed_target_variant",
    )
    assert n == 1
    assert rows[0]["canonical_ir_id"] == "b5023f3908fe9ec5"
    assert rows[0]["form"] == "móbaa"


def test_no_hardcoded_regression_id_repair_in_transition_code():
    forbidden = (
        "7n2a_mobaa_targets_moyibaa",
        "7n2a_hopital_health_order",
        "c5f78c8ac66eac6b",
        "b5023f3908fe9ec5",
        "71e323e2dafa590f",
        "87d3d2ddd3c0d555",
    )
    repair_files = [
        TRANSITION_SRC / "id_remap.py",
        TRANSITION_SRC / "anchor_continuity.py",
        TRANSITION_SRC / "differential.py",
        TRANSITION_SRC / "virtual_product.py",
        TRANSITION_SRC / "virtual_overlay.py",
        TRANSITION_SRC / "closure.py",
    ]
    for path in repair_files:
        text = path.read_text(encoding="utf-8")
        for token in forbidden:
            assert token not in text, f"{path.name} hard-codes {token}"


def test_rights_and_canonical_write_invariants_in_decisions():
    assert DECISION_CLOSED.endswith("_CLOSED")
    assert DECISION_BLOCKED.endswith("_BLOCKED")
    assert F18_VIRTUAL_BEFORE == {"pass": 24, "fail": 6}
    assert FROZEN_F18_COMMIT == "a957f2482f4655782edfc6606e7cc41fe4070dd3"


def test_mobaa_variant_reaches_current_search_posting(tmp_path: Path):
    from normalizer.normalize import process_ir_files
    from query_evidence.replay import load_search_index
    from search_index.build_index import process_normalized_file

    current_ir = tmp_path / "current.jsonl"
    overlay_path = tmp_path / "tvar.jsonl"
    norm_path = tmp_path / "norm.jsonl"
    index_path = tmp_path / "index.jsonl"
    write_jsonl(
        current_ir,
        [
            {
                "ir_id": "b5023f3908fe9ec5",
                "ir_kind": "lexicon_entry",
                "source_id": "src_malipense",
                "parser_version": "malipense_lexicon_v1",
                "evidence": [
                    {
                        "source_id": "src_malipense",
                        "snapshot_id": "20f263ef15dc6ae1",
                        "entry_block": {
                            "start_selector": "span#x",
                            "end_selector": "span#x-next",
                        },
                        "text_quote": "móyibaa",
                    }
                ],
                "record_locator": {
                    "kind": "source_record_id",
                    "url_canonical": "https://www.mali-pense.net/emk/lexicon/m.htm",
                    "source_record_id": "e8285",
                    "anchor_names": ["móyibaa", "moyibaa"],
                },
                "fields_raw": {
                    "headword_latin": "móyibaa",
                    "senses": [{"gloss_fr": "parent par alliance"}],
                },
            }
        ],
    )
    overlay = {"c5f78c8ac66eac6b": "b5023f3908fe9ec5"}
    tvars, _ = rewrite_table(
        [
            {
                "schema_version": "reviewed_target_variant_table_v1",
                "target_variant_table_version": "phase7n2a-round1",
                "variant_id": "rtv_phase7n2a_0001",
                "status": "approved",
                "canonical_ir_id": "c5f78c8ac66eac6b",
                "form": "móbaa",
                "target_script": "latin",
                "review_document": "docs/PHASE_7K1_STRUCTURED_USABILITY_TRIAGE.md",
                "reviewer": "test",
                "reviewed_at": "2026-07-05",
                "rationale": "variant of móyibaa",
                "source_norm_version": "norm_v3",
            }
        ],
        overlay,
        artifact="reviewed_target_variant",
    )
    write_jsonl(overlay_path, tvars)
    stats = process_ir_files(
        [current_ir], norm_path, target_variant_overlay=overlay_path
    )
    assert int(stats.get("errors") or 0) == 0
    process_normalized_file(norm_path, index_path)
    index = load_search_index(index_path)
    assert index.get(("tgt_casefold", "móbaa")) == ["b5023f3908fe9ec5"]


def test_clean_virtual_table_rewrite_is_deterministic(tmp_path: Path):
    overlay = {"aaaa000000000001": "bbbb000000000001"}
    src_alias = tmp_path / "aliases.jsonl"
    write_jsonl(
        src_alias,
        [
            {
                "alias_id": "a1",
                "resolved_ir_ids": ["aaaa000000000001"],
                "evidence_ir_ids": ["keep"],
            }
        ],
    )
    from malipense_version_delta.source_refresh.paths import SourceRefreshPaths

    def _paths(root: Path) -> SourceRefreshPaths:
        return SourceRefreshPaths(
            repo_root=root,
            baseline_ir=root / "missing_b.jsonl",
            current_ir=root / "missing_c.jsonl",
            delta=root / "missing_d.jsonl",
            crawl_dir=root,
            capture_receipt=root / "cap.json",
            review_registry=root / "rev.jsonl",
            baseline_crawl_dir=root,
            output_dir=root,
            owner_ir=root / "missing_o.jsonl",
            index_ir=root / "missing_i.jsonl",
            aliases=src_alias,
            supplements=root / "missing_s.jsonl",
            target_variants=root / "missing_t.jsonl",
            phrase_review=root / "missing_p.jsonl",
            search_regression_dir=root,
            malipense_yaml=root / "m.yaml",
        )

    paths = _paths(tmp_path)
    first = rewrite_downstream_tables(
        paths, overlay=overlay, work_dir=tmp_path / "v1"
    )
    second = rewrite_downstream_tables(
        paths, overlay=overlay, work_dir=tmp_path / "v2"
    )
    assert sha256_file(first["aliases"]) == sha256_file(second["aliases"])


def test_g7_g9_rights_canonical_invariants_on_local_data():
    paths = default_paths()
    overlay_path = paths.f18_dir / "virtual" / "identity_overlay.json"
    if not overlay_path.is_file():
        pytest.skip("local F18 overlay missing")
    overlay = json.loads(overlay_path.read_text(encoding="utf-8"))
    from malipense_version_delta.compare import load_jsonl_records
    from malipense_version_delta.source_refresh.transition.virtual_overlay import (
        virtual_g7_counts,
    )

    rows = load_jsonl_records(paths.integrity_manifest)
    counts = virtual_g7_counts(rows, overlay)
    assert counts["still_resolves"] == 37
    assert counts["requires_remap"] == 0
    assert counts["ambiguous"] == 0
    assert counts["broken"] == 0

    type_a = paths.f18_dir / "malidaba_continuity_reviews_v1.jsonl"
    type_b = paths.f18_dir / "malidaba_missing_disposition_reviews_v1.jsonl"
    assert sha256_file(type_a) == FROZEN_F18_TYPE_A_REGISTRY_SHA256
    assert sha256_file(type_b) == FROZEN_F18_TYPE_B_REGISTRY_SHA256

    from malipense_version_delta.frozen_inputs import FROZEN_BASELINE_IR_SHA256
    from malipense_version_delta.source_refresh.paths import (
        FROZEN_REVIEW_REGISTRY_SHA256,
    )

    assert sha256_file(paths.baseline_ir) == FROZEN_BASELINE_IR_SHA256
    assert sha256_file(paths.review_registry) == FROZEN_REVIEW_REGISTRY_SHA256

    from malipense_version_delta.source_refresh.evidence_gates import (
        evaluate_g10_rights,
    )
    from malipense_version_delta.source_refresh.continuity.build import (
        load_f15_destructive_dispositions,
    )
    from malipense_version_delta.source_refresh.continuity.g9_continuity import (
        apply_human_type_b_dispositions,
        evaluate_g9_versioned_continuity,
    )
    from malipense_version_delta.source_refresh.continuity.type_b import (
        TYPE_B_REVIEW_DECISION,
    )
    from malipense_version_delta.compare import load_jsonl_records as load_rows

    g10 = evaluate_g10_rights(paths)
    assert g10.status == "PASS"
    assert g10.evidence.get("internal_source_maintenance") == "allowed"
    assert g10.evidence.get("noncommercial_distribution") == "requires_rights_review"
    assert g10.evidence.get("commercial_distribution") == "blocked"

    type_b_rows = load_rows(type_b)
    retain_ids = {
        str(r["baseline_ir_id"])
        for r in type_b_rows
        if r.get("review_decision") == TYPE_B_REVIEW_DECISION
    }
    g9_gate, g9_counts = evaluate_g9_versioned_continuity(
        apply_human_type_b_dispositions(
            load_f15_destructive_dispositions(paths),
            retain_baseline_ir_ids=retain_ids,
        )
    )
    assert g9_gate.status == "PASS"
    assert g9_counts.get("retain_baseline_record") == 42
    assert g9_counts.get("destructive_unresolved") == 0
