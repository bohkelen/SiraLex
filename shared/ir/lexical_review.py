"""
Contracts for SiraLex owner-reviewed lexical additions and reviewed target variants.

See docs/PHASE_7N2A3_SCHEMA_AND_ARTIFACT_DECISION.md.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from normalization.norm_v3 import normalize_nfc

SIRALEX_LEXICAL_REVIEW_SOURCE_ID = "src_siralex_lexical_review"
SIRALEX_OWNER_LEXICAL_PARSER_VERSION = "siralex_owner_lexical_v1"
OWNER_APPROVED_LEXICAL_DERIVATION_KIND = "owner_approved_lexical_addition"

REVIEW_REFERENCE_REQUIRED_FIELDS = frozenset(
    {"document_path", "approval_status", "reviewer_role"}
)
REVIEWED_TARGET_VARIANT_REQUIRED_FIELDS = frozenset(
    {"form", "review_document", "reviewer", "reviewed_at", "rationale"}
)

MALIPENSE_SOURCE_ID = "src_malipense"
MALIPENSE_URL_PREFIX = "https://www.mali-pense.net/"


class LexicalReviewValidationError(ValueError):
    """Raised when manual lexical-review or reviewed-target-variant rules fail."""


@dataclass
class ReviewedTargetVariant:
    """Owner-reviewed target-side spelling variant attached to an existing lexicon entry."""

    form: str
    review_document: str
    reviewer: str
    reviewed_at: str
    rationale: str

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> "ReviewedTargetVariant":
        missing = REVIEWED_TARGET_VARIANT_REQUIRED_FIELDS - payload.keys()
        if missing:
            raise LexicalReviewValidationError(
                f"reviewed_target_variants item missing fields: {sorted(missing)}"
            )
        form = payload.get("form")
        if not isinstance(form, str) or not form.strip():
            raise LexicalReviewValidationError("reviewed_target_variants.form must be non-empty")
        return cls(
            form=form,
            review_document=str(payload["review_document"]),
            reviewer=str(payload["reviewer"]),
            reviewed_at=str(payload["reviewed_at"]),
            rationale=str(payload["rationale"]),
        )


def _nfc_key(value: str) -> str:
    return normalize_nfc(value.strip())


def validate_review_reference(review_reference: Any, *, line_context: str = "") -> None:
    if not isinstance(review_reference, dict):
        raise LexicalReviewValidationError(
            f"{line_context}review_reference must be an object"
        )
    missing = REVIEW_REFERENCE_REQUIRED_FIELDS - review_reference.keys()
    if missing:
        raise LexicalReviewValidationError(
            f"{line_context}review_reference missing fields: {sorted(missing)}"
        )
    for field_name in REVIEW_REFERENCE_REQUIRED_FIELDS:
        value = review_reference.get(field_name)
        if not isinstance(value, str) or not value.strip():
            raise LexicalReviewValidationError(
                f"{line_context}review_reference.{field_name} must be a non-empty string"
            )


def validate_manual_lexical_review_evidence(
    evidence: Any,
    *,
    line_context: str = "",
) -> None:
    """Validate evidence[] for src_siralex_lexical_review lexicon entries."""
    if not isinstance(evidence, list) or not evidence:
        raise LexicalReviewValidationError(
            f"{line_context}manual lexical-review entries require non-empty evidence[]"
        )

    saw_review_reference = False
    for index, item in enumerate(evidence):
        if not isinstance(item, dict):
            raise LexicalReviewValidationError(
                f"{line_context}evidence[{index}] must be an object"
            )
        if item.get("source_id") != SIRALEX_LEXICAL_REVIEW_SOURCE_ID:
            raise LexicalReviewValidationError(
                f"{line_context}evidence[{index}].source_id must be {SIRALEX_LEXICAL_REVIEW_SOURCE_ID}"
            )
        if item.get("snapshot_id"):
            raise LexicalReviewValidationError(
                f"{line_context}evidence[{index}] must not include snapshot_id"
            )
        if "review_reference" not in item:
            raise LexicalReviewValidationError(
                f"{line_context}evidence[{index}] requires review_reference"
            )
        validate_review_reference(
            item["review_reference"],
            line_context=f"{line_context}evidence[{index}].",
        )
        text_quote = item.get("text_quote")
        if not isinstance(text_quote, str) or not text_quote.strip():
            raise LexicalReviewValidationError(
                f"{line_context}evidence[{index}].text_quote must be a non-empty string"
            )
        saw_review_reference = True

    if not saw_review_reference:
        raise LexicalReviewValidationError(
            f"{line_context}manual lexical-review evidence requires review_reference"
        )


def validate_malipense_lexicon_evidence(
    evidence: Any,
    *,
    line_context: str = "",
) -> None:
    """Validate that Mali-Pense lexicon evidence still requires snapshot-backed proof."""
    if not isinstance(evidence, list) or not evidence:
        raise LexicalReviewValidationError(
            f"{line_context}Mali-Pense lexicon entries require non-empty evidence[]"
        )

    for index, item in enumerate(evidence):
        if not isinstance(item, dict):
            raise LexicalReviewValidationError(
                f"{line_context}evidence[{index}] must be an object"
            )
        snapshot_id = item.get("snapshot_id")
        entry_block = item.get("entry_block")
        css_selector = item.get("css_selector")
        if not snapshot_id:
            raise LexicalReviewValidationError(
                f"{line_context}evidence[{index}] requires snapshot_id"
            )
        if not entry_block and not css_selector:
            raise LexicalReviewValidationError(
                f"{line_context}evidence[{index}] requires entry_block or css_selector"
            )
        if item.get("review_reference") is not None:
            raise LexicalReviewValidationError(
                f"{line_context}evidence[{index}] must not include review_reference"
            )


def validate_lexicon_entry_evidence(ir_unit: dict[str, Any], *, line_context: str = "") -> None:
    """Dispatch evidence validation by source_id without changing Mali-Pense rules."""
    source_id = ir_unit.get("source_id", "")
    evidence = ir_unit.get("evidence", [])
    if source_id == SIRALEX_LEXICAL_REVIEW_SOURCE_ID:
        validate_manual_lexical_review_evidence(evidence, line_context=line_context)
        record_locator = ir_unit.get("record_locator", {})
        url_canonical = record_locator.get("url_canonical", "")
        if isinstance(url_canonical, str) and url_canonical.startswith(MALIPENSE_URL_PREFIX):
            raise LexicalReviewValidationError(
                f"{line_context}manual lexical-review record_locator must not use Mali-Pense url_canonical"
            )
        return
    if source_id == MALIPENSE_SOURCE_ID and ir_unit.get("ir_kind") == "lexicon_entry":
        validate_malipense_lexicon_evidence(evidence, line_context=line_context)


def parse_reviewed_target_variants(ir_unit: dict[str, Any]) -> list[ReviewedTargetVariant]:
    raw_variants = ir_unit.get("reviewed_target_variants")
    if raw_variants is None:
        return []
    if not isinstance(raw_variants, list):
        raise LexicalReviewValidationError("reviewed_target_variants must be an array")
    variants = [ReviewedTargetVariant.from_dict(item) for item in raw_variants]
    ir_id = str(ir_unit.get("ir_id", ""))
    seen_keys: set[str] = set()
    for variant in variants:
        key = _nfc_key(variant.form)
        if key in seen_keys:
            raise LexicalReviewValidationError(
                f"reviewed_target_variants contains duplicate form on {ir_id}"
            )
        seen_keys.add(key)
    return variants


@dataclass
class LexiconVariantRegistry:
    """Tracks source-attested Latin and reviewed forms to prevent duplicate target keys.

    Source-attested N'Ko headwords are intentionally excluded from the global map:
    the frozen Mali-Pense corpus legitimately reuses N'Ko forms across distinct
    Latin entries. Per-record normalization still merges N'Ko into variant_forms.

    Source-attested Latin forms are indexed without aborting on homographs so frozen
    corpus normalization can complete. Reviewed target variants remain fail-closed
    against other records' attested Latin forms and reviewed forms.
    """

    _attested_form_to_ir_ids: dict[str, set[str]] = field(default_factory=dict)
    _reviewed_form_to_ir_id: dict[str, str] = field(default_factory=dict)

    def source_attested_forms(self, ir_unit: dict[str, Any]) -> list[str]:
        """Latin attested forms indexed for cross-record reviewed-variant checks."""
        fields_raw = ir_unit.get("fields_raw", {})
        record_locator = ir_unit.get("record_locator", {})
        forms: list[str] = []

        headword = fields_raw.get("headword_latin", "")
        if isinstance(headword, str) and headword.strip():
            forms.append(headword)

        anchor_names = record_locator.get("anchor_names", [])
        if isinstance(anchor_names, list):
            forms.extend(
                name for name in anchor_names if isinstance(name, str) and name.strip()
            )

        return forms

    def register_source_attested(self, ir_unit: dict[str, Any]) -> None:
        ir_id = str(ir_unit.get("ir_id", ""))
        if not ir_id:
            raise LexicalReviewValidationError("lexicon entry missing ir_id")
        for form in self.source_attested_forms(ir_unit):
            self._index_attested_form(ir_id, form)

    def validate_reviewed_variant(
        self,
        ir_unit: dict[str, Any],
        variant: ReviewedTargetVariant,
    ) -> None:
        ir_id = str(ir_unit.get("ir_id", ""))
        fields_raw = ir_unit.get("fields_raw", {})
        anchor_names = ir_unit.get("record_locator", {}).get("anchor_names", [])
        if not isinstance(anchor_names, list):
            anchor_names = []

        variant_key = _nfc_key(variant.form)

        headword_latin = fields_raw.get("headword_latin", "")
        if (
            isinstance(headword_latin, str)
            and headword_latin.strip()
            and _nfc_key(headword_latin) == variant_key
        ):
            raise LexicalReviewValidationError(
                f"reviewed_target_variants.form duplicates canonical headword_latin "
                f"on {ir_id}"
            )

        for anchor in anchor_names:
            if isinstance(anchor, str) and _nfc_key(anchor) == variant_key:
                raise LexicalReviewValidationError(
                    f"reviewed_target_variants.form duplicates anchor_names entry on {ir_id}"
                )

        attested_owners = self._attested_form_to_ir_ids.get(variant_key, set())
        other_attested = attested_owners - {ir_id}
        if other_attested:
            raise LexicalReviewValidationError(
                "reviewed_target_variants.form conflicts with lexical record "
                f"{sorted(other_attested)[0]}"
            )

        reviewed_owner = self._reviewed_form_to_ir_id.get(variant_key)
        if reviewed_owner is not None and reviewed_owner != ir_id:
            raise LexicalReviewValidationError(
                f"reviewed_target_variants.form conflicts with lexical record {reviewed_owner}"
            )

    def register_reviewed_form(self, ir_id: str, form: str) -> None:
        key = _nfc_key(form)
        owner = self._reviewed_form_to_ir_id.get(key)
        if owner is not None and owner != ir_id:
            raise LexicalReviewValidationError(
                f"duplicate lexical form {form!r} conflicts with record {owner}"
            )
        self._reviewed_form_to_ir_id[key] = ir_id

    def _index_attested_form(self, ir_id: str, form: str) -> None:
        key = _nfc_key(form)
        self._attested_form_to_ir_ids.setdefault(key, set()).add(ir_id)
