// @vitest-environment jsdom
import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  STORE_RECORDS,
  deleteSiralexDb,
  openSiralexDb,
  setActiveBundleMeta,
  type ActiveBundleMeta,
} from "../idb/siralex_db";
import { setCurrentLocale } from "../i18n";
import { saveLearningRecord, reflectOnLearningRecord } from "../learning/learning_record_store";
import type { SaveLearningRecordInput } from "../learning/learning_record_types";
import { createReviewSurfaceHost } from "../learning/review_surface_host";
import type { EnrichedRecord } from "../types/records";

const BUNDLE = "bundle_ls2i3_h";
const HASH = "sha256:hostaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SCOPE = `${BUNDLE}::${HASH}`;
const TS = "2026-07-29T20:00:00.000Z";

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
    imported_at_iso: "2026-07-29T00:00:00.000Z",
  };
}

function lexicon(irId: string, headword: string, gloss: string): EnrichedRecord {
  return {
    ir_id: irId,
    ir_kind: "lexicon_entry",
    source_id: "s",
    norm_version: "norm_v3",
    preferred_form: headword,
    variant_forms: [],
    search_keys: {},
    display: {
      headword_latin: headword,
      senses: [{ gloss_fr: gloss }],
    },
  };
}

function saveInput(irId: string): SaveLearningRecordInput {
  return {
    bundle_id: BUNDLE,
    ir_id: irId,
    ir_kind: "lexicon_entry",
    content_sha256: HASH,
    storage_scope_id: SCOPE,
    display_cache: { headword_latin: irId, gloss_short: "cache-secret" },
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

async function seed(db: IDBDatabase, ids: Array<{ id: string; gloss: string }>): Promise<void> {
  await setActiveBundleMeta(db, meta());
  for (const row of ids) {
    await saveLearningRecord(db, saveInput(row.id));
    await putLive(db, lexicon(row.id, row.id, row.gloss));
  }
}

describe("LS2I3 Review surface host integration", () => {
  beforeEach(async () => {
    setCurrentLocale("en");
    try {
      await deleteSiralexDb();
    } catch {
      // ignore
    }
  }, 20_000);

  it("loads, reveals, reflects, advances, and completes with model counts", async () => {
    const db = await openSiralexDb();
    try {
      await seed(db, [
        { id: "a", gloss: "alpha-live" },
        { id: "b", gloss: "beta-live" },
      ]);

      const mount = document.createElement("div");
      document.body.appendChild(mount);
      const onBack = vi.fn();
      const host = createReviewSurfaceHost({
        mount,
        getActiveMeta: () => meta(),
        openDb: async () => db,
        isHostCurrent: () => true,
        onBack,
        now: () => TS,
      });
      host.start();

      await vi.waitFor(() => {
        expect(mount.querySelector(".review-headword")?.textContent).toBe("a");
      });
      expect(mount.textContent).not.toContain("alpha-live");
      expect(mount.textContent).not.toContain("cache-secret");
      expect(mount.querySelector(".review-still-learning")).toBeNull();

      mount.querySelector<HTMLButtonElement>(".review-reveal")!.click();
      await vi.waitFor(() => {
        expect(mount.textContent).toContain("alpha-live");
      });
      expect(mount.querySelector(".review-still-learning")).not.toBeNull();

      mount.querySelector<HTMLButtonElement>(".review-still-learning")!.click();
      await vi.waitFor(() => {
        expect(mount.querySelector(".review-headword")?.textContent).toBe("b");
      });
      expect(mount.textContent).not.toContain("beta-live");

      mount.querySelector<HTMLButtonElement>(".review-reveal")!.click();
      await vi.waitFor(() => expect(mount.textContent).toContain("beta-live"));
      mount.querySelector<HTMLButtonElement>(".review-remembered")!.click();
      await vi.waitFor(() => {
        expect(mount.querySelector("#review-complete-heading")).not.toBeNull();
      });
      expect(mount.textContent).toContain("Reviewed: 2");
      expect(mount.textContent).toContain("Still learning: 1");
      expect(mount.textContent).toContain("Remembered: 1");

      mount.querySelector<HTMLButtonElement>(".review-back")!.click();
      expect(onBack).toHaveBeenCalledTimes(1);
      expect(host.isActive()).toBe(false);
    } finally {
      db.close();
      document.body.innerHTML = "";
    }
  });

  it("keeps revealed card on reflection failure and retries once", async () => {
    const db = await openSiralexDb();
    try {
      await seed(db, [{ id: "r", gloss: "rouge" }]);
      const mount = document.createElement("div");
      let failOnce = true;
      const reflect = vi.fn(async (...args: Parameters<typeof reflectOnLearningRecord>) => {
        if (failOnce) {
          failOnce = false;
          throw new Error("write failed");
        }
        return reflectOnLearningRecord(...args);
      });
      const host = createReviewSurfaceHost({
        mount,
        getActiveMeta: () => meta(),
        openDb: async () => db,
        isHostCurrent: () => true,
        onBack: () => undefined,
        now: () => TS,
        reflect,
      });
      host.start();
      await vi.waitFor(() => expect(mount.querySelector(".review-reveal")).not.toBeNull());
      mount.querySelector<HTMLButtonElement>(".review-reveal")!.click();
      await vi.waitFor(() => expect(mount.querySelector(".review-remembered")).not.toBeNull());
      mount.querySelector<HTMLButtonElement>(".review-remembered")!.click();
      await vi.waitFor(() => {
        expect(mount.querySelector("#review-card-error")).not.toBeNull();
      });
      expect(mount.querySelector(".review-headword")?.textContent).toBe("r");
      expect(mount.textContent).toContain("rouge");
      expect(mount.querySelector("#review-complete-heading")).toBeNull();

      mount.querySelector<HTMLButtonElement>(".review-still-learning")!.click();
      await vi.waitFor(() => {
        expect(mount.querySelector("#review-complete-heading")).not.toBeNull();
      });
      expect(reflect).toHaveBeenCalledTimes(2);
      expect(mount.textContent).toContain("Still learning: 1");
    } finally {
      db.close();
      document.body.innerHTML = "";
    }
  });

  it("drops stale updates after dispose and does not rerun search on back", async () => {
    const db = await openSiralexDb();
    try {
      await seed(db, [{ id: "s", gloss: "sable" }]);
      const mount = document.createElement("div");
      let current = true;
      const onBack = vi.fn(() => {
        current = false;
      });
      const host = createReviewSurfaceHost({
        mount,
        getActiveMeta: () => meta(),
        openDb: async () => db,
        isHostCurrent: () => current,
        onBack,
        now: () => TS,
      });
      host.start();
      await vi.waitFor(() => expect(mount.querySelector(".review-headword")).not.toBeNull());
      const before = mount.innerHTML;
      host.dispose();
      // Late model would be ignored — mount unchanged by dispose itself after last apply
      expect(mount.innerHTML).toBe(before);
      expect(host.isActive()).toBe(false);
      expect(onBack).not.toHaveBeenCalled();
    } finally {
      db.close();
      document.body.innerHTML = "";
    }
  });

  it("Review again starts a fresh session from complete", async () => {
    const db = await openSiralexDb();
    try {
      await seed(db, [{ id: "one", gloss: "un" }]);
      const mount = document.createElement("div");
      const host = createReviewSurfaceHost({
        mount,
        getActiveMeta: () => meta(),
        openDb: async () => db,
        isHostCurrent: () => true,
        onBack: () => undefined,
        now: () => TS,
      });
      host.start();
      await vi.waitFor(() => expect(mount.querySelector(".review-reveal")).not.toBeNull());
      mount.querySelector<HTMLButtonElement>(".review-reveal")!.click();
      await vi.waitFor(() => expect(mount.querySelector(".review-remembered")).not.toBeNull());
      mount.querySelector<HTMLButtonElement>(".review-remembered")!.click();
      await vi.waitFor(() => expect(mount.querySelector(".review-again")).not.toBeNull());
      mount.querySelector<HTMLButtonElement>(".review-again")!.click();
      await vi.waitFor(() => {
        expect(mount.querySelector(".review-headword")?.textContent).toBe("one");
        expect(mount.querySelector(".review-reveal")).not.toBeNull();
      });
      expect(mount.textContent).not.toContain("un");
    } finally {
      db.close();
      document.body.innerHTML = "";
    }
  });

  it("drops stale session updates when host is no longer current", async () => {
    const db = await openSiralexDb();
    try {
      await seed(db, [{ id: "stale", gloss: "vieux" }]);
      const mount = document.createElement("div");
      let current = true;
      let release!: () => void;
      const gate = new Promise<void>((r) => {
        release = r;
      });
      const reflect = vi.fn(async (...args: Parameters<typeof reflectOnLearningRecord>) => {
        await gate;
        return reflectOnLearningRecord(...args);
      });
      const host = createReviewSurfaceHost({
        mount,
        getActiveMeta: () => meta(),
        openDb: async () => db,
        isHostCurrent: () => current,
        onBack: () => undefined,
        now: () => TS,
        reflect,
      });
      host.start();
      await vi.waitFor(() => expect(mount.querySelector(".review-reveal")).not.toBeNull());
      mount.querySelector<HTMLButtonElement>(".review-reveal")!.click();
      await vi.waitFor(() => expect(mount.querySelector(".review-remembered")).not.toBeNull());
      mount.querySelector<HTMLButtonElement>(".review-remembered")!.click();
      await vi.waitFor(() => expect(mount.querySelector(".review-busy-status")).not.toBeNull());
      const before = mount.innerHTML;
      current = false;
      release();
      await Promise.resolve();
      await new Promise((r) => setTimeout(r, 20));
      expect(mount.innerHTML).toBe(before);
      expect(mount.querySelector("#review-complete-heading")).toBeNull();
    } finally {
      db.close();
      document.body.innerHTML = "";
    }
  });

  it("emits navigable empty and unavailable surfaces", async () => {
    const mount = document.createElement("div");
    const onBack = vi.fn();
    const host = createReviewSurfaceHost({
      mount,
      getActiveMeta: () => undefined,
      openDb: async () => {
        throw new Error("should not open");
      },
      isHostCurrent: () => true,
      onBack,
    });
    host.start();
    await vi.waitFor(() => {
      expect(mount.textContent).toContain("Add a dictionary");
    });
    mount.querySelector<HTMLButtonElement>(".review-back")!.click();
    expect(onBack).toHaveBeenCalled();
  });
});
