import json
from pathlib import Path

import pytest

from search_index.build_index import build_inverted_index, serialize_index
from source_index_supplements.generate_supplement_records import (
    generate_supplement_records,
    generated_ir_id,
)
from source_index_supplements.merge_supplements_into_search_index import (
    merge_supplements_into_search_index,
)
from source_index_supplements.validate_supplements import (
    SupplementValidationError,
    search_keys_for_source_term,
    validate_supplement_table,
)


def write_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")


def lexicon_record(ir_id: str, preferred_form: str, gloss_fr: str = "") -> dict:
    senses = [{"gloss_fr": gloss_fr}] if gloss_fr else []
    return {
        "ir_id": ir_id,
        "ir_kind": "lexicon_entry",
        "source_id": "src_malipense",
        "norm_version": "norm_v3",
        "preferred_form": preferred_form,
        "variant_forms": [preferred_form],
        "search_keys": {
            "casefold": [preferred_form],
            "diacritics_insensitive": [preferred_form],
            "punct_stripped": [preferred_form],
            "nospace": [preferred_form],
        },
        "display": {
            "headword_latin": preferred_form,
            "anchor_names": [preferred_form],
            "senses": senses,
        },
    }


def index_mapping_record(
    ir_id: str,
    source_term: str,
    target_display: str,
    lexicon_url: str = "../lexicon/test.htm",
    anchor: str | None = None,
) -> dict:
    anchor = anchor or f"e-{ir_id}"
    return {
        "ir_id": ir_id,
        "ir_kind": "index_mapping",
        "source_id": "src_malipense",
        "norm_version": "norm_v3",
        "preferred_form": source_term,
        "variant_forms": [source_term],
        "search_keys": {
            "casefold": [source_term],
            "diacritics_insensitive": [source_term],
            "punct_stripped": [source_term],
            "nospace": [source_term],
        },
        "display": {
            "source_term": source_term,
            "source_lang": "fr",
            "target_entries": [
                {
                    "lexicon_url": lexicon_url,
                    "anchor": anchor,
                    "display_text": target_display,
                }
            ],
        },
    }


def base_records() -> list[dict]:
    return [
        lexicon_record("id-si", "sí", "poil, toison, pelage"),
        lexicon_record("id-tanten", "tɛ́nɛn", "tante paternelle"),
        lexicon_record("id-nalaka", "nàlaka", "tantine"),
        lexicon_record("id-oncle-mat", "bárin", "oncle maternel"),
        lexicon_record("id-oncle-pat", "bɛ́nɔɔ", "oncle paternel"),
        index_mapping_record("idx-pelage", "pelage", "sí", "../lexicon/s.htm", "e7501"),
        index_mapping_record("idx-toison", "toison", "sí", "../lexicon/s.htm", "e7501"),
        index_mapping_record("idx-tante", "tante", "nàlaka", "../lexicon/n.htm", "e6502"),
        index_mapping_record("idx-tante-pat", "tante paternelle", "tɛ́nɛn", "../lexicon/t.htm", "e8121"),
        index_mapping_record("idx-oncle-mat", "oncle maternel", "bárin", "../lexicon/b.htm", "e701"),
        index_mapping_record("idx-oncle-pat", "oncle paternel", "bɛ́nɔɔ", "../lexicon/b.htm", "e973"),
    ]


def base_index_rows() -> list[dict]:
    return [
        {"key": "pelage", "key_type": "src_casefold", "ir_ids": ["idx-pelage"]},
        {"key": "toison", "key_type": "src_casefold", "ir_ids": ["idx-toison"]},
        {"key": "tante", "key_type": "src_casefold", "ir_ids": ["idx-tante"]},
        {"key": "tante", "key_type": "src_diacritics_insensitive", "ir_ids": ["idx-tante"]},
        {"key": "tante", "key_type": "src_punct_stripped", "ir_ids": ["idx-tante"]},
        {"key": "tante", "key_type": "src_nospace", "ir_ids": ["idx-tante"]},
        {"key": "tante paternelle", "key_type": "src_casefold", "ir_ids": ["idx-tante-pat"]},
        {"key": "oncle maternel", "key_type": "src_casefold", "ir_ids": ["idx-oncle-mat"]},
        {"key": "oncle paternel", "key_type": "src_casefold", "ir_ids": ["idx-oncle-pat"]},
    ]


