"""PRODUCT2 — publication readiness and catalog boundary."""

from .evaluate import evaluate_product2
from .model import (
    DECISION_BLOCKED,
    DECISION_READY,
    GATE_AWAITING_HUMAN_AUTHORIZATION,
    GATE_PASS,
)

__all__ = [
    "evaluate_product2",
    "DECISION_READY",
    "DECISION_BLOCKED",
    "GATE_PASS",
    "GATE_AWAITING_HUMAN_AUTHORIZATION",
]
