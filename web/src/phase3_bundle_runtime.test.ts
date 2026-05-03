import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { parseAndValidateManifestJson } from "./bundle_manifest";
import {
  deleteBundleData,
  deleteSiralexDb,
  getActiveBundleId,
  getActiveBundleMeta,
  listInstalledBundles,
  openSiralexDb,
  recoverInterruptedBundleInstall,
  setBundleInstallSession,
  setActiveBundleId,
  setActiveBundleMeta,
} from "./idb/siralex_db";
import { importRecordsJsonl } from "./import/import_records";
import { importSearchIndexJsonl } from "./import/import_search_index";
import { resolveRecords } from "./search/resolve_records";
import { searchQuery } from "./search/search_query";

function makeJsonlFile(name: string, rows: unknown[]): File {
  const text = rows.map((row) => JSON.stringify(row)).join("\n") + "\n";
  return new File([text], name, { type: "application/json" });
}

describe("Phase 3 manifest parsing", () => {
  it("accepts legacy manifests without language metadata", () => {
    const result = parseAndValidateManifestJson(
      JSON.stringify({
        manifest_schema_version: "bundle_manifest_v1",
        bundle_id: "bundle_full_legacy_00000000",
        bundle_type: "full",
        bundle_format: "directory",
        compression: "none",
        record_schema_id: "normalized_v1",
        record_schema_version: "1",
        rule_versions: { normalization: "norm_v1" },
        sources: { included: ["src_malipense"], excluded: [] },
        reconciliation_action: "REPLACE_ALL",
        update_mode: "REPLACE_ALL",
        files: [
          { path: "records.jsonl", byte_length: 10, sha256: "sha256:aaa" },
          { path: "search_index.jsonl", byte_length: 20, sha256: "sha256:bbb" },
        ],
        content_sha256: "sha256:ccc",
      }),
    );

    expect(result.ok).toBe(true);
    expect(result.manifest?.languages).toBeUndefined();
    expect(result.manifest?.language_labels).toBeUndefined();
    expect(result.manifest?.scripts).toBeUndefined();
  });

  it("parses optional language metadata when present", () => {
    const result = parseAndValidateManifestJson(
      JSON.stringify({
        manifest_schema_version: "bundle_manifest_v1",
        bundle_id: "bundle_full_lang_11111111",
        bundle_type: "full",
        bundle_format: "directory",
        compression: "none",
        record_schema_id: "normalized_v1",
        record_schema_version: "1",
        rule_versions: { normalization: "norm_v1" },
        sources: { included: ["src_malipense"], excluded: [] },
        reconciliation_action: "REPLACE_ALL",
        update_mode: "REPLACE_ALL",
        languages: { source_lang: "fr", target_lang: "mnk" },
        language_labels: { source: "French", target: "Maninka" },
        scripts: { target_supported: ["latin", "nko"] },
        files: [
          { path: "records.jsonl", byte_length: 10, sha256: "sha256:aaa" },
          { path: "search_index.jsonl", byte_length: 20, sha256: "sha256:bbb" },
        ],
        content_sha256: "sha256:ccc",
      }),
    );

    expect(result.ok).toBe(true);
    expect(result.manifest?.languages).toEqual({ source_lang: "fr", target_lang: "mnk" });
    expect(result.manifest?.language_labels).toEqual({ source: "French", target: "Maninka" });
    expect(result.manifest?.scripts).toEqual({ target_supported: ["latin", "nko"] });
  });

  it("accepts versioned normalization rulesets beyond norm_v1", () => {
    const result = parseAndValidateManifestJson(
      JSON.stringify({
        manifest_schema_version: "bundle_manifest_v1",
        bundle_id: "bundle_full_norm_v2_22222222",
        bundle_type: "full",
        bundle_format: "directory",
        compression: "none",
        record_schema_id: "normalized_v1",
        record_schema_version: "1",
        rule_versions: { normalization: "norm_v2" },
        sources: { included: ["src_malipense"], excluded: [] },
        reconciliation_action: "REPLACE_ALL",
        update_mode: "REPLACE_ALL",
        files: [
          { path: "records.jsonl", byte_length: 10, sha256: "sha256:aaa" },
          { path: "search_index.jsonl", byte_length: 20, sha256: "sha256:bbb" },
        ],
        content_sha256: "sha256:ccc",
      }),
    );

    expect(result.ok).toBe(true);
    expect(result.manifest?.rule_versions.normalization).toBe("norm_v2");
  });
});

