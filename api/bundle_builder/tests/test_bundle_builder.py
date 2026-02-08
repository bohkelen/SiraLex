"""
Tests for the offline bundle builder.

Tests cover:
1. SHA-256 file hashing
2. content_sha256 canonical computation (JCS-style)
3. Bundle ID generation
4. End-to-end bundle build with manifest validation
5. Bundle integrity verification (verify_bundle)
6. Deterministic output (same inputs → same bundle content)
7. Edge cases (missing files, corrupt manifest)
"""

import hashlib
import json
import tempfile
from pathlib import Path

import pytest

from bundle_builder.build_bundle import (
    build_bundle,
    compute_content_sha256,
    generate_bundle_id,
    sha256_file,
    verify_bundle,
)


# ===========================================================================
# Fixtures: minimal normalized and search index JSONL files
# ===========================================================================

SAMPLE_NORMALIZED_RECORDS = [
    {
        "ir_id": "aaaa1111bbbb2222",
        "ir_kind": "lexicon_entry",
        "source_id": "src_malipense",
        "norm_version": "norm_v1",
        "preferred_form": "test",
        "variant_forms": ["test"],
        "search_keys": {
            "casefold": ["test"],
            "diacritics_insensitive": ["test"],
            "punct_stripped": ["test"],
            "nospace": ["test"],
        },
    },
]

SAMPLE_INDEX_ENTRIES = [
    {
        "key": "test",
        "key_type": "casefold",
        "ir_ids": ["aaaa1111bbbb2222"],
    },
]


def write_jsonl(path: Path, records: list[dict]) -> None:
    with open(path, "w", encoding="utf-8") as f:
        for rec in records:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")


@pytest.fixture
def bundle_inputs(tmp_path):
    """Create minimal normalized and search index JSONL files."""
    normalized = tmp_path / "normalized.jsonl"
    search_index = tmp_path / "search_index.jsonl"
    write_jsonl(normalized, SAMPLE_NORMALIZED_RECORDS)
    write_jsonl(search_index, SAMPLE_INDEX_ENTRIES)
    return normalized, search_index


# ===========================================================================
# Category 1: SHA-256 file hashing
# ===========================================================================

class TestSha256File:
    """Test per-file SHA-256 computation."""

    def test_known_content(self, tmp_path):
        test_file = tmp_path / "test.txt"
        test_file.write_text("hello world\n", encoding="utf-8")

        expected = "sha256:" + hashlib.sha256(b"hello world\n").hexdigest()
        assert sha256_file(test_file) == expected

    def test_empty_file(self, tmp_path):
        test_file = tmp_path / "empty.txt"
        test_file.write_bytes(b"")

        expected = "sha256:" + hashlib.sha256(b"").hexdigest()
        assert sha256_file(test_file) == expected

    def test_binary_content(self, tmp_path):
        test_file = tmp_path / "binary.bin"
        content = bytes(range(256))
        test_file.write_bytes(content)

        expected = "sha256:" + hashlib.sha256(content).hexdigest()
        assert sha256_file(test_file) == expected


# ===========================================================================
# Category 2: content_sha256 canonical computation
# ===========================================================================

