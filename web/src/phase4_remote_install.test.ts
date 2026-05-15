import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import type { BundleCatalogEntryV1 } from "./bundle_catalog";
import {
  deleteSiralexDb,
  getActiveBundleMeta,
  getBundleInstallSession,
  getInstalledBundleMeta,
  openSiralexDb,
  recoverInterruptedBundleInstall,
  setActiveBundleId,
  setActiveBundleMeta,
} from "./idb/siralex_db";
import { importRecordsJsonl } from "./import/import_records";
import { importSearchIndexJsonl } from "./import/import_search_index";
import { installRemoteCatalogBundle } from "./install/bundle_install";
import { resolveRecords } from "./search/resolve_records";
import { searchQuery } from "./search/search_query";

function makeJsonl(rows: unknown[]): string {
  return rows.map((row) => JSON.stringify(row)).join("\n") + "\n";
}

function makeStream(text: string): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes.subarray(0, Math.ceil(bytes.length / 2)));
      controller.enqueue(bytes.subarray(Math.ceil(bytes.length / 2)));
      controller.close();
    },
  });
}

function makeLineChunkedStream(text: string): ReadableStream<Uint8Array> {
  const lines = text.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  const encoder = new TextEncoder();
  let index = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index >= lines.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(lines[index]!));
      index += 1;
    },
  });
}

function makeDelayedLineChunkedStream(text: string, delayMs: number): ReadableStream<Uint8Array> {
  const lines = text.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  const encoder = new TextEncoder();
  let index = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (index >= lines.length) {
        controller.close();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      controller.enqueue(encoder.encode(lines[index]!));
      index += 1;
    },
  });
}

function makeResponse(body: string, contentType: string): Response {
  const bytes = new TextEncoder().encode(body);
  return new Response(makeStream(body), {
    status: 200,
    headers: {
      "content-type": contentType,
      "content-length": String(bytes.byteLength),
    },
  });
}

function makeResponseWithUrl(body: string, contentType: string, url: string, chunked = false): Response {
  const bytes = new TextEncoder().encode(body);
  const response = new Response(chunked ? makeLineChunkedStream(body) : makeStream(body), {
    status: 200,
    headers: {
      "content-type": contentType,
      "content-length": String(bytes.byteLength),
    },
  });
  Object.defineProperty(response, "url", {
    value: url,
    configurable: true,
  });
  return response;
}

function makeDelayedResponseWithUrl(body: string, contentType: string, url: string, delayMs: number): Response {
  const bytes = new TextEncoder().encode(body);
  const response = new Response(makeDelayedLineChunkedStream(body, delayMs), {
    status: 200,
    headers: {
      "content-type": contentType,
      "content-length": String(bytes.byteLength),
    },
  });
  Object.defineProperty(response, "url", {
    value: url,
    configurable: true,
  });
  return response;
}

async function seedInstalledBundleScope(
  db: IDBDatabase,
  storageScopeId: string,
  preferredForm: string,
  lookupKey: string,
): Promise<void> {
  await importRecordsJsonl(
    db,
    new Blob([
      makeJsonl([
        {
          ir_id: `${storageScopeId}-rec`,
          ir_kind: "lexicon_entry",
          source_id: `${storageScopeId}-src`,
          norm_version: "norm_v1",
          preferred_form: preferredForm,
          variant_forms: [preferredForm],
          search_keys: { casefold: [lookupKey] },
          display: { headword_latin: preferredForm },
        },
      ]),
    ]),
    { bundleId: storageScopeId, batchSize: 10 },
  );
  await importSearchIndexJsonl(
    db,
    new Blob([makeJsonl([{ key_type: "tgt_casefold", key: lookupKey, ir_ids: [`${storageScopeId}-rec`] }])]),
    { bundleId: storageScopeId, batchSize: 10 },
  );
}

