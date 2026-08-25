"""CORPUS1F3: translation-subject worksheet v3 + v2 compatibility."""

from __future__ import annotations

import csv
import io
import json
from pathlib import Path

import pytest

from corpus_annotations.validate_corpus_annotations import validate_corpus_annotations
from corpus_reviews.dry_run_import_reviews import dry_run_import_review_worksheet
from corpus_reviews.export_review_worksheet import (
    WORKSHEET_COLUMNS_V2,
    WORKSHEET_COLUMNS_V3,
    WORKSHEET_SCHEMA_V2,
    WORKSHEET_SCHEMA_V3,
    build_worksheet_rows,
    export_review_worksheet,
    worksheet_rows_to_csv,
)

REPO_ROOT = Path(__file__).resolve().parents[3]
FIXTURES = REPO_ROOT / "shared/corpus/fixtures"
PILOT = REPO_ROOT / "data/corpus1f"


def write_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")


def minimal_transcript(**overrides: object) -> dict:
    row: dict = {
        "schema_version": "corpus_annotations_v1",
        "annotation_id": "cann_src_raw_001",
        "segment_id": "cseg_fixture_time_001",
        "annotation_type": "transcript_raw",
        "content": "n'na",
        "content_language": "Maninka",
        "created_at": "2026-08-20T19:00:00Z",
        "creation_method": "manual_transcription",
        "created_by": "reviewer_example",
    }
    row.update(overrides)
    return row


def minimal_translation(
    *,
    annotation_id: str,
    content: str,
    language: str,
    derived_from: list[str],
    **overrides: object,
) -> dict:
    row: dict = {
        "schema_version": "corpus_annotations_v1",
        "annotation_id": annotation_id,
        "segment_id": "cseg_fixture_time_001",
        "annotation_type": "translation",
        "content": content,
        "content_language": language,
        "created_at": "2026-08-20T19:05:00Z",
        "creation_method": "import",
        "created_by": "slr106_vocab_import",
        "derived_from_annotation_ids": derived_from,
    }
    row.update(overrides)
    return row


def _pilot_paths() -> tuple[Path, Path, Path, Path, Path]:
    tables = PILOT / "tables"
    return (
        tables / "corpus_annotations_v1.jsonl",
        tables / "corpus_segments_v1.jsonl",
        tables / "corpus_source_artifacts_v1.jsonl",
        tables / "corpus_sources_v1.jsonl",
        tables / "corpus_annotation_reviews_v1.jsonl",
    )


def test_historical_v2_worksheet_still_accepted(tmp_path: Path):
    annotations = FIXTURES / "valid_manual_raw_transcript.jsonl"
    result = validate_corpus_annotations(annotations)
    rows = build_worksheet_rows(result.rows, worksheet_schema=WORKSHEET_SCHEMA_V2)
    assert rows[0]["worksheet_schema"] == WORKSHEET_SCHEMA_V2
    assert "source_transcript" not in rows[0]
    worksheet = tmp_path / "v2.csv"
    worksheet.write_text(
        worksheet_rows_to_csv(rows, worksheet_schema=WORKSHEET_SCHEMA_V2),
        encoding="utf-8",
    )
    header = worksheet.read_text(encoding="utf-8").splitlines()[0].split(",")
    assert header == WORKSHEET_COLUMNS_V2
    dry = dry_run_import_review_worksheet(worksheet, annotations)
    assert dry.summary["error_count"] == 0
    assert dry.summary["rows_skipped_unreviewed"] == 1
    assert dry.summary["worksheet_schema_v2"] == 1


def test_malformed_v2_still_fails(tmp_path: Path):
    annotations = FIXTURES / "valid_manual_raw_transcript.jsonl"
    result = validate_corpus_annotations(annotations)
    rows = build_worksheet_rows(result.rows, worksheet_schema=WORKSHEET_SCHEMA_V2)
    filled = dict(rows[0])
    filled["related_translation_english"] = "tampered"
    worksheet = tmp_path / "v2_bad.csv"
    worksheet.write_text(
        worksheet_rows_to_csv([filled], worksheet_schema=WORKSHEET_SCHEMA_V2),
        encoding="utf-8",
    )
    dry = dry_run_import_review_worksheet(worksheet, annotations)
    assert dry.summary["error_count"] >= 1
    assert any("FAIL STALE OR MODIFIED WORKSHEET CONTEXT" in err for err in dry.errors)


