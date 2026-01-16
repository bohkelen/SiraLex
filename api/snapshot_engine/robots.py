"""
Robots.txt enforcement using urllib.robotparser.

Per shared/specs/snapshot-engine.md:
- Default: if disallowed → do not fetch unless permission_override=True
- Record robots_observed and robots_policy_notes
"""

import logging
from dataclasses import dataclass
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

import httpx

logger = logging.getLogger(__name__)

# Our User-Agent for robots.txt evaluation
USER_AGENT = "Nkokan-Snapshot"


@dataclass
class RobotsResult:
    """Result of a robots.txt check."""

    observed: bool  # True if we successfully checked robots.txt
    allowed: bool  # True if our UA is allowed to fetch the URL
    notes: str  # Human-readable explanation


class RobotsChecker:
    """
    Robots.txt checker with caching per host.

    Uses urllib.robotparser for proper parsing and evaluation.
    """

    def __init__(self, client: httpx.Client, user_agent: str = USER_AGENT) -> None:
        self._client = client
        self._user_agent = user_agent
        self._cache: dict[str, RobotFileParser | None] = {}  # host -> parser or None

    def _get_robots_url(self, url: str) -> tuple[str, str]:
        """Get the robots.txt URL and host key for a given URL."""
        parsed = urlparse(url)
        host_key = f"{parsed.scheme}://{parsed.netloc}"
        robots_url = urljoin(host_key, "/robots.txt")
        return robots_url, host_key

    def _fetch_and_parse_robots(self, robots_url: str) -> RobotFileParser | None:
        """Fetch and parse robots.txt, returning None if unavailable."""
        try:
            response = self._client.get(robots_url)

            if response.status_code == 404:
                logger.debug(f"No robots.txt found at {robots_url}")
                return None

            if response.status_code != 200:
                logger.warning(
                    f"Unexpected status {response.status_code} for {robots_url}"
                )
                return None

            # Parse the robots.txt content
            parser = RobotFileParser()
            parser.parse(response.text.splitlines())
            return parser

        except httpx.RequestError as e:
            logger.warning(f"Failed to fetch robots.txt from {robots_url}: {e}")
            return None

    def check(self, url: str) -> RobotsResult:
        """
        Check if our User-Agent is allowed to fetch the given URL.

        Args:
            url: The URL we want to fetch.

        Returns:
            RobotsResult with observed, allowed, and notes.
        """
        robots_url, host_key = self._get_robots_url(url)

        # Check cache
        if host_key not in self._cache:
            logger.debug(f"Fetching robots.txt: {robots_url}")
            self._cache[host_key] = self._fetch_and_parse_robots(robots_url)

        parser = self._cache[host_key]

        if parser is None:
            # No robots.txt or fetch failed → allowed by default
            return RobotsResult(
                observed=True,
                allowed=True,
                notes="no_robots_file",
            )

        # Check if our user agent can fetch this URL
        allowed = parser.can_fetch(self._user_agent, url)

        # Also check wildcard (*) if our specific UA isn't mentioned
        if not allowed:
            allowed_wildcard = parser.can_fetch("*", url)
            if allowed_wildcard:
                # Our specific UA isn't blocked, wildcard allows
                allowed = True

        if allowed:
            return RobotsResult(
                observed=True,
                allowed=True,
                notes="allowed",
            )
        else:
            return RobotsResult(
                observed=True,
                allowed=False,
                notes="disallowed",
            )

    def clear_cache(self) -> None:
        """Clear the robots.txt cache."""
        self._cache.clear()
