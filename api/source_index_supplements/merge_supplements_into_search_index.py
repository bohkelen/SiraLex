"""Merge approved source-index supplements into a baseline search index."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from .generate_supplement_records import (
    SupplementGenerationError,
    generate_supplement_records,
)
from .validate_supplements import (
    APPLICABLE_STATUS,
    read_supplement_rows,
)


class SupplementMergeError(RuntimeError):
    """Raised when source-index supplements cannot be merged cleanly."""


def read_json(path: Path) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise SupplementMergeError(f"{path}: invalid JSON: {exc}") from exc
    if not isinstance(payload, dict):
        raise SupplementMergeError(f"{path}: expected JSON object")
    return payload


def read_search_index_rows(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    with path.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, 1):
            text = line.strip()
            if not text:
                continue
            try:
                row = json.loads(text)
            except json.JSONDecodeError as exc:
                raise SupplementMergeError(f"{path}:{line_number}: invalid JSON: {exc}") from exc
            if not isinstance(row, dict):
                raise SupplementMergeError(f"{path}:{line_number}: expected JSON object")
            key_type = row.get("key_type")
            key = row.get("key")
            ir_ids = row.get("ir_ids")
            if not isinstance(key_type, str) or not key_type:
                raise SupplementMergeError(f"{path}:{line_number}: missing key_type")
            if not isinstance(key, str) or not key:
                raise SupplementMergeError(f"{path}:{line_number}: missing key")
            if not isinstance(ir_ids, list) or not all(isinstance(ir_id, str) for ir_id in ir_ids):
                raise SupplementMergeError(f"{path}:{line_number}: invalid ir_ids")
            compound = (key_type, key)
            if compound in seen:
                raise SupplementMergeError(f"{path}:{line_number}: duplicate index key {compound}")
            seen.add(compound)
            rows.append({"key": key, "key_type": key_type, "ir_ids": list(ir_ids)})
    return rows


def write_search_index_rows(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")


def rows_to_index(rows: list[dict[str, Any]]) -> dict[tuple[str, str], list[str]]:
    return {(row["key_type"], row["key"]): list(row["ir_ids"]) for row in rows}


def serialize_index(index: dict[tuple[str, str], list[str]]) -> list[dict[str, Any]]:
    return [
        {"key": key, "key_type": key_type, "ir_ids": list(ir_ids)}
        for (key_type, key), ir_ids in sorted(index.items())
    ]


def generated_records_by_supplement_id(
    report: dict[str, Any],
    records: list[dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    records_by_id = {record["ir_id"]: record for record in records}
    out: dict[str, dict[str, Any]] = {}
    for item in report.get("generated_records", []):
        if not isinstance(item, dict):
            continue
        supplement_id = item.get("supplement_id")
        generated_ir_id = item.get("generated_ir_id")
        if isinstance(supplement_id, str) and isinstance(generated_ir_id, str):
            record = records_by_id.get(generated_ir_id)
            if record:
                out[supplement_id] = record
    return out


def record_outcomes_by_supplement_id(report: dict[str, Any]) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for item in report.get("supplement_record_outcomes", []):
        if not isinstance(item, dict):
            continue
        supplement_id = item.get("supplement_id")
        if isinstance(supplement_id, str):
            out[supplement_id] = item
    return out


def _target_display_entries(record: dict[str, Any]) -> list[dict[str, Any]]:
    display = record.get("display")
    if not isinstance(display, dict):
        return []
    target_entries = display.get("target_entries")
    return [entry for entry in target_entries if isinstance(entry, dict)] if isinstance(target_entries, list) else []


def _change_summary(
    before: dict[tuple[str, str], list[str]],
    after: dict[tuple[str, str], list[str]],
    expected_changed_keys: set[tuple[str, str]],
) -> dict[str, Any]:
    before_keys = set(before)
    after_keys = set(after)
    added_keys = sorted(after_keys - before_keys)
    removed_keys = sorted(before_keys - after_keys)
    changed_keys = sorted(key for key in before_keys & after_keys if before[key] != after[key])
    target_side_changed = sorted(
        key
        for key in added_keys + removed_keys + changed_keys
        if key[0].startswith("tgt_")
    )
    unexpected_changes = sorted(
        key
        for key in added_keys + removed_keys + changed_keys
        if key not in expected_changed_keys
    )
    return {
        "unchanged_key_count": sum(1 for key in before_keys & after_keys if before[key] == after[key]),
        "changed_key_list": [
            {"key_type": key_type, "key": key}
            for key_type, key in changed_keys
        ],
        "added_key_list": [
            {"key_type": key_type, "key": key}
            for key_type, key in added_keys
        ],
        "removed_key_list": [
            {"key_type": key_type, "key": key}
            for key_type, key in removed_keys
        ],
        "target_side_changed_key_list": [
            {"key_type": key_type, "key": key}
            for key_type, key in target_side_changed
        ],
        "unexpected_changes": [
            {"key_type": key_type, "key": key}
            for key_type, key in unexpected_changes
        ],
    }


def merge_supplements_into_search_index(
    supplement_table_path: Path,
    records_path: Path,
    baseline_search_index_path: Path,
    baseline_bundle_dir: Path,
    owner_lexical_ir_path: Path | None = None,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    try:
        generated_records, generation_report = generate_supplement_records(
            supplement_table_path=supplement_table_path,
            records_path=records_path,
            search_index_path=baseline_search_index_path,
            owner_lexical_ir_path=owner_lexical_ir_path,
        )
    except SupplementGenerationError as exc:
        raise SupplementMergeError(str(exc)) from exc

    baseline_manifest = read_json(baseline_bundle_dir / "bundle.manifest.json")
    baseline_rows = read_search_index_rows(baseline_search_index_path)
    baseline_index = rows_to_index(baseline_rows)
    merged_index = {key: list(value) for key, value in baseline_index.items()}
    rows = read_supplement_rows(supplement_table_path)
    generated_by_supplement_id = generated_records_by_supplement_id(
        generation_report,
        generated_records,
    )
    record_outcomes = record_outcomes_by_supplement_id(generation_report)

    applied_changes: list[dict[str, Any]] = []
    expected_changed_keys: set[tuple[str, str]] = set()
    non_applied_rows: list[dict[str, Any]] = []

    for row in rows:
        if row.status != APPLICABLE_STATUS:
            non_applied_rows.append(
                {
                    "supplement_id": row.supplement_id,
                    "status": row.status,
                    "source_term": row.source_term,
                    "supplement_mode": row.supplement_mode,
                    "target_ir_ids": row.target_ir_ids,
                }
            )
            continue

        record_outcome = record_outcomes.get(row.supplement_id)
        if not record_outcome:
            raise SupplementMergeError(f"{row.supplement_id}: missing supplement outcome")

        if record_outcome.get("outcome") == "already_present":
            continue
        if record_outcome.get("outcome") != "applied":
            raise SupplementMergeError(
                f"{row.supplement_id}: unsupported supplement outcome "
                f"{record_outcome.get('outcome')!r}"
            )

        generated_record = generated_by_supplement_id.get(row.supplement_id)
        if not generated_record:
            raise SupplementMergeError(f"{row.supplement_id}: missing generated record")

        for operation_item in record_outcome.get("source_key_operations", []):
            if not isinstance(operation_item, dict):
                raise SupplementMergeError(f"{row.supplement_id}: invalid source key operation")
            key_type = operation_item.get("key_type")
            key = operation_item.get("key")
            previous_ir_ids = operation_item.get("previous_ir_ids")
            new_ir_ids = operation_item.get("new_ir_ids")
            operation = operation_item.get("operation")
            if (
                not isinstance(key_type, str)
                or not isinstance(key, str)
                or not isinstance(previous_ir_ids, list)
                or not all(isinstance(ir_id, str) for ir_id in previous_ir_ids)
                or not isinstance(new_ir_ids, list)
                or not all(isinstance(ir_id, str) for ir_id in new_ir_ids)
                or operation not in {"added_key", "appended_posting"}
            ):
                raise SupplementMergeError(f"{row.supplement_id}: invalid source key operation")

            compound = (key_type, key)
            current = merged_index.get(compound, [])
            if current != previous_ir_ids:
                raise SupplementMergeError(
                    f"{row.supplement_id}: source key {compound} changed before merge; "
                    f"expected {previous_ir_ids}, got {current}"
                )
            merged_index[compound] = list(new_ir_ids)
            expected_changed_keys.add(compound)
            applied_changes.append(
                {
                    "supplement_id": row.supplement_id,
                    "source_term": row.source_term,
                    "key": key,
                    "key_type": key_type,
                    "previous_ir_ids": previous_ir_ids,
                    "new_ir_ids": new_ir_ids,
                    "operation": operation,
                }
            )

    summary = _change_summary(baseline_index, merged_index, expected_changed_keys)
    if summary["unexpected_changes"]:
        raise SupplementMergeError(
            f"unexpected index changes detected: {summary['unexpected_changes']}"
        )
    if summary["target_side_changed_key_list"]:
        raise SupplementMergeError(
            f"target-side changes detected: {summary['target_side_changed_key_list']}"
        )
    if summary["removed_key_list"]:
        raise SupplementMergeError(f"removed index keys detected: {summary['removed_key_list']}")

    report = {
        "baseline_bundle_id": baseline_manifest.get("bundle_id"),
        "baseline_content_sha256": baseline_manifest.get("content_sha256"),
        "supplement_input_path": generation_report.get("supplement_input_path"),
        "supplement_input_sha256": generation_report.get("supplement_input_sha256"),
        "supplement_table_version": (
            generation_report.get("source_index_supplement_tables", [{}])[0].get(
                "supplement_table_version"
            )
        ),
        "applied_supplement_count": generation_report.get("applied_supplement_count", 0),
        "already_present_supplement_count": generation_report.get(
            "already_present_supplement_count",
            0,
        ),
        "conflicted_supplement_count": generation_report.get("conflicted_supplement_count", 0),
        "applied_supplements": generation_report.get("applied_supplements", []),
        "already_present_supplements": generation_report.get("already_present_supplements", []),
        "conflicted_supplements": generation_report.get("conflicted_supplements", []),
        "generated_supplement_records": [
            {
                "supplement_id": item.get("supplement_id"),
                "generated_ir_id": item.get("generated_ir_id"),
                "source_term": item.get("source_term"),
                "target_entries": _target_display_entries(
                    generated_by_supplement_id[item["supplement_id"]]
                ),
            }
            for item in generation_report.get("generated_records", [])
            if isinstance(item, dict) and item.get("supplement_id") in generated_by_supplement_id
        ],
        "applied_index_changes": applied_changes,
        "non_applied_supplement_rows": non_applied_rows,
        **summary,
    }
    owner_reviewed_target_ids = generation_report.get("owner_reviewed_target_ids")
    if isinstance(owner_reviewed_target_ids, list):
        normalized_owner_ids = sorted(
            {
                item
                for item in owner_reviewed_target_ids
                if isinstance(item, str) and item
            }
        )
        if normalized_owner_ids:
            owner_lexical_input = generation_report.get("owner_lexical_input")
            if isinstance(owner_lexical_input, dict):
                report["owner_lexical_input"] = {
                    "path": owner_lexical_input.get("path"),
                    "sha256": owner_lexical_input.get("sha256"),
                    "row_count": owner_lexical_input.get("row_count"),
                }
            report["owner_reviewed_target_ids"] = normalized_owner_ids
    return serialize_index(merged_index), report


def merge_and_write(
    supplement_table_path: Path,
    records_path: Path,
    baseline_search_index_path: Path,
    baseline_bundle_dir: Path,
    output_search_index_path: Path,
    output_report_path: Path,
    owner_lexical_ir_path: Path | None = None,
) -> dict[str, Any]:
    rows, report = merge_supplements_into_search_index(
        supplement_table_path=supplement_table_path,
        records_path=records_path,
        baseline_search_index_path=baseline_search_index_path,
        baseline_bundle_dir=baseline_bundle_dir,
        owner_lexical_ir_path=owner_lexical_ir_path,
    )
    write_search_index_rows(output_search_index_path, rows)
    output_report_path.parent.mkdir(parents=True, exist_ok=True)
    output_report_path.write_text(
        json.dumps(report, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    return report


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--supplements", type=Path, required=True, help="Source supplement JSONL table")
    parser.add_argument("--records", type=Path, required=True, help="Baseline records.jsonl")
    parser.add_argument(
        "--baseline-search-index",
        type=Path,
        required=True,
        help="Baseline search_index.jsonl to merge into",
    )
    parser.add_argument(
        "--baseline-bundle-dir",
        type=Path,
        required=True,
        help="Baseline bundle directory containing bundle.manifest.json",
    )
    parser.add_argument(
        "--output-search-index",
        type=Path,
        required=True,
        help="Merged candidate search_index.jsonl output path",
    )
    parser.add_argument(
        "--output-report",
        type=Path,
        required=True,
        help="Compatibility merge report JSON path",
    )
    parser.add_argument(
        "--owner-lexical-ir",
        type=Path,
        default=None,
        help="Optional owner lexical IR JSONL used for explicit owner-reviewed target evidence",
    )
    args = parser.parse_args(argv)

    try:
        report = merge_and_write(
            supplement_table_path=args.supplements,
            records_path=args.records,
            baseline_search_index_path=args.baseline_search_index,
            baseline_bundle_dir=args.baseline_bundle_dir,
            output_search_index_path=args.output_search_index,
            output_report_path=args.output_report,
            owner_lexical_ir_path=args.owner_lexical_ir,
        )
    except SupplementMergeError as exc:
        print(f"Source-index supplement compatibility merge FAILED: {exc}", file=sys.stderr)
        return 1

    print("Source-index supplement compatibility merge completed.")
    print(f"  baseline_bundle_id: {report['baseline_bundle_id']}")
    print(f"  changed_key_count: {len(report['changed_key_list'])}")
    print(f"  added_key_count: {len(report['added_key_list'])}")
    print(f"  unexpected_change_count: {len(report['unexpected_changes'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
