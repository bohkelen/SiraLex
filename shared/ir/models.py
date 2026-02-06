"""
IR (Intermediate Representation) data models.

Implements shared/specs/lossless-capture-and-ir.md v1.1.

Key design decisions:
- ir_id is deterministic and collision-safe (includes url_canonical)
- No retrieved_at or source_name on IR (join via snapshot/source registry)
- ir_kind discriminates document types (lexicon_entry vs index_mapping)
- Evidence covers full entry block, not just headword
- fields_raw preserves literal extraction (no over-interpretation)
- "provided" vs "generated" forms are distinguished
"""

from dataclasses import dataclass, field
from enum import Enum
from hashlib import sha256
from typing import Any


class IRKind(str, Enum):
    """Document type discriminator for IR units."""
    
    LEXICON_ENTRY = "lexicon_entry"  # Dictionary entry (headword + senses + examples)
    INDEX_MAPPING = "index_mapping"  # French/English index → Maninka entry refs
    METADATA_PAGE = "metadata_page"  # Landing/info pages


class RecordLocatorKind(str, Enum):
    """Record locator kind per spec."""
    
    SOURCE_RECORD_ID = "source_record_id"
    URL_CANONICAL_ENTRY_INDEX = "url_canonical+entry_index"
    CSS_SELECTOR_TEXT_QUOTE = "css_selector+text_quote"
    PAGE_BBOX_BLOCK_INDEX = "page+bbox+block_index"


@dataclass
class EntryBlock:
    """
    Defines the DOM range for an entry block.
    
    Used in evidence pointers to cover the full entry, not just the headword.
    """
    start_selector: str  # e.g., "span#e15"
    end_selector: str | None = None  # e.g., "span#e16" (next entry, exclusive)
    block_selectors: list[str] | None = None  # Alternative: explicit list of selectors


@dataclass
class EvidencePointer:
    """
    Fragment pointer to source evidence.
    
    Must cover the full entry block, not just the headword element.
    """
    source_id: str
    snapshot_id: str
    
    # For HTML entries: block range
    entry_block: EntryBlock | None = None
    
    # Simple selectors (for non-block evidence)
    css_selector: str | None = None
    xpath: str | None = None
    
    # Anchor text for verification
    text_quote: str | None = None
    
    # For PDF/scans
    page_number: int | None = None
    bbox: dict[str, float] | None = None  # {x, y, w, h}
    rotation_degrees: int | None = None
    
    # Hash of the fragment content
    fragment_hash: str | None = None
    fragment_representation_kind: str | None = None
    
    # Raw block hash for lossiness detection (parser drift detection)
    raw_block_hash: str | None = None

    def to_dict(self) -> dict[str, Any]:
        """Convert to JSON-serializable dict, omitting None values."""
        result: dict[str, Any] = {
            "source_id": self.source_id,
            "snapshot_id": self.snapshot_id,
        }
        if self.entry_block:
            result["entry_block"] = {
                "start_selector": self.entry_block.start_selector,
            }
            if self.entry_block.end_selector:
                result["entry_block"]["end_selector"] = self.entry_block.end_selector
            if self.entry_block.block_selectors:
                result["entry_block"]["block_selectors"] = self.entry_block.block_selectors
        if self.css_selector:
            result["css_selector"] = self.css_selector
        if self.xpath:
            result["xpath"] = self.xpath
        if self.text_quote:
            result["text_quote"] = self.text_quote
        if self.page_number is not None:
            result["page_number"] = self.page_number
        if self.bbox:
            result["bbox"] = self.bbox
        if self.rotation_degrees is not None:
            result["rotation_degrees"] = self.rotation_degrees
        if self.fragment_hash:
            result["fragment_hash"] = self.fragment_hash
        if self.fragment_representation_kind:
            result["fragment_representation_kind"] = self.fragment_representation_kind
        if self.raw_block_hash:
            result["raw_block_hash"] = self.raw_block_hash
        return result


