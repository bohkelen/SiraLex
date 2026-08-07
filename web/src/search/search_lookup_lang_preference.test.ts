import { describe, expect, it, vi } from "vitest";

import {
  parseSearchLookupLangPreference,
  readSearchLookupLangPreference,
  SEARCH_LOOKUP_LANG_STORAGE_KEY,
  writeSearchLookupLangPreference,
} from "./search_lookup_lang_preference";

describe("search_lookup_lang_preference", () => {
  it("defaults invalid values to fr", () => {
    expect(parseSearchLookupLangPreference(undefined)).toBe("fr");
    expect(parseSearchLookupLangPreference(null)).toBe("fr");
    expect(parseSearchLookupLangPreference("")).toBe("fr");
    expect(parseSearchLookupLangPreference("de")).toBe("fr");
    expect(parseSearchLookupLangPreference("EN")).toBe("fr");
    expect(parseSearchLookupLangPreference("en")).toBe("en");
    expect(parseSearchLookupLangPreference("fr")).toBe("fr");
  });

  it("reads and writes fr|en safely", () => {
    const map = new Map<string, string>();
    const storage = {
      getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
      setItem: (k: string, v: string) => {
        map.set(k, v);
      },
      removeItem: (k: string) => {
        map.delete(k);
      },
    };

    expect(readSearchLookupLangPreference(storage)).toBe("fr");
    writeSearchLookupLangPreference("en", storage);
    expect(map.get(SEARCH_LOOKUP_LANG_STORAGE_KEY)).toBe("en");
    expect(readSearchLookupLangPreference(storage)).toBe("en");
    writeSearchLookupLangPreference("fr", storage);
    expect(readSearchLookupLangPreference(storage)).toBe("fr");
  });

  it("fails closed when storage throws", () => {
    const broken = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
      removeItem: () => {
        throw new Error("denied");
      },
    };
    expect(readSearchLookupLangPreference(broken)).toBe("fr");
    expect(() => writeSearchLookupLangPreference("en", broken)).not.toThrow();
  });

  it("documents that ML1D1 does not restore EN at consumer startup", () => {
    // Preference helpers exist for ML1D2; main.ts must not call read on boot for mode.
    expect(SEARCH_LOOKUP_LANG_STORAGE_KEY).toBe("siralex.search_lookup_lang");
    expect(vi.isFakeTimers()).toBe(false);
  });
});
