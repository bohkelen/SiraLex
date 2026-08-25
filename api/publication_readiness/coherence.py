"""Exact coherence between sealed release directory and authorization worksheet v2."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from .identity import (
    RELEASE_DISTRIBUTED_FILES,
    collect_distributed_file_hashes,
    compute_release_artifact_fingerprint,
    identity_from_frozen_bundle,
    release_artifact_dir_name,
    release_artifact_fingerprint_prefix,
)
from .model import GATE_AWAITING_HUMAN_AUTHORIZATION, GATE_PASS
from .seal import is_sealed


EXPECTED_COUNTS = {
    "records": 22199,
    "lexicon_entries": 11694,
    "headwords": 10148,
    "search_keys": 174700,
}


def validate_worksheet_release_coherence(
    *,
    sealed_bundle_dir: Path,
    worksheet: dict[str, Any],
    expected_counts: dict[str, int] | None = None,
) -> dict[str, Any]:
    """
    Hard validator: sealed directory bytes must exactly match worksheet v2.

    Any mismatch is FAIL — never a warning.
    """
    errors: list[str] = []
    counts_expected = expected_counts or EXPECTED_COUNTS
    protected = worksheet.get("protected_fields") or {}

    if worksheet.get("schema_version") != "siralex_publication_authorization_v2":
        errors.append(
            f"schema_version must be siralex_publication_authorization_v2, "
            f"got {worksheet.get('schema_version')!r}"
        )

    if not sealed_bundle_dir.is_dir():
        errors.append(f"sealed bundle directory missing: {sealed_bundle_dir}")
        return _fail(errors)

    if not is_sealed(sealed_bundle_dir):
        errors.append("sealed bundle directory is missing seal marker")

    identity = identity_from_frozen_bundle(sealed_bundle_dir)
    disk_hashes = collect_distributed_file_hashes(sealed_bundle_dir)
    recomputed_fp = compute_release_artifact_fingerprint(
        bundle_id=identity["semantic_bundle_id"],
        semantic_content_sha256=identity["semantic_content_sha256"],
        distributed_file_hashes=disk_hashes,
    )
    if recomputed_fp != identity["release_artifact_fingerprint"]:
        errors.append("disk release fingerprint recompute mismatch")

    expected_dir = release_artifact_dir_name(
        identity["semantic_bundle_id"], identity["release_artifact_fingerprint"]
    )
    if sealed_bundle_dir.name != expected_dir:
        errors.append(
            f"directory name {sealed_bundle_dir.name!r} != expected {expected_dir!r}"
        )

    prefix = release_artifact_fingerprint_prefix(identity["release_artifact_fingerprint"])
    if not sealed_bundle_dir.name.endswith(f"__{prefix}"):
        errors.append(
            f"directory suffix does not match release fingerprint prefix {prefix!r}"
        )

    present = {p.name for p in sealed_bundle_dir.iterdir() if p.is_file()}
    for name in RELEASE_DISTRIBUTED_FILES:
        if name not in present:
            errors.append(f"missing distributed file: {name}")

    ws_hashes = protected.get("distributed_file_hashes") or {}
    matched = 0
    for name in RELEASE_DISTRIBUTED_FILES:
        disk_h = disk_hashes.get(name)
        ws_h = ws_hashes.get(name)
        if disk_h and ws_h and disk_h == ws_h:
            matched += 1
        else:
            errors.append(
                f"hash mismatch for {name}: worksheet={ws_h!r} disk={disk_h!r}"
            )

    if protected.get("release_artifact_fingerprint") != identity["release_artifact_fingerprint"]:
        errors.append(
            "worksheet release_artifact_fingerprint != disk "
            f"{protected.get('release_artifact_fingerprint')!r} vs "
            f"{identity['release_artifact_fingerprint']!r}"
        )
    if protected.get("release_artifact_dir_name") != sealed_bundle_dir.name:
        errors.append(
            "worksheet release_artifact_dir_name != directory "
            f"{protected.get('release_artifact_dir_name')!r} vs {sealed_bundle_dir.name!r}"
        )
    if protected.get("semantic_bundle_id") != identity["semantic_bundle_id"]:
        errors.append("semantic_bundle_id mismatch")
    if protected.get("semantic_content_sha256") != identity["semantic_content_sha256"]:
        errors.append("semantic_content_sha256 mismatch")
    if (
        protected.get("semantic_candidate_fingerprint")
        != identity["semantic_candidate_fingerprint"]
    ):
        errors.append("semantic_candidate_fingerprint mismatch")

    counts = protected.get("candidate_counts") or {}
    for key, expected in counts_expected.items():
        if counts.get(key) != expected:
            errors.append(f"count mismatch for {key}: {counts.get(key)!r} != {expected}")

    if worksheet.get("publication_authorized") is not False:
        errors.append("publication_authorized must be false")
    for field in ("publication_decision", "reviewer_id", "reviewed_at", "review_method", "notes"):
        if worksheet.get(field) is not None:
            errors.append(f"human field {field} must be blank")

    p_gates = protected.get("p_gates") or {}
    for gate in (
        "P1_CANDIDATE_REPRODUCIBLE",
        "P2_BUNDLE_INTEGRITY",
        "P3_RIGHTS_COMPLIANCE",
        "P4_PROVENANCE_COMPLETE",
        "P5_OFFLINE_INSTALL",
        "P6_SEARCH_VALIDATION",
        "P7_USER_CREDITS",
        "P8_CATALOG_COMPATIBILITY",
        "P9_ROLLBACK_DESIGN",
    ):
        if p_gates.get(gate) != GATE_PASS:
            errors.append(f"{gate} must be PASS, got {p_gates.get(gate)!r}")
    if p_gates.get("P10_PUBLICATION_AUTHORIZATION_NOT_YET_GRANTED") != GATE_AWAITING_HUMAN_AUTHORIZATION:
        errors.append(
            "P10 must be AWAITING_HUMAN_AUTHORIZATION, "
            f"got {p_gates.get('P10_PUBLICATION_AUTHORIZATION_NOT_YET_GRANTED')!r}"
        )

    internal = protected.get("internal_full_regression") or {}
    if internal.get("pass") != 30 or internal.get("fail") != 0:
        errors.append(f"INTERNAL_FULL must be 30/0, got {internal!r}")
    pub = protected.get("publication_candidate_regression") or {}
    if (
        pub.get("pass") != 26
        or pub.get("expected_owner_rights_exclusion") != 4
        or pub.get("unexpected_defects") != 0
    ):
        errors.append(f"publication candidate accounting mismatch: {pub!r}")

    rights = protected.get("source_rights_summary") or {}
    if rights.get("owner_rows_included") != 0:
        errors.append("owner_rows_included must be 0")

    status = "PASS" if not errors else "FAIL"
    return {
        "status": status,
        "errors": errors,
        "distributed_hashes_matched": f"{matched}/6",
        "directory_release_prefix_match": sealed_bundle_dir.name.endswith(f"__{prefix}"),
        "worksheet_release_fingerprint_match": (
            protected.get("release_artifact_fingerprint")
            == identity["release_artifact_fingerprint"]
        ),
        "release_artifact_fingerprint": identity["release_artifact_fingerprint"],
        "release_artifact_dir_name": sealed_bundle_dir.name,
        "distributed_file_hashes": disk_hashes,
        "semantic_identity": {
            "semantic_bundle_id": identity["semantic_bundle_id"],
            "semantic_content_sha256": identity["semantic_content_sha256"],
            "semantic_candidate_fingerprint": identity["semantic_candidate_fingerprint"],
        },
    }


def _fail(errors: list[str]) -> dict[str, Any]:
    return {
        "status": "FAIL",
        "errors": errors,
        "distributed_hashes_matched": "0/6",
        "directory_release_prefix_match": False,
        "worksheet_release_fingerprint_match": False,
    }
