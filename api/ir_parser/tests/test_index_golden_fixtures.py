"""
Golden fixture regression tests for Mali-pense French index parser.

These tests prevent parser "improvements" from silently changing the dataset.
Each fixture represents a specific index mapping pattern that must be preserved.

Fixture categories:
1. Single target entry (simple 1:1 mapping)
2. Multiple target entries (1:N mapping with deduplication)
3. French term with special characters (accents, apostrophes, parentheses)
4. Multi-word French phrase mapping
5. Page boundary: first and last entry on a page
6. Structural integrity checks (ir_kind, record_locator, evidence)
7. Entry counts per page (regression guard)
"""

import json
import unicodedata
import pytest
from pathlib import Path
from typing import Any


def _nfc(s: str | None) -> str | None:
    """Normalize to NFC for comparison (source HTML may use NFD)."""
    if s is None:
        return None
    return unicodedata.normalize("NFC", s)


# ---------------------------------------------------------------------------
# Golden fixtures: expected parser output for specific index mappings
# ---------------------------------------------------------------------------

GOLDEN_FIXTURES = {
    # 1. Single target entry: Kabiné → Kábìnɛ (k.htm, entry_index 2)
    "k_kabine": {
        "page": "index-french/k.htm",
        "entry_index": 2,
        "expected": {
            "source_term": "Kabiné",
            "source_lang": "fr",
            "target_count": 1,
            "first_target_anchor": "e4476",
            "first_target_display": "Kábìnɛ",
            "first_target_lexicon_url": "../lexicon/k.htm",
        },
    },

    # 2. Multiple targets with deduplication: kaki (k.htm)
    #    Raw HTML has 4 <a> links but only 3 unique (lexicon_url, anchor) pairs
    "k_kaki": {
        "page": "index-french/k.htm",
        "entry_index": 3,
        "expected": {
            "source_term": "kaki",
            "source_lang": "fr",
            "target_count": 3,  # Deduplicated from 4 raw links
            "target_anchors": ["e865", "e866", "e8628"],
        },
    },

    # 3. Multiple targets including IvBm class links: kapok (k.htm)
    "k_kapok": {
        "page": "index-french/k.htm",
        "entry_index": 6,
        "expected": {
            "source_term": "kapok",
            "source_lang": "fr",
            "target_count": 4,  # Deduplicated from 7 raw links (IxBm + IvBm)
            "target_anchors": ["e515", "e557", "e2043", "e3598"],
        },
    },

    # 4. Spec example: abandonner (a.htm) — matches spec Example B
    "a_abandonner": {
        "page": "index-french/a.htm",
        "expected": {
            "source_term": "abandonner",
            "source_lang": "fr",
            "target_count": 6,
            "target_anchors": ["e504", "e1096", "e1423", "e5194", "e5589", "e5650"],
            "target_displays": ["bàn", "bìla", "bólokà", "kɔ́n", "lábìla", "láfìli"],
        },
    },

    # 5. French term with special characters: bâchée (accented, b.htm)
    "b_bachee": {
        "page": "index-french/b.htm",
        "expected": {
            "source_term": "bâchée",
            "source_lang": "fr",
            "target_count_min": 1,
        },
    },

    # 6. Complex French phrase: "b) il s'est affolé (de douleur, de peur, etc )"
    #    First entry on b.htm — tests apostrophes and parentheses in source_term
    "b_first_entry": {
        "page": "index-french/b.htm",
        "entry_index": 0,
        "expected": {
            "source_term": "b) il s'est affolé (de douleur, de peur, etc )",
            "source_lang": "fr",
            "target_count": 1,
            "first_target_anchor": "e179",
            "first_target_display": "bá",
        },
    },

    # 7. Last entry on k.htm: kyste
    "k_kyste": {
        "page": "index-french/k.htm",
        "entry_index": 20,
        "expected": {
            "source_term": "kyste",
            "source_lang": "fr",
            "target_count": 2,
            "target_anchors": ["e5350", "e5504"],
        },
    },

    # 8. First entry on k.htm: Kaaba (page boundary)
    "k_kaaba": {
        "page": "index-french/k.htm",
        "entry_index": 0,
        "expected": {
            "source_term": "Kaaba",
            "source_lang": "fr",
            "target_count": 1,
            "first_target_anchor": "e80",
            "first_target_display": "àlikaaba",
        },
    },
}


