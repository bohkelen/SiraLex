"""Deterministic Malidaba / src_malipense source version-delta (evidence only)."""

from .compare import (
    COMPARISON_SCHEMA_VERSION,
    compare_lexicon_records,
    run_version_delta,
)

__all__ = [
    "COMPARISON_SCHEMA_VERSION",
    "compare_lexicon_records",
    "run_version_delta",
]
