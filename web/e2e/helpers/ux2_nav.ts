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
  action: "corrections" | "search-feedback" | "dictionaries",
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
  await page.locator("#openManageDictionaries").click();
  await page.locator("#manageDictionariesPanel").evaluate((el) => {
    if (el instanceof HTMLDetailsElement) el.open = true;
  });
}

/** Visible search-from language (left label in UX2 direction row). */
export async function getSearchFromLanguage(page: Page): Promise<string> {
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
