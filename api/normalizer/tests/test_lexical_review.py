"""Tests for Phase 7N2A manual lexical-review and reviewed target variant support."""

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "shared"))

from ir.lexical_review import (  # noqa: E402
    OWNER_APPROVED_LEXICAL_DERIVATION_KIND,
    LexicalReviewValidationError,
    LexiconVariantRegistry,
    SIRALEX_LEXICAL_REVIEW_SOURCE_ID,
    SIRALEX_OWNER_LEXICAL_PARSER_VERSION,
    project_manual_provenance_derivation,
    validate_lexicon_entry_evidence,
    validate_malipense_lexicon_evidence,
    validate_manual_lexical_review_evidence,
    validate_manual_lexical_review_provenance,
)
from ir.models import compute_ir_id  # noqa: E402
from normalization.norm_v3 import normalize_nfc  # noqa: E402
from normalizer.normalize import normalize_lexicon_entry  # noqa: E402

REPO_ROOT = Path(__file__).parent.parent.parent.parent
OWNER_LEXICAL_IR_PATH = REPO_ROOT / "data" / "ir" / "siralex_owner_lexical_v1.jsonl"
EXPECTED_OWNER_RECORDS = {
    "ndándayoro": {
        "source_record_id": "7n2a_ndandayoro_v1",
        "url_canonical": "siralex://lexical-review/7n2a/ndandayoro",
        "ir_id": "a9c7d82decee9191",
        "review_document": "docs/reviews/phase7n2a_ndandayoro_lexical_review.md",
    },
    "ndándadiya": {
        "source_record_id": "7n2a_ndandadiya_v1",
        "url_canonical": "siralex://lexical-review/7n2a/ndandadiya",
        "ir_id": "fefe9b063e05ed11",
        "review_document": "docs/reviews/phase7n2a_ndandadiya_lexical_review.md",
    },
}


def manual_provenance_derivation_blocks(
    *,
    source_record_id: str = "7n2a_ndandayoro_v1",
    url_canonical: str = "siralex://lexical-review/7n2a/ndandayoro",
    retrieved_at: str = "2026-07-05T12:00:00Z",
    license_notes: str = (
        "Owner-approved SiraLex project lexical addition; not derived from Mali-Pense."
    ),
    source_url: str | None = "https://github.com/thethiccckening/SiraLex",
    normalization_ruleset: str = "norm_v3",
) -> dict:
    return {
        "provenance": {
            "source": {
                "id": SIRALEX_LEXICAL_REVIEW_SOURCE_ID,
                "name": "SiraLex owner-reviewed lexical addition",
                "url": source_url,
                "retrieved_at": retrieved_at,
                "license_notes": license_notes,
                "record_pointer": {
                    "kind": "source_record_id",
                    "source_record_id": source_record_id,
                    "url_canonical": url_canonical,
                },
            }
        },
        "derivation": {
            "kind": OWNER_APPROVED_LEXICAL_DERIVATION_KIND,
            "rule_versions": {"normalization": normalization_ruleset},
        },
    }


def manual_lexical_ir(**overrides) -> dict:
    record_locator = {
        "kind": "source_record_id",
        "url_canonical": "siralex://lexical-review/7n2a/ndandayoro",
        "source_record_id": "7n2a_ndandayoro_v1",
        "anchor_names": ["ndándayoro"],
    }
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
        "record_locator": record_locator,
        "fields_raw": {
            "headword_latin": "ndándayoro",
            "senses": [{"gloss_fr": "health institution"}],
        },
        **manual_provenance_derivation_blocks(
            source_record_id=record_locator["source_record_id"],
            url_canonical=record_locator["url_canonical"],
        ),
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


def frozen_nko_homograph_ir(
    *,
    ir_id: str,
    headword_latin: str,
    anchor_names: list[str],
    nko: str = "ߘߊ",
) -> dict:
    return {
        "ir_id": ir_id,
        "ir_kind": "lexicon_entry",
        "source_id": "src_malipense",
        "parser_version": "malipense_lexicon_v1",
        "evidence": [
            {
                "source_id": "src_malipense",
                "snapshot_id": "20f263ef15dc6ae1",
                "entry_block": {
                    "start_selector": f"span#{ir_id}",
                    "end_selector": f"span#{ir_id}-next",
                },
                "text_quote": headword_latin,
            }
        ],
        "record_locator": {
            "kind": "source_record_id",
            "url_canonical": "https://www.mali-pense.net/emk/lexicon/d.htm",
            "source_record_id": ir_id,
            "anchor_names": anchor_names,
        },
        "fields_raw": {
            "headword_latin": headword_latin,
            "headword_nko_provided": nko,
            "senses": [{"gloss_en": "fixture"}],
        },
    }


