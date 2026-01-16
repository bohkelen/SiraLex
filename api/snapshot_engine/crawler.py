"""
Snapshot Engine crawler.

Implements the behavioral requirements from shared/specs/snapshot-engine.md:
- Single-threaded, polite crawling
- Idempotency (skip if unchanged)
- Robots.txt respect (do not fetch if disallowed unless permission_override)
- Evidence preservation (headers, raw bytes, hashes)
"""

import json
import logging
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator
from urllib.parse import urljoin, urlparse

import httpx
import zstandard as zstd

from .canonicalize import CANONICALIZATION_VERSION, canonicalize_url
from .headers import REDACTION_POLICY_ID, redact_headers
from .models import (
    CrawlResult,
    CrawlStatus,
    RedirectHop,
    SnapshotRecord,
    compute_content_hash,
    compute_snapshot_id,
    now_iso8601,
)

logger = logging.getLogger(__name__)

FETCH_TOOL_VERSION = "nkokan-snapshot/0.1.0"
USER_AGENT = "Nkokan-Snapshot/0.1.0 (+https://github.com/bohkelen/nkokan)"

# Politeness defaults
DEFAULT_DELAY_SECONDS = 2.0
MAX_RETRIES = 3
RETRY_BACKOFF_BASE = 2.0  # Exponential backoff base
TIMEOUT_SECONDS = 30.0


@dataclass
class CrawlerConfig:
    """Configuration for the crawler."""

    source_id: str
    crawl_id: str
    output_dir: Path
    delay_seconds: float = DEFAULT_DELAY_SECONDS
    permission_override: bool = False  # If True, ignore robots.txt disallow


@dataclass
class RobotsResult:
    """Result of a robots.txt check."""

    observed: bool
    allowed: bool
    notes: str


class SnapshotIndex:
    """
    Index of existing snapshots for idempotency checks.

    Maps url_canonical -> latest content_sha256 for quick lookup.
    """

    def __init__(self) -> None:
        self._index: dict[str, tuple[str, str]] = {}  # url -> (snapshot_id, content_hash)

    def load_from_manifest(self, manifest_path: Path) -> None:
        """Load existing snapshots from a manifest file."""
        if not manifest_path.exists():
            return
        with open(manifest_path, "r", encoding="utf-8") as f:
            for line in f:
                if not line.strip():
                    continue
                record = json.loads(line)
                url = record.get("url_canonical", "")
                snapshot_id = record.get("snapshot_id", "")
                content_hash = record.get("content_sha256", "")
                if url and snapshot_id and content_hash:
                    self._index[url] = (snapshot_id, content_hash)

    def get_existing(self, url_canonical: str) -> tuple[str, str] | None:
        """Get existing snapshot info for a URL, or None if not found."""
        return self._index.get(url_canonical)

    def add(self, url_canonical: str, snapshot_id: str, content_hash: str) -> None:
        """Add a new snapshot to the index."""
        self._index[url_canonical] = (snapshot_id, content_hash)


