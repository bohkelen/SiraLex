"""
Mali-pense lexicon page parser.

Parses /emk/lexicon/{letter}.htm pages into IR units.

HTML structure (observed 2026-01-22):
    <a name="ábadàn"></a><a name="abadan"></a>
    <p class="lxP">
        <span id="e15" class="Lxe">ábadàn</span>     <!-- Headword -->
        <span class="GlNko">ߤߓߊߘߊ߲߫</span>           <!-- N'Ko (provided) -->
        <span class="PS">adv jamais</span>           <!-- POS + gloss hint -->
        ...
    </p>
    <p class="lxP2">                                 <!-- Sense/example blocks -->
        <span class="SnsN">1 • </span>
        <div class="GlFr">jamais</div>
        <div class="GlEn">never</div>
        <span class="Exe">...</span>                 <!-- Example -->
        ...
    </p>
    <!-- More lxP2 blocks until next lxP -->

Entry boundary rule: from <p class="lxP"> containing <span id="eN"> 
                     until next <p class="lxP"> (exclusive)
"""

import json
import logging
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator

from bs4 import BeautifulSoup, Tag

# Add shared to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "shared"))

from ir.models import (
    IRUnit,
    IRKind,
    EntryBlock,
    EvidencePointer,
    RecordLocator,
    RecordLocatorKind,
    LexiconEntryFieldsRaw,
    SenseRaw,
    ExampleRaw,
    compute_ir_id,
)

logger = logging.getLogger(__name__)

PARSER_VERSION = "malipense_lexicon_v1"
SOURCE_ID = "src_malipense"

# Warning policy: versioned thresholds for generating warnings
# Changes to these thresholds change warning behavior across parser runs
WARNING_POLICY_ID = "malipense_warn_v1"
WARNING_THRESHOLDS = {
    "max_senses_before_warning": 30,
    "max_examples_before_warning": 50,
    "max_blocks_before_warning": 50,
}


def compute_block_hash(elements: list) -> str:
    """
    Compute SHA256 hash of the entry block HTML for lossiness detection.
    
    This allows detecting when parser v2 produces different extraction
    from the same evidence block.
    """
    from hashlib import sha256
    
    block_html = ""
    for el in elements:
        if hasattr(el, "decode"):
            block_html += str(el)
        else:
            block_html += str(el)
    
    return sha256(block_html.encode("utf-8")).hexdigest()[:16]


@dataclass
class ParsedEntry:
    """Intermediate structure for a parsed entry before conversion to IR."""
    entry_id: str  # e.g., "e15"
    anchor_names: list[str]
    headword_latin: str
    headword_nko: str | None
    ps_raw: str | None
    pos_hint: str | None
    senses: list[SenseRaw]
    variants_raw: list[str]
    synonyms_raw: list[str]
    etymology_raw: str | None
    literal_meaning_raw: str | None
    corpus_count: int | None
    warnings: list[str]
    raw_block_hash: str | None = None  # SHA256 hash of entry block HTML


