"""Rights profiles, classifications, and reason codes for PRODUCT1A."""

from __future__ import annotations

from typing import Final

# ---------------------------------------------------------------------------
# Product-use profiles
# ---------------------------------------------------------------------------

PROFILE_INTERNAL_FULL: Final = "INTERNAL_FULL"
PROFILE_NONCOMMERCIAL_CANDIDATE: Final = "NONCOMMERCIAL_CANDIDATE"
PROFILE_COMMERCIAL_SAFE_CANDIDATE: Final = "COMMERCIAL_SAFE_CANDIDATE"

# ---------------------------------------------------------------------------
# Rights classifications (fail-closed vocabulary)
# ---------------------------------------------------------------------------

COMMERCIAL_SAFE_INDEPENDENT: Final = "COMMERCIAL_SAFE_INDEPENDENT"
COMMERCIAL_SAFE_LICENSED: Final = "COMMERCIAL_SAFE_LICENSED"
NONCOMMERCIAL_SOURCE_DERIVED: Final = "NONCOMMERCIAL_SOURCE_DERIVED"
MIXED_RIGHTS: Final = "MIXED_RIGHTS"
UNKNOWN_RIGHTS: Final = "UNKNOWN_RIGHTS"
METADATA_ONLY_NONCONTENT: Final = "METADATA_ONLY_NONCONTENT"
BLOCKED_COMMERCIAL: Final = "BLOCKED_COMMERCIAL"

# ---------------------------------------------------------------------------
# Dependence buckets (mutually exclusive product-item accounting)
# ---------------------------------------------------------------------------

DEP_DIRECT_MALIDABA: Final = "DIRECT_MALIDABA"
DEP_LEGACY_MALIDABA: Final = "LEGACY_MALIDABA"
DEP_MALIDABA_DERIVED: Final = "MALIDABA_DERIVED"
DEP_MIXED_MALIDABA_OTHER: Final = "MIXED_MALIDABA_OTHER"
DEP_INDEPENDENT_COMMERCIAL_SAFE: Final = "INDEPENDENT_COMMERCIAL_SAFE"
DEP_UNKNOWN_BLOCKED: Final = "UNKNOWN_BLOCKED"

# ---------------------------------------------------------------------------
# Reason codes
# ---------------------------------------------------------------------------

MALIDABA_DIRECT_CONTENT: Final = "MALIDABA_DIRECT_CONTENT"
MALIDABA_LEGACY_CONTENT: Final = "MALIDABA_LEGACY_CONTENT"
MALIDABA_DERIVED_GLOSS: Final = "MALIDABA_DERIVED_GLOSS"
MALIDABA_DERIVED_VARIANT: Final = "MALIDABA_DERIVED_VARIANT"
MALIDABA_DERIVED_ALIAS: Final = "MALIDABA_DERIVED_ALIAS"
MALIDABA_DERIVED_SUPPLEMENT: Final = "MALIDABA_DERIVED_SUPPLEMENT"
MALIDABA_EVIDENCE_DEPENDENCY: Final = "MALIDABA_EVIDENCE_DEPENDENCY"
MIXED_SOURCE_RIGHTS: Final = "MIXED_SOURCE_RIGHTS"
UNKNOWN_SOURCE_RIGHTS: Final = "UNKNOWN_SOURCE_RIGHTS"
MISSING_PROVENANCE: Final = "MISSING_PROVENANCE"
NONCOMMERCIAL_LICENSE: Final = "NONCOMMERCIAL_LICENSE"
COMMERCIAL_PERMISSION_NOT_RECORDED: Final = "COMMERCIAL_PERMISSION_NOT_RECORDED"
PROJECT_INTERNAL_LICENSE_ONLY: Final = "PROJECT_INTERNAL_LICENSE_ONLY"

# ---------------------------------------------------------------------------
# Source identities
# ---------------------------------------------------------------------------

SOURCE_MALIPENSE: Final = "src_malipense"
SOURCE_OWNER: Final = "src_siralex_lexical_review"

LICENSE_CC_BY_NC_SA: Final = "CC BY-NC-SA 4.0"
LICENSE_PROJECT_INTERNAL: Final = "project-internal-review"

EDITION_CURRENT: Final = "current_edition"
EDITION_BASELINE: Final = "baseline_edition"
LAYER_LEGACY: Final = "malidaba_legacy_retained_assertion_v1"

# Commercial-safe eligibility: only these classifications may enter the profile.
COMMERCIAL_ELIGIBLE_CLASSIFICATIONS: Final = frozenset(
    {
        COMMERCIAL_SAFE_INDEPENDENT,
        COMMERCIAL_SAFE_LICENSED,
        METADATA_ONLY_NONCONTENT,
    }
)

# Regression outcome labels for commercial profile.
REGRESSION_PASS: Final = "PASS"
REGRESSION_EXPECTED_RIGHTS_EXCLUSION: Final = "EXPECTED_RIGHTS_EXCLUSION"
REGRESSION_UNEXPECTED_PRODUCT_DEFECT: Final = "UNEXPECTED_PRODUCT_DEFECT"
