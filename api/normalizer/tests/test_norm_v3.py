"""
norm_v3: NFC search-key input canonicalization on top of norm_v2 behavior.

norm_v1 and norm_v2 modules must stay behaviorally unchanged; tests here lock
norm_v3 composition only.
"""

import sys
import unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "shared"))

from normalization.norm_v2 import (  # noqa: E402
    compute_search_keys as norm_v2_compute_search_keys,
    extract_source_phrases,
)
from normalization.norm_v3 import RULESET_ID, compute_search_keys as norm_v3_compute_search_keys  # noqa: E402
from normalizer.normalize import normalize_index_mapping, normalize_lexicon_entry  # noqa: E402


def test_ruleset_id_is_norm_v3():
    assert RULESET_ID == "norm_v3"


def test_nfc_canonical_equivalence_kun_maninka():
    """Composed kùn vs NFD u+combining grave produce identical search keys."""
    composed = "kùn"
    decomposed = "ku\u0300n"
    assert composed != decomposed
    assert unicodedata.normalize("NFC", decomposed) == composed

    keys_a = norm_v3_compute_search_keys([composed])
    keys_b = norm_v3_compute_search_keys([decomposed])
    assert keys_a == keys_b
    assert "kùn" in keys_a["casefold"]


def test_nfc_canonical_equivalence_tete_french():
    """Composed tête vs NFD e+combining circumflex match under norm_v3."""
    composed = "tête"
    decomposed = "te\u0302te"
    assert unicodedata.normalize("NFC", decomposed) == composed

    keys_a = norm_v3_compute_search_keys([composed])
    keys_b = norm_v3_compute_search_keys([decomposed])
    assert keys_a == keys_b
    assert keys_a["casefold"] == ["tête"]


def test_norm_v3_differs_from_norm_v2_on_nfd_latin():
    """norm_v2 (norm_v1 keys) leaves NFD in casefold; norm_v3 composes first."""
    decomposed = "ku\u0300n"
    v2 = norm_v2_compute_search_keys([decomposed])
    v3 = norm_v3_compute_search_keys([decomposed])
    assert v2["casefold"] != v3["casefold"]
    assert v3["casefold"] == ["kùn"]


def test_norm_v3_matches_norm_v2_for_nfc_stable_forms():
    """NFC-stable inputs: identical key material to norm_v2 / norm_v1 path."""
    forms = ["bonjour", "café", "dɔ́bɛ̀n", "merci le monde"]
    assert norm_v2_compute_search_keys(forms) == norm_v3_compute_search_keys(forms)


def test_norm_v3_normalize_index_mapping_variant_forms_identical_to_extract_v2():
    """phrase list is still pure norm_v2 extract_source_phrases output."""
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
    expected_variants = extract_source_phrases(ir_unit["fields_raw"]["source_term"])
    assert result.variant_forms == expected_variants


def test_norm_v3_normalize_lexicon_entry_preserves_raw_variants():
    """N'Ko append + anchors unchanged; only norm_version and search_keys move."""
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
    assert result.variant_forms == ["dàa", "ߘߊ߰"]
    assert "ߘߊ߰" in result.search_keys["casefold"]


def test_normalize_pipeline_emits_norm_v3():
    """Active normalizer stamps norm_v3 on emitted records."""
    ir_unit = {
        "ir_id": "x1",
        "ir_kind": "index_mapping",
        "source_id": "src_malipense",
        "fields_raw": {"source_term": "test", "source_lang": "fr"},
    }
    assert normalize_index_mapping(ir_unit).norm_version == "norm_v3"
