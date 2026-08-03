/**
 * CF2I4 focused integration: create → manage → edit → export → delete + lifecycle.
 */
import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  STORE_BUNDLES_REGISTRY,
  STORE_CORRECTION_DRAFTS,
  STORE_LEARNING_RECORDS,
  STORE_META,
  STORE_QUERY_LOGS,
  STORE_RECORDS,
  STORE_SEARCH_FAILURE_FEEDBACK,
  STORE_SEARCH_INDEX,
  deleteBundleData,
  deleteSiralexDb,
  openSiralexDb,
  putInstalledBundleMeta,
  setActiveBundleId,
  type ActiveBundleMeta,
} from "../idb/siralex_db";
import { createSearchFeedbackCaptureController } from "./search_feedback_capture_controller";
import {
  buildSearchFeedbackCaptureContext,
  type ExecutedSearchSnapshot,
} from "./search_feedback_capture_model";
import { createSearchFeedbackManagementSession } from "./search_feedback_management_session";
import {
  countSearchFeedbackDrafts,
  getSearchFeedbackDraft,
  listSearchFeedbackDrafts,
} from "./search_feedback_store";
import {
  SEARCH_FEEDBACK_AUTHORITY_LABEL,
  parseSearchFeedbackJson,
} from "./search_feedback_package";

const HASH =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const HASH_B =
  "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const SCOPE = `bundle_a::${HASH}`;

function meta(overrides: Partial<ActiveBundleMeta> = {}): ActiveBundleMeta {
  return {
    bundle_id: "bundle_a",
    storage_scope_id: SCOPE,
    manifest_schema_version: "1",
    record_schema_id: "enriched_record_v1",
    record_schema_version: "1",
    normalization_ruleset: "norm_v3",
    update_mode: "replace",
    reconciliation_action: "none",
    expected_content_sha256: HASH,
    imported_at_iso: "2026-08-02T18:00:00.000Z",
    ...overrides,
  };
}

function snap(overrides: Partial<ExecutedSearchSnapshot> = {}): ExecutedSearchSnapshot {
  return {
    generation: 1,
    query_raw: "  missing  ",
    search_direction: "source_to_target",
    result_state: "no_result",
    result_count: 0,
    bundle_id: "bundle_a",
    content_sha256: HASH,
    storage_scope_id: SCOPE,
    ...overrides,
  };
}

async function countStore(db: IDBDatabase, name: string): Promise<number> {
  if (!db.objectStoreNames.contains(name)) return 0;
  const tx = db.transaction(name, "readonly");
  const count = await new Promise<number>((resolve, reject) => {
    const req = tx.objectStore(name).count();
    req.addEventListener("success", () => resolve(req.result));
    req.addEventListener("error", () => reject(req.error));
  });
  await new Promise<void>((resolve, reject) => {
    tx.addEventListener("complete", () => resolve());
    tx.addEventListener("error", () => reject(tx.error));
  });
  return count;
}

async function snapshot(db: IDBDatabase): Promise<Record<string, number>> {
  const names = [
    STORE_META,
    STORE_RECORDS,
    STORE_SEARCH_INDEX,
    STORE_BUNDLES_REGISTRY,
    STORE_QUERY_LOGS,
    STORE_LEARNING_RECORDS,
    STORE_CORRECTION_DRAFTS,
    STORE_SEARCH_FAILURE_FEEDBACK,
  ];
  const out: Record<string, number> = {};
  for (const name of names) {
    out[name] = await countStore(db, name);
  }
  return out;
}

beforeEach(async () => {
  try {
    await deleteSiralexDb();
  } catch {
    // ok
  }
});

