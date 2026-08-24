"""Simulated apply + rollback drills on staging destinations only."""

from __future__ import annotations

import hashlib
import os
import shutil
from pathlib import Path
from typing import Any, Callable

from malipense_version_delta.canonical_json import sha256_file


class SimulatedApplyError(RuntimeError):
    """Raised to abort a simulated apply for rollback drills."""


def _write_atomic(dest: Path, payload: bytes) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_name(dest.name + ".tmp")
    with tmp.open("wb") as handle:
        handle.write(payload)
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(tmp, dest)
    # Best-effort directory fsync
    try:
        dir_fd = os.open(str(dest.parent), os.O_RDONLY)
        try:
            os.fsync(dir_fd)
        finally:
            os.close(dir_fd)
    except OSError:
        pass


def simulate_apply_sequence(
    *,
    dest_root: Path,
    candidate_bytes: dict[str, bytes],
    before_bytes: dict[str, bytes | None],
    ordered_paths: list[str],
    fail_after: int | None = None,
    fail_during_postvalidate: bool = False,
    postvalidate: Callable[[Path], None] | None = None,
) -> dict[str, Any]:
    """
    Apply candidate bytes under dest_root (NOT real repo).

    before_bytes[rel] is None for new files.
    fail_after: raise after N successful writes (0-based count of completed writes).
    """
    if dest_root.exists():
        shutil.rmtree(dest_root)
    dest_root.mkdir(parents=True, exist_ok=True)

    # Seed destinations with before state
    for rel, payload in before_bytes.items():
        if payload is None:
            continue
        path = dest_root / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(payload)

    written: list[str] = []
    try:
        for index, rel in enumerate(ordered_paths):
            payload = candidate_bytes[rel]
            _write_atomic(dest_root / rel, payload)
            written.append(rel)
            if fail_after is not None and index + 1 >= fail_after:
                raise SimulatedApplyError(f"simulated_fail_after_write:{index + 1}")
        if postvalidate is not None:
            postvalidate(dest_root)
        if fail_during_postvalidate:
            raise SimulatedApplyError("simulated_fail_post_validation")
        after_hashes = {
            rel: sha256_file(dest_root / rel) for rel in ordered_paths
        }
        return {
            "status": "APPLIED",
            "written": written,
            "after_hashes": after_hashes,
            "rolled_back": False,
        }
    except SimulatedApplyError as exc:
        # Restore every destination from before_bytes
        for rel in ordered_paths:
            path = dest_root / rel
            before = before_bytes.get(rel)
            if before is None:
                if path.is_file():
                    # Only delete if we created it in this transaction
                    path.unlink()
                    # clean empty parents lightly
            else:
                _write_atomic(path, before)
        restored = {}
        for rel in ordered_paths:
            path = dest_root / rel
            before = before_bytes.get(rel)
            if before is None:
                restored[rel] = {
                    "exists": path.is_file(),
                    "sha256": sha256_file(path) if path.is_file() else None,
                    "ok": not path.is_file(),
                }
            else:
                actual = sha256_file(path)
                restored[rel] = {
                    "exists": True,
                    "sha256": actual,
                    "ok": actual == hashlib.sha256(before).hexdigest(),
                }
        return {
            "status": "ROLLED_BACK",
            "error": str(exc),
            "written_before_failure": written,
            "restored": restored,
            "rollback_ok": all(v["ok"] for v in restored.values()),
            "rolled_back": True,
        }


def run_rollback_drills(
    *,
    work_root: Path,
    candidate_bytes: dict[str, bytes],
    before_store: dict[str, Any],
    ordered_paths: list[str],
) -> dict[str, Any]:
    """Full simulated rollback rehearsal (A/B/C/D)."""
    before_bytes: dict[str, bytes | None] = {}
    for rel in ordered_paths:
        meta = before_store["files"][rel]
        if not meta.get("existed"):
            before_bytes[rel] = None
        else:
            before_bytes[rel] = Path(meta["path"]).read_bytes()

    def expected_after_ok(root: Path) -> None:
        for rel in ordered_paths:
            actual = sha256_file(root / rel)
            expect = hashlib.sha256(candidate_bytes[rel]).hexdigest()
            if actual != expect:
                raise SimulatedApplyError(f"postvalidate_hash_mismatch:{rel}")

    drills: dict[str, Any] = {}

    drills["success_path"] = simulate_apply_sequence(
        dest_root=work_root / "drill_success",
        candidate_bytes=candidate_bytes,
        before_bytes=before_bytes,
        ordered_paths=ordered_paths,
        postvalidate=expected_after_ok,
    )

    drills["fail_after_first_write"] = simulate_apply_sequence(
        dest_root=work_root / "drill_fail_first",
        candidate_bytes=candidate_bytes,
        before_bytes=before_bytes,
        ordered_paths=ordered_paths,
        fail_after=1,
    )

    mid = max(2, len(ordered_paths) // 2)
    drills["fail_mid_transaction"] = simulate_apply_sequence(
        dest_root=work_root / "drill_fail_mid",
        candidate_bytes=candidate_bytes,
        before_bytes=before_bytes,
        ordered_paths=ordered_paths,
        fail_after=mid,
    )

    drills["fail_post_validation"] = simulate_apply_sequence(
        dest_root=work_root / "drill_fail_post",
        candidate_bytes=candidate_bytes,
        before_bytes=before_bytes,
        ordered_paths=ordered_paths,
        fail_during_postvalidate=True,
        postvalidate=expected_after_ok,
    )

    return {
        "drills": drills,
        "success_path": drills["success_path"].get("status") == "APPLIED",
        "fail_after_first_write": drills["fail_after_first_write"].get("rollback_ok")
        is True,
        "fail_mid_transaction": drills["fail_mid_transaction"].get("rollback_ok")
        is True,
        "fail_post_validation": drills["fail_post_validation"].get("rollback_ok")
        is True,
        "all_pass": (
            drills["success_path"].get("status") == "APPLIED"
            and drills["fail_after_first_write"].get("rollback_ok") is True
            and drills["fail_mid_transaction"].get("rollback_ok") is True
            and drills["fail_post_validation"].get("rollback_ok") is True
        ),
    }
