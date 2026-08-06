"""
Golden fixture tests for search index builder.

Tests cover:
1. Basic inverted index construction from normalized records
2. Deduplication and deterministic lexicographic ordering of ir_ids
3. Multi-record key collision (multiple ir_ids for the same key)
4. Serialization sort order (by key_type, then key)
5. Round-trip determinism (same input → same output bytes)
6. Edge cases (empty keys, missing fields, empty input)
7. End-to-end file processing with known fixtures
8. Featured-record rebuild preserves frozen 7L posting order
"""

import json
import tempfile
from pathlib import Path

import pytest

from search_index.build_index import (
    build_inverted_index,
    process_normalized_file,
    serialize_index,
    sort_posting_ir_ids,
)

REPO_ROOT = Path(__file__).resolve().parents[3]
FEATURED_BUNDLE = (
    REPO_ROOT / "web/public/bundle_full_20260616_phase7j_alias_round2_candidate"
)


# ===========================================================================
# Fixtures: normalized record factories
# ===========================================================================

def make_normalized_record(
    ir_id: str,
    ir_kind: str = "lexicon_entry",
    source_id: str = "src_test",
    norm_version: str = "norm_v1",
    preferred_form: str = "test",
    variant_forms: list[str] | None = None,
    search_keys: dict[str, list[str]] | None = None,
) -> dict:
    """Factory for normalized record dicts."""
    return {
        "ir_id": ir_id,
        "ir_kind": ir_kind,
        "source_id": source_id,
        "norm_version": norm_version,
        "preferred_form": preferred_form,
        "variant_forms": variant_forms or [preferred_form],
        "search_keys": search_keys or {},
    }


# Realistic fixture: a Maninka lexicon entry with diacritics
FIXTURE_LEXICON_DOBEN = make_normalized_record(
    ir_id="aaaa1111bbbb2222",
    ir_kind="lexicon_entry",
    preferred_form="dɔ́bɛ̀n",
    variant_forms=["dɔ́bɛ̀n", "dɔbɛn", "dòbèn"],
    search_keys={
        "casefold": ["dɔ́bɛ̀n"],
        "diacritics_insensitive": ["dɔbɛn", "doben"],
        "punct_stripped": ["dɔbɛn", "doben"],
        "nospace": ["dɔbɛn", "doben"],
    },
)

# Another entry that shares "doben" in diacritics_insensitive
FIXTURE_LEXICON_DOBEN_ALT = make_normalized_record(
    ir_id="cccc3333dddd4444",
    ir_kind="lexicon_entry",
    preferred_form="dòbèn",
    variant_forms=["dòbèn"],
    search_keys={
        "casefold": ["dòbèn"],
        "diacritics_insensitive": ["doben"],
        "punct_stripped": ["doben"],
        "nospace": ["doben"],
    },
)

# French index mapping
FIXTURE_INDEX_ABANDONNER = make_normalized_record(
    ir_id="eeee5555ffff6666",
    ir_kind="index_mapping",
    preferred_form="abandonner",
    variant_forms=["abandonner"],
    search_keys={
        "casefold": ["abandonner"],
        "diacritics_insensitive": ["abandonner"],
        "punct_stripped": ["abandonner"],
        "nospace": ["abandonner"],
    },
)

FIXTURE_INDEX_GLOSS_V2 = make_normalized_record(
    ir_id="ffff7777aaaa8888",
    ir_kind="index_mapping",
    norm_version="norm_v2",
    preferred_form="a) bon travail! (une salutation), b) merci! (pour un travail)",
    variant_forms=[
        "a) bon travail! (une salutation), b) merci! (pour un travail)",
        "bon travail",
        "merci",
        "bon réveil",
    ],
    search_keys={
        "casefold": ["bon travail", "merci", "bon réveil"],
        "diacritics_insensitive": ["bon travail", "merci", "bon reveil"],
        "punct_stripped": ["bon travail", "merci", "bon reveil"],
        "nospace": ["bontravail", "merci", "bonreveil"],
    },
)

FIXTURE_LEXICON_NKO_V2 = make_normalized_record(
    ir_id="1111eeee2222ffff",
    ir_kind="lexicon_entry",
    norm_version="norm_v2",
    preferred_form="dàa",
    variant_forms=["dàa", "ߘߊ߰"],
    search_keys={
        "casefold": ["dàa", "ߘߊ߰"],
        "diacritics_insensitive": ["daa", "ߘߊ"],
        "punct_stripped": ["daa", "ߘߊ"],
        "nospace": ["daa", "ߘߊ"],
    },
)


