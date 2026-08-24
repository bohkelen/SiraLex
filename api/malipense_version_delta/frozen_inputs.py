"""Frozen CORPUS1F11 delta input hashes for review triage."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from .canonical_json import sha256_file

FROZEN_BASELINE_IR_SHA256 = (
    "97529fc9bb69d9eb3a3ce40ffa30cc6a1b881f7f2b5edb2709ae7ed3db4dafe1"
)
FROZEN_CURRENT_IR_SHA256 = (
    "fb8e97b0a8e1b82b5fc7874d7af010063112799cc116dd458ae0c48e56778221"
)
# Post-CORPUS1F21 applied current-edition Malidaba lexicon (stamped layer bytes).
FROZEN_APPLIED_CURRENT_LEXICON_SHA256 = (
    "4d6e82e98638b5371aa80b09726cbf1f5a4a6de5fd4c3e006f7ec5591e2ae5de"
)
FROZEN_APPLIED_LEGACY_RETAINED_SHA256 = (
    "b74f22d36972fceb8622b61c31931f3a0d401820bc6bbb30c22eb2588da89764"
)
FROZEN_APPLIED_INDEX_IR_SHA256 = (
    "590c0ff9320f56cb88de016e2042ee9c9fd898717cea7f8cb5d53375ab38d7a4"
)
FROZEN_DELTA_SHA256 = (
    "6dd2092078ba99c512b1e7b376e68599dd7e3faa1e7f1b8cccd1fe20335abeba"
)


@dataclass(frozen=True)
class FrozenInputs:
    baseline_ir_path: Path
    current_ir_path: Path
    delta_path: Path
    crawl_dir: Path
    baseline_ir_sha256: str
    current_ir_sha256: str
    delta_sha256: str


class FrozenInputMismatchError(ValueError):
    """Raised when review triage inputs do not match frozen F11 hashes."""


def verify_frozen_inputs(
    *,
    baseline_ir_path: Path,
    current_ir_path: Path,
    delta_path: Path,
    crawl_dir: Path,
    expected_baseline_sha: str = FROZEN_BASELINE_IR_SHA256,
    expected_current_sha: str = FROZEN_CURRENT_IR_SHA256,
    expected_delta_sha: str = FROZEN_DELTA_SHA256,
) -> FrozenInputs:
    """Verify artifact paths exist and SHA-256 matches frozen F11 outputs."""
    for label, path in (
        ("baseline_ir", baseline_ir_path),
        ("current_ir", current_ir_path),
        ("delta", delta_path),
    ):
        if not path.is_file():
            raise FrozenInputMismatchError(f"missing frozen input file: {label}={path}")

    if not crawl_dir.is_dir():
        raise FrozenInputMismatchError(f"missing crawl directory: {crawl_dir}")

    baseline_sha = sha256_file(baseline_ir_path)
    current_sha = sha256_file(current_ir_path)
    delta_sha = sha256_file(delta_path)

    mismatches: list[str] = []
    if baseline_sha != expected_baseline_sha:
        mismatches.append(
            f"baseline_ir_sha256 expected {expected_baseline_sha} got {baseline_sha}"
        )
    if current_sha != expected_current_sha:
        mismatches.append(
            f"current_ir_sha256 expected {expected_current_sha} got {current_sha}"
        )
    if delta_sha != expected_delta_sha:
        mismatches.append(f"delta_sha256 expected {expected_delta_sha} got {delta_sha}")

    if mismatches:
        raise FrozenInputMismatchError("; ".join(mismatches))

    return FrozenInputs(
        baseline_ir_path=baseline_ir_path,
        current_ir_path=current_ir_path,
        delta_path=delta_path,
        crawl_dir=crawl_dir,
        baseline_ir_sha256=baseline_sha,
        current_ir_sha256=current_sha,
        delta_sha256=delta_sha,
    )
