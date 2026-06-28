"""
Deterministic STORED-ZIP package builder for package-v1 transport.

Wraps a verified bundle directory in a `.siralex.zip` envelope without changing
the inner bundle contract.
"""

from __future__ import annotations

import os
import struct
import tempfile
import zipfile
from pathlib import Path
from typing import Any

from .build_bundle import sha256_file, verify_bundle

PACKAGE_FORMAT_VERSION = "siralex_bundle_package_v1"
PACKAGE_EXTENSION = ".siralex.zip"

# Parser limits from shared/specs/siralex-bundle-package-v1.md
MAX_ARCHIVE_BYTES = 64 * 1024 * 1024
MAX_TOTAL_UNCOMPRESSED_BYTES = 80 * 1024 * 1024
MAX_ENTRY_UNCOMPRESSED_BYTES = 60 * 1024 * 1024
MAX_COMPRESSION_RATIO = 100

REQUIRED_PACKAGE_ENTRIES = (
    "bundle.manifest.json",
    "records.jsonl",
    "search_index.jsonl",
)

FIXED_ZIP_DATE_TIME = (1980, 1, 1, 0, 0, 0)
FIXED_CREATE_SYSTEM = 3
FIXED_EXTERNAL_ATTR = (0o100644 & 0xFFFF) << 16
FIXED_INTERNAL_ATTR = 0
FIXED_FLAG_BITS = 0

READ_CHUNK_SIZE = 8192
TEMP_FILE_PREFIX = ".siralex-package-"
TEMP_FILE_SUFFIX = ".tmp"

EOCD_SIZE = 22
LOCAL_FILE_HEADER_FIXED_SIZE = 30
CENTRAL_DIRECTORY_HEADER_FIXED_SIZE = 46

END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054B50
LOCAL_FILE_HEADER_SIGNATURE = 0x04034B50
CENTRAL_DIRECTORY_HEADER_SIGNATURE = 0x02014B50
ZIP64_EOCD_TOTAL_ENTRIES_SENTINEL = 0xFFFF
ZIP64_EOCD_SIZE_SENTINEL = 0xFFFFFFFF
ZIP64_EOCD_OFFSET_SENTINEL = 0xFFFFFFFF


class PackageBundleError(Exception):
    """Raised when package creation preflight or emission fails."""


def build_package(bundle_dir: Path, output_path: Path) -> dict[str, Any]:
    """
    Build a deterministic `.siralex.zip` package from a verified bundle directory.

    Preflight order:
      verify_bundle -> validate regular source files -> predict archive size
      -> write owned temp package -> verify emitted package -> reverify source
      -> atomic replace -> report package SHA-256 and size
    """
    resolved_bundle_dir = bundle_dir.resolve()
    resolved_output = output_path.resolve()

    if not resolved_bundle_dir.is_dir():
        raise PackageBundleError(f"Bundle directory not found: {bundle_dir}")

    verification = verify_bundle(resolved_bundle_dir)
    if not verification["valid"]:
        errors = "; ".join(verification["errors"])
        raise PackageBundleError(f"Bundle verification failed: {errors}")

    bundle_id = verification["bundle_id"]
    if not bundle_id:
        raise PackageBundleError("Verified bundle is missing bundle_id")

    _assert_output_path(resolved_bundle_dir, resolved_output)
    _assert_package_extension(resolved_output)
    source_paths = _collect_regular_source_files(resolved_bundle_dir)
    entry_sizes = _validate_source_sizes(source_paths)
    predicted_size = _predict_archive_size(entry_sizes)
    if predicted_size > MAX_ARCHIVE_BYTES:
        raise PackageBundleError(
            f"Predicted package size exceeds package-v1 max archive limit ({MAX_ARCHIVE_BYTES} bytes)"
        )

    temp_path = _allocate_owned_temp_file(resolved_output.parent)

    try:
        _write_package_zip(temp_path, source_paths, entry_sizes)
        _verify_emitted_package(temp_path, source_paths, entry_sizes)
        _reverify_source_bundle(resolved_bundle_dir, bundle_id)
        os.replace(temp_path, resolved_output)
    except Exception:
        _cleanup_owned_temp_file(temp_path)
        raise

    return {
        "bundle_id": bundle_id,
        "output_path": str(resolved_output),
        "package_byte_length": resolved_output.stat().st_size,
        "package_sha256": sha256_file(resolved_output),
        "entries": list(REQUIRED_PACKAGE_ENTRIES),
        "package_format_version": PACKAGE_FORMAT_VERSION,
    }


