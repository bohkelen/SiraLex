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
import { installBundleIntoDb } from "./install/bundle_install";
import { resolveRecords } from "./search/resolve_records";
import { searchQuery } from "./search/search_query";

function makeJsonlFile(name: string, rows: unknown[]): File {
  const text = rows.map((row) => JSON.stringify(row)).join("\n") + "\n";
  return new File([text], name, { type: "application/json" });
}

describe("Phase 3 manifest parsing", () => {
  it("accepts additive multilingual capability metadata", () => {
    const result = parseAndValidateManifestJson(
      JSON.stringify({
        manifest_schema_version: "bundle_manifest_v1",
        bundle_id: "bundle_full_20260710_337619ff",
        bundle_type: "full",
        bundle_format: "directory",
        compression: "none",
        record_schema_id: "normalized_v1",
        record_schema_version: "1",
        rule_versions: { normalization: "norm_v3", en_gloss_key: "en_gloss_key_v1" },
        sources: { included: ["src_malipense"], excluded: [] },
        reconciliation_action: "REPLACE_ALL",
        update_mode: "REPLACE_ALL",
        search_index_directional: true,
        search_key_families: ["en", "src", "tgt"],
        languages: {
          source_lang: "fr",
          target_lang: "mnk",
          lexical_language: "mnk",
          lookup_languages: ["fr", "en", "mnk"],
        },
        files: [
          { path: "records.jsonl", byte_length: 1, sha256: "sha256:aa" },
          { path: "search_index.jsonl", byte_length: 1, sha256: "sha256:bb" },
        ],
        content_sha256: "sha256:" + "a".repeat(64),
      }),
    );
    expect(result.ok).toBe(true);
    expect(result.manifest?.search_key_families).toEqual(["en", "src", "tgt"]);
    expect(result.manifest?.languages).toEqual({
      source_lang: "fr",
      target_lang: "mnk",
      lexical_language: "mnk",
      lookup_languages: ["fr", "en", "mnk"],
    });
    expect(result.manifest?.rule_versions.en_gloss_key).toBe("en_gloss_key_v1");
  });

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
    expect(result.manifest?.search_index_directional).toBeUndefined();
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

  it("accepts norm_v3 normalization ruleset in manifests", () => {
    const result = parseAndValidateManifestJson(
      JSON.stringify({
        manifest_schema_version: "bundle_manifest_v1",
        bundle_id: "bundle_full_norm_v3_aaaaaaaa",
        bundle_type: "full",
        bundle_format: "directory",
        compression: "none",
        record_schema_id: "normalized_v1",
        record_schema_version: "1",
        rule_versions: { normalization: "norm_v3" },
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
    expect(result.manifest?.rule_versions.normalization).toBe("norm_v3");
  });

  it("parses search_index_directional when present", () => {
    const result = parseAndValidateManifestJson(
      JSON.stringify({
        manifest_schema_version: "bundle_manifest_v1",
        bundle_id: "bundle_full_directional_33333333",
        bundle_type: "full",
        bundle_format: "directory",
        compression: "none",
        record_schema_id: "normalized_v1",
        record_schema_version: "1",
        rule_versions: { normalization: "norm_v2" },
        sources: { included: ["src_malipense"], excluded: [] },
        reconciliation_action: "REPLACE_ALL",
        update_mode: "REPLACE_ALL",
        search_index_directional: true,
        files: [
          { path: "records.jsonl", byte_length: 10, sha256: "sha256:aaa" },
          { path: "search_index.jsonl", byte_length: 20, sha256: "sha256:bbb" },
        ],
        content_sha256: "sha256:ccc",
      }),
    );

    expect(result.ok).toBe(true);
    expect(result.manifest?.search_index_directional).toBe(true);
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

      let result = await searchQuery(db, bundleB, "target_to_source", "hello", true);
      expect(result.ir_ids).toEqual(["rec-b"]);
      let records = await resolveRecords(db, bundleB, result.ir_ids);
      expect(records.map((record) => record.ir_id)).toEqual(["rec-b"]);

      await setActiveBundleId(db, bundleA);
      active = await getActiveBundleMeta(db);
      expect(active?.bundle_id).toBe(bundleA);

      result = await searchQuery(db, bundleA, "target_to_source", "hello", true);
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

      expect((await searchQuery(db, bundleId, "source_to_target", "bon travail", true)).ir_ids).toEqual(["rec-source"]);
      expect((await searchQuery(db, bundleId, "source_to_target", "merci", true)).ir_ids).toEqual(["rec-source"]);
      expect((await searchQuery(db, bundleId, "source_to_target", "bon réveil", true)).ir_ids).toEqual(["rec-source"]);
      expect((await searchQuery(db, bundleId, "source_to_target", "bon re\u0301veil", true)).ir_ids).toEqual(["rec-source"]);
      expect((await searchQuery(db, bundleId, "target_to_source", "ߘߊ߰", true)).ir_ids).toEqual(["rec-target"]);

      expect((await searchQuery(db, bundleId, "target_to_source", "bon travail", true)).ir_ids).toEqual([]);
      expect((await searchQuery(db, bundleId, "source_to_target", "ߘߊ߰", true)).ir_ids).toEqual([]);
    } finally {
      db.close();
    }
  });

  /**
   Unicode NFC canonicalization (norm_v3): index keys use NFC-composed Latin forms.
   Unchanged searchQuery + normalizeNfc(query) must hit tgt_casefold "kùn" for both
   composed and decomposed user input. Synthetic records mirror Python norm_v3 output.
   */
  it("resolves norm_v3 NFC-composed target keys with unchanged searchQuery", async () => {
    const db = await openSiralexDb();
    try {
      const bundleId = "bundle_full_norm_v3_nfc_search";

      const kunKeys = {
        casefold: ["kùn"],
        diacritics_insensitive: ["kun"],
        punct_stripped: ["kun"],
        nospace: ["kun"],
      };
      const teteKeys = {
        casefold: ["tête"],
        diacritics_insensitive: ["tete"],
        punct_stripped: ["tete"],
        nospace: ["tete"],
      };
      const senKeys = {
        casefold: ["sen"],
        diacritics_insensitive: ["sen"],
        punct_stripped: ["sen"],
        nospace: ["sen"],
      };
      const piedKeys = {
        casefold: ["pied"],
        diacritics_insensitive: ["pied"],
        punct_stripped: ["pied"],
        nospace: ["pied"],
      };

      await importRecordsJsonl(
        db,
        makeJsonlFile("records.jsonl", [
          {
            ir_id: "rec-map-tete",
            ir_kind: "index_mapping",
            source_id: "src_malipense",
            norm_version: "norm_v3",
            preferred_form: "tête",
            variant_forms: ["tête"],
            search_keys: teteKeys,
            display: { source_term: "tête" },
          },
          {
            ir_id: "rec-lex-kun",
            ir_kind: "lexicon_entry",
            source_id: "src_malipense",
            norm_version: "norm_v3",
            preferred_form: "ku\u0300n",
            variant_forms: ["ku\u0300n"],
            search_keys: kunKeys,
            display: { headword_latin: "ku\u0300n" },
          },
          {
            ir_id: "rec-map-pied",
            ir_kind: "index_mapping",
            source_id: "src_malipense",
            norm_version: "norm_v3",
            preferred_form: "pied",
            variant_forms: ["pied"],
            search_keys: piedKeys,
            display: { source_term: "pied" },
          },
          {
            ir_id: "rec-lex-sen",
            ir_kind: "lexicon_entry",
            source_id: "src_malipense",
            norm_version: "norm_v3",
            preferred_form: "sen",
            variant_forms: ["sen"],
            search_keys: senKeys,
            display: { headword_latin: "sen" },
          },
        ]),
        { bundleId, batchSize: 10 },
      );
      await importSearchIndexJsonl(
        db,
        makeJsonlFile("search_index.jsonl", [
          { key_type: "src_casefold", key: "tête", ir_ids: ["rec-map-tete"] },
          { key_type: "tgt_casefold", key: "kùn", ir_ids: ["rec-lex-kun"] },
          { key_type: "src_casefold", key: "pied", ir_ids: ["rec-map-pied"] },
          { key_type: "tgt_casefold", key: "sen", ir_ids: ["rec-lex-sen"] },
        ]),
        { bundleId, batchSize: 10 },
      );

      expect((await searchQuery(db, bundleId, "source_to_target", "tête", true)).ir_ids).toEqual(["rec-map-tete"]);
      expect((await searchQuery(db, bundleId, "source_to_target", "te\u0302te", true)).ir_ids).toEqual(["rec-map-tete"]);

      expect((await searchQuery(db, bundleId, "target_to_source", "Kùn", true)).ir_ids).toEqual(["rec-lex-kun"]);
      expect((await searchQuery(db, bundleId, "target_to_source", "ku\u0300n", true)).ir_ids).toEqual(["rec-lex-kun"]);

      expect((await searchQuery(db, bundleId, "source_to_target", "pied", true)).ir_ids).toEqual(["rec-map-pied"]);
      expect((await searchQuery(db, bundleId, "target_to_source", "Sen", true)).ir_ids).toEqual(["rec-lex-sen"]);
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

      const result = await searchQuery(db, "bundle_full_a_aaaaaaaa", "target_to_source", "hello", true);
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

      let result = await searchQuery(db, "bundle_a::sha256:new", "target_to_source", "hello", true);
      expect(result.ir_ids).toEqual(["rec-staged"]);

      await deleteBundleData(db, "bundle_a");

      result = await searchQuery(db, "bundle_a::sha256:new", "target_to_source", "hello", true);
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

      const result = await searchQuery(db, "bundle_a", "target_to_source", "old", false);
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

      expect((await searchQuery(db, bundleId, "source_to_target", "abandonner", true)).ir_ids).toEqual(["rec-source"]);
      expect((await searchQuery(db, bundleId, "target_to_source", "bàn", true)).ir_ids).toEqual(["rec-target"]);
      expect((await searchQuery(db, bundleId, "source_to_target", "bàn", true)).ir_ids).toEqual([]);
      expect((await searchQuery(db, bundleId, "target_to_source", "abandonner", true)).ir_ids).toEqual([]);
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

      expect((await searchQuery(db, bundleId, "target_to_source", "bàn", true)).ir_ids).toEqual(["rec-target"]);
      expect((await searchQuery(db, bundleId, "source_to_target", "bàn", true)).ir_ids).toEqual([]);
    } finally {
      db.close();
    }
  });

  it("uses undirected key types for legacy bundles", async () => {
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

      expect((await searchQuery(db, bundleId, "source_to_target", "ouverture", false)).ir_ids).toEqual(["rec-ouverture"]);
      expect((await searchQuery(db, bundleId, "target_to_source", "ouverture", false)).ir_ids).toEqual(["rec-ouverture"]);
    } finally {
      db.close();
    }
  });

  it("imports old manifest without directional flag and searches via legacy ladder", async () => {
    const parsed = parseAndValidateManifestJson(
      JSON.stringify({
        manifest_schema_version: "bundle_manifest_v1",
        bundle_id: "bundle_legacy_missing_directional_flag",
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
        content_sha256: "sha256:legacycompat",
      }),
    );
    expect(parsed.ok).toBe(true);
    expect(parsed.manifest).toBeDefined();
    expect(parsed.manifest?.search_index_directional).toBeUndefined();

    const db = await openSiralexDb();
    try {
      const installResult = await installBundleIntoDb(
        db,
        parsed.manifest!,
        {
          recordsSource: makeJsonlFile("records.jsonl", [
            {
              ir_id: "rec-legacy",
              ir_kind: "index_mapping",
              source_id: "src_malipense",
              norm_version: "norm_v1",
              preferred_form: "ouverture",
              variant_forms: ["ouverture"],
              search_keys: { casefold: ["ouverture"] },
              display: { source_term: "ouverture" },
            },
          ]),
          searchIndexSource: makeJsonlFile("search_index.jsonl", [
            { key_type: "casefold", key: "ouverture", ir_ids: ["rec-legacy"] },
          ]),
        },
        () => undefined,
      );
      expect(installResult.recordsCount).toBe(1);
      expect(installResult.indexCount).toBe(1);

      const active = await getActiveBundleMeta(db);
      expect(active?.bundle_id).toBe("bundle_legacy_missing_directional_flag");
      expect(active?.search_index_directional).toBe(false);

      const storageScopeId = active?.storage_scope_id ?? active?.bundle_id ?? "";
      const result = await searchQuery(
        db,
        storageScopeId,
        "source_to_target",
        "ouverture",
        active?.search_index_directional === true,
      );
      expect(result.ir_ids).toEqual(["rec-legacy"]);
    } finally {
      db.close();
    }
  });

  it("directional mode does not fallback to legacy key families", async () => {
    const db = await openSiralexDb();
    try {
      const bundleId = "bundle_directional_no_legacy_fallback";
      await importRecordsJsonl(
        db,
        makeJsonlFile("records.jsonl", [
          {
            ir_id: "rec-directional",
            ir_kind: "index_mapping",
            source_id: "src_malipense",
            norm_version: "norm_v2",
            preferred_form: "bonjour",
            variant_forms: ["bonjour"],
            search_keys: { casefold: ["bonjour"] },
            display: { source_term: "bonjour" },
          },
        ]),
        { bundleId, batchSize: 10 },
      );
      await importSearchIndexJsonl(
        db,
        makeJsonlFile("search_index.jsonl", [
          { key_type: "casefold", key: "bonjour", ir_ids: ["rec-directional"] },
        ]),
        { bundleId, batchSize: 10 },
      );

      expect((await searchQuery(db, bundleId, "source_to_target", "bonjour", true)).ir_ids).toEqual([]);
    } finally {
      db.close();
    }
  });

  it("legacy mode does not attempt directional key families", async () => {
    const db = await openSiralexDb();
    try {
      const bundleId = "bundle_legacy_no_directional_attempt";
      await importRecordsJsonl(
        db,
        makeJsonlFile("records.jsonl", [
          {
            ir_id: "rec-directional-only",
            ir_kind: "index_mapping",
            source_id: "src_malipense",
            norm_version: "norm_v1",
            preferred_form: "bonjour",
            variant_forms: ["bonjour"],
            search_keys: { casefold: ["bonjour"] },
            display: { source_term: "bonjour" },
          },
        ]),
        { bundleId, batchSize: 10 },
      );
      await importSearchIndexJsonl(
        db,
        makeJsonlFile("search_index.jsonl", [
          { key_type: "src_casefold", key: "bonjour", ir_ids: ["rec-directional-only"] },
        ]),
        { bundleId, batchSize: 10 },
      );

      expect((await searchQuery(db, bundleId, "source_to_target", "bonjour", false)).ir_ids).toEqual([]);
    } finally {
      db.close();
    }
  });
});
