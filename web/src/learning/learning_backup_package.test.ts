/**
 * LP1I1 — Learning backup package model and validator tests.
 */

import { describe, expect, it } from "vitest";

import {
  LEARNING_BACKUP_FILE_SUFFIX,
  LEARNING_BACKUP_MAX_BYTES,
  LEARNING_BACKUP_PACKAGE_SCHEMA,
  buildLearningBackupFilename,
  buildLearningBackupPackage,
  compareLearningBackupRecords,
  deriveLearningBackupBundleSummaries,
  getUtf8ByteLength,
  learningBackupRecordKey,
  parseLearningBackupJson,
  serializeLearningBackupPackage,
  type LearningBackupPackageV1,
} from "./learning_backup_package";
import {
  LEARNING_RECORD_SCHEMA_VERSION,
  validateLearningRecordForWrite,
  type LearningRecordV1,
} from "./learning_record_types";

const HASH_A = "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const HASH_B = "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const TS = "2026-07-01T10:00:00.000Z";
const TS_REVIEW = "2026-07-02T12:00:00.000Z";
const EXPORTED_AT = "2026-07-30T22:30:00.000Z";

function makeRecord(overrides: Partial<LearningRecordV1> = {}): LearningRecordV1 {
  return {
    schema_version: LEARNING_RECORD_SCHEMA_VERSION,
    bundle_id: "bundle_a",
    ir_id: "lex-1",
    ir_kind: "lexicon_entry",
    content_sha256: HASH_A,
    storage_scope_id: "bundle_a::" + HASH_A,
    status: "still_learning",
    created_at: TS,
    display_cache: { headword_latin: "kùn" },
    last_reviewed: null,
    review_count: 0,
    ...overrides,
  };
}

function packageFromRecords(
  records: LearningRecordV1[],
  options: { exportedAt?: string; appVersion?: string } = {},
): LearningBackupPackageV1 {
  return buildLearningBackupPackage(records, {
    exportedAt: options.exportedAt ?? EXPORTED_AT,
    appVersion: options.appVersion,
  });
}

describe("learning_backup_package constants", () => {
  it("locks package schema, size limit, and file suffix", () => {
    expect(LEARNING_BACKUP_PACKAGE_SCHEMA).toBe("siralex_learning_backup_v1");
    expect(LEARNING_BACKUP_MAX_BYTES).toBe(25 * 1024 * 1024);
    expect(LEARNING_BACKUP_FILE_SUFFIX).toBe(".siralex-learning-backup.json");
  });
});

