// @vitest-environment jsdom
/**
 * LS3I3 — Return action and navigation integration.
 * Mirrors main.ts host-context / generation / focusReviewActionOnce rules.
 */
import "fake-indexeddb/auto";

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  STORE_RECORDS,
  deleteSiralexDb,
  openSiralexDb,
  setActiveBundleMeta,
  type ActiveBundleMeta,
} from "../idb/siralex_db";
import { setCurrentLocale } from "../i18n";
import { createReviewSurfaceHost } from "./review_surface_host";
import { saveLearningRecord } from "./learning_record_store";
import type { SaveLearningRecordInput } from "./learning_record_types";
import {
  createSavedVocabularySession,
  type SavedVocabularyModel,
} from "./saved_vocabulary_session";
import { renderSavedVocabulary } from "../render/render_saved_vocabulary";
import type { EnrichedRecord } from "../types/records";

const BUNDLE = "bundle_ls3i3_nav";
const HASH = "sha256:ls3i3aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SCOPE = `${BUNDLE}::${HASH}`;
const TS = "2026-07-30T16:00:00.000Z";

function meta(bundleId = BUNDLE, scope = SCOPE, hash = HASH): ActiveBundleMeta {
  return {
    bundle_id: bundleId,
    storage_scope_id: scope,
    expected_content_sha256: hash,
    manifest_schema_version: "bundle_manifest_v1",
    record_schema_id: "normalized_v1",
    record_schema_version: "1",
    normalization_ruleset: "norm_v3",
    update_mode: "REPLACE_ALL",
    reconciliation_action: "REPLACE_ALL",
    imported_at_iso: "2026-07-30T00:00:00.000Z",
  };
}

function lexicon(irId: string, gloss: string): EnrichedRecord {
  return {
    ir_id: irId,
    ir_kind: "lexicon_entry",
    source_id: "s",
    norm_version: "norm_v3",
    preferred_form: irId,
    variant_forms: [],
    search_keys: {},
    display: { headword_latin: irId, senses: [{ gloss_fr: gloss }] },
  };
}

function saveInput(irId: string, bundleId = BUNDLE, hash = HASH, scope = SCOPE): SaveLearningRecordInput {
  return {
    bundle_id: bundleId,
    ir_id: irId,
    ir_kind: "lexicon_entry",
    content_sha256: hash,
    storage_scope_id: scope,
    display_cache: { headword_latin: irId },
  };
}

async function putLive(db: IDBDatabase, entry: EnrichedRecord, scope = SCOPE): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_RECORDS, "readwrite");
    tx.objectStore(STORE_RECORDS).put({ ...entry, bundle_id: scope });
    tx.addEventListener("complete", () => resolve());
    tx.addEventListener("error", () => reject(tx.error));
    tx.addEventListener("abort", () => reject(tx.error));
  });
}

type Harness = {
  mount: HTMLElement;
  runSearch: ReturnType<typeof vi.fn>;
  showSaved: () => void;
  showReview: () => void;
  getReviewHost: () => ReturnType<typeof createReviewSurfaceHost> | undefined;
  getHostContext: () => "saved_vocabulary" | "review";
  getLastModel: () => SavedVocabularyModel | undefined;
  confirmRemove: ReturnType<typeof vi.fn>;
};

