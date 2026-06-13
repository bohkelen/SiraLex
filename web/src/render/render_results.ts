/**
 * Phase 2.0.4 — Results list rendering.
 *
 * Builds a list of search results from enriched records plus search context.
 * Cards stay consumer-facing: no internal IDs, search keys, or provenance labels.
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
  foundEntry: string;
  meaning: string;
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
  return {
    foundEntry: d.headword_latin,
    meaning: firstGloss || t("render.noTranslation"),
    sourceTerm: d.headword_latin,
    isIndexMapping: false,
  };
}

function summarizeIndexMapping(d: IndexMappingDisplayFields): Summary {
  const targets = d.target_entries?.map((target) => target.display_text) ?? [];
  const visibleTargets = targets.slice(0, MAX_VISIBLE_TARGETS);
  const remainingCount = targets.length - visibleTargets.length;
  let targetText = visibleTargets.join(", ");
  if (remainingCount > 0) {
    targetText += `, ${t("render.moreTargets", { count: remainingCount })}`;
  }
  return {
    foundEntry: d.source_term,
    meaning: targetText || t("render.noTranslation"),
    sourceTerm: d.source_term,
    isIndexMapping: true,
  };
}

export type OnSelectRecord = (record: EnrichedRecord) => void;

function normalizeForDisplayCompare(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function getDirectionLabel(context: ResultDisplayContext): string {
  return context.searchDirection === "source_to_target"
    ? `${context.sourceLabel} → ${context.targetLabel}`
    : `${context.targetLabel} → ${context.sourceLabel}`;
}

function shouldShowQueryHint(context: ResultDisplayContext, summary: Summary): boolean {
  const query = normalizeForDisplayCompare(context.rawQuery);
  const sourceTerm = normalizeForDisplayCompare(summary.sourceTerm ?? summary.foundEntry);
  return query !== "" && sourceTerm !== "" && query !== sourceTerm;
}

function getMeaningLabel(context: ResultDisplayContext, summary: Summary): string {
  if (context.searchDirection === "target_to_source") {
    return t("render.meaningPossible");
  }
  return summary.isIndexMapping ? t("render.possibleTranslations") : t("render.meaningPossible");
}

function renderLabeledLine(label: string, value: string, cls: string): HTMLElement {
  const line = el("div", `result-line ${cls}`);
  line.appendChild(el("span", "result-label", label));
  line.appendChild(el("span", "result-value", value));
  return line;
}

function renderWhyDisclosure(context: ResultDisplayContext, summary: Summary): HTMLElement {
  const details = document.createElement("details");
  details.className = "result-why";

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
    body.appendChild(el("div", undefined, t("render.relatedEntry", { sourceTerm: summary.foundEntry })));
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
 */
export function renderResultsList(
  results: ResultDisplayContext[],
  onSelect: OnSelectRecord,
): HTMLElement | null {
  if (results.length === 0) return null;

  const list = document.createElement("div");
  list.className = "results-list";

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
    item.className = "result-item";

    const openButton = document.createElement("button");
    openButton.className = "result-open";
    openButton.type = "button";
    openButton.addEventListener("click", () => onSelect(record));

    openButton.appendChild(
      renderLabeledLine(t("render.direction"), getDirectionLabel(context), "result-direction"),
    );
    openButton.appendChild(
      renderLabeledLine(t("render.foundEntry"), summary.foundEntry, "result-found-entry"),
    );
    openButton.appendChild(
      renderLabeledLine(getMeaningLabel(context, summary), summary.meaning, "result-translation"),
    );

    if (shouldShowQueryHint(context, summary)) {
      openButton.appendChild(
        el("div", "result-query-hint", t("render.foundForQuery", { query: context.rawQuery })),
      );
    }

    item.append(openButton, renderWhyDisclosure(context, summary));
    list.appendChild(item);
  }

  return list;
}
