"""Orchestrate PRODUCT1A rights-aware product boundary evaluation."""

from __future__ import annotations

import hashlib
import subprocess
from collections import Counter
from pathlib import Path
from typing import Any

from malipense_version_delta.canonical_json import sha256_file, write_json, write_jsonl

from . import SCHEMA_VERSION
from .build import (
    build_commercial_safe,
    build_internal_full,
    classify_surface,
    owner_audit,
)
from .freeze import freeze_product_inputs
from .gaps import build_coverage_gaps
from .leakage import audit_commercial_leaks
from .model import (
    BLOCKED_COMMERCIAL,
    COMMERCIAL_SAFE_INDEPENDENT,
    COMMERCIAL_SAFE_LICENSED,
    METADATA_ONLY_NONCONTENT,
    MIXED_RIGHTS,
    NONCOMMERCIAL_SOURCE_DERIVED,
    PROFILE_COMMERCIAL_SAFE_CANDIDATE,
    PROFILE_INTERNAL_FULL,
    PROFILE_NONCOMMERCIAL_CANDIDATE,
    UNKNOWN_RIGHTS,
)
from .paths import Product1APaths, default_paths


def _git_head(repo_root: Path) -> str:
    return (
        subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=str(repo_root), text=True)
        .strip()
    )


def _classification_histogram(items: list[dict[str, Any]]) -> dict[str, int]:
    c: Counter[str] = Counter()
    for item in items:
        c[str(item.get("classification") or "")] += 1
    return dict(c)


