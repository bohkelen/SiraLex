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