def test_valid_v3_transcript_and_translation_worksheets(tmp_path: Path):
    path = tmp_path / "ann.jsonl"
    write_jsonl(
        path,
        [
            minimal_transcript(),
            minimal_translation(
                annotation_id="cann_tr_en",
                content="Mom",
                language="English",
                derived_from=["cann_src_raw_001"],
            ),
            minimal_translation(
                annotation_id="cann_tr_fr",
                content="Maman",
                language="French",
                derived_from=["cann_src_raw_001"],
            ),
        ],
    )
    result = validate_corpus_annotations(path)
    transcript_rows = build_worksheet_rows(
        result.rows, annotation_type="transcript_raw", worksheet_schema=WORKSHEET_SCHEMA_V3
    )
    assert len(transcript_rows) == 1
    assert transcript_rows[0]["worksheet_schema"] == WORKSHEET_SCHEMA_V3
    assert transcript_rows[0]["source_transcript"] == ""
    assert transcript_rows[0]["related_translation_english"] == "Mom"
    assert transcript_rows[0]["related_translation_french"] == "Maman"

    translation_rows = build_worksheet_rows(
        result.rows, annotation_type="translation", worksheet_schema=WORKSHEET_SCHEMA_V3
    )
    assert len(translation_rows) == 2
    by_id = {row["annotation_id"]: row for row in translation_rows}
    en = by_id["cann_tr_en"]
    fr = by_id["cann_tr_fr"]
    assert en["source_transcript"] == "n'na"
    assert en["source_transcript_annotation_ids"] == "cann_src_raw_001"
    assert en["related_translation_english"] == ""
    assert en["related_translation_french"] == "Maman"
    assert fr["related_translation_english"] == "Mom"
    assert fr["related_translation_french"] == ""
    assert en["review_decision"] == ""
    assert fr["review_decision"] == ""


def test_multiple_parent_transcripts_deterministic(tmp_path: Path):
    path = tmp_path / "ann.jsonl"
    write_jsonl(
        path,
        [
            minimal_transcript(annotation_id="cann_src_b", content="later"),
            minimal_transcript(annotation_id="cann_src_a", content="earlier"),
            minimal_translation(
                annotation_id="cann_tr_en",
                content="Mom",
                language="English",
                derived_from=["cann_src_b", "cann_src_a"],
            ),
        ],
    )
    result = validate_corpus_annotations(path)
    rows = build_worksheet_rows(
        result.rows, annotation_type="translation", worksheet_schema=WORKSHEET_SCHEMA_V3
    )
    assert rows[0]["source_transcript_annotation_ids"] == "cann_src_a;cann_src_b"
    assert rows[0]["source_transcript"] == "earlier | later"


def test_competing_same_language_translation_leaves_remain_visible(tmp_path: Path):
    """All OTHER same-segment translation leaves stay visible, including same-language."""
    path = tmp_path / "ann.jsonl"
    write_jsonl(
        path,
        [
            minimal_transcript(),
            minimal_translation(
                annotation_id="cann_tr_en_a",
                content="Mom",
                language="English",
                derived_from=["cann_src_raw_001"],
            ),
            minimal_translation(
                annotation_id="cann_tr_en_c",
                content="Mother",
                language="English",
                derived_from=["cann_src_raw_001"],
            ),
            minimal_translation(
                annotation_id="cann_tr_en_b",
                content="Mama",
                language="English",
                derived_from=["cann_src_raw_001"],
            ),
            minimal_translation(
                annotation_id="cann_tr_fr_a",
                content="Maman",
                language="French",
                derived_from=["cann_src_raw_001"],
            ),
        ],
    )
    result = validate_corpus_annotations(path)
    rows = build_worksheet_rows(
        result.rows, annotation_type="translation", worksheet_schema=WORKSHEET_SCHEMA_V3
    )
    by_id = {row["annotation_id"]: row for row in rows}
    subject = by_id["cann_tr_en_a"]
    assert subject["source_transcript"] == "n'na"
    assert subject["source_transcript_annotation_ids"] == "cann_src_raw_001"
    # Competing English leaves remain visible; subject itself excluded; id order deterministic.
    assert subject["related_translation_english_annotation_ids"] == (
        "cann_tr_en_b;cann_tr_en_c"
    )
    assert subject["related_translation_english"] == "Mama | Mother"
    assert subject["related_translation_french"] == "Maman"
    assert subject["related_translation_french_annotation_ids"] == "cann_tr_fr_a"
    assert "Mom" not in subject["related_translation_english"].split(" | ")
    assert "cann_tr_en_a" not in subject["related_translation_english_annotation_ids"]
    assert "cann_tr_en_a" not in subject["related_translation_french_annotation_ids"]


