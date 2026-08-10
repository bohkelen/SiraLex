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
import shutil
import tempfile
from pathlib import Path

import pytest

from bundle_builder.build_bundle import (
    ArtifactDirectoryConflictError,
    artifact_dir_name,
    build_bundle,
    compute_content_sha256,
    generate_bundle_id,
    sha256_file,
    validate_bundle_id,
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

SAMPLE_NORMALIZED_RECORDS_V2 = [
    {
        "ir_id": "ffff1111eeee2222",
        "ir_kind": "index_mapping",
        "source_id": "src_malipense",
        "norm_version": "norm_v2",
        "preferred_form": "a) bon travail! (une salutation), b) merci! (pour un travail)",
        "variant_forms": [
            "a) bon travail! (une salutation), b) merci! (pour un travail)",
            "bon travail",
            "merci",
        ],
        "search_keys": {
            "casefold": [
                "a) bon travail! (une salutation), b) merci! (pour un travail)",
                "bon travail",
                "merci",
            ],
            "diacritics_insensitive": [
                "a) bon travail! (une salutation), b) merci! (pour un travail)",
                "bon travail",
                "merci",
            ],
            "punct_stripped": [
                "a bon travail une salutation b merci pour un travail",
                "bon travail",
                "merci",
            ],
            "nospace": [
                "a)bontravail!(unesalutation),b)merci!(pouruntravail)",
                "bontravail",
                "merci",
            ],
        },
    },
]

SAMPLE_NORMALIZED_RECORDS_V3 = [
    {
        "ir_id": "ffff1111eeee2222",
        "ir_kind": "index_mapping",
        "source_id": "src_malipense",
        "norm_version": "norm_v3",
        "preferred_form": "a) bon travail! (une salutation), b) merci! (pour un travail)",
        "variant_forms": [
            "a) bon travail! (une salutation), b) merci! (pour un travail)",
            "bon travail",
            "merci",
        ],
        "search_keys": {
            "casefold": [
                "a) bon travail! (une salutation), b) merci! (pour un travail)",
                "bon travail",
                "merci",
            ],
            "diacritics_insensitive": [
                "a) bon travail! (une salutation), b) merci! (pour un travail)",
                "bon travail",
                "merci",
            ],
            "punct_stripped": [
                "a bon travail une salutation b merci pour un travail",
                "bon travail",
                "merci",
            ],
            "nospace": [
                "a)bontravail!(unesalutation),b)merci!(pouruntravail)",
                "bontravail",
                "merci",
            ],
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

SAMPLE_INDEX_ENTRIES_DIRECTIONAL = [
    {
        "key": "bon travail",
        "key_type": "src_casefold",
        "ir_ids": ["ffff1111eeee2222"],
    },
    {
        "key": "dɔbɛn",
        "key_type": "tgt_casefold",
        "ir_ids": ["aaaa1111bbbb2222"],
    },
]

SAMPLE_INDEX_ENTRIES_DIRECTIONAL_WITH_EN = [
    *SAMPLE_INDEX_ENTRIES_DIRECTIONAL,
    {
        "key": "house",
        "key_type": "en_casefold",
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


@pytest.fixture
def bundle_inputs_v2(tmp_path):
    normalized = tmp_path / "normalized_v2.jsonl"
    search_index = tmp_path / "search_index_v2.jsonl"
    write_jsonl(normalized, SAMPLE_NORMALIZED_RECORDS_V2)
    write_jsonl(search_index, SAMPLE_INDEX_ENTRIES_DIRECTIONAL)
    return normalized, search_index


@pytest.fixture
def bundle_inputs_v3(tmp_path):
    normalized = tmp_path / "normalized_v3.jsonl"
    search_index = tmp_path / "search_index_v3.jsonl"
    write_jsonl(normalized, SAMPLE_NORMALIZED_RECORDS_V3)
    write_jsonl(search_index, SAMPLE_INDEX_ENTRIES_DIRECTIONAL)
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


class TestValidateBundleId:
    def test_accepts_historical_shapes(self):
        assert validate_bundle_id("bundle_full_20260710_337619ff") == "bundle_full_20260710_337619ff"
        assert (
            validate_bundle_id("bundle_full_20260616_phase7j_alias_round2_candidate")
            == "bundle_full_20260616_phase7j_alias_round2_candidate"
        )

    def test_rejects_empty_and_whitespace(self):
        with pytest.raises(ValueError, match="nonempty"):
            validate_bundle_id("")
        with pytest.raises(ValueError, match="whitespace"):
            validate_bundle_id(" bundle_x ")

    def test_rejects_path_separators(self):
        with pytest.raises(ValueError, match="path separators"):
            validate_bundle_id("bundle/full")


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

    def test_rule_versions_follow_normalized_records(self, bundle_inputs_v2, tmp_path):
        normalized, search_index = bundle_inputs_v2
        output_dir = tmp_path / "bundles"

        result = build_bundle(normalized, search_index, output_dir)
        manifest = result["manifest"]

        assert manifest["rule_versions"]["normalization"] == "norm_v2"

    def test_rule_versions_follow_normalized_records_v3(self, bundle_inputs_v3, tmp_path):
        normalized, search_index = bundle_inputs_v3
        output_dir = tmp_path / "bundles"

        result = build_bundle(normalized, search_index, output_dir)
        manifest = result["manifest"]

        assert manifest["rule_versions"]["normalization"] == "norm_v3"

    def test_emits_directional_flag_true_for_norm_v2(self, bundle_inputs_v2, tmp_path):
        normalized, search_index = bundle_inputs_v2
        output_dir = tmp_path / "bundles"

        result = build_bundle(normalized, search_index, output_dir)
        manifest = result["manifest"]

        assert manifest["search_index_directional"] is True

    def test_emits_directional_flag_true_for_norm_v3(self, bundle_inputs_v3, tmp_path):
        normalized, search_index = bundle_inputs_v3
        output_dir = tmp_path / "bundles"

        result = build_bundle(normalized, search_index, output_dir)
        manifest = result["manifest"]

        assert manifest["search_index_directional"] is True

    def test_emits_directional_flag_false_for_legacy(self, bundle_inputs, tmp_path):
        normalized, search_index = bundle_inputs
        output_dir = tmp_path / "bundles"

        result = build_bundle(normalized, search_index, output_dir)
        manifest = result["manifest"]

        assert manifest["search_index_directional"] is False

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

    def test_directional_mode_rejects_legacy_key_families(self, bundle_inputs_v2, tmp_path):
        normalized, _ = bundle_inputs_v2
        search_index = tmp_path / "search_index_legacy_for_v2.jsonl"
        write_jsonl(search_index, SAMPLE_INDEX_ENTRIES)

        with pytest.raises(ValueError, match="Directional bundle mode requires directional key families"):
            build_bundle(normalized, search_index, tmp_path / "bundles")

    def test_legacy_mode_rejects_directional_key_families(self, bundle_inputs, tmp_path):
        normalized, _ = bundle_inputs
        search_index = tmp_path / "search_index_directional_for_legacy.jsonl"
        write_jsonl(search_index, SAMPLE_INDEX_ENTRIES_DIRECTIONAL)

        with pytest.raises(ValueError, match="Legacy bundle mode requires undirected key families only"):
            build_bundle(normalized, search_index, tmp_path / "bundles")

    def test_rejects_mixed_key_families(self, bundle_inputs, tmp_path):
        normalized, _ = bundle_inputs
        search_index = tmp_path / "search_index_mixed.jsonl"
        write_jsonl(
            search_index,
            [
                {"key": "test", "key_type": "casefold", "ir_ids": ["aaaa1111bbbb2222"]},
                {"key": "test", "key_type": "tgt_casefold", "ir_ids": ["aaaa1111bbbb2222"]},
            ],
        )

        with pytest.raises(ValueError, match="mixes directional and legacy key families"):
            build_bundle(normalized, search_index, tmp_path / "bundles")

    def test_explicit_bundle_id_honored(self, bundle_inputs, tmp_path):
        normalized, search_index = bundle_inputs
        output_dir = tmp_path / "bundles"
        result = build_bundle(
            normalized,
            search_index,
            output_dir,
            bundle_id="bundle_full_logical_line_pin",
        )
        assert result["bundle_id"] == "bundle_full_logical_line_pin"
        expected_dir = artifact_dir_name(
            "bundle_full_logical_line_pin",
            result["content_sha256"],
        )
        assert result["artifact_dir_name"] == expected_dir
        assert Path(result["bundle_dir"]).name == expected_dir
        assert result["versioned_output"] is True
        assert result["manifest"]["bundle_id"] == "bundle_full_logical_line_pin"

    def test_invalid_explicit_bundle_id_rejected(self, bundle_inputs, tmp_path):
        normalized, search_index = bundle_inputs
        with pytest.raises(ValueError, match="bundle_id"):
            build_bundle(
                normalized,
                search_index,
                tmp_path / "bundles",
                bundle_id="bad id with spaces",
            )

    def test_content_hash_independent_of_bundle_id(self, bundle_inputs, tmp_path):
        normalized, search_index = bundle_inputs
        generated = build_bundle(normalized, search_index, tmp_path / "gen")
        pinned = build_bundle(
            normalized,
            search_index,
            tmp_path / "pin",
            bundle_id="bundle_full_logical_line_pin",
        )
        assert generated["content_sha256"] == pinned["content_sha256"]
        assert generated["bundle_id"] != pinned["bundle_id"]

    def test_versioned_outputs_coexist_for_same_logical_id(self, bundle_inputs, tmp_path):
        normalized, search_index = bundle_inputs
        output_dir = tmp_path / "bundles"
        logical_id = "bundle_full_logical_line_pin"

        first = build_bundle(
            normalized,
            search_index,
            output_dir,
            bundle_id=logical_id,
        )

        # Mutate search index payload to force a new content_sha256.
        alt_index = tmp_path / "search_index_alt.jsonl"
        alt_index.write_text(
            search_index.read_text(encoding="utf-8")
            + json.dumps(
                {
                    "key": "extra",
                    "key_type": "casefold",
                    "ir_ids": ["zzzz9999yyyy8888"],
                },
                ensure_ascii=False,
            )
            + "\n",
            encoding="utf-8",
        )
        second = build_bundle(
            normalized,
            alt_index,
            output_dir,
            bundle_id=logical_id,
        )

        assert first["bundle_id"] == second["bundle_id"] == logical_id
        assert first["content_sha256"] != second["content_sha256"]
        assert first["artifact_dir_name"] != second["artifact_dir_name"]
        assert Path(first["bundle_dir"]).is_dir()
        assert Path(second["bundle_dir"]).is_dir()
        assert Path(first["bundle_dir"]).exists()
        assert Path(second["bundle_dir"]).exists()
        assert verify_bundle(Path(first["bundle_dir"]))["valid"] is True
        assert verify_bundle(Path(second["bundle_dir"]))["valid"] is True
        assert (
            json.load(open(Path(first["bundle_dir"]) / "bundle.manifest.json"))["bundle_id"]
            == logical_id
        )
        assert (
            json.load(open(Path(second["bundle_dir"]) / "bundle.manifest.json"))["bundle_id"]
            == logical_id
        )

    def test_versioned_identical_rebuild_is_idempotent(self, bundle_inputs, tmp_path):
        normalized, search_index = bundle_inputs
        output_dir = tmp_path / "bundles"
        first = build_bundle(
            normalized,
            search_index,
            output_dir,
            bundle_id="bundle_full_logical_line_pin",
        )
        marker = Path(first["bundle_dir"]) / "marker.txt"
        marker.write_text("keep-me", encoding="utf-8")
        assert verify_bundle(Path(first["bundle_dir"]))["valid"] is True

        second = build_bundle(
            normalized,
            search_index,
            output_dir,
            bundle_id="bundle_full_logical_line_pin",
        )
        assert second["skipped_because_identical"] is True
        assert second["bundle_dir"] == first["bundle_dir"]
        assert second["content_sha256"] == first["content_sha256"]
        assert marker.read_text(encoding="utf-8") == "keep-me"
        assert verify_bundle(Path(second["bundle_dir"]))["valid"] is True

    def _assert_tampered_versioned_artifact_fails_closed(
        self,
        *,
        bundle_inputs,
        tmp_path,
        mutate,
    ):
        normalized, search_index = bundle_inputs
        output_dir = tmp_path / "bundles"
        first = build_bundle(
            normalized,
            search_index,
            output_dir,
            bundle_id="bundle_full_logical_line_pin",
        )
        artifact = Path(first["bundle_dir"])
        mutate(artifact)
        after_mutate_listing = {
            p.name: (p.read_bytes() if p.is_file() else None) for p in artifact.iterdir()
        }

        with pytest.raises(ArtifactDirectoryConflictError, match="verification failed"):
            build_bundle(
                normalized,
                search_index,
                output_dir,
                bundle_id="bundle_full_logical_line_pin",
            )

        assert artifact.is_dir()
        after_fail_listing = {
            p.name: (p.read_bytes() if p.is_file() else None) for p in artifact.iterdir()
        }
        assert after_fail_listing == after_mutate_listing
        # Temp build dir must not remain.
        assert not (output_dir / "_bundle_full_building").exists()
        # Corrupted artifact was not repaired in place.
        assert verify_bundle(artifact)["valid"] is False

    def test_versioned_tampered_records_fails_closed(self, bundle_inputs, tmp_path):
        def mutate(artifact: Path) -> None:
            records = artifact / "records.jsonl"
            records.write_bytes(records.read_bytes() + b"\nTAMPER\n")

        self._assert_tampered_versioned_artifact_fails_closed(
            bundle_inputs=bundle_inputs,
            tmp_path=tmp_path,
            mutate=mutate,
        )

    def test_versioned_tampered_search_index_fails_closed(self, bundle_inputs, tmp_path):
        def mutate(artifact: Path) -> None:
            index = artifact / "search_index.jsonl"
            index.write_bytes(index.read_bytes() + b"\nTAMPER\n")

        self._assert_tampered_versioned_artifact_fails_closed(
            bundle_inputs=bundle_inputs,
            tmp_path=tmp_path,
            mutate=mutate,
        )

    def test_versioned_missing_payload_fails_closed(self, bundle_inputs, tmp_path):
        def mutate(artifact: Path) -> None:
            (artifact / "records.jsonl").unlink()

        self._assert_tampered_versioned_artifact_fails_closed(
            bundle_inputs=bundle_inputs,
            tmp_path=tmp_path,
            mutate=mutate,
        )

    def test_versioned_manifest_hash_match_but_payload_differs_fails_closed(
        self,
        bundle_inputs,
        tmp_path,
    ):
        """Exact ML1C1A1 regression: matching declared content_sha256 alone is insufficient."""
        normalized, search_index = bundle_inputs
        output_dir = tmp_path / "bundles"
        first = build_bundle(
            normalized,
            search_index,
            output_dir,
            bundle_id="bundle_full_logical_line_pin",
        )
        artifact = Path(first["bundle_dir"])
        declared_hash = first["content_sha256"]

        # Corrupt payload bytes while leaving the manifest content_sha256 text alone.
        records = artifact / "records.jsonl"
        records.write_bytes(records.read_bytes() + b"CORRUPT")
        manifest = json.loads((artifact / "bundle.manifest.json").read_text(encoding="utf-8"))
        assert manifest["content_sha256"] == declared_hash

        with pytest.raises(ArtifactDirectoryConflictError, match="verification failed"):
            build_bundle(
                normalized,
                search_index,
                output_dir,
                bundle_id="bundle_full_logical_line_pin",
            )

        assert artifact.is_dir()
        assert json.loads((artifact / "bundle.manifest.json").read_text(encoding="utf-8"))[
            "content_sha256"
        ] == declared_hash
        assert records.read_bytes().endswith(b"CORRUPT")
        assert not (output_dir / "_bundle_full_building").exists()

    def test_versioned_conflict_fails_closed(self, bundle_inputs, tmp_path):
        normalized, search_index = bundle_inputs
        output_dir = tmp_path / "bundles"
        logical_id = "bundle_full_logical_line_pin"
        first = build_bundle(
            normalized,
            search_index,
            output_dir,
            bundle_id=logical_id,
        )
        alt_index = tmp_path / "search_index_alt.jsonl"
        alt_index.write_text(
            search_index.read_text(encoding="utf-8")
            + '{"key":"extra","key_type":"casefold","ir_ids":["zzzz"]}\n',
            encoding="utf-8",
        )
        # Precompute next content hash by building into an isolated dir first.
        preview = build_bundle(
            normalized,
            alt_index,
            tmp_path / "preview",
            bundle_id=logical_id,
        )
        conflict_dir = output_dir / preview["artifact_dir_name"]
        conflict_dir.mkdir(parents=True)
        (conflict_dir / "bundle.manifest.json").write_text(
            json.dumps(
                {
                    "bundle_id": logical_id,
                    "content_sha256": "sha256:" + ("0" * 64),
                }
            ),
            encoding="utf-8",
        )
        # Incomplete planted artifact fails verification before any overwrite.
        with pytest.raises(ArtifactDirectoryConflictError, match="verification failed"):
            build_bundle(
                normalized,
                alt_index,
                output_dir,
                bundle_id=logical_id,
            )
        # Prior first artifact retained.
        assert Path(first["bundle_dir"]).is_dir()
        assert conflict_dir.is_dir()

    def test_versioned_valid_existing_with_conflicting_hash_fails_closed(
        self,
        bundle_inputs,
        tmp_path,
    ):
        """Existing dir verifies, but verified content_sha256 differs from new build."""
        normalized, search_index = bundle_inputs
        output_dir = tmp_path / "bundles"
        logical_id = "bundle_full_logical_line_pin"
        first = build_bundle(
            normalized,
            search_index,
            output_dir,
            bundle_id=logical_id,
        )
        alt_index = tmp_path / "search_index_alt.jsonl"
        alt_index.write_text(
            search_index.read_text(encoding="utf-8")
            + '{"key":"extra","key_type":"casefold","ir_ids":["zzzz"]}\n',
            encoding="utf-8",
        )
        preview = build_bundle(
            normalized,
            alt_index,
            tmp_path / "preview",
            bundle_id=logical_id,
        )
        # Place a *valid* different-content artifact under the path the new build needs.
        conflict_dir = output_dir / preview["artifact_dir_name"]
        shutil.copytree(first["bundle_dir"], conflict_dir)
        assert verify_bundle(conflict_dir)["valid"] is True
        assert verify_bundle(conflict_dir)["content_sha256"] == first["content_sha256"]
        assert first["content_sha256"] != preview["content_sha256"]

        planted_listing = {
            p.name: (p.read_bytes() if p.is_file() else None) for p in conflict_dir.iterdir()
        }
        with pytest.raises(ArtifactDirectoryConflictError, match="Refusing to overwrite"):
            build_bundle(
                normalized,
                alt_index,
                output_dir,
                bundle_id=logical_id,
            )
        assert Path(first["bundle_dir"]).is_dir()
        assert {
            p.name: (p.read_bytes() if p.is_file() else None) for p in conflict_dir.iterdir()
        } == planted_listing
        assert not (output_dir / "_bundle_full_building").exists()

    def test_default_convenience_dir_name_equals_bundle_id(self, bundle_inputs, tmp_path):
        normalized, search_index = bundle_inputs
        result = build_bundle(normalized, search_index, tmp_path / "bundles")
        assert result["versioned_output"] is False
        assert result["artifact_dir_name"] == result["bundle_id"]
        assert Path(result["bundle_dir"]).name == result["bundle_id"]

    def test_accepts_additive_en_key_family(self, bundle_inputs_v3, tmp_path):
        normalized, _ = bundle_inputs_v3
        search_index = tmp_path / "search_index_en.jsonl"
        write_jsonl(search_index, SAMPLE_INDEX_ENTRIES_DIRECTIONAL_WITH_EN)
        result = build_bundle(
            normalized,
            search_index,
            tmp_path / "bundles",
            source_lang="fr",
            target_lang="mnk",
            bundle_id="bundle_full_logical_line_pin",
        )
        assert result["manifest"]["search_key_families"] == ["en", "src", "tgt"]
        assert result["manifest"]["rule_versions"]["en_gloss_key"] == "en_gloss_key_v1"
        assert result["manifest"]["languages"]["lookup_languages"] == ["en", "fr", "mnk"]
        assert result["manifest"]["languages"]["lexical_language"] == "mnk"
        assert result["artifact_dir_name"].startswith("bundle_full_logical_line_pin__")

    def test_optional_language_metadata(self, bundle_inputs, tmp_path):
        normalized, search_index = bundle_inputs
        output_dir = tmp_path / "bundles"

        result = build_bundle(
            normalized,
            search_index,
            output_dir,
            source_lang="fr",
            target_lang="mnk",
            source_label="French",
            target_label="Maninka",
            target_scripts=["latin", "nko"],
        )
        manifest = result["manifest"]

        assert manifest["languages"] == {
            "source_lang": "fr",
            "target_lang": "mnk",
        }
        assert manifest["language_labels"] == {
            "source": "French",
            "target": "Maninka",
        }
        assert manifest["scripts"] == {
            "target_supported": ["latin", "nko"],
        }


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
        assert verification["content_sha256"] == result["content_sha256"]

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
