import { describe, expect, it } from "vitest";

import { createUsageEvidenceRow } from "../e2e/human_usage/evidence_writer";
import type { DiagnosticPersona, ScenarioTask } from "../e2e/human_usage/personas";

const persona: DiagnosticPersona = {
  id: "test_persona",
  location: "Guinea",
  userType: "test",
  whyThisPersonMatters: "unit test",
  primaryQuestion: "unit test",
  deviceCondition: "unit test",
  tasks: [],
};

const offlineTask: ScenarioTask = {
  id: "offline_check_test",
  layer: "offline_check",
  prompt: "offline",
  query: "école",
  intention: "Confirm offline reopen still searches.",
  direction: "source_to_target",
  expectedIssueClass: "setup_ux",
  candidateInterventionCategory: "offline_install_reliability",
  userImpact: "Offline failure would break low-connectivity use.",
};

function rowFor(status: "hit_single" | "hit_multi" | "miss" | "blocked" | "error", task: ScenarioTask = offlineTask) {
  return createUsageEvidenceRow({
    runId: "usage_test",
    generatedAtIso: "2026-07-23T00:00:00.000Z",
    persona,
    task,
    query: task.query,
    status,
    resultCount: status.startsWith("hit") ? 1 : status === "miss" ? 0 : null,
    searchMetaText: status.startsWith("hit") ? `1 result(s) for "${task.query}"` : `No results for "${task.query}".`,
    resultExcerpt: "",
    offlineReopenChecked: task.layer === "offline_check",
  });
}

describe("Phase 7N2K/L offline issue-class cleanup", () => {
  it("maps successful offline hit_single away from setup_ux", () => {
    const row = rowFor("hit_single");
    expect(row.issue_class).toBe("no_issue_observed");
    expect(row.candidate_intervention_category).toBe("none");
  });

  it("maps successful offline hit_multi away from setup_ux", () => {
    const row = rowFor("hit_multi");
    expect(row.issue_class).toBe("no_issue_observed");
    expect(row.candidate_intervention_category).toBe("none");
  });

  it("keeps miss + setup_ux as no_issue_observed with status still miss", () => {
    const row = rowFor("miss");
    expect(row.observed_result.status).toBe("miss");
    expect(row.issue_class).toBe("no_issue_observed");
    expect(row.candidate_intervention_category).toBe("none");
  });

  it("keeps blocked and error as setup_ux", () => {
    expect(rowFor("blocked").issue_class).toBe("setup_ux");
    expect(rowFor("error").issue_class).toBe("setup_ux");
    expect(rowFor("blocked").candidate_intervention_category).toBe("offline_install_reliability");
  });

  it("keeps pending_human_review + miss as pending_human_review", () => {
    const reviewTask: ScenarioTask = {
      ...offlineTask,
      id: "pending_review_miss",
      layer: "scenario_card",
      expectedIssueClass: "pending_human_review",
      candidateInterventionCategory: "human_review_required",
    };
    const row = rowFor("miss", reviewTask);
    expect(row.observed_result.status).toBe("miss");
    expect(row.issue_class).toBe("pending_human_review");
    expect(row.candidate_intervention_category).toBe("human_review_required");
  });

  it("leaves non-setup expected classes unchanged for hits", () => {
    const phraseTask: ScenarioTask = {
      ...offlineTask,
      id: "phrase_test",
      layer: "scenario_card",
      expectedIssueClass: "phrase_mismatch",
      candidateInterventionCategory: "phrase_handling",
    };
    const row = rowFor("hit_single", phraseTask);
    expect(row.issue_class).toBe("phrase_mismatch");
    expect(row.candidate_intervention_category).toBe("phrase_handling");
  });
});
