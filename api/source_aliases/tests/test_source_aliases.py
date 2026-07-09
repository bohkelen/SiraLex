import json
from pathlib import Path

import pytest

from source_aliases.apply_aliases_to_search_index import (
    AliasApplicationError,
    apply_approved_aliases,
)
from source_aliases.validate_alias_table import (
    AliasValidationError,
    search_keys_for_source_term,
    validate_alias_table,
)

REPO_ROOT = Path(__file__).parent.parent.parent.parent
TRACKED_ALIAS_TABLE_PATH = REPO_ROOT / "shared/aliases/source_aliases_v1.jsonl"
GENERIC_MERE_IR_ID = "e5164efcdf5e6ca4"
VOCATIVE_MOTHER_IR_ID = "0f517a71c373f51d"
RESPECTFUL_MOTHER_IR_ID = "d540716db9321a83"


def write_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")


def read_jsonl(path: Path) -> list[dict]:
    with path.open("r", encoding="utf-8") as handle:
        return [json.loads(line) for line in handle if line.strip()]


def tracked_alias_rows() -> list[dict]:
    return read_jsonl(TRACKED_ALIAS_TABLE_PATH)


def records_rows() -> list[dict]:
    return [
        {"ir_id": "id-oeil", "ir_kind": "index_mapping"},
        {"ir_id": "id-grand", "ir_kind": "index_mapping"},
        {"ir_id": "id-jumeau", "ir_kind": "index_mapping"},
        {"ir_id": "id-grandmere", "ir_kind": "index_mapping"},
        {"ir_id": "id-grandpere", "ir_kind": "index_mapping"},
        {"ir_id": "id-kun", "ir_kind": "lexicon_entry"},
        {"ir_id": "id-mere-direct", "ir_kind": "index_mapping"},
        {"ir_id": "id-mere-other", "ir_kind": "index_mapping"},
        {"ir_id": GENERIC_MERE_IR_ID, "ir_kind": "index_mapping"},
        {"ir_id": VOCATIVE_MOTHER_IR_ID, "ir_kind": "index_mapping"},
        {"ir_id": RESPECTFUL_MOTHER_IR_ID, "ir_kind": "index_mapping"},
        {"ir_id": "id-a", "ir_kind": "index_mapping"},
        {"ir_id": "id-b", "ir_kind": "index_mapping"},
        {"ir_id": "id-c", "ir_kind": "index_mapping"},
        {"ir_id": "id-z", "ir_kind": "index_mapping"},
    ]


def base_index_rows() -> list[dict]:
    return [
        {"key": "oeil", "key_type": "src_casefold", "ir_ids": ["id-oeil"]},
        {"key": "oeil", "key_type": "src_diacritics_insensitive", "ir_ids": ["id-oeil"]},
        {"key": "oeil", "key_type": "src_punct_stripped", "ir_ids": ["id-oeil"]},
        {"key": "oeil", "key_type": "src_nospace", "ir_ids": ["id-oeil"]},
        {"key": "grand", "key_type": "src_casefold", "ir_ids": ["id-grand"]},
        {"key": "jumeau", "key_type": "src_casefold", "ir_ids": ["id-jumeau"]},
        {"key": "grand-mère", "key_type": "src_casefold", "ir_ids": ["id-grandmere"]},
        {"key": "grand-père", "key_type": "src_casefold", "ir_ids": ["id-grandpere"]},
        {"key": "mere", "key_type": "src_diacritics_insensitive", "ir_ids": ["id-z", "id-a"]},
        {"key": "multi-alpha", "key_type": "src_casefold", "ir_ids": ["id-z", "id-a"]},
        {"key": "multi-beta", "key_type": "src_casefold", "ir_ids": ["id-b", "id-z", "id-c"]},
        {
            "key": "mère",
            "key_type": "src_casefold",
            "ir_ids": [VOCATIVE_MOTHER_IR_ID, RESPECTFUL_MOTHER_IR_ID, GENERIC_MERE_IR_ID],
        },
        {
            "key": "mère",
            "key_type": "src_diacritics_insensitive",
            "ir_ids": [VOCATIVE_MOTHER_IR_ID, RESPECTFUL_MOTHER_IR_ID, GENERIC_MERE_IR_ID],
        },
        {
            "key": "mère",
            "key_type": "src_punct_stripped",
            "ir_ids": [VOCATIVE_MOTHER_IR_ID, RESPECTFUL_MOTHER_IR_ID, GENERIC_MERE_IR_ID],
        },
        {
            "key": "mère",
            "key_type": "src_nospace",
            "ir_ids": [VOCATIVE_MOTHER_IR_ID, RESPECTFUL_MOTHER_IR_ID, GENERIC_MERE_IR_ID],
        },
        {"key": "wóyì", "key_type": "src_casefold", "ir_ids": [VOCATIVE_MOTHER_IR_ID]},
        {"key": "tɔ́ɔma", "key_type": "src_casefold", "ir_ids": [RESPECTFUL_MOTHER_IR_ID]},
        {"key": "kun", "key_type": "tgt_casefold", "ir_ids": ["id-kun"]},
    ]


