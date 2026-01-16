"""
URL canonicalization per shared/specs/lossless-capture-and-ir.md (urlcanon_v1).

Rules:
- Normalize scheme and host case (lowercase)
- Remove URL fragment (#...)
- Remove default ports (:80 for http, :443 for https)
- Normalize trailing slash (remove unless path is /)
- Normalize query parameter ordering (sort by key, then value)
- Remove tracking parameters (utm_*, gclid, fbclid)
"""

from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

CANONICALIZATION_VERSION = "urlcanon_v1"

# Tracking parameters to remove (conservative list)
TRACKING_PARAMS = frozenset(
    {
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_term",
        "utm_content",
        "gclid",
        "fbclid",
        "msclkid",
        "ref",
        "_ga",
    }
)


def canonicalize_url(url: str) -> str:
    """
    Canonicalize a URL per urlcanon_v1 rules.

    Args:
        url: The URL to canonicalize.

    Returns:
        Canonicalized URL string.
    """
    parsed = urlparse(url)

    # Lowercase scheme and host
    scheme = parsed.scheme.lower()
    netloc = parsed.netloc.lower()

    # Remove default ports
    if netloc.endswith(":80") and scheme == "http":
        netloc = netloc[:-3]
    elif netloc.endswith(":443") and scheme == "https":
        netloc = netloc[:-4]

    # Normalize path
    path = parsed.path
    # Remove trailing slash unless path is just /
    if path != "/" and path.endswith("/"):
        path = path.rstrip("/")
    # Ensure path is at least /
    if not path:
        path = "/"

    # Sort query parameters and remove tracking params
    query_params = parse_qsl(parsed.query, keep_blank_values=True)
    filtered_params = [
        (k, v) for k, v in query_params if k.lower() not in TRACKING_PARAMS
    ]
    sorted_params = sorted(filtered_params, key=lambda x: (x[0], x[1]))
    query = urlencode(sorted_params)

    # Remove fragment entirely
    fragment = ""

    return urlunparse((scheme, netloc, path, parsed.params, query, fragment))