@dataclass
class RecordLocator:
    """
    Identity hint for a source record within a snapshot.
    
    url_canonical is REQUIRED on all kinds for global uniqueness
    (source IDs like "e15" are page-scoped).
    """
    kind: RecordLocatorKind
    url_canonical: str  # REQUIRED for global uniqueness
    
    # For kind=source_record_id
    source_record_id: str | None = None
    anchor_names: list[str] | None = None  # Human-friendly anchors
    
    # For kind=url_canonical+entry_index
    entry_index: int | None = None
    
    # For kind=css_selector+text_quote
    css_selector: str | None = None
    text_quote: str | None = None
    
    # For kind=page+bbox+block_index
    page_number: int | None = None
    bbox: dict[str, float] | None = None
    block_index: int | None = None

    def to_dict(self) -> dict[str, Any]:
        """Convert to JSON-serializable dict."""
        result: dict[str, Any] = {
            "kind": self.kind.value,
            "url_canonical": self.url_canonical,
        }
        if self.source_record_id:
            result["source_record_id"] = self.source_record_id
        if self.anchor_names:
            result["anchor_names"] = self.anchor_names
        if self.entry_index is not None:
            result["entry_index"] = self.entry_index
        if self.css_selector:
            result["css_selector"] = self.css_selector
        if self.text_quote:
            result["text_quote"] = self.text_quote
        if self.page_number is not None:
            result["page_number"] = self.page_number
        if self.bbox:
            result["bbox"] = self.bbox
        if self.block_index is not None:
            result["block_index"] = self.block_index
        return result


# --- fields_raw schemas by ir_kind ---

@dataclass
class ExampleRaw:
    """Raw example sentence with translations."""
    text_latin: str
    text_nko_provided: str | None = None  # From source (not generated)
    trans_fr: str | None = None
    trans_en: str | None = None
    trans_ru: str | None = None
    source_attribution: str | None = None  # e.g., "[Diane Mamadi]"

    def to_dict(self) -> dict[str, Any]:
        result: dict[str, Any] = {"text_latin": self.text_latin}
        if self.text_nko_provided:
            result["text_nko_provided"] = self.text_nko_provided
        if self.trans_fr:
            result["trans_fr"] = self.trans_fr
        if self.trans_en:
            result["trans_en"] = self.trans_en
        if self.trans_ru:
            result["trans_ru"] = self.trans_ru
        if self.source_attribution:
            result["source_attribution"] = self.source_attribution
        return result


