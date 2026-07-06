from copy import deepcopy
import json
from pathlib import Path

import pytest

from search_index.build_index import build_inverted_index, serialize_index
from source_index_supplements.generate_supplement_records import (
    SupplementGenerationError,
    build_generated_record,
    generate_supplement_records,
    generated_ir_id,
)
from source_index_supplements.merge_supplements_into_search_index import (
    merge_supplements_into_search_index,
)
from source_index_supplements.validate_supplements import (
    SupplementRow,
    SupplementValidationError,
    search_keys_for_source_term,
    validate_supplement_table,
)

HEALTH_SUPPLEMENT_TERMS = {"hôpital", "clinique", "centre de santé"}
HEALTH_TARGET_IDS = ["a9c7d82decee9191", "fefe9b063e05ed11"]
HOPITAL_BASE_TARGET_ID = "71e323e2dafa590f"
PLACE_MAPPING_ID = "96b72ff71179d689"
PLACE_PRESERVED_TARGET_ID = "de6fb406453616e3"
HEALTH_EVIDENCE_INDEX_IDS = ["7e95a0d4f7f80731", "1ed4f7a94fdba41f"]


def write_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")


def read_jsonl(path: Path) -> list[dict]:
    rows: list[dict] = []
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            text = line.strip()
            if text:
                rows.append(json.loads(text))
    return rows


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


def make_fixture(
    tmp_path: Path,
    supplements: list[dict],
    index_rows: list[dict] | None = None,
    records: list[dict] | None = None,
):
    records_path = tmp_path / "records.jsonl"
    index_path = tmp_path / "search_index.jsonl"
    supplements_path = tmp_path / "supplements.jsonl"
    write_jsonl(records_path, records or base_records())
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


def supplement_as_row(row: dict) -> SupplementRow:
    return SupplementRow(row=row, line_number=1)


def expected_generated_record(row: dict, records: list[dict] | None = None) -> dict:
    return build_generated_record(
        supplement_as_row(row),
        {record["ir_id"]: record for record in records or base_records()},
    )


def load_owner_lexical_rows(repo_root: Path) -> dict[str, dict]:
    owner_path = repo_root / "data/ir/siralex_owner_lexical_v1.jsonl"
    rows = {}
    for row in read_jsonl(owner_path):
        rows[row["ir_id"]] = row
    return rows


def minimal_owner_lexicon_record(owner_row: dict) -> dict:
    headword = owner_row["fields_raw"]["headword_latin"]
    return {
        "ir_id": owner_row["ir_id"],
        "ir_kind": "lexicon_entry",
        "source_id": owner_row["source_id"],
        "norm_version": "norm_v3",
        "preferred_form": headword,
        "variant_forms": [headword],
        "search_keys": {
            "casefold": [headword],
            "diacritics_insensitive": [headword],
            "punct_stripped": [headword],
            "nospace": [headword],
        },
        "display": {
            "headword_latin": headword,
            "anchor_names": [headword],
            "senses": owner_row.get("fields_raw", {}).get("senses", []),
        },
    }


def owner_evidence_index_mapping(ir_id: str, source_term: str, target_form: str, anchor: str) -> dict:
    return {
        "ir_id": ir_id,
        "ir_kind": "index_mapping",
        "source_id": "src_siralex_lexical_review",
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
                    "lexicon_url": "siralex://lexical-review/7n2a",
                    "anchor": anchor,
                    "display_text": target_form,
                }
            ],
        },
    }


def lookup_record(records: list[dict], ir_id: str) -> dict:
    for record in records:
        if record.get("ir_id") == ir_id:
            return record
    raise AssertionError(f"Record {ir_id} not found")


def source_posting(index_rows: list[dict], source_term: str) -> list[str]:
    return lookup(index_rows, source_term)


def legacy_phase7b_phase7d_rows(all_rows: list[dict]) -> list[dict]:
    return [row for row in all_rows if row.get("supplement_id", "").startswith(("src_supp_phase7b_", "src_supp_phase7d_"))]


