import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

import { computeContentSha256 } from "./content_sha256";
import {
  BundlePackageIntegrityError,
  prepareVerifiedBundlePackage,
} from "./bundle_package_integrity";

const FIXTURE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures/bundle_package_integrity");

type ExpectedFixture = {
  bundle_id: string;
  records_sha256: string;
  search_index_sha256: string;
  content_sha256: string;
  manifest_content_sha256: string;
  records_byte_length: number;
  search_index_byte_length: number;
};

type ContentSha256VectorFixture = {
  input: Array<{ path: string; byte_length: number; sha256: string }>;
  content_sha256: string;
};

function fixtureFile(name: string): File {
  const bytes = readFileSync(path.join(FIXTURE_DIR, name));
  return new File([bytes], name, { type: "application/zip" });
}

function readExpectedFixture(): ExpectedFixture {
  return JSON.parse(readFileSync(path.join(FIXTURE_DIR, "valid_package.expected.json"), "utf-8")) as ExpectedFixture;
}

function readContentSha256Vector(): ContentSha256VectorFixture {
  return JSON.parse(readFileSync(path.join(FIXTURE_DIR, "content_sha256_vector.json"), "utf-8")) as ContentSha256VectorFixture;
}

async function readBlobStream(blob: Blob): Promise<Uint8Array> {
  const parts: Uint8Array[] = [];
  const reader = blob.stream().getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      parts.push(value instanceof Uint8Array ? value : new Uint8Array(value));
    }
  } finally {
    reader.releaseLock();
  }
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.byteLength;
  }
  return out;
}

async function expectIntegrityError(file: File, code: string): Promise<void> {
  await expect(prepareVerifiedBundlePackage(file)).rejects.toMatchObject({ code });
}

describe("prepareVerifiedBundlePackage", () => {
  it("prepares a verified package from the static valid fixture", async () => {
    const expected = readExpectedFixture();
    const verified = await prepareVerifiedBundlePackage(fixtureFile("valid_package.siralex.zip"));

    expect(verified.manifest.bundle_id).toBe(expected.bundle_id);
    expect(verified.observedIntegrity.recordsSha256).toBe(expected.records_sha256);
    expect(verified.observedIntegrity.searchIndexSha256).toBe(expected.search_index_sha256);
    expect(verified.observedIntegrity.contentSha256).toBe(expected.content_sha256);
    expect(verified.manifest.content_sha256).toBe(expected.manifest_content_sha256);
    expect(verified.packageMetadata.entryByteLengths["records.jsonl"]).toBe(expected.records_byte_length);
    expect(verified.packageMetadata.entryByteLengths["search_index.jsonl"]).toBe(expected.search_index_byte_length);
  });

  it("matches backend content_sha256 for a fixed vector", () => {
    const vector = readContentSha256Vector();
    expect(computeContentSha256(vector.input)).toBe(vector.content_sha256);
  });

  it("sorts content_sha256 input by ordinal path order regardless of input order", () => {
    const vector = readContentSha256Vector();
    const reversed = [...vector.input].reverse();
    expect(reversed[0]?.path).toBe("records.jsonl");
    expect(reversed[1]?.path).toBe("search_index.jsonl");
    expect(computeContentSha256(reversed)).toBe(vector.content_sha256);
  });

  it("rejects manifest files[] with an unexpected extra entry", async () => {
    await expectIntegrityError(fixtureFile("manifest_extra_file_entry.siralex.zip"), "manifest_payload_mapping_invalid");
  });

  it("rejects manifest files[] missing a required entry", async () => {
    await expectIntegrityError(
      fixtureFile("manifest_missing_required_entry.siralex.zip"),
      "manifest_payload_mapping_invalid",
    );
  });

  it("rejects modified records payload bytes", async () => {
    await expectIntegrityError(fixtureFile("records_sha_mismatch.siralex.zip"), "payload_sha256_mismatch");
  });

  it("rejects modified search-index payload bytes", async () => {
    await expectIntegrityError(fixtureFile("search_index_sha_mismatch.siralex.zip"), "payload_sha256_mismatch");
  });

  it("rejects manifest byte_length disagreements with Blob size", async () => {
    await expectIntegrityError(fixtureFile("byte_length_mismatch.siralex.zip"), "payload_byte_length_mismatch");
  });

  it("rejects wrong declared content_sha256 when per-file hashes match", async () => {
    await expectIntegrityError(fixtureFile("content_sha256_mismatch.siralex.zip"), "content_sha256_mismatch");
  });

  it("rejects invalid UTF-8 manifest bytes before parsing", async () => {
    await expectIntegrityError(fixtureFile("invalid_utf8_manifest.siralex.zip"), "manifest_invalid_utf8");
  });

  it("rejects oversized manifest before full-text decode", async () => {
    await expectIntegrityError(fixtureFile("manifest_too_large.siralex.zip"), "manifest_too_large");
  });

  it("returns replayable data Blobs after verification", async () => {
    const expected = readExpectedFixture();
    const verified = await prepareVerifiedBundlePackage(fixtureFile("valid_package.siralex.zip"));

    const recordsFirst = await readBlobStream(verified.recordsBlob);
    const recordsSecond = await readBlobStream(verified.recordsBlob);
    const indexFirst = await readBlobStream(verified.searchIndexBlob);
    const indexSecond = await readBlobStream(verified.searchIndexBlob);

    expect(recordsFirst).toEqual(recordsSecond);
    expect(indexFirst).toEqual(indexSecond);
    expect(recordsFirst.byteLength).toBe(expected.records_byte_length);
    expect(indexFirst.byteLength).toBe(expected.search_index_byte_length);
  });

  it("does not call Blob.text() or Blob.arrayBuffer() for records/index payloads", async () => {
    const originalText = Blob.prototype.text;
    const originalArrayBuffer = Blob.prototype.arrayBuffer;

    const textSpy = vi.spyOn(Blob.prototype, "text").mockImplementation(function text(this: Blob) {
      if (this.type === "application/x-ndjson") {
        throw new Error("Blob.text must not be used for JSONL payload verification");
      }
      return originalText.call(this);
    });
    const arrayBufferSpy = vi.spyOn(Blob.prototype, "arrayBuffer").mockImplementation(function arrayBuffer(this: Blob) {
      if (this.type === "application/x-ndjson") {
        throw new Error("Blob.arrayBuffer must not be used for JSONL payload verification");
      }
      return originalArrayBuffer.call(this);
    });

    try {
      await expect(prepareVerifiedBundlePackage(fixtureFile("valid_package.siralex.zip"))).resolves.toBeDefined();
    } finally {
      textSpy.mockRestore();
      arrayBufferSpy.mockRestore();
    }
  });
});

describe("prepareVerifiedBundlePackage install coupling", () => {
  it("does not import install or IndexedDB orchestration modules", async () => {
    const source = readFileSync(
      path.join(path.dirname(fileURLToPath(import.meta.url)), "bundle_package_integrity.ts"),
      "utf-8",
    );

    expect(source.includes("installBundleIntoDb")).toBe(false);
    expect(source.includes("recoverInterruptedBundleInstall")).toBe(false);
    expect(source.includes("withSingleWriterLock")).toBe(false);
    expect(source.includes("../install/")).toBe(false);
    expect(source.includes("../idb/")).toBe(false);
    expect(source.includes("main.ts")).toBe(false);
  });

  it("surfaces BundlePackageIntegrityError for integrity failures", async () => {
    await expect(prepareVerifiedBundlePackage(fixtureFile("records_sha_mismatch.siralex.zip"))).rejects.toBeInstanceOf(
      BundlePackageIntegrityError,
    );
  });
});