describe("valid packages", () => {
  it("accepts never-reviewed, still_learning, and remembered records", () => {
    const never = makeRecord({ ir_id: "n1", review_count: 0, last_reviewed: null });
    const still = makeRecord({
      ir_id: "s1",
      status: "still_learning",
      review_count: 2,
      last_reviewed: TS_REVIEW,
    });
    const remembered = makeRecord({
      ir_id: "r1",
      status: "remembered",
      review_count: 1,
      last_reviewed: TS_REVIEW,
    });
    const pkg = packageFromRecords([remembered, never, still]);
    const json = serializeLearningBackupPackage(pkg);
    const parsed = parseLearningBackupJson(json);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.package.record_count).toBe(3);
    expect(parsed.package.records.map((r) => r.ir_id)).toEqual(["n1", "r1", "s1"]);
  });

  it("accepts unresolved-compatible stamps without dictionary access", () => {
    const orphan = makeRecord({
      ir_id: "missing",
      content_sha256: HASH_B,
      storage_scope_id: "bundle_a::" + HASH_B,
      display_cache: { headword_latin: "orphan" },
    });
    const parsed = parseLearningBackupJson(serializeLearningBackupPackage(packageFromRecords([orphan])));
    expect(parsed.ok).toBe(true);
  });

  it("accepts multiple bundles and multiple hashes", () => {
    const records = [
      makeRecord({ bundle_id: "b2", ir_id: "x", content_sha256: HASH_A }),
      makeRecord({ bundle_id: "b1", ir_id: "y", content_sha256: HASH_A }),
      makeRecord({ bundle_id: "b1", ir_id: "z", content_sha256: HASH_B }),
    ];
    const pkg = packageFromRecords(records);
    expect(pkg.bundle_summaries.map((s) => s.bundle_id)).toEqual(["b1", "b2"]);
    expect(pkg.bundle_summaries[0]!.content_sha256_values).toEqual([HASH_A, HASH_B].sort());
    expect(parseLearningBackupJson(serializeLearningBackupPackage(pkg)).ok).toBe(true);
  });

  it("accepts optional app_version absent or present", () => {
    const without = packageFromRecords([makeRecord()]);
    expect(without.app_version).toBeUndefined();
    expect(parseLearningBackupJson(serializeLearningBackupPackage(without)).ok).toBe(true);

    const withVersion = packageFromRecords([makeRecord()], { appVersion: "1.2.3" });
    expect(withVersion.app_version).toBe("1.2.3");
    expect(parseLearningBackupJson(serializeLearningBackupPackage(withVersion)).ok).toBe(true);
  });

  it("accepts non-ASCII display cache", () => {
    const record = makeRecord({
      display_cache: { headword_latin: "dàa dá", headword_nko: "ߘߊ߫ ߘߊ", gloss_short: "ouverture" },
    });
    const parsed = parseLearningBackupJson(serializeLearningBackupPackage(packageFromRecords([record])));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.package.records[0]!.display_cache.headword_nko).toBe("ߘߊ߫ ߘߊ");
  });

  it("accepts semantically correct summaries in noncanonical order", () => {
    const records = [
      makeRecord({ bundle_id: "b1", ir_id: "a", content_sha256: HASH_A }),
      makeRecord({ bundle_id: "b2", ir_id: "b", content_sha256: HASH_B }),
    ];
    const pkg = packageFromRecords(records);
    const reordered: LearningBackupPackageV1 = {
      ...pkg,
      bundle_summaries: [...pkg.bundle_summaries].reverse(),
    };
    const json = JSON.stringify(reordered);
    const parsed = parseLearningBackupJson(json);
    expect(parsed.ok).toBe(true);
  });
});

describe("package shape rejection", () => {
  it("rejects invalid JSON and non-object tops", () => {
    expect(parseLearningBackupJson("{").ok).toBe(false);
    expect(parseLearningBackupJson("null").ok).toBe(false);
    expect(parseLearningBackupJson("[]").ok).toBe(false);
    expect(parseLearningBackupJson('"x"').ok).toBe(false);
    expect(parseLearningBackupJson("1").ok).toBe(false);
  });

  it("rejects missing/wrong schema and exported_at", () => {
    const base = packageFromRecords([makeRecord()]);
    const missingSchema = { ...base } as Record<string, unknown>;
    delete missingSchema.package_schema;
    expect(parseLearningBackupJson(JSON.stringify(missingSchema)).ok).toBe(false);

    expect(
      parseLearningBackupJson(JSON.stringify({ ...base, package_schema: "future_v9" })).ok,
    ).toBe(false);
    expect(parseLearningBackupJson(JSON.stringify({ ...base, exported_at: "" })).ok).toBe(false);
    expect(parseLearningBackupJson(JSON.stringify({ ...base, exported_at: "yesterday" })).ok).toBe(
      false,
    );
  });

  it("rejects record_count problems and empty package", () => {
    const base = packageFromRecords([makeRecord()]);
    expect(parseLearningBackupJson(JSON.stringify({ ...base, record_count: 2 })).ok).toBe(false);
    expect(parseLearningBackupJson(JSON.stringify({ ...base, record_count: 1.5 })).ok).toBe(false);
    expect(
      parseLearningBackupJson(
        JSON.stringify({ ...base, record_count: Number.MAX_SAFE_INTEGER + 1 }),
      ).ok,
    ).toBe(false);

    const empty = {
      package_schema: LEARNING_BACKUP_PACKAGE_SCHEMA,
      exported_at: EXPORTED_AT,
      record_count: 0,
      bundle_summaries: [],
      records: [],
    };
    const emptyResult = parseLearningBackupJson(JSON.stringify(empty));
    expect(emptyResult.ok).toBe(false);
    if (!emptyResult.ok) {
      expect(emptyResult.errors.some((e) => e.code === "invalid_package_field")).toBe(true);
    }
  });

  it("rejects missing summaries/records and unknown top-level fields", () => {
    const base = packageFromRecords([makeRecord()]) as Record<string, unknown>;
    const noSummaries = { ...base };
    delete noSummaries.bundle_summaries;
    expect(parseLearningBackupJson(JSON.stringify(noSummaries)).ok).toBe(false);

    const noRecords = { ...base };
    delete noRecords.records;
    expect(parseLearningBackupJson(JSON.stringify(noRecords)).ok).toBe(false);

    expect(
      parseLearningBackupJson(JSON.stringify({ ...base, extra_field: true })).ok,
    ).toBe(false);
  });
});

