/**
 * LP1I4 — Learning backup surface controller tests.
 */

// @vitest-environment jsdom

import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { deleteSiralexDb, openSiralexDb } from "../idb/siralex_db";
import {
  buildLearningBackupPackage,
  serializeLearningBackupPackage,
} from "./learning_backup_package";
import { createLearningBackupSurface } from "./learning_backup_surface";
import { saveLearningRecord } from "./learning_record_store";
import { LEARNING_RECORD_SCHEMA_VERSION, type LearningRecordV1 } from "./learning_record_types";

const HASH = "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const EXPORTED_AT = "2026-07-30T22:30:00.000Z";

function makeRecord(overrides: Partial<LearningRecordV1> = {}): LearningRecordV1 {
  return {
    schema_version: LEARNING_RECORD_SCHEMA_VERSION,
    bundle_id: "bundle_a",
    ir_id: "lex-1",
    ir_kind: "lexicon_entry",
    content_sha256: HASH,
    storage_scope_id: `bundle_a::${HASH}`,
    status: "still_learning",
    created_at: "2026-07-01T10:00:00.000Z",
    display_cache: { headword_latin: "kùn" },
    last_reviewed: null,
    review_count: 0,
    ...overrides,
  };
}

function backupFile(records: LearningRecordV1[], name = "b.json"): File {
  const pkg = buildLearningBackupPackage(records, { exportedAt: EXPORTED_AT });
  return new File([serializeLearningBackupPackage(pkg)], name, { type: "application/json" });
}

async function withDb<T>(fn: (db: IDBDatabase) => Promise<T>): Promise<T> {
  const db = await openSiralexDb();
  try {
    return await fn(db);
  } finally {
    db.close();
  }
}

beforeEach(async () => {
  try {
    await deleteSiralexDb();
  } catch {
    // ignore
  }
});

describe("learning backup surface export", () => {
  it("disables export when empty and downloads once when ready", async () => {
    await withDb(async (db) => {
      const downloadArtifact = vi.fn();
      let resolveExport!: (value: unknown) => void;
      const createExport = vi.fn(
        () =>
          new Promise((resolve) => {
            resolveExport = resolve;
          }),
      );

      const surface = createLearningBackupSurface(
        {
          openDb: async () => db,
          now: () => EXPORTED_AT,
          createExport: createExport as never,
          downloadArtifact,
        },
        { onModel: () => undefined },
      );

      await vi.waitFor(() => expect(surface.getVm().recordCount).toBe(0));
      expect(surface.getVm().exportEnabled).toBe(false);

      await saveLearningRecord(db, {
        bundle_id: "bundle_a",
        ir_id: "lex-1",
        ir_kind: "lexicon_entry",
        content_sha256: HASH,
        storage_scope_id: `bundle_a::${HASH}`,
        display_cache: { headword_latin: "kùn" },
      });
      await surface.refreshCount();
      await vi.waitFor(() => expect(surface.getVm().recordCount).toBe(1));
      expect(surface.getVm().exportEnabled).toBe(true);

      const first = surface.startExport();
      const second = surface.startExport();
      expect(createExport).toHaveBeenCalledTimes(1);
      resolveExport({
        ok: true,
        artifact: {
          filename: "out.json",
          mediaType: "application/json",
          text: "{}\n",
          byteLength: 3,
          recordCount: 1,
          bundleCount: 1,
          exportedAt: EXPORTED_AT,
        },
      });
      await Promise.all([first, second]);
      expect(downloadArtifact).toHaveBeenCalledTimes(1);
      expect(surface.getVm().exportResult).toEqual({
        kind: "success",
        recordCount: 1,
        filename: "out.json",
      });
      surface.dispose();
    });
  });

  it("ignores stale export completion after dispose", async () => {
    await withDb(async (db) => {
      await saveLearningRecord(db, {
        bundle_id: "bundle_a",
        ir_id: "lex-1",
        ir_kind: "lexicon_entry",
        content_sha256: HASH,
        storage_scope_id: `bundle_a::${HASH}`,
        display_cache: { headword_latin: "kùn" },
      });

      let resolveExport!: (v: unknown) => void;
      const pending = new Promise((resolve) => {
        resolveExport = resolve;
      });
      const downloadArtifact = vi.fn();
      const surface = createLearningBackupSurface(
        {
          openDb: async () => db,
          now: () => EXPORTED_AT,
          createExport: async () => pending as never,
          downloadArtifact,
        },
        { onModel: () => undefined },
      );
      await vi.waitFor(() => expect(surface.getVm().recordCount).toBe(1));
      const exportPromise = surface.startExport();
      surface.dispose();
      resolveExport({
        ok: true,
        artifact: {
          filename: "late.json",
          mediaType: "application/json",
          text: "{}\n",
          byteLength: 3,
          recordCount: 1,
          bundleCount: 1,
          exportedAt: EXPORTED_AT,
        },
      });
      await exportPromise;
      expect(downloadArtifact).not.toHaveBeenCalled();
    });
  });
});

