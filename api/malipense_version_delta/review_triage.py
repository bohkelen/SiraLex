"""Generate deterministic Malidaba delta review queues from frozen F11 artifacts."""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .batch_selection import select_batch_records
from .canonical_json import sha256_file, write_json, write_jsonl
from .compare import load_jsonl_records
from .frozen_inputs import FrozenInputs, verify_frozen_inputs
from .record_fingerprint import current_record_fingerprint_sha256
from .review_descriptors import build_queue_row, headword_group_id
from .source_section import (
    CLASS_BASE_LEXICAL,
    CLASS_TOPONYM,
    classify_current_record,
    build_entry_ps_index,
)

QUEUE_NEW_HEADWORD = "NEW_HEADWORD_EVIDENCE"
QUEUE_NEW_EXISTING_HW = "NEW_RECORD_EXISTING_HEADWORD"
QUEUE_CHANGED = "CHANGED_MATCHED_RECORD"
QUEUE_MISSING = "MISSING_SOURCE_EVIDENCE"
QUEUE_AMBIGUOUS = "IDENTITY_AMBIGUOUS"

CLASS_NEW = "NEW_IN_CURRENT_SOURCE"
CLASS_MISSING = "MISSING_FROM_CURRENT_SOURCE"
CLASS_CHANGED = "CHANGED_EXISTING_RECORD"
CLASS_AMBIGUOUS = "IDENTITY_AMBIGUOUS"


@dataclass
class TriageResult:
    decision: str
    summary: dict[str, Any]
    queues: dict[str, list[dict[str, Any]]]
    batch_rows: list[dict[str, Any]]
    batch_meta: dict[str, Any]


def _baseline_headwords(baseline_records: list[dict[str, Any]]) -> set[str]:
    out: set[str] = set()
    for record in baseline_records:
        hw = (record.get("fields_raw") or {}).get("headword_latin")
        if hw:
            out.add(hw)
    return out


