/**
 * ML1D3A — Bind mapping→target navigation to the immutable Search-origin
 * LookupMode. Live picker / currentLookupMode must not be consulted.
 */

import {
  preferredGlossLanguage,
  type LookupMode,
} from "../search/lookup_mode";

export type TargetNavBoundModes = {
  /** Snapshot restored on Back and used for target lexical presentation. */
  restoreLookupMode: LookupMode;
  /** Temporary chrome while viewing the Maninka lexicon target. */
  chromeLookupMode: LookupMode;
};

/**
 * Derive restore + temporary MNK→partner chrome from the Search-origin snapshot.
 * `liveLookupMode` is accepted only to make call-site mistakes visible in tests:
 * it must never affect the returned modes.
 */
export function bindTargetNavToSearchOrigin(
  originLookupMode: LookupMode,
  liveLookupMode?: LookupMode,
): TargetNavBoundModes {
  void liveLookupMode;
  const restoreLookupMode: LookupMode = {
    from: originLookupMode.from,
    to: originLookupMode.to,
  };
  const glossPartner: "fr" | "en" =
    restoreLookupMode.from === "en" || restoreLookupMode.to === "en" ? "en" : "fr";
  return {
    restoreLookupMode,
    chromeLookupMode: { from: "mnk", to: glossPartner },
  };
}

export function targetNavPreferredGlossLanguage(
  originLookupMode: LookupMode,
  liveLookupMode?: LookupMode,
): "fr" | "en" {
  return preferredGlossLanguage(
    bindTargetNavToSearchOrigin(originLookupMode, liveLookupMode).restoreLookupMode,
  );
}
