// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import { setCurrentLocale, t } from "../i18n";
import {
  buildCorrectionEntryContext,
  buildCorrectionFormViewModel,
  createInitialCorrectionFormFields,
  type CorrectionFormViewModel,
} from "../corrections/correction_form_model";
import type { ActiveBundleMeta } from "../idb/siralex_db";
import type { EnrichedRecord } from "../types/records";
import { renderCorrectionForm } from "./render_correction_form";

const HASH =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function meta(): ActiveBundleMeta {
  return {
    bundle_id: "bundle_a",
    storage_scope_id: `bundle_a::${HASH}`,
    manifest_schema_version: "1",
    record_schema_id: "enriched_record_v1",
    record_schema_version: "1",
    normalization_ruleset: "norm_v3",
    update_mode: "replace",
    reconciliation_action: "none",
    expected_content_sha256: HASH,
    imported_at_iso: "2026-07-31T18:00:00.000Z",
  };
}

function lexicon(): EnrichedRecord {
  return {
    ir_id: "lex-1",
    ir_kind: "lexicon_entry",
    source_id: "src",
    norm_version: "n",
    preferred_form: "kùn",
    variant_forms: [],
    search_keys: {},
    display: {
      headword_latin: "kùn",
      headword_nko_provided: "ߞߎ߲",
      ps_raw: "n",
      senses: [{ gloss_fr: "tête" }],
    },
  };
}

function baseVm(overrides: Partial<CorrectionFormViewModel> = {}): CorrectionFormViewModel {
  const context = buildCorrectionEntryContext(lexicon(), meta())!;
  const fields = createInitialCorrectionFormFields();
  return {
    ...buildCorrectionFormViewModel({ state: "ready", context, fields }),
    ...overrides,
  };
}