def augmented_phase7d_fixture(tmp_path: Path) -> tuple[Path, Path, Path, list[dict]]:
    repo_root = Path(__file__).resolve().parents[3]
    phase7d_bundle = repo_root / "web/public/bundle_full_20260606_6b8b401a"
    supplements_path = repo_root / "shared/source_index_supplements/source_index_supplements_v1.jsonl"
    owner_rows = load_owner_lexical_rows(repo_root)

    base_records = read_jsonl(phase7d_bundle / "records.jsonl")
    base_index = read_jsonl(phase7d_bundle / "search_index.jsonl")
    supplements = read_jsonl(supplements_path)

    augmented_records = [
        *base_records,
        minimal_owner_lexicon_record(owner_rows["a9c7d82decee9191"]),
        minimal_owner_lexicon_record(owner_rows["fefe9b063e05ed11"]),
        owner_evidence_index_mapping(
            ir_id=HEALTH_EVIDENCE_INDEX_IDS[0],
            source_term="hôpital (owner-reviewed ndándayoro evidence)",
            target_form="ndándayoro",
            anchor="7n2a_ndandayoro_v1",
        ),
        owner_evidence_index_mapping(
            ir_id=HEALTH_EVIDENCE_INDEX_IDS[1],
            source_term="hôpital (owner-reviewed ndándadiya evidence)",
            target_form="ndándadiya",
            anchor="7n2a_ndandadiya_v1",
        ),
    ]

    records_path = tmp_path / "records.jsonl"
    index_path = tmp_path / "search_index.jsonl"
    supplements_tmp_path = tmp_path / "supplements.jsonl"
    write_jsonl(records_path, augmented_records)
    write_jsonl(index_path, base_index)
    write_jsonl(supplements_tmp_path, supplements)
    return records_path, index_path, supplements_tmp_path, supplements


