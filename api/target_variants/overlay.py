"""Load and validate reviewed target-variant overlay tables."""

from __future__ import annotations

import hashlib
import json
import re
import sys
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).parent.parent.parent / "shared"))

from ir.lexical_review import ReviewedTargetVariant  # noqa: E402
from normalization.norm_v3 import RULESET_ID, normalize_nfc  # noqa: E402

SCHEMA_VERSION = "reviewed_target_variant_table_v1"
ALLOWED_STATUSES = frozenset({"approved", "pending", "rejected"})
APPROVED_STATUS = "approved"
ALLOWED_TARGET_SCRIPTS = frozenset({"latin"})
CANONICAL_IR_ID_RE = re.compile(r"^[0-9a-f]{16}$")
MALIPENSE_SOURCE_ID = "src_malipense"

REQUIRED_FIELDS = frozenset(
    {
        "schema_version",
        "target_variant_table_version",
        "variant_id",
        "status",
        "canonical_ir_id",
        "form",
        "target_script",
        "review_document",
        "reviewer",
        "reviewed_at",
        "rationale",
        "source_norm_version",
    }
)


class TargetVariantOverlayError(ValueError):
    """Raised when a reviewed target-variant overlay table is invalid."""


@dataclass(frozen=True)
class TargetVariantOverlayRow:
    """Parsed overlay row with source location metadata."""

    row: dict[str, Any]
    line_number: int

    @property
    def variant_id(self) -> str:
        return str(self.row["variant_id"])

    @property
    def status(self) -> str:
        return str(self.row["status"])

    @property
    def canonical_ir_id(self) -> str:
        return str(self.row["canonical_ir_id"])

    @property
    def form(self) -> str:
        return str(self.row["form"])

    def to_reviewed_target_variant(self) -> ReviewedTargetVariant:
        return ReviewedTargetVariant(
            form=self.form,
            review_document=str(self.row["review_document"]),
            reviewer=str(self.row["reviewer"]),
            reviewed_at=str(self.row["reviewed_at"]),
            rationale=str(self.row["rationale"]),
        )


@dataclass
class TargetVariantOverlay:
    """Validated overlay table loaded from disk."""

    path: Path
    file_sha256: str
    rows: list[TargetVariantOverlayRow] = field(default_factory=list)

    @property
    def row_count(self) -> int:
        return len(self.rows)

    @property
    def approved_row_count(self) -> int:
        return sum(1 for row in self.rows if row.status == APPROVED_STATUS)


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _nfc_key(value: str) -> str:
    return normalize_nfc(value.strip())


def _is_valid_iso8601(value: str) -> bool:
    """Accept ISO date and datetime forms used in repository contracts."""
    try:
        datetime.strptime(value, "%Y-%m-%d")
        return True
    except ValueError:
        pass

    candidate = value
    if candidate.endswith("Z"):
        candidate = candidate[:-1] + "+00:00"
    try:
        datetime.fromisoformat(candidate)
        return True
    except ValueError:
        return False


def _validate_row_schema(row: dict[str, Any], *, line_number: int) -> None:
    if not isinstance(row, dict):
        raise TargetVariantOverlayError(f"line {line_number}: row must be a JSON object")

    missing = REQUIRED_FIELDS - row.keys()
    if missing:
        raise TargetVariantOverlayError(
            f"line {line_number}: missing required fields: {sorted(missing)}"
        )

    extra = set(row.keys()) - REQUIRED_FIELDS - {
        "review_reference",
        "supersedes_variant_id",
        "notes",
    }
    if extra:
        raise TargetVariantOverlayError(
            f"line {line_number}: unsupported fields: {sorted(extra)}"
        )

    if row["schema_version"] != SCHEMA_VERSION:
        raise TargetVariantOverlayError(
            f"line {line_number}: schema_version must be {SCHEMA_VERSION!r}"
        )

    status = row["status"]
    if status not in ALLOWED_STATUSES:
        raise TargetVariantOverlayError(
            f"line {line_number}: status must be one of {sorted(ALLOWED_STATUSES)}"
        )

    canonical_ir_id = row["canonical_ir_id"]
    if not isinstance(canonical_ir_id, str) or not CANONICAL_IR_ID_RE.fullmatch(canonical_ir_id):
        raise TargetVariantOverlayError(
            f"line {line_number}: canonical_ir_id must be 16 lowercase hex characters"
        )

    form = row["form"]
    if not isinstance(form, str) or not form.strip():
        raise TargetVariantOverlayError(f"line {line_number}: form must be a non-empty string")
    if _nfc_key(form) != form:
        raise TargetVariantOverlayError(f"line {line_number}: form must be NFC-normalized")

    target_script = row["target_script"]
    if target_script not in ALLOWED_TARGET_SCRIPTS:
        raise TargetVariantOverlayError(
            f"line {line_number}: target_script must be one of {sorted(ALLOWED_TARGET_SCRIPTS)}"
        )

    review_document = row["review_document"]
    if (
        not isinstance(review_document, str)
        or not review_document.startswith("docs/")
        or not review_document.strip()
    ):
        raise TargetVariantOverlayError(
            f"line {line_number}: review_document must be a repository-relative path under docs/"
        )

    for field_name in ("target_variant_table_version", "variant_id", "reviewer", "rationale"):
        value = row[field_name]
        if not isinstance(value, str) or not value.strip():
            raise TargetVariantOverlayError(
                f"line {line_number}: {field_name} must be a non-empty string"
            )

    reviewed_at = row["reviewed_at"]
    if not isinstance(reviewed_at, str) or not reviewed_at.strip():
        raise TargetVariantOverlayError(
            f"line {line_number}: reviewed_at must be a non-empty string"
        )
    if not _is_valid_iso8601(reviewed_at):
        raise TargetVariantOverlayError(
            f"line {line_number}: reviewed_at must be an ISO-8601 date or datetime"
        )

    if row["source_norm_version"] != RULESET_ID:
        raise TargetVariantOverlayError(
            f"line {line_number}: source_norm_version must be {RULESET_ID!r}"
        )


