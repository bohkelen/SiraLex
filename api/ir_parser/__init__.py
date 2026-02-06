"""
IR Parser module for Nkokan.

Parsers extract IR units from raw snapshots.
"""

from .malipense_lexicon import MalipenseLexiconParser, PARSER_VERSION as LEXICON_PARSER_VERSION
from .malipense_index import MalipenseIndexParser, PARSER_VERSION as INDEX_PARSER_VERSION

__all__ = [
    "MalipenseLexiconParser",
    "MalipenseIndexParser",
    "LEXICON_PARSER_VERSION",
    "INDEX_PARSER_VERSION",
]
