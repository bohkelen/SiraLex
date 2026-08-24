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
import re
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

LEGACY_KEY_TYPES = {
    "casefold",
    "diacritics_insensitive",
    "punct_stripped",
    "nospace",
}

DIRECTIONAL_KEY_FAMILIES = ("src", "tgt", "en")

DIRECTIONAL_KEY_TYPES = {
    f"{family}_{key_type}"
    for family in DIRECTIONAL_KEY_FAMILIES
    for key_type in LEGACY_KEY_TYPES
}

# Core FR/MNK families required for directional bundles; en_* is optional/additive.
CORE_DIRECTIONAL_FAMILIES = ("src", "tgt")

# Logical bundle_id shape: nonempty, path-safe, matches historical id conventions.
BUNDLE_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,198}$")


def validate_bundle_id(bundle_id: str) -> str:
    """
    Validate an explicit logical bundle_id.

    Returns the id unchanged when valid; raises ValueError otherwise.
    Does not hardcode any featured id.
    """
    if not isinstance(bundle_id, str):
        raise ValueError("bundle_id must be a string")
    if bundle_id.strip() != bundle_id:
        raise ValueError("bundle_id must not have leading or trailing whitespace")
    if not bundle_id:
        raise ValueError("bundle_id must be nonempty")
    if "/" in bundle_id or "\\" in bundle_id:
        raise ValueError("bundle_id must not contain path separators")
    if not BUNDLE_ID_PATTERN.fullmatch(bundle_id):
        raise ValueError(
            "bundle_id must match ^[A-Za-z0-9][A-Za-z0-9._-]{0,198}$ "
            f"(got {bundle_id!r})"
        )
    return bundle_id


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


def content_sha256_prefix(content_sha256: str, *, length: int = 8) -> str:
    """Return the leading hex prefix of a canonical content_sha256 value."""
    if not isinstance(content_sha256, str) or not content_sha256.startswith("sha256:"):
        raise ValueError(
            "content_sha256 must be shaped as sha256:<hex> "
            f"(got {content_sha256!r})"
        )
    hex_part = content_sha256.split(":", 1)[1]
    if length < 1 or length > len(hex_part):
        raise ValueError(f"invalid content hash prefix length: {length}")
    return hex_part[:length]


def artifact_dir_name(bundle_id: str, content_sha256: str) -> str:
    """
    Physical artifact directory name for a logical bundle + content version.

    Shape: `{bundle_id}__{content_sha256_prefix8}`

    This is NOT Learning identity and MUST NOT replace manifest.bundle_id.
    """
    validated = validate_bundle_id(bundle_id)
    prefix = content_sha256_prefix(content_sha256)
    return f"{validated}__{prefix}"


class ArtifactDirectoryConflictError(FileExistsError):
    """Raised when a versioned artifact directory already exists unsafely."""


def _commit_artifact_directory(
    *,
    temp_bundle_dir: Path,
    final_bundle_dir: Path,
    content_hash: str,
    versioned_output: bool,
) -> tuple[Path, bool]:
    """
    Move temp build into the final artifact directory.

    Returns (final_dir, skipped_because_identical).

    Versioned/publish-safe path:
      - existing artifact must fully verify via verify_bundle()
      - only then may matching content_sha256 be treated as idempotent
      - verification failure or hash mismatch → fail closed (no overwrite)
    Convenience path:
      - may replace an existing same-named convenience directory.
    """
    if final_bundle_dir.exists():
        if versioned_output:
            # Forward reference is safe: verify_bundle exists at call time.
            verification = verify_bundle(final_bundle_dir)
            if not verification["valid"]:
                raise ArtifactDirectoryConflictError(
                    "Refusing to reuse existing immutable artifact directory "
                    f"{final_bundle_dir}: verification failed: "
                    + "; ".join(verification.get("errors") or ["unknown error"])
                )
            existing_hash = verification.get("content_sha256")
            if existing_hash == content_hash:
                # Idempotent rebuild of the exact same verified immutable artifact.
                shutil.rmtree(temp_bundle_dir)
                return final_bundle_dir, True
            raise ArtifactDirectoryConflictError(
                "Refusing to overwrite existing immutable artifact directory "
                f"{final_bundle_dir}: existing content_sha256={existing_hash!r}, "
                f"new content_sha256={content_hash!r}"
            )
        # Convenience/non-versioned path only: replace same-named output.
        shutil.rmtree(final_bundle_dir)

    temp_bundle_dir.rename(final_bundle_dir)
    return final_bundle_dir, False


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


