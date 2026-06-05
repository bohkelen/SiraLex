import json
from pathlib import Path

from source_index_gap_discovery.mine_candidates import build_report
from source_index_gap_discovery.normalization import source_search_keys
from source_index_gap_discovery.reporting import write_report


def write_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")


def lexicon_record(ir_id: str, preferred_form: str, gloss_fr: str) -> dict:
    return {
        "ir_id": ir_id,
        "ir_kind": "lexicon_entry",
        "source_id": "src_test",
        "norm_version": "norm_v3",
        "preferred_form": preferred_form,
        "variant_forms": [preferred_form],
        "search_keys": source_search_keys(preferred_form),
        "display": {
            "headword_latin": preferred_form,
            "senses": [{"gloss_fr": gloss_fr}],
        },
    }


def index_mapping_record(ir_id: str, source_term: str, target_form: str) -> dict:
    return {
        "ir_id": ir_id,
        "ir_kind": "index_mapping",
        "source_id": "src_test",
        "norm_version": "norm_v3",
        "preferred_form": source_term,
        "variant_forms": [source_term],
        "search_keys": source_search_keys(source_term),
        "display": {
            "source_term": source_term,
            "source_lang": "fr",
            "target_entries": [{"display_text": target_form}],
        },
    }


def source_index_rows(records: list[dict]) -> list[dict]:
    rows: list[dict] = []
    for record in records:
        if record["ir_kind"] != "index_mapping":
            continue
        for key_type, keys in record["search_keys"].items():
            for key in keys:
                rows.append({
                    "key_type": f"src_{key_type}",
                    "key": key,
                    "ir_ids": [record["ir_id"]],
                })
    return rows


def write_bundle(tmp_path: Path) -> Path:
    bundle_dir = tmp_path / "bundle_full_test"
    records = [
        lexicon_record("id-si", "sí", "poil, poils, toison, pelage de la tête"),
        lexicon_record("id-oncle-mat", "bárin", "oncle maternel"),
        lexicon_record("id-oncle-pat", "bɛ́nɔɔ", "oncle paternel"),
        lexicon_record("id-tanten", "tɛ́nɛn", "tante paternelle"),
        lexicon_record("id-rang", "kɔ́rɔ", "frère aîné, cadet"),
        lexicon_record("id-animal", "wari", "animal sauvage"),
        lexicon_record("id-arbre", "yiri", "arbre fruitier"),
        lexicon_record("id-plurals", "bolo", "main, mains, jour, jours, pied, pieds, fruit, fruits"),
        index_mapping_record("idx-pelage", "pelage", "sí"),
        index_mapping_record("idx-toison", "toison", "sí"),
        index_mapping_record("idx-oncle-mat", "oncle maternel", "bárin"),
        index_mapping_record("idx-oncle-pat", "oncle paternel", "bɛ́nɔɔ"),
        index_mapping_record("idx-tante", "tante", "nàlaka"),
        index_mapping_record("idx-tante-pat", "tante paternelle", "tɛ́nɛn"),
        index_mapping_record("idx-animal", "animal", "wari"),
        index_mapping_record("idx-animal-sauvage", "animal sauvage", "wulaba"),
        index_mapping_record("idx-arbre", "arbre", "yiri"),
        index_mapping_record("idx-arbre-fruitier", "arbre fruitier", "yiriden"),
        index_mapping_record("idx-main", "main", "bolo"),
        index_mapping_record("idx-jour", "jour", "lon"),
        index_mapping_record("idx-pied", "pied", "sen"),
    ]
    bundle_dir.mkdir()
    (bundle_dir / "bundle.manifest.json").write_text(
        json.dumps({
            "manifest_schema_version": "bundle_manifest_v1",
            "bundle_id": "bundle_full_test",
            "content_sha256": "sha256:test",
        }),
        encoding="utf-8",
    )
    write_jsonl(bundle_dir / "records.jsonl", records)
    write_jsonl(bundle_dir / "search_index.jsonl", source_index_rows(records))
    return bundle_dir


def rows_by_term(bundle_dir: Path) -> dict[str, dict]:
    report = build_report(bundle_dir)
    return {row.candidate_french_term: row.to_dict() for row in report.rows}


def test_known_examples_surface_with_expected_categories(tmp_path: Path) -> None:
    rows = rows_by_term(write_bundle(tmp_path))

    assert rows["poil"]["candidate_type"] == "missing_standalone_source_term"
    assert rows["poil"]["actionability"] == "review_candidate"
    assert rows["poil"]["review_tier"] in {
        "tier_1_strong_candidate",
        "tier_2_interesting_candidate",
    }
    assert rows["poil"]["proposed_representation"] == "new_source_mapping"

    assert rows["poils"]["candidate_type"] == "missing_standalone_source_term"
    assert any("plural_linked_to:poil" in reason for reason in rows["poils"]["score_reasons"])
    assert rows["poils"]["canonical_candidate_term"] == "poil"

    assert rows["oncle"]["candidate_type"] == "missing_broad_umbrella_term"
    assert rows["oncle"]["actionability"] == "review_candidate"
    assert rows["oncle"]["review_tier"] == "tier_1_strong_candidate"
    assert rows["oncle"]["proposed_representation"] == "broad_umbrella_source_mapping"

    assert rows["tante"]["candidate_type"] == "suspected_incomplete_existing_source_mapping"
    assert rows["tante"]["actionability"] == "review_candidate"
    assert rows["tante"]["review_tier"] == "tier_2_interesting_candidate"
    assert rows["tante"]["proposed_representation"] == "additive_source_mapping"


