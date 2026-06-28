import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import * as bundlePackage from "./bundle_package";
import {
  BUNDLE_PACKAGE_V1_LIMITS,
  BundlePackageError,
  openStoredBundlePackage,
} from "./bundle_package";

const FIXTURE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures/bundle_package");

function fixtureFile(name: string): File {
  const bytes = readFileSync(path.join(FIXTURE_DIR, name));
  return new File([bytes], name, { type: "application/zip" });
}

async function readBlobBytes(blob: Blob): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  const reader = blob.stream().getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
      chunks.push(bytes);
    }
  } finally {
    reader.releaseLock();
  }
  let total = 0;
  for (const chunk of chunks) {
    total += chunk.byteLength;
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

async function expectPackageError(file: File, code: string): Promise<void> {
  await expect(openStoredBundlePackage(file)).rejects.toMatchObject({ code });
}

describe("openStoredBundlePackage", () => {
  it("accepts a valid exact three-entry STORE ZIP", async () => {
    const opened = await openStoredBundlePackage(fixtureFile("valid_three_entry.siralex.zip"));

    expect(opened.packageMetadata.packageFormatVersion).toBe("siralex_bundle_package_v1");
    expect(opened.packageMetadata.entryByteLengths["bundle.manifest.json"]).toBeGreaterThan(0);
    expect(opened.packageMetadata.entryByteLengths["records.jsonl"]).toBeGreaterThan(0);
    expect(opened.packageMetadata.entryByteLengths["search_index.jsonl"]).toBeGreaterThan(0);

    const manifestBytes = await readBlobBytes(opened.manifestBlob);
    const recordsBytes = await readBlobBytes(opened.recordsBlob);
    const indexBytes = await readBlobBytes(opened.searchIndexBlob);

    expect(new TextDecoder().decode(manifestBytes)).toContain("bundle_manifest_v1");
    expect(new TextDecoder().decode(recordsBytes)).toContain('"ir_id":"rec1"');
    expect(new TextDecoder().decode(indexBytes)).toContain("src_casefold");
  });

  it("does not export readBlobBytes from the production module", () => {
    expect("readBlobBytes" in bundlePackage).toBe(false);
  });

  it("exposes JSONL payloads as replayable Blob stream sources without full-payload strings", async () => {
    const opened = await openStoredBundlePackage(fixtureFile("valid_three_entry.siralex.zip"));

    expect(opened.recordsBlob.size).toBe(opened.packageMetadata.entryByteLengths["records.jsonl"]);
    expect(opened.searchIndexBlob.size).toBe(opened.packageMetadata.entryByteLengths["search_index.jsonl"]);

    const streamParts: Uint8Array[] = [];
    const recordsReader = opened.recordsBlob.stream().getReader();
    try {
      while (true) {
        const { done, value } = await recordsReader.read();
        if (done) {
          break;
        }
        streamParts.push(value instanceof Uint8Array ? value : new Uint8Array(value));
      }
    } finally {
      recordsReader.releaseLock();
    }
    const recordsFromStream = Buffer.concat(streamParts.map((part) => Buffer.from(part)));
    const recordsFromSlice = Buffer.from(await opened.recordsBlob.arrayBuffer());
    expect(recordsFromStream.equals(recordsFromSlice)).toBe(true);
    expect(recordsFromSlice.toString("utf8")).toContain('"ir_id":"rec1"');

    const indexFromStream = await readBlobBytes(opened.searchIndexBlob);
    expect(new TextDecoder().decode(indexFromStream)).toContain("src_casefold");
  });

  it("rejects a missing required entry", async () => {
    await expectPackageError(fixtureFile("missing_records.siralex.zip"), "missing_entry");
  });

  it("rejects an unexpected extra entry", async () => {
    await expectPackageError(fixtureFile("extra_entry.siralex.zip"), "unexpected_entry");
  });

  it("rejects duplicate required entry names", async () => {
    await expectPackageError(fixtureFile("duplicate_records.siralex.zip"), "duplicate_entry");
  });

  it("rejects nested path entries", async () => {
    await expectPackageError(fixtureFile("nested_path.siralex.zip"), "invalid_entry_path");
  });

  it("rejects backslash path entries", async () => {
    await expectPackageError(fixtureFile("backslash_path.siralex.zip"), "invalid_entry_path");
  });

  it("rejects drive-prefix path entries", async () => {
    await expectPackageError(fixtureFile("drive_prefix_path.siralex.zip"), "invalid_entry_path");
  });

  it("rejects non-STORE compression methods", async () => {
    await expectPackageError(fixtureFile("deflated_entry.siralex.zip"), "unsupported_compression");
  });

  it("rejects encryption flags", async () => {
    await expectPackageError(fixtureFile("encrypted_flag.siralex.zip"), "encrypted_entry");
  });

  it("rejects data-descriptor flags", async () => {
    await expectPackageError(fixtureFile("data_descriptor_flag.siralex.zip"), "data_descriptor");
  });

  it("rejects unsupported general-purpose flags", async () => {
    await expectPackageError(fixtureFile("unsupported_gpbf.siralex.zip"), "unsupported_general_purpose_flag");
  });

  it("rejects a central-directory extra field with truncated trailing bytes", async () => {
    await expectPackageError(fixtureFile("central_truncated_extra.siralex.zip"), "corrupt_extra_field");
  });

  it("rejects a local-header extra field with truncated trailing bytes", async () => {
    await expectPackageError(fixtureFile("local_truncated_extra.siralex.zip"), "corrupt_extra_field");
  });

  it("rejects ZIP64 EOCD sentinel values", async () => {
    await expectPackageError(fixtureFile("eocd_zip64_sentinel.siralex.zip"), "zip64");
  });

  it("rejects ZIP64 size markers", async () => {
    await expectPackageError(fixtureFile("zip64_sizes.siralex.zip"), "zip64");
  });

  it("rejects multi-disk archives", async () => {
    await expectPackageError(fixtureFile("multi_disk.siralex.zip"), "multi_disk");
  });

  it("rejects archive comments", async () => {
    await expectPackageError(fixtureFile("archive_comment.siralex.zip"), "archive_comment");
  });

  it("rejects a central-directory and EOCD gap or mismatch", async () => {
    await expectPackageError(fixtureFile("cd_eocd_gap.siralex.zip"), "central_directory_eocd_mismatch");
  });

  it("rejects corrupt end-of-central-directory records", async () => {
    await expectPackageError(fixtureFile("corrupt_eocd.siralex.zip"), "corrupt_eocd");
  });

  it("rejects local header offsets outside the archive", async () => {
    await expectPackageError(fixtureFile("local_offset_out_of_range.siralex.zip"), "local_header_out_of_range");
  });

  it("rejects local filename or extra-field declarations extending into the central directory", async () => {
    await expectPackageError(fixtureFile("local_variable_into_cd.siralex.zip"), "entry_range_overlaps_central_directory");
  });

  it("rejects local payload bytes extending into the central directory", async () => {
    await expectPackageError(fixtureFile("payload_into_cd.siralex.zip"), "entry_range_overlaps_central_directory");
  });

  it("rejects overlapping local-entry byte ranges", async () => {
    await expectPackageError(fixtureFile("entry_range_overlap.siralex.zip"), "entry_range_overlap");
  });

  it("rejects local/central size disagreements", async () => {
    await expectPackageError(fixtureFile("local_central_size_mismatch.siralex.zip"), "local_central_mismatch");
  });

  it("rejects oversized declared entries", async () => {
    await expectPackageError(fixtureFile("oversized_declared_entry.siralex.zip"), "entry_too_large");
  });

  it("rejects archives above the parser archive byte limit", async () => {
    const tiny = fixtureFile("valid_three_entry.siralex.zip");
    const oversized = new File([tiny], "oversized.siralex.zip", { type: "application/zip" });
    Object.defineProperty(oversized, "size", {
      value: BUNDLE_PACKAGE_V1_LIMITS.maxArchiveBytes + 1,
    });

    await expectPackageError(oversized, "archive_too_large");
  });

  it("surfaces BundlePackageError for structural failures", async () => {
    await expect(openStoredBundlePackage(fixtureFile("corrupt_eocd.siralex.zip"))).rejects.toBeInstanceOf(
      BundlePackageError,
    );
  });
});
