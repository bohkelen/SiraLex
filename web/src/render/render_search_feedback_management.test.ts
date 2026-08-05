// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import { setCurrentLocale, t } from "../i18n";
import type { SearchFeedbackManagementVm } from "../search_feedback/search_feedback_management_session";
import {
  SEARCH_FEEDBACK_DRAFT_SCHEMA_VERSION,
  type SearchFeedbackDraftV1,
} from "../search_feedback/search_feedback_types";
import { renderSearchFeedbackManagement } from "./render_search_feedback_management";

const HASH =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function draft(overrides: Partial<SearchFeedbackDraftV1> = {}): SearchFeedbackDraftV1 {
  return {
    schema_version: SEARCH_FEEDBACK_DRAFT_SCHEMA_VERSION,
    feedback_id: "fb-secret",
    bundle_id: "bundle_a",
    content_sha256: HASH,
    storage_scope_id: `bundle_a::${HASH}`,
    query_raw: "  kùn  ",
    search_direction: "source_to_target",
    result_state: "no_result",
    result_count: 0,
    created_at: "2026-08-02T18:00:00.000Z",
    updated_at: "2026-08-02T19:00:00.000Z",
    status: "draft",
    ...overrides,
  };
}

function baseVm(overrides: Partial<SearchFeedbackManagementVm> = {}): SearchFeedbackManagementVm {
  return {
    generation: 1,
    phase: "list",
    feedbackCount: 1,
    items: [
      {
        feedback_id: "fb-secret",
        query_raw: "  kùn  ",
        result_state: "no_result",
        search_direction: "source_to_target",
        updated_at: "2026-08-02T19:00:00.000Z",
        requested_meaning_preview: "head",
        availability: "dictionary_current",
      },
    ],
    requestedMeaningCount: 0,
    userDescriptionCount: 0,
    busy: false,
    sendForReviewAvailable: false,
    focusTarget: "heading",
    ...overrides,
  };
}

const callbacks = () => ({
  onOpenDetail: vi.fn(),
  onBackToList: vi.fn(),
  onStartEdit: vi.fn(),
  onCancelEdit: vi.fn(),
  onSaveEdit: vi.fn(),
  onRequestedMeaningChange: vi.fn(),
  onUserDescriptionChange: vi.fn(),
  onRequestDelete: vi.fn(),
  onCancelDelete: vi.fn(),
  onConfirmDelete: vi.fn(),
  onExport: vi.fn(),
  onAcknowledgeExport: vi.fn(),
  onRequestSendForReview: vi.fn(),
  onCancelSendForReview: vi.fn(),
  onConfirmSendForReview: vi.fn(),
  onAcknowledgeHandoff: vi.fn(),
  onBack: vi.fn(),
});

