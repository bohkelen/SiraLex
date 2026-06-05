"""Versioned French stopword/modifier filters for source-gap discovery."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from .normalization import primary_source_key

DEFAULT_FILTER_PATH = (
    Path(__file__).parent.parent.parent
    / "shared"
    / "source_index_gap_discovery"
    / "french_stopwords_modifiers_v1.json"
)


@dataclass(frozen=True)
class FrenchTermFilters:
    """Normalized filter sets for review-time candidate downgrading."""

    schema_version: str
    stopwords: frozenset[str]
    modifiers: frozenset[str]
    low_value_terms: frozenset[str]
    abstract_terms: frozenset[str]

    def labels_for(self, term: str) -> set[str]:
        key = primary_source_key(term)
        keys = {key}
        if key.endswith("s") and len(key) > 3:
            keys.add(key[:-1])
        labels: set[str] = set()
        if keys & self.stopwords:
            labels.add("stopword")
        if keys & self.modifiers:
            labels.add("modifier")
        if keys & self.low_value_terms:
            labels.add("low_value")
        if keys & self.abstract_terms:
            labels.add("abstract")
        return labels


def _normalize_values(values: object) -> frozenset[str]:
    if not isinstance(values, list):
        return frozenset()
    return frozenset(primary_source_key(str(value)) for value in values if str(value).strip())


def load_filters(path: Path | None = None) -> FrenchTermFilters:
    """Load the versioned French filter file."""
    filter_path = path or DEFAULT_FILTER_PATH
    payload = json.loads(filter_path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError(f"{filter_path}: expected JSON object")
    schema_version = payload.get("schema_version")
    if not isinstance(schema_version, str) or not schema_version:
        raise ValueError(f"{filter_path}: missing schema_version")
    return FrenchTermFilters(
        schema_version=schema_version,
        stopwords=_normalize_values(payload.get("stopwords")),
        modifiers=_normalize_values(payload.get("modifiers")),
        low_value_terms=_normalize_values(payload.get("low_value_terms")),
        abstract_terms=_normalize_values(payload.get("abstract_terms")),
    )
