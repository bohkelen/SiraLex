"""Validate reviewed source-index supplement tables against records and source index."""

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

SCHEMA_VERSION = "source_index_supplement_v1"
SOURCE_LANG = "fr"
APPLICABLE_STATUS = "approved"
KEY_TYPE_ORDER = ("casefold", "diacritics_insensitive", "punct_stripped", "nospace")
SOURCE_KEY_TYPES = tuple(f"src_{key_type}" for key_type in KEY_TYPE_ORDER)

ALLOWED_STATUSES = {"candidate", "approved", "rejected", "superseded"}
REVIEW_STATUSES = {"candidate"}
ALLOWED_SUPPLEMENT_MODES = {
    "new_source_mapping",
    "additive_source_mapping",
    "broad_umbrella_source_mapping",
}
ALLOWED_CANDIDATE_TYPES = {
    "missing_source_index_mapping",
    "incomplete_source_mapping",
    "broad_umbrella_source_mapping",
    "content_correction_candidate",
}
REQUIRED_FIELDS = {
    "schema_version",
    "supplement_table_version",
    "supplement_id",
    "status",
    "source_lang",
    "source_term",
    "source_display_text",
    "target_ir_ids",
    "target_forms",
    "target_notes",
    "candidate_type",
    "supplement_mode",
    "broad_mapping",
    "broad_mapping_rationale",
    "supporting_evidence_ir_ids",
    "supporting_source_terms",
    "rationale",
    "source_bundle_id",
    "source_norm_version",
}
APPROVED_REQUIRED_FIELDS = {"reviewer", "reviewed_at"}


class SupplementValidationError(ValueError):
    """Raised when a source-index supplement table is invalid."""


@dataclass(frozen=True)
class SupplementRow:
    """Parsed supplement row with source location metadata."""

    row: dict[str, Any]
    line_number: int

    @property
    def supplement_id(self) -> str:
        return str(self.row.get("supplement_id", ""))

    @property
    def status(self) -> str:
        return str(self.row.get("status", ""))

    @property
    def supplement_table_version(self) -> str:
        return str(self.row.get("supplement_table_version", ""))

    @property
    def supplement_mode(self) -> str:
        return str(self.row.get("supplement_mode", ""))

    @property
    def source_term(self) -> str:
        return str(self.row.get("source_term", ""))

    @property
    def target_ir_ids(self) -> list[str]:
        values = self.row.get("target_ir_ids", [])
        return [str(value) for value in values] if isinstance(values, list) else []

    @property
    def target_forms(self) -> list[str]:
        values = self.row.get("target_forms", [])
        return [str(value) for value in values] if isinstance(values, list) else []


@dataclass(frozen=True)
class SupplementOutcome:
    supplement_id: str
    status: str
    source_term: str
    supplement_mode: str
    target_ir_ids: list[str]
    generated_key_types: list[str]
    outcome: str
    reason: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "supplement_id": self.supplement_id,
            "status": self.status,
            "source_term": self.source_term,
            "supplement_mode": self.supplement_mode,
            "target_ir_ids": self.target_ir_ids,
            "generated_key_types": self.generated_key_types,
            "outcome": self.outcome,
            "reason": self.reason,
        }