def approved_alias(
    alias_id: str = "alias-1",
    alias_source_term: str = "Yeux",
    canonical_source_terms: list[str] | None = None,
    resolved_ir_ids: list[str] | None = None,
    status: str = "approved",
    candidate_type: str = "french_plural_singular_alias",
) -> dict:
    row = {
        "schema_version": "source_alias_table_v1",
        "alias_table_version": "test-table",
        "alias_id": alias_id,
        "status": status,
        "direction": "source_to_target",
        "alias_source_term": alias_source_term,
        "canonical_source_terms": canonical_source_terms or ["oeil"],
        "resolved_ir_ids": resolved_ir_ids or ["id-oeil"],
        "candidate_type": candidate_type,
        "evidence_ir_ids": ["id-oeil"],
        "rationale": "test rationale",
        "source_bundle_id": "test-bundle",
        "source_norm_version": "norm_v3",
    }
    if status == "approved":
        row["reviewer"] = "reviewer"
        row["reviewed_at"] = "2026-06-02"
    return row


def make_fixture(tmp_path: Path, aliases: list[dict], index_rows: list[dict] | None = None):
    records_path = tmp_path / "records.jsonl"
    index_path = tmp_path / "search_index.jsonl"
    aliases_path = tmp_path / "aliases.jsonl"
    write_jsonl(records_path, records_rows())
    write_jsonl(index_path, index_rows or base_index_rows())
    write_jsonl(aliases_path, aliases)
    return records_path, index_path, aliases_path


def lookup(index_path: Path, direction: str, query: str) -> list[str]:
    index = {(row["key_type"], row["key"]): row["ir_ids"] for row in read_jsonl(index_path)}
    prefix = "src_" if direction == "source_to_target" else "tgt_"
    for key_type, key in search_keys_for_source_term(query):
        storage_key = (key_type if prefix == "src_" else key_type.replace("src_", "tgt_", 1), key)
        if storage_key in index:
            return index[storage_key]
    return []


def test_valid_approved_alias_passes_validation(tmp_path: Path):
    records_path, index_path, aliases_path = make_fixture(tmp_path, [approved_alias()])

    result = validate_alias_table(aliases_path, records_path, index_path)

    assert result.summary["approved_alias_count"] == 1
    assert result.summary["applied_alias_count"] == 1


def test_missing_required_field_rejected(tmp_path: Path):
    row = approved_alias()
    del row["alias_source_term"]
    records_path, index_path, aliases_path = make_fixture(tmp_path, [row])

    with pytest.raises(AliasValidationError, match="missing required fields"):
        validate_alias_table(aliases_path, records_path, index_path)


def test_invalid_status_rejected(tmp_path: Path):
    row = approved_alias(status="ready")
    records_path, index_path, aliases_path = make_fixture(tmp_path, [row])

    with pytest.raises(AliasValidationError, match="invalid status"):
        validate_alias_table(aliases_path, records_path, index_path)