def test_shared_nko_homographs_register_without_global_collision():
    minus_da = frozen_nko_homograph_ir(
        ir_id="964909ef6912ff64",
        headword_latin="-da",
        anchor_names=["-da"],
    )
    da_acute = frozen_nko_homograph_ir(
        ir_id="d426e49d1e2ab3d9",
        headword_latin="dá",
        anchor_names=["dá", "da"],
    )
    registry = LexiconVariantRegistry()
    registry.register_source_attested(minus_da)
    registry.register_source_attested(da_acute)


def test_nko_headword_remains_in_per_record_variant_forms_and_search_keys():
    ir_unit = frozen_nko_homograph_ir(
        ir_id="964909ef6912ff64",
        headword_latin="-da",
        anchor_names=["-da"],
    )
    registry = registry_for(ir_unit)
    result = normalize_lexicon_entry(ir_unit, variant_registry=registry)
    assert "ߘߊ" in result.variant_forms
    assert "ߘߊ" in result.search_keys["casefold"]


def test_duplicate_latin_attested_forms_block_reviewed_variants_across_records():
    first = frozen_nko_homograph_ir(
        ir_id="latin-owner-1",
        headword_latin="bá",
        anchor_names=["bá"],
        nko="ߓߊ",
    )
    second = {
        **frozen_nko_homograph_ir(
            ir_id="latin-owner-2",
            headword_latin="moyibaa",
            anchor_names=["moyibaa"],
            nko="ߡߏߦߌߓߊ",
        ),
        "reviewed_target_variants": [reviewed_variant_item(form="bá")],
    }
    registry = registry_for(first, second)
    with pytest.raises(LexicalReviewValidationError, match="conflicts with lexical record latin-owner-1"):
        normalize_lexicon_entry(second, variant_registry=registry)


def reviewed_variant_holder_ir(
    *,
    ir_id: str = "variant-holder",
    headword_latin: str = "móyibaa",
    anchor_names: list[str] | None = None,
    reviewed_forms: list[str] | None = None,
) -> dict:
    if anchor_names is None:
        anchor_names = []
    ir_unit = {
        "ir_id": ir_id,
        "ir_kind": "lexicon_entry",
        "source_id": "src_malipense",
        "parser_version": "malipense_lexicon_v1",
        "evidence": [
            {
                "source_id": "src_malipense",
                "snapshot_id": "20f263ef15dc6ae1",
                "entry_block": {
                    "start_selector": "span#holder",
                    "end_selector": "span#holder-next",
                },
                "text_quote": headword_latin,
            }
        ],
        "record_locator": {
            "kind": "source_record_id",
            "url_canonical": "https://www.mali-pense.net/emk/lexicon/m.htm",
            "source_record_id": "e-holder",
            "anchor_names": anchor_names,
        },
        "fields_raw": {
            "headword_latin": headword_latin,
            "senses": [{"gloss_en": "parent"}],
        },
    }
    if reviewed_forms is not None:
        ir_unit["reviewed_target_variants"] = [
            reviewed_variant_item(form=form) for form in reviewed_forms
        ]
    return ir_unit


def test_reviewed_variant_equal_to_own_headword_fails_with_empty_anchor_names():
    ir_unit = reviewed_variant_holder_ir(
        headword_latin="móyibaa",
        anchor_names=[],
        reviewed_forms=["móyibaa"],
    )
    registry = registry_for(ir_unit)
    with pytest.raises(LexicalReviewValidationError, match="duplicates canonical headword_latin"):
        normalize_lexicon_entry(ir_unit, variant_registry=registry)


def test_reviewed_variant_equal_to_own_headword_fails_when_anchor_omits_headword():
    ir_unit = reviewed_variant_holder_ir(
        headword_latin="móyibaa",
        anchor_names=["moyibaa"],
        reviewed_forms=["móyibaa"],
    )
    registry = registry_for(ir_unit)
    with pytest.raises(LexicalReviewValidationError, match="duplicates canonical headword_latin"):
        normalize_lexicon_entry(ir_unit, variant_registry=registry)


def test_duplicate_reviewed_variants_on_same_record_fail():
    ir_unit = reviewed_variant_holder_ir(reviewed_forms=["móbaa", "móbaa"])
    registry = registry_for(ir_unit)
    with pytest.raises(LexicalReviewValidationError, match="duplicate form"):
        normalize_lexicon_entry(ir_unit, variant_registry=registry)


def test_nfc_equivalent_duplicate_reviewed_variants_on_same_record_fail():
    ir_unit = reviewed_variant_holder_ir(reviewed_forms=["móbaa", "móbaa"])
    registry = registry_for(ir_unit)
    with pytest.raises(LexicalReviewValidationError, match="duplicate form"):
        normalize_lexicon_entry(ir_unit, variant_registry=registry)


def test_fully_populated_manual_lexical_review_ir_validates():
    validate_lexicon_entry_evidence(manual_lexical_ir())
    validate_manual_lexical_review_provenance(manual_lexical_ir())


