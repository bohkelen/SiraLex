"""G1–G6 and G10 gate evaluators for source-refresh acceptance."""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
from typing import Any

from malipense_version_delta.canonical_json import canonical_dumps, sha256_file
from malipense_version_delta.compare import (
    compare_lexicon_records,
    load_jsonl_records,
    parse_lexicon_crawl_to_records,
)
from malipense_version_delta.frozen_inputs import (
    FrozenInputMismatchError,
    verify_frozen_inputs,
)
from malipense_version_delta.parser_compat import (
    assess_parser_compatibility,
    detect_nested_lxp2_in_html,
)
from malipense_version_delta.semantic import semantic_projection
from malipense_version_delta.validate_reviews import (
    find_malidaba_review_leaves,
    validate_malidaba_reviews,
)

from .model import (
    RIGHTS_ALLOWED,
    RIGHTS_BLOCKED,
    RIGHTS_REQUIRES_REVIEW,
    GateResult,
    RightsPosture,
)
from .paths import (
    EXPECTED_BATCH_PAGES,
    EXPECTED_BASELINE_ROWS,
    EXPECTED_BASELINE_WITH_SENSES,
    EXPECTED_CONFIRMED_LEAVES,
    EXPECTED_CURRENT_LEXICON_PAGES,
    EXPECTED_CURRENT_ROWS,
    EXPECTED_CURRENT_WITH_SENSES,
    EXPECTED_REVIEW_LEAVES,
    FROZEN_BASELINE_IR_SHA256,
    FROZEN_CURRENT_IR_SHA256,
    FROZEN_DELTA_SHA256,
    FROZEN_REVIEW_REGISTRY_SHA256,
    OFFICIAL_ORIGIN_PREFIX,
    SourceRefreshPaths,
)


def evaluate_frozen_hashes(paths: SourceRefreshPaths) -> GateResult:
    """Shared frozen-input hash gate used before other evidence gates."""
    try:
        frozen = verify_frozen_inputs(
            baseline_ir_path=paths.baseline_ir,
            current_ir_path=paths.current_ir,
            delta_path=paths.delta,
            crawl_dir=paths.crawl_dir,
        )
    except FrozenInputMismatchError as exc:
        return GateResult(
            gate_id="FROZEN_INPUTS",
            status="BLOCK",
            evidence={},
            block_reason=f"frozen_hash_mismatch:{exc}",
        )

    review_sha = sha256_file(paths.review_registry) if paths.review_registry.is_file() else None
    if review_sha != FROZEN_REVIEW_REGISTRY_SHA256:
        return GateResult(
            gate_id="FROZEN_INPUTS",
            status="BLOCK",
            evidence={"review_registry_sha256": review_sha},
            block_reason=(
                "frozen_hash_mismatch:review_registry "
                f"expected {FROZEN_REVIEW_REGISTRY_SHA256} got {review_sha}"
            ),
        )

    return GateResult(
        gate_id="FROZEN_INPUTS",
        status="PASS",
        evidence={
            "baseline_ir_sha256": frozen.baseline_ir_sha256,
            "current_ir_sha256": frozen.current_ir_sha256,
            "delta_sha256": frozen.delta_sha256,
            "review_registry_sha256": review_sha,
        },
    )


