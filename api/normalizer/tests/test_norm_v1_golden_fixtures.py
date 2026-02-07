"""
Golden fixture regression tests for norm_v1 normalization.

Tests cover:
1. Pure key functions (primitive transforms)
2. Composed search key functions
3. Multi-variant key computation with deduplication
4. Lexicon entry normalization (preferred form, variants, search keys)
5. Index mapping normalization (French terms)
6. Structural integrity of normalized output
7. Edge cases (apostrophes, backticks, proper nouns, empty strings)
"""

import json
import sys
import unicodedata
import pytest
from pathlib import Path

# Add shared to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "shared"))

from normalization.norm_v1 import (
    RULESET_ID,
    normalize_whitespace,
    strip_diacritics,
    strip_punctuation,
    punctuation_to_space,
    casefold_latin,
    remove_spaces,
    normalize_nfc,
    key_casefold,
    key_diacritics_insensitive,
    key_punct_stripped,
    key_nospace,
    compute_search_keys,
    KEY_FUNCTIONS,
)

from api.normalizer.normalize import (
    normalize_lexicon_entry,
    normalize_index_mapping,
    normalize_ir_unit,
)


# ===========================================================================
# Category 1: Primitive transforms
# ===========================================================================

class TestNormalizeWhitespace:
    """Whitespace normalization: collapse sequences, trim."""

    def test_single_spaces_unchanged(self):
        assert normalize_whitespace("hello world") == "hello world"

    def test_multiple_spaces(self):
        assert normalize_whitespace("hello   world") == "hello world"

    def test_leading_trailing(self):
        assert normalize_whitespace("  hello  ") == "hello"

    def test_tabs_and_newlines(self):
        assert normalize_whitespace("hello\t\nworld") == "hello world"

    def test_empty_string(self):
        assert normalize_whitespace("") == ""

    def test_only_whitespace(self):
        assert normalize_whitespace("   ") == ""


class TestStripDiacritics:
    """Diacritics stripping: NFD → remove marks → NFC."""

    def test_tone_marks_removed(self):
        # ɔ́ = ɔ + combining acute → ɔ
        assert strip_diacritics("dɔ́bɛ̀n") == "dɔbɛn"

    def test_base_characters_preserved(self):
        # ɔ (U+0254) and ɛ (U+025B) are base characters, not marks
        assert strip_diacritics("dɔbɛn") == "dɔbɛn"

    def test_grave_accents_on_latin(self):
        # dòbèn: o + grave, e + grave → plain o and e
        assert strip_diacritics("dòbèn") == "doben"

    def test_french_circumflex(self):
        assert strip_diacritics("bâchée") == "bachee"

    def test_acute_accent(self):
        assert strip_diacritics("ábadàn") == "abadan"

    def test_no_diacritics_unchanged(self):
        assert strip_diacritics("hello") == "hello"

    def test_nko_base_preserved(self):
        # N'Ko characters are base characters, not combining marks
        nko = "ߘߊ"  # N'Ko DA + N'Ko A
        assert strip_diacritics(nko) == nko


class TestStripPunctuation:
    """Punctuation removal: delete P-category chars + whitespace normalize."""

    def test_apostrophe_removed(self):
        assert strip_punctuation("tɛ̀d'") == "tɛ̀d"

    def test_backtick_not_punctuation(self):
        # U+0060 GRAVE ACCENT has category Sk (Symbol), not P (Punctuation)
        # strip_punctuation only removes P-category chars per spec
        assert strip_punctuation("dín`") == "dín`"

    def test_comma_removed(self):
        assert strip_punctuation("a, b") == "a b"

    def test_no_punctuation_unchanged(self):
        assert strip_punctuation("hello world") == "hello world"


class TestPunctuationToSpace:
    """Punctuation to space: replace P-category with space + whitespace normalize."""

    def test_apostrophe_becomes_space(self):
        assert punctuation_to_space("l'arbre") == "l arbre"

    def test_comma_becomes_space(self):
        assert punctuation_to_space("a,b") == "a b"


