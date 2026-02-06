"""
Mali-pense French index page parser.

Parses /emk/index-french/{letter}.htm pages into IR units of kind=index_mapping.

HTML structure (observed 2026-02-06):
    <table>
    <tr>
     <td><span class="IxFr"><a name="abandonner"></a>abandonner</span></td>
     <td>
        <a class="IxBm" href="../lexicon/b.htm#e504">bàn</a>,
        <a class="IxBm" href="../lexicon/b.htm#e1096">bìla</a>
     </td>
    </tr>
    ...
    </table>

Entry boundary rule: each <tr> is one index mapping.
    - First <td> contains <span class="IxFr"> with the French source term
    - Second <td> contains <a class="IxBm"> or <a class="IvBm"> links to lexicon entries
    - Links follow the pattern ../lexicon/{letter}.htm#{entry_id}
"""

import json
import logging
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterator

from bs4 import BeautifulSoup, Tag

# Add shared to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "shared"))

from ir.models import (
    IRUnit,
    IRKind,
    EvidencePointer,
    RecordLocator,
    RecordLocatorKind,
    IndexMappingFieldsRaw,
    TargetEntry,
    compute_ir_id,
)

logger = logging.getLogger(__name__)

PARSER_VERSION = "malipense_index_v1"
SOURCE_ID = "src_malipense"


@dataclass
class ParsedMapping:
    """Intermediate structure for a parsed index mapping before conversion to IR."""
    entry_index: int  # 0-based position in DOM order
    source_term: str  # French headword
    source_lang: str  # Always "fr" for index-french pages
    target_entries: list[TargetEntry]
    css_selector: str  # CSS selector for the row
    warnings: list[str] = field(default_factory=list)


class MalipenseIndexParser:
    """
    Parser for Mali-pense French index pages.

    Extracts index mappings from /emk/index-french/{letter}.htm pages.
    Each mapping represents a French term pointing to one or more Maninka
    lexicon entry IDs.
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
            IRUnit for each index mapping found
        """
        if isinstance(html_content, bytes):
            html_content = html_content.decode("utf-8", errors="replace")

        soup = BeautifulSoup(html_content, "html.parser")

        # Find all table rows in the index
        # The index table is inside <div id="basfr">
        container = soup.find("div", id="basfr")
        if not container:
            logger.warning(f"No div#basfr found in {self.url_canonical}")
            return

        table = container.find("table")
        if not table:
            logger.warning(f"No table found in div#basfr at {self.url_canonical}")
            return

        rows = table.find_all("tr")

        for i, row in enumerate(rows):
            try:
                parsed = self._parse_row(row, i)
                if parsed is None:
                    continue
                ir_unit = self._to_ir_unit(parsed)
                yield ir_unit
            except Exception as e:
                logger.warning(f"Failed to parse row {i} in {self.url_canonical}: {e}")
                continue

    def _parse_row(self, row: Tag, entry_index: int) -> ParsedMapping | None:
        """
        Parse a single table row into a mapping.

        Args:
            row: The <tr> element
            entry_index: 0-based index of this row in the table

        Returns:
            ParsedMapping or None if the row is not a valid mapping
        """
        warnings: list[str] = []

        tds = row.find_all("td")
        if len(tds) < 2:
            return None

        # --- Extract source term from first <td> ---
        td_fr = tds[0]
        ix_fr_span = td_fr.find("span", class_="IxFr")
        if not ix_fr_span:
            warnings.append("no_IxFr_span")
            return None

        source_term = ix_fr_span.get_text(strip=True)
        if not source_term:
            warnings.append("empty_source_term")
            return None

        # --- Extract target entries from second <td> ---
        td_targets = tds[1]
        target_entries = self._parse_target_links(td_targets, warnings)

        if not target_entries:
            warnings.append("no_target_entries")

        # Build CSS selector for evidence
        css_selector = f"tr:nth-child({entry_index + 1})"

        return ParsedMapping(
            entry_index=entry_index,
            source_term=source_term,
            source_lang="fr",
            target_entries=target_entries,
            css_selector=css_selector,
            warnings=warnings,
        )

    def _parse_target_links(
        self, td: Tag, warnings: list[str]
    ) -> list[TargetEntry]:
        """
        Extract target entry links from the second <td>.

        Links have class IxBm (main), IvBm (variant), or IeBm (English-gloss
        variant). All point to lexicon entries via
        href="../lexicon/{letter}.htm#{entry_id}".

        Returns deduplicated list of TargetEntry (by lexicon_url + anchor pair).
        """
        entries: list[TargetEntry] = []
        seen: set[tuple[str, str]] = set()

        # Accept IxBm, IvBm, and IeBm link classes
        links = td.find_all("a", class_=re.compile(r"^I[xve]Bm$"))

        for link in links:
            href = link.get("href", "")
            display_text = link.get_text(strip=True)

            if not href or not display_text:
                continue

            # Parse href: ../lexicon/b.htm#e504
            lexicon_url, anchor = self._parse_href(href)
            if not lexicon_url or not anchor:
                warnings.append(f"unparseable_href: {href}")
                continue

            # Deduplicate by (lexicon_url, anchor) — the source often
            # has the same link repeated multiple times in a single row
            key = (lexicon_url, anchor)
            if key in seen:
                continue
            seen.add(key)

            entries.append(TargetEntry(
                lexicon_url=lexicon_url,
                anchor=anchor,
                display_text=display_text,
            ))

        return entries

    @staticmethod
    def _parse_href(href: str) -> tuple[str, str]:
        """
        Parse an href like ../lexicon/b.htm#e504 into (lexicon_url, anchor).

        Returns:
            (lexicon_url, anchor) tuple, e.g. ("../lexicon/b.htm", "e504")
            Returns ("", "") if parsing fails.
        """
        if "#" not in href:
            return ("", "")

        parts = href.split("#", 1)
        lexicon_url = parts[0]
        anchor = parts[1]

        if not anchor:
            return ("", "")

        return (lexicon_url, anchor)

    def _to_ir_unit(self, parsed: ParsedMapping) -> IRUnit:
        """Convert parsed mapping to IR unit."""
        fields_raw = IndexMappingFieldsRaw(
            source_term=parsed.source_term,
            source_lang=parsed.source_lang,
            target_entries=parsed.target_entries,
        )

        return IRUnit.create_index_mapping(
            source_id=self.source_id,
            url_canonical=self.url_canonical,
            entry_index=parsed.entry_index,
            parser_version=self.parser_version,
            snapshot_id=self.snapshot_id,
            css_selector=parsed.css_selector,
            fields_raw=fields_raw,
            text_quote=parsed.source_term,
            parse_warnings=parsed.warnings if parsed.warnings else None,
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
        IRUnit for each index mapping
    """
    import zstandard as zstd

    # Read snapshot metadata
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

    parser = MalipenseIndexParser(snapshot_id, url_canonical)
    yield from parser.parse_html(html_content)


if __name__ == "__main__":
    # Quick test
    import sys

    if len(sys.argv) < 3:
        print("Usage: python malipense_index.py <payload.html.zst> <snapshots.jsonl>")
        sys.exit(1)

    logging.basicConfig(level=logging.INFO)

    snapshot_path = Path(sys.argv[1])
    snapshots_jsonl = Path(sys.argv[2])

    count = 0
    for ir_unit in parse_snapshot_file(snapshot_path, snapshots_jsonl):
        count += 1
        if count <= 5:
            print(json.dumps(ir_unit.to_dict(), indent=2, ensure_ascii=False))

    print(f"\nTotal mappings parsed: {count}")