def evaluate_g1_source_capture(paths: SourceRefreshPaths) -> GateResult:
    evidence: dict[str, Any] = {}
    if not paths.capture_receipt.is_file():
        return GateResult(
            "G1_SOURCE_CAPTURE_VALID",
            "BLOCK",
            evidence,
            "missing_capture_receipt",
        )
    receipt = json.loads(paths.capture_receipt.read_text(encoding="utf-8"))
    evidence["capture_receipt"] = {
        "official_origin": receipt.get("official_origin"),
        "crawl_dir": receipt.get("crawl_dir"),
        "offline_zip_note": receipt.get("offline_zip_note"),
    }

    origin = str(receipt.get("official_origin") or "")
    if not origin.startswith(OFFICIAL_ORIGIN_PREFIX.rstrip("/")) and OFFICIAL_ORIGIN_PREFIX not in origin:
        if not origin.startswith("https://www.mali-pense.net/"):
            return GateResult(
                "G1_SOURCE_CAPTURE_VALID",
                "BLOCK",
                evidence,
                f"unofficial_origin:{origin}",
            )

    if not paths.crawl_dir.is_dir():
        return GateResult(
            "G1_SOURCE_CAPTURE_VALID",
            "BLOCK",
            evidence,
            f"missing_crawl_dir:{paths.crawl_dir}",
        )

    snapshots = paths.crawl_dir / "snapshots.jsonl"
    payloads = paths.crawl_dir / "payloads"
    if not snapshots.is_file() or not payloads.is_dir():
        return GateResult(
            "G1_SOURCE_CAPTURE_VALID",
            "BLOCK",
            evidence,
            "crawl_missing_snapshots_or_payloads",
        )

    lexicon_pages = 0
    with snapshots.open(encoding="utf-8") as handle:
        for line in handle:
            row = json.loads(line)
            url = str(row.get("url_canonical") or "")
            if "/emk/lexicon/" in url and url.rstrip("/").endswith(".htm"):
                # count letter pages, not index pages
                name = url.rsplit("/", 1)[-1]
                if name.startswith("index"):
                    continue
                lexicon_pages += 1
    evidence["lexicon_pages"] = lexicon_pages
    if lexicon_pages != EXPECTED_CURRENT_LEXICON_PAGES:
        return GateResult(
            "G1_SOURCE_CAPTURE_VALID",
            "BLOCK",
            evidence,
            f"lexicon_page_count_expected_{EXPECTED_CURRENT_LEXICON_PAGES}_got_{lexicon_pages}",
        )

    zip_note = str(receipt.get("offline_zip_note") or "")
    if "NOT used as current source" not in zip_note and "NOT used" not in zip_note:
        # Soft: receipt must document ZIP is not authority
        evidence["offline_zip_warning"] = "receipt_missing_explicit_non_authority_note"

    current_sha = sha256_file(paths.current_ir)
    evidence["current_ir_sha256"] = current_sha
    if current_sha != FROZEN_CURRENT_IR_SHA256:
        return GateResult(
            "G1_SOURCE_CAPTURE_VALID",
            "BLOCK",
            evidence,
            "current_ir_sha_mismatch_vs_frozen",
        )

    return GateResult("G1_SOURCE_CAPTURE_VALID", "PASS", evidence, None)


def evaluate_g2_parser_compatibility(
    baseline_records: list[dict[str, Any]],
    current_records: list[dict[str, Any]],
    *,
    nested_lxp2_pages: int,
    pages_checked: int,
) -> GateResult:
    compat = assess_parser_compatibility(
        baseline_records,
        current_records,
        nested_lxp2_pages=nested_lxp2_pages,
        pages_checked=pages_checked,
    )
    evidence = {
        "status": compat.status,
        "current_with_senses": compat.current_with_senses,
        "current_no_senses": compat.current_no_senses,
        "nested_lxp2_pages": compat.nested_lxp2_pages,
        "pages_checked": compat.pages_checked,
        "notes": compat.notes,
    }
    if compat.status != "PASS":
        return GateResult(
            "G2_PARSER_COMPATIBILITY_PASS",
            "BLOCK",
            evidence,
            compat.block_reason or "parser_compatibility_fail",
        )
    if nested_lxp2_pages < EXPECTED_CURRENT_LEXICON_PAGES:
        return GateResult(
            "G2_PARSER_COMPATIBILITY_PASS",
            "BLOCK",
            evidence,
            "nested_lxp2_coverage_incomplete",
        )
    return GateResult("G2_PARSER_COMPATIBILITY_PASS", "PASS", evidence, None)