function createHarness(db: IDBDatabase, activeMeta: () => ActiveBundleMeta): Harness {
  const mount = document.createElement("div");
  document.body.appendChild(mount);
  const runSearch = vi.fn();
  let hostContext: "saved_vocabulary" | "review" = "saved_vocabulary";
  let savedGen = 0;
  let reviewGen = 0;
  let reviewHost: ReturnType<typeof createReviewSurfaceHost> | undefined;
  let focusReviewActionOnce = false;
  let lastModel: SavedVocabularyModel | undefined;
  const confirmRemove = vi.fn(() => true);

  const showSaved = () => {
    reviewHost?.dispose();
    reviewHost = undefined;
    reviewGen += 1;
    const generation = ++savedGen;
    hostContext = "saved_vocabulary";
    const restore = focusReviewActionOnce;
    focusReviewActionOnce = false;
    let restored = false;

    const apply = (model: SavedVocabularyModel) => {
      if (generation !== savedGen || hostContext !== "saved_vocabulary") return;
      lastModel = model;
      const view = renderSavedVocabulary(model, {
        onSearch: () => undefined,
        onOpen: () => undefined,
        onRemove: (row) => {
          void session.remove(row.bundle_id, row.ir_id);
        },
        onStartReview: () => {
          if (generation !== savedGen || hostContext !== "saved_vocabulary") return;
          if (reviewHost?.isActive()) return;
          showReview();
        },
      });
      mount.replaceChildren(view.root);
      if (restore && !restored && model.surface !== "loading") {
        restored = true;
        if (view.startReviewButton && !view.startReviewButton.disabled) {
          view.startReviewButton.focus();
        } else {
          view.heading?.focus();
        }
      }
    };

    const session = createSavedVocabularySession({
      getActiveMeta: activeMeta,
      openDb: async () => db,
      isCurrent: () => generation === savedGen && hostContext === "saved_vocabulary",
      onUpdate: apply,
      confirmRemove: () => confirmRemove() as boolean,
    });
    apply({ surface: "loading" });
    void session.load();
  };

  const showReview = () => {
    reviewHost?.dispose();
    const generation = ++reviewGen;
    savedGen += 1;
    hostContext = "review";
    focusReviewActionOnce = false;
    const host = createReviewSurfaceHost({
      mount,
      getActiveMeta: activeMeta,
      openDb: async () => db,
      isHostCurrent: () => generation === reviewGen && hostContext === "review",
      onBack: () => {
        reviewHost?.dispose();
        reviewHost = undefined;
        reviewGen += 1;
        focusReviewActionOnce = true;
        showSaved();
      },
      now: () => TS,
    });
    reviewHost = host;
    host.start();
  };

  return {
    mount,
    runSearch,
    showSaved,
    showReview,
    getReviewHost: () => reviewHost,
    getHostContext: () => hostContext,
    getLastModel: () => lastModel,
    confirmRemove,
  };
}

async function completeOneCard(mount: HTMLElement, outcome: "still" | "remembered"): Promise<void> {
  await vi.waitFor(() => expect(mount.querySelector(".review-reveal")).not.toBeNull());
  mount.querySelector<HTMLButtonElement>(".review-reveal")!.click();
  const selector = outcome === "still" ? ".review-still-learning" : ".review-remembered";
  await vi.waitFor(() => expect(mount.querySelector(selector)).not.toBeNull());
  mount.querySelector<HTMLButtonElement>(selector)!.click();
}