class TestComputeContentSha256:
    """Test JCS-style canonical content hash."""

    def test_deterministic_ordering(self):
        """Files list order should not affect the hash (sorted by path)."""
        files_a = [
            {"path": "b.jsonl", "byte_length": 100, "sha256": "sha256:bbb"},
            {"path": "a.jsonl", "byte_length": 200, "sha256": "sha256:aaa"},
        ]
        files_b = [
            {"path": "a.jsonl", "byte_length": 200, "sha256": "sha256:aaa"},
            {"path": "b.jsonl", "byte_length": 100, "sha256": "sha256:bbb"},
        ]
        assert compute_content_sha256(files_a) == compute_content_sha256(files_b)

    def test_different_content_different_hash(self):
        files_a = [{"path": "a.jsonl", "byte_length": 100, "sha256": "sha256:aaa"}]
        files_b = [{"path": "a.jsonl", "byte_length": 100, "sha256": "sha256:bbb"}]
        assert compute_content_sha256(files_a) != compute_content_sha256(files_b)

    def test_empty_list(self):
        """Empty files list should produce a valid hash of '[]'."""
        result = compute_content_sha256([])
        assert result.startswith("sha256:")

    def test_canonical_json_no_extra_fields(self):
        """Only path, byte_length, sha256 should be in the canonical JSON."""
        files = [{
            "path": "a.jsonl",
            "byte_length": 100,
            "sha256": "sha256:aaa",
            "extra_field": "should be included since it is in the dict",
        }]
        # The function explicitly picks only 3 fields, so adding extra
        # should not change the hash
        files_clean = [{"path": "a.jsonl", "byte_length": 100, "sha256": "sha256:aaa"}]
        assert compute_content_sha256(files) == compute_content_sha256(files_clean)


# ===========================================================================
# Category 3: Bundle ID generation
# ===========================================================================

class TestGenerateBundleId:
    """Test bundle_id format."""

    def test_format(self):
        bid = generate_bundle_id("full", "20260207", "sha256:abcdef1234567890")
        assert bid == "bundle_full_20260207_abcdef12"

    def test_seed_type(self):
        bid = generate_bundle_id("seed", "20260207", "sha256:1234567890abcdef")
        assert bid.startswith("bundle_seed_")

    def test_short_hash_is_8_chars(self):
        bid = generate_bundle_id("full", "20260207", "sha256:abcdef1234567890fedcba")
        parts = bid.split("_")
        assert len(parts[-1]) == 8


# ===========================================================================
# Category 4: End-to-end bundle build
# ===========================================================================

