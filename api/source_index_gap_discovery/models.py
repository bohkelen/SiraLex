"""Data models for source-index gap discovery."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

CandidateType = Literal[
    "missing_standalone_source_term",
    "missing_broad_umbrella_term",
    "plural_form_gap",
    "incomplete_existing_source_mapping",
    "existing_source_with_related_phrases",
    "suspected_incomplete_existing_source_mapping",
    "confirmed_incomplete_existing_source_mapping",
    "modifier_or_low_value_term",
    "ambiguous_or_review_required",
    "likely_stopword_or_noise",
]

Actionability = Literal["review_candidate", "evidence_only", "noise", "defer"]
Confidence = Literal["high", "medium", "low"]
ReviewTier = Literal[
    "tier_1_strong_candidate",
    "tier_2_interesting_candidate",
    "tier_3_evidence_only",
    "tier_4_noise_or_defer",
]

KEY_TYPE_ORDER = ("casefold", "diacritics_insensitive", "punct_stripped", "nospace")
SOURCE_KEY_TYPES = tuple(f"src_{key_type}" for key_type in KEY_TYPE_ORDER)


@dataclass(frozen=True)
class GlossEvidence:
    """French gloss evidence tied to a target lexicon entry."""

    ir_id: str
    target_form: str
    field_path: str
    gloss: str

    def to_dict(self) -> dict[str, str]:
        return {
            "ir_id": self.ir_id,
            "target_form": self.target_form,
            "field_path": self.field_path,
            "gloss": self.gloss,
        }


@dataclass(frozen=True)
class SourceMappingEvidence:
    """Existing source mapping evidence tied to an index_mapping record."""

    ir_id: str
    source_term: str
    target_forms: tuple[str, ...] = ()

    def to_dict(self) -> dict[str, Any]:
        return {
            "ir_id": self.ir_id,
            "source_term": self.source_term,
            "target_forms": list(self.target_forms),
        }


@dataclass
class CandidateAccumulator:
    """Mutable collection of evidence before final classification."""

    term: str
    normalized_keys: dict[str, list[str]]
    gloss_evidence: list[GlossEvidence] = field(default_factory=list)
    source_mappings: list[SourceMappingEvidence] = field(default_factory=list)
    related_source_mappings: list[SourceMappingEvidence] = field(default_factory=list)
    phrase_head_evidence: list[SourceMappingEvidence] = field(default_factory=list)
    source_lookup_postings: dict[str, list[str]] = field(default_factory=dict)
    filter_labels: set[str] = field(default_factory=set)
    plural_linked_to: str | None = None


@dataclass(frozen=True)
class CandidateRow:
    """Review-only candidate row emitted by the miner."""

    candidate_french_term: str
    normalized_source_key: str
    current_lookup_behavior: str
    evidence_glosses: list[dict[str, str]]
    target_forms: list[str]
    target_ir_ids: list[str]
    related_existing_source_mappings: list[dict[str, Any]]
    candidate_type: CandidateType
    confidence: Confidence
    score: int
    score_reasons: list[str]
    actionability: Actionability
    review_tier: ReviewTier
    canonical_candidate_term: str
    observed_variants: list[str]
    plural_linked_to: str | None
    evidence_rollup: dict[str, Any]
    group_candidate_types: list[str]
    group_review_tier: ReviewTier
    group_actionability: Actionability
    proposed_representation: str
    review_needed: bool
    implementation_decision: str = "pending_review"

    def to_dict(self) -> dict[str, Any]:
        return {
            "candidate_french_term": self.candidate_french_term,
            "normalized_source_key": self.normalized_source_key,
            "current_lookup_behavior": self.current_lookup_behavior,
            "evidence_glosses": self.evidence_glosses,
            "target_forms": self.target_forms,
            "target_ir_ids": self.target_ir_ids,
            "related_existing_source_mappings": self.related_existing_source_mappings,
            "candidate_type": self.candidate_type,
            "confidence": self.confidence,
            "score": self.score,
            "score_reasons": self.score_reasons,
            "actionability": self.actionability,
            "review_tier": self.review_tier,
            "canonical_candidate_term": self.canonical_candidate_term,
            "observed_variants": self.observed_variants,
            "plural_linked_to": self.plural_linked_to,
            "evidence_rollup": self.evidence_rollup,
            "group_candidate_types": self.group_candidate_types,
            "group_review_tier": self.group_review_tier,
            "group_actionability": self.group_actionability,
            "proposed_representation": self.proposed_representation,
            "review_needed": self.review_needed,
            "implementation_decision": self.implementation_decision,
        }


@dataclass(frozen=True)
class DiscoveryReport:
    """Complete mining result."""

    bundle_id: str
    manifest_content_sha256: str
    total_candidates: int
    candidates_by_type: dict[str, int]
    candidates_by_actionability: dict[str, int]
    candidates_by_review_tier: dict[str, int]
    rows: list[CandidateRow]

    def summary_dict(self) -> dict[str, Any]:
        return {
            "bundle_id": self.bundle_id,
            "manifest_content_sha256": self.manifest_content_sha256,
            "total_candidates": self.total_candidates,
            "candidates_by_type": self.candidates_by_type,
            "candidates_by_actionability": self.candidates_by_actionability,
            "candidates_by_review_tier": self.candidates_by_review_tier,
        }
