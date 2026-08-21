"""Stable / conservative identity matching for Malidaba lexicon IR."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from typing import Any


IDENTITY_RULE_ID = "malipense_identity_v1_partial"

# Primary locator fields from existing IR / registry guidance.
PRIMARY_IDENTITY_FIELDS = ("url_canonical", "source_record_id")


@dataclass(frozen=True)
class RecordRef:
    """Lightweight identity handle for one lexicon IR row."""

    side: str  # "baseline" | "current"
    ir_id: str
    url_canonical: str
    source_record_id: str | None
    headword_latin: str | None
    record: dict[str, Any]

    @property
    def primary_key(self) -> tuple[str, str] | None:
        if not self.source_record_id:
            return None
        return (self.url_canonical, self.source_record_id)

    @property
    def headword_key(self) -> tuple[str, str] | None:
        if self.headword_latin is None or self.headword_latin == "":
            return None
        return (self.url_canonical, self.headword_latin)


def record_ref_from_ir(side: str, record: dict[str, Any]) -> RecordRef:
    locator = record.get("record_locator") or {}
    fields = record.get("fields_raw") or {}
    return RecordRef(
        side=side,
        ir_id=str(record.get("ir_id") or ""),
        url_canonical=str(locator.get("url_canonical") or ""),
        source_record_id=locator.get("source_record_id"),
        headword_latin=fields.get("headword_latin"),
        record=record,
    )


def index_by_primary(refs: list[RecordRef]) -> dict[tuple[str, str], list[RecordRef]]:
    out: dict[tuple[str, str], list[RecordRef]] = defaultdict(list)
    for ref in refs:
        key = ref.primary_key
        if key is None:
            continue
        out[key].append(ref)
    return out


def index_by_headword(refs: list[RecordRef]) -> dict[tuple[str, str], list[RecordRef]]:
    out: dict[tuple[str, str], list[RecordRef]] = defaultdict(list)
    for ref in refs:
        key = ref.headword_key
        if key is None:
            continue
        out[key].append(ref)
    return out


def reject_duplicate_primary_keys(refs: list[RecordRef]) -> list[tuple[str, str]]:
    """Return primary keys that appear more than once on one side."""
    counts: dict[tuple[str, str], int] = defaultdict(int)
    for ref in refs:
        key = ref.primary_key
        if key is not None:
            counts[key] += 1
    return sorted(k for k, n in counts.items() if n > 1)


@dataclass
class MatchPair:
    baseline: RecordRef | None
    current: RecordRef | None
    match_method: str
    # STRONG | PROVISIONAL | AMBIGUOUS | UNMATCHED_BASELINE | UNMATCHED_CURRENT
    identity_confidence: str


def match_records(
    baseline_refs: list[RecordRef],
    current_refs: list[RecordRef],
) -> list[MatchPair]:
    """
    Conservative deterministic matching hierarchy.

    1. Primary (url_canonical, source_record_id) when headword_latin also equal
       → STRONG
    2. Else unique (url_canonical, headword_latin) 1:1 among unmatched
       → PROVISIONAL
    3. Else multi-homonym / multi-id collisions among unmatched
       → AMBIGUOUS
    4. Remainder → UNMATCHED_*

    Duplicate primary keys on a single side are rejected by caller before match.
    """
    pairs: list[MatchPair] = []
    used_baseline: set[str] = set()
    used_current: set[str] = set()

    base_by_primary = index_by_primary(baseline_refs)
    cur_by_primary = index_by_primary(current_refs)

    # Phase 1: strong primary+headword
    for key in sorted(set(base_by_primary) & set(cur_by_primary)):
        b_list = base_by_primary[key]
        c_list = cur_by_primary[key]
        if len(b_list) != 1 or len(c_list) != 1:
            # Ambiguous primary collision on a side — one row per involved record.
            for b in b_list:
                pairs.append(
                    MatchPair(
                        baseline=b,
                        current=None,
                        match_method="primary_key_collision",
                        identity_confidence="AMBIGUOUS",
                    )
                )
                used_baseline.add(b.ir_id)
            for c in c_list:
                pairs.append(
                    MatchPair(
                        baseline=None,
                        current=c,
                        match_method="primary_key_collision",
                        identity_confidence="AMBIGUOUS",
                    )
                )
                used_current.add(c.ir_id)
            continue
        b = b_list[0]
        c = c_list[0]
        if b.headword_latin == c.headword_latin:
            pairs.append(
                MatchPair(
                    baseline=b,
                    current=c,
                    match_method="url_canonical+source_record_id+headword",
                    identity_confidence="STRONG",
                )
            )
            used_baseline.add(b.ir_id)
            used_current.add(c.ir_id)
        # else: same id, different headword → renumbering; leave for later phases

    # Phase 2/3: headword keys among remaining
    rem_base = [r for r in baseline_refs if r.ir_id not in used_baseline]
    rem_cur = [r for r in current_refs if r.ir_id not in used_current]
    base_by_hw = index_by_headword(rem_base)
    cur_by_hw = index_by_headword(rem_cur)

    for key in sorted(set(base_by_hw) & set(cur_by_hw)):
        b_list = base_by_hw[key]
        c_list = cur_by_hw[key]
        if len(b_list) == 1 and len(c_list) == 1:
            b = b_list[0]
            c = c_list[0]
            pairs.append(
                MatchPair(
                    baseline=b,
                    current=c,
                    match_method="url_canonical+headword_latin_unique",
                    identity_confidence="PROVISIONAL",
                )
            )
            used_baseline.add(b.ir_id)
            used_current.add(c.ir_id)
        else:
            # Ambiguous homonym / multi-id collision: one evidence row per
            # involved record (not a cartesian product).
            for b in b_list:
                pairs.append(
                    MatchPair(
                        baseline=b,
                        current=None,
                        match_method="url_canonical+headword_latin_ambiguous",
                        identity_confidence="AMBIGUOUS",
                    )
                )
                used_baseline.add(b.ir_id)
            for c in c_list:
                pairs.append(
                    MatchPair(
                        baseline=None,
                        current=c,
                        match_method="url_canonical+headword_latin_ambiguous",
                        identity_confidence="AMBIGUOUS",
                    )
                )
                used_current.add(c.ir_id)

    for b in baseline_refs:
        if b.ir_id not in used_baseline:
            pairs.append(
                MatchPair(
                    baseline=b,
                    current=None,
                    match_method="unmatched",
                    identity_confidence="UNMATCHED_BASELINE",
                )
            )
            used_baseline.add(b.ir_id)

    for c in current_refs:
        if c.ir_id not in used_current:
            pairs.append(
                MatchPair(
                    baseline=None,
                    current=c,
                    match_method="unmatched",
                    identity_confidence="UNMATCHED_CURRENT",
                )
            )
            used_current.add(c.ir_id)

    return pairs