def _assert_output_path(bundle_dir: Path, output_path: Path) -> None:
    if output_path.exists():
        raise PackageBundleError(f"Output already exists: {output_path}")

    if not output_path.parent.exists():
        raise PackageBundleError(f"Output parent directory does not exist: {output_path.parent}")

    try:
        output_path.relative_to(bundle_dir)
    except ValueError:
        return

    raise PackageBundleError("Output path must not be inside the source bundle directory")


def _assert_package_extension(output_path: Path) -> None:
    if not output_path.name.endswith(PACKAGE_EXTENSION):
        raise PackageBundleError(f"Output path must end with {PACKAGE_EXTENSION}")


def _collect_regular_source_files(bundle_dir: Path) -> dict[str, Path]:
    source_paths: dict[str, Path] = {}
    for name in REQUIRED_PACKAGE_ENTRIES:
        path = bundle_dir / name
        if not path.exists():
            raise PackageBundleError(f"Required bundle file not found: {name}")
        if path.is_symlink():
            raise PackageBundleError(f"Required bundle file must not be a symlink: {name}")
        if not path.is_file():
            raise PackageBundleError(f"Required bundle file must be a regular file: {name}")
        source_paths[name] = path
    return source_paths


def _validate_source_sizes(source_paths: dict[str, Path]) -> dict[str, int]:
    entry_sizes: dict[str, int] = {}
    total_uncompressed = 0

    for name in REQUIRED_PACKAGE_ENTRIES:
        size = source_paths[name].stat().st_size
        if size > MAX_ENTRY_UNCOMPRESSED_BYTES:
            raise PackageBundleError(
                f"{name} exceeds package-v1 max one-entry limit ({MAX_ENTRY_UNCOMPRESSED_BYTES} bytes)"
            )
        entry_sizes[name] = size
        total_uncompressed += size

    if total_uncompressed > MAX_TOTAL_UNCOMPRESSED_BYTES:
        raise PackageBundleError(
            "Bundle payloads exceed package-v1 max total uncompressed limit "
            f"({MAX_TOTAL_UNCOMPRESSED_BYTES} bytes)"
        )

    return entry_sizes


def _predict_archive_size(entry_sizes: dict[str, int]) -> int:
    local_bytes = 0
    central_bytes = 0
    for name in REQUIRED_PACKAGE_ENTRIES:
        filename_bytes = len(name.encode("ascii"))
        local_bytes += LOCAL_FILE_HEADER_FIXED_SIZE + filename_bytes + entry_sizes[name]
        central_bytes += CENTRAL_DIRECTORY_HEADER_FIXED_SIZE + filename_bytes
    return local_bytes + central_bytes + EOCD_SIZE


def _allocate_owned_temp_file(output_dir: Path) -> Path:
    fd, temp_name = tempfile.mkstemp(
        prefix=TEMP_FILE_PREFIX,
        suffix=TEMP_FILE_SUFFIX,
        dir=output_dir,
    )
    os.close(fd)
    return Path(temp_name)


def _cleanup_owned_temp_file(temp_path: Path) -> None:
    if temp_path.exists():
        temp_path.unlink()


def _reverify_source_bundle(bundle_dir: Path, expected_bundle_id: str) -> None:
    verification = verify_bundle(bundle_dir)
    if not verification["valid"]:
        errors = "; ".join(verification["errors"])
        raise PackageBundleError(f"Source bundle changed before publication: {errors}")
    if verification["bundle_id"] != expected_bundle_id:
        raise PackageBundleError("Source bundle_id changed before publication")


def _make_zipinfo(name: str, size: int) -> zipfile.ZipInfo:
    zinfo = zipfile.ZipInfo(filename=name, date_time=FIXED_ZIP_DATE_TIME)
    zinfo.compress_type = zipfile.ZIP_STORED
    zinfo.create_system = FIXED_CREATE_SYSTEM
    zinfo.external_attr = FIXED_EXTERNAL_ATTR
    zinfo.internal_attr = FIXED_INTERNAL_ATTR
    zinfo.flag_bits = FIXED_FLAG_BITS
    zinfo.file_size = size
    zinfo.compress_size = size
    return zinfo


def _write_package_zip(
    output_path: Path,
    source_paths: dict[str, Path],
    entry_sizes: dict[str, int],
) -> None:
    with zipfile.ZipFile(
        output_path,
        mode="w",
        compression=zipfile.ZIP_STORED,
        allowZip64=False,
    ) as zf:
        for name in REQUIRED_PACKAGE_ENTRIES:
            source = source_paths[name]
            size = entry_sizes[name]
            zinfo = _make_zipinfo(name, size)
            with zf.open(zinfo, "w", force_zip64=False) as dest:
                with open(source, "rb") as src:
                    while True:
                        chunk = src.read(READ_CHUNK_SIZE)
                        if not chunk:
                            break
                        dest.write(chunk)


