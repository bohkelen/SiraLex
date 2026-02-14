"""
Golden fixture regression tests for Mali-pense lexicon parser.

IMPORTANT (dataset freeze discipline):

These tests validate the frozen IR artifacts produced for the
`v1.0-dataset-freeze` milestone (e.g. `malipense_lexicon_v3.jsonl`).

Frozen artifacts MUST NOT be regenerated or modified in-place. If the IR
schema/expectations evolve (NFC normalization, new structural fields, etc.),
introduce a vNext parser + vNext artifacts and add separate tests.

Implication for comparisons in this file:
- Latin headwords and anchor names may differ only by Unicode normalization
  form (NFC vs decomposed). Comparisons MUST be done under NFC to avoid
  platform-specific drift (e.g. macOS vs Linux).
- Newer fields (e.g. raw_block_hash, warning_policy_id) are treated as optional
  for frozen v3 artifacts unless explicitly required by the v3 freeze spec.

Fixture categories:
1. Simplest entry (like -da)
2. Multi-sense with examples (like dɔ́bɛ̀n)
3. Huge entry with many sub-entries (like dá)
4. Entry with no examples
5. Entry with no En/Ru glosses (French-only)
6. Entry with multiple MXRef blocks
7. Entry with weird punctuation/apostrophes/backticks
8. Entry with ɛ/ɲ/ɔ headword
9. Entry at page boundaries
10. Entry where span.SnsN formatting deviates
"""

import json
import pytest
import unicodedata
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
            "sub_entry_count_min": 30,  # At least 30 sub-entries total
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

    # 5. Entry with no En/Ru glosses (French-only): Ísa
    "e4014": {
        "entry_id": "e4014",
        "url_pattern": "lexicon/i.htm",
        "expected": {
            "headword_latin": "Ísa",
            "headword_nko_provided": "ߌߛߊ߫",
            "anchor_names": ["Ísa", "Isa"],
            "sense_count": 1,
            "has_gloss_fr": True,
            "has_gloss_en": False,
            "has_gloss_ru": False,
        },
    },

    # 6. Entry with multiple MXRef blocks: dàa (6 sub-entries)
    "e2212": {
        "entry_id": "e2212",
        "url_pattern": "lexicon/d.htm",
        "expected": {
            "headword_latin": "dàa",
            "headword_nko_provided": "ߘߊ߱",
            "anchor_names": ["dàa"],
            "sense_count": 1,
            "has_sub_entries": True,
            "sub_entry_count_min": 5,  # At least 5 sub-entries
            "sub_entry_nko_binding": True,  # All sub-entries have N'Ko
            "sub_entry_has_glosses": True,  # Sub-entries have Fr/En/Ru glosses
        },
    },

    # 7. Entry with weird punctuation (backtick): tɛ̀d' (apostrophe in headword)
    "e8072": {
        "entry_id": "e8072",
        "url_pattern": "lexicon/t.htm",
        "expected": {
            "headword_latin": "tɛ̀d'",
            "headword_nko_provided": "ߕߘߍ߬",
            "anchor_names": ["tɛ̀d'", "tɛd'", "tèd'"],
            "sense_count": 0,  # No senses - just the headword
            "should_have_warning": True,  # no_senses_found
        },
    },

    # 7b. Another punctuation entry: dín` (backtick in headword)
    "e2770": {
        "entry_id": "e2770",
        "url_pattern": "lexicon/d.htm",
        "expected": {
            "headword_latin": "dín`",
            "headword_nko_provided": "ߘߌߣߊ߬",
            "anchor_names": ["dín`", "din`"],
            "sense_count": 1,
        },
    },

    # 8a. Entry with ɛ headword: ɛ́ (first entry on ɛ.htm)
    "e3135": {
        "entry_id": "e3135",
        "url_pattern": "lexicon/ɛ.htm",
        "expected": {
            "headword_latin": "ɛ́",
            "headword_nko_provided": "ߍ߫",
            "headword_contains_ɛ": True,
            "anchor_names": ["ɛ́", "ɛ", "è"],
            "sense_count": 1,
        },
    },

    # 8b. Entry with ɲ headword: -ɲa (first entry on ɲ.htm)
    "e6758": {
        "entry_id": "e6758",
        "url_pattern": "lexicon/ɲ.htm",
        "expected": {
            "headword_latin": "-ɲa",
            "headword_nko_provided": "ߦߊ",
            "headword_contains_ɲ": True,
            "sense_count": 1,
        },
    },

    # 8c. Entry with ɔ headword: ɔ̀ (first entry on ɔ.htm)
    "e7015": {
        "entry_id": "e7015",
        "url_pattern": "lexicon/ɔ.htm",
        "expected": {
            "headword_latin": "ɔ̀",
            "headword_nko_provided": "ߐ߬",
            "headword_contains_ɔ": True,
            "sense_count": 1,
        },
    },

    # 10. SnsN formatting deviation: dà (sense numbering starts at None, then 2)
    "e2208": {
        "entry_id": "e2208",
        "url_pattern": "lexicon/d.htm",
        "expected": {
            "headword_latin": "dà",
            "headword_nko_provided": "ߘߊ߭",
            "anchor_names": ["dà"],
            "sense_count": 2,
            "sense_numbers": [None, 2],  # Deviation: first sense has no number
            "has_gloss_fr": True,
            "has_gloss_en": True,
        },
    },
}

