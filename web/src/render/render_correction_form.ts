/**
 * CF1I3 — Pure correction suggestion form renderer.
 *
 * DOM only: no IndexedDB, dictionary resolution, timestamps, or ID generation.
 */

import { t, type TranslationKey } from "../i18n";
import {
  CORRECTION_OTHER_FIELD_LABEL_MAX_CHARS,
  CORRECTION_PROBLEM_DESCRIPTION_MAX_CHARS,
  CORRECTION_PROPOSED_VALUE_MAX_CHARS,
  type CorrectionIssueType,
} from "../corrections/correction_draft_types";
import {
  CORRECTION_FORM_ISSUE_TYPES,
  type CorrectionFormErrorCode,
  type CorrectionFormFieldErrors,
  type CorrectionFormViewModel,
  type CorrectionTargetOption,
  type CorrectionTargetOptionLabel,
} from "../corrections/correction_form_model";

export type CorrectionFormRendererCallbacks = {
  onIssueTypeChange: (value: CorrectionIssueType | "") => void;
  onTargetChange: (key: string) => void;
  onModeChange: (mode: "problem_report" | "proposed_correction") => void;
  onProblemDescriptionChange: (value: string) => void;
  onProposedValueChange: (value: string) => void;
  onOtherFieldLabelChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onBackToEntry: () => void;
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

const ISSUE_LABEL_KEYS: Record<CorrectionIssueType, TranslationKey> = {
  spelling: "correctionFeedback.form.issue.spelling",
  translation_or_gloss: "correctionFeedback.form.issue.translation_or_gloss",
  part_of_speech: "correctionFeedback.form.issue.part_of_speech",
  nko: "correctionFeedback.form.issue.nko",
  example: "correctionFeedback.form.issue.example",
  usage_or_context: "correctionFeedback.form.issue.usage_or_context",
  missing_information: "correctionFeedback.form.issue.missing_information",
  duplicate_or_wrong_sense: "correctionFeedback.form.issue.duplicate_or_wrong_sense",
  other: "correctionFeedback.form.issue.other",
};

const FIELD_ERROR_KEYS: Record<
  keyof CorrectionFormFieldErrors,
  Record<string, TranslationKey>
> = {
  issue_type: { required: "correctionFeedback.form.error.issueRequired" },
  target: {
    required: "correctionFeedback.form.error.targetRequired",
    invalid: "correctionFeedback.form.error.targetInvalid",
  },
  problem_description: {
    required: "correctionFeedback.form.error.descriptionRequired",
    too_long: "correctionFeedback.form.error.descriptionTooLong",
    invalid_chars: "correctionFeedback.form.error.descriptionInvalid",
  },
  proposed_value: {
    required: "correctionFeedback.form.error.proposedRequired",
    too_long: "correctionFeedback.form.error.proposedTooLong",
    invalid_chars: "correctionFeedback.form.error.proposedInvalid",
  },
  field_label: {
    required: "correctionFeedback.form.error.fieldLabelRequired",
    too_long: "correctionFeedback.form.error.fieldLabelTooLong",
    invalid_chars: "correctionFeedback.form.error.fieldLabelInvalid",
  },
};

const STORE_ERROR_KEYS: Record<CorrectionFormErrorCode, TranslationKey> = {
  entry_context_changed: "correctionFeedback.form.error.staleContext",
  invalid_fields: "correctionFeedback.form.error.reviewFields",
  invalid_timestamp: "correctionFeedback.form.error.invalidTimestamp",
  id_generation_failed: "correctionFeedback.form.error.idGenerationFailed",
  draft_id_conflict: "correctionFeedback.form.error.draftIdConflict",
  database_write_failed: "correctionFeedback.form.error.databaseWriteFailed",
  invalid_input: "correctionFeedback.form.error.reviewFields",
};

export function formatCorrectionTargetOptionLabel(label: CorrectionTargetOptionLabel): string {
  switch (label.kind) {
    case "entry":
      return t("correctionFeedback.form.target.entry");
    case "headword":
      return t("correctionFeedback.form.target.headword", { headword: label.headword });
    case "part_of_speech":
      return t("correctionFeedback.form.target.part_of_speech", { pos: label.pos });
    case "nko":
      return t("correctionFeedback.form.target.nko", { nko: label.nko });
    case "sense":
      return t("correctionFeedback.form.target.sense", { n: label.senseNumber });
    case "translation":
      if (label.gloss_lang === "fr") {
        return t("correctionFeedback.form.target.translationFr", {
          n: label.senseNumber,
          gloss: label.gloss,
        });
      }
      if (label.gloss_lang === "en") {
        return t("correctionFeedback.form.target.translationEn", {
          n: label.senseNumber,
          gloss: label.gloss,
        });
      }
      return t("correctionFeedback.form.target.translationRu", {
        n: label.senseNumber,
        gloss: label.gloss,
      });
    case "example":
      return t("correctionFeedback.form.target.example", {
        sense: label.senseNumber,
        example: label.exampleNumber,
        text: label.text,
      });
    case "usage_note":
      return t("correctionFeedback.form.target.usage_note", { n: label.senseNumber });
    case "other_field":
      return t("correctionFeedback.form.target.other_field");
  }
}

function fieldErrorMessage(
  field: keyof CorrectionFormFieldErrors,
  code: string | undefined,
): string | undefined {
  if (!code) return undefined;
  const key = FIELD_ERROR_KEYS[field][code];
  return key ? t(key) : undefined;
}

function cssEscapeIdent(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return value.replace(/([^a-zA-Z0-9_-])/g, "\\$1");
}

function focusSelector(root: HTMLElement, selector: string): void {
  const node = root.querySelector<HTMLElement>(selector);
  node?.focus();
}

export type CorrectionFormView = {
  root: HTMLElement;
  update: (vm: CorrectionFormViewModel) => void;
};

/**
 * Render the correction suggestion form from a pure view model.
 */
export function renderCorrectionForm(
  initialVm: CorrectionFormViewModel,
  callbacks: CorrectionFormRendererCallbacks,
): CorrectionFormView {
  const root = el("div", "correction-form");
  root.setAttribute("data-testid", "correction-form");

  let current = initialVm;

  function paint(vm: CorrectionFormViewModel): void {
    current = vm;
    const previousFocusId = document.activeElement?.id;
    root.replaceChildren();
    root.setAttribute("aria-busy", vm.busy ? "true" : "false");

    if (vm.state === "saved") {
      paintSuccess(vm);
      return;
    }

    const heading = el("h2", "correction-form-heading", t("correctionFeedback.form.heading"));
    heading.id = "correction-form-heading";
    root.appendChild(heading);

    const summary = el("p", "correction-form-entry-summary");
    summary.id = "correction-form-entry-summary";
    const headword = vm.context.entry.display && "headword_latin" in vm.context.entry.display
      ? vm.context.entry.display.headword_latin
      : vm.context.ir_id;
    summary.textContent = t("correctionFeedback.form.entrySummary", { headword });
    root.appendChild(summary);

    const nko =
      vm.context.entry.display &&
      "headword_nko_provided" in vm.context.entry.display &&
      vm.context.entry.display.headword_nko_provided
        ? vm.context.entry.display.headword_nko_provided
        : undefined;
    if (nko) {
      const nkoEl = el("p", "correction-form-entry-nko", nko);
      nkoEl.setAttribute("lang", "nqo");
      nkoEl.dir = "rtl";
      root.appendChild(nkoEl);
    }

    const privacy = el("div", "correction-form-privacy");
    privacy.appendChild(el("p", undefined, t("correctionFeedback.form.privacy.localOnly")));
    privacy.appendChild(el("p", undefined, t("correctionFeedback.form.privacy.exportLater")));
    privacy.appendChild(el("p", undefined, t("correctionFeedback.form.privacy.unreviewed")));
    root.appendChild(privacy);

    if (vm.state === "stale_context") {
      const stale = el("div", "correction-form-stale");
      stale.setAttribute("role", "alert");
      stale.id = "correction-form-stale";
      stale.textContent = t("correctionFeedback.form.error.staleContext");
      root.appendChild(stale);
    }

    if (vm.state === "invalid" || vm.state === "error") {
      paintErrorSummary(vm);
    }

    // Issue type
    const issueField = el("div", "field correction-form-field");
    const issueLabel = el("label", "label", t("correctionFeedback.form.issueLabel"));
    issueLabel.htmlFor = "correction-form-issue";
    const issueSelect = document.createElement("select");
    issueSelect.id = "correction-form-issue";
    issueSelect.disabled = vm.state === "saving" || vm.state === "stale_context";
    const issuePlaceholder = document.createElement("option");
    issuePlaceholder.value = "";
    issuePlaceholder.textContent = t("correctionFeedback.form.issuePlaceholder");
    issueSelect.appendChild(issuePlaceholder);
    for (const issue of CORRECTION_FORM_ISSUE_TYPES) {
      const opt = document.createElement("option");
      opt.value = issue;
      opt.textContent = t(ISSUE_LABEL_KEYS[issue]);
      if (vm.fields.issue_type === issue) opt.selected = true;
      issueSelect.appendChild(opt);
    }
    issueSelect.addEventListener("change", () => {
      callbacks.onIssueTypeChange(issueSelect.value as CorrectionIssueType | "");
    });
    issueField.appendChild(issueLabel);
    issueField.appendChild(issueSelect);
    appendFieldError(issueField, "issue_type", vm.errors, "correction-form-issue-error");
    root.appendChild(issueField);

    // Target
    const targetField = el("div", "field correction-form-field");
    const targetLabel = el("label", "label", t("correctionFeedback.form.targetLabel"));
    targetLabel.htmlFor = "correction-form-target";
    const targetSelect = document.createElement("select");
    targetSelect.id = "correction-form-target";
    targetSelect.disabled = vm.state === "saving" || vm.state === "stale_context";
    for (const option of vm.targetOptions) {
      targetSelect.appendChild(optionElement(option, vm.fields.target_key === option.key));
    }
    targetSelect.addEventListener("change", () => {
      callbacks.onTargetChange(targetSelect.value);
    });
    targetField.appendChild(targetLabel);
    targetField.appendChild(targetSelect);
    if (vm.targetPreview) {
      const preview = el(
        "p",
        "correction-form-target-preview",
        t("correctionFeedback.form.targetPreview", { text: vm.targetPreview }),
      );
      preview.id = "correction-form-target-preview";
      if (vm.fields.target_key === "nko" || /[\u07C0-\u07FF]/.test(vm.targetPreview)) {
        preview.setAttribute("lang", "nqo");
        preview.dir = "rtl";
      }
      targetField.appendChild(preview);
    }
    appendFieldError(targetField, "target", vm.errors, "correction-form-target-error");
    root.appendChild(targetField);

    if (vm.fields.target_key === "other_field") {
      const labelField = el("div", "field correction-form-field");
      const label = el("label", "label", t("correctionFeedback.form.otherFieldLabel"));
      label.htmlFor = "correction-form-field-label";
      const input = document.createElement("input");
      input.type = "text";
      input.id = "correction-form-field-label";
      input.value = vm.fields.other_field_label;
      input.disabled = vm.state === "saving" || vm.state === "stale_context";
      input.setAttribute("aria-describedby", "correction-form-field-label-help correction-form-field-label-count");
      input.addEventListener("input", () => {
        callbacks.onOtherFieldLabelChange(input.value);
      });
      const help = el("p", "correction-form-help", t("correctionFeedback.form.otherFieldHelp"));
      help.id = "correction-form-field-label-help";
      const counter = el(
        "p",
        "correction-form-counter",
        t("correctionFeedback.form.counter", {
          count: vm.fieldLabelCount,
          max: CORRECTION_OTHER_FIELD_LABEL_MAX_CHARS,
        }),
      );
      counter.id = "correction-form-field-label-count";
      if (vm.fieldLabelCount > CORRECTION_OTHER_FIELD_LABEL_MAX_CHARS) {
        counter.classList.add("correction-form-counter-over");
        counter.setAttribute("role", "status");
      }
      labelField.appendChild(label);
      labelField.appendChild(input);
      labelField.appendChild(help);
      labelField.appendChild(counter);
      appendFieldError(labelField, "field_label", vm.errors, "correction-form-field-label-error");
      root.appendChild(labelField);
    }

    // Mode
    const modeFieldset = el("fieldset", "correction-form-mode");
    modeFieldset.disabled = vm.state === "saving" || vm.state === "stale_context";
    modeFieldset.appendChild(el("legend", undefined, t("correctionFeedback.form.modeLabel")));
    modeFieldset.appendChild(
      radioOption(
        "problem_report",
        t("correctionFeedback.form.mode.problem_report"),
        vm.fields.mode === "problem_report",
        () => callbacks.onModeChange("problem_report"),
      ),
    );
    modeFieldset.appendChild(
      radioOption(
        "proposed_correction",
        t("correctionFeedback.form.mode.proposed_correction"),
        vm.fields.mode === "proposed_correction",
        () => callbacks.onModeChange("proposed_correction"),
      ),
    );
    root.appendChild(modeFieldset);

    // Description
    const descField = el("div", "field correction-form-field");
    const descLabel = el("label", "label", t("correctionFeedback.form.descriptionLabel"));
    descLabel.htmlFor = "correction-form-description";
    const desc = document.createElement("textarea");
    desc.id = "correction-form-description";
    desc.rows = 5;
    desc.value = vm.fields.problem_description;
    desc.disabled = vm.state === "saving" || vm.state === "stale_context";
    desc.setAttribute(
      "aria-describedby",
      "correction-form-description-help correction-form-description-count",
    );
    desc.addEventListener("input", () => {
      callbacks.onProblemDescriptionChange(desc.value);
    });
    const descHelp = el("p", "correction-form-help", t("correctionFeedback.form.descriptionHelp"));
    descHelp.id = "correction-form-description-help";
    const descCount = el(
      "p",
      "correction-form-counter",
      t("correctionFeedback.form.counter", {
        count: vm.descriptionCount,
        max: CORRECTION_PROBLEM_DESCRIPTION_MAX_CHARS,
      }),
    );
    descCount.id = "correction-form-description-count";
    if (vm.descriptionCount > CORRECTION_PROBLEM_DESCRIPTION_MAX_CHARS) {
      descCount.classList.add("correction-form-counter-over");
      descCount.setAttribute("role", "status");
    }
    descField.appendChild(descLabel);
    descField.appendChild(desc);
    descField.appendChild(descHelp);
    descField.appendChild(descCount);
    appendFieldError(descField, "problem_description", vm.errors, "correction-form-description-error");
    root.appendChild(descField);

    if (vm.fields.mode === "proposed_correction") {
      const propField = el("div", "field correction-form-field");
      const propLabel = el("label", "label", t("correctionFeedback.form.proposedLabel"));
      propLabel.htmlFor = "correction-form-proposed";
      const prop = document.createElement("textarea");
      prop.id = "correction-form-proposed";
      prop.rows = 4;
      prop.value = vm.fields.proposed_value;
      prop.disabled = vm.state === "saving" || vm.state === "stale_context";
      prop.setAttribute(
        "aria-describedby",
        "correction-form-proposed-help correction-form-proposed-count",
      );
      prop.addEventListener("input", () => {
        callbacks.onProposedValueChange(prop.value);
      });
      const propHelp = el("p", "correction-form-help", t("correctionFeedback.form.proposedHelp"));
      propHelp.id = "correction-form-proposed-help";
      const propCount = el(
        "p",
        "correction-form-counter",
        t("correctionFeedback.form.counter", {
          count: vm.proposedCount,
          max: CORRECTION_PROPOSED_VALUE_MAX_CHARS,
        }),
      );
      propCount.id = "correction-form-proposed-count";
      if (vm.proposedCount > CORRECTION_PROPOSED_VALUE_MAX_CHARS) {
        propCount.classList.add("correction-form-counter-over");
        propCount.setAttribute("role", "status");
      }
      propField.appendChild(propLabel);
      propField.appendChild(prop);
      propField.appendChild(propHelp);
      propField.appendChild(propCount);
      appendFieldError(propField, "proposed_value", vm.errors, "correction-form-proposed-error");
      root.appendChild(propField);
    }

    const actions = el("div", "correction-form-actions");
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "btn correction-form-save";
    saveBtn.id = "correction-form-save";
    saveBtn.textContent =
      vm.state === "saving"
        ? t("correctionFeedback.form.saving")
        : t("correctionFeedback.form.save");
    saveBtn.disabled = vm.saveDisabled;
    saveBtn.addEventListener("click", () => {
      callbacks.onSave();
    });
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "btn correction-form-cancel";
    cancelBtn.id = "correction-form-cancel";
    cancelBtn.textContent = t("correctionFeedback.form.cancel");
    cancelBtn.disabled = vm.state === "saving";
    cancelBtn.addEventListener("click", () => {
      callbacks.onCancel();
    });
    actions.appendChild(saveBtn);
    actions.appendChild(cancelBtn);
    root.appendChild(actions);

    // Restore focus when possible; otherwise apply invalid/success focus rules.
    if (vm.state === "invalid" || vm.state === "error") {
      focusSelector(root, "#correction-form-error-summary");
    } else if (previousFocusId) {
      focusSelector(root, `#${cssEscapeIdent(previousFocusId)}`);
    }
  }

  function paintSuccess(vm: CorrectionFormViewModel): void {
    const heading = el("h2", "correction-form-heading", t("correctionFeedback.form.success.heading"));
    heading.id = "correction-form-success-heading";
    heading.tabIndex = -1;
    root.appendChild(heading);
    root.appendChild(el("p", undefined, t("correctionFeedback.form.success.body1")));
    root.appendChild(el("p", undefined, t("correctionFeedback.form.success.body2")));
    const back = document.createElement("button");
    back.type = "button";
    back.className = "btn correction-form-back";
    back.id = "correction-form-back";
    back.textContent = t("correctionFeedback.form.backToEntry");
    back.addEventListener("click", () => {
      callbacks.onBackToEntry();
    });
    root.appendChild(back);
    // Focus after paint.
    queueMicrotask(() => {
      heading.focus();
    });
    void vm;
  }

  function paintErrorSummary(vm: CorrectionFormViewModel): void {
    const summary = el("div", "correction-form-error-summary");
    summary.id = "correction-form-error-summary";
    summary.setAttribute("role", "alert");
    summary.tabIndex = -1;
    summary.appendChild(
      el("p", "correction-form-error-summary-title", t("correctionFeedback.form.error.summary")),
    );
    if (vm.errorCode && vm.errorCode !== "invalid_fields") {
      summary.appendChild(el("p", undefined, t(STORE_ERROR_KEYS[vm.errorCode])));
    }
    const list = el("ul");
    for (const field of Object.keys(vm.errors) as (keyof CorrectionFormFieldErrors)[]) {
      const code = vm.errors[field];
      const message = fieldErrorMessage(field, code);
      if (!message) continue;
      const item = el("li");
      const link = document.createElement("a");
      link.href = `#${fieldControlId(field)}`;
      link.textContent = message;
      item.appendChild(link);
      list.appendChild(item);
    }
    if (list.childElementCount > 0) summary.appendChild(list);
    root.appendChild(summary);
  }

  function appendFieldError(
    field: HTMLElement,
    key: keyof CorrectionFormFieldErrors,
    errors: CorrectionFormFieldErrors,
    errorId: string,
  ): void {
    const message = fieldErrorMessage(key, errors[key]);
    if (!message) return;
    const err = el("p", "correction-form-field-error", message);
    err.id = errorId;
    err.setAttribute("role", "alert");
    field.appendChild(err);
    const control = field.querySelector<HTMLElement>("select, textarea, input");
    if (control) {
      control.setAttribute("aria-invalid", "true");
      const describedBy = control.getAttribute("aria-describedby");
      control.setAttribute(
        "aria-describedby",
        describedBy ? `${describedBy} ${errorId}` : errorId,
      );
    }
  }

  paint(initialVm);

  return {
    root,
    update: (vm) => {
      paint(vm);
    },
  };
}

function fieldControlId(field: keyof CorrectionFormFieldErrors): string {
  switch (field) {
    case "issue_type":
      return "correction-form-issue";
    case "target":
      return "correction-form-target";
    case "problem_description":
      return "correction-form-description";
    case "proposed_value":
      return "correction-form-proposed";
    case "field_label":
      return "correction-form-field-label";
  }
}

function optionElement(option: CorrectionTargetOption, selected: boolean): HTMLOptionElement {
  const opt = document.createElement("option");
  opt.value = option.key;
  opt.textContent = formatCorrectionTargetOptionLabel(option.label);
  opt.selected = selected;
  return opt;
}

function radioOption(
  value: "problem_report" | "proposed_correction",
  labelText: string,
  checked: boolean,
  onChange: () => void,
): HTMLElement {
  const wrap = el("label", "correction-form-mode-option");
  const input = document.createElement("input");
  input.type = "radio";
  input.name = "correction-form-mode";
  input.value = value;
  input.checked = checked;
  input.id = `correction-form-mode-${value}`;
  input.addEventListener("change", () => {
    if (input.checked) onChange();
  });
  wrap.appendChild(input);
  wrap.appendChild(document.createTextNode(` ${labelText}`));
  return wrap;
}
