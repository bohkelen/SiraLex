"""Tests for manual lexical-review provenance projection through enrichment."""

import json
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "shared"))

from enrichment.enrich import enrich_record, enrich_records  # noqa: E402
from enrichment.validate_enrichment_display_only import validate_display_only  # noqa: E402
from ir.lexical_review import (  # noqa: E402
    OWNER_APPROVED_LEXICAL_DERIVATION_KIND,
    SIRALEX_LEXICAL_REVIEW_SOURCE_ID,
    SIRALEX_OWNER_LEXICAL_PARSER_VERSION,
)


def manual_lexical_ir() -> dict:
    record_locator = {
        "kind": "source_record_id",
        "url_canonical": "siralex://lexical-review/7n2a/ndandayoro",
        "source_record_id": "7n2a_ndandayoro_v1",
        "anchor_names": ["ndándayoro"],
    }
    return {
        "ir_id": "test-manual-provenance",
        "ir_kind": "lexicon_entry",
        "source_id": SIRALEX_LEXICAL_REVIEW_SOURCE_ID,
        "parser_version": SIRALEX_OWNER_LEXICAL_PARSER_VERSION,
        "evidence": [
            {
                "source_id": SIRALEX_LEXICAL_REVIEW_SOURCE_ID,
                "review_reference": {
                    "document_path": "docs/reviews/phase7n2a_ndandayoro_lexical_review.md",
                    "approval_status": "owner linguistic approval recorded",
                    "reviewer_role": "project owner / native-speaker linguistic authority",
                },
                "text_quote": "ndándayoro",
            }
        ],
        "record_locator": record_locator,
        "fields_raw": {
            "headword_latin": "ndándayoro",
            "senses": [{"gloss_fr": "établissement de santé"}],
        },
        "provenance": {
            "source": {
                "id": SIRALEX_LEXICAL_REVIEW_SOURCE_ID,
                "name": "SiraLex owner-reviewed lexical addition",
                "url": "https://github.com/thethiccckening/SiraLex",
                "retrieved_at": "2026-07-05T12:00:00Z",
                "license_notes": (
                    "Owner-approved SiraLex project lexical addition; "
                    "not derived from Mali-Pense."
                ),
                "record_pointer": {
                    "kind": "source_record_id",
                    "source_record_id": record_locator["source_record_id"],
                    "url_canonical": record_locator["url_canonical"],
                },
            }
        },
        "derivation": {
            "kind": OWNER_APPROVED_LEXICAL_DERIVATION_KIND,
            "rule_versions": {"normalization": "norm_v3"},
        },
    }


def normalized_manual_record() -> dict:
    return {
        "ir_id": "test-manual-provenance",
        "ir_kind": "lexicon_entry",
        "source_id": SIRALEX_LEXICAL_REVIEW_SOURCE_ID,
        "norm_version": "norm_v3",
        "preferred_form": "ndándayoro",
        "variant_forms": ["ndándayoro"],
        "search_keys": {"casefold": ["ndándayoro"]},
        "provenance": manual_lexical_ir()["provenance"],
        "derivation": manual_lexical_ir()["derivation"],
    }


def _write_jsonl(path: Path, records: list[dict]) -> None:
    with open(path, "w", encoding="utf-8") as handle:
        for record in records:
            handle.write(json.dumps(record, ensure_ascii=False) + "\n")


def test_manual_provenance_and_derivation_survive_enrichment_unchanged():
    ir_unit = manual_lexical_ir()
    normalized = normalized_manual_record()
    lookup = {ir_unit["ir_id"]: ir_unit["fields_raw"]}
    enriched = enrich_record(normalized, lookup)

    assert enriched["provenance"] == normalized["provenance"]
    assert enriched["derivation"] == normalized["derivation"]
    assert enriched["display"] == ir_unit["fields_raw"]


def test_display_only_gate_passes_for_manual_provenance_enrichment():
    normalized = normalized_manual_record()
    ir_unit = manual_lexical_ir()
    lookup = {ir_unit["ir_id"]: ir_unit["fields_raw"]}
    enriched = enrich_record(normalized, lookup)

    issues = validate_display_only(
        {normalized["ir_id"]: normalized},
        {enriched["ir_id"]: enriched},
    )
    assert issues == []


def test_display_only_gate_passes_for_malipense_without_provenance():
    normalized = {
        "ir_id": "malipense-fixture",
        "ir_kind": "lexicon_entry",
        "source_id": "src_malipense",
        "norm_version": "norm_v3",
        "preferred_form": "dándaso",
        "variant_forms": ["dándaso"],
        "search_keys": {"casefold": ["dándaso"]},
    }
    ir_fields = {"headword_latin": "dándaso", "senses": [{"gloss_en": "hospital"}]}
    enriched = enrich_record(normalized, {"malipense-fixture": ir_fields})

    issues = validate_display_only(
        {normalized["ir_id"]: normalized},
        {enriched["ir_id"]: enriched},
    )
    assert issues == []
    assert "provenance" not in enriched
    assert "derivation" not in enriched


def test_manual_provenance_end_to_end_file_enrichment():
    ir_unit = manual_lexical_ir()
    normalized = normalized_manual_record()

    with tempfile.TemporaryDirectory() as tmpdir:
        norm_path = Path(tmpdir) / "normalized.jsonl"
        ir_path = Path(tmpdir) / "ir.jsonl"
        output_path = Path(tmpdir) / "enriched.jsonl"
        _write_jsonl(norm_path, [normalized])
        _write_jsonl(ir_path, [ir_unit])

        stats = enrich_records(norm_path, [ir_path], output_path)
        assert stats["enriched_with_display"] == 1

        enriched = json.loads(output_path.read_text(encoding="utf-8").strip())
        assert enriched["provenance"] == normalized["provenance"]
        assert enriched["derivation"] == normalized["derivation"]
