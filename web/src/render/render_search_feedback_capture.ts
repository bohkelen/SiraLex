/**
 * CF2I3 / CF2I6A — Search failure capture renderer (DOM only).
 *
 * Ordinary field input must preserve textarea nodes (focus/caret/composition).
 * Full replacement is reserved for layout transitions (editing ↔ saved).
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

/** Do not overwrite an actively edited control (preserves caret/IME). */
function syncTextControl(
  control: HTMLTextAreaElement | HTMLInputElement,
  next: string,
): void {
  if (document.activeElement === control) return;
  if (control.value !== next) control.value = next;
}

function setCounter(
  node: HTMLElement,
  count: number,
  max: number,
  overClass: string,
): void {
  node.textContent = t("searchFeedback.capture.counter", { count, max });
  node.className =
    count > max
      ? `search-feedback-capture-counter ${overClass}`
      : "search-feedback-capture-counter";
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

  root.appendChild(
    el("p", "search-feedback-entry-prompt", t("search.lookingForSomethingElse")),
  );

  const button = el(
    "button",
    "ux2-search-feedback-cta search-feedback-report-btn",
    t("searchFeedback.capture.noResultAction"),
  );
  button.type = "button";
  button.setAttribute("data-testid", "search-feedback-report");
  button.addEventListener("click", () => onReport());
  root.appendChild(button);
  // Keep exact query available for diagnostics without dominating the calm surface.
  root.dataset.query = query;
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
    "ux2-search-feedback-cta search-feedback-report-btn",
    t("searchFeedback.capture.resultsNotUsefulAction"),
  );
  button.type = "button";
  button.setAttribute("data-testid", "search-feedback-report");
  button.addEventListener("click", () => onReport());
  root.appendChild(button);
  return root;
}

type EditingShell = {
  meaningInput: HTMLTextAreaElement;
  detailsInput: HTMLTextAreaElement;
  meaningCounter: HTMLElement;
  detailsCounter: HTMLElement;
  meaningField: HTMLElement;
  detailsField: HTMLElement;
  meaningError: HTMLElement;
  detailsError: HTMLElement;
  staleHost: HTMLElement;
  errorHost: HTMLElement;
  saveBtn: HTMLButtonElement;
  cancelBtn: HTMLButtonElement;
};

/**
 * Render the search-failure feedback form from a pure view model.
 */