def supplement_row(
    supplement_id: str = "src_supp_test_0001",
    source_term: str = "poil",
    target_ir_ids: list[str] | None = None,
    target_forms: list[str] | None = None,
    status: str = "approved",
    supplement_mode: str = "new_source_mapping",
    broad_mapping: bool = False,
) -> dict:
    target_ir_ids = target_ir_ids or ["id-si"]
    target_forms = target_forms or ["sí"]
    row = {
        "schema_version": "source_index_supplement_v1",
        "supplement_table_version": "test-table",
        "supplement_id": supplement_id,
        "status": status,
        "source_lang": "fr",
        "source_term": source_term,
        "source_display_text": source_term,
        "target_ir_ids": target_ir_ids,
        "target_forms": target_forms,
        "target_notes": [
            {
                "target_ir_id": target_ir_ids[0],
                "target_form": target_forms[0],
                "label": "test label" if broad_mapping else "",
                "note": "test note",
            }
        ],
        "candidate_type": (
            "broad_umbrella_source_mapping"
            if supplement_mode == "broad_umbrella_source_mapping"
            else "missing_source_index_mapping"
        ),
        "supplement_mode": supplement_mode,
        "broad_mapping": broad_mapping,
        "broad_mapping_rationale": "Broad test rationale" if broad_mapping else "",
        "supporting_evidence_ir_ids": ["idx-pelage", *target_ir_ids],
        "supporting_source_terms": ["pelage"],
        "rationale": "test rationale",
        "source_bundle_id": "test-bundle",
        "source_norm_version": "norm_v3",
    }
    if status == "approved":
        row["reviewer"] = "reviewer"
        row["reviewed_at"] = "2026-06-03"
    return row


def make_fixture(tmp_path: Path, supplements: list[dict], index_rows: list[dict] | None = None):
    records_path = tmp_path / "records.jsonl"
    index_path = tmp_path / "search_index.jsonl"
    supplements_path = tmp_path / "supplements.jsonl"
    write_jsonl(records_path, base_records())
    write_jsonl(index_path, index_rows or base_index_rows())
    write_jsonl(supplements_path, supplements)
    return records_path, index_path, supplements_path


