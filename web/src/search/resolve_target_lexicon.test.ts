import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import {
  deleteSiralexDb,
  openSiralexDb,
  STORE_RECORDS,
} from "../idb/siralex_db";
import type { EnrichedRecord } from "../types/records";
import {
  findLexiconBySourceRecordId,
  resolveTargetLexiconEntry,
} from "./resolve_target_lexicon";

const SCOPE = "bundle_feat::sha256:abc";

async function put(record: EnrichedRecord): Promise<void> {
  const db = await openSiralexDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_RECORDS, "readwrite");
    tx.objectStore(STORE_RECORDS).put({ ...record, bundle_id: SCOPE });
    tx.addEventListener("complete", () => resolve());
    tx.addEventListener("error", () => reject(tx.error));
    tx.addEventListener("abort", () => reject(tx.error));
  });
  db.close();
}

describe("resolveTargetLexiconEntry", () => {
  beforeEach(async () => {
    try {
      await deleteSiralexDb();
    } catch {
      // ignore
    }
  });

  it("resolves featured-style anchor via record_locator.source_record_id", async () => {
    const entry: EnrichedRecord = {
      ir_id: "2847e86214f9f870",
      ir_kind: "lexicon_entry",
      source_id: "src_malipense",
      norm_version: "norm_v3",
      preferred_form: "bólo",
      variant_forms: [],
      search_keys: {},
      display: {
        headword_latin: "bólo",
        senses: [{ gloss_fr: "main" }],
      },
      record_locator: {
        kind: "source_record_id",
        url_canonical: "https://www.mali-pense.net/emk/lexicon/b.htm",
        source_record_id: "e1385",
      },
    };
    await put(entry);

    const db = await openSiralexDb();
    const found = await resolveTargetLexiconEntry(db, SCOPE, {
      lexicon_url: "../lexicon/b.htm",
      anchor: "e1385",
      display_text: "bólo",
    });
    expect(found?.ir_id).toBe("2847e86214f9f870");
    expect(found?.ir_kind).toBe("lexicon_entry");
    db.close();
  });

  it("still resolves when anchor is the ir_id (debug fixtures)", async () => {
    const entry: EnrichedRecord = {
      ir_id: "diag_lex_alpha",
      ir_kind: "lexicon_entry",
      source_id: "s",
      norm_version: "norm_v3",
      preferred_form: "alpha_mnk",
      variant_forms: [],
      search_keys: {},
      display: { headword_latin: "alpha_mnk", senses: [{ gloss_fr: "a" }] },
    };
    await put(entry);

    const db = await openSiralexDb();
    const found = await resolveTargetLexiconEntry(db, SCOPE, {
      lexicon_url: "./lexicon/alpha",
      anchor: "diag_lex_alpha",
      display_text: "alpha_mnk",
    });
    expect(found?.ir_id).toBe("diag_lex_alpha");
    db.close();
  });

  it("does not match unrelated source_record_id or invent by display text", async () => {
    await put({
      ir_id: "other",
      ir_kind: "lexicon_entry",
      source_id: "s",
      norm_version: "norm_v3",
      preferred_form: "bólo",
      variant_forms: [],
      search_keys: {},
      display: { headword_latin: "bólo", senses: [{ gloss_fr: "x" }] },
      record_locator: { source_record_id: "e9999" },
    });

    const db = await openSiralexDb();
    expect(
      await findLexiconBySourceRecordId(db, SCOPE, "e1385"),
    ).toBeUndefined();
    expect(
      await resolveTargetLexiconEntry(db, SCOPE, {
        lexicon_url: "../lexicon/b.htm",
        anchor: "e1385",
        display_text: "bólo",
      }),
    ).toBeUndefined();
    db.close();
  });
});