def _detect_normalization_ruleset(normalized_path: Path) -> str:
    """
    Detect the normalization ruleset used by the normalized records.

    All normalized records in a bundle must share the same norm_version.
    """
    detected: str | None = None

    with open(normalized_path, "r", encoding="utf-8") as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            record = json.loads(line)
            norm_version = record.get("norm_version")
            if not isinstance(norm_version, str) or not norm_version:
                raise ValueError(
                    f"Normalized record missing norm_version at {normalized_path}:{line_num}"
                )
            if detected is None:
                detected = norm_version
            elif norm_version != detected:
                raise ValueError(
                    "Normalized records mix multiple norm_version values: "
                    f"{detected!r} and {norm_version!r}"
                )

    if detected is None:
        raise ValueError(f"No normalized records found in {normalized_path}")

    return detected


def _is_directional_ruleset(normalization_ruleset: str) -> bool:
    """
    Declare search-index direction capability from build ruleset contract.

    Current contract:
    - norm_v2 and norm_v3 bundles use directional src_*/tgt_* keys
    - older rulesets are treated as legacy
    """
    return normalization_ruleset in ("norm_v2", "norm_v3")


def _collect_search_index_key_types(search_index_path: Path) -> set[str]:
    key_types: set[str] = set()
    with open(search_index_path, "r", encoding="utf-8") as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
            except json.JSONDecodeError as exc:
                raise ValueError(
                    f"Invalid JSON in search index at {search_index_path}:{line_num}: {exc}"
                ) from exc
            key_type = entry.get("key_type")
            if not isinstance(key_type, str) or not key_type.strip():
                raise ValueError(
                    f"Missing/invalid key_type in search index at {search_index_path}:{line_num}"
                )
            key_types.add(key_type)
    return key_types


def _family_prefix(key_type: str) -> str:
    return key_type.split("_", 1)[0]


