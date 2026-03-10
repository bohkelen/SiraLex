"""
Offline bundle builder: assemble artifacts into a versioned bundle directory.

Reads normalized JSONL and search index JSONL, copies them into a bundle
directory with a manifest and integrity checksums.

Implements shared/specs/offline-bundle-versioning.md.

Bundle layout:
  bundle_full_{date}_{short_hash}/
    bundle.manifest.json
    records.jsonl
    search_index.jsonl
    checksums.sha256

This module never modifies source artifacts. It only copies and hashes.
"""

import hashlib
import json
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Hashing utilities
# ---------------------------------------------------------------------------


def sha256_file(path: Path) -> str:
    """Compute the SHA-256 hex digest of a file's bytes."""
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return f"sha256:{h.hexdigest()}"


def compute_content_sha256(files_list: list[dict[str, Any]]) -> str:
    """
    Compute the canonical content hash per the bundle spec.

    Algorithm (from offline-bundle-versioning.md § Integrity rules):
    1. Sort files_list by "path" ascending.
    2. Build a list where each element has exactly {path, byte_length, sha256}.
    3. Serialize as RFC 8785 (JCS) canonical JSON.
    4. Hash the UTF-8 bytes with SHA-256.

    Since our keys are all ASCII and values are simple types, canonical JSON
    is achieved by sorting object keys and using no extra whitespace (which
    json.dumps with sort_keys=True provides for this data shape).
    """
    # Sort by path
    sorted_files = sorted(files_list, key=lambda f: f["path"])

    # Build canonical list (only the three required fields, in sorted key order)
    canonical_list = [
        {
            "byte_length": f["byte_length"],
            "path": f["path"],
            "sha256": f["sha256"],
        }
        for f in sorted_files
    ]

    # Serialize deterministically: sort_keys ensures key order, separators remove whitespace
    canonical_json = json.dumps(
        canonical_list,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    )

    h = hashlib.sha256(canonical_json.encode("utf-8"))
    return f"sha256:{h.hexdigest()}"


# ---------------------------------------------------------------------------
# Git commit lookup
# ---------------------------------------------------------------------------


def get_git_commit() -> str:
    """Get the current git HEAD commit hash, or 'unknown' if unavailable."""
    try:
        result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except (subprocess.TimeoutExpired, FileNotFoundError):
        pass
    return "unknown"


# ---------------------------------------------------------------------------
# Bundle ID generation
# ---------------------------------------------------------------------------


def generate_bundle_id(
    bundle_type: str,
    date_str: str,
    content_sha256: str,
) -> str:
    """
    Generate a bundle_id from type, date, and content hash.

    Format: bundle_{type}_{yyyymmdd}_{short_hash}
    where short_hash is first 8 hex chars of content_sha256.
    """
    # Extract just the hex part after "sha256:"
    hex_part = content_sha256.split(":")[-1]
    short_hash = hex_part[:8]
    return f"bundle_{bundle_type}_{date_str}_{short_hash}"


# ---------------------------------------------------------------------------
# Record counting
# ---------------------------------------------------------------------------


