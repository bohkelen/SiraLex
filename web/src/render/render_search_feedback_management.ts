/**
 * CF2I4 — Pure search-feedback management renderer.
 * No IndexedDB, timestamps, ID generation, or dictionary resolution.
 */

import { t, type TranslationKey } from "../i18n";
import {
  SEARCH_FEEDBACK_REQUESTED_MEANING_MAX_CHARS,
  SEARCH_FEEDBACK_USER_DESCRIPTION_MAX_CHARS,
} from "../search_feedback/search_feedback_types";
import type {
  SearchFeedbackAvailabilityState,
  SearchFeedbackManagementErrorCode,
  SearchFeedbackManagementVm,
} from "../search_feedback/search_feedback_management_session";

export type SearchFeedbackManagementRendererCallbacks = {
  onOpenDetail: (feedbackId: string) => void;
  onBackToList: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onRequestedMeaningChange: (value: string) => void;
  onUserDescriptionChange: (value: string) => void;
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

const AVAIL_KEYS: Record<SearchFeedbackAvailabilityState, TranslationKey> = {
  dictionary_current: "searchFeedback.manage.availability.current",
  dictionary_content_differs: "searchFeedback.manage.availability.contentDiffers",
  dictionary_unavailable: "searchFeedback.manage.availability.unavailable",
};

const ERROR_KEYS: Partial<Record<SearchFeedbackManagementErrorCode, TranslationKey>> = {
  invalid_stored_feedback: "searchFeedback.manage.error.invalidStored",
  database_read_failed: "searchFeedback.manage.error.readFailed",
  database_write_failed: "searchFeedback.manage.error.writeFailed",
  stale_edit: "searchFeedback.manage.error.staleEdit",
  stale_delete: "searchFeedback.manage.error.staleDelete",
  not_found: "searchFeedback.manage.error.notFound",
  invalid_fields: "searchFeedback.manage.error.invalidFields",
  invalid_timestamp: "searchFeedback.manage.error.invalidTimestamp",
  export_failed: "searchFeedback.manage.error.exportFailed",
  no_search_feedback: "searchFeedback.manage.error.exportEmpty",
  invalid_local_feedback: "searchFeedback.manage.error.exportInvalid",
  duplicate_feedback_id: "searchFeedback.manage.error.exportDuplicate",
  generated_package_too_large: "searchFeedback.manage.error.exportTooLarge",
  generated_package_invalid: "searchFeedback.manage.error.exportInvalidPackage",
  send_failed: "searchFeedback.manage.error.sendFailed",
  send_unavailable: "searchFeedback.manage.send.unavailable",
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

function looksLikeNko(text: string): boolean {
  return /[\u07C0-\u07FF]/.test(text);
}

function applyNkoAttrs(node: HTMLElement, text: string): void {
  if (looksLikeNko(text)) {
    node.setAttribute("lang", "nqo");
    node.dir = "rtl";
  }
}

function resultStateLabel(
  state: SearchFeedbackManagementVm["items"][number]["result_state"],
): string {
  return state === "no_result"
    ? t("searchFeedback.manage.resultState.noResult")
    : t("searchFeedback.manage.resultState.resultsNotUseful");
}

function directionLabel(
  direction: SearchFeedbackManagementVm["items"][number]["search_direction"],
): string {
  return direction === "source_to_target"
    ? t("searchFeedback.manage.direction.sourceToTarget")
    : t("searchFeedback.manage.direction.targetToSource");
}

function formatUpdated(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(ms));
  } catch {
    return iso;
  }
}

function focusById(root: HTMLElement, id: string): void {
  queueMicrotask(() => {
    root.querySelector<HTMLElement>(`#${id}`)?.focus();
  });
}

export type SearchFeedbackManagementView = {
  root: HTMLElement;
  update: (vm: SearchFeedbackManagementVm) => void;
};