def evaluate_g3_baseline_regression(
    baseline_records: list[dict[str, Any]],
    *,
    baseline_crawl_dir: Path,
    reparse_cache: Path | None = None,
) -> GateResult:
    """Reparse historical crawl and require 0 semantic projection diffs."""
    evidence: dict[str, Any] = {
        "expected_rows": EXPECTED_BASELINE_ROWS,
        "expected_with_senses": EXPECTED_BASELINE_WITH_SENSES,
    }
    if not baseline_crawl_dir.is_dir():
        return GateResult(
            "G3_BASELINE_REGRESSION_PASS",
            "BLOCK",
            evidence,
            f"missing_baseline_crawl:{baseline_crawl_dir}",
        )

    if reparse_cache and reparse_cache.is_file():
        reparsed = load_jsonl_records(reparse_cache)
        evidence["reparse_source"] = str(reparse_cache)
        evidence["reparse_sha256"] = sha256_file(reparse_cache)
    else:
        reparsed, parse_stats = parse_lexicon_crawl_to_records(baseline_crawl_dir)
        evidence["reparse_source"] = "live_parse"
        evidence["parse_stats"] = {
            k: parse_stats.get(k)
            for k in ("entries_parsed", "nested_lxp2_pages", "pages_checked")
        }

    if len(baseline_records) != EXPECTED_BASELINE_ROWS or len(reparsed) != EXPECTED_BASELINE_ROWS:
        evidence["baseline_rows"] = len(baseline_records)
        evidence["reparse_rows"] = len(reparsed)
        return GateResult(
            "G3_BASELINE_REGRESSION_PASS",
            "BLOCK",
            evidence,
            "baseline_row_count_mismatch",
        )

    base_by_key = {
        (
            (r.get("record_locator") or {}).get("url_canonical"),
            (r.get("record_locator") or {}).get("source_record_id"),
        ): r
        for r in baseline_records
    }
    repar_by_key = {
        (
            (r.get("record_locator") or {}).get("url_canonical"),
            (r.get("record_locator") or {}).get("source_record_id"),
        ): r
        for r in reparsed
    }
    if set(base_by_key) != set(repar_by_key):
        return GateResult(
            "G3_BASELINE_REGRESSION_PASS",
            "BLOCK",
            evidence,
            "baseline_identity_key_set_mismatch",
        )

    diffs = 0
    for key, base in base_by_key.items():
        if semantic_projection(base) != semantic_projection(repar_by_key[key]):
            diffs += 1
    with_senses = sum(
        1 for r in reparsed if (r.get("fields_raw") or {}).get("senses")
    )
    evidence["semantic_diff"] = diffs
    evidence["reparse_with_senses"] = with_senses
    if diffs != 0:
        return GateResult(
            "G3_BASELINE_REGRESSION_PASS",
            "BLOCK",
            evidence,
            f"baseline_semantic_diff={diffs}",
        )
    if with_senses != EXPECTED_BASELINE_WITH_SENSES:
        return GateResult(
            "G3_BASELINE_REGRESSION_PASS",
            "BLOCK",
            evidence,
            f"baseline_with_senses_expected_{EXPECTED_BASELINE_WITH_SENSES}_got_{with_senses}",
        )
    return GateResult("G3_BASELINE_REGRESSION_PASS", "PASS", evidence, None)


def evaluate_g4_structural_coverage(current_records: list[dict[str, Any]]) -> GateResult:
    rows = len(current_records)
    with_senses = sum(
        1 for r in current_records if (r.get("fields_raw") or {}).get("senses")
    )
    # F11 definition: structurally expected sense entries == parsed with senses
    # when coverage is healthy (10124/10124). Entries without gloss/Exe/SnsN may
    # still warn structural_lxp2_present_but_no_senses; those are expected
    # no-sense (1570), not unexpected empty parses.
    structurally_expected = EXPECTED_CURRENT_WITH_SENSES
    unexpected = max(0, structurally_expected - with_senses)
    no_sense_total = rows - with_senses
    evidence = {
        "current_rows": rows,
        "structurally_expected_sense_entries": structurally_expected,
        "parsed_with_senses": with_senses,
        "unexpected_no_sense": unexpected,
        "parsed_without_senses_no_structural_gloss": no_sense_total,
        "expected_rows": EXPECTED_CURRENT_ROWS,
        "expected_with_senses": EXPECTED_CURRENT_WITH_SENSES,
        "note": (
            "Generic IDENTITY_AMBIGUOUS delta pairing is out of scope for G4; "
            "this gate only checks current-source structural sense coverage."
        ),
    }
    if rows != EXPECTED_CURRENT_ROWS:
        return GateResult(
            "G4_CURRENT_STRUCTURAL_COVERAGE_PASS",
            "BLOCK",
            evidence,
            "current_row_count_mismatch",
        )
    if with_senses != EXPECTED_CURRENT_WITH_SENSES:
        return GateResult(
            "G4_CURRENT_STRUCTURAL_COVERAGE_PASS",
            "BLOCK",
            evidence,
            "current_sense_coverage_mismatch",
        )
    if unexpected != 0:
        return GateResult(
            "G4_CURRENT_STRUCTURAL_COVERAGE_PASS",
            "BLOCK",
            evidence,
            f"unexpected_no_sense={unexpected}",
        )
    return GateResult("G4_CURRENT_STRUCTURAL_COVERAGE_PASS", "PASS", evidence, None)


