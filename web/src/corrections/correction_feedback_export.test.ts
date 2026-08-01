/**
 * CF1I4 — Correction feedback export pipeline tests.
 */

import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { deleteSiralexDb, openSiralexDb, STORE_CORRECTION_DRAFTS } from "../idb/siralex_db";
import {
  createCorrectionDraft,
  listCorrectionDrafts,
  type CreateCorrectionDraftInput,
} from "./correction_draft_store";
import {
  CORRECTION_DRAFT_SCHEMA_VERSION,
  type CorrectionDraftV1,
} from "./correction_draft_types";
import {
  buildCorrectionFeedbackExportArtifact,
  createCorrectionFeedbackExport,
} from "./correction_feedback_export";
import { downloadCorrectionFeedbackArtifact } from "./correction_feedback_file";
import {
  CORRECTION_FEEDBACK_AUTHORITY_LABEL,
  buildCorrectionFeedbackFilename,
  parseCorrectionFeedbackJson,
} from "./correction_feedback_package";

const HASH =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const EXPORTED_AT = "2026-07-31T22:30:00.000Z";
const TS = "2026-07-31T18:00:00.000Z";

function makeInput(
  overrides: Partial<CreateCorrectionDraftInput> = {},
): CreateCorrectionDraftInput {
  return {
    bundle_id: "bundle_a",
    ir_id: "lex-1",
    ir_kind: "lexicon_entry",
    content_sha256: HASH,
    storage_scope_id: `bundle_a::${HASH}`,
    issue_type: "spelling",
    mode: "problem_report",
    target: { type: "headword" },
    display_snapshot: { headword_latin: "kùn", headword_nko: "ߞߎ߲" },
    problem_description: "Spelling looks off.",
    ...overrides,
  };
}

