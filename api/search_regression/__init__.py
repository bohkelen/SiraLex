"""Curated search regression matrix schema and validation (Phase 7L)."""

from .schema import (
    CASE_SCHEMA_VERSION,
    MANIFEST_SCHEMA_VERSION,
    MatrixManifest,
    SearchRegressionCase,
    load_matrix_jsonl,
    load_matrix_manifest,
)
from .validate_matrix import ValidationError, validate_case, validate_matrix

__all__ = [
    "CASE_SCHEMA_VERSION",
    "MANIFEST_SCHEMA_VERSION",
    "MatrixManifest",
    "SearchRegressionCase",
    "ValidationError",
    "load_matrix_jsonl",
    "load_matrix_manifest",
    "validate_case",
    "validate_matrix",
]