def evaluate_g5_delta_deterministic(
    baseline_records: list[dict[str, Any]],
    current_records: list[dict[str, Any]],
    *,
    frozen_delta_path: Path,
) -> GateResult:
    frozen_sha = sha256_file(frozen_delta_path)
    evidence: dict[str, Any] = {
        "frozen_delta_sha256": frozen_sha,
        "expected_delta_sha256": FROZEN_DELTA_SHA256,
    }
    if frozen_sha != FROZEN_DELTA_SHA256:
        return GateResult(
            "G5_DELTA_DETERMINISTIC",
            "BLOCK",
            evidence,
            "frozen_delta_sha_mismatch",
        )

    rows1, _ = compare_lexicon_records(
        baseline_records, current_records, parser_compat_status="PASS"
    )
    rows2, _ = compare_lexicon_records(
        baseline_records, current_records, parser_compat_status="PASS"
    )
    dump1 = "\n".join(canonical_dumps(r) for r in rows1)
    dump2 = "\n".join(canonical_dumps(r) for r in rows2)
    if dump1 != dump2:
        return GateResult(
            "G5_DELTA_DETERMINISTIC",
            "BLOCK",
            evidence,
            "in_memory_compare_not_byte_identical",
        )

    # Recomputed rows must match frozen delta file bytes when serialized the same way
    frozen_rows = load_jsonl_records(frozen_delta_path)
    if len(rows1) != len(frozen_rows):
        evidence["recomputed_rows"] = len(rows1)
        evidence["frozen_rows"] = len(frozen_rows)
        return GateResult(
            "G5_DELTA_DETERMINISTIC",
            "BLOCK",
            evidence,
            "recomputed_delta_row_count_mismatch",
        )
    # Compare canonical line serialization to frozen file content
    recomputed_text = "".join(canonical_dumps(r) + "\n" for r in rows1)
    frozen_text = frozen_delta_path.read_text(encoding="utf-8")
    if recomputed_text != frozen_text:
        evidence["recomputed_sha256_preview"] = (
            __import__("hashlib").sha256(recomputed_text.encode("utf-8")).hexdigest()
        )
        return GateResult(
            "G5_DELTA_DETERMINISTIC",
            "BLOCK",
            evidence,
            "recomputed_delta_bytes_differ_from_frozen",
        )

    evidence["dual_run_identical"] = True
    evidence["matches_frozen_delta"] = True
    return GateResult("G5_DELTA_DETERMINISTIC", "PASS", evidence, None)


def evaluate_g6_review_evidence(paths: SourceRefreshPaths) -> GateResult:
    evidence: dict[str, Any] = {}
    if not paths.review_registry.is_file():
        return GateResult(
            "G6_DELTA_REVIEW_EVIDENCE_SUFFICIENT",
            "BLOCK",
            evidence,
            "missing_review_registry",
        )
    registry_sha = sha256_file(paths.review_registry)
    evidence["review_registry_sha256"] = registry_sha
    if registry_sha != FROZEN_REVIEW_REGISTRY_SHA256:
        return GateResult(
            "G6_DELTA_REVIEW_EVIDENCE_SUFFICIENT",
            "BLOCK",
            evidence,
            "review_registry_sha_mismatch",
        )

    result = validate_malidaba_reviews(paths.review_registry)
    summary = result.summary
    leaf_ids = set(summary.get("current_leaf_review_ids") or [])
    leaf_decisions = dict(summary.get("current_leaf_decision_counts") or {})
    rows = [r.row for r in result.rows]
    leaf_rows = [r for r in rows if r.get("review_id") in leaf_ids]
    evidence["rows"] = len(rows)
    evidence["current_leaves"] = int(summary.get("current_leaf_count") or len(leaf_ids))
    evidence["leaf_decisions"] = dict(sorted(leaf_decisions.items()))
    evidence["f14_review_volume_decision"] = "BATCH001_SUFFICIENT_FOR_SOURCE_FIDELITY_GATE"
    # ensure leaf helper agrees
    evidence["leaf_ids_via_helper"] = len(find_malidaba_review_leaves(rows))

    if len(rows) != EXPECTED_REVIEW_LEAVES or evidence["current_leaves"] != EXPECTED_REVIEW_LEAVES:
        return GateResult(
            "G6_DELTA_REVIEW_EVIDENCE_SUFFICIENT",
            "BLOCK",
            evidence,
            "review_leaf_count_mismatch",
        )
    if leaf_decisions.get("confirmed_source_delta", 0) != EXPECTED_CONFIRMED_LEAVES:
        return GateResult(
            "G6_DELTA_REVIEW_EVIDENCE_SUFFICIENT",
            "BLOCK",
            evidence,
            "confirmed_source_delta_leaf_mismatch",
        )
    if leaf_decisions.get("rejected", 0) or leaf_decisions.get("needs_more_evidence", 0):
        return GateResult(
            "G6_DELTA_REVIEW_EVIDENCE_SUFFICIENT",
            "BLOCK",
            evidence,
            "batch001_contains_non_confirmed_leaves",
        )

    reviewers = {str(r.get("reviewer_id")) for r in leaf_rows}
    evidence["reviewers"] = sorted(reviewers)
    if reviewers != {"Reviewer_001"}:
        return GateResult(
            "G6_DELTA_REVIEW_EVIDENCE_SUFFICIENT",
            "BLOCK",
            evidence,
            "unexpected_reviewer_set",
        )

    evidence["unique_subjects"] = len({str(r.get("review_subject_id")) for r in leaf_rows})

    import csv

    worksheet = (
        paths.repo_root
        / "data"
        / "malidaba_delta"
        / "current"
        / "review"
        / "malidaba_new_headword_review_batch_001.csv"
    )
    if worksheet.is_file():
        page_set: set[str] = set()
        hw_set: set[str] = set()
        with worksheet.open(encoding="utf-8", newline="") as handle:
            for w in csv.DictReader(handle):
                hw = w.get("headword_latin") or ""
                url = w.get("url_canonical") or ""
                if hw:
                    hw_set.add(str(hw))
                if url:
                    page_set.add(str(url))
        evidence["batch_unique_headwords"] = len(hw_set)
        evidence["batch_unique_pages"] = len(page_set)
        if len(hw_set) != EXPECTED_REVIEW_LEAVES:
            return GateResult(
                "G6_DELTA_REVIEW_EVIDENCE_SUFFICIENT",
                "BLOCK",
                evidence,
                "batch_headword_diversity_mismatch",
            )
        if len(page_set) != EXPECTED_BATCH_PAGES:
            return GateResult(
                "G6_DELTA_REVIEW_EVIDENCE_SUFFICIENT",
                "BLOCK",
                evidence,
                f"batch_page_diversity_expected_{EXPECTED_BATCH_PAGES}_got_{len(page_set)}",
            )

    return GateResult("G6_DELTA_REVIEW_EVIDENCE_SUFFICIENT", "PASS", evidence, None)


