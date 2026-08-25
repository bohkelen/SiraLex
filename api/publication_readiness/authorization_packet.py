"""Human-readable publication authorization packet (gitignored evidence only)."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from malipense_version_delta.canonical_json import write_json

from .model import GATE_AWAITING_HUMAN_AUTHORIZATION


def build_authorization_packet_v2(
    *,
    coherence: dict[str, Any],
    worksheet: dict[str, Any],
    publication_receipt: dict[str, Any],
    head_commit: str,
) -> dict[str, Any]:
    """
    Build packet only from sealed release + worksheet evidence.

    If coherence fails, decision is BLOCKED and no usable authorization statement
    is emitted.
    """
    protected = worksheet.get("protected_fields") or {}
    coherent = coherence.get("status") == "PASS"
    release_fp = coherence.get("release_artifact_fingerprint") or protected.get(
        "release_artifact_fingerprint"
    )
    release_dir = coherence.get("release_artifact_dir_name") or protected.get(
        "release_artifact_dir_name"
    )
    hashes = coherence.get("distributed_file_hashes") or protected.get(
        "distributed_file_hashes"
    ) or {}
    semantic = coherence.get("semantic_identity") or {
        "semantic_bundle_id": protected.get("semantic_bundle_id"),
        "semantic_content_sha256": protected.get("semantic_content_sha256"),
        "semantic_candidate_fingerprint": protected.get("semantic_candidate_fingerprint"),
    }

    if coherent:
        decision = "PRODUCT2C_PUBLICATION_AUTHORIZATION_PACKET_READY"
        statement = (
            "I authorize the noncommercial publication of the exact SiraLex release "
            f"artifact identified by release_artifact_fingerprint {release_fp}, "
            "with the distributed file hashes recorded in "
            "publication_authorization_worksheet_v2.json."
        )
    else:
        decision = "PRODUCT2C_PUBLICATION_AUTHORIZATION_PACKET_BLOCKED"
        statement = None

    p_gates = protected.get("p_gates") or publication_receipt.get("p_gates") or {}

    return {
        "schema_version": "siralex_publication_authorization_packet_v2",
        "decision": decision,
        "generated_at_commit": head_commit,
        "publication_state": GATE_AWAITING_HUMAN_AUTHORIZATION,
        "publication_authorized": False,
        "coherence_status": coherence.get("status"),
        "coherence_errors": coherence.get("errors") or [],
        "what_is_being_authorized": {
            "semantic_bundle_id": semantic.get("semantic_bundle_id"),
            "semantic_content_sha256": semantic.get("semantic_content_sha256"),
            "semantic_candidate_fingerprint": semantic.get(
                "semantic_candidate_fingerprint"
            ),
            "release_artifact_fingerprint": release_fp,
            "physical_immutable_release_path": release_dir,
            "distributed_file_hashes": dict(sorted(hashes.items())),
            "candidate_counts": protected.get("candidate_counts"),
            "rights_summary": protected.get("source_rights_summary"),
            "regression_summary": {
                "internal_full": protected.get("internal_full_regression"),
                "publication_candidate": protected.get(
                    "publication_candidate_regression"
                ),
            },
            "p_gates": p_gates,
            "rollback_target": publication_receipt.get("current_published_bundle_id"),
        }
        if coherent
        else None,
        "what_authorization_means": {
            "permits": (
                "Publication of THESE EXACT BYTES as a NONCOMMERCIAL SiraLex "
                "dictionary bundle"
            ),
            "does_not_permit": [
                "commercial exploitation",
                "different bundle bytes",
                "owner/SiraLex excluded rows",
                "future bundle revisions",
                "removal of attribution",
                "removal of CC BY-NC-SA conditions",
            ],
        },
        "what_will_happen_next_if_approved": [
            "copy this immutable release directory into web/public",
            "add the exact catalog entry",
            "promote the catalog pointer / selection",
            "validate runtime",
            "rollback pointer to previous published bundle on failure",
        ],
        "exact_authorization_statement": statement,
        "human_decision_fields": {
            "publication_decision": worksheet.get("publication_decision"),
            "reviewer_id": worksheet.get("reviewer_id"),
            "reviewed_at": worksheet.get("reviewed_at"),
            "review_method": worksheet.get("review_method"),
            "notes": worksheet.get("notes"),
            "status": "BLANK",
        },
        "authority_artifacts": {
            "authorization_worksheet_v2": "data/product2/publication_authorization_worksheet_v2.json",
            "frozen_bundle_path": f"data/product2/frozen_bundle/{release_dir}/"
            if release_dir
            else None,
            "publication_readiness_receipt": "data/product2/siralex_publication_readiness_v1.json",
        },
    }


def render_authorization_packet_txt(packet: dict[str, Any]) -> str:
    what = packet.get("what_is_being_authorized") or {}
    hashes = what.get("distributed_file_hashes") or {}
    lines = [
        "SiraLex PRODUCT2C — Publication Authorization Packet v2",
        "=" * 56,
        "",
        f"DECISION: {packet.get('decision')}",
        f"HEAD: {packet.get('generated_at_commit')}",
        f"Publication authorized: {packet.get('publication_authorized')}",
        f"Coherence: {packet.get('coherence_status')}",
        "",
    ]
    if packet.get("decision") == "PRODUCT2C_PUBLICATION_AUTHORIZATION_PACKET_READY":
        lines.extend(
            [
                "WHAT IS BEING AUTHORIZED",
                "-" * 24,
                f"semantic_bundle_id: {what.get('semantic_bundle_id')}",
                f"semantic_content_sha256: {what.get('semantic_content_sha256')}",
                f"semantic_candidate_fingerprint: {what.get('semantic_candidate_fingerprint')}",
                f"release_artifact_fingerprint: {what.get('release_artifact_fingerprint')}",
                f"physical_immutable_release_path: {what.get('physical_immutable_release_path')}",
                "",
                "Distributed file hashes:",
            ]
        )
        for name, sha in sorted(hashes.items()):
            lines.append(f"  {name}: {sha}")
        counts = what.get("candidate_counts") or {}
        lines.extend(
            [
                "",
                f"counts: records={counts.get('records')} "
                f"lexicon_entries={counts.get('lexicon_entries')} "
                f"headwords={counts.get('headwords')} "
                f"search_keys={counts.get('search_keys')}",
                f"rollback_target: {what.get('rollback_target')}",
                "",
                "WHAT AUTHORIZATION MEANS",
                "-" * 24,
                packet["what_authorization_means"]["permits"],
                "Does NOT authorize:",
            ]
        )
        for item in packet["what_authorization_means"]["does_not_permit"]:
            lines.append(f"  - {item}")
        lines.extend(
            [
                "",
                "WHAT WILL HAPPEN NEXT IF APPROVED",
                "-" * 34,
            ]
        )
        for step in packet["what_will_happen_next_if_approved"]:
            lines.append(f"  - {step}")
        lines.extend(
            [
                "",
                "EXACT AUTHORIZATION STATEMENT (for human to state — not filled)",
                "-" * 60,
                packet.get("exact_authorization_statement") or "",
                "",
                "Human decision fields: BLANK — do not fill in this slice.",
            ]
        )
    else:
        lines.extend(
            [
                "PACKET BLOCKED — do not authorize.",
                "Coherence errors:",
            ]
        )
        for err in packet.get("coherence_errors") or []:
            lines.append(f"  - {err}")
    lines.append("")
    return "\n".join(lines)


def write_authorization_packet(
    *,
    json_path: Path,
    txt_path: Path,
    packet: dict[str, Any],
) -> None:
    json_path.parent.mkdir(parents=True, exist_ok=True)
    write_json(json_path, packet)
    txt_path.write_text(render_authorization_packet_txt(packet), encoding="utf-8")