export function renderSearchFeedbackCapture(
  initialVm: SearchFeedbackCaptureViewModel,
  callbacks: SearchFeedbackCaptureRendererCallbacks,
): SearchFeedbackCaptureView {
  const root = el("div", "search-feedback-capture");
  root.setAttribute("data-testid", "search-feedback-capture");

  let layout: "none" | "editing" | "saved" = "none";
  let shell: EditingShell | null = null;

  function paintSuccess(vm: SearchFeedbackCaptureViewModel): void {
    void vm;
    shell = null;
    layout = "saved";
    root.replaceChildren();
    root.setAttribute("aria-busy", "false");

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

  function buildErrorSummary(vm: SearchFeedbackCaptureViewModel): HTMLElement {
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
    return summary;
  }

  function buildEditing(vm: SearchFeedbackCaptureViewModel): void {
    root.replaceChildren();
    layout = "editing";

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

    const staleHost = el("div", "search-feedback-capture-stale-host");
    root.appendChild(staleHost);

    const errorHost = el("div", "search-feedback-capture-error-host");
    root.appendChild(errorHost);

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
    meaningInput.addEventListener("input", () => {
      callbacks.onRequestedMeaningChange(meaningInput.value);
    });
    const meaningCounter = el("p", "search-feedback-capture-counter");
    meaningCounter.id = "search-feedback-capture-meaning-counter";
    const meaningError = el("p", "search-feedback-capture-field-error");
    meaningError.hidden = true;
    meaningField.append(
      meaningLabel,
      meaningHelp,
      meaningInput,
      meaningCounter,
      meaningError,
    );
    root.appendChild(meaningField);

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
    detailsInput.addEventListener("input", () => {
      callbacks.onUserDescriptionChange(detailsInput.value);
    });
    const detailsCounter = el("p", "search-feedback-capture-counter");
    detailsCounter.id = "search-feedback-capture-details-counter";
    const detailsError = el("p", "search-feedback-capture-field-error");
    detailsError.hidden = true;
    detailsField.append(
      detailsLabel,
      detailsHelp,
      detailsInput,
      detailsCounter,
      detailsError,
    );
    root.appendChild(detailsField);

    const actions = el("div", "search-feedback-capture-actions");
    const saveBtn = el(
      "button",
      "btn search-feedback-capture-save",
      t("searchFeedback.capture.save"),
    ) as HTMLButtonElement;
    saveBtn.type = "button";
    saveBtn.setAttribute("data-testid", "search-feedback-save");
    saveBtn.addEventListener("click", () => callbacks.onSave());

    const cancelBtn = el(
      "button",
      "btn search-feedback-capture-cancel",
      t("searchFeedback.capture.cancel"),
    ) as HTMLButtonElement;
    cancelBtn.type = "button";
    cancelBtn.setAttribute("data-testid", "search-feedback-cancel");
    cancelBtn.addEventListener("click", () => callbacks.onCancel());

    actions.append(saveBtn, cancelBtn);
    root.appendChild(actions);

    shell = {
      meaningInput,
      detailsInput,
      meaningCounter,
      detailsCounter,
      meaningField,
      detailsField,
      meaningError,
      detailsError,
      staleHost,
      errorHost,
      saveBtn,
      cancelBtn,
    };
    syncEditing(vm);
  }

  function syncEditing(vm: SearchFeedbackCaptureViewModel): void {
    if (!shell) return;
    const locked = vm.state === "saving" || vm.state === "stale_context";
    root.setAttribute("aria-busy", vm.state === "saving" ? "true" : "false");

    syncTextControl(shell.meaningInput, vm.fields.requested_meaning);
    syncTextControl(shell.detailsInput, vm.fields.user_description);
    shell.meaningInput.disabled = locked;
    shell.detailsInput.disabled = locked;

    setCounter(
      shell.meaningCounter,
      vm.requestedMeaningCount,
      SEARCH_FEEDBACK_REQUESTED_MEANING_MAX_CHARS,
      "search-feedback-capture-counter-over",
    );
    setCounter(
      shell.detailsCounter,
      vm.userDescriptionCount,
      SEARCH_FEEDBACK_USER_DESCRIPTION_MAX_CHARS,
      "search-feedback-capture-counter-over",
    );

    const meaningErr = fieldErrorMessage(
      "requested_meaning",
      vm.errors.requested_meaning,
    );
    if (meaningErr) {
      shell.meaningError.hidden = false;
      shell.meaningError.textContent = meaningErr;
      shell.meaningInput.setAttribute("aria-invalid", "true");
    } else {
      shell.meaningError.hidden = true;
      shell.meaningError.textContent = "";
      shell.meaningInput.removeAttribute("aria-invalid");
    }

    const detailsErr = fieldErrorMessage(
      "user_description",
      vm.errors.user_description,
    );
    if (detailsErr) {
      shell.detailsError.hidden = false;
      shell.detailsError.textContent = detailsErr;
      shell.detailsInput.setAttribute("aria-invalid", "true");
    } else {
      shell.detailsError.hidden = true;
      shell.detailsError.textContent = "";
      shell.detailsInput.removeAttribute("aria-invalid");
    }

    shell.staleHost.replaceChildren();
    if (vm.state === "stale_context") {
      const stale = el("div", "search-feedback-capture-stale");
      stale.setAttribute("role", "alert");
      stale.id = "search-feedback-capture-stale";
      stale.textContent = t("searchFeedback.capture.error.staleContext");
      shell.staleHost.appendChild(stale);
    }

    const hadErrorSummary = Boolean(
      shell.errorHost.querySelector("#search-feedback-capture-error-summary"),
    );
    shell.errorHost.replaceChildren();
    if (vm.state === "invalid" || vm.state === "error") {
      shell.errorHost.appendChild(buildErrorSummary(vm));
      // Focus only when the summary newly appears (not on each field keystroke).
      if (!hadErrorSummary) {
        queueMicrotask(() => {
          shell?.errorHost
            .querySelector<HTMLElement>("#search-feedback-capture-error-summary")
            ?.focus();
        });
      }
    }

    shell.saveBtn.textContent =
      vm.state === "saving"
        ? t("searchFeedback.capture.saving")
        : t("searchFeedback.capture.save");
    shell.saveBtn.disabled = locked;
    if (vm.state === "saving") {
      shell.saveBtn.setAttribute("aria-busy", "true");
    } else {
      shell.saveBtn.removeAttribute("aria-busy");
    }
    shell.cancelBtn.disabled = vm.state === "saving";
  }

  function apply(vm: SearchFeedbackCaptureViewModel): void {
    if (vm.state === "saved") {
      paintSuccess(vm);
      return;
    }
    if (layout !== "editing" || !shell || !root.contains(shell.meaningInput)) {
      buildEditing(vm);
      return;
    }
    syncEditing(vm);
  }

  apply(initialVm);

  return {
    root,
    update(vm: SearchFeedbackCaptureViewModel) {
      apply(vm);
    },
  };
}
