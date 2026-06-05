"""Read-only candidate miner for French source-index gaps."""

from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from .filters import FrenchTermFilters, load_filters
from .models import (
    Actionability,
    CandidateAccumulator,
    CandidateRow,
    CandidateType,
    DiscoveryReport,
    GlossEvidence,
    KEY_TYPE_ORDER,
    ReviewTier,
    SOURCE_KEY_TYPES,
    SourceMappingEvidence,
)
from .normalization import canonical_term, primary_source_key, source_search_keys, tokenize_french_text
from .reporting import write_report

INDEX_MAPPING_KIND = "index_mapping"
LEXICON_ENTRY_KIND = "lexicon_entry"
IMPLEMENTATION_DECISION_DEFAULT = "pending_review"

CONCRETE_DOMAIN_TERMS = {
    "abeille",
    "animal",
    "arbre",
    "bouche",
    "bras",
    "cheval",
    "chien",
    "corps",
    "doigt",
    "eau",
    "enfant",
    "femme",
    "feuille",
    "fruit",
    "frere",
    "frère",
    "grain",
    "griot",
    "homme",
    "jambe",
    "jour",
    "main",
    "mere",
    "mère",
    "mot",
    "nez",
    "nuage",
    "oeil",
    "œil",
    "oncle",
    "oreille",
    "pere",
    "père",
    "pied",
    "poil",
    "poils",
    "soeur",
    "sœur",
    "tante",
    "tete",
    "tête",
}

SUBTYPE_MODIFIERS = {
    "aine",
    "aîné",
    "ainee",
    "aînée",
    "cadet",
    "cadette",
    "maternel",
    "maternelle",
    "paternel",
    "paternelle",
}

KINSHIP_UMBRELLA_TERMS = {
    "frere",
    "frère",
    "mere",
    "mère",
    "oncle",
    "pere",
    "père",
    "soeur",
    "sœur",
    "tante",
}

TIER_ORDER = {
    "tier_1_strong_candidate": 0,
    "tier_2_interesting_candidate": 1,
    "tier_3_evidence_only": 2,
    "tier_4_noise_or_defer": 3,
}

ACTIONABILITY_ORDER = {
    "review_candidate": 0,
    "evidence_only": 1,
    "defer": 2,
    "noise": 3,
}


class SourceIndexGapDiscoveryError(RuntimeError):
    """Raised when discovery inputs are invalid."""


def read_json(path: Path) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise SourceIndexGapDiscoveryError(f"{path}: invalid JSON: {exc}") from exc
    if not isinstance(payload, dict):
        raise SourceIndexGapDiscoveryError(f"{path}: expected JSON object")
    return payload


def read_jsonl_records(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, 1):
            text = line.strip()
            if not text:
                continue
            try:
                row = json.loads(text)
            except json.JSONDecodeError as exc:
                raise SourceIndexGapDiscoveryError(
                    f"{path}:{line_number}: invalid JSON: {exc}"
                ) from exc
            if not isinstance(row, dict):
                raise SourceIndexGapDiscoveryError(f"{path}:{line_number}: expected object")
            rows.append(row)
    return rows


def read_search_index(path: Path) -> dict[tuple[str, str], list[str]]:
    index: dict[tuple[str, str], list[str]] = {}
    for row in read_jsonl_records(path):
        key_type = row.get("key_type")
        key = row.get("key")
        ir_ids = row.get("ir_ids")
        if not isinstance(key_type, str) or not isinstance(key, str):
            raise SourceIndexGapDiscoveryError(f"{path}: search index row missing key/key_type")
        if not isinstance(ir_ids, list) or not all(isinstance(value, str) for value in ir_ids):
            raise SourceIndexGapDiscoveryError(f"{path}: invalid ir_ids for {key_type}:{key}")
        index[(key_type, key)] = list(ir_ids)
    return index


def target_form(record: dict[str, Any]) -> str:
    display = record.get("display")
    if isinstance(display, dict):
        headword = display.get("headword_latin")
        if isinstance(headword, str) and headword.strip():
            return headword
    preferred = record.get("preferred_form")
    return preferred if isinstance(preferred, str) and preferred.strip() else str(record.get("ir_id", ""))