class MalipenseLexiconParser:
    """
    Parser for Mali-pense lexicon pages.
    
    Extracts lexicon entries from /emk/lexicon/{letter}.htm pages.
    """
    
    def __init__(self, snapshot_id: str, url_canonical: str):
        """
        Initialize parser for a specific snapshot.
        
        Args:
            snapshot_id: The snapshot ID this parser is working on
            url_canonical: Canonical URL of the page
        """
        self.snapshot_id = snapshot_id
        self.url_canonical = url_canonical
        self.parser_version = PARSER_VERSION
        self.source_id = SOURCE_ID
    
    def parse_html(self, html_content: str | bytes) -> Iterator[IRUnit]:
        """
        Parse HTML content and yield IR units.
        
        Args:
            html_content: Raw HTML content (str or bytes)
        
        Yields:
            IRUnit for each entry found
        """
        if isinstance(html_content, bytes):
            html_content = html_content.decode("utf-8", errors="replace")
        
        soup = BeautifulSoup(html_content, "html.parser")
        
        # Find all entry header paragraphs (p.lxP with span.Lxe)
        entry_headers = soup.find_all("p", class_="lxP")
        
        for i, header in enumerate(entry_headers):
            # Find the entry ID span
            entry_span = header.find("span", class_="Lxe")
            if not entry_span or not entry_span.get("id"):
                continue
            
            entry_id = entry_span.get("id")
            
            # Determine entry block boundary (until next p.lxP)
            next_header = entry_headers[i + 1] if i + 1 < len(entry_headers) else None
            next_entry_id = None
            if next_header:
                next_span = next_header.find("span", class_="Lxe")
                if next_span:
                    next_entry_id = next_span.get("id")
            
            # Collect all elements for this entry
            entry_elements = [header]
            sibling = header.find_next_sibling()
            while sibling:
                if sibling.name == "p" and "lxP" in sibling.get("class", []):
                    break  # Hit next entry
                entry_elements.append(sibling)
                sibling = sibling.find_next_sibling()
            
            # Compute block hash for lossiness detection
            raw_block_hash = compute_block_hash(entry_elements)
            
            # Parse the entry
            try:
                parsed = self._parse_entry(entry_id, entry_elements, raw_block_hash)
                ir_unit = self._to_ir_unit(parsed, next_entry_id)
                yield ir_unit
            except Exception as e:
                logger.warning(f"Failed to parse entry {entry_id}: {e}")
                continue
    
    def _parse_entry(self, entry_id: str, elements: list[Tag], raw_block_hash: str) -> ParsedEntry:
        """Parse entry elements into intermediate structure."""
        warnings: list[str] = []
        
        # First element is the header (p.lxP)
        header = elements[0]
        
        # Extract anchor names (a[@name] before the header)
        anchor_names = self._extract_anchor_names(header)
        
        # Extract headword (span.Lxe)
        entry_span = header.find("span", class_="Lxe")
        headword_latin = entry_span.get_text(strip=True) if entry_span else ""
        
        # Extract N'Ko (span.GlNko in header)
        nko_span = header.find("span", class_="GlNko")
        headword_nko = nko_span.get_text(strip=True) if nko_span else None
        
        # Extract PS line (span.PS) - DON'T over-interpret
        ps_span = header.find("span", class_="PS")
        ps_raw = ps_span.get_text(strip=True) if ps_span else None
        pos_hint = self._extract_pos_hint(ps_raw) if ps_raw else None
        
        # Extract etymology (span.Mnhbw)
        etymology_span = header.find("span", class_="Mnhbw")
        etymology_raw = etymology_span.get_text(strip=True) if etymology_span else None
        
        # Extract literal meaning (span.lpLiteralMeaningEnglish or Mnhlitt)
        literal_span = header.find("span", class_="lpLiteralMeaningEnglish")
        if not literal_span:
            literal_span = header.find("span", class_="Mnhlitt")
        literal_meaning_raw = literal_span.get_text(strip=True) if literal_span else None
        
        # Extract corpus count (from the clnknt link)
        corpus_count = self._extract_corpus_count(header)
        
        # Extract variants (span.Mnhvam, Mnhrv)
        variants_raw = self._extract_variants(header)
        
        # Extract synonyms (span.Mnhsynm) from header
        synonyms_raw = self._extract_synonyms(header)
        
        # Parse sense blocks (p.lxP2)
        senses = self._parse_senses(elements[1:], warnings)
        
        # Generate warnings for edge cases
        if not headword_latin:
            warnings.append("missing_headword")
        
        if not senses:
            warnings.append("no_senses_found")
        elif all(not s.gloss_fr and not s.gloss_en and not s.gloss_ru for s in senses):
            warnings.append("no_glosses_in_any_sense")
        
        # Check for examples without example text (translation but no source)
        for i, sense in enumerate(senses):
            for j, ex in enumerate(sense.examples):
                if (ex.trans_fr or ex.trans_en) and not ex.text_latin:
                    warnings.append(f"sense_{i}_example_{j}_has_translation_but_no_text")
        
        # Use versioned thresholds for warnings
        max_senses = WARNING_THRESHOLDS["max_senses_before_warning"]
        max_examples = WARNING_THRESHOLDS["max_examples_before_warning"]
        
        if len(senses) > max_senses:
            warnings.append(f"unusually_many_senses: {len(senses)}")
        
        total_examples = sum(len(s.examples) for s in senses)
        if total_examples > max_examples:
            warnings.append(f"unusually_many_examples: {total_examples}")
        
        return ParsedEntry(
            entry_id=entry_id,
            anchor_names=anchor_names,
            headword_latin=headword_latin,
            headword_nko=headword_nko,
            ps_raw=ps_raw,
            pos_hint=pos_hint,
            senses=senses,
            variants_raw=variants_raw,
            synonyms_raw=synonyms_raw,
            etymology_raw=etymology_raw,
            literal_meaning_raw=literal_meaning_raw,
            corpus_count=corpus_count,
            warnings=warnings,
            raw_block_hash=raw_block_hash,
        )
    
    def _extract_anchor_names(self, header: Tag) -> list[str]:
        """
        Extract anchor names from <a name="..."> elements before the header.
        
        IMPORTANT: This extracts ONLY from literal <a name="..."> tags in the HTML.
        No synthesis or generation. The Mali-pense source provides multiple anchor
        variants (e.g., "dɔ́bɛ̀n", "dɔbɛn", "dòbèn") for the same entry.
        
        FIXED: Skip whitespace nodes, comments, and other non-anchor elements
        to handle cases where there are gaps between anchors and header.
        """
        from bs4 import NavigableString, Comment
        
        anchors = []
        prev = header.previous_sibling
        
        while prev is not None:
            # Skip whitespace-only text nodes and comments
            if isinstance(prev, NavigableString):
                if isinstance(prev, Comment) or not prev.strip():
                    prev = prev.previous_sibling
                    continue
                else:
                    # Non-whitespace text node - stop
                    break
            
            # Check if it's an anchor tag with name attribute
            if isinstance(prev, Tag):
                if prev.name == "a" and prev.get("name"):
                    anchors.insert(0, prev.get("name"))
                else:
                    # Hit a non-anchor tag - stop
                    break
            
            prev = prev.previous_sibling
        
        return anchors
    
    def _extract_pos_hint(self, ps_raw: str) -> str | None:
        """
        Extract POS hint from ps_raw string.
        
        Only extract if confident (first word is a known POS tag).
        """
        known_pos = {
            "n", "v", "adj", "adv", "intj", "conj", "prep", "pp", "prt",
            "pers", "prn", "dtm", "num", "cop", "pm", "ptcp", "vq", "onomat",
            "n.prop", "pers/pm", "adv.p"
        }
        
        if not ps_raw:
            return None
        
        # First word/token
        first_word = ps_raw.split()[0].lower() if ps_raw.split() else ""
        
        # Check for compound POS like "pers/pm"
        if "/" in first_word:
            return first_word
        
        if first_word in known_pos:
            return first_word
        
        return None
    
    def _extract_corpus_count(self, header: Tag) -> int | None:
        """Extract corpus link count from clnknt element."""
        clnknt = header.find("b", class_="clnknt")
        if clnknt:
            link = clnknt.find("a")
            if link:
                text = link.get_text(strip=True)
                # Format: "→ 1234"
                match = re.search(r"(\d+)", text)
                if match:
                    return int(match.group(1))
        return None
    
    def _extract_variants(self, header: Tag) -> list[str]:
        """Extract variant forms from Mnhvam and Mnhrv spans."""
        variants = []
        
        # Mnhvam contains variant links
        for vam in header.find_all("span", class_="Mnhvam"):
            for link in vam.find_all("a", class_="MXRef"):
                text = link.get_text(strip=True)
                if text and text not in variants:
                    variants.append(text)
        
        # Mnhrv is "main variant" reference
        for rv in header.find_all("span", class_="Mnhrv"):
            for link in rv.find_all("a", class_="MXRef"):
                text = link.get_text(strip=True)
                if text and text not in variants:
                    variants.append(text)
        
        return variants
    
    def _extract_synonyms(self, element: Tag) -> list[str]:
        """Extract synonyms from Mnhsynm span."""
        synonyms = []
        for synm in element.find_all("span", class_="Mnhsynm"):
            for link in synm.find_all("a"):
                text = link.get_text(strip=True)
                if text and text not in synonyms:
                    synonyms.append(text)
            # Also get non-linked text (span.LexF)
            for lexf in synm.find_all("span", class_="LexF"):
                text = lexf.get_text(strip=True)
                if text and text not in synonyms:
                    synonyms.append(text)
        return synonyms
    
    def _parse_senses(self, elements: list[Tag], warnings: list[str]) -> list[SenseRaw]:
        """
        Parse sense blocks (p.lxP2 elements).
        
        FIXED:
        - Skip PS-only blocks (they're part of speech info, not senses)
        - Better sub-entry handling (→ markers attach to current sense)
        - Generate warnings for edge cases
        """
        senses: list[SenseRaw] = []
        current_sense: SenseRaw | None = None
        block_count = 0
        
        for elem in elements:
            if not isinstance(elem, Tag):
                continue
            
            if elem.name != "p" or "lxP2" not in elem.get("class", []):
                continue
            
            block_count += 1
            
            # Check if this is a PS-only block (part of speech line with no glosses)
            ps_span = elem.find("span", class_="PS")
            has_any_gloss = (
                elem.find("div", class_="GlFr") or 
                elem.find("div", class_="GlEn") or 
                elem.find("div", class_="GlRu")
            )
            if ps_span and not elem.find("span", class_="SnsN") and not has_any_gloss:
                # This is just the PS line with no glosses - skip as sense
                continue
            
            # Check if this is a sub-entry block (→ marker without SnsN number)
            sense_num_span = elem.find("span", class_="SnsN")
            is_sub_entry_block = False
            
            if sense_num_span:
                sense_text = sense_num_span.get_text(strip=True)
                # Check if it's a → marker (sub-entry) vs numbered sense
                if sense_text.strip().startswith("→"):
                    is_sub_entry_block = True
                else:
                    # Save previous sense and start new one
                    if current_sense:
                        senses.append(current_sense)
                    
                    sense_num = self._parse_sense_number(sense_text)
                    current_sense = SenseRaw(sense_num=sense_num)
            
            if current_sense is None:
                # First block without SnsN - create sense with no number
                current_sense = SenseRaw(sense_num=None)
            
            # Extract glosses (for both senses and sub-entries)
            gloss_fr = elem.find("div", class_="GlFr")
            gloss_en = elem.find("div", class_="GlEn")
            gloss_ru = elem.find("div", class_="GlRu")
            
            # Handle sub-entry blocks
            mxref = elem.find("span", class_="MXRef")
            if is_sub_entry_block or (mxref and not sense_num_span):
                # This is a sub-entry/collocation
                sub_text = mxref.get_text(strip=True) if mxref else ""
                sub_nko = elem.find("div", class_="GlNko")
                
                current_sense.sub_entries.append({
                    "text": sub_text,
                    "nko": sub_nko.get_text(strip=True) if sub_nko else None,
                    "gloss_fr": gloss_fr.get_text(strip=True) if gloss_fr else None,
                    "gloss_en": gloss_en.get_text(strip=True) if gloss_en else None,
                    "gloss_ru": gloss_ru.get_text(strip=True) if gloss_ru else None,
                })
            else:
                # Regular sense content
                if gloss_fr:
                    text = gloss_fr.get_text(strip=True)
                    if text:
                        current_sense.gloss_fr = text
                
                if gloss_en:
                    text = gloss_en.get_text(strip=True)
                    if text:
                        current_sense.gloss_en = text
                
                if gloss_ru:
                    text = gloss_ru.get_text(strip=True)
                    if text:
                        current_sense.gloss_ru = text
                
                # Extract examples
                examples = self._parse_examples(elem)
                current_sense.examples.extend(examples)
                
                # Extract synonyms at sense level
                synonyms = self._extract_synonyms(elem)
                for s in synonyms:
                    if s not in current_sense.synonyms_raw:
                        current_sense.synonyms_raw.append(s)
        
        # Don't forget the last sense
        if current_sense:
            senses.append(current_sense)
        
        # Generate warnings for edge cases (using versioned thresholds)
        max_blocks = WARNING_THRESHOLDS["max_blocks_before_warning"]
        if block_count > max_blocks:
            warnings.append(f"entry_unusually_large: {block_count} blocks (possible boundary bleed)")
        
        # Check for empty senses - a sense is non-empty if it has:
        # - a gloss (Fr/En/Ru)
        # - examples
        # - sub-entries (MXRef)
        # - synonyms
        def is_sense_non_empty(s: SenseRaw) -> bool:
            return bool(
                s.gloss_fr or 
                s.gloss_en or 
                s.gloss_ru or
                s.examples or
                s.sub_entries or
                s.synonyms_raw
            )
        
        empty_senses = [i for i, s in enumerate(senses) if not is_sense_non_empty(s)]
        if empty_senses:
            warnings.append(f"empty_senses_at_indices: {empty_senses}")
        
        return senses
    
    def _parse_sense_number(self, text: str) -> int | None:
        """Parse sense number from "1 • " or similar."""
        match = re.search(r"(\d+)", text)
        if match:
            return int(match.group(1))
        return None
    
    def _parse_examples(self, elem: Tag) -> list[ExampleRaw]:
        """
        Parse example sentences from a sense block.
        
        FIXED: Constrain N'Ko and translation search to siblings within the
        parent p.lxP2 block, not the entire document tree.
        """
        examples = []
        
        for exe in elem.find_all("span", class_="Exe"):
            text_latin = exe.get_text(strip=True)
            if not text_latin:
                continue
            
            # Extract source attribution [Author Name]
            source_attr = None
            attr_match = re.search(r"\[([^\]]+)\]", text_latin)
            if attr_match:
                source_attr = attr_match.group(0)
                # Remove from text
                text_latin = re.sub(r"\s*\[[^\]]+\]\s*", " ", text_latin).strip()
            
            # Find corresponding N'Ko and translations by walking siblings
            # CONSTRAINED to the parent p.lxP2 block only
            text_nko = None
            trans_fr = None
            trans_en = None
            trans_ru = None
            
            # Walk siblings after the example span until next Exe or end of block
            next_elem = exe.find_next_sibling()
            while next_elem:
                if isinstance(next_elem, Tag):
                    # Stop at next example
                    if next_elem.name == "span" and "Exe" in next_elem.get("class", []):
                        break
                    # Stop at next SnsN (sense number)
                    if next_elem.name == "span" and "SnsN" in next_elem.get("class", []):
                        break
                    
                    if next_elem.name == "div":
                        classes = next_elem.get("class", [])
                        if "GlNko" in classes and text_nko is None:
                            text_nko = next_elem.get_text(strip=True)
                        elif "GlFr" in classes and trans_fr is None:
                            trans_fr = next_elem.get_text(strip=True)
                        elif "GlEn" in classes and trans_en is None:
                            trans_en = next_elem.get_text(strip=True)
                        elif "GlRu" in classes and trans_ru is None:
                            trans_ru = next_elem.get_text(strip=True)
                
                next_elem = next_elem.find_next_sibling()
            
            examples.append(ExampleRaw(
                text_latin=text_latin,
                text_nko_provided=text_nko,
                trans_fr=trans_fr,
                trans_en=trans_en,
                trans_ru=trans_ru,
                source_attribution=source_attr,
            ))
        
        return examples
    
    def _to_ir_unit(self, parsed: ParsedEntry, next_entry_id: str | None) -> IRUnit:
        """Convert parsed entry to IR unit."""
        # Create entry block
        entry_block = EntryBlock(
            start_selector=f"span#{parsed.entry_id}",
            end_selector=f"span#{next_entry_id}" if next_entry_id else None,
        )
        
        # Create fields_raw (anchor_names goes in record_locator, not here)
        fields_raw = LexiconEntryFieldsRaw(
            headword_latin=parsed.headword_latin,
            headword_nko_provided=parsed.headword_nko,
            ps_raw=parsed.ps_raw,
            pos_hint=parsed.pos_hint,
            senses=parsed.senses,
            variants_raw=parsed.variants_raw,
            synonyms_raw=parsed.synonyms_raw,
            etymology_raw=parsed.etymology_raw,
            literal_meaning_raw=parsed.literal_meaning_raw,
            corpus_count=parsed.corpus_count,
        )
        
        # Create IR unit using factory method
        return IRUnit.create_lexicon_entry(
            source_id=self.source_id,
            url_canonical=self.url_canonical,
            source_record_id=parsed.entry_id,
            parser_version=self.parser_version,
            snapshot_id=self.snapshot_id,
            entry_block=entry_block,
            fields_raw=fields_raw,
            anchor_names=parsed.anchor_names,
            text_quote=parsed.headword_latin,
            parse_warnings=parsed.warnings,
            warning_policy_id=WARNING_POLICY_ID,
            raw_block_hash=parsed.raw_block_hash,
        )