describe("Phase 3 bundle-aware runtime", () => {
  beforeEach(async () => {
    try {
      await deleteSiralexDb();
    } catch {
      // fine if db does not exist yet
    }
  });

  it("keeps multiple bundles installed and scopes search to the active bundle", async () => {
    const db = await openSiralexDb();
    try {
      const bundleA = "bundle_full_a_aaaaaaaa";
      const bundleB = "bundle_full_b_bbbbbbbb";

      await importRecordsJsonl(
        db,
        makeJsonlFile("records.jsonl", [
          {
            ir_id: "rec-a",
            ir_kind: "lexicon_entry",
            source_id: "src_a",
            norm_version: "norm_v1",
            preferred_form: "bonjour",
            variant_forms: ["bonjour"],
            search_keys: { casefold: ["bonjour"] },
            display: { headword_latin: "bonjour" },
          },
        ]),
        { bundleId: bundleA, batchSize: 10 },
      );
      await importSearchIndexJsonl(
        db,
        makeJsonlFile("search_index.jsonl", [
          { key_type: "tgt_casefold", key: "hello", ir_ids: ["rec-a"] },
        ]),
        { bundleId: bundleA, batchSize: 10 },
      );
      await setActiveBundleMeta(db, {
        bundle_id: bundleA,
        manifest_schema_version: "bundle_manifest_v1",
        record_schema_id: "normalized_v1",
        record_schema_version: "1",
        normalization_ruleset: "norm_v1",
        update_mode: "REPLACE_ALL",
        reconciliation_action: "REPLACE_ALL",
        imported_at_iso: "2026-03-08T00:00:00Z",
        records_count: 1,
        index_entries_count: 1,
        language_meta: {
          source_lang: "fr",
          target_lang: "mnk",
          source_label: "French",
          target_label: "Maninka",
        },
      });

      await importRecordsJsonl(
        db,
        makeJsonlFile("records.jsonl", [
          {
            ir_id: "rec-b",
            ir_kind: "lexicon_entry",
            source_id: "src_b",
            norm_version: "norm_v1",
            preferred_form: "hello",
            variant_forms: ["hello"],
            search_keys: { casefold: ["hello"] },
            display: { headword_latin: "hello" },
          },
        ]),
        { bundleId: bundleB, batchSize: 10 },
      );
      await importSearchIndexJsonl(
        db,
        makeJsonlFile("search_index.jsonl", [
          { key_type: "tgt_casefold", key: "hello", ir_ids: ["rec-b"] },
        ]),
        { bundleId: bundleB, batchSize: 10 },
      );
      await setActiveBundleMeta(db, {
        bundle_id: bundleB,
        manifest_schema_version: "bundle_manifest_v1",
        record_schema_id: "normalized_v1",
        record_schema_version: "1",
        normalization_ruleset: "norm_v1",
        update_mode: "REPLACE_ALL",
        reconciliation_action: "REPLACE_ALL",
        imported_at_iso: "2026-03-09T00:00:00Z",
        records_count: 1,
        index_entries_count: 1,
        language_meta: {
          source_lang: "fr",
          target_lang: "ff",
          source_label: "French",
          target_label: "Fula",
        },
      });

      const installed = await listInstalledBundles(db);
      expect(installed).toHaveLength(2);

      let active = await getActiveBundleMeta(db);
      expect(active?.bundle_id).toBe(bundleB);

      let result = await searchQuery(db, bundleB, "target_to_source", "hello");
      expect(result.ir_ids).toEqual(["rec-b"]);
      let records = await resolveRecords(db, bundleB, result.ir_ids);
      expect(records.map((record) => record.ir_id)).toEqual(["rec-b"]);

      await setActiveBundleId(db, bundleA);
      active = await getActiveBundleMeta(db);
      expect(active?.bundle_id).toBe(bundleA);

      result = await searchQuery(db, bundleA, "target_to_source", "hello");
      expect(result.ir_ids).toEqual(["rec-a"]);
      records = await resolveRecords(db, bundleA, result.ir_ids);
      expect(records.map((record) => record.ir_id)).toEqual(["rec-a"]);
    } finally {
      db.close();
    }
  });

  it("resolves norm_v2 phrase and N'Ko keys while keeping directions isolated", async () => {
    const db = await openSiralexDb();
    try {
      const bundleId = "bundle_full_norm_v2_search";

      await importRecordsJsonl(
        db,
        makeJsonlFile("records.jsonl", [
          {
            ir_id: "rec-source",
            ir_kind: "index_mapping",
            source_id: "src_malipense",
            norm_version: "norm_v2",
            preferred_form: "a) bon travail! (une salutation), b) merci! (pour un travail)",
            variant_forms: [
              "a) bon travail! (une salutation), b) merci! (pour un travail)",
              "bon travail",
              "merci",
              "bon réveil",
            ],
            search_keys: {
              casefold: ["bon travail", "merci", "bon réveil"],
            },
            display: { source_term: "a) bon travail! (une salutation), b) merci! (pour un travail)" },
          },
          {
            ir_id: "rec-target",
            ir_kind: "lexicon_entry",
            source_id: "src_malipense",
            norm_version: "norm_v2",
            preferred_form: "dàa",
            variant_forms: ["dàa", "ߘߊ߰"],
            search_keys: {
              casefold: ["dàa", "ߘߊ߰"],
            },
            display: { headword_latin: "dàa", headword_nko_provided: "ߘߊ߰" },
          },
        ]),
        { bundleId, batchSize: 10 },
      );
      await importSearchIndexJsonl(
        db,
        makeJsonlFile("search_index.jsonl", [
          { key_type: "src_casefold", key: "bon travail", ir_ids: ["rec-source"] },
          { key_type: "src_casefold", key: "merci", ir_ids: ["rec-source"] },
          { key_type: "src_casefold", key: "bon réveil", ir_ids: ["rec-source"] },
          { key_type: "tgt_casefold", key: "ߘߊ߰", ir_ids: ["rec-target"] },
        ]),
        { bundleId, batchSize: 10 },
      );

      expect((await searchQuery(db, bundleId, "source_to_target", "bon travail")).ir_ids).toEqual(["rec-source"]);
      expect((await searchQuery(db, bundleId, "source_to_target", "merci")).ir_ids).toEqual(["rec-source"]);
      expect((await searchQuery(db, bundleId, "source_to_target", "bon réveil")).ir_ids).toEqual(["rec-source"]);
      expect((await searchQuery(db, bundleId, "source_to_target", "bon re\u0301veil")).ir_ids).toEqual(["rec-source"]);
      expect((await searchQuery(db, bundleId, "target_to_source", "ߘߊ߰")).ir_ids).toEqual(["rec-target"]);

      expect((await searchQuery(db, bundleId, "target_to_source", "bon travail")).ir_ids).toEqual([]);
      expect((await searchQuery(db, bundleId, "source_to_target", "ߘߊ߰")).ir_ids).toEqual([]);
    } finally {
      db.close();
    }
  });

  it("persists the active bundle across reopen and keeps search scoped after reload", async () => {
    let db = await openSiralexDb();
    try {
      const bundleA = "bundle_full_a_aaaaaaaa";
      const bundleB = "bundle_full_b_bbbbbbbb";

      await importRecordsJsonl(
        db,
        makeJsonlFile("records.jsonl", [
          {
            ir_id: "rec-a",
            ir_kind: "lexicon_entry",
            source_id: "src_a",
            norm_version: "norm_v1",
            preferred_form: "alpha",
            variant_forms: ["alpha"],
            search_keys: { casefold: ["hello"] },
            display: { headword_latin: "alpha" },
          },
        ]),
        { bundleId: bundleA, batchSize: 10 },
      );
      await importSearchIndexJsonl(
        db,
        makeJsonlFile("search_index.jsonl", [
          { key_type: "tgt_casefold", key: "hello", ir_ids: ["rec-a"] },
        ]),
        { bundleId: bundleA, batchSize: 10 },
      );
      await setActiveBundleMeta(db, {
        bundle_id: bundleA,
        manifest_schema_version: "bundle_manifest_v1",
        record_schema_id: "normalized_v1",
        record_schema_version: "1",
        normalization_ruleset: "norm_v1",
        update_mode: "REPLACE_ALL",
        reconciliation_action: "REPLACE_ALL",
        imported_at_iso: "2026-03-08T00:00:00Z",
      });

      await importRecordsJsonl(
        db,
        makeJsonlFile("records.jsonl", [
          {
            ir_id: "rec-b",
            ir_kind: "lexicon_entry",
            source_id: "src_b",
            norm_version: "norm_v1",
            preferred_form: "beta",
            variant_forms: ["beta"],
            search_keys: { casefold: ["hello"] },
            display: { headword_latin: "beta" },
          },
        ]),
        { bundleId: bundleB, batchSize: 10 },
      );
      await importSearchIndexJsonl(
        db,
        makeJsonlFile("search_index.jsonl", [
          { key_type: "tgt_casefold", key: "hello", ir_ids: ["rec-b"] },
        ]),
        { bundleId: bundleB, batchSize: 10 },
      );
      await setActiveBundleMeta(db, {
        bundle_id: bundleB,
        manifest_schema_version: "bundle_manifest_v1",
        record_schema_id: "normalized_v1",
        record_schema_version: "1",
        normalization_ruleset: "norm_v1",
        update_mode: "REPLACE_ALL",
        reconciliation_action: "REPLACE_ALL",
        imported_at_iso: "2026-03-09T00:00:00Z",
      });

      await setActiveBundleId(db, bundleA);
    } finally {
      db.close();
    }

    db = await openSiralexDb();
    try {
      expect(await getActiveBundleId(db)).toBe("bundle_full_a_aaaaaaaa");
      const active = await getActiveBundleMeta(db);
      expect(active?.bundle_id).toBe("bundle_full_a_aaaaaaaa");

      const result = await searchQuery(db, "bundle_full_a_aaaaaaaa", "target_to_source", "hello");
      expect(result.ir_ids).toEqual(["rec-a"]);
      const records = await resolveRecords(db, "bundle_full_a_aaaaaaaa", result.ir_ids);
      expect(records.map((record) => record.ir_id)).toEqual(["rec-a"]);
    } finally {
      db.close();
    }
  });

  it("deletes data using storage_scope_id from the registry", async () => {
    const db = await openSiralexDb();
    try {
      await importRecordsJsonl(
        db,
        makeJsonlFile("records.jsonl", [
          {
            ir_id: "rec-staged",
            ir_kind: "lexicon_entry",
            source_id: "src_staged",
            norm_version: "norm_v1",
            preferred_form: "hello",
            variant_forms: ["hello"],
            search_keys: { casefold: ["hello"] },
            display: { headword_latin: "hello" },
          },
        ]),
        { bundleId: "bundle_a::sha256:new", batchSize: 10 },
      );
      await importSearchIndexJsonl(
        db,
        makeJsonlFile("search_index.jsonl", [
          { key_type: "tgt_casefold", key: "hello", ir_ids: ["rec-staged"] },
        ]),
        { bundleId: "bundle_a::sha256:new", batchSize: 10 },
      );
      await setActiveBundleMeta(db, {
        bundle_id: "bundle_a",
        storage_scope_id: "bundle_a::sha256:new",
        manifest_schema_version: "bundle_manifest_v1",
        record_schema_id: "normalized_v1",
        record_schema_version: "1",
        normalization_ruleset: "norm_v1",
        update_mode: "REPLACE_ALL",
        reconciliation_action: "REPLACE_ALL",
        imported_at_iso: "2026-03-10T00:00:00Z",
      });

      let result = await searchQuery(db, "bundle_a::sha256:new", "target_to_source", "hello");
      expect(result.ir_ids).toEqual(["rec-staged"]);

      await deleteBundleData(db, "bundle_a");

      result = await searchQuery(db, "bundle_a::sha256:new", "target_to_source", "hello");
      expect(result.ir_ids).toEqual([]);
    } finally {
      db.close();
    }
  });

  it("recovers interrupted committed installs by cleaning previous storage scope", async () => {
    const db = await openSiralexDb();
    try {
      await importRecordsJsonl(
        db,
        makeJsonlFile("records.jsonl", [
          {
            ir_id: "rec-old",
            ir_kind: "lexicon_entry",
            source_id: "src_old",
            norm_version: "norm_v1",
            preferred_form: "old",
            variant_forms: ["old"],
            search_keys: { casefold: ["old"] },
            display: { headword_latin: "old" },
          },
        ]),
        { bundleId: "bundle_a", batchSize: 10 },
      );
      await setBundleInstallSession(db, {
        bundle_id: "bundle_a",
        storage_scope_id: "bundle_a::sha256:new",
        previous_storage_scope_id: "bundle_a",
        started_at_iso: "2026-03-10T00:00:00Z",
        phase: "committed",
      });

      const message = await recoverInterruptedBundleInstall(db);
      expect(message).toContain("Recovered committed install");

      const result = await searchQuery(db, "bundle_a", "target_to_source", "old");
      expect(result.ir_ids).toEqual([]);
    } finally {
      db.close();
    }
  });

  it("filters search to the selected direction within a bilingual bundle", async () => {
    const db = await openSiralexDb();
    try {
      const bundleId = "bundle_full_bilingual_aaaaaaaa";

      await importRecordsJsonl(
        db,
        makeJsonlFile("records.jsonl", [
          {
            ir_id: "rec-source",
            ir_kind: "index_mapping",
            source_id: "src_index",
            norm_version: "norm_v1",
            preferred_form: "abandonner",
            variant_forms: ["abandonner"],
            search_keys: { casefold: ["abandonner"] },
            display: {
              source_term: "abandonner",
              source_lang: "fr",
              target_entries: [{ lexicon_url: "../lexicon/b.htm", anchor: "e1", display_text: "bàn" }],
            },
          },
          {
            ir_id: "rec-target",
            ir_kind: "lexicon_entry",
            source_id: "src_lexicon",
            norm_version: "norm_v1",
            preferred_form: "bàn",
            variant_forms: ["bàn"],
            search_keys: { casefold: ["bàn"] },
            display: { headword_latin: "bàn" },
          },
        ]),
        { bundleId, batchSize: 10 },
      );
      await importSearchIndexJsonl(
        db,
        makeJsonlFile("search_index.jsonl", [
          { key_type: "src_casefold", key: "abandonner", ir_ids: ["rec-source"] },
          { key_type: "tgt_casefold", key: "bàn", ir_ids: ["rec-target"] },
        ]),
        { bundleId, batchSize: 10 },
      );

      expect((await searchQuery(db, bundleId, "source_to_target", "abandonner")).ir_ids).toEqual(["rec-source"]);
      expect((await searchQuery(db, bundleId, "target_to_source", "bàn")).ir_ids).toEqual(["rec-target"]);
      expect((await searchQuery(db, bundleId, "source_to_target", "bàn")).ir_ids).toEqual([]);
      expect((await searchQuery(db, bundleId, "target_to_source", "abandonner")).ir_ids).toEqual([]);
    } finally {
      db.close();
    }
  });

  it("fails closed when a bundle only contains one direction family", async () => {
    const db = await openSiralexDb();
    try {
      const bundleId = "bundle_full_target_only_aaaaaaaa";

      await importRecordsJsonl(
        db,
        makeJsonlFile("records.jsonl", [
          {
            ir_id: "rec-target",
            ir_kind: "lexicon_entry",
            source_id: "src_lexicon",
            norm_version: "norm_v1",
            preferred_form: "bàn",
            variant_forms: ["bàn"],
            search_keys: { casefold: ["bàn"] },
            display: { headword_latin: "bàn" },
          },
        ]),
        { bundleId, batchSize: 10 },
      );
      await importSearchIndexJsonl(
        db,
        makeJsonlFile("search_index.jsonl", [
          { key_type: "tgt_casefold", key: "bàn", ir_ids: ["rec-target"] },
        ]),
        { bundleId, batchSize: 10 },
      );

      expect((await searchQuery(db, bundleId, "target_to_source", "bàn")).ir_ids).toEqual(["rec-target"]);
      expect((await searchQuery(db, bundleId, "source_to_target", "bàn")).ir_ids).toEqual([]);
    } finally {
      db.close();
    }
  });

  it("falls back to undirected key types for bundles built before Phase 4.2.5", async () => {
    const db = await openSiralexDb();
    try {
      const bundleId = "bundle_legacy_undirected_keys";

      await importRecordsJsonl(
        db,
        makeJsonlFile("records.jsonl", [
          {
            ir_id: "rec-ouverture",
            ir_kind: "index_mapping",
            source_id: "src_malipense",
            norm_version: "norm_v1",
            preferred_form: "ouverture",
            variant_forms: ["ouverture"],
            search_keys: { casefold: ["ouverture"], diacritics_insensitive: ["ouverture"] },
            display: {
              source_term: "ouverture",
              source_lang: "fr",
              target_entries: [{ lexicon_url: "../lexicon/d.htm", anchor: "e2204", display_text: "dá" }],
            },
          },
        ]),
        { bundleId, batchSize: 10 },
      );
      // Legacy format: undirected key_type (no src_ / tgt_ prefix)
      await importSearchIndexJsonl(
        db,
        makeJsonlFile("search_index.jsonl", [
          { key_type: "casefold", key: "ouverture", ir_ids: ["rec-ouverture"] },
          { key_type: "diacritics_insensitive", key: "ouverture", ir_ids: ["rec-ouverture"] },
        ]),
        { bundleId, batchSize: 10 },
      );

      expect((await searchQuery(db, bundleId, "source_to_target", "ouverture")).ir_ids).toEqual(["rec-ouverture"]);
      expect((await searchQuery(db, bundleId, "target_to_source", "ouverture")).ir_ids).toEqual(["rec-ouverture"]);
    } finally {
      db.close();
    }
  });
});