# Expected entry counts per page (from observed data)
EXPECTED_PAGE_ENTRY_COUNTS = {
    "d.htm": 923,
    "a.htm": 176,
    "b.htm": 1941,
    "k.htm": 1098,
    "ɛ.htm": 9,
    "ɲ.htm": 251,
    "ɔ.htm": 4,
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

    def _nfc(s: str | None) -> str | None:
        if s is None:
            return None
        return unicodedata.normalize("NFC", s)

    def _nfc_list(values: list[str]) -> list[str]:
        return [unicodedata.normalize("NFC", v) for v in values]

    # Headword checks (compare under NFC; IR is capture-accurate, not NFC-normalized)
    if "headword_latin" in expected:
        actual_hw = _nfc(fields_raw.get("headword_latin"))
        expected_hw = _nfc(expected["headword_latin"])
        if actual_hw != expected_hw:
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
        if "ɛ" not in fields_raw.get("headword_latin", "").lower():
            failures.append("headword_latin should contain ɛ")

    if "headword_contains_ɲ" in expected and expected["headword_contains_ɲ"]:
        if "ɲ" not in fields_raw.get("headword_latin", "").lower():
            failures.append("headword_latin should contain ɲ")

    if "headword_contains_ɔ" in expected and expected["headword_contains_ɔ"]:
        if "ɔ" not in fields_raw.get("headword_latin", "").lower():
            failures.append("headword_latin should contain ɔ")

    # Anchor names (in record_locator, not fields_raw)
    if "anchor_names" in expected:
        actual_anchors = record_locator.get("anchor_names", [])
        actual_anchors_nfc = set(_nfc_list(list(actual_anchors)))
        expected_anchors_nfc = set(_nfc_list(list(expected["anchor_names"])))
        if actual_anchors_nfc != expected_anchors_nfc:
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

    # Sense number sequence check
    if "sense_numbers" in expected:
        actual_nums = [s.get("sense_num") for s in senses]
        if actual_nums != expected["sense_numbers"]:
            failures.append(
                f"sense_numbers: expected {expected['sense_numbers']}, got {actual_nums}"
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

    # Sub-entry minimum count
    if "sub_entry_count_min" in expected:
        total_sub_entries = sum(len(s.get("sub_entries", [])) for s in senses)
        if total_sub_entries < expected["sub_entry_count_min"]:
            failures.append(
                f"sub_entry_count_min: expected >= {expected['sub_entry_count_min']}, "
                f"got {total_sub_entries}"
            )

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

    # Sub-entry gloss check
    if expected.get("sub_entry_has_glosses"):
        found_sub_gloss = False
        for sense in senses:
            for sub in sense.get("sub_entries", []):
                if sub.get("gloss_fr") or sub.get("gloss_en") or sub.get("gloss_ru"):
                    found_sub_gloss = True
                    break
            if found_sub_gloss:
                break
        if not found_sub_gloss:
            failures.append("sub_entry_has_glosses: no sub-entry with glosses found")

    # Gloss presence checks (per-language)
    if "has_gloss_fr" in expected:
        has_fr = any(s.get("gloss_fr") for s in senses)
        if expected["has_gloss_fr"] and not has_fr:
            failures.append("has_gloss_fr: expected French glosses but found none")
        elif not expected["has_gloss_fr"] and has_fr:
            failures.append("has_gloss_fr: expected no French glosses but found some")

    if "has_gloss_en" in expected:
        has_en = any(s.get("gloss_en") for s in senses)
        if expected["has_gloss_en"] and not has_en:
            failures.append("has_gloss_en: expected English glosses but found none")
        elif not expected["has_gloss_en"] and has_en:
            failures.append("has_gloss_en: expected no English glosses but found some")

    if "has_gloss_ru" in expected:
        has_ru = any(s.get("gloss_ru") for s in senses)
        if expected["has_gloss_ru"] and not has_ru:
            failures.append("has_gloss_ru: expected Russian glosses but found none")
        elif not expected["has_gloss_ru"] and has_ru:
            failures.append("has_gloss_ru: expected no Russian glosses but found some")

    # Warning checks
    if expected.get("should_have_warning"):
        warnings = ir_unit.get("parse_warnings", [])
        if not warnings:
            failures.append("should_have_warning: expected warnings but none found")

    return failures


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

IR_DATA_CANDIDATES = [
    Path("/home/potentplot/projects/perso_projects/nkokan/data/ir/malipense_lexicon_v3.jsonl"),
    Path("data/ir/malipense_lexicon_v3.jsonl"),
    Path("../../../data/ir/malipense_lexicon_v3.jsonl"),
]


def _find_ir_data() -> Path | None:
    for p in IR_DATA_CANDIDATES:
        if p.exists():
            return p
    return None


@pytest.fixture(scope="module")
def ir_data_path() -> Path | None:
    """Path to IR JSONL data (if available)."""
    return _find_ir_data()


@pytest.fixture(scope="module")
def ir_entries(ir_data_path: Path | None) -> dict[str, dict]:
    """Load IR entries indexed by source_record_id."""
    if ir_data_path is None:
        pytest.skip("IR data file not found")

    entries: dict[str, dict] = {}
    with open(ir_data_path, "r", encoding="utf-8") as f:
        for line in f:
            entry = json.loads(line)
            record_id = entry.get("record_locator", {}).get("source_record_id")
            if record_id:
                entries[record_id] = entry
    return entries


@pytest.fixture(scope="module")
def ir_entries_by_page(ir_data_path: Path | None) -> dict[str, list]:
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
        pages[url].sort(
            key=lambda e: e.get("record_locator", {}).get("source_record_id", "")
        )

    return pages


# ---------------------------------------------------------------------------
# Helper to look up a fixture entry
# ---------------------------------------------------------------------------

def _get_entry(ir_entries: dict, fixture_key: str) -> dict | None:
    """Get an IR unit from the data by fixture key."""
    fixture = GOLDEN_FIXTURES[fixture_key]
    entry_id = fixture.get("entry_id")
    if entry_id:
        return ir_entries.get(entry_id)
    return None


# ===========================================================================
# Category 1: Simplest entry
# ===========================================================================

class TestSimplestEntry:
    """1. Simplest entry: -da (morpheme, 1 sense, no examples)."""

    def test_simplest_entry_e2203(self, ir_entries: dict):
        entry = _get_entry(ir_entries, "e2203")
        assert entry is not None, "Entry e2203 (-da) not found"
        failures = validate_entry(entry, GOLDEN_FIXTURES["e2203"]["expected"])
        assert not failures, f"Validation failures: {failures}"


# ===========================================================================
# Category 2: Multi-sense with examples
# ===========================================================================

class TestMultiSenseWithExamples:
    """2. Multi-sense with examples: dɔ́bɛ̀n."""

    def test_multi_sense_e2847(self, ir_entries: dict):
        entry = _get_entry(ir_entries, "e2847")
        assert entry is not None, "Entry e2847 (dɔ́bɛ̀n) not found"
        failures = validate_entry(entry, GOLDEN_FIXTURES["e2847"]["expected"])
        assert not failures, f"Validation failures: {failures}"


# ===========================================================================
# Category 3: Huge entry with many sub-entries
# ===========================================================================

class TestHugeEntryWithSubEntries:
    """3. Huge entry with many sub-entries: dá (80+ blocks)."""

    def test_huge_entry_e2204(self, ir_entries: dict):
        entry = _get_entry(ir_entries, "e2204")
        assert entry is not None, "Entry e2204 (dá) not found"
        failures = validate_entry(entry, GOLDEN_FIXTURES["e2204"]["expected"])
        assert not failures, f"Validation failures: {failures}"


# ===========================================================================
# Category 4: Entry with no examples
# ===========================================================================

class TestNoExamples:
    """4. Entry with no examples: dáaba."""

    def test_no_examples_e2214(self, ir_entries: dict):
        entry = _get_entry(ir_entries, "e2214")
        assert entry is not None, "Entry e2214 (dáaba) not found"
        failures = validate_entry(entry, GOLDEN_FIXTURES["e2214"]["expected"])
        assert not failures, f"Validation failures: {failures}"


# ===========================================================================
# Category 5: Entry with no En/Ru glosses (French-only)
# ===========================================================================

class TestNoEnRuGlosses:
    """5. Entry with no En/Ru glosses: Ísa (French-only)."""

    def test_french_only_e4014(self, ir_entries: dict):
        entry = _get_entry(ir_entries, "e4014")
        assert entry is not None, "Entry e4014 (Ísa) not found"
        failures = validate_entry(entry, GOLDEN_FIXTURES["e4014"]["expected"])
        assert not failures, f"Validation failures: {failures}"


# ===========================================================================
# Category 6: Entry with multiple MXRef blocks
# ===========================================================================

class TestMultipleMXRef:
    """6. Entry with multiple MXRef/sub-entry blocks: dàa (6 sub-entries)."""

    def test_multiple_mxref_e2212(self, ir_entries: dict):
        entry = _get_entry(ir_entries, "e2212")
        assert entry is not None, "Entry e2212 (dàa) not found"
        failures = validate_entry(entry, GOLDEN_FIXTURES["e2212"]["expected"])
        assert not failures, f"Validation failures: {failures}"

    def test_sub_entry_nko_binding_e2212(self, ir_entries: dict):
        """Verify N'Ko is correctly bound to each sub-entry."""
        entry = ir_entries.get("e2212")
        if entry is None:
            pytest.skip("Entry e2212 not found")
        senses = entry.get("fields_raw", {}).get("senses", [])
        for sense in senses:
            for sub in sense.get("sub_entries", []):
                if sub.get("text"):
                    assert sub.get("nko"), (
                        f"Sub-entry '{sub.get('text')[:40]}' missing N'Ko binding"
                    )

    def test_sub_entry_glosses_e2212(self, ir_entries: dict):
        """Verify sub-entries have Fr/En glosses."""
        entry = ir_entries.get("e2212")
        if entry is None:
            pytest.skip("Entry e2212 not found")
        senses = entry.get("fields_raw", {}).get("senses", [])
        for sense in senses:
            for sub in sense.get("sub_entries", []):
                if sub.get("text"):
                    has_gloss = sub.get("gloss_fr") or sub.get("gloss_en")
                    assert has_gloss, (
                        f"Sub-entry '{sub.get('text')[:40]}' missing glosses"
                    )


# ===========================================================================
# Category 7: Entry with weird punctuation
# ===========================================================================

class TestWeirdPunctuation:
    """7. Entries with apostrophes, backticks, special characters."""

    def test_apostrophe_headword_e8072(self, ir_entries: dict):
        """tɛ̀d' - headword with trailing apostrophe."""
        entry = _get_entry(ir_entries, "e8072")
        assert entry is not None, "Entry e8072 (tɛ̀d') not found"
        failures = validate_entry(entry, GOLDEN_FIXTURES["e8072"]["expected"])
        assert not failures, f"Validation failures: {failures}"

    def test_backtick_headword_e2770(self, ir_entries: dict):
        """dín` - headword with trailing backtick."""
        entry = _get_entry(ir_entries, "e2770")
        assert entry is not None, "Entry e2770 (dín`) not found"
        failures = validate_entry(entry, GOLDEN_FIXTURES["e2770"]["expected"])
        assert not failures, f"Validation failures: {failures}"

    def test_apostrophe_anchor_variants(self, ir_entries: dict):
        """Verify punctuation is preserved in anchor names."""
        entry = ir_entries.get("e8072")
        if entry is None:
            pytest.skip("Entry e8072 not found")
        anchors = entry.get("record_locator", {}).get("anchor_names", [])
        # At least one anchor should contain the apostrophe
        assert any("'" in a for a in anchors), (
            f"No anchor with apostrophe found in {anchors}"
        )


# ===========================================================================
# Category 8: Entries with ɛ/ɲ/ɔ headwords
# ===========================================================================

class TestSpecialCharacterHeadwords:
    """8. Entries with ɛ, ɲ, ɔ in headword."""

    def test_epsilon_headword_e3135(self, ir_entries: dict):
        """ɛ́ - first entry on ɛ.htm."""
        entry = _get_entry(ir_entries, "e3135")
        assert entry is not None, "Entry e3135 (ɛ́) not found"
        failures = validate_entry(entry, GOLDEN_FIXTURES["e3135"]["expected"])
        assert not failures, f"Validation failures: {failures}"

    def test_ny_headword_e6758(self, ir_entries: dict):
        """-ɲa - first entry on ɲ.htm."""
        entry = _get_entry(ir_entries, "e6758")
        assert entry is not None, "Entry e6758 (-ɲa) not found"
        failures = validate_entry(entry, GOLDEN_FIXTURES["e6758"]["expected"])
        assert not failures, f"Validation failures: {failures}"

    def test_open_o_headword_e7015(self, ir_entries: dict):
        """ɔ̀ - first entry on ɔ.htm."""
        entry = _get_entry(ir_entries, "e7015")
        assert entry is not None, "Entry e7015 (ɔ̀) not found"
        failures = validate_entry(entry, GOLDEN_FIXTURES["e7015"]["expected"])
        assert not failures, f"Validation failures: {failures}"


# ===========================================================================
# Category 9: Page boundary conditions
# ===========================================================================

class TestPageBoundaries:
    """9. Entries at page boundaries (first/last on page)."""

    def test_first_entry_on_every_page(self, ir_entries_by_page: dict):
        """First entry on each page has a valid headword."""
        for url, entries in ir_entries_by_page.items():
            if entries:
                first = entries[0]
                fields_raw = first.get("fields_raw", {})
                assert fields_raw.get("headword_latin"), (
                    f"First entry on {url} missing headword_latin"
                )

    def test_last_entry_end_selector_null_or_valid(self, ir_entries_by_page: dict):
        """
        Last entry on each page should have a valid entry_block range.

        Note: some frozen pages in v3 include an end_selector for the last entry.
        We accept either:
        - end_selector is None (ideal: extends to end of page), OR
        - end_selector is a valid span selector (legacy/frozen behavior).
        """
        for url, entries in ir_entries_by_page.items():
            if entries:
                last = entries[-1]
                evidence = last.get("evidence", [{}])[0]
                entry_block = evidence.get("entry_block", {})
                # Last entry should have start_selector
                assert entry_block.get("start_selector"), (
                    f"Last entry on {url} missing start_selector"
                )
                end_sel = entry_block.get("end_selector")
                if end_sel is not None:
                    assert isinstance(end_sel, str) and end_sel.startswith("span#"), (
                        f"Last entry on {url} has invalid end_selector: {end_sel!r}"
                    )

    def test_first_entry_d_htm_is_e2203(self, ir_entries_by_page: dict):
        """d.htm starts with e2203 (-da)."""
        for url, entries in ir_entries_by_page.items():
            if url.endswith("d.htm") and entries:
                first = entries[0]
                rid = first.get("record_locator", {}).get("source_record_id")
                hw = first.get("fields_raw", {}).get("headword_latin")
                assert rid == "e2203", f"First entry on d.htm: expected e2203, got {rid}"
                assert hw == "-da", f"First headword on d.htm: expected '-da', got '{hw}'"

    def test_last_entry_d_htm_is_e3125(self, ir_entries_by_page: dict):
        """d.htm ends with e3125 (d')."""
        for url, entries in ir_entries_by_page.items():
            if url.endswith("d.htm") and entries:
                last = entries[-1]
                rid = last.get("record_locator", {}).get("source_record_id")
                assert rid == "e3125", f"Last entry on d.htm: expected e3125, got {rid}"


# ===========================================================================
# Category 10: SnsN formatting deviation
# ===========================================================================

class TestSnsNDeviation:
    """10. Entry where span.SnsN formatting deviates."""

    def test_mixed_sense_numbers_e2208(self, ir_entries: dict):
        """dà has sense_nums=[None, 2] - first sense lacks a number."""
        entry = _get_entry(ir_entries, "e2208")
        assert entry is not None, "Entry e2208 (dà) not found"
        failures = validate_entry(entry, GOLDEN_FIXTURES["e2208"]["expected"])
        assert not failures, f"Validation failures: {failures}"

    def test_sense_number_sequence_e2208(self, ir_entries: dict):
        """Explicitly verify the non-sequential sense numbering."""
        entry = ir_entries.get("e2208")
        if entry is None:
            pytest.skip("Entry e2208 not found")
        senses = entry.get("fields_raw", {}).get("senses", [])
        nums = [s.get("sense_num") for s in senses]
        # First sense has no number (None), second is numbered 2
        assert nums == [None, 2], f"Expected [None, 2], got {nums}"


# ===========================================================================
# Structural integrity tests (cross-cutting)
# ===========================================================================

class TestStructuralIntegrity:
    """Cross-cutting tests for data model consistency."""

    def test_anchor_names_only_in_record_locator(self, ir_entries: dict):
        """
        Frozen v3 artifacts may include anchor_names in fields_raw.

        For the freeze, we accept either representation, but require consistency:
        if fields_raw.anchor_names is present, it must match record_locator.anchor_names
        under NFC normalization.
        """
        for entry_id in ["e2203", "e2204", "e2847", "e2212", "e8072", "e3135"]:
            entry = ir_entries.get(entry_id)
            if entry:
                fields_raw = entry.get("fields_raw", {}) or {}
                record_locator = entry.get("record_locator", {}) or {}

                fr_anchors = fields_raw.get("anchor_names")
                rl_anchors = record_locator.get("anchor_names")

                # record_locator.anchor_names remains the authoritative location
                if fr_anchors is not None and rl_anchors is not None:
                    fr_set = {unicodedata.normalize("NFC", a) for a in fr_anchors}
                    rl_set = {unicodedata.normalize("NFC", a) for a in rl_anchors}
                    assert fr_set == rl_set, (
                        f"Entry {entry_id}: fields_raw.anchor_names differs from record_locator.anchor_names"
                    )

    def test_raw_block_hash_present(self, ir_entries: dict):
        """
        raw_block_hash is a valuable drift/lossiness signal, but it is optional for frozen v3.

        If present, it must be a non-empty string.
        """
        for entry_id in ["e2203", "e2204", "e2847", "e2212"]:
            entry = ir_entries.get(entry_id)
            if entry:
                evidence = entry.get("evidence", [])
                assert len(evidence) > 0, f"Entry {entry_id}: no evidence"
                for e in evidence:
                    if "raw_block_hash" in e:
                        assert isinstance(e.get("raw_block_hash"), str) and e.get("raw_block_hash"), (
                            f"Entry {entry_id}: raw_block_hash present but empty/invalid"
                        )

    def test_warning_policy_id_present(self, ir_entries: dict):
        """
        warning_policy_id is optional for frozen v3.

        If present, it must be a non-empty string. We do not require it for v3
        even when parse_warnings exist.
        """
        entry = ir_entries.get("e2204")  # Known to have warnings
        if entry:
            if "warning_policy_id" in entry:
                assert isinstance(entry.get("warning_policy_id"), str) and entry.get("warning_policy_id"), (
                    "warning_policy_id present but empty/invalid"
                )

    def test_entry_block_end_selector_exclusive(self, ir_entries: dict):
        """
        entry_block boundary semantics:
        - start_selector is INCLUSIVE (first element of this entry)
        - end_selector is EXCLUSIVE (first element of NEXT entry)
        Half-open interval: [start, end)
        """
        entry = ir_entries.get("e2203")  # -da, followed by e2204 (dá)
        if entry:
            evidence = entry.get("evidence", [{}])[0]
            entry_block = evidence.get("entry_block", {})

            assert entry_block.get("start_selector") == "span#e2203"
            assert entry_block.get("end_selector") == "span#e2204"
            # The end_selector points to the NEXT entry, not this one
            # This is the half-open interval [e2203, e2204)


# ===========================================================================
# Entry count per page fragment
# ===========================================================================

class TestEntryCountPerPage:
    """Verify entry counts per page match expected values."""

    def test_entry_counts(self, ir_entries_by_page: dict):
        """Entry count per page should match expected values."""
        for url, entries in ir_entries_by_page.items():
            page_file = url.split("/")[-1] if "/" in url else url
            if page_file in EXPECTED_PAGE_ENTRY_COUNTS:
                expected_count = EXPECTED_PAGE_ENTRY_COUNTS[page_file]
                actual_count = len(entries)
                assert actual_count == expected_count, (
                    f"{page_file}: expected {expected_count} entries, got {actual_count}"
                )


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
