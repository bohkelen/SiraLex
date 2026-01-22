"""
CLI for the Snapshot Engine.

Usage:
    nkokan-crawl --source src_malipense --urls https://www.mali-pense.net/emk/index-french/a.htm
    nkokan-crawl --source src_malipense --url-file urls.txt
"""

import argparse
import logging
import secrets
import sys
from datetime import datetime, timezone
from pathlib import Path

from .crawler import CrawlerConfig, SnapshotCrawler

logger = logging.getLogger(__name__)


def generate_crawl_id(source_id: str) -> str:
    """
    Generate a unique crawl ID based on source, timestamp, and random suffix.

    Format: crawl_YYYYMMDD_HHMMSS_mmm_XXXX_{source_id}
    - mmm: milliseconds (prevents same-second collisions)
    - XXXX: 4 random hex chars (extra collision safety)
    """
    now = datetime.now(timezone.utc)
    timestamp = now.strftime("%Y%m%d_%H%M%S")
    millis = f"{now.microsecond // 1000:03d}"
    rand_suffix = secrets.token_hex(2)  # 4 hex chars
    return f"crawl_{timestamp}_{millis}_{rand_suffix}_{source_id}"


def main() -> int:
    """Main entry point for the CLI."""
    parser = argparse.ArgumentParser(
        description="Nkokan Snapshot Engine - crawl and capture web pages",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Crawl a single URL
  nkokan-crawl --source src_malipense --urls https://www.mali-pense.net/emk/index-french/a.htm

  # Crawl multiple URLs
  nkokan-crawl --source src_malipense --urls URL1 URL2 URL3

  # Crawl URLs from a file (one per line)
  nkokan-crawl --source src_malipense --url-file urls.txt

  # Specify output directory
  nkokan-crawl --source src_malipense --urls URL --output ./data/snapshots
        """,
    )

    parser.add_argument(
        "--source",
        required=True,
        help="Source ID from the source registry (e.g., src_malipense)",
    )

    parser.add_argument(
        "--urls",
        nargs="+",
        help="URLs to crawl",
    )

    parser.add_argument(
        "--url-file",
        type=Path,
        help="File containing URLs to crawl (one per line)",
    )

    parser.add_argument(
        "--output",
        type=Path,
        default=Path("data/snapshots"),
        help="Output directory for snapshots (default: data/snapshots)",
    )

    parser.add_argument(
        "--crawl-id",
        help="Custom crawl ID (default: auto-generated)",
    )

    parser.add_argument(
        "--delay",
        type=float,
        default=2.0,
        help="Delay between requests in seconds (default: 2.0)",
    )

    parser.add_argument(
        "--permission-override",
        action="store_true",
        help="Ignore robots.txt disallow (use only with explicit permission)",
    )

    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Enable verbose logging",
    )

    args = parser.parse_args()

    # Set up logging
    log_level = logging.DEBUG if args.verbose else logging.INFO
    logging.basicConfig(
        level=log_level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # Collect URLs
    urls: list[str] = []

    if args.urls:
        urls.extend(args.urls)

    if args.url_file:
        if not args.url_file.exists():
            logger.error(f"URL file not found: {args.url_file}")
            return 1
        with open(args.url_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#"):
                    urls.append(line)

    if not urls:
        logger.error("No URLs provided. Use --urls or --url-file")
        return 1

    # Generate crawl ID if not provided
    crawl_id = args.crawl_id or generate_crawl_id(args.source)

    logger.info(f"Starting crawl: {crawl_id}")
    logger.info(f"Source: {args.source}")
    logger.info(f"URLs to crawl: {len(urls)}")
    logger.info(f"Output directory: {args.output}")

    # Create config
    config = CrawlerConfig(
        source_id=args.source,
        crawl_id=crawl_id,
        output_dir=args.output,
        delay_seconds=args.delay,
        permission_override=args.permission_override,
    )

    # Run crawler
    stats = {"new": 0, "changed": 0, "unchanged": 0, "not_found": 0, "error": 0, "robots_blocked": 0}

    with SnapshotCrawler(config) as crawler:
        for result in crawler.crawl_urls(urls):
            stats[result.crawl_status.value] += 1

    # Print summary
    logger.info("=" * 50)
    logger.info("Crawl complete!")
    logger.info(f"  New:            {stats['new']}")
    logger.info(f"  Changed:        {stats['changed']}")
    logger.info(f"  Unchanged:      {stats['unchanged']}")
    logger.info(f"  Not found:      {stats['not_found']}")
    logger.info(f"  Errors:         {stats['error']}")
    logger.info(f"  Robots blocked: {stats['robots_blocked']}")
    logger.info(f"Output: {config.output_dir / config.source_id / config.crawl_id}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
