"""PRODUCT1A workspace paths and frozen input inventory."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Product1APaths:
    repo_root: Path
    workspace: Path
    current_ir: Path
    legacy_ir: Path
    index_ir: Path
    owner_ir: Path
    logical_continuity: Path
    edition_map: Path
    aliases: Path
    supplements: Path
    target_variants: Path
    search_regression_dir: Path
    sources_dir: Path
    malipense_yaml: Path
    owner_yaml: Path
    internal_dir: Path
    commercial_dir: Path
    manifest_path: Path
    gaps_path: Path
    freeze_path: Path
    report_receipt_path: Path

    @property
    def internal_records(self) -> Path:
        return self.internal_dir / "records.jsonl"

    @property
    def internal_search(self) -> Path:
        return self.internal_dir / "search_index.jsonl"

    @property
    def commercial_records(self) -> Path:
        return self.commercial_dir / "records.jsonl"

    @property
    def commercial_search(self) -> Path:
        return self.commercial_dir / "search_index.jsonl"

    @property
    def commercial_bundle_dir(self) -> Path:
        return self.commercial_dir / "bundle_prototype"


def default_paths(repo_root: Path | None = None) -> Product1APaths:
    root = repo_root or Path(__file__).resolve().parents[2]
    # parents[2] from api/product_boundary/paths.py → api/; need repo root = parents[3]?
    # __file__ = .../api/product_boundary/paths.py → parents[0]=product_boundary, [1]=api, [2]=repo
    workspace = root / "data" / "product1a"
    return Product1APaths(
        repo_root=root,
        workspace=workspace,
        current_ir=root / "data" / "ir" / "malipense_lexicon_v3.jsonl",
        legacy_ir=root / "data" / "ir" / "malidaba_legacy_retained_v1.jsonl",
        index_ir=root / "data" / "ir" / "malipense_index_v1.jsonl",
        owner_ir=root / "data" / "ir" / "siralex_owner_lexical_v1.jsonl",
        logical_continuity=root
        / "shared"
        / "malidaba"
        / "malidaba_logical_lexical_continuity_v1.jsonl",
        edition_map=root
        / "shared"
        / "malidaba"
        / "malidaba_edition_to_logical_mapping_v1.jsonl",
        aliases=root / "shared" / "aliases" / "source_aliases_v1.jsonl",
        supplements=root
        / "shared"
        / "source_index_supplements"
        / "source_index_supplements_v1.jsonl",
        target_variants=root
        / "shared"
        / "target_variants"
        / "reviewed_target_variants_v1.jsonl",
        search_regression_dir=root / "shared" / "search_regression",
        sources_dir=root / "shared" / "sources",
        malipense_yaml=root / "shared" / "sources" / "malipense.yaml",
        owner_yaml=root / "shared" / "sources" / "siralex_lexical_review.yaml",
        internal_dir=workspace / "internal_full",
        commercial_dir=workspace / "commercial_safe_candidate",
        manifest_path=workspace / "siralex_product_rights_manifest_v1.jsonl",
        gaps_path=workspace / "commercial_coverage_gaps_v1.jsonl",
        freeze_path=workspace / "frozen_inputs.json",
        report_receipt_path=workspace / "product1a_receipt.json",
    )
