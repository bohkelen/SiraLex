"""Generate supplement-derived index_mapping records from approved supplement rows."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import Any

# Add shared to path for normalization imports, matching the normalizer package.
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "shared"))

from normalization.norm_v3 import compute_search_keys
from ir.lexical_review import SIRALEX_LEXICAL_REVIEW_SOURCE_ID

from .validate_supplements import (
    APPLICABLE_STATUS,
    OwnerLexicalInput,
    SupplementRow,
    SupplementValidationError,
    load_search_index,
    load_records_by_id,
    load_owner_lexical_input,
    result_to_report,
    search_keys_for_source_term,
    validate_owner_target_evidence,
    validate_supplement_table,
)


class SupplementGenerationError(RuntimeError):
    """Raised when approved supplements cannot be generated cleanly."""


def generated_ir_id(row: SupplementRow) -> str:
    """Return a stable generated record id for an approved supplement row."""
    payload = "|".join(
        [
            "source_index_supplement_v1",
            row.supplement_id,
            row.source_term,
            ",".join(row.target_ir_ids),
        ]
    )
    return "ff" + hashlib.sha256(payload.encode("utf-8")).hexdigest()[:14]


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def target_display_text(record: dict[str, Any], fallback: str) -> str:
    display = record.get("display")
    if isinstance(display, dict):
        headword = display.get("headword_latin")
        if isinstance(headword, str) and headword.strip():
            return headword
    preferred_form = record.get("preferred_form")
    if isinstance(preferred_form, str) and preferred_form.strip():
        return preferred_form
    return fallback


def _target_entry_from_evidence(
    row: SupplementRow,
    records_by_id: dict[str, dict[str, Any]],
    target_form: str,
) -> dict[str, str] | None:
    """Copy a real target_entries item from supporting index mappings when available."""
    for evidence_ir_id in row.row.get("supporting_evidence_ir_ids", []):
        evidence = records_by_id.get(evidence_ir_id)
        if not evidence or evidence.get("ir_kind") != "index_mapping":
            continue
        display = evidence.get("display")
        if not isinstance(display, dict):
            continue
        target_entries = display.get("target_entries")
        if not isinstance(target_entries, list):
            continue
        for target_entry in target_entries:
            if not isinstance(target_entry, dict):
                continue
            if target_entry.get("display_text") != target_form:
                continue
            lexicon_url = target_entry.get("lexicon_url")
            anchor = target_entry.get("anchor")
            display_text = target_entry.get("display_text")
            if (
                isinstance(lexicon_url, str)
                and lexicon_url
                and isinstance(anchor, str)
                and anchor
                and isinstance(display_text, str)
                and display_text
            ):
                return {
                    "lexicon_url": lexicon_url,
                    "anchor": anchor,
                    "display_text": display_text,
                }
    return None


def _target_entry_from_owner_adapter(
    row: SupplementRow,
    *,
    target_ir_id: str,
    target_form: str,
    target_record: dict[str, Any],
    owner_lexical_input: OwnerLexicalInput | None,
) -> dict[str, str] | None:
    owner_row = validate_owner_target_evidence(
        row=row,
        target_ir_id=target_ir_id,
        target_form=target_form,
        target_record=target_record,
        owner_lexical_input=owner_lexical_input,
    )
    if owner_row is None:
        return None
    locator = owner_row["record_locator"]
    headword = owner_row["fields_raw"]["headword_latin"]
    return {
        "lexicon_url": str(locator["url_canonical"]),
        "anchor": str(locator["source_record_id"]),
        "display_text": str(headword),
    }


def build_target_entries(
    row: SupplementRow,
    records_by_id: dict[str, dict[str, Any]],
    owner_lexical_input: OwnerLexicalInput | None,
) -> list[dict[str, str]]:
    entries: list[dict[str, str]] = []
    for target_ir_id, target_form in zip(row.target_ir_ids, row.target_forms, strict=True):
        target_record = records_by_id[target_ir_id]
        if target_record.get("source_id") == SIRALEX_LEXICAL_REVIEW_SOURCE_ID:
            # Owner-reviewed lexical targets must resolve through the validated owner adapter.
            owner_entry = _target_entry_from_owner_adapter(
                row,
                target_ir_id=target_ir_id,
                target_form=target_form,
                target_record=target_record,
                owner_lexical_input=owner_lexical_input,
            )
            if owner_entry is not None:
                entries.append(owner_entry)
                continue
            raise SupplementGenerationError(
                f"{row.supplement_id}: owner-reviewed target {target_ir_id} requires "
                "validated owner lexical evidence"
            )

        evidence_entry = _target_entry_from_evidence(row, records_by_id, target_form)
        if evidence_entry:
            entries.append(evidence_entry)
            continue
        raise SupplementGenerationError(
            f"{row.supplement_id}: no supporting index_mapping target_entry found "
            f"for target {target_ir_id} ({target_display_text(target_record, target_form)!r})"
        )
    return entries


def build_search_keys(source_term: str) -> dict[str, list[str]]:
    keys = compute_search_keys([source_term])
    return {
        key_type: [key for key in keys.get(key_type, []) if key]
        for key_type in ("casefold", "diacritics_insensitive", "punct_stripped", "nospace")
    }


def build_generated_record(
    row: SupplementRow,
    records_by_id: dict[str, dict[str, Any]],
    owner_lexical_input: OwnerLexicalInput | None,
) -> dict[str, Any]:
    target_records = [records_by_id[target_ir_id] for target_ir_id in row.target_ir_ids]
    source_ids = [
        record.get("source_id")
        for record in target_records
        if isinstance(record.get("source_id"), str) and record.get("source_id")
    ]
    source_id = source_ids[0] if source_ids else "src_malipense"
    source_display_text = str(row.row.get("source_display_text") or row.source_term)

    return {
        "ir_id": generated_ir_id(row),
        "ir_kind": "index_mapping",
        "source_id": source_id,
        "norm_version": row.row["source_norm_version"],
        "preferred_form": row.source_term,
        "variant_forms": [row.source_term],
        "search_keys": build_search_keys(row.source_term),
        "display": {
            "source_term": source_display_text,
            "source_lang": row.row["source_lang"],
            "target_entries": build_target_entries(row, records_by_id, owner_lexical_input),
        },
    }


def target_entries_projection(record: dict[str, Any]) -> list[dict[str, Any]]:
    display = record.get("display")
    target_entries = display.get("target_entries") if isinstance(display, dict) else None
    if not isinstance(target_entries, list):
        return []
    return [
        {
            "lexicon_url": entry.get("lexicon_url"),
            "anchor": entry.get("anchor"),
            "display_text": entry.get("display_text"),
        }
        for entry in target_entries
        if isinstance(entry, dict)
    ]


def generated_record_projection(record: dict[str, Any]) -> dict[str, Any]:
    display = record.get("display")
    display = display if isinstance(display, dict) else {}
    return {
        "ir_id": record.get("ir_id"),
        "ir_kind": record.get("ir_kind"),
        "source_id": record.get("source_id"),
        "norm_version": record.get("norm_version"),
        "preferred_form": record.get("preferred_form"),
        "variant_forms": record.get("variant_forms"),
        "search_keys": record.get("search_keys"),
        "display": {
            "source_term": display.get("source_term"),
            "source_lang": display.get("source_lang"),
            "target_entries": target_entries_projection(record),
        },
    }


def _projection_mismatch_reason(
    expected: dict[str, Any],
    existing: dict[str, Any],
) -> str:
    expected_projection = generated_record_projection(expected)
    existing_projection = generated_record_projection(existing)
    if existing_projection.get("ir_kind") != "index_mapping":
        return "generated_id_collision_unrelated_record"
    expected_targets = expected_projection["display"]["target_entries"]
    existing_targets = existing_projection["display"]["target_entries"]
    if expected_targets != existing_targets:
        return "target_entry_metadata_mismatch"
    return "generated_record_content_mismatch"


def _raise_conflict(row: SupplementRow, generated_id: str, reason: str, detail: str) -> None:
    raise SupplementGenerationError(
        f"{row.supplement_id}: {reason}; generated_ir_id={generated_id}; {detail}"
    )


def validate_source_key_state(
    row: SupplementRow,
    index: dict[tuple[str, str], list[str]],
    generated_id: str,
    *,
    already_present: bool,
) -> tuple[str, list[dict[str, Any]]]:
    operations: list[dict[str, Any]] = []
    for key_type, key in search_keys_for_source_term(row.source_term):
        compound = (key_type, key)
        previous = index.get(compound)
        previous_ids = list(previous) if previous is not None else []

        if len(previous_ids) != len(set(previous_ids)):
            _raise_conflict(
                row,
                generated_id,
                "source_key_duplicate_posting",
                f"{compound} has duplicate postings {previous_ids}",
            )

        if already_present:
            if previous is None or generated_id not in previous_ids:
                _raise_conflict(
                    row,
                    generated_id,
                    "source_key_missing_expected_posting",
                    f"{compound} is missing expected generated posting",
                )
            if row.supplement_mode in {"new_source_mapping", "broad_umbrella_source_mapping"}:
                if previous_ids != [generated_id]:
                    _raise_conflict(
                        row,
                        generated_id,
                        "source_key_unexpected_postings",
                        f"{compound} expected [{generated_id!r}], got {previous_ids}",
                    )
            elif row.supplement_mode == "additive_source_mapping":
                if previous_ids[-1] != generated_id:
                    _raise_conflict(
                        row,
                        generated_id,
                        "source_key_order_mismatch",
                        f"{compound} expected generated posting last, got {previous_ids}",
                    )
                if len(previous_ids) < 2:
                    _raise_conflict(
                        row,
                        generated_id,
                        "source_key_unexpected_postings",
                        f"{compound} missing pre-existing additive posting",
                    )
            else:
                _raise_conflict(
                    row,
                    generated_id,
                    "unsupported_supplement_mode",
                    f"unsupported supplement_mode {row.supplement_mode!r}",
                )
            operations.append(
                {
                    "key_type": key_type,
                    "key": key,
                    "previous_ir_ids": previous_ids,
                    "new_ir_ids": previous_ids,
                    "operation": "verified_existing_posting",
                }
            )
            continue

        if row.supplement_mode == "new_source_mapping":
            if previous is not None:
                _raise_conflict(
                    row,
                    generated_id,
                    "source_key_unexpected_postings",
                    f"{compound} expected absent key, got {previous_ids}",
                )
            new_ids = [generated_id]
            operation = "added_key"
        elif row.supplement_mode == "additive_source_mapping":
            if previous is None:
                _raise_conflict(
                    row,
                    generated_id,
                    "source_key_missing_existing_posting",
                    f"{compound} expected existing source key",
                )
            if generated_id in previous_ids:
                _raise_conflict(
                    row,
                    generated_id,
                    "source_key_unexpected_postings",
                    f"{compound} contains generated posting without generated record",
                )
            new_ids = [*previous_ids, generated_id]
            operation = "appended_posting"
        elif row.supplement_mode == "broad_umbrella_source_mapping":
            if previous is not None:
                _raise_conflict(
                    row,
                    generated_id,
                    "source_key_unexpected_postings",
                    f"{compound} expected absent broad umbrella key, got {previous_ids}",
                )
            new_ids = [generated_id]
            operation = "added_key"
        else:
            _raise_conflict(
                row,
                generated_id,
                "unsupported_supplement_mode",
                f"unsupported supplement_mode {row.supplement_mode!r}",
            )
        operations.append(
            {
                "key_type": key_type,
                "key": key,
                "previous_ir_ids": previous_ids,
                "new_ir_ids": new_ids,
                "operation": operation,
            }
        )

    return ("already_present" if already_present else "valid_for_apply", operations)


def supplement_report_item(
    row: SupplementRow,
    *,
    outcome: str,
    expected_generated_ir_id: str,
    existing_generated_ir_id: str | None,
    source_key_status: str,
    source_key_operations: list[dict[str, Any]],
    conflict_reason: str | None,
    target_entries: list[dict[str, Any]],
) -> dict[str, Any]:
    return {
        "supplement_id": row.supplement_id,
        "source_term": row.source_term,
        "target_ir_ids": row.target_ir_ids,
        "outcome": outcome,
        "expected_generated_ir_id": expected_generated_ir_id,
        "existing_generated_ir_id": existing_generated_ir_id,
        "source_key_status": source_key_status,
        "source_key_operations": source_key_operations,
        "conflict_reason": conflict_reason,
        "target_entries": target_entries,
    }


def read_records(records_path: Path) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    with records_path.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, 1):
            text = line.strip()
            if not text:
                continue
            try:
                payload = json.loads(text)
            except json.JSONDecodeError as exc:
                raise SupplementGenerationError(
                    f"{records_path}:{line_number}: invalid JSON: {exc}"
                ) from exc
            if not isinstance(payload, dict):
                raise SupplementGenerationError(f"{records_path}:{line_number}: expected JSON object")
            records.append(payload)
    return records


def write_jsonl(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")


def generate_supplement_records(
    supplement_table_path: Path,
    records_path: Path,
    search_index_path: Path,
    owner_lexical_ir_path: Path | None = None,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    owner_lexical_input = (
        load_owner_lexical_input(owner_lexical_ir_path)
        if owner_lexical_ir_path is not None
        else None
    )
    try:
        validation_result = validate_supplement_table(
            supplement_table_path=supplement_table_path,
            records_path=records_path,
            search_index_path=search_index_path,
            defer_index_conflicts=True,
            owner_lexical_ir_path=owner_lexical_ir_path,
        )
    except SupplementValidationError as exc:
        raise SupplementGenerationError(str(exc)) from exc

    records_by_id = load_records_by_id(records_path)
    index = load_search_index(search_index_path)
    rows_by_id = {row.supplement_id: row for row in validation_result.rows}
    generated_records: list[dict[str, Any]] = []
    expected_generated_ids: set[str] = set()
    applied_supplements: list[dict[str, Any]] = []
    already_present_supplements: list[dict[str, Any]] = []
    conflicted_supplements: list[dict[str, Any]] = []

    for outcome in validation_result.outcomes:
        row = rows_by_id[outcome.supplement_id]
        if row.status != APPLICABLE_STATUS:
            continue
        generated_id = generated_ir_id(row)
        if generated_id in expected_generated_ids:
            raise SupplementGenerationError(
                f"{row.supplement_id}: generated ir_id collision {generated_id}"
            )
        expected_generated_ids.add(generated_id)

        expected_record = build_generated_record(row, records_by_id, owner_lexical_input)
        existing_record = records_by_id.get(generated_id)
        try:
            if existing_record is not None:
                mismatch_reason = _projection_mismatch_reason(expected_record, existing_record)
                if generated_record_projection(expected_record) != generated_record_projection(existing_record):
                    _raise_conflict(
                        row,
                        generated_id,
                        mismatch_reason,
                        "existing generated record does not match expected projection",
                    )
                source_key_status, source_key_operations = validate_source_key_state(
                    row,
                    index,
                    generated_id,
                    already_present=True,
                )
                already_present_supplements.append(
                    supplement_report_item(
                        row,
                        outcome="already_present",
                        expected_generated_ir_id=generated_id,
                        existing_generated_ir_id=generated_id,
                        source_key_status=source_key_status,
                        source_key_operations=source_key_operations,
                        conflict_reason=None,
                        target_entries=target_entries_projection(expected_record),
                    )
                )
                continue

            source_key_status, source_key_operations = validate_source_key_state(
                row,
                index,
                generated_id,
                already_present=False,
            )
        except SupplementGenerationError as exc:
            conflicted_supplements.append(
                supplement_report_item(
                    row,
                    outcome="conflict",
                    expected_generated_ir_id=generated_id,
                    existing_generated_ir_id=generated_id if existing_record is not None else None,
                    source_key_status="conflict",
                    source_key_operations=[],
                    conflict_reason=str(exc),
                    target_entries=target_entries_projection(expected_record),
                )
            )
            raise

        generated_records.append(expected_record)
        applied_supplements.append(
            supplement_report_item(
                row,
                outcome="applied",
                expected_generated_ir_id=generated_id,
                existing_generated_ir_id=None,
                source_key_status=source_key_status,
                source_key_operations=source_key_operations,
                conflict_reason=None,
                target_entries=target_entries_projection(expected_record),
            )
        )

    report = result_to_report(validation_result)
    table_summary = report["source_index_supplement_tables"][0]
    table_summary["applied_supplement_count"] = len(applied_supplements)
    table_summary["already_present_supplement_count"] = len(already_present_supplements)
    table_summary["conflicted_supplement_count"] = len(conflicted_supplements)
    report["supplement_input_path"] = str(supplement_table_path)
    report["supplement_input_sha256"] = file_sha256(supplement_table_path)
    if owner_lexical_input is not None:
        report["owner_lexical_input"] = {
            "path": str(owner_lexical_input.path),
            "sha256": owner_lexical_input.sha256,
            "row_count": owner_lexical_input.row_count,
        }
    report["applied_supplement_count"] = len(applied_supplements)
    report["already_present_supplement_count"] = len(already_present_supplements)
    report["conflicted_supplement_count"] = len(conflicted_supplements)
    report["applied_supplements"] = applied_supplements
    report["already_present_supplements"] = already_present_supplements
    report["conflicted_supplements"] = conflicted_supplements
    report["generated_records"] = [
        {
            "supplement_id": item["supplement_id"],
            "generated_ir_id": record["ir_id"],
            "source_term": record["preferred_form"],
            "target_display_texts": [
                target["display_text"] for target in record["display"]["target_entries"]
            ],
            "target_entries": target_entries_projection(record),
        }
        for item, record in zip(applied_supplements, generated_records, strict=True)
    ]
    report["supplement_record_outcomes"] = [
        *applied_supplements,
        *already_present_supplements,
        *conflicted_supplements,
    ]
    return generated_records, report


def generate_augmented_records(
    supplement_table_path: Path,
    records_path: Path,
    search_index_path: Path,
    output_records_path: Path,
    output_report_path: Path,
    owner_lexical_ir_path: Path | None = None,
) -> dict[str, Any]:
    generated_records, report = generate_supplement_records(
        supplement_table_path=supplement_table_path,
        records_path=records_path,
        search_index_path=search_index_path,
        owner_lexical_ir_path=owner_lexical_ir_path,
    )
    base_records = read_records(records_path)
    write_jsonl(output_records_path, base_records + generated_records)
    output_report_path.parent.mkdir(parents=True, exist_ok=True)
    output_report_path.write_text(
        json.dumps(report, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    return report


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--supplements", type=Path, required=True, help="Source supplement JSONL table")
    parser.add_argument("--records", type=Path, required=True, help="Base enriched records.jsonl")
    parser.add_argument("--search-index", type=Path, required=True, help="Base search_index.jsonl")
    parser.add_argument(
        "--owner-lexical-ir",
        type=Path,
        default=None,
        help="Optional owner lexical IR JSONL used for explicit owner-reviewed target evidence",
    )
    parser.add_argument(
        "--output-records",
        type=Path,
        required=True,
        help="Output records.jsonl with supplement-derived index_mapping records appended",
    )
    parser.add_argument(
        "--output-report",
        type=Path,
        required=True,
        help="Supplement generation report JSON path",
    )
    args = parser.parse_args(argv)

    try:
        report = generate_augmented_records(
            supplement_table_path=args.supplements,
            records_path=args.records,
            search_index_path=args.search_index,
            output_records_path=args.output_records,
            output_report_path=args.output_report,
            owner_lexical_ir_path=args.owner_lexical_ir,
        )
    except SupplementGenerationError as exc:
        print(f"Source-index supplement generation FAILED: {exc}", file=sys.stderr)
        return 1

    print("Source-index supplement generation completed.")
    for table in report.get("source_index_supplement_tables", []):
        if isinstance(table, dict):
            for key, value in sorted(table.items()):
                print(f"  {key}: {value}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
