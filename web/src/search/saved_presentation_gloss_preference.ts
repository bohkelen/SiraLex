/**
 * ML1D3 — Non-persisted presentation preference for Saved Vocabulary (and
 * any non-Search surfaces that opt in).
 *
 * Uses siralex.search_lookup_lang + active EN capability clamp.
 * Does not mutate Learning Records.
 */

import {
  bundleSupportsEnglishLookup,
  type LookupCapabilityMeta,
  type PreferredGlossLanguage,
} from "./lookup_mode";
import {
  readSearchLookupLangPreference,
  type SearchLookupLangPreference,
} from "./search_lookup_lang_preference";

export function resolveSavedPresentationPreferredGlossLanguage(
  meta: LookupCapabilityMeta | null | undefined,
  stored: SearchLookupLangPreference = readSearchLookupLangPreference(),
): PreferredGlossLanguage {
  if (stored === "en" && meta && bundleSupportsEnglishLookup(meta)) {
    return "en";
  }
  return "fr";
}
