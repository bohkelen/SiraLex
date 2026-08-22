"""Stable / conservative identity matching for Malidaba lexicon IR."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from typing import Any

from .canonical_json import canonical_dumps
from .semantic import semantic_projection


IDENTITY_RULE_ID = "malipense_identity_v2_partial"

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

    @property
    def semantic_signature(self) -> str:
        return canonical_dumps(semantic_projection(self.record))


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
    # STRONG | EXACT_CONTENT_SUPPORTED | PROVISIONAL | AMBIGUOUS |
    # UNMATCHED_BASELINE | UNMATCHED_CURRENT
    identity_confidence: str


def _emit_ambiguous_members(
    pairs: list[MatchPair],
    b_list: list[RecordRef],
    c_list: list[RecordRef],
    used_baseline: set[str],
    used_current: set[str],
    *,
    match_method: str,
) -> None:
    for b in b_list:
        if b.ir_id in used_baseline:
            continue
        pairs.append(
            MatchPair(
                baseline=b,
                current=None,
                match_method=match_method,
                identity_confidence="AMBIGUOUS",
            )
        )
        used_baseline.add(b.ir_id)
    for c in c_list:
        if c.ir_id in used_current:
            continue
        pairs.append(
            MatchPair(
                baseline=None,
                current=c,
                match_method=match_method,
                identity_confidence="AMBIGUOUS",
            )
        )
        used_current.add(c.ir_id)


def _exact_content_pairs_within_group(
    b_list: list[RecordRef],
    c_list: list[RecordRef],
) -> list[tuple[RecordRef, RecordRef]]:
    """
    Within an ambiguous same-page/same-headword group, pair records that share
    an identical canonical semantic projection when that signature is unique
    on both sides (1:1 only). No fuzzy / similarity matching.
    """
    by_sig_b: dict[str, list[RecordRef]] = defaultdict(list)
    by_sig_c: dict[str, list[RecordRef]] = defaultdict(list)
    for b in b_list:
        by_sig_b[b.semantic_signature].append(b)
    for c in c_list:
        by_sig_c[c.semantic_signature].append(c)

    paired: list[tuple[RecordRef, RecordRef]] = []
    for sig in sorted(set(by_sig_b) & set(by_sig_c)):
        bb = by_sig_b[sig]
        cc = by_sig_c[sig]
        if len(bb) == 1 and len(cc) == 1:
            paired.append((bb[0], cc[0]))
    return paired


def match_records(
    baseline_refs: list[RecordRef],
    current_refs: list[RecordRef],
) -> list[MatchPair]:
    """
    Conservative deterministic matching hierarchy.

    1. Primary (url_canonical, source_record_id) when headword_latin also equal
       → STRONG
    2. Unique (url_canonical, headword_latin) 1:1 among unmatched
       → PROVISIONAL
    3. Within ambiguous same-page/same-headword groups, unique identical
       semantic projection 1:1 → EXACT_CONTENT_SUPPORTED
    4. Remaining multi-homonym collisions → AMBIGUOUS
    5. Remainder → UNMATCHED_*

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
            _emit_ambiguous_members(
                pairs,
                b_list,
                c_list,
                used_baseline,
                used_current,
                match_method="primary_key_collision",
            )
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

    # Phase 2: unique headword keys among remaining → PROVISIONAL
    rem_base = [r for r in baseline_refs if r.ir_id not in used_baseline]
    rem_cur = [r for r in current_refs if r.ir_id not in used_current]
    base_by_hw = index_by_headword(rem_base)
    cur_by_hw = index_by_headword(rem_cur)

    ambiguous_groups: list[tuple[list[RecordRef], list[RecordRef]]] = []

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
            ambiguous_groups.append((b_list, c_list))

    # Phase 3: exact-content-supported within ambiguous groups
    for b_list, c_list in ambiguous_groups:
        exact_pairs = _exact_content_pairs_within_group(b_list, c_list)
        exact_b = {b.ir_id for b, _ in exact_pairs}
        exact_c = {c.ir_id for _, c in exact_pairs}
        for b, c in sorted(exact_pairs, key=lambda pc: (pc[0].ir_id, pc[1].ir_id)):
            pairs.append(
                MatchPair(
                    baseline=b,
                    current=c,
                    match_method="url_canonical+headword+exact_semantic_projection",
                    identity_confidence="EXACT_CONTENT_SUPPORTED",
                )
            )
            used_baseline.add(b.ir_id)
            used_current.add(c.ir_id)

        remain_b = [b for b in b_list if b.ir_id not in exact_b]
        remain_c = [c for c in c_list if c.ir_id not in exact_c]
        if remain_b or remain_c:
            _emit_ambiguous_members(
                pairs,
                remain_b,
                remain_c,
                used_baseline,
                used_current,
                match_method="url_canonical+headword_latin_ambiguous",
            )

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
