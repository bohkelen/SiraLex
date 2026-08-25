"""Load and interpret shared/source registry entries."""

from __future__ import annotations

from .load import (
    build_attribution_text,
    load_source_registry,
    resolve_source_entry,
    source_distribution_posture,
)

__all__ = [
    "build_attribution_text",
    "load_source_registry",
    "resolve_source_entry",
    "source_distribution_posture",
]
