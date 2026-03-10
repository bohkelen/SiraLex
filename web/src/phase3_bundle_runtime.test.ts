import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { parseAndValidateManifestJson } from "./bundle_manifest";
import {
  deleteSiralexDb,
  getActiveBundleId,
  getActiveBundleMeta,
  listInstalledBundles,
  openSiralexDb,
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
          { key_type: "casefold", key: "hello", ir_ids: ["rec-a"] },
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
          { key_type: "casefold", key: "hello", ir_ids: ["rec-b"] },
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

      let result = await searchQuery(db, bundleB, "hello");
      expect(result.ir_ids).toEqual(["rec-b"]);
      let records = await resolveRecords(db, bundleB, result.ir_ids);
      expect(records.map((record) => record.ir_id)).toEqual(["rec-b"]);

      await setActiveBundleId(db, bundleA);
      active = await getActiveBundleMeta(db);
      expect(active?.bundle_id).toBe(bundleA);

      result = await searchQuery(db, bundleA, "hello");
      expect(result.ir_ids).toEqual(["rec-a"]);
      records = await resolveRecords(db, bundleA, result.ir_ids);
      expect(records.map((record) => record.ir_id)).toEqual(["rec-a"]);
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
          { key_type: "casefold", key: "hello", ir_ids: ["rec-a"] },
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
          { key_type: "casefold", key: "hello", ir_ids: ["rec-b"] },
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

      const result = await searchQuery(db, "bundle_full_a_aaaaaaaa", "hello");
      expect(result.ir_ids).toEqual(["rec-a"]);
      const records = await resolveRecords(db, "bundle_full_a_aaaaaaaa", result.ir_ids);
      expect(records.map((record) => record.ir_id)).toEqual(["rec-a"]);
    } finally {
      db.close();
    }
  });
});
