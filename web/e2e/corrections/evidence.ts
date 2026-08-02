/**
 * CF1I5 — local evidence artifacts for offline correction lifecycle runs.
 * Output is under data/local_evidence (gitignored).
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

export type Cf1EvidenceSummary = {
  schema_version: "cf1_offline_lifecycle_summary_v1";
  commit: string;
  app_version: string;
  browser: string;
  os: string;
  test_timestamp: string;
  bundle_id: string;
  content_sha256: string;
  scenario: string;
  overall_status: LifecycleStatus;
  scenarios: LifecycleScenarioResult[];
  artifact_names: string[];
  defect_references: string[];
};

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

export function createRunId(now = new Date()): string {
  const iso = now.toISOString().replace(/[:.]/g, "-");
  return `cf1i5_${iso}`;
}

export function evidenceRoot(runId: string): string {
  return path.join(repoRoot, "data/local_evidence/cf1_offline_lifecycle", runId);
}

export async function writeCf1EvidenceArtifacts(options: {
  runId: string;
  summary: Cf1EvidenceSummary;
  exportedPackageText?: string;
  browserInfo?: Record<string, unknown>;
  consoleLines?: string[];
  networkLines?: string[];
}): Promise<string> {
  const root = evidenceRoot(options.runId);
  const screenshots = path.join(root, "screenshots");
  await mkdir(screenshots, { recursive: true });

  const artifactNames = ["summary.json", "browser-info.json", "console.log", "network.log"];
  await writeFile(path.join(root, "summary.json"), `${JSON.stringify(options.summary, null, 2)}\n`, "utf8");
  await writeFile(
    path.join(root, "browser-info.json"),
    `${JSON.stringify(options.browserInfo ?? {}, null, 2)}\n`,
    "utf8",
  );
  await writeFile(path.join(root, "console.log"), `${(options.consoleLines ?? []).join("\n")}\n`, "utf8");
  await writeFile(path.join(root, "network.log"), `${(options.networkLines ?? []).join("\n")}\n`, "utf8");

  if (options.exportedPackageText !== undefined) {
    await writeFile(
      path.join(root, "exported-correction-package.json"),
      options.exportedPackageText.endsWith("\n")
        ? options.exportedPackageText
        : `${options.exportedPackageText}\n`,
      "utf8",
    );
    artifactNames.push("exported-correction-package.json");
  }

  options.summary.artifact_names = artifactNames;
  await writeFile(path.join(root, "summary.json"), `${JSON.stringify(options.summary, null, 2)}\n`, "utf8");
  return root;
}
