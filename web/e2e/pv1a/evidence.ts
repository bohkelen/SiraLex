/**
 * PV1A — local evidence artifacts for production desktop smoke.
 * Output: data/local_evidence/pv1a_production_desktop/<run_id>/ (gitignored).
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type ScenarioStatus = "PASS" | "FAIL" | "BLOCKED_EXTERNAL" | "NOT_APPLICABLE";

export type ScenarioResult = {
  id: string;
  status: ScenarioStatus;
  notes?: string;
  evidence?: string[];
};

export type Pv1aDecision =
  | "PV1A_PRODUCTION_DESKTOP_SMOKE_VERIFIED"
  | "PV1A_PRODUCTION_DESKTOP_SMOKE_BLOCKED";

export type AlignmentStatus =
  | "ALIGNED"
  | "DEPLOYMENT_BEHIND_REPOSITORY"
  | "DEPLOYMENT_AHEAD_OR_UNKNOWN";

export type DefectClass =
  | "PRODUCT_DEFECT"
  | "DEPLOYMENT_DEFECT"
  | "CONTENT/CATALOG_DEFECT"
  | "HARNESS_DEFECT"
  | "ENVIRONMENT_DEFECT";

export type DefectRecord = {
  class: DefectClass;
  summary: string;
  blocks_verified: boolean;
};

export type Pv1aSummary = {
  schema_version: "pv1a_production_desktop_smoke_summary_v1";
  decision: Pv1aDecision;
  alignment_status: AlignmentStatus;
  repository_head: string;
  amended_floor_commit: string;
  production_url: string;
  verification_timestamp: string;
  browser: string;
  os: string;
  scenarios: ScenarioResult[];
  defects: DefectRecord[];
  artifact_names: string[];
  evidence_path: string;
};

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

export function createRunId(now = new Date()): string {
  const iso = now.toISOString().replace(/[:.]/g, "-");
  return `pv1a_${iso}`;
}

export function evidenceRoot(runId: string): string {
  return path.join(repoRoot, "data/local_evidence/pv1a_production_desktop", runId);
}

export function mark(
  scenarios: ScenarioResult[],
  id: string,
  status: ScenarioStatus,
  notes?: string,
  evidence?: string[],
): void {
  const existing = scenarios.find((s) => s.id === id);
  if (existing) {
    existing.status = status;
    if (notes !== undefined) existing.notes = notes;
    if (evidence !== undefined) existing.evidence = evidence;
    return;
  }
  scenarios.push({ id, status, notes, evidence });
}

export async function writePv1aEvidenceArtifacts(options: {
  runId: string;
  summary: Pv1aSummary;
  identity: Record<string, unknown>;
  network: Record<string, unknown>;
  consoleLines?: string[];
  screenshotBuffers?: Array<{ name: string; buffer: Buffer }>;
  downloadTexts?: Array<{ name: string; text: string }>;
}): Promise<string> {
  const root = evidenceRoot(options.runId);
  const screenshotsDir = path.join(root, "screenshots");
  const downloadsDir = path.join(root, "downloads");
  await mkdir(screenshotsDir, { recursive: true });
  await mkdir(downloadsDir, { recursive: true });

  const artifactNames = ["summary.json", "identity.json", "network.json", "console.txt"];

  await writeFile(
    path.join(root, "identity.json"),
    `${JSON.stringify(options.identity, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    path.join(root, "network.json"),
    `${JSON.stringify(options.network, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    path.join(root, "console.txt"),
    `${(options.consoleLines ?? []).join("\n")}\n`,
    "utf8",
  );

  for (const shot of options.screenshotBuffers ?? []) {
    await writeFile(path.join(screenshotsDir, shot.name), shot.buffer);
    artifactNames.push(`screenshots/${shot.name}`);
  }

  for (const dl of options.downloadTexts ?? []) {
    await writeFile(path.join(downloadsDir, dl.name), dl.text.endsWith("\n") ? dl.text : `${dl.text}\n`);
    artifactNames.push(`downloads/${dl.name}`);
  }

  options.summary.artifact_names = artifactNames;
  options.summary.evidence_path = root;
  await writeFile(path.join(root, "summary.json"), `${JSON.stringify(options.summary, null, 2)}\n`, "utf8");
  return root;
}
