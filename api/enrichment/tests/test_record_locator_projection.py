"""Tests for lexicon record_locator projection through enrichment."""

from __future__ import annotations

import json
import tempfile
from pathlib import Path

import pytest

from enrichment.enrich import (
    EnrichmentLocatorError,
    enrich_record,
    enrich_records,
)
from enrichment.validate_enrichment_display_only import validate_display_only


def _write_jsonl(path: Path, records: list[dict]) -> None:
    with open(path, "w", encoding="utf-8") as handle:
        for record in records:
            handle.write(json.dumps(record, ensure_ascii=False) + "\n")


def malipense_ir_unit() -> dict:
    return {
        "ir_id": "71e323e2dafa590f",
        "ir_kind": "lexicon_entry",
        "source_id": "src_malipense",
        "parser_version": "malipense_lexicon_v3",
        "evidence": [],
        "record_locator": {
            "kind": "source_record_id",
            "url_canonical": "https://www.mali-pense.net/emk/lexicon/d.htm",
            "source_record_id": "e2533",
            "anchor_names": ["dándaso", "dandaso"],
        },
        "fields_raw": {
            "headword_latin": "dándaso",
            "anchor_names": ["dándaso", "dandaso"],
            "senses": [{"gloss_en": "hospital"}],
        },
    }


def malipense_normalized() -> dict:
    return {
        "ir_id": "71e323e2dafa590f",
        "ir_kind": "lexicon_entry",
        "source_id": "src_malipense",
        "norm_version": "norm_v3",
        "preferred_form": "dándaso",
        "variant_forms": ["dándaso", "dandaso"],
        "search_keys": {"casefold": ["dándaso"]},
    }


def owner_ir_unit() -> dict:
    record_locator = {
        "kind": "source_record_id",
        "url_canonical": "siralex://lexical-review/7n2a/ndandayoro",
        "source_record_id": "7n2a_ndandayoro_v1",
        "anchor_names": ["ndándayoro"],
    }
    return {
        "ir_id": "a9c7d82decee9191",
        "ir_kind": "lexicon_entry",
        "source_id": "src_siralex_lexical_review",
        "parser_version": "siralex_owner_lexical_v1",
        "evidence": [],
        "record_locator": record_locator,
        "fields_raw": {
            "headword_latin": "ndándayoro",
            "senses": [{"gloss_fr": "établissement de santé"}],
        },
        "provenance": {
            "source": {
                "id": "src_siralex_lexical_review",
                "name": "SiraLex owner-reviewed lexical addition",
                "url": None,
                "retrieved_at": "2026-07-05T14:04:34Z",
                "license_notes": "Owner-approved addition.",
                "record_pointer": {
                    "kind": "source_record_id",
                    "source_record_id": "7n2a_ndandayoro_v1",
                    "url_canonical": "siralex://lexical-review/7n2a/ndandayoro",
                },
            }
        },
        "derivation": {
            "kind": "owner_approved_lexical_addition",
            "rule_versions": {"normalization": "norm_v3"},
        },
    }


def owner_normalized() -> dict:
    ir_unit = owner_ir_unit()
    return {
        "ir_id": ir_unit["ir_id"],
        "ir_kind": "lexicon_entry",
        "source_id": ir_unit["source_id"],
        "norm_version": "norm_v3",
        "preferred_form": "ndándayoro",
        "variant_forms": ["ndándayoro"],
        "search_keys": {"casefold": ["ndándayoro"]},
        "provenance": ir_unit["provenance"],
        "derivation": ir_unit["derivation"],
    }


def test_malipense_lexicon_projects_source_record_id_and_anchor_names():
    ir_unit = malipense_ir_unit()
    normalized = malipense_normalized()
    lookup = {
        ir_unit["ir_id"]: {
            "fields_raw": ir_unit["fields_raw"],
            "record_locator": ir_unit["record_locator"],
            "ir_kind": "lexicon_entry",
        }
    }
    enriched = enrich_record(normalized, lookup)

    assert enriched["source_id"] == "src_malipense"
    assert enriched["record_locator"] == {
        "kind": "source_record_id",
        "url_canonical": "https://www.mali-pense.net/emk/lexicon/d.htm",
        "source_record_id": "e2533",
        "anchor_names": ["dándaso", "dandaso"],
    }
    # Join key used by index_mapping.target_entries[].anchor
    assert enriched["record_locator"]["source_record_id"] == "e2533"


