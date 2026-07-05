"""Validate reviewed source-side alias tables against records and a base index."""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

# Add shared to path for normalization imports, matching the normalizer package.
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "shared"))

from normalization.norm_v3 import compute_search_keys

SCHEMA_VERSION = "source_alias_table_v1"
SOURCE_DIRECTION = "source_to_target"

KEY_TYPE_ORDER = ("casefold", "diacritics_insensitive", "punct_stripped", "nospace")
SOURCE_KEY_TYPES = tuple(f"src_{key_type}" for key_type in KEY_TYPE_ORDER)

ALLOWED_STATUSES = {"candidate", "approved", "rejected", "deferred"}
APPLICABLE_STATUS = "approved"
REVIEW_STATUSES = {"candidate", "deferred"}
ALLOWED_CANDIDATE_TYPES = {
    "french_plural_singular_alias",
    "french_gender_alias",
    "hyphenation_or_compound_alias",
    "french_common_form_alias",
}
REQUIRED_FIELDS = {
    "schema_version",
    "alias_table_version",
    "alias_id",
    "status",
    "direction",
    "alias_source_term",
    "canonical_source_terms",
    "resolved_ir_ids",
    "candidate_type",
    "evidence_ir_ids",
    "rationale",
    "source_bundle_id",
    "source_norm_version",
}
APPROVED_REQUIRED_FIELDS = {"reviewer", "reviewed_at"}


class AliasValidationError(ValueError):
    """Raised when a source alias table is invalid."""


@dataclass(frozen=True)
class AliasRow:
    """Parsed source alias row with source location metadata."""

    row: dict[str, Any]
    line_number: int

    @property
    def alias_id(self) -> str:
        return str(self.row.get("alias_id", ""))

    @property
    def status(self) -> str:
        return str(self.row.get("status", ""))

    @property
    def alias_source_term(self) -> str:
        return str(self.row.get("alias_source_term", ""))

    @property
    def alias_table_version(self) -> str:
        return str(self.row.get("alias_table_version", ""))

    @property
    def canonical_source_terms(self) -> list[str]:
        values = self.row.get("canonical_source_terms", [])
        return [str(value) for value in values] if isinstance(values, list) else []

    @property
    def resolved_ir_ids(self) -> list[str]:
        values = self.row.get("resolved_ir_ids", [])
        return [str(value) for value in values] if isinstance(values, list) else []


@dataclass(frozen=True)
class AliasOutcome:
    alias_id: str
    status: str
    alias_source_term: str
    canonical_source_terms: list[str]
    resolved_ir_ids: list[str]
    generated_key_types: list[str]
    outcome: str
    reason: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "alias_id": self.alias_id,
            "status": self.status,
            "alias_source_term": self.alias_source_term,
            "canonical_source_terms": self.canonical_source_terms,
            "resolved_ir_ids": self.resolved_ir_ids,
            "generated_key_types": self.generated_key_types,
            "outcome": self.outcome,
            "reason": self.reason,
        }


@dataclass(frozen=True)
class AliasValidationResult:
    rows: list[AliasRow]
    outcomes: list[AliasOutcome]
    alias_table_versions: list[str]
    schema_versions: list[str]
    summary: dict[str, int] = field(default_factory=dict)


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    objects: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, 1):
            text = line.strip()
            if not text:
                continue
            try:
                payload = json.loads(text)
            except json.JSONDecodeError as exc:
                raise AliasValidationError(f"{path}:{line_number}: invalid JSON: {exc}") from exc
            if not isinstance(payload, dict):
                raise AliasValidationError(f"{path}:{line_number}: expected JSON object")
            objects.append(payload)
    return objects


def load_records_by_id(records_path: Path) -> dict[str, dict[str, Any]]:
    by_id: dict[str, dict[str, Any]] = {}
    with records_path.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, 1):
            text = line.strip()
            if not text:
                continue
            try:
                record = json.loads(text)
            except json.JSONDecodeError as exc:
                raise AliasValidationError(
                    f"{records_path}:{line_number}: invalid JSON: {exc}"
                ) from exc
            if not isinstance(record, dict):
                raise AliasValidationError(f"{records_path}:{line_number}: expected JSON object")
            ir_id = record.get("ir_id")
            if not isinstance(ir_id, str) or not ir_id:
                raise AliasValidationError(f"{records_path}:{line_number}: missing ir_id")
            if ir_id in by_id:
                raise AliasValidationError(f"{records_path}:{line_number}: duplicate ir_id {ir_id}")
            by_id[ir_id] = record
    return by_id


