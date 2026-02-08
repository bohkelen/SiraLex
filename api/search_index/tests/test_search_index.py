"""
Golden fixture tests for search index builder.

Tests cover:
1. Basic inverted index construction from normalized records
2. Deduplication and deterministic ordering of ir_ids
3. Multi-record key collision (multiple ir_ids for the same key)
4. Serialization sort order (by key_type, then key)
5. Round-trip determinism (same input → same output bytes)
6. Edge cases (empty keys, missing fields, empty input)
7. End-to-end file processing with known fixtures
"""

import json
import tempfile
from pathlib import Path

import pytest

from search_index.build_index import (
    build_inverted_index,
    process_normalized_file,
    serialize_index,
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
        assert ("casefold", "hello") in index
        assert index[("casefold", "hello")] == {"aaa"}

    def test_single_record_multiple_key_types(self):
        records = [FIXTURE_LEXICON_DOBEN]
        index = build_inverted_index(records)

        assert ("casefold", "dɔ́bɛ̀n") in index
        assert ("diacritics_insensitive", "dɔbɛn") in index
        assert ("diacritics_insensitive", "doben") in index
        assert FIXTURE_LEXICON_DOBEN["ir_id"] in index[("casefold", "dɔ́bɛ̀n")]

    def test_multiple_records_key_collision(self):
        """Two records sharing the same diacritics_insensitive key."""
        records = [FIXTURE_LEXICON_DOBEN, FIXTURE_LEXICON_DOBEN_ALT]
        index = build_inverted_index(records)

        doben_ids = index[("diacritics_insensitive", "doben")]
        assert FIXTURE_LEXICON_DOBEN["ir_id"] in doben_ids
        assert FIXTURE_LEXICON_DOBEN_ALT["ir_id"] in doben_ids
        assert len(doben_ids) == 2

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
        assert ("casefold", "") not in index
        assert ("casefold", "hello") in index

    def test_missing_ir_id_skipped(self):
        """Records without ir_id should be skipped."""
        records = [{"search_keys": {"casefold": ["hello"]}}]
        index = build_inverted_index(records)
        assert len(index) == 0


# ===========================================================================
# Category 2: Serialization and sort order
# ===========================================================================

class TestSerializeIndex:
    """Test serialization to sorted list of dicts."""

    def test_sorted_by_key_type_then_key(self):
        index = {
            ("nospace", "b"): {"id1"},
            ("casefold", "a"): {"id2"},
            ("casefold", "b"): {"id3"},
            ("diacritics_insensitive", "a"): {"id4"},
        }
        entries = serialize_index(index)

        key_type_key_pairs = [(e["key_type"], e["key"]) for e in entries]
        assert key_type_key_pairs == [
            ("casefold", "a"),
            ("casefold", "b"),
            ("diacritics_insensitive", "a"),
            ("nospace", "b"),
        ]

    def test_ir_ids_sorted(self):
        index = {("casefold", "x"): {"ccc", "aaa", "bbb"}}
        entries = serialize_index(index)
        assert entries[0]["ir_ids"] == ["aaa", "bbb", "ccc"]

    def test_empty_index(self):
        entries = serialize_index({})
        assert entries == []

    def test_entry_schema(self):
        index = {("casefold", "hello"): {"id1"}}
        entries = serialize_index(index)
        assert len(entries) == 1
        entry = entries[0]
        assert set(entry.keys()) == {"key", "key_type", "ir_ids"}
        assert entry["key"] == "hello"
        assert entry["key_type"] == "casefold"
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
                if e["key"] == "doben" and e["key_type"] == "diacritics_insensitive"
            ]
            assert len(doben_entries) == 1
            assert len(doben_entries[0]["ir_ids"]) == 2
            assert FIXTURE_LEXICON_DOBEN["ir_id"] in doben_entries[0]["ir_ids"]
            assert FIXTURE_LEXICON_DOBEN_ALT["ir_id"] in doben_entries[0]["ir_ids"]

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
            assert "casefold" in stats["unique_keys_by_type"]
            assert "diacritics_insensitive" in stats["unique_keys_by_type"]
            assert "punct_stripped" in stats["unique_keys_by_type"]
            assert "nospace" in stats["unique_keys_by_type"]

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
                    # ir_ids must be sorted
                    assert obj["ir_ids"] == sorted(obj["ir_ids"]), (
                        f"Line {line_num}: ir_ids not sorted"
                    )
