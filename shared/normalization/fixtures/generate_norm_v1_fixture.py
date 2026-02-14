"""
Generate a small, versioned JSON fixture for cross-language parity tests.

This script produces a canonical fixture file that can be consumed by:
- Python tests (shared normalization implementation)
- JS/TS tests (web app normalization mirror)

The fixture focuses on norm_v1 search key computation as currently implemented
in shared/normalization/norm_v1.py (compute_search_keys and component transforms).

It is intentionally small but high-coverage for Unicode/whitespace/punctuation edge cases.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from normalization.norm_v1 import RULESET_ID, compute_search_keys, normalize_nfc


FIXTURE_INPUTS: list[str] = [
    # Maninka Latin with combining marks (tone)
    "dɔ́bɛ̀n",
    # Decomposed version (NFD-like) to catch NFC differences
    "da\u0301",
    # Whitespace normalization
    "  a\tb\nc  ",
    # Punctuation stripping and replacement behaviors (hyphen/backtick)
    "dín`",
    "-da",
    # Apostrophes / quotes (common typing variants)
    "n'ko",
    "n’ko",
    # N'Ko sample (should round-trip NFC baseline without crashes)
    "ߞߊ߬ߣߌ߲ߞߊߞߊ߲",
    # German sharp s (casefold != lower); catches casefold drift in JS
    "Straße",
]


def make_case(input_s: str) -> dict[str, Any]:
    # The fixture is defined on NFC-normalized inputs (baseline rule)
    nfc = normalize_nfc(input_s)
    keys = compute_search_keys([nfc])
    return {
        "input": input_s,
        "input_nfc": nfc,
        "expected": keys,
        "normalized_record_projection": {
            "preferred_form": nfc,
            "variant_forms": [nfc],
            "search_keys": keys,
        },
    }


def main() -> None:
    here = Path(__file__).resolve()
    out_path = here.parent / "norm_v1_search_keys.json"

    payload = {
        "ruleset_id": RULESET_ID,
        "cases": [make_case(s) for s in FIXTURE_INPUTS],
    }

    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {out_path} ({len(payload['cases'])} cases) for {RULESET_ID}")


if __name__ == "__main__":
    main()

