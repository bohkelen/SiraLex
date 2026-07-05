"""Tests for Phase 7N2A manual lexical-review and reviewed target variant support."""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "shared"))

from ir.lexical_review import (  # noqa: E402
    LexicalReviewValidationError,
    LexiconVariantRegistry,
    SIRALEX_LEXICAL_REVIEW_SOURCE_ID,
    SIRALEX_OWNER_LEXICAL_PARSER_VERSION,
    validate_lexicon_entry_evidence,
    validate_malipense_lexicon_evidence,
    validate_manual_lexical_review_evidence,
)
from normalizer.normalize import normalize_lexicon_entry  # noqa: E402


def manual_lexical_ir(**overrides) -> dict:
    base = {
        "ir_id": "test-ndandayoro",
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
        "record_locator": {
            "kind": "source_record_id",
            "url_canonical": "siralex://lexical-review/7n2a/ndandayoro",
            "source_record_id": "7n2a_ndandayoro_v1",
            "anchor_names": ["ndándayoro"],
        },
        "fields_raw": {
            "headword_latin": "ndándayoro",
            "senses": [{"gloss_fr": "health institution"}],
        },
    }
    base.update(overrides)
    return base


def malipense_lexicon_ir() -> dict:
    return {
        "ir_id": "71e323e2dafa590f",
        "ir_kind": "lexicon_entry",
        "source_id": "src_malipense",
        "parser_version": "malipense_lexicon_v1",
        "evidence": [
            {
                "source_id": "src_malipense",
                "snapshot_id": "20f263ef15dc6ae1",
                "entry_block": {
                    "start_selector": "span#e2533",
                    "end_selector": "span#e2534",
                },
                "text_quote": "dándaso",
            }
        ],
        "record_locator": {
            "kind": "source_record_id",
            "url_canonical": "https://www.mali-pense.net/emk/lexicon/d.htm",
            "source_record_id": "e2533",
            "anchor_names": ["dándaso", "dandaso"],
        },
        "fields_raw": {
            "headword_latin": "dándaso",
            "headword_nko_provided": "ߘߊ߲ߘߊߛߏ",
            "senses": [{"gloss_en": "hospital"}],
        },
    }


def reviewed_variant_item(form: str = "móbaa") -> dict:
    return {
        "form": form,
        "review_document": "docs/PHASE_7K1_STRUCTURED_USABILITY_TRIAGE.md",
        "reviewer": "project owner",
        "reviewed_at": "2026-07-04",
        "rationale": "approved target-side variant",
    }


def registry_for(*ir_units: dict) -> LexiconVariantRegistry:
    registry = LexiconVariantRegistry()
    for ir_unit in ir_units:
        registry.register_source_attested(ir_unit)
    return registry


def test_manual_owner_review_provenance_accepts_valid_review_reference():
    validate_manual_lexical_review_evidence(manual_lexical_ir()["evidence"])
    validate_lexicon_entry_evidence(manual_lexical_ir())


def test_existing_malipense_evidence_profile_remains_valid():
    validate_malipense_lexicon_evidence(malipense_lexicon_ir()["evidence"])
    validate_lexicon_entry_evidence(malipense_lexicon_ir())


def test_invalid_manual_lexical_review_provenance_fails_closed():
    invalid = manual_lexical_ir()
    invalid["evidence"][0].pop("review_reference")
    with pytest.raises(LexicalReviewValidationError, match="review_reference"):
        validate_manual_lexical_review_evidence(invalid["evidence"])

    invalid_snapshot = manual_lexical_ir()
    invalid_snapshot["evidence"][0]["snapshot_id"] = "fake-snapshot"
    with pytest.raises(LexicalReviewValidationError, match="snapshot_id"):
        validate_manual_lexical_review_evidence(invalid_snapshot["evidence"])

    invalid_url = manual_lexical_ir()
    invalid_url["record_locator"]["url_canonical"] = "https://www.mali-pense.net/emk/lexicon/n.htm"
    with pytest.raises(LexicalReviewValidationError, match="Mali-Pense url_canonical"):
        validate_lexicon_entry_evidence(invalid_url)


def test_reviewed_target_variants_merge_into_variant_forms():
    ir_unit = malipense_lexicon_ir()
    ir_unit = {
        **ir_unit,
        "ir_id": "c5f78c8ac66eac6b",
        "fields_raw": {
            "headword_latin": "móyibaa",
            "senses": [{"gloss_en": "parent"}],
        },
        "record_locator": {
            **ir_unit["record_locator"],
            "anchor_names": ["móyibaa", "moyibaa"],
        },
        "reviewed_target_variants": [reviewed_variant_item()],
    }
    registry = registry_for(ir_unit)
    result = normalize_lexicon_entry(ir_unit, variant_registry=registry)
    assert "móbaa" in result.variant_forms
    assert result.variant_forms[:2] == ["móyibaa", "moyibaa"]


