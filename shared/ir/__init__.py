"""
IR (Intermediate Representation) models for SiraLex.

These models implement the contracts defined in shared/specs/lossless-capture-and-ir.md v1.1.
"""

from .models import (
    IRKind,
    EntryBlock,
    EvidencePointer,
    RecordLocator,
    RecordLocatorKind,
    ExampleRaw,
    SenseRaw,
    LexiconEntryFieldsRaw,
    IndexMappingFieldsRaw,
    TargetEntry,
    IRUnit,
    compute_ir_id,
)
from .lexical_review import (
    LexicalReviewValidationError,
    LexiconVariantRegistry,
    OWNER_APPROVED_LEXICAL_DERIVATION_KIND,
    ReviewedTargetVariant,
    SIRALEX_LEXICAL_REVIEW_SOURCE_ID,
    SIRALEX_OWNER_LEXICAL_PARSER_VERSION,
)

__all__ = [
    "IRKind",
    "EntryBlock",
    "EvidencePointer",
    "RecordLocator",
    "RecordLocatorKind",
    "ExampleRaw",
    "SenseRaw",
    "LexiconEntryFieldsRaw",
    "IndexMappingFieldsRaw",
    "TargetEntry",
    "IRUnit",
    "compute_ir_id",
    "LexicalReviewValidationError",
    "LexiconVariantRegistry",
    "OWNER_APPROVED_LEXICAL_DERIVATION_KIND",
    "ReviewedTargetVariant",
    "SIRALEX_LEXICAL_REVIEW_SOURCE_ID",
    "SIRALEX_OWNER_LEXICAL_PARSER_VERSION",
]