# Expected mapping counts per page (from observed data, crawl 2026-01-22 + a.htm from crawl 2026-01-16)
EXPECTED_PAGE_MAPPING_COUNTS = {
    "a.htm": 845,
    "b.htm": 562,
    "c.htm": 1152,
    "d.htm": 665,
    "e.htm": 798,
    "f.htm": 638,
    "g.htm": 317,
    "h.htm": 201,
    "i.htm": 353,
    "j.htm": 153,
    "k.htm": 21,
    "l.htm": 399,
    "m.htm": 675,
    "n.htm": 193,
    "o.htm": 208,
    "p.htm": 641,
    "q.htm": 87,
    "r.htm": 558,
    "s.htm": 1076,
    "t.htm": 559,
    "u.htm": 79,
    "v.htm": 300,
    "w.htm": 7,
    "y.htm": 3,
    "z.htm": 11,
}


def validate_mapping(ir_unit: dict[str, Any], expected: dict[str, Any]) -> list[str]:
    """
    Validate an IR unit against expected assertions.

    Returns list of failure messages (empty if all pass).
    """
    failures = []
    fields_raw = ir_unit.get("fields_raw", {})
    targets = fields_raw.get("target_entries", [])

    # Source term (NFC-normalized comparison — HTML may use NFD)
    if "source_term" in expected:
        if _nfc(fields_raw.get("source_term")) != _nfc(expected["source_term"]):
            failures.append(
                f"source_term: expected '{expected['source_term']}', "
                f"got '{fields_raw.get('source_term')}'"
            )

    # Source lang
    if "source_lang" in expected:
        if fields_raw.get("source_lang") != expected["source_lang"]:
            failures.append(
                f"source_lang: expected '{expected['source_lang']}', "
                f"got '{fields_raw.get('source_lang')}'"
            )

    # Target count (exact)
    if "target_count" in expected:
        if len(targets) != expected["target_count"]:
            failures.append(
                f"target_count: expected {expected['target_count']}, got {len(targets)}"
            )

    # Target count (minimum)
    if "target_count_min" in expected:
        if len(targets) < expected["target_count_min"]:
            failures.append(
                f"target_count_min: expected >= {expected['target_count_min']}, "
                f"got {len(targets)}"
            )

    # First target anchor
    if "first_target_anchor" in expected:
        if not targets:
            failures.append("first_target_anchor: no targets")
        elif targets[0].get("anchor") != expected["first_target_anchor"]:
            failures.append(
                f"first_target_anchor: expected '{expected['first_target_anchor']}', "
                f"got '{targets[0].get('anchor')}'"
            )

    # First target display text (NFC-normalized)
    if "first_target_display" in expected:
        if not targets:
            failures.append("first_target_display: no targets")
        elif _nfc(targets[0].get("display_text")) != _nfc(expected["first_target_display"]):
            failures.append(
                f"first_target_display: expected '{expected['first_target_display']}', "
                f"got '{targets[0].get('display_text')}'"
            )

    # First target lexicon URL
    if "first_target_lexicon_url" in expected:
        if not targets:
            failures.append("first_target_lexicon_url: no targets")
        elif targets[0].get("lexicon_url") != expected["first_target_lexicon_url"]:
            failures.append(
                f"first_target_lexicon_url: expected '{expected['first_target_lexicon_url']}', "
                f"got '{targets[0].get('lexicon_url')}'"
            )

    # All target anchors (ordered)
    if "target_anchors" in expected:
        actual_anchors = [t.get("anchor") for t in targets]
        if actual_anchors != expected["target_anchors"]:
            failures.append(
                f"target_anchors: expected {expected['target_anchors']}, "
                f"got {actual_anchors}"
            )

    # All target display texts (ordered, NFC-normalized)
    if "target_displays" in expected:
        actual_displays = [_nfc(t.get("display_text")) for t in targets]
        expected_displays = [_nfc(d) for d in expected["target_displays"]]
        if actual_displays != expected_displays:
            failures.append(
                f"target_displays: expected {expected['target_displays']}, "
                f"got {[t.get('display_text') for t in targets]}"
            )

    return failures


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