@dataclass
class SenseRaw:
    """Raw sense/meaning with glosses and examples."""
    sense_num: int | None = None  # 1, 2, 3... or None if not numbered
    gloss_fr: str | None = None
    gloss_en: str | None = None
    gloss_ru: str | None = None
    examples: list[ExampleRaw] = field(default_factory=list)
    usage_note: str | None = None
    synonyms_raw: list[str] = field(default_factory=list)
    
    # Sub-entries (→ markers in Mali-pense)
    sub_entries: list[dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        result: dict[str, Any] = {}
        if self.sense_num is not None:
            result["sense_num"] = self.sense_num
        if self.gloss_fr:
            result["gloss_fr"] = self.gloss_fr
        if self.gloss_en:
            result["gloss_en"] = self.gloss_en
        if self.gloss_ru:
            result["gloss_ru"] = self.gloss_ru
        if self.examples:
            result["examples"] = [e.to_dict() for e in self.examples]
        if self.usage_note:
            result["usage_note"] = self.usage_note
        if self.synonyms_raw:
            result["synonyms_raw"] = self.synonyms_raw
        if self.sub_entries:
            result["sub_entries"] = self.sub_entries
        return result


@dataclass
class LexiconEntryFieldsRaw:
    """
    fields_raw schema for ir_kind=lexicon_entry.
    
    Preserves literal extraction - no over-interpretation.
    
    Note: anchor_names belongs in record_locator, not here.
    fields_raw contains only content fields, not identity/locator fields.
    """
    headword_latin: str
    headword_nko_provided: str | None = None  # From source, not generated
    
    # POS: store literally, don't over-interpret
    ps_raw: str | None = None  # Exactly as found (e.g., "adv jamais")
    pos_hint: str | None = None  # Optional, only if parser is confident
    
    # Senses
    senses: list[SenseRaw] = field(default_factory=list)
    
    # Variants and cross-references
    variants_raw: list[str] = field(default_factory=list)
    synonyms_raw: list[str] = field(default_factory=list)
    
    # Other raw fields
    etymology_raw: str | None = None
    literal_meaning_raw: str | None = None
    corpus_count: int | None = None  # Link count to corpus

    def to_dict(self) -> dict[str, Any]:
        result: dict[str, Any] = {
            "headword_latin": self.headword_latin,
        }
        if self.headword_nko_provided:
            result["headword_nko_provided"] = self.headword_nko_provided
        if self.ps_raw:
            result["ps_raw"] = self.ps_raw
        if self.pos_hint:
            result["pos_hint"] = self.pos_hint
        if self.senses:
            result["senses"] = [s.to_dict() for s in self.senses]
        if self.variants_raw:
            result["variants_raw"] = self.variants_raw
        if self.synonyms_raw:
            result["synonyms_raw"] = self.synonyms_raw
        if self.etymology_raw:
            result["etymology_raw"] = self.etymology_raw
        if self.literal_meaning_raw:
            result["literal_meaning_raw"] = self.literal_meaning_raw
        if self.corpus_count is not None:
            result["corpus_count"] = self.corpus_count
        return result


@dataclass
class TargetEntry:
    """A target entry reference in an index mapping."""
    lexicon_url: str  # Relative URL to lexicon page
    anchor: str  # Anchor ID (e.g., "e504")
    display_text: str  # Display text (e.g., "bàn")

    def to_dict(self) -> dict[str, Any]:
        return {
            "lexicon_url": self.lexicon_url,
            "anchor": self.anchor,
            "display_text": self.display_text,
        }


@dataclass
class IndexMappingFieldsRaw:
    """
    fields_raw schema for ir_kind=index_mapping.
    
    Represents a French/English/etc. term mapping to Maninka entries.
    """
    source_term: str  # e.g., "abandonner"
    source_lang: str  # e.g., "fr", "en", "ru"
    target_entries: list[TargetEntry] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "source_term": self.source_term,
            "source_lang": self.source_lang,
            "target_entries": [t.to_dict() for t in self.target_entries],
        }


def compute_ir_id(
    source_id: str,
    url_canonical: str,
    record_id_component: str,
    parser_version: str,
) -> str:
    """
    Compute ir_id per spec (collision-safe, deterministic).
    
    ir_id = sha256(source_id + "|" + url_canonical + "|" + record_id_component + "|" + parser_version)[:16]
    
    Args:
        source_id: From Source Registry (e.g., "src_malipense")
        url_canonical: Page URL (required for global uniqueness)
        record_id_component: Page-scoped ID (e.g., "e15") or stringified entry_index
        parser_version: Parser version string
    
    Returns:
        16-character hex string
    """
    data = f"{source_id}|{url_canonical}|{record_id_component}|{parser_version}"
    return sha256(data.encode("utf-8")).hexdigest()[:16]


