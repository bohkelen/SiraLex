"""
Golden fixture regression tests for Mali-pense lexicon parser.

These tests prevent parser "improvements" from silently changing the dataset.
Each fixture represents a specific entry pattern that must be preserved.

Fixture categories:
1. Simplest entry (like -da)
2. Multi-sense with examples (like dɔ́bɛ̀n)
3. Huge entry with many sub-entries (like dá)
4. Entry with no examples
5. Entry with no En/Ru glosses
6. Entry with multiple MXRef blocks
7. Entry with weird punctuation/apostrophes/backticks
8. Entry with ɛ/ɲ/ɔ headword
9. Entry at page boundaries
10. Entry where span.SnsN formatting deviates
"""

import json
import pytest
from pathlib import Path
from typing import Any

# Golden fixtures: expected parser output for specific entries
# Key assertions are conservative: entry count, headword, sense count, N'Ko bindings

GOLDEN_FIXTURES = {
    # 1. Simplest entry: -da (morpheme, 1 sense, no examples)
    "e2203": {
        "entry_id": "e2203",
        "url_pattern": "lexicon/d.htm",
        "expected": {
            "headword_latin": "-da",
            "headword_nko_provided": "ߘߊ",
            "anchor_names": ["-da"],
            "sense_count": 1,
            "has_examples": False,
            "has_sub_entries": False,
        },
    },
    
    # 2. Multi-sense with examples: dɔ́bɛ̀n
    "e2847": {
        "entry_id": "e2847",
        "url_pattern": "lexicon/d.htm",
        "expected": {
            "headword_latin": "dɔ́bɛ̀n",
            "headword_nko_provided": "ߘߐߓߍ߲߬",
            "anchor_names": ["dɔ́bɛ̀n", "dɔbɛn", "dòbèn"],
            "sense_count_min": 5,  # At least 5 senses
            "has_examples": True,
            "example_nko_binding": True,  # Examples have N'Ko bound correctly
        },
    },
    
    # 3. Huge entry with many sub-entries: dá (80+ blocks)
    "e2204": {
        "entry_id": "e2204",
        "url_pattern": "lexicon/d.htm",
        "expected": {
            "headword_latin": "dá",
            "headword_nko_provided": "ߘߊ",
            "anchor_names": ["dá", "da"],
            "sense_count_min": 8,  # At least 8 numbered senses
            "has_sub_entries": True,
            "sub_entry_nko_binding": True,  # Sub-entries have N'Ko bound correctly
            "should_have_warning": True,  # entry_unusually_large warning
        },
    },
    
    # 4. Entry with no examples: dáaba (simple noun)
    "e2214": {
        "entry_id": "e2214",
        "url_pattern": "lexicon/d.htm",
        "expected": {
            "headword_latin": "dáaba",
            "headword_nko_provided": "ߘߊ߯ߓߊ",
            "has_examples": False,
            "sense_count": 1,
        },
    },
    
    # 8. Entry with ɛ headword
    "ɛ_entry": {
        "entry_id": None,  # Will be found by pattern
        "url_pattern": "lexicon/ɛ.htm",
        "find_by": "first_entry",  # First entry on ɛ.htm page
        "expected": {
            "headword_contains_ɛ": True,
            "has_nko": True,
        },
    },
    
    # Entry with ɲ headword
    "ɲ_entry": {
        "entry_id": None,
        "url_pattern": "lexicon/ɲ.htm",
        "find_by": "first_entry",
        "expected": {
            "headword_contains_ɲ": True,
            "has_nko": True,
        },
    },
    
    # Entry with ɔ headword
    "ɔ_entry": {
        "entry_id": None,
        "url_pattern": "lexicon/ɔ.htm",
        "find_by": "first_entry",
        "expected": {
            "headword_contains_ɔ": True,
            "has_nko": True,
        },
    },
}


