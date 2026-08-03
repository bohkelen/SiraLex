/**
 * FH1 — Session-level handoff: governed packages pass through unchanged;
 * draft rows remain draft; unavailable email keeps Export working.
 */

import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { deleteSiralexDb, openSiralexDb } from "../idb/siralex_db";
import {
  createCorrectionDraft,
  listCorrectionDrafts,
  type CreateCorrectionDraftInput,
} from "../corrections/correction_draft_store";
import { createCorrectionManagementSession } from "../corrections/correction_management_session";
import {
  createSearchFeedbackDraft,
  listSearchFeedbackDrafts,
  type CreateSearchFeedbackDraftInput,
} from "../search_feedback/search_feedback_store";
import { createSearchFeedbackManagementSession } from "../search_feedback/search_feedback_management_session";
import { toFeedbackHandoffArtifact } from "./feedback_handoff";

const HASH =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const TS = "2026-08-03T18:00:00.000Z";

function correctionInput(): CreateCorrectionDraftInput {
  return {
    bundle_id: "bundle_a",
    ir_id: "lex-1",
    ir_kind: "lexicon_entry",
    content_sha256: HASH,
    storage_scope_id: `bundle_a::${HASH}`,
    issue_type: "spelling",
    mode: "problem_report",
    target: { type: "headword" },
    display_snapshot: { headword_latin: "kùn" },
    problem_description: "Looks wrong",
  };
}

function searchInput(): CreateSearchFeedbackDraftInput {
  return {
    bundle_id: "bundle_a",
    content_sha256: HASH,
    storage_scope_id: `bundle_a::${HASH}`,
    query_raw: "zzzz_fh1",
    search_direction: "source_to_target",
    result_state: "no_result",
    result_count: 0,
  };
}

describe("FH1 session handoff", () => {
  beforeEach(async () => {
    await deleteSiralexDb();
  });

  it("passes CF1 governed package text unchanged to handoff and keeps drafts as draft", async () => {
    const db = await openSiralexDb();
    const created = await createCorrectionDraft(db, correctionInput(), {
      now: () => TS,
      generateDraftId: () => "draft-fh1",
    });
    expect(created.ok).toBe(true);
    db.close();

    let seenText: string | undefined;
    const session = createCorrectionManagementSession({
      openDb: openSiralexDb,
      dbOwnership: "controller_owned",
      now: () => "2026-08-03T19:00:00.000Z",
      appVersion: "0.0.0-test",
      sendForReviewAvailable: true,
      performHandoff: async (artifact) => {
        const bridged = toFeedbackHandoffArtifact(artifact, "correction_feedback");
        seenText = bridged?.text;
        expect(bridged?.text).toContain("siralex_correction_feedback_v1");
        expect(bridged?.text).toBe(artifact.text);
        return { ok: true, method: "share" };
      },
      isCurrent: () => true,
      onModel: () => undefined,
    });

    await session.load();
    session.requestSendForReview();
    expect(session.getVm().phase).toBe("confirm_handoff");
    await session.confirmSendForReview();
    expect(session.getVm().phase).toBe("handoff_prepared");
    expect(session.getVm().handoffMethod).toBe("share");
    expect(seenText).toBeTruthy();

    const verifyDb = await openSiralexDb();
    const after = await listCorrectionDrafts(verifyDb);
    verifyDb.close();
    expect(after).toHaveLength(1);
    expect(after[0]?.status).toBe("draft");
    session.dispose();
  });

  it("passes CF2 governed package text unchanged to handoff and keeps drafts as draft", async () => {
    const db = await openSiralexDb();
    const created = await createSearchFeedbackDraft(db, searchInput(), {
      now: () => TS,
      generateFeedbackId: () => "fb-fh1",
    });
    expect(created.ok).toBe(true);
    db.close();

    let seenText: string | undefined;
    const session = createSearchFeedbackManagementSession({
      openDb: openSiralexDb,
      dbOwnership: "controller_owned",
      now: () => "2026-08-03T19:00:00.000Z",
      appVersion: "0.0.0-test",
      sendForReviewAvailable: true,
      performHandoff: async (artifact) => {
        const bridged = toFeedbackHandoffArtifact(artifact, "search_feedback");
        seenText = bridged?.text;
        expect(bridged?.text).toContain("siralex_search_feedback_v1");
        expect(bridged?.text).toBe(artifact.text);
        return { ok: true, method: "download_mailto" };
      },
      isCurrent: () => true,
      onModel: () => undefined,
    });

    await session.load();
    session.requestSendForReview();
    await session.confirmSendForReview();
    expect(session.getVm().phase).toBe("handoff_prepared");
    expect(session.getVm().handoffMethod).toBe("download_mailto");
    expect(seenText).toBeTruthy();

    const verifyDb = await openSiralexDb();
    const after = await listSearchFeedbackDrafts(verifyDb);
    verifyDb.close();
    expect(after).toHaveLength(1);
    expect(after[0]?.status).toBe("draft");
    session.dispose();
  });

  it("keeps Send unavailable without email while Export path remains injectable", async () => {
    const db = await openSiralexDb();
    const created = await createCorrectionDraft(db, correctionInput(), {
      now: () => TS,
      generateDraftId: () => "draft-fh1-export",
    });
    expect(created.ok).toBe(true);
    db.close();

    const download = vi.fn();
    const session = createCorrectionManagementSession({
      openDb: openSiralexDb,
      dbOwnership: "controller_owned",
      now: () => "2026-08-03T19:00:00.000Z",
      sendForReviewAvailable: false,
      downloadArtifact: download,
      isCurrent: () => true,
      onModel: () => undefined,
    });

    await session.load();
    expect(session.getVm().sendForReviewAvailable).toBe(false);
    session.requestSendForReview();
    expect(session.getVm().phase).toBe("list");
    expect(session.getVm().errorCode).toBe("send_unavailable");

    await session.exportAll();
    expect(download).toHaveBeenCalledTimes(1);
    expect(session.getVm().phase).toBe("exported");
    session.dispose();
  });
});