describe("renderCorrectionForm", () => {
  beforeEach(() => {
    setCurrentLocale("en");
    document.body.innerHTML = "";
  });

  it("renders heading, privacy, issues, target, mode, counters; no Submit/internal IDs", () => {
    const callbacks = {
      onIssueTypeChange: vi.fn(),
      onTargetChange: vi.fn(),
      onModeChange: vi.fn(),
      onProblemDescriptionChange: vi.fn(),
      onProposedValueChange: vi.fn(),
      onOtherFieldLabelChange: vi.fn(),
      onSave: vi.fn(),
      onCancel: vi.fn(),
      onBackToEntry: vi.fn(),
    };
    const { root } = renderCorrectionForm(baseVm(), callbacks);
    document.body.appendChild(root);

    expect(root.querySelector("#correction-form-heading")?.textContent).toBe(
      "Suggest a correction",
    );
    expect(root.textContent).toContain("local draft only");
    expect(root.textContent).not.toMatch(/submit/i);
    expect(root.textContent).not.toContain(HASH);
    expect(root.textContent).not.toContain("lex-1");
    expect(root.textContent).not.toContain("storage_scope");

    const issue = root.querySelector<HTMLSelectElement>("#correction-form-issue");
    expect(issue).not.toBeNull();
    expect([...issue!.options].map((o) => o.textContent)).toEqual(
      expect.arrayContaining([
        "Spelling",
        "Translation or meaning",
        "Part of speech",
        "N’Ko",
        "Example",
        "Usage or context",
        "Missing information",
        "Duplicate or incorrect sense",
        "Other",
      ]),
    );

    expect(root.querySelector("fieldset.correction-form-mode legend")?.textContent).toBe(
      "Response mode",
    );
    expect(root.querySelector("#correction-form-proposed")).toBeNull();
    expect(root.querySelector("#correction-form-description-count")?.textContent).toContain("0 /");

    const nko = root.querySelector(".correction-form-entry-nko");
    expect(nko?.textContent).toBe("ߞߎ߲");
    expect(nko?.getAttribute("lang")).toBe("nqo");

    root.querySelector<HTMLButtonElement>("#correction-form-cancel")?.click();
    expect(callbacks.onCancel).toHaveBeenCalled();
  });

  it("shows FR labels without English fallbacks and conditional proposed/other fields", () => {
    setCurrentLocale("fr");
    const context = buildCorrectionEntryContext(lexicon(), meta())!;
    const fields = createInitialCorrectionFormFields();
    fields.mode = "proposed_correction";
    fields.target_key = "other_field";
    const vm = buildCorrectionFormViewModel({ state: "ready", context, fields });
    const { root } = renderCorrectionForm(vm, {
      onIssueTypeChange: vi.fn(),
      onTargetChange: vi.fn(),
      onModeChange: vi.fn(),
      onProblemDescriptionChange: vi.fn(),
      onProposedValueChange: vi.fn(),
      onOtherFieldLabelChange: vi.fn(),
      onSave: vi.fn(),
      onCancel: vi.fn(),
      onBackToEntry: vi.fn(),
    });
    expect(root.querySelector("#correction-form-heading")?.textContent).toBe(
      t("correctionFeedback.form.heading"),
    );
    expect(root.textContent).toContain("Suggérer une correction");
    expect(root.textContent).toContain("Signaler un problème");
    expect(root.textContent).toContain("Proposer une correction");
    expect(root.textContent).not.toContain("Suggest a correction");
    expect(root.querySelector("#correction-form-proposed")).not.toBeNull();
    expect(root.querySelector("#correction-form-field-label")).not.toBeNull();
  });

  it("renders busy, stale, success, error summary, and keyboard Save", () => {
    const onSave = vi.fn();
    const onBack = vi.fn();
    const context = buildCorrectionEntryContext(lexicon(), meta())!;
    const fields = createInitialCorrectionFormFields();
    fields.issue_type = "other";
    fields.problem_description = "x";

    const busy = buildCorrectionFormViewModel({ state: "saving", context, fields });
    const view = renderCorrectionForm(busy, {
      onIssueTypeChange: vi.fn(),
      onTargetChange: vi.fn(),
      onModeChange: vi.fn(),
      onProblemDescriptionChange: vi.fn(),
      onProposedValueChange: vi.fn(),
      onOtherFieldLabelChange: vi.fn(),
      onSave,
      onCancel: vi.fn(),
      onBackToEntry: onBack,
    });
    document.body.appendChild(view.root);
    expect(view.root.getAttribute("aria-busy")).toBe("true");
    expect(view.root.querySelector<HTMLButtonElement>("#correction-form-save")?.disabled).toBe(
      true,
    );

    const invalid = buildCorrectionFormViewModel({
      state: "invalid",
      context,
      fields: createInitialCorrectionFormFields(),
      errors: { issue_type: "required", problem_description: "required" },
      errorCode: "invalid_fields",
    });
    view.update(invalid);
    expect(view.root.querySelector("#correction-form-error-summary")).not.toBeNull();

    const stale = buildCorrectionFormViewModel({
      state: "stale_context",
      context,
      fields,
      errorCode: "entry_context_changed",
    });
    view.update(stale);
    expect(view.root.textContent).toContain("no longer available");
    expect(view.root.querySelector<HTMLButtonElement>("#correction-form-save")?.disabled).toBe(
      true,
    );
    expect(view.root.querySelector<HTMLButtonElement>("#correction-form-cancel")?.disabled).toBe(
      false,
    );

    const saved = buildCorrectionFormViewModel({
      state: "saved",
      context,
      fields,
      draft_id: "d1",
    });
    view.update(saved);
    expect(view.root.textContent).toContain("Correction draft saved on this device");
    expect(view.root.textContent).toContain("has not been submitted");
    view.root.querySelector<HTMLButtonElement>("#correction-form-back")?.click();
    expect(onBack).toHaveBeenCalled();

    // Keyboard Save from ready state
    const ready = buildCorrectionFormViewModel({ state: "ready", context, fields });
    view.update(ready);
    const save = view.root.querySelector<HTMLButtonElement>("#correction-form-save")!;
    save.focus();
    save.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    save.click();
    expect(onSave).toHaveBeenCalled();
  });
});
