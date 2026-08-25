"""Classify product items and their substantive rights dependencies."""

from __future__ import annotations

from typing import Any

from .model import (
    BLOCKED_COMMERCIAL,
    COMMERCIAL_PERMISSION_NOT_RECORDED,
    COMMERCIAL_SAFE_INDEPENDENT,
    COMMERCIAL_SAFE_LICENSED,
    DEP_DIRECT_MALIDABA,
    DEP_INDEPENDENT_COMMERCIAL_SAFE,
    DEP_LEGACY_MALIDABA,
    DEP_MALIDABA_DERIVED,
    DEP_MIXED_MALIDABA_OTHER,
    DEP_UNKNOWN_BLOCKED,
    LAYER_LEGACY,
    LICENSE_CC_BY_NC_SA,
    LICENSE_PROJECT_INTERNAL,
    MALIDABA_DERIVED_ALIAS,
    MALIDABA_DERIVED_SUPPLEMENT,
    MALIDABA_DERIVED_VARIANT,
    MALIDABA_DIRECT_CONTENT,
    MALIDABA_EVIDENCE_DEPENDENCY,
    MALIDABA_LEGACY_CONTENT,
    METADATA_ONLY_NONCONTENT,
    MISSING_PROVENANCE,
    MIXED_RIGHTS,
    MIXED_SOURCE_RIGHTS,
    NONCOMMERCIAL_LICENSE,
    NONCOMMERCIAL_SOURCE_DERIVED,
    PROJECT_INTERNAL_LICENSE_ONLY,
    SOURCE_MALIPENSE,
    SOURCE_OWNER,
    UNKNOWN_RIGHTS,
    UNKNOWN_SOURCE_RIGHTS,
)
from .registry import commercial_compatible_license


def is_legacy_malidaba_record(record: dict[str, Any]) -> bool:
    layer = record.get("edition_layer")
    if isinstance(layer, dict):
        if layer.get("schema_version") == LAYER_LEGACY:
            return True
        if layer.get("current_edition_attribution") is False and layer.get(
            "human_disposition"
        ) == "retain_baseline_record":
            return True
    return False


def is_direct_malidaba_record(record: dict[str, Any]) -> bool:
    if record.get("source_id") == SOURCE_MALIPENSE:
        return True
    layer = record.get("edition_layer")
    if isinstance(layer, dict) and layer.get("source_id") == SOURCE_MALIPENSE:
        return True
    return False


def owner_claims_independent(record: dict[str, Any]) -> bool:
    if record.get("source_id") != SOURCE_OWNER:
        return False
    provenance = record.get("provenance") or {}
    source = provenance.get("source") if isinstance(provenance, dict) else None
    notes = ""
    if isinstance(source, dict):
        notes = str(source.get("license_notes") or "")
    if "not derived from Mali-Pense" in notes or "not derived from Malidaba" in notes:
        return True
    evidence = record.get("evidence") or []
    if not evidence:
        return False
    for item in evidence:
        if not isinstance(item, dict):
            return False
        if item.get("source_id") == SOURCE_MALIPENSE:
            return False
        if "review_reference" not in item:
            return False
    return True