class TestCasefoldLatin:
    """Case normalization: Unicode casefold."""

    def test_uppercase_to_lower(self):
        assert casefold_latin("Ísa") == "ísa"

    def test_already_lowercase(self):
        assert casefold_latin("dɔ́bɛ̀n") == "dɔ́bɛ̀n"

    def test_mixed_case(self):
        assert casefold_latin("Kabiné") == "kabiné"


# ===========================================================================
# Category 2: Composed search key functions
# ===========================================================================

class TestKeyCasefold:
    """casefold key: whitespace normalize → casefold."""

    def test_maninka_headword(self):
        assert key_casefold("dɔ́bɛ̀n") == "dɔ́bɛ̀n"  # Already lowercase

    def test_proper_noun(self):
        assert key_casefold("Ísa") == "ísa"

    def test_french_term(self):
        assert key_casefold("Bâchée") == "bâchée"


class TestKeyDiacriticsInsensitive:
    """diacritics_insensitive key: broadest Latin match."""

    def test_maninka_tone_marks(self):
        assert key_diacritics_insensitive("dɔ́bɛ̀n") == "dɔbɛn"

    def test_french_accents(self):
        assert key_diacritics_insensitive("bâchée") == "bachee"

    def test_proper_noun(self):
        assert key_diacritics_insensitive("Ísa") == "isa"

    def test_abadan(self):
        assert key_diacritics_insensitive("ábadàn") == "abadan"


class TestKeyPunctStripped:
    """punct_stripped key: casefold + diacritics + punctuation removed."""

    def test_apostrophe_in_headword(self):
        assert key_punct_stripped("tɛ̀d'") == "tɛd"

    def test_backtick_in_headword(self):
        # Backtick (U+0060) is Sk not P — preserved through punct_stripped
        assert key_punct_stripped("dín`") == "din`"

    def test_french_apostrophe(self):
        # strip_punctuation deletes P-category chars (doesn't replace with space)
        assert key_punct_stripped("l'arbre") == "larbre"


class TestKeyNospace:
    """nospace key: phone typing (casefold + diacritics + no spaces)."""

    def test_multiword_french(self):
        assert key_nospace("bâcler le travail") == "baclerletravail"

    def test_single_word(self):
        assert key_nospace("dɔ́bɛ̀n") == "dɔbɛn"

    def test_french_phrase_with_apostrophe(self):
        # key_nospace strips diacritics and spaces but NOT punctuation
        # apostrophe (U+0027 category Po) is preserved by nospace
        assert key_nospace("l'arbre") == "l'arbre"


# ===========================================================================
# Category 3: Multi-variant key computation
# ===========================================================================

class TestComputeSearchKeys:
    """compute_search_keys: all keys from variant forms, deduplicated."""

    def test_single_form(self):
        keys = compute_search_keys(["abandonner"])
        assert keys["casefold"] == ["abandonner"]
        assert keys["diacritics_insensitive"] == ["abandonner"]

    def test_multiple_variants_dedup(self):
        """dɔ́bɛ̀n + dɔbɛn + dòbèn → 2 distinct diacritics_insensitive keys."""
        keys = compute_search_keys(["dɔ́bɛ̀n", "dɔbɛn", "dòbèn"])
        assert len(keys["casefold"]) == 3  # All distinct after casefold
        assert len(keys["diacritics_insensitive"]) == 2  # dɔbɛn + doben
        assert "dɔbɛn" in keys["diacritics_insensitive"]
        assert "doben" in keys["diacritics_insensitive"]

    def test_empty_list(self):
        keys = compute_search_keys([])
        for key_name in KEY_FUNCTIONS:
            assert keys[key_name] == []

    def test_preserves_order(self):
        """First-seen order is preserved in deduplicated output."""
        keys = compute_search_keys(["dɔ́bɛ̀n", "dɔbɛn"])
        # dɔ́bɛ̀n → dɔbɛn, dɔbɛn → dɔbɛn (deduped)
        assert keys["diacritics_insensitive"] == ["dɔbɛn"]

    def test_all_key_types_present(self):
        keys = compute_search_keys(["test"])
        for key_name in KEY_FUNCTIONS:
            assert key_name in keys