export function renderSearchFeedbackManagement(
  initial: SearchFeedbackManagementVm,
  callbacks: SearchFeedbackManagementRendererCallbacks,
): SearchFeedbackManagementView {
  const root = el("div", "search-feedback-manage");
  root.setAttribute("data-testid", "search-feedback-manage");

  type StableEdit = {
    feedbackId: string;
    meaningInput: HTMLTextAreaElement;
    detailsInput: HTMLTextAreaElement;
    meaningCounter: HTMLElement;
    detailsCounter: HTMLElement;
    saveBtn: HTMLButtonElement;
    cancelBtn: HTMLButtonElement;
  };
  let stableEdit: StableEdit | null = null;

  function syncTextControl(
    control: HTMLTextAreaElement | HTMLInputElement,
    next: string,
  ): void {
    if (document.activeElement === control) return;
    if (control.value !== next) control.value = next;
  }

  function setManageCounter(node: HTMLElement, count: number, max: number): void {
    node.textContent = t("searchFeedback.manage.counter", { count, max });
    node.className =
      count > max
        ? "search-feedback-manage-counter search-feedback-manage-counter-over"
        : "search-feedback-manage-counter";
  }

  function paintListChrome(vm: SearchFeedbackManagementVm): void {
    const privacy = el("p", "search-feedback-manage-privacy");
    privacy.textContent = t("searchFeedback.manage.privacy");
    root.appendChild(privacy);

    const warning = el("p", "search-feedback-manage-export-warning");
    warning.textContent = t("searchFeedback.manage.export.authority");
    root.appendChild(warning);

    const actions = el("div", "row search-feedback-manage-transport-actions");
    const exportBtn = el(
      "button",
      "btn search-feedback-manage-export",
      vm.phase === "exporting"
        ? t("searchFeedback.manage.export.progress")
        : t("searchFeedback.manage.export.button"),
    );
    exportBtn.type = "button";
    exportBtn.id = "search-feedback-manage-export";
    exportBtn.disabled =
      vm.feedbackCount === 0 ||
      vm.busy ||
      vm.phase === "error" ||
      vm.phase === "handoff_preparing" ||
      vm.phase === "confirm_handoff";
    exportBtn.addEventListener("click", () => callbacks.onExport());
    actions.appendChild(exportBtn);

    const sendBtn = el(
      "button",
      "btn search-feedback-manage-send",
      vm.phase === "handoff_preparing"
        ? t("searchFeedback.manage.send.progress")
        : t("searchFeedback.manage.send.button"),
    );
    sendBtn.type = "button";
    sendBtn.id = "search-feedback-manage-send";
    sendBtn.disabled =
      !vm.sendForReviewAvailable ||
      vm.feedbackCount === 0 ||
      vm.busy ||
      vm.phase === "error" ||
      vm.phase === "exporting" ||
      vm.phase === "handoff_preparing" ||
      vm.phase === "confirm_handoff";
    sendBtn.addEventListener("click", () => callbacks.onRequestSendForReview());
    actions.appendChild(sendBtn);
    root.appendChild(actions);

    if (!vm.sendForReviewAvailable) {
      root.appendChild(
        el(
          "p",
          "search-feedback-manage-send-unavailable",
          t("searchFeedback.manage.send.unavailable"),
        ),
      );
    }

    if (vm.phase === "exported") {
      const success = el("div", "search-feedback-manage-export-success");
      success.setAttribute("role", "status");
      success.id = "search-feedback-manage-status";
      success.tabIndex = -1;
      success.appendChild(
        el(
          "p",
          undefined,
          t("searchFeedback.manage.export.success", {
            count: vm.exportFeedbackCount ?? vm.feedbackCount,
            filename: vm.exportFilename ?? "",
          }),
        ),
      );
      const ack = el(
        "button",
        "btn",
        t("searchFeedback.manage.export.acknowledge"),
      );
      ack.type = "button";
      ack.addEventListener("click", () => callbacks.onAcknowledgeExport());
      success.appendChild(ack);
      root.appendChild(success);
    }

    if (vm.phase === "confirm_handoff") {
      const box = el("div", "search-feedback-manage-handoff-confirm");
      box.id = "search-feedback-manage-handoff-confirm";
      const email = vm.reviewEmail ?? "";
      box.appendChild(
        el(
          "h3",
          "search-feedback-manage-handoff-heading",
          t("searchFeedback.manage.send.confirmHeading"),
        ),
      );
      box.appendChild(el("p", undefined, t("searchFeedback.manage.send.privacy")));
      appendTextWithEmailLink(
        box,
        t("searchFeedback.manage.send.destination", { email }),
        email,
        "search-feedback-manage-handoff-destination",
      );
      box.appendChild(el("p", undefined, t("searchFeedback.manage.send.destinationHint")));
      const row = el("div", "row");
      const cancel = el("button", "btn", t("searchFeedback.manage.send.cancel"));
      cancel.type = "button";
      cancel.id = "search-feedback-manage-handoff-cancel";
      cancel.addEventListener("click", () => callbacks.onCancelSendForReview());
      const cont = el("button", "btn", t("searchFeedback.manage.send.continue"));
      cont.type = "button";
      cont.id = "search-feedback-manage-handoff-continue";
      cont.addEventListener("click", () => callbacks.onConfirmSendForReview());
      row.appendChild(cancel);
      row.appendChild(cont);
      box.appendChild(row);
      root.appendChild(box);
    }

    if (vm.phase === "handoff_prepared") {
      const success = el("div", "search-feedback-manage-handoff-success");
      success.setAttribute("role", "status");
      success.id = "search-feedback-manage-status";
      success.tabIndex = -1;
      success.appendChild(
        el(
          "p",
          undefined,
          vm.handoffMethod === "download_mailto"
            ? t("searchFeedback.manage.send.successFallback", {
                email: vm.reviewEmail ?? "",
              })
            : t("searchFeedback.manage.send.successShare"),
        ),
      );
      const ack = el("button", "btn", t("searchFeedback.manage.send.acknowledge"));
      ack.type = "button";
      ack.id = "search-feedback-manage-handoff-acknowledge";
      ack.addEventListener("click", () => callbacks.onAcknowledgeHandoff());
      success.appendChild(ack);
      root.appendChild(success);
    }
  }

  function paintError(vm: SearchFeedbackManagementVm): void {
    if (!vm.errorCode) return;
    const key = ERROR_KEYS[vm.errorCode];
    if (!key) return;
    const summary = el("div", "search-feedback-manage-error-summary");
    summary.setAttribute("role", "alert");
    summary.id = "search-feedback-manage-error-summary";
    summary.tabIndex = -1;
    summary.textContent = t(key);
    root.appendChild(summary);
  }

  function paintList(vm: SearchFeedbackManagementVm): void {
    paintListChrome(vm);
    if (vm.phase === "empty") {
      const empty = el(
        "p",
        "search-feedback-manage-empty",
        t("searchFeedback.manage.empty"),
      );
      empty.id = "search-feedback-manage-status";
      empty.tabIndex = -1;
      root.appendChild(empty);
      return;
    }

    const list = el("ul", "search-feedback-manage-list");
    list.id = "search-feedback-manage-list";
    list.setAttribute("aria-label", t("searchFeedback.manage.heading"));

    for (const item of vm.items) {
      const li = el("li", "search-feedback-manage-row");
      const btn = el("button", "search-feedback-manage-row-button");
      btn.type = "button";
      btn.setAttribute("data-testid", "search-feedback-manage-row");
      btn.addEventListener("click", () => callbacks.onOpenDetail(item.feedback_id));

      const query = el("div", "search-feedback-manage-row-query", `"${item.query_raw}"`);
      applyNkoAttrs(query, item.query_raw);
      btn.appendChild(query);

      btn.appendChild(
        el("div", "search-feedback-manage-row-meta", resultStateLabel(item.result_state)),
      );
      btn.appendChild(
        el(
          "div",
          "search-feedback-manage-row-meta",
          directionLabel(item.search_direction),
        ),
      );
      btn.appendChild(
        el(
          "div",
          "search-feedback-manage-row-updated",
          t("searchFeedback.manage.updated", { date: formatUpdated(item.updated_at) }),
        ),
      );
      if (item.requested_meaning_preview) {
        btn.appendChild(
          el(
            "div",
            "search-feedback-manage-row-meaning",
            t("searchFeedback.manage.meaningPreview", {
              meaning: item.requested_meaning_preview,
            }),
          ),
        );
      }
      const avail = el(
        "div",
        "search-feedback-manage-availability",
        t(AVAIL_KEYS[item.availability]),
      );
      avail.setAttribute("data-state", item.availability);
      btn.appendChild(avail);

      li.appendChild(btn);
      list.appendChild(li);
    }
    root.appendChild(list);
  }

  function paintDetail(vm: SearchFeedbackManagementVm): void {
    const draft = vm.selected;
    if (!draft) return;

    const backList = el(
      "button",
      "btn search-feedback-manage-back-list",
      t("searchFeedback.manage.backToList"),
    );
    backList.type = "button";
    backList.addEventListener("click", () => callbacks.onBackToList());
    root.appendChild(backList);

    if (
      vm.phase === "stale_edit" ||
      vm.phase === "stale_delete" ||
      vm.errorCode
    ) {
      paintError(vm);
    }

    const query = el(
      "p",
      "search-feedback-manage-detail-query",
      `"${draft.query_raw}"`,
    );
    applyNkoAttrs(query, draft.query_raw);
    root.appendChild(query);

    root.appendChild(
      el(
        "p",
        "search-feedback-manage-detail-meta",
        `${resultStateLabel(draft.result_state)} · ${directionLabel(draft.search_direction)} · ${t("searchFeedback.manage.resultCount", { count: draft.result_count })}`,
      ),
    );

    if (vm.availability) {
      const avail = el(
        "p",
        "search-feedback-manage-availability",
        t(AVAIL_KEYS[vm.availability]),
      );
      avail.setAttribute("data-state", vm.availability);
      root.appendChild(avail);
    }

    if (draft.requested_meaning !== undefined) {
      root.appendChild(
        el(
          "p",
          "search-feedback-manage-detail-meaning",
          t("searchFeedback.manage.meaningValue", {
            meaning: draft.requested_meaning,
          }),
        ),
      );
    }
    if (draft.user_description !== undefined) {
      root.appendChild(
        el(
          "p",
          "search-feedback-manage-detail-details",
          t("searchFeedback.manage.detailsValue", {
            details: draft.user_description,
          }),
        ),
      );
    }

    root.appendChild(
      el(
        "p",
        "search-feedback-manage-timestamps",
        t("searchFeedback.manage.timestamps", {
          created: draft.created_at,
          updated: draft.updated_at,
        }),
      ),
    );

    const provenance = document.createElement("details");
    provenance.className = "search-feedback-manage-provenance";
    const summary = document.createElement("summary");
    summary.textContent = t("searchFeedback.manage.provenance.toggle");
    provenance.appendChild(summary);
    const body = el("div", "mono search-feedback-manage-provenance-body");
    body.appendChild(el("div", undefined, `bundle_id: ${draft.bundle_id}`));
    body.appendChild(el("div", undefined, `content_sha256: ${draft.content_sha256}`));
    body.appendChild(
      el("div", undefined, `storage_scope_id: ${draft.storage_scope_id}`),
    );
    body.appendChild(el("div", undefined, `feedback_id: ${draft.feedback_id}`));
    if (draft.matched_ir_ids !== undefined) {
      body.appendChild(
        el("div", undefined, `matched_ir_ids: ${draft.matched_ir_ids.join(", ")}`),
      );
    }
    provenance.appendChild(body);
    root.appendChild(provenance);

    if (vm.phase === "editing") {
      paintEditForm(vm);
      return;
    }

    if (vm.phase === "confirm_delete") {
      const confirm = el("div", "search-feedback-manage-delete-confirm");
      confirm.setAttribute("role", "alertdialog");
      confirm.setAttribute("aria-modal", "true");
      confirm.id = "search-feedback-manage-delete-confirm";
      confirm.tabIndex = -1;
      confirm.appendChild(
        el("p", undefined, t("searchFeedback.manage.deleteConfirmTitle")),
      );
      confirm.appendChild(
        el("p", undefined, t("searchFeedback.manage.deleteConfirmBody")),
      );
      const actions = el("div", "search-feedback-manage-actions");
      const yes = el(
        "button",
        "btn",
        t("searchFeedback.manage.deleteConfirmAction"),
      );
      yes.type = "button";
      yes.disabled = vm.busy;
      yes.addEventListener("click", () => callbacks.onConfirmDelete());
      const no = el("button", "btn", t("searchFeedback.manage.cancel"));
      no.type = "button";
      no.disabled = vm.busy;
      no.addEventListener("click", () => callbacks.onCancelDelete());
      actions.append(yes, no);
      confirm.appendChild(actions);
      root.appendChild(confirm);
      return;
    }

    const actions = el("div", "search-feedback-manage-actions");
    const edit = el("button", "btn", t("searchFeedback.manage.edit"));
    edit.type = "button";
    edit.disabled = vm.busy;
    edit.addEventListener("click", () => callbacks.onStartEdit());
    const del = el("button", "btn", t("searchFeedback.manage.delete"));
    del.type = "button";
    del.disabled = vm.busy;
    del.addEventListener("click", () => callbacks.onRequestDelete());
    actions.append(edit, del);
    root.appendChild(actions);
  }

  function paintEditForm(vm: SearchFeedbackManagementVm): void {
    const fields = vm.editFields;
    if (!fields || !vm.selected) return;

    paintError(vm);

    const meaningField = el("div", "field");
    const meaningLabel = el(
      "label",
      "label",
      `${t("searchFeedback.manage.meaningLabel")} (${t("searchFeedback.manage.optional")})`,
    );
    meaningLabel.htmlFor = "search-feedback-manage-meaning";
    const meaningInput = document.createElement("textarea");
    meaningInput.id = "search-feedback-manage-meaning";
    meaningInput.value = fields.requested_meaning;
    meaningInput.disabled = vm.busy;
    meaningInput.addEventListener("input", () => {
      callbacks.onRequestedMeaningChange(meaningInput.value);
    });
    const meaningCounter = el("p", "search-feedback-manage-counter");
    setManageCounter(
      meaningCounter,
      vm.requestedMeaningCount,
      SEARCH_FEEDBACK_REQUESTED_MEANING_MAX_CHARS,
    );
    meaningField.append(meaningLabel, meaningInput, meaningCounter);
    root.appendChild(meaningField);

    const detailsField = el("div", "field");
    const detailsLabel = el(
      "label",
      "label",
      `${t("searchFeedback.manage.detailsLabel")} (${t("searchFeedback.manage.optional")})`,
    );
    detailsLabel.htmlFor = "search-feedback-manage-details";
    const detailsInput = document.createElement("textarea");
    detailsInput.id = "search-feedback-manage-details";
    detailsInput.value = fields.user_description;
    detailsInput.disabled = vm.busy;
    detailsInput.addEventListener("input", () => {
      callbacks.onUserDescriptionChange(detailsInput.value);
    });
    const detailsCounter = el("p", "search-feedback-manage-counter");
    setManageCounter(
      detailsCounter,
      vm.userDescriptionCount,
      SEARCH_FEEDBACK_USER_DESCRIPTION_MAX_CHARS,
    );
    detailsField.append(detailsLabel, detailsInput, detailsCounter);
    root.appendChild(detailsField);

    const actions = el("div", "search-feedback-manage-actions");
    const save = el(
      "button",
      "btn",
      vm.busy
        ? t("searchFeedback.manage.saving")
        : t("searchFeedback.manage.saveEdit"),
    ) as HTMLButtonElement;
    save.type = "button";
    save.disabled = vm.busy;
    save.addEventListener("click", () => callbacks.onSaveEdit());
    const cancel = el(
      "button",
      "btn",
      t("searchFeedback.manage.cancel"),
    ) as HTMLButtonElement;
    cancel.type = "button";
    cancel.disabled = vm.busy;
    cancel.addEventListener("click", () => callbacks.onCancelEdit());
    actions.append(save, cancel);
    root.appendChild(actions);

    stableEdit = {
      feedbackId: vm.selected.feedback_id,
      meaningInput,
      detailsInput,
      meaningCounter,
      detailsCounter,
      saveBtn: save,
      cancelBtn: cancel,
    };
  }

  function syncStableEdit(vm: SearchFeedbackManagementVm): void {
    if (!stableEdit || !vm.editFields) return;
    root.setAttribute("aria-busy", vm.busy ? "true" : "false");
    syncTextControl(stableEdit.meaningInput, vm.editFields.requested_meaning);
    syncTextControl(stableEdit.detailsInput, vm.editFields.user_description);
    stableEdit.meaningInput.disabled = vm.busy;
    stableEdit.detailsInput.disabled = vm.busy;
    setManageCounter(
      stableEdit.meaningCounter,
      vm.requestedMeaningCount,
      SEARCH_FEEDBACK_REQUESTED_MEANING_MAX_CHARS,
    );
    setManageCounter(
      stableEdit.detailsCounter,
      vm.userDescriptionCount,
      SEARCH_FEEDBACK_USER_DESCRIPTION_MAX_CHARS,
    );
    stableEdit.saveBtn.textContent = vm.busy
      ? t("searchFeedback.manage.saving")
      : t("searchFeedback.manage.saveEdit");
    stableEdit.saveBtn.disabled = vm.busy;
    stableEdit.cancelBtn.disabled = vm.busy;
  }

  function paint(vm: SearchFeedbackManagementVm): void {
    stableEdit = null;
    root.replaceChildren();
    root.setAttribute("aria-busy", vm.busy ? "true" : "false");

    const back = el("button", "btn search-feedback-manage-back", t("searchFeedback.manage.back"));
    back.type = "button";
    back.addEventListener("click", () => callbacks.onBack());
    root.appendChild(back);

    const heading = el(
      "h2",
      "search-feedback-manage-heading",
      t("searchFeedback.manage.heading"),
    );
    heading.id = "search-feedback-manage-heading";
    heading.tabIndex = -1;
    root.appendChild(heading);

    if (vm.phase === "loading") {
      const status = el(
        "p",
        "search-feedback-manage-status",
        t("searchFeedback.manage.loading"),
      );
      status.id = "search-feedback-manage-status";
      status.tabIndex = -1;
      root.appendChild(status);
    } else if (vm.phase === "error") {
      paintError(vm);
      const status = el("p", "search-feedback-manage-status");
      status.id = "search-feedback-manage-status";
      status.tabIndex = -1;
      root.appendChild(status);
    } else if (
      vm.phase === "list" ||
      vm.phase === "empty" ||
      vm.phase === "exporting" ||
      vm.phase === "exported" ||
      vm.phase === "confirm_handoff" ||
      vm.phase === "handoff_preparing" ||
      vm.phase === "handoff_prepared"
    ) {
      if (
        vm.errorCode &&
        vm.phase !== "exported" &&
        vm.phase !== "handoff_prepared"
      ) {
        paintError(vm);
      }
      paintList(vm);
    } else {
      paintDetail(vm);
    }

    if (vm.focusTarget === "heading") {
      focusById(root, "search-feedback-manage-heading");
    } else if (vm.focusTarget === "status") {
      focusById(root, "search-feedback-manage-status");
    } else if (vm.focusTarget === "error_summary") {
      focusById(root, "search-feedback-manage-error-summary");
    } else if (vm.focusTarget === "delete_confirm") {
      focusById(root, "search-feedback-manage-delete-confirm");
    } else if (vm.focusTarget === "list") {
      focusById(root, "search-feedback-manage-list");
    }
  }

  function apply(vm: SearchFeedbackManagementVm): void {
    if (
      vm.phase === "editing" &&
      stableEdit &&
      vm.selected?.feedback_id === stableEdit.feedbackId &&
      root.contains(stableEdit.meaningInput) &&
      root.contains(stableEdit.detailsInput)
    ) {
      syncStableEdit(vm);
      return;
    }
    paint(vm);
  }

  apply(initial);

  return {
    root,
    update(vm: SearchFeedbackManagementVm) {
      apply(vm);
    },
  };
}
