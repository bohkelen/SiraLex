"""Frozen CORPUS1F15 / F11 input verification for F16 transition gate."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from malipense_version_delta.canonical_json import sha256_file
from malipense_version_delta.frozen_inputs import (
    FrozenInputMismatchError,
    verify_frozen_inputs,
)

from ..paths import (
    FROZEN_ACCEPTANCE_SHA256,
    FROZEN_DESTRUCTIVE_MANIFEST_SHA256,
    FROZEN_INTEGRITY_MANIFEST_SHA256,
    FROZEN_REVIEW_REGISTRY_SHA256,
    SourceRefreshPaths,
)


@dataclass(frozen=True)
class FrozenF16Inputs:
    baseline_ir_sha256: str
    current_ir_sha256: str
    delta_sha256: str
    review_registry_sha256: str
    acceptance_sha256: str
    integrity_manifest_sha256: str
    destructive_manifest_sha256: str


def verify_f16_frozen_inputs(paths: SourceRefreshPaths) -> FrozenF16Inputs:
    """Verify all frozen F11–F15 hashes required by CORPUS1F16."""
    frozen = verify_frozen_inputs(
        baseline_ir_path=paths.baseline_ir,
        current_ir_path=paths.current_ir,
        delta_path=paths.delta,
        crawl_dir=paths.crawl_dir,
    )
    review_sha = sha256_file(paths.review_registry)
    if review_sha != FROZEN_REVIEW_REGISTRY_SHA256:
        raise FrozenInputMismatchError(
            f"review_registry_sha256 expected {FROZEN_REVIEW_REGISTRY_SHA256} got {review_sha}"
        )

    for label, path, expected in (
        ("acceptance", paths.acceptance_json, FROZEN_ACCEPTANCE_SHA256),
        ("integrity_manifest", paths.integrity_manifest, FROZEN_INTEGRITY_MANIFEST_SHA256),
        (
            "destructive_manifest",
            paths.destructive_manifest,
            FROZEN_DESTRUCTIVE_MANIFEST_SHA256,
        ),
    ):
        if not path.is_file():
            raise FrozenInputMismatchError(f"missing frozen input file: {label}={path}")
        got = sha256_file(path)
        if got != expected:
            raise FrozenInputMismatchError(
                f"{label}_sha256 expected {expected} got {got}"
            )

    return FrozenF16Inputs(
        baseline_ir_sha256=frozen.baseline_ir_sha256,
        current_ir_sha256=frozen.current_ir_sha256,
        delta_sha256=frozen.delta_sha256,
        review_registry_sha256=review_sha,
        acceptance_sha256=FROZEN_ACCEPTANCE_SHA256,
        integrity_manifest_sha256=FROZEN_INTEGRITY_MANIFEST_SHA256,
        destructive_manifest_sha256=FROZEN_DESTRUCTIVE_MANIFEST_SHA256,
    )