def make_baseline_bundle_dir(tmp_path: Path) -> Path:
    bundle_dir = tmp_path / "bundle"
    bundle_dir.mkdir()
    (bundle_dir / "bundle.manifest.json").write_text(
        json.dumps(
            {
                "bundle_id": "bundle_full_test",
                "content_sha256": "sha256:test",
            },
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )
    return bundle_dir


def lookup(index_entries: list[dict], query: str) -> list[str]:
    index = {(row["key_type"], row["key"]): row["ir_ids"] for row in index_entries}
    for storage_key in search_keys_for_source_term(query):
        if storage_key in index:
            return index[storage_key]
    return []


def test_valid_new_source_mapping_passes_validation(tmp_path: Path):
    records_path, index_path, supplements_path = make_fixture(tmp_path, [supplement_row()])

    result = validate_supplement_table(supplements_path, records_path, index_path)

    assert result.summary["approved_supplement_count"] == 1
    assert result.summary["applied_supplement_count"] == 1


def test_additive_source_mapping_allows_existing_source_term(tmp_path: Path):
    row = supplement_row(
        supplement_id="src_supp_test_tante",
        source_term="tante",
        target_ir_ids=["id-tanten"],
        target_forms=["tɛ́nɛn"],
        supplement_mode="additive_source_mapping",
        broad_mapping=True,
    )
    row["candidate_type"] = "incomplete_source_mapping"
    row["broad_mapping_rationale"] = "Add paternal aunt to broad tante."
    records_path, index_path, supplements_path = make_fixture(tmp_path, [row])

    result = validate_supplement_table(supplements_path, records_path, index_path)

    assert result.outcomes[0].supplement_mode == "additive_source_mapping"


def test_new_source_mapping_rejects_existing_source_term(tmp_path: Path):
    row = supplement_row(source_term="tante")
    records_path, index_path, supplements_path = make_fixture(tmp_path, [row])

    with pytest.raises(SupplementValidationError, match="conflicts with existing source term"):
        validate_supplement_table(supplements_path, records_path, index_path)


def test_additive_source_mapping_requires_existing_source_term(tmp_path: Path):
    row = supplement_row(supplement_mode="additive_source_mapping")
    records_path, index_path, supplements_path = make_fixture(tmp_path, [row])

    with pytest.raises(SupplementValidationError, match="requires existing source term"):
        validate_supplement_table(supplements_path, records_path, index_path)


def test_broad_mapping_requires_rationale_and_target_notes(tmp_path: Path):
    row = supplement_row(broad_mapping=True)
    row["broad_mapping_rationale"] = ""
    records_path, index_path, supplements_path = make_fixture(tmp_path, [row])

    with pytest.raises(SupplementValidationError, match="broad_mapping_rationale"):
        validate_supplement_table(supplements_path, records_path, index_path)


def test_target_form_must_be_attested(tmp_path: Path):
    row = supplement_row(target_forms=["invented"])
    row["target_notes"][0]["target_form"] = "invented"
    records_path, index_path, supplements_path = make_fixture(tmp_path, [row])

    with pytest.raises(SupplementValidationError, match="not attested"):
        validate_supplement_table(supplements_path, records_path, index_path)


def test_candidate_rejected_and_superseded_rows_do_not_generate(tmp_path: Path):
    rows = [
        supplement_row("candidate", status="candidate"),
        supplement_row("rejected", status="rejected"),
        supplement_row("superseded", status="superseded"),
    ]
    records_path, index_path, supplements_path = make_fixture(tmp_path, rows)

    generated_records, report = generate_supplement_records(supplements_path, records_path, index_path)

    assert generated_records == []
    assert report["generated_records"] == []
    assert report["source_index_supplement_tables"][0]["applied_supplement_count"] == 0


def test_generated_record_is_deterministic_and_display_compatible(tmp_path: Path):
    row_data = supplement_row()
    records_path, index_path, supplements_path = make_fixture(tmp_path, [row_data])
    generated_records, report = generate_supplement_records(supplements_path, records_path, index_path)
    generated_again, _ = generate_supplement_records(supplements_path, records_path, index_path)

    assert generated_records == generated_again
    record = generated_records[0]
    assert record["ir_id"] == generated_ir_id(report_row(report, "src_supp_test_0001"))
    assert record["ir_kind"] == "index_mapping"
    assert record["display"]["source_term"] == "poil"
    assert record["display"]["source_lang"] == "fr"
    assert record["display"]["target_entries"] == [
        {"lexicon_url": "../lexicon/s.htm", "anchor": "e7501", "display_text": "sí"}
    ]


def report_row(report: dict, supplement_id: str):
    from source_index_supplements.validate_supplements import SupplementRow

    row = supplement_row(supplement_id=supplement_id)
    return SupplementRow(row=row, line_number=1)


def test_generated_records_produce_expected_source_search_rows(tmp_path: Path):
    rows = [
        supplement_row("src_supp_poil", "poil"),
        supplement_row("src_supp_poils", "poils"),
        supplement_row(
            supplement_id="src_supp_tante",
            source_term="tante",
            target_ir_ids=["id-tanten"],
            target_forms=["tɛ́nɛn"],
            supplement_mode="additive_source_mapping",
            broad_mapping=True,
        ),
    ]
    rows[2]["candidate_type"] = "incomplete_source_mapping"
    rows[2]["broad_mapping_rationale"] = "Add paternal aunt to broad tante."
    rows[2]["supporting_evidence_ir_ids"] = ["idx-tante", "idx-tante-pat", "id-tanten"]
    rows[2]["supporting_source_terms"] = ["tante", "tante paternelle"]
    records_path, index_path, supplements_path = make_fixture(tmp_path, rows)

    generated_records, _ = generate_supplement_records(supplements_path, records_path, index_path)
    index_entries = serialize_index(build_inverted_index(base_records() + generated_records))

    assert lookup(index_entries, "poil") == [generated_records[0]["ir_id"]]
    assert lookup(index_entries, "poils") == [generated_records[1]["ir_id"]]
    assert lookup(index_entries, "tante") == ["idx-tante", generated_records[2]["ir_id"]]


def test_compatibility_merge_only_changes_targeted_source_keys(tmp_path: Path):
    rows = [
        supplement_row("src_supp_poil", "poil"),
        supplement_row("src_supp_poils", "poils"),
        supplement_row(
            supplement_id="src_supp_tante",
            source_term="tante",
            target_ir_ids=["id-tanten"],
            target_forms=["tɛ́nɛn"],
            supplement_mode="additive_source_mapping",
            broad_mapping=True,
        ),
        supplement_row(
            supplement_id="src_supp_oncle",
            source_term="oncle",
            target_ir_ids=["id-oncle-mat", "id-oncle-pat"],
            target_forms=["bárin", "bɛ́nɔɔ"],
            status="candidate",
            supplement_mode="broad_umbrella_source_mapping",
            broad_mapping=True,
        ),
    ]
    rows[2]["candidate_type"] = "incomplete_source_mapping"
    rows[2]["broad_mapping_rationale"] = "Add paternal aunt to broad tante."
    rows[2]["supporting_evidence_ir_ids"] = ["idx-tante", "idx-tante-pat", "id-tanten"]
    rows[2]["supporting_source_terms"] = ["tante", "tante paternelle"]
    rows[3]["candidate_type"] = "broad_umbrella_source_mapping"
    rows[3]["broad_mapping_rationale"] = "Candidate broad oncle mapping."
    rows[3]["target_notes"] = [
        {
            "target_ir_id": "id-oncle-mat",
            "target_form": "bárin",
            "label": "oncle maternel",
            "note": "candidate",
        },
        {
            "target_ir_id": "id-oncle-pat",
            "target_form": "bɛ́nɔɔ",
            "label": "oncle paternel",
            "note": "candidate",
        },
    ]
    rows[3]["supporting_evidence_ir_ids"] = ["idx-oncle-mat", "idx-oncle-pat"]
    rows[3]["supporting_source_terms"] = ["oncle maternel", "oncle paternel"]
    records_path, index_path, supplements_path = make_fixture(tmp_path, rows)

    merged_rows, report = merge_supplements_into_search_index(
        supplement_table_path=supplements_path,
        records_path=records_path,
        baseline_search_index_path=index_path,
        baseline_bundle_dir=make_baseline_bundle_dir(tmp_path),
    )
    merged = {(row["key_type"], row["key"]): row["ir_ids"] for row in merged_rows}
    generated_ids = {
        item["source_term"]: item["generated_ir_id"]
        for item in report["generated_supplement_records"]
    }

    assert merged[("src_casefold", "poil")] == [generated_ids["poil"]]
    assert merged[("src_casefold", "poils")] == [generated_ids["poils"]]
    assert merged[("src_casefold", "tante")] == ["idx-tante", generated_ids["tante"]]
    assert merged[("src_diacritics_insensitive", "tante")] == [
        "idx-tante",
        generated_ids["tante"],
    ]
    assert ("src_casefold", "oncle") not in merged
    assert report["removed_key_list"] == []
    assert report["target_side_changed_key_list"] == []
    assert report["unexpected_changes"] == []
    assert {item["source_term"] for item in report["non_applied_supplement_rows"]} == {"oncle"}
    changed_keys = {(item["key_type"], item["key"]) for item in report["changed_key_list"]}
    added_keys = {(item["key_type"], item["key"]) for item in report["added_key_list"]}
    assert changed_keys == {
        ("src_casefold", "tante"),
        ("src_diacritics_insensitive", "tante"),
        ("src_nospace", "tante"),
        ("src_punct_stripped", "tante"),
    }
    assert added_keys == {
        ("src_casefold", "poil"),
        ("src_diacritics_insensitive", "poil"),
        ("src_nospace", "poil"),
        ("src_punct_stripped", "poil"),
        ("src_casefold", "poils"),
        ("src_diacritics_insensitive", "poils"),
        ("src_nospace", "poils"),
        ("src_punct_stripped", "poils"),
    }
