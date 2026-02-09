"""
Tests for the record enrichment module.

Tests cover:
1. IR lookup construction from JSONL files
2. Single-record enrichment (lexicon_entry and index_mapping)
3. Missing IR records (graceful degradation)
4. End-to-end file processing with known fixtures
5. Determinism (same input → same output bytes)
6. Edge cases (empty input, malformed JSON, duplicate ir_ids)
7. Display field correctness (verbatim copy of fields_raw)
"""

import json
import tempfile
from pathlib import Path

import pytest

from enrichment.enrich import (
    build_ir_lookup,
    enrich_record,
    enrich_records,
)


# ===========================================================================
# Fixtures: IR record factories
# ===========================================================================

def make_ir_unit(
    ir_id: str,
    ir_kind: str = "lexicon_entry",
    source_id: str = "src_test",
    parser_version: str = "test_parser_v1",
    fields_raw: dict | None = None,
) -> dict:
    """Factory for IR unit dicts."""
    return {
        "ir_id": ir_id,
        "ir_kind": ir_kind,
        "source_id": source_id,
        "parser_version": parser_version,
        "evidence": [],
        "record_locator": {
            "kind": "source_record_id",
            "url_canonical": "https://example.com/test",
            "source_record_id": ir_id,
        },
        "fields_raw": fields_raw or {},
    }


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


# --- Realistic fixtures ---

LEXICON_FIELDS_RAW = {
    "headword_latin": "dɔ́bɛ̀n",
    "headword_nko_provided": "ߘɔ߁ߓɛ߀ߒ",
    "ps_raw": "v",
    "pos_hint": "verb",
    "senses": [
        {
            "gloss_fr": "commencer",
            "gloss_en": "to begin",
            "gloss_ru": "начинать",
            "examples": [
                {
                    "text_latin": "À dɔ́bɛ̀n bàara lá",
                    "trans_fr": "Il a commencé le travail",
                }
            ],
            "usage_note": None,
            "synonyms_raw": [],
        }
    ],
    "variants_raw": ["dɔbɛn", "dòbèn"],
    "synonyms_raw": [],
    "etymology_raw": None,
    "literal_meaning_raw": None,
}

INDEX_FIELDS_RAW = {
    "source_term": "abandonner",
    "source_lang": "fr",
    "target_entries": [
        {
            "lexicon_url": "/emk/lexicon/b.htm",
            "anchor": "e504",
            "display_text": "bàn",
        }
    ],
}

FIXTURE_IR_LEXICON = make_ir_unit(
    ir_id="aaaa1111bbbb2222",
    ir_kind="lexicon_entry",
    fields_raw=LEXICON_FIELDS_RAW,
)

FIXTURE_IR_INDEX = make_ir_unit(
    ir_id="eeee5555ffff6666",
    ir_kind="index_mapping",
    fields_raw=INDEX_FIELDS_RAW,
)