describe("learning backup surface restore", () => {
  it("previews without mutation, confirms replace, and commits once", async () => {
    await withDb(async (db) => {
      await saveLearningRecord(db, {
        bundle_id: "bundle_a",
        ir_id: "local-only",
        ir_kind: "lexicon_entry",
        content_sha256: HASH,
        storage_scope_id: `bundle_a::${HASH}`,
        display_cache: { headword_latin: "local" },
      });

      const afterRestore = vi.fn();
      const surface = createLearningBackupSurface(
        { openDb: async () => db, now: () => EXPORTED_AT },
        { onModel: () => undefined, onAfterRestoreSuccess: afterRestore },
      );
      await vi.waitFor(() => expect(surface.getVm().recordCount).toBe(1));

      await surface.selectRestoreFile(backupFile([makeRecord({ ir_id: "from-backup" })]));
      const previewVm = surface.getVm();
      expect(previewVm.restore.phase).toBe("preview");
      if (previewVm.restore.phase !== "preview") return;
      expect(previewVm.restore.selectedPolicy).toBe("add_missing");
      expect(previewVm.restore.preview.add_missing).toMatchObject({
        state: "available",
        add_count: 1,
        skipped_existing_count: 0,
      });

      surface.selectPolicy("replace_all");
      surface.requestCommit();
      expect(surface.getVm().restore.phase).toBe("confirming");

      surface.cancelConfirm();
      expect(surface.getVm().restore.phase).toBe("preview");

      surface.selectPolicy("replace_all");
      surface.requestCommit();
      surface.confirmReplaceAll();
      surface.confirmReplaceAll();
      await vi.waitFor(() => expect(surface.getVm().restore.phase).toBe("success"));
      expect(afterRestore).toHaveBeenCalledTimes(1);
      const success = surface.getVm().restore;
      expect(success.phase).toBe("success");
      if (success.phase !== "success") return;
      expect(success.policy).toBe("replace_all");
      expect(success.previous_count).toBe(1);
      expect(success.restored_count).toBe(1);
      surface.dispose();
    });
  });

  it("drops stale file A when file B wins the race", async () => {
    await withDb(async (db) => {
      let gate!: () => void;
      const blocked = new Promise<void>((resolve) => {
        gate = resolve;
      });

      const surface = createLearningBackupSurface(
        {
          openDb: async () => db,
          now: () => EXPORTED_AT,
          readFile: async (file) => {
            if (file?.name === "a.json") {
              await blocked;
            }
            const { readLearningBackupFile } = await import("./learning_backup_file");
            return readLearningBackupFile(file);
          },
        },
        { onModel: () => undefined },
      );

      const a = surface.selectRestoreFile(backupFile([makeRecord({ ir_id: "a" })], "a.json"));
      await surface.selectRestoreFile(backupFile([makeRecord({ ir_id: "b" })], "b.json"));
      gate();
      await a;
      const vm = surface.getVm();
      expect(vm.restore.phase).toBe("preview");
      if (vm.restore.phase !== "preview") return;
      expect(vm.restore.filename).toBe("b.json");
      expect(vm.restore.preview.record_count).toBe(1);
      surface.dispose();
    });
  });
});
