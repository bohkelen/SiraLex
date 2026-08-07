/**
 * ML1D1 harness: multilingual LookupMode search + query-log + CF2 snapshot identity
 * without exposing English UI controls.
 */
import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { buildSearchFeedbackCaptureContext } from "../search_feedback/search_feedback_capture_model";
import type { ExecutedSearchSnapshot } from "../search_feedback/search_feedback_capture_model";
import {
  deleteSiralexDb,
  openSiralexDb,
  STORE_SEARCH_INDEX,
} from "../idb/siralex_db";
import { recordQueryLoggingConsent } from "../query_logging/query_log_consent";
import { isQueryLogEventV3 } from "../query_logging/query_log_derive";
import { appendSearchQueryLogIfEnabled } from "../query_logging/query_log_runtime";
import { listQueryLogs } from "../query_logging/query_log_store";
import {
  indexFamilyForLookupInput,
  resolveSupportedLookupMode,
  toLegacySearchDirection,
  type LookupMode,
} from "./lookup_mode";
import { searchQueryForLookupMode } from "./search_query";

const SCOPE = "bundle-ml1d1-harness";
const EN_CAPABLE = {
  lookup_languages: ["fr", "en", "mnk"],
  search_key_families: ["src", "en", "tgt"],
};

async function putKey(
  db: IDBDatabase,
  keyType: string,
  key: string,
  irIds: string[],
): Promise<void> {
  const tx = db.transaction(STORE_SEARCH_INDEX, "readwrite");
  tx.objectStore(STORE_SEARCH_INDEX).put({
    bundle_id: SCOPE,
    key_type: keyType,
    key,
    ir_ids: irIds,
  });
  await new Promise<void>((resolve, reject) => {
    tx.addEventListener("complete", () => resolve());
    tx.addEventListener("error", () => reject(tx.error));
    tx.addEventListener("abort", () => reject(tx.error));
  });
}

function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    key() {
      return null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  };
}

describe("ML1D1 multilingual search state harness", () => {
  beforeEach(async () => {
    try {
      await deleteSiralexDb();
    } catch {
      // ok
    }
  });

  it("probes four LookupModes with matching log + CF2 language identity", async () => {
    const db = await openSiralexDb();
    const storage = createMemoryStorage();
    globalThis.localStorage = storage;
    storage.setItem("siralex.query_logging.enabled", "true");
    recordQueryLoggingConsent(() => new Date("2026-07-01T00:00:00.000Z"));

    await putKey(db, "src_casefold", "maison", ["ir-fr"]);
    await putKey(db, "en_casefold", "house", ["ir-en"]);
    await putKey(db, "tgt_casefold", "bón", ["ir-mnk"]);

    const probes: Array<{
      mode: LookupMode;
      query: string;
      family: "src" | "en" | "tgt";
    }> = [
      { mode: { from: "fr", to: "mnk" }, query: "maison", family: "src" },
      { mode: { from: "en", to: "mnk" }, query: "house", family: "en" },
      { mode: { from: "mnk", to: "fr" }, query: "bón", family: "tgt" },
      { mode: { from: "mnk", to: "en" }, query: "bón", family: "tgt" },
    ];

    try {
      for (const [i, probe] of probes.entries()) {
        expect(indexFamilyForLookupInput(probe.mode.from)).toBe(probe.family);

        const result = await searchQueryForLookupMode(
          db,
          SCOPE,
          probe.mode,
          probe.query,
          true,
          EN_CAPABLE,
        );
        expect(result.ir_ids.length).toBeGreaterThan(0);

        await appendSearchQueryLogIfEnabled({
          queryRaw: probe.query,
          lookupMode: probe.mode,
          result,
          activeBundleMeta: {
            bundle_id: "bundle-ml1d1",
            version: "1.0.0",
            normalization_ruleset: "norm_v3",
          },
          storageScopeId: SCOPE,
          uiLanguage: "fr",
          latencyMs: 1,
          timestampIso: `2026-07-02T00:00:0${i}.000Z`,
        });

        const snapshot: ExecutedSearchSnapshot = {
          generation: i + 1,
          query_raw: probe.query,
          search_direction: toLegacySearchDirection(probe.mode),
          input_lang: probe.mode.from,
          output_lang: probe.mode.to,
          result_state: "results_not_useful",
          result_count: result.ir_ids.length,
          bundle_id: "bundle-ml1d1",
          content_sha256:
            "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          storage_scope_id: SCOPE,
        };
        const ctx = buildSearchFeedbackCaptureContext(snapshot);
        expect(ctx).toBeDefined();
        expect(ctx?.input_lang).toBe(probe.mode.from);
        expect(ctx?.output_lang).toBe(probe.mode.to);
        expect(ctx?.search_direction).toBe(toLegacySearchDirection(probe.mode));
      }

      const rows = await listQueryLogs(db);
      expect(rows).toHaveLength(4);
      for (const [i, probe] of probes.entries()) {
        const row = rows[i];
        expect(isQueryLogEventV3(row)).toBe(true);
        if (isQueryLogEventV3(row)) {
          expect(row.input_lang).toBe(probe.mode.from);
          expect(row.output_lang).toBe(probe.mode.to);
          expect(row.direction).toBe(toLegacySearchDirection(probe.mode));
        }
      }
    } finally {
      db.close();
    }
  });

  it("falls back EN→MNK to FR→MNK on legacy-capability bundle downgrade", () => {
    const requested: LookupMode = { from: "en", to: "mnk" };
    const effective = resolveSupportedLookupMode({}, requested);
    expect(effective).toEqual({ from: "fr", to: "mnk" });
    expect(effective).not.toEqual({ from: "mnk", to: "fr" });
  });
});
