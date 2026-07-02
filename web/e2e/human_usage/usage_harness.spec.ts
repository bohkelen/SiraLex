import path from "node:path";
import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { expect, test, type BrowserContext, type Locator, type Page } from "@playwright/test";

import {
  applyRecurrence,
  createUsageEvidenceRow,
  type ObservedResultStatus,
  type UsageEvidenceRow,
  writeEvidenceArtifacts,
} from "./evidence_writer";
import { diagnosticPersonas, type DiagnosticPersona, type ScenarioTask, type SearchDirection } from "./personas";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const outputRoot = path.resolve(webRoot, "../data/local_evidence/human_usage_automation");
const usagePackagePath = process.env.SIRALEX_USAGE_PACKAGE?.trim();
const usageBundleDir =
  process.env.SIRALEX_USAGE_BUNDLE_DIR?.trim() ??
  path.join(webRoot, "public/debug-bundles/test_directional_bundle");
const installTimeoutMs = Number.parseInt(
  process.env.SIRALEX_USAGE_INSTALL_TIMEOUT_MS ?? (usagePackagePath ? "900000" : "90000"),
  10,
);
const queryTimeoutMs = Number.parseInt(process.env.SIRALEX_USAGE_QUERY_TIMEOUT_MS ?? "5000", 10);
const offlineTimeoutMs = Number.parseInt(process.env.SIRALEX_USAGE_OFFLINE_TIMEOUT_MS ?? "10000", 10);

test.describe("local human-like structured usability automation", () => {
  test("runs the ten diagnostic archetypes without producing demand evidence", async ({ browser }) => {
    const runId = `usage_${new Date().toISOString().replace(/[:.]/g, "-")}`;
    const generatedAtIso = new Date().toISOString();
    const rows: UsageEvidenceRow[] = [];
    const context = await browser.newContext({ baseURL: "http://127.0.0.1:4173" });
    const page = await context.newPage();
    const runNotes = [
      "Featured dictionary installed once for this local automation run to keep execution practical.",
      "Per-persona rows remain structured usability evidence, not demand evidence.",
    ];

    try {
      await installFeaturedDictionary(page, runNotes);

      for (const persona of diagnosticPersonas) {
        const notes = [...runNotes, `Persona primary question: ${persona.primaryQuestion}`, persona.deviceCondition];
        let currentDirection: SearchDirection = "source_to_target";
        await context.setOffline(false);
        await page.goto("/", { waitUntil: "domcontentloaded" });
        await expect(page.locator("#searchInput")).toBeEnabled({ timeout: 60_000 });

        for (const task of persona.tasks) {
          const offlineReopenChecked = task.layer === "offline_check";
          if (offlineReopenChecked) {
            await reopenOffline(context, page, notes);
            currentDirection = "source_to_target";
          }

          currentDirection = await setSearchDirection(page, currentDirection, task.direction);
          rows.push(
            createUsageEvidenceRow({
              runId,
              generatedAtIso,
              persona,
              task,
              query: task.query,
              ...(await runQuery(page, task.query)),
              offlineReopenChecked,
              notes,
            }),
          );

          if (task.retryQuery) {
            currentDirection = await setSearchDirection(page, currentDirection, task.direction);
            rows.push(
              createUsageEvidenceRow({
                runId,
                generatedAtIso,
                persona,
                task,
                query: task.retryQuery,
                ...(await runQuery(page, task.retryQuery)),
                retryOf: task.query,
                retryReason: task.retryReason,
                offlineReopenChecked,
                notes,
              }),
            );
          }
        }
      }
    } finally {
      await context.close();
    }

    const artifacts = await writeEvidenceArtifacts(applyRecurrence(rows), outputRoot);
    test.info().annotations.push({
      type: "local-evidence-artifacts",
      description: artifacts.join("\n"),
    });

    expect(rows.length).toBeGreaterThanOrEqual(diagnosticPersonas.length * 6);
    expect(rows.every((row) => row.can_influence_demand === false)).toBe(true);
    await browser.close();
  });
});

async function installFeaturedDictionary(page: Page, notes: string[]): Promise<void> {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#app")).toBeVisible();

  const searchInput = page.locator("#searchInput");
  if (await searchInput.isEnabled()) {
    notes.push("Featured dictionary was already available in this browser context.");
    return;
  }

  if (usagePackagePath) {
    await installDictionaryPackage(page, usagePackagePath, notes);
    return;
  }

  if (usageBundleDir) {
    await installLegacyBundleDir(page, usageBundleDir, notes);
    return;
  }

  const featuredInstall = page.locator("#featuredInstall");
  await expect(featuredInstall).toBeVisible();
  await featuredInstall.click();
  await expect(searchInput).toBeEnabled({ timeout: installTimeoutMs });
  await expect(page.locator("#activeDictionarySummary")).not.toContainText(/No dictionary added|Aucun dictionnaire ajouté/, {
    timeout: 30_000,
  });
}

async function installDictionaryPackage(page: Page, packagePath: string, notes: string[]): Promise<void> {
  const resolvedPackagePath = path.resolve(packagePath);
  await access(resolvedPackagePath);
  notes.push(`Installed dictionary from local package: ${resolvedPackagePath}`);

  await openManageDictionariesPanel(page);
  const packageInput = page.locator("#packageImportFile");
  await expect(packageInput).toBeAttached();
  await packageInput.setInputFiles(resolvedPackagePath);
  await dispatchChange(page, "packageImportFile");
  await expect(page.locator("#importProgress")).toContainText(/Preparing|Verifying|Installing|Dictionary installed/i, {
    timeout: 30_000,
  });
  await expect(page.locator("#searchInput")).toBeEnabled({ timeout: installTimeoutMs });
  await expect(page.locator("#activeDictionarySummary")).not.toContainText(/No dictionary added|Aucun dictionnaire ajouté/, {
    timeout: 30_000,
  });
}