def test_non_source_direction_rejected(tmp_path: Path):
    row = approved_alias()
    row["direction"] = "target_to_source"
    records_path, index_path, aliases_path = make_fixture(tmp_path, [row])

    with pytest.raises(AliasValidationError, match="direction must be"):
        validate_alias_table(aliases_path, records_path, index_path)


def test_approved_without_reviewer_or_reviewed_at_rejected(tmp_path: Path):
    row = approved_alias()
    del row["reviewer"]
    records_path, index_path, aliases_path = make_fixture(tmp_path, [row])

    with pytest.raises(AliasValidationError, match="approved alias missing fields"):
        validate_alias_table(aliases_path, records_path, index_path)


def test_unknown_candidate_type_rejected(tmp_path: Path):
    row = approved_alias()
    row["candidate_type"] = "missing_source_index_mapping"
    records_path, index_path, aliases_path = make_fixture(tmp_path, [row])

    with pytest.raises(AliasValidationError, match="invalid candidate_type"):
        validate_alias_table(aliases_path, records_path, index_path)


def test_french_common_form_alias_validates(tmp_path: Path):
    row = approved_alias(
        alias_id="alias-maman",
        alias_source_term="maman",
        canonical_source_terms=["mère"],
        resolved_ir_ids=[GENERIC_MERE_IR_ID],
    )
    row["candidate_type"] = "french_common_form_alias"
    row["evidence_ir_ids"] = [GENERIC_MERE_IR_ID]
    records_path, index_path, aliases_path = make_fixture(tmp_path, [row])

    result = validate_alias_table(aliases_path, records_path, index_path)

    assert result.summary["approved_alias_count"] == 1
    assert result.summary["applied_alias_count"] == 1


def test_tracked_maman_alias_row_matches_approved_contract():
    rows = tracked_alias_rows()
    maman_rows = [row for row in rows if row.get("alias_source_term") == "maman"]
    assert len(maman_rows) == 1
    row = maman_rows[0]
    assert row["alias_id"] == "src_alias_phase7n2a_0001"
    assert row["candidate_type"] == "french_common_form_alias"
    assert row["canonical_source_terms"] == ["mère"]
    assert row["resolved_ir_ids"] == [GENERIC_MERE_IR_ID]
    assert row["resolved_ir_ids"] == [GENERIC_MERE_IR_ID]
    assert VOCATIVE_MOTHER_IR_ID not in row["resolved_ir_ids"]
    assert RESPECTFUL_MOTHER_IR_ID not in row["resolved_ir_ids"]


def test_maman_routes_exactly_to_generic_mere_posting(tmp_path: Path):
    row = approved_alias(
        alias_id="alias-maman-generic",
        alias_source_term="maman",
        canonical_source_terms=["mère"],
        resolved_ir_ids=[GENERIC_MERE_IR_ID],
        candidate_type="french_common_form_alias",
    )
    row["evidence_ir_ids"] = [GENERIC_MERE_IR_ID]
    records_path, index_path, aliases_path = make_fixture(tmp_path, [row])
    output_index = tmp_path / "out.jsonl"

    validate_alias_table(aliases_path, records_path, index_path)
    apply_approved_aliases(
        aliases_path,
        records_path,
        index_path,
        output_index,
        tmp_path / "report.json",
    )

    maman_posting = lookup(output_index, "source_to_target", "maman")
    mere_posting = lookup(output_index, "source_to_target", "mère")
    assert maman_posting == [GENERIC_MERE_IR_ID]
    assert mere_posting == [VOCATIVE_MOTHER_IR_ID, RESPECTFUL_MOTHER_IR_ID, GENERIC_MERE_IR_ID]
    assert VOCATIVE_MOTHER_IR_ID not in maman_posting
    assert RESPECTFUL_MOTHER_IR_ID not in maman_posting


