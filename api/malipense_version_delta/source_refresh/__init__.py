"""Dry-run Malidaba SOURCE_REFRESH_ACCEPTANCE evaluation (CORPUS1F15)."""

from .evaluate import (
    SourceRefreshPaths,
    evaluate_source_refresh_acceptance,
    run_source_refresh_acceptance,
)
from .model import (
    ACCEPTANCE_SCHEMA_VERSION,
    GateResult,
    GateStatus,
    OverallDecision,
    RightsPosture,
    SourceRefreshAcceptance,
)

__all__ = [
    "ACCEPTANCE_SCHEMA_VERSION",
    "GateResult",
    "GateStatus",
    "OverallDecision",
    "RightsPosture",
    "SourceRefreshAcceptance",
    "SourceRefreshPaths",
    "evaluate_source_refresh_acceptance",
    "run_source_refresh_acceptance",
]