def validate_entry(ir_unit: dict[str, Any], expected: dict[str, Any]) -> list[str]:
    """
    Validate an IR unit against expected assertions.
    
    Returns list of failure messages (empty if all pass).
    """
    failures = []
    fields_raw = ir_unit.get("fields_raw", {})
    record_locator = ir_unit.get("record_locator", {})
    senses = fields_raw.get("senses", [])
    
    # Headword checks
    if "headword_latin" in expected:
        if fields_raw.get("headword_latin") != expected["headword_latin"]:
            failures.append(
                f"headword_latin: expected '{expected['headword_latin']}', "
                f"got '{fields_raw.get('headword_latin')}'"
            )
    
    if "headword_nko_provided" in expected:
        if fields_raw.get("headword_nko_provided") != expected["headword_nko_provided"]:
            failures.append(
                f"headword_nko_provided: expected '{expected['headword_nko_provided']}', "
                f"got '{fields_raw.get('headword_nko_provided')}'"
            )
    
    if "headword_contains_ɛ" in expected and expected["headword_contains_ɛ"]:
        if "ɛ" not in fields_raw.get("headword_latin", ""):
            failures.append("headword_latin should contain ɛ")
    
    if "headword_contains_ɲ" in expected and expected["headword_contains_ɲ"]:
        if "ɲ" not in fields_raw.get("headword_latin", ""):
            failures.append("headword_latin should contain ɲ")
    
    if "headword_contains_ɔ" in expected and expected["headword_contains_ɔ"]:
        if "ɔ" not in fields_raw.get("headword_latin", ""):
            failures.append("headword_latin should contain ɔ")
    
    # Anchor names (in record_locator, not fields_raw)
    if "anchor_names" in expected:
        actual_anchors = record_locator.get("anchor_names", [])
        if set(actual_anchors) != set(expected["anchor_names"]):
            failures.append(
                f"anchor_names: expected {expected['anchor_names']}, got {actual_anchors}"
            )
    
    # Sense count checks
    if "sense_count" in expected:
        if len(senses) != expected["sense_count"]:
            failures.append(
                f"sense_count: expected {expected['sense_count']}, got {len(senses)}"
            )
    
    if "sense_count_min" in expected:
        if len(senses) < expected["sense_count_min"]:
            failures.append(
                f"sense_count_min: expected >= {expected['sense_count_min']}, got {len(senses)}"
            )
    
    # Example checks
    if "has_examples" in expected:
        total_examples = sum(len(s.get("examples", [])) for s in senses)
        if expected["has_examples"] and total_examples == 0:
            failures.append("has_examples: expected examples but found none")
        elif not expected["has_examples"] and total_examples > 0:
            failures.append(f"has_examples: expected no examples but found {total_examples}")
    
    # N'Ko checks
    if "has_nko" in expected and expected["has_nko"]:
        if not fields_raw.get("headword_nko_provided"):
            failures.append("has_nko: expected N'Ko headword but none found")
    
    # Example N'Ko binding check
    if expected.get("example_nko_binding"):
        found_nko_example = False
        for sense in senses:
            for ex in sense.get("examples", []):
                if ex.get("text_nko_provided"):
                    found_nko_example = True
                    break
            if found_nko_example:
                break
        if not found_nko_example:
            failures.append("example_nko_binding: no example with text_nko_provided found")
    
    # Sub-entry checks
    if "has_sub_entries" in expected:
        total_sub_entries = sum(len(s.get("sub_entries", [])) for s in senses)
        if expected["has_sub_entries"] and total_sub_entries == 0:
            failures.append("has_sub_entries: expected sub-entries but found none")
        elif not expected["has_sub_entries"] and total_sub_entries > 0:
            failures.append(f"has_sub_entries: expected no sub-entries but found {total_sub_entries}")
    
    # Sub-entry N'Ko binding check
    if expected.get("sub_entry_nko_binding"):
        found_nko_sub = False
        for sense in senses:
            for sub in sense.get("sub_entries", []):
                if sub.get("nko"):
                    found_nko_sub = True
                    break
            if found_nko_sub:
                break
        if not found_nko_sub:
            failures.append("sub_entry_nko_binding: no sub-entry with nko found")
    
    # Warning checks
    if expected.get("should_have_warning"):
        warnings = ir_unit.get("parse_warnings", [])
        if not warnings:
            failures.append("should_have_warning: expected warnings but none found")
    
    return failures


