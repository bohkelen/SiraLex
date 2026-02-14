/**
 * JS/TS mirror of shared/normalization/norm_v1.py.
 *
 * Goal: byte-for-byte parity on produced search keys (given the same input).
 *
 * This file intentionally mirrors the Python pipeline:
 * - normalize_whitespace
 * - casefold_latin (approximated via NFKC + toLowerCase + ß→ss)
 * - strip_diacritics (NFD remove marks -> NFC)
 * - strip_punctuation (remove Unicode category P* then whitespace-normalize)
 * - remove_spaces (remove ASCII spaces)
 *
 * Notes:
 * - Python uses full Unicode casefold (str.casefold()).
 *   JS has no built-in casefold; we use NFKC + toLowerCase and apply the
 *   highest-impact casefold difference for Latin text (ß -> ss) so the
 *   shared fixture catches drift.
 */

export type SearchKeys = Record<
  "casefold" | "diacritics_insensitive" | "punct_stripped" | "nospace",
  string[]
>;

export const RULESET_ID = "norm_v1" as const;

export function normalizeNfc(s: string): string {
  return s.normalize("NFC");
}

export function normalizeWhitespace(s: string): string {
  // Python uses re.sub(r"\s+", " ", s) then strip().
  // JS \s is Unicode-aware for whitespace; we keep parity by collapsing and trimming.
  return s.replace(/\s+/gu, " ").trim();
}

export function stripDiacritics(s: string): string {
  // Python: NFD -> remove Mn/Mc/Me -> NFC.
  return s
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .normalize("NFC");
}

export function stripPunctuation(s: string): string {
  // Python: remove any Unicode category starting with 'P', then whitespace-normalize.
  // JS: use Unicode property escapes for punctuation.
  const noPunct = s.replace(/\p{P}+/gu, "");
  return normalizeWhitespace(noPunct);
}

export function removeSpaces(s: string): string {
  return s.replace(/ /g, "");
}

export function casefoldLatin(s: string): string {
  // Best-effort parity with Python str.casefold for Latin text:
  // - apply NFKC (Python casefold performs full casefold mapping; NFKC helps with some ligatures)
  // - lowercase
  // - apply known important fold: ß -> ss
  return s.normalize("NFKC").toLowerCase().replace(/\u00df/g, "ss");
}

export function keyCasefold(s: string): string {
  return casefoldLatin(normalizeWhitespace(s));
}

export function keyDiacriticsInsensitive(s: string): string {
  return stripDiacritics(casefoldLatin(normalizeWhitespace(s)));
}

export function keyPunctStripped(s: string): string {
  return stripDiacritics(casefoldLatin(stripPunctuation(normalizeWhitespace(s))));
}

export function keyNospace(s: string): string {
  return removeSpaces(stripDiacritics(casefoldLatin(normalizeWhitespace(s))));
}

const KEY_FUNCTIONS: Record<keyof SearchKeys, (s: string) => string> = {
  casefold: keyCasefold,
  diacritics_insensitive: keyDiacriticsInsensitive,
  punct_stripped: keyPunctStripped,
  nospace: keyNospace,
};

export function computeSearchKeys(forms: string[]): SearchKeys {
  const out = {} as SearchKeys;
  (Object.keys(KEY_FUNCTIONS) as (keyof SearchKeys)[]).forEach((keyName) => {
    const keyFn = KEY_FUNCTIONS[keyName];
    const seen = new Set<string>();
    const values: string[] = [];
    for (const form of forms) {
      const val = keyFn(form);
      if (val && !seen.has(val)) {
        seen.add(val);
        values.push(val);
      }
    }
    out[keyName] = values;
  });
  return out;
}

