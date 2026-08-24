"""Default paths for Malidaba source-refresh dry-run evaluation."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from malipense_version_delta.frozen_inputs import (
    FROZEN_BASELINE_IR_SHA256,
    FROZEN_CURRENT_IR_SHA256,
    FROZEN_DELTA_SHA256,
)

FROZEN_REVIEW_REGISTRY_SHA256 = (
    "6ada0ee6381379ae1f260c9317e6c6ca4233d76b1dcbc0e198ade21dc8e46104"
)
FROZEN_ACCEPTANCE_SHA256 = (
    "d48d7ee1382f337bc9b628fb7d98858a8e0780a8aad84ba00ebfc053faa29d1e"
)
FROZEN_INTEGRITY_MANIFEST_SHA256 = (
    "2492b284be058f24be560021abf3ca4e95d8b113969989a34bab9e8c08bb5d64"
)
FROZEN_DESTRUCTIVE_MANIFEST_SHA256 = (
    "d7417a5cd83c6a9f766d1e14e2485fc33eed2e05b9312abf18ecb2e8e378f758"
)
FROZEN_F16_COMMIT = "604a0927fa870e93a1736da55a2de46bf2b0c76f"
FROZEN_F16_PROPOSALS_SHA256 = (
    "74c1553f4bdd5846f20dcf5085e3c52045e3cbddc3b4eebf700bc47d156f290b"
)
# Blank F16 Type-B worksheet before human Type-B encoding (F17).
FROZEN_F16_TYPE_B_BLANK_WORKSHEET_SHA256 = (
    "60191121f91a9933c289dcc109a5417e5dd560303d181de94896511beb8b032b"
)
# Blank F16 Type-A ambiguous remap worksheet (superseded by F17 v2 continuity worksheet).
FROZEN_F16_TYPE_A_BLANK_WORKSHEET_SHA256 = (
    "c5bc336a186e116ae034869bbe96c612ee3518f002c489dc3e083636b4e4fa2a"
)

FROZEN_BASELINE_REPARSE_SHA256 = (
    "64b5509e97274f4045302e61c12697519a32cad7a51ac3433c9d975664592142"
)

EXPECTED_CURRENT_LEXICON_PAGES = 27
EXPECTED_CURRENT_ROWS = 11694
EXPECTED_CURRENT_WITH_SENSES = 10124
EXPECTED_BASELINE_ROWS = 8823
EXPECTED_BASELINE_WITH_SENSES = 8776
EXPECTED_REVIEW_LEAVES = 100
EXPECTED_CONFIRMED_LEAVES = 100
EXPECTED_BATCH_PAGES = 24

OFFICIAL_ORIGIN_PREFIX = "https://www.mali-pense.net/emk/lexicon/"


@dataclass(frozen=True)
class SourceRefreshPaths:
    repo_root: Path
    baseline_ir: Path
    current_ir: Path
    delta: Path
    crawl_dir: Path
    capture_receipt: Path
    review_registry: Path
    baseline_crawl_dir: Path
    output_dir: Path
    owner_ir: Path
    index_ir: Path
    aliases: Path
    supplements: Path
    target_variants: Path
    phrase_review: Path
    search_regression_dir: Path
    malipense_yaml: Path
    canonical_enriched: Path | None = None
    canonical_search_index: Path | None = None
    canonical_bundle_dir: Path | None = None

    @property
    def build_dir(self) -> Path:
        return self.output_dir / "build"

    @property
    def integrity_manifest(self) -> Path:
        return self.output_dir / "downstream_reference_integrity.jsonl"

    @property
    def acceptance_json(self) -> Path:
        return self.output_dir / "source_refresh_acceptance.json"

    @property
    def destructive_manifest(self) -> Path:
        return self.output_dir / "destructive_change_disposition.jsonl"

    @property
    def f16_dir(self) -> Path:
        return self.output_dir / "f16"

    @property
    def f17_dir(self) -> Path:
        return self.output_dir / "f17"


def default_paths(repo_root: Path | None = None) -> SourceRefreshPaths:
    root = repo_root or Path(__file__).resolve().parents[3]
    workspace = root / "data" / "malidaba_delta" / "current"
    return SourceRefreshPaths(
        repo_root=root,
        baseline_ir=root / "data" / "ir" / "malipense_lexicon_v3.jsonl",
        current_ir=workspace / "artifacts" / "malidaba_current_ir.jsonl",
        delta=workspace / "artifacts" / "malidaba_version_delta.jsonl",
        crawl_dir=(
            workspace
            / "snapshots"
            / "src_malipense"
            / "crawl_20260821_170103_554_2876_src_malipense"
        ),
        capture_receipt=workspace / "evidence" / "capture_receipt.json",
        review_registry=(
            workspace / "review" / "malidaba_delta_reviews_v1.jsonl"
        ),
        baseline_crawl_dir=(
            root
            / "data"
            / "snapshots"
            / "src_malipense"
            / "crawl_20260122_042746_100_5a30_src_malipense"
        ),
        output_dir=workspace / "source_refresh",
        owner_ir=root / "data" / "ir" / "siralex_owner_lexical_v1.jsonl",
        index_ir=root / "data" / "ir" / "malipense_index_v1.jsonl",
        aliases=root / "shared" / "aliases" / "source_aliases_v1.jsonl",
        supplements=(
            root / "shared" / "source_index_supplements" / "source_index_supplements_v1.jsonl"
        ),
        target_variants=(
            root / "shared" / "target_variants" / "reviewed_target_variants_v1.jsonl"
        ),
        phrase_review=(
            root / "shared" / "phrase_review" / "phrase_miss_review_v1.jsonl"
        ),
        search_regression_dir=root / "shared" / "search_regression",
        malipense_yaml=root / "shared" / "sources" / "malipense.yaml",
        canonical_enriched=(
            root / "data" / "enriched" / "malipense_enriched_norm_v3.jsonl"
        ),
        canonical_search_index=None,
        canonical_bundle_dir=root
        / "web"
        / "public"
        / "bundle_full_20260710_337619ff",
    )


# Re-export frozen hashes for acceptance receipts
__all__ = [
    "EXPECTED_BATCH_PAGES",
    "EXPECTED_BASELINE_ROWS",
    "EXPECTED_BASELINE_WITH_SENSES",
    "EXPECTED_CONFIRMED_LEAVES",
    "EXPECTED_CURRENT_LEXICON_PAGES",
    "EXPECTED_CURRENT_ROWS",
    "EXPECTED_CURRENT_WITH_SENSES",
    "EXPECTED_REVIEW_LEAVES",
    "FROZEN_BASELINE_IR_SHA256",
    "FROZEN_BASELINE_REPARSE_SHA256",
    "FROZEN_CURRENT_IR_SHA256",
    "FROZEN_DELTA_SHA256",
    "FROZEN_DESTRUCTIVE_MANIFEST_SHA256",
    "FROZEN_F16_COMMIT",
    "FROZEN_F16_PROPOSALS_SHA256",
    "FROZEN_F16_TYPE_A_BLANK_WORKSHEET_SHA256",
    "FROZEN_F16_TYPE_B_BLANK_WORKSHEET_SHA256",
    "FROZEN_INTEGRITY_MANIFEST_SHA256",
    "FROZEN_ACCEPTANCE_SHA256",
    "FROZEN_REVIEW_REGISTRY_SHA256",
    "OFFICIAL_ORIGIN_PREFIX",
    "SourceRefreshPaths",
    "default_paths",
]
