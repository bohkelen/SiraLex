/**
 * CF1I4 / CF2I6A — Pure pending-corrections management renderer.
 * No IndexedDB, timestamps, ID generation, or dictionary resolution.
 */

import { t, type TranslationKey } from "../i18n";
import { CORRECTION_FORM_ISSUE_TYPES } from "../corrections/correction_form_model";
import type {
  CorrectionAvailabilityState,
  CorrectionManagementErrorCode,
  CorrectionManagementVm,
} from "../corrections/correction_management_session";
import type { CorrectionIssueType, CorrectionMode, CorrectionTarget } from "../corrections/correction_draft_types";
import {
  CORRECTION_OTHER_FIELD_LABEL_MAX_CHARS,
  CORRECTION_PROBLEM_DESCRIPTION_MAX_CHARS,
  CORRECTION_PROPOSED_VALUE_MAX_CHARS,
  countUnicodeCharacters,
} from "../corrections/correction_draft_types";
import { formatCorrectionTargetOptionLabel } from "./render_correction_form";

export type CorrectionManagementRendererCallbacks = {
  onOpenDetail: (draftId: string) => void;
  onBackToList: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onIssueTypeChange: (value: CorrectionIssueType | "") => void;
  onModeChange: (mode: CorrectionMode) => void;
  onTargetChange: (key: string) => void;
  onProblemDescriptionChange: (value: string) => void;
  onProposedValueChange: (value: string) => void;
  onOtherFieldLabelChange: (value: string) => void;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
  onExport: () => void;
  onAcknowledgeExport: () => void;
  onRequestSendForReview: () => void;
  onCancelSendForReview: () => void;
  onConfirmSendForReview: () => void;
  onAcknowledgeHandoff: () => void;
  onBack: () => void;
};

