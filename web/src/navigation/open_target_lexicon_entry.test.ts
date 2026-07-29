import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  deleteSiralexDb,
  openSiralexDb,
  setActiveBundleMeta,
  STORE_RECORDS,
  type ActiveBundleMeta,
} from "../idb/siralex_db";
import type { EnrichedRecord, TargetEntry } from "../types/records";
import {
  openTargetLexiconEntry,
  targetEntryHasResolvableId,
} from "./open_target_lexicon_entry";

const BUNDLE = "bundle_nav_direct";
const HASH = "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SCOPE = `${BUNDLE}::${HASH}`;

function meta(): ActiveBundleMeta {
  return {
    bundle_id: BUNDLE,
    storage_scope_id: SCOPE,
    expected_content_sha256: HASH,
    manifest_schema_version: "bundle_manifest_v1",
    record_schema_id: "normalized_v1",
    record_schema_version: "1",
    normalization_ruleset: "norm_v3",
    update_mode: "REPLACE_ALL",
    reconciliation_action: "REPLACE_ALL",
    imported_at_iso: "2026-07-29T00:00:00.000Z",
  };
}

function lexicon(irId: string, headword: string): EnrichedRecord {
  return {
    ir_id: irId,
    ir_kind: "lexicon_entry",
    source_id: "s",
    norm_version: "norm_v3",
    preferred_form: headword,
    variant_forms: [],
    search_keys: {},
    display: {
      headword_latin: headword,
      senses: [{ gloss_fr: "g" }],
    },
  };
}

async function putRecord(record: EnrichedRecord): Promise<void> {
  const db = await openSiralexDb();
  await setActiveBundleMeta(db, meta());
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_RECORDS, "readwrite");
    tx.objectStore(STORE_RECORDS).put({ ...record, bundle_id: SCOPE });
    tx.addEventListener("complete", () => resolve());
    tx.addEventListener("error", () => reject(tx.error));
    tx.addEventListener("abort", () => reject(tx.error));
  });
  db.close();
}

describe("openTargetLexiconEntry", () => {
  beforeEach(async () => {
    try {
      await deleteSiralexDb();
    } catch {
      // ignore
    }
  });

  it("opens exact lexicon entry by anchor ir_id, switches direction, does not search", async () => {
    const entry = lexicon("lex-bolo", "bólo");
    await putRecord(entry);

    const setDirection = vi.fn();
    const openDetail = vi.fn();
    const onUnavailable = vi.fn();
    const runSearch = vi.fn();
    let searchInput = "main";

    const result = await openTargetLexiconEntry({
      target: {
        lexicon_url: "./lexicon/b",
        anchor: "lex-bolo",
        display_text: "bólo",
      },
      restoreDirection: "source_to_target",
      getActiveMeta: () => meta(),
      openDb: openSiralexDb,
      isCurrent: () => true,
      setDirectionTargetToSource: setDirection,
      openEntryDetail: (record, restoreDirection) => {
        expect(searchInput).toBe("main");
        openDetail(record, restoreDirection);
      },
      onUnavailable,
    });

    expect(result).toBe("opened");
    expect(setDirection).toHaveBeenCalledTimes(1);
    expect(openDetail).toHaveBeenCalledTimes(1);
    expect(openDetail.mock.calls[0]![0].ir_id).toBe("lex-bolo");
    expect(openDetail.mock.calls[0]![0].ir_kind).toBe("lexicon_entry");
    expect(openDetail.mock.calls[0]![1]).toBe("source_to_target");
    expect(onUnavailable).not.toHaveBeenCalled();
    expect(runSearch).not.toHaveBeenCalled();
    expect(searchInput).toBe("main");
  });

  it("does not open or search when ir_id is missing", async () => {
    const setDirection = vi.fn();
    const openDetail = vi.fn();
    const onUnavailable = vi.fn();

    const result = await openTargetLexiconEntry({
      target: { lexicon_url: "x", anchor: "   ", display_text: "bólo" },
      restoreDirection: "source_to_target",
      getActiveMeta: () => meta(),
      openDb: openSiralexDb,
      isCurrent: () => true,
      setDirectionTargetToSource: setDirection,
      openEntryDetail: openDetail,
      onUnavailable,
    });

    expect(result).toBe("unavailable");
    expect(setDirection).not.toHaveBeenCalled();
    expect(openDetail).not.toHaveBeenCalled();
    expect(onUnavailable).toHaveBeenCalledTimes(1);
  });

  it("does not open non-lexicon records and does not change direction", async () => {
    const mapping: EnrichedRecord = {
      ir_id: "idx-1",
      ir_kind: "index_mapping",
      source_id: "s",
      norm_version: "norm_v3",
      preferred_form: "main",
      variant_forms: [],
      search_keys: {},
      display: { source_term: "main", source_lang: "fr", target_entries: [] },
    };
    await putRecord(mapping);

    const setDirection = vi.fn();
    const openDetail = vi.fn();
    const onUnavailable = vi.fn();

    const result = await openTargetLexiconEntry({
      target: { lexicon_url: "x", anchor: "idx-1", display_text: "main" },
      restoreDirection: "source_to_target",
      getActiveMeta: () => meta(),
      openDb: openSiralexDb,
      isCurrent: () => true,
      setDirectionTargetToSource: setDirection,
      openEntryDetail: openDetail,
      onUnavailable,
    });

    expect(result).toBe("unavailable");
    expect(setDirection).not.toHaveBeenCalled();
    expect(openDetail).not.toHaveBeenCalled();
    expect(onUnavailable).toHaveBeenCalled();
  });

  it("resolution failure retains direction and does not open", async () => {
    await putRecord(lexicon("other", "x"));
    const setDirection = vi.fn();
    const openDetail = vi.fn();
    const onUnavailable = vi.fn();

    const result = await openTargetLexiconEntry({
      target: { lexicon_url: "x", anchor: "missing-id", display_text: "bólo" },
      restoreDirection: "source_to_target",
      getActiveMeta: () => meta(),
      openDb: openSiralexDb,
      isCurrent: () => true,
      setDirectionTargetToSource: setDirection,
      openEntryDetail: openDetail,
      onUnavailable,
    });

    expect(result).toBe("unavailable");
    expect(setDirection).not.toHaveBeenCalled();
    expect(openDetail).not.toHaveBeenCalled();
  });

  it("stale resolution does not open or switch direction", async () => {
    await putRecord(lexicon("lex-bolo", "bólo"));
    let current = true;
    const setDirection = vi.fn();
    const openDetail = vi.fn();

    const result = await openTargetLexiconEntry({
      target: { lexicon_url: "x", anchor: "lex-bolo", display_text: "bólo" },
      restoreDirection: "source_to_target",
      getActiveMeta: () => meta(),
      openDb: openSiralexDb,
      isCurrent: () => {
        current = false;
        return current;
      },
      setDirectionTargetToSource: setDirection,
      openEntryDetail: openDetail,
      onUnavailable: vi.fn(),
    });

    expect(result).toBe("stale");
    expect(setDirection).not.toHaveBeenCalled();
    expect(openDetail).not.toHaveBeenCalled();
  });

  it("targetEntryHasResolvableId requires non-empty anchor", () => {
    const ok: TargetEntry = { lexicon_url: "a", anchor: "id", display_text: "x" };
    const bad: TargetEntry = { lexicon_url: "a", anchor: " ", display_text: "x" };
    expect(targetEntryHasResolvableId(ok)).toBe(true);
    expect(targetEntryHasResolvableId(bad)).toBe(false);
  });
});