describe("CF2I4 management integration", () => {
  it("create → manage → edit → export → delete with isolation and bundle lifecycle", async () => {
    const active = meta();
    const db = await openSiralexDb();
    await putInstalledBundleMeta(db, active);
    await setActiveBundleId(db, active.bundle_id);
    let nowMs = Date.now();
    const now = () => {
      nowMs += 1000;
      return new Date(nowMs).toISOString();
    };

    const executed = snap();
    const capture = createSearchFeedbackCaptureController({
      context: buildSearchFeedbackCaptureContext(executed)!,
      openDb: async () => db,
      dbOwnership: "caller_owned",
      getActiveMeta: () => active,
      getCurrentExecutedSearch: () => executed,
      isCurrent: () => true,
      onModel: () => undefined,
      onCancel: () => undefined,
      onBackToSearch: () => undefined,
      createDraft: async (database, createInput) => {
        const { createSearchFeedbackDraft } = await import("./search_feedback_store");
        return createSearchFeedbackDraft(database, createInput, { now });
      },
    });
    await capture.save();
    expect(await countSearchFeedbackDrafts(db)).toBe(1);

    const downloaded: string[] = [];
    let installed: ActiveBundleMeta | undefined = active;
    const manage = createSearchFeedbackManagementSession({
      openDb: async () => db,
      dbOwnership: "caller_owned",
      now,
      appVersion: "test",
      isCurrent: () => true,
      onModel: () => undefined,
      downloadArtifact: (artifact) => {
        downloaded.push(artifact.text);
      },
      getInstalledMeta: async (_db, bundleId) =>
        installed?.bundle_id === bundleId ? installed : undefined,
    });
    await manage.load();
    expect(manage.getVm().phase).toBe("list");
    expect(manage.getVm().items).toHaveLength(1);

    const feedbackId = manage.getVm().items[0]!.feedback_id;
    await manage.openDetail(feedbackId);
    manage.startEdit();
    manage.setEditRequestedMeaning("head");
    manage.setEditUserDescription("note");
    const beforeEdit = await snapshot(db);
    await manage.saveEdit();
    const stored = await getSearchFeedbackDraft(db, feedbackId);
    expect(stored?.requested_meaning).toBe("head");
    expect(stored?.query_raw).toBe("  missing  ");
    expect(stored?.result_state).toBe("no_result");
    const afterEdit = await snapshot(db);
    for (const key of Object.keys(beforeEdit)) {
      if (key === STORE_SEARCH_FAILURE_FEEDBACK) {
        expect(afterEdit[key]).toBe(beforeEdit[key]);
      } else {
        expect(afterEdit[key]).toBe(beforeEdit[key]);
      }
    }

    const beforeExport = await snapshot(db);
    await manage.exportAll();
    expect(downloaded).toHaveLength(1);
    const parsed = parseSearchFeedbackJson(downloaded[0]!);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.package.authority_label).toBe(SEARCH_FEEDBACK_AUTHORITY_LABEL);
      expect(parsed.package.feedbacks[0]!.content_sha256).toBe(HASH);
    }
    expect(await snapshot(db)).toEqual(beforeExport);

    // Bundle remove → unavailable, still editable/exportable
    await deleteBundleData(db, active.bundle_id);
    installed = undefined;
    await manage.load();
    expect(manage.getVm().items[0]!.availability).toBe("dictionary_unavailable");
    await manage.openDetail(feedbackId);
    manage.startEdit();
    manage.setEditRequestedMeaning("still editable");
    await manage.saveEdit();
    expect(manage.getVm().selected?.requested_meaning).toBe("still editable");

    // Reinstall as H2 content → content differs; export still H1 hash
    installed = meta({
      expected_content_sha256: HASH_B,
      storage_scope_id: `bundle_a::${HASH_B}`,
    });
    await putInstalledBundleMeta(db, installed);
    await manage.load();
    expect(manage.getVm().items[0]!.availability).toBe("dictionary_content_differs");
    downloaded.length = 0;
    await manage.exportAll();
    const parsed2 = parseSearchFeedbackJson(downloaded[0]!);
    expect(parsed2.ok).toBe(true);
    if (parsed2.ok) {
      expect(parsed2.package.feedbacks[0]!.content_sha256).toBe(HASH);
    }

    await manage.openDetail(feedbackId);
    manage.requestDelete();
    await manage.confirmDelete();
    expect(manage.getVm().phase).toBe("empty");
    expect(await listSearchFeedbackDrafts(db)).toHaveLength(0);
    db.close();
  });
});
