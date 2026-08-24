"""Freeze and verify every transaction input by SHA-256."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

from malipense_version_delta.canonical_json import sha256_file
from malipense_version_delta.frozen_inputs import (
    FROZEN_BASELINE_IR_SHA256,
    FROZEN_CURRENT_IR_SHA256,
    FROZEN_DELTA_SHA256,
)

from ..paths import (
    FROZEN_ACCEPTANCE_SHA256,
    FROZEN_F18_TYPE_A_REGISTRY_SHA256,
    FROZEN_F18_TYPE_B_REGISTRY_SHA256,
    FROZEN_F19_CLOSURE_SHA256,
    FROZEN_F19_LOGICAL_CONTINUITY_SHA256,
    FROZEN_F19_OVERLAY_SHA256,
    FROZEN_F19_VIRTUAL_ALIASES_SHA256,
    FROZEN_F19_VIRTUAL_INDEX_IR_SHA256,
    FROZEN_F19_VIRTUAL_RECORDS_SHA256,
    FROZEN_F19_VIRTUAL_SEARCH_INDEX_SHA256,
    FROZEN_F19_VIRTUAL_SUPPLEMENTS_SHA256,
    FROZEN_F19_VIRTUAL_TARGET_VARIANTS_SHA256,
    FROZEN_REVIEW_REGISTRY_SHA256,
    SourceRefreshPaths,
)


class FrozenTransactionInputError(ValueError):
    """Raised when a required frozen transaction input is missing or mismatched."""


@dataclass(frozen=True)
class FrozenInput:
    role: str
    path: Path
    expected_sha256: str
    actual_sha256: str

    @property
    def ok(self) -> bool:
        return self.actual_sha256 == self.expected_sha256


def _req(path: Path, role: str, expected: str) -> FrozenInput:
    if not path.is_file():
        raise FrozenTransactionInputError(f"missing_input:{role}:{path}")
    actual = sha256_file(path)
    item = FrozenInput(role=role, path=path, expected_sha256=expected, actual_sha256=actual)
    if not item.ok:
        raise FrozenTransactionInputError(
            f"hash_mismatch:{role}:expected={expected}:actual={actual}"
        )
    return item


def freeze_transaction_inputs(paths: SourceRefreshPaths) -> dict[str, Any]:
    """Verify every frozen input required to reproduce the F19 accepted candidate."""
    items = [
        _req(paths.baseline_ir, "baseline_canonical_malidaba_ir", FROZEN_BASELINE_IR_SHA256),
        _req(paths.current_ir, "current_corrected_malidaba_ir", FROZEN_CURRENT_IR_SHA256),
        _req(paths.delta, "trusted_f11_delta", FROZEN_DELTA_SHA256),
        _req(paths.review_registry, "f13_source_delta_review_registry", FROZEN_REVIEW_REGISTRY_SHA256),
        _req(paths.acceptance_json, "f15_acceptance_evidence", FROZEN_ACCEPTANCE_SHA256),
        _req(
            paths.f18_dir / "malidaba_continuity_reviews_v1.jsonl",
            "f18_type_a_continuity_registry",
            FROZEN_F18_TYPE_A_REGISTRY_SHA256,
        ),
        _req(
            paths.f18_dir / "malidaba_missing_disposition_reviews_v1.jsonl",
            "f18_type_b_disposition_registry",
            FROZEN_F18_TYPE_B_REGISTRY_SHA256,
        ),
        _req(
            paths.f19_dir / "transition_regression_closure.json",
            "f19_transition_closure_receipt",
            FROZEN_F19_CLOSURE_SHA256,
        ),
        _req(
            paths.f19_dir / "virtual" / "logical_lexical_continuity.jsonl",
            "f19_logical_continuity_graph",
            FROZEN_F19_LOGICAL_CONTINUITY_SHA256,
        ),
        _req(
            paths.f19_dir / "virtual" / "identity_overlay.json",
            "f19_identity_overlay",
            FROZEN_F19_OVERLAY_SHA256,
        ),
        _req(
            paths.f19_dir / "virtual" / "product" / "source_aliases_virtual.jsonl",
            "f19_remapped_aliases",
            FROZEN_F19_VIRTUAL_ALIASES_SHA256,
        ),
        _req(
            paths.f19_dir / "virtual" / "product" / "source_index_supplements_virtual.jsonl",
            "f19_remapped_supplements",
            FROZEN_F19_VIRTUAL_SUPPLEMENTS_SHA256,
        ),
        _req(
            paths.f19_dir
            / "virtual"
            / "product"
            / "reviewed_target_variants_virtual.jsonl",
            "f19_remapped_target_variants",
            FROZEN_F19_VIRTUAL_TARGET_VARIANTS_SHA256,
        ),
        _req(
            paths.f19_dir / "virtual" / "product" / "index_ir_virtual.jsonl",
            "f19_rewritten_index_mapping_locators",
            FROZEN_F19_VIRTUAL_INDEX_IR_SHA256,
        ),
        _req(
            paths.f19_dir / "virtual" / "product" / "candidate_records_virtual.jsonl",
            "f19_regression_replay_records",
            FROZEN_F19_VIRTUAL_RECORDS_SHA256,
        ),
        _req(
            paths.f19_dir
            / "virtual"
            / "product"
            / "candidate_search_index_virtual.jsonl",
            "f19_regression_replay_search_index",
            FROZEN_F19_VIRTUAL_SEARCH_INDEX_SHA256,
        ),
    ]
    if paths.canonical_bundle_dir is None:
        raise FrozenTransactionInputError("canonical_bundle_dir_missing")
    canon_index = paths.canonical_bundle_dir / "search_index.jsonl"
    canon_records = paths.canonical_bundle_dir / "records.jsonl"
    if not canon_index.is_file() or not canon_records.is_file():
        raise FrozenTransactionInputError("canonical_published_regression_baseline_missing")
    # Baseline SHAs are recorded (not compared to a frozen constant beyond existence).
    items.append(
        FrozenInput(
            role="canonical_published_search_index",
            path=canon_index,
            expected_sha256=sha256_file(canon_index),
            actual_sha256=sha256_file(canon_index),
        )
    )
    items.append(
        FrozenInput(
            role="canonical_published_records",
            path=canon_records,
            expected_sha256=sha256_file(canon_records),
            actual_sha256=sha256_file(canon_records),
        )
    )
    return {
        "status": "PASS",
        "inputs": [
            {
                "role": i.role,
                "path": str(i.path),
                "sha256": i.actual_sha256,
            }
            for i in items
        ],
        "hashes": {i.role: i.actual_sha256 for i in items},
    }