def _verify_emitted_package(
    package_path: Path,
    source_paths: dict[str, Path],
    entry_sizes: dict[str, int],
) -> None:
    package_size = package_path.stat().st_size
    if package_size > MAX_ARCHIVE_BYTES:
        raise PackageBundleError(
            f"Emitted package exceeds package-v1 max archive limit ({MAX_ARCHIVE_BYTES} bytes)"
        )

    with zipfile.ZipFile(package_path, "r") as zf:
        if zf.comment:
            raise PackageBundleError("Emitted package must not contain an archive comment")

        names = zf.namelist()
        if names != list(REQUIRED_PACKAGE_ENTRIES):
            raise PackageBundleError(
                f"Emitted package entry order/names invalid: expected {list(REQUIRED_PACKAGE_ENTRIES)}, got {names}"
            )

        for name, info in zip(names, zf.infolist(), strict=True):
            if info.compress_type != zipfile.ZIP_STORED:
                raise PackageBundleError(f"{name} must use STORED compression")
            if info.flag_bits != FIXED_FLAG_BITS:
                raise PackageBundleError(f"{name} must have zero general-purpose bit flags")
            if info.extra:
                raise PackageBundleError(f"{name} must not contain extra fields")
            if info.comment:
                raise PackageBundleError(f"{name} must not contain a per-entry comment")
            if info.date_time != FIXED_ZIP_DATE_TIME:
                raise PackageBundleError(f"{name} must use fixed ZIP timestamp metadata")
            if info.create_system != FIXED_CREATE_SYSTEM:
                raise PackageBundleError(f"{name} must use fixed create_system metadata")
            if info.external_attr != FIXED_EXTERNAL_ATTR:
                raise PackageBundleError(f"{name} must use fixed external_attr metadata")
            if info.internal_attr != FIXED_INTERNAL_ATTR:
                raise PackageBundleError(f"{name} must use fixed internal_attr metadata")
            if info.file_size != entry_sizes[name] or info.compress_size != entry_sizes[name]:
                raise PackageBundleError(f"{name} emitted size metadata does not match source file")

            with zf.open(info, "r") as zip_entry:
                _compare_stream_to_source(zip_entry, source_paths[name], entry_sizes[name], name)

    _assert_raw_zip_structure(package_path)


def _compare_stream_to_source(
    zip_stream,
    source_path: Path,
    expected_size: int,
    label: str,
) -> None:
    total_bytes = 0
    with open(source_path, "rb") as source_file:
        while True:
            zip_chunk = zip_stream.read(READ_CHUNK_SIZE)
            source_chunk = source_file.read(READ_CHUNK_SIZE)
            if not zip_chunk and not source_chunk:
                break
            if zip_chunk != source_chunk:
                raise PackageBundleError(f"{label} payload bytes do not match source file")
            total_bytes += len(zip_chunk)

    if total_bytes != expected_size:
        raise PackageBundleError(f"{label} payload byte count does not match source file")


def _read_path_range(path: Path, start: int, length: int) -> bytes:
    file_size = path.stat().st_size
    if start < 0 or length < 0 or start + length > file_size:
        raise PackageBundleError("Structural ZIP read is out of bounds")
    with open(path, "rb") as handle:
        handle.seek(start)
        data = handle.read(length)
    if len(data) != length:
        raise PackageBundleError("Structural ZIP read was truncated")
    return data