def test_edited_source_and_sibling_context_fail(tmp_path: Path):
    path = tmp_path / "ann.jsonl"
    write_jsonl(
        path,
        [
            minimal_transcript(),
            minimal_translation(
                annotation_id="cann_tr_en",
                content="Mom",
                language="English",
                derived_from=["cann_src_raw_001"],
            ),
            minimal_translation(
                annotation_id="cann_tr_fr",
                content="Maman",
                language="French",
                derived_from=["cann_src_raw_001"],
            ),
        ],
    )
    result = validate_corpus_annotations(path)
    base = dict(
        build_worksheet_rows(
            result.rows, annotation_type="translation", worksheet_schema=WORKSHEET_SCHEMA_V3
        )[0]
    )

    for column, value in [
        ("source_transcript", "tampered"),
        ("source_transcript_annotation_ids", "cann_other"),
        ("related_translation_french", "tampered-fr"),
    ]:
        edited = dict(base)
        edited[column] = value
        worksheet = tmp_path / f"bad_{column}.csv"
        worksheet.write_text(
            worksheet_rows_to_csv([edited], worksheet_schema=WORKSHEET_SCHEMA_V3),
            encoding="utf-8",
        )
        dry = dry_run_import_review_worksheet(
            worksheet, path, annotation_type="translation"
        )
        assert any(
            "FAIL STALE OR MODIFIED WORKSHEET CONTEXT" in err and column in err
            for err in dry.errors
        ), (column, dry.errors)


def test_unsupported_worksheet_schema_fails(tmp_path: Path):
    annotations = FIXTURES / "valid_manual_raw_transcript.jsonl"
    result = validate_corpus_annotations(annotations)
    row = dict(build_worksheet_rows(result.rows, worksheet_schema=WORKSHEET_SCHEMA_V3)[0])
    row["worksheet_schema"] = "corpus_annotation_review_worksheet_v9"
    worksheet = tmp_path / "unsupported.csv"
    worksheet.write_text(
        worksheet_rows_to_csv([row], worksheet_schema=WORKSHEET_SCHEMA_V3),
        encoding="utf-8",
    )
    dry = dry_run_import_review_worksheet(worksheet, annotations)
    assert any("unsupported worksheet_schema" in err for err in dry.errors)


def test_translation_exporter_subject_is_translation_no_decision_inheritance(tmp_path: Path):
    path = tmp_path / "ann.jsonl"
    write_jsonl(
        path,
        [
            minimal_transcript(),
            minimal_translation(
                annotation_id="cann_tr_en",
                content="Mom",
                language="English",
                derived_from=["cann_src_raw_001"],
            ),
        ],
    )
    csv_text, summary = export_review_worksheet(path, annotation_type="translation")
    assert summary["worksheet_row_count"] == 1
    reader = csv.DictReader(io.StringIO(csv_text))
    assert list(reader.fieldnames) == WORKSHEET_COLUMNS_V3
    rows = list(reader)
    assert rows[0]["annotation_type"] == "translation"
    assert rows[0]["annotation_id"] == "cann_tr_en"
    assert rows[0]["review_decision"] == ""
    assert rows[0]["reviewer_id"] == ""
    assert rows[0]["source_transcript"] == "n'na"


@pytest.mark.skipif(not PILOT.exists(), reason="local CORPUS1F pilot data not present")
def test_pilot_translation_export_dry_run_skips_all_and_preserves_reviews(tmp_path: Path):
    """Blank translation export/dry-run must not mutate the existing local registry."""
    annotations, segments, artifacts, sources, reviews = _pilot_paths()
    assert reviews.exists()
    review_before = reviews.read_bytes()
    review_count_before = sum(
        1 for line in reviews.read_text(encoding="utf-8").splitlines() if line.strip()
    )
    assert review_count_before > 0
    annotations_before = annotations.read_bytes()

    csv_text, summary = export_review_worksheet(
        annotations,
        annotation_type="translation",
        segments_path=segments,
        artifacts_path=artifacts,
        sources_path=sources,
    )
    assert summary["worksheet_row_count"] == 48
    reader = csv.DictReader(io.StringIO(csv_text))
    rows = list(reader)
    assert len(rows) == 48
    assert all(row["worksheet_schema"] == WORKSHEET_SCHEMA_V3 for row in rows)
    assert all(row["annotation_type"] == "translation" for row in rows)
    assert all(row["review_decision"] == "" for row in rows)
    assert all(row["source_transcript"] for row in rows)
    assert all(row["artifact_storage_ref"] for row in rows)
    en = [row for row in rows if row["content_language"].lower() in {"english", "en"}]
    fr = [
        row
        for row in rows
        if row["content_language"].lower() in {"french", "fr", "français", "francais"}
    ]
    assert len(en) == 24
    assert len(fr) == 24

    out = tmp_path / "translation_review_worksheet.csv"
    out.write_text(csv_text, encoding="utf-8")
    dry = dry_run_import_review_worksheet(
        out,
        annotations,
        segments_path=segments,
        artifacts_path=artifacts,
        sources_path=sources,
        annotation_type="translation",
    )
    assert dry.summary["rows_read"] == 48
    assert dry.summary["rows_skipped_unreviewed"] == 48
    assert dry.summary["preview_row_count"] == 0
    assert dry.summary["error_count"] == 0
    assert reviews.read_bytes() == review_before
    review_count_after = sum(
        1 for line in reviews.read_text(encoding="utf-8").splitlines() if line.strip()
    )
    assert review_count_after == review_count_before
    assert annotations.read_bytes() == annotations_before