# ===========================================================================
# Category 1: Basic inverted index construction
# ===========================================================================

class TestBuildInvertedIndex:
    """Test in-memory inverted index construction."""

    def test_single_record_single_key(self):
        records = [make_normalized_record(
            ir_id="aaa",
            search_keys={"casefold": ["hello"]},
        )]
        index = build_inverted_index(records)
        assert ("tgt_casefold", "hello") in index
        assert index[("tgt_casefold", "hello")] == ["aaa"]

    def test_single_record_multiple_key_types(self):
        records = [FIXTURE_LEXICON_DOBEN]
        index = build_inverted_index(records)

        assert ("tgt_casefold", "dɔ́bɛ̀n") in index
        assert ("tgt_diacritics_insensitive", "dɔbɛn") in index
        assert ("tgt_diacritics_insensitive", "doben") in index
        assert FIXTURE_LEXICON_DOBEN["ir_id"] in index[("tgt_casefold", "dɔ́bɛ̀n")]

    def test_multiple_records_key_collision(self):
        """Two records sharing the same diacritics_insensitive key."""
        records = [FIXTURE_LEXICON_DOBEN, FIXTURE_LEXICON_DOBEN_ALT]
        index = build_inverted_index(records)

        doben_ids = index[("tgt_diacritics_insensitive", "doben")]
        assert FIXTURE_LEXICON_DOBEN["ir_id"] in doben_ids
        assert FIXTURE_LEXICON_DOBEN_ALT["ir_id"] in doben_ids
        assert len(doben_ids) == 2
        # Lexicographic posting order, independent of record-stream order.
        assert doben_ids == sorted(doben_ids)

    def test_multi_hit_source_keys_are_lexicographically_ordered(self):
        """Source multi-hit postings sort by ir_id, not first-seen order."""
        records = [
            make_normalized_record(
                ir_id="d540716db9321a83",
                ir_kind="index_mapping",
                search_keys={"casefold": ["mère"]},
            ),
            make_normalized_record(
                ir_id="e5164efcdf5e6ca4",
                ir_kind="index_mapping",
                search_keys={"casefold": ["mère"]},
            ),
            make_normalized_record(
                ir_id="0f517a71c373f51d",
                ir_kind="index_mapping",
                search_keys={"casefold": ["mère"]},
            ),
        ]
        index = build_inverted_index(records)
        assert index[("src_casefold", "mère")] == [
            "0f517a71c373f51d",
            "d540716db9321a83",
            "e5164efcdf5e6ca4",
        ]

    def test_multi_hit_target_keys_are_lexicographically_ordered(self):
        """Target multi-hit postings sort by ir_id, not first-seen order."""
        records = [
            make_normalized_record(
                ir_id="e28e149f57ab616b",
                ir_kind="lexicon_entry",
                search_keys={"casefold": ["kùn"]},
            ),
            make_normalized_record(
                ir_id="753fa18e0a6df4ab",
                ir_kind="lexicon_entry",
                search_keys={"casefold": ["kùn"]},
            ),
        ]
        index = build_inverted_index(records)
        assert index[("tgt_casefold", "kùn")] == [
            "753fa18e0a6df4ab",
            "e28e149f57ab616b",
        ]

    def test_posting_order_independent_of_record_stream_order(self):
        forward = build_inverted_index(
            [
                make_normalized_record(
                    ir_id="bbb",
                    ir_kind="index_mapping",
                    search_keys={"casefold": ["x"]},
                ),
                make_normalized_record(
                    ir_id="aaa",
                    ir_kind="index_mapping",
                    search_keys={"casefold": ["x"]},
                ),
            ]
        )
        reverse = build_inverted_index(
            [
                make_normalized_record(
                    ir_id="aaa",
                    ir_kind="index_mapping",
                    search_keys={"casefold": ["x"]},
                ),
                make_normalized_record(
                    ir_id="bbb",
                    ir_kind="index_mapping",
                    search_keys={"casefold": ["x"]},
                ),
            ]
        )
        assert forward[("src_casefold", "x")] == ["aaa", "bbb"]
        assert reverse[("src_casefold", "x")] == ["aaa", "bbb"]

    def test_bilingual_bundle_emits_source_and_target_key_families(self):
        records = [FIXTURE_LEXICON_DOBEN, FIXTURE_INDEX_ABANDONNER]
        index = build_inverted_index(records)

        assert ("tgt_casefold", "dɔ́bɛ̀n") in index
        assert ("src_casefold", "abandonner") in index
        assert index[("src_casefold", "abandonner")] == ["eeee5555ffff6666"]
        assert index[("tgt_casefold", "dɔ́bɛ̀n")] == ["aaaa1111bbbb2222"]

    def test_v2_gloss_phrases_emit_directional_source_keys(self):
        index = build_inverted_index([FIXTURE_INDEX_GLOSS_V2])

        assert index[("src_casefold", "bon travail")] == ["ffff7777aaaa8888"]
        assert index[("src_casefold", "merci")] == ["ffff7777aaaa8888"]
        assert index[("src_casefold", "bon réveil")] == ["ffff7777aaaa8888"]

    def test_v2_nko_variant_emits_directional_target_keys(self):
        index = build_inverted_index([FIXTURE_LEXICON_NKO_V2])

        assert index[("tgt_casefold", "ߘߊ߰")] == ["1111eeee2222ffff"]

    def test_mono_direction_bundle_only_emits_present_direction(self):
        index = build_inverted_index([FIXTURE_INDEX_ABANDONNER])

        assert ("src_casefold", "abandonner") in index
        assert all(not key_type.startswith("tgt_") for key_type, _ in index.keys())

    def test_empty_records_list(self):
        index = build_inverted_index([])
        assert len(index) == 0

    def test_record_with_empty_search_keys(self):
        records = [make_normalized_record(ir_id="aaa", search_keys={})]
        index = build_inverted_index(records)
        assert len(index) == 0

    def test_empty_key_values_skipped(self):
        """Empty string keys should not appear in the index."""
        records = [make_normalized_record(
            ir_id="aaa",
            search_keys={"casefold": ["", "hello"]},
        )]
        index = build_inverted_index(records)
        assert ("tgt_casefold", "") not in index
        assert ("tgt_casefold", "hello") in index

    def test_missing_ir_id_skipped(self):
        """Records without ir_id should be skipped."""
        records = [{"search_keys": {"casefold": ["hello"]}}]
        index = build_inverted_index(records)
        assert len(index) == 0

    def test_unsupported_ir_kind_is_skipped(self):
        records = [make_normalized_record(
            ir_id="aaa",
            ir_kind="unsupported_kind",
            search_keys={"casefold": ["hello"]},
        )]
        index = build_inverted_index(records)
        assert index == {}