FIXTURE_NORMALIZED_LEXICON = make_normalized_record(
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

FIXTURE_NORMALIZED_INDEX = make_normalized_record(
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
# Helpers
# ===========================================================================

def _write_jsonl(path: Path, records: list[dict]):
    with open(path, "w", encoding="utf-8") as f:
        for rec in records:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")


def _read_jsonl(path: Path) -> list[dict]:
    entries = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                entries.append(json.loads(line))
    return entries


# ===========================================================================
# Category 1: IR lookup construction
# ===========================================================================

class TestBuildIrLookup:
    """Test building ir_id → fields_raw lookup from IR JSONL files."""

    def test_single_file_single_record(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            ir_path = Path(tmpdir) / "ir.jsonl"
            _write_jsonl(ir_path, [FIXTURE_IR_LEXICON])

            lookup = build_ir_lookup([ir_path])
            assert len(lookup) == 1
            assert "aaaa1111bbbb2222" in lookup
            assert lookup["aaaa1111bbbb2222"] == LEXICON_FIELDS_RAW

    def test_multiple_files(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            lex_path = Path(tmpdir) / "lexicon.jsonl"
            idx_path = Path(tmpdir) / "index.jsonl"
            _write_jsonl(lex_path, [FIXTURE_IR_LEXICON])
            _write_jsonl(idx_path, [FIXTURE_IR_INDEX])

            lookup = build_ir_lookup([lex_path, idx_path])
            assert len(lookup) == 2
            assert "aaaa1111bbbb2222" in lookup
            assert "eeee5555ffff6666" in lookup

    def test_missing_file_skipped(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            real_path = Path(tmpdir) / "real.jsonl"
            fake_path = Path(tmpdir) / "nonexistent.jsonl"
            _write_jsonl(real_path, [FIXTURE_IR_LEXICON])

            lookup = build_ir_lookup([real_path, fake_path])
            assert len(lookup) == 1

    def test_empty_file(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            ir_path = Path(tmpdir) / "empty.jsonl"
            _write_jsonl(ir_path, [])

            lookup = build_ir_lookup([ir_path])
            assert len(lookup) == 0

    def test_duplicate_ir_id_keeps_first(self):
        """If two IR records have the same ir_id, keep the first one."""
        duplicate = make_ir_unit(
            ir_id="aaaa1111bbbb2222",
            fields_raw={"headword_latin": "DUPLICATE"},
        )
        with tempfile.TemporaryDirectory() as tmpdir:
            ir_path = Path(tmpdir) / "ir.jsonl"
            _write_jsonl(ir_path, [FIXTURE_IR_LEXICON, duplicate])

            lookup = build_ir_lookup([ir_path])
            assert len(lookup) == 1
            # Should keep the first one (LEXICON_FIELDS_RAW), not the duplicate
            assert lookup["aaaa1111bbbb2222"] == LEXICON_FIELDS_RAW

    def test_missing_ir_id_skipped(self):
        bad_record = {"fields_raw": {"headword_latin": "test"}}
        with tempfile.TemporaryDirectory() as tmpdir:
            ir_path = Path(tmpdir) / "ir.jsonl"
            _write_jsonl(ir_path, [bad_record])

            lookup = build_ir_lookup([ir_path])
            assert len(lookup) == 0

    def test_missing_fields_raw_skipped(self):
        bad_record = {"ir_id": "aaa", "ir_kind": "lexicon_entry"}
        with tempfile.TemporaryDirectory() as tmpdir:
            ir_path = Path(tmpdir) / "ir.jsonl"
            _write_jsonl(ir_path, [bad_record])

            lookup = build_ir_lookup([ir_path])
            assert len(lookup) == 0

    def test_malformed_json_skipped(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            ir_path = Path(tmpdir) / "ir.jsonl"
            with open(ir_path, "w") as f:
                f.write(json.dumps(FIXTURE_IR_LEXICON, ensure_ascii=False) + "\n")
                f.write("NOT VALID JSON\n")
                f.write(json.dumps(FIXTURE_IR_INDEX, ensure_ascii=False) + "\n")

            lookup = build_ir_lookup([ir_path])
            assert len(lookup) == 2  # Both valid records loaded


# ===========================================================================
# Category 2: Single-record enrichment
# ===========================================================================

class TestEnrichRecord:
    """Test enriching individual normalized records."""

    def test_lexicon_entry_enriched(self):
        lookup = {"aaaa1111bbbb2222": LEXICON_FIELDS_RAW}
        enriched = enrich_record(FIXTURE_NORMALIZED_LEXICON, lookup)

        assert "display" in enriched
        assert enriched["display"] == LEXICON_FIELDS_RAW

    def test_index_mapping_enriched(self):
        lookup = {"eeee5555ffff6666": INDEX_FIELDS_RAW}
        enriched = enrich_record(FIXTURE_NORMALIZED_INDEX, lookup)

        assert "display" in enriched
        assert enriched["display"] == INDEX_FIELDS_RAW

    def test_missing_ir_record_no_display(self):
        lookup = {}  # Empty lookup
        enriched = enrich_record(FIXTURE_NORMALIZED_LEXICON, lookup)

        assert "display" not in enriched

    def test_normalized_fields_preserved(self):
        """Enrichment must not alter the original normalized fields."""
        lookup = {"aaaa1111bbbb2222": LEXICON_FIELDS_RAW}
        enriched = enrich_record(FIXTURE_NORMALIZED_LEXICON, lookup)

        assert enriched["ir_id"] == FIXTURE_NORMALIZED_LEXICON["ir_id"]
        assert enriched["ir_kind"] == FIXTURE_NORMALIZED_LEXICON["ir_kind"]
        assert enriched["source_id"] == FIXTURE_NORMALIZED_LEXICON["source_id"]
        assert enriched["norm_version"] == FIXTURE_NORMALIZED_LEXICON["norm_version"]
        assert enriched["preferred_form"] == FIXTURE_NORMALIZED_LEXICON["preferred_form"]
        assert enriched["variant_forms"] == FIXTURE_NORMALIZED_LEXICON["variant_forms"]
        assert enriched["search_keys"] == FIXTURE_NORMALIZED_LEXICON["search_keys"]

    def test_display_is_verbatim_copy(self):
        """display field must be a verbatim copy of fields_raw, not a transformation."""
        fields_raw = {
            "headword_latin": "tɛ̀st",
            "headword_nko_provided": "ߕɛ߀ߛߕ",
            "senses": [{"gloss_fr": "test", "gloss_en": "test"}],
        }
        lookup = {"id1": fields_raw}
        normalized = make_normalized_record(ir_id="id1")
        enriched = enrich_record(normalized, lookup)

        # Must be equal — not filtered, not transformed
        assert enriched["display"] == fields_raw

    def test_does_not_mutate_input(self):
        """Enrichment must not mutate the input normalized record."""
        lookup = {"aaaa1111bbbb2222": LEXICON_FIELDS_RAW}
        original = dict(FIXTURE_NORMALIZED_LEXICON)
        enrich_record(FIXTURE_NORMALIZED_LEXICON, lookup)

        # Original must not have been modified
        assert "display" not in FIXTURE_NORMALIZED_LEXICON
        assert FIXTURE_NORMALIZED_LEXICON == original


# ===========================================================================
# Category 3: End-to-end file processing
# ===========================================================================

class TestEnrichRecords:
    """Test the full pipeline: normalized JSONL + IR JSONL → enriched JSONL."""

    def test_basic_end_to_end(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            norm_path = Path(tmpdir) / "normalized.jsonl"
            ir_lex_path = Path(tmpdir) / "ir_lexicon.jsonl"
            ir_idx_path = Path(tmpdir) / "ir_index.jsonl"
            output_path = Path(tmpdir) / "enriched.jsonl"

            _write_jsonl(norm_path, [
                FIXTURE_NORMALIZED_LEXICON,
                FIXTURE_NORMALIZED_INDEX,
            ])
            _write_jsonl(ir_lex_path, [FIXTURE_IR_LEXICON])
            _write_jsonl(ir_idx_path, [FIXTURE_IR_INDEX])

            stats = enrich_records(
                norm_path,
                [ir_lex_path, ir_idx_path],
                output_path,
            )

            assert stats["ir_records_loaded"] == 2
            assert stats["normalized_records_read"] == 2
            assert stats["enriched_with_display"] == 2
            assert stats["missing_display"] == 0
            assert stats["parse_errors"] == 0

            records = _read_jsonl(output_path)
            assert len(records) == 2

            # Check both have display fields
            for rec in records:
                assert "display" in rec
                assert "ir_id" in rec
                assert "search_keys" in rec

    def test_lexicon_display_fields_correct(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            norm_path = Path(tmpdir) / "normalized.jsonl"
            ir_path = Path(tmpdir) / "ir.jsonl"
            output_path = Path(tmpdir) / "enriched.jsonl"

            _write_jsonl(norm_path, [FIXTURE_NORMALIZED_LEXICON])
            _write_jsonl(ir_path, [FIXTURE_IR_LEXICON])

            enrich_records(norm_path, [ir_path], output_path)

            records = _read_jsonl(output_path)
            assert len(records) == 1

            display = records[0]["display"]
            assert display["headword_latin"] == "dɔ́bɛ̀n"
            assert display["headword_nko_provided"] == "ߘɔ߁ߓɛ߀ߒ"
            assert display["ps_raw"] == "v"
            assert display["pos_hint"] == "verb"
            assert len(display["senses"]) == 1
            assert display["senses"][0]["gloss_fr"] == "commencer"
            assert display["senses"][0]["gloss_en"] == "to begin"
            assert len(display["senses"][0]["examples"]) == 1
            assert display["variants_raw"] == ["dɔbɛn", "dòbèn"]

    def test_index_mapping_display_fields_correct(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            norm_path = Path(tmpdir) / "normalized.jsonl"
            ir_path = Path(tmpdir) / "ir.jsonl"
            output_path = Path(tmpdir) / "enriched.jsonl"

            _write_jsonl(norm_path, [FIXTURE_NORMALIZED_INDEX])
            _write_jsonl(ir_path, [FIXTURE_IR_INDEX])

            enrich_records(norm_path, [ir_path], output_path)

            records = _read_jsonl(output_path)
            assert len(records) == 1

            display = records[0]["display"]
            assert display["source_term"] == "abandonner"
            assert display["source_lang"] == "fr"
            assert len(display["target_entries"]) == 1
            assert display["target_entries"][0]["display_text"] == "bàn"

    def test_missing_ir_produces_record_without_display(self):
        """Normalized records without matching IR still appear in output."""
        orphan = make_normalized_record(
            ir_id="orphan_no_ir",
            preferred_form="orphan",
        )
        with tempfile.TemporaryDirectory() as tmpdir:
            norm_path = Path(tmpdir) / "normalized.jsonl"
            ir_path = Path(tmpdir) / "ir.jsonl"
            output_path = Path(tmpdir) / "enriched.jsonl"

            _write_jsonl(norm_path, [
                FIXTURE_NORMALIZED_LEXICON,
                orphan,
            ])
            _write_jsonl(ir_path, [FIXTURE_IR_LEXICON])

            stats = enrich_records(norm_path, [ir_path], output_path)

            assert stats["enriched_with_display"] == 1
            assert stats["missing_display"] == 1

            records = _read_jsonl(output_path)
            assert len(records) == 2

            # Find the orphan
            orphan_out = [r for r in records if r["ir_id"] == "orphan_no_ir"]
            assert len(orphan_out) == 1
            assert "display" not in orphan_out[0]

            # The other should have display
            enriched_out = [r for r in records if r["ir_id"] == "aaaa1111bbbb2222"]
            assert len(enriched_out) == 1
            assert "display" in enriched_out[0]

    def test_determinism(self):
        """Running twice on the same input produces identical output bytes."""
        with tempfile.TemporaryDirectory() as tmpdir:
            norm_path = Path(tmpdir) / "normalized.jsonl"
            ir_lex_path = Path(tmpdir) / "ir_lexicon.jsonl"
            ir_idx_path = Path(tmpdir) / "ir_index.jsonl"
            output_a = Path(tmpdir) / "enriched_a.jsonl"
            output_b = Path(tmpdir) / "enriched_b.jsonl"

            _write_jsonl(norm_path, [
                FIXTURE_NORMALIZED_LEXICON,
                FIXTURE_NORMALIZED_INDEX,
            ])
            _write_jsonl(ir_lex_path, [FIXTURE_IR_LEXICON])
            _write_jsonl(ir_idx_path, [FIXTURE_IR_INDEX])

            enrich_records(norm_path, [ir_lex_path, ir_idx_path], output_a)
            enrich_records(norm_path, [ir_lex_path, ir_idx_path], output_b)

            assert output_a.read_bytes() == output_b.read_bytes()

    def test_empty_normalized_input(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            norm_path = Path(tmpdir) / "normalized.jsonl"
            ir_path = Path(tmpdir) / "ir.jsonl"
            output_path = Path(tmpdir) / "enriched.jsonl"

            _write_jsonl(norm_path, [])
            _write_jsonl(ir_path, [FIXTURE_IR_LEXICON])

            stats = enrich_records(norm_path, [ir_path], output_path)

            assert stats["normalized_records_read"] == 0
            assert stats["enriched_with_display"] == 0
            assert output_path.exists()
            assert _read_jsonl(output_path) == []

    def test_missing_normalized_file(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            norm_path = Path(tmpdir) / "does_not_exist.jsonl"
            ir_path = Path(tmpdir) / "ir.jsonl"
            output_path = Path(tmpdir) / "enriched.jsonl"

            _write_jsonl(ir_path, [FIXTURE_IR_LEXICON])

            stats = enrich_records(norm_path, [ir_path], output_path)
            assert stats["normalized_records_read"] == 0

    def test_malformed_json_in_normalized_counted(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            norm_path = Path(tmpdir) / "normalized.jsonl"
            ir_path = Path(tmpdir) / "ir.jsonl"
            output_path = Path(tmpdir) / "enriched.jsonl"

            with open(norm_path, "w") as f:
                f.write(json.dumps(FIXTURE_NORMALIZED_LEXICON, ensure_ascii=False) + "\n")
                f.write("NOT VALID JSON\n")
                f.write(json.dumps(FIXTURE_NORMALIZED_INDEX, ensure_ascii=False) + "\n")

            _write_jsonl(ir_path, [FIXTURE_IR_LEXICON, FIXTURE_IR_INDEX])

            stats = enrich_records(norm_path, [ir_path], output_path)
            assert stats["normalized_records_read"] == 2
            assert stats["parse_errors"] == 1
            assert stats["enriched_with_display"] == 2

    def test_output_lines_are_valid_json(self):
        """Every output line must be valid JSON with the enriched schema."""
        with tempfile.TemporaryDirectory() as tmpdir:
            norm_path = Path(tmpdir) / "normalized.jsonl"
            ir_lex_path = Path(tmpdir) / "ir_lexicon.jsonl"
            ir_idx_path = Path(tmpdir) / "ir_index.jsonl"
            output_path = Path(tmpdir) / "enriched.jsonl"

            _write_jsonl(norm_path, [
                FIXTURE_NORMALIZED_LEXICON,
                FIXTURE_NORMALIZED_INDEX,
            ])
            _write_jsonl(ir_lex_path, [FIXTURE_IR_LEXICON])
            _write_jsonl(ir_idx_path, [FIXTURE_IR_INDEX])

            enrich_records(norm_path, [ir_lex_path, ir_idx_path], output_path)

            with open(output_path, "r", encoding="utf-8") as f:
                for line_num, line in enumerate(f, 1):
                    obj = json.loads(line.strip())
                    # Required fields from normalized record
                    assert isinstance(obj["ir_id"], str), f"Line {line_num}: ir_id not str"
                    assert isinstance(obj["ir_kind"], str), f"Line {line_num}: ir_kind not str"
                    assert isinstance(obj["search_keys"], dict), (
                        f"Line {line_num}: search_keys not dict"
                    )
                    # Display field must be present and be a dict
                    assert isinstance(obj["display"], dict), (
                        f"Line {line_num}: display not dict"
                    )

    def test_record_order_preserved(self):
        """Output records must appear in the same order as normalized input."""
        records = [
            make_normalized_record(ir_id=f"id_{i}", preferred_form=f"form_{i}")
            for i in range(10)
        ]
        ir_units = [
            make_ir_unit(ir_id=f"id_{i}", fields_raw={"headword_latin": f"form_{i}"})
            for i in range(10)
        ]

        with tempfile.TemporaryDirectory() as tmpdir:
            norm_path = Path(tmpdir) / "normalized.jsonl"
            ir_path = Path(tmpdir) / "ir.jsonl"
            output_path = Path(tmpdir) / "enriched.jsonl"

            _write_jsonl(norm_path, records)
            _write_jsonl(ir_path, ir_units)

            enrich_records(norm_path, [ir_path], output_path)

            output_records = _read_jsonl(output_path)
            output_ids = [r["ir_id"] for r in output_records]
            expected_ids = [f"id_{i}" for i in range(10)]
            assert output_ids == expected_ids
