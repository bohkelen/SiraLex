import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  CandidateInterventionCategory,
  DiagnosticPersona,
  IssueClass,
  ScenarioTask,
  SearchDirection,
  SessionType,
} from "./personas";

export type ObservedResultStatus = "hit_single" | "hit_multi" | "miss" | "blocked" | "error";

export type UsageEvidenceRow = {
  schema_version: "local_usage_evidence_v1";
  run_id: string;
  generated_at_iso: string;
  tester_id: string;
  location: DiagnosticPersona["location"];
  user_type: string;
  session_type: SessionType;
  consent: "not_applicable";
  can_influence_demand: false;
  task_id: string;
  task_layer: ScenarioTask["layer"];
  task_prompt: string;
  query: string;
  user_intention: string;
  search_direction: SearchDirection;
  observed_result: {
    status: ObservedResultStatus;
    result_count: number | null;
    search_meta_text: string;
    result_excerpt: string;
    retry_of?: string;
    retry_reason?: string;
    offline_reopen_checked: boolean;
  };
  issue_class: IssueClass;
  recurrence: number;
  user_impact: string;
  candidate_intervention_category: CandidateInterventionCategory;
  human_disposition: "pending_owner_review";
  notes: string[];
};

export type ObservationInput = {
  runId: string;
  generatedAtIso: string;
  persona: DiagnosticPersona;
  task: ScenarioTask;
  query: string;
  status: ObservedResultStatus;
  resultCount: number | null;
  searchMetaText: string;
  resultExcerpt: string;
  retryOf?: string;
  retryReason?: string;
  offlineReopenChecked: boolean;
  notes?: string[];
};

export function createUsageEvidenceRow(input: ObservationInput): UsageEvidenceRow {
  const issueClass = deriveIssueClass(input.status, input.task.expectedIssueClass);
  return {
    schema_version: "local_usage_evidence_v1",
    run_id: input.runId,
    generated_at_iso: input.generatedAtIso,
    tester_id: input.persona.id,
    location: input.persona.location,
    user_type: input.persona.userType,
    session_type: "structured_usability",
    consent: "not_applicable",
    can_influence_demand: false,
    task_id: input.task.id,
    task_layer: input.task.layer,
    task_prompt: input.task.prompt,
    query: input.query,
    user_intention: input.task.intention,
    search_direction: input.task.direction,
    observed_result: {
      status: input.status,
      result_count: input.resultCount,
      search_meta_text: input.searchMetaText,
      result_excerpt: input.resultExcerpt,
      retry_of: input.retryOf,
      retry_reason: input.retryReason,
      offline_reopen_checked: input.offlineReopenChecked,
    },
    issue_class: issueClass,
    recurrence: 1,
    user_impact: input.task.userImpact,
    candidate_intervention_category:
      issueClass === "no_issue_observed" ? "none" : input.task.candidateInterventionCategory,
    human_disposition: "pending_owner_review",
    notes: [
      "Scripted diagnostic cohort row; do not use for demand ranking.",
      "Maninka usefulness and semantic fit require owner review.",
      ...(input.notes ?? []),
    ],
  };
}

export function applyRecurrence(rows: UsageEvidenceRow[]): UsageEvidenceRow[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = recurrenceKey(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return rows.map((row) => ({
    ...row,
    recurrence: counts.get(recurrenceKey(row)) ?? 1,
  }));
}

export async function writeEvidenceArtifacts(rows: UsageEvidenceRow[], outputRoot: string): Promise<string[]> {
  const runId = rows[0]?.run_id ?? `usage_${Date.now()}`;
  const outputDir = path.join(outputRoot, runId);
  await mkdir(outputDir, { recursive: true });

  const jsonlPath = path.join(outputDir, "structured_usability_evidence.jsonl");
  const markdownPath = path.join(outputDir, "structured_usability_evidence.md");
  const summaryPath = path.join(outputDir, "run_summary.json");

  await writeFile(jsonlPath, rows.map((row) => JSON.stringify(row)).join("\n") + "\n", "utf8");
  await writeFile(markdownPath, renderEvidenceMarkdown(rows), "utf8");
  await writeFile(
    summaryPath,
    JSON.stringify(
      {
        schema_version: "local_usage_evidence_summary_v1",
        run_id: runId,
        generated_at_iso: rows[0]?.generated_at_iso,
        row_count: rows.length,
        session_type: "structured_usability",
        can_influence_demand: false,
        raw_natural_use_logs_included: false,
        disposition_required: true,
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );

  return [jsonlPath, markdownPath, summaryPath];
}

function deriveIssueClass(status: ObservedResultStatus, expected: IssueClass): IssueClass {
  if (status === "hit_single" && expected === "pending_human_review") return "no_issue_observed";
  if (status === "hit_multi" && expected === "pending_human_review") return "interpretability";
  if (status === "miss" && expected === "pending_human_review") return "pending_human_review";
  if (status === "blocked" || status === "error") return "setup_ux";
  // Successful offline/reopen searches are not setup failures (offline_check personas expect setup_ux).
  if ((status === "hit_single" || status === "hit_multi") && expected === "setup_ux") {
    return "no_issue_observed";
  }
  // Normal offline content miss after searchable reopen is not a setup failure.
  if (status === "miss" && expected === "setup_ux") {
    return "no_issue_observed";
  }
  return expected;
}

function recurrenceKey(row: UsageEvidenceRow): string {
  return [
    row.session_type,
    row.location,
    row.issue_class,
    row.candidate_intervention_category,
    row.observed_result.status,
  ].join("|");
}

function renderEvidenceMarkdown(rows: UsageEvidenceRow[]): string {
  const header = [
    "# Structured Usability Evidence",
    "",
    "Scripted diagnostic cohort output. These rows are UX and comprehension evidence only; they cannot influence demand ranking.",
    "",
    "| Query / user intention | Direction | Observed result | Issue class | Recurrence | User impact | Candidate intervention | Human disposition |",
    "|---|---|---|---|---:|---|---|---|",
  ];

  const body = rows.map((row) =>
    [
      `${escapeCell(row.query)}<br>${escapeCell(row.user_intention)}`,
      row.search_direction,
      escapeCell(formatObservedResult(row)),
      row.issue_class,
      String(row.recurrence),
      escapeCell(row.user_impact),
      row.candidate_intervention_category,
      row.human_disposition,
    ].join(" | "),
  );

  return [...header, ...body.map((line) => `| ${line} |`), ""].join("\n");
}

function formatObservedResult(row: UsageEvidenceRow): string {
  const count = row.observed_result.result_count;
  const countText = count === null ? "unknown count" : `${count} result(s)`;
  const retry = row.observed_result.retry_of ? `; retry of "${row.observed_result.retry_of}"` : "";
  const offline = row.observed_result.offline_reopen_checked ? "; after offline reopen" : "";
  return `${row.observed_result.status}, ${countText}${retry}${offline}: ${row.observed_result.search_meta_text}`;
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, "<br>");
}
