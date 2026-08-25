"""Deterministic transaction + rollback manifests."""

from __future__ import annotations

import hashlib
import json
from typing import Any

from malipense_version_delta.canonical_json import canonical_dumps

from .model import SCHEMA_VERSION


def compute_transaction_id(
    *,
    base_git_commit: str,
    frozen_input_hashes: dict[str, str],
    mutation_paths: list[str],
) -> str:
    """Deterministic id from frozen transaction identity (no random UUID)."""
    payload = {
        "schema_version": SCHEMA_VERSION,
        "base_git_commit": base_git_commit,
        "frozen_input_hashes": dict(sorted(frozen_input_hashes.items())),
        "mutation_paths": sorted(mutation_paths),
    }
    digest = hashlib.sha256(
        json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()
    return f"malidaba_src_refresh_{digest[:32]}"


def build_transaction_manifest(
    *,
    transaction_id: str,
    base_git_commit: str,
    frozen_input_hashes: dict[str, str],
    mutations: list[dict[str, Any]],
    counts: dict[str, Any],
    review_registry_hashes: dict[str, str],
    logical_continuity_hash: str,
    rights: dict[str, str],
    preconditions: dict[str, Any],
    postconditions: dict[str, Any],
    rollback_manifest_hash: str,
    dry_run_result: dict[str, Any],
) -> dict[str, Any]:
    before = {m["path"]: m.get("current_sha256") for m in mutations}
    after = {m["path"]: m["candidate_sha256"] for m in mutations}
    return {
        "schema_version": SCHEMA_VERSION,
        "transaction_id": transaction_id,
        "base_git_commit": base_git_commit,
        "frozen_input_hashes": dict(sorted(frozen_input_hashes.items())),
        "expected_destination_hashes_before": before,
        "expected_destination_hashes_after": after,
        "mutation_paths": [m["path"] for m in mutations],
        "artifact_roles": {m["path"]: m["artifact_role"] for m in mutations},
        "artifact_kinds": {m["path"]: m["kind"] for m in mutations},
        "row_count_summaries": {
            m["path"]: {
                "before": m.get("current_row_count"),
                "after": m.get("candidate_row_count"),
            }
            for m in mutations
        },
        "source_layer_counts": counts,
        "review_registry_hashes": review_registry_hashes,
        "logical_continuity_hash": logical_continuity_hash,
        "rights_state": rights,
        "preconditions": {
            "ok": preconditions.get("ok"),
            "failures": preconditions.get("failures"),
            "mode": preconditions.get("mode"),
        },
        "postconditions": postconditions,
        "rollback_manifest_hash": rollback_manifest_hash,
        "dry_run_result": dry_run_result,
        "publication_boundary": "OUT_OF_TRANSACTION_SCOPE",
        "purpose": "INTERNAL_SOURCE_MAINTENANCE",
    }


def build_rollback_manifest(
    *,
    transaction_id: str,
    before_store: dict[str, Any],
    mutations: list[dict[str, Any]],
) -> dict[str, Any]:
    files = {}
    for mut in mutations:
        rel = mut["path"]
        meta = before_store["files"][rel]
        files[rel] = {
            "existed_before": meta.get("existed"),
            "before_sha256": meta.get("sha256"),
            "rollback_action": (
                "delete_if_exact_transaction_hash"
                if mut.get("is_new_file")
                else "restore_before_bytes"
            ),
            "candidate_sha256": mut["candidate_sha256"],
        }
    return {
        "schema_version": "malidaba_source_refresh_rollback_v1",
        "transaction_id": transaction_id,
        "files": files,
        "policy": {
            "partial_apply_forbidden": True,
            "restore_exact_before_hashes": True,
            "new_file_delete_only_if_hash_matches": True,
            "no_silent_partial_state": True,
        },
    }


def manifest_sha256(manifest: dict[str, Any]) -> str:
    return hashlib.sha256(canonical_dumps(manifest).encode("utf-8")).hexdigest()
