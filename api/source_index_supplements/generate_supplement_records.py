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

from .validate_supplements import (
    APPLICABLE_STATUS,
    SupplementRow,
    SupplementValidationError,
    load_records_by_id,
    read_supplement_rows,
    result_to_report,
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


def build_target_entries(
    row: SupplementRow,
    records_by_id: dict[str, dict[str, Any]],
) -> list[dict[str, str]]:
    entries: list[dict[str, str]] = []
    for target_ir_id, target_form in zip(row.target_ir_ids, row.target_forms, strict=True):
        target_record = records_by_id[target_ir_id]
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
            "target_entries": build_target_entries(row, records_by_id),
        },
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
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    try:
        validation_result = validate_supplement_table(
            supplement_table_path=supplement_table_path,
            records_path=records_path,
            search_index_path=search_index_path,
        )
    except SupplementValidationError as exc:
        raise SupplementGenerationError(str(exc)) from exc

    records_by_id = load_records_by_id(records_path)
    rows_by_id = {row.supplement_id: row for row in validation_result.rows}
    existing_record_ids = set(records_by_id)
    generated_records: list[dict[str, Any]] = []
    generated_ids: set[str] = set()
    generated_supplement_ids: list[str] = []

    for outcome in validation_result.outcomes:
        row = rows_by_id[outcome.supplement_id]
        if row.status != APPLICABLE_STATUS:
            continue
        generated_id = generated_ir_id(row)
        if generated_id in existing_record_ids or generated_id in generated_ids:
            raise SupplementGenerationError(
                f"{row.supplement_id}: generated ir_id collision {generated_id}"
            )
        generated_ids.add(generated_id)
        generated_supplement_ids.append(row.supplement_id)
        generated_records.append(build_generated_record(row, records_by_id))

    report = result_to_report(validation_result)
    report["generated_records"] = [
        {
            "supplement_id": supplement_id,
            "generated_ir_id": record["ir_id"],
            "source_term": record["preferred_form"],
            "target_display_texts": [
                target["display_text"] for target in record["display"]["target_entries"]
            ],
        }
        for supplement_id, record in zip(generated_supplement_ids, generated_records, strict=True)
    ]
    return generated_records, report


def generate_augmented_records(
    supplement_table_path: Path,
    records_path: Path,
    search_index_path: Path,
    output_records_path: Path,
    output_report_path: Path,
) -> dict[str, Any]:
    generated_records, report = generate_supplement_records(
        supplement_table_path=supplement_table_path,
        records_path=records_path,
        search_index_path=search_index_path,
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
