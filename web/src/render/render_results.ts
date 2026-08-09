/**
 * Phase 2.0.4 / UX2I3 — Results list rendering.
 *
 * Builds a list of search results from enriched records plus search context.
 * Cards stay consumer-facing: no internal IDs, search keys, or provenance labels.
 * Visual hierarchy follows UX2 Contemporary West African Modernism tokens.
 *
 * ML1D3: lexicon glosses follow the immutable LookupMode on each result context.
 */

import type { SearchDirection } from "../bundle_labels";
import type {
  EnrichedRecord,
  LexiconDisplayFields,
  IndexMappingDisplayFields,
} from "../types/records";
import { isLexiconDisplay, isIndexMappingDisplay } from "../types/records";
import { t } from "../i18n";
import {
  preferredGlossLanguage,
  type LookupMode,
} from "../search/lookup_mode";
import { resolvePreferredGloss } from "../search/resolve_preferred_gloss";

type SearchMatchKeyType =
  | "casefold"
  | "diacritics_insensitive"
  | "punct_stripped"
  | "nospace";

export type ResultDisplayContext = {
  rawQuery: string;
  /** Immutable LookupMode that produced this result event (ML1D3). */
  lookupMode: LookupMode;
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
  /** Present for lexicon glosses; omitted for index_mapping targets. */
  glossLanguage?: "fr" | "en";
  glossUsedFallback?: boolean;
  glossUnavailable?: boolean;
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

function summarizeLexicon(d: LexiconDisplayFields, mode: LookupMode): Summary {
  const preferred = preferredGlossLanguage(mode);
  const firstSense = d.senses?.[0];
  const resolved = resolvePreferredGloss({
    glossFr: firstSense?.gloss_fr,
    glossEn: firstSense?.gloss_en,
    preferred,
  });
  const pos = (d.ps_raw ?? d.pos_hint)?.trim() || undefined;
  if (resolved.text && resolved.language) {
    return {
      primary: d.headword_latin,
      pos,
      secondary: resolved.text,
      glossLanguage: resolved.language,
      glossUsedFallback: resolved.usedFallback,
      sourceTerm: d.headword_latin,
      isIndexMapping: false,
    };
  }
  return {
    primary: d.headword_latin,
    pos,
    secondary: t("render.noTranslation"),
    glossUnavailable: true,
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

export type OnSelectRecord = (
  record: EnrichedRecord,
  context: ResultDisplayContext,
) => void;

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
 *
 * Lexicon gloss preference uses each result's immutable `lookupMode`, not the
 * live global partner selection.
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
      summary = summarizeLexicon(record.display, context.lookupMode);
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
    openButton.addEventListener("click", () => onSelect(record, context));

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
      const gloss = el(
        "div",
        summary.isIndexMapping
          ? "ux2-result-targets ux2-type-body result-translation"
          : "ux2-result-gloss ux2-type-body result-translation",
        summary.secondary,
      );
      if (!summary.isIndexMapping) {
        gloss.setAttribute("data-testid", "result-gloss");
        if (summary.glossUnavailable) {
          gloss.setAttribute("data-gloss-unavailable", "true");
        } else if (summary.glossLanguage) {
          gloss.setAttribute("data-gloss-lang", summary.glossLanguage);
          gloss.setAttribute(
            "data-gloss-fallback",
            summary.glossUsedFallback ? "true" : "false",
          );
        }
      }
      openButton.appendChild(gloss);
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
