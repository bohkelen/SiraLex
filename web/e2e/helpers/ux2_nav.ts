import { expect, type Page } from "@playwright/test";

export type Ux2PrimaryDestination = "search" | "saved" | "review" | "more";

export async function navigateUx2Primary(
  page: Page,
  destination: Ux2PrimaryDestination,
): Promise<void> {
  await page.locator(`[data-testid="ux2-nav-${destination}"]`).click();
  await expect(page.locator("#ux2AppShell")).toHaveAttribute("data-primary", destination);
}

export async function openMoreAnd(
  page: Page,
  action: "corrections" | "search-feedback" | "dictionaries" | "learning-data",
): Promise<void> {
  await navigateUx2Primary(page, "more");
  if (action === "corrections") {
    await page.locator("#openManageCorrections").click();
    return;
  }
  if (action === "search-feedback") {
    await page.locator("#openManageSearchFeedback").click();
    return;
  }
  if (action === "learning-data") {
    await page.locator("#openManageLearningData").click();
    await expect(page.locator("#moreManagementHost")).toBeVisible();
    await expect(page.locator("#learningBackupHost")).toBeVisible();
    return;
  }
  await page.locator("#openManageDictionaries").click();
  await expect(page.locator("#moreManagementHost")).toBeVisible();
  await expect(page.locator("#dictionary-management-heading")).toBeVisible();
  await expect(page.locator("#ux2AppShell")).toHaveAttribute(
    "data-more-management",
    "dictionaries",
  );
}

/** Open Dictionaries including the subordinate data-management / Delete DB area. */
export async function openDictionariesDataManagement(page: Page): Promise<void> {
  await openMoreAnd(page, "dictionaries");
  await expect(page.locator("#dictionariesDestructive")).toBeVisible();
  await expect(page.locator("#clearDb")).toBeVisible();
}

/** Open Dictionaries Advanced disclosure (catalog / Diagnostics / Developer tools). */
export async function openDictionariesAdvanced(page: Page): Promise<void> {
  await openMoreAnd(page, "dictionaries");
  const advanced = page.locator("#dictionariesAdvanced");
  await advanced.evaluate((el) => {
    if (el instanceof HTMLDetailsElement) el.open = true;
  });
  await expect(advanced).toHaveAttribute("open", "");
}

/** Visible search-from language (left label in UX2 direction row). */
export async function getSearchFromLanguage(page: Page): Promise<string> {
  const select = page.locator("#searchSourceLanguage select");
  if ((await select.count()) > 0) {
    return ((await select.locator("option:checked").textContent()) ?? "").trim();
  }
  return ((await page.locator("#searchSourceLanguage").textContent()) ?? "").trim();
}

/**
 * Ensure dictionary source→target search direction.
 * Uses visible UX2 labels (swap button is icon-only).
 */
export async function ensureSourceToTarget(page: Page): Promise<void> {
  const from = await getSearchFromLanguage(page);
  if (/Maninka|Target|Cible|^mnk$/i.test(from)) {
    await page.locator("#langToggle").click();
  }
}

/**
 * Ensure dictionary target→source search direction.
 * Uses visible UX2 labels (swap button is icon-only).
 */
export async function ensureTargetToSource(page: Page): Promise<void> {
  const from = await getSearchFromLanguage(page);
  if (!/Maninka|Target|Cible|^mnk$/i.test(from)) {
    await page.locator("#langToggle").click();
  }
}