def test_maman_application_preserves_canonical_mere_posting_unchanged(tmp_path: Path):
    row = approved_alias(
        alias_id="alias-maman-order",
        alias_source_term="maman",
        canonical_source_terms=["mère"],
        resolved_ir_ids=[GENERIC_MERE_IR_ID],
        candidate_type="french_common_form_alias",
    )
    row["evidence_ir_ids"] = [GENERIC_MERE_IR_ID]
    records_path, index_path, aliases_path = make_fixture(tmp_path, [row])
    output_index = tmp_path / "out.jsonl"

    apply_approved_aliases(
        aliases_path,
        records_path,
        index_path,
        output_index,
        tmp_path / "report.json",
    )

    assert lookup(output_index, "source_to_target", "maman") == [GENERIC_MERE_IR_ID]
    assert lookup(output_index, "source_to_target", "mère") == [
        VOCATIVE_MOTHER_IR_ID,
        RESPECTFUL_MOTHER_IR_ID,
        GENERIC_MERE_IR_ID,
    ]


def test_french_common_form_alias_custom_resolved_ids_mismatch_rejected(tmp_path: Path):
    row = approved_alias(
        alias_id="alias-maman-bad",
        alias_source_term="maman",
        canonical_source_terms=["mère"],
        resolved_ir_ids=[VOCATIVE_MOTHER_IR_ID],
        candidate_type="french_common_form_alias",
    )
    row["evidence_ir_ids"] = [GENERIC_MERE_IR_ID]
    records_path, index_path, aliases_path = make_fixture(tmp_path, [row])

    with pytest.raises(AliasValidationError, match="requires evidence_ir_ids to exactly equal"):
        validate_alias_table(aliases_path, records_path, index_path)


def test_narrow_common_form_alias_declared_ids_must_be_canonical_subset(tmp_path: Path):
    row = approved_alias(
        alias_id="alias-maman-invalid-canonical",
        alias_source_term="maman",
        canonical_source_terms=["mère"],
        resolved_ir_ids=[GENERIC_MERE_IR_ID, "id-oeil"],
        candidate_type="french_common_form_alias",
    )
    row["evidence_ir_ids"] = [GENERIC_MERE_IR_ID, "id-oeil"]
    records_path, index_path, aliases_path = make_fixture(tmp_path, [row])

    with pytest.raises(AliasValidationError, match="not present in canonical source postings"):
        validate_alias_table(aliases_path, records_path, index_path)


def test_narrow_common_form_alias_declared_ids_must_preserve_canonical_order(tmp_path: Path):
    row = approved_alias(
        alias_id="alias-maman-order-invalid",
        alias_source_term="maman",
        canonical_source_terms=["mère"],
        resolved_ir_ids=[GENERIC_MERE_IR_ID, VOCATIVE_MOTHER_IR_ID],
        candidate_type="french_common_form_alias",
    )
    row["evidence_ir_ids"] = [GENERIC_MERE_IR_ID, VOCATIVE_MOTHER_IR_ID]
    records_path, index_path, aliases_path = make_fixture(tmp_path, [row])

    with pytest.raises(AliasValidationError, match="must preserve canonical posting order"):
        validate_alias_table(aliases_path, records_path, index_path)


def test_narrow_common_form_alias_evidence_ids_must_be_tied_to_canonical_source(tmp_path: Path):
    row = approved_alias(
        alias_id="alias-maman-evidence-invalid",
        alias_source_term="maman",
        canonical_source_terms=["mère"],
        resolved_ir_ids=[GENERIC_MERE_IR_ID],
        candidate_type="french_common_form_alias",
    )
    row["evidence_ir_ids"] = [GENERIC_MERE_IR_ID, "id-oeil"]
    records_path, index_path, aliases_path = make_fixture(tmp_path, [row])

    with pytest.raises(AliasValidationError, match="requires evidence_ir_ids to exactly equal"):
        validate_alias_table(aliases_path, records_path, index_path)