def test_owner_lexicon_preserves_provenance_record_pointer_and_projects_locator():
    ir_unit = owner_ir_unit()
    normalized = owner_normalized()
    lookup = {
        ir_unit["ir_id"]: {
            "fields_raw": ir_unit["fields_raw"],
            "record_locator": ir_unit["record_locator"],
            "ir_kind": "lexicon_entry",
        }
    }
    enriched = enrich_record(normalized, lookup)

    assert enriched["provenance"] == normalized["provenance"]
    assert (
        enriched["provenance"]["source"]["record_pointer"]["url_canonical"]
        == "siralex://lexical-review/7n2a/ndandayoro"
    )
    assert (
        enriched["provenance"]["source"]["record_pointer"]["source_record_id"]
        == "7n2a_ndandayoro_v1"
    )
    assert enriched["record_locator"]["source_record_id"] == "7n2a_ndandayoro_v1"
    assert (
        enriched["record_locator"]["url_canonical"]
        == "siralex://lexical-review/7n2a/ndandayoro"
    )


def test_display_only_gate_allows_lexicon_record_locator():
    ir_unit = malipense_ir_unit()
    normalized = malipense_normalized()
    lookup = {
        ir_unit["ir_id"]: {
            "fields_raw": ir_unit["fields_raw"],
            "record_locator": ir_unit["record_locator"],
            "ir_kind": "lexicon_entry",
        }
    }
    enriched = enrich_record(normalized, lookup)
    issues = validate_display_only(
        {normalized["ir_id"]: normalized},
        {enriched["ir_id"]: enriched},
    )
    assert issues == []


def test_display_only_gate_rejects_record_locator_on_index_mapping():
    normalized = {
        "ir_id": "idx-1",
        "ir_kind": "index_mapping",
        "source_id": "src_malipense",
        "norm_version": "norm_v3",
        "preferred_form": "hôpital",
        "variant_forms": ["hôpital"],
        "search_keys": {"casefold": ["hôpital"]},
    }
    enriched = {
        **normalized,
        "display": {"source_term": "hôpital", "target_entries": []},
        "record_locator": {
            "kind": "source_record_id",
            "url_canonical": "https://example.com",
            "source_record_id": "e1",
            "anchor_names": [],
        },
    }
    issues = validate_display_only(
        {normalized["ir_id"]: normalized},
        {enriched["ir_id"]: enriched},
    )
    assert any("only allowed on lexicon_entry" in msg for msg in issues)


def test_missing_source_record_id_fails_closed():
    lookup = {
        "71e323e2dafa590f": {
            "fields_raw": malipense_ir_unit()["fields_raw"],
            "record_locator": {
                "kind": "source_record_id",
                "url_canonical": "https://www.mali-pense.net/emk/lexicon/d.htm",
                "anchor_names": ["dándaso"],
            },
            "ir_kind": "lexicon_entry",
        }
    }
    with pytest.raises(EnrichmentLocatorError, match="source_record_id"):
        enrich_record(malipense_normalized(), lookup)


def test_missing_anchor_names_defaults_to_empty_list():
    lookup = {
        "71e323e2dafa590f": {
            "fields_raw": malipense_ir_unit()["fields_raw"],
            "record_locator": {
                "kind": "source_record_id",
                "url_canonical": "https://www.mali-pense.net/emk/lexicon/d.htm",
                "source_record_id": "e2533",
            },
            "ir_kind": "lexicon_entry",
        }
    }
    enriched = enrich_record(malipense_normalized(), lookup)
    assert enriched["record_locator"]["source_record_id"] == "e2533"
    assert enriched["record_locator"]["anchor_names"] == []


