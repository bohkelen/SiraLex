"""
Gate: enriched JSONL must match baseline normalized JSONL on every non-display field.

Compared per ir_id: ir_kind, norm_version, preferred_form, variant_forms, search_keys.
Also requires each enriched row to include a mapping-valued `display` field.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


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

        enr_without_display = {k: v for k, v in enr.items() if k != "display"}
        base_keys = set(base.keys())
        if base_keys != set(enr_without_display.keys()):
            only_b = sorted(base_keys - set(enr_without_display))
            only_e = sorted(set(enr_without_display) - base_keys)
            issues.append(
                f"{ir_id}: keys excluding display differ — "
                f"only_baseline={only_b[:12]} only_enriched={only_e[:12]}"
            )
            continue

        for key in sorted(base_keys):
            if base[key] != enr[key]:
                issues.append(f"{ir_id}: field {key!r} differs between baseline and enriched")

    return issues


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Validate that enriched JSONL differs from baseline normalized JSONL "
            "only by adding a dict-valued display field."
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
        print(f"Display-only enrichment gate PASSED ({n} records by ir_id).")
    else:
        print("Display-only enrichment gate PASSED.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
