import { expect, test } from "@playwright/test";
import type { APIRequestContext, Page } from "@playwright/test";
import { expectToast } from "tests/helper/ui";
import { getApiHeaders, getApiUrl } from "tests/helper/utils";
import { getFacilityId } from "tests/support/facilityId";

test.use({ storageState: "tests/.auth/user.json" });

let facilityId: string;

test.beforeAll(() => {
  facilityId = getFacilityId();
});

const MANUAL_TRIGGER_SLUG = "e2e_manual_notification";
const ACTIVE_TEMPLATE_SLUG = "e2e_active_template";

/**
 * Creates an event straight through the API — the create form is covered by its own spec, and
 * going through it here would make every dispatch test depend on that flow still working.
 *
 * `withRecipient: false` produces an event with nothing to send, which is how the "nothing
 * pending" states are reached without touching the database.
 */
async function createEvent(
  request: APIRequestContext,
  title: string,
  { withRecipient = true }: { withRecipient?: boolean } = {},
): Promise<string> {
  let recipientIds: string[] = [];

  if (withRecipient) {
    const patients = await request.get(
      `${getApiUrl()}/api/v1/patient/?limit=1`,
      {
        headers: getApiHeaders(),
      },
    );
    expect(patients.ok(), "could not read a patient to notify").toBeTruthy();
    recipientIds = [(await patients.json()).results[0].id];
  }

  const response = await request.post(
    `${getApiUrl()}/api/care_im_wrapper/notification-events/`,
    {
      headers: getApiHeaders(),
      data: {
        title,
        trigger_slug: MANUAL_TRIGGER_SLUG,
        template_slug: ACTIVE_TEMPLATE_SLUG,
        facility: facilityId,
        recipient_patient_ids: recipientIds,
      },
    },
  );
  expect(
    response.ok(),
    `could not seed an event: ${response.status()} ${await response.text()}`,
  ).toBeTruthy();

  return (await response.json()).id;
}

function confirmDialog(page: Page) {
  return page.getByRole("alertdialog");
}

test.describe("dispatch notification event", () => {
  test("dispatches pending recipients from the detail page", async ({
    page,
    request,
  }) => {
    const title = `Dispatch detail ${Date.now()}`;
    const eventId = await createEvent(request, title);

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

  test("offers no dispatch when nothing is pending", async ({
    page,
    request,
  }) => {
    const title = `Nothing pending ${Date.now()}`;
    const eventId = await createEvent(request, title, { withRecipient: false });

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
