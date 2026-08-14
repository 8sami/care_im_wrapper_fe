import type { Locator } from "@playwright/test";

/**
 * Ported verbatim from care_fe's tests/helper/error.ts.
 *
 * Gets the error message element for a form field.
 * Looks for the error message in the parent element's form-message slot.
 *
 * @param fieldLocator - The form field locator (textbox, combobox, etc.)
 * @returns Locator for the error message element
 *
 * @example
 * const titleField = page.getByRole("textbox", { name: "Title" });
 * const errorMessage = getFieldErrorMessage(titleField);
 * await expect(errorMessage).toBeVisible();
 */
export function getFieldErrorMessage(fieldLocator: Locator): Locator {
  return fieldLocator.locator("..").locator('[data-slot="form-message"]');
}
