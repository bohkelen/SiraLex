import { describe, expect, it } from "vitest";

import {
  DICTIONARY_REINSTALL_POLICY,
  getDictionaryUpdateComparison,
  getFeaturedUpdateKind,
  isActiveFeaturedUpdateAvailable,
  isDictionaryUpdateAvailable,
} from "./dictionary_update_availability";
import {
  applyNoticeDismissed,
  beginConfirm,
  beginProgress,
  closeUpdateUi,
  createDictionaryUpdateConsumerState,
  mapInstallLifecycleToConsumerStage,
  markUpdateFailure,
  markUpdateSuccess,
  shouldShowSearchUpdateNotice,
} from "./dictionary_update_consumer_state";

const BUNDLE_ID = "bundle_full_20260710_337619ff";
const OLD_HASH = "sha256:337619ff43131acde1390d7892d687372785729dac5d85abe82b61cc92285c3c";
const NEW_HASH = "sha256:d076558b2f668a06a5a30a143026433e9e0de3523e0397183cfd897b2641d90a";
const FEATURED_LINEAGE_ID = "bundle_noncommercial_dfd5ba62";
const FEATURED_HASH = "sha256:dfd5ba62514caa72f9e282d16160ded01c26164c5c982fd6d164b78b6f7aeb33";

const catalogEntry = {
  bundle_id: BUNDLE_ID,
  name: "Featured",
  version: "1",
  size_bytes: 1,
  url_base: "./x/",
  content_sha256: NEW_HASH,
};

const featuredLineageEntry = {
  bundle_id: FEATURED_LINEAGE_ID,
  name: "Noncommercial",
  version: "1",
  size_bytes: 32_805_591,
  url_base: "./bundle_noncommercial_dfd5ba62__51c38a75/",
  content_sha256: FEATURED_HASH,
};

describe("DU1 dictionary update availability", () => {
  it("detects update only when same bundle_id and different content hash", () => {
    expect(isDictionaryUpdateAvailable(catalogEntry)).toBe(false);
    expect(
      isDictionaryUpdateAvailable(catalogEntry, {
        bundle_id: BUNDLE_ID,
        expected_content_sha256: OLD_HASH,
      }),
    ).toBe(true);
    expect(
      getDictionaryUpdateComparison(catalogEntry, {
        bundle_id: BUNDLE_ID,
        expected_content_sha256: NEW_HASH,
      }).state,
    ).toBe("installed_current");
    expect(
      isDictionaryUpdateAvailable(catalogEntry, {
        bundle_id: "other",
        expected_content_sha256: OLD_HASH,
      }),
    ).toBe(false);
  });

  it("offers featured update for same-id hash change and for featured lineage change", () => {
    expect(
      isActiveFeaturedUpdateAvailable({
        active: { bundle_id: BUNDLE_ID, expected_content_sha256: OLD_HASH },
        featuredEntry: catalogEntry,
      }),
    ).toBe(true);
    expect(getFeaturedUpdateKind({
      active: { bundle_id: BUNDLE_ID, expected_content_sha256: OLD_HASH },
      featuredEntry: catalogEntry,
    })).toBe("same_id_content");

    expect(
      isActiveFeaturedUpdateAvailable({
        active: { bundle_id: BUNDLE_ID, expected_content_sha256: NEW_HASH },
        featuredEntry: catalogEntry,
      }),
    ).toBe(false);

    expect(
      isActiveFeaturedUpdateAvailable({
        active: { bundle_id: BUNDLE_ID, expected_content_sha256: NEW_HASH },
        featuredEntry: featuredLineageEntry,
      }),
    ).toBe(true);
    expect(
      getFeaturedUpdateKind({
        active: { bundle_id: BUNDLE_ID, expected_content_sha256: NEW_HASH },
        featuredEntry: featuredLineageEntry,
      }),
    ).toBe("featured_lineage");

    expect(
      isActiveFeaturedUpdateAvailable({
        active: { bundle_id: FEATURED_LINEAGE_ID, expected_content_sha256: FEATURED_HASH },
        featuredEntry: featuredLineageEntry,
      }),
    ).toBe(false);
  });

  it("does not treat missing active/featured as an update", () => {
    expect(isActiveFeaturedUpdateAvailable({})).toBe(false);
    expect(
      isActiveFeaturedUpdateAvailable({
        featuredEntry: featuredLineageEntry,
      }),
    ).toBe(false);
  });

  it("blocks destructive same-hash reinstall policy", () => {
    expect(DICTIONARY_REINSTALL_POLICY.supported).toBe(false);
    expect(DICTIONARY_REINSTALL_POLICY.reason).toMatch(/same-hash|skip|content_sha256/i);
  });
});

describe("DU1 dictionary update consumer state", () => {
  it("shows search notice only when update available and not dismissed", () => {
    expect(
      shouldShowSearchUpdateNotice({
        updateAvailable: true,
        noticeDismissedThisSession: false,
        phase: "idle",
      }),
    ).toBe(true);
    expect(
      shouldShowSearchUpdateNotice({
        updateAvailable: true,
        noticeDismissedThisSession: true,
        phase: "idle",
      }),
    ).toBe(false);
    expect(
      shouldShowSearchUpdateNotice({
        updateAvailable: false,
        noticeDismissedThisSession: false,
        phase: "idle",
      }),
    ).toBe(false);
    expect(
      shouldShowSearchUpdateNotice({
        updateAvailable: true,
        noticeDismissedThisSession: false,
        phase: "success",
      }),
    ).toBe(false);
  });

  it("tracks confirm → progress → success/failure → close", () => {
    let state = createDictionaryUpdateConsumerState();
    state = beginConfirm(state);
    expect(state.phase).toBe("confirming");
    state = beginProgress(state, "Preparing update…");
    expect(state.phase).toBe("progress");
    expect(state.progressMessage).toBe("Preparing update…");
    state = markUpdateSuccess(state, "cleanup warn");
    expect(state.phase).toBe("success");
    expect(state.cleanupWarning).toBe("cleanup warn");
    state = closeUpdateUi(state);
    expect(state.phase).toBe("idle");

    state = beginConfirm(createDictionaryUpdateConsumerState());
    state = markUpdateFailure(state, "network");
    expect(state.phase).toBe("failure");
    expect(state.failureMessage).toBe("network");

    state = applyNoticeDismissed(createDictionaryUpdateConsumerState());
    expect(state.noticeDismissedThisSession).toBe(true);
  });

  it("maps install lifecycle hints to consumer stages", () => {
    expect(mapInstallLifecycleToConsumerStage("fetching records")).toBe("downloading");
    expect(mapInstallLifecycleToConsumerStage("manifest verification")).toBe("verifying");
    expect(mapInstallLifecycleToConsumerStage("staging payloads")).toBe("installing");
    expect(mapInstallLifecycleToConsumerStage("cleanup previous")).toBe("cleanup");
    expect(mapInstallLifecycleToConsumerStage("preparing")).toBe("preparing");
  });
});