describe("LS3I3 Return action and navigation integration", () => {
  beforeEach(async () => {
    setCurrentLocale("en");
    try {
      await deleteSiralexDb();
    } catch {
      // ignore
    }
  }, 20_000);

  it("main.ts uses focusReviewActionOnce and shared onStartReview path", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const mainSrc = readFileSync(join(here, "../main.ts"), "utf8");
    expect(mainSrc).toMatch(/focusReviewActionOnce/);
    expect(mainSrc).not.toMatch(/focusStartReviewOnce/);
    expect(mainSrc).toMatch(/onStartReview/);
    expect(mainSrc).toMatch(/activeReviewHost\?\.isActive\(\)/);
    expect(mainSrc).toMatch(/invalidateCollectionAndReviewContexts\(\)/);
  });

  it("Start and Continue share one callback path into a fresh Review session", async () => {
    const db = await openSiralexDb();
    try {
      await setActiveBundleMeta(db, meta());
      await saveLearningRecord(db, saveInput("a"));
      await putLive(db, lexicon("a", "α"));
      const h = createHarness(db, () => meta());
      const startCalls: string[] = [];

      h.showSaved();
      await vi.waitFor(() => {
        expect(h.mount.querySelector<HTMLButtonElement>("#saved-vocab-start-review")?.disabled).toBe(false);
        expect(h.mount.querySelector(".saved-vocab-progress")).not.toBeNull();
      });
      const model = h.getLastModel();
      expect(model?.surface).toBe("populated");
      if (model?.surface !== "populated") throw new Error("expected populated");
      expect(model.progress.reviewAction).toEqual({
        state: "enabled",
        label: "start",
      });

      const btn = h.mount.querySelector<HTMLButtonElement>("#saved-vocab-start-review")!;
      btn.addEventListener("click", () => startCalls.push(btn.textContent ?? ""));
      btn.click();
      await vi.waitFor(() => expect(h.mount.querySelector(".review-reveal")).not.toBeNull());
      expect(h.runSearch).not.toHaveBeenCalled();
      expect(h.getHostContext()).toBe("review");
      expect(startCalls).toEqual(["Start review"]);

      await completeOneCard(h.mount, "still");
      await vi.waitFor(() => expect(h.mount.querySelector("#review-complete-heading")).not.toBeNull());
      h.mount.querySelector<HTMLButtonElement>(".review-back")!.click();
      await vi.waitFor(() => {
        expect(h.mount.querySelector("#saved-vocab-start-review")?.textContent).toBe(
          "Continue review",
        );
      });
      const after = h.getLastModel();
      expect(after?.surface === "populated" && after.progress).toMatchObject({
        not_reviewed: 0,
        still_learning: 1,
        reviewAction: { state: "enabled", label: "continue" },
      });
      expect(h.mount.querySelector('[data-progress-metric="still_learning"] dd')?.textContent).toBe(
        "1",
      );

      h.mount.querySelector<HTMLButtonElement>("#saved-vocab-start-review")!.click();
      await vi.waitFor(() => expect(h.mount.querySelector(".review-reveal")).not.toBeNull());
      expect(h.runSearch).not.toHaveBeenCalled();
      expect(h.getHostContext()).toBe("review");
    } finally {
      db.close();
      document.body.innerHTML = "";
    }
  });

  it("double Start/Continue activation yields one active Review host", async () => {
    const db = await openSiralexDb();
    try {
      await setActiveBundleMeta(db, meta());
      await saveLearningRecord(db, saveInput("solo"));
      await putLive(db, lexicon("solo", "s"));
      const h = createHarness(db, () => meta());
      h.showSaved();
      await vi.waitFor(() =>
        expect(h.mount.querySelector<HTMLButtonElement>("#saved-vocab-start-review")?.disabled).toBe(false),
      );

      const btn = h.mount.querySelector<HTMLButtonElement>("#saved-vocab-start-review")!;
      btn.click();
      btn.click();
      btn.click();
      await vi.waitFor(() => expect(h.mount.querySelector(".review-reveal")).not.toBeNull());
      expect(h.getReviewHost()?.isActive()).toBe(true);
      expect(h.mount.querySelectorAll(".review-surface").length).toBe(1);
    } finally {
      db.close();
      document.body.innerHTML = "";
    }
  });

  it("Back reloads Progress and restores focus to Continue after first reflection", async () => {
    const db = await openSiralexDb();
    try {
      await setActiveBundleMeta(db, meta());
      await saveLearningRecord(db, saveInput("n1"));
      await putLive(db, lexicon("n1", "n"));
      await saveLearningRecord(db, saveInput("n2"));
      await putLive(db, lexicon("n2", "n"));
      const h = createHarness(db, () => meta());
      h.showSaved();
      await vi.waitFor(() =>
        expect(h.mount.querySelector('[data-progress-metric="not_reviewed"] dd')?.textContent).toBe(
          "2",
        ),
      );

      h.mount.querySelector<HTMLButtonElement>("#saved-vocab-start-review")!.click();
      await completeOneCard(h.mount, "remembered");
      // May complete or show next card; finish remaining if needed.
      if (h.mount.querySelector(".review-reveal")) {
        await completeOneCard(h.mount, "still");
      }
      await vi.waitFor(() =>
        expect(
          h.mount.querySelector("#review-complete-heading, .review-reveal"),
        ).not.toBeNull(),
      );
      if (h.mount.querySelector(".review-reveal")) {
        await completeOneCard(h.mount, "still");
      }
      await vi.waitFor(() => expect(h.mount.querySelector("#review-complete-heading")).not.toBeNull());

      const focusSpy = vi.spyOn(HTMLElement.prototype, "focus");
      h.mount.querySelector<HTMLButtonElement>(".review-back")!.click();
      await vi.waitFor(() => {
        expect(h.mount.querySelector("#saved-vocab-start-review")?.textContent).toBe(
          "Continue review",
        );
      });
      const model = h.getLastModel();
      expect(model?.surface === "populated" && model.progress.not_reviewed).toBe(0);
      expect(model?.surface === "populated" && model.progress.reviewable).toBe(2);
      expect(
        focusSpy.mock.instances.some(
          (el) => el instanceof HTMLElement && el.id === "saved-vocab-start-review",
        ),
      ).toBe(true);
      focusSpy.mockRestore();
      expect(h.runSearch).not.toHaveBeenCalled();
    } finally {
      db.close();
      document.body.innerHTML = "";
    }
  });

  it("unresolved-only collection restores focus to heading, not disabled action", async () => {
    const db = await openSiralexDb();
    try {
      await setActiveBundleMeta(db, meta());
      await saveLearningRecord(db, saveInput("ghost"));
      const h = createHarness(db, () => meta());
      h.showSaved();
      await vi.waitFor(() =>
        expect(h.mount.querySelector<HTMLButtonElement>("#saved-vocab-start-review")?.disabled).toBe(true),
      );

      const focusSpy = vi.spyOn(HTMLElement.prototype, "focus");
      h.showReview();
      await vi.waitFor(() => {
        expect(h.mount.textContent).toMatch(/No saved entries are currently available for review/i);
        expect(h.mount.querySelector(".review-back")).not.toBeNull();
      });
      h.mount.querySelector<HTMLButtonElement>(".review-back")!.click();
      await vi.waitFor(() => {
        expect(h.mount.querySelector(".saved-vocab-progress")).not.toBeNull();
        expect(h.mount.querySelector<HTMLButtonElement>("#saved-vocab-start-review")?.disabled).toBe(true);
      });
      expect(
        focusSpy.mock.instances.some(
          (el) => el instanceof HTMLElement && el.id === "saved-vocab-heading",
        ),
      ).toBe(true);
      expect(document.activeElement?.id).not.toBe("saved-vocab-start-review");
      focusSpy.mockRestore();
    } finally {
      db.close();
      document.body.innerHTML = "";
    }
  });

  it("Review again creates a fresh session without reopening Saved Vocabulary", async () => {
    const db = await openSiralexDb();
    try {
      await setActiveBundleMeta(db, meta());
      await saveLearningRecord(db, saveInput("again"));
      await putLive(db, lexicon("again", "a"));
      const h = createHarness(db, () => meta());
      h.showSaved();
      await vi.waitFor(() =>
        expect(h.mount.querySelector<HTMLButtonElement>("#saved-vocab-start-review")?.disabled).toBe(false),
      );
      h.mount.querySelector<HTMLButtonElement>("#saved-vocab-start-review")!.click();
      await completeOneCard(h.mount, "still");
      await vi.waitFor(() => expect(h.mount.querySelector("#review-complete-heading")).not.toBeNull());

      expect(h.mount.querySelector("#review-complete-heading")).not.toBeNull();
      h.mount.querySelector<HTMLButtonElement>(".review-again")!.click();
      await vi.waitFor(() => expect(h.mount.querySelector(".review-reveal")).not.toBeNull());
      expect(h.getHostContext()).toBe("review");
      expect(h.mount.querySelector(".saved-vocab-progress")).toBeNull();
      expect(h.mount.querySelector("#review-complete-heading")).toBeNull();
      expect(h.getReviewHost()?.isActive()).toBe(true);
      expect(h.runSearch).not.toHaveBeenCalled();
    } finally {
      db.close();
      document.body.innerHTML = "";
    }
  });

  it("stale Review completion callback cannot reopen after navigation away", async () => {
    const db = await openSiralexDb();
    try {
      await setActiveBundleMeta(db, meta());
      await saveLearningRecord(db, saveInput("stale"));
      await putLive(db, lexicon("stale", "s"));
      const h = createHarness(db, () => meta());
      h.showSaved();
      await vi.waitFor(() =>
        expect(h.mount.querySelector<HTMLButtonElement>("#saved-vocab-start-review")?.disabled).toBe(false),
      );
      h.mount.querySelector<HTMLButtonElement>("#saved-vocab-start-review")!.click();
      await completeOneCard(h.mount, "still");
      await vi.waitFor(() => expect(h.mount.querySelector(".review-again")).not.toBeNull());

      const disposedHost = h.getReviewHost();
      h.mount.querySelector<HTMLButtonElement>(".review-back")!.click();
      await vi.waitFor(() => expect(h.mount.querySelector(".saved-vocab-progress")).not.toBeNull());
      expect(disposedHost?.isActive()).toBe(false);

      // Stale again click on disposed host must not recreate Review.
      disposedHost?.start();
      expect(h.getHostContext()).toBe("saved_vocabulary");
      expect(h.mount.querySelector(".review-reveal")).toBeNull();
    } finally {
      db.close();
      document.body.innerHTML = "";
    }
  });

  it("Remove updates Progress; cancelled remove leaves counts unchanged", async () => {
    const db = await openSiralexDb();
    try {
      await setActiveBundleMeta(db, meta());
      await saveLearningRecord(db, saveInput("keep"));
      await putLive(db, lexicon("keep", "k"));
      await saveLearningRecord(db, saveInput("drop"));
      await putLive(db, lexicon("drop", "d"));
      const h = createHarness(db, () => meta());
      h.showSaved();
      await vi.waitFor(() =>
        expect(h.mount.querySelector('[data-progress-metric="saved"] dd')?.textContent).toBe("2"),
      );

      h.confirmRemove.mockReturnValueOnce(false);
      h.mount.querySelectorAll<HTMLButtonElement>(".saved-vocab-remove")[0]!.click();
      await Promise.resolve();
      expect(h.mount.querySelector('[data-progress-metric="saved"] dd')?.textContent).toBe("2");

      h.confirmRemove.mockReturnValue(true);
      const removeButtons = h.mount.querySelectorAll<HTMLButtonElement>(".saved-vocab-remove");
      removeButtons[0]!.click();
      await vi.waitFor(() =>
        expect(h.mount.querySelector('[data-progress-metric="saved"] dd')?.textContent).toBe("1"),
      );
      const model = h.getLastModel();
      expect(model?.surface === "populated" && model.progress.total_saved).toBe(1);

      removeButtons.length;
      h.mount.querySelector<HTMLButtonElement>(".saved-vocab-remove")!.click();
      await vi.waitFor(() => expect(h.mount.querySelector(".saved-vocab-progress")).toBeNull());
      expect(h.getLastModel()?.surface).toBe("empty");
    } finally {
      db.close();
      document.body.innerHTML = "";
    }
  });

  it("ordinary Saved Vocabulary open does not auto-focus Review action", async () => {
    const db = await openSiralexDb();
    try {
      await setActiveBundleMeta(db, meta());
      await saveLearningRecord(db, saveInput("focus"));
      await putLive(db, lexicon("focus", "f"));
      const h = createHarness(db, () => meta());
      h.showSaved();
      await vi.waitFor(() =>
        expect(h.mount.querySelector<HTMLButtonElement>("#saved-vocab-start-review")?.disabled).toBe(false),
      );
      expect(document.activeElement?.id).not.toBe("saved-vocab-start-review");
    } finally {
      db.close();
      document.body.innerHTML = "";
    }
  });

  it("active-bundle Progress scopes to current bundle only", async () => {
    const db = await openSiralexDb();
    const B = "bundle_ls3i3_b";
    const HB = "sha256:ls3i3bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    const SB = `${B}::${HB}`;
    try {
      await setActiveBundleMeta(db, meta());
      await saveLearningRecord(db, saveInput("a1"));
      await putLive(db, lexicon("a1", "a"));
      await saveLearningRecord(db, saveInput("b1", B, HB, SB));
      await putLive(db, lexicon("b1", "b"), SB);

      let active = meta();
      const h = createHarness(db, () => active);
      h.showSaved();
      await vi.waitFor(() =>
        expect(h.mount.querySelector('[data-progress-metric="saved"] dd')?.textContent).toBe("1"),
      );

      active = meta(B, SB, HB);
      await setActiveBundleMeta(db, active);
      h.showSaved();
      await vi.waitFor(() =>
        expect(h.mount.querySelector('[data-progress-metric="saved"] dd')?.textContent).toBe("1"),
      );
      expect(h.mount.textContent).toContain("b1");
      expect(h.mount.textContent).not.toContain("a1");
    } finally {
      db.close();
      document.body.innerHTML = "";
    }
  });

  it("one-use focus intent is consumed once across reloads", async () => {
    const db = await openSiralexDb();
    try {
      await setActiveBundleMeta(db, meta());
      await saveLearningRecord(db, saveInput("once"));
      await putLive(db, lexicon("once", "o"));
      const h = createHarness(db, () => meta());
      h.showSaved();
      await vi.waitFor(() =>
        expect(h.mount.querySelector<HTMLButtonElement>("#saved-vocab-start-review")?.disabled).toBe(false),
      );
      h.mount.querySelector<HTMLButtonElement>("#saved-vocab-start-review")!.click();
      await completeOneCard(h.mount, "still");
      await vi.waitFor(() => expect(h.mount.querySelector(".review-back")).not.toBeNull());

      const focusSpy = vi.spyOn(HTMLElement.prototype, "focus");
      h.mount.querySelector<HTMLButtonElement>(".review-back")!.click();
      await vi.waitFor(() =>
        expect(h.mount.querySelector("#saved-vocab-start-review")?.textContent).toBe(
          "Continue review",
        ),
      );
      const focusesToButton = focusSpy.mock.instances.filter(
        (el) => el instanceof HTMLElement && el.id === "saved-vocab-start-review",
      ).length;
      expect(focusesToButton).toBeGreaterThanOrEqual(1);

      // Ordinary reopen must not focus again.
      focusSpy.mockClear();
      h.showSaved();
      await vi.waitFor(() =>
        expect(h.mount.querySelector<HTMLButtonElement>("#saved-vocab-start-review")?.disabled).toBe(false),
      );
      expect(
        focusSpy.mock.instances.some(
          (el) => el instanceof HTMLElement && el.id === "saved-vocab-start-review",
        ),
      ).toBe(false);
      focusSpy.mockRestore();
    } finally {
      db.close();
      document.body.innerHTML = "";
    }
  });
});