const ISSUE_KEYS: Record<CorrectionIssueType, TranslationKey> = {
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

const AVAIL_KEYS: Record<CorrectionAvailabilityState, TranslationKey> = {
  matching_live_content: "correctionFeedback.manage.availability.matching",
  dictionary_unavailable: "correctionFeedback.manage.availability.dictionaryUnavailable",
  entry_unavailable: "correctionFeedback.manage.availability.entryUnavailable",
  dictionary_content_differs: "correctionFeedback.manage.availability.contentDiffers",
};

const ERROR_KEYS: Partial<Record<CorrectionManagementErrorCode, TranslationKey>> = {
  invalid_stored_draft: "correctionFeedback.manage.error.invalidStored",
  database_read_failed: "correctionFeedback.manage.error.readFailed",
  database_write_failed: "correctionFeedback.manage.error.writeFailed",
  stale_draft: "correctionFeedback.manage.error.staleEdit",
  not_found: "correctionFeedback.manage.error.notFound",
  invalid_fields: "correctionFeedback.manage.error.invalidFields",
  invalid_timestamp: "correctionFeedback.manage.error.invalidTimestamp",
  export_failed: "correctionFeedback.manage.error.exportFailed",
  no_correction_drafts: "correctionFeedback.manage.error.exportEmpty",
  invalid_local_draft: "correctionFeedback.manage.error.exportInvalid",
  duplicate_draft_id: "correctionFeedback.manage.error.exportDuplicate",
  generated_package_too_large: "correctionFeedback.manage.error.exportTooLarge",
  generated_package_invalid: "correctionFeedback.manage.error.exportInvalidPackage",
  send_failed: "correctionFeedback.manage.error.sendFailed",
  send_unavailable: "correctionFeedback.manage.send.unavailable",
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

/** Render copy that includes a configured email as a mailto link (address from config, not translations). */
function appendTextWithEmailLink(
  parent: HTMLElement,
  text: string,
  email: string,
  className?: string,
): void {
  const p = el("p", className);
  if (!email) {
    p.textContent = text;
    parent.appendChild(p);
    return;
  }
  const idx = text.indexOf(email);
  if (idx < 0) {
    p.textContent = text;
    parent.appendChild(p);
    return;
  }
  if (idx > 0) p.append(text.slice(0, idx));
  const link = document.createElement("a");
  link.href = `mailto:${email}`;
  link.textContent = email;
  link.rel = "noopener";
  link.className = "feedback-handoff-email";
  p.append(link);
  if (idx + email.length < text.length) p.append(text.slice(idx + email.length));
  parent.appendChild(p);
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
}

/** Management/list target label (includes historical RU identification). */
export function formatCorrectionManagementTargetLabel(target: CorrectionTarget): string {
  switch (target.type) {
    case "entry":
      return t("correctionFeedback.form.target.entry");
    case "headword":
      return t("correctionFeedback.manage.target.headwordOnly");
    case "part_of_speech":
      return t("correctionFeedback.manage.target.posOnly");
    case "nko":
      return t("correctionFeedback.manage.target.nkoOnly");
    case "sense":
      return t("correctionFeedback.form.target.sense", { n: target.sense_index + 1 });
    case "translation":
      if (target.gloss_lang === "fr") {
        return t("correctionFeedback.manage.target.translationFrOnly", {
          n: target.sense_index + 1,
        });
      }
      if (target.gloss_lang === "en") {
        return t("correctionFeedback.manage.target.translationEnOnly", {
          n: target.sense_index + 1,
        });
      }
      return t("correctionFeedback.manage.target.translationRuOnly", {
        n: target.sense_index + 1,
      });
    case "example":
      return t("correctionFeedback.form.target.example", {
        sense: target.sense_index + 1,
        example: target.example_index + 1,
        text: "…",
      });
    case "usage_note":
      return t("correctionFeedback.form.target.usage_note", { n: target.sense_index + 1 });
    case "other_field":
      return t("correctionFeedback.manage.target.otherWithLabel", {
        label: target.field_label,
      });
  }
}

function simplifyTargetLabel(target: CorrectionTarget): string {
  return formatCorrectionManagementTargetLabel(target);
}

export type CorrectionManagementView = {
  root: HTMLElement;
  update: (vm: CorrectionManagementVm) => void;
};

type StableEdit = {
  draftId: string;
  issueSelect: HTMLSelectElement;
  targetSelect: HTMLSelectElement | null;
  otherField: HTMLElement | null;
  otherFieldInput: HTMLInputElement | null;
  otherFieldCounter: HTMLElement | null;
  modeFieldset: HTMLFieldSetElement;
  modeProblem: HTMLInputElement;
  modeProposed: HTMLInputElement;
  descInput: HTMLTextAreaElement;
  descCounter: HTMLElement;
  propField: HTMLElement;
  propInput: HTMLTextAreaElement;
  propCounter: HTMLElement;
  saveBtn: HTMLButtonElement;
  cancelBtn: HTMLButtonElement;
};

export function renderCorrectionManagement(
  initial: CorrectionManagementVm,
  callbacks: CorrectionManagementRendererCallbacks,
): CorrectionManagementView {
  const root = el("div", "correction-manage ux2-correction-manage");
  root.setAttribute("data-testid", "correction-manage");

  let stableEdit: StableEdit | null = null;

  function paint(vm: CorrectionManagementVm): void {
    stableEdit = null;
    root.replaceChildren();
    root.setAttribute("aria-busy", vm.busy ? "true" : "false");

    const back = document.createElement("button");
    back.type = "button";
    back.className = "btn correction-manage-back ux2-correction-back";
    back.textContent = t("correctionFeedback.manage.back");
    back.addEventListener("click", () => callbacks.onBack());
    root.appendChild(back);

    const heading = el(
      "h2",
      "correction-manage-heading ux2-type-page-title",
      t("correctionFeedback.manage.heading"),
    );
    heading.id = "correction-manage-heading";
    heading.tabIndex = -1;
    root.appendChild(heading);

    const status = el("div", "correction-manage-status");
    status.id = "correction-manage-status";
    status.tabIndex = -1;
    status.setAttribute("role", "status");
    root.appendChild(status);

    if (vm.errorCode && ERROR_KEYS[vm.errorCode]) {
      status.textContent = t(ERROR_KEYS[vm.errorCode]!);
    } else if (vm.phase === "loading") {
      status.textContent = t("correctionFeedback.manage.loading");
    } else if (vm.phase === "empty") {
      status.textContent = t("correctionFeedback.manage.empty");
    } else if (vm.phase === "exporting") {
      status.textContent = t("correctionFeedback.manage.export.progress");
    } else if (vm.phase === "exported") {
      status.textContent = t("correctionFeedback.manage.export.success", {
        filename: vm.exportFilename ?? "",
        count: vm.exportDraftCount ?? 0,
      });
    } else if (vm.phase === "handoff_preparing") {
      status.textContent = t("correctionFeedback.manage.send.progress");
    } else if (vm.phase === "handoff_prepared") {
      status.textContent =
        vm.handoffMethod === "download_mailto"
          ? t("correctionFeedback.manage.send.successFallback", {
              email: vm.reviewEmail ?? "",
            })
          : t("correctionFeedback.manage.send.successShare");
    } else if (vm.phase === "confirm_handoff") {
      status.textContent = t("correctionFeedback.manage.send.confirmHeading");
    }

    if (
      vm.phase === "list" ||
      vm.phase === "empty" ||
      vm.phase === "exported" ||
      vm.phase === "exporting" ||
      vm.phase === "handoff_preparing" ||
      vm.phase === "handoff_prepared" ||
      vm.phase === "confirm_handoff"
    ) {
      paintListChrome(vm);
    }
    if (vm.phase === "list") {
      paintList(vm);
    }
    if (vm.phase === "detail" || vm.phase === "confirm_delete") {
      paintDetail(vm);
    }
    if (vm.phase === "editing") {
      paintEdit(vm);
    }
    if (vm.phase === "confirm_delete") {
      paintDeleteConfirm();
    }
    if (vm.phase === "confirm_handoff") {
      paintHandoffConfirm(vm);
    }
    if (vm.phase === "exported") {
      const ack = document.createElement("button");
      ack.type = "button";
      ack.className = "btn";
      ack.textContent = t("correctionFeedback.manage.export.acknowledge");
      ack.addEventListener("click", () => callbacks.onAcknowledgeExport());
      root.appendChild(ack);
    }
    if (vm.phase === "handoff_prepared") {
      const ack = document.createElement("button");
      ack.type = "button";
      ack.className = "btn";
      ack.id = "correction-manage-handoff-acknowledge";
      ack.textContent = t("correctionFeedback.manage.send.acknowledge");
      ack.addEventListener("click", () => callbacks.onAcknowledgeHandoff());
      root.appendChild(ack);
    }

    applyFocus(vm);
  }

  function paintListChrome(vm: CorrectionManagementVm): void {
    const warning = el("p", "correction-manage-export-warning", t("correctionFeedback.manage.export.authority"));
    root.appendChild(warning);
    const actions = el("div", "row correction-manage-transport-actions");
    const exportBtn = document.createElement("button");
    exportBtn.type = "button";
    exportBtn.className = "btn correction-manage-export ux2-correction-secondary-btn";
    exportBtn.id = "correction-manage-export";
    exportBtn.textContent = t("correctionFeedback.manage.export.button");
    exportBtn.disabled =
      vm.busy ||
      vm.draftCount === 0 ||
      vm.phase === "exporting" ||
      vm.phase === "handoff_preparing" ||
      vm.phase === "confirm_handoff";
    exportBtn.addEventListener("click", () => callbacks.onExport());
    actions.appendChild(exportBtn);

    const sendBtn = document.createElement("button");
    sendBtn.type = "button";
    sendBtn.className = "btn correction-manage-send ux2-correction-primary-btn";
    sendBtn.id = "correction-manage-send";
    sendBtn.textContent = t("correctionFeedback.manage.send.button");
    sendBtn.disabled =
      !vm.sendForReviewAvailable ||
      vm.busy ||
      vm.draftCount === 0 ||
      vm.phase === "exporting" ||
      vm.phase === "handoff_preparing" ||
      vm.phase === "confirm_handoff";
    sendBtn.addEventListener("click", () => callbacks.onRequestSendForReview());
    actions.appendChild(sendBtn);
    root.appendChild(actions);

    if (!vm.sendForReviewAvailable) {
      root.appendChild(
        el("p", "correction-manage-send-unavailable", t("correctionFeedback.manage.send.unavailable")),
      );
    }
  }

  function paintHandoffConfirm(vm: CorrectionManagementVm): void {
    const box = el("div", "correction-manage-delete-confirm ux2-correction-handoff-confirm");
    box.id = "correction-manage-handoff-confirm";
    const email = vm.reviewEmail ?? "";
    box.appendChild(
      el("h3", "correction-manage-handoff-heading", t("correctionFeedback.manage.send.confirmHeading")),
    );
    box.appendChild(el("p", undefined, t("correctionFeedback.manage.send.privacy")));
    appendTextWithEmailLink(
      box,
      t("correctionFeedback.manage.send.destination", { email }),
      email,
      "correction-manage-handoff-destination",
    );
    box.appendChild(
      el("p", undefined, t("correctionFeedback.manage.send.destinationHint")),
    );
    const row = el("div", "row ux2-correction-actions");
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "btn ux2-correction-secondary-btn";
    cancel.id = "correction-manage-handoff-cancel";
    cancel.textContent = t("correctionFeedback.manage.send.cancel");
    cancel.addEventListener("click", () => callbacks.onCancelSendForReview());
    const cont = document.createElement("button");
    cont.type = "button";
    cont.className = "btn ux2-correction-primary-btn";
    cont.id = "correction-manage-handoff-continue";
    cont.textContent = t("correctionFeedback.manage.send.continue");
    cont.addEventListener("click", () => callbacks.onConfirmSendForReview());
    row.appendChild(cancel);
    row.appendChild(cont);
    box.appendChild(row);
    root.appendChild(box);
  }

  function paintList(vm: CorrectionManagementVm): void {
    const list = el("ul", "correction-manage-list");
    list.id = "correction-manage-list";
    list.setAttribute("role", "list");
    list.tabIndex = -1;
    for (const item of vm.items) {
      const li = el("li", "correction-manage-row");
      li.setAttribute("role", "listitem");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "correction-manage-row-button";
      btn.appendChild(el("span", "correction-manage-row-headword", item.headword));
      btn.appendChild(
        el("span", "correction-manage-row-meta", `${t(ISSUE_KEYS[item.issue_type])} · ${simplifyTargetLabel(item.target)}`),
      );
      btn.appendChild(el("span", "correction-manage-row-updated", item.updated_at));
      const avail = el("span", "correction-manage-availability", t(AVAIL_KEYS[item.availability]));
      avail.dataset.state = item.availability;
      btn.appendChild(avail);
      // Never expose hash/scope in primary row.
      btn.addEventListener("click", () => callbacks.onOpenDetail(item.draft_id));
      li.appendChild(btn);
      list.appendChild(li);
    }
    root.appendChild(list);
  }

  function paintDetail(vm: CorrectionManagementVm): void {
    if (!vm.selected) return;
    const d = vm.selected;
    const backList = document.createElement("button");
    backList.type = "button";
    backList.className = "btn";
    backList.textContent = t("correctionFeedback.manage.backToList");
    backList.addEventListener("click", () => callbacks.onBackToList());
    root.appendChild(backList);

    root.appendChild(el("p", "correction-manage-detail-headword", d.display_snapshot.headword_latin));
    if (d.display_snapshot.headword_nko) {
      const nko = el("p", "correction-manage-detail-nko", d.display_snapshot.headword_nko);
      nko.setAttribute("lang", "nqo");
      nko.dir = "rtl";
      root.appendChild(nko);
    }
    if (vm.availability) {
      const avail = el("p", "correction-manage-availability", t(AVAIL_KEYS[vm.availability]));
      avail.dataset.state = vm.availability;
      root.appendChild(avail);
    }
    root.appendChild(el("p", undefined, `${t("correctionFeedback.form.issueLabel")}: ${t(ISSUE_KEYS[d.issue_type])}`));
    root.appendChild(
      el(
        "p",
        undefined,
        `${t("correctionFeedback.form.modeLabel")}: ${
          d.mode === "problem_report"
            ? t("correctionFeedback.form.mode.problem_report")
            : t("correctionFeedback.form.mode.proposed_correction")
        }`,
      ),
    );
    root.appendChild(el("p", undefined, `${t("correctionFeedback.form.targetLabel")}: ${simplifyTargetLabel(d.target)}`));
    root.appendChild(el("p", "correction-manage-description", d.problem_description));
    if (d.proposed_value !== undefined) {
      root.appendChild(el("p", "correction-manage-proposed", d.proposed_value));
    }
    root.appendChild(
      el("p", "correction-manage-timestamps", `${d.created_at} → ${d.updated_at}`),
    );

    const tech = el("details", "correction-manage-provenance");
    tech.appendChild(el("summary", undefined, t("correctionFeedback.manage.provenance.toggle")));
    tech.appendChild(el("p", "mono", `bundle_id: ${d.bundle_id}`));
    tech.appendChild(el("p", "mono", `ir_id: ${d.ir_id}`));
    tech.appendChild(el("p", "mono", `content_sha256: ${d.content_sha256}`));
    tech.appendChild(el("p", "mono", `storage_scope_id: ${d.storage_scope_id}`));
    root.appendChild(tech);

    const actions = el("div", "correction-manage-actions ux2-correction-actions");
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "btn ux2-correction-primary-btn";
    edit.textContent = t("correctionFeedback.manage.edit");
    edit.disabled = vm.busy;
    edit.addEventListener("click", () => callbacks.onStartEdit());
    const del = document.createElement("button");
    del.type = "button";
    del.className = "btn ux2-correction-secondary-btn";
    del.textContent = t("correctionFeedback.manage.delete");
    del.disabled = vm.busy;
    del.addEventListener("click", () => callbacks.onRequestDelete());
    actions.appendChild(edit);
    actions.appendChild(del);
    root.appendChild(actions);
  }

  function paintEdit(vm: CorrectionManagementVm): void {
    if (!vm.selected || !vm.editFields) return;
    const fields = vm.editFields;
    if (vm.errorCode === "stale_draft" || vm.errorCode === "invalid_fields") {
      const summary = el("div", "correction-manage-error-summary");
      summary.id = "correction-manage-error-summary";
      summary.setAttribute("role", "alert");
      summary.tabIndex = -1;
      summary.textContent = t(ERROR_KEYS[vm.errorCode] ?? "correctionFeedback.manage.error.invalidFields");
      root.appendChild(summary);
    }

    // Issue
    const issueField = el("div", "field");
    const issueLabel = el("label", "label", t("correctionFeedback.form.issueLabel"));
    issueLabel.htmlFor = "correction-manage-issue";
    const issueSelect = document.createElement("select");
    issueSelect.id = "correction-manage-issue";
    issueSelect.disabled = vm.busy;
    for (const issue of CORRECTION_FORM_ISSUE_TYPES) {
      const opt = document.createElement("option");
      opt.value = issue;
      opt.textContent = t(ISSUE_KEYS[issue]);
      if (fields.issue_type === issue) opt.selected = true;
      issueSelect.appendChild(opt);
    }
    issueSelect.addEventListener("change", () => {
      callbacks.onIssueTypeChange(issueSelect.value as CorrectionIssueType);
    });
    issueField.appendChild(issueLabel);
    issueField.appendChild(issueSelect);
    root.appendChild(issueField);

    let targetSelect: HTMLSelectElement | null = null;
    let otherField: HTMLElement | null = null;
    let otherFieldInput: HTMLInputElement | null = null;
    let otherFieldCounter: HTMLElement | null = null;

    if (vm.editRetargetAllowed && vm.editTargetOptions) {
      const targetField = el("div", "field");
      const targetLabel = el("label", "label", t("correctionFeedback.form.targetLabel"));
      targetLabel.htmlFor = "correction-manage-target";
      targetSelect = document.createElement("select");
      targetSelect.id = "correction-manage-target";
      targetSelect.disabled = vm.busy;
      for (const option of vm.editTargetOptions) {
        const opt = document.createElement("option");
        opt.value = option.key;
        opt.textContent = formatCorrectionTargetOptionLabel(option.label);
        if (fields.target_key === option.key) opt.selected = true;
        targetSelect.appendChild(opt);
      }
      targetSelect.addEventListener("change", () => callbacks.onTargetChange(targetSelect!.value));
      targetField.appendChild(targetLabel);
      targetField.appendChild(targetSelect);
      root.appendChild(targetField);

      // Always create other-field input; toggle visibility during incremental sync.
      otherField = el("div", "field");
      otherField.hidden = fields.target_key !== "other_field";
      const lab = el("label", "label", t("correctionFeedback.form.otherFieldLabel"));
      lab.htmlFor = "correction-manage-field-label";
      otherFieldInput = document.createElement("input");
      otherFieldInput.type = "text";
      otherFieldInput.id = "correction-manage-field-label";
      otherFieldInput.value = fields.other_field_label;
      otherFieldInput.disabled = vm.busy;
      otherFieldInput.addEventListener("input", () =>
        callbacks.onOtherFieldLabelChange(otherFieldInput!.value),
      );
      otherFieldCounter = el("p", "correction-form-counter");
      setCounter(
        otherFieldCounter,
        countUnicodeCharacters(fields.other_field_label),
        CORRECTION_OTHER_FIELD_LABEL_MAX_CHARS,
      );
      otherField.appendChild(lab);
      otherField.appendChild(otherFieldInput);
      otherField.appendChild(otherFieldCounter);
      root.appendChild(otherField);
    } else {
      root.appendChild(
        el(
          "p",
          undefined,
          `${t("correctionFeedback.form.targetLabel")}: ${simplifyTargetLabel(vm.selected.target)}`,
        ),
      );
      root.appendChild(el("p", "correction-manage-help", t("correctionFeedback.manage.edit.noRetarget")));
    }

    const modeFieldset = el("fieldset", "correction-form-mode");
    modeFieldset.disabled = vm.busy;
    modeFieldset.appendChild(el("legend", undefined, t("correctionFeedback.form.modeLabel")));
    let modeProblem!: HTMLInputElement;
    let modeProposed!: HTMLInputElement;
    for (const mode of ["problem_report", "proposed_correction"] as const) {
      const wrap = el("label", "correction-form-mode-option");
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "correction-manage-mode";
      input.value = mode;
      input.checked = fields.mode === mode;
      input.addEventListener("change", () => {
        if (input.checked) callbacks.onModeChange(mode);
      });
      if (mode === "problem_report") modeProblem = input;
      else modeProposed = input;
      wrap.appendChild(input);
      wrap.appendChild(
        document.createTextNode(
          ` ${
            mode === "problem_report"
              ? t("correctionFeedback.form.mode.problem_report")
              : t("correctionFeedback.form.mode.proposed_correction")
          }`,
        ),
      );
      modeFieldset.appendChild(wrap);
    }
    root.appendChild(modeFieldset);

    const descField = el("div", "field");
    const descLabel = el("label", "label", t("correctionFeedback.form.descriptionLabel"));
    descLabel.htmlFor = "correction-manage-description";
    const desc = document.createElement("textarea");
    desc.id = "correction-manage-description";
    desc.rows = 4;
    desc.value = fields.problem_description;
    desc.disabled = vm.busy;
    desc.addEventListener("input", () => callbacks.onProblemDescriptionChange(desc.value));
    const descCounter = el("p", "correction-form-counter");
    setCounter(
      descCounter,
      countUnicodeCharacters(fields.problem_description),
      CORRECTION_PROBLEM_DESCRIPTION_MAX_CHARS,
    );
    descField.appendChild(descLabel);
    descField.appendChild(desc);
    descField.appendChild(descCounter);
    root.appendChild(descField);

    // Always create proposed field; toggle visibility during incremental sync.
    const propField = el("div", "field");
    propField.hidden = fields.mode !== "proposed_correction";
    const propLabel = el("label", "label", t("correctionFeedback.form.proposedLabel"));
    propLabel.htmlFor = "correction-manage-proposed";
    const prop = document.createElement("textarea");
    prop.id = "correction-manage-proposed";
    prop.rows = 3;
    prop.value = fields.proposed_value;
    prop.disabled = vm.busy;
    prop.addEventListener("input", () => callbacks.onProposedValueChange(prop.value));
    const propCounter = el("p", "correction-form-counter");
    setCounter(
      propCounter,
      countUnicodeCharacters(fields.proposed_value),
      CORRECTION_PROPOSED_VALUE_MAX_CHARS,
    );
    propField.appendChild(propLabel);
    propField.appendChild(prop);
    propField.appendChild(propCounter);
    root.appendChild(propField);

    const actions = el("div", "correction-manage-actions");
    const save = document.createElement("button");
    save.type = "button";
    save.className = "btn";
    save.textContent = t("correctionFeedback.manage.saveEdit");
    save.disabled = vm.busy;
    save.addEventListener("click", () => callbacks.onSaveEdit());
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "btn";
    cancel.textContent = t("correctionFeedback.manage.cancel");
    cancel.disabled = vm.busy;
    cancel.addEventListener("click", () => callbacks.onCancelEdit());
    actions.appendChild(save);
    actions.appendChild(cancel);
    root.appendChild(actions);

    stableEdit = {
      draftId: vm.selected.draft_id,
      issueSelect,
      targetSelect,
      otherField,
      otherFieldInput,
      otherFieldCounter,
      modeFieldset,
      modeProblem,
      modeProposed,
      descInput: desc,
      descCounter,
      propField,
      propInput: prop,
      propCounter,
      saveBtn: save,
      cancelBtn: cancel,
    };
  }

  function syncStableEdit(vm: CorrectionManagementVm): void {
    if (!stableEdit || !vm.editFields) return;
    const fields = vm.editFields;
    root.setAttribute("aria-busy", vm.busy ? "true" : "false");

    const status = root.querySelector<HTMLElement>("#correction-manage-status");
    if (status) {
      status.textContent =
        vm.errorCode && ERROR_KEYS[vm.errorCode] ? t(ERROR_KEYS[vm.errorCode]!) : "";
    }

    let errorSummary = root.querySelector<HTMLElement>("#correction-manage-error-summary");
    if (vm.errorCode === "stale_draft" || vm.errorCode === "invalid_fields") {
      if (!errorSummary) {
        errorSummary = el("div", "correction-manage-error-summary");
        errorSummary.id = "correction-manage-error-summary";
        errorSummary.setAttribute("role", "alert");
        errorSummary.tabIndex = -1;
        const insertBefore = stableEdit.issueSelect.closest(".field");
        if (insertBefore) root.insertBefore(errorSummary, insertBefore);
        else root.appendChild(errorSummary);
      }
      errorSummary.textContent = t(
        ERROR_KEYS[vm.errorCode] ?? "correctionFeedback.manage.error.invalidFields",
      );
    } else if (errorSummary) {
      errorSummary.remove();
    }

    syncTextControl(stableEdit.descInput, fields.problem_description);
    syncTextControl(stableEdit.propInput, fields.proposed_value);
    if (stableEdit.otherFieldInput) {
      syncTextControl(stableEdit.otherFieldInput, fields.other_field_label);
    }

    stableEdit.issueSelect.disabled = vm.busy;
    if (stableEdit.issueSelect.value !== fields.issue_type) {
      stableEdit.issueSelect.value = fields.issue_type;
    }
    if (stableEdit.targetSelect) {
      stableEdit.targetSelect.disabled = vm.busy;
      if (stableEdit.targetSelect.value !== fields.target_key) {
        stableEdit.targetSelect.value = fields.target_key;
      }
    }
    if (stableEdit.otherFieldInput) {
      stableEdit.otherFieldInput.disabled = vm.busy;
    }
    if (stableEdit.otherField) {
      stableEdit.otherField.hidden = fields.target_key !== "other_field";
    }
    stableEdit.descInput.disabled = vm.busy;
    stableEdit.propInput.disabled = vm.busy;
    stableEdit.modeFieldset.disabled = vm.busy;

    stableEdit.modeProblem.checked = fields.mode === "problem_report";
    stableEdit.modeProposed.checked = fields.mode === "proposed_correction";
    stableEdit.propField.hidden = fields.mode !== "proposed_correction";

    setCounter(
      stableEdit.descCounter,
      countUnicodeCharacters(fields.problem_description),
      CORRECTION_PROBLEM_DESCRIPTION_MAX_CHARS,
    );
    setCounter(
      stableEdit.propCounter,
      countUnicodeCharacters(fields.proposed_value),
      CORRECTION_PROPOSED_VALUE_MAX_CHARS,
    );
    if (stableEdit.otherFieldCounter) {
      setCounter(
        stableEdit.otherFieldCounter,
        countUnicodeCharacters(fields.other_field_label),
        CORRECTION_OTHER_FIELD_LABEL_MAX_CHARS,
      );
    }

    stableEdit.saveBtn.textContent = t("correctionFeedback.manage.saveEdit");
    stableEdit.saveBtn.disabled = vm.busy;
    stableEdit.cancelBtn.disabled = vm.busy;

    // Do not re-apply heading/list focus on keystroke sync — that steals the
    // caret from text controls (same invariant as CF2 manage incremental sync).
    // Only move focus for in-edit error surfacing after a failed save.
    if (vm.focusTarget === "error_summary" || vm.focusTarget === "status") {
      applyFocus(vm);
    }
  }

  function paintDeleteConfirm(): void {
    const dialog = el("div", "correction-manage-delete-confirm");
    dialog.id = "correction-manage-delete-confirm";
    dialog.tabIndex = -1;
    dialog.setAttribute("role", "alertdialog");
    dialog.setAttribute("aria-labelledby", "correction-manage-delete-title");
    const title = el("h3", undefined, t("correctionFeedback.manage.deleteConfirmTitle"));
    title.id = "correction-manage-delete-title";
    dialog.appendChild(title);
    dialog.appendChild(el("p", undefined, t("correctionFeedback.manage.deleteConfirmBody")));
    const actions = el("div", "correction-manage-actions");
    const confirm = document.createElement("button");
    confirm.type = "button";
    confirm.className = "btn";
    confirm.textContent = t("correctionFeedback.manage.deleteConfirmAction");
    confirm.addEventListener("click", () => callbacks.onConfirmDelete());
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "btn";
    cancel.textContent = t("correctionFeedback.manage.cancel");
    cancel.addEventListener("click", () => callbacks.onCancelDelete());
    actions.appendChild(confirm);
    actions.appendChild(cancel);
    dialog.appendChild(actions);
    root.appendChild(dialog);
  }

  function applyFocus(vm: CorrectionManagementVm): void {
    queueMicrotask(() => {
      if (vm.focusTarget === "heading") {
        root.querySelector<HTMLElement>("#correction-manage-heading")?.focus();
      } else if (vm.focusTarget === "status") {
        root.querySelector<HTMLElement>("#correction-manage-status")?.focus();
      } else if (vm.focusTarget === "error_summary") {
        root.querySelector<HTMLElement>("#correction-manage-error-summary")?.focus();
      } else if (vm.focusTarget === "delete_confirm") {
        root.querySelector<HTMLElement>("#correction-manage-delete-confirm")?.focus();
      } else if (vm.focusTarget === "list") {
        root.querySelector<HTMLElement>(".correction-manage-list")?.focus();
      }
    });
  }

  function apply(vm: CorrectionManagementVm): void {
    if (
      vm.phase === "editing" &&
      stableEdit &&
      vm.selected?.draft_id === stableEdit.draftId &&
      root.contains(stableEdit.descInput) &&
      root.contains(stableEdit.propInput)
    ) {
      syncStableEdit(vm);
      return;
    }
    paint(vm);
  }

  apply(initial);

  return {
    root,
    update(vm: CorrectionManagementVm) {
      apply(vm);
    },
  };
}
