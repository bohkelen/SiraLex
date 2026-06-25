"""
Tests for deterministic STORED-ZIP package builder (package-v1).
"""

from __future__ import annotations

import hashlib
import os
import struct
import zipfile
from pathlib import Path
from unittest.mock import patch

import pytest

from bundle_builder.build_bundle import build_bundle, verify_bundle
from bundle_builder.package_bundle import (
    PACKAGE_FORMAT_VERSION,
    REQUIRED_PACKAGE_ENTRIES,
    PackageBundleError,
    _verify_emitted_package as real_verify_emitted_package,
    build_package,
    package_sha256_file,
)
from bundle_builder.tests.test_bundle_builder import (
    SAMPLE_INDEX_ENTRIES,
    SAMPLE_NORMALIZED_RECORDS,
    write_jsonl,
)


@pytest.fixture
def verified_bundle(tmp_path):
    normalized = tmp_path / "normalized.jsonl"
    search_index = tmp_path / "search_index.jsonl"
    write_jsonl(normalized, SAMPLE_NORMALIZED_RECORDS)
    write_jsonl(search_index, SAMPLE_INDEX_ENTRIES)

    output_dir = tmp_path / "bundles"
    result = build_bundle(normalized, search_index, output_dir)
    bundle_dir = Path(result["bundle_dir"])
    assert verify_bundle(bundle_dir)["valid"] is True
    return bundle_dir


def _build_package(bundle_dir: Path, output_path: Path):
    return build_package(bundle_dir, output_path)


def _legacy_part_path(output_path: Path) -> Path:
    return output_path.with_name(f"{output_path.name}.part")


class TestValidPackageBuild:
    def test_builds_package_with_report_and_matching_payloads(self, verified_bundle, tmp_path):
        output_path = tmp_path / "bundle.siralex.zip"
        result = _build_package(verified_bundle, output_path)

        assert output_path.exists()
        assert result["bundle_id"] == verify_bundle(verified_bundle)["bundle_id"]
        assert result["output_path"] == str(output_path.resolve())
        assert result["package_byte_length"] == output_path.stat().st_size
        assert result["package_sha256"] == package_sha256_file(output_path)
        assert result["entries"] == list(REQUIRED_PACKAGE_ENTRIES)
        assert result["package_format_version"] == PACKAGE_FORMAT_VERSION

        with zipfile.ZipFile(output_path, "r") as zf:
            assert zf.namelist() == list(REQUIRED_PACKAGE_ENTRIES)
            for name in REQUIRED_PACKAGE_ENTRIES:
                assert zf.read(name) == (verified_bundle / name).read_bytes()


class TestStrictPackageStructure:
    def test_emits_slice1_compatible_zip_metadata(self, verified_bundle, tmp_path):
        output_path = tmp_path / "bundle.siralex.zip"
        _build_package(verified_bundle, output_path)
        data = output_path.read_bytes()

        with zipfile.ZipFile(output_path, "r") as zf:
            assert zf.comment == b""
            for info in zf.infolist():
                assert info.compress_type == zipfile.ZIP_STORED
                assert info.flag_bits == 0
                assert info.extra == b""
                assert info.comment == b""
                assert info.date_time == (1980, 1, 1, 0, 0, 0)
                assert info.create_system == 3
                assert info.external_attr == (0o100644 & 0xFFFF) << 16
                assert info.internal_attr == 0

        eocd_offset = len(data) - 22
        assert struct.unpack_from("<I", data, eocd_offset)[0] == 0x06054B50
        assert struct.unpack_from("<H", data, eocd_offset + 10)[0] == 3
        assert struct.unpack_from("<I", data, eocd_offset + 12)[0] != 0xFFFFFFFF
        assert struct.unpack_from("<I", data, eocd_offset + 16)[0] != 0xFFFFFFFF
        assert struct.unpack_from("<H", data, eocd_offset + 20)[0] == 0


