"""Read-only Python replay runner for the Phase 7L search regression matrix."""

from __future__ import annotations

import hashlib
import json
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Callable

from query_evidence.replay import (  # noqa: E402
    SearchIndexLoadError,
    load_search_index,
)

from .schema import (
    MatrixManifest,
    SearchRegressionCase,
    load_matrix_jsonl,
    load_matrix_manifest,
)
from .validate_matrix import ValidationError, validate_matrix

SHARED_ROOT = Path(__file__).resolve().parents[2] / "shared"
if str(SHARED_ROOT) not in sys.path:
    sys.path.insert(0, str(SHARED_ROOT))

from normalization.norm_v3 import compute_search_keys  # noqa: E402

RUN_SCHEMA_VERSION = "search_regression_python_run_v1"
KEY_TYPE_ORDER = ("casefold", "diacritics_insensitive", "punct_stripped", "nospace")
DEEP_LADDER_KEY_TYPES = frozenset({"punct_stripped", "nospace"})
SearchKeysFn = Callable[[str], dict[str, list[str]]]

_search_keys_fn: SearchKeysFn = compute_search_keys


class RegressionRunError(Exception):
    """Base error for search regression replay runs."""


class MatrixValidationFailure(RegressionRunError):
    """Raised when matrix or manifest semantic validation fails."""


class BundleMetadataError(RegressionRunError):
    """Raised when bundle directory metadata does not match the manifest."""


class SearchIndexChecksumError(RegressionRunError):
    """Raised when search_index.jsonl checksum does not match manifest."""


@dataclass(frozen=True)
class CaseReplayResult:
    case_id: str
    query: str
    query_unicode_form: str
    direction: str
    actual_result_status: str
    actual_result_count: int
    actual_ir_ids: list[str]
    actual_matched_key_type: str
    actual_matched_key: str | None
    actual_deep_ladder: bool
    expected_match: bool
    mismatches: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class RegressionRunResult:
    schema_version: str
    bundle_id: str
    catalog_version: str
    norm_version: str
    search_index_sha256: str
    matrix_case_count: int
    passed_case_count: int
    failed_case_count: int
    cases: list[CaseReplayResult]

    @property
    def all_passed(self) -> bool:
        return self.failed_case_count == 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "bundle_id": self.bundle_id,
            "catalog_version": self.catalog_version,
            "norm_version": self.norm_version,
            "search_index_sha256": self.search_index_sha256,
            "matrix_case_count": self.matrix_case_count,
            "passed_case_count": self.passed_case_count,
            "failed_case_count": self.failed_case_count,
            "cases": [case.to_dict() for case in self.cases],
        }


def set_search_keys_fn(fn: SearchKeysFn | None) -> None:
    """Test hook to observe or replace norm_v3 key generation."""
    global _search_keys_fn
    _search_keys_fn = compute_search_keys if fn is None else fn


def get_search_keys_fn() -> SearchKeysFn:
    return _search_keys_fn


def compute_search_keys_for_query(query: str) -> dict[str, list[str]]:
    if query == "":
        return {
            "casefold": [],
            "diacritics_insensitive": [],
            "punct_stripped": [],
            "nospace": [],
        }
    return _search_keys_fn([query])


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return f"sha256:{digest.hexdigest()}"


