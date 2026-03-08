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
]