@dataclass(frozen=True)
class SupplementValidationResult:
    rows: list[SupplementRow]
    outcomes: list[SupplementOutcome]
    supplement_table_versions: list[str]
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
                raise SupplementValidationError(
                    f"{path}:{line_number}: invalid JSON: {exc}"
                ) from exc
            if not isinstance(payload, dict):
                raise SupplementValidationError(f"{path}:{line_number}: expected JSON object")
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
                raise SupplementValidationError(
                    f"{records_path}:{line_number}: invalid JSON: {exc}"
                ) from exc
            if not isinstance(record, dict):
                raise SupplementValidationError(f"{records_path}:{line_number}: expected JSON object")
            ir_id = record.get("ir_id")
            if not isinstance(ir_id, str) or not ir_id:
                raise SupplementValidationError(f"{records_path}:{line_number}: missing ir_id")
            if ir_id in by_id:
                raise SupplementValidationError(f"{records_path}:{line_number}: duplicate ir_id {ir_id}")
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
                raise SupplementValidationError(
                    f"{index_path}:{line_number}: invalid JSON: {exc}"
                ) from exc
            if not isinstance(entry, dict):
                raise SupplementValidationError(f"{index_path}:{line_number}: expected JSON object")
            key_type = entry.get("key_type")
            key = entry.get("key")
            ir_ids = entry.get("ir_ids")
            if not isinstance(key_type, str) or not key_type:
                raise SupplementValidationError(f"{index_path}:{line_number}: missing key_type")
            if not isinstance(key, str) or not key:
                raise SupplementValidationError(f"{index_path}:{line_number}: missing key")
            if not isinstance(ir_ids, list) or not all(isinstance(x, str) for x in ir_ids):
                raise SupplementValidationError(f"{index_path}:{line_number}: invalid ir_ids")
            compound_key = (key_type, key)
            if compound_key in index:
                raise SupplementValidationError(
                    f"{index_path}:{line_number}: duplicate index key {compound_key}"
                )
            index[compound_key] = list(ir_ids)
    return index


def read_supplement_rows(supplement_table_path: Path) -> list[SupplementRow]:
    rows: list[SupplementRow] = []
    with supplement_table_path.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, 1):
            text = line.strip()
            if not text:
                continue
            try:
                payload = json.loads(text)
            except json.JSONDecodeError as exc:
                raise SupplementValidationError(
                    f"{supplement_table_path}:{line_number}: invalid JSON: {exc}"
                ) from exc
            if not isinstance(payload, dict):
                raise SupplementValidationError(
                    f"{supplement_table_path}:{line_number}: expected JSON object"
                )
            rows.append(SupplementRow(row=payload, line_number=line_number))
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
    for key_type, key in search_keys_for_source_term(term):
        if key_type in SOURCE_KEY_TYPES and (ids := index.get((key_type, key))):
            return list(ids)
    return []


def _string_list(value: Any, *, allow_empty: bool = False) -> bool:
    return (
        isinstance(value, list)
        and (allow_empty or bool(value))
        and all(isinstance(item, str) and item.strip() for item in value)
    )


def _attested_forms(record: dict[str, Any]) -> set[str]:
    forms: set[str] = set()
    for field_name in ("preferred_form",):
        value = record.get(field_name)
        if isinstance(value, str) and value:
            forms.add(value)
    for field_name in ("variant_forms",):
        values = record.get(field_name)
        if isinstance(values, list):
            forms.update(value for value in values if isinstance(value, str) and value)
    display = record.get("display")
    if isinstance(display, dict):
        headword = display.get("headword_latin")
        if isinstance(headword, str) and headword:
            forms.add(headword)
        anchors = display.get("anchor_names")
        if isinstance(anchors, list):
            forms.update(value for value in anchors if isinstance(value, str) and value)
    search_keys = record.get("search_keys")
    if isinstance(search_keys, dict):
        for values in search_keys.values():
            if isinstance(values, list):
                forms.update(value for value in values if isinstance(value, str) and value)
    return forms


def _has_display(record: dict[str, Any]) -> bool:
    display = record.get("display")
    if not isinstance(display, dict):
        return False
    if isinstance(display.get("headword_latin"), str) and display["headword_latin"].strip():
        return True
    if isinstance(record.get("preferred_form"), str) and record["preferred_form"].strip():
        return True
    return False


