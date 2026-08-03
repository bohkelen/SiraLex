/**
 * CF2I4 — Search feedback export pipeline tests.
 */

import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  STORE_SEARCH_FAILURE_FEEDBACK,
  deleteSiralexDb,
  openSiralexDb,
} from "../idb/siralex_db";
import {
  SEARCH_FEEDBACK_AUTHORITY_LABEL,
  SEARCH_FEEDBACK_PACKAGE_SCHEMA,
  buildSearchFeedbackFilename,
  parseSearchFeedbackJson,
} from "./search_feedback_package";
import {
  buildSearchFeedbackExportArtifact,
  createSearchFeedbackExport,
  downloadSearchFeedbackArtifact,
} from "./search_feedback_export";
import {
  createSearchFeedbackDraft,
  listSearchFeedbackDrafts,
  type CreateSearchFeedbackDraftInput,
} from "./search_feedback_store";
import {
  SEARCH_FEEDBACK_DRAFT_SCHEMA_VERSION,
  type SearchFeedbackDraftV1,
} from "./search_feedback_types";

const HASH =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const EXPORTED_AT = "2026-08-02T22:30:00.000Z";
const TS = "2026-08-02T18:00:00.000Z";

function makeInput(
  overrides: Partial<CreateSearchFeedbackDraftInput> = {},
): CreateSearchFeedbackDraftInput {
  return {
    bundle_id: "bundle_a",
    content_sha256: HASH,
    storage_scope_id: `bundle_a::${HASH}`,
    query_raw: "kùn",
    search_direction: "target_to_source",
    result_state: "no_result",
    result_count: 0,
    ...overrides,
  };
}

function makeDraft(overrides: Partial<SearchFeedbackDraftV1> = {}): SearchFeedbackDraftV1 {
  return {
    schema_version: SEARCH_FEEDBACK_DRAFT_SCHEMA_VERSION,
    feedback_id: "fb-1",
    bundle_id: "bundle_a",
    content_sha256: HASH,
    storage_scope_id: `bundle_a::${HASH}`,
    query_raw: "kùn",
    search_direction: "target_to_source",
    result_state: "no_result",
    result_count: 0,
    created_at: TS,
    updated_at: TS,
    status: "draft",
    ...overrides,
  };
}

beforeEach(async () => {
  try {
    await deleteSiralexDb();
  } catch {
    // ok
  }
});