function makeDraft(overrides: Partial<CorrectionDraftV1> = {}): CorrectionDraftV1 {
  return {
    schema_version: CORRECTION_DRAFT_SCHEMA_VERSION,
    draft_id: "draft-1",
    bundle_id: "bundle_a",
    ir_id: "lex-1",
    ir_kind: "lexicon_entry",
    content_sha256: HASH,
    storage_scope_id: `bundle_a::${HASH}`,
    issue_type: "spelling",
    mode: "problem_report",
    target: { type: "headword" },
    display_snapshot: { headword_latin: "kùn", headword_nko: "ߞߎ߲" },
    problem_description: "Spelling looks off.",
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

describe("buildCorrectionFeedbackExportArtifact", () => {
  it("rejects empty draft lists", () => {
    expect(
      buildCorrectionFeedbackExportArtifact([], { exportedAt: EXPORTED_AT }).ok,
    ).toBe(false);
    expect(
      buildCorrectionFeedbackExportArtifact([], { exportedAt: EXPORTED_AT }),
    ).toMatchObject({ code: "no_correction_drafts" });
  });

  it("exports all valid drafts with deterministic package and filename", () => {
    const drafts = [
      makeDraft({
        draft_id: "z-draft",
        problem_description: "Second\nline with ߞߎ߲ accents",
      }),
      makeDraft({ draft_id: "a-draft", ir_id: "lex-2", issue_type: "nko" }),
    ];
    const result = buildCorrectionFeedbackExportArtifact(drafts, {
      exportedAt: EXPORTED_AT,
      appVersion: "1.2.3",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.artifact.filename).toBe(buildCorrectionFeedbackFilename(EXPORTED_AT));
    expect(result.artifact.draftCount).toBe(2);
    expect(result.artifact.mediaType).toBe("application/json");

    const parsed = parseCorrectionFeedbackJson(result.artifact.text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.package.authority_label).toBe(CORRECTION_FEEDBACK_AUTHORITY_LABEL);
    expect(parsed.package.draft_count).toBe(2);
    expect(parsed.package.exported_at).toBe(EXPORTED_AT);
    expect(parsed.package.app_version).toBe("1.2.3");
    // Deterministic CF1I1 export order (bundle_id, ir_id, created_at, draft_id).
    expect(parsed.package.drafts.map((d) => d.draft_id)).toEqual(["z-draft", "a-draft"]);
    expect(parsed.package.drafts[0]!.problem_description).toContain("ߞߎ߲");
    expect(parsed.package.drafts[0]!.problem_description).toContain("\n");
    expect(JSON.stringify(parsed.package)).not.toMatch(/phase_1\.5|submitted|"status":"exported"/i);
    expect(parsed.package.drafts.every((d) => d.status === "draft")).toBe(true);
    expect(
      Object.keys(parsed.package as object).some((k) => /phase/i.test(k)),
    ).toBe(false);

    const again = buildCorrectionFeedbackExportArtifact(drafts, {
      exportedAt: EXPORTED_AT,
      appVersion: "1.2.3",
    });
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.artifact.text).toBe(result.artifact.text);
  });

  it("blocks invalid local rows and duplicate IDs with no artifact", () => {
    const invalid = buildCorrectionFeedbackExportArtifact(
      [makeDraft({ problem_description: "" })],
      { exportedAt: EXPORTED_AT },
    );
    expect(invalid).toEqual({ ok: false, code: "invalid_local_draft" });

    const duplicate = buildCorrectionFeedbackExportArtifact(
      [makeDraft({ draft_id: "same" }), makeDraft({ draft_id: "same", ir_id: "lex-9" })],
      { exportedAt: EXPORTED_AT },
    );
    expect(duplicate).toEqual({ ok: false, code: "duplicate_draft_id" });
  });

  it("blocks oversized artifacts", () => {
    const result = buildCorrectionFeedbackExportArtifact([makeDraft()], {
      exportedAt: EXPORTED_AT,
      maxBytes: 10,
    });
    expect(result).toEqual({ ok: false, code: "generated_package_too_large" });
  });

  it("rejects when reparse fails", () => {
    const result = buildCorrectionFeedbackExportArtifact([makeDraft()], {
      exportedAt: EXPORTED_AT,
      parse: () => ({ ok: false, errors: [{ code: "invalid_json", path: "$" }] }),
    });
    expect(result).toEqual({ ok: false, code: "generated_package_invalid" });
  });
});

describe("createCorrectionFeedbackExport + download", () => {
  it("exports from IndexedDB without mutating drafts; repeat export allowed", async () => {
    const db = await openSiralexDb();
    const created = await createCorrectionDraft(db, makeInput(), {
      now: () => TS,
      generateDraftId: () => "draft-export-1",
    });
    expect(created.ok).toBe(true);
    const before = await listCorrectionDrafts(db);

    const first = await createCorrectionFeedbackExport(db, { exportedAt: EXPORTED_AT });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const after = await listCorrectionDrafts(db);
    expect(after).toEqual(before);

    const second = await createCorrectionFeedbackExport(db, { exportedAt: EXPORTED_AT });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.artifact.text).toBe(first.artifact.text);
    db.close();
  });

  it("blocks export when a corrupt stored row exists", async () => {
    const db = await openSiralexDb();
    await createCorrectionDraft(db, makeInput(), {
      now: () => TS,
      generateDraftId: () => "ok-draft",
    });
    const tx = db.transaction(STORE_CORRECTION_DRAFTS, "readwrite");
    tx.objectStore(STORE_CORRECTION_DRAFTS).put({
      schema_version: CORRECTION_DRAFT_SCHEMA_VERSION,
      draft_id: "corrupt",
      bad: true,
    });
    await new Promise<void>((resolve, reject) => {
      tx.addEventListener("complete", () => resolve());
      tx.addEventListener("error", () => reject(tx.error));
    });

    const result = await createCorrectionFeedbackExport(db, { exportedAt: EXPORTED_AT });
    expect(result).toEqual({ ok: false, code: "invalid_local_draft" });
    db.close();
  });

  it("downloads via injectable adapter and always revokes the object URL", () => {
    const built = buildCorrectionFeedbackExportArtifact([makeDraft()], {
      exportedAt: EXPORTED_AT,
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;

    const createObjectUrl = vi.fn(() => "blob:test-url");
    const revokeObjectUrl = vi.fn();
    const click = vi.fn();
    const remove = vi.fn();
    const appendChild = vi.fn();
    const doc = {
      createElement: (tag: string) => {
        if (tag !== "a") throw new Error(`unexpected ${tag}`);
        return { href: "", download: "", rel: "", click, remove };
      },
      body: { appendChild },
    } as unknown as Document;

    downloadCorrectionFeedbackArtifact(built.artifact, {
      createObjectUrl,
      revokeObjectUrl,
      documentRef: doc,
    });

    expect(createObjectUrl).toHaveBeenCalledTimes(1);
    expect(appendChild).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:test-url");

    const create2 = vi.fn(() => "blob:fail");
    const revoke2 = vi.fn();
    const docFail = {
      createElement: () => {
        throw new Error("dom fail");
      },
      body: { appendChild: vi.fn() },
    } as unknown as Document;
    expect(() =>
      downloadCorrectionFeedbackArtifact(built.artifact, {
        createObjectUrl: create2,
        revokeObjectUrl: revoke2,
        documentRef: docFail,
      }),
    ).toThrow(/dom fail/);
    expect(revoke2).toHaveBeenCalledWith("blob:fail");
  });
});
