import json

from analyze_query_logs import parse_jsonl, render_markdown, summarize


def write_jsonl(path, rows):
    path.write_text("\n".join(json.dumps(row, ensure_ascii=False) for row in rows) + "\n", encoding="utf-8")


def base_row(**overrides):
    row = {
        "schema_version": "query_log_event_v1",
        "query_raw": "amour",
        "query_normalized_keys": {
            "casefold": ["amour"],
            "diacritics_insensitive": ["amour"],
            "punct_stripped": ["amour"],
            "nospace": ["amour"],
        },
        "direction": "source_to_target",
        "ladder_level_hit": "casefold",
        "ir_ids_count": 1,
        "bundle_id": "bundle_full_20260518_15605571",
        "bundle_version": "20260518",
        "storage_scope_id": "scope",
        "norm_version": "norm_v3",
        "app_version": "0.0.0",
        "timestamp_iso": "2026-06-01T12:00:00Z",
        "logging_enabled": True,
    }
    row.update(overrides)
    return row


def test_summarize_counts_hits_misses_and_versions(tmp_path):
    export = tmp_path / "logs.jsonl"
    write_jsonl(
        export,
        [
            base_row(query_raw="amour", ir_ids_count=2, ladder_level_hit="casefold"),
            base_row(query_raw="bon matin", ir_ids_count=0, ladder_level_hit="none"),
            base_row(query_raw="bon matin", ir_ids_count=0, ladder_level_hit="none"),
            base_row(
                query_raw="kùn",
                direction="target_to_source",
                ir_ids_count=1,
                ladder_level_hit="diacritics_insensitive",
            ),
        ],
    )

    rows, errors = parse_jsonl([export])
    summary = summarize(rows, errors, top=10)

    assert summary["total_queries"] == 4
    assert summary["hits"] == 2
    assert summary["misses"] == 2
    assert summary["hit_rate"] == 0.5
    assert summary["unique_queries"] == 3
    assert summary["repeated_misses"] == [
        {"query": "bon matin", "direction": "source_to_target", "count": 2}
    ]
    assert summary["bundle_versions"] == [{"value": "20260518", "count": 4}]
    assert summary["norm_versions"] == [{"value": "norm_v3", "count": 4}]
    assert summary["manual_classification_candidates"][0]["candidate_reasons"] == [
        "miss",
        "repeated_miss",
        "phrase_like",
    ]


def test_parse_jsonl_reports_bad_lines(tmp_path):
    export = tmp_path / "logs.jsonl"
    export.write_text('{"query_raw": "missing fields"}\nnot-json\n', encoding="utf-8")

    rows, errors = parse_jsonl([export])
    summary = summarize(rows, errors)

    assert rows == []
    assert len(summary["parse_errors"]) == 2


def test_render_markdown_includes_manual_queue(tmp_path):
    export = tmp_path / "logs.jsonl"
    write_jsonl(export, [base_row(query_raw="merci beaucoup", ir_ids_count=0, ladder_level_hit="none")])

    rows, errors = parse_jsonl([export])
    markdown = render_markdown(summarize(rows, errors))

    assert "Total queries: 1" in markdown
    assert "`merci beaucoup` direction=source_to_target" in markdown
    assert "reasons=miss,phrase_like" in markdown