def _validate_target_notes(row: SupplementRow) -> None:
    target_notes = row.row.get("target_notes")
    if not isinstance(target_notes, list):
        raise SupplementValidationError(f"line {row.line_number}: invalid target_notes")
    if row.row.get("broad_mapping") is True and not target_notes:
        raise SupplementValidationError(
            f"line {row.line_number}: broad mappings require target_notes"
        )
    for note in target_notes:
        if not isinstance(note, dict):
            raise SupplementValidationError(f"line {row.line_number}: target_notes must be objects")
        target_ir_id = note.get("target_ir_id")
        target_form = note.get("target_form")
        if not isinstance(target_ir_id, str) or target_ir_id not in row.target_ir_ids:
            raise SupplementValidationError(
                f"line {row.line_number}: target_note has invalid target_ir_id"
            )
        if not isinstance(target_form, str) or target_form not in row.target_forms:
            raise SupplementValidationError(
                f"line {row.line_number}: target_note has invalid target_form"
            )
        if row.row.get("broad_mapping") is True:
            label = note.get("label")
            note_text = note.get("note")
            if not (
                isinstance(label, str)
                and label.strip()
                or isinstance(note_text, str)
                and note_text.strip()
            ):
                raise SupplementValidationError(
                    f"line {row.line_number}: broad target_notes require label or note"
                )


def validate_row_shape(row: SupplementRow, records_by_id: dict[str, dict[str, Any]]) -> None:
    missing = sorted(REQUIRED_FIELDS - set(row.row))
    if missing:
        raise SupplementValidationError(f"line {row.line_number}: missing required fields {missing}")

    if row.row.get("schema_version") != SCHEMA_VERSION:
        raise SupplementValidationError(f"line {row.line_number}: invalid schema_version")

    if row.status not in ALLOWED_STATUSES:
        raise SupplementValidationError(f"line {row.line_number}: invalid status {row.status!r}")

    if row.row.get("source_lang") != SOURCE_LANG:
        raise SupplementValidationError(f"line {row.line_number}: source_lang must be {SOURCE_LANG!r}")

    if row.supplement_mode not in ALLOWED_SUPPLEMENT_MODES:
        raise SupplementValidationError(f"line {row.line_number}: invalid supplement_mode")

    if row.row.get("candidate_type") not in ALLOWED_CANDIDATE_TYPES:
        raise SupplementValidationError(f"line {row.line_number}: invalid candidate_type")

    if not isinstance(row.row.get("supplement_table_version"), str) or not row.supplement_table_version:
        raise SupplementValidationError(f"line {row.line_number}: invalid supplement_table_version")

    if not isinstance(row.row.get("supplement_id"), str) or not row.supplement_id:
        raise SupplementValidationError(f"line {row.line_number}: invalid supplement_id")

    if not isinstance(row.row.get("source_term"), str) or not row.source_term.strip():
        raise SupplementValidationError(f"line {row.line_number}: invalid source_term")

    if not isinstance(row.row.get("source_display_text"), str) or not row.row["source_display_text"].strip():
        raise SupplementValidationError(f"line {row.line_number}: invalid source_display_text")

    if not _string_list(row.row.get("target_ir_ids")):
        raise SupplementValidationError(f"line {row.line_number}: invalid target_ir_ids")
    if not _string_list(row.row.get("target_forms")):
        raise SupplementValidationError(f"line {row.line_number}: invalid target_forms")
    if len(row.target_ir_ids) != len(row.target_forms):
        raise SupplementValidationError(
            f"line {row.line_number}: target_ir_ids and target_forms must have same length"
        )

    for field_name in ("supporting_evidence_ir_ids", "supporting_source_terms"):
        if not _string_list(row.row.get(field_name)):
            raise SupplementValidationError(f"line {row.line_number}: invalid {field_name}")

    for field_name in ("rationale", "source_bundle_id", "source_norm_version"):
        value = row.row.get(field_name)
        if not isinstance(value, str) or not value.strip():
            raise SupplementValidationError(f"line {row.line_number}: invalid {field_name}")

    if row.row.get("source_norm_version") != "norm_v3":
        raise SupplementValidationError(f"line {row.line_number}: source_norm_version must be 'norm_v3'")

    if row.status == APPLICABLE_STATUS:
        missing_approved = sorted(APPROVED_REQUIRED_FIELDS - set(row.row))
        if missing_approved:
            raise SupplementValidationError(
                f"line {row.line_number}: approved supplement missing fields {missing_approved}"
            )
        for field_name in APPROVED_REQUIRED_FIELDS:
            value = row.row.get(field_name)
            if not isinstance(value, str) or not value.strip():
                raise SupplementValidationError(
                    f"line {row.line_number}: approved supplement has invalid {field_name}"
                )

    broad_mapping = row.row.get("broad_mapping")
    if not isinstance(broad_mapping, bool):
        raise SupplementValidationError(f"line {row.line_number}: broad_mapping must be boolean")
    broad_rationale = row.row.get("broad_mapping_rationale")
    if broad_mapping:
        if not isinstance(broad_rationale, str) or not broad_rationale.strip():
            raise SupplementValidationError(
                f"line {row.line_number}: broad mappings require broad_mapping_rationale"
            )
    elif not isinstance(broad_rationale, str):
        raise SupplementValidationError(f"line {row.line_number}: invalid broad_mapping_rationale")

    if row.supplement_mode == "broad_umbrella_source_mapping" and broad_mapping is not True:
        raise SupplementValidationError(
            f"line {row.line_number}: broad_umbrella_source_mapping requires broad_mapping"
        )

    _validate_target_notes(row)

    missing_targets = sorted(ir_id for ir_id in row.target_ir_ids if ir_id not in records_by_id)
    if missing_targets:
        raise SupplementValidationError(
            f"line {row.line_number}: target ir_id(s) not found {missing_targets}"
        )
    missing_evidence = sorted(
        ir_id for ir_id in row.row["supporting_evidence_ir_ids"] if ir_id not in records_by_id
    )
    if missing_evidence:
        raise SupplementValidationError(
            f"line {row.line_number}: evidence ir_id(s) not found {missing_evidence}"
        )

    for target_ir_id, target_form in zip(row.target_ir_ids, row.target_forms, strict=True):
        record = records_by_id[target_ir_id]
        if record.get("ir_kind") != "lexicon_entry":
            raise SupplementValidationError(
                f"line {row.line_number}: target {target_ir_id} is not lexicon_entry"
            )
        if not _has_display(record):
            raise SupplementValidationError(
                f"line {row.line_number}: target {target_ir_id} missing display"
            )
        if target_form not in _attested_forms(record):
            raise SupplementValidationError(
                f"line {row.line_number}: target form {target_form!r} is not attested "
                f"on {target_ir_id}"
            )


