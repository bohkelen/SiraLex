/**
 * Phase 2.0.4 — Entry detail rendering.
 *
 * Renders a full enriched record: all senses, translations, variant forms,
 * examples, sub-entries, and provenance metadata.
 *
 * No styling polish, no animations — functional rendering that proves
 * the enriched records are consumable by a human.
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
    wrap.appendChild(el("div", "sense-usage", `Usage: ${sense.usage_note}`));
  }
  if (sense.synonyms_raw && sense.synonyms_raw.length > 0) {
    wrap.appendChild(el("div", "sense-synonyms", `Syn: ${sense.synonyms_raw.join(", ")}`));
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

function renderLexiconEntry(record: EnrichedRecord, d: LexiconDisplayFields): HTMLElement {
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

  if (d.variants_raw && d.variants_raw.length > 0) {
    wrap.appendChild(el("div", "entry-variants", `Variants: ${d.variants_raw.join(", ")}`));
  }
  if (d.synonyms_raw && d.synonyms_raw.length > 0) {
    wrap.appendChild(el("div", "entry-synonyms", `Synonyms: ${d.synonyms_raw.join(", ")}`));
  }
  if (d.etymology_raw) {
    wrap.appendChild(el("div", "entry-etymology", `Etymology: ${d.etymology_raw}`));
  }
  if (d.literal_meaning_raw) {
    wrap.appendChild(el("div", "entry-literal", `Literal: ${d.literal_meaning_raw}`));
  }

  if (d.senses && d.senses.length > 0) {
    const sensesWrap = el("div", "entry-senses");
    d.senses.forEach((sense, i) => sensesWrap.appendChild(renderSense(sense, i)));
    wrap.appendChild(sensesWrap);
  }

  const meta = el("div", "entry-meta");
  meta.appendChild(el("span", "meta-item", `ir_id: ${record.ir_id}`));
  meta.appendChild(el("span", "meta-item", `source: ${record.source_id}`));
  meta.appendChild(el("span", "meta-item", `norm: ${record.norm_version}`));
  if (d.corpus_count != null) {
    meta.appendChild(el("span", "meta-item", `corpus: ${d.corpus_count}`));
  }
  wrap.appendChild(meta);

  return wrap;
}

function renderIndexMapping(
  record: EnrichedRecord,
  d: IndexMappingDisplayFields,
  onSearch?: (query: string) => void,
): HTMLElement {
  const wrap = el("div", "entry-detail entry-index");

  const header = el("div", "entry-header");
  header.appendChild(el("h3", "entry-headword", d.source_term));
  header.appendChild(el("span", "entry-pos", d.source_lang));
  wrap.appendChild(header);

  if (d.target_entries && d.target_entries.length > 0) {
    const targets = el("div", "entry-targets");
    targets.appendChild(el("div", "targets-label", "Maninka entries:"));
    for (const t of d.target_entries) {
      if (onSearch) {
        const btn = document.createElement("button");
        btn.className = "target-item target-link";
        btn.type = "button";
        btn.appendChild(el("span", "target-text", t.display_text));
        btn.appendChild(el("span", "target-ref", ` (${t.anchor})`));
        btn.addEventListener("click", () => onSearch(t.display_text));
        targets.appendChild(btn);
      } else {
        const item = el("div", "target-item");
        item.appendChild(el("span", "target-text", t.display_text));
        item.appendChild(el("span", "target-ref", ` (${t.anchor})`));
        targets.appendChild(item);
      }
    }
    wrap.appendChild(targets);
  }

  const meta = el("div", "entry-meta");
  meta.appendChild(el("span", "meta-item", `ir_id: ${record.ir_id}`));
  meta.appendChild(el("span", "meta-item", `source: ${record.source_id}`));
  meta.appendChild(el("span", "meta-item", `norm: ${record.norm_version}`));
  wrap.appendChild(meta);

  return wrap;
}

export type EntryDetailCallbacks = {
  onBack: () => void;
  onSearch?: (query: string) => void;
};

/**
 * Render a full entry detail view for a single enriched record.
 * Includes a "Back to results" callback button.
 * If onSearch is provided, target entries in index mappings become clickable.
 */
export function renderEntryDetail(
  record: EnrichedRecord,
  callbacks: EntryDetailCallbacks,
): HTMLElement {
  const container = el("div", "entry-container");

  const backBtn = document.createElement("button");
  backBtn.className = "btn entry-back";
  backBtn.type = "button";
  backBtn.textContent = "\u2190 Back to results";
  backBtn.addEventListener("click", callbacks.onBack);
  container.appendChild(backBtn);

  if (isLexiconDisplay(record)) {
    container.appendChild(renderLexiconEntry(record, record.display));
  } else if (isIndexMappingDisplay(record)) {
    container.appendChild(renderIndexMapping(record, record.display, callbacks.onSearch));
  } else {
    container.appendChild(el("div", "entry-error", `No display data for ir_id: ${record.ir_id}`));
  }

  return container;
}