def test_duplicate_alias_source_term_under_same_normalized_form_fails(tmp_path: Path):
    row_a = approved_alias(
        alias_id="alias-maman-a",
        alias_source_term="maman",
        canonical_source_terms=["mère"],
        resolved_ir_ids=[GENERIC_MERE_IR_ID],
        candidate_type="french_common_form_alias",
    )
    row_a["evidence_ir_ids"] = [GENERIC_MERE_IR_ID]
    row_b = approved_alias(
        alias_id="alias-maman-b",
        alias_source_term="Maman",
        canonical_source_terms=["oeil"],
        resolved_ir_ids=["id-oeil"],
        candidate_type="french_common_form_alias",
    )
    row_b["evidence_ir_ids"] = ["id-oeil"]
    records_path, index_path, aliases_path = make_fixture(tmp_path, [row_a, row_b])

    with pytest.raises(AliasApplicationError, match="conflicts with existing postings"):
        apply_approved_aliases(
            aliases_path,
            records_path,
            index_path,
            tmp_path / "out.jsonl",
            tmp_path / "report.json",
        )


def test_existing_alias_candidate_types_remain_valid(tmp_path: Path):
    for candidate_type in (
        "french_plural_singular_alias",
        "french_gender_alias",
        "hyphenation_or_compound_alias",
    ):
        row = approved_alias(alias_id=f"alias-{candidate_type}", candidate_type=candidate_type)
        records_path, index_path, aliases_path = make_fixture(tmp_path, [row])
        result = validate_alias_table(aliases_path, records_path, index_path)
        assert result.summary["approved_alias_count"] == 1


def test_missing_evidence_id_rejected(tmp_path: Path):
    row = approved_alias()
    row["evidence_ir_ids"] = ["missing-id"]
    records_path, index_path, aliases_path = make_fixture(tmp_path, [row])

    with pytest.raises(AliasValidationError, match="evidence ir_id"):
        validate_alias_table(aliases_path, records_path, index_path)


def test_unresolved_canonical_source_term_rejected(tmp_path: Path):
    row = approved_alias(canonical_source_terms=["not-indexed"])
    records_path, index_path, aliases_path = make_fixture(tmp_path, [row])

    with pytest.raises(AliasValidationError, match="canonical source term"):
        validate_alias_table(aliases_path, records_path, index_path)


def test_resolved_ir_ids_mismatch_rejected(tmp_path: Path):
    row = approved_alias(resolved_ir_ids=["id-grand"])
    records_path, index_path, aliases_path = make_fixture(tmp_path, [row])

    with pytest.raises(AliasValidationError, match="resolved_ir_ids mismatch"):
        validate_alias_table(aliases_path, records_path, index_path)


def test_missing_resolved_ir_id_rejected(tmp_path: Path):
    row = approved_alias(resolved_ir_ids=["missing-id"])
    # Make the canonical posting agree with the stale alias row so this test
    # specifically exercises records.jsonl existence validation.
    index_rows = base_index_rows() + [
        {"key": "stale", "key_type": "src_casefold", "ir_ids": ["missing-id"]}
    ]
    row["canonical_source_terms"] = ["stale"]
    records_path, index_path, aliases_path = make_fixture(
        tmp_path, [row], index_rows=index_rows
    )

    with pytest.raises(AliasValidationError, match="resolved ir_id"):
        validate_alias_table(aliases_path, records_path, index_path)


def test_mixed_schema_versions_rejected(tmp_path: Path):
    row_a = approved_alias(alias_id="alias-a")
    row_b = approved_alias(alias_id="alias-b")
    row_b["schema_version"] = "source_alias_table_v2"
    records_path, index_path, aliases_path = make_fixture(tmp_path, [row_a, row_b])

    with pytest.raises(AliasValidationError, match="mixed schema_version"):
        validate_alias_table(aliases_path, records_path, index_path)


def test_mixed_alias_table_versions_rejected(tmp_path: Path):
    row_a = approved_alias(alias_id="alias-a")
    row_b = approved_alias(alias_id="alias-b")
    row_b["alias_table_version"] = "other-release"
    records_path, index_path, aliases_path = make_fixture(tmp_path, [row_a, row_b])

    with pytest.raises(AliasValidationError, match="mixed alias_table_version"):
        validate_alias_table(aliases_path, records_path, index_path)


