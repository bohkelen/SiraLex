/**
 * CF2I3 — Search failure capture renderer (DOM only).
 *
 * No IndexedDB, search execution, provenance construction, or query logging.
 */

import { t, type TranslationKey } from "../i18n";
import {
  SEARCH_FEEDBACK_REQUESTED_MEANING_MAX_CHARS,
  SEARCH_FEEDBACK_USER_DESCRIPTION_MAX_CHARS,
  type SearchFeedbackCaptureErrorCode,
  type SearchFeedbackCaptureFieldErrors,
  type SearchFeedbackCaptureViewModel,
} from "../search_feedback/search_feedback_capture_model";

export type SearchFeedbackCaptureRendererCallbacks = {
  onRequestedMeaningChange: (value: string) => void;
  onUserDescriptionChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onBackToSearch: () => void;
};

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const FIELD_ERROR_KEYS: Record<
  keyof SearchFeedbackCaptureFieldErrors,
  Record<string, TranslationKey>
> = {
  requested_meaning: {
    too_long: "searchFeedback.capture.error.meaningTooLong",
    invalid_chars: "searchFeedback.capture.error.meaningInvalid",
  },
  user_description: {
    too_long: "searchFeedback.capture.error.detailsTooLong",
    invalid_chars: "searchFeedback.capture.error.detailsInvalid",
  },
};

const STORE_ERROR_KEYS: Record<SearchFeedbackCaptureErrorCode, TranslationKey> = {
  search_context_changed: "searchFeedback.capture.error.staleContext",
  invalid_fields: "searchFeedback.capture.error.reviewFields",
  invalid_timestamp: "searchFeedback.capture.error.invalidTimestamp",
  id_generation_failed: "searchFeedback.capture.error.idGenerationFailed",
  feedback_id_conflict: "searchFeedback.capture.error.feedbackIdConflict",
  database_write_failed: "searchFeedback.capture.error.databaseWriteFailed",
  invalid_input: "searchFeedback.capture.error.reviewFields",
};

function fieldErrorMessage(
  field: keyof SearchFeedbackCaptureFieldErrors,
  code: string | undefined,
): string | undefined {
  if (!code) return undefined;
  const key = FIELD_ERROR_KEYS[field][code];
  return key ? t(key) : undefined;
}

function focusSelector(root: HTMLElement, selector: string): void {
  const node = root.querySelector<HTMLElement>(selector);
  node?.focus();
}

function looksLikeNko(text: string): boolean {
  return /[\u07C0-\u07FF]/.test(text);
}

function resultStateLabel(
  state: SearchFeedbackCaptureViewModel["context"]["result_state"],
): string {
  return state === "no_result"
    ? t("searchFeedback.capture.resultState.noResult")
    : t("searchFeedback.capture.resultState.resultsNotUseful");
}

function directionLabel(
  direction: SearchFeedbackCaptureViewModel["context"]["search_direction"],
): string {
  return direction === "source_to_target"
    ? t("searchFeedback.capture.direction.sourceToTarget")
    : t("searchFeedback.capture.direction.targetToSource");
}

export type SearchFeedbackCaptureView = {
  root: HTMLElement;
  update: (vm: SearchFeedbackCaptureViewModel) => void;
};

/**
 * Zero-result entry surface: message + Report this search.
 */
export function renderNoResultSearchFeedbackEntry(
  query: string,
  onReport: () => void,
): HTMLElement {
  const root = el("div", "search-feedback-entry search-feedback-entry-no-result");
  root.setAttribute("data-testid", "search-feedback-entry-no-result");

  const message = el(
    "p",
    "search-feedback-entry-message",
    t("searchFeedback.capture.zeroResultMessage", { query }),
  );
  if (looksLikeNko(query)) {
    message.setAttribute("lang", "nqo");
    message.dir = "rtl";
  }
  root.appendChild(message);

  const button = el(
    "button",
    "btn search-feedback-report-btn",
    t("searchFeedback.capture.reportAction"),
  );
  button.type = "button";
  button.setAttribute("data-testid", "search-feedback-report");
  button.addEventListener("click", () => onReport());
  root.appendChild(button);
  return root;
}

/**
 * Secondary entry surface beneath results: prompt + Report this search.
 */
export function renderResultsNotUsefulSearchFeedbackEntry(
  onReport: () => void,
): HTMLElement {
  const root = el(
    "div",
    "search-feedback-entry search-feedback-entry-results-not-useful",
  );
  root.setAttribute("data-testid", "search-feedback-entry-results-not-useful");

  root.appendChild(
    el(
      "p",
      "search-feedback-entry-prompt",
      t("searchFeedback.capture.resultsNotUsefulPrompt"),
    ),
  );

  const button = el(
    "button",
    "btn search-feedback-report-btn",
    t("searchFeedback.capture.reportAction"),
  );
  button.type = "button";
  button.setAttribute("data-testid", "search-feedback-report");
  button.addEventListener("click", () => onReport());
  root.appendChild(button);
  return root;
}