def test_existing_broad_terms_with_phrase_evidence_are_evidence_only(tmp_path: Path) -> None:
    rows = rows_by_term(write_bundle(tmp_path))

    for term in ["animal", "arbre"]:
        assert rows[term]["candidate_type"] == "existing_source_with_related_phrases"
        assert rows[term]["actionability"] == "evidence_only"
        assert rows[term]["review_tier"] == "tier_3_evidence_only"
        assert rows[term]["proposed_representation"] == "do_not_apply"


def test_plural_grouping_rolls_up_obvious_final_s_variants(tmp_path: Path) -> None:
    rows = rows_by_term(write_bundle(tmp_path))

    for singular, plural in [("main", "mains"), ("jour", "jours")]:
        assert rows[plural]["plural_linked_to"] == singular
        assert rows[plural]["canonical_candidate_term"] == singular
        assert rows[singular]["canonical_candidate_term"] == singular
        assert rows[singular]["observed_variants"] == [singular, plural]
        assert rows[plural]["observed_variants"] == [singular, plural]
        assert rows[plural]["candidate_type"] == "plural_form_gap"
        assert rows[plural]["review_tier"] == "tier_2_interesting_candidate"
        assert rows[plural]["proposed_representation"] == "reviewed_plural_alias"


def test_plural_form_gaps_do_not_become_missing_source_mappings(tmp_path: Path) -> None:
    rows = rows_by_term(write_bundle(tmp_path))

    for plural in ["mains", "jours", "pieds"]:
        assert rows[plural]["candidate_type"] == "plural_form_gap"
        assert rows[plural]["actionability"] == "review_candidate"
        assert rows[plural]["review_tier"] == "tier_2_interesting_candidate"
        assert rows[plural]["proposed_representation"] == "reviewed_plural_alias"
        assert rows[plural]["proposed_representation"] != "new_source_mapping"

    # No singular source lookup exists for poil in this fixture, so poils remains
    # a missing-term pattern rather than an ordinary plural recall alias.
    assert rows["poils"]["candidate_type"] == "missing_standalone_source_term"


def test_stopwords_and_modifiers_are_downgraded(tmp_path: Path) -> None:
    rows = rows_by_term(write_bundle(tmp_path))

    assert rows["de"]["candidate_type"] == "likely_stopword_or_noise"
    assert rows["de"]["actionability"] == "noise"
    assert rows["la"]["candidate_type"] == "likely_stopword_or_noise"
    assert rows["la"]["actionability"] == "noise"

    for term in ["maternel", "paternel", "paternelle", "cadet", "aîné"]:
        assert rows[term]["candidate_type"] == "modifier_or_low_value_term"
        assert rows[term]["actionability"] == "evidence_only"
        assert rows[term]["proposed_representation"] == "do_not_apply"


def test_report_writes_only_review_outputs(tmp_path: Path) -> None:
    report = build_report(write_bundle(tmp_path))
    output_dir = tmp_path / "reports"
    paths = write_report(output_dir, report)

    assert sorted(path.name for path in paths.values()) == [
        "source_index_gap_candidates.csv",
        "source_index_gap_candidates.jsonl",
        "source_index_gap_summary.md",
    ]
    assert not (output_dir / "source_index_supplements_v1.jsonl").exists()
    assert not (output_dir / "source_aliases_v1.jsonl").exists()

    first_row = json.loads(paths["jsonl"].read_text(encoding="utf-8").splitlines()[0])
    assert first_row["implementation_decision"] == "pending_review"
    assert "actionability" in first_row
    assert "review_tier" in first_row
    assert "canonical_candidate_term" in first_row
    assert "observed_variants" in first_row

    summary = paths["summary"].read_text(encoding="utf-8")
    assert "## Top Tier 1 Candidates" in summary
    assert "## Top Missing Standalone Candidates" in summary
    assert "## Top Missing Umbrella Candidates" in summary
    assert "## Top Plural/Form Recall Candidates" in summary
    assert "## Top Suspected Incomplete Existing Mappings" in summary
    assert "## Existing Source Terms With Related Phrases" in summary
    assert "## Evidence-Only Modifier List" in summary
    assert "## Noise Count" in summary


def test_current_featured_bundle_reflects_phase7b_state() -> None:
    repo_root = Path(__file__).resolve().parents[3]
    bundle_dir = repo_root / "web/public/bundle_full_20260603_d0e4f812"
    report = build_report(bundle_dir)
    rows = {row.candidate_french_term: row.to_dict() for row in report.rows}

    assert rows["poil"]["candidate_type"] != "missing_standalone_source_term"
    assert rows["poil"]["current_lookup_behavior"].startswith("existing source lookup")
    assert rows["poils"]["candidate_type"] != "missing_standalone_source_term"
    assert rows["poils"]["current_lookup_behavior"].startswith("existing source lookup")

    assert rows["oncle"]["candidate_type"] == "missing_broad_umbrella_term"
    assert rows["oncle"]["review_tier"] == "tier_1_strong_candidate"

    assert rows["animal"]["review_tier"] != "tier_1_strong_candidate"
    assert rows["arbre"]["review_tier"] != "tier_1_strong_candidate"