def evaluate_g10_rights(paths: SourceRefreshPaths) -> GateResult:
    if not paths.malipense_yaml.is_file():
        return GateResult(
            "G10_RIGHTS_POSTURE_RECORDED",
            "BLOCK",
            {},
            "missing_malipense_yaml",
        )
    text = paths.malipense_yaml.read_text(encoding="utf-8")
    license_ok = "CC BY-NC-SA 4.0" in text
    posture = RightsPosture(
        claimed_license="CC BY-NC-SA 4.0",
        internal_source_maintenance=RIGHTS_ALLOWED,
        noncommercial_distribution=RIGHTS_REQUIRES_REVIEW,
        commercial_distribution=RIGHTS_BLOCKED,
        notes=[
            "Engineering PASS must not flip commercial_distribution to allowed.",
            "Source refresh is source maintenance, not publication authorization.",
        ],
    )
    evidence = posture.to_dict()
    evidence["registry_license_observed"] = license_ok
    if not license_ok:
        return GateResult(
            "G10_RIGHTS_POSTURE_RECORDED",
            "BLOCK",
            evidence,
            "claimed_license_not_found_in_registry",
        )
    if posture.commercial_distribution == RIGHTS_ALLOWED:
        return GateResult(
            "G10_RIGHTS_POSTURE_RECORDED",
            "BLOCK",
            evidence,
            "commercial_must_not_be_allowed_without_rights_strategy",
        )
    return GateResult("G10_RIGHTS_POSTURE_RECORDED", "PASS", evidence, None)


def count_nested_lxp2_pages(crawl_dir: Path) -> tuple[int, int]:
    """Return (nested_lxp2_pages, pages_checked) for lexicon letter pages."""
    import zstandard as zstd

    snapshots = crawl_dir / "snapshots.jsonl"
    payloads = crawl_dir / "payloads"
    dctx = zstd.ZstdDecompressor()
    nested = 0
    checked = 0
    with snapshots.open(encoding="utf-8") as handle:
        for line in handle:
            row = json.loads(line)
            url = str(row.get("url_canonical") or "")
            if "/emk/lexicon/" not in url:
                continue
            name = url.rsplit("/", 1)[-1]
            if name.startswith("index"):
                continue
            sid = row.get("snapshot_id")
            if not sid:
                continue
            payload = payloads / f"{sid}.html.zst"
            if not payload.is_file():
                # try alternate naming
                matches = list(payloads.glob(f"*{sid}*.zst"))
                if not matches:
                    continue
                payload = matches[0]
            raw = dctx.decompress(payload.read_bytes())
            html = raw.decode("utf-8", errors="replace")
            checked += 1
            if detect_nested_lxp2_in_html(html):
                nested += 1
    return nested, checked