class TestBuildBundle:
    """Test full bundle build pipeline."""

    def test_creates_bundle_directory(self, bundle_inputs, tmp_path):
        normalized, search_index = bundle_inputs
        output_dir = tmp_path / "bundles"

        result = build_bundle(normalized, search_index, output_dir)

        bundle_dir = Path(result["bundle_dir"])
        assert bundle_dir.exists()
        assert bundle_dir.is_dir()
        assert result["bundle_id"] in bundle_dir.name

    def test_manifest_exists_and_valid_json(self, bundle_inputs, tmp_path):
        normalized, search_index = bundle_inputs
        output_dir = tmp_path / "bundles"

        result = build_bundle(normalized, search_index, output_dir)
        bundle_dir = Path(result["bundle_dir"])

        manifest_path = bundle_dir / "bundle.manifest.json"
        assert manifest_path.exists()

        with open(manifest_path) as f:
            manifest = json.load(f)

        assert manifest["manifest_schema_version"] == "bundle_manifest_v1"
        assert manifest["bundle_type"] == "full"
        assert manifest["bundle_format"] == "directory"
        assert manifest["compression"] == "none"

    def test_manifest_required_fields(self, bundle_inputs, tmp_path):
        normalized, search_index = bundle_inputs
        output_dir = tmp_path / "bundles"

        result = build_bundle(normalized, search_index, output_dir)
        manifest = result["manifest"]

        required = [
            "manifest_schema_version", "bundle_id", "bundle_type",
            "bundle_format", "compression", "record_schema_id",
            "record_schema_version", "rule_versions", "sources",
            "reconciliation_action", "update_mode", "build",
            "files", "content_sha256",
        ]
        for field in required:
            assert field in manifest, f"Missing field: {field}"

    def test_rule_versions(self, bundle_inputs, tmp_path):
        normalized, search_index = bundle_inputs
        output_dir = tmp_path / "bundles"

        result = build_bundle(normalized, search_index, output_dir)
        manifest = result["manifest"]

        assert manifest["rule_versions"]["normalization"] == "norm_v1"

    def test_sources_included(self, bundle_inputs, tmp_path):
        normalized, search_index = bundle_inputs
        output_dir = tmp_path / "bundles"

        result = build_bundle(normalized, search_index, output_dir)
        manifest = result["manifest"]

        assert "src_malipense" in manifest["sources"]["included"]
        assert manifest["sources"]["excluded"] == []

    def test_payload_files_exist(self, bundle_inputs, tmp_path):
        normalized, search_index = bundle_inputs
        output_dir = tmp_path / "bundles"

        result = build_bundle(normalized, search_index, output_dir)
        bundle_dir = Path(result["bundle_dir"])

        assert (bundle_dir / "records.jsonl").exists()
        assert (bundle_dir / "search_index.jsonl").exists()
        assert (bundle_dir / "checksums.sha256").exists()

    def test_files_list_in_manifest(self, bundle_inputs, tmp_path):
        normalized, search_index = bundle_inputs
        output_dir = tmp_path / "bundles"

        result = build_bundle(normalized, search_index, output_dir)
        manifest = result["manifest"]

        assert len(manifest["files"]) == 2

        for file_entry in manifest["files"]:
            assert "path" in file_entry
            assert "byte_length" in file_entry
            assert "sha256" in file_entry
            assert file_entry["sha256"].startswith("sha256:")
            assert file_entry["byte_length"] > 0

    def test_content_sha256_present(self, bundle_inputs, tmp_path):
        normalized, search_index = bundle_inputs
        output_dir = tmp_path / "bundles"

        result = build_bundle(normalized, search_index, output_dir)

        assert result["content_sha256"].startswith("sha256:")

    def test_v1_reconciliation_and_update_mode(self, bundle_inputs, tmp_path):
        normalized, search_index = bundle_inputs
        output_dir = tmp_path / "bundles"

        result = build_bundle(normalized, search_index, output_dir)
        manifest = result["manifest"]

        assert manifest["reconciliation_action"] == "REPLACE_ALL"
        assert manifest["update_mode"] == "REPLACE_ALL"

    def test_missing_normalized_file_raises(self, tmp_path):
        search_index = tmp_path / "search_index.jsonl"
        write_jsonl(search_index, SAMPLE_INDEX_ENTRIES)

        with pytest.raises(FileNotFoundError, match="Normalized"):
            build_bundle(
                tmp_path / "nonexistent.jsonl",
                search_index,
                tmp_path / "bundles",
            )

    def test_missing_search_index_raises(self, tmp_path):
        normalized = tmp_path / "normalized.jsonl"
        write_jsonl(normalized, SAMPLE_NORMALIZED_RECORDS)

        with pytest.raises(FileNotFoundError, match="Search index"):
            build_bundle(
                normalized,
                tmp_path / "nonexistent.jsonl",
                tmp_path / "bundles",
            )

    def test_seed_bundle_type(self, bundle_inputs, tmp_path):
        normalized, search_index = bundle_inputs
        output_dir = tmp_path / "bundles"

        result = build_bundle(
            normalized, search_index, output_dir,
            bundle_type="seed",
        )

        assert "seed" in result["bundle_id"]
        assert result["manifest"]["bundle_type"] == "seed"


# ===========================================================================
# Category 5: Bundle verification
# ===========================================================================