def validate_approved_row_against_index(
    row: SupplementRow,
    index: dict[tuple[str, str], list[str]],
    *,
    defer_index_conflicts: bool = False,
) -> SupplementOutcome:
    generated_keys = search_keys_for_source_term(row.source_term)
    generated_key_types = sorted({key_type for key_type, _ in generated_keys})
    existing_postings = lookup_source_term(index, row.source_term)

    if row.supplement_mode == "new_source_mapping":
        if existing_postings and not defer_index_conflicts:
            raise SupplementValidationError(
                f"{row.supplement_id}: new_source_mapping conflicts with existing source "
                f"term {row.source_term!r}; existing={existing_postings}"
            )
        return SupplementOutcome(
            supplement_id=row.supplement_id,
            status=row.status,
            source_term=row.source_term,
            supplement_mode=row.supplement_mode,
            target_ir_ids=row.target_ir_ids,
            generated_key_types=generated_key_types,
            outcome="applied",
            reason="approved supplement can generate a new source mapping",
        )

    if row.supplement_mode == "additive_source_mapping":
        if not existing_postings and not defer_index_conflicts:
            raise SupplementValidationError(
                f"{row.supplement_id}: additive_source_mapping requires existing source term "
                f"{row.source_term!r}"
            )
        return SupplementOutcome(
            supplement_id=row.supplement_id,
            status=row.status,
            source_term=row.source_term,
            supplement_mode=row.supplement_mode,
            target_ir_ids=row.target_ir_ids,
            generated_key_types=generated_key_types,
            outcome="applied",
            reason="approved supplement can add a reviewed target mapping to an existing source term",
        )

    if row.supplement_mode == "broad_umbrella_source_mapping":
        return SupplementOutcome(
            supplement_id=row.supplement_id,
            status=row.status,
            source_term=row.source_term,
            supplement_mode=row.supplement_mode,
            target_ir_ids=row.target_ir_ids,
            generated_key_types=generated_key_types,
            outcome="applied",
            reason="approved supplement can generate a broad umbrella source mapping",
        )

    raise SupplementValidationError(f"{row.supplement_id}: invalid supplement_mode")