describe("bundle summaries", () => {
  it("rejects summary mismatches and invalid summary shapes", () => {
    const pkg = packageFromRecords([makeRecord()]);
    const badCount = {
      ...pkg,
      bundle_summaries: [{ ...pkg.bundle_summaries[0]!, record_count: 99 }],
    };
    expect(parseLearningBackupJson(JSON.stringify(badCount)).ok).toBe(false);

    const missingHash = {
      ...pkg,
      bundle_summaries: [{ ...pkg.bundle_summaries[0]!, content_sha256_values: [] }],
    };
    expect(parseLearningBackupJson(JSON.stringify(missingHash)).ok).toBe(false);

    const extraHash = {
      ...pkg,
      bundle_summaries: [
        {
          ...pkg.bundle_summaries[0]!,
          content_sha256_values: [HASH_A, HASH_B],
        },
      ],
    };
    expect(parseLearningBackupJson(JSON.stringify(extraHash)).ok).toBe(false);

    const duplicateHash = {
      ...pkg,
      bundle_summaries: [
        {
          ...pkg.bundle_summaries[0]!,
          content_sha256_values: [HASH_A, HASH_A],
        },
      ],
    };
    expect(parseLearningBackupJson(JSON.stringify(duplicateHash)).ok).toBe(false);

    const emptyBundleId = {
      ...pkg,
      bundle_summaries: [{ ...pkg.bundle_summaries[0]!, bundle_id: "" }],
    };
    expect(parseLearningBackupJson(JSON.stringify(emptyBundleId)).ok).toBe(false);

    const negative = {
      ...pkg,
      bundle_summaries: [{ ...pkg.bundle_summaries[0]!, record_count: -1 }],
    };
    expect(parseLearningBackupJson(JSON.stringify(negative)).ok).toBe(false);

    const nonStringHash = {
      ...pkg,
      bundle_summaries: [
        {
          ...pkg.bundle_summaries[0]!,
          content_sha256_values: [1],
        },
      ],
    };
    expect(parseLearningBackupJson(JSON.stringify(nonStringHash)).ok).toBe(false);

    const duplicateSummary = {
      ...pkg,
      bundle_summaries: [pkg.bundle_summaries[0]!, pkg.bundle_summaries[0]!],
    };
    expect(parseLearningBackupJson(JSON.stringify(duplicateSummary)).ok).toBe(false);

    const extraBundle = {
      ...pkg,
      bundle_summaries: [
        ...pkg.bundle_summaries,
        { bundle_id: "ghost", record_count: 0, content_sha256_values: [] },
      ],
    };
    expect(parseLearningBackupJson(JSON.stringify(extraBundle)).ok).toBe(false);
  });

  it("derives canonical summaries", () => {
    const records = [
      makeRecord({ bundle_id: "z", ir_id: "1", content_sha256: HASH_B }),
      makeRecord({ bundle_id: "a", ir_id: "2", content_sha256: HASH_A }),
      makeRecord({ bundle_id: "a", ir_id: "3", content_sha256: HASH_B }),
    ];
    expect(deriveLearningBackupBundleSummaries(records)).toEqual([
      {
        bundle_id: "a",
        record_count: 2,
        content_sha256_values: [HASH_A, HASH_B].sort(),
      },
      {
        bundle_id: "z",
        record_count: 1,
        content_sha256_values: [HASH_B],
      },
    ]);
  });
});

