import { Page, expect } from "@playwright/test";

// Ported from care_fe's tests/helper/ui.ts. Only the three helpers this plugin's screens
// actually need are here.
//
// care_fe's selectFromCommand is deliberately NOT ported: no screen here renders a
// <Command> behind a trigger for it to open.

/**
 * Asserts a toast with the given text is visible. The toaster belongs to care_fe -- the
 * plugin's `toast()` calls reach it because sonner is a shared federation dependency.
 */
export async function expectToast(
  page: Page,
  text: string | RegExp,
  options: { timeout?: number } = {},
) {
  const toaster = page.locator(".toaster.group");
  await expect(toaster.getByText(text)).toBeVisible(options);
}

/**
 * Gets a card element by its title
 * @param page - Playwright page object
 * @param title - Card title to search for (can be string or RegExp)
 * @returns Locator for the card element
 */
export function getCardByTitle(page: Page, title: string | RegExp) {
  return page.locator('[data-slot="card"]').filter({
    has: page.locator('[data-slot="card-title"]', { hasText: title }),
  });
}

/**
 * Asserts every row of the table carries a badge with `badgeText`, and optionally that a
 * row matching `specificRowText` is present.
 */
export async function verifyTableBadges(
  page: Page,
  badgeText: string,
  specificRowText?: string,
) {
  const tableBody = page.locator('[data-slot="table-body"]');
  const tableBodyRows = tableBody.locator('[data-slot="table-row"]');
  const rowCount = await tableBodyRows.count();

  if (rowCount > 0) {
    const badges = tableBody
      .locator('[data-slot="badge"]')
      .filter({ hasText: badgeText });
    await expect(badges).toHaveCount(rowCount);
  }

  if (specificRowText) {
    const specificRow = page.locator('[data-slot="table-row"]', {
      hasText: specificRowText,
    });
    await expect(specificRow).toBeVisible();
  }
}
