/**
 * ML1D2 preference restore / partner selection / downgrade retention.
 */
import { describe, expect, it } from "vitest";

import {
  DEFAULT_LOOKUP_MODE,
  resolveSupportedLookupMode,
  restoreForwardLookupModeFromPreference,
  swapLookupMode,
  withPartnerLookupLanguage,
  type LookupMode,
} from "./lookup_mode";
import {
  parseSearchLookupLangPreference,
  readSearchLookupLangPreference,
  writeSearchLookupLangPreference,
  type SearchLookupLangPreference,
} from "./search_lookup_lang_preference";

const EN_CAPABLE = {
  lookup_languages: ["fr", "en", "mnk"],
  search_key_families: ["src", "en", "tgt"],
};

function memoryStorage(seed?: Record<string, string>) {
  const map = new Map<string, string>(Object.entries(seed ?? {}));
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    snapshot: () => Object.fromEntries(map.entries()),
  };
}

describe("ML1D2 preference restore algorithm", () => {
  it("maps preference + capability to forward LookupMode", () => {
    expect(restoreForwardLookupModeFromPreference("fr", EN_CAPABLE)).toEqual(DEFAULT_LOOKUP_MODE);
    expect(restoreForwardLookupModeFromPreference("en", EN_CAPABLE)).toEqual({
      from: "en",
      to: "mnk",
    });
    expect(restoreForwardLookupModeFromPreference("en", {})).toEqual(DEFAULT_LOOKUP_MODE);
    expect(
      restoreForwardLookupModeFromPreference(
        parseSearchLookupLangPreference("nope"),
        EN_CAPABLE,
      ),
    ).toEqual(DEFAULT_LOOKUP_MODE);
  });

  it("retains stored EN across capability downgrade while effective mode falls back", () => {
    const storage = memoryStorage();
    writeSearchLookupLangPreference("en", storage);
    expect(readSearchLookupLangPreference(storage)).toBe("en");

    let mode: LookupMode = restoreForwardLookupModeFromPreference("en", EN_CAPABLE);
    expect(mode).toEqual({ from: "en", to: "mnk" });

    mode = swapLookupMode(mode);
    expect(mode).toEqual({ from: "mnk", to: "en" });

    mode = resolveSupportedLookupMode({}, mode);
    expect(mode).toEqual(DEFAULT_LOOKUP_MODE);
    expect(readSearchLookupLangPreference(storage)).toBe("en");

    mode = restoreForwardLookupModeFromPreference(
      readSearchLookupLangPreference(storage),
      EN_CAPABLE,
    );
    expect(mode).toEqual({ from: "en", to: "mnk" });
  });
});

describe("ML1D2 partner selection vs swap preference writes", () => {
  it("preserves orientation across FR↔EN selection", () => {
    let mode: LookupMode = { from: "fr", to: "mnk" };
    mode = withPartnerLookupLanguage(mode, "en");
    expect(mode).toEqual({ from: "en", to: "mnk" });
    mode = swapLookupMode(mode);
    expect(mode).toEqual({ from: "mnk", to: "en" });
    mode = withPartnerLookupLanguage(mode, "fr");
    expect(mode).toEqual({ from: "mnk", to: "fr" });
    mode = swapLookupMode(mode);
    expect(mode).toEqual({ from: "fr", to: "mnk" });
  });

  it("writes preference only for explicit partner changes, not swap", () => {
    const storage = memoryStorage({ "siralex.search_lookup_lang": "fr" });
    const persistPartner = (partner: SearchLookupLangPreference) => {
      writeSearchLookupLangPreference(partner, storage);
    };

    persistPartner("en");
    expect(storage.snapshot()["siralex.search_lookup_lang"]).toBe("en");

    // Swap mutates mode only — no writeSearchLookupLangPreference call.
    const afterSwap = swapLookupMode({ from: "en", to: "mnk" });
    expect(afterSwap).toEqual({ from: "mnk", to: "en" });
    expect(storage.snapshot()["siralex.search_lookup_lang"]).toBe("en");

    persistPartner("fr");
    expect(storage.snapshot()["siralex.search_lookup_lang"]).toBe("fr");
  });
});
