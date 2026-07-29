/**
 * Phase 2.0.4 — Entry detail rendering.
 *
 * Renders a full enriched record: all senses, translations, variant forms,
 * examples, sub-entries, and provenance metadata.
 *
 * LS1I2: lexicon entries may show a Learning Save control. The renderer does
 * not open IndexedDB; the application owns persistence and state updates.
 */

import type {
  EnrichedRecord,
  LexiconDisplayFields,
  IndexMappingDisplayFields,
  SenseRaw,
  ExampleRaw,
  SubEntry,
} from "../types/records";
import { isLexiconDisplay, isIndexMappingDisplay } from "../types/records";
import { t } from "../i18n";
import type { LearningSaveControlState } from "../learning/entry_learning_session";

function el(tag: string, cls?: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

function renderExample(ex: ExampleRaw): HTMLElement {
  const wrap = el("div", "entry-example");
  wrap.appendChild(el("div", "example-text", ex.text_latin));
  if (ex.text_nko_provided) {
    wrap.appendChild(el("div", "example-nko", ex.text_nko_provided));
  }
  const translations: string[] = [];
  if (ex.trans_fr) translations.push(ex.trans_fr);
  if (ex.trans_en) translations.push(ex.trans_en);
  if (ex.trans_ru) translations.push(ex.trans_ru);
  if (translations.length > 0) {
    wrap.appendChild(el("div", "example-trans", translations.join(" / ")));
  }
  if (ex.source_attribution) {
    wrap.appendChild(el("div", "example-attr", ex.source_attribution));
  }
  return wrap;
}

function renderSubEntry(sub: SubEntry): HTMLElement {
  const wrap = el("div", "entry-subentry");
  let line = `→ ${sub.text}`;
  if (sub.nko) line += ` (${sub.nko})`;
  wrap.appendChild(el("span", "subentry-text", line));
  const glosses: string[] = [];
  if (sub.gloss_fr) glosses.push(sub.gloss_fr);
  if (sub.gloss_en) glosses.push(sub.gloss_en);
  if (sub.gloss_ru) glosses.push(sub.gloss_ru);
  if (glosses.length > 0) {
    wrap.appendChild(el("span", "subentry-gloss", ` — ${glosses.join(" / ")}`));
  }
  return wrap;
}

function renderSense(sense: SenseRaw, index: number): HTMLElement {
  const wrap = el("div", "entry-sense");
  const num = sense.sense_num ?? index + 1;
  const glosses: string[] = [];
  if (sense.gloss_fr) glosses.push(sense.gloss_fr);
  if (sense.gloss_en) glosses.push(sense.gloss_en);
  if (sense.gloss_ru) glosses.push(sense.gloss_ru);

  const header = el("div", "sense-header");
  header.appendChild(el("span", "sense-num", `${num}.`));
  if (glosses.length > 0) {
    header.appendChild(el("span", "sense-gloss", glosses.join(" / ")));
  }
  wrap.appendChild(header);

  if (sense.usage_note) {
    wrap.appendChild(el("div", "sense-usage", t("entry.usage", { value: sense.usage_note })));
  }
  if (sense.synonyms_raw && sense.synonyms_raw.length > 0) {
    wrap.appendChild(el("div", "sense-synonyms", t("entry.synShort", { value: sense.synonyms_raw.join(", ") })));
  }
  if (sense.examples && sense.examples.length > 0) {
    const exWrap = el("div", "sense-examples");
    for (const ex of sense.examples) exWrap.appendChild(renderExample(ex));
    wrap.appendChild(exWrap);
  }
  if (sense.sub_entries && sense.sub_entries.length > 0) {
    const subWrap = el("div", "sense-subentries");
    for (const sub of sense.sub_entries) subWrap.appendChild(renderSubEntry(sub));
    wrap.appendChild(subWrap);
  }
  return wrap;
}

export type EntryLearningCallbacks = {
  initialState: LearningSaveControlState;
  onSave: () => void;
  onUnsave: () => void;
};

function isBusyState(state: LearningSaveControlState): boolean {
  return state === "loading" || state === "saving" || state === "removing";
}

function isSavedSideState(state: LearningSaveControlState): boolean {
  return state === "saved" || state === "removing" || state === "error_saved";
}

function isUnsavedSideState(state: LearningSaveControlState): boolean {
  return state === "not_saved" || state === "error_not_saved";
}

export function applyLearningSaveControlState(
  button: HTMLButtonElement,
  errorEl: HTMLElement,
  state: LearningSaveControlState,
): void {
  const busy = isBusyState(state);
  button.disabled = busy || state === "unavailable";
  button.setAttribute("aria-busy", busy ? "true" : "false");

  if (state === "unavailable") {
    button.removeAttribute("aria-pressed");
    button.hidden = true;
    errorEl.hidden = true;
    errorEl.textContent = "";
    return;
  }

  button.hidden = false;
  button.setAttribute("aria-pressed", isSavedSideState(state) ? "true" : "false");

  switch (state) {
    case "loading":
      button.textContent = t("learning.checking");
      errorEl.hidden = true;
      errorEl.textContent = "";
      break;
    case "not_saved":
      button.textContent = t("learning.save");
      errorEl.hidden = true;
      errorEl.textContent = "";
      break;
    case "saving":
      button.textContent = t("learning.saving");
      errorEl.hidden = true;
      errorEl.textContent = "";
      break;
    case "saved":
      button.textContent = t("learning.saved");
      errorEl.hidden = true;
      errorEl.textContent = "";
      break;
    case "removing":
      button.textContent = t("learning.removing");
      errorEl.hidden = true;
      errorEl.textContent = "";
      break;
    case "error_not_saved":
      button.textContent = t("learning.save");
      errorEl.textContent = t("learning.saveError");
      errorEl.hidden = false;
      break;
    case "error_saved":
      button.textContent = t("learning.saved");
      errorEl.textContent = t("learning.removeError");
      errorEl.hidden = false;
      break;
  }
}

function renderLearningSaveControl(learning: EntryLearningCallbacks): {
  root: HTMLElement;
  setState: (state: LearningSaveControlState) => void;
} {
  const root = el("div", "entry-learning-actions");
  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn entry-learning-save";
  button.id = "entry-learning-save";

  const errorEl = el("div", "entry-learning-error");
  errorEl.id = "entry-learning-error";
  errorEl.setAttribute("role", "status");
  button.setAttribute("aria-describedby", errorEl.id);

  let currentState = learning.initialState;
  applyLearningSaveControlState(button, errorEl, currentState);

  button.addEventListener("click", () => {
    if (isBusyState(currentState) || currentState === "unavailable") return;
    if (isUnsavedSideState(currentState)) {
      learning.onSave();
      return;
    }
    if (isSavedSideState(currentState)) {
      learning.onUnsave();
    }
  });

  root.appendChild(button);
  root.appendChild(errorEl);

  return {
    root,
    setState: (state: LearningSaveControlState) => {
      currentState = state;
      applyLearningSaveControlState(button, errorEl, state);
    },
  };
}

function renderLexiconEntry(
  record: EnrichedRecord,
  d: LexiconDisplayFields,
  learning?: EntryLearningCallbacks,
): { wrap: HTMLElement; setLearningSaveState?: (state: LearningSaveControlState) => void } {
  const wrap = el("div", "entry-detail entry-lexicon");

  const header = el("div", "entry-header");
  header.appendChild(el("h3", "entry-headword", d.headword_latin));
  if (d.headword_nko_provided) {
    header.appendChild(el("span", "entry-nko", d.headword_nko_provided));
  }
  if (d.pos_hint || d.ps_raw) {
    header.appendChild(el("span", "entry-pos", d.pos_hint ?? d.ps_raw ?? ""));
  }
  wrap.appendChild(header);

  let setLearningSaveState: ((state: LearningSaveControlState) => void) | undefined;
  if (learning) {
    const control = renderLearningSaveControl(learning);
    wrap.appendChild(control.root);
    setLearningSaveState = control.setState;
  }

  if (d.variants_raw && d.variants_raw.length > 0) {
    wrap.appendChild(el("div", "entry-variants", t("entry.variants", { value: d.variants_raw.join(", ") })));
  }
  if (d.synonyms_raw && d.synonyms_raw.length > 0) {
    wrap.appendChild(el("div", "entry-synonyms", t("entry.synonyms", { value: d.synonyms_raw.join(", ") })));
  }
  if (d.etymology_raw) {
    wrap.appendChild(el("div", "entry-etymology", t("entry.etymology", { value: d.etymology_raw })));
  }
  if (d.literal_meaning_raw) {
    wrap.appendChild(el("div", "entry-literal", t("entry.literal", { value: d.literal_meaning_raw })));
  }

  if (d.senses && d.senses.length > 0) {
    const sensesWrap = el("div", "entry-senses");
    d.senses.forEach((sense, i) => sensesWrap.appendChild(renderSense(sense, i)));
    wrap.appendChild(sensesWrap);
  }

  if (d.corpus_count != null) {
    const meta = el("div", "entry-meta");
    meta.appendChild(el("span", "meta-item", t("entry.meta.corpus", { value: d.corpus_count })));
    wrap.appendChild(meta);
  }

  return { wrap, setLearningSaveState };
}

function renderIndexMapping(
  record: EnrichedRecord,
  d: IndexMappingDisplayFields,
  targetEntriesLabel: string,
  onSearch?: (query: string) => void,
): HTMLElement {
  const wrap = el("div", "entry-detail entry-index");

  const header = el("div", "entry-header");
  header.appendChild(el("h3", "entry-headword", d.source_term));
  wrap.appendChild(header);

  if (d.target_entries && d.target_entries.length > 0) {
    const targets = el("div", "entry-targets");
    targets.appendChild(el("div", "targets-label", targetEntriesLabel));
    for (const target of d.target_entries) {
      if (onSearch) {
        const btn = document.createElement("button");
        btn.className = "target-item target-link";
        btn.type = "button";
        btn.appendChild(el("span", "target-text", target.display_text));
        btn.addEventListener("click", () => onSearch(target.display_text));
        targets.appendChild(btn);
      } else {
        const item = el("div", "target-item");
        item.appendChild(el("span", "target-text", target.display_text));
        targets.appendChild(item);
      }
    }
    wrap.appendChild(targets);
  }

  return wrap;
}

export type EntryDetailCallbacks = {
  onBack: () => void;
  onSearch?: (query: string) => void;
  targetEntriesLabel?: string;
  /** Present only for lexicon entries when the app wants a Learning Save control. */
  learning?: EntryLearningCallbacks;
};

export type EntryDetailView = {
  root: HTMLElement;
  setLearningSaveState?: (state: LearningSaveControlState) => void;
};

/**
 * Render a full entry detail view for a single enriched record.
 * Includes a "Back to results" callback button.
 * If onSearch is provided, target entries in index mappings become clickable.
 */
export function renderEntryDetail(
  record: EnrichedRecord,
  callbacks: EntryDetailCallbacks,
): EntryDetailView {
  const container = el("div", "entry-container");

  const backBtn = document.createElement("button");
  backBtn.className = "btn entry-back";
  backBtn.type = "button";
  backBtn.textContent = t("entry.back");
  backBtn.addEventListener("click", callbacks.onBack);
  container.appendChild(backBtn);

  let setLearningSaveState: ((state: LearningSaveControlState) => void) | undefined;

  if (isLexiconDisplay(record)) {
    const lexicon = renderLexiconEntry(record, record.display, callbacks.learning);
    container.appendChild(lexicon.wrap);
    setLearningSaveState = lexicon.setLearningSaveState;
  } else if (isIndexMappingDisplay(record)) {
    container.appendChild(
      renderIndexMapping(
        record,
        record.display,
        callbacks.targetEntriesLabel ?? t("entry.targetEntriesDefault"),
        callbacks.onSearch,
      ),
    );
  } else {
    container.appendChild(el("div", "entry-error", t("entry.noDisplay")));
  }

  return { root: container, setLearningSaveState };
}
