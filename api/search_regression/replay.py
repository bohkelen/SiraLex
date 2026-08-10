"""Read-only Python replay runner for curated search regression matrices."""

from __future__ import annotations

import hashlib
import json
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Callable
from urllib.parse import urlparse

from query_evidence.replay import (  # noqa: E402
    SearchIndexLoadError,
    load_search_index,
)

from .schema import (
    DEFAULT_EXPECTED_ID_SPACE,
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


class TargetResolutionError(RegressionRunError):
    """Raised when resolved-target ID expansion fails closed."""


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
    expected_id_space: str = DEFAULT_EXPECTED_ID_SPACE
    actual_resolved_target_ir_ids: list[str] | None = None
    mismatches: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        if payload.get("actual_resolved_target_ir_ids") is None:
            del payload["actual_resolved_target_ir_ids"]
        return payload


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


def is_acceptable_bundle_artifact_dir_name(
    dir_name: str, bundle_id: str, content_sha256: str | None = None
) -> bool:
    """Accept logical id dirname or ML1C1A `{bundle_id}__{content_sha256_prefix8}`."""
    if dir_name == bundle_id:
        return True
    prefix = f"{bundle_id}__"
    if not dir_name.startswith(prefix):
        return False
    hash_prefix = dir_name[len(prefix) :]
    if len(hash_prefix) != 8 or any(c not in "0123456789abcdefABCDEF" for c in hash_prefix):
        return False
    if isinstance(content_sha256, str) and content_sha256.strip():
        hex_part = content_sha256.split(":", 1)[-1].lower()
        if not hex_part.startswith(hash_prefix.lower()):
            return False
    return True


def validate_bundle_metadata(bundle_path: Path, manifest: MatrixManifest) -> None:
    bundle_dir = bundle_path.resolve()
    if not bundle_dir.is_dir():
        raise BundleMetadataError(f"bundle path is not a directory: {bundle_dir}")

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

    manifest_bundle_id = bundle_manifest.get("bundle_id")
    if manifest_bundle_id != manifest.bundle_id:
        raise BundleMetadataError(
            "bundle.manifest.json bundle_id must match matrix manifest bundle_id: "
            f"expected {manifest.bundle_id!r}, got {manifest_bundle_id!r}"
        )

    content_sha = bundle_manifest.get("content_sha256")
    content_sha_str = content_sha if isinstance(content_sha, str) else None
    if not is_acceptable_bundle_artifact_dir_name(
        bundle_dir.name, manifest.bundle_id, content_sha_str
    ):
        raise BundleMetadataError(
            "bundle directory basename must match manifest.bundle_id "
            "or versioned artifact `{bundle_id}__{content_sha256_prefix8}`: "
            f"expected {manifest.bundle_id!r}, got {bundle_dir.name!r}"
        )

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


def load_bundle_records(records_path: Path) -> dict[str, dict[str, Any]]:
    """Load bundle records.jsonl keyed by ir_id."""
    if not records_path.is_file():
        raise BundleMetadataError(f"records.jsonl is missing: {records_path}")

    by_id: dict[str, dict[str, Any]] = {}
    with records_path.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            text = line.strip()
            if not text:
                continue
            try:
                record = json.loads(text)
            except json.JSONDecodeError as exc:
                raise BundleMetadataError(
                    f"records.jsonl line {line_number}: invalid JSON: {exc}"
                ) from exc
            if not isinstance(record, dict):
                raise BundleMetadataError(
                    f"records.jsonl line {line_number}: expected JSON object"
                )
            ir_id = record.get("ir_id")
            if not isinstance(ir_id, str) or not ir_id:
                raise BundleMetadataError(
                    f"records.jsonl line {line_number}: missing ir_id"
                )
            if ir_id in by_id:
                raise BundleMetadataError(
                    f"records.jsonl duplicate ir_id {ir_id!r}"
                )
            by_id[ir_id] = record
    return by_id


def _normalize_url_path(url: str) -> str:
    """Normalize a URL or relative lexicon path for durable suffix comparison."""
    text = url.strip()
    if not text:
        return ""
    parsed = urlparse(text)
    path = parsed.path if parsed.scheme or parsed.netloc else text
    # Collapse relative prefixes such as ../lexicon/d.htm
    parts = [part for part in path.replace("\\", "/").split("/") if part and part != "."]
    while ".." in parts:
        idx = parts.index("..")
        if idx == 0:
            parts.pop(0)
        else:
            del parts[idx - 1 : idx + 1]
    return "/".join(parts)


def urls_compatible(locator_url: str, lexicon_url: str) -> bool:
    """
    Compare mapping lexicon_url to lexicon record_locator.url_canonical.

    Exact match always wins. Relative Mali-Pense paths are accepted when the
    canonical URL path ends with the normalized relative path. Never uses
    display_text.
    """
    if locator_url == lexicon_url:
        return True
    left = _normalize_url_path(locator_url)
    right = _normalize_url_path(lexicon_url)
    if not left or not right:
        return False
    return left == right or left.endswith(right) or right.endswith(left)


def _durable_locator_refs(record: dict[str, Any]) -> list[tuple[str, str]]:
    """
    Collect durable (url_canonical, source_record_id) refs from a lexicon record.

    Sources:
    - record_locator
    - provenance.source.record_pointer (owner path)
    """
    refs: list[tuple[str, str]] = []
    seen: set[tuple[str, str]] = set()

    def add(url: Any, source_record_id: Any) -> None:
        if not isinstance(url, str) or not url:
            return
        if not isinstance(source_record_id, str) or not source_record_id:
            return
        key = (url, source_record_id)
        if key in seen:
            return
        seen.add(key)
        refs.append(key)

    locator = record.get("record_locator")
    if isinstance(locator, dict):
        add(locator.get("url_canonical"), locator.get("source_record_id"))

    provenance = record.get("provenance")
    if isinstance(provenance, dict):
        source = provenance.get("source")
        if isinstance(source, dict):
            pointer = source.get("record_pointer")
            if isinstance(pointer, dict):
                add(pointer.get("url_canonical"), pointer.get("source_record_id"))

    return refs


@dataclass(frozen=True)
class LexiconLocatorIndex:
    """Index lexicon records by durable source_record_id for fail-closed joins."""

    by_source_record_id: dict[str, list[dict[str, Any]]]

    @classmethod
    def from_records(cls, records_by_id: dict[str, dict[str, Any]]) -> LexiconLocatorIndex:
        by_sid: dict[str, list[dict[str, Any]]] = {}
        for record in records_by_id.values():
            if record.get("ir_kind") != "lexicon_entry":
                continue
            refs = _durable_locator_refs(record)
            if not refs:
                continue
            # Index once per distinct source_record_id on the record.
            for _url, source_record_id in refs:
                bucket = by_sid.setdefault(source_record_id, [])
                if record not in bucket:
                    bucket.append(record)
        return cls(by_source_record_id=by_sid)


def resolve_target_entry_to_ir_id(
    target_entry: dict[str, Any],
    locator_index: LexiconLocatorIndex,
    *,
    mapping_ir_id: str,
    entry_index: int,
) -> str:
    """
    Resolve one index_mapping target_entry to a unique lexicon ir_id.

    Uses only durable locator fields (anchor / lexicon_url / record_locator /
    provenance.record_pointer). Never matches on display_text.
    """
    if not isinstance(target_entry, dict):
        raise TargetResolutionError(
            f"mapping {mapping_ir_id!r} target_entries[{entry_index}] "
            "must be an object"
        )

    anchor = target_entry.get("anchor")
    lexicon_url = target_entry.get("lexicon_url")
    if not isinstance(anchor, str) or not anchor:
        raise TargetResolutionError(
            f"mapping {mapping_ir_id!r} target_entries[{entry_index}] "
            "missing durable locator anchor"
        )
    if not isinstance(lexicon_url, str) or not lexicon_url:
        raise TargetResolutionError(
            f"mapping {mapping_ir_id!r} target_entries[{entry_index}] "
            "missing durable locator lexicon_url"
        )

    candidates = list(locator_index.by_source_record_id.get(anchor, []))
    matched: list[dict[str, Any]] = []
    for record in candidates:
        for url_canonical, source_record_id in _durable_locator_refs(record):
            if source_record_id != anchor:
                continue
            if urls_compatible(url_canonical, lexicon_url):
                matched.append(record)
                break

    if not matched:
        raise TargetResolutionError(
            f"mapping {mapping_ir_id!r} target_entries[{entry_index}] "
            f"resolved to zero lexicon records for anchor={anchor!r} "
            f"lexicon_url={lexicon_url!r}"
        )

    unique_ids = sorted({str(record.get("ir_id")) for record in matched})
    if len(unique_ids) != 1:
        raise TargetResolutionError(
            f"mapping {mapping_ir_id!r} target_entries[{entry_index}] "
            f"resolved ambiguously to ir_ids={unique_ids} for anchor={anchor!r} "
            f"lexicon_url={lexicon_url!r}"
        )
    return unique_ids[0]


def resolve_direct_postings_to_target_ir_ids(
    direct_ir_ids: list[str],
    records_by_id: dict[str, dict[str, Any]],
    locator_index: LexiconLocatorIndex | None = None,
) -> list[str]:
    """
    Expand ordered direct source posting IDs into resolved target lexicon IDs.

    Preserves target_entries order within each mapping and mapping order across
    direct postings.
    """
    index = locator_index or LexiconLocatorIndex.from_records(records_by_id)
    resolved: list[str] = []

    for posting_id in direct_ir_ids:
        record = records_by_id.get(posting_id)
        if record is None:
            raise TargetResolutionError(
                f"direct posting ID missing from bundle records: {posting_id!r}"
            )
        if record.get("ir_kind") != "index_mapping":
            raise TargetResolutionError(
                f"direct posting ID {posting_id!r} is not an index_mapping record"
            )
        display = record.get("display")
        if not isinstance(display, dict):
            raise TargetResolutionError(
                f"mapping {posting_id!r} missing display object"
            )
        target_entries = display.get("target_entries")
        if not isinstance(target_entries, list):
            raise TargetResolutionError(
                f"mapping {posting_id!r} missing display.target_entries list"
            )
        for entry_index, entry in enumerate(target_entries):
            if not isinstance(entry, dict):
                raise TargetResolutionError(
                    f"mapping {posting_id!r} target_entries[{entry_index}] "
                    "must be an object"
                )
            resolved.append(
                resolve_target_entry_to_ir_id(
                    entry,
                    index,
                    mapping_ir_id=posting_id,
                    entry_index=entry_index,
                )
            )
    return resolved


def compare_case(case: SearchRegressionCase, replay: CaseReplayResult) -> CaseReplayResult:
    mismatches: list[str] = []
    id_space = case.expected_id_space

    if id_space == "resolved_target_ir_ids":
        actual_ids = replay.actual_resolved_target_ir_ids
        if actual_ids is None:
            mismatches.append(
                "resolved target lexicon IDs: missing actual_resolved_target_ir_ids"
            )
            actual_ids = []
        id_field_label = "resolved target lexicon IDs (actual_resolved_target_ir_ids)"
        expected_fields: list[tuple[str, Any, Any]] = [
            ("actual_result_status", case.expected_result_status, replay.actual_result_status),
            ("actual_result_count", case.expected_result_count, replay.actual_result_count),
            (id_field_label, case.expected_ir_ids, actual_ids),
            (
                "actual_matched_key_type",
                case.expected_matched_key_type,
                replay.actual_matched_key_type,
            ),
            ("actual_matched_key", case.expected_matched_key, replay.actual_matched_key),
            ("actual_deep_ladder", case.expected_deep_ladder, replay.actual_deep_ladder),
        ]
    else:
        expected_fields = [
            ("actual_result_status", case.expected_result_status, replay.actual_result_status),
            ("actual_result_count", case.expected_result_count, replay.actual_result_count),
            (
                "direct source posting IDs (actual_ir_ids)",
                case.expected_ir_ids,
                replay.actual_ir_ids,
            ),
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
        expected_id_space=id_space,
        actual_resolved_target_ir_ids=replay.actual_resolved_target_ir_ids,
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
    *,
    records_by_id: dict[str, dict[str, Any]] | None = None,
    locator_index: LexiconLocatorIndex | None = None,
) -> CaseReplayResult:
    result_count, ir_ids, matched_key_type, matched_key = lookup_query(
        search_index,
        case.query,
        case.direction,
    )
    actual_deep_ladder = derive_deep_ladder(matched_key_type)
    expected_id_space = case.expected_id_space
    actual_resolved: list[str] | None = None
    actual_status = result_status_from_count(result_count)
    actual_count = result_count

    if expected_id_space == "resolved_target_ir_ids":
        if case.direction != "source_to_target":
            raise TargetResolutionError(
                f"case {case.case_id!r}: resolved_target_ir_ids requires "
                "direction source_to_target"
            )
        if records_by_id is None:
            raise TargetResolutionError(
                f"case {case.case_id!r}: resolved_target_ir_ids requires "
                "bundle records.jsonl"
            )
        actual_resolved = resolve_direct_postings_to_target_ir_ids(
            ir_ids,
            records_by_id,
            locator_index=locator_index,
        )
        actual_count = len(actual_resolved)
        actual_status = result_status_from_count(actual_count)

    provisional = CaseReplayResult(
        case_id=case.case_id,
        query=case.query,
        query_unicode_form=case.query_unicode_form,
        direction=case.direction,
        actual_result_status=actual_status,
        actual_result_count=actual_count,
        actual_ir_ids=ir_ids,
        actual_matched_key_type=matched_key_type,
        actual_matched_key=matched_key,
        actual_deep_ladder=actual_deep_ladder,
        expected_match=True,
        expected_id_space=expected_id_space,
        actual_resolved_target_ir_ids=actual_resolved,
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

    needs_records = any(
        case.expected_id_space == "resolved_target_ir_ids" for case in cases
    )
    records_by_id: dict[str, dict[str, Any]] | None = None
    locator_index: LexiconLocatorIndex | None = None
    if needs_records:
        records_by_id = load_bundle_records(bundle_dir / "records.jsonl")
        locator_index = LexiconLocatorIndex.from_records(records_by_id)

    case_results = [
        replay_case(
            search_index,
            case,
            records_by_id=records_by_id,
            locator_index=locator_index,
        )
        for case in cases
    ]
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