# ===========================================================================
# Category 4: Lexicon entry normalization
# ===========================================================================

class TestNormalizeLexiconEntry:
    """Full normalization of lexicon_entry IR units."""

    def test_preferred_form_is_headword(self):
        ir_unit = {
            "ir_id": "test123",
            "ir_kind": "lexicon_entry",
            "source_id": "src_malipense",
            "record_locator": {
                "anchor_names": ["dɔ́bɛ̀n", "dɔbɛn", "dòbèn"],
            },
            "fields_raw": {
                "headword_latin": "dɔ́bɛ̀n",
            },
        }
        result = normalize_lexicon_entry(ir_unit)
        assert result.preferred_form == "dɔ́bɛ̀n"
        assert result.norm_version == "norm_v1"

    def test_variant_forms_include_preferred(self):
        ir_unit = {
            "ir_id": "test123",
            "ir_kind": "lexicon_entry",
            "source_id": "src_malipense",
            "record_locator": {
                "anchor_names": ["dɔ́bɛ̀n", "dɔbɛn", "dòbèn"],
            },
            "fields_raw": {
                "headword_latin": "dɔ́bɛ̀n",
            },
        }
        result = normalize_lexicon_entry(ir_unit)
        # preferred_form is in variant_forms
        assert any(
            unicodedata.normalize("NFC", v) == unicodedata.normalize("NFC", "dɔ́bɛ̀n")
            for v in result.variant_forms
        )

    def test_missing_anchor_names_falls_back(self):
        ir_unit = {
            "ir_id": "test123",
            "ir_kind": "lexicon_entry",
            "source_id": "src_malipense",
            "record_locator": {},
            "fields_raw": {
                "headword_latin": "fàa",
            },
        }
        result = normalize_lexicon_entry(ir_unit)
        assert result.variant_forms == ["fàa"]
        assert result.preferred_form == "fàa"

    def test_search_keys_computed_from_variants(self):
        ir_unit = {
            "ir_id": "test123",
            "ir_kind": "lexicon_entry",
            "source_id": "src_malipense",
            "record_locator": {
                "anchor_names": ["dá", "da"],
            },
            "fields_raw": {
                "headword_latin": "dá",
            },
        }
        result = normalize_lexicon_entry(ir_unit)
        # "dá" → casefold "dá", "da" → casefold "da"
        assert "dá" in result.search_keys["casefold"] or "da" in result.search_keys["casefold"]
        # diacritics insensitive: both → "da"
        assert result.search_keys["diacritics_insensitive"] == ["da"]


# ===========================================================================
# Category 5: Index mapping normalization
# ===========================================================================

class TestNormalizeIndexMapping:
    """Full normalization of index_mapping IR units."""

    def test_french_term_normalized(self):
        ir_unit = {
            "ir_id": "idx123",
            "ir_kind": "index_mapping",
            "source_id": "src_malipense",
            "fields_raw": {
                "source_term": "abandonner",
                "source_lang": "fr",
            },
        }
        result = normalize_index_mapping(ir_unit)
        assert result.preferred_form == "abandonner"
        assert result.variant_forms == ["abandonner"]
        assert result.search_keys["casefold"] == ["abandonner"]

    def test_french_accented_term(self):
        ir_unit = {
            "ir_id": "idx456",
            "ir_kind": "index_mapping",
            "source_id": "src_malipense",
            "fields_raw": {
                "source_term": "bâchée",
                "source_lang": "fr",
            },
        }
        result = normalize_index_mapping(ir_unit)
        assert result.search_keys["diacritics_insensitive"] == ["bachee"]

    def test_french_proper_noun(self):
        ir_unit = {
            "ir_id": "idx789",
            "ir_kind": "index_mapping",
            "source_id": "src_malipense",
            "fields_raw": {
                "source_term": "Kabiné",
                "source_lang": "fr",
            },
        }
        result = normalize_index_mapping(ir_unit)
        assert result.search_keys["casefold"] == ["kabiné"]
        assert result.search_keys["diacritics_insensitive"] == ["kabine"]