def _assert_raw_zip_structure(package_path: Path) -> None:
    package_size = package_path.stat().st_size
    if package_size < EOCD_SIZE:
        raise PackageBundleError("Emitted package is too small to contain a ZIP EOCD")

    eocd_offset = package_size - EOCD_SIZE
    eocd = _read_path_range(package_path, eocd_offset, EOCD_SIZE)
    if struct.unpack_from("<I", eocd, 0)[0] != END_OF_CENTRAL_DIRECTORY_SIGNATURE:
        raise PackageBundleError("Emitted package EOCD signature is invalid")

    total_entries = struct.unpack_from("<H", eocd, 10)[0]
    central_directory_size = struct.unpack_from("<I", eocd, 12)[0]
    central_directory_offset = struct.unpack_from("<I", eocd, 16)[0]
    comment_length = struct.unpack_from("<H", eocd, 20)[0]

    if comment_length != 0:
        raise PackageBundleError("Emitted package EOCD must not include an archive comment")
    if (
        total_entries == ZIP64_EOCD_TOTAL_ENTRIES_SENTINEL
        or central_directory_size == ZIP64_EOCD_SIZE_SENTINEL
        or central_directory_offset == ZIP64_EOCD_OFFSET_SENTINEL
    ):
        raise PackageBundleError("Emitted package must not contain ZIP64 EOCD markers")
    if total_entries != len(REQUIRED_PACKAGE_ENTRIES):
        raise PackageBundleError("Emitted package EOCD entry count is invalid")
    if central_directory_offset + central_directory_size != eocd_offset:
        raise PackageBundleError("Emitted package central directory must abut the EOCD")

    cd_end = central_directory_offset + central_directory_size
    offset = central_directory_offset
    while offset < cd_end:
        if offset + CENTRAL_DIRECTORY_HEADER_FIXED_SIZE > cd_end:
            raise PackageBundleError("Emitted package central directory header truncated")

        header = _read_path_range(package_path, offset, CENTRAL_DIRECTORY_HEADER_FIXED_SIZE)
        if struct.unpack_from("<I", header, 0)[0] != CENTRAL_DIRECTORY_HEADER_SIGNATURE:
            raise PackageBundleError("Emitted package central directory header signature is invalid")

        gpbf = struct.unpack_from("<H", header, 8)[0]
        method = struct.unpack_from("<H", header, 10)[0]
        compressed_size = struct.unpack_from("<I", header, 20)[0]
        uncompressed_size = struct.unpack_from("<I", header, 24)[0]
        file_name_length = struct.unpack_from("<H", header, 28)[0]
        extra_field_length = struct.unpack_from("<H", header, 30)[0]
        file_comment_length = struct.unpack_from("<H", header, 32)[0]
        local_header_offset = struct.unpack_from("<I", header, 42)[0]

        if gpbf != 0:
            raise PackageBundleError("Emitted package central directory GPBF must be zero")
        if method != 0:
            raise PackageBundleError("Emitted package central directory compression method must be STORE")
        if extra_field_length != 0 or file_comment_length != 0:
            raise PackageBundleError("Emitted package central directory must not contain extra fields or comments")
        if compressed_size == ZIP64_EOCD_SIZE_SENTINEL or uncompressed_size == ZIP64_EOCD_SIZE_SENTINEL:
            raise PackageBundleError("Emitted package must not contain ZIP64 size markers")
        if local_header_offset == ZIP64_EOCD_OFFSET_SENTINEL:
            raise PackageBundleError("Emitted package must not contain ZIP64 offset markers")

        name_end = offset + CENTRAL_DIRECTORY_HEADER_FIXED_SIZE + file_name_length
        extra_end = name_end + extra_field_length
        entry_end = extra_end + file_comment_length
        if entry_end > cd_end:
            raise PackageBundleError("Emitted package central directory entry extends past directory end")

        local_header = _read_path_range(package_path, local_header_offset, LOCAL_FILE_HEADER_FIXED_SIZE)
        if struct.unpack_from("<I", local_header, 0)[0] != LOCAL_FILE_HEADER_SIGNATURE:
            raise PackageBundleError("Emitted package local header signature is invalid")

        local_gpbf = struct.unpack_from("<H", local_header, 6)[0]
        local_method = struct.unpack_from("<H", local_header, 8)[0]
        local_file_name_length = struct.unpack_from("<H", local_header, 26)[0]
        local_extra_field_length = struct.unpack_from("<H", local_header, 28)[0]
        if local_gpbf != 0:
            raise PackageBundleError("Emitted package local header GPBF must be zero")
        if local_method != 0:
            raise PackageBundleError("Emitted package local header compression method must be STORE")
        if local_extra_field_length != 0:
            raise PackageBundleError("Emitted package local header must not contain extra fields")
        if local_file_name_length != file_name_length:
            raise PackageBundleError("Emitted package local/central filename length mismatch")

        local_name_end = local_header_offset + LOCAL_FILE_HEADER_FIXED_SIZE + local_file_name_length
        local_extra_end = local_name_end + local_extra_field_length
        if local_extra_end > eocd_offset:
            raise PackageBundleError("Emitted package local variable field overlaps central directory")

        offset = entry_end

    if offset != cd_end:
        raise PackageBundleError("Emitted package central directory contains trailing bytes")


def package_sha256_file(path: Path) -> str:
    """Compute package SHA-256 for an on-disk `.siralex.zip` file."""
    return sha256_file(path)
