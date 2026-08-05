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

  it("interpolates configured review email into handoff copy without hardcoding it", () => {
    const previous = getCurrentLocale();
    const email = "inbox@example.org";
    setCurrentLocale("en");
    expect(t("correctionFeedback.manage.send.destination", { email })).toContain(email);
    expect(t("correctionFeedback.manage.send.shareText", { email })).toContain(email);
    expect(t("searchFeedback.manage.send.shareText", { email })).toContain(email);
    expect(t("correctionFeedback.manage.send.shareText", { email })).not.toContain(
      "diabilasekou@gmail.com",
    );
    setCurrentLocale("fr");
    expect(t("correctionFeedback.manage.send.destination", { email })).toContain(email);
    expect(t("correctionFeedback.manage.send.shareText", { email })).toContain(email);
    setCurrentLocale(previous);
  });

  it("resolves Theme labels in English and French", () => {
    const previous = getCurrentLocale();
    setCurrentLocale("en");
    expect(t("theme.selectorLabel")).toBe("Theme");
    expect(t("theme.system")).toBe("System");
    expect(t("theme.light")).toBe("Light");
    expect(t("theme.dark")).toBe("Dark");
    setCurrentLocale("fr");
    expect(t("theme.selectorLabel")).toBe("Thème");
    expect(t("theme.system")).toBe("Système");
    expect(t("theme.light")).toBe("Clair");
    expect(t("theme.dark")).toBe("Sombre");
    setCurrentLocale(previous);
  });

  it("resolves UX2 primary navigation and More labels in English and French", () => {
    const previous = getCurrentLocale();
    setCurrentLocale("en");
    expect(t("nav.primaryAriaLabel")).toBe("Primary");
    expect(t("nav.search")).toBe("Search");
    expect(t("nav.saved")).toBe("Saved");
    expect(t("nav.review")).toBe("Review");
    expect(t("nav.more")).toBe("More");
    expect(t("more.corrections")).toBe("Corrections");
    expect(t("more.myCorrections")).toBe("Corrections");
    expect(t("more.searchFeedback")).toBe("Search feedback");
    expect(t("more.dictionaries")).toBe("Dictionaries");
    expect(t("more.learningData")).toBe("Learning data");
    expect(t("more.contributeSection")).toBe("Contribute");
    expect(t("more.back")).toBe("← Back to More");
    setCurrentLocale("fr");
    expect(t("nav.primaryAriaLabel")).toBe("Principal");
    expect(t("nav.search")).toBe("Recherche");
    expect(t("nav.saved")).toBe("Enregistré");
    expect(t("nav.review")).toBe("Révision");
    expect(t("nav.more")).toBe("Plus");
    expect(t("more.corrections")).toBe("Corrections");
    expect(t("more.myCorrections")).toBe("Corrections");
    expect(t("more.searchFeedback")).toBe("Retours de recherche");
    expect(t("more.dictionaries")).toBe("Dictionnaires");
    expect(t("more.learningData")).toBe("Données d’apprentissage");
    expect(t("more.back")).toBe("← Retour à Plus");
    setCurrentLocale(previous);
  });

  it("resolves UX2I4 Entry Detail labels in English and French", () => {
    const previous = getCurrentLocale();
    setCurrentLocale("en");
    expect(t("entry.back")).toBe("← Back to results");
    expect(t("entry.backToSaved")).toBe("← Back to saved");
    expect(t("entry.suggestCorrection")).toBe("Suggest correction →");
    expect(t("entry.section.examples")).toBe("Examples");
    setCurrentLocale("fr");
    expect(t("entry.back")).toBe("← Retour aux résultats");
    expect(t("entry.backToSaved")).toBe("← Retour aux enregistrés");
    expect(t("entry.suggestCorrection")).toBe("Suggérer une correction →");
    expect(t("entry.section.examples")).toBe("Exemples");
    setCurrentLocale(previous);
  });

  it("resolves UX2I3 Search Home/Results labels in English and French", () => {
    const previous = getCurrentLocale();
    setCurrentLocale("en");
    expect(t("search.switchDirection", { from: "French", to: "Maninka" })).toBe(
      "Switch search direction: French to Maninka",
    );
    expect(t("search.resultMeta", { count: 4 })).toBe("4 results");
    expect(t("searchFeedback.capture.resultsNotUsefulAction")).toContain(
      "Tell us what you were looking for",
    );
    expect(t("search.lookingForSomethingElse")).toBe("Looking for something else?");
    setCurrentLocale("fr");
    expect(t("search.switchDirection", { from: "Français", to: "Maninka" })).toBe(
      "Changer le sens de recherche : Français vers Maninka",
    );
    expect(t("search.resultMeta", { count: 4 })).toBe("4 résultats");
    expect(t("searchFeedback.capture.resultsNotUsefulAction")).toContain(
      "Dites-nous ce que vous cherchiez",
    );
    expect(t("search.lookingForSomethingElse")).toBe("Vous cherchiez autre chose ?");
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

  it("resolves correction feedback form keys in English and French", () => {
    const previous = getCurrentLocale();

    setCurrentLocale("en");
    expect(t("correctionFeedback.form.suggestAction")).toBe("Suggest a correction");
    expect(t("correctionFeedback.form.save")).toBe("Save correction draft");
    expect(t("correctionFeedback.form.success.body1")).toMatch(/saved on this device/i);
    expect(t("correctionFeedback.form.success.body2")).toMatch(/not been submitted/i);
    expect(t("correctionFeedback.form.privacy.localOnly")).toMatch(/does not change the dictionary/i);

    setCurrentLocale("fr");
    expect(t("correctionFeedback.form.suggestAction")).toBe("Suggérer une correction");
    expect(t("correctionFeedback.form.save")).toBe("Enregistrer le brouillon de correction");
    expect(t("correctionFeedback.form.success.body1")).toMatch(/enregistré sur cet appareil/i);
    expect(t("correctionFeedback.form.success.body2")).toMatch(/pas été envoyé/i);
    expect(t("correctionFeedback.form.privacy.localOnly")).toMatch(/brouillon local/i);
    expect(t("correctionFeedback.form.suggestAction")).not.toBe("Suggest a correction");

    setCurrentLocale(previous);
  });

  it("resolves correction feedback manage/export keys in English and French", () => {
    const previous = getCurrentLocale();

    setCurrentLocale("en");
    expect(t("correctionFeedback.manage.open")).toBe("Manage Corrections");
    expect(t("correctionFeedback.manage.heading")).toBe("Pending corrections");
    expect(t("correctionFeedback.manage.export.authority")).toBe(
      "This file contains unreviewed user suggestions. It must not be applied automatically.",
    );
    expect(t("correctionFeedback.manage.deleteReminder")).toBe(
      "Before deleting the database, export your correction drafts if you want to keep them.",
    );
    expect(t("correctionFeedback.manage.export.success", {
      filename: "x.json",
      count: 2,
    })).toContain("x.json");
    expect(t("correctionFeedback.manage.export.button")).not.toMatch(/submit/i);

    setCurrentLocale("fr");
    expect(t("correctionFeedback.manage.open")).toBe("Gérer les corrections");
    expect(t("correctionFeedback.manage.heading")).toBe("Corrections en attente");
    expect(t("correctionFeedback.manage.export.authority")).toBe(
      "Ce fichier contient des suggestions utilisateur non révisées. Il ne doit pas être appliqué automatiquement.",
    );
    expect(t("correctionFeedback.manage.deleteReminder")).toMatch(/Avant de supprimer/i);
    expect(t("correctionFeedback.manage.open")).not.toBe("Manage Corrections");

    setCurrentLocale(previous);
  });
});