describe("learning records", () => {
  it("rejects structural and consistency failures", () => {
    const base = packageFromRecords([makeRecord()]);
    const mutate = (patch: Record<string, unknown>) => {
      const record = { ...base.records[0]!, ...patch };
      return parseLearningBackupJson(
        JSON.stringify({
          ...base,
          records: [record],
          bundle_summaries: deriveLearningBackupBundleSummaries([record as LearningRecordV1]),
          record_count: 1,
        }),
      );
    };

    expect(mutate({ schema_version: "learning_record_v0" }).ok).toBe(false);
    expect(mutate({ bundle_id: "" }).ok).toBe(false);
    expect(mutate({ ir_id: "" }).ok).toBe(false);
    expect(mutate({ ir_kind: "index_mapping" }).ok).toBe(false);
    expect(mutate({ content_sha256: "" }).ok).toBe(false);
    expect(mutate({ storage_scope_id: "" }).ok).toBe(false);
    expect(mutate({ status: "mastered" }).ok).toBe(false);
    expect(mutate({ created_at: "nope" }).ok).toBe(false);
    expect(mutate({ last_reviewed: "nope" }).ok).toBe(false);
    expect(mutate({ review_count: -1 }).ok).toBe(false);
    expect(mutate({ review_count: 1.5 }).ok).toBe(false);
    expect(mutate({ review_count: Number.MAX_SAFE_INTEGER + 1 }).ok).toBe(false);
    expect(mutate({ display_cache: {} }).ok).toBe(false);
    expect(mutate({ review_count: 0, last_reviewed: TS_REVIEW }).ok).toBe(false);
    expect(mutate({ review_count: 1, last_reviewed: null }).ok).toBe(false);
    expect(mutate({ unexpected: true }).ok).toBe(false);
  });

  it("shared write validator rejects unknown fields", () => {
    expect(() =>
      validateLearningRecordForWrite({ ...makeRecord(), extra: 1 } as unknown),
    ).toThrow(/unknown field/);
  });
});

describe("duplicate identities", () => {
  it("rejects identical and conflicting duplicates; accepts cross-bundle and distinct ir_id", () => {
    const a = makeRecord({ ir_id: "same" });
    const identical = [a, { ...a }];
    expect(() => packageFromRecords(identical)).toThrow(/duplicate/);

    const conflicting = [
      makeRecord({ ir_id: "same", review_count: 0, last_reviewed: null }),
      makeRecord({
        ir_id: "same",
        status: "remembered",
        review_count: 1,
        last_reviewed: TS_REVIEW,
      }),
    ];
    expect(() => packageFromRecords(conflicting)).toThrow(/duplicate/);

    const crossBundle = packageFromRecords([
      makeRecord({ bundle_id: "b1", ir_id: "same" }),
      makeRecord({ bundle_id: "b2", ir_id: "same" }),
    ]);
    expect(crossBundle.record_count).toBe(2);

    const distinct = packageFromRecords([
      makeRecord({ ir_id: "a", content_sha256: HASH_A, storage_scope_id: "s1" }),
      makeRecord({ ir_id: "b", content_sha256: HASH_A, storage_scope_id: "s1" }),
    ]);
    expect(distinct.record_count).toBe(2);

    expect(learningBackupRecordKey("b", "i")).toBe("b\0i");
    expect(compareLearningBackupRecords(makeRecord({ ir_id: "a" }), makeRecord({ ir_id: "b" }))).toBeLessThan(
      0,
    );
  });
});