def evaluate_product_boundary(
    paths: Product1APaths | None = None,
    *,
    expected_base_commit: str = "88ea05adb74459b16c17576b9e376771cc5e351f",
) -> dict[str, Any]:
    paths = paths or default_paths()
    paths.workspace.mkdir(parents=True, exist_ok=True)

    head = _git_head(paths.repo_root)
    if head != expected_base_commit:
        receipt = {
            "decision": "PRODUCT1A_RIGHTS_AWARE_PRODUCT_BOUNDARY_BLOCKED",
            "block_reason": f"base_commit_mismatch:expected={expected_base_commit}:got={head}",
        }
        write_json(paths.report_receipt_path, receipt)
        return receipt

    frozen = freeze_product_inputs(paths)
    internal = build_internal_full(paths)
    if internal.get("regression_fail", 1) != 0 or internal.get("regression_pass") != 30:
        receipt = {
            "decision": "PRODUCT1A_RIGHTS_AWARE_PRODUCT_BOUNDARY_BLOCKED",
            "block_reason": (
                f"internal_full_regression:"
                f"pass={internal.get('regression_pass')}:fail={internal.get('regression_fail')}"
            ),
            "internal_full": internal,
            "frozen_inputs": frozen,
        }
        write_json(paths.report_receipt_path, receipt)
        return receipt

    classification = classify_surface(paths, records_path=paths.internal_records)
    # Manifest: every classified product item.
    manifest_rows: list[dict[str, Any]] = []
    for item in classification["all_items"]:
        manifest_rows.append(
            {
                "schema_version": SCHEMA_VERSION,
                "product_item_id": item.get("product_item_id"),
                "item_kind": item.get("item_kind"),
                "source_id": item.get("source_id"),
                "substantive_source_dependencies": item.get(
                    "substantive_source_dependencies"
                ),
                "rights_classification": item.get("classification"),
                "dependence_bucket": item.get("dependence_bucket"),
                "eligibility": {
                    PROFILE_INTERNAL_FULL: True,
                    PROFILE_NONCOMMERCIAL_CANDIDATE: item.get("classification")
                    in {
                        NONCOMMERCIAL_SOURCE_DERIVED,
                        MIXED_RIGHTS,
                        METADATA_ONLY_NONCONTENT,
                        COMMERCIAL_SAFE_INDEPENDENT,
                        COMMERCIAL_SAFE_LICENSED,
                        BLOCKED_COMMERCIAL,
                    },
                    PROFILE_COMMERCIAL_SAFE_CANDIDATE: bool(
                        item.get("commercial_eligible")
                    ),
                },
                "reason_codes": item.get("reason_codes"),
                "provenance_closure": item.get("provenance_closure"),
                "closure_blocking_ancestors": item.get("closure_blocking_ancestors"),
            }
        )
    manifest_rows.sort(
        key=lambda r: (
            str(r.get("item_kind") or ""),
            str(r.get("product_item_id") or ""),
        )
    )
    write_jsonl(paths.manifest_path, manifest_rows)

    commercial = build_commercial_safe(
        paths,
        classification=classification,
        internal_records_path=paths.internal_records,
        internal_search_path=paths.internal_search,
    )

    leaks = audit_commercial_leaks(
        paths,
        commercial_records_path=paths.commercial_records,
        commercial_search_path=paths.commercial_search,
        malidaba_ir_ids=classification["malidaba_ir_ids"],
        legacy_ir_ids=classification["legacy_ir_ids"],
    )
    if not leaks["ok"] or commercial["regression"]["unexpected_product_defect"] > 0:
        decision = "PRODUCT1A_RIGHTS_AWARE_PRODUCT_BOUNDARY_BLOCKED"
        block_reason = (
            "commercial_leakage"
            if not leaks["ok"]
            else "unexpected_commercial_regression_defect"
        )
    else:
        decision = "PRODUCT1A_RIGHTS_AWARE_PRODUCT_BOUNDARY_READY"
        block_reason = None

    gaps = build_coverage_gaps(
        paths,
        classification=classification,
        internal_records_path=paths.internal_records,
    )
    high_value_gaps = [g for g in gaps if g.get("high_value")]
    independent_for_excluded = sum(
        1 for g in gaps if g.get("independent_evidence_already_available")
    )

    lex_only = [
        v
        for v in classification["record_classes"].values()
        if v.get("item_kind") == "lexicon_entry"
    ]
    if not lex_only:
        lex_only = list(classification["record_classes"].values())

    dep_counts = Counter(i.get("dependence_bucket") for i in lex_only)
    class_counts = _classification_histogram(lex_only)
    total_lex = len(lex_only) or 1
    commercial_safe_lex = sum(1 for i in lex_only if i.get("commercial_eligible"))
    restricted_lex = total_lex - commercial_safe_lex

    owners = owner_audit(classification["record_classes"])

    # Alias/supplement/variant tallies
    alias_eligible = sum(1 for a in classification["aliases"] if a.get("commercial_eligible"))
    supp_eligible = sum(
        1 for s in classification["supplements"] if s.get("commercial_eligible")
    )
    var_eligible = sum(1 for v in classification["variants"] if v.get("commercial_eligible"))

    coverage_delta = {
        "records_internal": internal["records"],
        "records_commercial": commercial["records"],
        "records_excluded": internal["records"] - commercial["records"],
        "headwords_internal": internal["headwords"],
        "headwords_commercial": commercial["headwords"],
        "headwords_excluded": internal["headwords"] - commercial["headwords"],
        "search_keys_internal": internal["search_keys"],
        "search_keys_commercial": commercial["search_keys"],
        "search_keys_excluded": internal["search_keys"] - commercial["search_keys"],
        "fr_keys_internal": internal.get("fr_keys"),
        "fr_keys_commercial": commercial.get("fr_keys"),
        "en_keys_internal": internal.get("en_keys"),
        "en_keys_commercial": commercial.get("en_keys"),
        "aliases_total": len(classification["aliases"]),
        "aliases_commercial_eligible": alias_eligible,
        "supplements_total": len(classification["supplements"]),
        "supplements_commercial_eligible": supp_eligible,
        "variants_total": len(classification["variants"]),
        "variants_commercial_eligible": var_eligible,
    }

    # Strategic route: SiraLex is non-commercial infrastructure; next gate is
    # distribution compliance (BY-NC-SA), not commercial licensing.
    recommended_route = "NONCOMMERCIAL_DISTRIBUTION_COMPLIANCE"
    next_gate = "PRODUCT1B_NONCOMMERCIAL_DISTRIBUTION_COMPLIANCE"

    receipt = {
        "decision": decision,
        "block_reason": block_reason,
        "base_commit": head,
        "frozen_inputs": frozen,
        "malidaba_rights": classification["malidaba_rights"],
        "profiles": {
            PROFILE_INTERNAL_FULL: internal,
            PROFILE_COMMERCIAL_SAFE_CANDIDATE: commercial,
            PROFILE_NONCOMMERCIAL_CANDIDATE: {
                "status": "NEXT_GATE_PRODUCT1B",
                "publication_ready": False,
                "note": (
                    "Noncommercial distribution requires PRODUCT1B compliance "
                    "checks (attribution, data-license notices, ShareAlike, "
                    "provenance in bundles). Not authorized by PRODUCT1A alone."
                ),
            },
        },
        "rights_classification_lexicon": class_counts,
        "dependence_lexicon": dict(dep_counts),
        "commercial_safe_lexical_coverage_pct": round(
            100.0 * commercial_safe_lex / total_lex, 4
        ),
        "restricted_mixed_coverage_pct": round(100.0 * restricted_lex / total_lex, 4),
        "owner_audit": owners,
        "coverage_delta": coverage_delta,
        "rights_exclusion_audit": leaks,
        "commercial_regression": commercial["regression"],
        "gaps": {
            "total": len(gaps),
            "high_value": len(high_value_gaps),
            "independent_evidence_already_available": independent_for_excluded,
        },
        "manifest_sha256": sha256_file(paths.manifest_path),
        "commercial_records_sha256": commercial["records_sha256"],
        "commercial_search_sha256": commercial["search_index_sha256"],
        "commercial_bundle_manifest_sha256": commercial["bundle_manifest_sha256"],
        "recommended_strategic_route": recommended_route,
        "recommended_next_gate": next_gate,
        "operational_debt": {
            "REAL_APPLY_ENTRYPOINT_SHOULD_BE_COMMITTED_AND_AUDITABLE": "OPEN",
            "classification": "SOURCE_MAINTENANCE_OPERATIONAL_DEBT",
        },
        "canonical_mutation": "NONE",
        "publication_writes": "NONE",
        "product_promotion": "NONE",
        "commit": "NOT_CREATED",
    }
    write_json(paths.report_receipt_path, receipt)
    return receipt


def verify_canonical_unchanged(paths: Product1APaths) -> dict[str, str]:
    expected = {
        str(paths.current_ir.relative_to(paths.repo_root)): (
            "4d6e82e98638b5371aa80b09726cbf1f5a4a6de5fd4c3e006f7ec5591e2ae5de"
        ),
        str(paths.legacy_ir.relative_to(paths.repo_root)): (
            "b74f22d36972fceb8622b61c31931f3a0d401820bc6bbb30c22eb2588da89764"
        ),
        str(paths.logical_continuity.relative_to(paths.repo_root)): (
            "e8df1bfc6abeef68c33ce9ca00df4526bc10b64ebf6f13b41119a8a573569bc0"
        ),
    }
    out: dict[str, str] = {}
    for rel, exp in expected.items():
        got = hashlib.sha256((paths.repo_root / rel).read_bytes()).hexdigest()
        out[rel] = "OK" if got == exp else f"MISMATCH:{got}"
    return out