def test_existing_key_with_different_posting_set_hard_conflict(tmp_path: Path):
    index_rows = base_index_rows() + [
        {"key": "yeux", "key_type": "src_casefold", "ir_ids": ["id-grand"]}
    ]
    records_path, index_path, aliases_path = make_fixture(
        tmp_path, [approved_alias()], index_rows=index_rows
    )

    with pytest.raises(AliasApplicationError, match="conflicts with existing postings"):
        apply_approved_aliases(
            aliases_path,
            records_path,
            index_path,
            tmp_path / "out.jsonl",
            tmp_path / "report.json",
        )


def test_existing_key_with_same_set_different_order_is_hard_conflict(tmp_path: Path):
    index_rows = base_index_rows() + [
        {"key": "alias-multi", "key_type": "src_casefold", "ir_ids": ["id-a", "id-z"]}
    ]
    row = approved_alias(
        alias_source_term="alias-multi",
        canonical_source_terms=["multi-alpha"],
        resolved_ir_ids=["id-z", "id-a"],
    )
    records_path, index_path, aliases_path = make_fixture(tmp_path, [row], index_rows=index_rows)

    with pytest.raises(AliasApplicationError, match="conflicts with existing postings"):
        apply_approved_aliases(
            aliases_path,
            records_path,
            index_path,
            tmp_path / "out.jsonl",
            tmp_path / "report.json",
        )


def test_existing_key_with_identical_posting_set_is_no_op(tmp_path: Path):
    index_rows = list(base_index_rows())
    for key_type, key in search_keys_for_source_term("Yeux"):
        index_rows.append({"key": key, "key_type": key_type, "ir_ids": ["id-oeil"]})
    records_path, index_path, aliases_path = make_fixture(
        tmp_path, [approved_alias()], index_rows=index_rows
    )

    apply_approved_aliases(
        aliases_path,
        records_path,
        index_path,
        tmp_path / "out.jsonl",
        tmp_path / "report.json",
    )

    report = json.loads((tmp_path / "report.json").read_text(encoding="utf-8"))
    assert report["alias_tables"][0]["applied_alias_count"] == 0
    assert report["alias_tables"][0]["skipped_alias_count"] == 1
    assert report["aliases"][0]["outcome"] == "skipped"


def test_candidate_rejected_deferred_rows_validate_but_do_not_apply(tmp_path: Path):
    rows = [
        approved_alias(alias_id="candidate", status="candidate"),
        approved_alias(alias_id="rejected", status="rejected"),
        approved_alias(alias_id="deferred", status="deferred"),
    ]
    records_path, index_path, aliases_path = make_fixture(tmp_path, rows)

    result = validate_alias_table(aliases_path, records_path, index_path)
    apply_approved_aliases(
        aliases_path,
        records_path,
        index_path,
        tmp_path / "out.jsonl",
        tmp_path / "report.json",
    )

    report = json.loads((tmp_path / "report.json").read_text(encoding="utf-8"))
    assert result.summary["approved_alias_count"] == 0
    assert report["alias_tables"][0]["applied_alias_count"] == 0
    assert report["aliases"] == []


def test_application_is_deterministic_and_records_unchanged(tmp_path: Path):
    rows = [
        approved_alias(
            alias_id="alias-yeux",
            alias_source_term="Yeux",
            canonical_source_terms=["oeil"],
            resolved_ir_ids=["id-oeil"],
        ),
        approved_alias(
            alias_id="alias-grande",
            alias_source_term="Grande",
            canonical_source_terms=["grand"],
            resolved_ir_ids=["id-grand"],
        ),
        approved_alias(
            alias_id="alias-jumelle",
            alias_source_term="jumelle",
            canonical_source_terms=["jumeau"],
            resolved_ir_ids=["id-jumeau"],
        ),
    ]
    records_path, index_path, aliases_path = make_fixture(tmp_path, rows)
    before_records = records_path.read_bytes()

    apply_approved_aliases(
        aliases_path,
        records_path,
        index_path,
        tmp_path / "out_a.jsonl",
        tmp_path / "report_a.json",
    )
    apply_approved_aliases(
        aliases_path,
        records_path,
        index_path,
        tmp_path / "out_b.jsonl",
        tmp_path / "report_b.json",
    )

    assert records_path.read_bytes() == before_records
    assert (tmp_path / "out_a.jsonl").read_bytes() == (tmp_path / "out_b.jsonl").read_bytes()
    assert (tmp_path / "report_a.json").read_bytes() == (tmp_path / "report_b.json").read_bytes()