def source_term(record: dict[str, Any]) -> str:
    display = record.get("display")
    if isinstance(display, dict):
        value = display.get("source_term")
        if isinstance(value, str) and value.strip():
            return canonical_term(value)
    preferred = record.get("preferred_form")
    return canonical_term(preferred) if isinstance(preferred, str) else ""


def mapping_target_forms(record: dict[str, Any]) -> tuple[str, ...]:
    display = record.get("display")
    if not isinstance(display, dict):
        return ()
    target_entries = display.get("target_entries")
    if not isinstance(target_entries, list):
        return ()
    forms: list[str] = []
    for entry in target_entries:
        if not isinstance(entry, dict):
            continue
        display_text = entry.get("display_text")
        if isinstance(display_text, str) and display_text.strip() and display_text not in forms:
            forms.append(display_text)
    return tuple(forms)


def collect_french_strings(value: Any, path: str = "") -> list[tuple[str, str]]:
    """Collect French display/gloss strings with field provenance."""
    strings: list[tuple[str, str]] = []
    if isinstance(value, dict):
        for key, child in value.items():
            child_path = f"{path}.{key}" if path else str(key)
            if key in {"gloss_fr", "trans_fr"} and isinstance(child, str) and child.strip():
                strings.append((child_path, child))
            strings.extend(collect_french_strings(child, child_path))
    elif isinstance(value, list):
        for index, child in enumerate(value):
            strings.extend(collect_french_strings(child, f"{path}[{index}]"))
    return strings


def lookup_source_postings(
    index: dict[tuple[str, str], list[str]],
    normalized_keys: dict[str, list[str]],
) -> dict[str, list[str]]:
    postings: dict[str, list[str]] = {}
    for key_type in KEY_TYPE_ORDER:
        directional_type = f"src_{key_type}"
        for key in normalized_keys.get(key_type, []):
            ids = index.get((directional_type, key))
            if ids:
                postings[directional_type] = list(ids)
                break
    return postings


def get_candidate(
    candidates: dict[str, CandidateAccumulator],
    term: str,
) -> CandidateAccumulator:
    term = canonical_term(term)
    key = primary_source_key(term)
    candidate = candidates.get(key)
    if candidate is None:
        candidate = CandidateAccumulator(term=term, normalized_keys=source_search_keys(term))
        candidates[key] = candidate
    return candidate


def build_accumulators(
    records: list[dict[str, Any]],
    source_index: dict[tuple[str, str], list[str]],
    filters: FrenchTermFilters,
) -> dict[str, CandidateAccumulator]:
    candidates: dict[str, CandidateAccumulator] = {}

    for record in records:
        if record.get("ir_kind") != INDEX_MAPPING_KIND:
            continue
        term = source_term(record)
        if not term:
            continue
        evidence = SourceMappingEvidence(
            ir_id=str(record.get("ir_id", "")),
            source_term=term,
            target_forms=mapping_target_forms(record),
        )
        get_candidate(candidates, term).source_mappings.append(evidence)

        tokens = tokenize_french_text(term)
        if len(tokens) > 1:
            head = tokens[0]
            if "stopword" not in filters.labels_for(head):
                get_candidate(candidates, head).phrase_head_evidence.append(evidence)
            for token in tokens:
                get_candidate(candidates, token).related_source_mappings.append(evidence)

    for record in records:
        if record.get("ir_kind") != LEXICON_ENTRY_KIND:
            continue
        ir_id = str(record.get("ir_id", ""))
        form = target_form(record)
        display = record.get("display")
        for field_path, text in collect_french_strings(display):
            for token in tokenize_french_text(text):
                candidate = get_candidate(candidates, token)
                candidate.gloss_evidence.append(
                    GlossEvidence(
                        ir_id=ir_id,
                        target_form=form,
                        field_path=field_path,
                        gloss=text,
                    )
                )

    for candidate in candidates.values():
        candidate.source_lookup_postings = lookup_source_postings(source_index, candidate.normalized_keys)
        candidate.filter_labels = filters.labels_for(candidate.term)

    for key, candidate in list(candidates.items()):
        if key.endswith("s") and len(key) > 3:
            singular = key[:-1]
            if singular in candidates:
                candidate.plural_linked_to = candidates[singular].term

    return candidates


