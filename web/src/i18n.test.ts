import { describe, expect, it } from "vitest";

import {
  UI_LOCALE_STORAGE_KEY,
  getCurrentLocale,
  getSavedLocalePreference,
  resolveDefaultLocale,
  setCurrentLocale,
  setCurrentLocaleWithPersistence,
  setSavedLocalePreference,
  t,
} from "./i18n";

function createMockStorage(initial: Record<string, string> = {}) {
  const data = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
}

describe("i18n locale resolution", () => {
  it("saved preference wins over deployment default", () => {
    const storage = createMockStorage({ [UI_LOCALE_STORAGE_KEY]: "en" });
    expect(resolveDefaultLocale("fr", "fr-FR", storage)).toBe("en");
  });

  it("deployment default wins when no saved preference", () => {
    const storage = createMockStorage();
    expect(resolveDefaultLocale("fr", "en-US", storage)).toBe("fr");
    expect(resolveDefaultLocale("en", "fr-FR", storage)).toBe("en");
  });

  it("invalid saved preference is ignored", () => {
    const storage = createMockStorage({ [UI_LOCALE_STORAGE_KEY]: "de" });
    expect(resolveDefaultLocale("fr", "en-US", storage)).toBe("fr");
  });

  it("falls back to browser locale, then french", () => {
    const storage = createMockStorage();
    expect(resolveDefaultLocale("de", "en-GB", storage)).toBe("en");
    expect(resolveDefaultLocale(undefined, undefined, storage)).toBe("fr");
    expect(resolveDefaultLocale("de", "es-ES", storage)).toBe("fr");
  });
});

describe("i18n locale persistence", () => {
  it("setting saved locale writes to storage", () => {
    const storage = createMockStorage();
    setSavedLocalePreference("fr", storage);
    expect(storage.getItem(UI_LOCALE_STORAGE_KEY)).toBe("fr");
  });

  it("setCurrentLocaleWithPersistence updates current locale and storage", () => {
    const previous = getCurrentLocale();
    const storage = createMockStorage();
    setCurrentLocaleWithPersistence("en", storage);
    expect(getCurrentLocale()).toBe("en");
    expect(storage.getItem(UI_LOCALE_STORAGE_KEY)).toBe("en");
    setCurrentLocale(previous);
  });

  it("reads saved locale safely", () => {
    const storage = createMockStorage({ [UI_LOCALE_STORAGE_KEY]: "fr" });
    expect(getSavedLocalePreference(storage)).toBe("fr");
  });
});

describe("i18n translations", () => {
  it("uses active locale translations with interpolation", () => {
    const previous = getCurrentLocale();
    setCurrentLocale("fr");
    expect(t("search.queryLabel", { direction: "FR → Mnk" })).toBe("Recherche (FR → Mnk)");
    setCurrentLocale("en");
    expect(t("search.queryLabel", { direction: "FR → Mnk" })).toBe("Search (FR → Mnk)");
    setCurrentLocale(previous);
  });

  it("resolves Progress keys in English and French", () => {
    const previous = getCurrentLocale();

    setCurrentLocale("en");
    expect(t("progress.heading")).toBe("Vocabulary overview");
    expect(t("progress.saved")).toBe("Saved");
    expect(t("progress.notReviewed")).toBe("Not reviewed");
    expect(t("progress.stillLearning")).toBe("Still learning");
    expect(t("progress.remembered")).toBe("Remembered");
    expect(t("progress.unavailable")).toBe("Unavailable");
    expect(t("progress.startReview")).toBe("Start review");
    expect(t("progress.continueReview")).toBe("Continue review");
    expect(t("progress.cue.reviewNew")).toBe("Review new saved words");
    expect(t("progress.cue.reviewStillLearning")).toBe("Review words you are still learning");
    expect(t("progress.cue.reviewAgain")).toBe("Review saved vocabulary again");
    expect(t("progress.unavailableExplanation")).toMatch(/not available in the current dictionary/i);

    setCurrentLocale("fr");
    expect(t("progress.heading")).toBe("Aperçu du vocabulaire");
    expect(t("progress.saved")).toBe("Enregistrés");
    expect(t("progress.notReviewed")).toBe("Pas encore révisés");
    expect(t("progress.stillLearning")).toBe("Encore en apprentissage");
    expect(t("progress.remembered")).toBe("Mémorisés");
    expect(t("progress.unavailable")).toBe("Indisponibles");
    expect(t("progress.startReview")).toBe("Commencer la révision");
    expect(t("progress.continueReview")).toBe("Continuer la révision");
    expect(t("progress.cue.reviewNew")).toBe("Réviser les nouveaux mots enregistrés");
    expect(t("progress.cue.reviewStillLearning")).toBe("Réviser les mots encore en apprentissage");
    expect(t("progress.cue.reviewAgain")).toBe("Réviser à nouveau le vocabulaire enregistré");
    expect(t("progress.unavailableExplanation")).toMatch(/ne sont pas disponibles/i);

    setCurrentLocale(previous);
  });

  it("resolves new consent and diagnostics keys in English and French", () => {
    const previous = getCurrentLocale();

    setCurrentLocale("en");
    expect(t("logging.consentPrompt")).toMatch(/locally on this device/i);
    expect(t("logging.consentPrompt")).toMatch(/not uploaded automatically/i);
    expect(t("logging.consentStatusNotRecorded")).toBe("Consent: not recorded");
    expect(t("logging.copyDiagnostics")).toBe("Copy diagnostic info");
    expect(t("logging.statsLine", { count: 3, oldest: "2026-06-01" })).toContain("3 logs");
    expect(t("logging.recentColStatus")).toBe("status");

    setCurrentLocale("fr");
    expect(t("logging.consentPrompt")).toMatch(/localement/i);
    expect(t("logging.consentPrompt")).toMatch(/pas envoyés automatiquement/i);
    expect(t("logging.consentStatusNotRecorded")).toBe("Consentement : non enregistré");
    expect(t("logging.copyDiagnostics")).toBe("Copier les infos de diagnostic");
    expect(t("logging.statsLine", { count: 3, oldest: "2026-06-01" })).toContain("3 journaux");
    expect(t("logging.recentColStatus")).toBe("statut");

    setCurrentLocale(previous);
  });
});

