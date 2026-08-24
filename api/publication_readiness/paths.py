"""PRODUCT2 gitignored workspace paths."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Product2Paths:
    repo_root: Path
    workspace: Path
    candidate_workspace: Path
    frozen_bundle_parent: Path
    portable_dir: Path
    catalog_simulation_dir: Path
    receipt_path: Path
    authorization_worksheet: Path
    proposed_catalog_entry: Path
    internal_records: Path
    internal_search: Path
    data_licenses_doc: Path
    catalog_source: Path
    web_public: Path

    @property
    def candidate_records(self) -> Path:
        return self.candidate_workspace / "records.jsonl"

    @property
    def candidate_search(self) -> Path:
        return self.candidate_workspace / "search_index.jsonl"


def default_paths(repo_root: Path | None = None) -> Product2Paths:
    root = repo_root or Path(__file__).resolve().parents[2]
    workspace = root / "data" / "product2"
    internal = root / "data" / "product1a" / "internal_full"
    return Product2Paths(
        repo_root=root,
        workspace=workspace,
        candidate_workspace=workspace / "publication_candidate",
        frozen_bundle_parent=workspace / "frozen_bundle",
        portable_dir=workspace / "portable_bundle_audit",
        catalog_simulation_dir=workspace / "catalog_simulation",
        receipt_path=workspace / "siralex_publication_readiness_v1.json",
        authorization_worksheet=workspace / "publication_authorization_worksheet_v1.json",
        proposed_catalog_entry=workspace / "proposed_catalog_entry_v1.json",
        internal_records=internal / "records.jsonl",
        internal_search=internal / "search_index.jsonl",
        data_licenses_doc=root / "DATA_LICENSES.md",
        catalog_source=root / "web" / "public" / "catalog.json",
        web_public=root / "web" / "public",
    )
