"""PRODUCT2D: durable authorization record + public published bytes."""

from __future__ import annotations

import json
from pathlib import Path

from publication_readiness.authorization import validate_authorization_v2_binds_bytes
from publication_readiness.identity import (
    RELEASE_DISTRIBUTED_FILES,
    collect_distributed_file_hashes,
    identity_from_frozen_bundle,
    release_artifact_fingerprint_prefix,
)

REPO_ROOT = Path(__file__).resolve().parents[3]
AUTH_RECORD = (
    REPO_ROOT
    / "shared/publication_authorizations/pubauth_542387db78552c18.json"
)
PUBLIC_BUNDLE = (
    REPO_ROOT / "web/public/bundle_noncommercial_dfd5ba62__51c38a75"
)
EXPECTED_FP = (
    "sha256:51c38a75d5a663caf591d27b1b73da9b7ddc3776c7c96ff724deeaca4b078838"
)
EXPECTED_HASHES = {
    "records.jsonl": "sha256:e18c2583a60e8e4a12ce0dc2f21f11cfc1ab2d7f8c9eeb3f2219d2ca8417c1fd",
    "search_index.jsonl": "sha256:1ab532d9885ea8fd1216936fd1564e950260f9015911b0f9a3908a1f6eb7e44a",
    "bundle.manifest.json": "sha256:4472c9e2602006d87975a29ac6b43807818bd85f5da71e24bc885cbd186f0e62",
    "checksums.sha256": "sha256:cf4ae66c4db75ac85fb9196a5483993f70f7d615f82137c026fdc918748933aa",
    "ATTRIBUTION.txt": "sha256:f9d747fef3acef5ab2f6800ae190d58c274cc5238eb26c75495c3ccd608aec6e",
    "DATA_LICENSES.md": "sha256:cdbec942ebd3ae8dfb5bd21f2925884a4fe94df7d4306ee72020ec54d52ee3c7",
}


def test_durable_authorization_record_binds_exact_release():
    record = json.loads(AUTH_RECORD.read_text(encoding="utf-8"))
    assert record["schema_version"] == "siralex_publication_authorization_record_v1"
    assert record["authorization_id"] == "pubauth_542387db78552c18"
    assert record["release_artifact_fingerprint"] == EXPECTED_FP
    assert record["distributed_file_hashes"] == EXPECTED_HASHES
    assert record["publication_decision"] == "authorize_noncommercial_publication"
    assert record["reviewer_id"] == "bohkelen"
    assert record["reviewed_at"] == "2026-08-25T12:29:26Z"
    assert record["review_method"] == "explicit_statement_in_cursor_chat"
    assert record["publication_authorized"] is True
    assert record["commercial_authorization"] is False
    assert record["owner_rows_authorized"] is False
    assert record["publication_profile"] == "NONCOMMERCIAL_DISTRIBUTION"
    assert record["rollback_target"] == "bundle_full_20260710_337619ff"
    assert record["invariants"]["immutable_event"] is True
    assert record["invariants"]["latest_wins"] is False
    assert record["invariants"]["future_releases_do_not_inherit"] is True


def test_public_bundle_matches_authorized_hashes():
    assert PUBLIC_BUNDLE.is_dir()
    files = sorted(p.name for p in PUBLIC_BUNDLE.iterdir() if p.is_file())
    assert files == sorted(RELEASE_DISTRIBUTED_FILES)
    assert not (PUBLIC_BUNDLE / ".siralex_release_sealed").exists()
    hashes = collect_distributed_file_hashes(PUBLIC_BUNDLE)
    assert hashes == EXPECTED_HASHES
    identity = identity_from_frozen_bundle(PUBLIC_BUNDLE)
    assert identity["release_artifact_fingerprint"] == EXPECTED_FP
    prefix = release_artifact_fingerprint_prefix(EXPECTED_FP)
    assert PUBLIC_BUNDLE.name.endswith(f"__{prefix}")


def test_catalog_and_featured_point_at_authorized_release():
    catalog = json.loads(
        (REPO_ROOT / "web/public/catalog.json").read_text(encoding="utf-8")
    )
    entries = [
        b for b in catalog["bundles"] if b["bundle_id"] == "bundle_noncommercial_dfd5ba62"
    ]
    assert len(entries) == 1
    entry = entries[0]
    assert entry["url_base"] == "./bundle_noncommercial_dfd5ba62__51c38a75/"
    assert entry["content_sha256"] == (
        "sha256:dfd5ba62514caa72f9e282d16160ded01c26164c5c982fd6d164b78b6f7aeb33"
    )
    assert entry.get("release_artifact_fingerprint") == EXPECTED_FP
    assert entry.get("release_artifact_dir_name") == "bundle_noncommercial_dfd5ba62__51c38a75"

    env = (REPO_ROOT / "web/.env.production").read_text(encoding="utf-8")
    assert "VITE_FEATURED_BUNDLE_ID=bundle_noncommercial_dfd5ba62" in env

    old = next(
        b for b in catalog["bundles"] if b["bundle_id"] == "bundle_full_20260710_337619ff"
    )
    old_rel = old["url_base"].strip("./").rstrip("/")
    assert (REPO_ROOT / "web/public" / old_rel / "bundle.manifest.json").is_file()


def test_authorization_record_hashes_bind_public_bytes():
    record = json.loads(AUTH_RECORD.read_text(encoding="utf-8"))
    worksheet = {
        "schema_version": "siralex_publication_authorization_v2",
        "protected_fields": {
            "semantic_bundle_id": record["semantic_bundle_id"],
            "semantic_content_sha256": record["semantic_content_sha256"],
            "semantic_candidate_fingerprint": record["semantic_candidate_fingerprint"],
            "release_artifact_fingerprint": record["release_artifact_fingerprint"],
            "release_artifact_dir_name": record["release_artifact_dir_name"],
            "distributed_file_hashes": record["distributed_file_hashes"],
        },
        "publication_decision": record["publication_decision"],
        "publication_authorized": True,
    }
    hashes = collect_distributed_file_hashes(PUBLIC_BUNDLE)
    validation = validate_authorization_v2_binds_bytes(
        worksheet,
        semantic_bundle_id=record["semantic_bundle_id"],
        semantic_content_sha256=record["semantic_content_sha256"],
        semantic_candidate_fingerprint=record["semantic_candidate_fingerprint"],
        release_artifact_fingerprint=EXPECTED_FP,
        distributed_file_hashes=hashes,
    )
    assert validation["binds_exact_bytes"] is True
    assert validation["can_publish"] is True
