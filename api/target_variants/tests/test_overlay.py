"""Tests for reviewed target-variant overlay tables and normalizer integration."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "shared"))
sys.path.insert(0, str(REPO_ROOT / "api"))

from ir.lexical_review import LexicalReviewValidationError, LexiconVariantRegistry  # noqa: E402
from normalization.norm_v3 import normalize_nfc  # noqa: E402
from normalizer.normalize import normalize_lexicon_entry, process_ir_files  # noqa: E402
from target_variants.overlay import (  # noqa: E402
    TargetVariantOverlayError,
    load_reviewed_target_variant_overlay,
    validate_overlay_against_ir,
)

TRACKED_OVERLAY_PATH = REPO_ROOT / "shared/target_variants/reviewed_target_variants_v1.jsonl"
SYNTHETIC_CANONICAL_IR_ID = "aaaa000000000001"
OTHER_LEXICON_IR_ID = "aaaa000000000002"
INDEX_IR_ID = "bbbb000000000001"
OWNER_LEXICON_IR_ID = "cccc000000000001"
NON_MALIPENSE_LEXICON_IR_ID = "dddd000000000001"


def overlay_row(
    *,
    variant_id: str = "rtv_test_0001",
    status: str = "approved",
    canonical_ir_id: str = SYNTHETIC_CANONICAL_IR_ID,
    form: str = "synthvariant",
    review_document: str = "docs/reviews/phase7n2a_ndandayoro_lexical_review.md",
    reviewer: str = "overlay test reviewer",
    reviewed_at: str = "2026-07-05",
    rationale: str = "synthetic approved target-side variant",
    schema_version: str = "reviewed_target_variant_table_v1",
    source_norm_version: str = "norm_v3",
    target_variant_table_version: str = "phase7n2a4c1-test",
    target_script: str = "latin",
) -> dict:
    return {
        "schema_version": schema_version,
        "target_variant_table_version": target_variant_table_version,
        "variant_id": variant_id,
        "status": status,
        "canonical_ir_id": canonical_ir_id,
        "form": form,
        "target_script": target_script,
        "review_document": review_document,
        "reviewer": reviewer,
        "reviewed_at": reviewed_at,
        "rationale": rationale,
        "source_norm_version": source_norm_version,
    }


def synthetic_lexicon_ir(
    *,
    ir_id: str = SYNTHETIC_CANONICAL_IR_ID,
    headword_latin: str = "synthcanonical",
    anchor_names: list[str] | None = None,
) -> dict:
    if anchor_names is None:
        anchor_names = [headword_latin, "synthalt"]
    return {
        "ir_id": ir_id,
        "ir_kind": "lexicon_entry",
        "source_id": "src_malipense",
        "parser_version": "malipense_lexicon_v1",
        "evidence": [
            {
                "source_id": "src_malipense",
                "snapshot_id": "20f263ef15dc6ae1",
                "entry_block": {
                    "start_selector": f"span#{ir_id}",
                    "end_selector": f"span#{ir_id}-next",
                },
                "text_quote": headword_latin,
            }
        ],
        "record_locator": {
            "kind": "source_record_id",
            "url_canonical": "https://www.mali-pense.net/emk/lexicon/s.htm",
            "source_record_id": f"e-{ir_id[:8]}",
            "anchor_names": anchor_names,
        },
        "fields_raw": {
            "headword_latin": headword_latin,
            "senses": [{"gloss_en": "synthetic"}],
        },
    }


def synthetic_lexicon_ir_with_source(
    *,
    ir_id: str,
    source_id: str,
    headword_latin: str,
) -> dict:
    return {
        "ir_id": ir_id,
        "ir_kind": "lexicon_entry",
        "source_id": source_id,
        "parser_version": "synthetic_lexicon_v1",
        "evidence": [
            {
                "source_id": source_id,
                "snapshot_id": "synthetic",
                "entry_block": {
                    "start_selector": f"span#{ir_id}",
                    "end_selector": f"span#{ir_id}-next",
                },
                "text_quote": headword_latin,
            }
        ],
        "record_locator": {
            "kind": "source_record_id",
            "url_canonical": f"https://example.invalid/{ir_id}",
            "source_record_id": f"e-{ir_id[:8]}",
            "anchor_names": [headword_latin],
        },
        "fields_raw": {
            "headword_latin": headword_latin,
            "senses": [{"gloss_en": "synthetic"}],
        },
    }


def synthetic_index_ir(ir_id: str = INDEX_IR_ID) -> dict:
    return {
        "ir_id": ir_id,
        "ir_kind": "index_mapping",
        "source_id": "src_malipense",
        "parser_version": "malipense_index_v1",
        "evidence": [
            {
                "source_id": "src_malipense",
                "snapshot_id": "20f263ef15dc6ae1",
                "css_selector": "p.idx",
                "text_quote": "synthetic",
            }
        ],
        "record_locator": {
            "kind": "url_canonical+entry_index",
            "url_canonical": "https://www.mali-pense.net/emk/index/s.htm",
            "entry_index": 1,
        },
        "fields_raw": {"source_term": "synthetic"},
    }


def write_jsonl(path: Path, rows: list[dict]) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")
    return path


def write_overlay(path: Path, rows: list[dict]) -> Path:
    return write_jsonl(path, rows)


def assert_target_resolution_error(exc: TargetVariantOverlayError, canonical_ir_id: str) -> None:
    message = str(exc)
    assert "line 1" in message
    assert canonical_ir_id in message
    assert "resolved" in message


def registry_for(*ir_units: dict) -> LexiconVariantRegistry:
    registry = LexiconVariantRegistry()
    for ir_unit in ir_units:
        registry.register_source_attested(ir_unit)
    return registry


def test_tracked_overlay_contains_approved_mobaa_row():
    overlay = load_reviewed_target_variant_overlay(TRACKED_OVERLAY_PATH)
    assert overlay.row_count == 1
    assert overlay.approved_row_count == 1

    row = overlay.rows[0].row
    assert row["variant_id"] == "rtv_phase7n2a_0001"
    assert row["canonical_ir_id"] == "c5f78c8ac66eac6b"
    assert row["form"] == "móbaa"
    assert normalize_nfc(row["form"]) == "móbaa"
    assert row["target_script"] == "latin"
    assert row["review_document"] == "docs/PHASE_7K1_STRUCTURED_USABILITY_TRIAGE.md"
    assert row["source_norm_version"] == "norm_v3"


def test_normalization_without_overlay_flag_does_not_load_overlay(tmp_path: Path):
    ir_path = write_jsonl(tmp_path / "lexicon.jsonl", [synthetic_lexicon_ir()])
    out_path = tmp_path / "raw.jsonl"
    stats = process_ir_files([ir_path], out_path)
    assert stats["errors"] == 0
    assert stats["target_variant_overlay_path"] is None
    assert stats["target_variant_overlay_row_count"] == 0


def test_normalization_with_explicit_empty_overlay_matches_raw(tmp_path: Path):
    ir_path = write_jsonl(tmp_path / "lexicon.jsonl", [synthetic_lexicon_ir()])
    empty_overlay_path = tmp_path / "empty_overlay.jsonl"
    empty_overlay_path.write_text("", encoding="utf-8")
    raw_out = tmp_path / "raw.jsonl"
    overlay_out = tmp_path / "overlay.jsonl"
    raw_stats = process_ir_files([ir_path], raw_out)
    overlay_stats = process_ir_files(
        [ir_path],
        overlay_out,
        target_variant_overlay=empty_overlay_path,
    )
    assert raw_stats["errors"] == 0
    assert overlay_stats["errors"] == 0
    assert raw_out.read_text(encoding="utf-8") == overlay_out.read_text(encoding="utf-8")


def test_missing_overlay_path_fails_clearly(tmp_path: Path):
    ir_path = write_jsonl(tmp_path / "lexicon.jsonl", [synthetic_lexicon_ir()])
    missing = tmp_path / "missing_overlay.jsonl"
    stats = process_ir_files(
        [ir_path],
        tmp_path / "out.jsonl",
        target_variant_overlay=missing,
    )
    assert stats["errors"] == 1


def test_unknown_overlay_schema_version_fails(tmp_path: Path):
    overlay_path = write_overlay(
        tmp_path / "bad_schema.jsonl",
        [overlay_row(schema_version="reviewed_target_variant_table_v9")],
    )
    with pytest.raises(TargetVariantOverlayError, match="schema_version"):
        load_reviewed_target_variant_overlay(overlay_path)


def test_invalid_canonical_ir_id_format_fails(tmp_path: Path):
    overlay_path = write_overlay(
        tmp_path / "bad_ir_id.jsonl",
        [overlay_row(canonical_ir_id="not-a-valid-ir-id")],
    )
    with pytest.raises(TargetVariantOverlayError, match="canonical_ir_id"):
        load_reviewed_target_variant_overlay(overlay_path)


def test_valid_iso_date_passes(tmp_path: Path):
    overlay_path = write_overlay(
        tmp_path / "iso_date.jsonl",
        [overlay_row(reviewed_at="2026-07-05")],
    )
    overlay = load_reviewed_target_variant_overlay(overlay_path)
    assert overlay.row_count == 1


def test_valid_iso_utc_datetime_passes(tmp_path: Path):
    overlay_path = write_overlay(
        tmp_path / "iso_datetime.jsonl",
        [overlay_row(reviewed_at="2026-07-05T14:04:34Z")],
    )
    overlay = load_reviewed_target_variant_overlay(overlay_path)
    assert overlay.row_count == 1


@pytest.mark.parametrize("reviewed_at", ["later", "2026/07/05", "July 5 2026"])
def test_malformed_reviewed_at_fails(tmp_path: Path, reviewed_at: str):
    overlay_path = write_overlay(
        tmp_path / "bad_reviewed_at.jsonl",
        [overlay_row(reviewed_at=reviewed_at)],
    )
    with pytest.raises(TargetVariantOverlayError, match="reviewed_at must be an ISO-8601"):
        load_reviewed_target_variant_overlay(overlay_path)


def test_duplicate_variant_id_fails(tmp_path: Path):
    row = overlay_row()
    overlay_path = write_overlay(tmp_path / "dup_id.jsonl", [row, row])
    with pytest.raises(TargetVariantOverlayError, match="duplicate variant_id"):
        load_reviewed_target_variant_overlay(overlay_path)


def test_nfc_equivalent_duplicate_approved_forms_fail(tmp_path: Path):
    overlay_path = write_overlay(
        tmp_path / "dup_form.jsonl",
        [
            overlay_row(variant_id="rtv_test_0001", form="synthvariant"),
            overlay_row(variant_id="rtv_test_0002", form="synthvariant"),
        ],
    )
    with pytest.raises(TargetVariantOverlayError, match="duplicate approved form"):
        load_reviewed_target_variant_overlay(overlay_path)


def test_pending_and_rejected_rows_are_not_applied(tmp_path: Path):
    overlay_path = write_overlay(
        tmp_path / "mixed_status.jsonl",
        [
            overlay_row(status="pending", variant_id="rtv_test_pending"),
            overlay_row(status="rejected", variant_id="rtv_test_rejected"),
        ],
    )
    overlay = load_reviewed_target_variant_overlay(overlay_path)
    assert overlay.approved_row_count == 0
    ir_path = write_jsonl(tmp_path / "lexicon.jsonl", [synthetic_lexicon_ir()])
    stats = process_ir_files(
        [ir_path],
        tmp_path / "out.jsonl",
        target_variant_overlay=overlay_path,
    )
    assert stats["errors"] == 0
    record = json.loads((tmp_path / "out.jsonl").read_text(encoding="utf-8").strip())
    assert record["variant_forms"] == ["synthcanonical", "synthalt"]


def test_overlay_row_targeting_missing_canonical_record_fails(tmp_path: Path):
    overlay_path = write_overlay(tmp_path / "orphan.jsonl", [overlay_row()])
    overlay = load_reviewed_target_variant_overlay(overlay_path)
    with pytest.raises(TargetVariantOverlayError) as exc_info:
        validate_overlay_against_ir(overlay, [])
    assert_target_resolution_error(exc_info.value, SYNTHETIC_CANONICAL_IR_ID)


def test_overlay_row_targeting_non_lexicon_record_fails(tmp_path: Path):
    overlay_path = write_overlay(
        tmp_path / "index_target.jsonl",
        [overlay_row(canonical_ir_id=INDEX_IR_ID)],
    )
    overlay = load_reviewed_target_variant_overlay(overlay_path)
    with pytest.raises(TargetVariantOverlayError) as exc_info:
        validate_overlay_against_ir(overlay, [synthetic_index_ir()])
    assert_target_resolution_error(exc_info.value, INDEX_IR_ID)


def test_overlay_row_targeting_owner_lexicon_entry_fails(tmp_path: Path):
    overlay_path = write_overlay(
        tmp_path / "owner_target.jsonl",
        [overlay_row(canonical_ir_id=OWNER_LEXICON_IR_ID)],
    )
    overlay = load_reviewed_target_variant_overlay(overlay_path)
    owner_row = synthetic_lexicon_ir_with_source(
        ir_id=OWNER_LEXICON_IR_ID,
        source_id="src_siralex_lexical_review",
        headword_latin="ownerheadword",
    )
    with pytest.raises(TargetVariantOverlayError) as exc_info:
        validate_overlay_against_ir(overlay, [owner_row])
    assert_target_resolution_error(exc_info.value, OWNER_LEXICON_IR_ID)


def test_overlay_row_targeting_non_malipense_lexicon_source_fails(tmp_path: Path):
    overlay_path = write_overlay(
        tmp_path / "other_source_target.jsonl",
        [overlay_row(canonical_ir_id=NON_MALIPENSE_LEXICON_IR_ID)],
    )
    overlay = load_reviewed_target_variant_overlay(overlay_path)
    other_row = synthetic_lexicon_ir_with_source(
        ir_id=NON_MALIPENSE_LEXICON_IR_ID,
        source_id="src_other_lexicon",
        headword_latin="otherheadword",
    )
    with pytest.raises(TargetVariantOverlayError) as exc_info:
        validate_overlay_against_ir(overlay, [other_row])
    assert_target_resolution_error(exc_info.value, NON_MALIPENSE_LEXICON_IR_ID)


def test_single_frozen_malipense_lexicon_target_passes(tmp_path: Path):
    overlay_path = write_overlay(
        tmp_path / "single_malipense_target.jsonl",
        [overlay_row(canonical_ir_id=SYNTHETIC_CANONICAL_IR_ID)],
    )
    overlay = load_reviewed_target_variant_overlay(overlay_path)
    validate_overlay_against_ir(overlay, [synthetic_lexicon_ir(ir_id=SYNTHETIC_CANONICAL_IR_ID)])


def test_duplicate_frozen_malipense_ids_fail(tmp_path: Path):
    overlay_path = write_overlay(
        tmp_path / "duplicate_malipense_ids.jsonl",
        [overlay_row(canonical_ir_id=SYNTHETIC_CANONICAL_IR_ID)],
    )
    overlay = load_reviewed_target_variant_overlay(overlay_path)
    ir_rows = [
        synthetic_lexicon_ir(ir_id=SYNTHETIC_CANONICAL_IR_ID, headword_latin="alpha"),
        synthetic_lexicon_ir(ir_id=SYNTHETIC_CANONICAL_IR_ID, headword_latin="beta"),
    ]
    with pytest.raises(TargetVariantOverlayError) as exc_info:
        validate_overlay_against_ir(overlay, ir_rows)
    assert_target_resolution_error(exc_info.value, SYNTHETIC_CANONICAL_IR_ID)


def test_malipense_plus_index_same_id_fails(tmp_path: Path):
    overlay_path = write_overlay(
        tmp_path / "malipense_plus_index.jsonl",
        [overlay_row(canonical_ir_id=SYNTHETIC_CANONICAL_IR_ID)],
    )
    overlay = load_reviewed_target_variant_overlay(overlay_path)
    ir_rows = [
        synthetic_lexicon_ir(ir_id=SYNTHETIC_CANONICAL_IR_ID),
        synthetic_index_ir(ir_id=SYNTHETIC_CANONICAL_IR_ID),
    ]
    with pytest.raises(TargetVariantOverlayError) as exc_info:
        validate_overlay_against_ir(overlay, ir_rows)
    assert_target_resolution_error(exc_info.value, SYNTHETIC_CANONICAL_IR_ID)


def test_malipense_plus_owner_same_id_fails(tmp_path: Path):
    overlay_path = write_overlay(
        tmp_path / "malipense_plus_owner.jsonl",
        [overlay_row(canonical_ir_id=SYNTHETIC_CANONICAL_IR_ID)],
    )
    overlay = load_reviewed_target_variant_overlay(overlay_path)
    ir_rows = [
        synthetic_lexicon_ir(ir_id=SYNTHETIC_CANONICAL_IR_ID),
        synthetic_lexicon_ir_with_source(
            ir_id=SYNTHETIC_CANONICAL_IR_ID,
            source_id="src_siralex_lexical_review",
            headword_latin="ownerdup",
        ),
    ]
    with pytest.raises(TargetVariantOverlayError) as exc_info:
        validate_overlay_against_ir(overlay, ir_rows)
    assert_target_resolution_error(exc_info.value, SYNTHETIC_CANONICAL_IR_ID)


def test_malipense_plus_other_source_same_id_fails(tmp_path: Path):
    overlay_path = write_overlay(
        tmp_path / "malipense_plus_other_source.jsonl",
        [overlay_row(canonical_ir_id=SYNTHETIC_CANONICAL_IR_ID)],
    )
    overlay = load_reviewed_target_variant_overlay(overlay_path)
    ir_rows = [
        synthetic_lexicon_ir(ir_id=SYNTHETIC_CANONICAL_IR_ID),
        synthetic_lexicon_ir_with_source(
            ir_id=SYNTHETIC_CANONICAL_IR_ID,
            source_id="src_other_lexicon",
            headword_latin="otherdup",
        ),
    ]
    with pytest.raises(TargetVariantOverlayError) as exc_info:
        validate_overlay_against_ir(overlay, ir_rows)
    assert_target_resolution_error(exc_info.value, SYNTHETIC_CANONICAL_IR_ID)


def test_overlay_row_conflicting_with_canonical_headword_fails(tmp_path: Path):
    overlay_path = write_overlay(
        tmp_path / "headword_conflict.jsonl",
        [overlay_row(form="synthcanonical")],
    )
    ir_path = write_jsonl(tmp_path / "lexicon.jsonl", [synthetic_lexicon_ir()])
    stats = process_ir_files(
        [ir_path],
        tmp_path / "out.jsonl",
        target_variant_overlay=overlay_path,
    )
    assert stats["errors"] == 1


def test_overlay_row_conflicting_with_frozen_attested_latin_form_fails(tmp_path: Path):
    overlay_path = write_overlay(
        tmp_path / "attested_conflict.jsonl",
        [overlay_row(form="otherattested")],
    )
    ir_units = [
        synthetic_lexicon_ir(),
        synthetic_lexicon_ir(
            ir_id=OTHER_LEXICON_IR_ID,
            headword_latin="otherhead",
            anchor_names=["otherhead", "otherattested"],
        ),
    ]
    ir_path = write_jsonl(tmp_path / "lexicon.jsonl", ir_units)
    stats = process_ir_files(
        [ir_path],
        tmp_path / "out.jsonl",
        target_variant_overlay=overlay_path,
    )
    assert stats["errors"] == 1
    assert not (tmp_path / "out.jsonl").exists()


def test_overlay_row_conflicting_with_another_approved_overlay_form_fails(tmp_path: Path):
    overlay_path = write_overlay(
        tmp_path / "overlay_form_conflict.jsonl",
        [
            overlay_row(
                variant_id="rtv_test_0001",
                canonical_ir_id=SYNTHETIC_CANONICAL_IR_ID,
                form="sharedform",
            ),
            overlay_row(
                variant_id="rtv_test_0002",
                canonical_ir_id=OTHER_LEXICON_IR_ID,
                form="sharedform",
            ),
        ],
    )
    with pytest.raises(TargetVariantOverlayError, match="duplicate approved form"):
        load_reviewed_target_variant_overlay(overlay_path)


def test_valid_approved_overlay_adds_variant_without_mutating_source_fields(tmp_path: Path):
    source_ir = synthetic_lexicon_ir()
    source_snapshot = json.loads(json.dumps(source_ir))
    overlay_path = write_overlay(
        tmp_path / "approved.jsonl",
        [overlay_row(form="synthvariant")],
    )
    ir_path = write_jsonl(tmp_path / "lexicon.jsonl", [source_ir])
    out_path = tmp_path / "out.jsonl"
    stats = process_ir_files(
        [ir_path],
        out_path,
        target_variant_overlay=overlay_path,
    )
    assert stats["errors"] == 0
    assert stats["target_variant_overlay_applied_row_count"] == 1
    assert source_ir == source_snapshot
    record = json.loads(out_path.read_text(encoding="utf-8").strip())
    assert record["ir_id"] == SYNTHETIC_CANONICAL_IR_ID
    assert record["preferred_form"] == "synthcanonical"
    assert "synthvariant" in record["variant_forms"]
    assert "synthvariant" in record["search_keys"]["casefold"]
    assert "provenance" not in record
    assert "derivation" not in record


def test_overlay_collision_preserves_existing_destination_bytes(tmp_path: Path):
    existing_out = tmp_path / "existing.jsonl"
    original_bytes = b"keep-this-existing-output\n"
    existing_out.write_bytes(original_bytes)

    overlay_path = write_overlay(
        tmp_path / "headword_conflict.jsonl",
        [overlay_row(form="synthcanonical")],
    )
    ir_path = write_jsonl(tmp_path / "lexicon.jsonl", [synthetic_lexicon_ir()])
    stats = process_ir_files(
        [ir_path],
        existing_out,
        target_variant_overlay=overlay_path,
    )
    assert stats["errors"] == 1
    assert existing_out.read_bytes() == original_bytes


def test_cli_invalid_overlay_exits_non_zero_and_writes_no_output(tmp_path: Path):
    ir_path = write_jsonl(tmp_path / "lexicon.jsonl", [synthetic_lexicon_ir()])
    bad_overlay = write_overlay(
        tmp_path / "bad_overlay.jsonl",
        [overlay_row(reviewed_at="later")],
    )
    out_path = tmp_path / "cli_out.jsonl"

    completed = subprocess.run(
        [
            sys.executable,
            "-m",
            "normalizer.cli",
            "--input",
            str(ir_path),
            "--target-variant-overlay",
            str(bad_overlay),
            "--output",
            str(out_path),
        ],
        cwd=str(REPO_ROOT),
        env={**os.environ, "PYTHONPATH": "api:shared"},
        capture_output=True,
        text=True,
    )
    assert completed.returncode != 0
    assert not out_path.exists()


def test_existing_r1_r1a_guards_still_pass():
    holder = synthetic_lexicon_ir(headword_latin="móyibaa", anchor_names=["moyibaa"])
    registry = registry_for(holder)
    with pytest.raises(LexicalReviewValidationError, match="duplicates canonical headword_latin"):
        normalize_lexicon_entry(
            {
                **holder,
                "reviewed_target_variants": [
                    {
                        "form": "móyibaa",
                        "review_document": "docs/reviews/phase7n2a_ndandayoro_lexical_review.md",
                        "reviewer": "test",
                        "reviewed_at": "2026-07-05",
                        "rationale": "duplicate headword guard",
                    }
                ],
            },
            variant_registry=registry,
        )

    with pytest.raises(LexicalReviewValidationError, match="duplicate form"):
        normalize_lexicon_entry(
            {
                **holder,
                "reviewed_target_variants": [
                    {
                        "form": "extraform",
                        "review_document": "docs/reviews/phase7n2a_ndandayoro_lexical_review.md",
                        "reviewer": "test",
                        "reviewed_at": "2026-07-05",
                        "rationale": "first",
                    },
                    {
                        "form": "extraform",
                        "review_document": "docs/reviews/phase7n2a_ndandayoro_lexical_review.md",
                        "reviewer": "test",
                        "reviewed_at": "2026-07-05",
                        "rationale": "duplicate",
                    },
                ],
            },
            variant_registry=registry,
        )