def _count_records_by_kind(normalized_path: Path) -> dict[str, int]:
    """
    Count normalized records by ir_kind for informational metadata.

    Returns a dict like {"lexicon_entries": 8823, "index_mappings": 10501}.
    """
    counts: dict[str, int] = {}
    with open(normalized_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                record = json.loads(line)
                ir_kind = record.get("ir_kind", "unknown")
                # Pluralize for readability: "lexicon_entry" → "lexicon_entries"
                if ir_kind == "lexicon_entry":
                    key = "lexicon_entries"
                elif ir_kind == "index_mapping":
                    key = "index_mappings"
                else:
                    key = ir_kind
                counts[key] = counts.get(key, 0) + 1
            except json.JSONDecodeError:
                pass
    return counts


# ---------------------------------------------------------------------------
# Bundle builder
# ---------------------------------------------------------------------------


def build_bundle(
    normalized_path: Path,
    search_index_path: Path,
    output_dir: Path,
    bundle_type: str = "full",
    sources_included: list[str] | None = None,
    ir_parser_versions: list[str] | None = None,
    source_lang: str | None = None,
    target_lang: str | None = None,
    source_label: str | None = None,
    target_label: str | None = None,
    target_scripts: list[str] | None = None,
) -> dict[str, Any]:
    """
    Build an offline bundle directory from normalized records and search index.

    Args:
        normalized_path: path to the normalized JSONL file
        search_index_path: path to the search index JSONL file
        output_dir: parent directory where the bundle directory will be created
        bundle_type: "full" or "seed"
        sources_included: list of source_id values (defaults to ["src_malipense"])
        ir_parser_versions: list of parser versions used
        source_lang: optional source language code for bundle metadata
        target_lang: optional target language code for bundle metadata
        source_label: optional human-readable source language label
        target_label: optional human-readable target language label
        target_scripts: optional list of supported target scripts

    Returns:
        dict with bundle metadata including bundle_id and bundle_dir path
    """
    if sources_included is None:
        sources_included = ["src_malipense"]
    if ir_parser_versions is None:
        ir_parser_versions = ["malipense_lexicon_v3", "malipense_index_v1"]
    if target_scripts is None:
        target_scripts = []

    # Validate inputs exist
    if not normalized_path.exists():
        raise FileNotFoundError(f"Normalized JSONL not found: {normalized_path}")
    if not search_index_path.exists():
        raise FileNotFoundError(f"Search index JSONL not found: {search_index_path}")

    # Count records by ir_kind for informational metadata
    record_counts = _count_records_by_kind(normalized_path)

    # Date string for bundle ID
    date_str = datetime.now(timezone.utc).strftime("%Y%m%d")

    # Create a temporary name first; we'll rename after computing the ID
    output_dir.mkdir(parents=True, exist_ok=True)
    temp_bundle_dir = output_dir / f"_bundle_{bundle_type}_building"
    if temp_bundle_dir.exists():
        shutil.rmtree(temp_bundle_dir)
    temp_bundle_dir.mkdir()

    # Copy payload files into bundle directory
    payload_files = {
        "records.jsonl": normalized_path,
        "search_index.jsonl": search_index_path,
    }

    for dest_name, src_path in payload_files.items():
        shutil.copy2(src_path, temp_bundle_dir / dest_name)

    # Compute per-file hashes and sizes
    files_list: list[dict[str, Any]] = []
    for dest_name in sorted(payload_files.keys()):
        dest_path = temp_bundle_dir / dest_name
        files_list.append({
            "path": dest_name,
            "byte_length": dest_path.stat().st_size,
            "sha256": sha256_file(dest_path),
        })

    # Compute content_sha256
    content_hash = compute_content_sha256(files_list)

    # Generate bundle_id
    bundle_id = generate_bundle_id(bundle_type, date_str, content_hash)

    # Get git commit
    git_commit = get_git_commit()

    # Build manifest
    manifest = {
        "manifest_schema_version": "bundle_manifest_v1",
        "bundle_id": bundle_id,
        "bundle_type": bundle_type,
        "bundle_format": "directory",
        "compression": "none",
        "record_schema_id": "normalized_v1",
        "record_schema_version": "1",
        "rule_versions": {
            "normalization": "norm_v1",
        },
        "sources": {
            "included": sorted(sources_included),
            "excluded": [],
        },
        "reconciliation_action": "REPLACE_ALL",
        "update_mode": "REPLACE_ALL",
        "build": {
            "ir_parser_versions": sorted(ir_parser_versions),
            "git_commit": git_commit,
            "record_counts": record_counts,
        },
        "files": files_list,
        "content_sha256": content_hash,
    }

    if source_lang or target_lang:
        manifest["languages"] = {}
        if source_lang:
            manifest["languages"]["source_lang"] = source_lang
        if target_lang:
            manifest["languages"]["target_lang"] = target_lang

    if source_label or target_label:
        manifest["language_labels"] = {}
        if source_label:
            manifest["language_labels"]["source"] = source_label
        if target_label:
            manifest["language_labels"]["target"] = target_label

    if target_scripts:
        manifest["scripts"] = {
            "target_supported": list(target_scripts),
        }

    # Write manifest
    manifest_path = temp_bundle_dir / "bundle.manifest.json"
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
        f.write("\n")

    # Write checksums file (simple sha256sum-compatible format)
    checksums_path = temp_bundle_dir / "checksums.sha256"
    with open(checksums_path, "w", encoding="utf-8") as f:
        for file_entry in files_list:
            # Format: hex_hash  filename (double-space, sha256sum convention)
            hex_hash = file_entry["sha256"].split(":")[-1]
            f.write(f"{hex_hash}  {file_entry['path']}\n")

    # Rename temp dir to final name
    final_bundle_dir = output_dir / bundle_id
    if final_bundle_dir.exists():
        shutil.rmtree(final_bundle_dir)
    temp_bundle_dir.rename(final_bundle_dir)

    return {
        "bundle_id": bundle_id,
        "bundle_dir": str(final_bundle_dir),
        "content_sha256": content_hash,
        "manifest": manifest,
        "files_count": len(files_list),
    }


def verify_bundle(bundle_dir: Path) -> dict[str, Any]:
    """
    Verify the integrity of an existing bundle directory.

    Checks:
    1. Manifest exists and is valid JSON.
    2. All files listed in manifest exist.
    3. Per-file SHA-256 hashes match.
    4. content_sha256 matches recomputed value.

    Returns:
        dict with verification results
    """
    result: dict[str, Any] = {
        "valid": True,
        "errors": [],
        "bundle_id": None,
    }

    manifest_path = bundle_dir / "bundle.manifest.json"
    if not manifest_path.exists():
        result["valid"] = False
        result["errors"].append("bundle.manifest.json not found")
        return result

    try:
        with open(manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)
    except json.JSONDecodeError as e:
        result["valid"] = False
        result["errors"].append(f"Manifest is not valid JSON: {e}")
        return result

    result["bundle_id"] = manifest.get("bundle_id")

    # Check required manifest fields
    required_fields = [
        "manifest_schema_version", "bundle_id", "bundle_type",
        "rule_versions", "sources", "files", "content_sha256",
    ]
    for field in required_fields:
        if field not in manifest:
            result["valid"] = False
            result["errors"].append(f"Missing required manifest field: {field}")

    if not result["valid"]:
        return result

    # Verify each file
    files_list = manifest.get("files", [])
    for file_entry in files_list:
        file_path = bundle_dir / file_entry["path"]

        if not file_path.exists():
            result["valid"] = False
            result["errors"].append(f"File not found: {file_entry['path']}")
            continue

        # Check byte length
        actual_size = file_path.stat().st_size
        if actual_size != file_entry["byte_length"]:
            result["valid"] = False
            result["errors"].append(
                f"Size mismatch for {file_entry['path']}: "
                f"expected {file_entry['byte_length']}, got {actual_size}"
            )

        # Check SHA-256
        actual_hash = sha256_file(file_path)
        if actual_hash != file_entry["sha256"]:
            result["valid"] = False
            result["errors"].append(
                f"Hash mismatch for {file_entry['path']}: "
                f"expected {file_entry['sha256']}, got {actual_hash}"
            )

    # Verify content_sha256
    expected_content_hash = manifest.get("content_sha256")
    actual_content_hash = compute_content_sha256(files_list)
    if actual_content_hash != expected_content_hash:
        result["valid"] = False
        result["errors"].append(
            f"content_sha256 mismatch: expected {expected_content_hash}, "
            f"got {actual_content_hash}"
        )

    return result
