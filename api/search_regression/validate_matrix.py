"""Validation for curated search regression matrix fixtures."""

from __future__ import annotations

import unicodedata
from dataclasses import dataclass

from .schema import (
    CASE_FAMILIES,
    CASE_SCHEMA_VERSION,
    DIRECTIONS,
    MANIFEST_SCHEMA_VERSION,
    MATCHED_KEY_TYPES,
    QUERY_UNICODE_FORMS,
    RESULT_STATUSES,
    REVIEW_STATUSES,
    MatrixManifest,
    SearchRegressionCase,
)

SEED_QUERIES = frozenset(
    {
        "fruit",
        "fruits",
        "grand-parents",
        "mère",
        "bras",
        "manger",
        "mou",
        "tête",
        "poil",
        "zzzz-nohit-test",
        "Kun",
        "K\u00f9n",
        "ku\u0300n",
    }
)

KUN_NFC = "K\u00f9n"
KUN_NFD = "ku\u0300n"


@dataclass(frozen=True)
class ValidationError:
    case_id: str
    message: str

    def __str__(self) -> str:
        if self.case_id:
            return f"{self.case_id}: {self.message}"
        return self.message


def _label(case: SearchRegressionCase) -> str:
    return case.case_id or "<unknown>"


def validate_case(
    case: SearchRegressionCase,
    manifest: MatrixManifest | None = None,
) -> list[ValidationError]:
    errors: list[ValidationError] = []
    case_id = _label(case)

    def add(message: str) -> None:
        errors.append(ValidationError(case_id=case.case_id, message=message))

    if not case.case_id.strip():
        add("empty case_id")

    if not case.query:
        add("empty query")

    if case.query_unicode_form not in QUERY_UNICODE_FORMS:
        add(f"invalid query_unicode_form {case.query_unicode_form!r}")

    if case.direction not in DIRECTIONS:
        add(f"invalid direction {case.direction!r}")

    if case.expected_result_status not in RESULT_STATUSES:
        add(f"invalid expected_result_status {case.expected_result_status!r}")

    if case.expected_matched_key_type not in MATCHED_KEY_TYPES:
        add(f"invalid expected_matched_key_type {case.expected_matched_key_type!r}")

    if case.case_family not in CASE_FAMILIES:
        add(f"invalid case_family {case.case_family!r}")

    if case.review_status not in REVIEW_STATUSES:
        add(f"review_status must be 'approved', got {case.review_status!r}")

    if case.case_tags is not None:
        if not isinstance(case.case_tags, list) or not all(
            isinstance(tag, str) for tag in case.case_tags
        ):
            add("case_tags must be a string array")

    if case.expected_result_count != len(case.expected_ir_ids):
        add(
            "expected_result_count must equal len(expected_ir_ids): "
            f"{case.expected_result_count} != {len(case.expected_ir_ids)}"
        )

    if case.expected_result_status == "miss":
        if case.expected_result_count != 0:
            add("miss requires expected_result_count 0")
        if case.expected_ir_ids:
            add("miss requires empty expected_ir_ids")
        if case.expected_matched_key_type != "none":
            add("miss requires expected_matched_key_type 'none'")
        if case.expected_matched_key is not None:
            add("miss requires expected_matched_key null")
        if case.expected_deep_ladder:
            add("miss requires expected_deep_ladder false")
    elif case.expected_result_status == "hit_single":
        if case.expected_result_count != 1:
            add("hit_single requires expected_result_count 1")
    elif case.expected_result_status == "hit_multi":
        if case.expected_result_count < 2:
            add("hit_multi requires expected_result_count >= 2")

    seen_ir_ids: set[str] = set()
    for ir_id in case.expected_ir_ids:
        if not ir_id.strip():
            add("expected_ir_ids must not contain empty values")
        if ir_id in seen_ir_ids:
            add(f"duplicate IR id in expected_ir_ids: {ir_id!r}")
        seen_ir_ids.add(ir_id)

    if case.query_unicode_form == "nfc":
        if unicodedata.normalize("NFC", case.query) != case.query:
            add("query_unicode_form=nfc requires query to be exact NFC")
    elif case.query_unicode_form == "nfd":
        if unicodedata.normalize("NFD", case.query) != case.query:
            add("query_unicode_form=nfd requires query to be exact NFD")

    if case.case_family == "unicode_canonicalization":
        if case.query_unicode_form != "nfd":
            add("unicode_canonicalization requires query_unicode_form nfd")

    if case.query == KUN_NFD and case.query_unicode_form != "nfd":
        add("kùn row must use query_unicode_form nfd")

    if case.query == KUN_NFC and case.query_unicode_form != "nfc":
        add("Kùn row must use query_unicode_form nfc")

    if not case.bundle_id.strip():
        add("empty bundle_id")

    if not case.norm_version.strip():
        add("empty norm_version")

    if manifest is not None:
        if case.bundle_id != manifest.bundle_id:
            add(
                f"bundle_id must match manifest {manifest.bundle_id!r}, "
                f"got {case.bundle_id!r}"
            )
        if case.norm_version != manifest.norm_version:
            add(
                f"norm_version must match manifest {manifest.norm_version!r}, "
                f"got {case.norm_version!r}"
            )

    return errors


def validate_matrix(
    cases: list[SearchRegressionCase],
    manifest: MatrixManifest | None = None,
) -> list[ValidationError]:
    errors: list[ValidationError] = []

    if manifest is not None:
        if manifest.schema_version != MANIFEST_SCHEMA_VERSION:
            errors.append(
                ValidationError(
                    case_id="",
                    message=(
                        f"manifest schema_version must be {MANIFEST_SCHEMA_VERSION!r}, "
                        f"got {manifest.schema_version!r}"
                    ),
                )
            )
        if manifest.matrix_schema_version != CASE_SCHEMA_VERSION:
            errors.append(
                ValidationError(
                    case_id="",
                    message=(
                        f"manifest matrix_schema_version must be {CASE_SCHEMA_VERSION!r}, "
                        f"got {manifest.matrix_schema_version!r}"
                    ),
                )
            )
        if manifest.case_count != len(cases):
            errors.append(
                ValidationError(
                    case_id="",
                    message=(
                        f"manifest case_count {manifest.case_count} "
                        f"does not match loaded rows {len(cases)}"
                    ),
                )
            )

    seen_case_ids: set[str] = set()
    seen_queries: set[str] = set()

    for case in cases:
        for error in validate_case(case, manifest):
            errors.append(error)

        if case.case_id in seen_case_ids:
            errors.append(
                ValidationError(
                    case_id=case.case_id,
                    message=f"duplicate case_id {case.case_id!r}",
                )
            )
        seen_case_ids.add(case.case_id)
        seen_queries.add(case.query)

    matrix_family = manifest.matrix_family if manifest is not None else "phase7l_pinned"
    if matrix_family == "phase7l_pinned":
        missing_queries = sorted(SEED_QUERIES - seen_queries)
        if missing_queries:
            errors.append(
                ValidationError(
                    case_id="",
                    message=f"missing required seed queries: {', '.join(missing_queries)}",
                )
            )
    elif matrix_family == "phase7n2a_additive":
        # Additive matrices run beside 7L and do not inherit the pinned 7L seed set.
        pass
    else:
        errors.append(
            ValidationError(
                case_id="",
                message=f"unsupported matrix family {matrix_family!r}",
            )
        )

    return errors
