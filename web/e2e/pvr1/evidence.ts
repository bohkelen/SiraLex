/**
 * PVR1 — local evidence under data/local_evidence/pvr1_theme_feedback_production/<run_id>/
 * (gitignored via data/*). Do not store private inbox contents.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type CheckStatus = "PASS" | "FAIL" | "NOT_VERIFIED" | "NOT_RUN";

export type Pvr1Decision =
  | "PVR1_THEME_AND_FEEDBACK_PRODUCTION_VERIFIED"
  | "PVR1_THEME_AND_FEEDBACK_PRODUCTION_BLOCKED";

export type DefectClass =
  | "PRODUCT_DEFECT"
  | "DEPLOYMENT_DEFECT"
  | "CONFIGURATION_DEFECT"
  | "HARNESS_DEFECT"
  | "ENVIRONMENT_DEFECT";

export type DefectRecord = {
  class: DefectClass;
  summary: string;
  blocks_verified: boolean;
};

export type Pvr1Summary = {
  schema_version: "pvr1_theme_feedback_production_summary_v1";
  decision: Pvr1Decision;
  production_url: string;
  repository_head: string;
  shell_asset: string | null;
  configured_review_inbox: string;
  verification_timestamp: string;
  browser: string;
  os: string;
  checks: Record<string, CheckStatus>;
  transport_method: "share" | "download_mailto" | "unknown" | null;
  cf1_attachment_filename: string | null;
  cf2_attachment_filename: string | null;
  cf1_package_schema: string | null;
  cf2_package_schema: string | null;
  defects: DefectRecord[];
  notes: string[];
  evidence_path: string;
};

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

export function createRunId(now = new Date()): string {
  const iso = now.toISOString().replace(/[:.]/g, "-");
  return `pvr1_${iso}`;
}

export function evidenceRoot(runId: string): string {
  return path.join(repoRoot, "data/local_evidence/pvr1_theme_feedback_production", runId);
}

export async function writePvr1Evidence(args: {
  runId: string;
  summary: Pvr1Summary;
  consoleLines: string[];
  networkEvents: Array<Record<string, unknown>>;
  packageTexts: Array<{ name: string; text: string }>;
  screenshotBuffers: Array<{ name: string; buffer: Buffer }>;
}): Promise<string> {
  const root = evidenceRoot(args.runId);
  await mkdir(root, { recursive: true });
  const artifactNames: string[] = [];

  const summaryPath = path.join(root, "summary.json");
  args.summary.evidence_path = root;
  await writeFile(summaryPath, `${JSON.stringify(args.summary, null, 2)}\n`, "utf-8");
  artifactNames.push("summary.json");

  await writeFile(
    path.join(root, "console.txt"),
    `${args.consoleLines.join("\n")}\n`,
    "utf-8",
  );
  artifactNames.push("console.txt");

  await writeFile(
    path.join(root, "network.json"),
    `${JSON.stringify({ events: args.networkEvents }, null, 2)}\n`,
    "utf-8",
  );
  artifactNames.push("network.json");

  for (const pkg of args.packageTexts) {
    // Store schema/status excerpts only — not full private draft bodies in report prose.
    const safeName = pkg.name.replace(/[^\w.-]+/g, "_");
    await writeFile(path.join(root, safeName), pkg.text, "utf-8");
    artifactNames.push(safeName);
  }

  for (const shot of args.screenshotBuffers) {
    await writeFile(path.join(root, shot.name), shot.buffer);
    artifactNames.push(shot.name);
  }

  await writeFile(
    path.join(root, "artifact_names.txt"),
    `${artifactNames.join("\n")}\n`,
    "utf-8",
  );

  return root;
}