def load_search_index(index_path: Path) -> dict[tuple[str, str], list[str]]:
    index: dict[tuple[str, str], list[str]] = {}
    with index_path.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, 1):
            text = line.strip()
            if not text:
                continue
            try:
                entry = json.loads(text)
            except json.JSONDecodeError as exc:
                raise AliasValidationError(
                    f"{index_path}:{line_number}: invalid JSON: {exc}"
                ) from exc
            if not isinstance(entry, dict):
                raise AliasValidationError(f"{index_path}:{line_number}: expected JSON object")
            key_type = entry.get("key_type")
            key = entry.get("key")
            ir_ids = entry.get("ir_ids")
            if not isinstance(key_type, str) or not key_type:
                raise AliasValidationError(f"{index_path}:{line_number}: missing key_type")
            if not isinstance(key, str) or not key:
                raise AliasValidationError(f"{index_path}:{line_number}: missing key")
            if not isinstance(ir_ids, list) or not all(isinstance(x, str) for x in ir_ids):
                raise AliasValidationError(f"{index_path}:{line_number}: invalid ir_ids")
            compound_key = (key_type, key)
            if compound_key in index:
                raise AliasValidationError(
                    f"{index_path}:{line_number}: duplicate index key {compound_key}"
                )
            index[compound_key] = list(ir_ids)
    return index


def read_alias_rows(alias_table_path: Path) -> list[AliasRow]:
    rows: list[AliasRow] = []
    with alias_table_path.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, 1):
            text = line.strip()
            if not text:
                continue
            try:
                payload = json.loads(text)
            except json.JSONDecodeError as exc:
                raise AliasValidationError(
                    f"{alias_table_path}:{line_number}: invalid JSON: {exc}"
                ) from exc
            if not isinstance(payload, dict):
                raise AliasValidationError(f"{alias_table_path}:{line_number}: expected JSON object")
            rows.append(AliasRow(row=payload, line_number=line_number))
    return rows


def source_storage_key_type(key_type: str) -> str:
    return f"src_{key_type}"


