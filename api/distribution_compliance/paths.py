"""PRODUCT1B workspace paths."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Product1BPaths:
    repo_root: Path
    workspace: Path
    internal_records: Path
    internal_search: Path
    candidate_dir: Path
    portable_dir: Path
    compliance_manifest: Path
    receipt_path: Path
    data_licenses_doc: Path
    readme: Path
    sources_dir: Path

    @property
    def candidate_records(self) -> Path:
        return self.candidate_dir / "records.jsonl"

    @property
    def candidate_search(self) -> Path:
        return self.candidate_dir / "search_index.jsonl"

    @property
    def candidate_bundle(self) -> Path:
        return self.candidate_dir / "bundle"


def default_paths(repo_root: Path | None = None) -> Product1BPaths:
    root = repo_root or Path(__file__).resolve().parents[2]
    workspace = root / "data" / "product1b"
    internal = root / "data" / "product1a" / "internal_full"
    return Product1BPaths(
        repo_root=root,
        workspace=workspace,
        internal_records=internal / "records.jsonl",
        internal_search=internal / "search_index.jsonl",
        candidate_dir=workspace / "noncommercial_distribution_candidate",
        portable_dir=workspace / "portable_bundle_audit",
        compliance_manifest=workspace / "siralex_noncommercial_distribution_compliance_v1.json",
        receipt_path=workspace / "product1b_receipt.json",
        data_licenses_doc=root / "DATA_LICENSES.md",
        readme=root / "README.md",
        sources_dir=root / "shared" / "sources",
    )
