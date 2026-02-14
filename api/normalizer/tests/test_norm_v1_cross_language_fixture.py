"""
Cross-language parity fixture test (Python side).

This validates that the canonical JSON fixture generated from norm_v1 stays
consistent with the actual Python implementation.

JS/TS tests consume the same fixture to enforce parity.
"""

import json
import sys
from pathlib import Path


# Add shared to path for imports (same pattern as other modules)
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "shared"))

from normalization.norm_v1 import RULESET_ID, compute_search_keys, normalize_nfc  # noqa: E402


def test_norm_v1_fixture_matches_python_implementation():
    fixture_path = (
        Path(__file__).parent.parent.parent.parent
        / "shared"
        / "normalization"
        / "fixtures"
        / "norm_v1_search_keys.json"
    )
    payload = json.loads(fixture_path.read_text(encoding="utf-8"))

    assert payload["ruleset_id"] == RULESET_ID

    for case in payload["cases"]:
        input_s = case["input"]
        input_nfc = normalize_nfc(input_s)

        assert case["input_nfc"] == input_nfc

        expected = case["expected"]
        got = compute_search_keys([input_nfc])
        assert got == expected

        proj = case["normalized_record_projection"]
        assert proj["preferred_form"] == input_nfc
        assert proj["variant_forms"] == [input_nfc]
        assert proj["search_keys"] == expected

