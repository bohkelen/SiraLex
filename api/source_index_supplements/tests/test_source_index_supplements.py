from copy import deepcopy
import json
import os
from pathlib import Path
import subprocess
import sys

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
OWNER_SOURCE_ID = "src_siralex_lexical_review"
PROHIBITED_SYNTHETIC_EVIDENCE_IDS = {"7e95a0d4f7f80731", "1ed4f7a94fdba41f"}


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
        None,
    )


def owner_raw_row(
    *,
    ir_id: str,
    headword: str,
    source_record_id: str,
    url_canonical: str,
    invalid_provenance: bool = False,
    source_id: str = OWNER_SOURCE_ID,
) -> dict:
    row = {
        "ir_id": ir_id,
        "ir_kind": "lexicon_entry",
        "source_id": source_id,
        "parser_version": "siralex_owner_lexical_v1",
        "evidence": [
            {
                "source_id": OWNER_SOURCE_ID,
                "review_reference": {
                    "document_path": "docs/reviews/test_owner_review.md",
                    "approval_status": "owner linguistic approval recorded",
                    "reviewer_role": "project owner / native-speaker linguistic authority",
                },
                "text_quote": headword,
            }
        ],
        "record_locator": {
            "kind": "source_record_id",
            "url_canonical": url_canonical,
            "source_record_id": source_record_id,
            "anchor_names": [headword],
        },
        "fields_raw": {
            "headword_latin": headword,
            "senses": [{"gloss_fr": "établissement de santé"}],
        },
        "provenance": {
            "source": {
                "id": OWNER_SOURCE_ID,
                "name": "SiraLex owner-reviewed lexical addition",
                "url": None,
                "retrieved_at": "2026-07-05T14:04:34Z",
                "license_notes": "Project owner linguistic review record.",
                "record_pointer": {
                    "kind": "source_record_id",
                    "source_record_id": source_record_id,
                    "url_canonical": url_canonical,
                },
            }
        },
        "derivation": {
            "kind": "owner_approved_lexical_addition",
            "rule_versions": {"normalization": "norm_v3"},
        },
    }
    if invalid_provenance:
        row["provenance"]["source"]["id"] = "invalid_source"
    return row


