"""
Header redaction per shared/specs/snapshot-engine.md.

Strategy:
- Exact-key denylist for high-risk headers (credentials)
- Substring matching for obvious secrets (token, secret, etc.)
- Value redaction (keep key, set value to "[REDACTED]") to preserve evidence
- Avoid over-broad rules (e.g., "session" matches too many safe headers)

MUST redact:
- Authorization, Proxy-Authorization
- Cookie, Set-Cookie

SHOULD preserve (for debugging/evidence):
- Content-Type, Content-Length, Content-Encoding
- Last-Modified, ETag
- X-* headers (unless they contain credential patterns)
- Server, Date
- Session-related diagnostic headers (affinity, routing, etc.)
"""

REDACTION_POLICY_ID = "header_redact_v1"

# Headers that MUST be redacted (exact match, case-insensitive)
# These are credential-bearing headers
REDACT_EXACT = frozenset(
    {
        "authorization",
        "proxy-authorization",
        "cookie",
        "set-cookie",
        "www-authenticate",
        "proxy-authenticate",
    }
)

# Substrings that trigger redaction if found in header name (case-insensitive)
# Only truly dangerous patterns - NOT "session" (too broad, matches diagnostic headers)
REDACT_SUBSTRINGS = (
    "token",
    "secret",
    "password",
    "credential",
    "apikey",
    "api-key",
    "api_key",
    "bearer",
    "auth-token",
    "access-key",
    "private-key",
)

# Redacted value marker
REDACTED_VALUE = "[REDACTED]"


def redact_headers(headers: dict[str, str]) -> dict[str, str]:
    """
    Apply header redaction policy.

    Strategy:
    - For credential headers: replace value with "[REDACTED]" (preserves evidence)
    - For headers matching dangerous substrings: replace value with "[REDACTED]"
    - All other headers: keep as-is

    Args:
        headers: Raw response headers.

    Returns:
        Headers with sensitive values redacted (keys preserved for evidence).
    """
    result = {}

    for name, value in headers.items():
        name_lower = name.lower()

        # Check exact match denylist
        if name_lower in REDACT_EXACT:
            result[name] = REDACTED_VALUE
            continue

        # Check for dangerous substrings in header name
        should_redact = any(substr in name_lower for substr in REDACT_SUBSTRINGS)
        if should_redact:
            result[name] = REDACTED_VALUE
            continue

        # Safe to keep
        result[name] = value

    return result
