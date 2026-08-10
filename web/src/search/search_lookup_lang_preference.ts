/**
 * ML1D1/ML1D2 — Search lookup-language preference key (localStorage).
 *
 * ML1B approved key: siralex.search_lookup_lang = "fr" | "en"
 *
 * ML1D2 restores EN at consumer startup only after active-bundle capability is known.
 */

export const SEARCH_LOOKUP_LANG_STORAGE_KEY = "siralex.search_lookup_lang" as const;

export type SearchLookupLangPreference = "fr" | "en";

export function parseSearchLookupLangPreference(
  value: unknown,
): SearchLookupLangPreference {
  return value === "en" ? "en" : "fr";
}

export function readSearchLookupLangPreference(
  storage: Pick<Storage, "getItem"> | null | undefined = globalThis.localStorage,
): SearchLookupLangPreference {
  try {
    const raw = storage?.getItem(SEARCH_LOOKUP_LANG_STORAGE_KEY);
    return parseSearchLookupLangPreference(raw);
  } catch {
    return "fr";
  }
}

export function writeSearchLookupLangPreference(
  value: SearchLookupLangPreference,
  storage: Pick<Storage, "setItem" | "removeItem"> | null | undefined = globalThis.localStorage,
): void {
  const normalized = parseSearchLookupLangPreference(value);
  try {
    if (!storage) return;
    if (normalized === "fr") {
      // Canonical default: absence or explicit fr both mean FR.
      storage.setItem(SEARCH_LOOKUP_LANG_STORAGE_KEY, "fr");
      return;
    }
    storage.setItem(SEARCH_LOOKUP_LANG_STORAGE_KEY, "en");
  } catch {
    // Fail closed: preference write is best-effort.
  }
}
