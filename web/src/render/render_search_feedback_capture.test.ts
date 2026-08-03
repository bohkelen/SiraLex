// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import { setCurrentLocale, t } from "../i18n";
import {
  buildSearchFeedbackCaptureContext,
  buildSearchFeedbackCaptureViewModel,
  createInitialSearchFeedbackCaptureFields,
  type SearchFeedbackCaptureViewModel,
} from "../search_feedback/search_feedback_capture_model";
import {
  renderNoResultSearchFeedbackEntry,
  renderResultsNotUsefulSearchFeedbackEntry,
  renderSearchFeedbackCapture,
} from "./render_search_feedback_capture";

const HASH =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function baseVm(
  overrides: Partial<SearchFeedbackCaptureViewModel> = {},
): SearchFeedbackCaptureViewModel {
  const context = buildSearchFeedbackCaptureContext({
    generation: 1,
    query_raw: "  kùn  ",
    search_direction: "source_to_target",
    result_state: "no_result",
    result_count: 0,
    bundle_id: "bundle_a",
    content_sha256: HASH,
    storage_scope_id: `bundle_a::${HASH}`,
  })!;
  const fields = createInitialSearchFeedbackCaptureFields();
  return {
    ...buildSearchFeedbackCaptureViewModel({
      state: "ready",
      context,
      fields,
    }),
    ...overrides,
  };
}

const callbacks = () => ({
  onRequestedMeaningChange: vi.fn(),
  onUserDescriptionChange: vi.fn(),
  onSave: vi.fn(),
  onCancel: vi.fn(),
  onBackToSearch: vi.fn(),
});

describe("render search feedback capture", () => {
  beforeEach(() => {
    setCurrentLocale("en");
    document.body.innerHTML = "";
  });

  it("renders EN/FR zero-result and results-not-useful entry copy", () => {
    setCurrentLocale("en");
    const enZero = renderNoResultSearchFeedbackEntry("xyzzy", () => undefined);
    expect(enZero.textContent).toContain('No results for “xyzzy”');
    expect(enZero.textContent).toContain("Report this search");
    expect(enZero.textContent).not.toMatch(/missing word/i);

    const enUseful = renderResultsNotUsefulSearchFeedbackEntry(() => undefined);
    expect(enUseful.textContent).toContain("Didn't find what you needed?");
    expect(enUseful.textContent).toContain("Report this search");

    setCurrentLocale("fr");
    const frZero = renderNoResultSearchFeedbackEntry("xyzzy", () => undefined);
    expect(frZero.textContent).toContain("Aucun résultat pour « xyzzy »");
    expect(frZero.textContent).toContain("Signaler cette recherche");
    expect(frZero.textContent).not.toMatch(/Report this search/);

    const frUseful = renderResultsNotUsefulSearchFeedbackEntry(() => undefined);
    expect(frUseful.textContent).toContain(
      "Vous n’avez pas trouvé ce que vous cherchiez ?",
    );
    expect(frUseful.textContent).toContain("Signaler cette recherche");
  });

  it("renders form heading, exact query, optional fields, counters, privacy; no Submit/Send/diagnosis/internal IDs", () => {
    const cb = callbacks();
    const { root } = renderSearchFeedbackCapture(baseVm(), cb);
    document.body.appendChild(root);

    expect(root.querySelector("#search-feedback-capture-heading")?.textContent).toBe(
      t("searchFeedback.capture.heading"),
    );
    expect(root.querySelector("#search-feedback-capture-query")?.textContent).toBe(
      '"  kùn  "',
    );
    expect(root.textContent).toContain("What were you trying to find?");
    expect(root.textContent).toContain("Additional details");
    expect(root.textContent).toContain("0 / 2000");
    expect(root.textContent).toContain(
      "This saves a local report about this search",
    );
    expect(root.textContent).toContain("Nothing is sent online");
    expect(root.textContent).toContain("Save search feedback");
    expect(root.textContent).toContain("Cancel");
    expect(root.textContent).not.toMatch(/\bSubmit\b/);
    expect(root.textContent).not.toMatch(/\bSend\b/);
    expect(root.textContent).not.toMatch(/missing word/i);
    expect(root.textContent).not.toContain(HASH);
    expect(root.textContent).not.toContain("bundle_a::");
    expect(root.textContent).not.toContain("feedback_");
    expect(root.textContent).toContain("No results");
  });

  it("renders invalid, busy, stale, and success states with focus and Cancel usable when stale", async () => {
    const cb = callbacks();
    const { root, update } = renderSearchFeedbackCapture(
      baseVm({
        state: "invalid",
        errorCode: "invalid_fields",
        errors: { requested_meaning: "too_long" },
      }),
      cb,
    );
    document.body.appendChild(root);
    expect(root.querySelector("#search-feedback-capture-error-summary")).not.toBeNull();
    await Promise.resolve();
    expect(document.activeElement?.id).toBe("search-feedback-capture-error-summary");

    update(
      baseVm({
        state: "saving",
      }),
    );
    expect(root.getAttribute("aria-busy")).toBe("true");
    const save = root.querySelector<HTMLButtonElement>(
      "[data-testid='search-feedback-save']",
    );
    expect(save?.disabled).toBe(true);
    expect(save?.textContent).toBe("Saving…");

    update(baseVm({ state: "stale_context", errorCode: "search_context_changed" }));
    expect(root.textContent).toContain("This search has changed");
    const cancel = root.querySelector<HTMLButtonElement>(
      "[data-testid='search-feedback-cancel']",
    );
    expect(cancel?.disabled).toBe(false);
    cancel?.click();
    expect(cb.onCancel).toHaveBeenCalled();

    update(baseVm({ state: "saved", feedback_id: "fb_secret" }));
    expect(root.textContent).toContain("Search feedback saved on this device");
    expect(root.textContent).not.toContain("fb_secret");
    await Promise.resolve();
    expect(document.activeElement?.id).toBe("search-feedback-capture-heading");
  });

  it("supports keyboard activation of Report and Save", () => {
    const onReport = vi.fn();
    const entry = renderNoResultSearchFeedbackEntry("q", onReport);
    document.body.appendChild(entry);
    const report = entry.querySelector<HTMLButtonElement>(
      "[data-testid='search-feedback-report']",
    )!;
    report.focus();
    report.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    report.click();
    expect(onReport).toHaveBeenCalled();

    const cb = callbacks();
    const { root } = renderSearchFeedbackCapture(baseVm(), cb);
    document.body.appendChild(root);
    const save = root.querySelector<HTMLButtonElement>(
      "[data-testid='search-feedback-save']",
    )!;
    save.focus();
    save.click();
    expect(cb.onSave).toHaveBeenCalled();
  });
});
