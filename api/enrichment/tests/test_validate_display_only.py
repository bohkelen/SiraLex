"""Tests for validate_enrichment_display_only gate."""

from pathlib import Path

import pytest

from enrichment.validate_enrichment_display_only import (
    validate_display_only,
)


def test_pass_when_only_display_added(tmp_path: Path) -> None:
    base = Path(tmp_path / "norm.jsonl")
    enr = Path(tmp_path / "enriched.jsonl")
    line_b = '{"ir_id":"a","ir_kind":"lexicon_entry","source_id":"s","norm_version":"norm_v3","preferred_form":"x","variant_forms":["x"],"search_keys":{"casefold":["x"]}}\n'
    base.write_text(line_b, encoding="utf-8")
    rec = (
        '{"ir_id":"a","ir_kind":"lexicon_entry","source_id":"s","norm_version":"norm_v3",'
        '"preferred_form":"x","variant_forms":["x"],"search_keys":{"casefold":["x"]},'
        '"display":{"headword_latin":"x"}}\n'
    )
    enr.write_text(rec, encoding="utf-8")

    from enrichment.validate_enrichment_display_only import _load_jsonl_by_ir_id

    b, _ = _load_jsonl_by_ir_id(base)
    e, _ = _load_jsonl_by_ir_id(enr)
    assert validate_display_only(b, e) == []


def test_pass_when_display_and_record_locator_added(tmp_path: Path) -> None:
    from enrichment.validate_enrichment_display_only import _load_jsonl_by_ir_id

    base = Path(tmp_path / "norm.jsonl")
    enr = Path(tmp_path / "enriched.jsonl")
    line_b = (
        '{"ir_id":"a","ir_kind":"lexicon_entry","source_id":"s","norm_version":"norm_v3",'
        '"preferred_form":"x","variant_forms":["x"],"search_keys":{"casefold":["x"]}}\n'
    )
    base.write_text(line_b, encoding="utf-8")
    rec = (
        '{"ir_id":"a","ir_kind":"lexicon_entry","source_id":"s","norm_version":"norm_v3",'
        '"preferred_form":"x","variant_forms":["x"],"search_keys":{"casefold":["x"]},'
        '"display":{"headword_latin":"x"},'
        '"record_locator":{"kind":"source_record_id","url_canonical":"https://example.com/x",'
        '"source_record_id":"e1","anchor_names":["x"]}}\n'
    )
    enr.write_text(rec, encoding="utf-8")

    b, _ = _load_jsonl_by_ir_id(base)
    e, _ = _load_jsonl_by_ir_id(enr)
    assert validate_display_only(b, e) == []


def test_fail_when_record_locator_missing_source_record_id(tmp_path: Path) -> None:
    from enrichment.validate_enrichment_display_only import _load_jsonl_by_ir_id

    base = Path(tmp_path / "norm.jsonl")
    enr = Path(tmp_path / "enriched.jsonl")
    line_b = (
        '{"ir_id":"a","ir_kind":"lexicon_entry","source_id":"s","norm_version":"norm_v3",'
        '"preferred_form":"x","variant_forms":["x"],"search_keys":{}}\n'
    )
    base.write_text(line_b, encoding="utf-8")
    rec = (
        '{"ir_id":"a","ir_kind":"lexicon_entry","source_id":"s","norm_version":"norm_v3",'
        '"preferred_form":"x","variant_forms":["x"],"search_keys":{},'
        '"display":{"headword_latin":"x"},'
        '"record_locator":{"kind":"source_record_id","url_canonical":"https://example.com/x",'
        '"anchor_names":["x"]}}\n'
    )
    enr.write_text(rec, encoding="utf-8")

    b, _ = _load_jsonl_by_ir_id(base)
    e, _ = _load_jsonl_by_ir_id(enr)
    errs = validate_display_only(b, e)
    assert any("source_record_id" in m for m in errs)


def test_fail_on_missing_display(tmp_path: Path) -> None:
    from enrichment.validate_enrichment_display_only import _load_jsonl_by_ir_id

    raw = '{"ir_id":"a","ir_kind":"lexicon_entry","source_id":"s","norm_version":"norm_v3","preferred_form":"x","variant_forms":["x"],"search_keys":{}}\n'
    base = Path(tmp_path / "b.jsonl")
    base.write_text(raw, encoding="utf-8")
    b, _ = _load_jsonl_by_ir_id(base)
    e, _ = _load_jsonl_by_ir_id(base)
    errs = validate_display_only(b, e)
    assert any("missing display" in m for m in errs)


def test_fail_on_norm_version_change(tmp_path: Path) -> None:
    from enrichment.validate_enrichment_display_only import _load_jsonl_by_ir_id

    bpath = Path(tmp_path / "b.jsonl")
    epath = Path(tmp_path / "e.jsonl")
    bpath.write_text(
        '{"ir_id":"a","ir_kind":"lexicon_entry","source_id":"s","norm_version":"norm_v3",'
        '"preferred_form":"x","variant_forms":["x"],"search_keys":{}}\n',
        encoding="utf-8",
    )
    epath.write_text(
        '{"ir_id":"a","ir_kind":"lexicon_entry","source_id":"s","norm_version":"norm_v2",'
        '"preferred_form":"x","variant_forms":["x"],"search_keys":{},"display":{}}\n',
        encoding="utf-8",
    )
    b, _ = _load_jsonl_by_ir_id(bpath)
    e, _ = _load_jsonl_by_ir_id(epath)
    errs = validate_display_only(b, e)
    assert any("norm_version" in m for m in errs)


def test_gate_script_main_zero(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    from enrichment.validate_enrichment_display_only import main

    base = Path(tmp_path / "n.jsonl")
    enr = Path(tmp_path / "out.jsonl")
    row = (
        '{"ir_id":"z","ir_kind":"index_mapping","source_id":"s","norm_version":"norm_v3",'
        '"preferred_form":"y","variant_forms":["y"],"search_keys":{"tokenized":["y"]}}\n'
    )
    erow = (
        '{"ir_id":"z","ir_kind":"index_mapping","source_id":"s","norm_version":"norm_v3",'
        '"preferred_form":"y","variant_forms":["y"],"search_keys":{"tokenized":["y"]},'
        '"display":{}}\n'
    )
    base.write_text(row, encoding="utf-8")
    enr.write_text(erow, encoding="utf-8")
    code = main(["--baseline", str(base), "--enriched", str(enr)])
    assert code == 0
    assert "PASSED" in capsys.readouterr().out
