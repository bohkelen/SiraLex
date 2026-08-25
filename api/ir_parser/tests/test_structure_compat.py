"""Structural HTML layout fixtures for MalipenseLexiconParser compatibility."""

from __future__ import annotations

from ir_parser.malipense_lexicon import MalipenseLexiconParser


URL = "https://www.mali-pense.net/emk/lexicon/a.htm"


def _parse(html: str):
    parser = MalipenseLexiconParser(snapshot_id="testsnap", url_canonical=URL)
    return list(parser.parse_html(html))


def _sense_proj(unit) -> list[dict]:
    senses = unit.fields_raw.senses or []
    return [
        {
            "sense_num": s.sense_num,
            "gloss_fr": s.gloss_fr,
            "gloss_en": s.gloss_en,
            "gloss_ru": s.gloss_ru,
            "examples": [
                {
                    "text_latin": e.text_latin,
                    "trans_fr": e.trans_fr,
                }
                for e in (s.examples or [])
            ],
            "sub_entries": s.sub_entries or [],
        }
        for s in senses
    ]


SIBLING_ONE_SENSE = """<!DOCTYPE html><html><body>
<a name="á"></a>
<p class="lxP"><span id="e0" class="Lxe">á</span><span class="GlNko">ߊ߫</span></p>
<p class="lxP2"> <span class="PS">intj hein</span><div class="GlFr">hein</div><div class="GlEn">huh?</div><div class="GlRu">э-э!</div></p>
</body></html>
"""

NESTED_ONE_SENSE = """<!DOCTYPE html><html><body>
<a name="á"></a>
<p class="lxP"><span id="e0" class="Lxe">á</span><span class="GlNko">ߊ߫</span>
<p class="lxP2"> <span class="PS">intj hein</span><span class="GlFr">hein</span><span class="GlEn">huh?</span><span class="GlRu">э-э!</span></p></p>
</body></html>
"""

SIBLING_MULTI = """<!DOCTYPE html><html><body>
<a name="ba"></a>
<p class="lxP"><span id="e1" class="Lxe">bá</span><span class="GlNko">ߓߊ</span></p>
<p class="lxP2"><span class="SnsN">1 • </span><div class="GlFr">mère</div><div class="GlEn">mother</div></p>
<p class="lxP2"><span class="SnsN">2 • </span><div class="GlFr">fleuve</div><div class="GlEn">river</div>
<span class="Exe">Bá kà táa.</span><div class="GlFr">La mère est partie.</div></p>
<a name="bi"></a>
<p class="lxP"><span id="e2" class="Lxe">bí</span><span class="GlNko">ߓߌ</span></p>
<p class="lxP2"><div class="GlFr">aujourd'hui</div><div class="GlEn">today</div></p>
</body></html>
"""

NESTED_MULTI = """<!DOCTYPE html><html><body>
<a name="ba"></a>
<p class="lxP"><span id="e1" class="Lxe">bá</span><span class="GlNko">ߓߊ</span>
<p class="lxP2"><span class="SnsN">1 • </span><span class="GlFr">mère</span><span class="GlEn">mother</span></p>
<p class="lxP2"><span class="SnsN">2 • </span><span class="GlFr">fleuve</span><span class="GlEn">river</span>
<span class="Exe">Bá kà táa.</span><span class="GlFr">La mère est partie.</span></p></p>
<a name="bi"></a>
<p class="lxP"><span id="e2" class="Lxe">bí</span><span class="GlNko">ߓߌ</span>
<p class="lxP2"><span class="GlFr">aujourd'hui</span><span class="GlEn">today</span></p></p>
</body></html>
"""

MIXED_NO_DUP = """<!DOCTYPE html><html><body>
<a name="ko"></a>
<p class="lxP"><span id="e3" class="Lxe">kó</span><span class="GlNko">ߞߏ</span>
<p class="lxP2"><span class="GlFr">affaire</span><span class="GlEn">matter</span></p></p>
<p class="lxP2"><span class="GlFr">SHOULD_NOT_ATTACH_TO_PREV_IF_OWNED_ELSEWHERE</span></div>
</body></html>
"""

