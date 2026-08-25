"""Deterministic diversity-first batch selection for Malidaba review worksheets."""

from __future__ import annotations

from collections import defaultdict
from typing import Any

BATCH_SELECTION_ALGORITHM_ID = "malidaba_new_headword_batch_v1_round_robin"


def _page_key(url: str | None) -> str:
    if not url:
        return ""
    return url.rsplit("/", 1)[-1]


def select_batch_records(
    eligible_rows: list[dict[str, Any]],
    *,
    target_size: int = 100,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """
    Diversity-first deterministic batch selection.

    1. group by source page (url_canonical)
    2. sort page groups by url
    3. within page sort by headword + source_record_id
    4. round-robin across pages
    5. prefer one record per unique headword before homonym repeats
    """
    if not eligible_rows:
        return [], {
            "algorithm_id": BATCH_SELECTION_ALGORITHM_ID,
            "target_size": target_size,
            "selected_count": 0,
            "page_distribution": {},
        }

    by_page: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in eligible_rows:
        by_page[str(row.get("url_canonical") or "")].append(row)

    for page in by_page:
        by_page[page].sort(
            key=lambda r: (
                r.get("headword_latin") or "",
                r.get("source_record_id") or "",
                r.get("review_subject_id") or "",
            )
        )

    pages = sorted(by_page)
    selected: list[dict[str, Any]] = []
    seen_headwords: set[tuple[str, str]] = set()
    seen_subjects: set[str] = set()

    def _try_add(row: dict[str, Any]) -> bool:
        sid = str(row.get("review_subject_id") or "")
        if not sid or sid in seen_subjects:
            return False
        seen_subjects.add(sid)
        selected.append(row)
        hw = row.get("headword_latin") or ""
        page = str(row.get("url_canonical") or "")
        seen_headwords.add((page, hw))
        return True

    # Pass 1: one unique headword per page round-robin
    progress = True
    idx = 0
    while progress and len(selected) < target_size:
        progress = False
        for page in pages:
            if len(selected) >= target_size:
                break
            candidates = [
                r
                for r in by_page[page]
                if str(r.get("review_subject_id") or "") not in seen_subjects
                and (page, r.get("headword_latin") or "") not in seen_headwords
            ]
            if not candidates:
                continue
            if _try_add(candidates[0]):
                progress = True
        idx += 1
        if idx > len(eligible_rows):
            break

    # Pass 2: fill remaining slots round-robin allowing homonym repeats
    progress = True
    page_idx = 0
    while progress and len(selected) < target_size:
        progress = False
        for _ in range(len(pages)):
            if len(selected) >= target_size:
                break
            page = pages[page_idx % len(pages)]
            page_idx += 1
            for row in by_page[page]:
                if len(selected) >= target_size:
                    break
                if _try_add(row):
                    progress = True
                    break

    page_distribution: dict[str, int] = defaultdict(int)
    for row in selected:
        page_distribution[_page_key(str(row.get("url_canonical") or ""))] += 1

    return selected, {
        "algorithm_id": BATCH_SELECTION_ALGORITHM_ID,
        "target_size": target_size,
        "selected_count": len(selected),
        "eligible_count": len(eligible_rows),
        "page_distribution": dict(sorted(page_distribution.items())),
    }
