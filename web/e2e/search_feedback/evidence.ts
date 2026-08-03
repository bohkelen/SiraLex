/**
 * CF2I5 — local evidence artifacts for offline search-feedback lifecycle runs.
 * Output is under data/local_evidence (gitignored via data/*).
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type LifecycleStatus =
  | "NOT_RUN"
  | "PASS"
  | "FAIL"
  | "BLOCKED_EXTERNAL"
  | "NOT_APPLICABLE";

export type LifecycleScenarioResult = {
  id: string;
  status: LifecycleStatus;
  notes?: string;
  evidence?: string[];
};

export type Cf2EvidenceSummary = {
  schema_version: "cf2_offline_lifecycle_summary_v1";
  commit: string;
  app_version: string;
  browser: string;
  browser_version?: string;
  os: string;
  preview_url: string;
  test_timestamp: string;
  bundle_id: string;
  content_sha256: string;
  storage_scope_id?: string;
  dictionary_fixture: string;
  scenario: string;
  overall_status: LifecycleStatus;
  scenarios: LifecycleScenarioResult[];
  artifact_names: string[];
  defect_references: string[];
};

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

export function createRunId(now = new Date()): string {
  const iso = now.toISOString().replace(/[:.]/g, "-");
  return `cf2i5_${iso}`;
}

export function evidenceRoot(runId: string): string {
  return path.join(repoRoot, "data/local_evidence/cf2_offline_lifecycle", runId);
}

export async function writeCf2EvidenceArtifacts(options: {
  runId: string;
  summary: Cf2EvidenceSummary;
  exportedPackageText?: string;
  browserInfo?: Record<string, unknown>;
  consoleLines?: string[];
  networkLines?: string[];
}): Promise<string> {
  const root = evidenceRoot(options.runId);
  const screenshots = path.join(root, "screenshots");
  const downloads = path.join(root, "downloads");
  await mkdir(screenshots, { recursive: true });
  await mkdir(downloads, { recursive: true });

  const artifactNames = [
    "summary.json",
    "browser_metadata.json",
    "console.txt",
    "network.json",
  ];
  await writeFile(
    path.join(root, "summary.json"),
    `${JSON.stringify(options.summary, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    path.join(root, "browser_metadata.json"),
    `${JSON.stringify(options.browserInfo ?? {}, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    path.join(root, "console.txt"),
    `${(options.consoleLines ?? []).join("\n")}\n`,
    "utf8",
  );
  await writeFile(
    path.join(root, "network.json"),
    `${JSON.stringify({ lines: options.networkLines ?? [] }, null, 2)}\n`,
    "utf8",
  );

  if (options.exportedPackageText !== undefined) {
    await writeFile(
      path.join(downloads, "exported-search-feedback-package.json"),
      options.exportedPackageText.endsWith("\n")
        ? options.exportedPackageText
        : `${options.exportedPackageText}\n`,
      "utf8",
    );
    artifactNames.push("downloads/exported-search-feedback-package.json");
  }

  options.summary.artifact_names = artifactNames;
  await writeFile(
    path.join(root, "summary.json"),
    `${JSON.stringify(options.summary, null, 2)}\n`,
    "utf8",
  );
  return root;
}