# ===========================================================================
# Category 2: Serialization and sort order
# ===========================================================================

class TestSerializeIndex:
    """Test serialization to sorted list of dicts."""

    def test_sorted_by_key_type_then_key(self):
        index = {
            ("tgt_nospace", "b"): ["id1"],
            ("src_casefold", "a"): ["id2"],
            ("tgt_casefold", "b"): ["id3"],
            ("src_diacritics_insensitive", "a"): ["id4"],
        }
        entries = serialize_index(index)

        key_type_key_pairs = [(e["key_type"], e["key"]) for e in entries]
        assert key_type_key_pairs == [
            ("src_casefold", "a"),
            ("src_diacritics_insensitive", "a"),
            ("tgt_casefold", "b"),
            ("tgt_nospace", "b"),
        ]

    def test_ir_ids_are_lexicographically_sorted(self):
        index = {("tgt_casefold", "x"): ["ccc", "aaa", "bbb"]}
        entries = serialize_index(index)
        assert entries[0]["ir_ids"] == ["aaa", "bbb", "ccc"]
        assert sort_posting_ir_ids(["ccc", "aaa", "bbb"]) == ["aaa", "bbb", "ccc"]

    def test_empty_index(self):
        entries = serialize_index({})
        assert entries == []

    def test_entry_schema(self):
        index = {("src_casefold", "hello"): ["id1"]}
        entries = serialize_index(index)
        assert len(entries) == 1
        entry = entries[0]
        assert set(entry.keys()) == {"key", "key_type", "ir_ids"}
        assert entry["key"] == "hello"
        assert entry["key_type"] == "src_casefold"
        assert entry["ir_ids"] == ["id1"]