def test_end_to_end_projects_malipense_and_owner_locators():
    malipense_ir = malipense_ir_unit()
    owner_ir = owner_ir_unit()
    with tempfile.TemporaryDirectory() as tmpdir:
        norm_path = Path(tmpdir) / "normalized.jsonl"
        ir_path = Path(tmpdir) / "ir.jsonl"
        out_path = Path(tmpdir) / "enriched.jsonl"
        _write_jsonl(norm_path, [malipense_normalized(), owner_normalized()])
        _write_jsonl(ir_path, [malipense_ir, owner_ir])

        stats = enrich_records(norm_path, [ir_path], out_path)
        assert stats["enriched_with_display"] == 2
        assert stats["enriched_with_record_locator"] == 2
        assert stats["duplicate_locator_tuples"] == 0

        rows = [
            json.loads(line)
            for line in out_path.read_text(encoding="utf-8").splitlines()
            if line.strip()
        ]
        by_id = {row["ir_id"]: row for row in rows}
        assert by_id["71e323e2dafa590f"]["record_locator"]["source_record_id"] == "e2533"
        assert (
            by_id["a9c7d82decee9191"]["provenance"]["source"]["record_pointer"][
                "source_record_id"
            ]
            == "7n2a_ndandayoro_v1"
        )


def _lexicon_row(
    *,
    ir_id: str,
    source_id: str,
    url_canonical: str,
    source_record_id: str,
) -> dict:
    return {
        "ir_id": ir_id,
        "ir_kind": "lexicon_entry",
        "source_id": source_id,
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


def test_duplicate_malipense_locator_tuple_fails():
    from enrichment.enrich import (
        EnrichmentDuplicateLocatorError,
        assert_unique_lexicon_locator_tuples,
        validate_unique_lexicon_locator_tuples,
    )

    rows = [
        _lexicon_row(
            ir_id="lex-a",
            source_id="src_malipense",
            url_canonical="https://www.mali-pense.net/emk/lexicon/d.htm",
            source_record_id="e2533",
        ),
        _lexicon_row(
            ir_id="lex-b",
            source_id="src_malipense",
            url_canonical="https://www.mali-pense.net/emk/lexicon/d.htm",
            source_record_id="e2533",
        ),
    ]
    issues = validate_unique_lexicon_locator_tuples(rows)
    assert len(issues) == 1
    assert "e2533" in issues[0]
    assert "lex-a" in issues[0] and "lex-b" in issues[0]
    with pytest.raises(EnrichmentDuplicateLocatorError, match="duplicate lexicon locator"):
        assert_unique_lexicon_locator_tuples(rows)


def test_duplicate_owner_locator_tuple_fails():
    from enrichment.enrich import validate_unique_lexicon_locator_tuples

    rows = [
        _lexicon_row(
            ir_id="owner-a",
            source_id="src_siralex_lexical_review",
            url_canonical="siralex://lexical-review/7n2a/ndandayoro",
            source_record_id="7n2a_ndandayoro_v1",
        ),
        _lexicon_row(
            ir_id="owner-b",
            source_id="src_siralex_lexical_review",
            url_canonical="siralex://lexical-review/7n2a/ndandayoro",
            source_record_id="7n2a_ndandayoro_v1",
        ),
    ]
    issues = validate_unique_lexicon_locator_tuples(rows)
    assert len(issues) == 1
    assert "7n2a_ndandayoro_v1" in issues[0]


def test_distinct_locator_tuples_pass():
    from enrichment.enrich import validate_unique_lexicon_locator_tuples

    rows = [
        _lexicon_row(
            ir_id="71e323e2dafa590f",
            source_id="src_malipense",
            url_canonical="https://www.mali-pense.net/emk/lexicon/d.htm",
            source_record_id="e2533",
        ),
        _lexicon_row(
            ir_id="a9c7d82decee9191",
            source_id="src_siralex_lexical_review",
            url_canonical="siralex://lexical-review/7n2a/ndandayoro",
            source_record_id="7n2a_ndandayoro_v1",
        ),
        {
            "ir_id": "idx-hopital",
            "ir_kind": "index_mapping",
            "source_id": "src_malipense",
            "norm_version": "norm_v3",
            "preferred_form": "hôpital",
            "variant_forms": ["hôpital"],
            "search_keys": {},
            "display": {
                "source_term": "hôpital",
                "target_entries": [
                    {
                        "lexicon_url": "../lexicon/d.htm",
                        "anchor": "e2533",
                        "display_text": "dándaso",
                    }
                ],
            },
        },
    ]
    assert validate_unique_lexicon_locator_tuples(rows) == []


def test_index_mapping_rows_ignored_for_locator_uniqueness():
    """Index mappings must not carry record_locator; uniqueness ignores them."""
    from enrichment.enrich import validate_unique_lexicon_locator_tuples

    index_row = {
        "ir_id": "idx-1",
        "ir_kind": "index_mapping",
        "source_id": "src_malipense",
        "norm_version": "norm_v3",
        "preferred_form": "hôpital",
        "variant_forms": ["hôpital"],
        "search_keys": {},
        "display": {"source_term": "hôpital", "target_entries": []},
    }
    # Even if a malformed index row somehow carried a locator, uniqueness
    # still ignores non-lexicon_entry rows.
    malformed_index = {
        **index_row,
        "ir_id": "idx-2",
        "record_locator": {
            "kind": "source_record_id",
            "url_canonical": "https://www.mali-pense.net/emk/lexicon/d.htm",
            "source_record_id": "e2533",
            "anchor_names": [],
        },
    }
    lexicon = _lexicon_row(
        ir_id="71e323e2dafa590f",
        source_id="src_malipense",
        url_canonical="https://www.mali-pense.net/emk/lexicon/d.htm",
        source_record_id="e2533",
    )
    assert validate_unique_lexicon_locator_tuples([lexicon, index_row, malformed_index]) == []


def test_enrich_records_fails_closed_on_duplicate_locator_tuple():
    from enrichment.enrich import EnrichmentDuplicateLocatorError

    ir_a = malipense_ir_unit()
    ir_b = {
        **malipense_ir_unit(),
        "ir_id": "duplicate-locator-ir",
        "fields_raw": {"headword_latin": "other", "senses": []},
        # Same locator tuple as ir_a
    }
    norm_a = malipense_normalized()
    norm_b = {
        **malipense_normalized(),
        "ir_id": "duplicate-locator-ir",
        "preferred_form": "other",
        "variant_forms": ["other"],
    }
    with tempfile.TemporaryDirectory() as tmpdir:
        norm_path = Path(tmpdir) / "normalized.jsonl"
        ir_path = Path(tmpdir) / "ir.jsonl"
        out_path = Path(tmpdir) / "enriched.jsonl"
        _write_jsonl(norm_path, [norm_a, norm_b])
        _write_jsonl(ir_path, [ir_a, ir_b])
        with pytest.raises(EnrichmentDuplicateLocatorError, match="e2533"):
            enrich_records(norm_path, [ir_path], out_path)


def test_display_only_gate_reports_duplicate_locator_tuple():
    base_a = {
        "ir_id": "lex-a",
        "ir_kind": "lexicon_entry",
        "source_id": "src_malipense",
        "norm_version": "norm_v3",
        "preferred_form": "a",
        "variant_forms": ["a"],
        "search_keys": {},
    }
    base_b = {**base_a, "ir_id": "lex-b", "preferred_form": "b", "variant_forms": ["b"]}
    locator = {
        "kind": "source_record_id",
        "url_canonical": "https://www.mali-pense.net/emk/lexicon/d.htm",
        "source_record_id": "e2533",
        "anchor_names": [],
    }
    enr_a = {**base_a, "display": {"headword_latin": "a"}, "record_locator": locator}
    enr_b = {**base_b, "display": {"headword_latin": "b"}, "record_locator": locator}
    issues = validate_display_only(
        {"lex-a": base_a, "lex-b": base_b},
        {"lex-a": enr_a, "lex-b": enr_b},
    )
    assert any("duplicate lexicon locator tuple" in msg for msg in issues)
