"""
Focused tests for norm_v2 additive search behavior.
"""

import sys
from pathlib import Path


# Add shared to path for imports.
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "shared"))

from normalization.norm_v2 import (  # noqa: E402
    MAX_SOURCE_PHRASES,
    RULESET_ID,
    extract_source_phrases,
)
from normalizer.normalize import normalize_index_mapping, normalize_lexicon_entry  # noqa: E402


def test_extract_source_phrases_keeps_original_and_adds_gloss_phrases():
    source_term = (
        "a) bon travail! (une salutation à celui qui est en train de travailler), "
        "b) merci! (pour un travail)"
    )

    phrases = extract_source_phrases(source_term)

    assert phrases[0] == source_term
    assert "bon travail" in phrases
    assert "merci" in phrases


def test_extract_source_phrases_adds_parenthetical_free_variant():
    source_term = "bon réveil! (lit : que tu sortes de la nuit!)"

    phrases = extract_source_phrases(source_term)

    assert source_term in phrases
    assert "bon réveil" in phrases


def test_extract_source_phrases_filters_stopword_only_segments():
    source_term = "a) de la, b) bon travail"

    phrases = extract_source_phrases(source_term)

    assert source_term in phrases
    assert "de la" not in phrases
    assert "bon travail" in phrases


def test_extract_source_phrases_preserves_multiword_phrase_without_word_tokens():
    phrases = extract_source_phrases("bon travail")

    assert phrases == ["bon travail"]


def test_extract_source_phrases_caps_total_output():
    source_term = ", ".join(f"{idx}. segment {idx} (note {idx})" for idx in range(1, 25))

    phrases = extract_source_phrases(source_term)

    assert phrases[0] == source_term
    assert len(phrases) <= MAX_SOURCE_PHRASES


def test_normalize_index_mapping_uses_extracted_source_phrases():
    ir_unit = {
        "ir_id": "idx-bon-travail",
        "ir_kind": "index_mapping",
        "source_id": "src_malipense",
        "fields_raw": {
            "source_term": (
                "a) bon travail! (une salutation à celui qui est en train de travailler), "
                "b) merci! (pour un travail)"
            ),
            "source_lang": "fr",
        },
    }

    result = normalize_index_mapping(ir_unit)

    assert result.norm_version == RULESET_ID
    assert result.variant_forms[0] == ir_unit["fields_raw"]["source_term"]
    assert "bon travail" in result.variant_forms
    assert "merci" in result.variant_forms
    assert "bon travail" in result.search_keys["casefold"]
    assert "merci" in result.search_keys["casefold"]


def test_normalize_index_mapping_adds_bon_reveil_variant():
    ir_unit = {
        "ir_id": "idx-bon-reveil",
        "ir_kind": "index_mapping",
        "source_id": "src_malipense",
        "fields_raw": {
            "source_term": "bon réveil! (lit : que tu sortes de la nuit!)",
            "source_lang": "fr",
        },
    }

    result = normalize_index_mapping(ir_unit)

    assert result.norm_version == RULESET_ID
    assert "bon réveil" in result.variant_forms
    assert "bon réveil" in result.search_keys["casefold"]


def test_normalize_lexicon_entry_adds_nko_headword_variant():
    ir_unit = {
        "ir_id": "lex-nko",
        "ir_kind": "lexicon_entry",
        "source_id": "src_malipense",
        "record_locator": {"anchor_names": ["dàa"]},
        "fields_raw": {
            "headword_latin": "dàa",
            "headword_nko_provided": "ߘߊ߰",
        },
    }

    result = normalize_lexicon_entry(ir_unit)

    assert result.norm_version == RULESET_ID
    assert "ߘߊ߰" in result.variant_forms
    assert "ߘߊ߰" in result.search_keys["casefold"]