def classify_source_id(
    source_id: str | None,
    *,
    claimed_license: str | None,
    is_legacy: bool = False,
) -> tuple[str, list[str], str]:
    """
    Return (classification, reason_codes, dependence_bucket).

    Fail-closed for commercial eligibility.
    """
    reasons: list[str] = []
    if not source_id:
        reasons.append(MISSING_PROVENANCE)
        return UNKNOWN_RIGHTS, reasons, DEP_UNKNOWN_BLOCKED

    if source_id == SOURCE_MALIPENSE:
        reasons.append(NONCOMMERCIAL_LICENSE)
        if is_legacy:
            reasons.append(MALIDABA_LEGACY_CONTENT)
            return NONCOMMERCIAL_SOURCE_DERIVED, reasons, DEP_LEGACY_MALIDABA
        reasons.append(MALIDABA_DIRECT_CONTENT)
        return NONCOMMERCIAL_SOURCE_DERIVED, reasons, DEP_DIRECT_MALIDABA

    if source_id == SOURCE_OWNER:
        if claimed_license == LICENSE_PROJECT_INTERNAL or not commercial_compatible_license(
            claimed_license
        ):
            reasons.append(COMMERCIAL_PERMISSION_NOT_RECORDED)
            reasons.append(PROJECT_INTERNAL_LICENSE_ONLY)
            # Independently authored content still lacks recorded commercial permission.
            return BLOCKED_COMMERCIAL, reasons, DEP_UNKNOWN_BLOCKED
        return COMMERCIAL_SAFE_INDEPENDENT, reasons, DEP_INDEPENDENT_COMMERCIAL_SAFE

    if commercial_compatible_license(claimed_license):
        return COMMERCIAL_SAFE_LICENSED, reasons, DEP_INDEPENDENT_COMMERCIAL_SAFE

    if claimed_license and "NC" in claimed_license.upper():
        reasons.append(NONCOMMERCIAL_LICENSE)
        return NONCOMMERCIAL_SOURCE_DERIVED, reasons, DEP_UNKNOWN_BLOCKED

    reasons.append(UNKNOWN_SOURCE_RIGHTS)
    return UNKNOWN_RIGHTS, reasons, DEP_UNKNOWN_BLOCKED


def classify_product_record(
    record: dict[str, Any],
    *,
    registry_licenses: dict[str, str],
    malidaba_ir_ids: set[str],
    legacy_ir_ids: set[str],
    evidence_ir_ids: set[str] | None = None,
) -> dict[str, Any]:
    """Classify one product-visible lexicon/index record."""
    ir_id = str(record.get("ir_id") or "")
    source_id = record.get("source_id")
    if not isinstance(source_id, str):
        source_id = None
    claimed = registry_licenses.get(source_id or "")
    layer = record.get("edition_layer") if isinstance(record.get("edition_layer"), dict) else {}
    if not claimed and isinstance(layer, dict):
        claimed = layer.get("claimed_license")

    is_legacy = is_legacy_malidaba_record(record)
    classification, reasons, dep = classify_source_id(
        source_id, claimed_license=claimed if isinstance(claimed, str) else None, is_legacy=is_legacy
    )

    substantive_deps: list[str] = []
    if is_direct_malidaba_record(record) or ir_id in malidaba_ir_ids:
        substantive_deps.append(ir_id)
    if evidence_ir_ids:
        for eid in sorted(evidence_ir_ids):
            if eid in malidaba_ir_ids or eid in legacy_ir_ids:
                substantive_deps.append(eid)
                if MALIDABA_EVIDENCE_DEPENDENCY not in reasons:
                    reasons.append(MALIDABA_EVIDENCE_DEPENDENCY)
                if classification in {
                    COMMERCIAL_SAFE_INDEPENDENT,
                    COMMERCIAL_SAFE_LICENSED,
                    BLOCKED_COMMERCIAL,
                }:
                    classification = MIXED_RIGHTS
                    if MIXED_SOURCE_RIGHTS not in reasons:
                        reasons.append(MIXED_SOURCE_RIGHTS)
                    dep = DEP_MIXED_MALIDABA_OTHER

    # Owner independence audit (separate from commercial eligibility).
    independence = "not_owner"
    if source_id == SOURCE_OWNER:
        if owner_claims_independent(record) and not (
            evidence_ir_ids and (evidence_ir_ids & (malidaba_ir_ids | legacy_ir_ids))
        ):
            independence = "independently_evidenced"
        elif evidence_ir_ids and (evidence_ir_ids & (malidaba_ir_ids | legacy_ir_ids)):
            independence = "malidaba_derived_or_dependent"
            classification = MIXED_RIGHTS
            reasons.append(MALIDABA_EVIDENCE_DEPENDENCY)
            reasons.append(MIXED_SOURCE_RIGHTS)
            dep = DEP_MIXED_MALIDABA_OTHER
        else:
            independence = "mixed_or_unclear"

    commercial_eligible = classification in {
        COMMERCIAL_SAFE_INDEPENDENT,
        COMMERCIAL_SAFE_LICENSED,
        METADATA_ONLY_NONCONTENT,
    }
    ir_kind = record.get("ir_kind")
    return {
        "product_item_id": ir_id,
        "item_kind": ir_kind if isinstance(ir_kind, str) and ir_kind else "record",
        "source_id": source_id,
        "classification": classification,
        "dependence_bucket": dep,
        "reason_codes": sorted(set(reasons)),
        "substantive_source_dependencies": sorted(set(substantive_deps)),
        "commercial_eligible": commercial_eligible,
        "owner_independence": independence,
        "preferred_form": record.get("preferred_form")
        or (record.get("display") or {}).get("headword_latin")
        or (record.get("fields_raw") or {}).get("headword_latin"),
    }