def resolve_catalog_version(catalog_path: Path | None, bundle_id: str) -> str | None:
    if catalog_path is None or not catalog_path.exists():
        return None
    try:
        payload = json.loads(catalog_path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        return None
    if not isinstance(payload, dict):
        return None
    bundles = payload.get("bundles")
    if not isinstance(bundles, list):
        return None
    for bundle in bundles:
        if not isinstance(bundle, dict):
            continue
        if bundle.get("bundle_id") != bundle_id:
            continue
        version = bundle.get("version")
        if isinstance(version, str) and version.strip():
            return version.strip()
        return None
    return None


def result_status_from_count(result_count: int) -> str:
    if result_count == 0:
        return "miss"
    if result_count == 1:
        return "hit_single"
    return "hit_multi"


def derive_deep_ladder(matched_key_type: str) -> bool:
    return matched_key_type in DEEP_LADDER_KEY_TYPES


def validate_bundle_metadata(bundle_path: Path, manifest: MatrixManifest) -> None:
    bundle_dir = bundle_path.resolve()
    if not bundle_dir.is_dir():
        raise BundleMetadataError(f"bundle path is not a directory: {bundle_dir}")

    if bundle_dir.name != manifest.bundle_id:
        raise BundleMetadataError(
            "bundle directory basename must match manifest.bundle_id: "
            f"expected {manifest.bundle_id!r}, got {bundle_dir.name!r}"
        )

    bundle_manifest_path = bundle_dir / "bundle.manifest.json"
    if not bundle_manifest_path.exists():
        raise BundleMetadataError("bundle.manifest.json is missing")

    try:
        bundle_manifest = json.loads(bundle_manifest_path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise BundleMetadataError(
            f"bundle.manifest.json is invalid: {exc}"
        ) from exc

    if not isinstance(bundle_manifest, dict):
        raise BundleMetadataError("bundle.manifest.json must be a JSON object")

    rule_versions = bundle_manifest.get("rule_versions") or {}
    bundle_norm = rule_versions.get("normalization")
    if isinstance(bundle_norm, str) and bundle_norm != manifest.norm_version:
        raise BundleMetadataError(
            "bundle manifest norm version must match matrix manifest norm_version: "
            f"expected {manifest.norm_version!r}, got {bundle_norm!r}"
        )


def verify_search_index_checksum(bundle_path: Path, manifest: MatrixManifest) -> str:
    search_index_path = bundle_path / "search_index.jsonl"
    if not search_index_path.is_file():
        raise BundleMetadataError("search_index.jsonl is missing")

    actual = sha256_file(search_index_path)
    if actual != manifest.search_index_sha256:
        raise SearchIndexChecksumError(
            "search_index.jsonl checksum mismatch: "
            f"expected {manifest.search_index_sha256!r}, got {actual!r}"
        )
    return actual


def _format_value(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True)


def compare_case(case: SearchRegressionCase, replay: CaseReplayResult) -> CaseReplayResult:
    mismatches: list[str] = []

    expected_fields: list[tuple[str, Any, Any]] = [
        ("actual_result_status", case.expected_result_status, replay.actual_result_status),
        ("actual_result_count", case.expected_result_count, replay.actual_result_count),
        ("actual_ir_ids", case.expected_ir_ids, replay.actual_ir_ids),
        (
            "actual_matched_key_type",
            case.expected_matched_key_type,
            replay.actual_matched_key_type,
        ),
        ("actual_matched_key", case.expected_matched_key, replay.actual_matched_key),
        ("actual_deep_ladder", case.expected_deep_ladder, replay.actual_deep_ladder),
    ]

    for field_name, expected, actual in expected_fields:
        if expected != actual:
            mismatches.append(
                f"{field_name}: expected {_format_value(expected)}, "
                f"got {_format_value(actual)}"
            )

    return CaseReplayResult(
        case_id=replay.case_id,
        query=replay.query,
        query_unicode_form=replay.query_unicode_form,
        direction=replay.direction,
        actual_result_status=replay.actual_result_status,
        actual_result_count=replay.actual_result_count,
        actual_ir_ids=replay.actual_ir_ids,
        actual_matched_key_type=replay.actual_matched_key_type,
        actual_matched_key=replay.actual_matched_key,
        actual_deep_ladder=replay.actual_deep_ladder,
        expected_match=len(mismatches) == 0,
        mismatches=mismatches,
    )


def _direction_prefix(direction: str) -> str:
    if direction == "source_to_target":
        return "src"
    if direction == "target_to_source":
        return "tgt"
    raise RegressionRunError(
        f"direction must be source_to_target or target_to_source, got {direction!r}"
    )


def _storage_key_type(direction: str, key_type: str) -> str:
    return f"{_direction_prefix(direction)}_{key_type}"


def lookup_query(
    search_index: dict[tuple[str, str], list[str]],
    query: str,
    direction: str,
) -> tuple[int, list[str], str, str | None]:
    keys = compute_search_keys_for_query(query)
    for key_type in KEY_TYPE_ORDER:
        for normalized_key in keys.get(key_type, []):
            if not normalized_key:
                continue
            storage_key_type = _storage_key_type(direction, key_type)
            ir_ids = search_index.get((storage_key_type, normalized_key))
            if ir_ids:
                return len(ir_ids), list(ir_ids), key_type, normalized_key
    return 0, [], "none", None


def replay_case(
    search_index: dict[tuple[str, str], list[str]],
    case: SearchRegressionCase,
) -> CaseReplayResult:
    result_count, ir_ids, matched_key_type, matched_key = lookup_query(
        search_index,
        case.query,
        case.direction,
    )
    actual_status = result_status_from_count(result_count)
    actual_deep_ladder = derive_deep_ladder(matched_key_type)

    provisional = CaseReplayResult(
        case_id=case.case_id,
        query=case.query,
        query_unicode_form=case.query_unicode_form,
        direction=case.direction,
        actual_result_status=actual_status,
        actual_result_count=result_count,
        actual_ir_ids=ir_ids,
        actual_matched_key_type=matched_key_type,
        actual_matched_key=matched_key,
        actual_deep_ladder=actual_deep_ladder,
        expected_match=True,
        mismatches=[],
    )
    return compare_case(case, provisional)


def run_search_regression(
    *,
    matrix_path: Path | str,
    manifest_path: Path | str,
    bundle_path: Path | str,
    catalog_path: Path | str | None = None,
) -> RegressionRunResult:
    cases = load_matrix_jsonl(matrix_path)
    manifest = load_matrix_manifest(manifest_path)
    bundle_dir = Path(bundle_path)
    catalog_file = Path(catalog_path) if catalog_path is not None else None

    validation_errors = validate_matrix(cases, manifest)
    if validation_errors:
        messages = "; ".join(str(error) for error in validation_errors)
        raise MatrixValidationFailure(messages)

    validate_bundle_metadata(bundle_dir, manifest)
    search_index_sha256 = verify_search_index_checksum(bundle_dir, manifest)

    search_index_path = bundle_dir / "search_index.jsonl"
    try:
        search_index = load_search_index(search_index_path)
    except SearchIndexLoadError as exc:
        raise RegressionRunError(str(exc)) from exc

    case_results = [replay_case(search_index, case) for case in cases]
    passed_case_count = sum(1 for case in case_results if case.expected_match)
    failed_case_count = len(case_results) - passed_case_count

    resolved_catalog = resolve_catalog_version(catalog_file, manifest.bundle_id)
    catalog_version = resolved_catalog or manifest.catalog_version

    return RegressionRunResult(
        schema_version=RUN_SCHEMA_VERSION,
        bundle_id=manifest.bundle_id,
        catalog_version=catalog_version,
        norm_version=manifest.norm_version,
        search_index_sha256=search_index_sha256,
        matrix_case_count=len(case_results),
        passed_case_count=passed_case_count,
        failed_case_count=failed_case_count,
        cases=case_results,
    )


def dumps_regression_result(result: RegressionRunResult) -> str:
    return json.dumps(result.to_dict(), ensure_ascii=False, indent=2) + "\n"
