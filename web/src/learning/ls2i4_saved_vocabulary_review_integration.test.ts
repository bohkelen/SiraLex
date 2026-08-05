// @vitest-environment jsdom
import "fake-indexeddb/auto";

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  STORE_QUERY_LOGS,
  STORE_RECORDS,
  STORE_SEARCH_INDEX,
  deleteSiralexDb,
  openSiralexDb,
  setActiveBundleMeta,
  type ActiveBundleMeta,
} from "../idb/siralex_db";
import { setCurrentLocale } from "../i18n";
import { createReviewSurfaceHost } from "../learning/review_surface_host";
import { saveLearningRecord } from "../learning/learning_record_store";
import type { SaveLearningRecordInput } from "../learning/learning_record_types";
import {
  createSavedVocabularySession,
  type SavedVocabularyModel,
} from "../learning/saved_vocabulary_session";
import { renderSavedVocabulary } from "../render/render_saved_vocabulary";
import type { EnrichedRecord } from "../types/records";

const BUNDLE = "bundle_ls2i4_nav";
const HASH = "sha256:navaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SCOPE = `${BUNDLE}::${HASH}`;
const TS = "2026-07-30T14:00:00.000Z";

function meta(): ActiveBundleMeta {
  return {
    bundle_id: BUNDLE,
    storage_scope_id: SCOPE,
    expected_content_sha256: HASH,
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

function saveInput(irId: string): SaveLearningRecordInput {
  return {
    bundle_id: BUNDLE,
    ir_id: irId,
    ir_kind: "lexicon_entry",
    content_sha256: HASH,
    storage_scope_id: SCOPE,
    display_cache: { headword_latin: irId },
  };
}

async function putLive(db: IDBDatabase, entry: EnrichedRecord): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_RECORDS, "readwrite");
    tx.objectStore(STORE_RECORDS).put({ ...entry, bundle_id: SCOPE });
    tx.addEventListener("complete", () => resolve());
    tx.addEventListener("error", () => reject(tx.error));
    tx.addEventListener("abort", () => reject(tx.error));
  });
}