def current_lookup_behavior(candidate: CandidateAccumulator) -> str:
    if not candidate.source_lookup_postings:
        if candidate.phrase_head_evidence:
            return "missing standalone source lookup; related longer source mappings exist"
        return "missing standalone source lookup"
    counts = {
        key_type: len(ir_ids)
        for key_type, ir_ids in sorted(candidate.source_lookup_postings.items())
    }
    if candidate.phrase_head_evidence:
        return f"existing source lookup {counts}; related longer source mappings may expand coverage"
    return f"existing source lookup {counts}"


def source_mapping_target_forms(candidate: CandidateAccumulator) -> set[str]:
    forms: set[str] = set()
    for mapping in candidate.source_mappings:
        forms.update(mapping.target_forms)
    return forms


def related_mapping_target_forms(candidate: CandidateAccumulator) -> set[str]:
    forms: set[str] = set()
    for mapping in dedup_mappings(candidate.related_source_mappings + candidate.phrase_head_evidence):
        forms.update(mapping.target_forms)
    return forms


def has_distinct_related_targets(candidate: CandidateAccumulator) -> bool:
    current = source_mapping_target_forms(candidate)
    related = related_mapping_target_forms(candidate)
    return bool(related - current)


def has_subtype_modifier_phrase(candidate: CandidateAccumulator) -> bool:
    for mapping in candidate.phrase_head_evidence:
        tokens = tokenize_french_text(mapping.source_term)
        tail_keys = {primary_source_key(token) for token in tokens[1:]}
        if tail_keys & SUBTYPE_MODIFIERS:
            return True
    return False


def is_plural_form_gap(
    candidate: CandidateAccumulator,
    candidates_by_key: dict[str, CandidateAccumulator],
) -> bool:
    """Return true for obvious final-s recall gaps where singular lookup works."""
    key = primary_source_key(candidate.term)
    if not key.endswith("s") or len(key) <= 3:
        return False
    if candidate.source_lookup_postings:
        return False
    singular_key = key[:-1]
    singular = candidates_by_key.get(singular_key)
    if singular is None:
        return False
    return bool(singular.source_lookup_postings)


def is_concrete_domain_term(term: str) -> bool:
    primary = primary_source_key(term)
    concrete = {primary_source_key(value) for value in CONCRETE_DOMAIN_TERMS}
    return primary in concrete or (primary.endswith("s") and primary[:-1] in concrete)


def is_kinship_umbrella_term(term: str) -> bool:
    primary = primary_source_key(term)
    return primary in {primary_source_key(value) for value in KINSHIP_UMBRELLA_TERMS}


def distinct_target_ids(candidate: CandidateAccumulator) -> list[str]:
    ids: list[str] = []
    for evidence in candidate.gloss_evidence:
        if evidence.ir_id not in ids:
            ids.append(evidence.ir_id)
    return ids


def distinct_target_forms(candidate: CandidateAccumulator) -> list[str]:
    forms: list[str] = []
    for evidence in candidate.gloss_evidence:
        if evidence.target_form not in forms:
            forms.append(evidence.target_form)
    return forms


def dedup_mappings(mappings: list[SourceMappingEvidence]) -> list[SourceMappingEvidence]:
    seen: set[str] = set()
    out: list[SourceMappingEvidence] = []
    for mapping in mappings:
        key = mapping.ir_id or mapping.source_term
        if key in seen:
            continue
        seen.add(key)
        out.append(mapping)
    return out


