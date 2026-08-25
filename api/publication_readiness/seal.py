"""Seal invariants for immutable release artifacts."""

from __future__ import annotations

from pathlib import Path

from .identity import RELEASE_DISTRIBUTED_FILES

SEAL_MARKER_NAME = ".siralex_release_sealed"


class SealedArtifactMutationError(RuntimeError):
    """Raised when code attempts to mutate a sealed distributed file."""


def seal_marker_path(bundle_dir: Path) -> Path:
    return bundle_dir / SEAL_MARKER_NAME


def is_sealed(bundle_dir: Path) -> bool:
    return seal_marker_path(bundle_dir).is_file()


def write_seal_marker(bundle_dir: Path, *, release_artifact_fingerprint: str) -> None:
    seal_marker_path(bundle_dir).write_text(
        f"sealed\nrelease_artifact_fingerprint={release_artifact_fingerprint}\n",
        encoding="utf-8",
    )


def assert_not_sealed(bundle_dir: Path, *, target: str) -> None:
    if is_sealed(bundle_dir):
        raise SealedArtifactMutationError(
            f"Refusing write to sealed release artifact: {target} under {bundle_dir}"
        )


def assert_distributed_write_allowed(bundle_dir: Path, relative_path: str) -> None:
    """Call before any write to a distributed release file."""
    if relative_path in RELEASE_DISTRIBUTED_FILES:
        assert_not_sealed(bundle_dir, target=relative_path)


def snapshot_distributed_hashes(file_hashes: dict[str, str]) -> dict[str, str]:
    return dict(sorted(file_hashes.items()))