# Correct mixed: nested sense + additional sibling sense for same entry
MIXED_NESTED_PLUS_SIBLING = """<!DOCTYPE html><html><body>
<a name="ko"></a>
<p class="lxP"><span id="e3" class="Lxe">kó</span><span class="GlNko">ߞߏ</span>
<p class="lxP2"><span class="SnsN">1 • </span><span class="GlFr">affaire</span></p></p>
<p class="lxP2"><span class="SnsN">2 • </span><div class="GlFr">chose</div></p>
<a name="next"></a>
<p class="lxP"><span id="e4" class="Lxe">kún</span></p>
<p class="lxP2"><div class="GlFr">tête</div></p>
</body></html>
"""

MALFORMED_EMPTY = """<!DOCTYPE html><html><body>
<p class="lxP"><span id="e9" class="Lxe">zz</span>
<p class="lxP2"> <span class="PS">n</span></p></p>
</body></html>
"""


def test_historical_sibling_layout_parses():
    units = _parse(SIBLING_ONE_SENSE)
    assert len(units) == 1
    assert units[0].fields_raw.headword_latin == "á"
    assert units[0].fields_raw.headword_nko_provided == "ߊ߫"
    assert len(units[0].fields_raw.senses) == 1
    assert units[0].fields_raw.senses[0].gloss_fr == "hein"
    assert units[0].fields_raw.senses[0].gloss_en == "huh?"


def test_current_nested_layout_parses():
    units = _parse(NESTED_ONE_SENSE)
    assert len(units) == 1
    assert units[0].fields_raw.headword_latin == "á"
    assert len(units[0].fields_raw.senses) == 1
    assert units[0].fields_raw.senses[0].gloss_fr == "hein"
    assert units[0].fields_raw.senses[0].gloss_en == "huh?"


def test_sibling_and_nested_equivalent_semantics():
    sib = _parse(SIBLING_ONE_SENSE)[0]
    nest = _parse(NESTED_ONE_SENSE)[0]
    assert _sense_proj(sib) == _sense_proj(nest)
    assert sib.fields_raw.headword_latin == nest.fields_raw.headword_latin
    assert sib.fields_raw.headword_nko_provided == nest.fields_raw.headword_nko_provided


def test_multiple_nested_senses_and_examples():
    units = _parse(NESTED_MULTI)
    assert len(units) == 2
    ba = units[0]
    assert ba.record_locator.source_record_id == "e1"
    assert len(ba.fields_raw.senses) == 2
    assert ba.fields_raw.senses[0].gloss_fr == "mère"
    assert ba.fields_raw.senses[1].gloss_fr == "fleuve"
    assert ba.fields_raw.senses[1].examples
    assert ba.fields_raw.senses[1].examples[0].text_latin.startswith("Bá")
    assert ba.fields_raw.senses[1].examples[0].trans_fr == "La mère est partie."
    assert units[1].record_locator.source_record_id == "e2"
    assert units[1].fields_raw.senses[0].gloss_fr == "aujourd'hui"


def test_mixed_nested_plus_sibling_no_double_count_and_boundary():
    units = _parse(MIXED_NESTED_PLUS_SIBLING)
    assert len(units) == 2
    ko = units[0]
    assert [s.gloss_fr for s in ko.fields_raw.senses] == ["affaire", "chose"]
    # next entry must not steal previous senses
    assert units[1].fields_raw.headword_latin == "kún"
    assert [s.gloss_fr for s in units[1].fields_raw.senses] == ["tête"]


def test_malformed_ps_only_warns_explicitly():
    units = _parse(MALFORMED_EMPTY)
    assert len(units) == 1
    warns = units[0].parse_warnings or []
    assert "no_senses_found" in warns
    assert any(str(w).startswith("structural_lxp2_present_but_no_senses") for w in warns)
