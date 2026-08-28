import { expect, test } from "@playwright/test";
import { expectToast } from "tests/helper/ui";

test.use({ storageState: "tests/.auth/user.json" });

// Seeded by the backend's seed_notification_test_data command, which also restores their
// is_active flags on teardown — so the toggle below is safe to leave flipped.
const ACTIVE_TEMPLATE = "E2E Active Template";
const INACTIVE_TEMPLATE = "E2E Inactive Template";

test.describe("notification templates", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/notification-templates");
    await expect(
      page.getByRole("heading", { name: "Notification templates" }),
    ).toBeVisible();
  });

  test("activating a template flips its state", async ({ page }) => {
    // Whether a template is active is what decides if a trigger can render through it,
    // so this toggle is the plugin's real gate on which messages can be sent.
    const row = page
      .locator('[data-slot="table-row"]')
      .filter({ hasText: INACTIVE_TEMPLATE });

    await test.step("it starts inactive", async () => {
      await expect(row).toBeVisible();
      await row.getByRole("button", { name: "Actions" }).click();
      await expect(
        page.getByRole("menuitem", { name: "Activate" }),
      ).toBeVisible();
    });

    await test.step("activating it reports success", async () => {
      await page.getByRole("menuitem", { name: "Activate" }).click();
      await expectToast(page, "Template updated");
    });

    await test.step("the menu now offers the reverse", async () => {
      await row.getByRole("button", { name: "Actions" }).click();
      await expect(
        page.getByRole("menuitem", { name: "Deactivate" }),
      ).toBeVisible();
    });
  });

  test("a template opens its variable mapping", async ({ page }) => {
    await page
      .locator('[data-slot="table-row"]')
      .filter({ hasText: ACTIVE_TEMPLATE })
      .click();

    await expect(page).toHaveURL(
      /\/admin\/notification-templates\/.+\/variables$/,
    );
    await expect(
      page.getByRole("heading", { name: "Variable mapping" }),
    ).toBeVisible();
  });
});