async function installLegacyBundleDir(page: Page, bundleDir: string, notes: string[]): Promise<void> {
  const resolvedBundleDir = path.resolve(bundleDir);
  const files = [
    path.join(resolvedBundleDir, "bundle.manifest.json"),
    path.join(resolvedBundleDir, "records.jsonl"),
    path.join(resolvedBundleDir, "search_index.jsonl"),
  ];
  await Promise.all(files.map((file) => access(file)));
  notes.push(`Installed dictionary from local three-file bundle: ${resolvedBundleDir}`);

  await openManageDictionariesPanel(page);
  const quickImportInput = page.locator("#quickImportFiles");
  await expect(quickImportInput).toBeAttached();
  await quickImportInput.setInputFiles(files);
  await dispatchChange(page, "quickImportFiles");
  await expect(page.locator("#importProgress")).toContainText(/Installing|Complete|already installed/i, {
    timeout: 30_000,
  });
  await expect(page.locator("#searchInput")).toBeEnabled({ timeout: installTimeoutMs });
  await expect(page.locator("#activeDictionarySummary")).not.toContainText(/No dictionary added|Aucun dictionnaire ajouté/, {
    timeout: 30_000,
  });
}

async function openManageDictionariesPanel(page: Page): Promise<void> {
  await page.locator("#manageDictionariesPanel").evaluate((el) => {
    if (el instanceof HTMLDetailsElement) el.open = true;
  });
}

async function dispatchChange(page: Page, elementId: string): Promise<void> {
  await page.evaluate((id) => {
    const input = document.getElementById(id);
    input?.dispatchEvent(new Event("change", { bubbles: true }));
  }, elementId);
}

async function reopenOffline(context: BrowserContext, page: Page, notes: string[]): Promise<void> {
  await context.setOffline(true);
  try {
    await page.reload({ waitUntil: "domcontentloaded", timeout: offlineTimeoutMs });
    await expect(page.locator("#searchInput")).toBeEnabled({ timeout: offlineTimeoutMs });
    notes.push("Offline reopen completed in Chromium context.");
  } catch (error) {
    notes.push(`Offline reopen did not reach searchable state: ${String(error)}`);
  }
}

async function setSearchDirection(
  page: Page,
  currentDirection: SearchDirection,
  desiredDirection: SearchDirection,
): Promise<SearchDirection> {
  if (currentDirection === desiredDirection) return currentDirection;
  await page.locator("#langToggle").click();
  await expect(page.locator("#searchLabel")).toContainText(desiredDirection === "source_to_target" ? "→" : "→");
  return desiredDirection;
}

async function runQuery(
  page: Page,
  query: string,
): Promise<{
  status: ObservedResultStatus;
  resultCount: number | null;
  searchMetaText: string;
  resultExcerpt: string;
}> {
  const searchInput = page.locator("#searchInput");
  const searchMeta = page.locator("#searchMeta");
  const searchResults = page.locator("#searchResults");

  try {
    const previousSearchMetaText = (await searchMeta.innerText().catch(() => "")).trim();
    await searchInput.fill(query);
    await waitForSettledSearchMeta(searchMeta, previousSearchMetaText, query);

    const searchMetaText = (await searchMeta.innerText()).trim();
    const resultExcerpt = ((await searchResults.innerText().catch(() => "")) ?? "").trim().slice(0, 500);
    const resultCount = parseResultCount(searchMetaText);
    return {
      status: deriveObservedStatus(searchMetaText, resultCount),
      resultCount,
      searchMetaText,
      resultExcerpt,
    };
  } catch (error) {
    return {
      status: "error",
      resultCount: null,
      searchMetaText: `Search automation error for "${query}": ${String(error)}`,
      resultExcerpt: "",
    };
  }
}

async function waitForSettledSearchMeta(
  searchMeta: Locator,
  previousSearchMetaText: string,
  query: string,
): Promise<void> {
  const deadline = Date.now() + queryTimeoutMs;
  let latest = "";
  while (Date.now() < deadline) {
    latest = (await searchMeta.innerText().catch(() => "")).trim();
    if (latest.length > 0 && (latest !== previousSearchMetaText || latest.includes(query))) return;
    await searchMeta.page().waitForTimeout(100);
  }
  throw new Error(
    `Search metadata did not settle for "${query}" within ${queryTimeoutMs}ms. Last meta: ${latest}`,
  );
}

function parseResultCount(searchMetaText: string): number | null {
  const match = searchMetaText.match(/(\d+)\s+(?:result|résultat)/i);
  if (!match?.[1]) return null;
  return Number.parseInt(match[1], 10);
}

function deriveObservedStatus(searchMetaText: string, resultCount: number | null): ObservedResultStatus {
  if (/No results|No exact result|Aucun résultat|Aucun résultat exact/i.test(searchMetaText)) return "miss";
  if (resultCount === 1) return "hit_single";
  if (typeof resultCount === "number" && resultCount > 1) return "hit_multi";
  return "blocked";
}