class TestByteDeterminism:
    def test_same_input_produces_identical_bytes_and_sha256(self, verified_bundle, tmp_path):
        output_a = tmp_path / "a.siralex.zip"
        output_b = tmp_path / "b.siralex.zip"

        result_a = _build_package(verified_bundle, output_a)
        result_b = _build_package(verified_bundle, output_b)

        bytes_a = output_a.read_bytes()
        bytes_b = output_b.read_bytes()
        assert bytes_a == bytes_b
        assert result_a["package_sha256"] == result_b["package_sha256"]
        assert hashlib.sha256(bytes_a).hexdigest() == result_a["package_sha256"].removeprefix("sha256:")


class TestInvalidSourceBundle:
    def test_does_not_create_output_when_verify_fails(self, verified_bundle, tmp_path):
        (verified_bundle / "records.jsonl").write_text("corrupt\n", encoding="utf-8")
        output_path = tmp_path / "bundle.siralex.zip"

        with pytest.raises(PackageBundleError, match="Bundle verification failed"):
            _build_package(verified_bundle, output_path)

        assert not output_path.exists()


class TestExistingOutputProtection:
    def test_rejects_existing_output_without_modifying_it(self, verified_bundle, tmp_path):
        output_path = tmp_path / "bundle.siralex.zip"
        output_path.write_bytes(b"keep-me")

        with pytest.raises(PackageBundleError, match="Output already exists"):
            _build_package(verified_bundle, output_path)

        assert output_path.read_bytes() == b"keep-me"


class TestOutputInsideBundleRejection:
    def test_rejects_output_path_inside_bundle_directory(self, verified_bundle):
        output_path = verified_bundle / "nested.siralex.zip"

        with pytest.raises(PackageBundleError, match="inside the source bundle directory"):
            _build_package(verified_bundle, output_path)


class TestSymlinkRejection:
    @pytest.mark.skipif(os.name == "nt", reason="symlink source rejection test requires Unix")
    def test_rejects_symlinked_required_source_file(self, verified_bundle, tmp_path):
        real_records = verified_bundle / "records.jsonl"
        backup = verified_bundle / "records.real.jsonl"
        real_records.rename(backup)
        os.symlink(backup, real_records)

        output_path = tmp_path / "bundle.siralex.zip"
        with pytest.raises(PackageBundleError, match="must not be a symlink"):
            _build_package(verified_bundle, output_path)

        assert not output_path.exists()


class TestAtomicFailureCleanup:
    def test_removes_owned_temp_file_and_leaves_no_final_output_on_write_failure(
        self,
        verified_bundle,
        tmp_path,
    ):
        output_path = tmp_path / "bundle.siralex.zip"
        sentinel_part = _legacy_part_path(output_path)
        sentinel_part.write_bytes(b"sentinel-part")

        with patch(
            "bundle_builder.package_bundle._write_package_zip",
            side_effect=OSError("simulated write failure"),
        ):
            with pytest.raises(OSError, match="simulated write failure"):
                _build_package(verified_bundle, output_path)

        assert not output_path.exists()
        assert sentinel_part.read_bytes() == b"sentinel-part"
        assert list(tmp_path.glob(".siralex-package-*")) == []


class TestSizeLimitEnforcement:
    def test_rejects_source_file_above_package_v1_entry_limit(self, verified_bundle, tmp_path):
        output_path = tmp_path / "bundle.siralex.zip"
        with patch(
            "bundle_builder.package_bundle.MAX_ENTRY_UNCOMPRESSED_BYTES",
            16,
        ):
            with pytest.raises(PackageBundleError, match="max one-entry limit"):
                _build_package(verified_bundle, output_path)

        assert not output_path.exists()


class TestNoFullZipEntryRead:
    def test_package_build_succeeds_when_zipfile_read_is_patched_to_fail(
        self,
        verified_bundle,
        tmp_path,
    ):
        output_path = tmp_path / "bundle.siralex.zip"
        with patch.object(
            zipfile.ZipFile,
            "read",
            side_effect=AssertionError("ZipFile.read must not be used during package build"),
        ):
            result = _build_package(verified_bundle, output_path)

        assert output_path.exists()
        assert result["package_byte_length"] == output_path.stat().st_size