# ===========================================================================
# Category 3: End-to-end file processing
# ===========================================================================

class TestProcessNormalizedFile:
    """Test the full pipeline: JSONL in → JSONL out."""

    def _write_jsonl(self, path: Path, records: list[dict]):
        with open(path, "w", encoding="utf-8") as f:
            for rec in records:
                f.write(json.dumps(rec, ensure_ascii=False) + "\n")

    def _read_jsonl(self, path: Path) -> list[dict]:
        entries = []
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    entries.append(json.loads(line))
        return entries

    def test_basic_end_to_end(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            input_path = Path(tmpdir) / "normalized.jsonl"
            output_path = Path(tmpdir) / "index.jsonl"

            self._write_jsonl(input_path, [
                FIXTURE_LEXICON_DOBEN,
                FIXTURE_INDEX_ABANDONNER,
            ])

            stats = process_normalized_file(input_path, output_path)

            assert stats["records_read"] == 2
            assert stats["parse_errors"] == 0
            assert stats["total_index_entries"] > 0

            entries = self._read_jsonl(output_path)
            assert len(entries) == stats["total_index_entries"]

            # Every entry must have the correct schema
            for entry in entries:
                assert "key" in entry
                assert "key_type" in entry
                assert "ir_ids" in entry
                assert isinstance(entry["ir_ids"], list)

    def test_key_collision_across_records(self):
        """Two records with overlapping diacritics_insensitive keys."""
        with tempfile.TemporaryDirectory() as tmpdir:
            input_path = Path(tmpdir) / "normalized.jsonl"
            output_path = Path(tmpdir) / "index.jsonl"

            self._write_jsonl(input_path, [
                FIXTURE_LEXICON_DOBEN,
                FIXTURE_LEXICON_DOBEN_ALT,
            ])

            process_normalized_file(input_path, output_path)
            entries = self._read_jsonl(output_path)

            # Find the "doben" diacritics_insensitive entry
            doben_entries = [
                e for e in entries
                if e["key"] == "doben" and e["key_type"] == "tgt_diacritics_insensitive"
            ]
            assert len(doben_entries) == 1
            assert len(doben_entries[0]["ir_ids"]) == 2
            assert FIXTURE_LEXICON_DOBEN["ir_id"] in doben_entries[0]["ir_ids"]
            assert FIXTURE_LEXICON_DOBEN_ALT["ir_id"] in doben_entries[0]["ir_ids"]

    def test_asymmetric_bundle_keeps_source_and_target_keys_isolated(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            input_path = Path(tmpdir) / "normalized.jsonl"
            output_path = Path(tmpdir) / "index.jsonl"

            self._write_jsonl(input_path, [
                FIXTURE_LEXICON_DOBEN_ALT,
                FIXTURE_INDEX_ABANDONNER,
            ])

            process_normalized_file(input_path, output_path)
            entries = self._read_jsonl(output_path)

            assert any(
                e["key_type"] == "src_casefold" and e["key"] == "abandonner"
                for e in entries
            )
            assert any(
                e["key_type"] == "tgt_casefold" and e["key"] == "dòbèn"
                for e in entries
            )
            assert not any(
                e["key_type"] == "src_casefold" and e["key"] == "dòbèn"
                for e in entries
            )

    def test_determinism(self):
        """Running twice on the same input produces identical output bytes."""
        with tempfile.TemporaryDirectory() as tmpdir:
            input_path = Path(tmpdir) / "normalized.jsonl"
            output_a = Path(tmpdir) / "index_a.jsonl"
            output_b = Path(tmpdir) / "index_b.jsonl"

            self._write_jsonl(input_path, [
                FIXTURE_LEXICON_DOBEN,
                FIXTURE_LEXICON_DOBEN_ALT,
                FIXTURE_INDEX_ABANDONNER,
            ])

            process_normalized_file(input_path, output_a)
            process_normalized_file(input_path, output_b)

            assert output_a.read_bytes() == output_b.read_bytes()

    def test_empty_input(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            input_path = Path(tmpdir) / "normalized.jsonl"
            output_path = Path(tmpdir) / "index.jsonl"

            self._write_jsonl(input_path, [])

            stats = process_normalized_file(input_path, output_path)
            assert stats["records_read"] == 0
            assert stats["total_index_entries"] == 0
            assert output_path.exists()

    def test_missing_input_file(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            input_path = Path(tmpdir) / "does_not_exist.jsonl"
            output_path = Path(tmpdir) / "index.jsonl"

            stats = process_normalized_file(input_path, output_path)
            assert stats["records_read"] == 0

    def test_malformed_json_lines_counted(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            input_path = Path(tmpdir) / "normalized.jsonl"
            output_path = Path(tmpdir) / "index.jsonl"

            with open(input_path, "w") as f:
                f.write(json.dumps(FIXTURE_LEXICON_DOBEN, ensure_ascii=False) + "\n")
                f.write("NOT VALID JSON\n")
                f.write(json.dumps(FIXTURE_INDEX_ABANDONNER, ensure_ascii=False) + "\n")

            stats = process_normalized_file(input_path, output_path)
            assert stats["records_read"] == 2
            assert stats["parse_errors"] == 1

    def test_stats_unique_keys_by_type(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            input_path = Path(tmpdir) / "normalized.jsonl"
            output_path = Path(tmpdir) / "index.jsonl"

            self._write_jsonl(input_path, [FIXTURE_LEXICON_DOBEN])

            stats = process_normalized_file(input_path, output_path)

            # FIXTURE_LEXICON_DOBEN has keys in all 4 types
            assert "tgt_casefold" in stats["unique_keys_by_type"]
            assert "tgt_diacritics_insensitive" in stats["unique_keys_by_type"]
            assert "tgt_punct_stripped" in stats["unique_keys_by_type"]
            assert "tgt_nospace" in stats["unique_keys_by_type"]

    def test_output_lines_are_valid_json(self):
        """Every output line must be valid JSON with the right schema."""
        with tempfile.TemporaryDirectory() as tmpdir:
            input_path = Path(tmpdir) / "normalized.jsonl"
            output_path = Path(tmpdir) / "index.jsonl"

            self._write_jsonl(input_path, [
                FIXTURE_LEXICON_DOBEN,
                FIXTURE_LEXICON_DOBEN_ALT,
                FIXTURE_INDEX_ABANDONNER,
            ])

            process_normalized_file(input_path, output_path)

            with open(output_path, "r", encoding="utf-8") as f:
                for line_num, line in enumerate(f, 1):
                    obj = json.loads(line.strip())
                    assert isinstance(obj["key"], str), f"Line {line_num}: key not str"
                    assert isinstance(obj["key_type"], str), f"Line {line_num}: key_type not str"
                    assert isinstance(obj["ir_ids"], list), f"Line {line_num}: ir_ids not list"
                    assert len(obj["ir_ids"]) > 0, f"Line {line_num}: ir_ids empty"
                    # ir_ids are unique and lexicographically ordered.
                    assert len(obj["ir_ids"]) == len(set(obj["ir_ids"])), (
                        f"Line {line_num}: duplicate ir_ids"
                    )
                    assert obj["ir_ids"] == sorted(obj["ir_ids"]), (
                        f"Line {line_num}: ir_ids not lexicographically sorted"
                    )


    def test_english_gloss_emits_en_keys_and_preserves_tgt(self):
        record = {
            "ir_id": "211060723bc2edc5",
            "ir_kind": "lexicon_entry",
            "norm_version": "norm_v3",
            "search_keys": {
                "casefold": ["bón"],
                "diacritics_insensitive": ["bon"],
                "punct_stripped": ["bon"],
                "nospace": ["bon"],
            },
            "display": {
                "senses": [
                    {
                        "gloss_en": "house",
                        "examples": [{"trans_en": "The house is big"}],
                        "sub_entries": [{"gloss_en": "to build a house"}],
                    }
                ]
            },
        }
        index = build_inverted_index([record])
        assert index[("tgt_casefold", "bón")] == ["211060723bc2edc5"]
        assert index[("en_casefold", "house")] == ["211060723bc2edc5"]
        # example / subentry English must not become keys
        assert ("en_casefold", "the house is big") not in index
        assert ("en_casefold", "to build a house") not in index
        assert ("en_casefold", "build") not in index

    def test_english_comma_alternatives_and_ordering(self):
        records = [
            {
                "ir_id": "bbbb",
                "ir_kind": "lexicon_entry",
                "norm_version": "norm_v3",
                "search_keys": {"casefold": ["x"]},
                "display": {"senses": [{"gloss_en": "hand, arm"}]},
            },
            {
                "ir_id": "aaaa",
                "ir_kind": "lexicon_entry",
                "norm_version": "norm_v3",
                "search_keys": {"casefold": ["y"]},
                "display": {"senses": [{"gloss_en": "hand"}]},
            },
        ]
        index = build_inverted_index(records)
        assert index[("en_casefold", "hand")] == ["aaaa", "bbbb"]
        assert index[("en_casefold", "arm")] == ["bbbb"]
        assert ("en_casefold", "hand, arm") not in index

    def test_english_disabled_emits_no_en_keys(self):
        record = {
            "ir_id": "211060723bc2edc5",
            "ir_kind": "lexicon_entry",
            "norm_version": "norm_v3",
            "search_keys": {"casefold": ["bón"]},
            "display": {"senses": [{"gloss_en": "house"}]},
        }
        index = build_inverted_index([record], emit_english_keys=False)
        assert ("en_casefold", "house") not in index
        assert index[("tgt_casefold", "bón")] == ["211060723bc2edc5"]


    def test_base_index_merge_preserves_src_tgt_and_adds_en(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            records_path = Path(tmpdir) / "records.jsonl"
            base_index_path = Path(tmpdir) / "base_index.jsonl"
            out_path = Path(tmpdir) / "out_index.jsonl"
            self._write_jsonl(
                records_path,
                [
                    {
                        "ir_id": "211060723bc2edc5",
                        "ir_kind": "lexicon_entry",
                        "norm_version": "norm_v3",
                        "search_keys": {"casefold": ["bón"]},
                        "display": {"senses": [{"gloss_en": "house"}]},
                    }
                ],
            )
            self._write_jsonl(
                base_index_path,
                [
                    {
                        "key": "maison",
                        "key_type": "src_casefold",
                        "ir_ids": ["map1"],
                    },
                    {
                        "key": "bón",
                        "key_type": "tgt_casefold",
                        "ir_ids": ["211060723bc2edc5"],
                    },
                ],
            )
            stats = process_normalized_file(
                records_path,
                out_path,
                emit_english_keys=True,
                base_search_index_path=base_index_path,
            )
            entries = self._read_jsonl(out_path)
            by = {(e["key_type"], e["key"]): e["ir_ids"] for e in entries}
            assert by[("src_casefold", "maison")] == ["map1"]
            assert by[("tgt_casefold", "bón")] == ["211060723bc2edc5"]
            assert by[("en_casefold", "house")] == ["211060723bc2edc5"]
            assert stats["total_index_entries"] == 6  # 2 base + 4 en ladder rungs
            assert all(
                not kt.startswith("src_") or (kt, key) in {("src_casefold", "maison")}
                for kt, key in by
            )

class TestFeaturedRecordRebuildOrdering:
    """Rebuild from featured records must match frozen 7L posting contracts."""

    @pytest.fixture(scope="class")
    def rebuilt_from_featured(self):
        if not FEATURED_BUNDLE.is_dir():
            pytest.skip(f"featured bundle missing: {FEATURED_BUNDLE}")
        records_path = FEATURED_BUNDLE / "records.jsonl"
        records = []
        with records_path.open(encoding="utf-8") as handle:
            for line in handle:
                text = line.strip()
                if text:
                    records.append(json.loads(text))
        return build_inverted_index(records)

    def test_mere_posting_order_matches_frozen_7l(self, rebuilt_from_featured):
        assert rebuilt_from_featured[("src_casefold", "mère")] == [
            "0f517a71c373f51d",
            "d540716db9321a83",
            "e5164efcdf5e6ca4",
        ]

    def test_kun_tgt_casefold_posting_order_matches_frozen_7l(self, rebuilt_from_featured):
        assert rebuilt_from_featured[("tgt_casefold", "kùn")] == [
            "753fa18e0a6df4ab",
            "e28e149f57ab616b",
        ]

    def test_featured_multi_posting_keys_are_lexicographic(self, rebuilt_from_featured):
        """Sanity: rebuilt multi-hit postings are lexicographic (featured rule)."""
        multi = {
            key: ids
            for key, ids in rebuilt_from_featured.items()
            if len(ids) > 1
        }
        assert multi
        for key, ids in multi.items():
            assert ids == sorted(ids), f"{key} not lexicographic: {ids}"