def score_candidate(candidate: CandidateAccumulator, candidate_type: CandidateType) -> tuple[int, list[str]]:
    score = 0
    reasons: list[str] = []
    gloss_occurrences = len(candidate.gloss_evidence)
    target_count = len(distinct_target_ids(candidate))
    related_count = len(dedup_mappings(candidate.related_source_mappings + candidate.phrase_head_evidence))

    if gloss_occurrences:
        points = min(20, gloss_occurrences * 2)
        score += points
        reasons.append(f"gloss_frequency:+{points}")
    if target_count:
        points = min(30, target_count * 5)
        score += points
        reasons.append(f"distinct_target_entries:+{points}")
    if related_count:
        points = min(24, related_count * 6)
        score += points
        reasons.append(f"related_source_mappings:+{points}")
    if not candidate.source_lookup_postings:
        score += 15
        reasons.append("missing_source_lookup:+15")
    elif candidate.phrase_head_evidence:
        score += 10
        reasons.append("existing_lookup_with_related_phrases:+10")

    if is_concrete_domain_term(candidate.term):
        score += 10
        reasons.append("concrete_domain_term:+10")
    if candidate_type == "existing_source_with_related_phrases":
        score -= 20
        reasons.append("existing_source_related_phrases_evidence_only:-20")
    if candidate_type == "suspected_incomplete_existing_source_mapping":
        score += 8
        reasons.append("suspected_distinct_subtype_coverage:+8")

    if candidate.plural_linked_to:
        score += 4
        reasons.append(f"plural_linked_to:{candidate.plural_linked_to}:+4")

    if "stopword" in candidate.filter_labels:
        score -= 60
        reasons.append("stopword:-60")
    if "modifier" in candidate.filter_labels:
        score -= 30
        reasons.append("modifier:-30")
    if "low_value" in candidate.filter_labels:
        score -= 20
        reasons.append("low_value:-20")
    if "abstract" in candidate.filter_labels:
        score -= 15
        reasons.append("abstract:-15")

    if candidate_type == "likely_stopword_or_noise":
        score = min(score, 0)
    return score, reasons


def classify_candidate(
    candidate: CandidateAccumulator,
    candidates_by_key: dict[str, CandidateAccumulator],
) -> CandidateType:
    if "stopword" in candidate.filter_labels:
        return "likely_stopword_or_noise"
    if candidate.filter_labels & {"modifier", "low_value"}:
        return "modifier_or_low_value_term"
    if is_plural_form_gap(candidate, candidates_by_key):
        return "plural_form_gap"
    if candidate.source_lookup_postings and candidate.phrase_head_evidence:
        if (
            has_distinct_related_targets(candidate)
            and has_subtype_modifier_phrase(candidate)
            and is_kinship_umbrella_term(candidate.term)
        ):
            return "suspected_incomplete_existing_source_mapping"
        return "existing_source_with_related_phrases"
    if not candidate.source_lookup_postings and len(candidate.phrase_head_evidence) >= 2:
        return "missing_broad_umbrella_term"
    if not candidate.source_lookup_postings and candidate.gloss_evidence:
        return "missing_standalone_source_term"
    if candidate.gloss_evidence or candidate.related_source_mappings:
        return "ambiguous_or_review_required"
    return "likely_stopword_or_noise"


def confidence_for(candidate_type: CandidateType, score: int) -> str:
    if candidate_type in {
        "likely_stopword_or_noise",
        "modifier_or_low_value_term",
        "existing_source_with_related_phrases",
    }:
        return "low"
    if score >= 45:
        return "high"
    if score >= 25:
        return "medium"
    return "low"


def actionability_for(candidate_type: CandidateType, confidence: str) -> str:
    if candidate_type == "likely_stopword_or_noise":
        return "noise"
    if candidate_type in {"modifier_or_low_value_term", "existing_source_with_related_phrases"}:
        return "evidence_only"
    if candidate_type == "ambiguous_or_review_required":
        return "defer"
    if candidate_type == "plural_form_gap":
        return "review_candidate"
    if confidence in {"high", "medium"}:
        return "review_candidate"
    return "defer"


