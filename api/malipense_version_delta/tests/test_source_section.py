"""Tests for Malidaba source-record classification from explicit PS metadata."""

from __future__ import annotations

import json
from pathlib import Path

import zstandard as zstd

from malipense_version_delta.source_section import (
    CLASS_BASE_LEXICAL,
    CLASS_OTHER_ADDON,
    CLASS_PERSON_NAME,
    CLASS_TOPONYM,
    CLASS_UNKNOWN,
    classify_ps_text,
    build_entry_ps_index,
    classify_current_record,
    derive_classification_evidence,
)

URL = "https://www.mali-pense.net/emk/lexicon/t.htm"


def test_classify_ps_text_toponym():
    section, marker = classify_ps_text("n prop TOP")
    assert section == CLASS_TOPONYM
    assert marker == "TOP"


def test_classify_ps_text_person_name_male():
    section, marker = classify_ps_text("n prop NOM M")
    assert section == CLASS_PERSON_NAME
    assert marker == "NOM M"


def test_classify_ps_text_person_name_female():
    section, marker = classify_ps_text("n prop NOM F")
    assert section == CLASS_PERSON_NAME
    assert marker == "NOM F"


def test_classify_ps_text_clan_addon():
    section, marker = classify_ps_text("n prop NOM CL")
    assert section == CLASS_OTHER_ADDON
    assert marker == "NOM CL"


def test_classify_ps_text_explicit_ordinary_noun():
    section, marker = classify_ps_text("n brique")
    assert section == CLASS_BASE_LEXICAL
    assert marker is None


def test_classify_ps_text_explicit_ordinary_verb():
    section, marker = classify_ps_text("v écraser")
    assert section == CLASS_BASE_LEXICAL
    assert marker is None


def test_classify_ps_text_explicit_ordinary_interjection():
    section, marker = classify_ps_text("intj hein")
    assert section == CLASS_BASE_LEXICAL
    assert marker is None


def test_classify_ps_text_missing_ps_is_unknown():
    section, marker = classify_ps_text(None)
    assert section == CLASS_UNKNOWN
    assert marker is None


def test_classify_ps_text_empty_ps_is_unknown():
    section, marker = classify_ps_text("")
    assert section == CLASS_UNKNOWN
    assert marker is None


def test_classify_ps_text_whitespace_only_ps_is_unknown():
    section, marker = classify_ps_text("   ")
    assert section == CLASS_UNKNOWN
    assert marker is None


def test_classify_ps_text_unknown_n_prop_form():
    section, marker = classify_ps_text("n prop FOO")
    assert section == CLASS_UNKNOWN
    assert marker is None


def test_classify_ps_text_unknown_non_empty_ps():
    section, marker = classify_ps_text("not-a-malidaba-pos-label")
    assert section == CLASS_UNKNOWN
    assert marker is None


def test_derive_evidence_missing_ps():
    assert (
        derive_classification_evidence(ps_text=None, section_class=CLASS_UNKNOWN)
        == "unknown:missing_ps"
    )


def test_classify_ps_text_does_not_guess_from_prophète_false_positive():
    """Word-boundary rule must not match 'n prophète' as onomastic."""
    section, marker = classify_ps_text("n prophète")
    assert section == CLASS_BASE_LEXICAL
    assert marker is None


def test_classify_ps_text_deterministic():
    assert classify_ps_text("v") == classify_ps_text("v")
    assert classify_ps_text(None) == classify_ps_text(None)


def _write_crawl(tmp_path: Path, html: str, snapshot_id: str = "snap1") -> Path:
    crawl = tmp_path / "crawl"
    payloads = crawl / "payloads"
    payloads.mkdir(parents=True)
    url = URL
    meta = {
        "snapshot_id": snapshot_id,
        "url_canonical": url,
    }
    with (crawl / "snapshots.jsonl").open("w", encoding="utf-8") as handle:
        handle.write(json.dumps(meta) + "\n")
    compressed = zstd.ZstdCompressor().compress(html.encode("utf-8"))
    (payloads / f"{snapshot_id}.html.zst").write_bytes(compressed)
    return crawl


SAMPLE_HTML = """<!DOCTYPE html><html><body>
<p class="lxP"><span id="e100" class="Lxe">Timbuktu</span></p>
<p class="lxP2"><span class="PS">n prop TOP</span><span class="GlFr">Tombouctou</span></p>
<p class="lxP"><span id="e101" class="Lxe">taba</span></p>
<p class="lxP2"><span class="PS">n</span><span class="GlFr">table</span></p>
<p class="lxP"><span id="e102" class="Lxe">empty</span></p>
<p class="lxP2"><span class="GlFr">no ps</span></p>
</body></html>
"""


def test_build_entry_ps_index_deterministic(tmp_path: Path):
    crawl = _write_crawl(tmp_path, SAMPLE_HTML)
    index1 = build_entry_ps_index(crawl)
    index2 = build_entry_ps_index(crawl)
    assert index1 == index2
    assert index1[(URL, "e100")] == "n prop TOP"
    assert index1[(URL, "e101")] == "n"
    assert (URL, "e102") not in index1


def test_classify_current_record_from_index(tmp_path: Path):
    crawl = _write_crawl(tmp_path, SAMPLE_HTML)
    ps_index = build_entry_ps_index(crawl)

    toponym = classify_current_record(
        {"record_locator": {"url_canonical": URL, "source_record_id": "e100"}},
        ps_index,
    )
    assert toponym["source_section_class"] == CLASS_TOPONYM

    lexical = classify_current_record(
        {"record_locator": {"url_canonical": URL, "source_record_id": "e101"}},
        ps_index,
    )
    assert lexical["source_section_class"] == CLASS_BASE_LEXICAL


def test_unknown_when_source_record_missing_from_index(tmp_path: Path):
    crawl = _write_crawl(tmp_path, SAMPLE_HTML)
    ps_index = build_entry_ps_index(crawl)
    result = classify_current_record(
        {"record_locator": {"url_canonical": URL, "source_record_id": "missing"}},
        ps_index,
    )
    assert result["source_section_class"] == CLASS_UNKNOWN
    assert result["source_section_ps_text"] is None


def test_unknown_when_ps_empty_in_html(tmp_path: Path):
    crawl = _write_crawl(tmp_path, SAMPLE_HTML)
    ps_index = build_entry_ps_index(crawl)
    result = classify_current_record(
        {"record_locator": {"url_canonical": URL, "source_record_id": "e102"}},
        ps_index,
    )
    assert result["source_section_class"] == CLASS_UNKNOWN
    assert result["source_section_ps_text"] is None
