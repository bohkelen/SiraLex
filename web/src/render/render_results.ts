/**
 * Phase 2.0.4 — Results list rendering.
 *
 * Builds a clickable list of search results from enriched records.
 * Each item shows a summary line: headword, POS, first translation.
 */

import type {
  EnrichedRecord,
  LexiconDisplayFields,
  IndexMappingDisplayFields,
} from "../types/records";
import { isLexiconDisplay, isIndexMappingDisplay } from "../types/records";
import { t } from "../i18n";

type Summary = { headword: string; pos: string; translation: string; kind: string };

function summarizeLexicon(d: LexiconDisplayFields): Summary {
  const pos = d.pos_hint ?? d.ps_raw ?? "";
  const firstSense = d.senses?.[0];
  const firstGloss =
    firstSense?.gloss_fr ?? firstSense?.gloss_en ?? firstSense?.gloss_ru ?? "";
  return {
    headword: d.headword_latin,
    pos,
    translation: firstGloss || t("render.noTranslation"),
    kind: t("render.kindLexicon"),
  };
}

function summarizeIndexMapping(d: IndexMappingDisplayFields): Summary {
  const targetText = d.target_entries?.map((t) => t.display_text).join(", ") ?? "";
  return {
    headword: d.source_term,
    pos: d.source_lang,
    translation: targetText || t("render.noTranslation"),
    kind: t("render.kindIndex"),
  };
}

export type OnSelectRecord = (record: EnrichedRecord) => void;

/**
 * Build a DOM element containing the results list.
 * Returns null if no renderable records.
 */
export function renderResultsList(
  records: EnrichedRecord[],
  onSelect: OnSelectRecord,
): HTMLElement | null {
  if (records.length === 0) return null;

  const list = document.createElement("div");
  list.className = "results-list";

  for (const record of records) {
    let summary: Summary;

    if (isLexiconDisplay(record)) {
      summary = summarizeLexicon(record.display);
    } else if (isIndexMappingDisplay(record)) {
      summary = summarizeIndexMapping(record.display);
    } else {
      continue;
    }

    const item = document.createElement("button");
    item.className = "result-item";
    item.type = "button";

    const hw = document.createElement("span");
    hw.className = "result-headword";
    hw.textContent = summary.headword;

    const pos = document.createElement("span");
    pos.className = "result-pos";
    pos.textContent = summary.pos;

    const tr = document.createElement("span");
    tr.className = "result-translation";
    tr.textContent = summary.translation;

    const badge = document.createElement("span");
    badge.className = "result-kind";
    badge.textContent = summary.kind;

    item.append(hw, pos, badge, tr);
    item.addEventListener("click", () => onSelect(record));
    list.appendChild(item);
  }

  return list;
}
