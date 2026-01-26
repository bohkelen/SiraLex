"""
IR Parser module for Nkokan.

Parsers extract IR units from raw snapshots.
"""

from .malipense_lexicon import MalipenseLexiconParser, PARSER_VERSION

__all__ = [
    "MalipenseLexiconParser",
    "PARSER_VERSION",
]
