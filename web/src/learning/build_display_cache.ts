/**
 * Build Learning Record display_cache from a live lexicon entry.
 * Pure helper — does not mutate the dictionary entry or invent content.
 *
 * Save-time cache remains FR-then-EN (stable offline fallback). Live Saved
 * Vocabulary presentation may prefer EN via search preference without writing
 * that preference into Learning Records (ML1D3).
 */

import { isLexiconDisplay, type EnrichedRecord } from "../types/records";
import type { LearningRecordDisplayCache } from "./learning_record_types";

/** Soft upper bound for list-row gloss text. */
export const GLOSS_SHORT_MAX_CHARS = 120;

function firstUsefulGloss(record: EnrichedRecord): string | undefined {
  if (!isLexiconDisplay(record) || !record.display.senses) return undefined;
  for (const sense of record.display.senses) {
    if (typeof sense.gloss_fr === "string" && sense.gloss_fr.trim() !== "") {
      return sense.gloss_fr.trim();
    }
  }
  for (const sense of record.display.senses) {
    if (typeof sense.gloss_en === "string" && sense.gloss_en.trim() !== "") {
      return sense.gloss_en.trim();
    }
  }
  return undefined;
}

function boundGloss(text: string): string {
  if (text.length <= GLOSS_SHORT_MAX_CHARS) return text;
  return `${text.slice(0, GLOSS_SHORT_MAX_CHARS - 1).trimEnd()}…`;
}

/**
 * Build display_cache for Save.
 * Throws if the entry is not a lexicon entry with a non-empty Latin headword.
 */
export function buildDisplayCache(entry: EnrichedRecord): LearningRecordDisplayCache {
  if (!isLexiconDisplay(entry)) {
    throw new Error("buildDisplayCache: entry must be a lexicon_entry with display fields");
  }
  const headword = entry.display.headword_latin.trim();
  if (headword === "") {
    throw new Error("buildDisplayCache: headword_latin must be non-empty");
  }

  const cache: LearningRecordDisplayCache = {
    headword_latin: headword,
  };

  const nko = entry.display.headword_nko_provided?.trim();
  if (nko) {
    cache.headword_nko = nko;
  }

  const gloss = firstUsefulGloss(entry);
  if (gloss) {
    cache.gloss_short = boundGloss(gloss);
  }

  return cache;
}
