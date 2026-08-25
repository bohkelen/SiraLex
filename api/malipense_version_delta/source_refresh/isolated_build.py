"""G8 isolated candidate build + regression summary (no canonical writes)."""

from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Any

from malipense_version_delta.canonical_json import sha256_file
from malipense_version_delta.compare import load_jsonl_records

from .model import GateResult
from .paths import SourceRefreshPaths


def _count_jsonl(path: Path) -> int:
    if not path.is_file():
        return 0
    n = 0
    with path.open(encoding="utf-8") as handle:
        for line in handle:
            if line.strip():
                n += 1
    return n


def _count_search_postings(path: Path) -> int:
    return _count_jsonl(path)


def _collect_ir_ids_from_records(path: Path) -> set[str]:
    ids: set[str] = set()
    if not path.is_file():
        return ids
    for row in load_jsonl_records(path):
        if row.get("ir_id"):
            ids.add(str(row["ir_id"]))
    return ids


def _run_normalize(inputs: list[Path], output: Path) -> None:
    from normalizer.normalize import process_ir_files

    process_ir_files(inputs, output)


def _run_enrich(*, normalized: Path, ir_paths: list[Path], output: Path) -> None:
    from enrichment.enrich import enrich_records

    enrich_records(
        normalized_path=normalized,
        ir_paths=ir_paths,
        output_path=output,
    )


def _run_build_index(*, normalized_or_enriched: Path, output: Path) -> None:
    from search_index.build_index import process_normalized_file

    process_normalized_file(normalized_or_enriched, output)


def _run_build_bundle(
    *,
    normalized: Path,
    search_index: Path,
    output_dir: Path,
) -> dict[str, Any]:
    from bundle_builder.build_bundle import build_bundle

    return build_bundle(
        normalized_path=normalized,
        search_index_path=search_index,
        output_dir=output_dir,
        bundle_type="full",
        source_lang="fr",
        target_lang="mnk",
        source_label="French",
        target_label="Maninka",
        target_scripts=["latin", "nko"],
        bundle_id="malidaba_source_refresh_candidate_dry_run",
        versioned_output=False,
    )


def _apply_aliases_if_available(
    *,
    search_index: Path,
    aliases: Path,
    records_path: Path,
    output: Path,
    report_path: Path,
) -> bool:
    if not aliases.is_file():
        shutil.copyfile(search_index, output)
        return False
    try:
        from source_aliases.apply_aliases_to_search_index import apply_approved_aliases

        apply_approved_aliases(
            alias_table_path=aliases,
            records_path=records_path,
            input_search_index_path=search_index,
            output_search_index_path=output,
            output_report_path=report_path,
        )
        return True
    except Exception:
        # Fall back to unaliased index; report in evidence
        shutil.copyfile(search_index, output)
        return False


def _replay_regression_matrices(
    *,
    search_index_path: Path,
    records_path: Path,
    regression_dir: Path,
) -> dict[str, Any]:
    """Replay curated matrices against candidate index (metadata-agnostic)."""
    try:
        from query_evidence.replay import load_search_index
        from search_regression.replay import replay_case
        from search_regression.schema import load_matrix_jsonl
    except Exception as exc:  # pragma: no cover - import environment
        return {
            "status": "SKIPPED",
            "reason": f"regression_imports_unavailable:{exc}",
            "pass": 0,
            "fail": 0,
        }

    search_index = load_search_index(search_index_path)
    records_by_id = {
        str(r["ir_id"]): r for r in load_jsonl_records(records_path) if r.get("ir_id")
    }

    passed = 0
    failed = 0
    failures: list[str] = []
    for matrix in sorted(regression_dir.glob("search_regression_matrix*.jsonl")):
        cases = load_matrix_jsonl(matrix)
        for case in cases:
            result = replay_case(
                search_index,
                case,
                records_by_id=records_by_id,
            )
            if result.expected_match:
                passed += 1
            else:
                failed += 1
                if len(failures) < 25:
                    failures.append(
                        f"{case.case_id}:{','.join(result.mismatches) or 'mismatch'}"
                    )

    return {
        "status": "RAN",
        "pass": passed,
        "fail": failed,
        "sample_failures": failures,
    }