def minimal_owner_lexicon_record(owner_row: dict, *, source_id: str | None = None) -> dict:
    headword = owner_row["fields_raw"]["headword_latin"]
    return {
        "ir_id": owner_row["ir_id"],
        "ir_kind": "lexicon_entry",
        "source_id": source_id if source_id is not None else owner_row["source_id"],
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


def owner_raw_rows_health() -> list[dict]:
    return [
        owner_raw_row(
            ir_id="a9c7d82decee9191",
            headword="ndándayoro",
            source_record_id="7n2a_ndandayoro_v1",
            url_canonical="siralex://lexical-review/7n2a/ndandayoro",
        ),
        owner_raw_row(
            ir_id="fefe9b063e05ed11",
            headword="ndándadiya",
            source_record_id="7n2a_ndandadiya_v1",
            url_canonical="siralex://lexical-review/7n2a/ndandadiya",
        ),
    ]


def synthetic_owner_index_mapping_record(
    ir_id: str, source_term: str, target_form: str, anchor: str
) -> dict:
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


def competing_owner_like_index_mapping_record(ir_id: str = "idx-owner-competing") -> dict:
    return {
        "ir_id": ir_id,
        "ir_kind": "index_mapping",
        "source_id": "src_malipense",
        "norm_version": "norm_v3",
        "preferred_form": "evidence-clinique",
        "variant_forms": ["evidence-clinique"],
        "search_keys": {
            "casefold": ["evidence-clinique"],
            "diacritics_insensitive": ["evidence-clinique"],
            "punct_stripped": ["evidence-clinique"],
            "nospace": ["evidenceclinique"],
        },
        "display": {
            "source_term": "evidence-clinique",
            "source_lang": "fr",
            "target_entries": [
                {
                    "lexicon_url": "https://www.mali-pense.net/emk/lexicon/fake.htm",
                    "anchor": "fake-owner-anchor-1",
                    "display_text": "ndándayoro",
                },
                {
                    "lexicon_url": "https://www.mali-pense.net/emk/lexicon/fake.htm",
                    "anchor": "fake-owner-anchor-2",
                    "display_text": "ndándadiya",
                },
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


def write_owner_lexical_ir(path: Path, rows: list[dict]) -> Path:
    write_jsonl(path, rows)
    return path


def source_attested_row(source_term: str = "clinique") -> dict:
    row = supplement_row(
        supplement_id="src_supp_src_attested_0001",
        source_term=source_term,
        target_ir_ids=["id-si"],
        target_forms=["sí"],
        supplement_mode="new_source_mapping",
        broad_mapping=False,
    )
    row["supporting_evidence_ir_ids"] = ["idx-pelage", "id-si"]
    row["supporting_source_terms"] = ["pelage"]
    return row


def owner_adapter_row(source_term: str = "clinique") -> dict:
    row = supplement_row(
        supplement_id="src_supp_owner_adapter_0001",
        source_term=source_term,
        target_ir_ids=HEALTH_TARGET_IDS,
        target_forms=["ndándayoro", "ndándadiya"],
        supplement_mode="new_source_mapping",
        broad_mapping=False,
    )
    row["supporting_evidence_ir_ids"] = HEALTH_TARGET_IDS.copy()
    row["supporting_source_terms"] = [source_term]
    row["target_notes"] = [
        {
            "target_ir_id": "a9c7d82decee9191",
            "target_form": "ndándayoro",
            "label": source_term,
            "note": "owner",
        },
        {
            "target_ir_id": "fefe9b063e05ed11",
            "target_form": "ndándadiya",
            "label": source_term,
            "note": "owner",
        },
    ]
    return row


def records_with_owner_targets(owner_rows: list[dict], *, source_id_override: str | None = None) -> list[dict]:
    rows = [*base_records()]
    rows.extend(
        minimal_owner_lexicon_record(row, source_id=source_id_override)
        for row in owner_rows
    )
    return rows


def run_module(module: str, args: list[str], *, repo_root: Path) -> None:
    env = os.environ.copy()
    env["PYTHONPATH"] = "api:shared"
    subprocess.run(
        [sys.executable, "-m", module, *args],
        cwd=str(repo_root),
        env=env,
        check=True,
        capture_output=True,
        text=True,
    )


def assemble_records_with_duplicate_guard(
    baseline_records: list[dict],
    owner_records: list[dict],
) -> tuple[list[dict], int, int, int, int]:
    combined = [*baseline_records, *owner_records]
    seen: set[str] = set()
    duplicate_count = 0
    for row in combined:
        ir_id = row.get("ir_id")
        if not isinstance(ir_id, str):
            continue
        if ir_id in seen:
            duplicate_count += 1
        seen.add(ir_id)
    return combined, len(baseline_records), len(owner_records), len(combined), duplicate_count


def resolve_source_posting_targets(
    posting_mapping_ids: list[str],
    records_by_id: dict[str, dict],
    malipense_source_record_to_ir_id: dict[str, str],
    owner_source_record_to_ir_id: dict[str, str],
) -> list[str]:
    resolved: list[str] = []
    for mapping_id in posting_mapping_ids:
        mapping = records_by_id[mapping_id]
        for entry in mapping.get("display", {}).get("target_entries", []):
            anchor = entry.get("anchor")
            if not isinstance(anchor, str):
                continue
            if anchor in malipense_source_record_to_ir_id:
                resolved.append(malipense_source_record_to_ir_id[anchor])
            elif anchor in owner_source_record_to_ir_id:
                resolved.append(owner_source_record_to_ir_id[anchor])
    return resolved


def test_existing_source_attested_path_unchanged_without_owner_ir(tmp_path: Path):
    row = source_attested_row()
    records_path, index_path, supplements_path = make_fixture(
        tmp_path,
        [row],
        records=base_records(),
    )
    validate_supplement_table(supplements_path, records_path, index_path)
    generated_records, _ = generate_supplement_records(supplements_path, records_path, index_path)
    assert generated_records[0]["display"]["target_entries"] == [
        {"lexicon_url": "../lexicon/s.htm", "anchor": "e7501", "display_text": "sí"}
    ]


def test_owner_reviewed_target_generates_without_synthetic_index_mapping(tmp_path: Path):
    owner_rows = owner_raw_rows_health()
    owner_ir_path = write_owner_lexical_ir(tmp_path / "owner_ir.jsonl", owner_rows)
    row = owner_adapter_row("clinique")
    records_path, index_path, supplements_path = make_fixture(
        tmp_path,
        [row],
        records=records_with_owner_targets(owner_rows),
    )

    validation = validate_supplement_table(
        supplements_path,
        records_path,
        index_path,
        owner_lexical_ir_path=owner_ir_path,
    )
    assert validation.summary["applied_supplement_count"] == 1
    assert validation.owner_reviewed_target_ids == HEALTH_TARGET_IDS

    generated_records, report = generate_supplement_records(
        supplements_path,
        records_path,
        index_path,
        owner_lexical_ir_path=owner_ir_path,
    )
    target_entries = generated_records[0]["display"]["target_entries"]
    assert target_entries == [
        {
            "lexicon_url": "siralex://lexical-review/7n2a/ndandayoro",
            "anchor": "7n2a_ndandayoro_v1",
            "display_text": "ndándayoro",
        },
        {
            "lexicon_url": "siralex://lexical-review/7n2a/ndandadiya",
            "anchor": "7n2a_ndandadiya_v1",
            "display_text": "ndándadiya",
        },
    ]
    assert report["owner_lexical_input"]["path"] == str(owner_ir_path)


def test_owner_target_pointer_precedence_over_matching_index_mapping(tmp_path: Path):
    owner_rows = owner_raw_rows_health()
    owner_ir_path = write_owner_lexical_ir(tmp_path / "owner_ir.jsonl", owner_rows)
    row = owner_adapter_row("clinique")
    row["supporting_evidence_ir_ids"] = [
        "a9c7d82decee9191",
        "fefe9b063e05ed11",
        "idx-owner-competing",
    ]
    records_path, index_path, supplements_path = make_fixture(
        tmp_path,
        [row],
        records=[
            *records_with_owner_targets(owner_rows),
            competing_owner_like_index_mapping_record(),
        ],
    )

    generated_records, _ = generate_supplement_records(
        supplements_path,
        records_path,
        index_path,
        owner_lexical_ir_path=owner_ir_path,
    )
    target_entries = generated_records[0]["display"]["target_entries"]
    assert target_entries == [
        {
            "lexicon_url": "siralex://lexical-review/7n2a/ndandayoro",
            "anchor": "7n2a_ndandayoro_v1",
            "display_text": "ndándayoro",
        },
        {
            "lexicon_url": "siralex://lexical-review/7n2a/ndandadiya",
            "anchor": "7n2a_ndandadiya_v1",
            "display_text": "ndándadiya",
        },
    ]
    for entry in target_entries:
        assert not entry["anchor"].startswith("fake-owner-anchor")
        assert "mali-pense.net" not in entry["lexicon_url"]


def test_missing_owner_lexical_ir_fails_when_owner_evidence_required(tmp_path: Path):
    owner_rows = owner_raw_rows_health()
    row = owner_adapter_row("clinique")
    records_path, index_path, supplements_path = make_fixture(
        tmp_path,
        [row],
        records=records_with_owner_targets(owner_rows),
    )
    with pytest.raises(SupplementValidationError, match="requires explicit --owner-lexical-ir"):
        validate_supplement_table(supplements_path, records_path, index_path)


def test_invalid_owner_lexical_provenance_fails_closed(tmp_path: Path):
    invalid_rows = [
        owner_raw_row(
            ir_id="a9c7d82decee9191",
            headword="ndándayoro",
            source_record_id="7n2a_ndandayoro_v1",
            url_canonical="siralex://lexical-review/7n2a/ndandayoro",
            invalid_provenance=True,
        ),
        owner_raw_row(
            ir_id="fefe9b063e05ed11",
            headword="ndándadiya",
            source_record_id="7n2a_ndandadiya_v1",
            url_canonical="siralex://lexical-review/7n2a/ndandadiya",
        ),
    ]
    owner_ir_path = write_owner_lexical_ir(tmp_path / "owner_ir.jsonl", invalid_rows)
    row = owner_adapter_row("clinique")
    records_path, index_path, supplements_path = make_fixture(
        tmp_path,
        [row],
        records=records_with_owner_targets(invalid_rows),
    )
    with pytest.raises(SupplementValidationError, match="provenance.source.id"):
        validate_supplement_table(
            supplements_path,
            records_path,
            index_path,
            owner_lexical_ir_path=owner_ir_path,
        )


def test_owner_target_form_nfc_mismatch_fails_closed(tmp_path: Path):
    owner_rows = owner_raw_rows_health()
    owner_rows_mismatch = [
        owner_rows[0],
        owner_raw_row(
            ir_id="fefe9b063e05ed11",
            headword="ndándadiya-mismatch",
            source_record_id="7n2a_ndandadiya_v1",
            url_canonical="siralex://lexical-review/7n2a/ndandadiya",
        ),
    ]
    owner_ir_path = write_owner_lexical_ir(tmp_path / "owner_ir.jsonl", owner_rows_mismatch)
    row = owner_adapter_row("clinique")
    records_path, index_path, supplements_path = make_fixture(
        tmp_path,
        [row],
        records=records_with_owner_targets(owner_rows),
    )
    with pytest.raises(SupplementValidationError, match="headword_latin does not match"):
        validate_supplement_table(
            supplements_path,
            records_path,
            index_path,
            owner_lexical_ir_path=owner_ir_path,
        )


def test_owner_target_must_appear_in_supporting_evidence_ids(tmp_path: Path):
    owner_rows = owner_raw_rows_health()
    owner_ir_path = write_owner_lexical_ir(tmp_path / "owner_ir.jsonl", owner_rows)
    row = owner_adapter_row("clinique")
    row["supporting_evidence_ir_ids"] = ["a9c7d82decee9191"]
    records_path, index_path, supplements_path = make_fixture(
        tmp_path,
        [row],
        records=records_with_owner_targets(owner_rows),
    )
    with pytest.raises(SupplementValidationError, match="must appear in supporting_evidence_ir_ids"):
        validate_supplement_table(
            supplements_path,
            records_path,
            index_path,
            owner_lexical_ir_path=owner_ir_path,
        )


def test_malipense_lexicon_target_cannot_use_owner_adapter(tmp_path: Path):
    owner_rows = owner_raw_rows_health()
    owner_ir_path = write_owner_lexical_ir(tmp_path / "owner_ir.jsonl", owner_rows)
    row = supplement_row(
        supplement_id="src_supp_test_non_owner_0001",
        source_term="clinique",
        target_ir_ids=["id-si"],
        target_forms=["sí"],
        supplement_mode="new_source_mapping",
    )
    row["supporting_evidence_ir_ids"] = ["id-si"]
    row["supporting_source_terms"] = ["clinique"]
    records_path, index_path, supplements_path = make_fixture(
        tmp_path,
        [row],
        records=base_records(),
    )
    with pytest.raises(SupplementGenerationError, match="no supporting index_mapping target_entry found"):
        generate_supplement_records(
            supplements_path,
            records_path,
            index_path,
            owner_lexical_ir_path=owner_ir_path,
        )


def test_non_owner_lexical_source_cannot_use_owner_adapter(tmp_path: Path):
    owner_rows = owner_raw_rows_health()
    owner_ir_path = write_owner_lexical_ir(tmp_path / "owner_ir.jsonl", owner_rows)
    row = owner_adapter_row("clinique")
    records_path, index_path, supplements_path = make_fixture(
        tmp_path,
        [row],
        records=records_with_owner_targets(owner_rows, source_id_override="src_other"),
    )
    with pytest.raises(SupplementGenerationError, match="no supporting index_mapping target_entry found"):
        generate_supplement_records(
            supplements_path,
            records_path,
            index_path,
            owner_lexical_ir_path=owner_ir_path,
        )


def test_owner_adapter_merge_preserves_order_and_no_duplicates(tmp_path: Path):
    owner_rows = owner_raw_rows_health()
    owner_ir_path = write_owner_lexical_ir(tmp_path / "owner_ir.jsonl", owner_rows)
    row = owner_adapter_row("clinique")
    records_path, index_path, supplements_path = make_fixture(
        tmp_path,
        [row],
        records=records_with_owner_targets(owner_rows),
    )
    merged_rows, report = merge_supplements_into_search_index(
        supplement_table_path=supplements_path,
        records_path=records_path,
        baseline_search_index_path=index_path,
        baseline_bundle_dir=make_baseline_bundle_dir(tmp_path),
        owner_lexical_ir_path=owner_ir_path,
    )
    merged_posting = source_posting(merged_rows, "clinique")
    generated_id = report["generated_supplement_records"][0]["generated_ir_id"]
    assert merged_posting == [generated_id]
    assert len(merged_posting) == len(set(merged_posting))
    assert report["owner_lexical_input"]["path"] == str(owner_ir_path)
    assert report["owner_lexical_input"]["row_count"] == 2
    assert report["owner_reviewed_target_ids"] == sorted(HEALTH_TARGET_IDS)


def test_merge_report_omits_owner_metadata_when_owner_path_unused(tmp_path: Path):
    row = source_attested_row("clinique")
    records_path, index_path, supplements_path = make_fixture(
        tmp_path,
        [row],
        records=base_records(),
    )
    _, report = merge_supplements_into_search_index(
        supplement_table_path=supplements_path,
        records_path=records_path,
        baseline_search_index_path=index_path,
        baseline_bundle_dir=make_baseline_bundle_dir(tmp_path),
    )
    assert "owner_lexical_input" not in report
    assert "owner_reviewed_target_ids" not in report


def test_tracked_health_rows_validate_with_durable_assembly_only(tmp_path: Path):
    repo_root = Path(__file__).resolve().parents[3]
    baseline_bundle = repo_root / "web/public/bundle_full_20260606_6b8b401a"
    supplements_path = repo_root / "shared/source_index_supplements/source_index_supplements_v1.jsonl"
    owner_ir_path = repo_root / "data/ir/siralex_owner_lexical_v1.jsonl"
    work_dir = tmp_path / "phase7n2a4e1r"
    work_dir.mkdir()

    owner_normalized_path = work_dir / "owner_normalized.jsonl"
    owner_enriched_path = work_dir / "owner_enriched.jsonl"
    records_augmented_path = work_dir / "records_augmented.jsonl"

    run_module(
        "normalizer.cli",
        [
            "--input",
            "data/ir/siralex_owner_lexical_v1.jsonl",
            "--output",
            str(owner_normalized_path),
            "-v",
        ],
        repo_root=repo_root,
    )
    run_module(
        "enrichment.cli",
        [
            "--normalized",
            str(owner_normalized_path),
            "--ir",
            "data/ir/siralex_owner_lexical_v1.jsonl",
            "--output",
            str(owner_enriched_path),
            "-v",
        ],
        repo_root=repo_root,
    )

    baseline_records = read_jsonl(baseline_bundle / "records.jsonl")
    owner_enriched_records = read_jsonl(owner_enriched_path)
    combined_records, baseline_count, owner_count, combined_count, duplicate_count = (
        assemble_records_with_duplicate_guard(baseline_records, owner_enriched_records)
    )
    assert baseline_count > 0
    assert owner_count == 2
    assert combined_count == baseline_count + owner_count
    assert duplicate_count == 0
    write_jsonl(records_augmented_path, combined_records)

    health_rows = [
        row
        for row in read_jsonl(supplements_path)
        if row.get("supplement_id")
        in {"src_supp_phase7n2a_0001", "src_supp_phase7n2a_0002", "src_supp_phase7n2a_0003"}
    ]
    assert len(health_rows) == 3
    by_id = {row["supplement_id"]: row for row in health_rows}
    assert by_id["src_supp_phase7n2a_0001"]["supporting_evidence_ir_ids"] == [
        "61843e6630c1fbae",
        "a9c7d82decee9191",
        "fefe9b063e05ed11",
    ]
    assert by_id["src_supp_phase7n2a_0002"]["supporting_evidence_ir_ids"] == [
        "a9c7d82decee9191",
        "fefe9b063e05ed11",
    ]
    assert by_id["src_supp_phase7n2a_0003"]["supporting_evidence_ir_ids"] == [
        "a9c7d82decee9191",
        "fefe9b063e05ed11",
    ]
    assert by_id["src_supp_phase7n2a_0001"]["supporting_source_terms"] == ["hôpital"]
    assert by_id["src_supp_phase7n2a_0002"]["supporting_source_terms"] == ["clinique"]
    assert by_id["src_supp_phase7n2a_0003"]["supporting_source_terms"] == ["centre de santé"]
    for row in health_rows:
        assert PROHIBITED_SYNTHETIC_EVIDENCE_IDS.isdisjoint(set(row["supporting_evidence_ir_ids"]))

    records_augmented = read_jsonl(records_augmented_path)
    records_augmented_by_id = {row["ir_id"]: row for row in records_augmented}
    for row in health_rows:
        for evidence_id in row["supporting_evidence_ir_ids"]:
            assert evidence_id in records_augmented_by_id

    validation = validate_supplement_table(
        supplements_path,
        records_augmented_path,
        baseline_bundle / "search_index.jsonl",
        owner_lexical_ir_path=owner_ir_path,
        defer_index_conflicts=True,
    )
    assert validation.summary["applied_supplement_count"] >= 3

    generated_records, generation_report = generate_supplement_records(
        supplements_path,
        records_augmented_path,
        baseline_bundle / "search_index.jsonl",
        owner_lexical_ir_path=owner_ir_path,
    )
    generated_by_term = {row["preferred_form"]: row for row in generated_records}
    assert {"hôpital", "clinique", "centre de santé"} <= set(generated_by_term)
    assert generated_by_term["hôpital"]["display"]["target_entries"] == [
        {
            "lexicon_url": "siralex://lexical-review/7n2a/ndandayoro",
            "anchor": "7n2a_ndandayoro_v1",
            "display_text": "ndándayoro",
        },
        {
            "lexicon_url": "siralex://lexical-review/7n2a/ndandadiya",
            "anchor": "7n2a_ndandadiya_v1",
            "display_text": "ndándadiya",
        },
    ]
    assert generation_report["owner_lexical_input"]["path"] == str(owner_ir_path)
    assert generation_report["owner_lexical_input"]["row_count"] == 2
    assert generation_report["owner_reviewed_target_ids"] == sorted(HEALTH_TARGET_IDS)

    merged_rows, merge_report = merge_supplements_into_search_index(
        supplement_table_path=supplements_path,
        records_path=records_augmented_path,
        baseline_search_index_path=baseline_bundle / "search_index.jsonl",
        baseline_bundle_dir=baseline_bundle,
        owner_lexical_ir_path=owner_ir_path,
    )
    merged_index = {(row["key_type"], row["key"]): row["ir_ids"] for row in merged_rows}
    h_mapping_ids = source_posting(merged_rows, "hôpital")
    c_mapping_ids = source_posting(merged_rows, "clinique")
    cds_mapping_ids = source_posting(merged_rows, "centre de santé")
    assert len(h_mapping_ids) == 2
    assert len(c_mapping_ids) == 1
    assert len(cds_mapping_ids) == 1
    assert h_mapping_ids[0] == "61843e6630c1fbae"
    assert h_mapping_ids[1] == generated_by_term["hôpital"]["ir_id"]
    assert c_mapping_ids == [generated_by_term["clinique"]["ir_id"]]
    assert cds_mapping_ids == [generated_by_term["centre de santé"]["ir_id"]]
    assert merge_report["owner_lexical_input"]["path"] == str(owner_ir_path)
    assert merge_report["owner_lexical_input"]["row_count"] == 2
    assert merge_report["owner_reviewed_target_ids"] == sorted(HEALTH_TARGET_IDS)

    malipense_source_record_to_ir_id: dict[str, str] = {}
    for row in read_jsonl(repo_root / "data/ir/malipense_lexicon_v3.jsonl"):
        source_record_id = row.get("record_locator", {}).get("source_record_id")
        if row.get("ir_kind") == "lexicon_entry" and isinstance(source_record_id, str):
            malipense_source_record_to_ir_id[source_record_id] = row["ir_id"]
    owner_source_record_to_ir_id: dict[str, str] = {}
    for row in read_jsonl(owner_ir_path):
        source_record_id = row.get("record_locator", {}).get("source_record_id")
        if row.get("ir_kind") == "lexicon_entry" and isinstance(source_record_id, str):
            owner_source_record_to_ir_id[source_record_id] = row["ir_id"]

    merged_records_by_id = {
        row["ir_id"]: row for row in [*records_augmented, *generated_records]
    }
    h_targets = resolve_source_posting_targets(
        h_mapping_ids,
        merged_records_by_id,
        malipense_source_record_to_ir_id,
        owner_source_record_to_ir_id,
    )
    c_targets = resolve_source_posting_targets(
        c_mapping_ids,
        merged_records_by_id,
        malipense_source_record_to_ir_id,
        owner_source_record_to_ir_id,
    )
    cds_targets = resolve_source_posting_targets(
        cds_mapping_ids,
        merged_records_by_id,
        malipense_source_record_to_ir_id,
        owner_source_record_to_ir_id,
    )
    assert h_targets == ["71e323e2dafa590f", "a9c7d82decee9191", "fefe9b063e05ed11"]
    assert c_targets == ["a9c7d82decee9191", "fefe9b063e05ed11"]
    assert cds_targets == ["a9c7d82decee9191", "fefe9b063e05ed11"]

    place_posting = source_posting(merged_rows, "place")
    assert place_posting == [PLACE_MAPPING_ID]
    place_targets = resolve_source_posting_targets(
        place_posting,
        merged_records_by_id,
        malipense_source_record_to_ir_id,
        owner_source_record_to_ir_id,
    )
    assert PLACE_PRESERVED_TARGET_ID in place_targets
    assert "a9c7d82decee9191" not in place_targets
    assert "fefe9b063e05ed11" not in place_targets
    assert source_posting(merged_rows, "location") == []
    assert source_posting(merged_rows, "yoro") == []
    assert ("src_casefold", "location") not in merged_index
    assert ("src_casefold", "yoro") not in merged_index
    for row in merged_rows:
        assert len(row["ir_ids"]) == len(set(row["ir_ids"]))


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
