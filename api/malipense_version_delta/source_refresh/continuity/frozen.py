"""Verify frozen F11–F16 inputs for CORPUS1F17."""

from __future__ import annotations

from dataclasses import dataclass

from malipense_version_delta.canonical_json import sha256_file
from malipense_version_delta.frozen_inputs import (
    FROZEN_BASELINE_IR_SHA256,
    FROZEN_CURRENT_IR_SHA256,
    FROZEN_DELTA_SHA256,
    FrozenInputMismatchError,
)

from ..paths import (
    FROZEN_ACCEPTANCE_SHA256,
    FROZEN_DESTRUCTIVE_MANIFEST_SHA256,
    FROZEN_F16_PROPOSALS_SHA256,
    FROZEN_INTEGRITY_MANIFEST_SHA256,
    FROZEN_REVIEW_REGISTRY_SHA256,
    SourceRefreshPaths,
)


@dataclass(frozen=True)
class F17FrozenInputs:
    baseline_ir_sha256: str
    current_ir_sha256: str
    delta_sha256: str
    review_registry_sha256: str
    acceptance_sha256: str
    integrity_manifest_sha256: str
    destructive_manifest_sha256: str
    f16_proposals_sha256: str


def verify_f17_frozen_inputs(paths: SourceRefreshPaths) -> F17FrozenInputs:
    checks = [
        (paths.baseline_ir, FROZEN_BASELINE_IR_SHA256, "baseline_ir"),
        (paths.current_ir, FROZEN_CURRENT_IR_SHA256, "current_ir"),
        (paths.delta, FROZEN_DELTA_SHA256, "delta"),
        (paths.review_registry, FROZEN_REVIEW_REGISTRY_SHA256, "review_registry"),
        (paths.acceptance_json, FROZEN_ACCEPTANCE_SHA256, "acceptance"),
        (paths.integrity_manifest, FROZEN_INTEGRITY_MANIFEST_SHA256, "integrity_manifest"),
        (
            paths.destructive_manifest,
            FROZEN_DESTRUCTIVE_MANIFEST_SHA256,
            "destructive_manifest",
        ),
        (
            paths.f16_dir / "downstream_ir_id_remap_proposals.jsonl",
            FROZEN_F16_PROPOSALS_SHA256,
            "f16_proposals",
        ),
    ]
    for path, expected, label in checks:
        if not path.is_file():
            raise FrozenInputMismatchError(f"{label}: missing file {path}")
        actual = sha256_file(path)
        if actual != expected:
            raise FrozenInputMismatchError(
                f"{label}: expected {expected}, got {actual}"
            )
    return F17FrozenInputs(
        baseline_ir_sha256=FROZEN_BASELINE_IR_SHA256,
        current_ir_sha256=FROZEN_CURRENT_IR_SHA256,
        delta_sha256=FROZEN_DELTA_SHA256,
        review_registry_sha256=FROZEN_REVIEW_REGISTRY_SHA256,
        acceptance_sha256=FROZEN_ACCEPTANCE_SHA256,
        integrity_manifest_sha256=FROZEN_INTEGRITY_MANIFEST_SHA256,
        destructive_manifest_sha256=FROZEN_DESTRUCTIVE_MANIFEST_SHA256,
        f16_proposals_sha256=FROZEN_F16_PROPOSALS_SHA256,
    )