def test_manual_lexical_missing_provenance_source_id_fails():
    ir_unit = manual_lexical_ir()
    ir_unit["provenance"]["source"].pop("id")
    with pytest.raises(LexicalReviewValidationError, match="missing fields"):
        validate_lexicon_entry_evidence(ir_unit)


def test_manual_lexical_missing_retrieved_at_fails():
    ir_unit = manual_lexical_ir()
    ir_unit["provenance"]["source"].pop("retrieved_at")
    with pytest.raises(LexicalReviewValidationError, match="retrieved_at"):
        validate_manual_lexical_review_provenance(ir_unit)


def test_manual_lexical_missing_license_notes_fails():
    ir_unit = manual_lexical_ir()
    ir_unit["provenance"]["source"].pop("license_notes")
    with pytest.raises(LexicalReviewValidationError, match="license_notes"):
        validate_manual_lexical_review_provenance(ir_unit)


def test_manual_lexical_mismatched_record_pointer_fails():
    ir_unit = manual_lexical_ir()
    ir_unit["provenance"]["source"]["record_pointer"]["source_record_id"] = "wrong-id"
    with pytest.raises(LexicalReviewValidationError, match="must match record_locator"):
        validate_manual_lexical_review_provenance(ir_unit)


def test_manual_lexical_missing_derivation_kind_fails():
    ir_unit = manual_lexical_ir()
    ir_unit["derivation"].pop("kind")
    with pytest.raises(LexicalReviewValidationError, match="derivation.kind"):
        validate_manual_lexical_review_provenance(ir_unit)


def test_manual_lexical_wrong_derivation_kind_fails():
    ir_unit = manual_lexical_ir()
    ir_unit["derivation"]["kind"] = "imported"
    with pytest.raises(LexicalReviewValidationError, match="derivation.kind"):
        validate_manual_lexical_review_provenance(ir_unit)


def test_manual_lexical_wrong_normalization_ruleset_fails():
    ir_unit = manual_lexical_ir()
    ir_unit["derivation"]["rule_versions"]["normalization"] = "norm_v1"
    with pytest.raises(LexicalReviewValidationError, match="normalization must be norm_v3"):
        validate_manual_lexical_review_provenance(ir_unit)


def test_manual_provenance_survives_normalization():
    ir_unit = manual_lexical_ir()
    registry = registry_for(ir_unit)
    result = normalize_lexicon_entry(ir_unit, variant_registry=registry)
    projected = project_manual_provenance_derivation(ir_unit)
    assert result.provenance == projected["provenance"]
    assert result.derivation == projected["derivation"]
    assert result.to_dict()["provenance"] == projected["provenance"]
    assert result.to_dict()["derivation"] == projected["derivation"]


def test_malipense_fixture_output_unchanged_without_manual_provenance():
    ir_unit = malipense_lexicon_ir()
    result_without_registry = normalize_lexicon_entry(ir_unit)
    registry = registry_for(ir_unit)
    result_with_registry = normalize_lexicon_entry(ir_unit, variant_registry=registry)
    assert result_without_registry.to_dict() == result_with_registry.to_dict()
    assert "provenance" not in result_without_registry.to_dict()
    assert "derivation" not in result_without_registry.to_dict()


def _load_owner_lexical_ir_records() -> list[dict]:
    records = []
    with OWNER_LEXICAL_IR_PATH.open(encoding="utf-8") as handle:
        for line in handle:
            if line.strip():
                records.append(json.loads(line))
    return records


def test_tracked_owner_lexical_ir_records_validate_and_have_distinct_ir_ids():
    records = _load_owner_lexical_ir_records()
    assert len(records) == 2

    seen_ir_ids: set[str] = set()
    for record in records:
        headword = record["fields_raw"]["headword_latin"]
        expected = EXPECTED_OWNER_RECORDS[headword]
        locator = record["record_locator"]

        assert normalize_nfc(headword) == headword
        assert locator["source_record_id"] == expected["source_record_id"]
        assert locator["url_canonical"] == expected["url_canonical"]
        assert record["evidence"][0]["review_reference"]["document_path"] == expected["review_document"]

        computed_ir_id = compute_ir_id(
            SIRALEX_LEXICAL_REVIEW_SOURCE_ID,
            locator["url_canonical"],
            locator["source_record_id"],
            SIRALEX_OWNER_LEXICAL_PARSER_VERSION,
        )
        assert record["ir_id"] == computed_ir_id == expected["ir_id"]
        assert record["ir_id"] not in seen_ir_ids
        seen_ir_ids.add(record["ir_id"])

        validate_lexicon_entry_evidence(record)
        validate_manual_lexical_review_provenance(record)

        registry = LexiconVariantRegistry()
        registry.register_source_attested(record)
        normalized = normalize_lexicon_entry(record, variant_registry=registry)
        projected = project_manual_provenance_derivation(record)
        assert normalized.provenance == projected["provenance"]
        assert normalized.derivation == projected["derivation"]