def test_reviewed_target_variants_generate_target_search_keys():
    ir_unit = malipense_lexicon_ir()
    ir_unit = {
        **ir_unit,
        "ir_id": "variant-target-1",
        "fields_raw": {"headword_latin": "móyibaa", "senses": [{"gloss_en": "parent"}]},
        "record_locator": {
            "kind": "source_record_id",
            "url_canonical": "https://www.mali-pense.net/emk/lexicon/m.htm",
            "source_record_id": "e6353",
            "anchor_names": ["móyibaa"],
        },
        "reviewed_target_variants": [reviewed_variant_item()],
    }
    registry = registry_for(ir_unit)
    result = normalize_lexicon_entry(ir_unit, variant_registry=registry)
    assert "móbaa" in result.search_keys["casefold"]


def test_reviewed_target_variants_do_not_alter_preferred_form():
    ir_unit = malipense_lexicon_ir()
    ir_unit = {
        **ir_unit,
        "ir_id": "variant-target-2",
        "fields_raw": {"headword_latin": "móyibaa", "senses": [{"gloss_en": "parent"}]},
        "record_locator": {
            "kind": "source_record_id",
            "url_canonical": "https://www.mali-pense.net/emk/lexicon/m.htm",
            "source_record_id": "e6353",
            "anchor_names": ["móyibaa"],
        },
        "reviewed_target_variants": [reviewed_variant_item()],
    }
    registry = registry_for(ir_unit)
    result = normalize_lexicon_entry(ir_unit, variant_registry=registry)
    assert result.preferred_form == "móyibaa"


def test_reviewed_target_variants_do_not_alter_record_locator_anchor_names():
    ir_unit = malipense_lexicon_ir()
    ir_unit = {
        **ir_unit,
        "ir_id": "variant-target-3",
        "fields_raw": {"headword_latin": "móyibaa", "senses": [{"gloss_en": "parent"}]},
        "record_locator": {
            "kind": "source_record_id",
            "url_canonical": "https://www.mali-pense.net/emk/lexicon/m.htm",
            "source_record_id": "e6353",
            "anchor_names": ["móyibaa", "moyibaa"],
        },
        "reviewed_target_variants": [reviewed_variant_item()],
    }
    registry = registry_for(ir_unit)
    normalize_lexicon_entry(ir_unit, variant_registry=registry)
    assert ir_unit["record_locator"]["anchor_names"] == ["móyibaa", "moyibaa"]


def test_duplicate_reviewed_variant_against_same_record_anchor_names_fails():
    ir_unit = malipense_lexicon_ir()
    ir_unit = {
        **ir_unit,
        "ir_id": "variant-target-4",
        "fields_raw": {"headword_latin": "móyibaa", "senses": [{"gloss_en": "parent"}]},
        "record_locator": {
            "kind": "source_record_id",
            "url_canonical": "https://www.mali-pense.net/emk/lexicon/m.htm",
            "source_record_id": "e6353",
            "anchor_names": ["móyibaa", "moyibaa"],
        },
        "reviewed_target_variants": [reviewed_variant_item(form="moyibaa")],
    }
    registry = registry_for(ir_unit)
    with pytest.raises(LexicalReviewValidationError, match="duplicates anchor_names"):
        normalize_lexicon_entry(ir_unit, variant_registry=registry)


def test_duplicate_reviewed_variant_against_another_record_fails():
    owner = malipense_lexicon_ir()
    owner["ir_id"] = "owner-record"
    owner["fields_raw"] = {"headword_latin": "bá", "senses": [{"gloss_en": "mother"}]}
    owner["record_locator"]["anchor_names"] = ["bá"]

    variant_holder = malipense_lexicon_ir()
    variant_holder = {
        **variant_holder,
        "ir_id": "variant-target-5",
        "fields_raw": {"headword_latin": "móyibaa", "senses": [{"gloss_en": "parent"}]},
        "record_locator": {
            "kind": "source_record_id",
            "url_canonical": "https://www.mali-pense.net/emk/lexicon/m.htm",
            "source_record_id": "e6353",
            "anchor_names": ["móyibaa"],
        },
        "reviewed_target_variants": [reviewed_variant_item(form="bá")],
    }
    registry = registry_for(owner, variant_holder)
    with pytest.raises(LexicalReviewValidationError, match="conflicts with lexical record owner-record"):
        normalize_lexicon_entry(variant_holder, variant_registry=registry)


def test_existing_rows_without_reviewed_target_variants_remain_unchanged():
    ir_unit = malipense_lexicon_ir()
    result_without_registry = normalize_lexicon_entry(ir_unit)
    registry = registry_for(ir_unit)
    result_with_registry = normalize_lexicon_entry(ir_unit, variant_registry=registry)
    assert result_without_registry.to_dict() == result_with_registry.to_dict()
