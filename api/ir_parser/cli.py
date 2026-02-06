"""
CLI for IR parser.

Processes snapshots and outputs IR JSONL.
"""

import argparse
import json
import logging
import sys
from pathlib import Path

import zstandard as zstd

# Add shared to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "shared"))

from .malipense_lexicon import MalipenseLexiconParser, PARSER_VERSION as LEXICON_PARSER_VERSION
from .malipense_index import MalipenseIndexParser, PARSER_VERSION as INDEX_PARSER_VERSION

logger = logging.getLogger(__name__)


def load_snapshots_metadata(jsonl_path: Path) -> dict[str, dict]:
    """Load snapshot metadata from snapshots.jsonl."""
    metadata = {}
    with open(jsonl_path, "r", encoding="utf-8") as f:
        for line in f:
            record = json.loads(line)
            snapshot_id = record.get("snapshot_id")
            if snapshot_id:
                metadata[snapshot_id] = record
    return metadata


def process_lexicon_crawl(
    crawl_dir: Path,
    output_path: Path,
    verbose: bool = False,
) -> dict[str, int]:
    """
    Process all lexicon snapshots from a crawl directory.
    
    Args:
        crawl_dir: Path to crawl directory (contains payloads/ and snapshots.jsonl)
        output_path: Path to output IR JSONL file
        verbose: Whether to print progress
    
    Returns:
        Stats dict with counts
    """
    payloads_dir = crawl_dir / "payloads"
    snapshots_jsonl = crawl_dir / "snapshots.jsonl"
    
    if not payloads_dir.exists():
        raise FileNotFoundError(f"Payloads directory not found: {payloads_dir}")
    if not snapshots_jsonl.exists():
        raise FileNotFoundError(f"Snapshots JSONL not found: {snapshots_jsonl}")
    
    # Load snapshot metadata
    metadata = load_snapshots_metadata(snapshots_jsonl)
    
    stats = {
        "snapshots_processed": 0,
        "snapshots_skipped": 0,
        "entries_parsed": 0,
        "entries_with_warnings": 0,
        "parse_errors": 0,
    }
    
    dctx = zstd.ZstdDecompressor()
    
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, "w", encoding="utf-8") as out_f:
        for payload_path in sorted(payloads_dir.glob("*.html.zst")):
            snapshot_id = payload_path.name.replace(".html.zst", "")
            
            if snapshot_id not in metadata:
                logger.warning(f"Snapshot {snapshot_id} not found in metadata, skipping")
                stats["snapshots_skipped"] += 1
                continue
            
            meta = metadata[snapshot_id]
            url_canonical = meta.get("url_canonical", "")
            
            # Only process lexicon pages
            if "/emk/lexicon/" not in url_canonical:
                if verbose:
                    logger.info(f"Skipping non-lexicon page: {url_canonical}")
                stats["snapshots_skipped"] += 1
                continue
            
            if verbose:
                logger.info(f"Processing: {url_canonical}")
            
            try:
                # Decompress
                with open(payload_path, "rb") as f:
                    html_content = dctx.decompress(f.read())
                
                # Parse
                parser = MalipenseLexiconParser(snapshot_id, url_canonical)
                
                for ir_unit in parser.parse_html(html_content):
                    out_f.write(json.dumps(ir_unit.to_dict(), ensure_ascii=False) + "\n")
                    stats["entries_parsed"] += 1
                    
                    if ir_unit.parse_warnings:
                        stats["entries_with_warnings"] += 1
                
                stats["snapshots_processed"] += 1
                
            except Exception as e:
                logger.error(f"Error processing {payload_path}: {e}")
                stats["parse_errors"] += 1
    
    return stats


