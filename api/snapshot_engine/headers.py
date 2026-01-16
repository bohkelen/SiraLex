"""
Header redaction per shared/specs/snapshot-engine.md.

MUST redact:
- Set-Cookie, Cookie
- Authorization, Proxy-Authorization
- Any header containing tokens, session IDs, or credentials

SHOULD preserve:
- Content-Type, Content-Length, Content-Encoding
- Last-Modified, ETag
- X-* headers (unless they contain credentials)
- Server, Date
"""

REDACTION_POLICY_ID = "header_redact_v1"

# Headers that MUST be redacted (case-insensitive)
REDACT_HEADERS = frozenset(
    {
        "set-cookie",
        "cookie",
        "authorization",
        "proxy-authorization",
        "x-api-key",
        "x-auth-token",
        "x-session-id",
        "x-csrf-token",
    }
)

# Substrings that trigger redaction if found in header name (case-insensitive)
REDACT_SUBSTRINGS = ("token", "secret", "password", "credential", "session")


def redact_headers(headers: dict[str, str]) -> dict[str, str]:
    """
    Apply header redaction policy.

    Args:
        headers: Raw response headers.

    Returns:
        Headers with sensitive values redacted.
    """
    result = {}

    for name, value in headers.items():
        name_lower = name.lower()

        # Check explicit redact list
        if name_lower in REDACT_HEADERS:
            continue  # Drop entirely

        # Check for suspicious substrings in header name
        if any(substr in name_lower for substr in REDACT_SUBSTRINGS):
            continue  # Drop entirely

        result[name] = value

    return result
