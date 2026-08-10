/**
 * ML1D3 — Resolve FR/EN consumer glosses from LookupMode preference.
 *
 * Never inspects Russian. Never synthesizes translation.
 * Preferred language comes from LookupMode (or an explicit preferred flag),
 * not UI locale or query text.
 */

import {
  glossFallbackChain,
  type PreferredGlossLanguage,
} from "./lookup_mode";

/** Alias matching the ML1D3 presentation contract. */
export type ConsumerGlossLanguage = PreferredGlossLanguage;

export type ResolvedPreferredGloss = {
  text?: string;
  language?: ConsumerGlossLanguage;
  usedFallback: boolean;
};

function normalizeGlossText(value: string | null | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

/**
 * Pick FR/EN gloss text by preferred language, then alternate.
 * Russian is never considered.
 */
export function resolvePreferredGloss(args: {
  glossFr?: string | null;
  glossEn?: string | null;
  preferred: PreferredGlossLanguage;
}): ResolvedPreferredGloss {
  const fr = normalizeGlossText(args.glossFr);
  const en = normalizeGlossText(args.glossEn);
  const byLang: Record<PreferredGlossLanguage, string | undefined> = { fr, en };

  const chain = glossFallbackChain(args.preferred);
  for (let i = 0; i < chain.length; i += 1) {
    const language = chain[i]!;
    const text = byLang[language];
    if (text) {
      return {
        text,
        language,
        usedFallback: i > 0,
      };
    }
  }
  return { usedFallback: false };
}
