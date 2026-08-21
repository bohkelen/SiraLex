"""Synthetic-fixture tests for Malidaba version-delta comparison."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from malipense_version_delta.canonical_json import canonical_dumps, write_jsonl
from malipense_version_delta.compare import compare_lexicon_records, load_jsonl_records
from malipense_version_delta.identity import reject_duplicate_primary_keys, record_ref_from_ir
from malipense_version_delta.parser_compat import (
    assess_parser_compatibility,
    detect_nested_lxp2_in_html,
)
from malipense_version_delta.semantic import semantic_projection


def _entry(
    *,
    ir_id: str,
    url: str,
    source_record_id: str,
    headword: str,
    gloss_fr: str | None = "g",
    nko: str | None = "ߊ",
    variants: list[str] | None = None,
    examples: list[dict] | None = None,
    evidence_snapshot: str = "snap-a",
) -> dict:
    senses = []
    if gloss_fr is not None or examples:
        sense = {"gloss_fr": gloss_fr} if gloss_fr is not None else {}
        if examples:
            sense["examples"] = examples
        senses.append(sense)
    fields = {
        "headword_latin": headword,
    }
    if nko is not None:
        fields["headword_nko_provided"] = nko
    if variants:
        fields["variants_raw"] = variants
    if senses:
        fields["senses"] = senses
    return {
        "ir_id": ir_id,
        "ir_kind": "lexicon_entry",
        "source_id": "src_malipense",
        "parser_version": "malipense_lexicon_v1",
        "evidence": [
            {
                "source_id": "src_malipense",
                "snapshot_id": evidence_snapshot,
                "text_quote": headword,
            }
        ],
        "record_locator": {
            "kind": "source_record_id",
            "url_canonical": url,
            "source_record_id": source_record_id,
            "anchor_names": [headword],
        },
        "fields_raw": fields,
    }


URL_A = "https://www.mali-pense.net/emk/lexicon/a.htm"
URL_B = "https://www.mali-pense.net/emk/lexicon/b.htm"


def test_identical_baseline_current_all_unchanged():
    rows = [
        _entry(ir_id="1", url=URL_A, source_record_id="e0", headword="á"),
        _entry(ir_id="2", url=URL_A, source_record_id="e1", headword="à"),
    ]
    delta, frag = compare_lexicon_records(rows, rows, parser_compat_status="PASS")
    assert frag["classification_counts"] == {"UNCHANGED": 2}
    assert all(r["classification"] == "UNCHANGED" for r in delta)


def test_new_record_detected():
    base = [_entry(ir_id="1", url=URL_A, source_record_id="e0", headword="á")]
    cur = base + [
        _entry(ir_id="2", url=URL_A, source_record_id="e1", headword="áa")
    ]
    delta, frag = compare_lexicon_records(base, cur, parser_compat_status="PASS")
    assert frag["classification_counts"]["NEW_IN_CURRENT_SOURCE"] == 1
    assert frag["classification_counts"]["UNCHANGED"] == 1


def test_missing_baseline_record_detected():
    base = [
        _entry(ir_id="1", url=URL_A, source_record_id="e0", headword="á"),
        _entry(ir_id="2", url=URL_A, source_record_id="e1", headword="à"),
    ]
    cur = [_entry(ir_id="1", url=URL_A, source_record_id="e0", headword="á")]
    _, frag = compare_lexicon_records(base, cur, parser_compat_status="PASS")
    assert frag["classification_counts"]["MISSING_FROM_CURRENT_SOURCE"] == 1


def test_changed_lexical_content_detected():
    base = [_entry(ir_id="1", url=URL_A, source_record_id="e0", headword="á", gloss_fr="old")]
    cur = [_entry(ir_id="1", url=URL_A, source_record_id="e0", headword="á", gloss_fr="new")]
    delta, frag = compare_lexicon_records(base, cur, parser_compat_status="PASS")
    assert frag["classification_counts"]["CHANGED_EXISTING_RECORD"] == 1
    assert "GLOSS_CHANGED" in delta[0]["change_classes"]


def test_operational_provenance_ignored():
    base = [_entry(ir_id="1", url=URL_A, source_record_id="e0", headword="á", evidence_snapshot="snap-1")]
    cur = [_entry(ir_id="1", url=URL_A, source_record_id="e0", headword="á", evidence_snapshot="snap-2")]
    # also different parse_warnings
    cur[0]["parse_warnings"] = ["no_senses_found"]
    delta, frag = compare_lexicon_records(base, cur, parser_compat_status="PASS")
    assert frag["classification_counts"] == {"UNCHANGED": 1}
    assert semantic_projection(base[0]) == semantic_projection(cur[0])


def test_ambiguous_identity_reported_conservatively():
    # Same headword twice on each side → ambiguous
    base = [
        _entry(ir_id="b1", url=URL_A, source_record_id="e0", headword="bá"),
        _entry(ir_id="b2", url=URL_A, source_record_id="e1", headword="bá"),
    ]
    # Different ids, same duplicated headword
    cur = [
        _entry(ir_id="c1", url=URL_A, source_record_id="e10", headword="bá"),
        _entry(ir_id="c2", url=URL_A, source_record_id="e11", headword="bá"),
    ]
    _, frag = compare_lexicon_records(base, cur, parser_compat_status="PASS")
    assert frag["classification_counts"].get("IDENTITY_AMBIGUOUS", 0) >= 1


def test_duplicate_stable_identity_rejected():
    rows = [
        _entry(ir_id="1", url=URL_A, source_record_id="e0", headword="á"),
        _entry(ir_id="2", url=URL_A, source_record_id="e0", headword="à"),
    ]
    refs = [record_ref_from_ir("baseline", r) for r in rows]
    assert reject_duplicate_primary_keys(refs) == [(URL_A, "e0")]
    with pytest.raises(ValueError, match="duplicate_stable_identity"):
        compare_lexicon_records(rows, rows, parser_compat_status="PASS")


def test_deterministic_ordering_and_serialization(tmp_path: Path):
    base = [
        _entry(ir_id="2", url=URL_B, source_record_id="e1", headword="ba"),
        _entry(ir_id="1", url=URL_A, source_record_id="e0", headword="á"),
    ]
    cur = [
        _entry(ir_id="1", url=URL_A, source_record_id="e0", headword="á"),
        _entry(ir_id="3", url=URL_A, source_record_id="e9", headword="ax"),
        _entry(ir_id="2", url=URL_B, source_record_id="e1", headword="ba"),
    ]
    d1, _ = compare_lexicon_records(base, cur, parser_compat_status="PASS")
    d2, _ = compare_lexicon_records(base, cur, parser_compat_status="PASS")
    assert [r["classification"] for r in d1] == [r["classification"] for r in d2]
    p1 = tmp_path / "d1.jsonl"
    p2 = tmp_path / "d2.jsonl"
    h1 = write_jsonl(p1, d1)
    h2 = write_jsonl(p2, d2)
    assert h1 == h2
    assert p1.read_bytes() == p2.read_bytes()


def test_baseline_and_current_inputs_never_mutated(tmp_path: Path):
    base_path = tmp_path / "base.jsonl"
    cur_path = tmp_path / "cur.jsonl"
    base = [_entry(ir_id="1", url=URL_A, source_record_id="e0", headword="á")]
    cur = base + [_entry(ir_id="2", url=URL_A, source_record_id="e1", headword="zz")]
    write_jsonl(base_path, base)
    write_jsonl(cur_path, cur)
    before_b = base_path.read_bytes()
    before_c = cur_path.read_bytes()
    b = load_jsonl_records(base_path)
    c = load_jsonl_records(cur_path)
    compare_lexicon_records(b, c, parser_compat_status="PASS")
    assert base_path.read_bytes() == before_b
    assert cur_path.read_bytes() == before_c


def test_parser_failure_blocks_misleading_semantic_delta():
    base = [
        _entry(ir_id="1", url=URL_A, source_record_id="e0", headword="á", gloss_fr="g"),
    ]
    # Current keeps identity but loses all senses (parser breakage simulation)
    cur = [
        _entry(ir_id="1", url=URL_A, source_record_id="e0", headword="á", gloss_fr=None, nko="ߊ"),
    ]
    cur[0]["fields_raw"].pop("senses", None)
    cur[0]["parse_warnings"] = ["no_senses_found"]

    compat = assess_parser_compatibility(base, cur, nested_lxp2_pages=1, pages_checked=1)
    assert compat.status == "FAIL"

    delta, frag = compare_lexicon_records(base, cur, parser_compat_status=compat.status)
    assert frag["semantic_compare_enabled"] is False
    assert frag["classification_counts"].get("CHANGED_EXISTING_RECORD", 0) == 0
    assert frag["classification_counts"].get("SEMANTIC_COMPARE_BLOCKED", 0) == 1
    assert all(r["classification"] != "CHANGED_EXISTING_RECORD" for r in delta)


def test_detect_nested_lxp2():
    html = (
        '<p class="lxP"><span id="e0" class="Lxe">á</span>'
        '<p class="lxP2"> <span class="GlEn">huh?</span></p></p>'
    )
    assert detect_nested_lxp2_in_html(html) is True
    html_ok = (
        '<p class="lxP"><span id="e0" class="Lxe">á</span></p>'
        '<p class="lxP2"><span class="GlFr">hein</span></p>'
    )
    assert detect_nested_lxp2_in_html(html_ok) is False


def test_provisional_match_when_ids_renumbered():
    base = [_entry(ir_id="1", url=URL_A, source_record_id="e0", headword="á", gloss_fr="g")]
    cur = [_entry(ir_id="9", url=URL_A, source_record_id="e99", headword="á", gloss_fr="g")]
    delta, frag = compare_lexicon_records(base, cur, parser_compat_status="PASS")
    assert frag["classification_counts"]["UNCHANGED"] == 1
    assert delta[0]["identity_confidence"] == "PROVISIONAL"
    assert delta[0]["match_method"] == "url_canonical+headword_latin_unique"


def test_canonical_dumps_sorted():
    assert canonical_dumps({"b": 1, "a": 2}) == '{"a":2,"b":1}'