class TestNoProductionPathReadBytes:
    def test_package_build_succeeds_when_path_read_bytes_is_patched_to_fail(
        self,
        verified_bundle,
        tmp_path,
    ):
        output_path = tmp_path / "bundle.siralex.zip"
        with patch.object(
            Path,
            "read_bytes",
            side_effect=AssertionError("Path.read_bytes must not be used during package build"),
        ):
            result = _build_package(verified_bundle, output_path)

        assert output_path.exists()
        assert result["package_sha256"] == package_sha256_file(output_path)


class TestPreflightArchiveSizeRejection:
    def test_rejects_predicted_oversize_archive_before_writing(self, verified_bundle, tmp_path):
        output_path = tmp_path / "bundle.siralex.zip"
        with patch("bundle_builder.package_bundle.MAX_ARCHIVE_BYTES", 100):
            with patch("bundle_builder.package_bundle._write_package_zip") as mock_write:
                with pytest.raises(PackageBundleError, match="Predicted package size exceeds"):
                    _build_package(verified_bundle, output_path)

        mock_write.assert_not_called()
        assert not output_path.exists()
        assert list(tmp_path.glob(".siralex-package-*")) == []


class TestPreexistingPartPreservation:
    def test_preserves_legacy_part_file_on_success_and_failure(self, verified_bundle, tmp_path):
        output_path = tmp_path / "bundle.siralex.zip"
        sentinel_part = _legacy_part_path(output_path)
        sentinel_part.write_bytes(b"sentinel-part")

        result = _build_package(verified_bundle, output_path)
        assert output_path.exists()
        assert result["package_byte_length"] == output_path.stat().st_size
        assert sentinel_part.read_bytes() == b"sentinel-part"

        output_path.unlink()
        with patch(
            "bundle_builder.package_bundle._write_package_zip",
            side_effect=OSError("simulated write failure"),
        ):
            with pytest.raises(OSError, match="simulated write failure"):
                _build_package(verified_bundle, output_path)

        assert sentinel_part.read_bytes() == b"sentinel-part"


class TestWrongExtensionRejection:
    def test_rejects_non_siralex_zip_output_before_writing(self, verified_bundle, tmp_path):
        output_path = tmp_path / "bundle.zip"
        with patch("bundle_builder.package_bundle._write_package_zip") as mock_write:
            with pytest.raises(PackageBundleError, match=r"Output path must end with \.siralex\.zip"):
                _build_package(verified_bundle, output_path)

        mock_write.assert_not_called()
        assert not output_path.exists()


class TestPostWriteSourceReverification:
    def test_rejects_publication_when_source_bundle_changes_after_write(
        self,
        verified_bundle,
        tmp_path,
    ):
        output_path = tmp_path / "bundle.siralex.zip"

        def verify_then_corrupt(package_path, source_paths, entry_sizes):
            real_verify_emitted_package(package_path, source_paths, entry_sizes)
            (verified_bundle / "records.jsonl").write_text(
                "changed after package write\n",
                encoding="utf-8",
            )

        with patch(
            "bundle_builder.package_bundle._verify_emitted_package",
            side_effect=verify_then_corrupt,
        ):
            with pytest.raises(PackageBundleError, match="Source bundle changed before publication"):
                _build_package(verified_bundle, output_path)

        assert not output_path.exists()
        assert list(tmp_path.glob(".siralex-package-*")) == []


class TestStreamingPayloadEquivalence:
    def test_stream_comparison_matches_source_bytes(self, verified_bundle, tmp_path, monkeypatch):
        compared: list[str] = []
        import bundle_builder.package_bundle as package_bundle

        real_compare = package_bundle._compare_stream_to_source

        def tracked_compare(zip_stream, source_path, expected_size, label):
            compared.append(label)
            return real_compare(zip_stream, source_path, expected_size, label)

        monkeypatch.setattr(
            package_bundle,
            "_compare_stream_to_source",
            tracked_compare,
        )

        output_path = tmp_path / "bundle.siralex.zip"
        _build_package(verified_bundle, output_path)

        assert compared == list(REQUIRED_PACKAGE_ENTRIES)
        with zipfile.ZipFile(output_path, "r") as zf:
            for name in REQUIRED_PACKAGE_ENTRIES:
                assert zf.read(name) == (verified_bundle / name).read_bytes()