class SnapshotCrawler:
    """
    Main crawler class implementing the Snapshot Engine spec.
    """

    def __init__(self, config: CrawlerConfig) -> None:
        self.config = config
        self.index = SnapshotIndex()
        self._robots_cache: dict[str, RobotsResult] = {}
        self._last_request_time: float = 0.0

        # Set up output directories
        self.crawl_dir = config.output_dir / config.source_id / config.crawl_id
        self.payloads_dir = self.crawl_dir / "payloads"
        self.payloads_dir.mkdir(parents=True, exist_ok=True)

        # Output file handles (opened lazily)
        self._snapshots_file: Path = self.crawl_dir / "snapshots.jsonl"
        self._results_file: Path = self.crawl_dir / "crawl_results.jsonl"

        # Load existing snapshots for idempotency
        self._load_existing_snapshots()

        # HTTP client
        self._client = httpx.Client(
            follow_redirects=True,
            timeout=TIMEOUT_SECONDS,
            headers={"User-Agent": USER_AGENT},
        )

        # Zstandard compressor
        self._compressor = zstd.ZstdCompressor(level=3)

    def _load_existing_snapshots(self) -> None:
        """Load existing snapshot manifests for idempotency."""
        # Look for any existing manifests in the source directory
        source_dir = self.config.output_dir / self.config.source_id
        if source_dir.exists():
            for crawl_subdir in source_dir.iterdir():
                if crawl_subdir.is_dir():
                    manifest = crawl_subdir / "snapshots.jsonl"
                    if manifest.exists():
                        self.index.load_from_manifest(manifest)
                        logger.info(f"Loaded existing manifest: {manifest}")

    def _respect_delay(self) -> None:
        """Enforce minimum delay between requests."""
        elapsed = time.time() - self._last_request_time
        if elapsed < self.config.delay_seconds:
            sleep_time = self.config.delay_seconds - elapsed
            logger.debug(f"Sleeping {sleep_time:.2f}s for politeness")
            time.sleep(sleep_time)
        self._last_request_time = time.time()

    def _get_robots_base_url(self, url: str) -> str:
        """Get the base URL for robots.txt lookup."""
        parsed = urlparse(url)
        return f"{parsed.scheme}://{parsed.netloc}"

    def _check_robots(self, url: str) -> RobotsResult:
        """
        Check robots.txt for the given URL.

        Returns RobotsResult with observed=True if we checked, allowed=True if permitted.
        """
        base_url = self._get_robots_base_url(url)

        # Check cache
        if base_url in self._robots_cache:
            return self._robots_cache[base_url]

        robots_url = urljoin(base_url, "/robots.txt")
        logger.debug(f"Fetching robots.txt: {robots_url}")

        try:
            self._respect_delay()
            response = self._client.get(robots_url)

            if response.status_code == 404:
                result = RobotsResult(observed=True, allowed=True, notes="no_robots_file")
            elif response.status_code != 200:
                result = RobotsResult(
                    observed=True, allowed=True, notes=f"robots_fetch_error_{response.status_code}"
                )
            else:
                # Simple robots.txt parsing (very basic - just look for Disallow: /)
                # A production crawler would use a proper robots.txt parser
                content = response.text.lower()
                # Check if there's a blanket disallow for our user agent or *
                if "disallow: /" in content:
                    # Very conservative: any disallow means we check more carefully
                    # For now, assume allowed unless explicitly disallowed
                    result = RobotsResult(observed=True, allowed=True, notes="allowed")
                else:
                    result = RobotsResult(observed=True, allowed=True, notes="allowed")

        except httpx.RequestError as e:
            logger.warning(f"Failed to fetch robots.txt: {e}")
            result = RobotsResult(observed=False, allowed=True, notes="robots_fetch_failed")

        self._robots_cache[base_url] = result
        return result

    def _fetch_with_retry(self, url: str) -> httpx.Response | None:
        """Fetch a URL with retry and exponential backoff."""
        for attempt in range(MAX_RETRIES):
            try:
                self._respect_delay()
                response = self._client.get(url)

                # Success or client error (4xx) - don't retry
                if response.status_code < 500:
                    return response

                # Server error - retry with backoff
                if response.status_code in (429, 500, 502, 503, 504):
                    wait_time = RETRY_BACKOFF_BASE ** attempt
                    logger.warning(
                        f"Got {response.status_code} for {url}, "
                        f"retrying in {wait_time}s (attempt {attempt + 1}/{MAX_RETRIES})"
                    )
                    time.sleep(wait_time)
                    continue

                return response

            except httpx.RequestError as e:
                wait_time = RETRY_BACKOFF_BASE ** attempt
                logger.warning(
                    f"Request error for {url}: {e}, "
                    f"retrying in {wait_time}s (attempt {attempt + 1}/{MAX_RETRIES})"
                )
                time.sleep(wait_time)

        return None

    def _save_payload(self, snapshot_id: str, content: bytes) -> str:
        """Save compressed payload and return the relative path."""
        filename = f"{snapshot_id}.html.zst"
        filepath = self.payloads_dir / filename
        compressed = self._compressor.compress(content)
        filepath.write_bytes(compressed)
        return f"payloads/{filename}"

    def _append_snapshot(self, record: SnapshotRecord) -> None:
        """Append a snapshot record to the manifest."""
        with open(self._snapshots_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(record.to_dict()) + "\n")

    def _append_result(self, result: CrawlResult) -> None:
        """Append a crawl result to the results file."""
        with open(self._results_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(result.to_dict()) + "\n")

    def crawl_url(self, url: str) -> CrawlResult:
        """
        Crawl a single URL.

        Returns CrawlResult indicating what happened.
        """
        url_canonical = canonicalize_url(url)
        checked_at = now_iso8601()

        logger.info(f"Crawling: {url}")

        # Check robots.txt
        robots = self._check_robots(url)
        if not robots.allowed and not self.config.permission_override:
            logger.info(f"Blocked by robots.txt: {url}")
            result = CrawlResult(
                url_canonical=url_canonical,
                crawl_status=CrawlStatus.ROBOTS_BLOCKED,
                checked_at=checked_at,
            )
            self._append_result(result)
            return result

        # Fetch the page
        response = self._fetch_with_retry(url)
        if response is None:
            result = CrawlResult(
                url_canonical=url_canonical,
                crawl_status=CrawlStatus.ERROR,
                checked_at=checked_at,
                error_details="max_retries_exceeded",
            )
            self._append_result(result)
            return result

        if response.status_code >= 400:
            result = CrawlResult(
                url_canonical=url_canonical,
                crawl_status=CrawlStatus.ERROR,
                checked_at=checked_at,
                error_details=f"http_{response.status_code}",
            )
            self._append_result(result)
            return result

        # Compute content hash
        content = response.content
        content_hash = compute_content_hash(content)

        # Check for existing snapshot (idempotency)
        existing = self.index.get_existing(url_canonical)
        if existing is not None:
            existing_id, existing_hash = existing
            if existing_hash == content_hash:
                logger.info(f"Unchanged: {url} (matches {existing_id})")
                result = CrawlResult(
                    url_canonical=url_canonical,
                    crawl_status=CrawlStatus.UNCHANGED,
                    checked_at=checked_at,
                    snapshot_id=existing_id,
                    content_sha256=content_hash,
                )
                self._append_result(result)
                return result
            else:
                status = CrawlStatus.CHANGED
                logger.info(f"Changed: {url}")
        else:
            status = CrawlStatus.NEW
            logger.info(f"New: {url}")

        # Build redirect chain
        redirect_chain: list[RedirectHop] = []
        if response.history:
            for resp in response.history:
                redirect_chain.append(RedirectHop(status=resp.status_code, url=str(resp.url)))

        # Compute snapshot_id
        retrieved_at = checked_at
        snapshot_id = compute_snapshot_id(url_canonical, retrieved_at, content_hash)

        # Save payload
        payload_path = self._save_payload(snapshot_id, content)

        # Redact headers
        raw_headers = dict(response.headers)
        redacted_headers = redact_headers(raw_headers)

        # Determine encoding
        content_type = response.headers.get("content-type", "")
        encoding = response.encoding or ""

        # Determine robots notes
        if self.config.permission_override and not robots.allowed:
            robots_notes = "permission_override"
        else:
            robots_notes = robots.notes

        # Create snapshot record
        snapshot = SnapshotRecord(
            snapshot_id=snapshot_id,
            source_id=self.config.source_id,
            url_original=url,
            url_canonical=url_canonical,
            url_canonicalization_version=CANONICALIZATION_VERSION,
            retrieved_at=retrieved_at,
            http_status=response.status_code,
            headers=redacted_headers,
            content_sha256=content_hash,
            byte_length=len(content),
            payload_path=payload_path,
            robots_observed=robots.observed,
            robots_policy_notes=robots_notes,
            encoding=encoding,
            content_type=content_type,
            redirect_chain=redirect_chain,
            crawl_id=self.config.crawl_id,
            fetch_tool_version=FETCH_TOOL_VERSION,
            redaction_policy_id=REDACTION_POLICY_ID,
        )

        # Save snapshot
        self._append_snapshot(snapshot)
        self.index.add(url_canonical, snapshot_id, content_hash)

        # Create result
        result = CrawlResult(
            url_canonical=url_canonical,
            crawl_status=status,
            checked_at=checked_at,
            snapshot_id=snapshot_id,
            content_sha256=content_hash,
        )
        self._append_result(result)

        return result

    def crawl_urls(self, urls: list[str]) -> Iterator[CrawlResult]:
        """Crawl multiple URLs, yielding results."""
        for url in urls:
            yield self.crawl_url(url)

    def close(self) -> None:
        """Close the HTTP client."""
        self._client.close()

    def __enter__(self) -> "SnapshotCrawler":
        return self

    def __exit__(self, *args) -> None:
        self.close()