def test_tracked_health_rows_validate_and_merge_with_preserved_place_boundary(tmp_path: Path):
    repo_root = Path(__file__).resolve().parents[3]
    records_path, index_path, supplements_path, supplements = augmented_phase7d_fixture(tmp_path)

    validation = validate_supplement_table(
        supplements_path,
        records_path,
        index_path,
        defer_index_conflicts=True,
    )
    assert validation.summary["approved_supplement_count"] >= 3

    health_rows = [row for row in supplements if row.get("source_term") in HEALTH_SUPPLEMENT_TERMS]
    assert {row["source_term"] for row in health_rows} == HEALTH_SUPPLEMENT_TERMS
    assert len(health_rows) == 3
    for row in health_rows:
        assert row["status"] == "approved"
        assert row["reviewer"] == "project owner / native-speaker linguistic authority"
        assert row["reviewed_at"] == "2026-07-05"
        assert row["source_norm_version"] == "norm_v3"
        assert row["broad_mapping"] is False
        assert row["broad_mapping_rationale"] == ""
        assert row["target_ir_ids"] == HEALTH_TARGET_IDS
        assert row["target_forms"] == ["ndándayoro", "ndándadiya"]

    by_term = {row["source_term"]: row for row in health_rows}
    assert by_term["hôpital"]["supplement_mode"] == "additive_source_mapping"
    assert by_term["hôpital"]["candidate_type"] == "incomplete_source_mapping"
    assert HOPITAL_BASE_TARGET_ID not in by_term["hôpital"]["target_ir_ids"]
    assert "place" not in {row["source_term"] for row in supplements}
    assert "location" not in {row["source_term"] for row in supplements}
    assert "yoro" not in {row["source_term"] for row in supplements}

    baseline_rows = read_jsonl(index_path)
    assert source_posting(baseline_rows, "hôpital") == ["61843e6630c1fbae"]
    assert source_posting(baseline_rows, "clinique") == []
    assert source_posting(baseline_rows, "centre de santé") == []

    merged_rows, report = merge_supplements_into_search_index(
        supplement_table_path=supplements_path,
        records_path=records_path,
        baseline_search_index_path=index_path,
        baseline_bundle_dir=repo_root / "web/public/bundle_full_20260606_6b8b401a",
    )
    merged_lookup = {(row["key_type"], row["key"]): row["ir_ids"] for row in merged_rows}
    generated_ids = {
        item["source_term"]: item["generated_ir_id"]
        for item in report["generated_supplement_records"]
    }
    assert generated_ids.keys() >= HEALTH_SUPPLEMENT_TERMS

    assert source_posting(merged_rows, "hôpital") == [
        "61843e6630c1fbae",
        generated_ids["hôpital"],
    ]
    assert source_posting(merged_rows, "clinique") == [generated_ids["clinique"]]
    assert source_posting(merged_rows, "centre de santé") == [generated_ids["centre de santé"]]

    generated_records = {
        record["ir_id"]: record
        for record in generate_supplement_records(supplements_path, records_path, index_path)[0]
    }
    hopital_targets = [
        target["display_text"]
        for target in generated_records[generated_ids["hôpital"]]["display"]["target_entries"]
    ]
    assert hopital_targets == ["ndándayoro", "ndándadiya"]
    clinique_targets = [
        target["display_text"]
        for target in generated_records[generated_ids["clinique"]]["display"]["target_entries"]
    ]
    centre_targets = [
        target["display_text"]
        for target in generated_records[generated_ids["centre de santé"]]["display"]["target_entries"]
    ]
    assert clinique_targets == ["ndándayoro", "ndándadiya"]
    assert centre_targets == ["ndándayoro", "ndándadiya"]

    for row in merged_rows:
        assert len(row["ir_ids"]) == len(set(row["ir_ids"]))

    assert source_posting(merged_rows, "location") == []
    assert source_posting(merged_rows, "yoro") == []

    place_posting = source_posting(merged_rows, "place")
    assert place_posting == [PLACE_MAPPING_ID]
    place_record = lookup_record(read_jsonl(records_path), PLACE_MAPPING_ID)
    place_target_anchors = {
        entry.get("anchor") for entry in place_record.get("display", {}).get("target_entries", [])
    }
    assert "e2782" in place_target_anchors

    lexicon_by_source_record = {}
    for lex_row in read_jsonl(repo_root / "data/ir/malipense_lexicon_v3.jsonl"):
        if lex_row.get("ir_kind") != "lexicon_entry":
            continue
        locator = lex_row.get("record_locator", {})
        source_record_id = locator.get("source_record_id")
        if isinstance(source_record_id, str):
            lexicon_by_source_record[source_record_id] = lex_row["ir_id"]
    resolved_place_targets = {
        lexicon_by_source_record.get(anchor)
        for anchor in place_target_anchors
        if isinstance(anchor, str)
    }
    assert PLACE_PRESERVED_TARGET_ID in resolved_place_targets
    assert "a9c7d82decee9191" not in resolved_place_targets
    assert "fefe9b063e05ed11" not in resolved_place_targets

    assert report["unexpected_changes"] == []
    assert report["target_side_changed_key_list"] == []


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


def test_deferred_validation_allows_existing_source_term_for_replay(tmp_path: Path):
    row = supplement_row(source_term="tante")
    records_path, index_path, supplements_path = make_fixture(tmp_path, [row])

    result = validate_supplement_table(
        supplements_path,
        records_path,
        index_path,
        defer_index_conflicts=True,
    )

    assert result.outcomes[0].outcome == "applied"
    assert result.outcomes[0].source_term == "tante"


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


def test_already_present_supplement_emits_no_duplicate_record(tmp_path: Path):
    row = supplement_row()
    expected = expected_generated_record(row)
    records = [*base_records(), expected]
    index_rows = serialize_index(build_inverted_index(records))
    records_path, index_path, supplements_path = make_fixture(
        tmp_path,
        [row],
        index_rows=index_rows,
        records=records,
    )

    generated_records, report = generate_supplement_records(supplements_path, records_path, index_path)

    assert generated_records == []
    assert report["applied_supplement_count"] == 0
    assert report["already_present_supplement_count"] == 1
    assert report["already_present_supplements"][0]["outcome"] == "already_present"
    assert report["already_present_supplements"][0]["existing_generated_ir_id"] == expected["ir_id"]