def _validate_table_invariants(rows: list[TargetVariantOverlayRow]) -> None:
    seen_variant_ids: set[str] = set()
    approved_form_keys: dict[str, str] = {}
    approved_rows: list[TargetVariantOverlayRow] = []

    for overlay_row in rows:
        variant_id = overlay_row.variant_id
        if variant_id in seen_variant_ids:
            raise TargetVariantOverlayError(f"duplicate variant_id: {variant_id}")
        seen_variant_ids.add(variant_id)

        if overlay_row.status != APPROVED_STATUS:
            continue

        approved_rows.append(overlay_row)
        form_key = _nfc_key(overlay_row.form)
        prior_variant_id = approved_form_keys.get(form_key)
        if prior_variant_id is not None:
            raise TargetVariantOverlayError(
                "duplicate approved form under NFC comparison: "
                f"{overlay_row.form!r} ({prior_variant_id}, {variant_id})"
            )
        approved_form_keys[form_key] = variant_id

    sort_keys = [(row.canonical_ir_id, row.variant_id) for row in approved_rows]
    if sort_keys != sorted(sort_keys):
        raise TargetVariantOverlayError(
            "approved rows must be sorted by canonical_ir_id, then variant_id"
        )


def load_reviewed_target_variant_overlay(path: Path) -> TargetVariantOverlay:
    """Load and schema-validate an overlay JSONL file."""
    if not path.exists():
        raise TargetVariantOverlayError(f"overlay file not found: {path}")

    rows: list[TargetVariantOverlayRow] = []
    with path.open(encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, 1):
            stripped = line.strip()
            if not stripped:
                continue
            try:
                payload = json.loads(stripped)
            except json.JSONDecodeError as exc:
                raise TargetVariantOverlayError(
                    f"line {line_number}: invalid JSON: {exc}"
                ) from exc
            _validate_row_schema(payload, line_number=line_number)
            rows.append(TargetVariantOverlayRow(row=payload, line_number=line_number))

    _validate_table_invariants(rows)
    return TargetVariantOverlay(
        path=path,
        file_sha256=file_sha256(path),
        rows=rows,
    )


def _ir_index(
    ir_units: list[dict[str, Any]],
) -> dict[str, list[dict[str, Any]]]:
    all_by_ir_id: dict[str, list[dict[str, Any]]] = {}

    for ir_unit in ir_units:
        ir_id = str(ir_unit.get("ir_id", ""))
        all_by_ir_id.setdefault(ir_id, []).append(ir_unit)

    return all_by_ir_id


def validate_overlay_against_ir(
    overlay: TargetVariantOverlay,
    ir_units: list[dict[str, Any]],
) -> None:
    """Validate approved overlay rows against supplied IR lexicon entries."""
    all_by_ir_id = _ir_index(ir_units)

    for overlay_row in overlay.rows:
        if overlay_row.status != APPROVED_STATUS:
            continue

        canonical_ir_id = overlay_row.canonical_ir_id
        matches = all_by_ir_id.get(canonical_ir_id, [])
        matching_targets = [
            ir_unit
            for ir_unit in matches
            if ir_unit.get("ir_kind") == "lexicon_entry"
            and ir_unit.get("source_id") == MALIPENSE_SOURCE_ID
        ]
        if len(matching_targets) != 1:
            raise TargetVariantOverlayError(
                f"line {overlay_row.line_number}: canonical_ir_id {canonical_ir_id!r} "
                "must resolve to exactly one frozen Mali-Pense lexicon entry "
                "(ir_kind=lexicon_entry, source_id=src_malipense); "
                f"resolved {len(matching_targets)} matching targets "
                f"from {len(matches)} loaded record(s)"
            )


def overlay_variants_by_ir_id(
    overlay: TargetVariantOverlay,
) -> dict[str, list[ReviewedTargetVariant]]:
    """Return approved overlay variants grouped by canonical_ir_id."""
    grouped: dict[str, list[ReviewedTargetVariant]] = {}
    for overlay_row in overlay.rows:
        if overlay_row.status != APPROVED_STATUS:
            continue
        grouped.setdefault(overlay_row.canonical_ir_id, []).append(
            overlay_row.to_reviewed_target_variant()
        )
    return grouped
