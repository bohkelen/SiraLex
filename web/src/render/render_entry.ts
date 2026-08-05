/**
 * Phase 2.0.4 / UX2I4 — Entry detail rendering.
 *
 * Renders a full enriched record: all senses, translations, variant forms,
 * examples, sub-entries, and secondary source metadata.
 *
 * Presentation follows UX2 Contemporary West African Modernism.
 * The renderer does not invent linguistic fields or own Learning/CF1 persistence.
 */

import type {
  EnrichedRecord,
  LexiconDisplayFields,
  IndexMappingDisplayFields,
  SenseRaw,
  ExampleRaw,
  SubEntry,
  TargetEntry,
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

function nkoText(text: string, cls: string): HTMLElement {
  const node = el("div", cls, text);
  node.classList.add("ux2-text-nko");
  node.setAttribute("lang", "nqo");
  node.dir = "rtl";
  return node;
}

function renderLabeledSection(titleKey: "entry.section.variants" | "entry.section.synonyms" | "entry.section.etymology" | "entry.section.literal" | "entry.section.usage" | "entry.section.examples" | "entry.section.subentries" | "entry.section.source", body: HTMLElement): HTMLElement {
  const section = el("section", "ux2-entry-section");
  section.appendChild(el("h4", "ux2-entry-section-title ux2-type-section-heading", t(titleKey)));
  body.classList.add("ux2-entry-section-body");
  section.appendChild(body);
  return section;
}

function renderExample(ex: ExampleRaw): HTMLElement {
  const wrap = el("div", "entry-example ux2-entry-example");
  wrap.appendChild(el("div", "example-text ux2-entry-example-latin", ex.text_latin));
  if (ex.text_nko_provided) {
    wrap.appendChild(nkoText(ex.text_nko_provided, "example-nko ux2-entry-example-nko"));
  }
  if (ex.trans_fr) {
    wrap.appendChild(el("div", "example-trans ux2-entry-example-trans", ex.trans_fr));
  }
  if (ex.trans_en) {
    wrap.appendChild(el("div", "example-trans ux2-entry-example-trans", ex.trans_en));
  }
  if (ex.trans_ru) {
    wrap.appendChild(el("div", "example-trans ux2-entry-example-trans", ex.trans_ru));
  }
  if (ex.source_attribution) {
    wrap.appendChild(el("div", "example-attr ux2-entry-example-attr", ex.source_attribution));
  }
  return wrap;
}

function renderSubEntry(sub: SubEntry): HTMLElement {
  const wrap = el("div", "entry-subentry ux2-entry-subentry");
  wrap.appendChild(el("div", "subentry-text ux2-entry-subentry-text", sub.text));
  if (sub.nko) {
    wrap.appendChild(nkoText(sub.nko, "subentry-nko ux2-entry-subentry-nko"));
  }
  if (sub.gloss_fr) {
    wrap.appendChild(el("div", "subentry-gloss ux2-entry-subentry-gloss", sub.gloss_fr));
  }
  if (sub.gloss_en) {
    wrap.appendChild(el("div", "subentry-gloss ux2-entry-subentry-gloss", sub.gloss_en));
  }
  if (sub.gloss_ru) {
    wrap.appendChild(el("div", "subentry-gloss ux2-entry-subentry-gloss", sub.gloss_ru));
  }
  return wrap;
}

function renderSense(sense: SenseRaw, index: number): HTMLElement {
  const wrap = el("div", "entry-sense ux2-entry-sense");
  const num = sense.sense_num ?? index + 1;

  const header = el("div", "sense-header ux2-entry-sense-header");
  header.appendChild(el("span", "sense-num ux2-entry-sense-num", `${num}`));
  wrap.appendChild(header);

  if (sense.gloss_fr) {
    wrap.appendChild(el("div", "sense-gloss ux2-entry-gloss", sense.gloss_fr));
  }
  if (sense.gloss_en) {
    wrap.appendChild(el("div", "sense-gloss ux2-entry-gloss", sense.gloss_en));
  }
  if (sense.gloss_ru) {
    wrap.appendChild(el("div", "sense-gloss ux2-entry-gloss", sense.gloss_ru));
  }

  if (sense.usage_note) {
    const usageBody = el("div");
    usageBody.appendChild(el("div", "sense-usage", sense.usage_note));
    wrap.appendChild(renderLabeledSection("entry.section.usage", usageBody));
  }
  if (sense.synonyms_raw && sense.synonyms_raw.length > 0) {
    const synBody = el("div");
    synBody.appendChild(el("div", "sense-synonyms", sense.synonyms_raw.join(", ")));
    wrap.appendChild(renderLabeledSection("entry.section.synonyms", synBody));
  }
  if (sense.examples && sense.examples.length > 0) {
    const exWrap = el("div", "sense-examples");
    for (const ex of sense.examples) exWrap.appendChild(renderExample(ex));
    wrap.appendChild(renderLabeledSection("entry.section.examples", exWrap));
  }
  if (sense.sub_entries && sense.sub_entries.length > 0) {
    const subWrap = el("div", "sense-subentries");
    for (const sub of sense.sub_entries) subWrap.appendChild(renderSubEntry(sub));
    wrap.appendChild(renderLabeledSection("entry.section.subentries", subWrap));
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

function bookmarkIconSvg(): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.classList.add("entry-learning-save-icon");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M7 4h10a1 1 0 0 1 1 1v15l-6-3.5L6 20V5a1 1 0 0 1 1-1z");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "2");
  path.setAttribute("stroke-linejoin", "round");
  svg.appendChild(path);
  return svg;
}

function ensureLearningSaveLabel(button: HTMLButtonElement): HTMLElement {
  let label = button.querySelector<HTMLElement>(".entry-learning-save-label");
  if (label && button.querySelector(".entry-learning-save-icon")) return label;
  button.replaceChildren();
  button.appendChild(bookmarkIconSvg());
  label = el("span", "entry-learning-save-label");
  button.appendChild(label);
  return label;
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
  const label = ensureLearningSaveLabel(button);

  switch (state) {
    case "loading":
      label.textContent = t("learning.checking");
      errorEl.hidden = true;
      errorEl.textContent = "";
      break;
    case "not_saved":
      label.textContent = t("learning.save");
      errorEl.hidden = true;
      errorEl.textContent = "";
      break;
    case "saving":
      label.textContent = t("learning.saving");
      errorEl.hidden = true;
      errorEl.textContent = "";
      break;
    case "saved":
      label.textContent = t("learning.saved");
      errorEl.hidden = true;
      errorEl.textContent = "";
      break;
    case "removing":
      label.textContent = t("learning.removing");
      errorEl.hidden = true;
      errorEl.textContent = "";
      break;
    case "error_not_saved":
      label.textContent = t("learning.save");
      errorEl.textContent = t("learning.saveError");
      errorEl.hidden = false;
      break;
    case "error_saved":
      label.textContent = t("learning.saved");
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
  button.className = "btn entry-learning-save ux2-entry-save";
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

function renderEntryActions(
  learning: EntryLearningCallbacks | undefined,
  onSuggestCorrection: (() => void) | undefined,
): {
  root: HTMLElement;
  setLearningSaveState?: (state: LearningSaveControlState) => void;
} {
  const root = el("div", "ux2-entry-actions");
  let setLearningSaveState: ((state: LearningSaveControlState) => void) | undefined;

  if (learning) {
    const control = renderLearningSaveControl(learning);
    root.appendChild(control.root);
    setLearningSaveState = control.setState;
  }

  if (onSuggestCorrection) {
    const actions = el("div", "entry-correction-actions");
    const suggestBtn = document.createElement("button");
    suggestBtn.type = "button";
    suggestBtn.className = "ux2-entry-suggest entry-suggest-correction";
    suggestBtn.id = "entry-suggest-correction";
    suggestBtn.textContent = t("entry.suggestCorrection");
    suggestBtn.addEventListener("click", () => {
      onSuggestCorrection();
    });
    actions.appendChild(suggestBtn);
    root.appendChild(actions);
  }

  return { root, setLearningSaveState };
}

function renderLexiconEntry(
  d: LexiconDisplayFields,
  learning?: EntryLearningCallbacks,
  onSuggestCorrection?: () => void,
): { wrap: HTMLElement; setLearningSaveState?: (state: LearningSaveControlState) => void } {
  const wrap = el("div", "entry-detail entry-lexicon ux2-entry-lexicon");

  const header = el("div", "entry-header ux2-entry-header");
  const orthography = el("div", "ux2-entry-orthography");
  const headword = el("h2", "entry-headword ux2-type-headword-large", d.headword_latin);
  orthography.appendChild(headword);
  if (d.headword_nko_provided) {
    orthography.appendChild(
      nkoText(d.headword_nko_provided, "entry-nko ux2-entry-headword-nko"),
    );
  }
  header.appendChild(orthography);

  const pos = (d.pos_hint ?? d.ps_raw)?.trim();
  if (pos) {
    header.appendChild(el("div", "entry-pos ux2-entry-pos ux2-type-metadata", pos));
  }
  wrap.appendChild(header);

  const actions = renderEntryActions(learning, onSuggestCorrection);
  if (actions.root.childElementCount > 0) {
    wrap.appendChild(actions.root);
  }

  if (d.variants_raw && d.variants_raw.length > 0) {
    const body = el("div");
    body.appendChild(el("div", "entry-variants", d.variants_raw.join(", ")));
    wrap.appendChild(renderLabeledSection("entry.section.variants", body));
  }
  if (d.synonyms_raw && d.synonyms_raw.length > 0) {
    const body = el("div");
    body.appendChild(el("div", "entry-synonyms", d.synonyms_raw.join(", ")));
    wrap.appendChild(renderLabeledSection("entry.section.synonyms", body));
  }
  if (d.etymology_raw) {
    const body = el("div");
    body.appendChild(el("div", "entry-etymology", d.etymology_raw));
    wrap.appendChild(renderLabeledSection("entry.section.etymology", body));
  }
  if (d.literal_meaning_raw) {
    const body = el("div");
    body.appendChild(el("div", "entry-literal", d.literal_meaning_raw));
    wrap.appendChild(renderLabeledSection("entry.section.literal", body));
  }

  if (d.senses && d.senses.length > 0) {
    const sensesWrap = el("div", "entry-senses ux2-entry-senses");
    d.senses.forEach((sense, i) => sensesWrap.appendChild(renderSense(sense, i)));
    wrap.appendChild(sensesWrap);
  }

  if (d.corpus_count != null) {
    const metaBody = el("div", "entry-meta ux2-entry-source-meta");
    metaBody.appendChild(el("span", "meta-item", t("entry.meta.corpus", { value: d.corpus_count })));
    wrap.appendChild(renderLabeledSection("entry.section.source", metaBody));
  }

  return { wrap, setLearningSaveState: actions.setLearningSaveState };
}

function renderIndexMapping(
  d: IndexMappingDisplayFields,
  targetEntriesLabel: string,
  onOpenTargetEntry?: (target: TargetEntry) => void,
): HTMLElement {
  const wrap = el("div", "entry-detail entry-index ux2-entry-index");

  const header = el("div", "entry-header ux2-entry-header");
  header.appendChild(el("h2", "entry-headword ux2-type-headword-large", d.source_term));
  wrap.appendChild(header);

  const status = el("div", "entry-target-status");
  status.id = "entry-target-status";
  status.setAttribute("role", "status");
  status.hidden = true;
  wrap.appendChild(status);

  if (d.target_entries && d.target_entries.length > 0) {
    const targets = el("div", "entry-targets ux2-entry-targets");
    targets.appendChild(el("div", "targets-label ux2-type-section-heading", targetEntriesLabel));
    for (const target of d.target_entries) {
      if (onOpenTargetEntry) {
        const btn = document.createElement("button");
        btn.className = "target-item target-link ux2-entry-target-row";
        btn.type = "button";
        btn.setAttribute(
          "aria-label",
          t("entry.openTarget", { headword: target.display_text }),
        );
        btn.appendChild(el("span", "target-text", target.display_text));
        btn.appendChild(el("span", "ux2-entry-target-chevron", "→"));
        btn.addEventListener("click", () => onOpenTargetEntry(target));
        targets.appendChild(btn);
      } else {
        const item = el("div", "target-item ux2-entry-target-row");
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
  /** Presentation-only Back label; navigation remains owned by the application. */
  backLabel?: string;
  /**
   * Open a target lexicon entry from an index mapping by identity (anchor/ir_id).
   * Must not perform a text search.
   */
  onOpenTargetEntry?: (target: TargetEntry) => void;
  targetEntriesLabel?: string;
  /** Present only for lexicon entries when the app wants a Learning Save control. */
  learning?: EntryLearningCallbacks;
  /**
   * Open the correction suggestion form for this live lexicon entry.
   * Owner supplies fully resolved context; renderer does not invent provenance.
   */
  onSuggestCorrection?: () => void;
};

export type EntryDetailView = {
  root: HTMLElement;
  setLearningSaveState?: (state: LearningSaveControlState) => void;
};

/**
 * Render a full entry detail view for a single enriched record.
 * Includes a Back callback button.
 * If onOpenTargetEntry is provided, target entries in index mappings become
 * clickable for direct lexicon-entry navigation (not text search).
 */
export function renderEntryDetail(
  record: EnrichedRecord,
  callbacks: EntryDetailCallbacks,
): EntryDetailView {
  const container = el("div", "entry-container ux2-entry-container");

  const backBtn = document.createElement("button");
  backBtn.className = "btn entry-back ux2-entry-back";
  backBtn.type = "button";
  backBtn.textContent = callbacks.backLabel ?? t("entry.back");
  backBtn.addEventListener("click", callbacks.onBack);
  container.appendChild(backBtn);

  let setLearningSaveState: ((state: LearningSaveControlState) => void) | undefined;

  if (isLexiconDisplay(record)) {
    const lexicon = renderLexiconEntry(
      record.display,
      callbacks.learning,
      callbacks.onSuggestCorrection,
    );
    container.appendChild(lexicon.wrap);
    setLearningSaveState = lexicon.setLearningSaveState;
  } else if (isIndexMappingDisplay(record)) {
    container.appendChild(
      renderIndexMapping(
        record.display,
        callbacks.targetEntriesLabel ?? t("entry.targetEntriesDefault"),
        callbacks.onOpenTargetEntry,
      ),
    );
  } else {
    container.appendChild(el("div", "entry-error", t("entry.noDisplay")));
  }

  return { root: container, setLearningSaveState };
}

/** Show a non-destructive unavailable message on an open index-mapping surface. */
export function showTargetEntryUnavailable(root: HTMLElement): void {
  const status = root.querySelector<HTMLElement>("#entry-target-status");
  if (!status) return;
  status.hidden = false;
  status.textContent = t("entry.targetUnavailable");
}