def process_index_crawl(
    crawl_dir: Path,
    output_path: Path,
    verbose: bool = False,
) -> dict[str, int]:
    """
    Process all French index snapshots from a crawl directory.

    Args:
        crawl_dir: Path to crawl directory (contains payloads/ and snapshots.jsonl)
        output_path: Path to output IR JSONL file
        verbose: Whether to print progress

    Returns:
        Stats dict with counts
    """
    payloads_dir = crawl_dir / "payloads"
    snapshots_jsonl = crawl_dir / "snapshots.jsonl"

    if not payloads_dir.exists():
        raise FileNotFoundError(f"Payloads directory not found: {payloads_dir}")
    if not snapshots_jsonl.exists():
        raise FileNotFoundError(f"Snapshots JSONL not found: {snapshots_jsonl}")

    # Load snapshot metadata
    metadata = load_snapshots_metadata(snapshots_jsonl)

    stats = {
        "snapshots_processed": 0,
        "snapshots_skipped": 0,
        "mappings_parsed": 0,
        "mappings_with_warnings": 0,
        "parse_errors": 0,
    }

    dctx = zstd.ZstdDecompressor()

    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, "w", encoding="utf-8") as out_f:
        for payload_path in sorted(payloads_dir.glob("*.html.zst")):
            snapshot_id = payload_path.name.replace(".html.zst", "")

            if snapshot_id not in metadata:
                logger.warning(f"Snapshot {snapshot_id} not found in metadata, skipping")
                stats["snapshots_skipped"] += 1
                continue

            meta = metadata[snapshot_id]
            url_canonical = meta.get("url_canonical", "")

            # Only process index-french pages
            if "/emk/index-french/" not in url_canonical:
                if verbose:
                    logger.info(f"Skipping non-index-french page: {url_canonical}")
                stats["snapshots_skipped"] += 1
                continue

            if verbose:
                logger.info(f"Processing: {url_canonical}")

            try:
                # Decompress
                with open(payload_path, "rb") as f:
                    html_content = dctx.decompress(f.read())

                # Parse
                parser = MalipenseIndexParser(snapshot_id, url_canonical)

                for ir_unit in parser.parse_html(html_content):
                    out_f.write(json.dumps(ir_unit.to_dict(), ensure_ascii=False) + "\n")
                    stats["mappings_parsed"] += 1

                    if ir_unit.parse_warnings:
                        stats["mappings_with_warnings"] += 1

                stats["snapshots_processed"] += 1

            except Exception as e:
                logger.error(f"Error processing {payload_path}: {e}")
                stats["parse_errors"] += 1

    return stats


def main():
    parser = argparse.ArgumentParser(
        description="Parse Mali-pense snapshots into IR JSONL"
    )
    parser.add_argument(
        "--crawl-dir",
        type=Path,
        required=True,
        help="Path to crawl directory (contains payloads/ and snapshots.jsonl)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        required=True,
        help="Output IR JSONL file path",
    )
    parser.add_argument(
        "--kind",
        choices=["lexicon", "index"],
        default="lexicon",
        help="Which page type to parse: 'lexicon' for /emk/lexicon/ pages, "
             "'index' for /emk/index-french/ pages (default: lexicon)",
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Verbose output",
    )

    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO if args.verbose else logging.WARNING,
        format="%(levelname)s: %(message)s",
    )

    print(f"Processing crawl: {args.crawl_dir}")

    if args.kind == "lexicon":
        print(f"Parser version: {LEXICON_PARSER_VERSION}")
        print(f"Page type: lexicon (/emk/lexicon/)")
        print()

        stats = process_lexicon_crawl(
            args.crawl_dir,
            args.output,
            verbose=args.verbose,
        )

        print()
        print("=" * 50)
        print("IR Parser Results — Lexicon")
        print("=" * 50)
        print(f"Snapshots processed:     {stats['snapshots_processed']}")
        print(f"Snapshots skipped:       {stats['snapshots_skipped']}")
        print(f"Entries parsed:          {stats['entries_parsed']}")
        print(f"Entries with warnings:   {stats['entries_with_warnings']}")
        print(f"Parse errors:            {stats['parse_errors']}")
        print(f"Output: {args.output}")
        print("=" * 50)

    elif args.kind == "index":
        print(f"Parser version: {INDEX_PARSER_VERSION}")
        print(f"Page type: index-french (/emk/index-french/)")
        print()

        stats = process_index_crawl(
            args.crawl_dir,
            args.output,
            verbose=args.verbose,
        )

        print()
        print("=" * 50)
        print("IR Parser Results — French Index")
        print("=" * 50)
        print(f"Snapshots processed:     {stats['snapshots_processed']}")
        print(f"Snapshots skipped:       {stats['snapshots_skipped']}")
        print(f"Mappings parsed:         {stats['mappings_parsed']}")
        print(f"Mappings with warnings:  {stats['mappings_with_warnings']}")
        print(f"Parse errors:            {stats['parse_errors']}")
        print(f"Output: {args.output}")
        print("=" * 50)


if __name__ == "__main__":
    main()
