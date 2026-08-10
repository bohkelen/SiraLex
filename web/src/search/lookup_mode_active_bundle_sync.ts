/**
 * ML1D2A — Decide how to sync LookupMode when the active installed bundle changes.
 *
 * Preference (`siralex.search_lookup_lang`) is never written here.
 * LookupMode remains the sole runtime search state; this helper only chooses
 * restore-vs-revalidate.
 */

export type LookupModeActiveBundleSyncAction =
  | "restore_preference_forward"
  | "revalidate_current"
  | "default_fr_mnk";

export type LookupModeActiveBundleSyncInput = {
  /** True after the first successful active-bundle sync this session. */
  hydrated: boolean;
  previousBundleId: string | undefined;
  nextBundleId: string | undefined;
  /**
   * English capability last applied to Search chrome/state.
   * Undefined before the first capability observation.
   */
  previousEnglishAvailable: boolean | undefined;
  /** Canonical: bundleSupportsEnglishLookup(next meta). */
  nextEnglishAvailable: boolean;
};

/**
 * Cases:
 * - no active bundle → default FR→MNK
 * - first hydration or bundle_id change → restore preference (forward …→MNK)
 * - same bundle_id, EN false→true (capability recovery) → restore preference
 * - same bundle_id otherwise (incl. EN true→false, true→true, false→false) → revalidate
 */
export function decideLookupModeActiveBundleSync(
  input: LookupModeActiveBundleSyncInput,
): LookupModeActiveBundleSyncAction {
  if (!input.nextBundleId) {
    return "default_fr_mnk";
  }

  if (!input.hydrated || input.previousBundleId !== input.nextBundleId) {
    return "restore_preference_forward";
  }

  const previousEn = input.previousEnglishAvailable === true;
  if (!previousEn && input.nextEnglishAvailable) {
    return "restore_preference_forward";
  }

  return "revalidate_current";
}
