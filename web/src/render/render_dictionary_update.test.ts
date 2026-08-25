// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import { setCurrentLocale, t } from "../i18n";
import {
  renderDictionaryUpdateDialog,
  renderSearchUpdateNotice,
  resolveUpdatePresentationCopy,
} from "./render_dictionary_update";
import { renderInstalledDictionaryList } from "./render_dictionary_management";
import { normalizeUpdateSummary } from "../dictionary_update/dictionary_update_summary";

const EN =
  "An updated Maninka dictionary is available with refreshed dictionary entries, broader search coverage, and a new offline Credits & Sources section.";
const FR =
  "Une mise à jour du dictionnaire maninka est disponible, avec des entrées actualisées, une couverture de recherche élargie et une nouvelle section Crédits et sources accessible hors ligne.";

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

  it("renders confirmation with resolved catalog update summary", () => {
    const dialog = renderDictionaryUpdateDialog(
      {
        phase: "confirming",
        progressMessage: "",
        resolvedSummary: {
          short_summary: "Refreshed entries and broader search coverage.",
          highlights: ["Offline Credits & Sources"],
          short_summary_source: "catalog_locale",
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

  it("resolves notice and confirm FR summary from bilingual catalog metadata", () => {
    setCurrentLocale("fr");
    const summary = normalizeUpdateSummary({
      short_summary: EN,
      short_summary_fr: FR,
      highlights: ["Broader searchable coverage"],
      highlights_fr: ["Couverture de recherche élargie"],
      title: "Dictionary update available",
      title_fr: "Mise à jour du dictionnaire disponible",
    });
    const presentation = resolveUpdatePresentationCopy(summary, 32_805_591, (n) => `${n}`);
    expect(presentation.resolved.short_summary).toBe(FR);
    expect(presentation.resolved.highlights?.[0]).toMatch(/Couverture/);
    expect(presentation.notice.bodyShort).toBe(FR);

    const notice = renderSearchUpdateNotice(
      { onUpdate: vi.fn(), onNotNow: vi.fn() },
      presentation.notice,
    );
    expect(notice.textContent).toContain(FR);
    expect(notice.textContent).not.toContain("updated Maninka dictionary");

    const dialog = renderDictionaryUpdateDialog(
      {
        phase: "confirming",
        progressMessage: "",
        resolvedSummary: presentation.resolved,
      },
      {
        onConfirmUpdate: vi.fn(),
        onCancel: vi.fn(),
        onRetry: vi.fn(),
        onContinue: vi.fn(),
        onCloseFailure: vi.fn(),
      },
    );
    expect(dialog.textContent).toContain(FR);
    expect(dialog.textContent).toContain("Couverture de recherche élargie");
    expect(dialog.textContent).not.toContain("updated Maninka dictionary");
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

  it("shows Dictionaries update row with locale-resolved help text", () => {
    setCurrentLocale("fr");
    const onUpdate = vi.fn();
    const root = renderInstalledDictionaryList(
      [
        {
          bundleId: "b1",
          displayName: "French / English ↔ Maninka",
          languageDirection: "French → Maninka",
          isActive: true,
          updateAvailable: true,
          updateHelpText: FR,
        },
      ],
      { onUse: vi.fn(), onRemove: vi.fn(), onUpdate, isBusy: () => false },
    );
    expect(root.textContent).toContain(FR);
    expect(root.textContent).not.toContain("updated Maninka dictionary");
    root.querySelector<HTMLButtonElement>(".ux2-dict-action-update")!.click();
    expect(onUpdate).toHaveBeenCalledWith("b1");
  });

  it("localizes FR consumer update chrome strings", () => {
    setCurrentLocale("fr");
    const notice = renderSearchUpdateNotice({ onUpdate: vi.fn(), onNotNow: vi.fn() });
    expect(notice.textContent).toContain(t("dictionaryUpdate.availableTitle"));
    expect(notice.textContent).toMatch(/Mettre à jour|dictionnaire/i);
  });
});
