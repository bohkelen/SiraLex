"""Core Malidaba version-delta comparison (non-mutating, evidence only)."""

from __future__ import annotations

import hashlib
import json
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import zstandard as zstd

from ir_parser.malipense_lexicon import MalipenseLexiconParser, PARSER_VERSION

from .canonical_json import canonical_dumps, sha256_file, write_json, write_jsonl
from .identity import (
    IDENTITY_RULE_ID,
    MatchPair,
    reject_duplicate_primary_keys,
    match_records,
    record_ref_from_ir,
)
from .parser_compat import (
    assess_parser_compatibility,
    detect_nested_lxp2_in_html,
)
from .semantic import classify_semantic_changes, semantic_projection

COMPARISON_SCHEMA_VERSION = "malipense_version_delta_v1"

CLASS_UNCHANGED = "UNCHANGED"
CLASS_NEW = "NEW_IN_CURRENT_SOURCE"
CLASS_MISSING = "MISSING_FROM_CURRENT_SOURCE"
CLASS_CHANGED = "CHANGED_EXISTING_RECORD"
CLASS_AMBIGUOUS = "IDENTITY_AMBIGUOUS"
CLASS_BLOCKED_SEMANTIC = "SEMANTIC_COMPARE_BLOCKED"


@dataclass(frozen=True)
class LoadStats:
    record_count: int
    duplicate_primary_keys: list[tuple[str, str]]


def load_jsonl_records(path: Path) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            records.append(json.loads(line))
    return records