class TestVerifyBundle:
    """Test bundle integrity verification."""

    def test_valid_bundle_passes(self, bundle_inputs, tmp_path):
        normalized, search_index = bundle_inputs
        output_dir = tmp_path / "bundles"

        result = build_bundle(normalized, search_index, output_dir)
        bundle_dir = Path(result["bundle_dir"])

        verification = verify_bundle(bundle_dir)
        assert verification["valid"] is True
        assert len(verification["errors"]) == 0
        assert verification["bundle_id"] == result["bundle_id"]

    def test_missing_manifest_fails(self, tmp_path):
        bundle_dir = tmp_path / "fake_bundle"
        bundle_dir.mkdir()

        verification = verify_bundle(bundle_dir)
        assert verification["valid"] is False
        assert any("manifest" in e.lower() for e in verification["errors"])

    def test_corrupt_manifest_fails(self, tmp_path):
        bundle_dir = tmp_path / "corrupt_bundle"
        bundle_dir.mkdir()
        (bundle_dir / "bundle.manifest.json").write_text("NOT JSON")

        verification = verify_bundle(bundle_dir)
        assert verification["valid"] is False
        assert any("json" in e.lower() for e in verification["errors"])

    def test_missing_payload_file_fails(self, bundle_inputs, tmp_path):
        normalized, search_index = bundle_inputs
        output_dir = tmp_path / "bundles"

        result = build_bundle(normalized, search_index, output_dir)
        bundle_dir = Path(result["bundle_dir"])

        # Delete a payload file
        (bundle_dir / "records.jsonl").unlink()

        verification = verify_bundle(bundle_dir)
        assert verification["valid"] is False
        assert any("records.jsonl" in e for e in verification["errors"])

    def test_tampered_file_fails(self, bundle_inputs, tmp_path):
        normalized, search_index = bundle_inputs
        output_dir = tmp_path / "bundles"

        result = build_bundle(normalized, search_index, output_dir)
        bundle_dir = Path(result["bundle_dir"])

        # Tamper with a payload file
        records_path = bundle_dir / "records.jsonl"
        records_path.write_text("TAMPERED CONTENT\n")

        verification = verify_bundle(bundle_dir)
        assert verification["valid"] is False
        # Should detect both size and hash mismatch
        assert any("mismatch" in e.lower() for e in verification["errors"])

    def test_missing_required_manifest_field_fails(self, bundle_inputs, tmp_path):
        normalized, search_index = bundle_inputs
        output_dir = tmp_path / "bundles"

        result = build_bundle(normalized, search_index, output_dir)
        bundle_dir = Path(result["bundle_dir"])

        # Remove a required field from manifest
        manifest_path = bundle_dir / "bundle.manifest.json"
        with open(manifest_path) as f:
            manifest = json.load(f)
        del manifest["content_sha256"]
        with open(manifest_path, "w") as f:
            json.dump(manifest, f)

        verification = verify_bundle(bundle_dir)
        assert verification["valid"] is False
        assert any("content_sha256" in e for e in verification["errors"])


# ===========================================================================
# Category 6: Deterministic output
# ===========================================================================

class TestDeterminism:
    """Same inputs must produce bundles with identical content hashes."""

    def test_same_inputs_same_content_hash(self, bundle_inputs, tmp_path):
        normalized, search_index = bundle_inputs

        result_a = build_bundle(
            normalized, search_index,
            tmp_path / "bundles_a",
        )
        result_b = build_bundle(
            normalized, search_index,
            tmp_path / "bundles_b",
        )

        assert result_a["content_sha256"] == result_b["content_sha256"]

    def test_same_inputs_same_payload_bytes(self, bundle_inputs, tmp_path):
        normalized, search_index = bundle_inputs

        result_a = build_bundle(
            normalized, search_index,
            tmp_path / "bundles_a",
        )
        result_b = build_bundle(
            normalized, search_index,
            tmp_path / "bundles_b",
        )

        dir_a = Path(result_a["bundle_dir"])
        dir_b = Path(result_b["bundle_dir"])

        # Payload files must be byte-identical
        for filename in ["records.jsonl", "search_index.jsonl"]:
            assert (dir_a / filename).read_bytes() == (dir_b / filename).read_bytes()

    def test_checksums_file_format(self, bundle_inputs, tmp_path):
        normalized, search_index = bundle_inputs
        output_dir = tmp_path / "bundles"

        result = build_bundle(normalized, search_index, output_dir)
        bundle_dir = Path(result["bundle_dir"])

        checksums = (bundle_dir / "checksums.sha256").read_text()
        lines = [l for l in checksums.strip().split("\n") if l]

        for line in lines:
            # Format: hex_hash  filename
            parts = line.split("  ")
            assert len(parts) == 2, f"Bad checksum line: {line}"
            hex_hash, filename = parts
            assert len(hex_hash) == 64, f"Hash not 64 hex chars: {hex_hash}"
            assert filename in ("records.jsonl", "search_index.jsonl")
