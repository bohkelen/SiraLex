"""
Robots.txt enforcement using urllib.robotparser.

Per shared/specs/snapshot-engine.md:
- Default: if disallowed → do not fetch unless permission_override=True
- Record robots_observed and robots_policy_notes

Semantics:
- robots_observed=True: We successfully checked robots.txt (200 OK or 404)
- robots_observed=False: We couldn't confirm (fetch error, unexpected status)
- allowed=True with observed=False means "we default to allow because we couldn't check"
"""

import logging
from dataclasses import dataclass
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

import httpx

logger = logging.getLogger(__name__)

# Our User-Agent for robots.txt evaluation
USER_AGENT = "SiraLex-Snapshot"


@dataclass
class RobotsResult:
    """Result of a robots.txt check."""

    observed: bool  # True if we successfully confirmed robots.txt contents (200 or 404)
    allowed: bool  # True if our UA is allowed to fetch the URL
    notes: str  # Human-readable explanation


# Sentinel for "no robots.txt exists"
_NO_ROBOTS = object()


class RobotsChecker:
    """
    Robots.txt checker with caching per host.

    Uses urllib.robotparser for proper parsing and evaluation.
    Does NOT apply manual wildcard fallback — robotparser handles
    User-Agent precedence correctly (specific UA > wildcard).
    """

    def __init__(self, client: httpx.Client, user_agent: str = USER_AGENT) -> None:
        self._client = client
        self._user_agent = user_agent
        # Cache: host -> (parser | _NO_ROBOTS | None for error, notes)
        self._cache: dict[str, tuple[RobotFileParser | object | None, str]] = {}

    def _get_host_key(self, url: str) -> str:
        """Get the host key for caching."""
        parsed = urlparse(url)
        return f"{parsed.scheme}://{parsed.netloc}"

    def _fetch_robots(self, host_key: str) -> tuple[RobotFileParser | object | None, str]:
        """
        Fetch and parse robots.txt for a host.

        Returns (parser, notes) where:
        - parser: RobotFileParser if successful, _NO_ROBOTS if 404, None if error
        - notes: explanation string
        """
        robots_url = urljoin(host_key, "/robots.txt")
        logger.debug(f"Fetching robots.txt: {robots_url}")

        try:
            response = self._client.get(robots_url)

            if response.status_code == 404:
                logger.debug(f"No robots.txt found at {robots_url} (404)")
                return _NO_ROBOTS, "no_robots_file"

            if response.status_code != 200:
                logger.warning(f"Unexpected status {response.status_code} for {robots_url}")
                return None, f"robots_unexpected_status_{response.status_code}"

            # 200 OK - parse the robots.txt content
            parser = RobotFileParser()
            parser.parse(response.text.splitlines())
            return parser, ""

        except httpx.RequestError as e:
            logger.warning(f"Failed to fetch robots.txt from {robots_url}: {e}")
            return None, "robots_fetch_failed"

    def check(self, url: str) -> RobotsResult:
        """
        Check if our User-Agent is allowed to fetch the given URL.

        Caches robots.txt per host. Uses robotparser which handles
        User-Agent precedence correctly (specific UA > wildcard).

        Args:
            url: The URL we want to fetch.

        Returns:
            RobotsResult with observed, allowed, and notes.
        """
        host_key = self._get_host_key(url)

        # Fetch robots.txt if not cached
        if host_key not in self._cache:
            self._cache[host_key] = self._fetch_robots(host_key)

        parser_or_sentinel, notes = self._cache[host_key]

        # Case 1: No robots.txt (404)
        if parser_or_sentinel is _NO_ROBOTS:
            return RobotsResult(observed=True, allowed=True, notes="no_robots_file")

        # Case 2: Fetch error or unexpected status
        if parser_or_sentinel is None:
            return RobotsResult(observed=False, allowed=True, notes=notes)

        # Case 3: We have a parser - evaluate for this specific URL
        parser: RobotFileParser = parser_or_sentinel  # type: ignore
        allowed = parser.can_fetch(self._user_agent, url)

        return RobotsResult(
            observed=True,
            allowed=allowed,
            notes="allowed" if allowed else "disallowed",
        )

    def clear_cache(self) -> None:
        """Clear the robots.txt cache."""
        self._cache.clear()