# ===========================================================================
# Category 6: Structural integrity (on real output)
# ===========================================================================

NORMALIZED_DATA_CANDIDATES = [
    Path("/home/potentplot/projects/perso_projects/nkokan/data/normalized/malipense_normalized_norm_v1.jsonl"),
    Path("data/normalized/malipense_normalized_norm_v1.jsonl"),
    Path("../../../data/normalized/malipense_normalized_norm_v1.jsonl"),
]


def _find_normalized_data() -> Path | None:
    for p in NORMALIZED_DATA_CANDIDATES:
        if p.exists():
            return p
    return None


@pytest.fixture(scope="module")
def normalized_records() -> list[dict]:
    """Load all normalized records."""
    path = _find_normalized_data()
    if path is None:
        pytest.skip("Normalized data file not found")
    records = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            records.append(json.loads(line))
    return records


class TestStructuralIntegrity:
    """Structural checks on the full normalized output."""

    def test_all_have_required_fields(self, normalized_records: list[dict]):
        required = {"ir_id", "ir_kind", "source_id", "norm_version",
                     "preferred_form", "variant_forms", "search_keys"}
        for i, rec in enumerate(normalized_records[:100]):
            missing = required - set(rec.keys())
            assert not missing, f"Record {i} missing fields: {missing}"

    def test_norm_version_is_norm_v1(self, normalized_records: list[dict]):
        for rec in normalized_records[:100]:
            assert rec["norm_version"] == "norm_v1"

    def test_search_keys_have_all_key_types(self, normalized_records: list[dict]):
        expected_keys = set(KEY_FUNCTIONS.keys())
        for rec in normalized_records[:100]:
            actual_keys = set(rec["search_keys"].keys())
            assert actual_keys == expected_keys, (
                f"Record {rec['ir_id']}: expected keys {expected_keys}, "
                f"got {actual_keys}"
            )

    def test_search_keys_are_lists(self, normalized_records: list[dict]):
        for rec in normalized_records[:100]:
            for key_name, values in rec["search_keys"].items():
                assert isinstance(values, list), (
                    f"Record {rec['ir_id']}: {key_name} should be list, "
                    f"got {type(values)}"
                )

    def test_preferred_form_in_variant_forms(self, normalized_records: list[dict]):
        """Preferred form must appear in variant_forms (NFC comparison)."""
        for rec in normalized_records[:100]:
            pref_nfc = unicodedata.normalize("NFC", rec["preferred_form"])
            variant_nfcs = [
                unicodedata.normalize("NFC", v) for v in rec["variant_forms"]
            ]
            assert pref_nfc in variant_nfcs, (
                f"Record {rec['ir_id']}: preferred_form not in variant_forms"
            )

    def test_ir_kind_valid(self, normalized_records: list[dict]):
        valid_kinds = {"lexicon_entry", "index_mapping"}
        for rec in normalized_records[:100]:
            assert rec["ir_kind"] in valid_kinds

    def test_no_empty_preferred_forms(self, normalized_records: list[dict]):
        for rec in normalized_records:
            assert rec["preferred_form"], (
                f"Record {rec['ir_id']} has empty preferred_form"
            )

    def test_no_empty_search_key_lists(self, normalized_records: list[dict]):
        """Every record should have at least one value per key type."""
        for rec in normalized_records[:200]:
            for key_name, values in rec["search_keys"].items():
                assert len(values) > 0, (
                    f"Record {rec['ir_id']}: {key_name} is empty"
                )

    def test_total_count(self, normalized_records: list[dict]):
        """Total normalized records should match IR input count."""
        lexicon = sum(1 for r in normalized_records if r["ir_kind"] == "lexicon_entry")
        index = sum(1 for r in normalized_records if r["ir_kind"] == "index_mapping")
        assert lexicon == 8823, f"Expected 8823 lexicon, got {lexicon}"
        assert index == 10501, f"Expected 10501 index, got {index}"