def test_base_index_posting_order_is_preserved_after_application(tmp_path: Path):
    row = approved_alias()
    records_path, index_path, aliases_path = make_fixture(tmp_path, [row])
    output_index = tmp_path / "out.jsonl"

    apply_approved_aliases(
        aliases_path,
        records_path,
        index_path,
        output_index,
        tmp_path / "report.json",
    )

    base_rows_by_key = {
        (row["key_type"], row["key"]): row["ir_ids"] for row in read_jsonl(index_path)
    }
    out_rows_by_key = {
        (row["key_type"], row["key"]): row["ir_ids"] for row in read_jsonl(output_index)
    }
    assert out_rows_by_key[("src_diacritics_insensitive", "mere")] == ["id-z", "id-a"]
    for key, ir_ids in base_rows_by_key.items():
        assert out_rows_by_key[key] == ir_ids


def test_multi_canonical_alias_resolution_preserves_order_and_deduplicates(tmp_path: Path):
    row = approved_alias(
        alias_source_term="alias-multi",
        canonical_source_terms=["multi-alpha", "multi-beta"],
        resolved_ir_ids=["id-z", "id-a", "id-b", "id-c"],
    )
    records_path, index_path, aliases_path = make_fixture(tmp_path, [row])
    output_index = tmp_path / "out.jsonl"

    result = validate_alias_table(aliases_path, records_path, index_path)
    apply_approved_aliases(
        aliases_path,
        records_path,
        index_path,
        output_index,
        tmp_path / "report.json",
    )

    assert result.outcomes[0].resolved_ir_ids == ["id-z", "id-a", "id-b", "id-c"]
    assert lookup(output_index, "source_to_target", "alias-multi") == [
        "id-z",
        "id-a",
        "id-b",
        "id-c",
    ]


def test_lookup_behavior_and_non_goals(tmp_path: Path):
    rows = [
        approved_alias("alias-yeux", "Yeux", ["oeil"], ["id-oeil"]),
        approved_alias("alias-grande", "Grande", ["grand"], ["id-grand"]),
        approved_alias("alias-jumelle", "jumelle", ["jumeau"], ["id-jumeau"]),
        approved_alias(
            "alias-grandparents",
            "grand-parents",
            ["grand-mère", "grand-père"],
            ["id-grandmere", "id-grandpere"],
            status="deferred",
        ),
    ]
    records_path, index_path, aliases_path = make_fixture(tmp_path, rows)
    output_index = tmp_path / "out.jsonl"

    apply_approved_aliases(
        aliases_path,
        records_path,
        index_path,
        output_index,
        tmp_path / "report.json",
    )

    assert lookup(output_index, "source_to_target", "Yeux") == lookup(
        output_index, "source_to_target", "oeil"
    )
    assert lookup(output_index, "source_to_target", "Grande") == lookup(
        output_index, "source_to_target", "grand"
    )
    assert lookup(output_index, "source_to_target", "jumelle") == lookup(
        output_index, "source_to_target", "jumeau"
    )
    assert lookup(output_index, "source_to_target", "grand-parents") == []
    assert lookup(output_index, "source_to_target", "Ferme la bouche") == []
    assert lookup(output_index, "source_to_target", "Grand chose") == []
    assert lookup(output_index, "source_to_target", "grande bouche") == []
    assert lookup(output_index, "source_to_target", "mere") == ["id-z", "id-a"]
    assert lookup(output_index, "target_to_source", "Kun") == ["id-kun"]