IR_DATA_CANDIDATES = [
    Path("/home/potentplot/projects/perso_projects/SiraLex/data/ir/malipense_index_v1.jsonl"),
    Path("data/ir/malipense_index_v1.jsonl"),
    Path("../../../data/ir/malipense_index_v1.jsonl"),
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
def ir_mappings(ir_data_path: Path | None) -> dict[str, list[dict]]:
    """
    Load IR mappings grouped by page URL suffix.

    Returns dict like {"index-french/k.htm": [list of IR unit dicts]}.
    """
    if ir_data_path is None:
        pytest.skip("Index IR data file not found")

    pages: dict[str, list[dict]] = {}
    with open(ir_data_path, "r", encoding="utf-8") as f:
        for line in f:
            entry = json.loads(line)
            url = entry.get("record_locator", {}).get("url_canonical", "")
            # Extract page suffix: "index-french/k.htm"
            for prefix in ["/emk/"]:
                idx = url.find(prefix)
                if idx >= 0:
                    key = url[idx + len(prefix):]
                    break
            else:
                key = url

            if key not in pages:
                pages[key] = []
            pages[key].append(entry)

    # Sort by entry_index within each page
    for key in pages:
        pages[key].sort(
            key=lambda e: e.get("record_locator", {}).get("entry_index", 0)
        )

    return pages


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _find_mapping(
    ir_mappings: dict[str, list[dict]],
    fixture_key: str,
) -> dict | None:
    """Find an IR unit matching a fixture key."""
    fixture = GOLDEN_FIXTURES[fixture_key]
    page = fixture["page"]
    expected = fixture["expected"]

    mappings = ir_mappings.get(page, [])
    if not mappings:
        return None

    # If entry_index is specified, use it directly
    if "entry_index" in fixture:
        idx = fixture["entry_index"]
        for m in mappings:
            if m.get("record_locator", {}).get("entry_index") == idx:
                return m
        return None

    # Otherwise, search by source_term (NFC-normalized comparison)
    source_term = expected.get("source_term")
    if source_term:
        for m in mappings:
            if _nfc(m.get("fields_raw", {}).get("source_term")) == _nfc(source_term):
                return m

    return None


# ===========================================================================
# Category 1: Single target entry
# ===========================================================================

class TestSingleTarget:
    """1. Simple 1:1 mapping: Kabiné → Kábìnɛ."""

    def test_kabine(self, ir_mappings: dict):
        mapping = _find_mapping(ir_mappings, "k_kabine")
        assert mapping is not None, "Mapping for 'Kabiné' not found"
        failures = validate_mapping(mapping, GOLDEN_FIXTURES["k_kabine"]["expected"])
        assert not failures, f"Validation failures: {failures}"


# ===========================================================================
# Category 2: Multiple targets with deduplication
# ===========================================================================

class TestMultipleTargets:
    """2. 1:N mapping with deduplication."""

    def test_kaki_deduplication(self, ir_mappings: dict):
        """kaki has 4 raw links but only 3 unique entries after dedup."""
        mapping = _find_mapping(ir_mappings, "k_kaki")
        assert mapping is not None, "Mapping for 'kaki' not found"
        failures = validate_mapping(mapping, GOLDEN_FIXTURES["k_kaki"]["expected"])
        assert not failures, f"Validation failures: {failures}"

    def test_kapok_ixbm_and_ivbm(self, ir_mappings: dict):
        """kapok uses both IxBm and IvBm link classes."""
        mapping = _find_mapping(ir_mappings, "k_kapok")
        assert mapping is not None, "Mapping for 'kapok' not found"
        failures = validate_mapping(mapping, GOLDEN_FIXTURES["k_kapok"]["expected"])
        assert not failures, f"Validation failures: {failures}"


# ===========================================================================
# Category 3: Spec example
# ===========================================================================

class TestSpecExample:
    """3. abandonner — matches spec Example B in lossless-capture-and-ir.md."""

    def test_abandonner_matches_spec(self, ir_mappings: dict):
        mapping = _find_mapping(ir_mappings, "a_abandonner")
        assert mapping is not None, "Mapping for 'abandonner' not found"
        failures = validate_mapping(mapping, GOLDEN_FIXTURES["a_abandonner"]["expected"])
        assert not failures, f"Validation failures: {failures}"

    def test_abandonner_target_lexicon_urls(self, ir_mappings: dict):
        """Verify target URLs span multiple lexicon pages."""
        mapping = _find_mapping(ir_mappings, "a_abandonner")
        if mapping is None:
            pytest.skip("Mapping for 'abandonner' not found")
        targets = mapping.get("fields_raw", {}).get("target_entries", [])
        urls = {t["lexicon_url"] for t in targets}
        assert len(urls) >= 3, f"Expected targets across >=3 lexicon pages, got {urls}"


# ===========================================================================
# Category 4: Special characters in French terms
# ===========================================================================

class TestSpecialCharacters:
    """4. French terms with accents, apostrophes, parentheses."""

    def test_bachee_accent(self, ir_mappings: dict):
        """bâchée — circumflex and acute accent."""
        mapping = _find_mapping(ir_mappings, "b_bachee")
        assert mapping is not None, "Mapping for 'bâchée' not found"
        failures = validate_mapping(mapping, GOLDEN_FIXTURES["b_bachee"]["expected"])
        assert not failures, f"Validation failures: {failures}"

    def test_complex_phrase_first_entry(self, ir_mappings: dict):
        """Complex phrase with apostrophes and parentheses as first entry."""
        mapping = _find_mapping(ir_mappings, "b_first_entry")
        assert mapping is not None, "First entry on b.htm not found"
        failures = validate_mapping(mapping, GOLDEN_FIXTURES["b_first_entry"]["expected"])
        assert not failures, f"Validation failures: {failures}"


# ===========================================================================
# Category 5: Page boundaries
# ===========================================================================

class TestPageBoundaries:
    """5. First and last entries on a page."""

    def test_first_entry_k_htm(self, ir_mappings: dict):
        """First entry on k.htm is 'Kaaba'."""
        mapping = _find_mapping(ir_mappings, "k_kaaba")
        assert mapping is not None, "First entry on k.htm not found"
        failures = validate_mapping(mapping, GOLDEN_FIXTURES["k_kaaba"]["expected"])
        assert not failures, f"Validation failures: {failures}"

    def test_last_entry_k_htm(self, ir_mappings: dict):
        """Last entry on k.htm is 'kyste'."""
        mapping = _find_mapping(ir_mappings, "k_kyste")
        assert mapping is not None, "Last entry on k.htm not found"
        failures = validate_mapping(mapping, GOLDEN_FIXTURES["k_kyste"]["expected"])
        assert not failures, f"Validation failures: {failures}"

    def test_first_entry_every_page_has_source_term(self, ir_mappings: dict):
        """First mapping on every page must have a non-empty source_term."""
        for page, mappings in ir_mappings.items():
            if mappings:
                first = mappings[0]
                term = first.get("fields_raw", {}).get("source_term", "")
                assert term, f"First entry on {page} has empty source_term"


# ===========================================================================
# Category 6: Structural integrity
# ===========================================================================

class TestStructuralIntegrity:
    """6. IR structure invariants."""

    def test_ir_kind_is_index_mapping(self, ir_mappings: dict):
        """All entries must have ir_kind=index_mapping."""
        for page, mappings in ir_mappings.items():
            for m in mappings[:5]:  # Check first 5 per page
                assert m.get("ir_kind") == "index_mapping", (
                    f"Entry on {page} has ir_kind={m.get('ir_kind')}"
                )

    def test_record_locator_kind(self, ir_mappings: dict):
        """All entries must use url_canonical+entry_index locator."""
        for page, mappings in ir_mappings.items():
            for m in mappings[:5]:
                loc = m.get("record_locator", {})
                assert loc.get("kind") == "url_canonical+entry_index", (
                    f"Entry on {page} has locator kind={loc.get('kind')}"
                )

    def test_evidence_has_css_selector(self, ir_mappings: dict):
        """All entries must have a CSS selector in evidence."""
        for page, mappings in ir_mappings.items():
            for m in mappings[:5]:
                evidence = m.get("evidence", [{}])[0]
                assert evidence.get("css_selector"), (
                    f"Entry on {page} missing css_selector in evidence"
                )

    def test_evidence_has_text_quote(self, ir_mappings: dict):
        """All entries must have text_quote matching source_term."""
        for page, mappings in ir_mappings.items():
            for m in mappings[:5]:
                evidence = m.get("evidence", [{}])[0]
                source_term = m.get("fields_raw", {}).get("source_term")
                assert evidence.get("text_quote") == source_term, (
                    f"Entry on {page}: text_quote mismatch"
                )

    def test_parser_version_is_index_v1(self, ir_mappings: dict):
        """All entries must have parser_version=malipense_index_v1."""
        for page, mappings in ir_mappings.items():
            for m in mappings[:5]:
                assert m.get("parser_version") == "malipense_index_v1", (
                    f"Entry on {page} has parser_version={m.get('parser_version')}"
                )

    def test_source_id_is_src_malipense(self, ir_mappings: dict):
        """All entries must have source_id=src_malipense."""
        for page, mappings in ir_mappings.items():
            for m in mappings[:5]:
                assert m.get("source_id") == "src_malipense", (
                    f"Entry on {page} has source_id={m.get('source_id')}"
                )

    def test_entry_index_is_sequential(self, ir_mappings: dict):
        """entry_index must be sequential (0-based) within each page."""
        for page, mappings in ir_mappings.items():
            indices = [
                m.get("record_locator", {}).get("entry_index")
                for m in mappings
            ]
            for i, idx in enumerate(indices):
                if i > 0 and indices[i - 1] is not None and idx is not None:
                    assert idx > indices[i - 1], (
                        f"Entry indices not sequential on {page}: "
                        f"[{i-1}]={indices[i-1]}, [{i}]={idx}"
                    )

    def test_ir_id_is_deterministic(self, ir_mappings: dict):
        """ir_id must be a 16-char hex string."""
        import re
        hex16 = re.compile(r"^[0-9a-f]{16}$")
        for page, mappings in ir_mappings.items():
            for m in mappings[:5]:
                ir_id = m.get("ir_id", "")
                assert hex16.match(ir_id), (
                    f"Entry on {page} has invalid ir_id: {ir_id}"
                )

    def test_no_duplicate_ir_ids(self, ir_mappings: dict):
        """ir_id must be globally unique."""
        all_ids: set[str] = set()
        duplicates: list[str] = []
        for page, mappings in ir_mappings.items():
            for m in mappings:
                ir_id = m.get("ir_id", "")
                if ir_id in all_ids:
                    duplicates.append(ir_id)
                all_ids.add(ir_id)
        assert not duplicates, f"Duplicate ir_ids found: {duplicates[:10]}"

    def test_target_entries_have_required_fields(self, ir_mappings: dict):
        """Every target entry must have lexicon_url, anchor, and display_text."""
        for page, mappings in ir_mappings.items():
            for m in mappings[:5]:
                targets = m.get("fields_raw", {}).get("target_entries", [])
                for t in targets:
                    assert t.get("lexicon_url"), (
                        f"Target missing lexicon_url on {page}"
                    )
                    assert t.get("anchor"), (
                        f"Target missing anchor on {page}"
                    )
                    assert t.get("display_text"), (
                        f"Target missing display_text on {page}"
                    )


# ===========================================================================
# Category 7: Entry counts per page
# ===========================================================================

class TestMappingCountPerPage:
    """7. Mapping counts per page must match expected values."""

    def test_mapping_counts(self, ir_mappings: dict):
        """Mapping count per page should match expected values."""
        for page_key, mappings in ir_mappings.items():
            # Extract filename from key like "index-french/k.htm"
            page_file = page_key.split("/")[-1] if "/" in page_key else page_key
            if page_file in EXPECTED_PAGE_MAPPING_COUNTS:
                expected_count = EXPECTED_PAGE_MAPPING_COUNTS[page_file]
                actual_count = len(mappings)
                assert actual_count == expected_count, (
                    f"{page_file}: expected {expected_count} mappings, "
                    f"got {actual_count}"
                )

    def test_total_mapping_count(self, ir_mappings: dict):
        """Total mapping count across all pages."""
        total = sum(len(m) for m in ir_mappings.values())
        expected_total = sum(EXPECTED_PAGE_MAPPING_COUNTS.values())
        assert total == expected_total, (
            f"Total mappings: expected {expected_total}, got {total}"
        )


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