# ===========================================================================
# Category 7: Edge cases
# ===========================================================================

class TestEdgeCases:
    """Edge cases for normalization."""

    def test_apostrophe_headword(self):
        """tɛ̀d' — apostrophe in headword generates useful punct_stripped key."""
        ir_unit = {
            "ir_id": "edge1",
            "ir_kind": "lexicon_entry",
            "source_id": "src_malipense",
            "record_locator": {"anchor_names": ["tɛ̀d'", "tɛd'", "tèd'"]},
            "fields_raw": {"headword_latin": "tɛ̀d'"},
        }
        result = normalize_lexicon_entry(ir_unit)
        # punct_stripped should remove the apostrophe
        assert any("'" not in v for v in result.search_keys["punct_stripped"])

    def test_backtick_headword(self):
        """dín` — backtick (U+0060 Sk) is NOT punctuation, preserved in all keys."""
        ir_unit = {
            "ir_id": "edge2",
            "ir_kind": "lexicon_entry",
            "source_id": "src_malipense",
            "record_locator": {"anchor_names": ["dín`", "din`"]},
            "fields_raw": {"headword_latin": "dín`"},
        }
        result = normalize_lexicon_entry(ir_unit)
        # Backtick preserved even in punct_stripped (it's Sk, not P)
        assert all("`" in v for v in result.search_keys["punct_stripped"])

    def test_morpheme_prefix(self):
        """-da — morpheme with leading hyphen."""
        ir_unit = {
            "ir_id": "edge3",
            "ir_kind": "lexicon_entry",
            "source_id": "src_malipense",
            "record_locator": {"anchor_names": ["-da"]},
            "fields_raw": {"headword_latin": "-da"},
        }
        result = normalize_lexicon_entry(ir_unit)
        # casefold preserves the hyphen
        assert "-da" in result.search_keys["casefold"]
        # punct_stripped removes the hyphen
        assert "da" in result.search_keys["punct_stripped"]

    def test_normalize_ir_unit_dispatches_correctly(self):
        """normalize_ir_unit routes by ir_kind."""
        lexicon = {
            "ir_id": "l1", "ir_kind": "lexicon_entry", "source_id": "s",
            "record_locator": {}, "fields_raw": {"headword_latin": "test"},
        }
        index = {
            "ir_id": "i1", "ir_kind": "index_mapping", "source_id": "s",
            "fields_raw": {"source_term": "test", "source_lang": "fr"},
        }
        unknown = {
            "ir_id": "u1", "ir_kind": "metadata_page", "source_id": "s",
        }

        assert normalize_ir_unit(lexicon) is not None
        assert normalize_ir_unit(index) is not None
        assert normalize_ir_unit(unknown) is None

    def test_complex_french_phrase(self):
        """Multi-word French phrase with special characters."""
        ir_unit = {
            "ir_id": "edge4",
            "ir_kind": "index_mapping",
            "source_id": "src_malipense",
            "fields_raw": {
                "source_term": "b) il s'est affolé (de douleur, de peur, etc )",
                "source_lang": "fr",
            },
        }
        result = normalize_index_mapping(ir_unit)
        # casefold preserves punctuation but lowercases
        assert result.search_keys["casefold"][0] == "b) il s'est affolé (de douleur, de peur, etc )"
        # nospace removes spaces and diacritics
        nospace = result.search_keys["nospace"][0]
        assert " " not in nospace
        assert "affolé" not in nospace  # accent stripped


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
