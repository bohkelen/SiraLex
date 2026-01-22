"""
Data models for the Snapshot Engine.

These models implement the contracts defined in shared/specs/snapshot-engine.md.

Key terminology:
- snapshot_id: Event identifier (unique per fetch). Answers "what did we fetch at that time?"
- content_id / content_sha256: Content address (unique per content). Answers "what bytes is this?"
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from hashlib import sha256
from typing import Any


class CrawlStatus(str, Enum):
    """Status of a URL check during a crawl run."""

    NEW = "new"  # No prior snapshot; new snapshot created
    CHANGED = "changed"  # Content hash differs; new snapshot created
    UNCHANGED = "unchanged"  # Content hash matches; no new snapshot
    NOT_FOUND = "not_found"  # HTTP 404 - page doesn't exist (valid state, not error)
    ERROR = "error"  # Fetch failed (network error, 5xx, max retries)
    ROBOTS_BLOCKED = "robots_blocked"  # Skipped due to robots.txt


@dataclass
class RedirectHop:
    """A single redirect in the chain."""

    status: int
    url: str


@dataclass
class SnapshotRecord:
    """
    Snapshot metadata record per shared/specs/snapshot-engine.md.

    All required fields from the spec are present.

    Identity fields:
    - snapshot_id: Per-fetch event identifier (includes timestamp in hash).
    - content_id: Per-content identifier (first 16 chars of content_sha256).
    - content_sha256: Full content hash for exact matching.
    """

    # Required fields
    snapshot_id: str  # Event ID: unique per fetch (includes timestamp)
    source_id: str
    url_original: str
    url_canonical: str
    url_canonicalization_version: str
    retrieved_at: str  # ISO-8601
    http_status: int
    headers: dict[str, str]
    content_sha256: str  # Full content hash
    byte_length: int
    payload_path: str
    robots_observed: bool

    # Content identity (convenience, derived from content_sha256)
    content_id: str = ""  # First 16 chars of content_sha256

    # Recommended fields
    robots_policy_notes: str = ""
    encoding: str = ""
    content_type: str = ""
    redirect_chain: list[RedirectHop] = field(default_factory=list)
    crawl_id: str = ""
    fetch_tool_version: str = ""
    redaction_policy_id: str = "header_redact_v1"

    def __post_init__(self) -> None:
        """Compute derived fields."""
        if not self.content_id and self.content_sha256:
            self.content_id = self.content_sha256[:16]

    def to_dict(self) -> dict[str, Any]:
        """Convert to JSON-serializable dict."""
        return {
            "snapshot_id": self.snapshot_id,
            "content_id": self.content_id,
            "source_id": self.source_id,
            "url_original": self.url_original,
            "url_canonical": self.url_canonical,
            "url_canonicalization_version": self.url_canonicalization_version,
            "retrieved_at": self.retrieved_at,
            "http_status": self.http_status,
            "headers": self.headers,
            "content_sha256": self.content_sha256,
            "byte_length": self.byte_length,
            "payload_path": self.payload_path,
            "robots_observed": self.robots_observed,
            "robots_policy_notes": self.robots_policy_notes,
            "encoding": self.encoding,
            "content_type": self.content_type,
            "redirect_chain": [{"status": r.status, "url": r.url} for r in self.redirect_chain],
            "crawl_id": self.crawl_id,
            "fetch_tool_version": self.fetch_tool_version,
            "redaction_policy_id": self.redaction_policy_id,
        }


@dataclass
class CrawlResult:
    """
    URL-level crawl result per shared/specs/snapshot-engine.md.

    Recorded for every URL checked, regardless of whether a new snapshot was created.

    For status=CHANGED, includes previous_* fields to make the diff explicit.
    """

    url_canonical: str
    crawl_status: CrawlStatus
    checked_at: str  # ISO-8601
    snapshot_id: str = ""  # Empty if error/robots_blocked
    content_id: str = ""  # First 16 chars of content_sha256 (convenience)
    content_sha256: str = ""  # Empty if not fetched

    # For CHANGED status: what did it change from?
    previous_snapshot_id: str = ""
    previous_content_sha256: str = ""

    # Error details
    error_details: str = ""  # Only if status is ERROR

    def __post_init__(self) -> None:
        """Compute derived fields."""
        if not self.content_id and self.content_sha256:
            self.content_id = self.content_sha256[:16]

    def to_dict(self) -> dict[str, Any]:
        """Convert to JSON-serializable dict."""
        result: dict[str, Any] = {
            "url_canonical": self.url_canonical,
            "crawl_status": self.crawl_status.value,
            "checked_at": self.checked_at,
        }
        if self.snapshot_id:
            result["snapshot_id"] = self.snapshot_id
        if self.content_id:
            result["content_id"] = self.content_id
        if self.content_sha256:
            result["content_sha256"] = self.content_sha256
        if self.previous_snapshot_id:
            result["previous_snapshot_id"] = self.previous_snapshot_id
        if self.previous_content_sha256:
            result["previous_content_sha256"] = self.previous_content_sha256
        if self.error_details:
            result["error_details"] = self.error_details
        return result


def compute_snapshot_id(url_canonical: str, retrieved_at: str, content_sha256: str) -> str:
    """
    Compute snapshot_id per spec:
    sha256_hex(url_canonical + "\\n" + retrieved_at + "\\n" + content_sha256)[:16]

    NOTE: This is an EVENT identifier, not a content address.
    Same content fetched at different times yields different snapshot_id.
    For content identity, use content_sha256 or content_id.
    """
    data = f"{url_canonical}\n{retrieved_at}\n{content_sha256}"
    return sha256(data.encode("utf-8")).hexdigest()[:16]


def compute_content_hash(content: bytes) -> str:
    """Compute SHA-256 hash of content bytes, lowercase hex."""
    return sha256(content).hexdigest()


def compute_content_id(content_sha256: str) -> str:
    """Compute content_id from full content hash (first 16 chars)."""
    return content_sha256[:16]


def now_iso8601() -> str:
    """Return current UTC time in ISO-8601 format with second precision."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