def parse_snapshot_file(
    snapshot_path: Path,
    snapshots_jsonl_path: Path,
) -> Iterator[IRUnit]:
    """
    Parse a snapshot file and yield IR units.
    
    Args:
        snapshot_path: Path to the .html.zst payload file
        snapshots_jsonl_path: Path to snapshots.jsonl for metadata lookup
    
    Yields:
        IRUnit for each entry
    """
    import zstandard as zstd
    
    # Read snapshot metadata
    # Filename is like "20f263ef15dc6ae1.html.zst", need to strip both extensions
    snapshot_id = snapshot_path.name.replace(".html.zst", "")
    metadata = None
    
    with open(snapshots_jsonl_path, "r", encoding="utf-8") as f:
        for line in f:
            record = json.loads(line)
            if record.get("snapshot_id") == snapshot_id:
                metadata = record
                break
    
    if not metadata:
        raise ValueError(f"Snapshot {snapshot_id} not found in {snapshots_jsonl_path}")
    
    url_canonical = metadata["url_canonical"]
    
    # Decompress and parse
    dctx = zstd.ZstdDecompressor()
    with open(snapshot_path, "rb") as f:
        html_content = dctx.decompress(f.read())
    
    parser = MalipenseLexiconParser(snapshot_id, url_canonical)
    yield from parser.parse_html(html_content)


if __name__ == "__main__":
    # Quick test
    import sys
    
    if len(sys.argv) < 3:
        print("Usage: python malipense_lexicon.py <payload.html.zst> <snapshots.jsonl>")
        sys.exit(1)
    
    logging.basicConfig(level=logging.INFO)
    
    snapshot_path = Path(sys.argv[1])
    snapshots_jsonl = Path(sys.argv[2])
    
    count = 0
    for ir_unit in parse_snapshot_file(snapshot_path, snapshots_jsonl):
        count += 1
        if count <= 3:
            print(json.dumps(ir_unit.to_dict(), indent=2, ensure_ascii=False))
    
    print(f"\nTotal entries parsed: {count}")