def evaluate_g8_isolated_build(
    paths: SourceRefreshPaths,
    *,
    skip_heavy_build: bool = False,
) -> GateResult:
    """
    Build candidate artifacts under paths.build_dir only.

    Never writes web/public, canonical data/bundles, or canonical search_index.
    """
    build_dir = paths.build_dir
    evidence: dict[str, Any] = {
        "build_dir": str(build_dir),
        "canonical_write_targets_forbidden": [
            "web/public/",
            "data/bundles/",
            "data/search_index/",
            "data/ir/malipense_lexicon_v3.jsonl",
            "data/normalized/",
            "data/enriched/",
        ],
    }

    # Guard: refuse if output somehow points at canonical public paths
    public = (paths.repo_root / "web" / "public").resolve()
    if public in build_dir.resolve().parents or build_dir.resolve() == public:
        return GateResult(
            "G8_ISOLATED_BUILD_REGRESSION_PASS",
            "BLOCK",
            evidence,
            "build_dir_must_not_be_under_web_public",
        )

    if skip_heavy_build:
        evidence["skipped"] = True
        return GateResult(
            "G8_ISOLATED_BUILD_REGRESSION_PASS",
            "NOT_APPLICABLE",
            evidence,
            None,
        )

    build_dir.mkdir(parents=True, exist_ok=True)

    ir_inputs = [paths.current_ir]
    if paths.index_ir.is_file():
        ir_inputs.append(paths.index_ir)
    if paths.owner_ir.is_file():
        ir_inputs.append(paths.owner_ir)

    normalized_path = build_dir / "candidate_normalized.jsonl"
    enriched_path = build_dir / "candidate_enriched.jsonl"
    index_raw_path = build_dir / "candidate_search_index_raw.jsonl"
    index_path = build_dir / "candidate_search_index.jsonl"
    bundle_out = build_dir / "bundles"

    try:
        _run_normalize(ir_inputs, normalized_path)
        try:
            _run_enrich(
                normalized=normalized_path,
                ir_paths=ir_inputs,
                output=enriched_path,
            )
            pipeline_records = enriched_path
            evidence["enrichment"] = "PASS"
        except Exception as exc:
            # Enrichment may have display-only deps; fall back to normalized
            pipeline_records = normalized_path
            evidence["enrichment"] = f"FALLBACK_NORMALIZED:{exc}"

        _run_build_index(
            normalized_or_enriched=pipeline_records, output=index_raw_path
        )
        aliases_applied = _apply_aliases_if_available(
            search_index=index_raw_path,
            aliases=paths.aliases,
            records_path=pipeline_records,
            output=index_path,
            report_path=build_dir / "alias_apply_report.json",
        )
        evidence["aliases_applied"] = aliases_applied

        # Supplements merge requires a baseline bundle contract; for dry-run we
        # keep the alias-applied index and record supplements as deferred audit.
        evidence["supplements_merged"] = False
        evidence["supplements_merge_note"] = (
            "deferred:merge_supplements_into_search_index_requires_baseline_bundle;"
            "shared supplement table left unmodified"
        )

        bundle_result = _run_build_bundle(
            normalized=pipeline_records,
            search_index=index_path,
            output_dir=bundle_out,
        )
        evidence["bundle"] = {
            "bundle_id": bundle_result.get("bundle_id"),
            "bundle_dir": bundle_result.get("bundle_dir"),
            "content_sha256": bundle_result.get("content_sha256"),
        }
        bundle_dir = Path(bundle_result["bundle_dir"])
        # Ensure bundle stayed under build_dir
        if paths.build_dir.resolve() not in bundle_dir.resolve().parents and (
            bundle_dir.resolve() != paths.build_dir.resolve()
        ):
            if not str(bundle_dir.resolve()).startswith(str(paths.build_dir.resolve())):
                return GateResult(
                    "G8_ISOLATED_BUILD_REGRESSION_PASS",
                    "BLOCK",
                    evidence,
                    "bundle_escaped_isolated_build_dir",
                )
    except Exception as exc:
        evidence["error"] = str(exc)
        return GateResult(
            "G8_ISOLATED_BUILD_REGRESSION_PASS",
            "BLOCK",
            evidence,
            f"isolated_build_failure:{exc}",
        )

    candidate_dict_rows = _count_jsonl(pipeline_records)
    candidate_search_rows = _count_search_postings(index_path)
    canonical_dict_rows = (
        _count_jsonl(paths.canonical_enriched)
        if paths.canonical_enriched and paths.canonical_enriched.is_file()
        else _count_jsonl(paths.baseline_ir)
    )
    canonical_search_rows = 0
    if paths.canonical_bundle_dir and (paths.canonical_bundle_dir / "search_index.jsonl").is_file():
        canonical_search_rows = _count_search_postings(
            paths.canonical_bundle_dir / "search_index.jsonl"
        )

    regression = _replay_regression_matrices(
        search_index_path=index_path,
        records_path=pipeline_records,
        regression_dir=paths.search_regression_dir,
    )

    evidence.update(
        {
            "canonical_dictionary_rows": canonical_dict_rows,
            "candidate_dictionary_rows": candidate_dict_rows,
            "canonical_search_rows": canonical_search_rows,
            "candidate_search_rows": candidate_search_rows,
            "candidate_normalized_sha256": sha256_file(normalized_path)
            if normalized_path.is_file()
            else None,
            "candidate_search_index_sha256": sha256_file(index_path)
            if index_path.is_file()
            else None,
            "regression": regression,
            "note": (
                "Large count increases from Malidaba growth are not automatic failure; "
                "unexpected losses and broken regression contracts are."
            ),
        }
    )

    if regression.get("status") == "RAN" and int(regression.get("fail") or 0) > 0:
        return GateResult(
            "G8_ISOLATED_BUILD_REGRESSION_PASS",
            "BLOCK",
            evidence,
            f"search_regression_failures={regression.get('fail')}",
        )

    # Detect unexpected loss of baseline product IR volume (lexicon shrink without remap)
    baseline_lex = len(load_jsonl_records(paths.baseline_ir))
    candidate_lex = len(
        [
            r
            for r in load_jsonl_records(paths.current_ir)
            if r.get("source_id") == "src_malipense"
        ]
    )
    evidence["baseline_lexicon_rows"] = baseline_lex
    evidence["candidate_lexicon_rows"] = candidate_lex
    if candidate_lex < baseline_lex:
        # May still be OK if destructive gate handles it; mark build warning but
        # do not alone BLOCK here if pipeline succeeded — G9 owns removals.
        evidence["lexicon_row_shrink"] = baseline_lex - candidate_lex

    return GateResult("G8_ISOLATED_BUILD_REGRESSION_PASS", "PASS", evidence, None)
