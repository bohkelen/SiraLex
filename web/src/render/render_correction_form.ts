/**
 * CF1I3 / CF2I6A — Pure correction suggestion form renderer.
 *
 * DOM only: no IndexedDB, dictionary resolution, timestamps, or ID generation.
 * Editing layout keeps text controls stable across ordinary keystroke updates.
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

const DESC_DESCRIBED_BY =
  "correction-form-description-help correction-form-description-count";
const PROP_DESCRIBED_BY =
  "correction-form-proposed-help correction-form-proposed-count";
const FIELD_LABEL_DESCRIBED_BY =
  "correction-form-field-label-help correction-form-field-label-count";

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

/** Do not overwrite an actively edited control (preserves caret/IME). */
function syncTextControl(
  control: HTMLTextAreaElement | HTMLInputElement,
  next: string,
): void {
  if (document.activeElement === control) return;
  if (control.value !== next) control.value = next;
}

function setCounter(node: HTMLElement, count: number, max: number): void {
  node.textContent = t("correctionFeedback.form.counter", { count, max });
  if (count > max) {
    node.classList.add("correction-form-counter-over");
    node.setAttribute("role", "status");
  } else {
    node.classList.remove("correction-form-counter-over");
    node.removeAttribute("role");
  }
}

function syncFieldError(
  control: HTMLElement,
  errorEl: HTMLElement,
  message: string | undefined,
  errorId: string,
  baseDescribedBy?: string,
): void {
  if (message) {
    errorEl.hidden = false;
    errorEl.id = errorId;
    errorEl.setAttribute("role", "alert");
    errorEl.textContent = message;
    control.setAttribute("aria-invalid", "true");
    control.setAttribute(
      "aria-describedby",
      baseDescribedBy ? `${baseDescribedBy} ${errorId}` : errorId,
    );
  } else {
    errorEl.hidden = true;
    errorEl.textContent = "";
    control.removeAttribute("aria-invalid");
    if (baseDescribedBy) {
      control.setAttribute("aria-describedby", baseDescribedBy);
    } else {
      control.removeAttribute("aria-describedby");
    }
  }
}