def review_tier_for(
    candidate: CandidateAccumulator,
    candidate_type: CandidateType,
    confidence: str,
    actionability: str,
    score: int,
) -> str:
    if actionability == "noise":
        return "tier_4_noise_or_defer"
    if candidate_type in {"modifier_or_low_value_term", "existing_source_with_related_phrases"}:
        return "tier_3_evidence_only"
    if candidate_type == "ambiguous_or_review_required" or actionability == "defer":
        return "tier_4_noise_or_defer"
    if candidate_type == "confirmed_incomplete_existing_source_mapping":
        return "tier_1_strong_candidate"
    if candidate_type == "suspected_incomplete_existing_source_mapping":
        return "tier_2_interesting_candidate"
    if candidate_type == "plural_form_gap":
        return "tier_2_interesting_candidate"
    if (
        candidate_type == "missing_broad_umbrella_term"
        and score >= 50
        and is_kinship_umbrella_term(candidate.term)
        and has_subtype_modifier_phrase(candidate)
    ):
        return "tier_1_strong_candidate"
    if candidate_type == "missing_standalone_source_term" and (
        score >= 60 and confidence == "high" and is_concrete_domain_term(candidate.term)
    ):
        return "tier_1_strong_candidate"
    if actionability == "review_candidate":
        return "tier_2_interesting_candidate"
    return "tier_4_noise_or_defer"


def proposed_representation_for(candidate_type: CandidateType) -> str:
    if candidate_type == "missing_standalone_source_term":
        return "new_source_mapping"
    if candidate_type == "missing_broad_umbrella_term":
        return "broad_umbrella_source_mapping"
    if candidate_type in {
        "incomplete_existing_source_mapping",
        "suspected_incomplete_existing_source_mapping",
        "confirmed_incomplete_existing_source_mapping",
    }:
        return "additive_source_mapping"
    if candidate_type == "plural_form_gap":
        return "reviewed_plural_alias"
    if candidate_type in {
        "modifier_or_low_value_term",
        "likely_stopword_or_noise",
        "existing_source_with_related_phrases",
    }:
        return "do_not_apply"
    return "needs_linguistic_review"


def candidate_to_row(
    candidate: CandidateAccumulator,
    candidates_by_key: dict[str, CandidateAccumulator],
) -> CandidateRow:
    candidate_type = classify_candidate(candidate, candidates_by_key)
    score, reasons = score_candidate(candidate, candidate_type)
    confidence = confidence_for(candidate_type, score)
    actionability = actionability_for(candidate_type, confidence)
    review_tier = review_tier_for(candidate, candidate_type, confidence, actionability, score)
    related = dedup_mappings(candidate.related_source_mappings + candidate.phrase_head_evidence)
    normalized_source_key = primary_source_key(candidate.term)
    evidence_rollup = {
        "gloss_occurrences": len(candidate.gloss_evidence),
        "distinct_target_entries": len(distinct_target_ids(candidate)),
        "related_source_mappings": len(related),
        "source_lookup_key_types": sorted(candidate.source_lookup_postings),
        "distinct_related_target_forms": sorted(related_mapping_target_forms(candidate)),
    }
    return CandidateRow(
        candidate_french_term=candidate.term,
        normalized_source_key=normalized_source_key,
        current_lookup_behavior=current_lookup_behavior(candidate),
        evidence_glosses=[item.to_dict() for item in candidate.gloss_evidence[:10]],
        target_forms=distinct_target_forms(candidate)[:20],
        target_ir_ids=distinct_target_ids(candidate)[:20],
        related_existing_source_mappings=[item.to_dict() for item in related[:20]],
        candidate_type=candidate_type,
        confidence=confidence,  # type: ignore[arg-type]
        score=score,
        score_reasons=reasons,
        actionability=actionability,  # type: ignore[arg-type]
        review_tier=review_tier,  # type: ignore[arg-type]
        canonical_candidate_term=candidate.plural_linked_to or candidate.term,
        observed_variants=[candidate.term],
        plural_linked_to=candidate.plural_linked_to,
        evidence_rollup=evidence_rollup,
        group_candidate_types=[candidate_type],
        group_review_tier=review_tier,  # type: ignore[arg-type]
        group_actionability=actionability,  # type: ignore[arg-type]
        proposed_representation=proposed_representation_for(candidate_type),
        review_needed=actionability != "noise",
        implementation_decision=IMPLEMENTATION_DECISION_DEFAULT,
    )