async function countStore(db: IDBDatabase, name: string): Promise<number> {
  return await new Promise((resolve, reject) => {
    const tx = db.transaction(name, "readonly");
    const req = tx.objectStore(name).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

describe("LS2I4 Saved Vocabulary ↔ Review navigation", () => {
  beforeEach(async () => {
    setCurrentLocale("en");
    try {
      await deleteSiralexDb();
    } catch {
      // ignore
    }
  }, 20_000);

  it("removes temporary top-level #startReview from main.ts", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const mainSrc = readFileSync(join(here, "../main.ts"), "utf8");
    expect(mainSrc).not.toMatch(/id=["']startReview["']/);
    expect(mainSrc).not.toMatch(/startReviewBtn/);
    expect(mainSrc).toMatch(/onStartReview/);
    expect(mainSrc).toMatch(/focusReviewActionOnce/);
    expect(mainSrc).not.toMatch(/focusStartReviewOnce/);
  });

  it("runs Saved Vocabulary → Review → Back with updated statuses and no search", async () => {
    const db = await openSiralexDb();
    try {
      await setActiveBundleMeta(db, meta());
      await saveLearningRecord(db, saveInput("alpha"));
      await putLive(db, lexicon("alpha", "α"));
      await saveLearningRecord(db, saveInput("beta"));
      await putLive(db, lexicon("beta", "β"));

      const recordsBefore = await countStore(db, STORE_RECORDS);
      const searchBefore = await countStore(db, STORE_SEARCH_INDEX);
      const logsBefore = await countStore(db, STORE_QUERY_LOGS);

      const mount = document.createElement("div");
      document.body.appendChild(mount);
      const runSearch = vi.fn();

      let hostContext: "saved_vocabulary" | "review" = "saved_vocabulary";
      let savedGen = 0;
      let reviewGen = 0;
      let reviewHost: ReturnType<typeof createReviewSurfaceHost> | undefined;
      let focusReviewActionOnce = false;

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
          const view = renderSavedVocabulary(model, {
            onSearch: () => undefined,
            onOpen: () => undefined,
            onRemove: () => undefined,
            onStartReview: () => {
              if (generation !== savedGen || hostContext !== "saved_vocabulary") return;
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
          getActiveMeta: () => meta(),
          openDb: async () => db,
          isCurrent: () => generation === savedGen && hostContext === "saved_vocabulary",
          onUpdate: apply,
          confirmRemove: () => true,
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
          getActiveMeta: () => meta(),
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

      showSaved();
      await vi.waitFor(() => {
        expect(mount.querySelectorAll("[data-review-status='not_reviewed']").length).toBe(2);
      });
      expect(mount.querySelector("#saved-vocab-start-review")?.textContent).toBe("Start review");
      expect(mount.querySelector("#startReview")).toBeNull();

      mount.querySelector<HTMLButtonElement>("#saved-vocab-start-review")!.click();
      await vi.waitFor(() => expect(mount.querySelector(".review-reveal")).not.toBeNull());
      expect(runSearch).not.toHaveBeenCalled();
      expect(mount.querySelector(".review-headword")?.textContent).toBeTruthy();

      // Late saved-vocab generation must not redraw Review
      const reviewHtml = mount.innerHTML;
      savedGen += 1;
      expect(mount.innerHTML).toBe(reviewHtml);

      mount.querySelector<HTMLButtonElement>(".review-reveal")!.click();
      await vi.waitFor(() => expect(mount.querySelector(".review-still-learning")).not.toBeNull());
      mount.querySelector<HTMLButtonElement>(".review-still-learning")!.click();
      await vi.waitFor(() => {
        expect(mount.querySelector(".review-reveal, #review-complete-heading")).not.toBeNull();
      });

      if (mount.querySelector(".review-reveal")) {
        mount.querySelector<HTMLButtonElement>(".review-reveal")!.click();
        await vi.waitFor(() => expect(mount.querySelector(".review-remembered")).not.toBeNull());
        mount.querySelector<HTMLButtonElement>(".review-remembered")!.click();
      }
      await vi.waitFor(() => expect(mount.querySelector("#review-complete-heading")).not.toBeNull());

      const focusSpy = vi.spyOn(HTMLElement.prototype, "focus");
      mount.querySelector<HTMLButtonElement>(".review-back")!.click();
      await vi.waitFor(() => {
        expect(mount.querySelector("#saved-vocab-start-review")).not.toBeNull();
        expect(
          mount.querySelectorAll(
            "[data-review-status='still_learning'], [data-review-status='remembered']",
          ).length,
        ).toBe(2);
      });
      expect(runSearch).not.toHaveBeenCalled();
      const startBtn = mount.querySelector<HTMLButtonElement>("#saved-vocab-start-review");
      expect(startBtn?.disabled).toBe(false);
      expect(startBtn?.textContent).toBe("Continue review");
      expect(mount.textContent).toContain("Last reviewed:");
      expect(mount.querySelector(".saved-vocab-progress")).not.toBeNull();
      expect(
        focusSpy.mock.instances.some(
          (el) => el instanceof HTMLElement && el.id === "saved-vocab-start-review",
        ),
      ).toBe(true);
      focusSpy.mockRestore();

      expect(await countStore(db, STORE_RECORDS)).toBe(recordsBefore);
      expect(await countStore(db, STORE_SEARCH_INDEX)).toBe(searchBefore);
      expect(await countStore(db, STORE_QUERY_LOGS)).toBe(logsBefore);
    } finally {
      db.close();
      document.body.innerHTML = "";
    }
  });

  it("cannot start Review from unresolved-only or empty collections", async () => {
    const db = await openSiralexDb();
    try {
      await setActiveBundleMeta(db, meta());
      await saveLearningRecord(db, saveInput("ghost"));

      const mount = document.createElement("div");
      const updates: SavedVocabularyModel[] = [];
      const session = createSavedVocabularySession({
        getActiveMeta: () => meta(),
        openDb: async () => db,
        isCurrent: () => true,
        onUpdate: (m) => {
          updates.push(m);
          if (m.surface === "populated" || m.surface === "removing" || m.surface === "loading") {
            const view = renderSavedVocabulary(m, {
              onSearch: () => undefined,
              onOpen: () => undefined,
              onRemove: () => undefined,
              onStartReview: () => undefined,
            });
            mount.replaceChildren(view.root);
          } else {
            const view = renderSavedVocabulary(m, {
              onSearch: () => undefined,
              onOpen: () => undefined,
              onRemove: () => undefined,
              onStartReview: () => undefined,
            });
            mount.replaceChildren(view.root);
          }
        },
        confirmRemove: () => true,
      });
      await session.load();
      expect(mount.querySelector<HTMLButtonElement>("#saved-vocab-start-review")?.disabled).toBe(
        true,
      );

      const emptyMount = document.createElement("div");
      const emptyView = renderSavedVocabulary({ surface: "empty" }, {
        onSearch: () => undefined,
        onOpen: () => undefined,
        onRemove: () => undefined,
        onStartReview: () => undefined,
      });
      emptyMount.appendChild(emptyView.root);
      expect(emptyMount.querySelector("#saved-vocab-start-review")).toBeNull();
    } finally {
      db.close();
    }
  });
});