/**
 * Render the search-failure feedback form from a pure view model.
 */
export function renderSearchFeedbackCapture(
  initialVm: SearchFeedbackCaptureViewModel,
  callbacks: SearchFeedbackCaptureRendererCallbacks,
): SearchFeedbackCaptureView {
  const root = el("div", "search-feedback-capture");
  root.setAttribute("data-testid", "search-feedback-capture");

  let current = initialVm;

  function paintSuccess(vm: SearchFeedbackCaptureViewModel): void {
    const heading = el(
      "h2",
      "search-feedback-capture-heading",
      t("searchFeedback.capture.success.heading"),
    );
    heading.id = "search-feedback-capture-heading";
    heading.tabIndex = -1;
    root.appendChild(heading);

    root.appendChild(
      el("p", undefined, t("searchFeedback.capture.success.body1")),
    );
    root.appendChild(
      el("p", undefined, t("searchFeedback.capture.success.body2")),
    );

    const back = el(
      "button",
      "btn search-feedback-capture-back",
      t("searchFeedback.capture.backToSearch"),
    );
    back.type = "button";
    back.setAttribute("data-testid", "search-feedback-back-to-search");
    back.addEventListener("click", () => callbacks.onBackToSearch());
    root.appendChild(back);

    queueMicrotask(() => {
      heading.focus();
    });
  }

  function paintErrorSummary(vm: SearchFeedbackCaptureViewModel): void {
    const summary = el("div", "search-feedback-capture-error-summary");
    summary.setAttribute("role", "alert");
    summary.id = "search-feedback-capture-error-summary";
    summary.tabIndex = -1;

    summary.appendChild(
      el(
        "p",
        "search-feedback-capture-error-summary-title",
        t("searchFeedback.capture.error.summary"),
      ),
    );

    if (vm.errorCode) {
      summary.appendChild(el("p", undefined, t(STORE_ERROR_KEYS[vm.errorCode])));
    }

    const meaningErr = fieldErrorMessage(
      "requested_meaning",
      vm.errors.requested_meaning,
    );
    if (meaningErr) summary.appendChild(el("p", undefined, meaningErr));
    const detailsErr = fieldErrorMessage(
      "user_description",
      vm.errors.user_description,
    );
    if (detailsErr) summary.appendChild(el("p", undefined, detailsErr));

    root.appendChild(summary);
    queueMicrotask(() => {
      summary.focus();
    });
  }

  function paint(vm: SearchFeedbackCaptureViewModel): void {
    current = vm;
    root.replaceChildren();
    root.setAttribute("aria-busy", vm.state === "saving" ? "true" : "false");

    if (vm.state === "saved") {
      paintSuccess(vm);
      return;
    }

    const heading = el(
      "h2",
      "search-feedback-capture-heading",
      t("searchFeedback.capture.heading"),
    );
    heading.id = "search-feedback-capture-heading";
    heading.tabIndex = -1;
    root.appendChild(heading);

    const searchBlock = el("div", "search-feedback-capture-search");
    const searchLabel = el(
      "div",
      "label",
      t("searchFeedback.capture.searchLabel"),
    );
    searchLabel.id = "search-feedback-capture-search-label";
    searchBlock.appendChild(searchLabel);

    const queryEl = el("p", "search-feedback-capture-query");
    queryEl.id = "search-feedback-capture-query";
    queryEl.setAttribute("aria-labelledby", "search-feedback-capture-search-label");
    queryEl.textContent = `"${vm.context.query_raw}"`;
    if (looksLikeNko(vm.context.query_raw)) {
      queryEl.setAttribute("lang", "nqo");
      queryEl.dir = "rtl";
    }
    searchBlock.appendChild(queryEl);

    searchBlock.appendChild(
      el(
        "p",
        "search-feedback-capture-search-meta",
        t("searchFeedback.capture.searchState", {
          direction: directionLabel(vm.context.search_direction),
          state: resultStateLabel(vm.context.result_state),
          count: vm.context.result_count,
        }),
      ),
    );
    root.appendChild(searchBlock);

    const privacy = el("div", "search-feedback-capture-privacy");
    privacy.appendChild(
      el("p", undefined, t("searchFeedback.capture.privacy.authority")),
    );
    privacy.appendChild(
      el("p", undefined, t("searchFeedback.capture.privacy.localOnly")),
    );
    root.appendChild(privacy);

    if (vm.state === "stale_context") {
      const stale = el("div", "search-feedback-capture-stale");
      stale.setAttribute("role", "alert");
      stale.id = "search-feedback-capture-stale";
      stale.textContent = t("searchFeedback.capture.error.staleContext");
      root.appendChild(stale);
    }

    if (vm.state === "invalid" || vm.state === "error") {
      paintErrorSummary(vm);
    }

    const locked = vm.state === "saving" || vm.state === "stale_context";

    // Requested meaning
    const meaningField = el("div", "field search-feedback-capture-field");
    const meaningLabel = el(
      "label",
      "label",
      `${t("searchFeedback.capture.meaningLabel")} (${t("searchFeedback.capture.optional")})`,
    );
    meaningLabel.htmlFor = "search-feedback-capture-meaning";
    const meaningHelp = el(
      "p",
      "search-feedback-capture-help",
      t("searchFeedback.capture.meaningHelp"),
    );
    meaningHelp.id = "search-feedback-capture-meaning-help";
    const meaningInput = document.createElement("textarea");
    meaningInput.id = "search-feedback-capture-meaning";
    meaningInput.setAttribute("data-testid", "search-feedback-meaning");
    meaningInput.setAttribute("aria-describedby", "search-feedback-capture-meaning-help");
    meaningInput.value = vm.fields.requested_meaning;
    meaningInput.disabled = locked;
    meaningInput.addEventListener("input", () => {
      callbacks.onRequestedMeaningChange(meaningInput.value);
    });
    const meaningCounter = el(
      "p",
      vm.requestedMeaningCount > SEARCH_FEEDBACK_REQUESTED_MEANING_MAX_CHARS
        ? "search-feedback-capture-counter search-feedback-capture-counter-over"
        : "search-feedback-capture-counter",
      t("searchFeedback.capture.counter", {
        count: vm.requestedMeaningCount,
        max: SEARCH_FEEDBACK_REQUESTED_MEANING_MAX_CHARS,
      }),
    );
    meaningCounter.id = "search-feedback-capture-meaning-counter";
    meaningField.append(meaningLabel, meaningHelp, meaningInput, meaningCounter);
    const meaningErr = fieldErrorMessage(
      "requested_meaning",
      vm.errors.requested_meaning,
    );
    if (meaningErr) {
      meaningField.appendChild(
        el("p", "search-feedback-capture-field-error", meaningErr),
      );
    }
    root.appendChild(meaningField);

    // Details
    const detailsField = el("div", "field search-feedback-capture-field");
    const detailsLabel = el(
      "label",
      "label",
      `${t("searchFeedback.capture.detailsLabel")} (${t("searchFeedback.capture.optional")})`,
    );
    detailsLabel.htmlFor = "search-feedback-capture-details";
    const detailsHelp = el(
      "p",
      "search-feedback-capture-help",
      t("searchFeedback.capture.detailsHelp"),
    );
    detailsHelp.id = "search-feedback-capture-details-help";
    const detailsInput = document.createElement("textarea");
    detailsInput.id = "search-feedback-capture-details";
    detailsInput.setAttribute("data-testid", "search-feedback-details");
    detailsInput.setAttribute("aria-describedby", "search-feedback-capture-details-help");
    detailsInput.value = vm.fields.user_description;
    detailsInput.disabled = locked;
    detailsInput.addEventListener("input", () => {
      callbacks.onUserDescriptionChange(detailsInput.value);
    });
    const detailsCounter = el(
      "p",
      vm.userDescriptionCount > SEARCH_FEEDBACK_USER_DESCRIPTION_MAX_CHARS
        ? "search-feedback-capture-counter search-feedback-capture-counter-over"
        : "search-feedback-capture-counter",
      t("searchFeedback.capture.counter", {
        count: vm.userDescriptionCount,
        max: SEARCH_FEEDBACK_USER_DESCRIPTION_MAX_CHARS,
      }),
    );
    detailsCounter.id = "search-feedback-capture-details-counter";
    detailsField.append(detailsLabel, detailsHelp, detailsInput, detailsCounter);
    const detailsErr = fieldErrorMessage(
      "user_description",
      vm.errors.user_description,
    );
    if (detailsErr) {
      detailsField.appendChild(
        el("p", "search-feedback-capture-field-error", detailsErr),
      );
    }
    root.appendChild(detailsField);

    const actions = el("div", "search-feedback-capture-actions");
    const saveBtn = el(
      "button",
      "btn search-feedback-capture-save",
      vm.state === "saving"
        ? t("searchFeedback.capture.saving")
        : t("searchFeedback.capture.save"),
    );
    saveBtn.type = "button";
    saveBtn.setAttribute("data-testid", "search-feedback-save");
    saveBtn.disabled = locked;
    if (vm.state === "saving") {
      saveBtn.setAttribute("aria-busy", "true");
    }
    saveBtn.addEventListener("click", () => callbacks.onSave());

    const cancelBtn = el(
      "button",
      "btn search-feedback-capture-cancel",
      t("searchFeedback.capture.cancel"),
    );
    cancelBtn.type = "button";
    cancelBtn.setAttribute("data-testid", "search-feedback-cancel");
    cancelBtn.disabled = vm.state === "saving";
    cancelBtn.addEventListener("click", () => callbacks.onCancel());

    actions.append(saveBtn, cancelBtn);
    root.appendChild(actions);

    // Preserve focus on re-paint of the field the user was editing when possible.
    void current;
  }

  paint(initialVm);

  return {
    root,
    update(vm: SearchFeedbackCaptureViewModel) {
      paint(vm);
      if (vm.state === "ready") {
        // Heading focus is applied by the host on first open.
      }
    },
  };
}