describe("renderSearchFeedbackManagement", () => {
  beforeEach(() => {
    setCurrentLocale("en");
    document.body.innerHTML = "";
  });

  it("renders EN/FR headings and entry copy without diagnosis/Submit/internal IDs in rows", () => {
    setCurrentLocale("en");
    const { root } = renderSearchFeedbackManagement(baseVm(), callbacks());
    document.body.appendChild(root);
    expect(root.classList.contains("ux2-search-feedback-manage")).toBe(true);
    expect(root.querySelector("#search-feedback-manage-heading")?.textContent).toBe(
      "Search feedback",
    );
    expect(root.textContent).toContain("No results");
    expect(root.textContent).toContain("Export");
    expect(root.textContent).toContain("Send for review");
    expect(root.textContent).toContain("unreviewed search feedback");
    expect(root.textContent).toContain("These are searches you chose to report");
    expect(root.textContent).toContain("← Back to More");
    expect(root.textContent).not.toMatch(/missing entry|Submit|submitted successfully/i);
    const row = root.querySelector("[data-testid='search-feedback-manage-row']");
    expect(row?.textContent).toContain('"  kùn  "');
    expect(row?.textContent).not.toContain(HASH);
    expect(row?.textContent).not.toContain("fb-secret");
    expect(row?.textContent).not.toContain("bundle_a::");

    setCurrentLocale("fr");
    const fr = renderSearchFeedbackManagement(baseVm(), callbacks()).root;
    expect(fr.querySelector("#search-feedback-manage-heading")?.textContent).toBe(
      "Retours sur la recherche",
    );
    expect(fr.textContent).toContain("Aucun résultat");
    expect(fr.textContent).not.toContain("Search feedback");
  });

  it("shows configured review email in EN/FR handoff confirmation", () => {
    const email = "review@example.org";
    setCurrentLocale("en");
    const en = renderSearchFeedbackManagement(
      baseVm({
        phase: "confirm_handoff",
        sendForReviewAvailable: true,
        reviewEmail: email,
      }),
      callbacks(),
    ).root;
    expect(en.textContent).toContain("Send this feedback to SiraLex review");
    expect(en.textContent).toContain(email);
    expect(en.querySelector(`a.feedback-handoff-email[href="mailto:${email}"]`)?.textContent).toBe(
      email,
    );

    setCurrentLocale("fr");
    const fr = renderSearchFeedbackManagement(
      baseVm({
        phase: "confirm_handoff",
        sendForReviewAvailable: true,
        reviewEmail: email,
      }),
      callbacks(),
    ).root;
    expect(fr.textContent).toContain("Envoyer ce retour pour révision");
    expect(fr.textContent).toContain(email);
    expect(fr.querySelector(`a.feedback-handoff-email[href="mailto:${email}"]`)?.textContent).toBe(
      email,
    );
  });

  it("renders loading, empty, availability, detail, edit, stale, delete, export states", async () => {
    const cb = callbacks();
    const { root, update } = renderSearchFeedbackManagement(
      baseVm({ phase: "loading", feedbackCount: 0, items: [] }),
      cb,
    );
    document.body.appendChild(root);
    expect(root.textContent).toContain(t("searchFeedback.manage.loading"));

    update(baseVm({ phase: "empty", feedbackCount: 0, items: [] }));
    expect(root.textContent).toContain("No search feedback yet");

    update(
      baseVm({
        items: [
          {
            feedback_id: "fb-secret",
            query_raw: "x",
            result_state: "results_not_useful",
            search_direction: "target_to_source",
            updated_at: "2026-08-02T19:00:00.000Z",
            availability: "dictionary_content_differs",
          },
        ],
      }),
    );
    expect(root.textContent).toContain("Results did not meet the user's need");
    expect(root.textContent).toContain("earlier version of the dictionary");

    update(
      baseVm({
        phase: "detail",
        selected: draft({
          result_state: "results_not_useful",
          result_count: 3,
          requested_meaning: "head",
        }),
        availability: "dictionary_unavailable",
      }),
    );
    expect(root.textContent).toContain("Original dictionary is not currently installed");
    expect(root.textContent).toContain("Technical provenance");

    update(
      baseVm({
        phase: "editing",
        selected: draft(),
        editFields: { requested_meaning: "", user_description: "" },
        availability: "dictionary_current",
      }),
    );
    expect(root.textContent).toContain("0 / 2000");
    expect(root.textContent).toContain("Save changes");

    update(
      baseVm({
        phase: "stale_edit",
        selected: draft(),
        errorCode: "stale_edit",
        availability: "dictionary_current",
      }),
    );
    expect(root.textContent).toContain("changed elsewhere");

    update(
      baseVm({
        phase: "confirm_delete",
        selected: draft(),
        availability: "dictionary_current",
        focusTarget: "delete_confirm",
      }),
    );
    expect(root.querySelector("#search-feedback-manage-delete-confirm")).not.toBeNull();

    update(
      baseVm({
        phase: "exporting",
        busy: true,
      }),
    );
    expect(root.getAttribute("aria-busy")).toBe("true");
    expect(root.textContent).toContain("Preparing export");

    update(
      baseVm({
        phase: "exported",
        exportFilename: "siralex-search-feedback-2026-08-02T22-30-00Z.json",
        exportFeedbackCount: 1,
        focusTarget: "status",
      }),
    );
    expect(root.textContent).toContain("Exported 1 search feedback reports");
    await Promise.resolve();
  });

  it("keeps edit textarea nodes stable across typing (CF2I6A)", () => {
    let latest = baseVm({
      phase: "editing",
      selected: draft(),
      editFields: { requested_meaning: "", user_description: "" },
      availability: "dictionary_current",
      focusTarget: "none",
    });
    const view = renderSearchFeedbackManagement(latest, {
      ...callbacks(),
      onRequestedMeaningChange: (value) => {
        latest = {
          ...latest,
          editFields: {
            requested_meaning: value,
            user_description: latest.editFields?.user_description ?? "",
          },
          requestedMeaningCount: [...value].length,
          focusTarget: "none",
        };
        view.update(latest);
      },
      onUserDescriptionChange: (value) => {
        latest = {
          ...latest,
          editFields: {
            requested_meaning: latest.editFields?.requested_meaning ?? "",
            user_description: value,
          },
          userDescriptionCount: [...value].length,
          focusTarget: "none",
        };
        view.update(latest);
      },
    });
    document.body.appendChild(view.root);

    const meaning = view.root.querySelector<HTMLTextAreaElement>(
      "#search-feedback-manage-meaning",
    )!;
    meaning.focus();
    for (const ch of "notes") {
      meaning.value = `${meaning.value}${ch}`;
      meaning.dispatchEvent(new Event("input", { bubbles: true }));
      expect(view.root.querySelector("#search-feedback-manage-meaning")).toBe(meaning);
      expect(document.activeElement).toBe(meaning);
    }
    expect(meaning.value).toBe("notes");

    const details = view.root.querySelector<HTMLTextAreaElement>(
      "#search-feedback-manage-details",
    )!;
    details.focus();
    for (const ch of "ߞߎ") {
      details.value = `${details.value}${ch}`;
      details.dispatchEvent(new Event("input", { bubbles: true }));
      expect(view.root.querySelector("#search-feedback-manage-details")).toBe(details);
      expect(document.activeElement).toBe(details);
    }
    expect(details.value).toBe("ߞߎ");
  });
});
