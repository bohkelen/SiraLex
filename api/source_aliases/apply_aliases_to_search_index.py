"""Apply approved source aliases to a base search index."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from .validate_alias_table import (
    APPLICABLE_STATUS,
    AliasOutcome,
    AliasValidationError,
    AliasValidationResult,
    generated_key_types_for_source_term,
    load_search_index,
    read_alias_rows,
    resolve_canonical_source_terms,
    result_to_report,
    search_keys_for_source_term,
    validate_alias_table,
)


class AliasApplicationError(RuntimeError):
    """Raised when approved aliases cannot be applied cleanly."""


def serialize_search_index(index: dict[tuple[str, str], list[str]]) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    for (key_type, key), ir_ids in sorted(index.items()):
        entries.append({"key": key, "key_type": key_type, "ir_ids": list(ir_ids)})
    return entries


def write_search_index(index: dict[tuple[str, str], list[str]], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as handle:
        for entry in serialize_search_index(index):
            handle.write(json.dumps(entry, ensure_ascii=False) + "\n")


def apply_approved_aliases(
    alias_table_path: Path,
    records_path: Path,
    input_search_index_path: Path,
    output_search_index_path: Path,
    output_report_path: Path,
) -> dict[str, Any]:
    """
    Validate and apply approved aliases to a search index.

    The function fails closed: no output index or report is written unless every
    approved alias validates and all collisions are either absent or no-op.
    """
    try:
        validation_result = validate_alias_table(
            alias_table_path=alias_table_path,
            records_path=records_path,
            search_index_path=input_search_index_path,
        )
    except AliasValidationError as exc:
        raise AliasApplicationError(str(exc)) from exc

    base_index = load_search_index(input_search_index_path)
    augmented_index: dict[tuple[str, str], list[str]] = {
        key: list(value) for key, value in base_index.items()
    }

    rows_by_alias_id = {row.alias_id: row for row in validation_result.rows}
    outcomes: list[AliasOutcome] = []

    for initial_outcome in validation_result.outcomes:
        row = rows_by_alias_id[initial_outcome.alias_id]
        if row.status != APPLICABLE_STATUS:
            continue

        resolved_ir_ids = resolve_canonical_source_terms(base_index, row.canonical_source_terms)
        if resolved_ir_ids != row.resolved_ir_ids:
            raise AliasApplicationError(
                f"{row.alias_id}: resolved_ir_ids changed after validation; "
                f"declared={row.resolved_ir_ids} recomputed={resolved_ir_ids}"
            )

        generated_keys = search_keys_for_source_term(row.alias_source_term)
        generated_key_types = generated_key_types_for_source_term(row.alias_source_term)
        added_count = 0
        no_op_count = 0

        for compound_key in generated_keys:
            existing = augmented_index.get(compound_key)
            if existing is None:
                augmented_index[compound_key] = list(resolved_ir_ids)
                added_count += 1
                continue
            if existing == resolved_ir_ids:
                no_op_count += 1
                continue
            raise AliasApplicationError(
                f"{row.alias_id}: alias source key {compound_key} conflicts with existing postings; "
                f"existing={existing} alias={resolved_ir_ids}"
            )

        if added_count > 0:
            outcomes.append(
                AliasOutcome(
                    alias_id=row.alias_id,
                    status=row.status,
                    alias_source_term=row.alias_source_term,
                    canonical_source_terms=row.canonical_source_terms,
                    resolved_ir_ids=resolved_ir_ids,
                    generated_key_types=generated_key_types,
                    outcome="applied",
                    reason=f"generated {added_count} alias-derived source key(s)",
                )
            )
        elif no_op_count > 0:
            outcomes.append(
                AliasOutcome(
                    alias_id=row.alias_id,
                    status=row.status,
                    alias_source_term=row.alias_source_term,
                    canonical_source_terms=row.canonical_source_terms,
                    resolved_ir_ids=resolved_ir_ids,
                    generated_key_types=generated_key_types,
                    outcome="skipped",
                    reason="alias-derived source keys already exist with identical postings",
                )
            )
        else:
            raise AliasApplicationError(f"{row.alias_id}: approved alias generated no source keys")

    summary = {
        "approved_alias_count": sum(
            1 for row in validation_result.rows if row.status == APPLICABLE_STATUS
        ),
        "candidate_alias_count": sum(
            1 for row in validation_result.rows if row.status in {"candidate", "deferred"}
        ),
        "rejected_alias_count": sum(
            1 for row in validation_result.rows if row.status == "rejected"
        ),
        "applied_alias_count": sum(1 for outcome in outcomes if outcome.outcome == "applied"),
        "skipped_alias_count": sum(1 for outcome in outcomes if outcome.outcome == "skipped"),
    }
    final_result = AliasValidationResult(
        rows=validation_result.rows,
        outcomes=outcomes,
        alias_table_versions=validation_result.alias_table_versions,
        schema_versions=validation_result.schema_versions,
        summary=summary,
    )
    report = result_to_report(final_result)

    # Write only after all approved aliases have applied cleanly in memory.
    write_search_index(augmented_index, output_search_index_path)
    output_report_path.parent.mkdir(parents=True, exist_ok=True)
    output_report_path.write_text(
        json.dumps(report, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    return report


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--aliases", type=Path, required=True, help="Source alias JSONL table")
    parser.add_argument("--records", type=Path, required=True, help="Bundle records.jsonl")
    parser.add_argument("--search-index", type=Path, required=True, help="Base search_index.jsonl")
    parser.add_argument(
        "--output-search-index",
        type=Path,
        required=True,
        help="Augmented search_index.jsonl output path",
    )
    parser.add_argument(
        "--output-report",
        type=Path,
        required=True,
        help="Alias application report JSON path",
    )
    args = parser.parse_args(argv)

    try:
        report = apply_approved_aliases(
            alias_table_path=args.aliases,
            records_path=args.records,
            input_search_index_path=args.search_index,
            output_search_index_path=args.output_search_index,
            output_report_path=args.output_report,
        )
    except AliasApplicationError as exc:
        print(f"Source alias application FAILED: {exc}", file=sys.stderr)
        return 1

    print("Source alias application completed.")
    for table in report.get("alias_tables", []):
        if isinstance(table, dict):
            for key, value in sorted(table.items()):
                print(f"  {key}: {value}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