def _validate_search_index_key_families(
    search_index_path: Path,
    search_index_directional: bool,
) -> set[str]:
    """
    Validate search index key families.

    Returns the set of directional family prefixes present (src/tgt/en) when
    directional, else an empty set. Legacy undirected indexes return empty.
    """
    key_types = _collect_search_index_key_types(search_index_path)
    if not key_types:
        raise ValueError(f"No search index entries found in {search_index_path}")

    seen_legacy = key_types & LEGACY_KEY_TYPES
    seen_directional = key_types & DIRECTIONAL_KEY_TYPES
    seen_unknown = key_types - LEGACY_KEY_TYPES - DIRECTIONAL_KEY_TYPES

    if seen_unknown:
        unknown = ", ".join(sorted(seen_unknown))
        raise ValueError(
            f"Unsupported search index key_type values in {search_index_path}: {unknown}"
        )

    if seen_legacy and seen_directional:
        raise ValueError(
            "Search index mixes directional and legacy key families, which is not allowed: "
            f"legacy={sorted(seen_legacy)}, directional={sorted(seen_directional)}"
        )

    if search_index_directional:
        if not seen_directional:
            raise ValueError(
                "Directional bundle mode requires directional key families in search_index.jsonl"
            )
        families = {_family_prefix(k) for k in seen_directional}
        missing_core = [f for f in CORE_DIRECTIONAL_FAMILIES if f not in families]
        if missing_core:
            raise ValueError(
                "Directional bundle mode requires src_* and tgt_* key families; "
                f"missing={missing_core}, present={sorted(families)}"
            )
        return families

    if seen_directional:
        raise ValueError(
            "Legacy bundle mode requires undirected key families only in search_index.jsonl"
        )
    return set()


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
    bundle_id: str | None = None,
    lexical_language: str | None = None,
    lookup_languages: list[str] | None = None,
    versioned_output: bool | None = None,
    license_enrichment: bool = False,
    repo_root: Path | None = None,
    publication_authorized: bool = False,
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
        bundle_id: optional explicit logical bundle_id; when omitted, a convenience
            id is generated from type/date/content hash
        lexical_language: optional lexical language code (e.g. mnk)
        lookup_languages: optional lookup language list (e.g. fr, en, mnk)
        versioned_output: when True, physical directory is
            `{bundle_id}__{content_prefix}` and never destructively overwritten.
            Default: True when explicit bundle_id is supplied; False for
            convenience-generated ids (directory name == bundle_id).

    Returns:
        dict with bundle_id, content_sha256, artifact_dir_name, bundle_dir, …
    """
    if sources_included is None:
        sources_included = ["src_malipense"]
    if ir_parser_versions is None:
        ir_parser_versions = ["malipense_lexicon_v3", "malipense_index_v1"]
    if target_scripts is None:
        target_scripts = []

    explicit_bundle_id = validate_bundle_id(bundle_id) if bundle_id is not None else None
    if versioned_output is None:
        # Publication-safe default: pin path when logical id is explicitly supplied.
        versioned_output = explicit_bundle_id is not None

    # Validate inputs exist
    if not normalized_path.exists():
        raise FileNotFoundError(f"Normalized JSONL not found: {normalized_path}")
    if not search_index_path.exists():
        raise FileNotFoundError(f"Search index JSONL not found: {search_index_path}")

    # Count records by ir_kind for informational metadata
    record_counts = _count_records_by_kind(normalized_path)
    normalization_ruleset = _detect_normalization_ruleset(normalized_path)
    search_index_directional = _is_directional_ruleset(normalization_ruleset)
    search_key_families = _validate_search_index_key_families(
        search_index_path,
        search_index_directional,
    )

    # Date string for convenience bundle ID
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

    # Compute content_sha256 (payload files only — independent of bundle_id /
    # physical artifact directory name)
    content_hash = compute_content_sha256(files_list)

    # Logical bundle_id: explicit pin or convenience default
    if explicit_bundle_id is not None:
        resolved_bundle_id = explicit_bundle_id
    else:
        resolved_bundle_id = generate_bundle_id(bundle_type, date_str, content_hash)

    if versioned_output:
        resolved_artifact_dir_name = artifact_dir_name(resolved_bundle_id, content_hash)
    else:
        resolved_artifact_dir_name = resolved_bundle_id

    # Get git commit
    git_commit = get_git_commit()

    rule_versions: dict[str, Any] = {
        "normalization": normalization_ruleset,
    }
    if "en" in search_key_families:
        rule_versions["en_gloss_key"] = "en_gloss_key_v1"

    # Build manifest
    manifest = {
        "manifest_schema_version": "bundle_manifest_v1",
        "bundle_id": resolved_bundle_id,
        "bundle_type": bundle_type,
        "bundle_format": "directory",
        "compression": "none",
        "record_schema_id": "normalized_v1",
        "record_schema_version": "1",
        "rule_versions": rule_versions,
        "search_index_directional": search_index_directional,
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

    if search_key_families:
        manifest["search_key_families"] = sorted(search_key_families)

    languages: dict[str, Any] = {}
    if source_lang:
        languages["source_lang"] = source_lang
    if target_lang:
        languages["target_lang"] = target_lang
    if lexical_language:
        languages["lexical_language"] = lexical_language
    if lookup_languages:
        languages["lookup_languages"] = list(lookup_languages)
    elif "en" in search_key_families and source_lang and target_lang:
        # Advertise FR+EN lookup when English keys are present and pair is known.
        languages["lookup_languages"] = sorted({source_lang, "en", target_lang})
        if not lexical_language:
            languages["lexical_language"] = target_lang
    if languages:
        manifest["languages"] = languages

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

    if license_enrichment:
        if repo_root is None:
            raise ValueError("license_enrichment requires repo_root")
        from source_registry.load import load_source_registry
        from distribution_compliance.manifest import enrich_manifest_with_licenses

        registry = load_source_registry(repo_root)
        manifest = enrich_manifest_with_licenses(
            manifest,
            registry=registry,
            source_ids=sorted(sources_included),
            publication_authorized=publication_authorized,
        )

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

    final_bundle_dir = output_dir / resolved_artifact_dir_name
    try:
        final_bundle_dir, skipped_identical = _commit_artifact_directory(
            temp_bundle_dir=temp_bundle_dir,
            final_bundle_dir=final_bundle_dir,
            content_hash=content_hash,
            versioned_output=versioned_output,
        )
    except Exception:
        if temp_bundle_dir.exists():
            shutil.rmtree(temp_bundle_dir)
        raise

    return {
        "bundle_id": resolved_bundle_id,
        "artifact_dir_name": resolved_artifact_dir_name,
        "bundle_dir": str(final_bundle_dir),
        "content_sha256": content_hash,
        "versioned_output": versioned_output,
        "skipped_because_identical": skipped_identical,
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
        dict with verification results. On success includes content_sha256.
    """
    result: dict[str, Any] = {
        "valid": True,
        "errors": [],
        "bundle_id": None,
        "content_sha256": None,
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
    declared_content_hash = manifest.get("content_sha256")
    if isinstance(declared_content_hash, str):
        result["content_sha256"] = declared_content_hash

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

    if not result["valid"]:
        # Do not advertise a declared hash as verified when integrity failed.
        result["content_sha256"] = None

    return result