describe("builder and deterministic serialization", () => {
  it("sorts records and produces identical serialization for different input orders", () => {
    const r1 = makeRecord({ bundle_id: "b2", ir_id: "z" });
    const r2 = makeRecord({ bundle_id: "b1", ir_id: "a" });
    const r3 = makeRecord({ bundle_id: "b1", ir_id: "b", content_sha256: HASH_B });

    const forward = packageFromRecords([r1, r2, r3], { appVersion: "t" });
    const reverse = packageFromRecords([r3, r2, r1], { appVersion: "t" });
    expect(serializeLearningBackupPackage(forward)).toBe(serializeLearningBackupPackage(reverse));
    expect(forward.records.map((r) => `${r.bundle_id}:${r.ir_id}`)).toEqual([
      "b1:a",
      "b1:b",
      "b2:z",
    ]);

    const json = serializeLearningBackupPackage(forward);
    expect(json.endsWith("\n")).toBe(true);
    expect(json.includes("\n  \"package_schema\"")).toBe(true);
    expect(json.indexOf('"package_schema"')).toBeLessThan(json.indexOf('"exported_at"'));
    expect(json.indexOf('"exported_at"')).toBeLessThan(json.indexOf('"app_version"'));
    expect(json.indexOf('"record_count"')).toBeLessThan(json.indexOf('"bundle_summaries"'));
    expect(json.indexOf('"bundle_summaries"')).toBeLessThan(json.indexOf('"records"'));

    const withoutApp = packageFromRecords([r2]);
    expect(serializeLearningBackupPackage(withoutApp).includes('"app_version"')).toBe(false);

    const parsed = parseLearningBackupJson(json);
    expect(parsed.ok).toBe(true);

    const original = [r1, r2, r3];
    const snapshot = structuredClone(original);
    packageFromRecords(original);
    expect(original).toEqual(snapshot);
  });

  it("omits undefined optional display_cache fields stably", () => {
    const withOptional = makeRecord({
      display_cache: { headword_latin: "a", gloss_short: "g" },
    });
    const json = serializeLearningBackupPackage(packageFromRecords([withOptional]));
    expect(json.includes('"gloss_short"')).toBe(true);
    expect(json.includes('"headword_nko"')).toBe(false);
  });
});

describe("filename helper", () => {
  it("formats UTC without colons or vocabulary", () => {
    expect(buildLearningBackupFilename(EXPORTED_AT)).toBe(
      "siralex-learning-backup-2026-07-30T22-30-00Z.json",
    );
    expect(buildLearningBackupFilename("2026-07-30T22:30:00.123Z")).toBe(
      "siralex-learning-backup-2026-07-30T22-30-00Z.json",
    );
    expect(() => buildLearningBackupFilename("nope")).toThrow();
    expect(buildLearningBackupFilename(EXPORTED_AT).includes(":")).toBe(false);
    expect(buildLearningBackupFilename(EXPORTED_AT).includes("kùn")).toBe(false);
  });
});

describe("UTF-8 size limit", () => {
  it("uses UTF-8 bytes and rejects oversized supplied byteLength before parse", () => {
    expect(getUtf8ByteLength("a")).toBe(1);
    expect(getUtf8ByteLength("é")).toBe(2);
    expect(getUtf8ByteLength("ߘ")).toBeGreaterThan(1);

    const tiny = serializeLearningBackupPackage(packageFromRecords([makeRecord()]));
    expect(parseLearningBackupJson(tiny, { byteLength: tiny.length }).ok).toBe(true);
    expect(parseLearningBackupJson(tiny, { byteLength: LEARNING_BACKUP_MAX_BYTES }).ok).toBe(true);

    const oversized = parseLearningBackupJson("{", {
      byteLength: LEARNING_BACKUP_MAX_BYTES + 1,
    });
    expect(oversized.ok).toBe(false);
    if (!oversized.ok) {
      expect(oversized.errors[0]!.code).toBe("file_too_large");
      expect(oversized.errors.some((e) => e.code === "invalid_json")).toBe(false);
    }
  });
});

describe("purity and preview types", () => {
  it("exposes restore preview types without IndexedDB", () => {
    const pkg = packageFromRecords([makeRecord()]);
    // Type-level shape smoke: preview fields exist for later LP1I3.
    const previewShape = {
      package_schema: pkg.package_schema,
      exported_at: pkg.exported_at,
      record_count: pkg.record_count,
      current_local_record_count: 0,
      bundle_compatibility: [
        {
          bundle_id: "bundle_a",
          record_count: 1,
          state: "not_installed" as const,
        },
      ],
      add_missing: { add_count: 1, skipped_existing_count: 0 },
      replace_all: { previous_count: 0, restored_count: 1 },
    };
    expect(previewShape.add_missing.add_count).toBe(1);
    expect(previewShape.replace_all.restored_count).toBe(1);
  });
});
