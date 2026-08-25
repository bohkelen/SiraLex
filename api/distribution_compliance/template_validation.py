"""Detect unresolved template placeholders in compliance metadata."""

from __future__ import annotations

from typing import Any

from source_registry.load import find_unresolved_template_tokens


def scan_compliance_metadata_texts(texts: dict[str, str]) -> dict[str, Any]:
    findings: list[dict[str, str]] = []
    for label, content in texts.items():
        tokens = find_unresolved_template_tokens(content)
        if tokens:
            findings.append({"surface": label, "tokens": ", ".join(tokens)})
    return {
        "unresolved_placeholder_count": sum(
            len(find_unresolved_template_tokens(c)) for c in texts.values()
        ),
        "findings": findings,
        "status": "BLOCK" if findings else "PASS",
    }
