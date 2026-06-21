"""Curated search regression matrix schema and validation (Phase 7L)."""

from .replay import (
    BundleMetadataError,
    CaseReplayResult,
    MatrixValidationFailure,
    RegressionRunError,
    RegressionRunResult,
    SearchIndexChecksumError,
    run_search_regression,
)
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
    "BundleMetadataError",
    "CASE_SCHEMA_VERSION",
    "CaseReplayResult",
    "MANIFEST_SCHEMA_VERSION",
    "MatrixManifest",
    "MatrixValidationFailure",
    "RegressionRunError",
    "RegressionRunResult",
    "SearchIndexChecksumError",
    "SearchRegressionCase",
    "ValidationError",
    "load_matrix_jsonl",
    "load_matrix_manifest",
    "run_search_regression",
    "validate_case",
    "validate_matrix",
]