describe("buildSearchFeedbackExportArtifact", () => {
  it("rejects empty feedback lists (empty export disabled)", () => {
    const result = buildSearchFeedbackExportArtifact([], { exportedAt: EXPORTED_AT });
    expect(result).toEqual({ ok: false, code: "no_search_feedback" });
  });

  it("exports with deterministic order, schema, authority, and filename", () => {
    const feedbacks = [
      makeDraft({
        feedback_id: "z-fb",
        query_raw: "  kùn  ",
        user_description: "Second\nline with ߞߎ߲",
        result_state: "results_not_useful",
        result_count: 2,
        matched_ir_ids: ["lex-1", "lex-2"],
      }),
      makeDraft({
        feedback_id: "a-fb",
        bundle_id: "bundle_b",
        storage_scope_id: `bundle_b::${HASH}`,
        query_raw: "tête",
      }),
    ];
    const result = buildSearchFeedbackExportArtifact(feedbacks, {
      exportedAt: EXPORTED_AT,
      appVersion: "1.2.3",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.artifact.filename).toBe(buildSearchFeedbackFilename(EXPORTED_AT));
    expect(result.artifact.feedbackCount).toBe(2);

    const parsed = parseSearchFeedbackJson(result.artifact.text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.package.package_schema).toBe(SEARCH_FEEDBACK_PACKAGE_SCHEMA);
    expect(parsed.package.authority_label).toBe(SEARCH_FEEDBACK_AUTHORITY_LABEL);
    expect(parsed.package.feedback_count).toBe(2);
    expect(parsed.package.app_version).toBe("1.2.3");
    // Export order: bundle_id → created_at → feedback_id
    expect(parsed.package.feedbacks.map((f) => f.feedback_id)).toEqual([
      "z-fb",
      "a-fb",
    ]);
    expect(parsed.package.feedbacks[0]!.query_raw).toBe("  kùn  ");
    expect(parsed.package.feedbacks[0]!.user_description).toContain("ߞߎ߲");
    expect(parsed.package.feedbacks[0]!.matched_ir_ids).toEqual(["lex-1", "lex-2"]);
    expect(parsed.package.feedbacks[0]!.content_sha256).toBe(HASH);
    expect(JSON.stringify(parsed.package)).not.toMatch(/correction_draft|phase.?1\.5|query_log|device_id|account/i);
  });

  it("blocks duplicate IDs, corrupt nested records, and oversize packages", () => {
    expect(
      buildSearchFeedbackExportArtifact(
        [makeDraft({ feedback_id: "same" }), makeDraft({ feedback_id: "same" })],
        { exportedAt: EXPORTED_AT },
      ),
    ).toMatchObject({ ok: false, code: "duplicate_feedback_id" });

    expect(
      buildSearchFeedbackExportArtifact(
        [makeDraft({ query_raw: "" })],
        { exportedAt: EXPORTED_AT },
      ),
    ).toMatchObject({ ok: false, code: "invalid_local_feedback" });

    const huge = makeDraft({
      user_description: "x".repeat(2000),
      requested_meaning: "y".repeat(2000),
    });
    const many = Array.from({ length: 40 }, (_, i) =>
      makeDraft({
        feedback_id: `fb-${i}`,
        user_description: huge.user_description,
        requested_meaning: huge.requested_meaning,
      }),
    );
    expect(
      buildSearchFeedbackExportArtifact(many, {
        exportedAt: EXPORTED_AT,
        maxBytes: 500,
      }),
    ).toMatchObject({ ok: false, code: "generated_package_too_large" });
  });

  it("reparses successfully before download artifact is returned", () => {
    const result = buildSearchFeedbackExportArtifact([makeDraft()], {
      exportedAt: EXPORTED_AT,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const reparsed = parseSearchFeedbackJson(result.artifact.text, {
      byteLength: result.artifact.byteLength,
    });
    expect(reparsed.ok).toBe(true);
  });
});

describe("createSearchFeedbackExport + download", () => {
  it("exports one/multiple from IndexedDB and leaves drafts unchanged; repeat allowed", async () => {
    const db = await openSiralexDb();
    await createSearchFeedbackDraft(db, makeInput({ query_raw: "one" }), {
      now: () => "2026-08-02T18:00:00.000Z",
      generateFeedbackId: () => "fb-one",
    });
    await createSearchFeedbackDraft(db, makeInput({ query_raw: "two" }), {
      now: () => "2026-08-02T19:00:00.000Z",
      generateFeedbackId: () => "fb-two",
    });
    const before = await listSearchFeedbackDrafts(db);

    const first = await createSearchFeedbackExport(db, {
      exportedAt: EXPORTED_AT,
      appVersion: "test",
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.artifact.feedbackCount).toBe(2);

    const after = await listSearchFeedbackDrafts(db);
    expect(after).toEqual(before);

    const second = await createSearchFeedbackExport(db, {
      exportedAt: "2026-08-02T23:00:00.000Z",
    });
    expect(second.ok).toBe(true);

    const clicks: string[] = [];
    const revoke = vi.fn();
    downloadSearchFeedbackArtifact(first.artifact, {
      createObjectURL: () => "blob:test",
      clickDownload: (url, filename) => {
        clicks.push(`${url}|${filename}`);
      },
      revokeObjectURL: revoke,
    });
    expect(clicks).toHaveLength(1);
    expect(revoke).toHaveBeenCalledWith("blob:test");
    db.close();
  });

  it("blocks export when a stored row is corrupt", async () => {
    const db = await openSiralexDb();
    const tx = db.transaction(STORE_SEARCH_FAILURE_FEEDBACK, "readwrite");
    tx.objectStore(STORE_SEARCH_FAILURE_FEEDBACK).put({
      feedback_id: "bad",
      broken: true,
    });
    await new Promise<void>((resolve, reject) => {
      tx.addEventListener("complete", () => resolve());
      tx.addEventListener("error", () => reject(tx.error));
    });
    const result = await createSearchFeedbackExport(db, { exportedAt: EXPORTED_AT });
    expect(result).toMatchObject({ ok: false, code: "invalid_local_feedback" });
    db.close();
  });
});