@dataclass
class IRUnit:
    """
    A single IR unit representing one source record.
    
    Implements shared/specs/lossless-capture-and-ir.md v1.1.
    """
    ir_id: str
    ir_kind: IRKind
    source_id: str
    parser_version: str
    evidence: list[EvidencePointer]
    record_locator: RecordLocator
    fields_raw: LexiconEntryFieldsRaw | IndexMappingFieldsRaw | dict[str, Any]
    parse_warnings: list[str] = field(default_factory=list)
    
    # Warning policy version (thresholds that generated the warnings)
    warning_policy_id: str | None = None
    
    # OCR-specific (only for OCR-derived IR)
    ocr_engine: str | None = None
    ocr_version: str | None = None

    def to_dict(self) -> dict[str, Any]:
        """Convert to JSON-serializable dict."""
        result: dict[str, Any] = {
            "ir_id": self.ir_id,
            "ir_kind": self.ir_kind.value,
            "source_id": self.source_id,
            "parser_version": self.parser_version,
            "evidence": [e.to_dict() for e in self.evidence],
            "record_locator": self.record_locator.to_dict(),
        }
        
        # Handle fields_raw based on type
        if hasattr(self.fields_raw, "to_dict"):
            result["fields_raw"] = self.fields_raw.to_dict()
        else:
            result["fields_raw"] = self.fields_raw
        
        if self.parse_warnings:
            result["parse_warnings"] = self.parse_warnings
        if self.warning_policy_id:
            result["warning_policy_id"] = self.warning_policy_id
        if self.ocr_engine:
            result["ocr_engine"] = self.ocr_engine
        if self.ocr_version:
            result["ocr_version"] = self.ocr_version
        
        return result

    @classmethod
    def create_lexicon_entry(
        cls,
        source_id: str,
        url_canonical: str,
        source_record_id: str,
        parser_version: str,
        snapshot_id: str,
        entry_block: EntryBlock,
        fields_raw: LexiconEntryFieldsRaw,
        anchor_names: list[str] | None = None,
        text_quote: str | None = None,
        parse_warnings: list[str] | None = None,
        warning_policy_id: str | None = None,
        raw_block_hash: str | None = None,
    ) -> "IRUnit":
        """
        Factory method to create a lexicon entry IR unit with proper ir_id computation.
        """
        ir_id = compute_ir_id(source_id, url_canonical, source_record_id, parser_version)
        
        evidence = EvidencePointer(
            source_id=source_id,
            snapshot_id=snapshot_id,
            entry_block=entry_block,
            text_quote=text_quote,
            raw_block_hash=raw_block_hash,
        )
        
        record_locator = RecordLocator(
            kind=RecordLocatorKind.SOURCE_RECORD_ID,
            url_canonical=url_canonical,
            source_record_id=source_record_id,
            anchor_names=anchor_names,
        )
        
        return cls(
            ir_id=ir_id,
            ir_kind=IRKind.LEXICON_ENTRY,
            source_id=source_id,
            parser_version=parser_version,
            evidence=[evidence],
            record_locator=record_locator,
            fields_raw=fields_raw,
            parse_warnings=parse_warnings or [],
            warning_policy_id=warning_policy_id,
        )

    @classmethod
    def create_index_mapping(
        cls,
        source_id: str,
        url_canonical: str,
        entry_index: int,
        parser_version: str,
        snapshot_id: str,
        css_selector: str,
        fields_raw: IndexMappingFieldsRaw,
        text_quote: str | None = None,
        parse_warnings: list[str] | None = None,
    ) -> "IRUnit":
        """
        Factory method to create an index mapping IR unit.
        """
        ir_id = compute_ir_id(source_id, url_canonical, str(entry_index), parser_version)
        
        evidence = EvidencePointer(
            source_id=source_id,
            snapshot_id=snapshot_id,
            css_selector=css_selector,
            text_quote=text_quote,
        )
        
        record_locator = RecordLocator(
            kind=RecordLocatorKind.URL_CANONICAL_ENTRY_INDEX,
            url_canonical=url_canonical,
            entry_index=entry_index,
        )
        
        return cls(
            ir_id=ir_id,
            ir_kind=IRKind.INDEX_MAPPING,
            source_id=source_id,
            parser_version=parser_version,
            evidence=[evidence],
            record_locator=record_locator,
            fields_raw=fields_raw,
            parse_warnings=parse_warnings or [],
        )