def _best_review_tier(values: list[ReviewTier]) -> ReviewTier:
    return min(values, key=lambda value: TIER_ORDER[value])


def _best_actionability(values: list[Actionability]) -> Actionability:
    return min(values, key=lambda value: ACTIONABILITY_ORDER[value])


def apply_plural_grouping(rows: list[CandidateRow]) -> list[CandidateRow]:
    """Roll up obvious final-s plural groups while preserving row-level evidence."""
    groups: dict[str, list[CandidateRow]] = defaultdict(list)
    for row in rows:
        groups[row.canonical_candidate_term].append(row)

    updated: list[CandidateRow] = []
    for row in rows:
        group = groups[row.canonical_candidate_term]
        observed_variants = sorted({item.candidate_french_term for item in group})
        group_types = sorted({item.candidate_type for item in group})
        group_tier = _best_review_tier([item.review_tier for item in group])
        group_actionability = _best_actionability([item.actionability for item in group])
        group_rollup = {
            "group_size": len(group),
            "observed_variants": observed_variants,
            "gloss_occurrences": sum(int(item.evidence_rollup["gloss_occurrences"]) for item in group),
            "distinct_target_entries": len({ir_id for item in group for ir_id in item.target_ir_ids}),
            "related_source_mappings": len({
                mapping.get("ir_id", mapping.get("source_term", ""))
                for item in group
                for mapping in item.related_existing_source_mappings
            }),
        }
        updated.append(
            CandidateRow(
                **{
                    **row.to_dict(),
                    "observed_variants": observed_variants,
                    "evidence_rollup": {**row.evidence_rollup, "group": group_rollup},
                    "group_candidate_types": group_types,
                    "group_review_tier": group_tier,
                    "group_actionability": group_actionability,
                }
            )
        )
    return updated


def build_report(bundle_dir: Path, filters: FrenchTermFilters | None = None) -> DiscoveryReport:
    """Mine source-index gap candidates without modifying bundle data."""
    manifest = read_json(bundle_dir / "bundle.manifest.json")
    records = read_jsonl_records(bundle_dir / "records.jsonl")
    source_index = {
        key: value
        for key, value in read_search_index(bundle_dir / "search_index.jsonl").items()
        if key[0] in SOURCE_KEY_TYPES
    }
    active_filters = filters or load_filters()
    candidates = build_accumulators(records, source_index, active_filters)
    rows = [candidate_to_row(candidate, candidates) for candidate in candidates.values()]
    rows = apply_plural_grouping(rows)
    rows.sort(
        key=lambda row: (
            TIER_ORDER[row.review_tier],
            -row.score,
            row.candidate_french_term,
        )
    )
    by_type = Counter(row.candidate_type for row in rows)
    by_actionability = Counter(row.actionability for row in rows)
    by_review_tier = Counter(row.review_tier for row in rows)
    return DiscoveryReport(
        bundle_id=str(manifest.get("bundle_id", "")),
        manifest_content_sha256=str(manifest.get("content_sha256", "")),
        total_candidates=len(rows),
        candidates_by_type=dict(by_type),
        candidates_by_actionability=dict(by_actionability),
        candidates_by_review_tier=dict(by_review_tier),
        rows=rows,
    )


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle-dir", required=True, type=Path, help="Bundle directory to inspect")
    parser.add_argument(
        "--output-dir",
        required=True,
        type=Path,
        help="Explicit output directory for review reports",
    )
    parser.add_argument(
        "--filter-file",
        type=Path,
        default=None,
        help="Optional French stopword/modifier filter JSON",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    report = build_report(args.bundle_dir, load_filters(args.filter_file))
    paths = write_report(args.output_dir, report)
    print(json.dumps({"summary": report.summary_dict(), "outputs": {k: str(v) for k, v in paths.items()}}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
