"""Data models for correction dry-run processing."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class CorrectionSetManifest:
    correctionset_id: str
    correctionset_version: str
    schema_id: str
    created_at: str
    target_ir_version: str
    files: list[dict[str, Any]]
    content_sha256: str


@dataclass(frozen=True)
class CorrectionRecord:
    raw: dict[str, Any]
    source_line_number: int
    source_file: str

    @property
    def correction_id(self) -> str:
        return str(self.raw.get("correction_id", ""))

    @property
    def target_ir_id(self) -> str:
        return str(self.raw.get("target_ir_id", ""))

    @property
    def status(self) -> str:
        return str(self.raw.get("status", ""))

    @property
    def patch(self) -> list[dict[str, Any]]:
        value = self.raw.get("patch", [])
        return value if isinstance(value, list) else []

    @property
    def updated_at(self) -> str:
        timestamps = self.raw.get("timestamps", {})
        if not isinstance(timestamps, dict):
            return ""
        return str(timestamps.get("updated_at", ""))


@dataclass(frozen=True)
class CorrectionSet:
    manifest: CorrectionSetManifest
    records: list[CorrectionRecord]


@dataclass(frozen=True)
class Rejection:
    correction_id: str
    target_ir_id: str
    reason_code: str
    detail: str | None = None


@dataclass(frozen=True)
class ApplyResult:
    corrected_ir_sha256: str
    report_sha256: str
    summary: dict[str, int]