def test_already_present_supplement_causes_no_index_mutation(tmp_path: Path):
    row = supplement_row()
    expected = expected_generated_record(row)
    records = [*base_records(), expected]
    index_rows = serialize_index(build_inverted_index(records))
    records_path, index_path, supplements_path = make_fixture(
        tmp_path,
        [row],
        index_rows=index_rows,
        records=records,
    )

    merged_rows, report = merge_supplements_into_search_index(
        supplement_table_path=supplements_path,
        records_path=records_path,
        baseline_search_index_path=index_path,
        baseline_bundle_dir=make_baseline_bundle_dir(tmp_path),
    )

    assert {(row["key_type"], row["key"]): row["ir_ids"] for row in merged_rows} == {
        (row["key_type"], row["key"]): row["ir_ids"] for row in index_rows
    }
    assert report["applied_supplement_count"] == 0
    assert report["already_present_supplement_count"] == 1
    assert report["changed_key_list"] == []
    assert report["added_key_list"] == []


def test_same_generated_id_with_different_record_content_fails(tmp_path: Path):
    row = supplement_row()
    expected = expected_generated_record(row)
    conflicting = deepcopy(expected)
    conflicting["preferred_form"] = "different"
    records = [*base_records(), conflicting]
    index_rows = serialize_index(build_inverted_index([*base_records(), expected]))
    records_path, index_path, supplements_path = make_fixture(
        tmp_path,
        [row],
        index_rows=index_rows,
        records=records,
    )

    with pytest.raises(SupplementGenerationError, match="generated_record_content_mismatch"):
        generate_supplement_records(supplements_path, records_path, index_path)


def test_same_source_key_points_to_unexpected_ir_id_fails(tmp_path: Path):
    row = supplement_row()
    index_rows = [
        *base_index_rows(),
        *[
            {"key_type": key_type, "key": key, "ir_ids": ["unexpected"]}
            for key_type, key in search_keys_for_source_term("poil")
        ],
    ]
    records_path, index_path, supplements_path = make_fixture(tmp_path, [row], index_rows=index_rows)

    with pytest.raises(SupplementGenerationError, match="source_key_unexpected_postings"):
        generate_supplement_records(supplements_path, records_path, index_path)


def test_expected_record_present_but_source_index_missing_posting_fails(tmp_path: Path):
    row = supplement_row()
    expected = expected_generated_record(row)
    records_path, index_path, supplements_path = make_fixture(
        tmp_path,
        [row],
        records=[*base_records(), expected],
    )

    with pytest.raises(SupplementGenerationError, match="source_key_missing_expected_posting"):
        generate_supplement_records(supplements_path, records_path, index_path)


def test_expected_source_key_with_duplicate_generated_postings_fails(tmp_path: Path):
    row = supplement_row()
    expected = expected_generated_record(row)
    generated_id = expected["ir_id"]
    index_rows = [
        *base_index_rows(),
        *[
            {
                "key_type": key_type,
                "key": key,
                "ir_ids": [generated_id, generated_id] if index == 0 else [generated_id],
            }
            for index, (key_type, key) in enumerate(search_keys_for_source_term("poil"))
        ],
    ]
    records_path, index_path, supplements_path = make_fixture(
        tmp_path,
        [row],
        index_rows=index_rows,
        records=[*base_records(), expected],
    )

    with pytest.raises(SupplementGenerationError, match="source_key_duplicate_posting"):
        generate_supplement_records(supplements_path, records_path, index_path)


def test_expected_source_key_with_correct_ids_in_wrong_order_fails(tmp_path: Path):
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
    row["supporting_evidence_ir_ids"] = ["idx-tante", "idx-tante-pat", "id-tanten"]
    row["supporting_source_terms"] = ["tante", "tante paternelle"]
    expected = expected_generated_record(row)
    generated_id = expected["ir_id"]
    index_rows = [
        *[
            item
            for item in base_index_rows()
            if (item["key_type"], item["key"]) not in set(search_keys_for_source_term("tante"))
        ],
        *[
            {"key_type": key_type, "key": key, "ir_ids": [generated_id, "idx-tante"]}
            for key_type, key in search_keys_for_source_term("tante")
        ],
    ]
    records_path, index_path, supplements_path = make_fixture(
        tmp_path,
        [row],
        index_rows=index_rows,
        records=[*base_records(), expected],
    )

    with pytest.raises(SupplementGenerationError, match="source_key_order_mismatch"):
        generate_supplement_records(supplements_path, records_path, index_path)


