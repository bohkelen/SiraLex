"""Models and classification constants for the F20 transaction design."""

from __future__ import annotations

SCHEMA_VERSION = "malidaba_source_refresh_transaction_v1"

ROLE_SOURCE_CURRENT = "SOURCE_CURRENT_EDITION"
ROLE_SOURCE_LEGACY = "SOURCE_LEGACY_ASSERTIONS"
ROLE_LOGICAL = "LOGICAL_CONTINUITY"
ROLE_EDITION_MAP = "EDITION_TO_LOGICAL_MAPPING"
ROLE_DOWNSTREAM = "DOWNSTREAM_PROJECTION"
ROLE_BUILD_DERIVED = "BUILD_DERIVED"
ROLE_PUBLICATION = "PUBLICATION_ARTIFACT"
ROLE_UNRELATED = "UNRELATED"

KIND_GOVERNED = "GOVERNED_CANONICAL_INPUT"
KIND_DERIVED = "DETERMINISTIC_DERIVED_OUTPUT"

EDITION_CURRENT = "current_edition"
EDITION_BASELINE = "baseline_edition"

LAYER_STAMP_CURRENT = "malidaba_edition_layer_v1"
LAYER_STAMP_LEGACY = "malidaba_legacy_retained_assertion_v1"

DECISION_READY = "CORPUS1F20_MALIDABA_CANONICAL_REFRESH_TRANSACTION_READY"
DECISION_BLOCKED = "CORPUS1F20_MALIDABA_CANONICAL_REFRESH_TRANSACTION_BLOCKED"

# Destination paths relative to repo root (discovered mutation surface).
DEST_CURRENT_IR = "data/ir/malipense_lexicon_v3.jsonl"
DEST_LEGACY_IR = "data/ir/malidaba_legacy_retained_v1.jsonl"
DEST_LOGICAL = "shared/malidaba/malidaba_logical_lexical_continuity_v1.jsonl"
DEST_EDITION_MAP = "shared/malidaba/malidaba_edition_to_logical_mapping_v1.jsonl"
DEST_ALIASES = "shared/aliases/source_aliases_v1.jsonl"
DEST_SUPPLEMENTS = "shared/source_index_supplements/source_index_supplements_v1.jsonl"
DEST_TARGET_VARIANTS = "shared/target_variants/reviewed_target_variants_v1.jsonl"
DEST_INDEX_IR = "data/ir/malipense_index_v1.jsonl"

# Applied destination SHA-256 (CORPUS1F21 authorized transaction after-hashes).
APPLIED_DESTINATION_SHA256 = {
    DEST_CURRENT_IR: (
        "4d6e82e98638b5371aa80b09726cbf1f5a4a6de5fd4c3e006f7ec5591e2ae5de"
    ),
    DEST_LEGACY_IR: (
        "b74f22d36972fceb8622b61c31931f3a0d401820bc6bbb30c22eb2588da89764"
    ),
    DEST_LOGICAL: (
        "e8df1bfc6abeef68c33ce9ca00df4526bc10b64ebf6f13b41119a8a573569bc0"
    ),
    DEST_EDITION_MAP: (
        "ee872549fcba49031f79aeb173d13f50aa50fbe0717e882f164fc31bf83b8bae"
    ),
    DEST_ALIASES: (
        "0e896a79758d4bf6e697a3c9463234e9b95cf58f6f9b2361437646374499d76b"
    ),
    DEST_SUPPLEMENTS: (
        "d8e13a8b30592205410a85219cc21843b76017c27c6ac259970bc1db8d7c2c9f"
    ),
    DEST_TARGET_VARIANTS: (
        "69134e77cfc62102afa061548c8b425583c5a5eb07838de3d174ab32ed8ee759"
    ),
    DEST_INDEX_IR: (
        "590c0ff9320f56cb88de016e2042ee9c9fd898717cea7f8cb5d53375ab38d7a4"
    ),
}

PUBLICATION_PREFIXES = (
    "web/public/",
    "web/.env.production",
)

PROJECTION_POLICY = {
    "aliases": (
        "runtime_current_edition_ir_id generated from logical continuity "
        "(deterministic projection; logical registry is authority)"
    ),
    "supplements": (
        "runtime_current_edition_ir_id generated from logical continuity"
    ),
    "target_variants": (
        "runtime_current_edition_ir_id generated from logical continuity"
    ),
    "index_mappings": (
        "source locator (source_record_id) generated from logical continuity "
        "successor; locator is not lexical identity"
    ),
    "phrase_review": (
        "runtime projection optional; evidence-only table in F20"
    ),
    "search_regression_expectations": (
        "remain edition-runtime assertions for now; future contracts should "
        "prefer logical_lexical_id / resolved_target_ir_ids"
    ),
}