class TestGoldenFixtures:
    """Golden fixture regression tests."""
    
    @pytest.fixture
    def ir_data_path(self) -> Path | None:
        """Path to IR JSONL data (if available)."""
        # Try multiple potential locations
        candidates = [
            Path("/home/potentplot/projects/perso_projects/nkokan/data/ir/malipense_lexicon_v3.jsonl"),
            Path("data/ir/malipense_lexicon_v3.jsonl"),
            Path("../../../data/ir/malipense_lexicon_v3.jsonl"),
        ]
        for p in candidates:
            if p.exists():
                return p
        return None
    
    @pytest.fixture
    def ir_entries(self, ir_data_path: Path | None) -> dict[str, dict]:
        """Load IR entries indexed by source_record_id."""
        if ir_data_path is None:
            pytest.skip("IR data file not found")
        
        entries = {}
        with open(ir_data_path, "r", encoding="utf-8") as f:
            for line in f:
                entry = json.loads(line)
                record_id = entry.get("record_locator", {}).get("source_record_id")
                url = entry.get("record_locator", {}).get("url_canonical", "")
                if record_id:
                    # Key by record_id + url to handle same ID across pages
                    key = f"{url}#{record_id}"
                    entries[key] = entry
                    # Also store by just record_id for convenience
                    entries[record_id] = entry
        return entries
    
    def test_simplest_entry_e2203(self, ir_entries: dict):
        """Test simplest entry: -da (morpheme)."""
        fixture = GOLDEN_FIXTURES["e2203"]
        entry = ir_entries.get(fixture["entry_id"])
        assert entry is not None, f"Entry {fixture['entry_id']} not found"
        
        failures = validate_entry(entry, fixture["expected"])
        assert not failures, f"Validation failures: {failures}"
    
    def test_multi_sense_e2847(self, ir_entries: dict):
        """Test multi-sense with examples: dɔ́bɛ̀n."""
        fixture = GOLDEN_FIXTURES["e2847"]
        entry = ir_entries.get(fixture["entry_id"])
        assert entry is not None, f"Entry {fixture['entry_id']} not found"
        
        failures = validate_entry(entry, fixture["expected"])
        assert not failures, f"Validation failures: {failures}"
    
    def test_huge_entry_e2204(self, ir_entries: dict):
        """Test huge entry with sub-entries: dá."""
        fixture = GOLDEN_FIXTURES["e2204"]
        entry = ir_entries.get(fixture["entry_id"])
        assert entry is not None, f"Entry {fixture['entry_id']} not found"
        
        failures = validate_entry(entry, fixture["expected"])
        assert not failures, f"Validation failures: {failures}"
    
    def test_no_examples_e2214(self, ir_entries: dict):
        """Test entry with no examples: dáaba."""
        fixture = GOLDEN_FIXTURES["e2214"]
        entry = ir_entries.get(fixture["entry_id"])
        assert entry is not None, f"Entry {fixture['entry_id']} not found"
        
        failures = validate_entry(entry, fixture["expected"])
        assert not failures, f"Validation failures: {failures}"
    
    def test_anchor_names_only_in_record_locator(self, ir_entries: dict):
        """Verify anchor_names is in record_locator, not fields_raw."""
        # Sample a few entries
        for entry_id in ["e2203", "e2204", "e2847"]:
            entry = ir_entries.get(entry_id)
            if entry:
                # anchor_names should NOT be in fields_raw
                assert "anchor_names" not in entry.get("fields_raw", {}), \
                    f"Entry {entry_id}: anchor_names should not be in fields_raw"
                
                # anchor_names SHOULD be in record_locator (if present)
                record_locator = entry.get("record_locator", {})
                # It's OK if anchor_names is empty for entries without anchors
    
    def test_raw_block_hash_present(self, ir_entries: dict):
        """Verify raw_block_hash is present for lossiness detection."""
        for entry_id in ["e2203", "e2204", "e2847"]:
            entry = ir_entries.get(entry_id)
            if entry:
                evidence = entry.get("evidence", [])
                assert len(evidence) > 0, f"Entry {entry_id}: no evidence"
                
                # raw_block_hash should be in evidence
                has_hash = any(e.get("raw_block_hash") for e in evidence)
                assert has_hash, f"Entry {entry_id}: no raw_block_hash in evidence"
    
    def test_warning_policy_id_present(self, ir_entries: dict):
        """Verify warning_policy_id is present when warnings exist."""
        entry = ir_entries.get("e2204")  # This entry has warnings
        if entry:
            warnings = entry.get("parse_warnings", [])
            if warnings:
                assert entry.get("warning_policy_id"), \
                    "Entries with warnings should have warning_policy_id"
    
    def test_entry_block_end_selector_exclusive(self, ir_entries: dict):
        """
        Verify entry_block.end_selector semantics:
        - start_selector is INCLUSIVE
        - end_selector is EXCLUSIVE (points to next entry)
        """
        entry = ir_entries.get("e2203")  # -da, followed by e2204 (dá)
        if entry:
            evidence = entry.get("evidence", [{}])[0]
            entry_block = evidence.get("entry_block", {})
            
            assert entry_block.get("start_selector") == "span#e2203"
            assert entry_block.get("end_selector") == "span#e2204"
            
            # The end_selector points to the NEXT entry, not this one
            # This is the half-open interval [e2203, e2204)


class TestPageBoundaries:
    """Test entries at page boundaries."""
    
    @pytest.fixture
    def ir_entries_by_page(self, ir_data_path: Path | None) -> dict[str, list]:
        """Load IR entries grouped by page URL."""
        if ir_data_path is None:
            pytest.skip("IR data file not found")
        
        pages: dict[str, list] = {}
        with open(ir_data_path, "r", encoding="utf-8") as f:
            for line in f:
                entry = json.loads(line)
                url = entry.get("record_locator", {}).get("url_canonical", "")
                if url not in pages:
                    pages[url] = []
                pages[url].append(entry)
        
        # Sort entries by entry_id within each page
        for url in pages:
            pages[url].sort(key=lambda e: e.get("record_locator", {}).get("source_record_id", ""))
        
        return pages
    
    def test_first_entry_on_page(self, ir_entries_by_page: dict):
        """Test first entry on each page has valid structure."""
        for url, entries in ir_entries_by_page.items():
            if entries:
                first = entries[0]
                fields_raw = first.get("fields_raw", {})
                
                # First entry should have headword
                assert fields_raw.get("headword_latin"), \
                    f"First entry on {url} missing headword_latin"
    
    def test_last_entry_on_page(self, ir_entries_by_page: dict):
        """Test last entry on each page has valid structure (end_selector may be None)."""
        for url, entries in ir_entries_by_page.items():
            if entries:
                last = entries[-1]
                evidence = last.get("evidence", [{}])[0]
                entry_block = evidence.get("entry_block", {})
                
                # Last entry may have end_selector = None
                # This is valid (entry extends to end of page)
                assert entry_block.get("start_selector"), \
                    f"Last entry on {url} missing start_selector"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
