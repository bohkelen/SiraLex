// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import { setCurrentLocale, t } from "../i18n";
import {
  renderDictionaryUpdateDialog,
  renderSearchUpdateNotice,
} from "./render_dictionary_update";
import { renderInstalledDictionaryList } from "./render_dictionary_management";

describe("DU1 dictionary update presentation", () => {
  beforeEach(() => {
    setCurrentLocale("en");
  });

  it("renders Search notice without covering results semantics", () => {
    const onUpdate = vi.fn();
    const onNotNow = vi.fn();
    const root = renderSearchUpdateNotice({ onUpdate, onNotNow });
    expect(root.getAttribute("role")).toBe("status");
    expect(root.textContent).toContain(t("dictionaryUpdate.availableTitle"));
    expect(root.textContent).toContain(t("dictionaryUpdate.availableBodyShort"));
    expect(root.textContent).not.toMatch(/sha256|bundle_id|storage_scope/i);
    root.querySelector<HTMLButtonElement>(".ux2-dict-action-update")!.click();
    expect(onUpdate).toHaveBeenCalled();
    root.querySelectorAll("button")[1]!.click();
    expect(onNotNow).toHaveBeenCalled();
  });

  it("renders confirmation with catalog update summary when provided", () => {
    const dialog = renderDictionaryUpdateDialog(
      {
        phase: "confirming",
        progressMessage: "",
        updateSummary: {
          short_summary: "Refreshed entries and broader search coverage.",
          highlights: ["Offline Credits & Sources"],
        },
        sizeLabel: "Download size: about 31 MB",
      },
      {
        onConfirmUpdate: vi.fn(),
        onCancel: vi.fn(),
        onRetry: vi.fn(),
        onContinue: vi.fn(),
        onCloseFailure: vi.fn(),
      },
    );
    expect(dialog.textContent).toContain("Refreshed entries and broader search coverage.");
    expect(dialog.textContent).toContain("Offline Credits & Sources");
    expect(dialog.textContent).toContain("31 MB");
    expect(dialog.textContent).not.toMatch(/sha256|bundle_id|IndexedDB/i);
  });

  it("renders confirmation with retained-data explanation", () => {
    const dialog = renderDictionaryUpdateDialog(
      { phase: "confirming", progressMessage: "" },
      {
        onConfirmUpdate: vi.fn(),
        onCancel: vi.fn(),
        onRetry: vi.fn(),
        onContinue: vi.fn(),
        onCloseFailure: vi.fn(),
      },
    );
    expect(dialog.getAttribute("aria-labelledby")).toBe("dictionary-update-dialog-title");
    expect(dialog.textContent).toContain("saved words");
    expect(dialog.textContent).toContain("corrections");
    expect(dialog.textContent).toContain("search feedback");
    expect(dialog.textContent).toContain("current dictionary stays available");
    expect(dialog.textContent).not.toMatch(/sha256|bundle_id|cloud|sync/i);
  });

  it("renders success and failure consumer copy", () => {
    const success = renderDictionaryUpdateDialog(
      { phase: "success", progressMessage: "", cleanupWarning: "x" },
      {
        onConfirmUpdate: vi.fn(),
        onCancel: vi.fn(),
        onRetry: vi.fn(),
        onContinue: vi.fn(),
        onCloseFailure: vi.fn(),
      },
    );
    expect(success.textContent).toContain(t("dictionaryUpdate.successTitle"));
    expect(success.textContent).toContain(t("dictionaryUpdate.cleanupWarning"));

    const failure = renderDictionaryUpdateDialog(
      { phase: "failure", progressMessage: "", failureMessage: "checksum" },
      {
        onConfirmUpdate: vi.fn(),
        onCancel: vi.fn(),
        onRetry: vi.fn(),
        onContinue: vi.fn(),
        onCloseFailure: vi.fn(),
      },
    );
    expect(failure.textContent).toContain(t("dictionaryUpdate.failureTitle"));
    expect(failure.textContent).toContain(t("dictionaryUpdate.failureBody"));
    expect(failure.textContent).toContain("checksum");
  });

  it("shows Dictionaries update card with one logical row action", () => {
    const onUpdate = vi.fn();
    const root = renderInstalledDictionaryList(
      [
        {
          bundleId: "b1",
          displayName: "French / English ↔ Maninka",
          languageDirection: "French → Maninka",
          isActive: true,
          updateAvailable: true,
        },
      ],
      { onUse: vi.fn(), onRemove: vi.fn(), onUpdate, isBusy: () => false },
    );
    expect(root.querySelectorAll(".ux2-dict-row")).toHaveLength(1);
    expect(root.textContent).toContain(t("dictionaries.installedState"));
    expect(root.textContent).toContain(t("dictionaryUpdate.newVersionAvailable"));
    expect(root.textContent).toContain(t("dictionaryUpdate.action"));
    root.querySelector<HTMLButtonElement>(".ux2-dict-action-update")!.click();
    expect(onUpdate).toHaveBeenCalledWith("b1");
  });

  it("localizes FR consumer update strings", () => {
    setCurrentLocale("fr");
    const notice = renderSearchUpdateNotice({ onUpdate: vi.fn(), onNotNow: vi.fn() });
    expect(notice.textContent).toContain(t("dictionaryUpdate.availableTitle"));
    expect(notice.textContent).toMatch(/Mettre à jour|dictionnaire/i);
  });
});