type EditingShell = {
  issueSelect: HTMLSelectElement;
  issueError: HTMLElement;
  targetSelect: HTMLSelectElement;
  targetPreview: HTMLElement;
  targetError: HTMLElement;
  otherField: HTMLElement;
  otherFieldInput: HTMLInputElement;
  otherFieldCounter: HTMLElement;
  otherFieldError: HTMLElement;
  modeFieldset: HTMLFieldSetElement;
  modeProblem: HTMLInputElement;
  modeProposed: HTMLInputElement;
  descInput: HTMLTextAreaElement;
  descCounter: HTMLElement;
  descError: HTMLElement;
  propField: HTMLElement;
  propInput: HTMLTextAreaElement;
  propCounter: HTMLElement;
  propError: HTMLElement;
  staleHost: HTMLElement;
  errorHost: HTMLElement;
  saveBtn: HTMLButtonElement;
  cancelBtn: HTMLButtonElement;
};

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

  let layout: "none" | "editing" | "saved" = "none";
  let shell: EditingShell | null = null;

  function paintSuccess(vm: CorrectionFormViewModel): void {
    shell = null;
    layout = "saved";
    root.replaceChildren();
    root.setAttribute("aria-busy", "false");

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
    queueMicrotask(() => {
      heading.focus();
    });
    void vm;
  }

  function buildErrorSummary(vm: CorrectionFormViewModel): HTMLElement {
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
    return summary;
  }

  function syncTargetOptions(vm: CorrectionFormViewModel): void {
    if (!shell) return;
    const select = shell.targetSelect;
    const nextKeys = vm.targetOptions.map((o) => o.key);
    const currentKeys = [...select.options].map((o) => o.value);
    const keysChanged =
      nextKeys.length !== currentKeys.length ||
      nextKeys.some((key, i) => key !== currentKeys[i]);

    if (keysChanged) {
      select.replaceChildren();
      for (const option of vm.targetOptions) {
        select.appendChild(optionElement(option, vm.fields.target_key === option.key));
      }
    } else {
      for (const option of select.options) {
        option.selected = option.value === vm.fields.target_key;
      }
    }

    if (vm.targetPreview) {
      shell.targetPreview.hidden = false;
      shell.targetPreview.textContent = t("correctionFeedback.form.targetPreview", {
        text: vm.targetPreview,
      });
      if (vm.fields.target_key === "nko" || /[\u07C0-\u07FF]/.test(vm.targetPreview)) {
        shell.targetPreview.setAttribute("lang", "nqo");
        shell.targetPreview.dir = "rtl";
      } else {
        shell.targetPreview.removeAttribute("lang");
        shell.targetPreview.removeAttribute("dir");
      }
    } else {
      shell.targetPreview.hidden = true;
      shell.targetPreview.textContent = "";
      shell.targetPreview.removeAttribute("lang");
      shell.targetPreview.removeAttribute("dir");
    }
  }

  function buildEditing(vm: CorrectionFormViewModel): void {
    root.replaceChildren();
    layout = "editing";

    const heading = el("h2", "correction-form-heading", t("correctionFeedback.form.heading"));
    heading.id = "correction-form-heading";
    root.appendChild(heading);

    const summary = el("p", "correction-form-entry-summary");
    summary.id = "correction-form-entry-summary";
    const headword =
      vm.context.entry.display && "headword_latin" in vm.context.entry.display
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

    const staleHost = el("div", "correction-form-stale-host");
    root.appendChild(staleHost);

    const errorHost = el("div", "correction-form-error-host");
    root.appendChild(errorHost);

    // Issue type
    const issueField = el("div", "field correction-form-field");
    const issueLabel = el("label", "label", t("correctionFeedback.form.issueLabel"));
    issueLabel.htmlFor = "correction-form-issue";
    const issueSelect = document.createElement("select");
    issueSelect.id = "correction-form-issue";
    const issuePlaceholder = document.createElement("option");
    issuePlaceholder.value = "";
    issuePlaceholder.textContent = t("correctionFeedback.form.issuePlaceholder");
    issueSelect.appendChild(issuePlaceholder);
    for (const issue of CORRECTION_FORM_ISSUE_TYPES) {
      const opt = document.createElement("option");
      opt.value = issue;
      opt.textContent = t(ISSUE_LABEL_KEYS[issue]);
      issueSelect.appendChild(opt);
    }
    issueSelect.addEventListener("change", () => {
      callbacks.onIssueTypeChange(issueSelect.value as CorrectionIssueType | "");
    });
    const issueError = el("p", "correction-form-field-error");
    issueError.id = "correction-form-issue-error";
    issueError.hidden = true;
    issueField.append(issueLabel, issueSelect, issueError);
    root.appendChild(issueField);

    // Target
    const targetField = el("div", "field correction-form-field");
    const targetLabel = el("label", "label", t("correctionFeedback.form.targetLabel"));
    targetLabel.htmlFor = "correction-form-target";
    const targetSelect = document.createElement("select");
    targetSelect.id = "correction-form-target";
    targetSelect.addEventListener("change", () => {
      callbacks.onTargetChange(targetSelect.value);
    });
    const targetPreview = el("p", "correction-form-target-preview");
    targetPreview.id = "correction-form-target-preview";
    targetPreview.hidden = true;
    const targetError = el("p", "correction-form-field-error");
    targetError.id = "correction-form-target-error";
    targetError.hidden = true;
    targetField.append(targetLabel, targetSelect, targetPreview, targetError);
    root.appendChild(targetField);

    // Other-field label (always created; hidden unless target is other_field)
    const otherField = el("div", "field correction-form-field");
    const otherLabel = el("label", "label", t("correctionFeedback.form.otherFieldLabel"));
    otherLabel.htmlFor = "correction-form-field-label";
    const otherFieldInput = document.createElement("input");
    otherFieldInput.type = "text";
    otherFieldInput.id = "correction-form-field-label";
    otherFieldInput.setAttribute("aria-describedby", FIELD_LABEL_DESCRIBED_BY);
    otherFieldInput.addEventListener("input", () => {
      callbacks.onOtherFieldLabelChange(otherFieldInput.value);
    });
    const otherHelp = el("p", "correction-form-help", t("correctionFeedback.form.otherFieldHelp"));
    otherHelp.id = "correction-form-field-label-help";
    const otherFieldCounter = el("p", "correction-form-counter");
    otherFieldCounter.id = "correction-form-field-label-count";
    const otherFieldError = el("p", "correction-form-field-error");
    otherFieldError.id = "correction-form-field-label-error";
    otherFieldError.hidden = true;
    otherField.append(
      otherLabel,
      otherFieldInput,
      otherHelp,
      otherFieldCounter,
      otherFieldError,
    );
    root.appendChild(otherField);

    // Mode
    const modeFieldset = el("fieldset", "correction-form-mode");
    modeFieldset.appendChild(el("legend", undefined, t("correctionFeedback.form.modeLabel")));
    const modeProblemWrap = radioOption(
      "problem_report",
      t("correctionFeedback.form.mode.problem_report"),
      false,
      () => callbacks.onModeChange("problem_report"),
    );
    const modeProposedWrap = radioOption(
      "proposed_correction",
      t("correctionFeedback.form.mode.proposed_correction"),
      false,
      () => callbacks.onModeChange("proposed_correction"),
    );
    modeFieldset.append(modeProblemWrap, modeProposedWrap);
    root.appendChild(modeFieldset);
    const modeProblem = modeProblemWrap.querySelector<HTMLInputElement>(
      "#correction-form-mode-problem_report",
    )!;
    const modeProposed = modeProposedWrap.querySelector<HTMLInputElement>(
      "#correction-form-mode-proposed_correction",
    )!;

    // Description (always created once)
    const descField = el("div", "field correction-form-field");
    const descLabel = el("label", "label", t("correctionFeedback.form.descriptionLabel"));
    descLabel.htmlFor = "correction-form-description";
    const descInput = document.createElement("textarea");
    descInput.id = "correction-form-description";
    descInput.rows = 5;
    descInput.setAttribute("aria-describedby", DESC_DESCRIBED_BY);
    descInput.addEventListener("input", () => {
      callbacks.onProblemDescriptionChange(descInput.value);
    });
    const descHelp = el("p", "correction-form-help", t("correctionFeedback.form.descriptionHelp"));
    descHelp.id = "correction-form-description-help";
    const descCounter = el("p", "correction-form-counter");
    descCounter.id = "correction-form-description-count";
    const descError = el("p", "correction-form-field-error");
    descError.id = "correction-form-description-error";
    descError.hidden = true;
    descField.append(descLabel, descInput, descHelp, descCounter, descError);
    root.appendChild(descField);

    // Proposed (always created; hidden unless mode is proposed_correction)
    const propField = el("div", "field correction-form-field");
    const propLabel = el("label", "label", t("correctionFeedback.form.proposedLabel"));
    propLabel.htmlFor = "correction-form-proposed";
    const propInput = document.createElement("textarea");
    propInput.id = "correction-form-proposed";
    propInput.rows = 4;
    propInput.setAttribute("aria-describedby", PROP_DESCRIBED_BY);
    propInput.addEventListener("input", () => {
      callbacks.onProposedValueChange(propInput.value);
    });
    const propHelp = el("p", "correction-form-help", t("correctionFeedback.form.proposedHelp"));
    propHelp.id = "correction-form-proposed-help";
    const propCounter = el("p", "correction-form-counter");
    propCounter.id = "correction-form-proposed-count";
    const propError = el("p", "correction-form-field-error");
    propError.id = "correction-form-proposed-error";
    propError.hidden = true;
    propField.append(propLabel, propInput, propHelp, propCounter, propError);
    root.appendChild(propField);

    const actions = el("div", "correction-form-actions");
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "btn correction-form-save";
    saveBtn.id = "correction-form-save";
    saveBtn.addEventListener("click", () => {
      callbacks.onSave();
    });
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "btn correction-form-cancel";
    cancelBtn.id = "correction-form-cancel";
    cancelBtn.textContent = t("correctionFeedback.form.cancel");
    cancelBtn.addEventListener("click", () => {
      callbacks.onCancel();
    });
    actions.append(saveBtn, cancelBtn);
    root.appendChild(actions);

    shell = {
      issueSelect,
      issueError,
      targetSelect,
      targetPreview,
      targetError,
      otherField,
      otherFieldInput,
      otherFieldCounter,
      otherFieldError,
      modeFieldset,
      modeProblem,
      modeProposed,
      descInput,
      descCounter,
      descError,
      propField,
      propInput,
      propCounter,
      propError,
      staleHost,
      errorHost,
      saveBtn,
      cancelBtn,
    };
    syncEditing(vm);
  }

  function syncEditing(vm: CorrectionFormViewModel): void {
    if (!shell) return;
    const locked = vm.state === "saving" || vm.state === "stale_context";
    root.setAttribute("aria-busy", vm.busy ? "true" : "false");

    syncTextControl(shell.descInput, vm.fields.problem_description);
    syncTextControl(shell.propInput, vm.fields.proposed_value);
    syncTextControl(shell.otherFieldInput, vm.fields.other_field_label);

    shell.issueSelect.disabled = locked;
    shell.targetSelect.disabled = locked;
    shell.otherFieldInput.disabled = locked;
    shell.descInput.disabled = locked;
    shell.propInput.disabled = locked;
    shell.modeFieldset.disabled = locked;

    shell.issueSelect.value = vm.fields.issue_type;
    syncTargetOptions(vm);

    shell.modeProblem.checked = vm.fields.mode === "problem_report";
    shell.modeProposed.checked = vm.fields.mode === "proposed_correction";

    shell.propField.hidden = vm.fields.mode !== "proposed_correction";
    shell.otherField.hidden = vm.fields.target_key !== "other_field";

    setCounter(
      shell.descCounter,
      vm.descriptionCount,
      CORRECTION_PROBLEM_DESCRIPTION_MAX_CHARS,
    );
    setCounter(shell.propCounter, vm.proposedCount, CORRECTION_PROPOSED_VALUE_MAX_CHARS);
    setCounter(
      shell.otherFieldCounter,
      vm.fieldLabelCount,
      CORRECTION_OTHER_FIELD_LABEL_MAX_CHARS,
    );

    syncFieldError(
      shell.issueSelect,
      shell.issueError,
      fieldErrorMessage("issue_type", vm.errors.issue_type),
      "correction-form-issue-error",
    );
    syncFieldError(
      shell.targetSelect,
      shell.targetError,
      fieldErrorMessage("target", vm.errors.target),
      "correction-form-target-error",
    );
    syncFieldError(
      shell.otherFieldInput,
      shell.otherFieldError,
      fieldErrorMessage("field_label", vm.errors.field_label),
      "correction-form-field-label-error",
      FIELD_LABEL_DESCRIBED_BY,
    );
    syncFieldError(
      shell.descInput,
      shell.descError,
      fieldErrorMessage("problem_description", vm.errors.problem_description),
      "correction-form-description-error",
      DESC_DESCRIBED_BY,
    );
    syncFieldError(
      shell.propInput,
      shell.propError,
      fieldErrorMessage("proposed_value", vm.errors.proposed_value),
      "correction-form-proposed-error",
      PROP_DESCRIBED_BY,
    );

    shell.staleHost.replaceChildren();
    if (vm.state === "stale_context") {
      const stale = el("div", "correction-form-stale");
      stale.setAttribute("role", "alert");
      stale.id = "correction-form-stale";
      stale.textContent = t("correctionFeedback.form.error.staleContext");
      shell.staleHost.appendChild(stale);
    }

    const hadErrorSummary = Boolean(
      shell.errorHost.querySelector("#correction-form-error-summary"),
    );
    shell.errorHost.replaceChildren();
    if (vm.state === "invalid" || vm.state === "error") {
      const summary = buildErrorSummary(vm);
      shell.errorHost.appendChild(summary);
      // Focus only when the summary newly appears (not on each field keystroke).
      if (!hadErrorSummary) {
        summary.focus();
      }
    }

    shell.saveBtn.textContent =
      vm.state === "saving"
        ? t("correctionFeedback.form.saving")
        : t("correctionFeedback.form.save");
    shell.saveBtn.disabled = vm.saveDisabled;
    shell.cancelBtn.disabled = vm.state === "saving";
  }

  function apply(vm: CorrectionFormViewModel): void {
    if (vm.state === "saved") {
      paintSuccess(vm);
      return;
    }
    if (
      layout !== "editing" ||
      !shell ||
      !root.contains(shell.descInput) ||
      !root.contains(shell.propInput) ||
      !root.contains(shell.otherFieldInput)
    ) {
      buildEditing(vm);
      return;
    }
    syncEditing(vm);
  }

  apply(initialVm);

  return {
    root,
    update: (vm) => {
      apply(vm);
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
