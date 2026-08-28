import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { seedEvent } from "tests/helper/seed";
import { expectToast } from "tests/helper/ui";
import { getFacilityId } from "tests/support/facilityId";

test.use({ storageState: "tests/.auth/user.json" });

let facilityId: string;

test.beforeAll(() => {
  facilityId = getFacilityId();
});

function confirmDialog(page: Page) {
  return page.getByRole("alertdialog");
}

test.describe("dispatch notification event", () => {
  test("dispatches pending recipients from the detail page", async ({
    page,
  }) => {
    const title = `Dispatch detail ${Date.now()}`;
    const eventId = seedEvent(title, facilityId);

    await page.goto(
      `/facility/${facilityId}/settings/notifications/${eventId}`,
    );

    await test.step("the button reports how many are waiting", async () => {
      await expect(
        page.getByRole("button", { name: "Dispatch 1 pending" }),
      ).toBeEnabled();
    });

    await test.step("confirming names the count before sending", async () => {
      await page.getByRole("button", { name: "Dispatch 1 pending" }).click();
      await expect(confirmDialog(page)).toContainText(
        "Dispatch to 1 pending recipient(s)?",
      );
      await confirmDialog(page)
        .getByRole("button", { name: "Dispatch", exact: true })
        .click();
    });

    await test.step("the queued count comes back from the API", async () => {
      await expectToast(page, /Queued 1 recipient\(s\) for dispatch/);
    });
  });

  test("offers no dispatch when nothing is pending", async ({ page }) => {
    const title = `Nothing pending ${Date.now()}`;
    const eventId = seedEvent(title, facilityId, { withRecipient: false });

    await test.step("the detail page's button is disabled", async () => {
      await page.goto(
        `/facility/${facilityId}/settings/notifications/${eventId}`,
      );
      await expect(
        page.getByRole("button", { name: "Dispatch 0 pending" }),
      ).toBeDisabled();
    });

    await test.step("the row menu's item is disabled too", async () => {
      await page.goto(`/facility/${facilityId}/settings/notifications`);
      await page
        .locator('[data-slot="table-row"]')
        .filter({ hasText: title })
        .getByRole("button", { name: "Actions" })
        .click();
      await expect(
        page.getByRole("menuitem", { name: "Dispatch" }),
      ).toBeDisabled();
    });
  });
});
