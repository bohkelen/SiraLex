"""Unit tests for en_gloss_key_v1 extraction."""

from search_index.en_gloss_key_v1 import (
    EXTRACTION_RULE,
    extract_en_gloss_key_v1_surfaces,
    iter_en_gloss_key_v1_from_record,
)


class TestEnGlossKeyV1Surfaces:
    def test_house_unitary(self):
        assert extract_en_gloss_key_v1_surfaces("house") == ["house"]

    def test_right_hand_multiword_unitary(self):
        assert extract_en_gloss_key_v1_surfaces("right hand") == ["right hand"]

    def test_comma_alternatives(self):
        assert extract_en_gloss_key_v1_surfaces("hand, arm, foreleg, forefoot") == [
            "hand",
            "arm",
            "foreleg",
            "forefoot",
        ]

    def test_trailing_parenthetical_strip(self):
        assert extract_en_gloss_key_v1_surfaces("very (dark)") == ["very"]

    def test_leading_parenthetical_preserved(self):
        assert extract_en_gloss_key_v1_surfaces("(not) yet") == ["(not) yet"]

    def test_no_or_split(self):
        assert extract_en_gloss_key_v1_surfaces("green or yellowish scorpion") == [
            "green or yellowish scorpion"
        ]

    def test_no_slash_split(self):
        assert extract_en_gloss_key_v1_surfaces("sth / smb.") == ["sth / smb."]

    def test_no_whitespace_tokenization_come_back(self):
        assert extract_en_gloss_key_v1_surfaces("come back") == ["come back"]

    def test_empty_and_whitespace(self):
        assert extract_en_gloss_key_v1_surfaces("") == []
        assert extract_en_gloss_key_v1_surfaces("   ") == []


class TestEnGlossKeyV1RecordScope:
    def test_ignores_examples_and_subentries(self):
        record = {
            "ir_id": "abcd",
            "ir_kind": "lexicon_entry",
            "display": {
                "senses": [
                    {
                        "gloss_en": "house",
                        "examples": [{"trans_en": "I go to the house"}],
                        "sub_entries": [{"gloss_en": "to build a house"}],
                    }
                ]
            },
        }
        candidates = list(iter_en_gloss_key_v1_from_record(record))
        assert len(candidates) == 1
        assert candidates[0].key_surface == "house"
        assert candidates[0].extraction_rule == EXTRACTION_RULE
        assert candidates[0].split_kind == "unitary"

    def test_skips_index_mapping(self):
        record = {
            "ir_id": "map1",
            "ir_kind": "index_mapping",
            "display": {"senses": [{"gloss_en": "house"}]},
        }
        assert list(iter_en_gloss_key_v1_from_record(record)) == []
