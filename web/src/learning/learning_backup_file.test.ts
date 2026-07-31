/**
 * LP1I4 — Learning backup file adapter tests.
 */

import { describe, expect, it, vi } from "vitest";

import {
  decodeLearningBackupUtf8,
  downloadLearningBackupArtifact,
  readLearningBackupFile,
} from "./learning_backup_file";
import {
  buildLearningBackupPackage,
  isVerifiedLearningBackupPackage,
  serializeLearningBackupPackage,
  LEARNING_BACKUP_MAX_BYTES,
} from "./learning_backup_package";
import { LEARNING_RECORD_SCHEMA_VERSION, type LearningRecordV1 } from "./learning_record_types";

const HASH = "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const EXPORTED_AT = "2026-07-30T22:30:00.000Z";

function makeRecord(): LearningRecordV1 {
  return {
    schema_version: LEARNING_RECORD_SCHEMA_VERSION,
    bundle_id: "b1",
    ir_id: "lex-1",
    ir_kind: "lexicon_entry",
    content_sha256: HASH,
    storage_scope_id: `b1::${HASH}`,
    status: "still_learning",
    created_at: "2026-07-01T10:00:00.000Z",
    display_cache: { headword_latin: "kùn" },
    last_reviewed: null,
    review_count: 0,
  };
}

function validJsonFile(name = "backup.json"): File {
  const pkg = buildLearningBackupPackage([makeRecord()], { exportedAt: EXPORTED_AT });
  const text = serializeLearningBackupPackage(pkg);
  return new File([text], name, { type: "application/json" });
}

describe("decodeLearningBackupUtf8", () => {
  it("decodes valid UTF-8 including non-ASCII", () => {
    const bytes = new TextEncoder().encode('{"x":"ߘߊ߫"}');
    expect(decodeLearningBackupUtf8(bytes.buffer)).toContain("ߘߊ߫");
  });

  it("rejects malformed UTF-8 without replacement", () => {
    const bad = new Uint8Array([0x22, 0xc3, 0x28, 0x22]); // invalid sequence
    expect(() => decodeLearningBackupUtf8(bad.buffer)).toThrow();
  });
});

describe("readLearningBackupFile", () => {
  it("returns verified package for valid UTF-8 JSON", async () => {
    const result = await readLearningBackupFile(validJsonFile("mine.json"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.filename).toBe("mine.json");
    expect(isVerifiedLearningBackupPackage(result.verified)).toBe(true);
    expect(result.verified.package.record_count).toBe(1);
  });

  it("rejects oversize before decode", async () => {
    const file = {
      name: "huge.json",
      size: LEARNING_BACKUP_MAX_BYTES + 1,
      arrayBuffer: vi.fn(async () => {
        throw new Error("should not read");
      }),
    } as unknown as File;
    const result = await readLearningBackupFile(file);
    expect(result).toEqual({ ok: false, code: "file_too_large" });
    expect(file.arrayBuffer).not.toHaveBeenCalled();
  });

  it("rejects invalid UTF-8", async () => {
    const bad = new Uint8Array([0x7b, 0xc3, 0x28, 0x7d]);
    const file = new File([bad], "bad.json", { type: "application/json" });
    const result = await readLearningBackupFile(file);
    expect(result).toEqual({ ok: false, code: "invalid_utf8" });
  });

  it("rejects invalid JSON / unsupported schema without mutation APIs", async () => {
    const invalid = new File(["{"], "x.json", { type: "application/json" });
    const a = await readLearningBackupFile(invalid);
    expect(a.ok).toBe(false);
    if (a.ok) return;
    expect(a.code).toBe("invalid_backup");

    const unsupported = new File(
      [
        JSON.stringify({
          package_schema: "siralex_learning_backup_v0",
          exported_at: EXPORTED_AT,
          record_count: 1,
          bundle_summaries: [],
          records: [makeRecord()],
        }),
      ],
      "old.json",
      { type: "application/json" },
    );
    const b = await readLearningBackupFile(unsupported);
    expect(b.ok).toBe(false);
  });

  it("returns no_file for null", async () => {
    expect(await readLearningBackupFile(null)).toEqual({ ok: false, code: "no_file" });
  });
});

describe("downloadLearningBackupArtifact", () => {
  it("creates one object URL, clicks download, and revokes", () => {
    const createObjectUrl = vi.fn(() => "blob:test");
    const revokeObjectUrl = vi.fn();
    const click = vi.fn();
    const remove = vi.fn();
    const appendChild = vi.fn();
    const documentRef = {
      body: { appendChild },
      createElement: vi.fn(() => ({
        href: "",
        download: "",
        rel: "",
        click,
        remove,
      })),
    } as unknown as Document;

    downloadLearningBackupArtifact(
      {
        filename: "siralex-learning-backup-2026-07-30T22-30-00Z.json",
        mediaType: "application/json",
        text: "{}\n",
        byteLength: 3,
        recordCount: 1,
        bundleCount: 1,
        exportedAt: EXPORTED_AT,
      },
      { createObjectUrl, revokeObjectUrl, documentRef },
    );

    expect(createObjectUrl).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:test");
    expect(remove).toHaveBeenCalled();
  });
});
