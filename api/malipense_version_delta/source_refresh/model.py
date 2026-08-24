"""Gate result and acceptance receipt models for source-refresh dry-run."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any

ACCEPTANCE_SCHEMA_VERSION = "malidaba_source_refresh_acceptance_v1"

GateStatus = str  # PASS | BLOCK | NOT_APPLICABLE

OVERALL_ENGINEERING_READY = "SOURCE_REFRESH_ENGINEERING_READY"
OVERALL_BLOCKED_DESTRUCTIVE = "SOURCE_REFRESH_BLOCKED_DESTRUCTIVE_CHANGE"
OVERALL_BLOCKED_REFERENCE = "SOURCE_REFRESH_BLOCKED_REFERENCE_INTEGRITY"
OVERALL_BLOCKED_BUILD = "SOURCE_REFRESH_BLOCKED_BUILD_REGRESSION"
OVERALL_BLOCKED_EVIDENCE = "SOURCE_REFRESH_BLOCKED_EVIDENCE"

OverallDecision = str

GATE_IDS = (
    "G1_SOURCE_CAPTURE_VALID",
    "G2_PARSER_COMPATIBILITY_PASS",
    "G3_BASELINE_REGRESSION_PASS",
    "G4_CURRENT_STRUCTURAL_COVERAGE_PASS",
    "G5_DELTA_DETERMINISTIC",
    "G6_DELTA_REVIEW_EVIDENCE_SUFFICIENT",
    "G7_DOWNSTREAM_REFERENCE_INTEGRITY_PASS",
    "G8_ISOLATED_BUILD_REGRESSION_PASS",
    "G9_NO_UNREVIEWED_DESTRUCTIVE_CHANGE",
    "G10_RIGHTS_POSTURE_RECORDED",
)

REMAP_CONFIDENCES = frozenset(
    {"STRONG", "EXACT_CONTENT_SUPPORTED", "PROVISIONAL"}
)

RESOLUTION_STILL = "STILL_RESOLVES"
RESOLUTION_REMAP = "REQUIRES_REMAP"
RESOLUTION_AMBIGUOUS = "AMBIGUOUS"
RESOLUTION_BROKEN = "BROKEN"
RESOLUTION_NOT_BOUND = "NOT_IDENTITY_BOUND"

DESTRUCTIVE_EQUIVALENT = "CURRENT_EQUIVALENT_RESOLVED"
DESTRUCTIVE_NOT_VISIBLE = "NOT_PRODUCT_VISIBLE"
DESTRUCTIVE_REQUIRES_REVIEW = "DESTRUCTIVE_CHANGE_REQUIRES_REVIEW"
DESTRUCTIVE_AMBIGUOUS = "AMBIGUOUS"

RIGHTS_ALLOWED = "allowed"
RIGHTS_REQUIRES_REVIEW = "requires_rights_review"
RIGHTS_BLOCKED = "blocked"


@dataclass(frozen=True)
class GateResult:
    gate_id: str
    status: GateStatus
    evidence: dict[str, Any] = field(default_factory=dict)
    block_reason: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "gate_id": self.gate_id,
            "status": self.status,
            "evidence": self.evidence,
            "block_reason": self.block_reason,
        }


@dataclass(frozen=True)
class RightsPosture:
    claimed_license: str
    internal_source_maintenance: str
    noncommercial_distribution: str
    commercial_distribution: str
    notes: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class SourceRefreshAcceptance:
    schema_version: str
    base_commit: str
    frozen_inputs: dict[str, Any]
    gates: dict[str, GateResult]
    review_leaf_counts: dict[str, Any]
    reference_integrity_counts: dict[str, int]
    isolated_build: dict[str, Any]
    destructive_change_counts: dict[str, int]
    rights_posture: RightsPosture
    overall_decision: OverallDecision
    blocking_reasons: list[str]
    engineering_ready: bool
    publication_authorized: bool
    product_candidates_authorized: bool

    def to_dict(self) -> dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "base_commit": self.base_commit,
            "frozen_inputs": self.frozen_inputs,
            "gates": {k: v.to_dict() for k, v in sorted(self.gates.items())},
            "review_leaf_counts": self.review_leaf_counts,
            "reference_integrity_counts": self.reference_integrity_counts,
            "isolated_build": self.isolated_build,
            "destructive_change_counts": self.destructive_change_counts,
            "rights_posture": self.rights_posture.to_dict(),
            "overall_decision": self.overall_decision,
            "blocking_reasons": self.blocking_reasons,
            "engineering_ready": self.engineering_ready,
            "publication_authorized": self.publication_authorized,
            "product_candidates_authorized": self.product_candidates_authorized,
        }


def derive_overall_decision(gates: dict[str, GateResult]) -> tuple[OverallDecision, list[str]]:
    """Map gate statuses to a single overall engineering decision."""
    reasons: list[str] = []
    evidence_ids = {
        "G1_SOURCE_CAPTURE_VALID",
        "G2_PARSER_COMPATIBILITY_PASS",
        "G3_BASELINE_REGRESSION_PASS",
        "G4_CURRENT_STRUCTURAL_COVERAGE_PASS",
        "G5_DELTA_DETERMINISTIC",
        "G6_DELTA_REVIEW_EVIDENCE_SUFFICIENT",
    }
    for gid in GATE_IDS:
        gate = gates.get(gid)
        if gate is None:
            reasons.append(f"missing_gate:{gid}")
            continue
        if gate.status == "BLOCK":
            reasons.append(gate.block_reason or f"{gid}=BLOCK")

    if any(
        gates.get(g) and gates[g].status == "BLOCK" for g in evidence_ids
    ) or any(r.startswith("missing_gate:") for r in reasons):
        return OVERALL_BLOCKED_EVIDENCE, reasons

    g7 = gates.get("G7_DOWNSTREAM_REFERENCE_INTEGRITY_PASS")
    if g7 and g7.status == "BLOCK":
        return OVERALL_BLOCKED_REFERENCE, reasons

    g8 = gates.get("G8_ISOLATED_BUILD_REGRESSION_PASS")
    if g8 and g8.status == "BLOCK":
        return OVERALL_BLOCKED_BUILD, reasons

    g9 = gates.get("G9_NO_UNREVIEWED_DESTRUCTIVE_CHANGE")
    if g9 and g9.status == "BLOCK":
        return OVERALL_BLOCKED_DESTRUCTIVE, reasons

    g10 = gates.get("G10_RIGHTS_POSTURE_RECORDED")
    if g10 and g10.status == "BLOCK":
        return OVERALL_BLOCKED_EVIDENCE, reasons

    return OVERALL_ENGINEERING_READY, reasons
