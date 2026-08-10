/**
 * RL1 — Historical CF1 Russian translation drafts remain valid/manageable,
 * while new consumer capture must not offer RU targets.
 */

// @vitest-environment jsdom

import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import {
  deleteSiralexDb,
  openSiralexDb,
  putInstalledBundleMeta,
  type ActiveBundleMeta,
} from "../idb/siralex_db";
import { setCurrentLocale, t } from "../i18n";
import { formatCorrectionManagementTargetLabel } from "../render/render_correction_management";
import type { EnrichedRecord } from "../types/records";
import { buildCorrectionFeedbackExportArtifact } from "./correction_feedback_export";
import { parseCorrectionFeedbackJson } from "./correction_feedback_package";
import {
  createCorrectionDraft,
  deleteCorrectionDraft,
  getCorrectionDraft,
  type CreateCorrectionDraftInput,
} from "./correction_draft_store";
import {
  CORRECTION_DRAFT_SCHEMA_VERSION,
  parseCorrectionDraft,
} from "./correction_draft_types";
import {
  buildCorrectionTargetOptions,
  isConsumerCreatableCorrectionTarget,
} from "./correction_form_model";
import {
  createCorrectionManagementSession,
  type CorrectionManagementVm,
} from "./correction_management_session";

const HASH =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const TS = "2026-07-31T18:00:00.000Z";
const TS2 = "2026-07-31T19:00:00.000Z";

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
    imported_at_iso: TS,
  };
}

function lexiconWithRu(): EnrichedRecord {
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
      senses: [
        {
          gloss_fr: "tête",
          gloss_en: "head",
          gloss_ru: "голова",
        },
      ],
    },
  };
}

function historicalRuInput(
  overrides: Partial<CreateCorrectionDraftInput> = {},
): CreateCorrectionDraftInput {
  return {
    bundle_id: "bundle_a",
    ir_id: "lex-1",
    ir_kind: "lexicon_entry",
    content_sha256: HASH,
    storage_scope_id: `bundle_a::${HASH}`,
    issue_type: "translation_or_gloss",
    mode: "problem_report",
    target: { type: "translation", sense_index: 0, gloss_lang: "ru" },
    display_snapshot: {
      headword_latin: "kùn",
      selected_gloss: "голова",
    },
    problem_description: "Historical RU meaning looks off",
    ...overrides,
  };
}

describe("RL1 historical CF1 RU drafts", () => {
  beforeEach(async () => {
    setCurrentLocale("en");
    await deleteSiralexDb();
  });

  it("validator accepts historical RU translation target under existing schema", () => {
    const parsed = parseCorrectionDraft({
      schema_version: CORRECTION_DRAFT_SCHEMA_VERSION,
      draft_id: "draft-ru-1",
      bundle_id: "bundle_a",
      ir_id: "lex-1",
      ir_kind: "lexicon_entry",
      content_sha256: HASH,
      storage_scope_id: `bundle_a::${HASH}`,
      issue_type: "translation_or_gloss",
      mode: "problem_report",
      target: { type: "translation", sense_index: 0, gloss_lang: "ru" },
      display_snapshot: { headword_latin: "kùn", selected_gloss: "голова" },
      problem_description: "ok",
      created_at: TS,
      updated_at: TS,
      status: "draft",
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.draft.target).toEqual({
      type: "translation",
      sense_index: 0,
      gloss_lang: "ru",
    });
  });

  it("new target generation omits RU while live entry retains gloss_ru", () => {
    const entry = lexiconWithRu();
    const options = buildCorrectionTargetOptions(entry);
    expect(options.map((o) => o.key)).toContain("translation:0:fr");
    expect(options.map((o) => o.key)).toContain("translation:0:en");
    expect(options.map((o) => o.key)).not.toContain("translation:0:ru");
    expect(
      isConsumerCreatableCorrectionTarget({
        type: "translation",
        sense_index: 0,
        gloss_lang: "ru",
      }),
    ).toBe(false);
    expect(
      isConsumerCreatableCorrectionTarget({
        type: "translation",
        sense_index: 0,
        gloss_lang: "fr",
      }),
    ).toBe(true);
    expect(
      (entry.display as { senses: { gloss_ru?: string }[] }).senses[0]?.gloss_ru,
    ).toBe("голова");
  });

  it("management identifies RU; edit retains target; export preserves ru; delete works", async () => {
    const db = await openSiralexDb();
    await putInstalledBundleMeta(db, meta());
    const created = await createCorrectionDraft(db, historicalRuInput(), {
      now: () => TS,
      generateDraftId: () => "draft-ru-hist",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect(formatCorrectionManagementTargetLabel(created.draft.target)).toBe(
      t("correctionFeedback.manage.target.translationRuOnly", { n: 1 }),
    );

    const models: CorrectionManagementVm[] = [];
    const session = createCorrectionManagementSession({
      openDb: async () => db,
      dbOwnership: "caller_owned",
      now: () => TS2,
      isCurrent: () => true,
      onModel: (vm) => {
        models.push(structuredClone(vm));
      },
      resolveLiveEntry: async () => lexiconWithRu(),
    });

    await session.load();
    await session.openDetail("draft-ru-hist");
    const detail = models[models.length - 1]!;
    expect(detail.selected?.target).toEqual({
      type: "translation",
      sense_index: 0,
      gloss_lang: "ru",
    });

    session.startEdit();
    const editing = models[models.length - 1]!;
    // RU key absent from new-capture options → retarget disabled; target immutable.
    expect(editing.editRetargetAllowed).toBe(false);
    session.setEditProblemDescription("Updated historical RU description");
    await session.saveEdit();

    const afterEdit = await getCorrectionDraft(db, "draft-ru-hist");
    expect(afterEdit?.target).toEqual({
      type: "translation",
      sense_index: 0,
      gloss_lang: "ru",
    });
    expect(afterEdit?.problem_description).toBe("Updated historical RU description");
    expect(afterEdit?.display_snapshot.selected_gloss).toBe("голова");

    const exported = buildCorrectionFeedbackExportArtifact([afterEdit!], {
      exportedAt: TS2,
    });
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    const parsed = parseCorrectionFeedbackJson(exported.artifact.text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const draft = parsed.package.drafts.find((d) => d.draft_id === "draft-ru-hist");
    expect(draft?.target).toEqual({
      type: "translation",
      sense_index: 0,
      gloss_lang: "ru",
    });
    expect(JSON.stringify(parsed.package)).toContain('"gloss_lang":"ru"');

    const deleted = await deleteCorrectionDraft(db, "draft-ru-hist", {
      expectedUpdatedAt: afterEdit!.updated_at,
    });
    expect(deleted.ok).toBe(true);
    expect(await getCorrectionDraft(db, "draft-ru-hist")).toBeUndefined();

    session.dispose();
    db.close();
  });
});
