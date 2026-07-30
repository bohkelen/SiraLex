/**
 * LS2I3 — narrowly scoped live-entry extraction for Review cards.
 * Never uses Learning Record display_cache. Does not mutate the entry.
 */

import type { EnrichedRecord, ExampleRaw, SenseRaw } from "../types/records";
import { isLexiconDisplay } from "../types/records";

export type ReviewExampleSupport = {
  text_latin: string;
  text_nko?: string;
  translations: string[];
};

export type ReviewSenseSupport = {
  sense_num?: number;
  gloss_fr?: string;
  gloss_en?: string;
  glosses: string[];
  examples: ReviewExampleSupport[];
};

export type ReviewLiveDisplay = {
  headword_latin: string;
  headword_nko?: string;
  pos?: string;
  senses: ReviewSenseSupport[];
  variants: string[];
};

function extractExample(ex: ExampleRaw): ReviewExampleSupport | undefined {
  const text = typeof ex.text_latin === "string" ? ex.text_latin.trim() : "";
  if (!text) return undefined;
  const translations: string[] = [];
  if (ex.trans_fr) translations.push(ex.trans_fr);
  if (ex.trans_en) translations.push(ex.trans_en);
  return {
    text_latin: text,
    ...(ex.text_nko_provided ? { text_nko: ex.text_nko_provided } : {}),
    translations,
  };
}

function extractSense(sense: SenseRaw, index: number): ReviewSenseSupport {
  const glosses: string[] = [];
  if (sense.gloss_fr) glosses.push(sense.gloss_fr);
  if (sense.gloss_en) glosses.push(sense.gloss_en);
  const examples: ReviewExampleSupport[] = [];
  if (Array.isArray(sense.examples)) {
    for (const ex of sense.examples) {
      try {
        const extracted = extractExample(ex);
        if (extracted) examples.push(extracted);
      } catch {
        // tolerate malformed examples
      }
    }
  }
  return {
    sense_num: sense.sense_num ?? index + 1,
    ...(sense.gloss_fr ? { gloss_fr: sense.gloss_fr } : {}),
    ...(sense.gloss_en ? { gloss_en: sense.gloss_en } : {}),
    glosses,
    examples,
  };
}

/**
 * Extract review-support fields from a live lexicon entry.
 * Returns undefined when the entry is not a usable lexicon display.
 */
export function extractReviewLiveDisplay(
  liveEntry: EnrichedRecord,
): ReviewLiveDisplay | undefined {
  try {
    if (liveEntry.ir_kind !== "lexicon_entry" || !isLexiconDisplay(liveEntry)) {
      return undefined;
    }
    const d = liveEntry.display;
    const headword =
      typeof d.headword_latin === "string" ? d.headword_latin.trim() : "";
    if (!headword) return undefined;

    const posRaw = d.pos_hint ?? d.ps_raw;
    const pos = typeof posRaw === "string" && posRaw.trim() !== "" ? posRaw.trim() : undefined;

    const senses: ReviewSenseSupport[] = [];
    if (Array.isArray(d.senses)) {
      d.senses.forEach((sense, i) => {
        try {
          senses.push(extractSense(sense, i));
        } catch {
          // tolerate malformed sense
        }
      });
    }

    const variants = Array.isArray(d.variants_raw)
      ? d.variants_raw.filter((v): v is string => typeof v === "string" && v.trim() !== "")
      : [];

    return {
      headword_latin: headword,
      ...(d.headword_nko_provided ? { headword_nko: d.headword_nko_provided } : {}),
      ...(pos ? { pos } : {}),
      senses,
      variants,
    };
  } catch {
    return undefined;
  }
}