def classify_alias_row(
    row: dict[str, Any],
    *,
    malidaba_ir_ids: set[str],
    legacy_ir_ids: set[str],
    record_class_by_id: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    resolved = [str(x) for x in (row.get("resolved_ir_ids") or []) if x]
    evidence = [str(x) for x in (row.get("evidence_ir_ids") or []) if x]
    reasons: list[str] = []
    deps = sorted(set(resolved + evidence))
    touches_malidaba = any(i in malidaba_ir_ids or i in legacy_ir_ids for i in deps)
    blocked_target = False
    for ir_id in resolved:
        cls = record_class_by_id.get(ir_id)
        if cls is None or not cls.get("commercial_eligible"):
            blocked_target = True
    if touches_malidaba:
        reasons.append(MALIDABA_DERIVED_ALIAS)
        classification = NONCOMMERCIAL_SOURCE_DERIVED
        dep = DEP_MALIDABA_DERIVED
    elif blocked_target:
        reasons.append(COMMERCIAL_PERMISSION_NOT_RECORDED)
        classification = BLOCKED_COMMERCIAL
        dep = DEP_UNKNOWN_BLOCKED
    else:
        classification = METADATA_ONLY_NONCONTENT
        dep = DEP_INDEPENDENT_COMMERCIAL_SAFE
    return {
        "product_item_id": str(row.get("alias_id") or ""),
        "item_kind": "source_alias",
        "classification": classification,
        "dependence_bucket": dep,
        "reason_codes": sorted(set(reasons)),
        "substantive_source_dependencies": deps,
        "commercial_eligible": classification
        in {COMMERCIAL_SAFE_INDEPENDENT, COMMERCIAL_SAFE_LICENSED, METADATA_ONLY_NONCONTENT}
        and not blocked_target
        and not touches_malidaba,
        "alias_source_term": row.get("alias_source_term"),
    }


def classify_supplement_row(
    row: dict[str, Any],
    *,
    malidaba_ir_ids: set[str],
    legacy_ir_ids: set[str],
    record_class_by_id: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    targets = [str(x) for x in (row.get("target_ir_ids") or []) if x]
    evidence = [str(x) for x in (row.get("supporting_evidence_ir_ids") or []) if x]
    deps = sorted(set(targets + evidence))
    reasons: list[str] = []
    touches_malidaba = any(i in malidaba_ir_ids or i in legacy_ir_ids for i in deps)
    blocked_target = any(
        not (record_class_by_id.get(i) or {}).get("commercial_eligible") for i in targets
    )
    if touches_malidaba:
        reasons.append(MALIDABA_DERIVED_SUPPLEMENT)
        if any(i in malidaba_ir_ids or i in legacy_ir_ids for i in evidence):
            reasons.append(MALIDABA_EVIDENCE_DEPENDENCY)
        # Owner targets + Malidaba evidence = mixed.
        owner_targets = any(
            (record_class_by_id.get(i) or {}).get("source_id") == SOURCE_OWNER for i in targets
        )
        if owner_targets:
            classification = MIXED_RIGHTS
            reasons.append(MIXED_SOURCE_RIGHTS)
            dep = DEP_MIXED_MALIDABA_OTHER
        else:
            classification = NONCOMMERCIAL_SOURCE_DERIVED
            dep = DEP_MALIDABA_DERIVED
    elif blocked_target:
        reasons.append(COMMERCIAL_PERMISSION_NOT_RECORDED)
        classification = BLOCKED_COMMERCIAL
        dep = DEP_UNKNOWN_BLOCKED
    else:
        classification = METADATA_ONLY_NONCONTENT
        dep = DEP_INDEPENDENT_COMMERCIAL_SAFE
    return {
        "product_item_id": str(row.get("supplement_id") or ""),
        "item_kind": "source_index_supplement",
        "classification": classification,
        "dependence_bucket": dep,
        "reason_codes": sorted(set(reasons)),
        "substantive_source_dependencies": deps,
        "commercial_eligible": False
        if touches_malidaba or blocked_target
        else classification == METADATA_ONLY_NONCONTENT,
        "source_term": row.get("source_term"),
    }


def classify_variant_row(
    row: dict[str, Any],
    *,
    malidaba_ir_ids: set[str],
    legacy_ir_ids: set[str],
    record_class_by_id: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    canonical = str(row.get("canonical_ir_id") or "")
    reasons: list[str] = []
    deps = [canonical] if canonical else []
    touches = canonical in malidaba_ir_ids or canonical in legacy_ir_ids
    target_ok = (record_class_by_id.get(canonical) or {}).get("commercial_eligible") is True
    if touches:
        reasons.append(MALIDABA_DERIVED_VARIANT)
        classification = NONCOMMERCIAL_SOURCE_DERIVED
        dep = DEP_MALIDABA_DERIVED
    elif not target_ok:
        reasons.append(COMMERCIAL_PERMISSION_NOT_RECORDED)
        classification = BLOCKED_COMMERCIAL
        dep = DEP_UNKNOWN_BLOCKED
    else:
        classification = METADATA_ONLY_NONCONTENT
        dep = DEP_INDEPENDENT_COMMERCIAL_SAFE
    return {
        "product_item_id": str(row.get("variant_id") or ""),
        "item_kind": "reviewed_target_variant",
        "classification": classification,
        "dependence_bucket": dep,
        "reason_codes": sorted(set(reasons)),
        "substantive_source_dependencies": deps,
        "commercial_eligible": classification == METADATA_ONLY_NONCONTENT and target_ok and not touches,
        "form": row.get("form"),
    }


def recursive_commercial_closure(
    item: dict[str, Any],
    *,
    class_by_id: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    """One blocked substantive ancestor ⇒ commercial candidate blocked."""
    if item.get("commercial_eligible") is not True:
        return {
            **item,
            "provenance_closure": "FAIL",
            "closure_blocking_ancestors": list(item.get("substantive_source_dependencies") or []),
        }
    blockers: list[str] = []
    for dep in item.get("substantive_source_dependencies") or []:
        ancestor = class_by_id.get(dep)
        if ancestor is None:
            blockers.append(dep)
            continue
        if ancestor.get("commercial_eligible") is not True:
            blockers.append(dep)
        if ancestor.get("classification") in {
            NONCOMMERCIAL_SOURCE_DERIVED,
            MIXED_RIGHTS,
            UNKNOWN_RIGHTS,
            BLOCKED_COMMERCIAL,
        }:
            blockers.append(dep)
    ok = not blockers
    return {
        **item,
        "commercial_eligible": ok,
        "provenance_closure": "PASS" if ok else "FAIL",
        "closure_blocking_ancestors": sorted(set(blockers)),
        "classification": item["classification"] if ok else BLOCKED_COMMERCIAL,
    }