describe("Phase 4.2 remote install", () => {
  beforeEach(async () => {
    try {
      await deleteSiralexDb();
    } catch {
      // ignore
    }
  });

  it("streams remote bundle payloads into staged install and activates the new storage scope", async () => {
    const recordsText = makeJsonl([
      {
        ir_id: "rec-1",
        ir_kind: "lexicon_entry",
        source_id: "src_1",
        norm_version: "norm_v1",
        preferred_form: "bonjour",
        variant_forms: ["bonjour"],
        search_keys: { casefold: ["hello"] },
        display: { headword_latin: "bonjour" },
      },
    ]);
    const indexText = makeJsonl([{ key_type: "tgt_casefold", key: "hello", ir_ids: ["rec-1"] }]);
    const manifestText = JSON.stringify({
      manifest_schema_version: "bundle_manifest_v1",
      bundle_id: "maninka_fr_v1",
      bundle_type: "full",
      bundle_format: "directory",
      compression: "none",
      record_schema_id: "normalized_v1",
      record_schema_version: "1",
      rule_versions: { normalization: "norm_v1" },
      sources: { included: ["src"], excluded: [] },
      reconciliation_action: "REPLACE_ALL",
      update_mode: "REPLACE_ALL",
      files: [
        {
          path: "records.jsonl",
          byte_length: new TextEncoder().encode(recordsText).byteLength,
          sha256: "sha256:records",
        },
        {
          path: "search_index.jsonl",
          byte_length: new TextEncoder().encode(indexText).byteLength,
          sha256: "sha256:index",
        },
      ],
      content_sha256: "sha256:bundle",
      languages: { source_lang: "fr", target_lang: "mnk" },
      language_labels: { source: "French", target: "Maninka" },
    });

    const entry: BundleCatalogEntryV1 = {
      bundle_id: "maninka_fr_v1",
      name: "French ↔ Maninka",
      version: "1.0.0",
      size_bytes: new TextEncoder().encode(recordsText).byteLength + new TextEncoder().encode(indexText).byteLength,
      url_base: "./bundles/maninka_fr_v1/",
      content_sha256: "sha256:bundle",
      language_meta: {
        source_lang: "fr",
        target_lang: "mnk",
        source_label: "French",
        target_label: "Maninka",
      },
    };

    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      if (url.endsWith("/bundle.manifest.json")) return makeResponse(manifestText, "application/json");
      if (url.endsWith("/records.jsonl")) return makeResponse(recordsText, "application/json");
      if (url.endsWith("/search_index.jsonl")) return makeResponse(indexText, "application/json");
      return new Response("not found", { status: 404, statusText: "Not Found" });
    };

    const db = await openSiralexDb();
    try {
      const { manifest, result } = await installRemoteCatalogBundle(
        db,
        entry,
        "https://example.test/catalog.json",
        { fetchImpl },
      );

      expect(manifest.bundle_id).toBe("maninka_fr_v1");
      expect(result.recordsCount).toBe(1);
      expect(result.indexCount).toBe(1);

      const active = await getActiveBundleMeta(db);
      expect(active?.bundle_id).toBe("maninka_fr_v1");
      expect(active?.storage_scope_id).toBe("maninka_fr_v1::sha256:bundle");

      const installed = await getInstalledBundleMeta(db, "maninka_fr_v1");
      expect(installed?.display_name).toBe("French ↔ Maninka");
      expect(installed?.version).toBe("1.0.0");
      expect(installed?.storage_bytes).toBe(entry.size_bytes);
      expect(installed?.expected_content_sha256).toBe("sha256:bundle");

      const resultIds = await searchQuery(db, active!.storage_scope_id!, "target_to_source", "hello", true);
      expect(resultIds.ir_ids).toEqual(["rec-1"]);
      const records = await resolveRecords(db, active!.storage_scope_id!, resultIds.ir_ids);
      expect(records.map((record) => record.ir_id)).toEqual(["rec-1"]);
    } finally {
      db.close();
    }
  });

  it("does not timeout an active payload stream just because total elapsed time exceeds response-start timeout", async () => {
    const recordsText = makeJsonl([
      {
        ir_id: "rec-slow",
        ir_kind: "lexicon_entry",
        source_id: "src_slow",
        norm_version: "norm_v1",
        preferred_form: "slow-entry",
        variant_forms: ["slow-entry"],
        search_keys: { casefold: ["slow-hello"] },
        display: { headword_latin: "slow-entry" },
      },
    ]);
    const indexText = makeJsonl([
      { key_type: "tgt_casefold", key: "slow-hello", ir_ids: ["rec-slow"] },
      { key_type: "tgt_casefold", key: "slow-hello-2", ir_ids: ["rec-slow"] },
      { key_type: "tgt_casefold", key: "slow-hello-3", ir_ids: ["rec-slow"] },
    ]);
    const manifestText = JSON.stringify({
      manifest_schema_version: "bundle_manifest_v1",
      bundle_id: "maninka_fr_slow",
      bundle_type: "full",
      bundle_format: "directory",
      compression: "none",
      record_schema_id: "normalized_v1",
      record_schema_version: "1",
      rule_versions: { normalization: "norm_v1" },
      sources: { included: ["src"], excluded: [] },
      reconciliation_action: "REPLACE_ALL",
      update_mode: "REPLACE_ALL",
      files: [
        {
          path: "records.jsonl",
          byte_length: new TextEncoder().encode(recordsText).byteLength,
          sha256: "sha256:records-slow",
        },
        {
          path: "search_index.jsonl",
          byte_length: new TextEncoder().encode(indexText).byteLength,
          sha256: "sha256:index-slow",
        },
      ],
      content_sha256: "sha256:bundle-slow",
    });

    const entry: BundleCatalogEntryV1 = {
      bundle_id: "maninka_fr_slow",
      name: "French ↔ Maninka Slow Stream",
      version: "1.0.0",
      size_bytes: new TextEncoder().encode(recordsText).byteLength + new TextEncoder().encode(indexText).byteLength,
      url_base: "./bundles/maninka_fr_slow/",
      content_sha256: "sha256:bundle-slow",
    };

    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      if (url.endsWith("/bundle.manifest.json")) {
        return makeResponseWithUrl(manifestText, "application/json", url);
      }
      if (url.endsWith("/records.jsonl")) {
        return makeDelayedResponseWithUrl(recordsText, "application/json", url, 4);
      }
      if (url.endsWith("/search_index.jsonl")) {
        return makeDelayedResponseWithUrl(indexText, "application/json", url, 4);
      }
      return new Response("not found", { status: 404, statusText: "Not Found" });
    };

    const db = await openSiralexDb();
    try {
      const { manifest, result } = await installRemoteCatalogBundle(
        db,
        entry,
        "https://example.test/catalog.json",
        {
          fetchImpl,
          timeoutMs: 5,
        },
      );

      expect(manifest.bundle_id).toBe("maninka_fr_slow");
      expect(result.recordsCount).toBe(1);
      expect(result.indexCount).toBe(3);

      const active = await getActiveBundleMeta(db);
      expect(active?.bundle_id).toBe("maninka_fr_slow");
      expect(active?.storage_scope_id).toBe("maninka_fr_slow::sha256:bundle-slow");
    } finally {
      db.close();
    }
  });

  it("keeps an updated active bundle active and serves the new scope", async () => {
    const oldScope = "maninka_fr_v1::sha256:old";
    const newScope = "maninka_fr_v1::sha256:new";
    const recordsText = makeJsonl([
      {
        ir_id: "rec-new",
        ir_kind: "lexicon_entry",
        source_id: "src_new",
        norm_version: "norm_v1",
        preferred_form: "updated-entry",
        variant_forms: ["updated-entry"],
        search_keys: { casefold: ["hello"] },
        display: { headword_latin: "updated-entry" },
      },
    ]);
    const indexText = makeJsonl([{ key_type: "tgt_casefold", key: "hello", ir_ids: ["rec-new"] }]);
    const manifestText = JSON.stringify({
      manifest_schema_version: "bundle_manifest_v1",
      bundle_id: "maninka_fr_v1",
      bundle_type: "full",
      bundle_format: "directory",
      compression: "none",
      record_schema_id: "normalized_v1",
      record_schema_version: "1",
      rule_versions: { normalization: "norm_v1" },
      sources: { included: ["src"], excluded: [] },
      reconciliation_action: "REPLACE_ALL",
      update_mode: "REPLACE_ALL",
      files: [
        {
          path: "records.jsonl",
          byte_length: new TextEncoder().encode(recordsText).byteLength,
          sha256: "sha256:records",
        },
        {
          path: "search_index.jsonl",
          byte_length: new TextEncoder().encode(indexText).byteLength,
          sha256: "sha256:index",
        },
      ],
      content_sha256: "sha256:new",
    });
    const entry: BundleCatalogEntryV1 = {
      bundle_id: "maninka_fr_v1",
      name: "French ↔ Maninka",
      size_bytes: new TextEncoder().encode(recordsText).byteLength + new TextEncoder().encode(indexText).byteLength,
      url_base: "./bundles/maninka_fr_v1/",
      content_sha256: "sha256:new",
    };
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      if (url.endsWith("/bundle.manifest.json")) return makeResponse(manifestText, "application/json");
      if (url.endsWith("/records.jsonl")) return makeResponse(recordsText, "application/json");
      if (url.endsWith("/search_index.jsonl")) return makeResponse(indexText, "application/json");
      return new Response("not found", { status: 404, statusText: "Not Found" });
    };

    const db = await openSiralexDb();
    try {
      await seedInstalledBundleScope(db, oldScope, "old-entry", "hello");
      await setActiveBundleMeta(db, {
        bundle_id: "maninka_fr_v1",
        storage_scope_id: oldScope,
        manifest_schema_version: "bundle_manifest_v1",
        record_schema_id: "normalized_v1",
        record_schema_version: "1",
        normalization_ruleset: "norm_v1",
        update_mode: "REPLACE_ALL",
        reconciliation_action: "REPLACE_ALL",
        expected_content_sha256: "sha256:old",
        imported_at_iso: "2026-03-11T00:00:00Z",
        records_count: 1,
        index_entries_count: 1,
      });

      await installRemoteCatalogBundle(db, entry, "https://example.test/catalog.json", {
        fetchImpl,
        activateOnCommit: true,
      });

      const active = await getActiveBundleMeta(db);
      expect(active?.bundle_id).toBe("maninka_fr_v1");
      expect(active?.storage_scope_id).toBe(newScope);
      expect((await getInstalledBundleMeta(db, "maninka_fr_v1"))?.storage_scope_id).toBe(newScope);

      const resultIds = await searchQuery(db, newScope, "target_to_source", "hello", true);
      expect(resultIds.ir_ids).toEqual(["rec-new"]);
      const records = await resolveRecords(db, newScope, resultIds.ir_ids);
      expect(records.map((record) => record.preferred_form)).toEqual(["updated-entry"]);
      expect((await searchQuery(db, oldScope, "target_to_source", "hello", true)).ir_ids).toEqual([]);
    } finally {
      db.close();
    }
  });

  it("updates a non-active bundle without changing the current active bundle", async () => {
    const activeScope = "bundle_a::sha256:active";
    const oldScope = "bundle_b::sha256:old";
    const newScope = "bundle_b::sha256:new";
    const recordsText = makeJsonl([
      {
        ir_id: "bundle-b-new",
        ir_kind: "lexicon_entry",
        source_id: "bundle-b-src",
        norm_version: "norm_v1",
        preferred_form: "bundle-b-updated",
        variant_forms: ["bundle-b-updated"],
        search_keys: { casefold: ["bundle-b"] },
        display: { headword_latin: "bundle-b-updated" },
      },
    ]);
    const indexText = makeJsonl([{ key_type: "tgt_casefold", key: "bundle-b", ir_ids: ["bundle-b-new"] }]);
    const manifestText = JSON.stringify({
      manifest_schema_version: "bundle_manifest_v1",
      bundle_id: "bundle_b",
      bundle_type: "full",
      bundle_format: "directory",
      compression: "none",
      record_schema_id: "normalized_v1",
      record_schema_version: "1",
      rule_versions: { normalization: "norm_v1" },
      sources: { included: ["src"], excluded: [] },
      reconciliation_action: "REPLACE_ALL",
      update_mode: "REPLACE_ALL",
      files: [
        {
          path: "records.jsonl",
          byte_length: new TextEncoder().encode(recordsText).byteLength,
          sha256: "sha256:records",
        },
        {
          path: "search_index.jsonl",
          byte_length: new TextEncoder().encode(indexText).byteLength,
          sha256: "sha256:index",
        },
      ],
      content_sha256: "sha256:new",
    });
    const entry: BundleCatalogEntryV1 = {
      bundle_id: "bundle_b",
      name: "Bundle B",
      size_bytes: new TextEncoder().encode(recordsText).byteLength + new TextEncoder().encode(indexText).byteLength,
      url_base: "./bundles/bundle_b/",
      content_sha256: "sha256:new",
    };
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      if (url.endsWith("/bundle.manifest.json")) return makeResponse(manifestText, "application/json");
      if (url.endsWith("/records.jsonl")) return makeResponse(recordsText, "application/json");
      if (url.endsWith("/search_index.jsonl")) return makeResponse(indexText, "application/json");
      return new Response("not found", { status: 404, statusText: "Not Found" });
    };

    const db = await openSiralexDb();
    try {
      await seedInstalledBundleScope(db, activeScope, "active-entry", "bundle-a");
      await seedInstalledBundleScope(db, oldScope, "old-bundle-b", "bundle-b");
      await setActiveBundleMeta(db, {
        bundle_id: "bundle_a",
        storage_scope_id: activeScope,
        manifest_schema_version: "bundle_manifest_v1",
        record_schema_id: "normalized_v1",
        record_schema_version: "1",
        normalization_ruleset: "norm_v1",
        update_mode: "REPLACE_ALL",
        reconciliation_action: "REPLACE_ALL",
        expected_content_sha256: "sha256:active",
        imported_at_iso: "2026-03-11T00:00:00Z",
        records_count: 1,
        index_entries_count: 1,
      });
      await setActiveBundleMeta(db, {
        bundle_id: "bundle_b",
        storage_scope_id: oldScope,
        manifest_schema_version: "bundle_manifest_v1",
        record_schema_id: "normalized_v1",
        record_schema_version: "1",
        normalization_ruleset: "norm_v1",
        update_mode: "REPLACE_ALL",
        reconciliation_action: "REPLACE_ALL",
        expected_content_sha256: "sha256:old",
        imported_at_iso: "2026-03-11T00:00:00Z",
        records_count: 1,
        index_entries_count: 1,
      });
      await setActiveBundleId(db, "bundle_a");

      await installRemoteCatalogBundle(db, entry, "https://example.test/catalog.json", {
        fetchImpl,
        activateOnCommit: false,
      });

      const active = await getActiveBundleMeta(db);
      expect(active?.bundle_id).toBe("bundle_a");
      expect(active?.storage_scope_id).toBe(activeScope);

      const installedB = await getInstalledBundleMeta(db, "bundle_b");
      expect(installedB?.storage_scope_id).toBe(newScope);
      expect(installedB?.expected_content_sha256).toBe("sha256:new");

      const activeIds = await searchQuery(db, activeScope, "target_to_source", "bundle-a", true);
      expect(activeIds.ir_ids).toEqual([`${activeScope}-rec`]);
      const updatedIds = await searchQuery(db, newScope, "target_to_source", "bundle-b", true);
      expect(updatedIds.ir_ids).toEqual(["bundle-b-new"]);
      expect((await searchQuery(db, oldScope, "target_to_source", "bundle-b", true)).ir_ids).toEqual([]);
    } finally {
      db.close();
    }
  });

  it("rejects catalog/manifest hash mismatches before payload import", async () => {
    const manifestText = JSON.stringify({
      manifest_schema_version: "bundle_manifest_v1",
      bundle_id: "maninka_fr_v1",
      bundle_type: "full",
      bundle_format: "directory",
      compression: "none",
      record_schema_id: "normalized_v1",
      record_schema_version: "1",
      rule_versions: { normalization: "norm_v1" },
      sources: { included: ["src"], excluded: [] },
      reconciliation_action: "REPLACE_ALL",
      update_mode: "REPLACE_ALL",
      files: [
        { path: "records.jsonl", byte_length: 1, sha256: "sha256:records" },
        { path: "search_index.jsonl", byte_length: 1, sha256: "sha256:index" },
      ],
      content_sha256: "sha256:manifest",
    });

    const entry: BundleCatalogEntryV1 = {
      bundle_id: "maninka_fr_v1",
      name: "French ↔ Maninka",
      size_bytes: 2,
      url_base: "./bundles/maninka_fr_v1/",
      content_sha256: "sha256:catalog",
    };

    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      if (url.endsWith("/bundle.manifest.json")) return makeResponse(manifestText, "application/json");
      return new Response("unexpected", { status: 500 });
    };

    const db = await openSiralexDb();
    try {
      await expect(
        installRemoteCatalogBundle(db, entry, "https://example.test/catalog.json", { fetchImpl }),
      ).rejects.toThrow("Catalog/manifest content_sha256 mismatch");
    } finally {
      db.close();
    }
  });

  it("rejects manifest redirects to disallowed final URLs", async () => {
    const manifestText = JSON.stringify({
      manifest_schema_version: "bundle_manifest_v1",
      bundle_id: "maninka_fr_v1",
      bundle_type: "full",
      bundle_format: "directory",
      compression: "none",
      record_schema_id: "normalized_v1",
      record_schema_version: "1",
      rule_versions: { normalization: "norm_v1" },
      sources: { included: ["src"], excluded: [] },
      reconciliation_action: "REPLACE_ALL",
      update_mode: "REPLACE_ALL",
      files: [
        { path: "records.jsonl", byte_length: 1, sha256: "sha256:records" },
        { path: "search_index.jsonl", byte_length: 1, sha256: "sha256:index" },
      ],
      content_sha256: "sha256:bundle",
    });

    const entry: BundleCatalogEntryV1 = {
      bundle_id: "maninka_fr_v1",
      name: "French ↔ Maninka",
      size_bytes: 2,
      url_base: "./bundles/maninka_fr_v1/",
      content_sha256: "sha256:bundle",
    };

    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      if (url.endsWith("/bundle.manifest.json")) {
        return makeResponseWithUrl(manifestText, "application/json", "http://evil.example/manifest.json");
      }
      return new Response("unexpected", { status: 500 });
    };

    const db = await openSiralexDb();
    try {
      await expect(
        installRemoteCatalogBundle(db, entry, "https://example.test/catalog.json", { fetchImpl }),
      ).rejects.toThrow("Remote http: URLs are only allowed for same-origin or local hosts");
    } finally {
      db.close();
    }
  });

  it("cancels during records import and cleans staged state", async () => {
    const oldScope = "maninka_fr_v1::sha256:old";
    const newScope = "maninka_fr_v1::sha256:new";
    const recordsText = makeJsonl(
      Array.from({ length: 4 }, (_, index) => ({
        ir_id: `new-rec-${index + 1}`,
        ir_kind: "lexicon_entry",
        source_id: `new-src-${index + 1}`,
        norm_version: "norm_v1",
        preferred_form: `new-${index + 1}`,
        variant_forms: [`new-${index + 1}`],
        search_keys: { casefold: ["hello"] },
        display: { headword_latin: `new-${index + 1}` },
      })),
    );
    const indexText = makeJsonl(
      Array.from({ length: 4 }, (_, index) => ({
        key_type: "tgt_casefold",
        key: `hello-${index + 1}`,
        ir_ids: [`new-rec-${index + 1}`],
      })),
    );
    const manifestText = JSON.stringify({
      manifest_schema_version: "bundle_manifest_v1",
      bundle_id: "maninka_fr_v1",
      bundle_type: "full",
      bundle_format: "directory",
      compression: "none",
      record_schema_id: "normalized_v1",
      record_schema_version: "1",
      rule_versions: { normalization: "norm_v1" },
      sources: { included: ["src"], excluded: [] },
      reconciliation_action: "REPLACE_ALL",
      update_mode: "REPLACE_ALL",
      files: [
        {
          path: "records.jsonl",
          byte_length: new TextEncoder().encode(recordsText).byteLength,
          sha256: "sha256:records",
        },
        {
          path: "search_index.jsonl",
          byte_length: new TextEncoder().encode(indexText).byteLength,
          sha256: "sha256:index",
        },
      ],
      content_sha256: "sha256:new",
    });
    const entry: BundleCatalogEntryV1 = {
      bundle_id: "maninka_fr_v1",
      name: "French ↔ Maninka",
      size_bytes: new TextEncoder().encode(recordsText).byteLength + new TextEncoder().encode(indexText).byteLength,
      url_base: "./bundles/maninka_fr_v1/",
      content_sha256: "sha256:new",
    };
    const controller = new AbortController();
    let aborted = false;

    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      if (url.endsWith("/bundle.manifest.json")) {
        return makeResponseWithUrl(manifestText, "application/json", url);
      }
      if (url.endsWith("/records.jsonl")) {
        return makeResponseWithUrl(recordsText, "application/json", url, true);
      }
      if (url.endsWith("/search_index.jsonl")) {
        return makeResponseWithUrl(indexText, "application/json", url, true);
      }
      throw init?.signal?.reason ?? new Error("unexpected fetch");
    };

    const db = await openSiralexDb();
    try {
      await seedInstalledBundleScope(db, oldScope, "old-entry", "hello");
      await setActiveBundleMeta(db, {
        bundle_id: "maninka_fr_v1",
        storage_scope_id: oldScope,
        manifest_schema_version: "bundle_manifest_v1",
        record_schema_id: "normalized_v1",
        record_schema_version: "1",
        normalization_ruleset: "norm_v1",
        update_mode: "REPLACE_ALL",
        reconciliation_action: "REPLACE_ALL",
        expected_content_sha256: "sha256:old",
        imported_at_iso: "2026-03-11T00:00:00Z",
        records_count: 1,
        index_entries_count: 1,
      });

      await expect(
        installRemoteCatalogBundle(db, entry, "https://example.test/catalog.json", {
          fetchImpl,
          signal: controller.signal,
          onUpdate: (message) => {
            if (!aborted && message.includes("[records.jsonl]") && message.includes("bytes read:")) {
              aborted = true;
              controller.abort(new Error("Cancel during records"));
            }
          },
        }),
      ).rejects.toThrow("Cancel during records");

      const active = await getActiveBundleMeta(db);
      expect(active?.storage_scope_id).toBe(oldScope);
      expect((await getInstalledBundleMeta(db, "maninka_fr_v1"))?.expected_content_sha256).toBe("sha256:old");
      expect(await getBundleInstallSession(db)).toBeUndefined();
      expect(await recoverInterruptedBundleInstall(db)).toBeUndefined();
      expect((await searchQuery(db, oldScope, "target_to_source", "hello", true)).ir_ids).toEqual([`${oldScope}-rec`]);
      expect((await searchQuery(db, newScope, "target_to_source", "hello", true)).ir_ids).toEqual([]);
    } finally {
      db.close();
    }
  });

  it("cancels during search index import and cleans staged state", async () => {
    const oldScope = "maninka_fr_v1::sha256:old";
    const newScope = "maninka_fr_v1::sha256:new";
    const recordsText = makeJsonl(
      Array.from({ length: 3 }, (_, index) => ({
        ir_id: `new-rec-${index + 1}`,
        ir_kind: "lexicon_entry",
        source_id: `new-src-${index + 1}`,
        norm_version: "norm_v1",
        preferred_form: `new-${index + 1}`,
        variant_forms: [`new-${index + 1}`],
        search_keys: { casefold: [`hello-${index + 1}`] },
        display: { headword_latin: `new-${index + 1}` },
      })),
    );
    const indexText = makeJsonl(
      Array.from({ length: 4 }, (_, index) => ({
        key_type: "tgt_casefold",
        key: `hello-${index + 1}`,
        ir_ids: [`new-rec-${Math.min(index + 1, 3)}`],
      })),
    );
    const manifestText = JSON.stringify({
      manifest_schema_version: "bundle_manifest_v1",
      bundle_id: "maninka_fr_v1",
      bundle_type: "full",
      bundle_format: "directory",
      compression: "none",
      record_schema_id: "normalized_v1",
      record_schema_version: "1",
      rule_versions: { normalization: "norm_v1" },
      sources: { included: ["src"], excluded: [] },
      reconciliation_action: "REPLACE_ALL",
      update_mode: "REPLACE_ALL",
      files: [
        {
          path: "records.jsonl",
          byte_length: new TextEncoder().encode(recordsText).byteLength,
          sha256: "sha256:records",
        },
        {
          path: "search_index.jsonl",
          byte_length: new TextEncoder().encode(indexText).byteLength,
          sha256: "sha256:index",
        },
      ],
      content_sha256: "sha256:new",
    });
    const entry: BundleCatalogEntryV1 = {
      bundle_id: "maninka_fr_v1",
      name: "French ↔ Maninka",
      size_bytes: new TextEncoder().encode(recordsText).byteLength + new TextEncoder().encode(indexText).byteLength,
      url_base: "./bundles/maninka_fr_v1/",
      content_sha256: "sha256:new",
    };
    const controller = new AbortController();
    let aborted = false;

    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      if (url.endsWith("/bundle.manifest.json")) {
        return makeResponseWithUrl(manifestText, "application/json", url);
      }
      if (url.endsWith("/records.jsonl")) {
        return makeResponseWithUrl(recordsText, "application/json", url, true);
      }
      if (url.endsWith("/search_index.jsonl")) {
        return makeResponseWithUrl(indexText, "application/json", url, true);
      }
      throw init?.signal?.reason ?? new Error("unexpected fetch");
    };

    const db = await openSiralexDb();
    try {
      await seedInstalledBundleScope(db, oldScope, "old-entry", "hello");
      await setActiveBundleMeta(db, {
        bundle_id: "maninka_fr_v1",
        storage_scope_id: oldScope,
        manifest_schema_version: "bundle_manifest_v1",
        record_schema_id: "normalized_v1",
        record_schema_version: "1",
        normalization_ruleset: "norm_v1",
        update_mode: "REPLACE_ALL",
        reconciliation_action: "REPLACE_ALL",
        expected_content_sha256: "sha256:old",
        imported_at_iso: "2026-03-11T00:00:00Z",
        records_count: 1,
        index_entries_count: 1,
      });

      await expect(
        installRemoteCatalogBundle(db, entry, "https://example.test/catalog.json", {
          fetchImpl,
          signal: controller.signal,
          onUpdate: (message) => {
            if (!aborted && message.includes("[search_index.jsonl]") && message.includes("bytes read:")) {
              aborted = true;
              controller.abort(new Error("Cancel during index"));
            }
          },
        }),
      ).rejects.toThrow("Cancel during index");

      const active = await getActiveBundleMeta(db);
      expect(active?.storage_scope_id).toBe(oldScope);
      expect((await getInstalledBundleMeta(db, "maninka_fr_v1"))?.expected_content_sha256).toBe("sha256:old");
      expect(await getBundleInstallSession(db)).toBeUndefined();
      expect(await recoverInterruptedBundleInstall(db)).toBeUndefined();
      expect((await searchQuery(db, oldScope, "target_to_source", "hello", true)).ir_ids).toEqual([`${oldScope}-rec`]);
      expect((await searchQuery(db, newScope, "target_to_source", "hello-1", true)).ir_ids).toEqual([]);
    } finally {
      db.close();
    }
  });
});