def test_target_entry_metadata_mismatch_fails(tmp_path: Path):
    row = supplement_row()
    expected = expected_generated_record(row)
    conflicting = deepcopy(expected)
    conflicting["display"]["target_entries"][0]["anchor"] = "different-anchor"
    index_rows = serialize_index(build_inverted_index([*base_records(), expected]))
    records_path, index_path, supplements_path = make_fixture(
        tmp_path,
        [row],
        index_rows=index_rows,
        records=[*base_records(), conflicting],
    )

    with pytest.raises(SupplementGenerationError, match="target_entry_metadata_mismatch"):
        generate_supplement_records(supplements_path, records_path, index_path)


def test_deterministic_generated_id_collision_with_unrelated_record_fails(tmp_path: Path):
    row = supplement_row()
    expected = expected_generated_record(row)
    unrelated = {
        "ir_id": expected["ir_id"],
        "ir_kind": "lexicon_entry",
        "source_id": "src_malipense",
        "norm_version": "norm_v3",
        "preferred_form": "unrelated",
        "variant_forms": ["unrelated"],
        "search_keys": {"casefold": ["unrelated"]},
        "display": {"headword_latin": "unrelated"},
    }
    index_rows = serialize_index(build_inverted_index([*base_records(), expected]))
    records_path, index_path, supplements_path = make_fixture(
        tmp_path,
        [row],
        index_rows=index_rows,
        records=[*base_records(), unrelated],
    )

    with pytest.raises(SupplementGenerationError, match="generated_id_collision_unrelated_record"):
        generate_supplement_records(supplements_path, records_path, index_path)


def test_cumulative_phase7b_phase7d_replay_matches_current_bundle_states(tmp_path: Path):
    repo_root = Path(__file__).resolve().parents[3]
    supplements = repo_root / "shared/source_index_supplements/source_index_supplements_v1.jsonl"
    phase7b_bundle = repo_root / "web/public/bundle_full_20260603_d0e4f812"
    phase7d_bundle = repo_root / "web/public/bundle_full_20260606_6b8b401a"
    scoped_rows = legacy_phase7b_phase7d_rows(read_jsonl(supplements))
    scoped_supplements = tmp_path / "phase7b_phase7d_replay_supplements.jsonl"
    write_jsonl(scoped_supplements, scoped_rows)

    phase7b_rows, phase7b_report = merge_supplements_into_search_index(
        supplement_table_path=scoped_supplements,
        records_path=phase7b_bundle / "records.jsonl",
        baseline_search_index_path=phase7b_bundle / "search_index.jsonl",
        baseline_bundle_dir=phase7b_bundle,
    )
    phase7b_outcomes = {
        item["source_term"]: item["outcome"]
        for item in [
            *phase7b_report["applied_supplements"],
            *phase7b_report["already_present_supplements"],
        ]
    }
    assert phase7b_outcomes == {
        "poil": "already_present",
        "poils": "already_present",
        "tante": "already_present",
        "oncle": "applied",
    }
    assert phase7b_report["applied_supplement_count"] == 1
    assert {item["source_term"] for item in phase7b_report["applied_supplements"]} == {"oncle"}
    assert len(phase7b_rows) > 0

    phase7d_rows, phase7d_report = merge_supplements_into_search_index(
        supplement_table_path=scoped_supplements,
        records_path=phase7d_bundle / "records.jsonl",
        baseline_search_index_path=phase7d_bundle / "search_index.jsonl",
        baseline_bundle_dir=phase7d_bundle,
    )
    phase7d_outcomes = {
        item["source_term"]: item["outcome"]
        for item in phase7d_report["already_present_supplements"]
    }
    assert phase7d_outcomes == {
        "poil": "already_present",
        "poils": "already_present",
        "tante": "already_present",
        "oncle": "already_present",
    }
    assert phase7d_report["applied_supplement_count"] == 0
    assert phase7d_report["changed_key_list"] == []
    assert phase7d_report["added_key_list"] == []
    assert {(row["key_type"], row["key"]): row["ir_ids"] for row in phase7d_rows} == {
        (row["key_type"], row["key"]): row["ir_ids"]
        for row in read_jsonl(phase7d_bundle / "search_index.jsonl")
    }