def parse_lexicon_crawl_to_records(crawl_dir: Path) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Parse a snapshot crawl directory with the canonical Malipense lexicon parser."""
    payloads_dir = crawl_dir / "payloads"
    snapshots_jsonl = crawl_dir / "snapshots.jsonl"
    if not payloads_dir.exists():
        raise FileNotFoundError(f"Payloads directory not found: {payloads_dir}")
    if not snapshots_jsonl.exists():
        raise FileNotFoundError(f"Snapshots JSONL not found: {snapshots_jsonl}")

    metadata: dict[str, dict[str, Any]] = {}
    with snapshots_jsonl.open("r", encoding="utf-8") as handle:
        for line in handle:
            record = json.loads(line)
            sid = record.get("snapshot_id")
            if sid:
                metadata[sid] = record

    dctx = zstd.ZstdDecompressor()
    records: list[dict[str, Any]] = []
    stats = {
        "snapshots_processed": 0,
        "snapshots_skipped": 0,
        "entries_parsed": 0,
        "entries_with_warnings": 0,
        "parse_errors": 0,
        "nested_lxp2_pages": 0,
        "pages_checked": 0,
    }

    for payload_path in sorted(payloads_dir.glob("*.html.zst")):
        snapshot_id = payload_path.name.replace(".html.zst", "")
        if snapshot_id not in metadata:
            stats["snapshots_skipped"] += 1
            continue
        meta = metadata[snapshot_id]
        url_canonical = meta.get("url_canonical", "")
        if "/emk/lexicon/" not in url_canonical:
            stats["snapshots_skipped"] += 1
            continue
        try:
            html_bytes = dctx.decompress(payload_path.read_bytes())
            html_text = html_bytes.decode("utf-8", errors="replace")
            stats["pages_checked"] += 1
            if detect_nested_lxp2_in_html(html_text):
                stats["nested_lxp2_pages"] += 1
            parser = MalipenseLexiconParser(snapshot_id, url_canonical)
            for ir_unit in parser.parse_html(html_bytes):
                records.append(ir_unit.to_dict())
                stats["entries_parsed"] += 1
                if ir_unit.parse_warnings:
                    stats["entries_with_warnings"] += 1
            stats["snapshots_processed"] += 1
        except Exception:
            stats["parse_errors"] += 1

    # Deterministic order by primary identity then ir_id
    records.sort(
        key=lambda r: (
            (r.get("record_locator") or {}).get("url_canonical") or "",
            (r.get("record_locator") or {}).get("source_record_id") or "",
            r.get("ir_id") or "",
        )
    )
    return records, stats


def _pair_sort_key(pair: MatchPair) -> tuple:
    b = pair.baseline
    c = pair.current
    return (
        pair.identity_confidence,
        pair.match_method,
        (b.url_canonical if b else "") or (c.url_canonical if c else ""),
        (b.source_record_id if b else "") or (c.source_record_id if c else ""),
        (b.ir_id if b else ""),
        (c.ir_id if c else ""),
    )


def compare_lexicon_records(
    baseline_records: list[dict[str, Any]],
    current_records: list[dict[str, Any]],
    *,
    parser_compat_status: str = "PASS",
    allow_semantic_when_blocked: bool = False,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """
    Compare baseline vs current lexicon IR records.

    Returns (delta_rows, summary_counts_fragment).
    """
    base_refs = [record_ref_from_ir("baseline", r) for r in baseline_records]
    cur_refs = [record_ref_from_ir("current", r) for r in current_records]

    dup_base = reject_duplicate_primary_keys(base_refs)
    dup_cur = reject_duplicate_primary_keys(cur_refs)
    if dup_base or dup_cur:
        raise ValueError(
            "duplicate_stable_identity:"
            f"baseline={dup_base[:5]!r};current={dup_cur[:5]!r}"
        )

    pairs = match_records(base_refs, cur_refs)
    semantic_enabled = parser_compat_status == "PASS" or allow_semantic_when_blocked

    delta_rows: list[dict[str, Any]] = []
    class_counts: Counter[str] = Counter()
    change_subtype_counts: Counter[str] = Counter()
    match_method_counts: Counter[str] = Counter()
    confidence_counts: Counter[str] = Counter()

    for pair in sorted(pairs, key=_pair_sort_key):
        match_method_counts[pair.match_method] += 1
        confidence_counts[pair.identity_confidence] += 1
        b = pair.baseline
        c = pair.current

        if pair.identity_confidence == "AMBIGUOUS":
            classification = CLASS_AMBIGUOUS
            change_classes: list[str] = []
        elif pair.identity_confidence == "UNMATCHED_CURRENT":
            classification = CLASS_NEW
            change_classes = []
        elif pair.identity_confidence == "UNMATCHED_BASELINE":
            classification = CLASS_MISSING
            change_classes = []
        elif b is not None and c is not None:
            if not semantic_enabled:
                classification = CLASS_BLOCKED_SEMANTIC
                change_classes = []
            else:
                b_proj = semantic_projection(b.record)
                c_proj = semantic_projection(c.record)
                if b_proj == c_proj:
                    classification = CLASS_UNCHANGED
                    change_classes = []
                else:
                    classification = CLASS_CHANGED
                    change_classes = classify_semantic_changes(b_proj, c_proj)
        else:
            classification = CLASS_AMBIGUOUS
            change_classes = []

        class_counts[classification] += 1
        for cc in change_classes:
            change_subtype_counts[cc] += 1

        row = {
            "schema_version": COMPARISON_SCHEMA_VERSION,
            "classification": classification,
            "change_classes": change_classes,
            "match_method": pair.match_method,
            "identity_confidence": pair.identity_confidence,
            "identity_rule_id": IDENTITY_RULE_ID,
            "baseline": None
            if b is None
            else {
                "ir_id": b.ir_id,
                "url_canonical": b.url_canonical,
                "source_record_id": b.source_record_id,
                "headword_latin": b.headword_latin,
            },
            "current": None
            if c is None
            else {
                "ir_id": c.ir_id,
                "url_canonical": c.url_canonical,
                "source_record_id": c.source_record_id,
                "headword_latin": c.headword_latin,
            },
            "baseline_semantic_sha256": None
            if b is None
            else hashlib.sha256(
                canonical_dumps(semantic_projection(b.record)).encode("utf-8")
            ).hexdigest(),
            "current_semantic_sha256": None
            if c is None
            else hashlib.sha256(
                canonical_dumps(semantic_projection(c.record)).encode("utf-8")
            ).hexdigest(),
        }
        delta_rows.append(row)

    # NEW analysis descriptors (source delta only)
    new_rows = [
        r
        for r in delta_rows
        if r["classification"] == CLASS_NEW and r.get("current") is not None
    ]
    new_headwords = sorted(
        {
            r["current"]["headword_latin"]
            for r in new_rows
            if r["current"].get("headword_latin")
        }
    )
    # Homonym structure among new descriptive headwords
    hw_to_ids: dict[str, list[str]] = defaultdict(list)
    for r in new_rows:
        hw = r["current"].get("headword_latin")
        sid = r["current"].get("source_record_id")
        if hw and sid:
            hw_to_ids[hw].append(sid)
    duplicate_new_headwords = sorted(hw for hw, ids in hw_to_ids.items() if len(ids) > 1)

    # Script / field availability from current records referenced as NEW
    new_ir_ids = {r["current"]["ir_id"] for r in new_rows}
    new_full = [r for r in current_records if r.get("ir_id") in new_ir_ids]

    def _field_stats(recs: list[dict[str, Any]]) -> dict[str, int]:
        nko = 0
        gloss = 0
        example = 0
        for rec in recs:
            fields = rec.get("fields_raw") or {}
            if fields.get("headword_nko_provided"):
                nko += 1
            senses = fields.get("senses") or []
            if any(s.get("gloss_fr") or s.get("gloss_en") or s.get("gloss_ru") for s in senses):
                gloss += 1
            if any(s.get("examples") for s in senses):
                example += 1
        return {
            "records": len(recs),
            "with_nko": nko,
            "with_gloss": gloss,
            "with_example": example,
        }

    fragment = {
        "classification_counts": dict(sorted(class_counts.items())),
        "change_subtype_counts": dict(sorted(change_subtype_counts.items())),
        "match_method_counts": dict(sorted(match_method_counts.items())),
        "identity_confidence_counts": dict(sorted(confidence_counts.items())),
        "new_analysis": {
            "record_count": len(new_rows),
            "unique_descriptive_headword_count": len(new_headwords),
            "duplicate_headword_count": len(duplicate_new_headwords),
            "field_availability": _field_stats(new_full),
            # samples filled by caller if desired
            "sample_headwords_first_n": new_headwords[:25],
        },
        "semantic_compare_enabled": semantic_enabled,
    }
    return delta_rows, fragment


def run_version_delta(
    *,
    baseline_ir_path: Path,
    current_crawl_dir: Path,
    output_dir: Path,
    sample_n: int = 15,
) -> dict[str, Any]:
    """
    End-to-end non-mutating version delta.

    Writes gitignored comparison artifacts under output_dir.
    Never modifies baseline_ir_path or canonical snapshot trees.
    """
    baseline_records = load_jsonl_records(baseline_ir_path)
    baseline_sha = sha256_file(baseline_ir_path)

    current_records, parse_stats = parse_lexicon_crawl_to_records(current_crawl_dir)

    compat = assess_parser_compatibility(
        baseline_records,
        current_records,
        nested_lxp2_pages=int(parse_stats.get("nested_lxp2_pages") or 0),
        pages_checked=int(parse_stats.get("pages_checked") or 0),
    )

    decision = (
        "CORPUS1F11_MALIDABA_DELTA_STILL_BLOCKED"
        if compat.status == "FAIL"
        else "CORPUS1F11_MALIDABA_PARSER_COMPATIBILITY_RESTORED"
    )

    current_ir_path = output_dir / "malidaba_current_ir.jsonl"
    current_ir_sha = write_jsonl(current_ir_path, current_records)

    delta_rows, fragment = compare_lexicon_records(
        baseline_records,
        current_records,
        parser_compat_status=compat.status,
    )
    delta_path = output_dir / "malidaba_version_delta.jsonl"
    delta_sha = write_jsonl(delta_path, delta_rows)

    # Bounded human samples
    def _samples(classification: str) -> list[dict[str, Any]]:
        rows = [r for r in delta_rows if r["classification"] == classification]
        return rows[:sample_n]

    # Headword-level descriptive sets (exact string equality; no fuzzy matching)
    def _headwords(recs: list[dict[str, Any]]) -> set[str]:
        out: set[str] = set()
        for rec in recs:
            hw = (rec.get("fields_raw") or {}).get("headword_latin")
            if hw:
                out.add(hw)
        return out

    base_hw = _headwords(baseline_records)
    cur_hw = _headwords(current_records)
    current_absent_from_baseline = sorted(cur_hw - base_hw)
    baseline_absent_from_current = sorted(base_hw - cur_hw)

    def _records_for_headwords(
        recs: list[dict[str, Any]], headwords: set[str]
    ) -> int:
        n = 0
        for rec in recs:
            hw = (rec.get("fields_raw") or {}).get("headword_latin")
            if hw in headwords:
                n += 1
        return n

    headword_descriptors = {
        "baseline_unique_headwords": len(base_hw),
        "current_unique_headwords": len(cur_hw),
        "current_headwords_absent_from_baseline": {
            "unique_headword_count": len(current_absent_from_baseline),
            "record_count": _records_for_headwords(
                current_records, set(current_absent_from_baseline)
            ),
            "sample_first_n": current_absent_from_baseline[:25],
        },
        "baseline_headwords_absent_from_current": {
            "unique_headword_count": len(baseline_absent_from_current),
            "record_count": _records_for_headwords(
                baseline_records, set(baseline_absent_from_current)
            ),
            "sample_first_n": baseline_absent_from_current[:25],
        },
    }

    def _sense_field_totals(recs: list[dict[str, Any]]) -> dict[str, int]:
        examples = 0
        idioms = 0
        nko = 0
        for rec in recs:
            fields = rec.get("fields_raw") or {}
            if fields.get("headword_nko_provided"):
                nko += 1
            for sense in fields.get("senses") or []:
                examples += len(sense.get("examples") or [])
                idioms += len(sense.get("sub_entries") or [])
        return {
            "records_with_nko_headword": nko,
            "example_count": examples,
            "idiom_subentry_count": idioms,
        }

    matched_for_lex = [
        r
        for r in delta_rows
        if r["identity_confidence"]
        in {"STRONG", "EXACT_CONTENT_SUPPORTED", "PROVISIONAL"}
        and r["classification"] in {CLASS_UNCHANGED, CLASS_CHANGED}
    ]
    nko_changed = sum(
        1 for r in matched_for_lex if "NKO_CHANGED" in r.get("change_classes", [])
    )
    example_changed = sum(
        1 for r in matched_for_lex if "EXAMPLE_CHANGED" in r.get("change_classes", [])
    )
    idiom_changed = sum(
        1 for r in matched_for_lex if "IDIOM_CHANGED" in r.get("change_classes", [])
    )

    nko_delta = {
        "baseline": _sense_field_totals(baseline_records),
        "current": _sense_field_totals(current_records),
        "matched_records_nko_changed": nko_changed,
        "matched_records_example_changed": example_changed,
        "matched_records_idiom_changed": idiom_changed,
    }

    summary = {
        "schema_version": COMPARISON_SCHEMA_VERSION,
        "decision": decision,
        "source_id": "src_malipense",
        "parser_version": PARSER_VERSION,
        "identity_rule_id": IDENTITY_RULE_ID,
        "identity_confidence_overall": "PARTIAL",
        "parser_compatibility": {
            "status": compat.status,
            "block_reason": compat.block_reason,
            "notes": compat.notes,
            "baseline_with_senses": compat.baseline_with_senses,
            "baseline_no_senses": compat.baseline_no_senses,
            "current_with_senses": compat.current_with_senses,
            "current_no_senses": compat.current_no_senses,
            "current_no_senses_ratio": compat.current_no_senses_ratio,
            "nested_lxp2_pages": compat.nested_lxp2_pages,
            "pages_checked": compat.pages_checked,
        },
        "parse_stats": parse_stats,
        "baseline_ir_path": str(baseline_ir_path),
        "baseline_record_count": len(baseline_records),
        "current_record_count": len(current_records),
        "hashes": {
            "baseline_ir_sha256": baseline_sha,
            "current_comparison_ir_sha256": current_ir_sha,
            "delta_sha256": delta_sha,
        },
        "classification_counts": fragment["classification_counts"],
        "change_subtype_counts": fragment["change_subtype_counts"],
        "match_method_counts": fragment["match_method_counts"],
        "identity_confidence_counts": fragment["identity_confidence_counts"],
        "new_analysis": fragment["new_analysis"],
        "headword_descriptors": headword_descriptors,
        "nko_delta": nko_delta,
        "samples": {
            "NEW_IN_CURRENT_SOURCE": _samples(CLASS_NEW),
            "MISSING_FROM_CURRENT_SOURCE": _samples(CLASS_MISSING),
            "CHANGED_EXISTING_RECORD": _samples(CLASS_CHANGED),
            "UNCHANGED": _samples(CLASS_UNCHANGED),
            "IDENTITY_AMBIGUOUS": _samples(CLASS_AMBIGUOUS),
            "SEMANTIC_COMPARE_BLOCKED": _samples(CLASS_BLOCKED_SEMANTIC),
        },
        "semantic_compare_enabled": fragment["semantic_compare_enabled"],
        "output_paths": {
            "current_ir": str(current_ir_path),
            "delta": str(delta_path),
            "summary": str(output_dir / "malidaba_version_delta_summary.json"),
        },
        "rights_posture": {
            "claimed_license": "CC BY-NC-SA 4.0",
            "operation": "internal_source_maintenance_evidence",
            "publication_authorization": False,
            "bundle_promotion": False,
        },
        "non_mutation": {
            "canonical_ir_mutated": False,
            "canonical_snapshots_mutated": False,
            "bundles_mutated": False,
        },
    }

    strong = fragment["identity_confidence_counts"].get("STRONG", 0)
    exact = fragment["identity_confidence_counts"].get("EXACT_CONTENT_SUPPORTED", 0)
    provisional = fragment["identity_confidence_counts"].get("PROVISIONAL", 0)
    ambiguous = fragment["identity_confidence_counts"].get("AMBIGUOUS", 0)
    if (
        strong
        and not provisional
        and not exact
        and not ambiguous
        and compat.status == "PASS"
    ):
        summary["identity_confidence_overall"] = "STRONG"
    elif compat.status == "FAIL":
        summary["identity_confidence_overall"] = "BLOCKED"
    else:
        summary["identity_confidence_overall"] = "PARTIAL"

    if (
        compat.status == "PASS"
        and fragment["semantic_compare_enabled"]
        and fragment["classification_counts"].get(CLASS_BLOCKED_SEMANTIC, 0) == 0
    ):
        summary["human_review_readiness"] = "MALIDABA_DELTA_HUMAN_REVIEW_READY"
    else:
        summary["human_review_readiness"] = "NOT_READY"

    summary_path = output_dir / "malidaba_version_delta_summary.json"
    write_json(summary_path, summary)
    return summary