def search_keys_for_source_term(term: str) -> list[tuple[str, str]]:
    keys = compute_search_keys([term])
    out: list[tuple[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for key_type in KEY_TYPE_ORDER:
        for key in keys.get(key_type, []):
            compound = (source_storage_key_type(key_type), key)
            if key and compound not in seen:
                seen.add(compound)
                out.append(compound)
    return out


def generated_key_types_for_source_term(term: str) -> list[str]:
    return sorted({key_type for key_type, _ in search_keys_for_source_term(term)})


def lookup_source_term(index: dict[tuple[str, str], list[str]], term: str) -> list[str]:
    """Resolve a source term through the same exactness ladder used by runtime search."""
    for key_type, key in search_keys_for_source_term(term):
        if key_type in SOURCE_KEY_TYPES and (ids := index.get((key_type, key))):
            return list(ids)
    return []


def resolve_canonical_source_terms(
    index: dict[tuple[str, str], list[str]], terms: list[str]
) -> list[str]:
    resolved: list[str] = []
    seen: set[str] = set()
    for term in terms:
        postings = lookup_source_term(index, term)
        if not postings:
            raise AliasValidationError(f"canonical source term {term!r} does not resolve")
        for ir_id in postings:
            if ir_id not in seen:
                seen.add(ir_id)
                resolved.append(ir_id)
    return resolved


def validate_row_shape(row: AliasRow, records_by_id: dict[str, dict[str, Any]]) -> None:
    missing = sorted(REQUIRED_FIELDS - set(row.row))
    if missing:
        raise AliasValidationError(f"line {row.line_number}: missing required fields {missing}")

    if row.row.get("schema_version") != SCHEMA_VERSION:
        raise AliasValidationError(f"line {row.line_number}: invalid schema_version")

    if row.status not in ALLOWED_STATUSES:
        raise AliasValidationError(f"line {row.line_number}: invalid status {row.status!r}")

    if row.row.get("direction") != SOURCE_DIRECTION:
        raise AliasValidationError(f"line {row.line_number}: direction must be {SOURCE_DIRECTION!r}")

    if row.status == APPLICABLE_STATUS:
        missing_approved = sorted(APPROVED_REQUIRED_FIELDS - set(row.row))
        if missing_approved:
            raise AliasValidationError(
                f"line {row.line_number}: approved alias missing fields {missing_approved}"
            )
        for field_name in APPROVED_REQUIRED_FIELDS:
            value = row.row.get(field_name)
            if not isinstance(value, str) or not value.strip():
                raise AliasValidationError(
                    f"line {row.line_number}: approved alias has invalid {field_name}"
                )

    if row.row.get("candidate_type") not in ALLOWED_CANDIDATE_TYPES:
        raise AliasValidationError(f"line {row.line_number}: invalid candidate_type")

    if not isinstance(row.row.get("alias_table_version"), str) or not row.alias_table_version:
        raise AliasValidationError(f"line {row.line_number}: invalid alias_table_version")

    if not isinstance(row.row.get("alias_id"), str) or not row.alias_id:
        raise AliasValidationError(f"line {row.line_number}: invalid alias_id")

    if not isinstance(row.row.get("alias_source_term"), str) or not row.alias_source_term.strip():
        raise AliasValidationError(f"line {row.line_number}: invalid alias_source_term")

    if (
        not isinstance(row.row.get("canonical_source_terms"), list)
        or len(row.canonical_source_terms) == 0
        or any(not term.strip() for term in row.canonical_source_terms)
    ):
        raise AliasValidationError(f"line {row.line_number}: invalid canonical_source_terms")

    if (
        not isinstance(row.row.get("resolved_ir_ids"), list)
        or (row.status == APPLICABLE_STATUS and len(row.resolved_ir_ids) == 0)
        or any(not ir_id.strip() for ir_id in row.resolved_ir_ids)
    ):
        raise AliasValidationError(f"line {row.line_number}: invalid resolved_ir_ids")

    if row.status == APPLICABLE_STATUS:
        missing_resolved = sorted(ir_id for ir_id in row.resolved_ir_ids if ir_id not in records_by_id)
        if missing_resolved:
            raise AliasValidationError(
                f"line {row.line_number}: resolved ir_id(s) not found {missing_resolved}"
            )

    evidence_ir_ids = row.row.get("evidence_ir_ids")
    if (
        not isinstance(evidence_ir_ids, list)
        or not evidence_ir_ids
        or any(not isinstance(ir_id, str) or not ir_id.strip() for ir_id in evidence_ir_ids)
    ):
        raise AliasValidationError(f"line {row.line_number}: invalid evidence_ir_ids")

    missing_evidence = sorted(ir_id for ir_id in evidence_ir_ids if ir_id not in records_by_id)
    if missing_evidence:
        raise AliasValidationError(
            f"line {row.line_number}: evidence ir_id(s) not found {missing_evidence}"
        )

    for field_name in ("rationale", "source_bundle_id", "source_norm_version"):
        value = row.row.get(field_name)
        if not isinstance(value, str) or not value.strip():
            raise AliasValidationError(f"line {row.line_number}: invalid {field_name}")


def validate_approved_row_against_index(
    row: AliasRow,
    index: dict[tuple[str, str], list[str]],
) -> AliasOutcome:
    recomputed = resolve_canonical_source_terms(index, row.canonical_source_terms)
    declared = row.resolved_ir_ids
    if recomputed != declared:
        raise AliasValidationError(
            f"{row.alias_id}: resolved_ir_ids mismatch; declared={declared} recomputed={recomputed}"
        )

    generated_keys = search_keys_for_source_term(row.alias_source_term)
    generated_key_types = sorted({key_type for key_type, _ in generated_keys})
    no_op_count = 0
    new_count = 0
    for compound_key in generated_keys:
        existing = index.get(compound_key)
        if existing is None:
            new_count += 1
            continue
        if existing == declared:
            no_op_count += 1
            continue
        raise AliasValidationError(
            f"{row.alias_id}: alias source key {compound_key} conflicts with existing postings; "
            f"existing={existing} alias={declared}"
        )

    if new_count == 0 and no_op_count > 0:
        return AliasOutcome(
            alias_id=row.alias_id,
            status=row.status,
            alias_source_term=row.alias_source_term,
            canonical_source_terms=row.canonical_source_terms,
            resolved_ir_ids=declared,
            generated_key_types=generated_key_types,
            outcome="skipped",
            reason="alias-derived source keys already exist with identical postings",
        )

    return AliasOutcome(
        alias_id=row.alias_id,
        status=row.status,
        alias_source_term=row.alias_source_term,
        canonical_source_terms=row.canonical_source_terms,
        resolved_ir_ids=declared,
        generated_key_types=generated_key_types,
        outcome="applied",
        reason="approved alias can generate absent source keys",
    )


def summarize_rows(rows: list[AliasRow], outcomes: list[AliasOutcome]) -> dict[str, int]:
    return {
        "approved_alias_count": sum(1 for row in rows if row.status == "approved"),
        "candidate_alias_count": sum(1 for row in rows if row.status in REVIEW_STATUSES),
        "rejected_alias_count": sum(1 for row in rows if row.status == "rejected"),
        "applied_alias_count": sum(1 for outcome in outcomes if outcome.outcome == "applied"),
        "skipped_alias_count": sum(1 for outcome in outcomes if outcome.outcome == "skipped"),
    }


def validate_alias_table(
    alias_table_path: Path,
    records_path: Path,
    search_index_path: Path,
) -> AliasValidationResult:
    records_by_id = load_records_by_id(records_path)
    index = load_search_index(search_index_path)
    rows = read_alias_rows(alias_table_path)

    seen_alias_ids: set[str] = set()
    outcomes: list[AliasOutcome] = []

    schema_versions = sorted({str(row.row.get("schema_version", "")) for row in rows})
    alias_table_versions = sorted({str(row.row.get("alias_table_version", "")) for row in rows})
    if len(schema_versions) > 1:
        raise AliasValidationError(f"mixed schema_version values in alias table: {schema_versions}")
    if len(alias_table_versions) > 1:
        raise AliasValidationError(
            f"mixed alias_table_version values in alias table: {alias_table_versions}"
        )

    for row in rows:
        if row.alias_id in seen_alias_ids:
            raise AliasValidationError(f"line {row.line_number}: duplicate alias_id {row.alias_id}")
        seen_alias_ids.add(row.alias_id)

        validate_row_shape(row, records_by_id)
        if row.status == APPLICABLE_STATUS:
            outcomes.append(validate_approved_row_against_index(row, index))

    return AliasValidationResult(
        rows=rows,
        outcomes=outcomes,
        alias_table_versions=alias_table_versions,
        schema_versions=schema_versions,
        summary=summarize_rows(rows, outcomes),
    )


def result_to_report(result: AliasValidationResult) -> dict[str, Any]:
    alias_table_version = (
        result.alias_table_versions[0]
        if len(result.alias_table_versions) == 1
        else "multiple"
    )
    schema_version = result.schema_versions[0] if len(result.schema_versions) == 1 else "multiple"
    return {
        "alias_tables": [
            {
                "schema_version": schema_version,
                "alias_table_version": alias_table_version,
                **result.summary,
            }
        ],
        "aliases": [outcome.to_dict() for outcome in result.outcomes],
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--aliases", type=Path, required=True, help="Source alias JSONL table")
    parser.add_argument("--records", type=Path, required=True, help="Bundle records.jsonl")
    parser.add_argument("--search-index", type=Path, required=True, help="Base search_index.jsonl")
    parser.add_argument("--output-report", type=Path, default=None, help="Optional report JSON path")
    args = parser.parse_args(argv)

    try:
        result = validate_alias_table(args.aliases, args.records, args.search_index)
    except AliasValidationError as exc:
        print(f"Source alias validation FAILED: {exc}", file=sys.stderr)
        return 1

    report = result_to_report(result)
    if args.output_report:
        args.output_report.parent.mkdir(parents=True, exist_ok=True)
        args.output_report.write_text(
            json.dumps(report, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
    print("Source alias validation PASSED.")
    for key, value in sorted(result.summary.items()):
        print(f"  {key}: {value}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
