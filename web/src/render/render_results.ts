/**
 * Phase 2.0.4 / UX2I3 — Results list rendering.
 *
 * Builds a list of search results from enriched records plus search context.
 * Cards stay consumer-facing: no internal IDs, search keys, or provenance labels.
 * Visual hierarchy follows UX2 Contemporary West African Modernism tokens.
 */

import type { SearchDirection } from "../bundle_labels";
import type {
  EnrichedRecord,
  LexiconDisplayFields,
  IndexMappingDisplayFields,
} from "../types/records";
import { isLexiconDisplay, isIndexMappingDisplay } from "../types/records";
import { t } from "../i18n";

type SearchMatchKeyType =
  | "casefold"
  | "diacritics_insensitive"
  | "punct_stripped"
  | "nospace";

export type ResultDisplayContext = {
  rawQuery: string;
  searchDirection: SearchDirection;
  matched_key_type: SearchMatchKeyType | null;
  matched_key: string | null;
  sourceLabel: string;
  targetLabel: string;
  record: EnrichedRecord;
};

type Summary = {
  primary: string;
  pos?: string;
  secondary: string;
  sourceTerm?: string;
  isIndexMapping: boolean;
};

const MAX_VISIBLE_TARGETS = 4;

function el(tag: string, cls?: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

function summarizeLexicon(d: LexiconDisplayFields): Summary {
  const firstSense = d.senses?.[0];
  const firstGloss =
    firstSense?.gloss_fr ?? firstSense?.gloss_en ?? firstSense?.gloss_ru ?? "";
  const pos = (d.ps_raw ?? d.pos_hint)?.trim() || undefined;
  return {
    primary: d.headword_latin,
    pos,
    secondary: firstGloss,
    sourceTerm: d.headword_latin,
    isIndexMapping: false,
  };
}

function summarizeIndexMapping(d: IndexMappingDisplayFields): Summary {
  const targets = d.target_entries?.map((target) => target.display_text) ?? [];
  const visibleTargets = targets.slice(0, MAX_VISIBLE_TARGETS);
  let targetText = visibleTargets.join(" · ");
  if (targets.length > visibleTargets.length) {
    targetText += " · …";
  }
  return {
    primary: d.source_term,
    secondary: targetText,
    sourceTerm: d.source_term,
    isIndexMapping: true,
  };
}

export type OnSelectRecord = (record: EnrichedRecord) => void;

function normalizeForDisplayCompare(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function shouldShowQueryHint(context: ResultDisplayContext, summary: Summary): boolean {
  const query = normalizeForDisplayCompare(context.rawQuery);
  const sourceTerm = normalizeForDisplayCompare(summary.sourceTerm ?? summary.primary);
  return query !== "" && sourceTerm !== "" && query !== sourceTerm;
}

function renderWhyDisclosure(context: ResultDisplayContext, summary: Summary): HTMLElement {
  const details = document.createElement("details");
  details.className = "result-why ux2-result-why";

  const disclosureSummary = document.createElement("summary");
  disclosureSummary.textContent = t("render.whyThisResult");
  details.appendChild(disclosureSummary);

  const body = el("div", "result-why-body");
  body.appendChild(el("div", undefined, t("render.foundForQuery", { query: context.rawQuery })));
  if (summary.sourceTerm) {
    body.appendChild(el("div", undefined, t("render.sourceEntry", { sourceTerm: summary.sourceTerm })));
    if (shouldShowQueryHint(context, summary)) {
      body.appendChild(el("div", undefined, t("render.sameEntryAs", { sourceTerm: summary.sourceTerm })));
    }
  } else {
    body.appendChild(el("div", undefined, t("render.relatedEntry", { sourceTerm: summary.primary })));
  }
  details.appendChild(body);

  return details;
}

export function getNoResultMessage(query: string): string {
  if (/\s/.test(query.trim())) {
    return t("search.noPhraseMatch");
  }
  return t("search.noMatchGuidance", { query });
}

/**
 * Build a DOM element containing the results list.
 * Returns null if no renderable records.
 * Order is preserved exactly as provided (bundle/runtime order).
 */
export function renderResultsList(
  results: ResultDisplayContext[],
  onSelect: OnSelectRecord,
): HTMLElement | null {
  if (results.length === 0) return null;

  const list = document.createElement("div");
  list.className = "results-list ux2-results-list";

  for (const context of results) {
    const { record } = context;
    let summary: Summary;

    if (isLexiconDisplay(record)) {
      summary = summarizeLexicon(record.display);
    } else if (isIndexMappingDisplay(record)) {
      summary = summarizeIndexMapping(record.display);
    } else {
      continue;
    }

    const item = document.createElement("div");
    item.className = "result-item ux2-result-row";
    if (summary.isIndexMapping) {
      item.classList.add("ux2-result-row-mapping");
    } else {
      item.classList.add("ux2-result-row-lexicon");
    }

    const openButton = document.createElement("button");
    openButton.className = "result-open";
    openButton.type = "button";
    openButton.addEventListener("click", () => onSelect(record));

    const primaryRow = el("div", "ux2-result-primary-row");
    const headword = el(
      "span",
      summary.isIndexMapping
        ? "ux2-result-source ux2-type-headword-medium"
        : "ux2-result-headword ux2-type-headword-medium result-value",
      summary.primary,
    );
    // Compatibility: found-entry line class retained for existing tests/selectors.
    headword.classList.add("result-found-entry");
    primaryRow.appendChild(headword);

    if (summary.pos) {
      primaryRow.appendChild(el("span", "ux2-result-pos ux2-type-metadata", summary.pos));
    }

    openButton.appendChild(primaryRow);

    if (summary.secondary) {
      openButton.appendChild(
        el(
          "div",
          summary.isIndexMapping
            ? "ux2-result-targets ux2-type-body result-translation"
            : "ux2-result-gloss ux2-type-body result-translation",
          summary.secondary,
        ),
      );
    }

    if (shouldShowQueryHint(context, summary)) {
      openButton.appendChild(
        el("div", "result-query-hint ux2-result-hint", t("render.foundForQuery", { query: context.rawQuery })),
      );
    }

    item.append(openButton, renderWhyDisclosure(context, summary));
    list.appendChild(item);
  }

  return list;
}
