// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import { setCurrentLocale, t } from "../i18n";
import {
  CORRECTION_DRAFT_SCHEMA_VERSION,
  type CorrectionDraftV1,
} from "../corrections/correction_draft_types";
import {
  createInitialCorrectionFormFields,
} from "../corrections/correction_form_model";
import type { CorrectionManagementVm } from "../corrections/correction_management_session";
import { renderCorrectionManagement } from "./render_correction_management";

const HASH =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function draft(overrides: Partial<CorrectionDraftV1> = {}): CorrectionDraftV1 {
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
    problem_description: "Looks wrong",
    created_at: "2026-07-31T18:00:00.000Z",
    updated_at: "2026-07-31T18:00:00.000Z",
    status: "draft",
    ...overrides,
  };
}

function baseVm(overrides: Partial<CorrectionManagementVm> = {}): CorrectionManagementVm {
  return {
    generation: 1,
    phase: "list",
    draftCount: 1,
    items: [
      {
        draft_id: "draft-1",
        headword: "kùn",
        issue_type: "spelling",
        mode: "problem_report",
        target: { type: "headword" },
        updated_at: "2026-07-31T18:00:00.000Z",
        availability: "matching_live_content",
      },
    ],
    editRetargetAllowed: false,
    busy: false,
    focusTarget: "heading",
    ...overrides,
  };
}

function callbacks() {
  return {
    onOpenDetail: vi.fn(),
    onBackToList: vi.fn(),
    onStartEdit: vi.fn(),
    onCancelEdit: vi.fn(),
    onSaveEdit: vi.fn(),
    onIssueTypeChange: vi.fn(),
    onModeChange: vi.fn(),
    onTargetChange: vi.fn(),
    onProblemDescriptionChange: vi.fn(),
    onProposedValueChange: vi.fn(),
    onOtherFieldLabelChange: vi.fn(),
    onRequestDelete: vi.fn(),
    onCancelDelete: vi.fn(),
    onConfirmDelete: vi.fn(),
    onExport: vi.fn(),
    onAcknowledgeExport: vi.fn(),
    onBack: vi.fn(),
  };
}

describe("renderCorrectionManagement", () => {
  beforeEach(() => {
    setCurrentLocale("en");
    document.body.innerHTML = "";
  });

  it("renders EN/FR headings and loading/empty/populated/error states", () => {
    const cbs = callbacks();
    const { root, update } = renderCorrectionManagement(baseVm({ phase: "loading", draftCount: 0, items: [] }), cbs);
    document.body.appendChild(root);
    expect(root.querySelector("#correction-manage-heading")?.textContent).toBe(
      t("correctionFeedback.manage.heading"),
    );
    expect(root.querySelector("#correction-manage-status")?.textContent).toBe(
      t("correctionFeedback.manage.loading"),
    );

    update(baseVm({ phase: "empty", draftCount: 0, items: [] }));
    expect(root.querySelector("#correction-manage-status")?.textContent).toBe(
      t("correctionFeedback.manage.empty"),
    );
    expect(
      (root.querySelector("#correction-manage-export") as HTMLButtonElement).disabled,
    ).toBe(true);

    update(baseVm());
    expect(root.querySelectorAll("[role='listitem']")).toHaveLength(1);
    expect(root.textContent).not.toContain(HASH);
    expect(root.textContent).not.toContain(`bundle_a::${HASH}`);
    expect(root.textContent).not.toMatch(/Submit/i);

    update(baseVm({ phase: "error", errorCode: "invalid_stored_draft", items: [] }));
    expect(root.querySelector("#correction-manage-status")?.textContent).toBe(
      t("correctionFeedback.manage.error.invalidStored"),
    );

    setCurrentLocale("fr");
    update(baseVm({ phase: "list" }));
    expect(root.querySelector("#correction-manage-heading")?.textContent).toBe(
      "Corrections en attente",
    );
  });

  it("renders detail, live comparison, editing, stale error, delete confirm, export warning, busy", () => {
    const cbs = callbacks();
    const { root, update } = renderCorrectionManagement(
      baseVm({
        phase: "detail",
        selected: draft(),
        availability: "dictionary_content_differs",
      }),
      cbs,
    );
    document.body.appendChild(root);
    expect(root.textContent).toContain("kùn");
    expect(root.textContent).toContain(
      t("correctionFeedback.manage.availability.contentDiffers"),
    );
    expect(root.querySelector(".correction-manage-provenance")).toBeTruthy();

    const fields = createInitialCorrectionFormFields();
    fields.issue_type = "spelling";
    fields.problem_description = "edit me";
    update(
      baseVm({
        phase: "editing",
        selected: draft(),
        editFields: fields,
        editRetargetAllowed: false,
        errorCode: "stale_draft",
        focusTarget: "error_summary",
      }),
    );
    expect(root.querySelector("#correction-manage-error-summary")?.textContent).toBe(
      t("correctionFeedback.manage.error.staleEdit"),
    );
    expect(root.querySelector("#correction-manage-issue")).toBeTruthy();
    expect(root.querySelector("#correction-manage-description")).toBeTruthy();

    update(
      baseVm({
        phase: "confirm_delete",
        selected: draft(),
        availability: "matching_live_content",
        focusTarget: "delete_confirm",
      }),
    );
    root.querySelector("#correction-manage-delete-confirm button")?.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    expect(cbs.onConfirmDelete).toHaveBeenCalled();

    update(
      baseVm({
        phase: "exporting",
        busy: true,
        draftCount: 1,
      }),
    );
    expect(root.getAttribute("aria-busy")).toBe("true");
    expect(root.querySelector(".correction-manage-export-warning")?.textContent).toBe(
      t("correctionFeedback.manage.export.authority"),
    );
    expect(
      (root.querySelector("#correction-manage-export") as HTMLButtonElement).disabled,
    ).toBe(true);

    update(
      baseVm({
        phase: "exported",
        exportFilename: "file.json",
        exportDraftCount: 2,
        draftCount: 2,
      }),
    );
    expect(root.querySelector("#correction-manage-status")?.textContent).toContain("file.json");
    expect(root.textContent).not.toMatch(/\bSubmit\b|\bUpload\b|\buploaded\b/i);
    expect(root.textContent).toContain(
      "This file contains unreviewed user suggestions. It must not be applied automatically.",
    );
  });

  it("wires keyboard-accessible row open and supports focus targets", async () => {
    const cbs = callbacks();
    const { root, update } = renderCorrectionManagement(baseVm({ focusTarget: "heading" }), cbs);
    document.body.appendChild(root);
    await Promise.resolve();
    expect(document.activeElement?.id).toBe("correction-manage-heading");

    const button = root.querySelector(".correction-manage-row-button") as HTMLButtonElement;
    expect(button).toBeTruthy();
    button.click();
    expect(cbs.onOpenDetail).toHaveBeenCalledWith("draft-1");

    update(baseVm({ phase: "list", focusTarget: "list" }));
    await Promise.resolve();
    expect(document.activeElement?.id).toBe("correction-manage-list");
  });
});