def _index_by_ir_id(records: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {str(r.get("ir_id")): r for r in records if r.get("ir_id")}


def _headword_group_sizes(rows: list[dict[str, Any]]) -> dict[str, int]:
    counts: Counter[str] = Counter()
    for row in rows:
        gid = headword_group_id(
            row.get("headword_latin"),
            str(row.get("url_canonical") or ""),
        )
        counts[gid] += 1
    return dict(counts)


def _queue_sort_key(row: dict[str, Any]) -> tuple:
    return (
        row.get("url_canonical") or "",
        row.get("source_record_id") or "",
        row.get("headword_latin") or "",
        row.get("review_subject_id") or "",
    )


def build_triage_in_memory(
    *,
    baseline_ir_path: Path,
    current_ir_path: Path,
    delta_path: Path,
    crawl_dir: Path,
    batch_target: int = 100,
    verify_hashes: bool = True,
) -> TriageResult:
    """Build review queues in memory without writing manifest files."""
    if verify_hashes:
        frozen = verify_frozen_inputs(
            baseline_ir_path=baseline_ir_path,
            current_ir_path=current_ir_path,
            delta_path=delta_path,
            crawl_dir=crawl_dir,
        )
    else:
        frozen = FrozenInputs(
            baseline_ir_path=baseline_ir_path,
            current_ir_path=current_ir_path,
            delta_path=delta_path,
            crawl_dir=crawl_dir,
            baseline_ir_sha256=sha256_file(baseline_ir_path),
            current_ir_sha256=sha256_file(current_ir_path),
            delta_sha256=sha256_file(delta_path),
        )

    baseline_records = load_jsonl_records(frozen.baseline_ir_path)
    current_records = load_jsonl_records(frozen.current_ir_path)
    delta_rows = load_jsonl_records(frozen.delta_path)

    baseline_hw = _baseline_headwords(baseline_records)
    current_by_id = _index_by_ir_id(current_records)
    baseline_by_id = _index_by_ir_id(baseline_records)
    ps_index = build_entry_ps_index(frozen.crawl_dir)

    queues: dict[str, list[dict[str, Any]]] = {
        QUEUE_NEW_HEADWORD: [],
        QUEUE_NEW_EXISTING_HW: [],
        QUEUE_CHANGED: [],
        QUEUE_MISSING: [],
        QUEUE_AMBIGUOUS: [],
    }

    for delta in delta_rows:
        classification = delta.get("classification")
        current_side = delta.get("current") or {}
        baseline_side = delta.get("baseline") or {}
        current_ir_id = current_side.get("ir_id")
        baseline_ir_id = baseline_side.get("ir_id")

        current_record = current_by_id.get(current_ir_id) if current_ir_id else None
        baseline_record = baseline_by_id.get(baseline_ir_id) if baseline_ir_id else None

        review_subject_id = current_ir_id or baseline_ir_id or ""
        source_section = (
            classify_current_record(current_record, ps_index) if current_record else None
        )
        fingerprint = (
            current_record_fingerprint_sha256(current_record) if current_record else None
        )

        hw = current_side.get("headword_latin") or baseline_side.get("headword_latin")
        gid = headword_group_id(hw, str(current_side.get("url_canonical") or baseline_side.get("url_canonical") or ""))

        row = build_queue_row(
            delta_row=delta,
            current_record=current_record,
            baseline_record=baseline_record,
            source_section=source_section,
            review_subject_id=review_subject_id,
            headword_group_size=1,  # filled after grouping
            current_fingerprint=fingerprint,
        )

        if classification == CLASS_AMBIGUOUS:
            queues[QUEUE_AMBIGUOUS].append(row)
        elif classification == CLASS_MISSING:
            queues[QUEUE_MISSING].append(row)
        elif classification == CLASS_CHANGED:
            queues[QUEUE_CHANGED].append(row)
        elif classification == CLASS_NEW:
            if hw and hw not in baseline_hw:
                queues[QUEUE_NEW_HEADWORD].append(row)
            else:
                queues[QUEUE_NEW_EXISTING_HW].append(row)

    # Fill headword_group_size per queue
    for qname, rows in queues.items():
        sizes = _headword_group_sizes(rows)
        for row in rows:
            row["headword_group_size"] = sizes.get(row["headword_group_id"], 1)
        rows.sort(key=_queue_sort_key)

    # Batch eligibility: Queue A + explicit BASE_LEXICAL + has_sense only.
    # UNKNOWN and onomastic classes never enter Batch 001.
    eligible = [
        r
        for r in queues[QUEUE_NEW_HEADWORD]
        if r.get("source_section_class") == CLASS_BASE_LEXICAL
        and (r.get("reviewability") or {}).get("has_sense")
    ]

    batch_rows, batch_meta = select_batch_records(eligible, target_size=batch_target)

    section_counts: Counter[str] = Counter()
    for row in queues[QUEUE_NEW_HEADWORD]:
        section_counts[row.get("source_section_class") or "UNKNOWN_SOURCE_SECTION"] += 1

    summary = {
        "schema_version": "malidaba_triage_summary_v1",
        "decision": "CORPUS1F12_HUMAN_REVIEW_GATE_READY",
        "frozen_inputs": {
            "baseline_ir_sha256": frozen.baseline_ir_sha256,
            "current_ir_sha256": frozen.current_ir_sha256,
            "delta_sha256": frozen.delta_sha256,
        },
        "source_section_classification": {
            "confidence": "PARTIAL",
            "rule_id": "malipense_source_section_ps_v2",
            "note": (
                "Source-record classification from lxP2 span.PS metadata (not physical "
                "HTML section boundaries). Positive BASE_LEXICAL requires observed ordinary "
                "POS first-token evidence. Missing/empty PS → UNKNOWN_SOURCE_SECTION. "
                "Unrecognized n prop ... → UNKNOWN. SURNAME not used without explicit marker."
            ),
        },
        "queue_counts": {name: len(rows) for name, rows in queues.items()},
        "queue_a_source_section_breakdown": dict(sorted(section_counts.items())),
        "queue_a_unique_headwords": len(
            {r.get("headword_latin") for r in queues[QUEUE_NEW_HEADWORD] if r.get("headword_latin")}
        ),
        "batch_001": batch_meta,
    }

    return TriageResult(
        decision=summary["decision"],
        summary=summary,
        queues=queues,
        batch_rows=batch_rows,
        batch_meta=batch_meta,
    )


def generate_review_queues(
    *,
    baseline_ir_path: Path,
    current_ir_path: Path,
    delta_path: Path,
    crawl_dir: Path,
    output_dir: Path,
    batch_target: int = 100,
    verify_hashes: bool = True,
) -> TriageResult:
    """Build review queue manifests and batch 001 worksheet inputs."""
    triage = build_triage_in_memory(
        baseline_ir_path=baseline_ir_path,
        current_ir_path=current_ir_path,
        delta_path=delta_path,
        crawl_dir=crawl_dir,
        batch_target=batch_target,
        verify_hashes=verify_hashes,
    )

    summary = dict(triage.summary)
    summary["generated_at_utc"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    summary["output_paths"] = {}

    review_dir = output_dir / "review"
    review_dir.mkdir(parents=True, exist_ok=True)

    queue_files = {
        "new_headword_evidence.jsonl": triage.queues[QUEUE_NEW_HEADWORD],
        "new_record_existing_headword.jsonl": triage.queues[QUEUE_NEW_EXISTING_HW],
        "changed_matched_records.jsonl": triage.queues[QUEUE_CHANGED],
        "missing_source_evidence.jsonl": triage.queues[QUEUE_MISSING],
        "identity_ambiguous.jsonl": triage.queues[QUEUE_AMBIGUOUS],
    }
    output_hashes: dict[str, str] = {}
    for filename, rows in queue_files.items():
        path = review_dir / filename
        output_hashes[filename] = write_jsonl(path, rows)
        summary["output_paths"][filename] = str(path)

    summary_path = review_dir / "triage_summary.json"
    write_json(summary_path, {k: v for k, v in summary.items() if k != "generated_at_utc"})
    receipt_path = review_dir / "triage_receipt.json"
    write_json(receipt_path, summary)

    summary["output_paths"]["triage_summary.json"] = str(summary_path)
    summary["output_paths"]["triage_receipt.json"] = str(receipt_path)
    summary["queue_output_hashes"] = output_hashes

    return TriageResult(
        decision=summary["decision"],
        summary=summary,
        queues=triage.queues,
        batch_rows=triage.batch_rows,
        batch_meta=triage.batch_meta,
    )
