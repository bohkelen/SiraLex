"""
Gate: enriched JSONL must match baseline normalized JSONL on every field
except the allowed enrichment additives:

- `display` (required on every enriched row; mapping-valued)
- `record_locator` (optional; lexicon_entry only; durable IR locator projection)

Compared per ir_id for all other keys: values must equal the baseline.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from enrichment.enrich import validate_unique_lexicon_locator_tuples

ALLOWED_ENRICHMENT_ONLY_KEYS = frozenset({"display", "record_locator"})
RECORD_LOCATOR_REQUIRED_STRING_KEYS = (
    "kind",
    "url_canonical",
    "source_record_id",
)


def _load_jsonl_by_ir_id(path: Path) -> tuple[dict[str, dict[str, Any]], list[str]]:
    by_id: dict[str, dict[str, Any]] = {}
    order: list[str] = []
    with open(path, encoding="utf-8") as f:
        for line_num, line in enumerate(f, 1):
            stripped = line.strip()
            if not stripped:
                continue
            try:
                rec = json.loads(stripped)
            except json.JSONDecodeError as e:
                raise SystemExit(f"{path}:{line_num}: invalid JSON: {e}") from e
            ir_id = rec.get("ir_id")
            if not ir_id:
                raise SystemExit(f"{path}:{line_num}: missing ir_id")
            if ir_id in by_id:
                raise SystemExit(f"{path}: duplicate ir_id {ir_id!r}")
            by_id[str(ir_id)] = rec
            order.append(str(ir_id))
    return by_id, order


def _validate_record_locator(ir_id: str, locator: Any, ir_kind: Any) -> list[str]:
    issues: list[str] = []
    if ir_kind != "lexicon_entry":
        issues.append(
            f"{ir_id}: record_locator is only allowed on lexicon_entry "
            f"(got ir_kind={ir_kind!r})"
        )
        return issues
    if not isinstance(locator, dict):
        issues.append(f"{ir_id}: record_locator must be a JSON object")
        return issues
    for key in RECORD_LOCATOR_REQUIRED_STRING_KEYS:
        if key not in locator:
            issues.append(f"{ir_id}: record_locator missing required key {key!r}")
            continue
        value = locator[key]
        if not isinstance(value, str) or not value:
            issues.append(
                f"{ir_id}: record_locator.{key} must be a non-empty string"
            )
    if "anchor_names" not in locator:
        issues.append(f"{ir_id}: record_locator missing required key 'anchor_names'")
    else:
        value = locator["anchor_names"]
        if not isinstance(value, list) or not all(
            isinstance(item, str) for item in value
        ):
            issues.append(
                f"{ir_id}: record_locator.anchor_names must be a list of strings"
            )
    return issues


def validate_display_only(
    baseline_by_id: dict[str, dict[str, Any]],
    enriched_by_id: dict[str, dict[str, Any]],
) -> list[str]:
    """Return human-readable issue lines; empty list means pass."""
    issues: list[str] = []

    baseline_ids = set(baseline_by_id)
    enriched_ids = set(enriched_by_id)
    if baseline_ids != enriched_ids:
        only_base = sorted(baseline_ids - enriched_ids)
        only_enriched = sorted(enriched_ids - baseline_ids)
        if only_base:
            issues.append(f"ir_id only in baseline (first 20): {only_base[:20]}")
        if only_enriched:
            issues.append(f"ir_id only in enriched (first 20): {only_enriched[:20]}")
        return issues

    if len(baseline_by_id) != len(enriched_by_id):
        issues.append(
            f"record count mismatch: baseline {len(baseline_by_id)} vs enriched "
            f"{len(enriched_by_id)}"
        )
        return issues

    for ir_id in sorted(baseline_ids):
        base = baseline_by_id[ir_id]
        enr = enriched_by_id[ir_id]

        if "display" not in enr:
            issues.append(f"{ir_id}: enriched record missing display")
            continue
        if not isinstance(enr["display"], dict):
            issues.append(f"{ir_id}: display must be a JSON object")

        if "record_locator" in enr:
            issues.extend(
                _validate_record_locator(
                    ir_id,
                    enr["record_locator"],
                    enr.get("ir_kind", base.get("ir_kind")),
                )
            )

        enr_without_additives = {
            k: v for k, v in enr.items() if k not in ALLOWED_ENRICHMENT_ONLY_KEYS
        }
        base_keys = set(base.keys())
        enr_keys = set(enr_without_additives.keys())
        if base_keys != enr_keys:
            only_b = sorted(base_keys - enr_keys)
            only_e = sorted(enr_keys - base_keys)
            issues.append(
                f"{ir_id}: keys excluding enrichment additives differ — "
                f"only_baseline={only_b[:12]} only_enriched={only_e[:12]}"
            )
            continue

        for key in sorted(base_keys):
            if base[key] != enr[key]:
                issues.append(
                    f"{ir_id}: field {key!r} differs between baseline and enriched"
                )

    issues.extend(
        validate_unique_lexicon_locator_tuples(list(enriched_by_id.values()))
    )
    return issues


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Validate that enriched JSONL differs from baseline normalized JSONL "
            "only by adding display and optional lexicon record_locator fields."
        ),
    )
    parser.add_argument(
        "--baseline",
        type=Path,
        required=True,
        help="Baseline normalized JSONL (no display)",
    )
    parser.add_argument(
        "--enriched",
        type=Path,
        required=True,
        help="Enriched JSONL output from siralex-enrich",
    )
    parser.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        help="Print counts on success",
    )
    args = parser.parse_args(argv)

    baseline_by_id, _ = _load_jsonl_by_ir_id(args.baseline)
    enriched_by_id, _ = _load_jsonl_by_ir_id(args.enriched)

    issues = validate_display_only(baseline_by_id, enriched_by_id)

    if issues:
        print("Display-only enrichment gate FAILED", file=sys.stderr)
        for line in issues[:100]:
            print(f"  {line}", file=sys.stderr)
        if len(issues) > 100:
            print(f"  … and {len(issues) - 100} more", file=sys.stderr)
        return 1

    if args.verbose:
        n = len(baseline_by_id)
        with_locator = sum(
            1 for rec in enriched_by_id.values() if "record_locator" in rec
        )
        dup_count = len(
            validate_unique_lexicon_locator_tuples(list(enriched_by_id.values()))
        )
        print(
            f"Display-only enrichment gate PASSED "
            f"({n} records by ir_id; {with_locator} with record_locator; "
            f"duplicate locator tuple count: {dup_count})."
        )
    else:
        print("Display-only enrichment gate PASSED.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