def summarize_rows(rows: list[SupplementRow], outcomes: list[SupplementOutcome]) -> dict[str, int]:
    return {
        "approved_supplement_count": sum(1 for row in rows if row.status == APPLICABLE_STATUS),
        "candidate_supplement_count": sum(1 for row in rows if row.status in REVIEW_STATUSES),
        "rejected_supplement_count": sum(1 for row in rows if row.status == "rejected"),
        "superseded_supplement_count": sum(1 for row in rows if row.status == "superseded"),
        "applied_supplement_count": sum(1 for outcome in outcomes if outcome.outcome == "applied"),
    }


def validate_supplement_table(
    supplement_table_path: Path,
    records_path: Path,
    search_index_path: Path,
    *,
    defer_index_conflicts: bool = False,
) -> SupplementValidationResult:
    records_by_id = load_records_by_id(records_path)
    index = load_search_index(search_index_path)
    rows = read_supplement_rows(supplement_table_path)

    seen_supplement_ids: set[str] = set()
    outcomes: list[SupplementOutcome] = []

    schema_versions = sorted({str(row.row.get("schema_version", "")) for row in rows})
    supplement_table_versions = sorted(
        {str(row.row.get("supplement_table_version", "")) for row in rows}
    )
    if len(schema_versions) > 1:
        raise SupplementValidationError(
            f"mixed schema_version values in supplement table: {schema_versions}"
        )

    for row in rows:
        if row.supplement_id in seen_supplement_ids:
            raise SupplementValidationError(
                f"line {row.line_number}: duplicate supplement_id {row.supplement_id}"
            )
        seen_supplement_ids.add(row.supplement_id)

        validate_row_shape(row, records_by_id)
        if row.status == APPLICABLE_STATUS:
            outcomes.append(
                validate_approved_row_against_index(
                    row,
                    index,
                    defer_index_conflicts=defer_index_conflicts,
                )
            )

    return SupplementValidationResult(
        rows=rows,
        outcomes=outcomes,
        supplement_table_versions=supplement_table_versions,
        schema_versions=schema_versions,
        summary=summarize_rows(rows, outcomes),
    )


def result_to_report(result: SupplementValidationResult) -> dict[str, Any]:
    supplement_table_version = (
        result.supplement_table_versions[0]
        if len(result.supplement_table_versions) == 1
        else "multiple"
    )
    schema_version = result.schema_versions[0] if len(result.schema_versions) == 1 else "multiple"
    return {
        "source_index_supplement_tables": [
            {
                "schema_version": schema_version,
                "supplement_table_version": supplement_table_version,
                **result.summary,
            }
        ],
        "supplements": [outcome.to_dict() for outcome in result.outcomes],
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--supplements", type=Path, required=True, help="Source supplement JSONL table")
    parser.add_argument("--records", type=Path, required=True, help="Bundle records.jsonl")
    parser.add_argument("--search-index", type=Path, required=True, help="Base search_index.jsonl")
    parser.add_argument("--output-report", type=Path, default=None, help="Optional report JSON path")
    parser.add_argument(
        "--defer-index-conflicts",
        action="store_true",
        help=(
            "Defer source-index precondition conflicts so replay-aware generation/merge "
            "can classify applied vs already_present vs conflict."
        ),
    )
    args = parser.parse_args(argv)

    try:
        result = validate_supplement_table(
            args.supplements,
            args.records,
            args.search_index,
            defer_index_conflicts=args.defer_index_conflicts,
        )
    except SupplementValidationError as exc:
        print(f"Source-index supplement validation FAILED: {exc}", file=sys.stderr)
        return 1

    report = result_to_report(result)
    if args.output_report:
        args.output_report.parent.mkdir(parents=True, exist_ok=True)
        args.output_report.write_text(
            json.dumps(report, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
    print("Source-index supplement validation PASSED.")
    for key, value in sorted(result.summary.items()):
        print(f"  {key}: {value}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
